<script lang="ts">
  import { exportBackup, importBackup } from './store.svelte'

  let dlg: HTMLDialogElement
  let msg = $state('')
  export function open() { msg = ''; dlg.showModal() }

  function download() {
    const blob = new Blob([exportBackup()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `bg3diq-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    msg = 'Backup created.'
  }
  async function load(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0]
    if (!f) return
    try {
      const n = importBackup(JSON.parse(await f.text()))
      msg = `${n} entries imported (newer changes win).`
    } catch (err) {
      msg = 'Error: ' + (err instanceof Error ? err.message : String(err))
    }
    e.currentTarget.value = ''
  }
</script>

<dialog bind:this={dlg} aria-labelledby="bk-h">
  <h2 id="bk-h">Backup</h2>
  <p class="muted">
    Progress, assignments and party are stored in this browser only. A backup lets you move them to another device or restore them.
  </p>
  <div class="row">
    <button type="button" onclick={download}>Download backup</button>
    <label class="btnlike">Load backup<input type="file" accept="application/json" hidden onchange={load} /></label>
  </div>
  <p class="muted" role="status">{msg}</p>
  <div class="row end"><button type="button" onclick={() => dlg.close()}>Close</button></div>
</dialog>
