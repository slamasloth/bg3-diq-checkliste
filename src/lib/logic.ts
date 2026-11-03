import type { PersistedState, Region, Row } from './schema'
import type { WireChange } from './sync/types'

// Every row can be ticked off, including plain bullets without a type icon: in the source list each bullet has its
// own ID, and a tip such as "Talk to a Strange Ox again" is exactly the kind of thing one wants to tick.

/** Can this entry be assigned to a character? */
export const isItem = (r: Row): boolean => r.kind === 'item'

// The `missable` flag is derived from the source text when the data package is built (tools/export_web_data.py).
export const isMissable = (r: Row): boolean => r.kind === 'missable' || r.missable === true

export interface Filters {
  query: string
  status: 'all' | 'open' | 'done'
  source: 'all' | 'base' | 'mod'
  mod: string
  verification: string
  /** '' = everyone, '-' = unassigned, otherwise a member ID */
  member: string
  missableOnly: boolean
  itemsOnly: boolean
}
export const noFilters = (): Filters => ({
  query: '', status: 'all', source: 'all', mod: '', verification: '', member: '', missableOnly: false, itemsOnly: false,
})
export const hasActiveFilter = (f: Filters): boolean =>
  Boolean(f.query) || f.status !== 'all' || f.source !== 'all' || Boolean(f.mod || f.verification || f.member) || f.missableOnly || f.itemsOnly

export interface Lookup {
  isChecked(id: string): boolean
  memberOf(id: string): string
}

export function rowPasses(r: Row, regionTitle: string, f: Filters, l: Lookup): boolean {
  if (f.source === 'base' && r.origin !== 'base') return false
  if (f.source === 'mod' && r.origin === 'base') return false
  if (f.mod && r.mod !== f.mod) return false
  if (f.verification && r.verification !== f.verification) return false
  const done = l.isChecked(r.id)
  if (f.status === 'open' && done) return false
  if (f.status === 'done' && !done) return false
  if (f.missableOnly && !isMissable(r)) return false
  if (f.itemsOnly && !isItem(r)) return false
  if (f.member) {
    const m = l.memberOf(r.id)
    if (f.member === '-') {
      if (!isItem(r) || m) return false
    } else if (m !== f.member) return false
  }
  if (f.query) {
    const hay = [r.text, r.name, r.mod, r.foundAt, r.condition, r.reward, regionTitle].join(' ').toLowerCase()
    if (!hay.includes(f.query.toLowerCase())) return false
  }
  return true
}

export function countRegion(g: Region, isChecked: (id: string) => boolean): [done: number, total: number] {
  let done = 0
  let total = 0
  for (const r of [...g.base, ...g.mod]) {
    total++
    if (isChecked(r.id)) done++
  }
  return [done, total]
}

/**
 * Wendet eine Aenderung an (veraendert `s`). Es gewinnt der neuere Zeitstempel; bei Gleichstand bleibt der Bestand.
 * Idempotent: dieselbe Aenderung zweimal anzuwenden aendert nichts. Gleiche Regel wie `apply_changes` im Server.
 */
export function applyChange(s: PersistedState, c: WireChange): boolean {
  switch (c.kind) {
    case 'checked': {
      const cur = s.checked[c.id]
      if (cur && cur.t >= c.t) return false
      s.checked[c.id] = { c: c.c, t: c.t }
      return true
    }
    case 'assign': {
      const cur = s.assign[c.id]
      if (cur && cur.t >= c.t) return false
      s.assign[c.id] = { member: c.member, note: c.note, t: c.t }
      return true
    }
    case 'member': {
      const cur = s.party.find((p) => p.id === c.id)
      if (cur && cur.t >= c.t) return false
      const next = { id: c.id, name: c.name, figure: c.figure, removed: c.removed, t: c.t }
      if (cur) Object.assign(cur, next)
      else s.party.push(next)
      return true
    }
  }
}

/** Gesamten Zustand als Aenderungsliste (z. B. um beim ersten Verbinden den lokalen Stand zu senden). */
export function stateToChanges(s: PersistedState): WireChange[] {
  return [
    ...Object.entries(s.checked).map(([id, v]): WireChange => ({ kind: 'checked', id, c: v.c, t: v.t })),
    ...Object.entries(s.assign).map(([id, v]): WireChange => ({ kind: 'assign', id, member: v.member, note: v.note, t: v.t })),
    ...s.party.map((p): WireChange => ({ kind: 'member', id: p.id, name: p.name, figure: p.figure, removed: p.removed, t: p.t })),
  ]
}

/**
 * Fuehrt zwei Staende zusammen: pro Eintrag gewinnt der neuere Zeitstempel.
 * Rein funktional (die Eingaben bleiben unveraendert); dieselbe Regel gilt fuer den Sync zwischen Geraeten.
 */
export function mergeStates(local: PersistedState, incoming: PersistedState): { state: PersistedState; changed: number } {
  const state: PersistedState = structuredClone(local)
  let changed = 0
  for (const c of stateToChanges(incoming)) if (applyChange(state, c)) changed++
  return { state, changed }
}
