import { z } from 'zod'

// Build package (builds.pack.json): schema + canonical JSON + hash. The package contains the corrected state only;
// originals of corrections live in `audit` and are never shown by the UI.

export const ActName = z.enum(['Act 1', 'Act 1.5', 'Act 2', 'Act 3'])
export type ActName = z.infer<typeof ActName>
export const SlotKey = z.enum(['mainhand', 'offhand', 'head', 'body', 'gloves', 'boots', 'cloak', 'amulet', 'ring1', 'ring2', 'ranged', 'quiver'])
export const VerificationLevel = z.enum(['INGAME_CONFIRMED', 'INSTALLED_FILE_CONFIRMED', 'AUTHOR_DOCUMENTED', 'PROJECT_RECONSTRUCTED', 'THEORY_INFERRED', 'UNKNOWN'])
export type VerificationLevel = z.infer<typeof VerificationLevel>

const Feat = z.object({ name: z.string().min(1), kind: z.enum(['bonus', 'class']), sourceClass: z.string().nullable() })
const LevelRow = z.object({
  totalLevel: z.number().int().min(1).max(20),
  cls: z.string().min(1),
  classLevel: z.number().int().min(1).max(20),
  text: z.string(),
  feats: z.array(Feat),
})
const Option = z.object({
  rank: z.number().int().min(1).max(3),
  itemId: z.string().min(1),
  notes: z.array(z.string()),
  inherited: z.boolean().optional(),
})
const Slot = z.object({
  slot: SlotKey,
  label: z.string().min(1),
  options: z.array(Option).min(1),
  guideStatesOnly: z.number().int().min(1).max(2).optional(),
})
const FoundScript = z.object({ act: z.string(), holder: z.string(), section: z.string().nullable() })
const FoundList = z.object({ act: z.string(), place: z.string().nullable(), checkedBy: z.string().nullable(), proofLink: z.string().nullable() })
const FoundCatalog = z.object({ act: z.string().nullable(), region: z.string().nullable(), place: z.string().nullable(), confidence: z.string().nullable() })
const FoundBase = z.object({ act: z.string().nullable(), wiki: z.string().nullable() })

export const ItemSchema = z.object({
  name: z.string().min(1),
  source: z.enum(['fed', 'base', 'synthetic']),
  exception: z.enum(['generic', 'not_an_item', 'name_in_package_no_location', 'no_project_proof', 'marksman_class_weapon']).optional(),
  rarity: z.string().nullable(),
  verification: VerificationLevel,
  locationStatus: z.enum(['script', 'list', 'catalog', 'base', 'none']),
  found: z.object({ script: z.array(FoundScript), list: z.array(FoundList), catalog: z.array(FoundCatalog), base: z.array(FoundBase) }),
})
export type PackItem = z.infer<typeof ItemSchema>

export const BuildSchema = z.object({
  id: z.string().min(1),
  character: z.string().min(1),
  title: z.string(),
  subtitle: z.string(),
  classSplit: z.array(z.object({ cls: z.string(), levels: z.number().int().min(1).max(20) })).min(1),
  verification: VerificationLevel,
  source: z.string(),
  levels: z.array(LevelRow).length(20),
  gear: z.record(ActName, z.object({ slots: z.array(Slot), notes: z.array(z.string()) })),
  endgameSets: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.array(z.string())]))),
  attributes: z.object({
    intro: z.array(z.string()),
    note: z.array(z.string()),
    base: z.object({
      columns: z.array(z.string()).min(2),
      rows: z.array(z.object({ stat: z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']), cells: z.record(z.string(), z.string()) })).length(6),
    }),
    progress: z
      .object({
        columns: z.array(z.string()).min(1),
        rows: z.array(z.object({ lv: z.number().int().min(1).max(20), source: z.string(), values: z.record(z.string(), z.number().int().nullable()) })).min(1),
      })
      .nullable(),
  }),
  sections: z.record(z.string(), z.array(z.string())),
  openPoints: z.array(z.string()),
  missables: z.array(z.object({ items: z.string().nullable(), bedingung: z.string(), akt: z.string().nullable() })),
})
export type PackBuild = z.infer<typeof BuildSchema>

export const BuildPackSchema = z.object({
  schemaVersion: z.literal(1),
  meta: z.object({ dataDate: z.string(), storeVersion: z.number().int(), seedManifestSha256: z.string().length(64), guideSource: z.string(), language: z.literal('de') }),
  party: z.object({ size: z.literal(4), fixed: z.tuple([z.literal('dark_urge'), z.literal('tala')]), noCompanions: z.literal(true), pool: z.array(z.string()).length(12) }),
  acts: z.array(ActName).length(4),
  slots: z.array(SlotKey).length(12),
  builds: z.array(BuildSchema).length(12),
  items: z.record(z.string(), ItemSchema),
  gaps: z.array(z.object({ id: z.string(), status: z.string(), title: z.string() })),
  ingameFindings: z.array(z.object({ id: z.string(), claim: z.string(), build: z.string(), totalLevel: z.number().int(), result: z.string(), date: z.string(), by: z.string() })),
  itemAliases: z.record(z.string(), z.object({ to: z.string(), item: z.string(), reason: z.string() })),
  itemUpgrades: z.record(z.string(), z.object({ to: z.string(), fromLevel: z.string(), toLevel: z.string(), materials: z.array(z.string()), craftedFrom: z.array(z.string()), station: z.string(), proof: z.string(), level: VerificationLevel })),
  openDecisions: z.array(z.object({ item: z.string(), gewaehlt: z.string(), kandidaten: z.array(z.string()), grund: z.string() })),
  audit: z.object({
    corrections: z.array(z.object({
      id: z.string(), type: z.enum(['akt_verschiebung', 'name', 'level_text']), target: z.record(z.string(), z.unknown()), original: z.record(z.string(), z.unknown()),
      new: z.record(z.string(), z.unknown()), level: z.enum(['INSTALLED_FILE_CONFIRMED', 'AUTHOR_DOCUMENTED', 'INGAME_CONFIRMED']), proof: z.string().min(1),
    })),
  }),
  packHash: z.string().length(64),
})
export type BuildPack = z.infer<typeof BuildPackSchema>

/** Canonical JSON: keys sorted, no whitespace. Must match tools/export_build_pack.py (json.dumps sort_keys, compact, ensure_ascii=False). */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']'
  const obj = value as Record<string, unknown>
  return '{' + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(obj[k])).join(',') + '}'
}

export async function packHashOf(pack: Record<string, unknown>): Promise<string> {
  const { packHash: _omit, ...body } = pack
  void _omit
  const bytes = new TextEncoder().encode(canonicalJson(body))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function loadBuildPack(url = './data/builds.pack.json'): Promise<BuildPack> {
  const raw: unknown = await (await fetch(url)).json()
  const parsed = BuildPackSchema.parse(raw)
  const hash = await packHashOf(raw as Record<string, unknown>)
  if (hash !== parsed.packHash) throw new Error('Build pack hash mismatch: file damaged or edited')
  return parsed
}
