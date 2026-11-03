import { emptyState, PersistedStateSchema, type PersistedState } from './schema'

/** Speicher-Schnittstelle. Die Cloud-Anbindung laeuft getrennt ueber die Sync-Engine (`lib/sync`). */
export interface StateRepo {
  load(): PersistedState
  save(s: PersistedState): boolean
}

const KEY = 'bg3diq.state.v3'
const KEY_V2 = 'bg3diq.state.v2'

/** Aeltere Staende lesbar machen. v2 kannte keinen Grabstein bei Mitgliedern. */
export function migrateState(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const o = raw as Record<string, unknown>
  if (o.v === 2 && Array.isArray(o.party)) {
    return { ...o, v: 3, party: o.party.map((p) => ({ ...(p as object), removed: false })) }
  }
  return raw
}

export const parseState = (raw: unknown) => PersistedStateSchema.safeParse(migrateState(raw))

export class LocalStorageRepo implements StateRepo {
  load(): PersistedState {
    for (const key of [KEY, KEY_V2]) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const parsed = parseState(JSON.parse(raw))
        if (parsed.success) return parsed.data
      } catch {
        /* naechsten Schluessel versuchen */
      }
    }
    return emptyState()
  }
  save(s: PersistedState): boolean {
    try {
      localStorage.setItem(KEY, JSON.stringify(s))
      return true
    } catch {
      return false
    }
  }
}

/** Outbox der Sync-Engine im lokalen Speicher. */
export const localOutbox = (partyKey: string) => ({
  load() {
    try {
      const raw = localStorage.getItem(`bg3diq.outbox.${partyKey}`)
      return raw ? (JSON.parse(raw) as import('./sync/types').WireChange[]) : []
    } catch {
      return []
    }
  },
  save(changes: import('./sync/types').WireChange[]) {
    try {
      localStorage.setItem(`bg3diq.outbox.${partyKey}`, JSON.stringify(changes))
    } catch {
      /* Speicher voll oder gesperrt: Aenderungen bleiben im Arbeitsspeicher */
    }
  },
})
