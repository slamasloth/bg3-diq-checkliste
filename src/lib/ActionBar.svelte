<script lang="ts">
  import Icon from './Icon.svelte'
  import { characterGroups } from './store.svelte'
  import { characterLabel } from './roster'
  import { isItem } from './logic'
  import { assignTo, cancelSelect, markDone, openCount, selection } from './groupActions.svelte'

  let dlg: HTMLDialogElement
  let who = $state('')

  const rows = $derived([...selection.rows.values()])
  const open = $derived(openCount(rows))
  const items = $derived(rows.filter(isItem).length)
  const done = () => { markDone(rows); cancelSelect() }
  const assign = () => {
    if (!who) return
    assignTo(rows, who)
    dlg.close()
    cancelSelect()
  }
</script>

<nav class="actionbar" aria-label="Actions for the selected rows">
  <div>
    <button type="button" class="btn primary" disabled={open === 0} onclick={done}>Mark {open} done</button>
    <button type="button" class="btn" disabled={items === 0} onclick={() => { who = ''; dlg.showModal() }}><Icon name="users" />Assign…</button>
  </div>
</nav>

<dialog bind:this={dlg} class="sheet" aria-labelledby="assign-title">
  <div class="grab" aria-hidden="true"></div>
  <div class="head">
    <h2 id="assign-title">Assign {items} {items === 1 ? 'item' : 'items'}</h2>
    <button type="button" class="btn plain" onclick={() => dlg.close()}><Icon name="close" />Close</button>
  </div>
  <div class="body">
    <label class="fld">Character
      <select bind:value={who}>
        <option value="">Choose…</option>
        {#each characterGroups() as g (g.label)}
          <optgroup label={g.label}>{#each g.list as p (p.id)}<option value={p.id}>{characterLabel(p)}</option>{/each}</optgroup>
        {/each}
      </select>
    </label>
    <p class="meta">Rows that are not items are left alone. You can undo right after.</p>
  </div>
  <div class="foot"><button type="button" class="btn primary" disabled={!who} onclick={assign}>Assign</button></div>
</dialog>
