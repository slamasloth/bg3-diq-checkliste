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

export interface OptionView {
  rank: number; name: string; item: PackItem | null; badge: VerificationBadge | null; notes: string; inherited: boolean; wiki: string | null
  /** Rarity as the package states it (null = not stated; never guessed) and its colour key. */
  rarity: string | null; rarityKey: RarityKey
  /** «Mod item» (FED), «Base game» or null for generic placeholders. */
  origin: 'Mod item' | 'Base game' | null
  locations: LocationLine[]
}
export interface SlotView { slot: string; label: string; icon: IconName; options: OptionView[]; gaps: number[] }

export type RarityKey = 'common' | 'unc' | 'rare' | 'vr' | 'leg' | 'none'
const RARITY: Record<string, RarityKey> = { common: 'common', uncommon: 'unc', rare: 'rare', 'very rare': 'vr', legendary: 'leg' }
export const rarityKey = (r: string | null): RarityKey => (r ? RARITY[r.trim().toLowerCase()] ?? 'none' : 'none')

const ACT_EN: Record<string, string> = { 'Akt 1': 'Act 1', 'Akt 1.5': 'Act 1.5', 'Akt 2': 'Act 2', 'Akt 3': 'Act 3', Prolog: 'Act 1' }
const actEn = (a: string | null): string => (a ? ACT_EN[a] ?? a : '')

export interface LocationLine {
  act: string
  /** Where, in the guide's own wording (German for the lists); for game-file entries a readable form of the holder ID. */
  text: string
  /** Where the statement comes from, with how reliable it is. */
  source: string
  /** Raw game-file ID (script entries only), shown in monospace so it can be searched in the game files. */
  id: string | null
  href: string | null
}

/** «CONT_GEN_Chest_Heavy_A_003» → «Chest Heavy A 003»: drop the file-prefix tokens, split camelCase. */
export function readableHolder(id: string): string {
  const s = id.replace(/^(?:(?:S|CONT|LOOT|CRE|DEC|FOR|CRA|DEN|GEN|LOW|WYR|MOO|UND|WLD|GLO|END|SCL|TWN|PLA|HAV|IRN|CAM|SHA|GOB|HAG|MAG|UNI)_)+/, '')
  const t = s.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s{2,}/g, ' ').trim()
  return t || id
}

/**
 * Every location the package holds for an item, most readable first: author list, catalog, installed game files, wiki.
 * Nothing is added: an item without any entry yields an empty list (the view shows «gap»).
 */
export function locationsOf(item: PackItem): LocationLine[] {
  const out: LocationLine[] = []
  for (const l of item.found.list) {
    if (l.place) out.push({ act: actEn(l.act), text: pdfText(l.place), source: 'Author list', id: null, href: l.proofLink })
  }
  for (const c of item.found.catalog) {
    const text = [c.region, c.place].filter(Boolean).join(' · ')
    if (text) out.push({ act: actEn(c.act), text: pdfText(text), source: `Catalog${c.confidence ? ' (' + c.confidence.split(':')[0].trim() + ')' : ''}`, id: null, href: null })
  }
  for (const s of item.found.script) {
    out.push({ act: actEn(s.act), text: readableHolder(s.holder), source: 'Game files', id: s.section ? `${s.holder} · ${s.section}` : s.holder, href: null })
  }
  for (const b of item.found.base) {
    out.push({ act: actEn(b.act), text: 'Base-game item, see the wiki page', source: 'bg3.wiki', id: null, href: b.wiki })
  }
  return out
}

export const SLOT_ICON: Record<string, IconName> = {
  mainhand: 'slot_mainhand', offhand: 'slot_offhand', head: 'slot_head', body: 'slot_body', gloves: 'slot_gloves', boots: 'slot_boots',
  cloak: 'slot_cloak', amulet: 'slot_amulet', ring1: 'slot_ring', ring2: 'slot_ring', ranged: 'slot_ranged', quiver: 'slot_quiver',
}

// ---- spells in running text ----
export type TextPart = { text: string; spell?: undefined } | { text: string; spell: { grade: number } }
const SPELL_RE = new WeakMap<object, RegExp | null>()
/**
 * Splits text into plain parts and spell parts (exact name, whole words, longest name first). The grade comes from
 * `pack.spellLevels`; names without an entry stay plain text.
 */
export function spellParts(text: string, levels: Record<string, number>): TextPart[] {
  let re = SPELL_RE.get(levels)
  if (re === undefined) {
    const names = Object.keys(levels).sort((a, b) => b.length - a.length)
    re = names.length ? new RegExp(`(?<![A-Za-z'’])(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z])`, 'g') : null
    SPELL_RE.set(levels, re)
  }
  if (!re) return [{ text }]
  const parts: TextPart[] = []
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index) })
    parts.push({ text: m[0], spell: { grade: levels[m[0]] } })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts.length ? parts : [{ text }]
}
/** Colour bands for the grades; the grade itself is always printed next to the name. */
export const gradeBand = (g: number): 'c' | 'low' | 'mid' | 'high' => (g === 0 ? 'c' : g <= 2 ? 'low' : g <= 4 ? 'mid' : 'high')
export const gradeLabel = (g: number): string => (g === 0 ? 'Cantrip' : `Level ${g}`)
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
            rarity: item?.rarity ?? null, rarityKey: rarityKey(item?.rarity ?? null),
            origin: item ? (item.source === 'fed' ? 'Mod item' as const : item.source === 'base' ? 'Base game' as const : null) : null,
            locations: item ? locationsOf(item) : [],
          }]
        })
        // Ranks the guide itself does not name (guideStatesOnly) or the package lacks are shown as gaps, not filled in.
        const present = new Set(options.map((o) => o.rank))
        const gaps = [1, 2, 3].filter((r) => !present.has(r))
        return { slot: s.slot, label: SLOT_LABEL[s.slot] ?? s.label, icon: SLOT_ICON[s.slot] ?? 'mod', options, gaps }
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
