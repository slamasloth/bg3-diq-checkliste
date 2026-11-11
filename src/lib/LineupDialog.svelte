<script lang="ts">
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'
  import { loadBuildPack, type BuildPack, type VerificationLevel } from './buildpack'
  import { assignGear, excludedText, SLOT_LABEL, type Candidate, type SlotResult } from './gearAssign'
  import { emptyPrefs, loadPrefs, lockItem, savePrefs, unlockItem, type LineupPrefs } from './lineup'

  let dlg: HTMLDialogElement
  let pack = $state<BuildPack | null>(null)
  let prefs = $state<LineupPrefs>(emptyPrefs())
  let msg = $state('')
  let saved = $state(true)

  export async function open() {
    msg = ''
    dlg.showModal()
    if (pack) return
    try {
      const p = await loadBuildPack(`${import.meta.env.BASE_URL}data/builds.pack.json`)
      prefs = loadPrefs(p)
      pack = p
    } catch (e) {
      msg = 'Error: ' + (e instanceof Error ? e.message : String(e))
    }
  }

  const update = (next: LineupPrefs) => {
    prefs = next
    saved = savePrefs(next)
  }

  const STAGE: Record<VerificationLevel, { text: string; cls: string; icon: IconName }> = {
    INGAME_CONFIRMED: { text: 'in-game confirmed', cls: 'v-sourced', icon: 'sourced' },
    INSTALLED_FILE_CONFIRMED: { text: 'file-confirmed', cls: 'v-sourced', icon: 'sourced' },
    AUTHOR_DOCUMENTED: { text: 'author-documented', cls: 'v-sourced', icon: 'sourced' },
    PROJECT_RECONSTRUCTED: { text: 'reconstructed', cls: 'v-candidate', icon: 'candidate' },
    THEORY_INFERRED: { text: 'inferred', cls: 'v-candidate', icon: 'candidate' },
    UNKNOWN: { text: 'unknown', cls: 'v-unverified', icon: 'unverified' },
  }

  const members = $derived(pack ? [...pack.party.fixed, ...prefs.extra] : [])
  const mode = $derived(prefs.verifiedOnly ? 'verified' : 'dated')
  const nameOf = (id: string) => pack?.builds.find((b) => b.id === id)
  const perAct = $derived(
    pack && members.length
      ? Object.fromEntries(pack.acts.map((a) => [a, assignGear(pack!, members, a, mode, prefs.locked[a] ?? {})]))
      : {},
  )
  const result = $derived(perAct[prefs.act] ?? null)
  const others = $derived(pack ? pack.party.pool.filter((m) => !(pack!.party.fixed as readonly string[]).includes(m)) : [])
  const choose = (i: 0 | 1, id: string) => {
    const extra = [...prefs.extra]
    if (id) extra[i] = id
    else extra.splice(i, 1)
    update({ ...prefs, extra: extra.filter(Boolean) })
  }

  const bySlot = (m: string) => result?.slots.filter((s) => s.member === m) ?? []
  const status = (s: SlotResult, o: Candidate): string => {
    if (s.chosen?.itemId === o.itemId) return s.locked ? 'Locked choice' : 'Assigned'
    if (o.excluded) return `Left out: ${excludedText(o.excluded)}`
    const w = s.whyNot.find((x) => x.name === o.name && x.rank === o.rank)
    return w ? `Not chosen: ${w.reason}` : 'Not needed: a better option is assigned'
  }
  const key = (s: SlotResult) => `${s.member}/${s.slot}`
  const summary = $derived.by(() => {
    if (!result) return ''
    const n = result.slots.length
    const open = result.unserved
    return open === 0
      ? `${prefs.act}: all ${n} slots have an item. Best rank sum according to the guides: ${result.rankSum}.`
      : `${prefs.act}: ${open} of ${n} slots have no item (gap). Rank sum of the others: ${result.rankSum}.`
  })
</script>

<dialog bind:this={dlg} class="wide" aria-labelledby="ld-h">
  <h2 id="ld-h">Lineup and gear</h2>
  <p class="muted">
    Dark Urge and Tala are fixed; choose two more. Every member gets one item per slot, no item twice. "Best" means the lowest sum of
    guide ranks (1 = the guide's first choice); it says nothing about item strength. Source status is not in-game verification.
  </p>

  {#if pack}
    <div class="pick">
      <div class="fixed"><span class="b">Fixed</span> Dark Urge, Tala</div>
      {#each [0, 1] as const as i (i)}
        <label class="field">Member {i + 3}
          <select value={prefs.extra[i] ?? ''} onchange={(e) => choose(i, e.currentTarget.value)}>
            <option value="">Not chosen</option>
            {#each others as m (m)}
              {#if m === prefs.extra[i] || !prefs.extra.includes(m)}<option value={m}>{nameOf(m)?.character} – {nameOf(m)?.title}</option>{/if}
            {/each}
          </select>
        </label>
      {/each}
    </div>

    <nav class="tabs" aria-label="Act">
      {#each pack.acts as a (a)}
        <button type="button" class="tab" aria-pressed={a === prefs.act} onclick={() => update({ ...prefs, act: a })}>
          {a}<small><span class="sr-only"> – </span>{perAct[a]?.unserved ? `${perAct[a].unserved} open` : 'complete'}</small>
        </button>
      {/each}
    </nav>

    <label class="chk"><input type="checkbox" checked={prefs.verifiedOnly} onchange={(e) => update({ ...prefs, verifiedOnly: e.currentTarget.checked })} />
      Verified items only (file-confirmed or author-documented, act known)</label>
    <p class="muted" role="status">{summary}</p>
    {#if members.length < 4}<p class="muted">Choose two more members to see the full lineup of four.</p>{/if}

    {#each members as m (m)}
      <section class="mem" aria-labelledby="mh-{m}">
        <h3 id="mh-{m}">{nameOf(m)?.character} <span class="muted">{nameOf(m)?.title}</span></h3>
        {#if bySlot(m).length === 0}
          <p class="muted">The guide names no gear for {nameOf(m)?.character} in {prefs.act}.</p>
        {:else}
          <ul class="slots">
            {#each bySlot(m) as s (s.slot)}
              <li>
                <div class="head">
                  <span class="sl">{SLOT_LABEL[s.slot] ?? s.slot}</span>
                  {#if s.chosen}
                    <span class="nm">{s.chosen.name}</span>
                    <span class="badges">
                      <span class="b">{s.chosen.rank > 0 ? `Rank ${s.chosen.rank}` : 'Not in the guide'}</span>
                      <span class="b {STAGE[s.chosen.level].cls}"><Icon name={STAGE[s.chosen.level].icon} />{STAGE[s.chosen.level].text}</span>
                      {#if s.locked}<span class="b"><Icon name="lineup" />locked</span>{/if}
                      {#if s.gap}<span class="b v-candidate"><Icon name="warn" />gap: {s.usable} of 3 options</span>{/if}
                    </span>
                  {:else}
                    <span class="nm none">No item</span>
                    <span class="badges"><span class="b v-unverified"><Icon name="warn" />gap: {s.usable} of 3 options</span></span>
                  {/if}
                </div>
                <details>
                  <summary>Options{#if s.whyNot.length || !s.chosen}, and why not rank 1{/if}</summary>
                  <ul class="opts">
                    {#each s.options as o (o.key)}
                      <li>
                        <span class="nm">{o.name}</span>
                        <span class="badges">
                          <span class="b">Rank {o.rank}</span>
                          <span class="b {STAGE[o.level].cls}"><Icon name={STAGE[o.level].icon} />{STAGE[o.level].text}</span>
                        </span>
                        <span class="why">{status(s, o)}</span>
                        {#if s.locked && s.chosen?.itemId === o.itemId}
                          <button type="button" onclick={() => update(unlockItem(prefs, prefs.act, key(s)))}>Unlock</button>
                        {:else if !o.excluded}
                          <button type="button" aria-label="Use this: {o.name}, {SLOT_LABEL[s.slot]}, {nameOf(s.member)?.character}"
                            onclick={() => update(lockItem(prefs, prefs.act, key(s), o.itemId))}>Use this</button>
                        {/if}
                      </li>
                    {/each}
                  </ul>
                  {#if s.gap}<p class="muted">Fewer than three usable options: the guide or the data names no more. Nothing is added from elsewhere.</p>{/if}
                </details>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
    {#if !saved}<p role="alert" class="muted">Saving in the browser is not possible: the lineup will be lost when you close the page.</p>{/if}
  {:else if !msg}
    <p class="muted">Loading guides …</p>
  {/if}
  <p class="muted" role="status">{msg}</p>
  <div class="row end"><button type="button" onclick={() => dlg.close()}>Close</button></div>
</dialog>

<style>
  dialog.wide { max-width: min(860px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; }
  .pick { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: end; margin: 12px 0; }
  .fixed { display: flex; align-items: center; gap: 8px; min-height: var(--tap); }
  .field { display: flex; flex-direction: column; gap: 4px; color: var(--muted); flex: 1 1 14rem; min-width: 0; }
  .field select { max-width: 100%; }
  .tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; }
  .mem { margin-top: 16px; }
  .mem h3 { font: 400 1.25rem/1.25 var(--serif); color: var(--h); margin: 0 0 4px; }
  .slots, .opts { list-style: none; margin: 0; padding: 0; }
  .slots > li { border-top: 1px solid var(--line-soft); padding: 8px 0; }
  .head { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
  .sl { flex: 0 0 6rem; font-weight: 700; color: var(--muted); }
  .nm { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
  .nm.none { color: var(--bad); }
  .badges { display: flex; flex-wrap: wrap; gap: 4px; }
  details > summary { min-height: var(--tap); display: flex; align-items: center; cursor: pointer; color: var(--accent); }
  .opts > li { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; padding: 4px 0 4px 12px; border-left: 2px solid var(--line-soft); margin-bottom: 4px; }
  .why { color: var(--muted); flex: 1 1 12rem; }
  @media (max-width: 640px) { .sl { flex-basis: 100%; } }
</style>
