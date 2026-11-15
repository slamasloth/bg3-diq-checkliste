import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BuildPackSchema } from './buildpack'
import { allClasses, endgameViews, filterEntries, gearViews, gradeBand, gradeLabel, levelViews, listEntries, locationsOf, missablesOf, openPointsOf, orderedBuilds, rarityKey, readableHolder, spellParts, verificationBadge } from './guideModel'

const pack = BuildPackSchema.parse(JSON.parse(readFileSync('public/data/builds.pack.json', 'utf-8')))

describe('Guides tab model (data → view)', () => {
  it('lists all 12 builds once, fixed first (Dark Urge, Tala), then the ten picks', () => {
    const e = listEntries(pack)
    expect(e).toHaveLength(12)
    expect(new Set(e.map((x) => x.id)).size).toBe(12)
    expect(e.slice(0, 2).map((x) => x.id)).toEqual(['dark_urge', 'tala'])
    expect(e.filter((x) => x.fixed)).toHaveLength(2)
    expect(e.slice(2).every((x) => !x.fixed)).toBe(true)
    expect(orderedBuilds(pack).map((x) => x.build.id).sort()).toEqual(pack.builds.map((b) => b.id).sort())
  })
  it('gives every entry character, title, class split, core statement and a verification badge', () => {
    for (const x of listEntries(pack)) {
      expect(x.character && x.title && x.split && x.core).toBeTruthy()
      expect(x.verification.label.length).toBeGreaterThan(0)
    }
    const du = listEntries(pack)[0]
    expect(du.split).toBe('Harlequin 14 / Fighter 3 / Sorcerer 3')
  })
  it('maps every verification level to a badge with a word and a symbol', () => {
    for (const v of ['INGAME_CONFIRMED', 'INSTALLED_FILE_CONFIRMED', 'AUTHOR_DOCUMENTED', 'PROJECT_RECONSTRUCTED', 'THEORY_INFERRED', 'UNKNOWN'] as const) {
      const b = verificationBadge(v)
      expect(b.label && b.icon).toBeTruthy()
    }
  })
  it('shows 20 levels per build, equal to the package, with feats carried over', () => {
    for (const b of pack.builds) {
      const lv = levelViews(b)
      expect(lv.map((l) => l.totalLevel)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
      lv.forEach((l, i) => {
        expect(l.cls).toBe(b.levels[i].cls)
        expect(l.classLevel).toBe(b.levels[i].classLevel)
        expect(l.feats).toHaveLength(b.levels[i].feats.length)
      })
    }
  })
  it('shows every slot and option of the package per act, each item with a badge; absent ranks become gaps, nothing is made up', () => {
    for (const b of pack.builds) {
      const g = gearViews(pack, b)
      expect(g.map((a) => a.act)).toEqual(pack.acts)
      for (const a of g) {
        const src = b.gear[a.act]
        expect(a.gap).toBe(!src || src.slots.length === 0)
        expect(a.slots).toHaveLength(src?.slots.length ?? 0)
        a.slots.forEach((s, i) => {
          expect(s.options).toHaveLength(src.slots[i].options.length)
          expect(s.options.length + s.gaps.length).toBe(3)
          for (const o of s.options) {
            expect(o.item, `${b.id} ${o.rank}`).not.toBeNull()
            expect(o.badge?.label).toBeTruthy()
          }
        })
      }
    }
  })
  it('keeps endgame sets and missables complete', () => {
    for (const b of pack.builds) {
      expect(endgameViews(b)).toHaveLength(Object.keys(b.endgameSets).length)
      expect(missablesOf(b)).toHaveLength(b.missables.length)
      expect(openPointsOf(b)).toHaveLength(b.openPoints.length)
    }
  })
  it('shows a location for every option whose item has any; items without one stay empty (gap), nothing is invented', () => {
    let withLoc = 0, without = 0
    for (const b of pack.builds) for (const a of gearViews(pack, b)) for (const s of a.slots) for (const o of s.options) {
      const it = o.item!
      const n = it.found.list.filter((l) => l.place).length + it.found.catalog.filter((c) => c.region || c.place).length + it.found.script.length + it.found.base.length
      expect(o.locations).toHaveLength(n)
      if (n) withLoc++; else without++
      expect(o.origin).toBe(it.source === 'fed' ? 'Mod item' : it.source === 'base' ? 'Base game' : null)
    }
    expect(withLoc).toBeGreaterThan(without)
    expect(without).toBeGreaterThan(0)
  })
  it('gives mod (FED) items a location from the installed game files or lists', () => {
    const fed = Object.values(pack.items).filter((i) => i.source === 'fed' && (i.found.script.length || i.found.list.length))
    expect(fed.length).toBeGreaterThan(100)
    const l = locationsOf(fed.find((i) => i.found.script.length)!)
    expect(l[0].source).toMatch(/Game files|Author list/)
    expect(readableHolder('CONT_GEN_Chest_Heavy_A_003')).toBe('Chest Heavy A 003')
    expect(readableHolder('S_CRE_IntelligenceOfficer01')).toBe('Intelligence Officer01')
  })
  it('maps rarity as stated and never guesses a missing one', () => {
    expect(rarityKey('Very Rare')).toBe('vr')
    expect(rarityKey('Legendary')).toBe('leg')
    expect(rarityKey(null)).toBe('none')
    expect(rarityKey('weird')).toBe('none')
  })
  it('marks spells by exact name with their grade and leaves other text untouched', () => {
    const parts = spellParts('Cantrip Fire Bolt, dazu Fireball → und Shielding', { 'Fire Bolt': 0, Fireball: 3, Shield: 1 })
    expect(parts.filter((p) => p.spell).map((p) => [p.text, p.spell!.grade])).toEqual([['Fire Bolt', 0], ['Fireball', 3]])
    expect(parts.map((p) => p.text).join('')).toBe('Cantrip Fire Bolt, dazu Fireball → und Shielding')
    expect(gradeBand(0)).toBe('c')
    expect(gradeBand(3)).toBe('mid')
    expect(gradeLabel(0)).toBe('Cantrip')
  })
  it('finds spells in the real level texts', () => {
    const du = pack.builds.find((b) => b.id === 'dark_urge')!
    const hits = levelViews(du).flatMap((l) => spellParts(l.text, pack.spellLevels).filter((p) => p.spell))
    expect(hits.length).toBeGreaterThan(5)
  })
  it('filters by class and text', () => {
    const e = listEntries(pack)
    expect(allClasses(e)).toContain('Harlequin')
    expect(filterEntries(e, '', 'Harlequin').map((x) => x.id)).toEqual(['dark_urge'])
    expect(filterEntries(e, 'gale', '').map((x) => x.id)).toEqual(['gale'])
    expect(filterEntries(e, '', '')).toHaveLength(12)
    expect(filterEntries(e, 'zzzz', '')).toHaveLength(0)
  })
})
