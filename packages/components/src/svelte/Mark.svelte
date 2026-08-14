<script lang="ts">
/**
 * The mark — three interlocked links.
 *
 * WHAT IT REPLACED AND WHY. The mark was a cut jewel: the pitch diamond,
 * cleaved and falling, on the argument that the logo and the core interface
 * primitive should be the same object. That was a good argument for a mark
 * that says *Flesh and Blood*. It is the wrong argument for this one, because
 * the jewel says what the game is and the chain says what the TOOL does.
 *
 * Optfall joins things. A card to the rule that governs it, a rule back to
 * every card that prints its keyword, a printing to its legality and to the
 * upstream flags that produced it. `docs/SCRYFALL-GAP.md` calls the card↔rules
 * cross-reference "the join nothing currently makes", and it is the one thing
 * here that no other tool has. A chain is that, drawn.
 *
 * THE INTERLOCK IS PURE PAINT ORDER — no mask, no subtraction, no cut edges.
 * Each link crosses its neighbour twice, and a real chain is on top at one
 * crossing and under at the other. Drawing left to right settles both the
 * same way, which reads as one ring lying flat over another; redrawing a link
 * inside a rectangle that contains only its UPPER crossing puts it back on
 * top there and nowhere else. The rectangles come from `MARK_GEOMETRY` and
 * sit in the empty band between each pair's two crossings, so nothing is ever
 * clipped through a link's own edge — which is what earlier attempts did, and
 * why they produced odd angled bites out of the rings.
 *
 * IT IS DRAWN AS AN SVG BECAUSE IT HAS TO SURVIVE A FAVICON — and the honest
 * finding is that at three links it does NOT. Measured at 16px the chain is a
 * smudge, so `apps/site/src/pages/favicon.svg.ts` draws ONE link, upright,
 * from `MARK_GEOMETRY.single`. That is the same path under a different
 * transform rather than a second drawing: the favicon is a link of this
 * chain, which is the relationship the geometry constant exists to guarantee.
 *
 * NOT SQUARE, AND THE SIZING FOLLOWS. The chain is about twice as wide as it
 * is tall, so the component sets a HEIGHT from `ornament.mark.*` and lets the
 * `viewBox` supply the width. A square box would letterbox it, and writing
 * both numbers would put a second copy of the aspect ratio somewhere it could
 * drift from the geometry.
 */

import { MARK_GEOMETRY } from "../index";

interface Props {
  /** Rendered size, in token steps rather than pixels. */
  size?: "sm" | "md" | "lg";
  /**
   * Which fill set.
   *
   * `pitch` is canonical: the three links carry the three pitch values, red,
   * yellow and blue. `docs/DESIGN.md` rations colour to data and reserves the
   * pitch palette for pitch — and this is the one sanctioned exception,
   * argued there: the mark is not a card, so its links are not a pitch
   * *value*. They are the three-value system itself, spent once, as identity.
   *
   * `ink` is the alternate for surfaces that cannot take three colours — and
   * it is the more legible of the two when small, which is worth knowing
   * before choosing.
   */
  variant?: "pitch" | "ink";
  /**
   * Accessible name. The product's name is the right default for a logo, and
   * it cannot be emptied — a blank falls back rather than through. To
   * suppress the name, say so with `decorative`.
   */
  title?: string;
  /**
   * Render the mark as pure decoration: `aria-hidden`, with no role, no name
   * and no `<title>` child. For the one case where the name is already on the
   * page — the mark beside a visible "Optfall" wordmark, where announcing it
   * twice is noise rather than information.
   */
  decorative?: boolean;
}

const {
  size = "md",
  variant = "pitch",
  title = "Optfall",
  decorative = false,
}: Props = $props();

/** A blank name is a missing name, and a logo's name is never missing. */
const name = $derived(title?.trim() || "Optfall");

/**
 * `aria-labelledby` rather than a bare `<title>`, because a `<title>` child
 * is mapped to the accessible name inconsistently across engines while this
 * association is not. The id is generated per instance, so a page carrying
 * the mark twice — header and footer — does not emit a duplicate id.
 */
const titleId = $props.id();

/**
 * Clip ids have to be unique per instance for the same reason.
 *
 * A page rendering the mark twice would otherwise emit two `clipPath`s with
 * one id, and every reference resolves to the first — so the second mark's
 * scopes would clip against the first's rectangles. On a page where both are
 * the same size that is invisible; at two different sizes it is a mark with
 * its interlock silently inside out.
 */
const scopeId = (index: number): string => `${titleId}-scope-${index}`;
</script>

<svg
  class="mark {size}"
  data-variant={variant}
  viewBox={MARK_GEOMETRY.viewBox}
  role={decorative ? undefined : "img"}
  aria-hidden={decorative ? "true" : undefined}
  aria-labelledby={decorative ? undefined : titleId}
  focusable="false"
>
  {#if !decorative}
    <title id={titleId}>{name}</title>
  {/if}

  <defs>
    {#each MARK_GEOMETRY.scopes as scope, index (index)}
      <clipPath id={scopeId(index)}>
        <rect x={scope.x} y={scope.y} width={scope.width} height={scope.height} />
      </clipPath>
    {/each}
  </defs>

  <!-- Every link, left to right. This settles the LOWER crossing of each pair:
       the right-hand link is drawn later, so it lies over its neighbour. -->
  {#each MARK_GEOMETRY.placements as placement, index (index)}
    <g transform={placement}>
      <path class="link" data-link={index} d={MARK_GEOMETRY.link} fill-rule="evenodd" />
    </g>
  {/each}

  <!-- And the UPPER crossing of each pair, by redrawing the left-hand link
       inside a rectangle that contains only that crossing. Same path, same
       transform, same fill — the only thing added is where it is allowed to
       appear. -->
  {#each MARK_GEOMETRY.scopes as scope, index (index)}
    <g clip-path="url(#{scopeId(index)})">
      <g transform={MARK_GEOMETRY.placements[scope.link]}>
        <path class="link" data-link={scope.link} d={MARK_GEOMETRY.link} fill-rule="evenodd" />
      </g>
    </g>
  {/each}
</svg>

<style>
  .mark {
    display: inline-block;

    /* Height is set and width follows from the viewBox — see the note at the
       top of this file for why both would be one number too many. */
    block-size: var(--of-ornament-mark-base);
    inline-size: auto;

    /* Struck, not printed: a light top edge and a dark bottom one, carried on
       the alpha silhouette so the bevel needs no extra geometry. */
    filter: drop-shadow(0 calc(-1 * var(--of-bevel-width)) 0 var(--of-bevel-light))
      drop-shadow(0 var(--of-bevel-width) 0 var(--of-bevel-dark));

    /* An SVG root clips at its viewBox by default, which would shear the bevel
       off the top and bottom edges. */
    overflow: visible;
  }

  .sm {
    block-size: var(--of-ornament-mark-small);
  }

  .lg {
    block-size: var(--of-ornament-mark-large);
  }

  /*
    THE CANONICAL FILL IS THE PITCH PALETTE, one link per value, in order. It is
    the one place this system spends pitch colour on something that is not a
    pitch value — argued in `docs/DESIGN.md`, and the argument is that the mark
    is not a card: the links are the three-value system itself rather than any
    one of its values.
  */
  .mark[data-variant="pitch"] .link[data-link="0"] {
    fill: var(--of-color-pitch-one);
  }

  .mark[data-variant="pitch"] .link[data-link="1"] {
    fill: var(--of-color-pitch-two);
  }

  .mark[data-variant="pitch"] .link[data-link="2"] {
    fill: var(--of-color-pitch-three);
  }

  /*
    The alternate: ink on the outside, blood in the middle. Blood is chrome in
    this system and a logo is chrome, so the accent is spent on exactly one
    link — and the outer two inherit, so the mark takes the ink of whatever it
    is locked up with rather than asserting its own.
  */
  .mark[data-variant="ink"] .link {
    fill: currentColor;
  }

  .mark[data-variant="ink"] .link[data-link="1"] {
    fill: var(--of-color-accent);
  }

  /*
    Forced colours: the palette is replaced wholesale, so the mark collapses to
    a single system ink. It still reads, because the interlock — not the colour
    — is what says "chain".

    THE SELECTORS HERE MATCH THE VARIANT RULES ABOVE, AND THEY HAVE TO. The
    first version of this was `.mark .link` (0-2-0), which the variant rules
    beat at 0-4-0 — so in Windows High Contrast the mark kept its pitch blues
    against a forced background and the collapse this block exists to perform
    never happened. The rules it replaced were the same specificity as the
    override and lost only to source order, so the attribute selectors turned a
    working guarantee into a dead one. Written out per variant rather than
    hoisted behind `:where()`, because the point is to be no less specific than
    what it is overriding and that is easier to check than to reason about.
  */
  @media (forced-colors: active) {
    .mark[data-variant="pitch"] .link[data-link="0"],
    .mark[data-variant="pitch"] .link[data-link="1"],
    .mark[data-variant="pitch"] .link[data-link="2"],
    .mark[data-variant="ink"] .link,
    .mark[data-variant="ink"] .link[data-link="1"] {
      fill: CanvasText;
    }

    .mark {
      filter: none;
    }
  }

  /* Honour a reduced-motion preference by never introducing motion here at
     all; the mark is static by design. Declared so the intent is explicit
     rather than accidental. */
  @media (prefers-reduced-motion: reduce) {
    .mark {
      transition: none;
    }
  }
</style>
