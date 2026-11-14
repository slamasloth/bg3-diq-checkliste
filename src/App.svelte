<script lang="ts">
  import { onMount } from 'svelte'
  import { ChecklistSchema, type Checklist } from './lib/schema'
  import { allCharacters, app, characterGroups, setActiveAct } from './lib/store.svelte'
  import { initNav, nav, saveNav } from './lib/nav.svelte'
  import ChecklistView from './lib/ChecklistView.svelte'
  import MenuList from './lib/MenuList.svelte'
  import SyncChip from './lib/SyncChip.svelte'
  import TabBar from './lib/TabBar.svelte'
  import PartyDialog from './lib/PartyDialog.svelte'
  import BackupDialog from './lib/BackupDialog.svelte'
  import SyncDialog from './lib/SyncDialog.svelte'
  import GuidesDialog from './lib/GuidesDialog.svelte'
  import LineupDialog from './lib/LineupDialog.svelte'
  import { reconcileNow, resumeSync, syncNow } from './lib/sync.svelte'

  let data = $state<Checklist | null>(null)
  let error = $state('')
  let act = $state('Act 1')
  let party: PartyDialog
  let backup: BackupDialog
  let syncDlg: SyncDialog
  let guides: GuidesDialog
  let lineup: LineupDialog

  onMount(async () => {
    initNav()
    resumeSync()
    window.addEventListener('online', syncNow)
    document.addEventListener('visibilitychange', reconcileNow)
    // Keep keyboard focus clear of the pinned act bar (WCAG 2.4.11): tell the browser how tall it is.
    const measure = () => {
      const el = document.querySelector('.pinned')
      document.documentElement.style.setProperty('--sticky-h', `${Math.round(el?.getBoundingClientRect().height ?? 0)}px`)
    }
    new ResizeObserver(measure).observe(document.body)
    window.addEventListener('resize', measure)
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

  const pick = (a: string) => { act = a; setActiveAct(a); window.scrollTo(0, 0) }
  // Reset the character filter if the selected (custom) character was removed.
  $effect(() => {
    if (nav.filters.member && nav.filters.member !== '-' && !allCharacters().some((p) => p.id === nav.filters.member)) nav.filters.member = ''
  })
  // Remember tab, region and filters (the view state only; never synchronised).
  $effect(() => { saveNav() })

  const TITLES = { checklist: 'Checklist', party: 'Party', more: 'More' } as const
  const inRegion = $derived(nav.tab === 'checklist' && nav.region !== null && data?.regions.some((g) => g.id === nav.region))
</script>

<div class="app">
  <header class="topbar">
    <div>
      <span class="eyebrow">BG3 DIQ R150</span>
      {#if inRegion}<p class="apptitle">Checklist</p>{:else}<h1>{TITLES[nav.tab]}</h1>{/if}
    </div>
    <SyncChip onclick={() => syncDlg.open()} />
  </header>

  {#if !app.storageOk}
    <p class="banner bad" role="alert">Saving in the browser is not possible: changes will be lost when you close the page. Please download a backup.</p>
  {/if}

  <main>
    {#if nav.tab === 'checklist'}
      {#if error}
        <p class="empty" role="alert">Error: {error}</p>
      {:else if !data}
        <p class="empty" role="status">Loading data …</p>
      {:else}
        <ChecklistView {data} {act} groups={characterGroups()} onPickAct={pick} />
      {/if}
    {:else if nav.tab === 'party'}
      <div class="page">
        <MenuList items={[
          { label: 'Characters', hint: 'Add characters beyond the built-in roster', icon: 'users', onselect: () => party.open() },
          { label: 'Lineup', hint: 'Choose the lineup of four and assign gear per act', icon: 'lineup', onselect: () => lineup.open() },
        ]} />
      </div>
    {:else}
      <div class="page">
        <MenuList items={[
          { label: 'Party sync', hint: 'Share progress between devices', icon: 'sync', onselect: () => syncDlg.open() },
          { label: 'Build guides', hint: 'Save the build guides as PDF', icon: 'guide', onselect: () => guides.open() },
          { label: 'Backup', hint: 'Download or restore your progress', icon: 'backup', onselect: () => backup.open() },
        ]} />
        <section class="about" aria-labelledby="about-t">
          <h2 id="about-t">About</h2>
          <p class="meta">Source status is not in-game verification.{#if data} Data as of {data.dataDate} ({data.dataStage}).{/if}</p>
          <p class="meta">Text size follows your device or browser setting.</p>
        </section>
      </div>
    {/if}
  </main>
</div>

<TabBar />

<PartyDialog bind:this={party} />
<BackupDialog bind:this={backup} />
<SyncDialog bind:this={syncDlg} />
<GuidesDialog bind:this={guides} />
<LineupDialog bind:this={lineup} />
