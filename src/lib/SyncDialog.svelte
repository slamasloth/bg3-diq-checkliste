<script lang="ts">
  import { createSyncParty, joinSyncParty, leaveSyncParty, sync, syncNow } from './sync.svelte'

  let dlg: HTMLDialogElement
  let mode = $state<'create' | 'join'>('create')
  let code = $state('')
  let secret = $state('')
  export function open() { dlg.showModal() }

  const statusText = $derived(
    sync.status.state === 'offline'
      ? `Offline – ${sync.status.pending} change(s) waiting`
      : sync.status.state === 'syncing'
        ? 'Syncing …'
        : sync.status.pending > 0
          ? `${sync.status.pending} change(s) waiting`
          : 'Connected and up to date',
  )

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const ok = mode === 'create' ? await createSyncParty(secret) : await joinSyncParty(code, secret)
    if (ok) { secret = ''; code = '' }
  }
  function leave() {
    if (confirm('Leave this party on this device? Your data stays here, but it will no longer sync.')) leaveSyncParty()
  }
</script>

<dialog bind:this={dlg} aria-labelledby="sync-h">
  <h2 id="sync-h">Sync</h2>
  {#if !sync.configured}
    <p class="muted">Sync is not configured in this build (no Supabase URL/key). The checklist works locally only.</p>
  {:else if sync.link}
    <p>Party code: <strong class="code">{sync.link.code}</strong></p>
    <p class="muted">Share the code and your secret with your co-op partner. They choose “Join” and enter both.</p>
    <p role="status">{statusText}</p>
    <div class="row">
      <button type="button" onclick={syncNow}>Sync now</button>
      <button type="button" onclick={leave}>Leave party</button>
    </div>
  {:else}
    <p class="muted">
      Share progress between devices. One player creates a party; the other joins with the code and the shared secret.
      Nothing is sent before you connect.
    </p>
    <div class="row" role="group" aria-label="Create or join">
      <button type="button" aria-pressed={mode === 'create'} class="tab" onclick={() => (mode = 'create')}>Create party</button>
      <button type="button" aria-pressed={mode === 'join'} class="tab" onclick={() => (mode = 'join')}>Join party</button>
    </div>
    <form onsubmit={submit}>
      <div class="row">
        {#if mode === 'join'}
          <input bind:value={code} placeholder="Party code (8 characters)" aria-label="Party code" maxlength="8" autocapitalize="characters" required />
        {/if}
        <input
          type="password" bind:value={secret} minlength="8" required autocomplete="off"
          placeholder={mode === 'create' ? 'Choose a secret (min. 8 characters)' : 'Shared secret'}
          aria-label="Secret"
        />
      </div>
      {#if sync.error}<p class="err" role="alert">{sync.error}</p>{/if}
      <div class="row">
        <button type="submit" disabled={sync.busy}>{sync.busy ? 'Connecting …' : mode === 'create' ? 'Create and connect' : 'Join and connect'}</button>
      </div>
    </form>
  {/if}
  <div class="row end"><button type="button" onclick={() => dlg.close()}>Close</button></div>
</dialog>

<style>
  .code { font-family: ui-monospace, monospace; letter-spacing: 0.12em; font-size: 1.2rem; }
  .err { color: var(--bad); }
</style>
