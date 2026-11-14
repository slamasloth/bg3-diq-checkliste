import { describe, expect, it } from 'vitest'
import { describe as text, describeUndo, planAssign, planMarkDone, runPlan, runUndo, type Ops } from './batch'
import { applyChange } from './logic'
import { emptyState, type PersistedState, type Row } from './schema'
import { Clock } from './sync/clock'
import type { WireChange } from './sync/types'
import { nextMissables, openMissables } from './counts'
import type { Region } from './schema'

const row = (id: string, p: Partial<Row> = {}) => ({ id, kind: 'task', text: id, verification: 'sourced', depth: 0, origin: 'base', ...p }) as Row

/** A device: its own state and clock; every local change is recorded as one WireChange (like the store's sink). */
function device(node: number, now: () => number) {
  const s: PersistedState = emptyState()
  const clock = new Clock(now, node)
  const sent: WireChange[] = []
  const commit = (c: WireChange) => { applyChange(s, c); sent.push(c) }
  const ops: Ops = {
    setChecked: (id, c) => commit({ kind: 'checked', id, c, t: clock.next() }),
    setAssign: (id, patch) => {
      const cur = s.assign[id]
      commit({ kind: 'assign', id, member: patch.member ?? cur?.member ?? '', note: patch.note ?? cur?.note ?? '', t: clock.next() })
    },
  }
  const st = {
    isChecked: (id: string) => Boolean(s.checked[id]?.c),
    assignOf: (id: string) => ({ member: s.assign[id]?.member ?? '', note: s.assign[id]?.note ?? '' }),
  }
  const receive = (cs: WireChange[]) => cs.forEach((c) => { clock.observe(c.t); applyChange(s, c) })
  return { s, ops, st, sent, receive }
}

describe('planMarkDone / runPlan', () => {
  it('plans only open rows and writes one change per row', () => {
    const a = device(1, () => 1000)
    a.ops.setChecked('b', true)
    a.sent.length = 0
    const plan = planMarkDone([row('a'), row('b'), row('c')], a.st)
    expect(plan.entries.map((e) => e.id)).toEqual(['a', 'c'])
    expect(runPlan(plan, a.ops)).toBe(2)
    expect(a.sent.map((c) => c.kind)).toEqual(['checked', 'checked'])
    expect(a.sent.map((c) => c.id)).toEqual(['a', 'c'])
    expect(new Set(a.sent.map((c) => c.t)).size).toBe(2) // own timestamp per row
    expect(['a', 'b', 'c'].every((id) => a.st.isChecked(id))).toBe(true)
  })
  it('an empty plan changes nothing', () => {
    const a = device(1, () => 1000)
    const plan = planMarkDone([], a.st)
    expect(runPlan(plan, a.ops)).toBe(0)
    expect(a.sent).toEqual([])
    expect(text(plan, 0)).toMatch(/nothing/i)
  })
})

describe('planAssign', () => {
  it('only items, skips rows already with that character, keeps notes', () => {
    const a = device(1, () => 1000)
    a.ops.setAssign('i2', { member: 'c-x', note: 'keep me' })
    a.ops.setAssign('i3', { member: 'c-y', note: '' })
    a.sent.length = 0
    const rows = [row('i1', { kind: 'item' }), row('i2', { kind: 'item' }), row('i3', { kind: 'item' }), row('t1')]
    const plan = planAssign(rows, a.st, 'c-x')
    expect(plan.entries.map((e) => e.id)).toEqual(['i1', 'i3'])
    runPlan(plan, a.ops)
    expect(a.sent.length).toBe(2)
    expect(a.st.assignOf('i1').member).toBe('c-x')
    expect(a.st.assignOf('i3')).toEqual({ member: 'c-x', note: '' })
    expect(a.st.assignOf('i2').note).toBe('keep me')
    expect(a.st.assignOf('t1').member).toBe('')
  })
})

describe('undo', () => {
  it('restores the earlier state of every row', () => {
    let now = 1000
    const a = device(1, () => now)
    const plan = planMarkDone([row('a'), row('b')], a.st)
    runPlan(plan, a.ops)
    now += 5
    expect(runUndo(plan, a.st, a.ops)).toEqual({ restored: 2, skipped: 0 })
    expect(a.st.isChecked('a') || a.st.isChecked('b')).toBe(false)
  })
  it('restores previous assignments, also those that were empty', () => {
    const a = device(1, () => 1000)
    a.ops.setAssign('i1', { member: 'c-y', note: '' })
    const plan = planAssign([row('i1', { kind: 'item' }), row('i2', { kind: 'item' })], a.st, 'c-x')
    runPlan(plan, a.ops)
    runUndo(plan, a.st, a.ops)
    expect(a.st.assignOf('i1').member).toBe('c-y')
    expect(a.st.assignOf('i2').member).toBe('')
  })
  it('skips a row that changed meanwhile and says so', () => {
    const a = device(1, () => 1000)
    const plan = planMarkDone([row('a'), row('b')], a.st)
    runPlan(plan, a.ops)
    a.ops.setChecked('b', false) // changed after the action (e.g. by the other device)
    const r = runUndo(plan, a.st, a.ops)
    expect(r).toEqual({ restored: 1, skipped: 1 })
    expect(describeUndo(r)).toBe('Undid 1 of 2, 1 changed meanwhile')
    expect(a.st.isChecked('a')).toBe(false)
  })
  it('keeps a note typed after an assign when undoing it', () => {
    const a = device(1, () => 1000)
    const plan = planAssign([row('i1', { kind: 'item' })], a.st, 'c-x')
    runPlan(plan, a.ops)
    a.ops.setAssign('i1', { note: 'typed later' })
    runUndo(plan, a.st, a.ops)
    expect(a.st.assignOf('i1')).toEqual({ member: '', note: 'typed later' })
  })
})

describe('two devices', () => {
  it('a batch and its undo converge on both devices, and the other device is never overwritten', () => {
    let nowA = 5000
    let nowB = 5003 // clocks disagree slightly
    const A = device(1, () => nowA)
    const B = device(2, () => nowB)
    const rows = ['a', 'b', 'c', 'd'].map((id) => row(id))

    const plan = planMarkDone(rows, A.st)
    runPlan(plan, A.ops)
    B.receive(A.sent.splice(0)) // B gets the batch
    expect(rows.every((r) => B.st.isChecked(r.id))).toBe(true)

    nowB += 10
    B.ops.setChecked('c', false) // B reopens one row
    nowA += 20
    A.receive(B.sent.splice(0)) // A hears about it before undoing

    nowA += 5
    const r = runUndo(plan, A.st, A.ops)
    expect(r).toEqual({ restored: 3, skipped: 1 }) // c changed meanwhile
    B.receive(A.sent.splice(0))

    for (const id of ['a', 'b', 'c', 'd']) {
      expect(A.st.isChecked(id)).toBe(B.st.isChecked(id)) // converged
      expect(A.st.isChecked(id)).toBe(false)
    }
  })
  it('if the other device acts before it hears of the batch, the newer change still wins on both', () => {
    const nowA = 9000
    let nowB = 9000
    const A = device(1, () => nowA)
    const B = device(2, () => nowB)
    const plan = planMarkDone([row('a'), row('b')], A.st)
    runPlan(plan, A.ops)
    nowB += 50
    B.ops.setChecked('a', false) // B, not yet knowing, writes later
    const aChanges = A.sent.splice(0)
    const bChanges = B.sent.splice(0)
    B.receive(aChanges)
    A.receive(bChanges)
    expect(A.st.isChecked('a')).toBe(false)
    expect(B.st.isChecked('a')).toBe(false)
    expect(A.st.isChecked('b')).toBe(true)
    expect(B.st.isChecked('b')).toBe(true)
  })
})

describe('Today counters', () => {
  const g = (id: string, act: string, base: Row[], mod: Row[] = []) => ({ id, title: id, act, base, mod }) as Region
  const regions = [
    g('r1', 'Act 1', [row('a', { missable: true }), row('b'), row('c', { missable: true })]),
    g('r2', 'Act 2', [row('x', { missable: true })]),
    g('r3', 'Act 1', [row('d', { kind: 'missable' })], [row('e', { missable: true })]),
  ]
  const done = (ids: string[]) => (id: string) => ids.includes(id)
  it('lists the next open missables of the act in data order', () => {
    expect(nextMissables(regions, 'Act 1', done(['a']), 5).map((x) => x.row.id)).toEqual(['c', 'd', 'e'])
    expect(nextMissables(regions, 'Act 1', done([]), 2).map((x) => x.row.id)).toEqual(['a', 'c'])
    expect(nextMissables(regions, 'Act 1', done([]), 2)[0].region.id).toBe('r1')
  })
  it('counts open missables of one act only', () => {
    expect(openMissables(regions, 'Act 1', done(['a']))).toBe(3)
    expect(openMissables(regions, 'Act 2', done([]))).toBe(1)
    expect(openMissables(regions, 'Act 3', done([]))).toBe(0)
  })
})
