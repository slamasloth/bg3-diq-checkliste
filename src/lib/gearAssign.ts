import type { BuildPack, PackItem, VerificationLevel } from './buildpack'

// Gear assigner (M4): gives every lineup member one distinct item per slot and act. Pure functions, no state.
// "Optimal" means: first as many slots served as possible, then the lowest sum of guide ranks (1 = best).
// Rank is the order of the guide authors, not an item value (there is no item_stats yet).
// Design and proof of the method: builds/M4_PARTY_GEAR_ENTWURF.md; checked against builds/tools/m4_party_gear_pruefung.py.

export type Mode = 'raw' | 'dated' | 'verified'
/** raw: all guide options. dated: + item not before its earliest source act (unknown act stays allowed).
 *  verified: + stage INSTALLED_FILE_CONFIRMED or AUTHOR_DOCUMENTED and a known act. The UI default is `dated`. */

export const SLOT_LABEL: Record<string, string> = {
  mainhand: 'Main hand', offhand: 'Off hand', head: 'Head', body: 'Body', gloves: 'Gloves', boots: 'Boots',
  cloak: 'Cloak', amulet: 'Amulet', ring1: 'Ring 1', ring2: 'Ring 2', ranged: 'Ranged', quiver: 'Quiver',
}

const ACT_NUM: Record<string, number> = { 'Akt 1': 1, 'Akt 1.5': 1.5, 'Akt 2': 2, 'Akt 3': 3, 'Act 1': 1, 'Act 1.5': 1.5, 'Act 2': 2, 'Act 3': 3 }
const VERIFIED = new Set<VerificationLevel>(['INGAME_CONFIRMED', 'INSTALLED_FILE_CONFIRMED', 'AUTHOR_DOCUMENTED'])

export const actNumber = (act: string): number => ACT_NUM[act] ?? NaN

/** Earliest act in which any source (script, author list, catalog, base checklist) places the item; null = unknown. */
export function earliestAct(item: PackItem): number | null {
  let best: number | null = null
  const f = item.found
  for (const e of [...f.script, ...f.list, ...f.catalog, ...f.base]) {
    const a = e.act == null ? undefined : ACT_NUM[e.act]
    if (a !== undefined && (best === null || a < best)) best = a
  }
  return best
}

export const resolveItemId = (pack: BuildPack, id: string): string => pack.itemAliases[id]?.to ?? id

export type Excluded =
  | { kind: 'act'; from: number }
  | { kind: 'stage'; level: VerificationLevel }
  | { kind: 'act-unknown' }

/** Why an option is left out in this mode (null = usable). */
export function excludedBy(pack: BuildPack, mode: Mode, act: string, itemId: string): Excluded | null {
  if (mode === 'raw') return null
  const item = pack.items[resolveItemId(pack, itemId)]
  if (!item) return null
  const ea = earliestAct(item)
  if (ea !== null && ea > actNumber(act)) return { kind: 'act', from: ea }
  if (mode === 'verified') {
    if (!VERIFIED.has(item.verification)) return { kind: 'stage', level: item.verification }
    if (ea === null) return { kind: 'act-unknown' }
  }
  return null
}

export interface Candidate {
  itemId: string
  name: string
  rank: number
  level: VerificationLevel
  /** Unique key in the matching; generic placeholders (e.g. "Kurzschwert") get one key per option, so they never collide. */
  key: string
  excluded: Excluded | null
}
export interface Need {
  member: string
  slot: string
  /** All options of the guide for this slot and act, in rank order. */
  options: Candidate[]
}

/** One need per member and slot that the member's guide names for this act. */
export function buildNeeds(pack: BuildPack, members: readonly string[], act: string, mode: Mode): Need[] {
  const out: Need[] = []
  for (const m of members) {
    const b = pack.builds.find((x) => x.id === m)
    const g = b?.gear[act as keyof typeof b.gear]
    if (!g) continue
    for (const s of g.slots) {
      if (s.options.length === 0) continue
      out.push({
        member: m,
        slot: s.slot,
        options: s.options.map((o, i) => {
          const id = resolveItemId(pack, o.itemId)
          const it = pack.items[id]
          return {
            itemId: id,
            name: it?.name ?? id,
            rank: o.rank,
            level: it?.verification ?? 'UNKNOWN',
            key: it?.exception === 'generic' ? `${id}#${m}/${s.slot}/${i}` : id,
            excluded: excludedBy(pack, mode, act, id),
          }
        }),
      })
    }
  }
  return out
}

export const needKey = (member: string, slot: string): string => `${member}/${slot}`

/** Result of the min-cost flow on usable candidates: for each need index its chosen candidate index (or -1). */
export interface Solution { unserved: number; cost: number; pick: number[] }

export function solve(needs: readonly Need[], blocked: ReadonlySet<string> = new Set()): Solution {
  const usable = needs.map((n) => n.options.map((o, i) => ({ o, i })).filter(({ o }) => o.excluded === null && !blocked.has(o.key)))
  const keys = [...new Set(usable.flatMap((u) => u.map(({ o }) => o.key)))].sort()
  const keyIdx = new Map(keys.map((k, i) => [k, i]))
  const N = needs.length
  const n = 2 + N + keys.length
  const S = 0
  const T = 1
  type Edge = { to: number; cap: number; cost: number; rev: number }
  const g: Edge[][] = Array.from({ length: n }, () => [])
  const add = (u: number, v: number, cap: number, cost: number) => {
    g[u].push({ to: v, cap, cost, rev: g[v].length })
    g[v].push({ to: u, cap: 0, cost: -cost, rev: g[u].length - 1 })
  }
  usable.forEach((u, i) => {
    add(S, 2 + i, 1, 0)
    for (const { o } of u) add(2 + i, 2 + N + keyIdx.get(o.key)!, 1, o.rank)
  })
  keys.forEach((_, k) => add(2 + N + k, T, 1, 0))
  let flow = 0
  let cost = 0
  for (;;) {
    const dist: (number | null)[] = Array(n).fill(null)
    const inq: boolean[] = Array(n).fill(false)
    const prev: ([number, number] | null)[] = Array(n).fill(null)
    dist[S] = 0
    const q = [S]
    for (let h = 0; h < q.length; h++) {
      const u = q[h]
      inq[u] = false
      g[u].forEach((e, ei) => {
        const du = dist[u]!
        if (e.cap > 0 && (dist[e.to] === null || du + e.cost < dist[e.to]!)) {
          dist[e.to] = du + e.cost
          prev[e.to] = [u, ei]
          if (!inq[e.to]) { inq[e.to] = true; q.push(e.to) }
        }
      })
    }
    if (dist[T] === null) break
    for (let v = T; v !== S;) {
      const [u, ei] = prev[v]!
      g[u][ei].cap -= 1
      g[v][g[u][ei].rev].cap += 1
      v = u
    }
    flow += 1
    cost += dist[T]
  }
  const pick = needs.map((_, i) => {
    const e = g[2 + i].find((x) => x.to >= 2 + N && x.cap === 0)
    if (!e) return -1
    const key = keys[e.to - 2 - N]
    return needs[i].options.findIndex((o) => o.key === key && o.excluded === null)
  })
  return { unserved: N - flow, cost, pick }
}

// ------------------------------------------------------------------------------------------------------------------

export interface SlotResult {
  member: string
  slot: string
  options: Candidate[]
  chosen: Candidate | null
  locked: boolean
  /** Number of usable options (after the filter); under 3 the slot is a gap. */
  usable: number
  gap: boolean
  /** For rank > 1 or no item: the reason for each better usable-in-principle option. */
  whyNot: { name: string; rank: number; reason: string }[]
}
export interface Assignment {
  slots: SlotResult[]
  unserved: number
  /** Sum of guide ranks of the chosen items (locked items count with their rank, 0 if not an option of the guide). */
  rankSum: number
}

const stageText = (l: VerificationLevel) => l.toLowerCase().replaceAll('_', ' ')

/** Plain-language reason for a left-out option (shown next to the option). */
export function excludedText(e: Excluded): string {
  if (e.kind === 'act') return `not available before Act ${e.from}`
  if (e.kind === 'stage') return `stage is ${stageText(e.level)}`
  return 'act of the source is unknown'
}

/**
 * Assign gear for a lineup. `locked` maps `member/slot` to an item id chosen by hand; those are fixed and their items are
 * blocked for everybody else. Locked items must be in the pack; unknown ids are ignored.
 */
export function assignGear(
  pack: BuildPack, members: readonly string[], act: string, mode: Mode, locked: Readonly<Record<string, string>> = {},
): Assignment {
  const all = buildNeeds(pack, members, act, mode)
  const lockedNeeds = new Map<number, Candidate>()
  const blocked = new Set<string>()
  all.forEach((n, i) => {
    const want = locked[needKey(n.member, n.slot)]
    if (!want) return
    const id = resolveItemId(pack, want)
    const it = pack.items[id]
    if (!it || blocked.has(id)) return
    const fromOpt = n.options.find((o) => o.itemId === id)
    lockedNeeds.set(i, fromOpt ?? { itemId: id, name: it.name, rank: 0, level: it.verification, key: id, excluded: null })
    blocked.add(it.exception === 'generic' ? `${id}#locked` : id)
  })
  const freeIdx = all.map((_, i) => i).filter((i) => !lockedNeeds.has(i))
  const free = freeIdx.map((i) => all[i])
  // Keys of locked items are blocked in the matching (a locked generic placeholder is not unique and blocks nothing).
  const sol = solve(free, new Set([...blocked].filter((k) => !k.endsWith('#locked'))))
  const owner = new Map<string, string>() // item key -> "member slot" that holds it
  lockedNeeds.forEach((c, i) => owner.set(c.key, `${all[i].member} ${SLOT_LABEL[all[i].slot] ?? all[i].slot}`))
  free.forEach((n, j) => { if (sol.pick[j] >= 0) owner.set(n.options[sol.pick[j]].key, `${n.member} ${SLOT_LABEL[n.slot] ?? n.slot}`) })

  const slots: SlotResult[] = all.map((n, i) => {
    const j = freeIdx.indexOf(i)
    const chosen = lockedNeeds.get(i) ?? (j >= 0 && sol.pick[j] >= 0 ? n.options[sol.pick[j]] : null)
    const usable = n.options.filter((o) => o.excluded === null).length
    const whyNot: SlotResult['whyNot'] = []
    for (const o of n.options) {
      if (chosen && o.rank >= chosen.rank && !lockedNeeds.has(i)) break
      if (o === chosen || o.itemId === chosen?.itemId) continue
      let reason: string
      if (o.excluded) reason = excludedText(o.excluded)
      else {
        const by = owner.get(o.key)
        reason = by ? `used by ${by}` : lockedNeeds.has(i) ? 'locked choice instead' : 'better overall elsewhere'
      }
      whyNot.push({ name: o.name, rank: o.rank, reason })
    }
    return { member: n.member, slot: n.slot, options: n.options, chosen, locked: lockedNeeds.has(i), usable, gap: usable < 3, whyNot }
  })
  return {
    slots,
    unserved: slots.filter((s) => !s.chosen).length,
    rankSum: slots.reduce((s, r) => s + (r.chosen?.rank ?? 0), 0),
  }
}

/** Overlaps that remain: items two members both list at rank 1 in this act (for the summary line). */
export function rankOneOverlaps(needs: readonly Need[]): number {
  const seen = new Map<string, number>()
  for (const n of needs) {
    const o = n.options.find((x) => x.rank === 1 && x.excluded === null)
    if (o) seen.set(o.key, (seen.get(o.key) ?? 0) + 1)
  }
  return [...seen.values()].filter((c) => c > 1).length
}

/** The 45 lineups: the two fixed members plus two of the others, in pool order. */
export function allLineups(pack: BuildPack): string[][] {
  const fixed: string[] = [...pack.party.fixed]
  const rest = pack.party.pool.filter((m) => !fixed.includes(m))
  const out: string[][] = []
  for (let i = 0; i < rest.length; i++) for (let j = i + 1; j < rest.length; j++) out.push([...fixed, rest[i], rest[j]])
  return out
}
