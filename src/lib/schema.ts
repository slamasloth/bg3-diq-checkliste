import { z } from 'zod'

export const Verification = z.enum(['sourced', 'candidate', 'unverified', 'conflict', 'separate'])
export type Verification = z.infer<typeof Verification>

export const RowSchema = z.object({
  id: z.string().min(1),
  origin: z.enum(['base', 'fed', 'content']),
  kind: z.enum(['task', 'missable', 'ability', 'note', 'item', 'content']),
  depth: z.number().int().min(0),
  text: z.string(),
  name: z.string().optional(),
  url: z.string().optional(),
  rarity: z.string().optional(),
  verification: Verification,
  missable: z.boolean().optional(),
  mod: z.string().optional(),
  foundAt: z.string().optional(),
  missableText: z.string().optional(),
  act: z.string().optional(),
  evidence: z.string().optional(),
  hint: z.string().optional(),
  dedupeNote: z.string().optional(),
  locMapping: z.string().optional(),
  effect: z.string().optional(),
  effectStatus: z.string().optional(),
  contentType: z.string().optional(),
  condition: z.string().optional(),
  reward: z.string().optional(),
  configDependency: z.string().optional(),
  aliasIds: z.array(z.string()).optional(),
  areaHint: z.string().optional(),
})
export type Row = z.infer<typeof RowSchema>

export const RegionSchema = z.object({
  id: z.string(),
  title: z.string(),
  act: z.string(),
  base: z.array(RowSchema),
  mod: z.array(RowSchema),
  pointOfNoReturn: z.boolean().optional(),
})
export type Region = z.infer<typeof RegionSchema>

export const ChecklistSchema = z.object({
  schemaVersion: z.literal(2),
  project: z.string(),
  dataDate: z.string(),
  dataStage: z.string(),
  acts: z.array(z.string()),
  mods: z.array(z.string()),
  regions: z.array(RegionSchema),
  issues: z.array(z.object({ source: z.string(), problem: z.string(), details: z.array(z.string()) })),
})
export type Checklist = z.infer<typeof ChecklistSchema>

/** Progress and assignments: one timestamp per entry so devices can merge cleanly. */
// removed = tombstone: a removed member must not reappear when states are merged.
export const PartyMemberSchema = z.object({ id: z.string(), name: z.string(), figure: z.string(), removed: z.boolean(), t: z.number() })
export type PartyMember = z.infer<typeof PartyMemberSchema>

export const PersistedStateSchema = z.object({
  format: z.literal('bg3diq-state'),
  v: z.literal(3),
  checked: z.record(z.string(), z.object({ c: z.boolean(), t: z.number() })),
  assign: z.record(z.string(), z.object({ member: z.string(), note: z.string(), t: z.number() })),
  party: z.array(PartyMemberSchema),
  ui: z.object({ act: z.string().nullable() }),
})
export type PersistedState = z.infer<typeof PersistedStateSchema>

export const emptyState = (): PersistedState => ({
  format: 'bg3diq-state', v: 3, checked: {}, assign: {}, party: [], ui: { act: null },
})
