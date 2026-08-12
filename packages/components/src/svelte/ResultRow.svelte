<script lang="ts">
  /**
   * One row in a list of results — the second primitive both search islands
   * have been asking for.
   *
   * `RulesSearch.svelte` and `CardSearch.svelte` each carried their own copy of
   * this row and its styles, and after `SearchField` was extracted the note in
   * both files narrowed to naming exactly this: "the dense list row … belongs
   * in the library as `ResultRow`, and is written here until it goes."
   * Measured before the cut: 52 identical CSS lines still shared across nine
   * selectors.
   *
   * THE STYLES ARE LIFTED VERBATIM, for the reason `SearchField` records the
   * hard way: rewriting them from memory silently changed four things last
   * time, one of which reversed a documented decision. A refactor that quietly
   * redesigns is not a refactor.
   *
   * WHAT THE ROW OWNS: the hairline that separates it from the row above, the
   * baseline alignment, the intrinsic wrap, and the three type voices — serif
   * for the name, mono for the metadata. What the CALLER owns: what a result
   * IS. A rules result leads with a citation and a card result leads with a
   * pitch jewel; neither belongs in a primitive that would then have to know
   * about both.
   *
   * SO THE LEADING SLOT IS A SNIPPET AND THE METADATA IS A SNIPPET. The row is
   * a layout and a set of voices, not a schema. It knows a result has a link,
   * something before it, and some facts under it.
   *
   * THE ROW WRAPS INTRINSICALLY rather than at a breakpoint, because this
   * repository publishes no breakpoint tokens and `check:tokens` rejects a raw
   * length — the same constraint that shaped the card page's two columns.
   */
  import type { Snippet } from "svelte";

  interface Props {
    /** Where the row goes. A real URL; every result here is a destination. */
    href: string;
    /**
     * The text inside the anchor.
     *
     * REQUIRED AND NOT A SNIPPET, deliberately. Two anchors that differ only in
     * where they point are a WCAG 2.4.4 failure, and this product has 900 card
     * names shared by two to four different cards — so the accessible name has
     * to be a string the caller composed on purpose, not markup it assembled
     * incidentally.
     */
    label: string;
    /** Rendered before the link — a pitch jewel, a citation. */
    lead?: Snippet;
    /** Rendered under the link, in the mono voice. Facts, not prose. */
    meta?: Snippet;
  }

  const { href, label, lead, meta }: Props = $props();
</script>

<li class="result">
  {@render lead?.()}

  <div class="body">
    <p class="line"><a class="name" {href}>{label}</a></p>
    {#if meta}
      <p class="meta">{@render meta()}</p>
    {/if}
  </div>
</li>

<style>
  /*
    LIFTED VERBATIM from `apps/site/src/components/CardSearch.svelte`, comments
    included, which is what makes this an extraction rather than a redesign.
    Every value names a token; `scripts/check-tokens.ts` fails the build on a
    raw hex or length in component source.
  */

  /*
    Density without clutter: rows are separated by one hairline and nothing else
    — no card, no shadow, no padding a reader has to look past. The row wraps
    intrinsically rather than at a breakpoint, since the theme publishes no
    breakpoint tokens and a raw one is not available to write.
  */
  .result {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--of-space-tight);
    padding-block: var(--of-space-base);
    border-block-start: var(--of-ornament-rule-width) solid var(--of-color-rule);
  }

  .body {
    flex: 1 1 60%;
    min-inline-size: 0;
  }

  .line {
    margin: 0;
  }

  /* Serif — the voice assigned to names. */
  .name {
    font-family: var(--of-type-family-serif);
    font-size: var(--of-type-size-large);
    letter-spacing: var(--of-type-tracking-tight);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--of-space-tight);
    margin-block: var(--of-space-tightest) 0;
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-wide);
    text-transform: uppercase;
    color: var(--of-color-ink-faint);
  }

  /*
    `:global()` on the metadata's children, and it is the same lesson
    `SearchField` learned: the snippet's markup is authored in the CALLER, so it
    carries the caller's scope hash. A plain `.meta span` compiles to nothing.
    Scoped under `.meta` so the reach stays inside this component's own row.
  */
  .meta :global(span) {
    color: var(--of-color-ink-muted);
  }
</style>
