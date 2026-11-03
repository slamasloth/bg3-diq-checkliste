import { applyChange, stateToChanges } from './logic'
import { LocalStorageRepo, parseState, type StateRepo } from './persist'
import type { PartyMember, PersistedState } from './schema'
import { Clock } from './sync/clock'
import { isWellFormed } from './sync/validate'
import type { WireChange } from './sync/types'

const repo: StateRepo = new LocalStorageRepo()

export const app: { s: PersistedState; storageOk: boolean } = $state({ s: repo.load(), storageOk: true })

/** Gemeinsame Uhr: monoton, ueberholt gesehene fremde Zeitstempel. Wird auch von der Sync-Engine genutzt. */
/** Stable random device number (0-1023), so timestamps from different devices never collide. */
function deviceNumber(): number {
  const KEY = 'bg3diq.node'
  try {
    const saved = Number(localStorage.getItem(KEY))
    if (Number.isInteger(saved) && saved >= 0 && saved < 1024 && localStorage.getItem(KEY) !== null) return saved
    const n = Math.floor(Math.random() * 1024)
    localStorage.setItem(KEY, String(n))
    return n
  } catch {
    return Math.floor(Math.random() * 1024)
  }
}
export const clock = new Clock(Date.now, deviceNumber())
for (const c of stateToChanges(app.s)) clock.observe(c.t)

/** Ziel fuer lokale Aenderungen; die Sync-Engine haengt sich hier ein (M3). */
let sink: (c: WireChange) => void = () => {}
export const setChangeSink = (fn: (c: WireChange) => void) => { sink = fn }

const persist = () => { app.storageOk = repo.save($state.snapshot(app.s)) }

/** Lokale Aenderung: anwenden, speichern, an die Sync-Engine melden. */
function commit(c: WireChange): void {
  applyChange(app.s, c)
  persist()
  sink(c)
}

export const isChecked = (id: string): boolean => Boolean(app.s.checked[id]?.c)
export const memberOf = (id: string): string => app.s.assign[id]?.member ?? ''
export const noteOf = (id: string): string => app.s.assign[id]?.note ?? ''
/** Party ohne entfernte Mitglieder. */
export const members = (): PartyMember[] => app.s.party.filter((p) => !p.removed)

export function setChecked(id: string, c: boolean): void {
  commit({ kind: 'checked', id, c, t: clock.next() })
}

export function setAssign(id: string, patch: { member?: string; note?: string }): void {
  const cur = app.s.assign[id]
  commit({ kind: 'assign', id, member: patch.member ?? cur?.member ?? '', note: patch.note ?? cur?.note ?? '', t: clock.next() })
}

export function addMember(name: string, figure: string): void {
  commit({ kind: 'member', id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, figure, removed: false, t: clock.next() })
}

export function removeMember(id: string): void {
  const p = app.s.party.find((x) => x.id === id)
  if (!p) return
  for (const [k, a] of Object.entries(app.s.assign)) if (a.member === id) setAssign(k, { member: '' })
  commit({ kind: 'member', id, name: p.name, figure: p.figure, removed: true, t: clock.next() })
}

export function setActiveAct(act: string): void {
  app.s.ui.act = act
  persist()
}

/** Fremde Aenderungen (Server, Echtzeit) anwenden. Meldet nichts zurueck an die Engine. */
export function applyRemote(changes: WireChange[]): void {
  let any = false
  for (const c of changes) if (applyChange(app.s, c)) any = true
  if (any) persist()
}
export const snapshot = (): WireChange[] => stateToChanges($state.snapshot(app.s))

/** Sicherung einlesen und per Zeitstempel zusammenfuehren (v2 und v3). Gibt die Zahl uebernommener Eintraege zurueck. */
export function importBackup(json: unknown): number {
  const parsed = parseState(json)
  if (!parsed.success) throw new Error('Not a valid backup (format bg3diq-state, version 2 or 3).')
  let n = 0
  for (const c of stateToChanges(parsed.data)) {
    if (!isWellFormed(c) || !clock.isPlausible(c.t)) continue // a backup file is untrusted input too
    clock.observe(c.t)
    if (applyChange(app.s, c)) { n++; sink(c) }
  }
  persist()
  return n
}

export function exportBackup(): string {
  // Einmalige Zeitangabe fuer den Dateiinhalt, nicht reaktiv.
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const exported = new Date().toISOString()
  return JSON.stringify({ ...$state.snapshot(app.s), exported }, null, 1)
}
