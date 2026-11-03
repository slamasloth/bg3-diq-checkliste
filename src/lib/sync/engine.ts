import { Clock } from './clock'
import { isWellFormed } from './validate'
import { changeKey, type OutboxStore, type SyncStatus, type SyncTransport, type WireChange } from './types'

/** Anbindung an den lokalen Zustand der App. */
export interface EngineIO {
  /** Fremde Aenderungen anwenden (neuerer Zeitstempel gewinnt). */
  applyRemote(changes: WireChange[]): void
  /** Gesamter lokaler Stand als Aenderungen (fuer das erste Verbinden). */
  snapshot(): WireChange[]
}

export interface EngineOptions {
  transport: SyncTransport
  outbox: OutboxStore
  io: EngineIO
  clock?: Clock
  /** Planer fuer Wiederholungen; gibt eine Abbruchfunktion zurueck. In Tests ersetzbar. */
  schedule?: (fn: () => void, ms: number) => () => void
  batchSize?: number
  /** Re-fetch the server state every n ms while connected, as a safety net for lost realtime messages. Off by default. */
  reconcileMs?: number
  onStatus?: (s: SyncStatus) => void
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000]

/**
 * Local-first-Sync: Aenderungen landen in einer Outbox und werden in Paketen gesendet.
 * Bei Fehlern wird mit steigender Wartezeit wiederholt. Fremde Aenderungen kommen per Abonnement
 * und per vollem Abgleich beim Verbinden; doppelte Zustellung ist harmlos (idempotent).
 */
export class SyncEngine {
  readonly clock: Clock
  private readonly queue = new Map<string, WireChange>()
  private readonly schedule: NonNullable<EngineOptions['schedule']>
  private readonly batchSize: number
  private flushing = false
  private failures = 0
  private cancelRetry: (() => void) | null = null
  private cancelTicker: (() => void) | null = null
  private unsubscribe: (() => void) | null = null
  private connected = false
  private state: SyncStatus['state'] = 'idle'

  constructor(private readonly o: EngineOptions) {
    this.clock = o.clock ?? new Clock()
    this.batchSize = o.batchSize ?? 200
    this.schedule = o.schedule ?? ((fn, ms) => {
      const h = setTimeout(fn, ms)
      return () => clearTimeout(h)
    })
    for (const c of o.outbox.load()) this.queue.set(changeKey(c), c)
  }

  get status(): SyncStatus {
    return { state: this.state, pending: this.queue.size }
  }

  /** Aenderung vormerken und senden. Fuer denselben Eintrag bleibt nur die neueste Aenderung erhalten. */
  enqueue(c: WireChange): void {
    this.clock.observe(c.t)
    const k = changeKey(c)
    const cur = this.queue.get(k)
    if (cur && cur.t > c.t) return
    this.queue.set(k, c)
    this.saveOutbox()
    this.emit()
    if (this.connected) void this.flush()
  }

  /** Verbinden: abonnieren, Serverstand holen und anwenden, optional lokalen Stand senden, Outbox leeren. */
  async connect(opts: { seedLocal: boolean }): Promise<void> {
    this.disconnect()
    this.connected = true
    // Erst abonnieren, dann abrufen: so geht zwischen beiden Schritten nichts verloren (Doppeltes ist harmlos).
    this.unsubscribe = this.o.transport.subscribe((c) => this.receive([c]))
    try {
      this.receive(await this.o.transport.pull())
    } catch {
      this.fail(() => this.connect(opts))
      return
    }
    if (opts.seedLocal) for (const c of this.o.io.snapshot()) this.enqueue(c)
    await this.flush()
    this.armTicker()
  }

  /**
   * Fetch the full server state and apply it, then send anything still waiting. Realtime messages can be lost
   * without any error (sleeping phone, flaky network), so a connected device must be able to heal itself.
   */
  async reconcile(): Promise<void> {
    if (!this.connected) return
    try {
      this.receive(await this.o.transport.pull())
    } catch {
      this.fail(() => this.reconcile())
      return
    }
    await this.flush()
  }

  private armTicker(): void {
    const ms = this.o.reconcileMs
    if (!ms || !this.connected) return
    this.cancelTicker?.()
    this.cancelTicker = this.schedule(() => {
      this.cancelTicker = null
      void this.reconcile().finally(() => this.armTicker())
    }, ms)
  }

  disconnect(): void {
    this.cancelTicker?.()
    this.cancelTicker = null
    this.connected = false
    this.unsubscribe?.()
    this.unsubscribe = null
    this.cancelRetry?.()
    this.cancelRetry = null
  }

  /** Number of received changes dropped as malformed or implausible (for diagnostics and tests). */
  rejected = 0

  private receive(changes: WireChange[]): void {
    // Changes from the server are untrusted: any party member can write arbitrary rows.
    const valid = changes.filter((c) => isWellFormed(c) && this.clock.isPlausible(c.t))
    this.rejected += changes.length - valid.length
    if (!valid.length) return
    for (const c of valid) this.clock.observe(c.t)
    this.o.io.applyRemote(valid)
  }

  async flush(): Promise<void> {
    if (this.flushing) return
    this.flushing = true
    try {
      while (this.queue.size > 0) {
        const batch = [...this.queue.values()].slice(0, this.batchSize)
        this.setState('syncing')
        await this.o.transport.push(batch)
        for (const c of batch) {
          const k = changeKey(c)
          // Nur loeschen, wenn waehrend des Sendens keine neuere Aenderung dazugekommen ist.
          if (this.queue.get(k)?.t === c.t) this.queue.delete(k)
        }
        this.saveOutbox()
      }
      this.failures = 0
      this.setState('idle')
    } catch {
      this.fail(() => this.flush())
    } finally {
      this.flushing = false
    }
  }

  private fail(retry: () => Promise<void>): void {
    this.setState('offline')
    this.cancelRetry?.()
    const wait = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)]
    this.failures++
    this.cancelRetry = this.schedule(() => {
      this.cancelRetry = null
      if (this.connected) void retry()
    }, wait)
  }

  private saveOutbox(): void {
    this.o.outbox.save([...this.queue.values()])
  }
  private setState(s: SyncStatus['state']): void {
    this.state = s
    this.emit()
  }
  private emit(): void {
    this.o.onStatus?.(this.status)
  }
}
