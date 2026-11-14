import { describe, expect, it } from 'vitest'
import { activeFilterCount, passes, regionStats, tierOf, visibleRows } from './counts'
import { noFilters } from './logic'
import type { Region, Row } from './schema'

const row = (id: string, p: Partial<Row> = {}) => ({ id, kind: 'task', text: id, verification: 'sourced', depth: 0, origin: 'base', ...p }) as Row
const region = (base: Row[], mod: Row[] = []) => ({ id: 'g', title: 'G', act: 'Act 1', base, mod }) as Region
const l = { isChecked: (id: string) => id === 'done', memberOf: () => '' }

describe('regionStats', () => {
  it('counts done rows and only still-open missables', () => {
    const g = region([row('done', { missable: true }), row('a', { missable: true }), row('b')], [row('c', { kind: 'missable' })])
    expect(regionStats(g, l.isChecked)).toEqual({ done: 1, total: 4, openMissable: 2 })
  })
})

describe('tier filter', () => {
  const maybe = row('m', { missableText: 'Possibly' })
  const sure = row('s', { missable: true })
  const plain = row('p')
  it('maybe / not / any', () => {
    expect(passes(maybe, 'G', noFilters(), 'maybe', l)).toBe(true)
    expect(passes(sure, 'G', noFilters(), 'maybe', l)).toBe(false)
    expect(passes(plain, 'G', noFilters(), 'not', l)).toBe(true)
    expect(passes(maybe, 'G', noFilters(), 'not', l)).toBe(false)
    expect(passes(sure, 'G', noFilters(), 'any', l)).toBe(true)
  })
  it('the quick chip means tier "missable"', () => {
    expect(tierOf({ ...noFilters(), missableOnly: true }, 'any')).toBe('missable')
    expect(tierOf(noFilters(), 'maybe')).toBe('maybe')
  })
  it('visibleRows applies the filters to base and mod', () => {
    const g = region([maybe, plain], [sure])
    const v = visibleRows(g, noFilters(), 'maybe', l)
    expect(v.base.map((r) => r.id)).toEqual(['m'])
    expect(v.mod).toEqual([])
  })
})

describe('activeFilterCount', () => {
  it('is 0 by default and ignores the search text', () => {
    expect(activeFilterCount(noFilters(), 'any')).toBe(0)
    expect(activeFilterCount({ ...noFilters(), query: 'x' }, 'any')).toBe(0)
  })
  it('counts each active filter once, the tier together with the chip', () => {
    const f = { ...noFilters(), status: 'open' as const, member: '-', missableOnly: true, itemsOnly: true }
    expect(activeFilterCount(f, 'maybe')).toBe(4)
  })
})
