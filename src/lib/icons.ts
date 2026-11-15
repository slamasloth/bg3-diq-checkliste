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
  today: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chev: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6L6 18',
  spell: 'M12 3l2.2 6.3L20.5 11.5l-6.3 2.2L12 20l-2.2-6.3L3.5 11.5l6.3-2.2zM19 3v4M17 5h4',
  slot_mainhand: 'M14.5 4.5 20 4l-.5 5.5L9 20l-5-5zM6 14l4 4M4 20l3-3',
  slot_offhand: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6zM12 7v10',
  slot_head: 'M5 15a7 7 0 0 1 14 0v4H5zM5 15h14M12 8v4',
  slot_body: 'M8 4 3 7l2 4 3-1v10h8V10l3 1 2-4-5-3a4 4 0 0 1-8 0z',
  slot_gloves: 'M7 21v-6l-2-3a1.5 1.5 0 0 1 2.5-1.5L9 12V5a1.5 1.5 0 0 1 3 0v-1a1.5 1.5 0 0 1 3 0v3a1.5 1.5 0 0 1 3 0v9c0 3-2 5-5 5z',
  slot_boots: 'M8 3h6v8l5 3v5H5v-4l3-1zM8 7h6',
  slot_cloak: 'M9 3h6l4 17H5zM9 3c0 3 6 3 6 0M12 8v8',
  slot_amulet: 'M6 3c0 6 3 8 6 8s6-2 6-8M12 11l3 4-3 5-3-5z',
  slot_ring: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9.5 7.5 12 3l2.5 4.5',
  slot_ranged: 'M7 4a13 13 0 0 1 13 13M7 4l13 13M4 20 15 9M15 9v4M15 9h-4',
  slot_quiver: 'M9 3l7 5-3 12-7-5zM9 6 7 4M8 12l5-5',
  pin: 'M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
} as const

export type IconName = keyof typeof ICONS
