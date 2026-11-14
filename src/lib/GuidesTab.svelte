<script lang="ts">
  import { onMount } from 'svelte'
  import { loadBuildPack, type BuildPack } from './buildpack'
  import { allClasses, filterEntries, listEntries, orderedBuilds } from './guideModel'
  import { nav, openGuide } from './nav.svelte'
  import Badge from './Badge.svelte'
  import GuideView from './GuideView.svelte'
  import Icon from './Icon.svelte'

  let { onPdf }: { onPdf: (id: string) => void } = $props()

  let pack = $state<BuildPack | null>(null)
  let error = $state('')
  let query = $state('')
  let cls = $state('')

  onMount(async () => {
    try {
      pack = await loadBuildPack(`${import.meta.env.BASE_URL}data/builds.pack.json`)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  })

  const entries = $derived(pack ? listEntries(pack) : [])
  const classes = $derived(allClasses(entries))
  const shown = $derived(filterEntries(entries, query, cls))
  const open = $derived(pack && nav.guide ? orderedBuilds(pack).find((x) => x.build.id === nav.guide) : undefined)
  const fixedShown = $derived(shown.filter((e) => e.fixed))
  const pickShown = $derived(shown.filter((e) => !e.fixed))
</script>

{#snippet card(e: (typeof entries)[number])}
  <li>
    <button type="button" class="card region-link" onclick={() => openGuide(e.id)}>
      <span class="name">{e.character}<span class="sr-only">: </span> <span class="gt">{e.title}</span></span>
      <Icon name="chev" />
      <span class="sub"><span>{e.split}</span></span>
      <span class="sub">{e.core}</span>
      <span class="sub"><Badge kind={e.verification.kind} icon={e.verification.icon}>{e.verification.label}</Badge></span>
    </button>
  </li>
{/snippet}

{#if error}
  <p class="empty" role="alert">Error: {error}</p>
{:else if !pack}
  <p class="empty" role="status">Loading guides …</p>
{:else if nav.guide && open}
  <GuideView {pack} build={open.build} fixed={open.fixed} {onPdf} />
{:else}
  <div class="page guides">
    <div class="searchrow">
      <input class="field" type="search" placeholder="Search (character, build, class)" aria-label="Search guides" bind:value={query} />
    </div>
    <div class="chips" role="group" aria-label="Filter by class">
      <button type="button" class="chip" aria-pressed={cls === ''} onclick={() => (cls = '')}>All</button>
      {#each classes as c (c)}
        <button type="button" class="chip" aria-pressed={cls === c} onclick={() => (cls = cls === c ? '' : c)}>{c}</button>
      {/each}
    </div>
    <p class="meta" role="status">{shown.length} of {entries.length} guides</p>
    {#if fixedShown.length}
      <h2 class="gh2">Fixed</h2>
      <ul class="cards">{#each fixedShown as e (e.id)}{@render card(e)}{/each}</ul>
    {/if}
    {#if pickShown.length}
      <h2 class="gh2">Picks</h2>
      <ul class="cards">{#each pickShown as e (e.id)}{@render card(e)}{/each}</ul>
    {/if}
    {#if shown.length === 0}<p class="empty">No guide matches.</p>{/if}
  </div>
{/if}
