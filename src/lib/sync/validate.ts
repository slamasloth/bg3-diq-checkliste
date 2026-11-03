import type { WireChange } from './types'

/** Field limits; the server enforces the same ones (supabase/migrations/0002_hardening.sql). */
export const LIMITS = { id: 80, member: 40, note: 500, name: 60, figure: 60 } as const
const ID = /^[A-Za-z0-9_-]+$/
const ok = (s: unknown, max: number, min = 0): s is string => typeof s === 'string' && s.length >= min && s.length <= max

/**
 * Structural check for changes coming from outside (server, backup file). Any party member can write arbitrary
 * rows, so a received change is untrusted: oversized or oddly shaped values are dropped, not displayed.
 */
export function isWellFormed(c: WireChange): boolean {
  if (!ok(c.id, LIMITS.id, 1) || !ID.test(c.id)) return false
  if (!Number.isSafeInteger(c.t) || c.t <= 0) return false
  switch (c.kind) {
    case 'checked':
      return typeof c.c === 'boolean'
    case 'assign':
      return ok(c.member, LIMITS.member) && ok(c.note, LIMITS.note)
    case 'member':
      return ok(c.name, LIMITS.name, 1) && ok(c.figure, LIMITS.figure) && typeof c.removed === 'boolean'
    default:
      return false
  }
}
