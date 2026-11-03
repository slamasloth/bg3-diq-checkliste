import { describe, expect, it } from 'vitest'
import { applyChange, stateToChanges } from '../logic'
import { emptyState, type PersistedState } from '../schema'
import { Clock } from './clock'
import { SyncEngine } from './engine'
import { changeKey, type OutboxStore, type SyncTransport, type WireChange } from './types'

/** Fake-Server: bildet die Regel von `apply_changes` nach (neuerer Zeitstempel gewinnt) und verteilt Echtzeit-Nachrichten. */
class FakeServer {
  readonly rows = new Map<string, WireChange>()
  private readonly subs = new Set<{ fn: (c: WireChange) => void; link: Link }>()
  pushes = 0

  apply(c: WireChange): void {
    const cur = this.rows.get(changeKey(c))
    if (!cur || cur.t < c.t) this.rows.set(changeKey(c), c)
  }
  connect(): { transport: SyncTransport; link: Link } {
    const link: Link = { online: true }
    const guard = () => { if (!link.online) throw new Error('offline') }
    const transport: SyncTransport = {
      pull: async () => { guard(); return [...this.rows.values()] },
      push: async (batch) => {
        guard()
        this.pushes++
        for (const c of batch) {
          this.apply(c)
          for (const s of this.subs) if (s.link.online) s.fn(c) // inkl. Echo an den Absender
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
interface Link { online: boolean }

const memoryOutbox = (initial: WireChange[] = []): OutboxStore & { data: WireChange[] } => {
  const o = { data: initial, load: () => o.data, save: (c: WireChange[]) => { o.data = c } }
  return o
}

/** Manueller Planer: Wiederholungen laufen erst, wenn der Test sie ausloest. */
const manualScheduler = () => {
  const tasks: { fn: () => void; ms: number; live: boolean }[] = []
  return {
    schedule: (fn: () => void, ms: number) => {
      const t = { fn, ms, live: true }
      tasks.push(t)
      return () => { t.live = false }
    },
    pending: () => tasks.filter((t) => t.live),
    runNext: async () => {
      const t = tasks.find((x) => x.live)
      if (!t) return
      t.live = false
      t.fn()
      await settle()
    },
  }
}
const settle = () => new Promise((r) => setTimeout(r, 0))

function device(server: FakeServer, opts: { initial?: PersistedState; outbox?: WireChange[]; now?: () => number } = {}) {
  const state = opts.initial ?? emptyState()
  const { transport, link } = server.connect()
  const sched = manualScheduler()
  const clock = new Clock(opts.now ?? (() => Date.now()))
  const outbox = memoryOutbox(opts.outbox)
  const engine = new SyncEngine({
    transport, outbox, clock, schedule: sched.schedule,
    io: {
      applyRemote: (cs) => { for (const c of cs) applyChange(state, c) },
      snapshot: () => stateToChanges(state),
    },
  })
  // Lokale Aktion wie in der App: erst lokal anwenden, dann in die Outbox.
  const act = (make: (t: number) => WireChange) => {
    const c = make(clock.next())
    applyChange(state, c)
    engine.enqueue(c)
  }
  return { state, engine, link, sched, outbox, act }
}

const check = (id: string, c: boolean) => (t: number): WireChange => ({ kind: 'checked', id, c, t })

describe('Sync zwischen zwei Geraeten', () => {
  it('Aenderung von A erscheint bei B in Echtzeit', async () => {
    const server = new FakeServer()
    const a = device(server)
    const b = device(server)
    await a.engine.connect({ seedLocal: false })
    await b.engine.connect({ seedLocal: false })
    a.act(check('x', true))
    await settle()
    expect(b.state.checked.x?.c).toBe(true)
  })

  it('Offline-Aenderungen bleiben in der Outbox und werden nach Wiederverbinden gesendet', async () => {
    const server = new FakeServer()
    const a = device(server)
    const b = device(server)
    await a.engine.connect({ seedLocal: false })
    await b.engine.connect({ seedLocal: false })
    a.link.online = false
    a.act(check('x', true))
    await settle()
    expect(a.engine.status).toEqual({ state: 'offline', pending: 1 })
    expect(a.outbox.data).toHaveLength(1)
    expect(b.state.checked.x).toBeUndefined()
    a.link.online = true
    await a.sched.runNext() // Wiederholung
    expect(a.engine.status).toEqual({ state: 'idle', pending: 0 })
    expect(b.state.checked.x?.c).toBe(true)
  })

  it('Neuer Stand des Servers wird beim Verbinden uebernommen (auch verpasste Aenderungen)', async () => {
    const server = new FakeServer()
    const a = device(server)
    const b = device(server)
    await a.engine.connect({ seedLocal: false })
    b.link.online = false // B verpasst die Nachricht
    a.act(check('x', true))
    await settle()
    b.link.online = true
    await b.engine.connect({ seedLocal: false })
    expect(b.state.checked.x?.c).toBe(true)
  })

  it('Aelterer Stempel ueberschreibt keinen neueren (Offline-Nachzuegler)', async () => {
    const server = new FakeServer()
    let clockA = 1000
    const a = device(server, { now: () => clockA })
    const b = device(server, { now: () => 5000 })
    await a.engine.connect({ seedLocal: false })
    await b.engine.connect({ seedLocal: false })
    a.link.online = false
    a.act(check('x', false)) // t=1000, offline
    b.act(check('x', true)) // t=5000
    await settle()
    clockA = 1100
    a.link.online = true
    await a.sched.runNext()
    expect(server.rows.get('checked:x')).toMatchObject({ c: true, t: 5000 })
    expect(a.state.checked.x?.c).toBe(false) // A kennt den Stand von B noch nicht ...
    await a.engine.connect({ seedLocal: false }) // ... bis zum naechsten Abgleich
    expect(a.state.checked.x?.c).toBe(true)
  })

  it('Fuer denselben Eintrag wird nur die neueste Aenderung gesendet', async () => {
    const server = new FakeServer()
    const a = device(server)
    await a.engine.connect({ seedLocal: false })
    a.link.online = false
    for (let i = 0; i < 5; i++) a.act(check('x', i % 2 === 0))
    await settle()
    expect(a.engine.status.pending).toBe(1)
  })

  it('Erster Kontakt sendet den lokalen Stand (seedLocal)', async () => {
    const server = new FakeServer()
    const initial = emptyState()
    initial.checked.a = { c: true, t: 10 }
    initial.assign.a = { member: 'p1', note: 'Ring', t: 11 }
    initial.party.push({ id: 'p1', name: 'S1', figure: 'Karlach', removed: false, t: 9 })
    const a = device(server, { initial })
    const b = device(server)
    await b.engine.connect({ seedLocal: false })
    await a.engine.connect({ seedLocal: true })
    expect(b.state.checked.a?.c).toBe(true)
    expect(b.state.assign.a?.note).toBe('Ring')
    expect(b.state.party).toHaveLength(1)
  })

  it('Entferntes Mitglied (Grabstein) taucht nicht wieder auf', async () => {
    const server = new FakeServer()
    const a = device(server)
    const b = device(server)
    await a.engine.connect({ seedLocal: false })
    await b.engine.connect({ seedLocal: false })
    a.act((t) => ({ kind: 'member', id: 'p1', name: 'S1', figure: 'K', removed: false, t }))
    await settle()
    a.act((t) => ({ kind: 'member', id: 'p1', name: 'S1', figure: 'K', removed: true, t }))
    await settle()
    expect(b.state.party[0]?.removed).toBe(true)
    // verspaetet eintreffende alte Nachricht aendert nichts
    applyChange(b.state, { kind: 'member', id: 'p1', name: 'S1', figure: 'K', removed: false, t: 1 })
    expect(b.state.party[0]?.removed).toBe(true)
  })

  it('Doppelte Zustellung ist harmlos', async () => {
    const server = new FakeServer()
    const a = device(server)
    await a.engine.connect({ seedLocal: false })
    const c: WireChange = { kind: 'checked', id: 'x', c: true, t: 50 }
    expect(applyChange(a.state, c)).toBe(true)
    expect(applyChange(a.state, c)).toBe(false)
  })
})

describe('Wiederholung', () => {
  it('Wartezeit waechst und wird bei Erfolg zurueckgesetzt', async () => {
    const server = new FakeServer()
    const a = device(server)
    await a.engine.connect({ seedLocal: false })
    a.link.online = false
    a.act(check('x', true))
    await settle()
    expect(a.sched.pending().map((t) => t.ms)).toEqual([1000])
    await a.sched.runNext()
    expect(a.sched.pending().map((t) => t.ms)).toEqual([2000])
    await a.sched.runNext()
    expect(a.sched.pending().map((t) => t.ms)).toEqual([4000])
    a.link.online = true
    await a.sched.runNext()
    expect(a.engine.status).toEqual({ state: 'idle', pending: 0 })
    a.link.online = false
    a.act(check('y', true))
    await settle()
    expect(a.sched.pending().map((t) => t.ms)).toEqual([1000])
  })

  it('Outbox ueberlebt einen Neustart', async () => {
    const server = new FakeServer()
    const pending: WireChange[] = [{ kind: 'checked', id: 'x', c: true, t: 77 }]
    const a = device(server, { outbox: pending })
    expect(a.engine.status.pending).toBe(1)
    await a.engine.connect({ seedLocal: false })
    expect(server.rows.get('checked:x')).toMatchObject({ c: true, t: 77 })
    expect(a.outbox.data).toHaveLength(0)
  })

  it('Pakete sind nach batchSize begrenzt', async () => {
    const server = new FakeServer()
    const { transport } = server.connect()
    const engine = new SyncEngine({
      transport, outbox: memoryOutbox(), batchSize: 2, schedule: () => () => {},
      io: { applyRemote: () => {}, snapshot: () => [] },
    })
    await engine.connect({ seedLocal: false })
    for (let i = 1; i <= 5; i++) engine.enqueue({ kind: 'checked', id: `i${i}`, c: true, t: i })
    await settle()
    expect(server.pushes).toBeGreaterThanOrEqual(3)
    expect(server.rows.size).toBe(5)
  })
})

describe('Clock', () => {
  it('ist streng monoton, auch bei stehender oder zurueckgehender Uhr', () => {
    let now = 100
    const c = new Clock(() => now)
    const a = c.next()
    const b = c.next()
    now = 50
    const d = c.next()
    expect(b).toBeGreaterThan(a)
    expect(d).toBeGreaterThan(b)
  })
  it('ueberholt gesehene fremde Stempel', () => {
    const c = new Clock(() => 100)
    c.observe(9000)
    expect(c.next()).toBeGreaterThan(9000)
  })
})
