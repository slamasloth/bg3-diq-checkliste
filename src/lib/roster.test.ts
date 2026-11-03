import { describe, expect, it } from 'vitest'
import { ROSTER, characterColor, characterInitials, characterLabel } from './roster'
import { LIMITS } from './sync/validate'

const all = ROSTER.flatMap((g) => g.list)

describe('roster', () => {
  it('contains the two player characters and the ten companions from the build guides', () => {
    expect(all.map((c) => c.name).sort()).toEqual(
      ['Astarion', 'Durge', 'Gale', 'Halsin', 'Jaheira', 'Karlach', "Lae'zel", 'Minsc', 'Minthara', 'Shadowheart', 'Tala', 'Wyll'],
    )
  })
  it('has unique IDs that the sync layer accepts (member field: <= 40 chars, safe characters)', () => {
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length)
    for (const c of all) {
      expect(c.id.length).toBeLessThanOrEqual(LIMITS.member)
      expect(c.id).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })
  it('gives every character unique two-letter initials and a mark colour readable with dark text', () => {
    const lum = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
    expect(new Set(all.map((c) => c.initials)).size).toBe(all.length)
    for (const c of all) {
      expect(c.initials).toMatch(/^[A-Z]{2}$/)
      expect(ratio(characterColor(c), '#141011')).toBeGreaterThanOrEqual(4.5) // same text colour as .b.who
    }
    expect(new Set(all.map((c) => c.color)).size).toBe(all.length)
  })
  it('derives marks for custom characters', () => {
    expect(characterInitials({ id: 'p1', name: 'hireling', figure: '' })).toBe('HI')
    expect(characterColor({ id: 'p1', name: 'x', figure: '' })).toBe('#c2c2c2')
  })
  it('labels characters with their qualifier only when there is one', () => {
    expect(characterLabel({ id: 'p1', name: 'Hireling', figure: 'Mod' })).toBe('Hireling (Mod)')
    expect(characterLabel({ id: 'c-gale', name: 'Gale', figure: '' })).toBe('Gale')
  })
  it('shows the built-in characters by name only', () => {
    expect(all.map(characterLabel)).toEqual(all.map((c) => c.name))
  })
})
