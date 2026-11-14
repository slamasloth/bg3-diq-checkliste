<script lang="ts">
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'
  import { nav, setTab, type Tab } from './nav.svelte'

  /** Open missables of the current act: the mark at the Today tab. */
  let { todayCount = 0 }: { todayCount?: number } = $props()
  const TABS: { id: Tab; label: string; icon: IconName }[] = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'checklist', label: 'Checklist', icon: 'list' },
    { id: 'party', label: 'Party', icon: 'users' },
    { id: 'more', label: 'More', icon: 'more' },
  ]
</script>

<nav class="tabbar" aria-label="Main">
  <ul>
    {#each TABS as t (t.id)}
      <li>
        <button type="button" aria-current={nav.tab === t.id ? 'page' : undefined} onclick={() => setTab(t.id)}>
          <Icon name={t.icon} />{t.label}
          {#if t.id === 'today' && todayCount > 0}<span class="count" aria-hidden="true">{todayCount}</span><span class="sr-only">, {todayCount} open missable{todayCount === 1 ? '' : 's'}</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</nav>
