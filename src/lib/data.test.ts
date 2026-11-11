import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ChecklistSchema } from './schema'

const raw = JSON.parse(readFileSync('public/data/checklist.json', 'utf-8'))

describe('checklist.json (M1 data package)', () => {
  const parsed = ChecklistSchema.safeParse(raw)
  it('matches the schema', () => {
    if (!parsed.success) console.error(parsed.error.issues.slice(0, 5))
    expect(parsed.success).toBe(true)
  })
  if (!parsed.success) return
  const rows = parsed.data.regions.flatMap((g) => [...g.base, ...g.mod])
  it('contains all 1880 entries (1235 base, 603 FED, 42 step 3)', () => {
    expect(rows.filter((r) => r.origin === 'base')).toHaveLength(1235)
    expect(rows.filter((r) => r.origin === 'fed')).toHaveLength(603)
    expect(rows.filter((r) => r.origin === 'content')).toHaveLength(42)
  })
  it('gives every row an ID so that every row can be ticked off (276 plain tips included)', () => {
    expect(rows.filter((r) => r.kind === 'note')).toHaveLength(276)
    expect(rows.every((r) => r.id.length > 0)).toBe(true)
  })
  it('has no open data conflicts (JWL double UUIDs, step 3 leftovers, FED act conflict, Necrobroker)', () => {
    expect(parsed.data.issues).toEqual([])
    const act2 = parsed.data.regions.filter((g) => g.act === 'Act 2').flatMap((g) => g.mod)
    expect(act2.filter((r) => r.text === "Cloak of the Smiter's Boon")).toHaveLength(1)
    expect(rows.filter((r) => r.text === "Cloak of the Smiter's Boon")).toHaveLength(1)
    expect(parsed.data.regions.some((g) => g.title === 'Act conflict (blocked)')).toBe(false)
    const necro = rows.find((r) => r.origin === 'content' && /Necrobroker clues/.test(r.text))
    expect(necro?.configDependency).toMatch(/active in the load order/)
    expect(necro?.condition).not.toMatch(/Only with/)
  })
  it('keeps the three step-3 rows without a known area in their own group (no invented location)', () => {
    const group = parsed.data.regions.find((g) => g.title === 'Step 3: location open')
    expect(group?.mod.map((r) => r.id).sort()).toEqual(['diq-ct-214ae86aee85c2', 'diq-ct-4145efad942318', 'diq-ct-f5056109dc1609'])
  })
  it('has unique IDs', () => expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length))
  it('assigns every region to a known act', () => {
    for (const g of parsed.data.regions) expect(parsed.data.acts).toContain(g.act)
  })
  it('Mountain Pass is Act 1.5, Owlbear Nest stays Act 1', () => {
    const act = (t: string) => parsed.data.regions.find((g) => g.title === t)?.act
    expect(act('Mountain Pass')).toBe('Act 1.5')
    expect(act('Owlbear Nest')).toBe('Act 1')
  })
  it('contains no German text in descriptive fields', () => {
    const fields = ['foundAt', 'missableText', 'act', 'evidence', 'hint', 'dedupeNote', 'effectStatus', 'contentType', 'condition', 'reward', 'configDependency'] as const
    const german = /[äöüÄÖÜß]|\b(und|mit|bei|nahe|der|die|das|nicht|truhe|akt|fundort)\b/i
    const hits = rows.flatMap((r) => fields.filter((f) => r[f] && german.test(r[f] as string)).map((f) => `${r.id}.${f}: ${r[f]}`))
    expect(hits).toEqual([])
    const titles = parsed.data.regions.map((g) => g.title + g.act)
    expect(titles.filter((t) => /[äöüÄÖÜß]|\b(Akt|ungeklärt|Fundort)\b/.test(t))).toEqual([])
  })
  it('"BEFORE CONTINUING" checklists sit in the act being left and are flagged', () => {
    const act = (t: string) => parsed.data.regions.find((g) => g.title === t)
    expect(act('BEFORE CONTINUING TO ACT 1.5')).toMatchObject({ act: 'Act 1', pointOfNoReturn: true })
    expect(act('BEFORE CONTINUING TO ACT 2')).toMatchObject({ act: 'Act 1.5', pointOfNoReturn: true })
    expect(act('BEFORE CONTINUING TO THE TEMPLE')).toMatchObject({ act: 'Act 2', pointOfNoReturn: true })
    expect(act('BEFORE CONTINUING TO ACT 3')).toMatchObject({ act: 'Act 2', pointOfNoReturn: true })
  })
  it('never shows a source row in an act that contradicts the act named by the source', () => {
    const rank = (a: string) => ({ 'Act 1': 1, 'Act 1.5': 1, 'Act 2': 2, 'Act 3': 3 })[a]
    const bad = parsed.data.regions
      .filter((g) => rank(g.act))
      .flatMap((g) => g.mod.filter((r) => r.act && rank(r.act) && rank(r.act) !== rank(g.act)).map((r) => `${r.text} (${r.act} in ${g.title}/${g.act})`))
    expect(bad).toEqual([])
  })
  it('only uses https links', () => expect(rows.filter((r) => r.url && !r.url.startsWith('https://'))).toEqual([]))
  it('uses English verification labels', () => {
    const allowed = new Set(['sourced', 'candidate', 'unverified', 'conflict', 'separate'])
    expect(rows.every((r) => allowed.has(r.verification))).toBe(true)
  })
})
