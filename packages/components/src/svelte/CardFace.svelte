<script lang="ts">
  /**
   * A card face — the printed image, and the copyright line that is the
   * condition of being allowed to show it.
   *
   * THE COPYRIGHT LINE IS NOT A PROP, AND THIS COMPONENT IS THE REASON THAT
   * WORKS. `docs/COMPLIANCE.md` §5 requires the line be "not a prop the caller
   * may omit, not a default that can be overridden to empty, and not the page's
   * responsibility", and it names the ways that could be undone: making it a
   * prop, or "adding a `compact` or `bare` variant that drops it". So there is
   * no such variant here and there must never be one. The line is emitted from
   * {@link CARD_IMAGE_COPYRIGHT} on every render, at every tier, and a caller
   * who wants the image gets the line.
   *
   * It is small and muted at thumbnail size, and it is genuinely rendered
   * rather than hidden. A grid of sixty faces therefore carries sixty short
   * notices, and that is the correct-looking outcome rather than a cost to
   * engineer around: this is what a compliant card database looks like, and the
   * permission it satisfies is the only reason any of these images may be shown
   * at all.
   *
   * WHY IT TAKES BUILT URLS RATHER THAN A KEY. `src`, `srcset` and the box are
   * composed by `apps/site/src/lib/faces.ts`, which owns the URL grammar and is
   * shared with the ingest that writes the blobs. Passing the finished strings
   * keeps this package free of a host name and of the key rule — so the library
   * stays adoptable by a tool that serves its faces from somewhere else, which
   * is the whole premise of publishing these primitives.
   *
   * WIDTH AND HEIGHT ARE REQUIRED, and that is not pedantry. Sixty lazily
   * loaded images with no intrinsic size are sixty layout shifts; the attributes
   * give the browser the box before a byte arrives. They are also why the
   * landscape cases matter — 15 cards are played horizontally and 10 printings
   * carry a rotation, and a portrait box around a landscape face is visible at a
   * glance.
   *
   * THERE IS NO ERROR HANDLING HERE, DELIBERATELY. The face host answers a miss
   * with a card-shaped NO IMAGE placeholder at 200 rather than a 404, so the
   * degraded path is already an image of the right shape. An `onerror` swap
   * here would be a second mechanism for the same thing, in a component that
   * cannot know why the first one did not fire.
   */
  import { CARD_IMAGE_COPYRIGHT } from "../index";
  import { insideCardFaceGroup } from "./CardFaceGroup.svelte";
  import type { PitchValue } from "optfall-theme";

  interface Props {
    /** The face URL at the tier being rendered. */
    src: string;
    /** Optional `srcset`, when more than one tier is worth offering. */
    srcset?: string;
    /** Paired with `srcset`; the layout width the browser should assume. */
    sizes?: string;
    /**
     * The accessible name. Composed by the caller from VERBATIM card fields —
     * `cards.ts` builds it the same way `titleFor` does, out of fixed labels
     * wrapped around real values. Nothing here composes prose.
     */
    alt: string;
    /** Intrinsic width in pixels. Required; see the note above. */
    width: number;
    /** Intrinsic height in pixels. Required; see the note above. */
    height: number;
    /**
     * Drawn by us as an overlay, never sampled from the artwork — so the
     * jewel's three-channel contract (shape, numeral, colour) travels with the
     * component instead of depending on what the printed face happens to show.
     * Rendered by the caller into the `jewel` snippet; this component only
     * positions it.
     */
    pitch?: PitchValue;
    /** Eager only for the one face above the fold on a card page. */
    loading?: "lazy" | "eager";
    /** Rendered into the jewel slot when `pitch` is set. */
    jewel?: import("svelte").Snippet<[PitchValue]>;
  }

  const {
    src,
    srcset,
    sizes,
    alt,
    width,
    height,
    pitch,
    loading = "lazy",
    jewel,
  }: Props = $props();

  /**
   * A group above us carries the notice for all of its faces.
   *
   * READ FROM CONTEXT, NOT FROM A PROP, and that distinction is the whole
   * guarantee. `docs/COMPLIANCE.md` §5 forbids a prop the caller may omit and a
   * variant that drops the line — a caller cannot forge this from markup, and
   * the only thing that sets it is `CardFaceGroup`, which emits the notice
   * itself. The line is hoisted, never dropped: a face outside a group still
   * carries its own.
   */
  const carriedByGroup = insideCardFaceGroup();
</script>

<figure class="face" style={`--face-ratio: ${width} / ${height}`}>
  <span class="frame">
    <img
      {src}
      {srcset}
      {sizes}
      {alt}
      {width}
      {height}
      {loading}
      decoding="async"
    />

    {#if pitch !== undefined && jewel}
      <span class="jewel">{@render jewel(pitch)}</span>
    {/if}
  </span>

  <!--
    Not optional, not overridable, not the page's job. See the block comment
    above and docs/COMPLIANCE.md §5. The only thing that suppresses it here is a
    `CardFaceGroup` ancestor, which emits it for the whole group.
  -->
  {#if !carriedByGroup}
    <figcaption class="copyright">{CARD_IMAGE_COPYRIGHT}</figcaption>
  {/if}
</figure>

<style>
  .face {
    display: flex;
    flex-direction: column;
    gap: var(--of-space-hair);
    margin: 0;
  }

  /*
    The frame is what the jewel is positioned against, and it shrink-wraps the
    image so the overlay cannot drift into the caption's box.
  */
  .frame {
    position: relative;
    display: block;
    line-height: 0;
  }

  img {
    display: block;
    max-inline-size: 100%;
    block-size: auto;
    /*
      THE BOX IS HELD BY THE PROPS, NOT BY WHAT LOADS INTO IT.
      `block-size: auto` alone lets the LOADED image's own ratio drive the
      height, which is fine until the thing that loads is not the shape the
      caller promised. The face host answers a miss with a portrait placeholder
      whatever was asked for, so the 15 horizontally-played cards would resolve
      a portrait SVG inside a landscape box and shift the layout the intrinsic
      attributes exist to hold still. `aspect-ratio` comes from the same
      `width`/`height` the caller already had to supply, and `object-fit`
      letterboxes anything that disagrees rather than distorting it.
    */
    aspect-ratio: var(--face-ratio);
    object-fit: contain;
    /* Stated rather than omitted, exactly as BevelledPlate does it: the token
       exists only to be zero, and saying it out loud is what stops a host
       stylesheet rounding a card face. */
    border-radius: var(--of-bevel-radius);
    /* A face is a struck object like everything else in the system: a light top
       edge and a dark bottom one, so it sits in the page rather than floating
       on it. */
    border-block-start: var(--of-bevel-width) solid var(--of-bevel-light);
    border-block-end: var(--of-bevel-width) solid var(--of-bevel-dark);
    border-inline: var(--of-bevel-width) solid var(--of-color-rule);
    /* Holds the box before the bytes land, and keeps a landscape face from
       being squeezed into a portrait cell. */
    background: var(--of-color-sunken);
  }

  /*
    Top-left, which is where the game's own furniture puts it — docs/DESIGN.md
    describes the card face as "jewel top-left". Inset by a hairline so it
    overlaps the frame's edge rather than sitting outside it.
  */
  .jewel {
    position: absolute;
    inset-block-start: var(--of-space-tight);
    inset-inline-start: var(--of-space-tight);
    line-height: normal;
  }

  /*
    LEGALESE, AND SET LIKE IT.

    This carried `tracking.wide` — the label treatment — which was right while
    it was the monospace label voice and wrong the moment that voice was
    retired. Wide-tracked sans at the top of a card reads as a heading, so the
    one line on the page that should recede was the one shouting. Fine print is
    small, tight and quiet; it is not a label, and it is not announcing itself.

    Still never hidden and never conditional. `docs/COMPLIANCE.md` §5 requires
    the notice accompany the image, and this component emits it with no prop and
    no variant that can drop it — but "present" was never the same as "loud",
    and the requirement asks for the first.
  */
  .copyright {
    font-family: var(--of-type-family-sans);
    /* The smallest step in the scale, and the only thing that uses it. */
    font-size: var(--of-type-size-legal);
    /* Tight rather than tracked: the opposite of the label treatment above. */
    letter-spacing: var(--of-type-tracking-tight);
    color: var(--of-color-ink-faint);
    line-height: var(--of-type-leading-tight);
    /* Never wider than the face it belongs to, so a thumbnail's notice cannot
       widen the cell it sits in. */
    max-inline-size: 100%;
  }
</style>
