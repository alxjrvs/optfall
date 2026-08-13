<script lang="ts">
  /**
   * The mark — a cut jewel, cleaved and falling.
   *
   * `docs/DESIGN.md`: **the logo and the core interface primitive are the same
   * object.** This is the pitch jewel's octagon, the reserved silhouette, split
   * along a cleavage plane — so the thing on the tab is the thing you see a
   * thousand times a session, rather than two shapes that happen to coexist.
   * The geometry below is `PitchJewel.svelte`'s `clip-path` restated in SVG
   * coordinates: same eight sides, same proportion of cut to edge.
   *
   * Following `PitchJewel.svelte` in every convention — styles name tokens and
   * nothing else, square corners, a light top edge and a dark bottom one, and
   * an accessible name that is a prop with a sensible default rather than
   * something a caller can forget.
   *
   * COMPLIANCE IS WHY IT HAS THIS FORM AT ALL. LSS's policy does not merely
   * prohibit using their logos — it prohibits creating any *close semblance* to
   * them, which rules out an angular-chiselled wordmark in their idiom even
   * drawn from scratch. So this takes the register (angular, chiselled, struck
   * from metal) and nothing of the form, because it is drawn from a game
   * MECHANIC rather than from a visual identity: a jewel is a mechanic, and a
   * mechanic cannot be confused with a trademark. Nothing here is heraldic,
   * bladed or lettered, and nothing here may drift that way later.
   *
   * IT IS DRAWN AS AN SVG BECAUSE IT HAS TO SURVIVE A FAVICON — and it now
   * actually is one. `apps/site/src/pages/favicon.svg.ts` emits the tab icon at
   * build time from `MARK_GEOMETRY`, the same constant this file draws from, so
   * the claim below is enforced by there being one set of numbers rather than
   * asserted by two files agreeing. Two solids and a hairline, in that order of
   * importance:
   *
   * 1. The **gap** between crown and pavilion is the whole idea, and it is the
   *    last thing to disappear. At a 16px favicon it is still 1.5 device pixels
   *    of ground, and the two pieces are two units out of register besides — so
   *    the mark reads as *cleaved* rather than as a slotted octagon even when
   *    the cut is a single pixel wide.
   * 2. The two solids carry it at every size above that.
   * 3. The hairline along the pavilion's cut face — the exposed cleavage plane —
   *    is the first thing to go, which is the correct order.
   *
   * The accent brackets the gap: the crown and the cut face are the parts that
   * are *new*, so blood marks the break. Blood is chrome rather than data in
   * this system, and a logo is chrome — this is one of the two places boldness
   * is allowed to be spent.
   *
   * The pavilion is `currentColor` rather than a fill of its own, which is what
   * lets the forced-colours fallback at the bottom of the style block collapse
   * the whole mark onto system ink and still leave it legible: the gap survives
   * with no colour at all, and colour never carried the meaning here. It is
   * also what lets the mark take the ink of the wordmark it is set beside
   * rather than asserting its own — see the note on `color` below, which is
   * the half of that arrangement that was wrong at first.
   *
   * The displacement is deliberately physical rather than logical. A mark is
   * not mirrored in RTL — the cleave falls the same way in every writing
   * direction, so this is one of the few places `inset-inline` would be wrong.
   *
   * NAMING AND HIDING ARE TWO QUESTIONS, AND CONFLATING THEM IS HOW A LOGO
   * LOSES ITS NAME. A default parameter fires on `undefined` alone, so
   * `title=""` type-checked its way to `<title></title>` and an
   * `aria-labelledby` resolving to the empty string — an unnamed `role="img"`,
   * which is the `svg-img-alt` violation the doc line above claims is designed
   * out. Worse, `title=""` was the only spelling available to the caller who
   * legitimately wanted the mark silent: beside a visible "Optfall" wordmark
   * the name is a duplicate, and the correct rendering there is a decoration.
   * So `title` is now uncrushable (`?.trim() ||`, the idiom from
   * `PitchJewel.svelte`) and `decorative` is the supported way to say
   * "presentational" out loud. Name it or hide it — never accidentally both.
   */

  import { MARK_GEOMETRY } from "../index";

  interface Props {
    /** Rendered size, in token steps rather than pixels. */
    size?: "sm" | "md" | "lg";
    /**
     * Accessible name. The product's name is the right default for a logo, and
     * it cannot be emptied — a blank falls back rather than through. To
     * suppress the name, say so with `decorative`.
     */
    title?: string;
    /**
     * Render the mark as pure decoration: `aria-hidden`, with no role, no
     * name and no `<title>` child. For the one case where the name is already
     * on the page — the mark sitting beside a visible "Optfall" wordmark,
     * where announcing it twice is noise rather than information.
     */
    decorative?: boolean;
  }

  const { size = "md", title = "Optfall", decorative = false }: Props = $props();

  /** A blank name is a missing name, and a logo's name is never missing. */
  const name = $derived(title?.trim() || "Optfall");

  /**
   * `aria-labelledby` rather than a bare `<title>`, because a `<title>` child
   * is mapped to the accessible name inconsistently across engines while this
   * association is not. The id is generated per instance, so a page carrying
   * the mark twice — header and footer — does not emit a duplicate id.
   */
  const titleId = $props.id();
</script>

<svg
  class="mark {size}"
  viewBox={MARK_GEOMETRY.viewBox}
  role={decorative ? undefined : "img"}
  aria-hidden={decorative ? "true" : undefined}
  aria-labelledby={decorative ? undefined : titleId}
  focusable="false"
>
  {#if !decorative}
    <title id={titleId}>{name}</title>
  {/if}

  <!-- The crown: the shallow upper third of the cut, holding the top of the
       frame. Its lower edge is the cleavage plane, and it is off level — a
       crystal parts along its own lattice, not along a saw line, and that tilt
       is most of what keeps the mark from reading as a lid on a box. -->
  <polygon class="crown" points={MARK_GEOMETRY.crown} />

  <!-- The pavilion: deeper than the crown, as a cut stone's is, and fallen —
       three units clear of the plane and two out of register with it, so the
       two halves no longer line up along the edge they parted on. -->
  <polygon class="pavilion" points={MARK_GEOMETRY.pavilion} />

  <!-- The cleavage plane, freshly exposed along the pavilion's cut face.
       Geometry comes from `MARK_GEOMETRY` so the favicon draws the same stone;
       only colour comes from the style block. -->
  <line
    class="cleave"
    x1={MARK_GEOMETRY.cleave.x1}
    y1={MARK_GEOMETRY.cleave.y1}
    x2={MARK_GEOMETRY.cleave.x2}
    y2={MARK_GEOMETRY.cleave.y2}
    stroke-width={MARK_GEOMETRY.cleave.width}
  />
</svg>

<style>
  .mark {
    display: inline-block;
    inline-size: var(--of-ornament-jewel-base);
    block-size: var(--of-ornament-jewel-base);

    /* THE PAVILION TAKES THE INK OF WHATEVER THE MARK IS LOCKED UP WITH.
       This was `var(--of-color-ink)`, which reads as a harmless default and is
       not one: an element's own `color` beats an inherited one, so the mark
       ignored its surroundings. In the header bar — where the wordmark is
       deliberately quiet, at `--of-color-ink-muted` — that put a full-ink stone
       beside a muted word and left the mark unchanged on hover, so the lockup
       lit up in halves. Inheriting is what makes it one object.

       Nothing is lost by dropping the token, but that holds only because the
       surfaces that render this component spend it on the document —
       `BaseLayout.astro`, `.storybook/preview.ts` and the a11y harness all set
       `--of-color-ink` on `body` — so a mark standing on its own resolves to
       exactly the value this line used to name. A surface that sets no `color`
       at all gets its host's text colour instead, which is what inheriting
       means and why the workbench had to stop being such a surface. */
    color: inherit;

    /* Struck, not printed: a light top edge and a dark bottom one, carried on
       the alpha silhouette so the bevel needs no extra geometry and cannot be
       mistaken for a ninth side. */
    filter: drop-shadow(0 calc(-1 * var(--of-bevel-width)) 0 var(--of-bevel-light))
      drop-shadow(0 var(--of-bevel-width) 0 var(--of-bevel-dark));

    /* An SVG root clips at its viewBox by default, which would shear the bevel
       off the top and bottom edges. */
    overflow: visible;
  }

  .sm {
    inline-size: var(--of-ornament-jewel-small);
    block-size: var(--of-ornament-jewel-small);
  }

  .lg {
    inline-size: var(--of-ornament-jewel-large);
    block-size: var(--of-ornament-jewel-large);
  }

  .crown {
    fill: var(--of-color-accent);
  }

  .pavilion {
    fill: currentColor;
  }

  .cleave {
    stroke: var(--of-color-accent);
  }

  /* Forced colours: the palette is replaced wholesale, so the mark is allowed
     to collapse to a single system ink. It still reads, because the gap — not
     the colour — is what says "cleaved". */
  @media (forced-colors: active) {
    .crown,
    .pavilion {
      fill: CanvasText;
    }

    .cleave {
      stroke: CanvasText;
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
