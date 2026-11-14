import type { Region, Row } from './schema'
import { isMissable, rowPasses, type Filters } from './logic'
import { isMaybeMissable } from './badges'

/**
 * Display-side filter extras and counters (S2). `logic.ts` keeps the stored filters; the "missable tier" in the
 * filter sheet adds two values that only exist in the view: "May be missable" and "Not missable".
 */
export type Tier = 'any' | 'missable' | 'maybe' | 'not'

export interface Lookup { isChecked: (id: string) => boolean; memberOf: (id: string) => string }

/** The tier chosen in the sheet; `missableOnly` (quick chip) counts as "missable". */
export const tierOf = (f: Filters, extra: Tier): Tier => (f.missableOnly ? 'missable' : extra)

export function passes(r: Row, regionTitle: string, f: Filters, extra: Tier, l: Lookup): boolean {
  if (!rowPasses(r, regionTitle, f, l)) return false
  if (extra === 'maybe') return isMaybeMissable(r)
  if (extra === 'not') return !isMissable(r) && !isMaybeMissable(r)
  return true
}

/** Number of active filters shown in "Filters (n)". The search text is not counted (it sits outside the sheet). */
export function activeFilterCount(f: Filters, extra: Tier): number {
  let n = 0
  if (f.status !== 'all') n++
  if (f.source !== 'all') n++
  if (f.mod) n++
  if (f.verification) n++
  if (f.member) n++
  if (f.missableOnly || extra !== 'any') n++
  if (f.itemsOnly) n++
  return n
}

export interface RegionStats { done: number; total: number; openMissable: number }

/** Progress of a region over all of its rows (filters do not change the progress, only what is listed). */
export function regionStats(g: Region, isChecked: (id: string) => boolean): RegionStats {
  let done = 0
  let total = 0
  let openMissable = 0
  for (const r of [...g.base, ...g.mod]) {
    total++
    if (isChecked(r.id)) done++
    else if (isMissable(r)) openMissable++
  }
  return { done, total, openMissable }
}

/** Rows of a region that pass the current filters. */
export function visibleRows(g: Region, f: Filters, extra: Tier, l: Lookup): { base: Row[]; mod: Row[] } {
  return {
    base: g.base.filter((r) => passes(r, g.title, f, extra, l)),
    mod: g.mod.filter((r) => passes(r, g.title, f, extra, l)),
  }
}
