import type { Row } from './schema'
import { isMissable } from './logic'

/**
 * Display-only derivation of the "May be missable" tier (design system, section 3). The data package has no such
 * flag: `missable` is true only when the source says so, hints like "Possibly" live in the free text `missableText`.
 * Rows that are already missable keep the filled "Missable" badge, so the two never appear together.
 */
const MAYBE = /\b(possibly|potentially|can be missed)\b/i

export const isMaybeMissable = (r: Row): boolean => !isMissable(r) && Boolean(r.missableText && MAYBE.test(r.missableText))

/** Short label per verification tier (visible word next to the symbol). */
export const VERIFICATION_LABEL: Record<string, string> = {
  sourced: 'Sourced',
  candidate: 'Candidate',
  unverified: 'Unverified',
  conflict: 'Conflict',
  separate: 'Separate',
}
