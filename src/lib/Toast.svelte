<script lang="ts">
  import { dismissToast, toast } from './groupActions.svelte'
</script>

<!-- The region stays in the page so assistive tech announces new text; it never takes focus. -->
<div class="toastzone" role="status" aria-live="polite">
  {#if toast.text}
    {#key toast.seq}
      <div class="toast">
        <span>{toast.text}</span>
        {#if toast.undo}<button type="button" class="btn plain" onclick={() => { const u = toast.undo; dismissToast(); u?.() }}>Undo</button>{/if}
      </div>
    {/key}
  {/if}
</div>
