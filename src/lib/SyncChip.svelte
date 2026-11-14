<script lang="ts">
  import Icon from './Icon.svelte'
  import { sync } from './sync.svelte'

  let { onclick }: { onclick: () => void } = $props()

  /** Symbol + word + colour, never colour alone. Reads the sync state only. */
  const view = $derived.by(() => {
    if (sync.error) return { cls: 'err', text: 'Sync failed' }
    if (!sync.link) return { cls: 'local', text: 'Local only' }
    const p = sync.status.pending
    if (sync.status.state === 'offline') return { cls: 'off', text: p ? `Offline · ${p} waiting` : 'Offline' }
    if (sync.status.state === 'syncing') return { cls: '', text: 'Syncing…' }
    return p ? { cls: 'off', text: `${p} waiting` } : { cls: '', text: 'Synced' }
  })
</script>

<button type="button" class="sync {view.cls}" {onclick} aria-label="Party sync: {view.text}">
  <Icon name="sync" />{view.text}
</button>
