<script lang="ts">
  import { ROSTER } from './roster'
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
  <h2 id="party-h">Characters</h2>
  <p class="muted">
    Tala, Durge and all ten companions are already available in every “Character” menu. Add extra ones here,
    for example a hireling or a mod companion.
  </p>
  <p class="muted"><strong>Built in:</strong> {ROSTER.flatMap((g) => g.list.map((c) => c.name)).join(', ')}.</p>
  <ul class="plist">
    {#each members() as p (p.id)}
      <li><span>{p.name}{p.figure ? ` · ${p.figure}` : ''}</span><button type="button" onclick={() => remove(p.id)}>Remove</button></li>
    {:else}
      <li class="muted">No extra characters yet.</li>
    {/each}
  </ul>
  <form class="row" onsubmit={(e) => { e.preventDefault(); add() }}>
    <input bind:value={name} placeholder="Name (e.g. Hireling)" aria-label="Name" />
    <input bind:value={figure} placeholder="Note (optional)" aria-label="Note" />
    <button type="submit">Add</button>
  </form>
  <div class="row end"><button type="button" onclick={() => dlg.close()}>Close</button></div>
</dialog>
