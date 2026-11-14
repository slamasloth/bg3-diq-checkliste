<script lang="ts">
  import type { Checklist } from './schema'
  import type { CharacterGroup } from './roster'
  import { nextMissables, openMissables, regionStats } from './counts'
  import { nav, openRegion, setTab } from './nav.svelte'
  import { isChecked, memberOf, noteOf, setAssign, setChecked } from './store.svelte'
  import RowView from './RowView.svelte'
  import Icon from './Icon.svelte'

  interface Props { data: Checklist; act: string; groups: CharacterGroup[]; onPickAct: (a: string) => void }
  let { data, act, groups, onPickAct }: Props = $props()

  const NEXT = 5
  const open = $derived(openMissables(data.regions, act, isChecked))
  const next = $derived(nextMissables(data.regions, act, isChecked, NEXT))
  const progress = $derived.by(() => {
    let done = 0, total = 0
    for (const g of data.regions) if (g.act === act) { const s = regionStats(g, isChecked); done += s.done; total += s.total }
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }
  })
  const last = $derived(nav.lastRegion ? data.regions.find((g) => g.id === nav.lastRegion) : undefined)
  const nextAct = $derived(data.acts[data.acts.indexOf(act) + 1])

  const goChecklist = () => setTab('checklist')
  const goRegion = (id: string, regionAct: string) => { onPickAct(regionAct); setTab('checklist'); openRegion(id) }
  const seeAll = () => { nav.filters.missableOnly = true; setTab('checklist') }
</script>

<div class="page today">
  <section class="card pad" aria-labelledby="today-act">
    <p class="eyebrow">Current act</p>
    <h2 id="today-act">{act}</h2>
    <p class="big">
      {#if open > 0}<span class="badge miss"><Icon name="warn" />{open} open missable{open === 1 ? '' : 's'}</span>
      {:else}<span class="badge ok"><Icon name="sourced" />No open missables</span>{/if}
    </p>
    <p class="meta">{progress.done} of {progress.total} done</p>
    <div class="progress" role="img" aria-label="{progress.pct} percent of {act} done"><i style:--p="{progress.pct}%"></i></div>
    <button type="button" class="btn" onclick={goChecklist}>Open {act}<Icon name="chev" /></button>
  </section>

  {#if last}
    <button type="button" class="btn continue" onclick={() => goRegion(last.id, last.act)}>
      <span><span class="meta">Continue where you left off</span><span class="cname">{last.title}</span></span>
      <Icon name="chev" />
    </button>
  {/if}

  <section aria-labelledby="today-next">
    <h2 id="today-next" class="sech">Next missables</h2>
    {#if next.length === 0}
      <div class="emptc">
        <h2>No open missables here</h2>
        <p class="muted">Nothing in {act} can still be missed. {nextAct ? `Check ${nextAct} when you get there.` : 'That was the last act.'}</p>
        {#if nextAct}<button type="button" class="btn" onclick={() => onPickAct(nextAct)}>Show {nextAct}</button>{/if}
      </div>
    {:else}
      <ul class="nextlist">
        {#each next as { row, region } (row.id)}
          <li>
            <p class="meta">{region.title}</p>
            <ul class="rows">
              <RowView
                {row} {groups} showAct={false}
                checked={isChecked(row.id)} member={memberOf(row.id)} note={noteOf(row.id)}
                onToggle={setChecked}
                onAssign={(id, member) => setAssign(id, { member })}
                onNote={(id, note) => setAssign(id, { note })}
              />
            </ul>
          </li>
        {/each}
      </ul>
      {#if open > next.length}<button type="button" class="btn seeall" onclick={seeAll}>See all {open} missables</button>{/if}
    {/if}
  </section>
</div>
