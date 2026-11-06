<script lang="ts">
  import { loadBuildPack, type BuildPack } from './buildpack'
  import { saveGuidePdf } from './guidePdf'

  let dlg: HTMLDialogElement
  let pack = $state<BuildPack | null>(null)
  let selected = $state<string[]>([])
  let msg = $state('')
  let busy = $state(false)
  let last = $state<{ name: string; url: string } | null>(null)
  let look = $state<'screen' | 'print'>('screen')

  export async function open() {
    msg = ''
    dlg.showModal()
    if (pack) return
    try {
      pack = await loadBuildPack(`${import.meta.env.BASE_URL}data/builds.pack.json`)
      selected = [...pack.party.fixed]
    } catch (e) {
      msg = 'Error: ' + (e instanceof Error ? e.message : String(e))
    }
  }

  async function save(ids: string[]) {
    if (!pack || ids.length === 0) return
    busy = true
    msg = 'Creating PDF …'
    try {
      if (last) URL.revokeObjectURL(last.url)
      const r = await saveGuidePdf(pack, ids, { theme: look })
      last = { name: r.name, url: r.url }
      msg = `${r.name} (${Math.round(r.bytes / 1024)} KB) was sent to your browser's downloads.`
    } catch (e) {
      msg = 'Error: ' + (e instanceof Error ? e.message : String(e))
    } finally {
      busy = false
    }
  }
  const toggle = (id: string) => (selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
</script>

<dialog bind:this={dlg} aria-labelledby="gd-h">
  <h2 id="gd-h">Guides as PDF</h2>
  <p class="muted">
    Choose the guides and save them as one PDF (levels 1–20, gear per act with tick boxes, end-game sets, tactics, open points).
    The PDF is created on this device, also offline.
  </p>
  {#if pack}
    <ul class="plist">
      {#each pack.builds as b (b.id)}
        <li>
          <label class="chk">
            <input type="checkbox" checked={selected.includes(b.id)} onchange={() => toggle(b.id)} />
            {b.character} – {b.title}{#if pack.party.fixed.includes(b.id as 'dark_urge' | 'tala')} <span class="muted">(fixed)</span>{/if}
          </label>
        </li>
      {/each}
    </ul>
    <label class="chk">Look
      <select bind:value={look} aria-label="Look">
        <option value="screen">Screen: dark like the full guide (phone, tablet, TV)</option>
        <option value="print">Print: light, A4</option>
      </select>
    </label>
    <div class="row">
      <button type="button" disabled={busy || selected.length === 0} onclick={() => save(selected)}>Save selected ({selected.length}) as PDF</button>
      <button type="button" disabled={busy} onclick={() => save(pack!.builds.map((b) => b.id))}>Save all 12</button>
    </div>
  {:else if !msg}
    <p class="muted">Loading guides …</p>
  {/if}
  <p class="muted" role="status">{msg}</p>
  {#if last}
    <div class="row">
      <a class="btnlike" href={last.url} target="_blank" rel="noopener">Open PDF</a>
      <a class="btnlike" href={last.url} download={last.name}>Download again</a>
    </div>
  {/if}
  <div class="row end"><button type="button" onclick={() => dlg.close()}>Close</button></div>
</dialog>
