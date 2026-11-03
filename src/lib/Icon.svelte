<script lang="ts">
  import { ICONS, type IconName } from './icons'
  let { name }: { name: IconName } = $props()
</script>

<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <path d={ICONS[name]} class:dashed={name === 'unverified'} />
</svg>
