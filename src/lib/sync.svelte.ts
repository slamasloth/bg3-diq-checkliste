import { localOutbox } from './persist'
import { applyRemote, clock, setChangeSink, snapshot } from './store.svelte'
import { SyncEngine } from './sync/engine'
import { createParty, createTransport, joinParty, makeClient } from './sync/supabase'
import type { SyncStatus } from './sync/types'

const LINK_KEY = 'bg3diq.party'
const client = makeClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

interface Link { id: string; code: string }

export const sync: { configured: boolean; link: Link | null; status: SyncStatus; busy: boolean; error: string } = $state({
  configured: client !== null,
  link: null,
  status: { state: 'idle', pending: 0 },
  busy: false,
  error: '',
})

let engine: SyncEngine | null = null

function readLink(): Link | null {
  try {
    const raw = localStorage.getItem(LINK_KEY)
    return raw ? (JSON.parse(raw) as Link) : null
  } catch {
    return null
  }
}
const writeLink = (l: Link | null) => {
  try {
    if (l) localStorage.setItem(LINK_KEY, JSON.stringify(l))
    else localStorage.removeItem(LINK_KEY)
  } catch {
    /* storage unavailable: the link is kept in memory only */
  }
}

function start(link: Link, seedLocal: boolean): void {
  if (!client) return
  engine?.disconnect()
  engine = new SyncEngine({
    transport: createTransport(client, link.id),
    outbox: localOutbox(link.id),
    clock,
    io: { applyRemote, snapshot },
    reconcileMs: 60_000, // safety net: realtime messages can be lost silently
    onStatus: (s) => { sync.status = s },
  })
  setChangeSink((c) => engine?.enqueue(c))
  sync.link = link
  sync.status = engine.status
  void engine.connect({ seedLocal })
}

/** Called once at startup: resume a previously joined party. */
export function resumeSync(): void {
  const link = readLink()
  if (client && link) start(link, false)
}

const friendly = (e: unknown): string => {
  const m = e instanceof Error ? e.message : String(e)
  if (/invalid code or secret/i.test(m)) return 'Wrong code or secret.'
  if (/secret too short/i.test(m)) return 'The secret needs at least 8 characters.'
  if (/too many attempts/i.test(m)) return 'Too many wrong attempts. Please wait a while and try again.'
  if (/party limit/i.test(m)) return 'This device has reached its limit of created parties.'
  if (/anonymous/i.test(m) && /disabled|not enabled/i.test(m)) return 'Anonymous sign-ins are disabled in Supabase (Authentication → Providers).'
  if (/could not find the function|schema cache|does not exist/i.test(m)) return 'The database is not set up yet: run 0001_init.sql in the Supabase SQL editor.'
  return m
}

async function run(fn: () => Promise<Link>): Promise<boolean> {
  if (!client) { sync.error = 'Sync is not configured in this build.'; return false }
  sync.busy = true
  sync.error = ''
  try {
    const link = await fn()
    writeLink(link)
    start(link, true) // first contact: also send everything stored on this device
    return true
  } catch (e) {
    sync.error = friendly(e)
    return false
  } finally {
    sync.busy = false
  }
}

export const createSyncParty = (secret: string) =>
  run(async () => {
    const r = await createParty(client!, secret)
    return { id: r.partyId, code: r.code }
  })

export const joinSyncParty = (code: string, secret: string) =>
  run(async () => {
    const id = await joinParty(client!, code, secret)
    return { id, code: code.trim().toUpperCase() }
  })

export function leaveSyncParty(): void {
  engine?.disconnect()
  engine = null
  setChangeSink(() => {})
  if (sync.link) {
    try { localStorage.removeItem(`bg3diq.outbox.${sync.link.id}`) } catch { /* ignore */ }
  }
  writeLink(null)
  sync.link = null
  sync.status = { state: 'idle', pending: 0 }
}

/** Reconnect immediately (e.g. when the browser reports it is back online). */
export function syncNow(): void {
  if (engine && sync.link) void engine.connect({ seedLocal: false })
}

/** Pull the server state when the app becomes visible again (phones suspend background pages and drop realtime messages). */
export function reconcileNow(): void {
  if (engine && sync.link && document.visibilityState === 'visible') void engine.reconcile()
}
