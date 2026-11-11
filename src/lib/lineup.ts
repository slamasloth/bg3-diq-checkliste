import { z } from 'zod'
import type { BuildPack } from './buildpack'

// Lineup preferences (M4), kept only on this device under their own key. Not part of the synced state:
// nothing here goes through sync/ or the Supabase wire format (decision 11.11.2026: scope B, no sync).

export const LINEUP_KEY = 'bg3diq.lineup.v1'

export interface LineupPrefs {
  /** The two chosen members besides the fixed ones (0..2 ids from the pack pool). */
  extra: string[]
  act: string
  verifiedOnly: boolean
  /** act -> `member/slot` -> item id picked by hand. */
  locked: Record<string, Record<string, string>>
}

export const emptyPrefs = (): LineupPrefs => ({ extra: [], act: 'Act 1', verifiedOnly: false, locked: {} })

const Raw = z.object({
  extra: z.array(z.string().max(40)).max(8),
  act: z.string().max(20),
  verifiedOnly: z.boolean(),
  locked: z.record(z.string().max(20), z.record(z.string().max(100), z.string().max(80))),
})

/** Foreign input is untrusted: keep only what fits the current pack, drop the rest. */
export function parsePrefs(raw: unknown, pack: BuildPack): LineupPrefs {
  const p = Raw.safeParse(raw)
  if (!p.success) return emptyPrefs()
  const fixed: string[] = [...pack.party.fixed]
  const pool = new Set(pack.party.pool.filter((m) => !fixed.includes(m)))
  const extra = [...new Set(p.data.extra.filter((m) => pool.has(m)))].slice(0, 2)
  const act = pack.acts.includes(p.data.act as never) ? p.data.act : 'Act 1'
  const members = new Set([...fixed, ...extra])
  const locked: LineupPrefs['locked'] = {}
  for (const [a, byKey] of Object.entries(p.data.locked)) {
    if (!pack.acts.includes(a as never)) continue
    for (const [key, item] of Object.entries(byKey)) {
      const [member, slot] = key.split('/')
      if (members.has(member) && (pack.slots as string[]).includes(slot) && pack.items[pack.itemAliases[item]?.to ?? item]) {
        ;(locked[a] ??= {})[key] = item
      }
    }
  }
  return { extra, act, verifiedOnly: p.data.verifiedOnly, locked }
}

export function loadPrefs(pack: BuildPack, storage: Pick<Storage, 'getItem'> = localStorage): LineupPrefs {
  try {
    const raw = storage.getItem(LINEUP_KEY)
    return raw ? parsePrefs(JSON.parse(raw), pack) : emptyPrefs()
  } catch {
    return emptyPrefs()
  }
}

export function savePrefs(p: LineupPrefs, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    storage.setItem(LINEUP_KEY, JSON.stringify(p))
    return true
  } catch {
    return false
  }
}

/** Lock `item` for `member/slot` in `act`; the same item is released elsewhere in that act (an item can be held once). */
export function lockItem(p: LineupPrefs, act: string, key: string, item: string): LineupPrefs {
  const byKey = { ...(p.locked[act] ?? {}) }
  for (const k of Object.keys(byKey)) if (byKey[k] === item) delete byKey[k]
  byKey[key] = item
  return { ...p, locked: { ...p.locked, [act]: byKey } }
}

export function unlockItem(p: LineupPrefs, act: string, key: string): LineupPrefs {
  const byKey = { ...(p.locked[act] ?? {}) }
  delete byKey[key]
  return { ...p, locked: { ...p.locked, [act]: byKey } }
}
