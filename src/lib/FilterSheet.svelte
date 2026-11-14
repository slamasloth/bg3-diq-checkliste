<script lang="ts">
  import Icon from './Icon.svelte'
  import { nav } from './nav.svelte'
  import { noFilters } from './logic'
  import { tierOf, type Tier } from './counts'
  import { characterLabel, type CharacterGroup } from './roster'

  interface Props { mods: string[]; groups: CharacterGroup[]; count: number }
  let { mods, groups, count }: Props = $props()
  let dlg: HTMLDialogElement

  /** showModal() traps focus inside the sheet and returns it to the opening button on close. */
  export function open() { dlg.showModal() }
  const close = () => dlg.close()

  const STATUS = [['all', 'All'], ['open', 'Open'], ['done', 'Done']] as const
  const TIERS: [Tier, string][] = [['any', 'Any'], ['missable', 'Missable'], ['maybe', 'May be missable'], ['not', 'Not missable']]
  const tier = $derived(tierOf(nav.filters, nav.tier))
  const setTier = (t: Tier) => {
    nav.filters.missableOnly = t === 'missable'
    nav.tier = t === 'missable' ? 'any' : t
  }
  const reset = () => {
    const q = nav.filters.query // the search sits outside the sheet and stays
    Object.assign(nav.filters, noFilters(), { query: q })
    nav.tier = 'any'
  }
</script>

<dialog bind:this={dlg} class="sheet" aria-labelledby="filters-title">
  <div class="grab" aria-hidden="true"></div>
  <div class="head">
    <button type="button" class="btn plain" onclick={reset}>Reset</button>
    <h2 id="filters-title">Filters</h2>
    <button type="button" class="btn plain" onclick={close}><Icon name="close" />Close</button>
  </div>
  <div class="body">
    <fieldset>
      <legend>Status</legend>
      <div class="seg">
        {#each STATUS as [v, l] (v)}
          <button type="button" aria-pressed={nav.filters.status === v} onclick={() => (nav.filters.status = v)}>{l}</button>
        {/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>Missable</legend>
      <div class="seg">
        {#each TIERS as [v, l] (v)}
          <button type="button" aria-pressed={tier === v} onclick={() => setTier(v)}>{l}</button>
        {/each}
      </div>
    </fieldset>
    <label class="fld">Verification
      <select bind:value={nav.filters.verification}>
        <option value="">Any</option>
        {#each ['sourced', 'candidate', 'unverified', 'conflict', 'separate'] as v (v)}<option value={v}>{v[0].toUpperCase() + v.slice(1)}</option>{/each}
      </select>
    </label>
    <label class="fld">Assigned to
      <select bind:value={nav.filters.member}>
        <option value="">Anyone</option><option value="-">Not assigned</option>
        {#each groups as g (g.label)}
          <optgroup label={g.label}>{#each g.list as p (p.id)}<option value={p.id}>{characterLabel(p)}</option>{/each}</optgroup>
        {/each}
      </select>
    </label>
    <label class="fld">Source
      <select bind:value={nav.filters.source}>
        <option value="all">Base + mods</option><option value="base">Base only (vanilla)</option><option value="mod">Mod additions only</option>
      </select>
    </label>
    <label class="fld">Mod
      <select bind:value={nav.filters.mod}>
        <option value="">All mods</option>
        {#each mods as m (m)}<option>{m}</option>{/each}
      </select>
    </label>
    <label class="opt"><input type="checkbox" bind:checked={nav.filters.itemsOnly} /> Items only</label>
  </div>
  <div class="foot">
    <button type="button" class="btn primary" onclick={close}>Show {count} {count === 1 ? 'row' : 'rows'}</button>
  </div>
</dialog>
