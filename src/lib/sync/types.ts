/** Aenderung im Wire-Format; identisch zu den JSON-Elementen, die `apply_changes` in Postgres erwartet. */
export type WireChange =
  | { kind: 'checked'; id: string; c: boolean; t: number }
  | { kind: 'assign'; id: string; member: string; note: string; t: number }
  | { kind: 'member'; id: string; name: string; figure: string; removed: boolean; t: number }

export const changeKey = (c: WireChange): string => `${c.kind}:${c.id}`

/** Austauschbare Verbindung zum Server (Supabase in Produktion, Fake in Tests). */
export interface SyncTransport {
  /** Gesamter Serverstand der Party. */
  pull(): Promise<WireChange[]>
  /** Aenderungen senden. Wirft bei Fehler; der Server wendet "neuerer Zeitstempel gewinnt" an. */
  push(changes: WireChange[]): Promise<void>
  /** Echtzeit-Aenderungen anderer (und eigene Echos). Gibt die Abmeldefunktion zurueck. */
  subscribe(onChange: (c: WireChange) => void): () => void
}

/** Wartende, noch nicht bestaetigte Aenderungen; ueberleben ein Neuladen. */
export interface OutboxStore {
  load(): WireChange[]
  save(changes: WireChange[]): void
}

export type SyncState = 'idle' | 'syncing' | 'offline'
export interface SyncStatus { state: SyncState; pending: number }
