<script lang="ts">
  import { onMount } from 'svelte'
  import { ChecklistSchema, type Checklist } from './lib/schema'
  import { countRegion, hasActiveFilter, noFilters } from './lib/logic'
  import { app, isChecked, members, setActiveAct } from './lib/store.svelte'
  import RegionView from './lib/RegionView.svelte'
  import PartyDialog from './lib/PartyDialog.svelte'
  import BackupDialog from './lib/BackupDialog.svelte'
  import SyncDialog from './lib/SyncDialog.svelte'
  import { resumeSync, sync, syncNow } from './lib/sync.svelte'

  let data = $state<Checklist | null>(null)
  let error = $state('')
  let filters = $state(noFilters())
  let showFilters = $state(false)
  let act = $state('Act 1')
  let party: PartyDialog
  let backup: BackupDialog
  let syncDlg: SyncDialog

  onMount(async () => {
    resumeSync()
    window.addEventListener('online', syncNow)
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/checklist.json`)
      if (!res.ok) throw new Error(`Could not load data (${res.status})`)
      const parsed = ChecklistSchema.safeParse(await res.json())
      if (!parsed.success) throw new Error('Data package does not match the schema: ' + parsed.error.issues[0]?.message)
      data = parsed.data
      if (app.s.ui.act && data.acts.includes(app.s.ui.act)) act = app.s.ui.act
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
  })

  const regions = $derived(data?.regions.filter((g) => g.act === act) ?? [])
  const tabCounts = $derived.by(() => {
    const out: Record<string, [number, number]> = {}
    for (const a of data?.acts ?? []) {
      let d = 0, t = 0
      for (const g of data!.regions) if (g.act === a) { const c = countRegion(g, isChecked); d += c[0]; t += c[1] }
      out[a] = [d, t]
    }
    return out
  })
  const pick = (a: string) => { act = a; setActiveAct(a); window.scrollTo(0, 0) }
  const label = (p: { name: string; figure: string }) => p.name + (p.figure ? ` (${p.figure})` : '')
  // Reset the character filter if the selected member was removed.
  $effect(() => {
    if (filters.member && filters.member !== '-' && !members().some((p) => p.id === filters.member)) filters.member = ''
  })
</script>

<header class="top">
  <div class="bar">
    <h1>BG3 DIQ R150 · Checklist</h1>
    <div class="actions">
      <button type="button" id="btnFilter" aria-expanded={showFilters} aria-controls="filters" onclick={() => (showFilters = !showFilters)}>Filters</button>
      <button type="button" onclick={() => syncDlg.open()} title="Share progress between devices">
        Sync{#if sync.link}<span class="dot" class:off={sync.status.state === 'offline'} aria-hidden="true"></span>{/if}
      </button>
      <button type="button" onclick={() => party.open()}>Party</button>
      <button type="button" onclick={() => backup.open()}>Backup</button>
    </div>
  </div>
  {#if data}
    <div class="tabs" role="tablist" aria-label="Acts">
      {#each data.acts as a (a)}
        <button type="button" class="tab" role="tab" aria-selected={a === act} onclick={() => pick(a)}>
          {a}<small>{tabCounts[a]?.[0]}/{tabCounts[a]?.[1]}</small>
        </button>
      {/each}
    </div>
    <div class="filters" class:show={showFilters} id="filters">
      <input type="search" placeholder="Search (name, place, mod)" aria-label="Search" bind:value={filters.query} />
      <select aria-label="Status" bind:value={filters.status}>
        <option value="all">All</option><option value="open">Open</option><option value="done">Done</option>
      </select>
      <select aria-label="Source" bind:value={filters.source}>
        <option value="all">Base + mods</option><option value="base">Base only (vanilla)</option><option value="mod">Mod additions only</option>
      </select>
      <select aria-label="Mod" bind:value={filters.mod}>
        <option value="">All mods</option>
        {#each data.mods as m (m)}<option>{m}</option>{/each}
      </select>
      <select aria-label="Verification" bind:value={filters.verification}>
        <option value="">Any status</option>
        {#each ['sourced', 'candidate', 'unverified', 'conflict', 'separate'] as v (v)}<option>{v}</option>{/each}
      </select>
      <select aria-label="Character" bind:value={filters.member}>
        <option value="">All characters</option><option value="-">Unassigned</option>
        {#each members() as p (p.id)}<option value={p.id}>{label(p)}</option>{/each}
      </select>
      <label class="chk"><input type="checkbox" bind:checked={filters.missableOnly} /> Missable only</label>
      <label class="chk"><input type="checkbox" bind:checked={filters.itemsOnly} /> Items only</label>
    </div>
  {/if}
</header>

<main aria-live="polite">
  {#if error}
    <p class="empty" role="alert">Error: {error}</p>
  {:else if !data}
    <p class="empty">Loading data …</p>
  {:else}
    {#each regions as g (g.id)}
      <RegionView region={g} {filters} party={members()} forceOpen={Boolean(filters.query)} />
    {/each}
    {#if hasActiveFilter(filters) && regions.length === 0}<p class="empty">No entries match these filters.</p>{/if}
  {/if}
</main>

<footer class="foot">
  {#if !app.storageOk}
    <span role="alert">Saving in the browser is not possible: changes will be lost when you close the page. Please download a backup.</span>
  {/if}
  <span>Source status is not in-game verification.{#if data} Data as of {data.dataDate} ({data.dataStage}).{/if}</span>
</footer>

<PartyDialog bind:this={party} />
<BackupDialog bind:this={backup} />
<SyncDialog bind:this={syncDlg} />
