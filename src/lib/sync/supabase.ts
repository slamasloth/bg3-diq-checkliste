import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { SyncTransport, WireChange } from './types'

/** Rows as returned by Postgres (see supabase/migrations/0001_init.sql). */
export interface CheckRow { node_id: string; checked: boolean; client_ts: number | string }
export interface AssignRow { node_id: string; member_id: string; note: string; client_ts: number | string }
export interface MemberRow { id: string; name: string; figure: string; removed: boolean; client_ts: number | string }

export const fromCheckRow = (r: CheckRow): WireChange => ({ kind: 'checked', id: r.node_id, c: r.checked, t: Number(r.client_ts) })
export const fromAssignRow = (r: AssignRow): WireChange => ({
  kind: 'assign', id: r.node_id, member: r.member_id, note: r.note, t: Number(r.client_ts),
})
export const fromMemberRow = (r: MemberRow): WireChange => ({
  kind: 'member', id: r.id, name: r.name, figure: r.figure, removed: r.removed, t: Number(r.client_ts),
})

export const PAGE = 1000

/** Reads every row of a party table (PostgREST returns at most 1000 rows per request). */
async function fetchAll<T>(client: SupabaseClient, table: string, columns: string, partyId: string, order: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select(columns).eq('party_id', partyId).order(order).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as unknown as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

export function createTransport(client: SupabaseClient, partyId: string): SyncTransport {
  return {
    async pull() {
      const [checks, assigns, members] = await Promise.all([
        fetchAll<CheckRow>(client, 'checks', 'node_id,checked,client_ts', partyId, 'node_id'),
        fetchAll<AssignRow>(client, 'assignments', 'node_id,member_id,note,client_ts', partyId, 'node_id'),
        fetchAll<MemberRow>(client, 'members', 'id,name,figure,removed,client_ts', partyId, 'id'),
      ])
      return [...checks.map(fromCheckRow), ...assigns.map(fromAssignRow), ...members.map(fromMemberRow)]
    },

    async push(changes) {
      const { error } = await client.rpc('apply_changes', { p_party: partyId, p_changes: changes })
      if (error) throw new Error(error.message)
    },

    subscribe(onChange) {
      const channel = client.channel(`party-${partyId}`)
      const filter = `party_id=eq.${partyId}`
      const listen = <T>(table: string, map: (r: T) => WireChange) =>
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, (p) => {
          // DELETE kommt nicht vor (Clients koennen nicht loeschen); nur neue/geaenderte Zeilen auswerten.
          if (p.new && Object.keys(p.new).length > 0) onChange(map(p.new as T))
        })
      listen<CheckRow>('checks', fromCheckRow)
      listen<AssignRow>('assignments', fromAssignRow)
      listen<MemberRow>('members', fromMemberRow)
      channel.subscribe()
      return () => { void client.removeChannel(channel) }
    },
  }
}

/** Anonymous device sign-in (no account, no e-mail). The session is kept by supabase-js in localStorage. */
export async function ensureSignedIn(client: SupabaseClient): Promise<void> {
  const { data } = await client.auth.getSession()
  if (data.session) return
  const { error } = await client.auth.signInAnonymously()
  if (error) throw new Error(`Anonymous sign-in failed: ${error.message}`)
}

export async function createParty(client: SupabaseClient, secret: string): Promise<{ partyId: string; code: string }> {
  await ensureSignedIn(client)
  const { data, error } = await client.rpc('create_party', { p_secret: secret })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row?.party_id || !row?.party_code) throw new Error('Unexpected response from create_party')
  return { partyId: row.party_id as string, code: row.party_code as string }
}

export async function joinParty(client: SupabaseClient, code: string, secret: string): Promise<string> {
  await ensureSignedIn(client)
  const { data, error } = await client.rpc('join_party', { p_code: code.trim().toUpperCase(), p_secret: secret })
  if (error) throw new Error(error.message)
  // 0002_hardening.sql returns NULL for a wrong code/secret (it must commit its failure counter); 0001 raised an error.
  if (data === null) throw new Error('invalid code or secret')
  if (typeof data !== 'string') throw new Error('Unexpected response from join_party')
  return data
}

/** Null when the app was built without a Supabase configuration (sync then stays off). */
export function makeClient(url: string | undefined, key: string | undefined): SupabaseClient | null {
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
}
