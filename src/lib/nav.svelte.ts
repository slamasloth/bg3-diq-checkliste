import { noFilters, type Filters } from './logic'
import type { Tier } from './counts'

/**
 * View state of the shell (S2): tab, open region, filters. Kept apart from the checklist state (`store.svelte.ts`)
 * and never synchronised: it only restores the screen the player left. A region is a history entry, so the browser's
 * back button closes it.
 */
export type Tab = 'today' | 'checklist' | 'party' | 'guides' | 'more'
const TABS: Tab[] = ['today', 'checklist', 'party', 'guides', 'more']
const KEY = 'bg3diq.nav'

export const nav: { tab: Tab; region: string | null; guide: string | null; lastRegion: string | null; filters: Filters; tier: Tier } = $state({
  tab: 'today',
  region: null,
  guide: null, // open build in the Guides tab (a history entry like a region)
  lastRegion: null,
  filters: noFilters(),
  tier: 'any',
})

/** Only accept known shapes from storage (it is plain localStorage, not trusted). */
function restore(): void {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return
    const o = JSON.parse(raw) as Record<string, unknown>
    if (typeof o.tab === 'string' && (TABS as string[]).includes(o.tab)) nav.tab = o.tab as Tab
    if (typeof o.region === 'string' && o.region.length < 200) nav.region = o.region
    if (typeof o.guide === 'string' && o.guide.length < 80) nav.guide = o.guide
    if (typeof o.lastRegion === 'string' && o.lastRegion.length < 200) nav.lastRegion = o.lastRegion
    if (o.tier === 'maybe' || o.tier === 'not') nav.tier = o.tier
    const f = o.filters as Partial<Filters> | undefined
    if (f && typeof f === 'object') {
      const base = noFilters()
      if (f.status === 'open' || f.status === 'done') base.status = f.status
      if (f.source === 'base' || f.source === 'mod') base.source = f.source
      if (typeof f.mod === 'string' && f.mod.length < 200) base.mod = f.mod
      if (typeof f.verification === 'string' && f.verification.length < 40) base.verification = f.verification
      if (typeof f.member === 'string' && f.member.length < 80) base.member = f.member
      base.missableOnly = f.missableOnly === true
      base.itemsOnly = f.itemsOnly === true
      Object.assign(nav.filters, base)
    }
  } catch {
    /* ignore: start from the defaults */
  }
}

/** Persist; call from an effect so it follows every change. The search text is not stored. */
export function saveNav(): void {
  try {
    const f = nav.filters
    const filters = { status: f.status, source: f.source, mod: f.mod, verification: f.verification, member: f.member, missableOnly: f.missableOnly, itemsOnly: f.itemsOnly }
    localStorage.setItem(KEY, JSON.stringify({ tab: nav.tab, region: nav.region, guide: nav.guide, lastRegion: nav.lastRegion, tier: nav.tier, filters }))
  } catch {
    /* storage unavailable: the view just starts fresh next time */
  }
}

export function initNav(): void {
  restore()
  // Make the restored region a history entry on top of the list, so Back returns to the list.
  if (nav.region) {
    history.replaceState({ list: true }, '')
    history.pushState({ region: nav.region }, '')
  } else if (nav.guide) {
    history.replaceState({ list: true }, '')
    history.pushState({ guide: nav.guide }, '')
  }
  window.addEventListener('popstate', (e) => {
    const st = e.state as { region?: string; guide?: string } | null
    nav.region = st?.region ?? null
    nav.guide = st?.guide ?? null
  })
}

export function setTab(t: Tab): void {
  if (nav.region && t !== nav.tab) closeRegion()
  if (nav.guide && t !== nav.tab) closeGuide()
  nav.tab = t
  window.scrollTo(0, 0)
}

export function openRegion(id: string): void {
  nav.region = id
  nav.lastRegion = id // "Continue where you left off" on Today
  history.pushState({ region: id }, '')
  window.scrollTo(0, 0)
}

/** Open a build in the Guides tab. History entry, so Back returns to the list. */
export function openGuide(id: string): void {
  nav.guide = id
  history.pushState({ guide: id }, '')
  window.scrollTo(0, 0)
}

export function closeGuide(): void {
  if (history.state && (history.state as { guide?: string }).guide) history.back()
  else nav.guide = null
  window.scrollTo(0, 0)
}

export function closeRegion(): void {
  if (history.state && (history.state as { region?: string }).region) history.back()
  else nav.region = null
  window.scrollTo(0, 0)
}
