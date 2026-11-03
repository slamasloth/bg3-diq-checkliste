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
  it('uses English verification labels', () => {
    const allowed = new Set(['sourced', 'candidate', 'unverified', 'conflict', 'separate'])
    expect(rows.every((r) => allowed.has(r.verification))).toBe(true)
  })
})
