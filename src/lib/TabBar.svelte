<script lang="ts">
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'
  import { nav, setTab, type Tab } from './nav.svelte'

  const TABS: { id: Tab; label: string; icon: IconName }[] = [
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
        </button>
      </li>
    {/each}
  </ul>
</nav>
