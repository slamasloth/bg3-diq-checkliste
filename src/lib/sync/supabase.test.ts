import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { createParty, createTransport, ensureSignedIn, fromAssignRow, fromCheckRow, fromMemberRow, joinParty, makeClient, PAGE } from './supabase'
import type { WireChange } from './types'

/** Minimal stand-in for the parts of SupabaseClient the transport uses. */
function fakeClient(tables: Record<string, unknown[]>, opts: { rpcResult?: unknown; rpcError?: string; session?: boolean } = {}) {
  const calls: { rpc: [string, unknown][]; ranges: [string, number, number][]; channels: string[]; removed: number; signedIn: number } =
    { rpc: [], ranges: [], channels: [], removed: 0, signedIn: 0 }
  let handlers: { table: string; cb: (p: { new: Record<string, unknown> }) => void }[] = []
  const client = {
    from(table: string) {
      const q = {
        select: () => q, eq: () => q, order: () => q,
        range: async (from: number, to: number) => {
          calls.ranges.push([table, from, to])
          return { data: (tables[table] ?? []).slice(from, to + 1), error: null }
        },
      }
      return q
    },
    rpc: async (name: string, args: unknown) => {
      calls.rpc.push([name, args])
      return opts.rpcError ? { data: null, error: { message: opts.rpcError } } : { data: opts.rpcResult ?? null, error: null }
    },
    channel(name: string) {
      calls.channels.push(name)
      const ch = {
        on: (_t: string, f: { table: string }, cb: (p: { new: Record<string, unknown> }) => void) => { handlers.push({ table: f.table, cb }); return ch },
        subscribe: () => ch,
      }
      return ch
    },
    removeChannel: async () => { calls.removed++; handlers = [] },
    auth: {
      getSession: async () => ({ data: { session: opts.session ? {} : null } }),
      signInAnonymously: async () => { calls.signedIn++; return { error: null } },
    },
  }
  return { client: client as unknown as SupabaseClient, calls, emit: (table: string, row: Record<string, unknown>) => handlers.filter((h) => h.table === table).forEach((h) => h.cb({ new: row })) }
}

describe('row mapping', () => {
  it('maps checks, assignments and members to wire changes (bigint may arrive as string)', () => {
    expect(fromCheckRow({ node_id: 'a', checked: true, client_ts: '1700000000001' })).toEqual({ kind: 'checked', id: 'a', c: true, t: 1700000000001 })
    expect(fromAssignRow({ node_id: 'a', member_id: 'p1', note: 'n', client_ts: 5 })).toEqual({ kind: 'assign', id: 'a', member: 'p1', note: 'n', t: 5 })
    expect(fromMemberRow({ id: 'p1', name: 'S1', figure: 'K', removed: true, client_ts: 9 })).toEqual({ kind: 'member', id: 'p1', name: 'S1', figure: 'K', removed: true, t: 9 })
  })
})

describe('transport', () => {
  it('pull reads all three tables and pages beyond 1000 rows', async () => {
    const many = Array.from({ length: PAGE + 5 }, (_, i) => ({ node_id: `n${i}`, checked: true, client_ts: i + 1 }))
    const f = fakeClient({ checks: many, assignments: [{ node_id: 'x', member_id: 'p', note: '', client_ts: 1 }], members: [] })
    const out = await createTransport(f.client, 'party-1').pull()
    expect(out.filter((c) => c.kind === 'checked')).toHaveLength(PAGE + 5)
    expect(out.filter((c) => c.kind === 'assign')).toHaveLength(1)
    expect(f.calls.ranges.filter(([t]) => t === 'checks')).toHaveLength(2)
  })

  it('push sends the batch to apply_changes and throws on error', async () => {
    const batch: WireChange[] = [{ kind: 'checked', id: 'a', c: true, t: 1 }]
    const ok = fakeClient({})
    await createTransport(ok.client, 'party-1').push(batch)
    expect(ok.calls.rpc).toEqual([['apply_changes', { p_party: 'party-1', p_changes: batch }]])
    const bad = fakeClient({}, { rpcError: 'not a member' })
    await expect(createTransport(bad.client, 'party-1').push(batch)).rejects.toThrow('not a member')
  })

  it('subscribe forwards realtime rows as wire changes and unsubscribes', () => {
    const f = fakeClient({})
    const seen: WireChange[] = []
    const off = createTransport(f.client, 'party-1').subscribe((c) => seen.push(c))
    f.emit("checks", { node_id: 'a', checked: false, client_ts: 3 })
    f.emit("checks", {}) // empty payload (e.g. delete) is ignored
    expect(seen).toEqual([{ kind: 'checked', id: 'a', c: false, t: 3 }])
    off()
    expect(f.calls.removed).toBe(1)
  })
})

describe('auth and party helpers', () => {
  it('signs in anonymously only when there is no session', async () => {
    const a = fakeClient({}, { session: false })
    await ensureSignedIn(a.client)
    expect(a.calls.signedIn).toBe(1)
    const b = fakeClient({}, { session: true })
    await ensureSignedIn(b.client)
    expect(b.calls.signedIn).toBe(0)
  })

  it('createParty returns id and code from the RPC result', async () => {
    const f = fakeClient({}, { rpcResult: [{ party_id: 'uuid-1', party_code: 'ABCD2345' }] })
    expect(await createParty(f.client, 'a-long-secret')).toEqual({ partyId: 'uuid-1', code: 'ABCD2345' })
    expect(f.calls.rpc[0]).toEqual(['create_party', { p_secret: 'a-long-secret' }])
  })

  it('joinParty normalises the code and surfaces server errors', async () => {
    const f = fakeClient({}, { rpcResult: 'uuid-2' })
    expect(await joinParty(f.client, ' abcd2345 ', 'secret-1')).toBe('uuid-2')
    expect(f.calls.rpc[0]).toEqual(['join_party', { p_code: 'ABCD2345', p_secret: 'secret-1' }])
    const bad = fakeClient({}, { rpcError: 'invalid code or secret' })
    await expect(joinParty(bad.client, 'X', 'y')).rejects.toThrow('invalid code or secret')
  })

  it('makeClient returns null without configuration', () => {
    const spy = vi.fn()
    expect(makeClient(undefined, 'key')).toBeNull()
    expect(makeClient('https://x.supabase.co', undefined)).toBeNull()
    spy()
  })
})
