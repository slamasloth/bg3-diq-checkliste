<script lang="ts">
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'

  /** A list of large, full-width actions (Party and More tabs). Each row is one button >= 64 px. */
  export interface MenuItem { label: string; hint: string; icon: IconName; onselect: () => void }
  let { items }: { items: MenuItem[] } = $props()
</script>

<ul class="menu">
  {#each items as it (it.label)}
    <li>
      <button type="button" onclick={it.onselect}>
        <Icon name={it.icon} />
        <span class="mt"><strong>{it.label}</strong><span class="meta">{it.hint}</span></span>
        <Icon name="chev" />
      </button>
    </li>
  {/each}
</ul>
