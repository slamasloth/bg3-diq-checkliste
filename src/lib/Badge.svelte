<script lang="ts">
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'
  import type { IconName } from './icons'

  /**
   * Badge = symbol + word, never colour alone (DESIGN_SYSTEM.md section 6).
   * kind: miss (filled, the only saturated one), maybe (outline), ok (quiet text), cand, bad, info, mod, plain.
   */
  interface Props {
    kind?: 'miss' | 'maybe' | 'ok' | 'cand' | 'bad' | 'info' | 'mod' | 'plain'
    icon?: IconName
    title?: string
    class?: string
    children: Snippet
  }
  let { kind = 'plain', icon, title, class: cls = '', children }: Props = $props()
</script>

<span class="badge {kind} {cls}" {title}>{#if icon}<Icon name={icon} />{/if}{@render children()}</span>
