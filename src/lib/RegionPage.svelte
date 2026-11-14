<script lang="ts">
  import type { Region } from './schema'
  import type { CharacterGroup } from './roster'
  import { regionStats, visibleRows } from './counts'
  import { nav, closeRegion } from './nav.svelte'
  import { isChecked, memberOf, noteOf, setAssign, setChecked } from './store.svelte'
  import RowView from './RowView.svelte'
  import Icon from './Icon.svelte'
  import type { Row } from './schema'

  interface Props { region: Region; groups: CharacterGroup[] }
  let { region, groups }: Props = $props()

  const lookup = { isChecked, memberOf }
  const vis = $derived(visibleRows(region, nav.filters, nav.tier, lookup))
  const stats = $derived(regionStats(region, isChecked))
  const pct = $derived(stats.total ? Math.round((stats.done / stats.total) * 100) : 0)
  let seg = $state<'all' | 'base' | 'mod'>('all')
  const hasBoth = $derived(region.base.length > 0 && region.mod.length > 0)
  const unplaced = $derived(region.act === 'Unplaced')
  const shown = $derived((seg !== 'mod' ? vis.base.length : 0) + (seg !== 'base' ? vis.mod.length : 0))
</script>

{#snippet list(rows: Row[])}
  <ul class="rows">
    {#each rows as r (r.id)}
      <RowView
        row={r} {groups} showAct={unplaced}
        checked={isChecked(r.id)} member={memberOf(r.id)} note={noteOf(r.id)}
        onToggle={setChecked}
        onAssign={(id, member) => setAssign(id, { member })}
        onNote={(id, note) => setAssign(id, { note })}
      />
    {/each}
  </ul>
{/snippet}

<section class="regionpage" aria-labelledby="region-title">
  <div class="rp-head">
    <button type="button" class="btn plain back" onclick={closeRegion}><Icon name="back" />Back</button>
    <h1 id="region-title">{region.title}</h1>
    <p class="meta">
      {stats.done} of {stats.total} done{#if stats.openMissable} · <span class="openmiss">{stats.openMissable} open missable{stats.openMissable === 1 ? '' : 's'}</span>{/if}
    </p>
    <div class="progress" role="img" aria-label="{pct} percent done"><i style:--p="{pct}%"></i></div>
    {#if hasBoth}
      <div class="seg" role="group" aria-label="Show">
        {#each [['all', 'All'], ['base', 'Base game'], ['mod', 'Mods']] as [v, l] (v)}
          <button type="button" aria-pressed={seg === v} onclick={() => (seg = v as typeof seg)}>{l}</button>
        {/each}
      </div>
    {/if}
  </div>

  <p class="sr-only" role="status">{shown} entries shown.</p>
  {#if shown === 0}
    <div class="emptyc"><h2>Nothing matches</h2><p class="muted">No rows in this region fit the current filters.</p></div>
  {:else}
    {#if seg !== 'mod' && vis.base.length}
      <div class="group">
        <h2 class="gh">Base game <span class="meta">{vis.base.length}</span></h2>
        {@render list(vis.base)}
      </div>
    {/if}
    {#if seg !== 'base' && vis.mod.length}
      <div class="group">
        <h2 class="gh">DIQ / mod additions <span class="meta">{vis.mod.length}</span></h2>
        {@render list(vis.mod)}
      </div>
    {/if}
  {/if}
</section>
