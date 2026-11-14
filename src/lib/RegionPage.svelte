<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { Region, Row } from './schema'
  import type { CharacterGroup } from './roster'
  import { regionStats, visibleRows } from './counts'
  import { nav, closeRegion } from './nav.svelte'
  import { isChecked, memberOf, noteOf, setAssign, setChecked } from './store.svelte'
  import { cancelSelect, markDone, openCount, selection, setGroup, startSelect, toggleRow } from './groupActions.svelte'
  import RowView from './RowView.svelte'
  import Icon from './Icon.svelte'

  interface Props { region: Region; groups: CharacterGroup[] }
  let { region, groups }: Props = $props()

  const lookup = { isChecked, memberOf }
  const vis = $derived(visibleRows(region, nav.filters, nav.tier, lookup))
  const stats = $derived(regionStats(region, isChecked))
  const pct = $derived(stats.total ? Math.round((stats.done / stats.total) * 100) : 0)
  let seg = $state<'all' | 'base' | 'mod'>('all')
  const hasBoth = $derived(region.base.length > 0 && region.mod.length > 0)
  const shown = $derived((seg !== 'mod' ? vis.base.length : 0) + (seg !== 'base' ? vis.mod.length : 0))
  const picked = $derived(selection.rows.size)
  const allPicked = (rows: Row[]) => rows.length > 0 && rows.every((r) => selection.rows.has(r.id))

  // Leaving the region (tab, back, another region) ends the selection.
  onDestroy(cancelSelect)
</script>

{#snippet group(title: string, rows: Row[])}
  {@const open = openCount(rows)}
  <div class="group">
    <div class="gh">
      <h2>{title} <span class="meta">{rows.length}</span></h2>
      {#if selection.on}
        <button type="button" class="btn plain" onclick={() => setGroup(rows, !allPicked(rows))}>
          {allPicked(rows) ? 'Deselect group' : 'Select group'}<span class="sr-only"> {title}</span>
        </button>
      {:else if open > 0}
        <button type="button" class="btn plain" onclick={() => markDone(rows)}>
          Mark all done<span class="sr-only"> in {title}, {open} open</span>
        </button>
      {/if}
    </div>
    <ul class="rows">
      {#each rows as r (r.id)}
        <RowView
          row={r} {groups} showAct={region.act === 'Unplaced'}
          checked={isChecked(r.id)} member={memberOf(r.id)} note={noteOf(r.id)}
          onToggle={setChecked}
          onAssign={(id, member) => setAssign(id, { member })}
          onNote={(id, note) => setAssign(id, { note })}
          selectMode={selection.on} selected={selection.rows.has(r.id)} onSelect={toggleRow}
        />
      {/each}
    </ul>
  </div>
{/snippet}

<section class="regionpage" aria-labelledby="region-title">
  <div class="rp-head">
    <div class="rp-top">
      {#if selection.on}
        <button type="button" class="btn plain back" onclick={cancelSelect}>Cancel</button>
        <span class="selcount" role="status">{picked} selected</span>
      {:else}
        <button type="button" class="btn plain back" onclick={closeRegion}><Icon name="back" />Back</button>
        <button type="button" class="btn" onclick={startSelect} disabled={shown === 0}><Icon name="sourced" />Select</button>
      {/if}
    </div>
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
    <div class="emptc"><h2>Nothing matches</h2><p class="muted">No rows in this region fit the current filters.</p></div>
  {:else}
    {#if seg !== 'mod' && vis.base.length}{@render group('Base game', vis.base)}{/if}
    {#if seg !== 'base' && vis.mod.length}{@render group('DIQ / mod additions', vis.mod)}{/if}
  {/if}
</section>
