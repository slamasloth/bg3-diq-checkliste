import { describe, expect, it } from 'vitest'
import { applyChange, stateToChanges } from '../logic'
import { emptyState, type PersistedState } from '../schema'
import { Clock } from './clock'
import { SyncEngine } from './engine'
import { changeKey, type OutboxStore, type SyncTransport, type WireChange } from './types'

/**
 * Model-based randomized test (fault injection). Several devices make random changes while the network
 * drops, duplicates and delays messages and goes offline; clocks disagree by a few milliseconds.
 * Invariants checked after the network heals:
 *   1. Convergence: every device ends with exactly the server's state.
 *   2. No lost update: for each entry the server holds the change with the highest timestamp ever issued.
 */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

interface Faults { drop: number; dup: number }

class Server {
  rows = new Map<string, WireChange>()
  subs = new Set<{ fn: (c: WireChange) => void; link: { online: boolean } }>()
  faults: Faults = { drop: 0, dup: 0 }
  constructor(private rand: () => number) {}
  apply(c: WireChange) {
    const cur = this.rows.get(changeKey(c))
    if (!cur || cur.t < c.t) this.rows.set(changeKey(c), c) // same rule as apply_changes in SQL: strictly newer wins
  }
  connect() {
    const link = { online: true }
    const transport: SyncTransport = {
      pull: async () => { if (!link.online) throw new Error('offline'); return [...this.rows.values()] },
      push: async (batch) => {
        if (!link.online) throw new Error('offline')
        for (const c of batch) {
          this.apply(c)
          for (const s of this.subs) {
            if (!s.link.online || this.rand() < this.faults.drop) continue
            s.fn(c)
            if (this.rand() < this.faults.dup) s.fn(c)
          }
        }
      },
      subscribe: (fn) => {
        const sub = { fn, link }
        this.subs.add(sub)
        return () => this.subs.delete(sub)
      },
    }
    return { transport, link }
  }
}

const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

function makeDevice(server: Server, id: number, clockNow: () => number) {
  const state: PersistedState = emptyState()
  const { transport, link } = server.connect()
  const retries: (() => void)[] = []
  let outboxData: WireChange[] = []
  const outbox: OutboxStore = { load: () => outboxData, save: (c) => { outboxData = c } }
  const clock = new Clock(clockNow, id)
  const engine = new SyncEngine({
    transport, outbox, clock,
    schedule: (fn) => { retries.push(fn); return () => { const i = retries.indexOf(fn); if (i >= 0) retries.splice(i, 1) } },
    io: { applyRemote: (cs) => { for (const c of cs) applyChange(state, c) }, snapshot: () => stateToChanges(state) },
  })
  return { state, engine, link, clock, runRetries: () => retries.splice(0).forEach((f) => f()) }
}

const KEYS = ['a', 'b', 'c', 'd', 'e']

async function simulate(seed: number, devices = 3, steps = 70) {
  const rand = mulberry32(seed)
  const server = new Server(rand)
  server.faults = { drop: 0.25, dup: 0.15 }
  let tick = 1_000
  const skew = Array.from({ length: devices }, () => Math.floor(rand() * 4)) // up to 3 ms apart
  const devs = skew.map((s, i) => makeDevice(server, i, () => tick + s))
  const best = new Map<string, WireChange>()
  for (const d of devs) await d.engine.connect({ seedLocal: false })

  for (let i = 0; i < steps; i++) {
    const d = devs[Math.floor(rand() * devices)]
    const r = rand()
    if (r < 0.5) {
      const k = KEYS[Math.floor(rand() * KEYS.length)]
      const kind = rand()
      const t = d.clock.next()
      const c: WireChange = kind < 0.5
        ? { kind: 'checked', id: k, c: rand() < 0.5, t }
        : kind < 0.85
          ? { kind: 'assign', id: k, member: rand() < 0.5 ? 'p1' : 'p2', note: String(Math.floor(rand() * 9)), t }
          : { kind: 'member', id: 'm' + (Math.floor(rand() * 2)), name: 'n' + Math.floor(rand() * 9), figure: '', removed: rand() < 0.3, t }
      applyChange(d.state, c)
      d.engine.enqueue(c)
      const key = changeKey(c)
      if (!best.has(key) || best.get(key)!.t < c.t) best.set(key, c)
    } else if (r < 0.65) d.link.online = !d.link.online
    else if (r < 0.8) d.runRetries()
    else tick += Math.floor(rand() * 3) // time passes slowly, so equal timestamps are likely
    await settle()
  }

  // Heal the network and let the engines do their own recovery work.
  server.faults = { drop: 0, dup: 0 }
  for (const d of devs) d.link.online = true
  for (let round = 0; round < 4; round++) {
    for (const d of devs) { d.runRetries(); await d.engine.flush(); await d.engine.reconcile() }
    await settle()
  }
  return { server, devs, best }
}

const canon = (cs: WireChange[]) => cs.map((c) => JSON.stringify(c, Object.keys(c).sort())).sort()

describe('sync under faults (randomized, seeded)', () => {
  const seeds = Array.from({ length: 300 }, (_, i) => i + 1)

  it('all devices converge to the server state', async () => {
    const failures: string[] = []
    for (const seed of seeds) {
      const { server, devs } = await simulate(seed)
      const want = canon([...server.rows.values()])
      devs.forEach((d, i) => {
        const got = canon(stateToChanges(d.state))
        if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`seed ${seed} device ${i} differs from server`)
      })
    }
    expect(failures.slice(0, 5)).toEqual([])
  })

  it('the server keeps the newest change ever issued for every entry', async () => {
    const failures: string[] = []
    for (const seed of seeds) {
      const { server, best } = await simulate(seed)
      for (const [k, c] of best) if (server.rows.get(k)?.t !== c.t) failures.push(`seed ${seed} key ${k}`)
    }
    expect(failures.slice(0, 5)).toEqual([])
  })

  it('timestamps issued by different devices never collide', () => {
    const t = 5_000
    const a = new Clock(() => t, 1)
    const b = new Clock(() => t, 2)
    const seen = new Set<number>()
    for (let i = 0; i < 200; i++) { seen.add(a.next()); seen.add(b.next()) }
    expect(seen.size).toBe(400)
  })
})
