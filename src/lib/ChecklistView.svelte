<script lang="ts">
  import type { Checklist } from './schema'
  import type { CharacterGroup } from './roster'
  import { activeFilterCount, regionStats, visibleRows } from './counts'
  import { nav, openRegion } from './nav.svelte'
  import { isChecked, memberOf } from './store.svelte'
  import { noFilters } from './logic'
  import Icon from './Icon.svelte'
  import RegionPage from './RegionPage.svelte'
  import FilterSheet from './FilterSheet.svelte'

  interface Props {
    data: Checklist
    act: string
    groups: CharacterGroup[]
    onPickAct: (a: string) => void
  }
  let { data, act, groups, onPickAct }: Props = $props()
  let sheet: FilterSheet

  const lookup = { isChecked, memberOf }
  const regions = $derived(data.regions.filter((g) => g.act === act))
  const region = $derived(nav.region ? data.regions.find((g) => g.id === nav.region) : undefined)

  /** Regions with at least one row that passes the filters, and how many rows that is. */
  const listed = $derived(
    regions
      .map((g) => ({ g, v: visibleRows(g, nav.filters, nav.tier, lookup), s: regionStats(g, isChecked) }))
      .filter((x) => x.v.base.length + x.v.mod.length > 0),
  )
  const rowCount = $derived(
    nav.region && region
      ? visibleRows(region, nav.filters, nav.tier, lookup).base.length + visibleRows(region, nav.filters, nav.tier, lookup).mod.length
      : listed.reduce((n, x) => n + x.v.base.length + x.v.mod.length, 0),
  )
  const nActive = $derived(activeFilterCount(nav.filters, nav.tier))
  const anyFilter = $derived(nActive > 0 || nav.filters.query !== '')

  const tabCounts = $derived.by(() => {
    const out: Record<string, [number, number]> = {}
    for (const a of data.acts) {
      let d = 0, t = 0
      for (const g of data.regions) if (g.act === a) { const s = regionStats(g, isChecked); d += s.done; t += s.total }
      out[a] = [d, t]
    }
    return out
  })
  const openMiss = $derived(regions.reduce((n, g) => n + regionStats(g, isChecked).openMissable, 0))

  const reset = () => { Object.assign(nav.filters, noFilters()); nav.tier = 'any' }
  const chip = (key: 'missableOnly' | 'itemsOnly') => { nav.filters[key] = !nav.filters[key] }
  const toggleOpen = () => { nav.filters.status = nav.filters.status === 'open' ? 'all' : 'open' }
</script>

{#if nav.region && region}
  <RegionPage {region} {groups} />
{:else}
  <div class="pinned">
    <nav class="chips acts" aria-label="Acts">
      {#each data.acts as a (a)}
        <button type="button" class="chip" aria-current={a === act ? 'true' : undefined} onclick={() => onPickAct(a)}>
          {a}<small><span class="sr-only"> – </span>{tabCounts[a]?.[0]}/{tabCounts[a]?.[1]}<span class="sr-only"> done</span></small>
        </button>
      {/each}
    </nav>
  </div>

  <div class="page">
    <div class="searchrow">
      <input class="field" type="search" placeholder="Search (name, place, mod)" aria-label="Search" bind:value={nav.filters.query} />
      <button type="button" class="btn" onclick={() => sheet.open()}><Icon name="filter" />Filters{nActive ? ` (${nActive})` : ''}</button>
    </div>
    <div class="chips" role="group" aria-label="Quick filters">
      <button type="button" class="chip" aria-pressed={nav.filters.missableOnly} onclick={() => chip('missableOnly')}>Missable<small>{openMiss}</small></button>
      <button type="button" class="chip" aria-pressed={nav.filters.status === 'open'} onclick={toggleOpen}>Open</button>
      <button type="button" class="chip" aria-pressed={nav.filters.itemsOnly} onclick={() => chip('itemsOnly')}>Items</button>
    </div>

    <p class="sr-only" role="status">{listed.length} {listed.length === 1 ? 'region' : 'regions'} with {rowCount} entries in {act}.</p>
    {#if listed.length === 0}
      <div class="emptyc">
        <h2>Nothing matches</h2>
        <p class="muted">{anyFilter ? 'No entries in this act fit the current filters.' : 'This act has no entries.'}</p>
        {#if anyFilter}<button type="button" class="btn" onclick={() => { reset(); nav.filters.query = '' }}>Reset filters</button>{/if}
      </div>
    {:else}
      <ul class="cards">
        {#each listed as { g, s } (g.id)}
          {@const pct = s.total ? Math.round((s.done / s.total) * 100) : 0}
          <li>
            <button type="button" class="card region-link" onclick={() => openRegion(g.id)}>
              <span class="name">{g.title}</span>
              <Icon name="chev" />
              <span class="sub">
                <span>{s.done} of {s.total} done</span>
                {#if s.openMissable}<span class="badge miss"><Icon name="warn" />{s.openMissable} missable<span class="sr-only"> open</span></span>{/if}
                {#if g.pointOfNoReturn}<span class="badge maybe"><Icon name="warn" />Before you leave</span>{/if}
              </span>
              <span class="progress" role="img" aria-label="{pct} percent done"><i style:--p="{pct}%"></i></span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<FilterSheet bind:this={sheet} mods={data.mods} {groups} count={rowCount} />
