<script lang="ts">
  import type { PartyMember, Region } from './schema'
  import { countRegion, rowPasses, type Filters } from './logic'
  import { isChecked, memberOf, noteOf, setAssign, setChecked } from './store.svelte'
  import RowView from './RowView.svelte'

  interface Props { region: Region; filters: Filters; party: PartyMember[]; forceOpen: boolean }
  let { region, filters, party, forceOpen }: Props = $props()

  const lookup = { isChecked, memberOf }
  const base = $derived(region.base.filter((r) => rowPasses(r, region.title, filters, lookup)))
  const mod = $derived(region.mod.filter((r) => rowPasses(r, region.title, filters, lookup)))
  const counts = $derived(countRegion(region, isChecked))
  let open = $state(false)
  const visible = $derived(base.length > 0 || mod.length > 0)
</script>

{#if visible}
  <details class="reg" open={open || forceOpen} ontoggle={(e) => (open = e.currentTarget.open)}>
    <summary style:--p="{counts[1] ? Math.round((counts[0] / counts[1]) * 100) : 0}%">
      <span>
        {region.title}
        {#if region.pointOfNoReturn}<span class="b miss" title="Do these before you leave this act">Before you leave</span>{/if}
      </span>
      <span class="cnt" class:full={counts[1] > 0 && counts[0] === counts[1]}>{counts[0]}/{counts[1]}</span>
    </summary>
    {#snippet list(rows: typeof base)}
      <ul class="rows">
        {#each rows as r (r.id)}
          <RowView
            row={r} {party} showAct={region.act === 'Unplaced'}
            checked={isChecked(r.id)} member={memberOf(r.id)} note={noteOf(r.id)}
            onToggle={setChecked}
            onAssign={(id, member) => setAssign(id, { member })}
            onNote={(id, note) => setAssign(id, { note })}
          />
        {/each}
      </ul>
    {/snippet}
    {#if base.length}{@render list(base)}{/if}
    {#if mod.length}
      <div class="sub">{region.act === 'Unplaced' ? 'Entries' : 'DIQ / mod additions'}</div>
      {@render list(mod)}
    {/if}
  </details>
{/if}
