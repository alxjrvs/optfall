<script lang="ts">
/**
 * Picks a card and goes there.
 *
 * `Math.random()` is the whole implementation, and that is the point: there
 * is nothing to rank, nothing to weight and nothing to remember. A "random"
 * that avoided repeats would need state, and state on a static site is a
 * cookie nobody asked for.
 *
 * It navigates on mount rather than offering a button, because the reader
 * already pressed the button — it was the link that brought them here.
 */
import { decodeNameIndex, type EncodedNameIndex } from "../lib/typeahead";

interface Props {
  index: EncodedNameIndex;
}

const { index }: Props = $props();

const names = $derived(decodeNameIndex(index));

let href = $state<string | null>(null);

$effect(() => {
  if (names.size === 0) return;
  const pick = Math.floor(Math.random() * names.size);
  const slug = names.slugs[pick];
  if (slug === undefined) return;
  href = `/card/${slug}`;
  window.location.replace(href);
});
</script>

<!--
  A link, not just a redirect. If the navigation is blocked or slow the reader
  still has something to press, and `replace` keeps the back button pointing at
  wherever they came from rather than trapping them in a loop of random cards.
-->
<p class="fallback">
  {#if href}
    <a href={href}>Opening a card…</a>
  {:else}
    Choosing a card…
  {/if}
</p>

<style>
  .fallback {
    color: var(--of-color-ink-muted);
  }
</style>
