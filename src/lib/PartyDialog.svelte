<script lang="ts">
  import { addMember, members, removeMember } from './store.svelte'

  let dlg: HTMLDialogElement
  let name = $state('')
  let figure = $state('')
  export function open() { dlg.showModal() }

  function add() {
    const n = name.trim()
    if (!n) return
    addMember(n, figure.trim())
    name = ''
    figure = ''
  }
  function remove(id: string) {
    if (confirm('Remove this character? Their item assignments will be cleared.')) removeMember(id)
  }
</script>

<dialog bind:this={dlg} aria-labelledby="party-h">
  <h2 id="party-h">Party</h2>
  <p class="muted">Characters you assign items to. Name and character are free text.</p>
  <ul class="plist">
    {#each members() as p (p.id)}
      <li><span>{p.name}{p.figure ? ` · ${p.figure}` : ''}</span><button type="button" onclick={() => remove(p.id)}>Remove</button></li>
    {:else}
      <li class="muted">No characters yet.</li>
    {/each}
  </ul>
  <form class="row" onsubmit={(e) => { e.preventDefault(); add() }}>
    <input bind:value={name} placeholder="Name (e.g. Player 1)" aria-label="Name" />
    <input bind:value={figure} placeholder="Character (e.g. Karlach)" aria-label="Character" />
    <button type="submit">Add</button>
  </form>
  <div class="row end"><button type="button" onclick={() => dlg.close()}>Close</button></div>
</dialog>
