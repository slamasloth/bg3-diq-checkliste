import type { Row } from './schema'
import { isItem } from './logic'

/**
 * Group actions (S3): "Mark all done" and "Assign..." over many rows, each with one undo.
 * Pure planning: the plan says which rows change and what they were before. Running a plan only calls the existing
 * store setters, so every row stays its own change with its own timestamp (no new wire format, nothing in the store).
 * Undo is a counter-change with a newer timestamp, never a deletion, and it touches a row only while that row is
 * still in the state the action left it in (a change by the other device in the meantime is respected).
 */
export interface Assign { member: string; note: string }

export type Entry =
  | { kind: 'checked'; id: string; before: boolean; after: boolean }
  | { kind: 'assign'; id: string; before: Assign; after: Assign }

export interface Plan {
  label: 'done' | 'assign'
  entries: Entry[]
}

export interface State {
  isChecked: (id: string) => boolean
  assignOf: (id: string) => Assign
}

export interface Ops {
  setChecked: (id: string, c: boolean) => void
  setAssign: (id: string, patch: { member?: string; note?: string }) => void
}

/** Only rows that are still open. */
export function planMarkDone(rows: Row[], st: Pick<State, 'isChecked'>): Plan {
  return {
    label: 'done',
    entries: rows.filter((r) => !st.isChecked(r.id)).map((r) => ({ kind: 'checked', id: r.id, before: false, after: true })),
  }
}

/** Only item rows, and only those not already assigned to that character. The note stays as it is. */
export function planAssign(rows: Row[], st: Pick<State, 'assignOf'>, member: string): Plan {
  const entries: Entry[] = []
  for (const r of rows) {
    if (!isItem(r)) continue
    const before = st.assignOf(r.id)
    if (before.member === member) continue
    entries.push({ kind: 'assign', id: r.id, before, after: { member, note: before.note } })
  }
  return { label: 'assign', entries }
}

export function runPlan(plan: Plan, ops: Ops): number {
  for (const e of plan.entries) {
    if (e.kind === 'checked') ops.setChecked(e.id, e.after)
    else ops.setAssign(e.id, { member: e.after.member, note: e.after.note })
  }
  return plan.entries.length
}

/**
 * Undo: restore the earlier state of every entry that is still as the action left it.
 * Returns how many rows were restored and how many were skipped because they changed meanwhile.
 */
export function runUndo(plan: Plan, st: State, ops: Ops): { restored: number; skipped: number } {
  let restored = 0
  let skipped = 0
  for (const e of plan.entries) {
    if (e.kind === 'checked') {
      if (st.isChecked(e.id) !== e.after) { skipped++; continue }
      ops.setChecked(e.id, e.before)
    } else {
      const cur = st.assignOf(e.id)
      if (cur.member !== e.after.member) { skipped++; continue }
      ops.setAssign(e.id, { member: e.before.member, note: cur.note }) // a note typed meanwhile is kept
    }
    restored++
  }
  return { restored, skipped }
}

/** Toast text for a finished action. */
export function describe(plan: Plan, n: number, memberName?: string): string {
  if (n === 0) return plan.label === 'done' ? 'Nothing to mark: all done already' : 'Nothing to assign'
  if (plan.label === 'done') return `${n} marked done`
  return `${n} assigned${memberName ? ` to ${memberName}` : ''}`
}

export function describeUndo(r: { restored: number; skipped: number }): string {
  const total = r.restored + r.skipped
  return r.skipped ? `Undid ${r.restored} of ${total}, ${r.skipped} changed meanwhile` : `Undid ${r.restored}`
}
