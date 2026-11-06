import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BuildPackSchema, canonicalJson, packHashOf, type BuildPack } from './buildpack'

const raw = JSON.parse(readFileSync('public/data/builds.pack.json', 'utf-8')) as Record<string, unknown>
const ORDER = ['Act 1', 'Act 1.5', 'Act 2', 'Act 3']
const SCRIPT_ACT: Record<string, string> = { 'Akt 1': 'Act 1', 'Akt 1.5': 'Act 1.5', 'Akt 2': 'Act 2', 'Akt 3': 'Act 3', Prolog: 'Act 1' }

describe('builds.pack.json (B1)', () => {
  const parsed = BuildPackSchema.safeParse(raw)
  it('matches the schema', () => {
    if (!parsed.success) console.error(parsed.error.issues.slice(0, 5))
    expect(parsed.success).toBe(true)
  })
  if (!parsed.success) return
  const pack: BuildPack = parsed.data

  it('has a package hash that is reproduced here (same canonical JSON as the Python exporter)', async () => {
    expect(await packHashOf(raw)).toBe(pack.packHash)
  })
  it('detects any edit without a new hash', async () => {
    const edited = structuredClone(raw) as { builds: { title: string }[]; packHash: string }
    edited.builds[0].title += '!'
    expect(await packHashOf(edited)).not.toBe(edited.packHash)
  })
  it('has the fixed core and a party of four without companions', () => {
    expect(pack.party.size).toBe(4)
    expect(pack.party.fixed).toEqual(['dark_urge', 'tala'])
    expect(pack.party.pool).toEqual(pack.builds.map((b) => b.id))
  })
  it('gives every build 20 levels 1..20 and class levels that add up to 20', () => {
    for (const b of pack.builds) {
      expect(b.levels.map((l) => l.totalLevel)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
      expect(b.classSplit.reduce((s, c) => s + c.levels, 0)).toBe(20)
      const max: Record<string, number> = {}
      for (const l of b.levels) max[l.cls] = Math.max(max[l.cls] ?? 0, l.classLevel)
      expect(Object.fromEntries(b.classSplit.map((c) => [c.cls, c.levels]))).toEqual(max)
    }
  })
  it('plans the bonus feats on total levels 2, 3, 4, 8, 12, 16, 19 (MCM FeatsUni)', () => {
    for (const b of pack.builds) {
      const bonus = new Set(b.levels.filter((l) => l.feats.some((f) => f.kind === 'bonus')).map((l) => l.totalLevel))
      for (const lv of [2, 3, 4, 8, 12, 16, 19]) expect(bonus.has(lv), `${b.id} level ${lv}`).toBe(true)
    }
  })
  it('numbers the ranks consecutively and refers only to known items, never twice in one slot', () => {
    for (const b of pack.builds)
      for (const g of Object.values(b.gear))
        for (const s of g.slots) {
          expect(s.options.map((o) => o.rank)).toEqual(s.options.map((_, i) => i + 1))
          const ids = s.options.map((o) => o.itemId)
          expect(new Set(ids).size).toBe(ids.length)
          for (const id of ids) expect(pack.items[id], `${b.id} ${s.slot} ${id}`).toBeDefined()
        }
  })
  it('uses exactly the items it lists and names every synthetic ID exception', () => {
    const used = new Set(pack.builds.flatMap((b) => Object.values(b.gear).flatMap((g) => g.slots.flatMap((s) => s.options.map((o) => o.itemId)))))
    for (const u of Object.values(pack.itemUpgrades)) used.add(u.to)
    expect(new Set(Object.keys(pack.items))).toEqual(used)
    for (const [id, it] of Object.entries(pack.items)) if (it.source === 'synthetic') expect(it.exception, id).toBeDefined()
  })
  it('puts no item into an act before the installed FED script distributes it', () => {
    for (const b of pack.builds)
      for (const [act, g] of Object.entries(b.gear))
        for (const s of g.slots)
          for (const o of s.options) {
            if (o.inherited) continue
            const acts = pack.items[o.itemId].found.script.map((x) => SCRIPT_ACT[x.act]).filter(Boolean)
            if (acts.length) expect(ORDER.indexOf(act), `${b.id} ${act} ${pack.items[o.itemId].name}`).toBeGreaterThanOrEqual(Math.min(...acts.map((a) => ORDER.indexOf(a))))
          }
  })
  it('backs every correction with a proof and a verification level, and applies it', () => {
    const names = new Set(Object.values(pack.items).map((i) => i.name))
    expect(pack.audit.corrections.length).toBeGreaterThan(0)
    for (const c of pack.audit.corrections) {
      expect(c.proof.trim().length, c.id).toBeGreaterThan(0)
      if (c.type === 'name') {
        expect(names.has((c.original as { name: string }).name), c.id).toBe(false)
        expect(names.has((c.new as { name: string }).name), c.id).toBe(true)
      }
    }
  })
  it('does not leak correction hints into builds or items', () => {
    const text = JSON.stringify({ b: pack.builds, i: pack.items })
    for (const bad of ['"original"', 'korrigiert', 'Korrektur']) expect(text.includes(bad), bad).toBe(false)
  })
  it('records the two confirmed in-game findings', () => {
    expect(pack.ingameFindings.map((f) => f.id).sort()).toEqual(['bef-animate-dead-wyll-5', 'bef-create-water-halsin-1'])
  })
  it('maps alias IDs onto listed items and keeps no alias as an item of its own', () => {
    for (const [from, v] of Object.entries(pack.itemAliases)) {
      expect(pack.items[from], from).toBeUndefined()
      expect(pack.items[v.to], v.to).toBeDefined()
    }
  })
  it('describes the Deathsong upgrade chain (+3 to +5) with materials', () => {
    const [from, u] = Object.entries(pack.itemUpgrades)[0]
    expect(pack.items[from].name).toBe('Deathsong')
    expect(pack.items[u.to].name).toBe('Deathsong+')
    expect(u.craftedFrom).toContain('Phalar Aluve')
  })
  it('keeps the open item-ID decisions explicit (distinct candidates only)', () => {
    for (const d of pack.openDecisions) expect(new Set(d.kandidaten).size).toBeGreaterThan(1)
  })
})

describe('schema rejects damaged packages', () => {
  const damage = (fn: (p: Record<string, unknown>) => void) => {
    const c = structuredClone(raw)
    fn(c)
    return BuildPackSchema.safeParse(c).success
  }
  it('rejects a missing level, a wrong party size and an unknown slot', () => {
    expect(damage((p) => ((p.builds as { levels: unknown[] }[])[0].levels.pop()))).toBe(false)
    expect(damage((p) => ((p.party as { size: number }).size = 3))).toBe(false)
    expect(damage((p) => {
      const b = (p.builds as { gear: Record<string, { slots: { slot: string }[] }> }[])[0]
      b.gear[Object.keys(b.gear)[0]].slots[0].slot = 'tail'
    })).toBe(false)
  })
  it('canonical JSON sorts keys and keeps non-ASCII characters', () => {
    expect(canonicalJson({ b: 1, a: ['ä', null, true] })).toBe('{"a":["ä",null,true],"b":1}')
  })
})
