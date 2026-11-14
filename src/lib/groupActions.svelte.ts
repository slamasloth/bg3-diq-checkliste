import { SvelteMap } from 'svelte/reactivity'
import type { Row } from './schema'
import { describe, describeUndo, planAssign, planMarkDone, runPlan, runUndo, type Ops, type Plan, type State } from './batch'
import { allCharacters, isChecked, memberOf, noteOf, setAssign, setChecked } from './store.svelte'
import { characterLabel } from './roster'

/** Selection mode (S3): which rows are picked on the region page. Not stored, not synchronised. */
export const selection: { on: boolean; rows: SvelteMap<string, Row> } = $state({ on: false, rows: new SvelteMap() })

export const startSelect = () => { selection.on = true; selection.rows.clear() }
export const cancelSelect = () => { selection.on = false; selection.rows.clear() }
export function toggleRow(row: Row, on: boolean): void {
  if (on) selection.rows.set(row.id, row)
  else selection.rows.delete(row.id)
}
export function setGroup(rows: Row[], on: boolean): void {
  for (const r of rows) toggleRow(r, on)
}

/** One toast at a time, with the undo of the last group action. The action itself is permanent; only the offer expires. */
export const toast: { text: string; undo: (() => void) | null; seq: number } = $state({ text: '', undo: null, seq: 0 })
const UNDO_MS = 10_000 // >= 8 s (design system)
let timer: ReturnType<typeof setTimeout> | undefined

export function showToast(text: string, undo: (() => void) | null = null, ms = undo ? UNDO_MS : 5000): void {
  clearTimeout(timer)
  toast.text = text
  toast.undo = undo
  toast.seq++
  timer = setTimeout(dismissToast, ms)
}
export function dismissToast(): void {
  clearTimeout(timer)
  toast.text = ''
  toast.undo = null
}

const ops: Ops = { setChecked, setAssign }
const state: State = { isChecked, assignOf: (id) => ({ member: memberOf(id), note: noteOf(id) }) }

function perform(plan: Plan, memberName?: string): void {
  const n = runPlan(plan, ops)
  if (n === 0) { showToast(describe(plan, 0)); return }
  showToast(describe(plan, n, memberName), () => {
    const r = runUndo(plan, state, ops)
    showToast(describeUndo(r))
  })
}

/** "Mark all done" for the given (visible) rows; only the open ones change. */
export const markDone = (rows: Row[]): void => perform(planMarkDone(rows, state))

/** Assign every item among the rows to one character. */
export function assignTo(rows: Row[], member: string): void {
  const who = allCharacters().find((c) => c.id === member)
  perform(planAssign(rows, state, member), who ? characterLabel(who) : undefined)
}

export const openCount = (rows: Iterable<Row>): number => { let n = 0; for (const r of rows) if (!isChecked(r.id)) n++; return n }
