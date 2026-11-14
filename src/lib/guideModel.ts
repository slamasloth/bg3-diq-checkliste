import type { ActName, BuildPack, PackBuild, PackItem, VerificationLevel } from './buildpack'
import { blocks, paragraphs, pdfText, type Block } from './guidePdf'
import type { IconName } from './icons'

/**
 * Pure mapping from the build package to what the Guides tab shows. No state, no DOM: the tests pin it against the
 * package. Wording stays as the guide has it (German); only the app's own labels are English. Nothing is invented:
 * a missing part becomes a `gap` entry that the view shows as «gap».
 */

export interface VerificationBadge { label: string; kind: 'ok' | 'info' | 'cand' | 'maybe' | 'bad'; icon: IconName }
const VERIFICATION: Record<VerificationLevel, VerificationBadge> = {
  INGAME_CONFIRMED: { label: 'In-game confirmed', kind: 'ok', icon: 'sourced' },
  INSTALLED_FILE_CONFIRMED: { label: 'Game files confirmed', kind: 'ok', icon: 'sourced' },
  AUTHOR_DOCUMENTED: { label: 'Author documented', kind: 'info', icon: 'separate' },
  PROJECT_RECONSTRUCTED: { label: 'Reconstructed', kind: 'cand', icon: 'candidate' },
  THEORY_INFERRED: { label: 'Theory', kind: 'maybe', icon: 'candidate' },
  UNKNOWN: { label: 'Unknown', kind: 'bad', icon: 'unverified' },
}
export const verificationBadge = (v: VerificationLevel): VerificationBadge => VERIFICATION[v]

/** Fixed builds (Dark Urge, Tala) first in the package's own order, then the ten picks in package order. */
export function orderedBuilds(pack: BuildPack): { build: PackBuild; fixed: boolean }[] {
  const fixed = new Set<string>(pack.party.fixed)
  const first = pack.party.fixed.map((id) => pack.builds.find((b) => b.id === id)).filter((b): b is PackBuild => b !== undefined)
  const rest = pack.builds.filter((b) => !fixed.has(b.id))
  return [...first.map((build) => ({ build, fixed: true })), ...rest.map((build) => ({ build, fixed: false }))]
}

export interface ListEntry {
  id: string
  character: string
  title: string
  /** «Harlequin 14 / Fighter 3 / Sorcerer 3» from the class split of the package. */
  split: string
  /** Core statement: the part of the subtitle after « · » (or the whole subtitle). */
  core: string
  fixed: boolean
  verification: VerificationBadge
  classes: string[]
}
export function listEntries(pack: BuildPack): ListEntry[] {
  return orderedBuilds(pack).map(({ build: b, fixed }) => {
    const i = b.subtitle.indexOf(' · ')
    return {
      id: b.id,
      character: b.character,
      title: b.title,
      split: b.classSplit.map((c) => `${c.cls} ${c.levels}`).join(' / '),
      core: i >= 0 ? b.subtitle.slice(i + 3) : b.subtitle,
      fixed,
      verification: verificationBadge(b.verification),
      classes: b.classSplit.map((c) => c.cls),
    }
  })
}

/** Search over character, title, classes and core statement; the class filter matches any class of the split. */
export function filterEntries(entries: ListEntry[], query: string, cls: string): ListEntry[] {
  const q = query.trim().toLowerCase()
  return entries.filter((e) => (!cls || e.classes.includes(cls)) && (!q || `${e.character} ${e.title} ${e.split} ${e.core}`.toLowerCase().includes(q)))
}
export const allClasses = (entries: ListEntry[]): string[] => [...new Set(entries.flatMap((e) => e.classes))].sort((a, b) => a.localeCompare(b))

// ---- reading view ----

export interface LevelView { totalLevel: number; cls: string; classLevel: number; text: string; feats: { name: string; kind: 'bonus' | 'class'; from: string | null }[] }
export function levelViews(b: PackBuild): LevelView[] {
  return b.levels.map((l) => ({
    totalLevel: l.totalLevel,
    cls: l.cls,
    classLevel: l.classLevel,
    // The row text already ends with the feat choice; the feats are shown as their own chips, so cut those parts out.
    text: pdfText(l.text.replace(/Feat:\s*.+?\((?:Bonus-Feat|Klassen-Feat)[^)]*\)/g, '')).replace(/\s{2,}/g, ' ').trim(),
    feats: l.feats.map((f) => ({ name: pdfText(f.name), kind: f.kind, from: f.sourceClass })),
  }))
}

export interface OptionView { rank: number; name: string; item: PackItem | null; badge: VerificationBadge | null; notes: string; inherited: boolean; wiki: string | null }
export interface SlotView { slot: string; label: string; options: OptionView[]; gaps: number[] }
export interface ActGear { act: ActName; notes: string[]; slots: SlotView[]; gap: boolean }

const SLOT_LABEL: Record<string, string> = {
  mainhand: 'Main hand', offhand: 'Off hand', head: 'Head', body: 'Body', gloves: 'Gloves', boots: 'Boots', cloak: 'Cloak',
  amulet: 'Amulet', ring1: 'Ring 1', ring2: 'Ring 2', ranged: 'Ranged', quiver: 'Quiver',
}
export function gearViews(pack: BuildPack, b: PackBuild): ActGear[] {
  return pack.acts.map((act) => {
    const g = b.gear[act]
    if (!g || g.slots.length === 0) return { act, notes: [], slots: [], gap: true }
    return {
      act,
      notes: paragraphs(g.notes.filter((n) => !/Haken|PDF-?Pro|Formulare|gramm Formulare/.test(n))),
      gap: false,
      slots: g.slots.map((s) => {
        const options = [1, 2, 3].flatMap((rank) => {
          const o = s.options.find((x) => x.rank === rank)
          if (!o) return []
          const item = pack.items[o.itemId] ?? null
          return [{
            rank, name: item ? pdfText(item.name) : '', item, badge: item ? verificationBadge(item.verification) : null,
            notes: pdfText(o.notes.join(' ')), inherited: Boolean(o.inherited), wiki: item?.found.base[0]?.wiki ?? null,
          }]
        })
        // Ranks the guide itself does not name (guideStatesOnly) or the package lacks are shown as gaps, not filled in.
        const present = new Set(options.map((o) => o.rank))
        const gaps = [1, 2, 3].filter((r) => !present.has(r))
        return { slot: s.slot, label: SLOT_LABEL[s.slot] ?? s.label, options, gaps }
      }),
    }
  })
}

export interface Prose { title: string; blocks: Block[] }
/** Sections of the guide by their number: 1 overview, 4 feat plan, 5 mechanics, 10 tactics. */
export const SECTIONS: { key: string; title: string }[] = [
  { key: '1', title: 'Build overview' },
  { key: '4', title: 'Feat plan' },
  { key: '5', title: 'Class mechanics, spells and metamagic' },
  { key: '10', title: 'Combat rotation and strategy' },
]
export function proseOf(b: PackBuild, key: string): Block[] {
  return blocks(b.sections[key] ?? [])
}

export interface EndgameSet { name: string; rows: { slot: string; value: string }[] }
export function endgameViews(b: PackBuild): EndgameSet[] {
  return Object.entries(b.endgameSets).map(([name, slots]) => ({
    name: pdfText(name),
    rows: Object.entries(slots).map(([slot, v]) => ({ slot: pdfText(slot), value: pdfText(Array.isArray(v) ? v.join(', ') : v) })),
  }))
}

/** Open points are already one entry per item (not wrapped lines), so they are cleaned but never merged. */
export const openPointsOf = (b: PackBuild): string[] => b.openPoints.map(pdfText).filter(Boolean)
export const missablesOf = (b: PackBuild) => b.missables.map((m) => ({ items: pdfText(m.items ?? ''), condition: pdfText(m.bedingung), act: m.akt ?? '' }))
/** Source lines of section 11 after the «Quellen» heading, as the PDF shows them. */
export function sourcesOf(b: PackBuild): string[] {
  const s11 = b.sections['11'] ?? []
  const qi = s11.findIndex((l) => /^Quellen/.test(l))
  return qi >= 0 ? paragraphs(s11.slice(qi + 1)) : []
}
