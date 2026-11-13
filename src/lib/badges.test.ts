import { describe, expect, it } from 'vitest'
import { isMaybeMissable } from './badges'
import type { Row } from './schema'

const row = (p: Partial<Row>) => ({ id: 'x', kind: 'task', text: 't', verification: 'sourced', depth: 0, origin: 'base', ...p }) as Row

describe('isMaybeMissable', () => {
  it('is true for hints without the missable flag', () => {
    expect(isMaybeMissable(row({ missableText: 'Possibly' }))).toBe(true)
    expect(isMaybeMissable(row({ missableText: 'Base materials/boss coins can be missed' }))).toBe(true)
  })
  it('is false when the row is already missable or has no hint', () => {
    expect(isMaybeMissable(row({ missable: true, missableText: 'Potentially; watch act completion' }))).toBe(false)
    expect(isMaybeMissable(row({ kind: 'missable', missableText: 'Possibly' }))).toBe(false)
    expect(isMaybeMissable(row({}))).toBe(false)
    expect(isMaybeMissable(row({ missableText: 'Not automatically' }))).toBe(false)
    expect(isMaybeMissable(row({ missableText: 'Location open' }))).toBe(false)
  })
})
