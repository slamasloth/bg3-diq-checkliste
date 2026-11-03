/**
 * Every playable character, available in all assignment menus from the start.
 * IDs are fixed so assignments stay valid across devices (they are synced as plain strings; the roster itself is not).
 * Source of the list: build guides PDF (Tala = Tav, Durge = Dark Urge, ten companions). Mod hirelings are not included;
 * add them as custom characters in the Characters dialog.
 */
export interface Character {
  id: string
  name: string
  /** Short qualifier shown in brackets, e.g. the origin name. */
  figure: string
  /** Two-letter code for the assignment mark (derived from the name for custom characters). */
  initials?: string
  /** Mark colour; dark text (#141011) on it must reach 4.5:1 (checked in roster.test.ts). */
  color?: string
}
export interface CharacterGroup {
  label: string
  list: Character[]
}

export const ROSTER: CharacterGroup[] = [
  {
    label: 'Player characters',
    list: [
      { id: 'c-tala', name: 'Tala', figure: '', initials: 'TA', color: '#ffa03c' },
      { id: 'c-durge', name: 'Durge', figure: '', initials: 'DU', color: '#ff8a80' },
    ],
  },
  {
    label: 'Companions',
    list: [
      { id: 'c-astarion', name: 'Astarion', figure: '', initials: 'AS', color: '#c9a4ff' },
      { id: 'c-gale', name: 'Gale', figure: '', initials: 'GA', color: '#7cb4ff' },
      { id: 'c-halsin', name: 'Halsin', figure: '', initials: 'HA', color: '#a8d070' },
      { id: 'c-jaheira', name: 'Jaheira', figure: '', initials: 'JA', color: '#6fd08a' },
      { id: 'c-karlach', name: 'Karlach', figure: '', initials: 'KA', color: '#ff6b3d' },
      { id: 'c-laezel', name: "Lae'zel", figure: '', initials: 'LZ', color: '#ffd84d' },
      { id: 'c-minsc', name: 'Minsc', figure: '', initials: 'MC', color: '#d7b98a' },
      { id: 'c-minthara', name: 'Minthara', figure: '', initials: 'MT', color: '#e08ad0' },
      { id: 'c-shadowheart', name: 'Shadowheart', figure: '', initials: 'SH', color: '#c0c8d4' },
      { id: 'c-wyll', name: 'Wyll', figure: '', initials: 'WY', color: '#5fd0c0' },
    ],
  },
]

export const characterLabel = (c: Character): string => c.name + (c.figure ? ` (${c.figure})` : '')
export const characterInitials = (c: Character): string => c.initials ?? (c.name.trim().slice(0, 2).toUpperCase() || '?')
export const characterColor = (c: Character): string => c.color ?? '#c2c2c2'
