import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BuildPackSchema, type BuildPack } from './buildpack'
import { createGuidePdf, guideDocument, guideFileName, PALETTES, paragraphs, pdfText, type FontLoader } from './guidePdf'

const loadFont: FontLoader = async (url) => {
  const b = readFileSync(fileURLToPath(url))
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
}
const pack: BuildPack = BuildPackSchema.parse(JSON.parse(readFileSync('public/data/builds.pack.json', 'utf-8')))
const json = (ids: string[], theme: 'screen' | 'print' = 'screen') => JSON.stringify(guideDocument(pack, ids, { theme }))
const ALL = pack.builds.map((b) => b.id)

describe('guide PDF document (pure definition)', () => {
  it('removes glyphs the embedded fonts cannot draw and tidies spacing', () => {
    expect(pdfText('Extra Attack →; Fire Shield → (Dia)')).toBe('Extra Attack; Fire Shield (Dia)')
    expect(pdfText('⚠ Im Spiel prüfen')).toBe('! Im Spiel prüfen')
    expect(pdfText('ab')).toBe('ab')
  })
  it('contains every level row and every gear option of a build, in both themes', () => {
    for (const theme of ['screen', 'print'] as const)
      for (const b of pack.builds) {
        const doc = json([b.id], theme)
        for (const l of b.levels) expect(doc, `${b.id} level ${l.totalLevel}`).toContain(`${l.cls} ${l.classLevel}`)
        for (const g of Object.values(b.gear))
          for (const s of g.slots) for (const o of s.options) expect(doc, `${b.id} ${pack.items[o.itemId].name}`).toContain(JSON.stringify(pdfText(pack.items[o.itemId].name)).slice(1, -1))
      }
  })
  it('never contains characters the fonts lack, nor correction hints', () => {
    const doc = json(ALL)
    expect(/[⚠-]/.test(doc)).toBe(false)
    expect(/→(?!\s?\d)/.test(doc.replace(/\d\s→\s\d/g, ''))).toBe(false) // link arrows are gone; only «2 → 20» between numbers stays
    for (const bad of ['korrigiert', 'Korrektur', '"original"']) expect(doc.includes(bad), bad).toBe(false)
  })
  it('gives each sheet an id, a tab bar and working links between the three sheets', () => {
    const text = json(['dark_urge', 'tala', 'wyll'])
    const targets = [...text.matchAll(/"linkToDestination":"([^"]+)"/g)].map((m) => m[1])
    for (const id of ['dark_urge', 'tala', 'wyll']) for (const t of [`build-${id}`, `build-${id}-s2`, `build-${id}-s3`]) expect(targets, t).toContain(t)
    for (const t of new Set(targets)) expect(text, t).toContain(`"id":"${t}"`)
    for (const t of ['1 · Level und Build', '2 · Ausrüstung', '3 · Kampf und Offenes']) expect(json(['tala']).split(t).length - 1, t).toBe(3)
  })
  it('shares no object between nodes (pdfmake writes layout data into nodes; sharing corrupted later documents)', () => {
    for (const theme of ['screen', 'print'] as const) {
      const seen = new Set<object>()
      const dupes: string[] = []
      const walk = (o: unknown) => {
        if (Array.isArray(o)) return o.forEach(walk)
        if (o && typeof o === 'object') {
          if (seen.has(o)) dupes.push(JSON.stringify(o).slice(0, 60))
          seen.add(o)
          Object.values(o).forEach(walk)
        }
      }
      walk((guideDocument(pack, ALL, { theme }) as { content: unknown }).content)
      expect(dupes, theme).toEqual([])
    }
  })
  it('names files predictably and rejects unknown builds', () => {
    expect(guideFileName(pack, ['tala'])).toBe(`BG3-DIQ-Guide-tala-${pack.meta.dataDate}.pdf`)
    expect(guideFileName(pack, ['tala'], { theme: 'print' })).toBe(`BG3-DIQ-Guide-tala-${pack.meta.dataDate}-druck.pdf`)
    expect(guideFileName(pack, ALL)).toBe(`BG3-DIQ-Guides-alle-${pack.meta.dataDate}.pdf`)
    expect(() => guideDocument(pack, ['nobody'])).toThrow('Unknown build')
  })
})

describe('design', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
  it('keeps every text colour readable on every background it is used on (WCAG AA, 4.5:1)', () => {
    for (const [theme, p] of Object.entries(PALETTES)) {
      const backgrounds: [string, string][] = [['page', p.bg ?? '#ffffff'], ['panel', p.panel], ['head', p.head], ['thead', p.thead], ['tab', p.tab], ['tabOn', p.tabOn]]
      for (const [name, bg] of backgrounds) for (const fg of ['ink', 'muted', 'faint', 'accent'] as const) expect(contrast(p[fg], bg), `${theme}: ${fg} on ${name}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('takes the accent colour of the full guide for the screen theme and uses page-sized 9:16 pages', () => {
    expect(PALETTES.screen.accent).toBe('#ffa03c')
    expect((guideDocument(pack, ['tala']) as { pageSize: unknown }).pageSize).toEqual({ width: 482, height: 857 })
    expect((guideDocument(pack, ['tala'], { theme: 'print' }) as { pageSize: unknown }).pageSize).toBe('A4')
  })
  it('joins wrapped lines into paragraphs and repairs soft hyphens', () => {
    const long = 'Das ist eine lange Zeile, die am Zeilenende abgebrochen wur‐'
    expect(paragraphs([long, 'de und weitergeht.', 'KURZ'])).toEqual(['Das ist eine lange Zeile, die am Zeilenende abgebrochen wurde und weitergeht.', 'KURZ'])
  })
})

describe('guide PDF file (the same code path the app uses, with the real fonts)', () => {
  it('creates real PDFs in both themes for the fixed core and for all twelve guides, repeatably', async () => {
    const core = await createGuidePdf(pack, pack.party.fixed.slice(), {}, loadFont)
    expect(new TextDecoder().decode(new Uint8Array(await core.arrayBuffer()).slice(0, 5))).toBe('%PDF-')
    expect(core.size).toBeGreaterThan(300_000) // contains the embedded fonts
    const all = await createGuidePdf(pack, ALL, {}, loadFont)
    expect(all.size).toBeGreaterThan(core.size)
    const again = await createGuidePdf(pack, pack.party.fixed.slice(), {}, loadFont)
    expect(Math.abs(again.size - core.size)).toBeLessThan(2_000)
    const print = await createGuidePdf(pack, pack.party.fixed.slice(), { theme: 'print' }, loadFont)
    expect(print.size).toBeGreaterThan(300_000)
    const out = process.env.GUIDE_PDF_OUT
    if (out) {
      mkdirSync(out, { recursive: true })
      for (const [name, blob] of [['kern', core], ['alle', all], ['druck', print]] as const) writeFileSync(`${out}/${name}.pdf`, new Uint8Array(await blob.arrayBuffer()))
    }
  }, 120_000)
})
