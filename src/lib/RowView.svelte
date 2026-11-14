<script lang="ts">
  import type { Row } from './schema'
  import { isItem, isMissable } from './logic'
  import { characterColor, characterInitials, characterLabel, type CharacterGroup } from './roster'
  import Badge from './Badge.svelte'
  import { isMaybeMissable, VERIFICATION_LABEL } from './badges'
  import type { IconName } from './icons'

  interface Props {
    row: Row
    checked: boolean
    member: string
    note: string
    /** Everyone an item can be given to, grouped (player characters, companions, custom). */
    groups: CharacterGroup[]
    onToggle: (id: string, c: boolean) => void
    onAssign: (id: string, member: string) => void
    onNote: (id: string, note: string) => void
    /** Show the act named by the source (used in the "Unplaced" tab, where the area is unknown). */
    showAct?: boolean
    /** Selection mode (S3): round select box instead of the done box; details and assignment are hidden. */
    selectMode?: boolean
    selected?: boolean
    onSelect?: (row: Row, on: boolean) => void
  }
  let { row, checked, member, note, groups, onToggle, onAssign, onNote, showAct = false, selectMode = false, selected = false, onSelect }: Props = $props()
  let showDetail = $state(false)

  /** The character this item is assigned to (for the coloured mark next to the title). */
  const who = $derived(member ? groups.flatMap((g) => g.list).find((c) => c.id === member) : undefined)
  const VERIFICATION_ICON: Record<string, IconName> = {
    sourced: 'sourced', candidate: 'candidate', unverified: 'unverified', conflict: 'conflict', separate: 'separate',
  }
  const open = $derived(!checked && isMissable(row)) // still-open missable: orange edge in addition to the badge
  const shortMod = (m: string) => (m.length > 28 ? m.slice(0, 26) + '…' : m)
  const slug = (s: string) => s.replace(/\s+/g, '')

  // Text before/after the linked item name.
  const parts = $derived.by(() => {
    if (row.origin !== 'base' || !row.name || !row.url) return null
    const i = row.text.indexOf(row.name)
    return { pre: i > 0 ? row.text.slice(0, i) : '', post: i >= 0 ? row.text.slice(i + row.name.length) : '' }
  })

  const details = $derived(
    (
      [
        ['Found at', row.foundAt], ['Trigger', row.condition], ['Reward', row.reward],
        ['Missable', row.missableText], ['Effect', row.effect], ['Effect status', row.effectStatus],
        ['Evidence', row.evidence], ['Note', row.hint], ['Duplicate', row.dedupeNote], ['Type', row.contentType],
        ['Configuration', row.configDependency], ['Mapped area (conflicts with act)', row.areaHint],
      ] as [string, string | undefined][]
    ).filter(([, v]) => v),
  )
  // Only offer the details button when there is something behind it (plain tips have nothing to show).
  const hasDetail = $derived(details.length > 0 || isItem(row) || (row.origin !== 'base' && Boolean(row.url)))
</script>

  <li class="row" class:done={checked} class:mark={open} class:item={isItem(row)} class:sel={selectMode} class:picked={selectMode && selected} style:padding-left="{8 + row.depth * 16}px">
    <label class="cbwrap">
      {#if selectMode}
        <input
          class="cb"
          type="checkbox"
          checked={selected}
          aria-label="Select: {row.name ?? row.text}"
          onchange={(e) => onSelect?.(row, e.currentTarget.checked)}
        />
      {:else}
        <input
          class="cb"
          type="checkbox"
          {checked}
          aria-label="Done: {row.name ?? row.text}"
          onchange={(e) => onToggle(row.id, e.currentTarget.checked)}
        />
      {/if}
    </label>
    <div class="txt">
      <span class="title">
        {#if parts}
          {parts.pre}<a href={row.url} target="_blank" rel="noopener">{row.name}</a>{parts.post}
        {:else}
          {row.text}
        {/if}
      </span>
      <div class="badges">
        {#if who}
          <span class="b who" style:background={characterColor(who)} title="Assigned to {characterLabel(who)}">
            <span aria-hidden="true">{characterInitials(who)}</span><span class="sr-only">Assigned to {characterLabel(who)}</span>
          </span>
        {/if}
        {#if isMissable(row)}<Badge kind="miss" icon="warn">Missable</Badge>
        {:else if isMaybeMissable(row)}<Badge kind="maybe" icon="warn" title={row.missableText}>May be missable</Badge>{/if}
        {#if row.verification === 'sourced'}<Badge kind="ok" icon="sourced">{VERIFICATION_LABEL.sourced}</Badge>
        {:else}<Badge kind={row.verification === 'candidate' ? 'cand' : row.verification === 'separate' ? 'info' : 'bad'} icon={VERIFICATION_ICON[row.verification] ?? 'candidate'}>{VERIFICATION_LABEL[row.verification] ?? row.verification}</Badge>{/if}
        {#if row.rarity}<span class="rarity ra-{slug(row.rarity)}">{row.rarity}</span>{/if}
        {#if row.origin !== 'base'}<Badge kind="mod" icon="mod" title={row.mod}>{shortMod(row.mod ?? 'Mod')}</Badge>{/if}
        {#if showAct && row.act}<Badge title="Act according to the source">{row.act}</Badge>{/if}
        {#if row.locMapping}<Badge icon="pin" title="Area only approximately assigned">Area approx.</Badge>{/if}
      </div>
    </div>
    {#if !selectMode}
    <div class="tools">
      {#if isItem(row)}
        <select
          class="asg"
          aria-label="Character for {row.name ?? row.text}"
          value={member}
          onchange={(e) => onAssign(row.id, e.currentTarget.value)}
        >
          <option value="">Character</option>
          {#each groups as g (g.label)}
            <optgroup label={g.label}>
              {#each g.list as p (p.id)}<option value={p.id}>{characterLabel(p)}</option>{/each}
            </optgroup>
          {/each}
        </select>
      {/if}
      {#if hasDetail}
        <button type="button" class="dt" aria-expanded={showDetail} aria-label="Details" onclick={() => (showDetail = !showDetail)}>⋯</button>
      {/if}
    </div>
    {/if}
    {#if showDetail && !selectMode}
      <div class="detail">
        <dl>
          {#each details as [k, v] (k)}<dt>{k}</dt><dd>{v}</dd>{/each}
          {#if row.origin !== 'base' && row.url}<dt>Source</dt><dd><a href={row.url} target="_blank" rel="noopener">{row.url}</a></dd>{/if}
        </dl>
        {#if isItem(row)}
          <input class="nt" placeholder="Note (e.g. who wears it, replacement)" value={note} aria-label="Note"
            onchange={(e) => onNote(row.id, e.currentTarget.value)} />
        {/if}
      </div>
    {/if}
  </li>
