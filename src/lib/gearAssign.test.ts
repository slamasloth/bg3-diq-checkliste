import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BuildPackSchema, type BuildPack } from './buildpack'
import { allLineups, assignGear, buildNeeds, solve, type Candidate, type Mode, type Need } from './gearAssign'

const pack: BuildPack = BuildPackSchema.parse(JSON.parse(readFileSync('public/data/builds.pack.json', 'utf-8')))
const ACTS = ['Act 1', 'Act 1.5', 'Act 2', 'Act 3']
const MODES: Mode[] = ['raw', 'dated', 'verified']

// ---- Independent judge: exhaustive search per connected component (shares no code with `solve`). -------------------
function judge(needs: readonly Need[]): { unserved: number; cost: number } {
  const edges = needs.map((n) => n.options.filter((o) => o.excluded === null).map((o) => [o.key, o.rank] as const))
  const parent = needs.map((_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const first = new Map<string, number>()
  edges.forEach((es, i) => es.forEach(([k]) => (first.has(k) ? (parent[find(i)] = find(first.get(k)!)) : first.set(k, i))))
  const comps = new Map<number, number[]>()
  needs.forEach((_, i) => comps.set(find(i), [...(comps.get(find(i)) ?? []), i]))
  let unserved = 0
  let cost = 0
  for (const comp of comps.values()) {
    const order = [...comp].sort((a, b) => edges[a].length - edges[b].length)
    let best: [number, number] | null = null
    const dfs = (pos: number, used: Set<string>, unc: number, c: number) => {
      if (best && (unc > best[0] || (unc === best[0] && c >= best[1]))) return
      if (pos === order.length) { best = [unc, c]; return }
      for (const [k, r] of [...edges[order[pos]]].sort((a, b) => a[1] - b[1])) {
        if (!used.has(k)) { used.add(k); dfs(pos + 1, used, unc, c + r); used.delete(k) }
      }
      dfs(pos + 1, used, unc + 1, c)
    }
    dfs(0, new Set(), 0, 0)
    unserved += best![0]
    cost += best![1]
  }
  return { unserved, cost }
}

function greedy(needs: readonly Need[]) {
  const used = new Set<string>()
  let unserved = 0
  let cost = 0
  for (const n of needs) {
    const o = n.options.find((x) => x.excluded === null && !used.has(x.key))
    if (o) { used.add(o.key); cost += o.rank } else unserved++
  }
  return { unserved, cost }
}

const cand = (key: string, rank: number): Candidate => ({ itemId: key, name: key, rank, level: 'AUTHOR_DOCUMENTED', key, excluded: null })
const need = (id: string, ...opts: [string, number][]): Need => ({ member: id, slot: 'head', options: opts.map(([k, r]) => cand(k, r)) })

describe('gear assigner: small instances against the exhaustive judge', () => {
  it('beats greedy where the first member would take a shared rank-1 item', () => {
    const needs = [need('a', ['x', 1], ['y', 2]), need('b', ['x', 1])]
    const s = solve(needs)
    expect(s.unserved).toBe(0)
    expect(s.cost).toBe(3) // a takes y (2), b takes x (1)
    expect(greedy(needs).unserved).toBe(1)
    expect(judge(needs)).toEqual({ unserved: 0, cost: 3 })
  })
  it('reports a need without any usable option as unserved', () => {
    const needs = [need('a', ['x', 1]), need('b', ['x', 1])]
    expect(solve(needs)).toMatchObject({ unserved: 1, cost: 1 })
  })
  it('matches the judge on 400 seeded random instances', () => {
    let seed = 12345
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff), seed % n)
    for (let t = 0; t < 400; t++) {
      const needs = Array.from({ length: 1 + rnd(7) }, (_, i) =>
        need(`m${i}`, ...[...new Set(Array.from({ length: rnd(4) }, () => `i${rnd(6)}`))].map((k, r): [string, number] => [k, r + 1])))
      const s = solve(needs)
      expect({ unserved: s.unserved, cost: s.cost }).toEqual(judge(needs))
      const picked = s.pick.map((p, i) => (p >= 0 ? needs[i].options[p].key : null)).filter(Boolean)
      expect(new Set(picked).size).toBe(picked.length)
    }
  })
})

describe('gear assigner on the real build pack', () => {
  const lineups = allLineups(pack)
  it('has 45 lineups with the two fixed members', () => {
    expect(lineups).toHaveLength(45)
    for (const l of lineups) expect(l.slice(0, 2)).toEqual(['dark_urge', 'tala'])
  })

  // Reference values of the Python prototype (builds/tools/m4_party_gear_pruefung.py), same pack hash.
  const FULL: Record<Mode, number[]> = { raw: [28, 45, 45, 45], dated: [28, 45, 45, 45], verified: [0, 28, 21, 28] }
  for (const mode of MODES) {
    it(`serves every slot of exactly ${FULL[mode].join('/')} lineups in acts 1/1.5/2/3 (mode ${mode}) and agrees with the judge`, () => {
      ACTS.forEach((act, a) => {
        let full = 0
        for (const l of lineups) {
          const needs = buildNeeds(pack, l, act, mode)
          const s = solve(needs)
          const j = judge(needs)
          expect({ unserved: s.unserved, cost: s.cost }).toEqual(j)
          const g = greedy(needs)
          expect(s.unserved).toBeLessThanOrEqual(g.unserved)
          if (s.unserved === g.unserved) expect(s.cost).toBeLessThanOrEqual(g.cost)
          if (s.unserved === 0) full++
        }
        expect(full).toBe(FULL[mode][a])
      })
    })
  }

  it('never gives an item twice and never before its earliest source act (mode dated)', () => {
    for (const l of lineups.slice(0, 15)) {
      for (const act of ACTS) {
        const r = assignGear(pack, l, act, 'dated')
        const ids = r.slots.filter((s) => s.chosen && pack.items[s.chosen.itemId]?.exception !== 'generic').map((s) => s.chosen!.itemId)
        expect(new Set(ids).size).toBe(ids.length)
        for (const s of r.slots) expect(s.chosen?.excluded ?? null).toBeNull()
      }
    }
  })

  it('marks slots with fewer than three usable options as gaps instead of filling them', () => {
    const r = assignGear(pack, ['dark_urge', 'tala'], 'Act 1', 'verified')
    expect(r.slots.length).toBeGreaterThan(0)
    for (const s of r.slots) expect(s.gap).toBe(s.usable < 3)
    expect(r.unserved).toBe(2) // Dark Urge main hand and ranged weapon have no verified option in Act 1
    expect(r.slots.filter((s) => !s.chosen).every((s) => s.whyNot.length > 0)).toBe(true)
  })

  it('keeps locked choices, blocks their item for others and recomputes the rest', () => {
    const base = assignGear(pack, ['dark_urge', 'tala'], 'Act 3', 'dated')
    const target = base.slots.find((s) => s.chosen && s.options.length > 1 && s.options.some((o) => o.itemId !== s.chosen!.itemId && o.excluded === null))!
    const other = target.options.find((o) => o.itemId !== target.chosen!.itemId && o.excluded === null)!
    const locked = { [`${target.member}/${target.slot}`]: other.itemId }
    const r = assignGear(pack, ['dark_urge', 'tala'], 'Act 3', 'dated', locked)
    const t = r.slots.find((s) => s.member === target.member && s.slot === target.slot)!
    expect(t.locked).toBe(true)
    expect(t.chosen?.itemId).toBe(other.itemId)
    const holders = r.slots.filter((s) => s.chosen?.itemId === other.itemId)
    expect(holders).toHaveLength(1)
    // idempotent: the same input gives the same result
    expect(assignGear(pack, ['dark_urge', 'tala'], 'Act 3', 'dated', locked)).toEqual(r)
  })

  it('ignores a lock with an unknown item id', () => {
    const base = assignGear(pack, ['dark_urge', 'tala'], 'Act 2', 'dated')
    const r = assignGear(pack, ['dark_urge', 'tala'], 'Act 2', 'dated', { 'dark_urge/head': 'does-not-exist' })
    expect(r).toEqual(base)
  })

  it('explains why rank 1 was not chosen', () => {
    const r = assignGear(pack, ['dark_urge', 'tala', 'minthara', 'shadowheart'], 'Act 1', 'dated')
    const swapped = r.slots.filter((s) => s.chosen && s.chosen.rank > 1)
    expect(swapped.length).toBeGreaterThan(0)
    for (const s of swapped) expect(s.whyNot.length).toBeGreaterThan(0)
  })
})
