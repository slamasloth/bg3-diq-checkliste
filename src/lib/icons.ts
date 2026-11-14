/**
 * Small line icons (24 x 24, drawn with a 2 px round stroke), written for this project.
 * They are decoration only: every use sits next to visible text or has an accessible name.
 */
export const ICONS = {
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  sync: 'M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4',
  users: 'M16 20v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1a3.5 3.5 0 0 0-2.5-3.3M15.5 4.3a3.5 3.5 0 0 1 0 6.4',
  backup: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  guide: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h8',
  lineup: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2.2 2.2L15.5 10',
  warn:'M12 3 2.5 20h19zM12 10v5M12 18v.5',
  sourced: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l3 3 5-6',
  candidate: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.5',
  unverified: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  conflict: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6',
  separate: 'M12 3 3 8l9 5 9-5zM3 13l9 5 9-5',
  mod: 'M4 4h16v16H4zM12 8v8M8 12h8',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6L6 18',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
} as const

export type IconName = keyof typeof ICONS
