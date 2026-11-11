import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BuildPackSchema } from './buildpack'
import { emptyPrefs, LINEUP_KEY, loadPrefs, lockItem, parsePrefs, savePrefs, unlockItem } from './lineup'

const pack = BuildPackSchema.parse(JSON.parse(readFileSync('public/data/builds.pack.json', 'utf-8')))
const someItem = Object.keys(pack.items)[0]

describe('lineup preferences', () => {
  it('starts empty and falls back to empty on garbage', () => {
    expect(parsePrefs(null, pack)).toEqual(emptyPrefs())
    expect(parsePrefs({ extra: 'x' }, pack)).toEqual(emptyPrefs())
  })
  it('keeps only pool members, never the fixed ones, at most two', () => {
    const p = parsePrefs({ extra: ['dark_urge', 'wyll', 'wyll', 'nobody', 'gale', 'karlach'], act: 'Act 2', verifiedOnly: true, locked: {} }, pack)
    expect(p.extra).toEqual(['wyll', 'gale'])
    expect(p.act).toBe('Act 2')
    expect(p.verifiedOnly).toBe(true)
  })
  it('drops locks of members outside the lineup, unknown slots and unknown items', () => {
    const p = parsePrefs({
      extra: ['wyll'], act: 'Act 9', verifiedOnly: false,
      locked: { 'Act 1': { [`wyll/head`]: someItem, 'gale/head': someItem, 'wyll/tail': someItem, 'wyll/body': 'nope' }, 'Act 7': { 'wyll/head': someItem } },
    }, pack)
    expect(p.act).toBe('Act 1')
    expect(p.locked).toEqual({ 'Act 1': { 'wyll/head': someItem } })
  })
  it('releases an item that is locked a second time', () => {
    let p = lockItem(emptyPrefs(), 'Act 1', 'dark_urge/head', 'x')
    p = lockItem(p, 'Act 1', 'tala/head', 'x')
    expect(p.locked['Act 1']).toEqual({ 'tala/head': 'x' })
    expect(unlockItem(p, 'Act 1', 'tala/head').locked['Act 1']).toEqual({})
  })
  it('saves and loads through a storage and survives a broken one', () => {
    const mem = new Map<string, string>()
    const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) }
    const p = { ...emptyPrefs(), extra: ['wyll'], verifiedOnly: true }
    expect(savePrefs(p, st)).toBe(true)
    expect(mem.has(LINEUP_KEY)).toBe(true)
    expect(loadPrefs(pack, st)).toEqual(p)
    expect(savePrefs(p, { setItem: () => { throw new Error('full') } })).toBe(false)
    expect(loadPrefs(pack, { getItem: () => '{broken' })).toEqual(emptyPrefs())
  })
})
