<script lang="ts">
  import type { BuildPack, PackBuild } from './buildpack'
  import { closeGuide } from './nav.svelte'
  import { endgameViews, gearViews, levelViews, missablesOf, openPointsOf, proseOf, SECTIONS, sourcesOf, verificationBadge } from './guideModel'
  import { paragraphs } from './guidePdf'
  import type { Block } from './guidePdf'
  import Badge from './Badge.svelte'
  import Icon from './Icon.svelte'

  interface Props { pack: BuildPack; build: PackBuild; fixed: boolean; onPdf: (id: string) => void }
  let { pack, build: b, fixed, onPdf }: Props = $props()

  type Sheet = 'build' | 'gear' | 'combat'
  const SHEETS: [Sheet, string][] = [['build', 'Build'], ['gear', 'Gear'], ['combat', 'Combat']]
  let sheet = $state<Sheet>('build')

  const badge = $derived(verificationBadge(b.verification))
  const levels = $derived(levelViews(b))
  const gear = $derived(gearViews(pack, b))
  const sets = $derived(endgameViews(b))
  const missables = $derived(missablesOf(b))
  const openPoints = $derived(openPointsOf(b))
  const sources = $derived(sourcesOf(b))
  const at = $derived(b.attributes)
  const tactics = $derived(proseOf(b, '10'))
  const attrCols = $derived(at.base.columns.slice(1))
  const pickSheet = (s: Sheet) => { sheet = s; window.scrollTo(0, 0) }
</script>

{#snippet prose(bl: Block[])}
  <div class="prose">
    {#each bl as p, i (i)}
      {#if p.kind === 'field'}
        <p class="field-line"><span class="fk">{p.key === 'WIRKUNG MIT FEATS OVERHAUL' ? 'WIRKUNG' : p.key}</span> {p.text}</p>
      {:else}
        <p>{p.text}</p>
      {/if}
    {/each}
  </div>
{/snippet}

{#snippet gap(what: string)}
  <p class="gapnote"><Badge kind="bad" icon="unverified">gap</Badge> {what}</p>
{/snippet}

<section class="guide" aria-labelledby="guide-title">
  <div class="rp-head">
    <div class="rp-top">
      <button type="button" class="btn plain back" onclick={closeGuide}><Icon name="back" />Back</button>
      <button type="button" class="btn" onclick={() => onPdf(b.id)}><Icon name="guide" />Save as PDF</button>
    </div>
    <p class="eyebrow">{b.character}{fixed ? ' · fixed' : ''}</p>
    <h1 id="guide-title">{b.title}</h1>
    <p class="split">{b.classSplit.map((c) => `${c.cls} ${c.levels}`).join(' / ')}</p>
    <div class="badges"><Badge kind={badge.kind} icon={badge.icon}>{badge.label}</Badge></div>
  </div>

  <div class="gsheets seg" role="group" aria-label="Part of the guide">
    {#each SHEETS as [id, label] (id)}
      <button type="button" aria-pressed={sheet === id} onclick={() => pickSheet(id)}>{label}</button>
    {/each}
  </div>

  {#if sheet === 'build'}
    <h2>Levels 1–20</h2>
    <ol class="levels">
      {#each levels as l (l.totalLevel)}
        <li>
          <span class="lv"><span class="sr-only">Level </span>{l.totalLevel}</span>
          <div class="lb">
            <p class="lc"><strong>{l.cls}</strong> <span class="meta">class level {l.classLevel}</span></p>
            {#if l.text}<p>{l.text}</p>{:else if l.feats.length === 0}{@render gap('no entry for this level')}{/if}
            {#if l.feats.length}
              <p class="feats">
                {#each l.feats as f, i (i)}
                  <Badge kind={f.kind === 'bonus' ? 'info' : 'plain'} icon="sourced">{f.kind === 'bonus' ? 'Bonus feat' : 'Class feat'}: {f.name}</Badge>
                {/each}
              </p>
            {/if}
          </div>
        </li>
      {/each}
    </ol>

    <h2>Attributes</h2>
    {#if paragraphs(at.intro).length}{@render prose(paragraphs(at.intro).map((text) => ({ kind: 'p', text })))}{/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="tablewrap" tabindex="0" role="region" aria-label="Starting attributes">
      <table>
        <caption class="sr-only">Starting attributes</caption>
        <thead><tr><th scope="col">{at.base.columns[0]}</th>{#each attrCols as c (c)}<th scope="col">{c}</th>{/each}</tr></thead>
        <tbody>
          {#each at.base.rows as r (r.stat)}
            <tr><th scope="row">{r.stat}</th>{#each attrCols as c (c)}<td>{r.cells[c] ?? ''}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if at.progress}
      <h3>Progress</h3>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div class="tablewrap" tabindex="0" role="region" aria-label="Attribute progress by level">
        <table>
          <caption class="sr-only">Attribute progress by level</caption>
          <thead><tr><th scope="col">LV</th><th scope="col">Source</th>{#each at.progress.columns as c (c)}<th scope="col">{c}</th>{/each}</tr></thead>
          <tbody>
            {#each at.progress.rows as r (r.lv)}
              <tr><th scope="row">{r.lv}</th><td class="src">{r.source}</td>{#each at.progress.columns as c (c)}<td>{r.values[c] ?? ''}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      {@render gap('no attribute progress in the guide')}
    {/if}
    {#if at.note.length}{@render prose(paragraphs(at.note).map((text) => ({ kind: 'p', text })))}{/if}

    {#each SECTIONS.filter((s) => s.key !== '10') as s (s.key)}
      {@const bl = proseOf(b, s.key)}
      <h2>{s.title}</h2>
      {#if bl.length}{@render prose(bl)}{:else}{@render gap('section missing in the guide')}{/if}
    {/each}
  {:else if sheet === 'gear'}
    <p class="meta">Option 1 is the recommendation. Every item shows how well it is verified.</p>
    {#each gear as g (g.act)}
      <h2>{g.act}</h2>
      {#if g.gap}
        {@render gap('no gear listed for this act')}
      {:else}
        {#each g.notes as n, i (i)}<p class="meta">{n}</p>{/each}
        <ul class="slots">
          {#each g.slots as s (s.slot)}
            <li class="slot">
              <h3>{s.label}</h3>
              <ol>
                {#each s.options as o (o.rank)}
                  <li class:inh={o.inherited}>
                    <span class="rk">{o.rank}</span>
                    <div>
                      {#if !o.item}
                        {@render gap('item not in the package')}
                      {:else}
                        <p class="iname">
                          {#if o.wiki}<a href={o.wiki} target="_blank" rel="noopener">{o.name}<span class="sr-only"> (bg3.wiki, opens in a new tab)</span></a>{:else}{o.name}{/if}
                          {#if o.inherited}<span class="meta"> · carried over</span>{/if}
                        </p>
                        {#if o.notes}<p class="meta">{o.notes}</p>{/if}
                        {#if o.badge}<Badge kind={o.badge.kind} icon={o.badge.icon}>{o.badge.label}</Badge>{/if}
                      {/if}
                    </div>
                  </li>
                {/each}
                {#each s.gaps as r (r)}
                  <li><span class="rk">{r}</span><div>{@render gap('not named in the guide')}</div></li>
                {/each}
              </ol>
            </li>
          {/each}
        </ul>
      {/if}
    {/each}
    <h2>Endgame sets</h2>
    {#if sets.length === 0}{@render gap('no endgame sets in the guide')}{/if}
    {#each sets as s, i (i)}
      <div class="card pad set">
        <h3>{s.name}</h3>
        <dl>{#each s.rows as r, i (i)}<dt>{r.slot}</dt><dd>{r.value}</dd>{/each}</dl>
      </div>
    {/each}
  {:else}
    <h2>Combat rotation and strategy</h2>
    {#if tactics.length}{@render prose(tactics)}{:else}{@render gap('section missing in the guide')}{/if}

    <h2>Missable parts</h2>
    {#if missables.length === 0}
      <p class="meta">None listed in the guide.</p>
    {:else}
      <ul class="miss">
        {#each missables as m, i (i)}
          <li><p><strong>{m.items}</strong></p><p>{m.condition}</p>{#if m.act}<p class="meta">{m.act}</p>{/if}</li>
        {/each}
      </ul>
    {/if}

    <h2>Still to check in the game</h2>
    {#if openPoints.length === 0}
      <p class="meta">None listed.</p>
    {:else}
      <ul class="open">{#each openPoints as p, i (i)}<li>{p}</li>{/each}</ul>
    {/if}

    {#if sources.length}
      <h2>Sources</h2>
      {@render prose(sources.map((text) => ({ kind: 'p', text })))}
    {/if}
    <p class="meta">Guide source: {b.source}</p>
  {/if}
</section>
