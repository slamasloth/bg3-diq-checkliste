import { describe, expect, it } from 'vitest'
import { countRegion, hasActiveFilter, isMissable, mergeStates, noFilters, rowPasses, type Lookup } from './logic'
import { emptyState, type PersistedState, type Region, type Row } from './schema'

const row = (o: Partial<Row>): Row => ({
  id: 'r1', origin: 'base', kind: 'item', depth: 0, text: 'Test Ring', verification: 'sourced', ...o,
})
const none: Lookup = { isChecked: () => false, memberOf: () => '' }

describe('isMissable', () => {
  it('flags missable rows of the base list', () => expect(isMissable(row({ kind: 'missable' }))).toBe(true))
  it('uses the missable flag from the data package', () => expect(isMissable(row({ missable: true }))).toBe(true))
  it('does not flag vague source text without the flag', () =>
    expect(isMissable(row({ missableText: 'Possibly' }))).toBe(false))
})

describe('rowPasses', () => {
  it('passes everything without filters', () => expect(rowPasses(row({}), 'X', noFilters(), none)).toBe(true))
  it('source filter: mods only hides base rows', () =>
    expect(rowPasses(row({}), 'X', { ...noFilters(), source: 'mod' }, none)).toBe(false))
  it('status open hides completed rows', () =>
    expect(rowPasses(row({}), 'X', { ...noFilters(), status: 'open' }, { ...none, isChecked: () => true })).toBe(false))
  it('note rows are never "open"', () =>
    expect(rowPasses(row({ kind: 'note' }), 'X', { ...noFilters(), status: 'open' }, none)).toBe(false))
  it('character filter "-" shows only unassigned items', () => {
    const f = { ...noFilters(), member: '-' }
    expect(rowPasses(row({}), 'X', f, none)).toBe(true)
    expect(rowPasses(row({}), 'X', f, { ...none, memberOf: () => 'p1' })).toBe(false)
    expect(rowPasses(row({ kind: 'task' }), 'X', f, none)).toBe(false)
  })
  it('search also matches the area name, case-insensitive', () =>
    expect(rowPasses(row({}), 'Arcane Tower', { ...noFilters(), query: 'ARCANE' }, none)).toBe(true))
  it('hasActiveFilter', () => {
    expect(hasActiveFilter(noFilters())).toBe(false)
    expect(hasActiveFilter({ ...noFilters(), missableOnly: true })).toBe(true)
  })
})

describe('countRegion', () => {
  const g: Region = { id: 'g', title: 'G', act: 'Act 1', base: [row({ id: 'a' }), row({ id: 'n', kind: 'note' })], mod: [row({ id: 'b', origin: 'fed' })] }
  it('counts only checkable rows', () => expect(countRegion(g, (id) => id === 'a')).toEqual([1, 2]))
})

describe('mergeStates', () => {
  const a: PersistedState = { ...emptyState(), checked: { x: { c: true, t: 100 } } }
  it('the newer timestamp wins', () => {
    const b = { ...emptyState(), checked: { x: { c: false, t: 200 } } }
    const { state, changed } = mergeStates(a, b)
    expect(state.checked.x).toEqual({ c: false, t: 200 })
    expect(changed).toBe(1)
  })
  it('an older timestamp is discarded', () => {
    const b = { ...emptyState(), checked: { x: { c: false, t: 50 } } }
    expect(mergeStates(a, b).state.checked.x.c).toBe(true)
  })
  it('adds new party members only once', () => {
    const m = { id: 'p1', name: 'S1', figure: 'Karlach', removed: false, t: 1 }
    const b = { ...emptyState(), party: [m] }
    const once = mergeStates(a, b).state
    expect(mergeStates(once, b).state.party).toHaveLength(1)
  })
  it('does not mutate its inputs', () => {
    const b = { ...emptyState(), checked: { y: { c: true, t: 5 } } }
    mergeStates(a, b)
    expect(a.checked.y).toBeUndefined()
  })
})
