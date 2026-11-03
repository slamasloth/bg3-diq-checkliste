import { describe, expect, it } from 'vitest'
import { Clock, MAX_AHEAD_MS } from './clock'
import { SyncEngine } from './engine'
import { isWellFormed, LIMITS } from './validate'
import type { SyncTransport, WireChange } from './types'

const ok: WireChange = { kind: 'checked', id: 'abc-123_X', c: true, t: 1_700_000_000_000 * 1024 }

describe('isWellFormed (untrusted input)', () => {
  it('accepts normal changes', () => {
    expect(isWellFormed(ok)).toBe(true)
    expect(isWellFormed({ kind: 'assign', id: 'diq-eq-8268e3c2dd6c3201', member: 'p1', note: 'Ring', t: 5 })).toBe(true)
    expect(isWellFormed({ kind: 'member', id: 'p1', name: 'Player 1', figure: 'Karlach', removed: false, t: 5 })).toBe(true)
  })
  it('rejects oversized fields (storage abuse found in the red-team run)', () => {
    expect(isWellFormed({ kind: 'assign', id: 'a', member: 'm'.repeat(LIMITS.member + 1), note: '', t: 5 })).toBe(false)
    expect(isWellFormed({ kind: 'assign', id: 'a', member: '', note: 'n'.repeat(LIMITS.note + 1), t: 5 })).toBe(false)
    expect(isWellFormed({ kind: 'member', id: 'i'.repeat(50_000), name: 'x', figure: '', removed: false, t: 5 })).toBe(false)
    expect(isWellFormed({ kind: 'checked', id: 'x'.repeat(LIMITS.id + 1), c: true, t: 5 })).toBe(false)
  })
  it('rejects ids with markup or odd characters', () => {
    expect(isWellFormed({ ...ok, id: '<img src=x onerror=alert(1)>' })).toBe(false)
    expect(isWellFormed({ ...ok, id: '' })).toBe(false)
  })
  it('rejects wrong types and unknown kinds', () => {
    expect(isWellFormed({ ...ok, c: 'yes' } as unknown as WireChange)).toBe(false)
    expect(isWellFormed({ kind: 'drop table', id: 'x', t: 5 } as unknown as WireChange)).toBe(false)
    expect(isWellFormed({ ...ok, t: 1.5 })).toBe(false)
    expect(isWellFormed({ ...ok, t: -1 })).toBe(false)
  })
})

describe('timestamp poisoning', () => {
  const now = () => 1_700_000_000_000
  it('Clock.isPlausible rejects absurd or unsafe timestamps', () => {
    const c = new Clock(now, 3)
    expect(c.isPlausible(now() * 1024)).toBe(true)
    expect(c.isPlausible((now() + MAX_AHEAD_MS / 2) * 1024)).toBe(true)
    expect(c.isPlausible(Number.MAX_SAFE_INTEGER)).toBe(false) // the value the red team wrote to the real server
    expect(c.isPlausible(Number.MAX_SAFE_INTEGER + 2)).toBe(false)
    expect(c.isPlausible(0)).toBe(false)
  })
  it('observe() ignores a poisoned timestamp, so the clock stays usable', () => {
    const c = new Clock(now, 3)
    c.observe(Number.MAX_SAFE_INTEGER)
    const t = c.next()
    expect(t).toBe(now() * 1024 + 3)
    expect(Number.isSafeInteger(t)).toBe(true)
  })
  it('the engine drops poisoned and malformed changes from the server instead of applying them', async () => {
    const poisoned: WireChange[] = [
      { kind: 'checked', id: 'sec-future', c: true, t: Number.MAX_SAFE_INTEGER },
      { kind: 'assign', id: 'sec-big', member: 'm'.repeat(100_000), note: '', t: 1_700_000_000_000 * 1024 },
      { kind: 'checked', id: 'fine', c: true, t: 1_700_000_000_000 * 1024 },
    ]
    const transport: SyncTransport = { pull: async () => poisoned, push: async () => {}, subscribe: () => () => {} }
    const applied: WireChange[] = []
    const clock = new Clock(now, 1)
    const engine = new SyncEngine({
      transport, clock, schedule: () => () => {},
      outbox: { load: () => [], save: () => {} },
      io: { applyRemote: (cs) => applied.push(...cs), snapshot: () => [] },
    })
    await engine.connect({ seedLocal: false })
    expect(applied.map((c) => c.id)).toEqual(['fine'])
    expect(engine.rejected).toBe(2)
    expect(Number.isSafeInteger(clock.next())).toBe(true)
  })
})
