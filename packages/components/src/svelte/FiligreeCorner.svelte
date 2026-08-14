<script lang="ts">
/**
 * Filigree, rationed — scrollwork in one of its three sanctioned roles.
 *
 * `docs/DESIGN.md`: leaving scrollwork out made the first pass read as
 * austere Swiss rather than as Rathe, so it comes back — but it "earns a
 * place in exactly three roles: the corners of a feature panel, the corners
 * of a card frame, and a section rule. Never on a control, never on a list,
 * never twice on one screen." The `OrnamentRole` union *is* that ration, and
 * this component takes nothing else: there is no `size`, no `tone`, no
 * `variant`. A prop that let a caller put filigree somewhere new would spend
 * the signal, and the signal is the whole reason it exists.
 *
 * THIS COMPONENT DRAWS SCROLLWORK AND OWNS NO LAYOUT. That sentence is the
 * contract, and it is written down because getting it wrong twice cost this
 * library two collisions with its own primitives:
 *
 * - **Placement belongs to the host.** `BevelledPlate` opens four
 *   correctly-placed corner slots and renders its `corner` snippet into each,
 *   passing the corner id. So one instance of this component is *one*
 *   ornament, told by {@link Props.corner} which corner it is drawing, and it
 *   positions nothing and sizes nothing — it fills the slot it was given.
 *   Composed the way `BevelledPlate` prescribes:
 *
 *   ```svelte
 *   <BevelledPlate ornament="panel-corner">
 *     {#snippet corner(id)}
 *       <FiligreeCorner role="panel-corner" corner={id} />
 *     {/snippet}
 *   </BevelledPlate>
 *   ```
 *
 *   An earlier version drew all four corners itself, which rendered sixteen
 *   ornaments through that snippet and stacked them inside one 1.25rem box,
 *   because its own absolute positioning resolved against the slot rather
 *   than against the plate.
 * - **The section rule belongs to `OrnamentalRule`.** In the `section-rule`
 *   role this emits a bare figure: no lines, no `role="separator"`, no
 *   vertical rhythm. `OrnamentalRule` owns the `<hr>` semantics, the two
 *   hairlines and the margins, which is what its name says. An earlier
 *   version rendered a complete rule here as well, so following
 *   `OrnamentalRule`'s own composition instructions produced four hairlines
 *   at two different weights, doubled rhythm, and a `separator` buried inside
 *   an `aria-hidden` mount where the accessibility tree discarded it.
 *
 * Conventions inherited from `PitchJewel.svelte`, the reference component:
 *
 * - **Styles name tokens and nothing else.** Not one literal colour or
 *   length; `scripts/check-tokens.ts` fails the build otherwise.
 * - **Square corners, bevelled surfaces.** Nothing here is rounded — the
 *   curves are scrollwork, which is a drawn line, not a rounded corner. Each
 *   stroke is struck: a `--of-bevel-light` pass above and a `--of-bevel-dark`
 *   pass below the ink, so the ornament reads as chiselled into the plate
 *   rather than printed onto it. A stroked path has no box to put a border
 *   on, so the bevel is drawn rather than declared — the fifth geometry in
 *   `PitchJewel.svelte`'s list of bevel mechanisms, and the only one that is
 *   a drawing instruction instead of a CSS one.
 *
 * **Drawn as inline SVG, never a font or an image.** A glyph would need a
 * webfont we have not licensed (`docs/DESIGN.md`, open questions) and would
 * inherit `font-size` rather than the ornament token; a raster would not
 * scale and could not take `currentColor`. Inline paths give us both, and
 * keep the drawing auditable in review — which matters for the compliance
 * point below.
 *
 * **THE ACCESSIBLE NAME IS DELIBERATELY ABSENT, AND THIS IS THE ONE PLACE
 * THAT IS RIGHT.** Every other primitive in this library takes a name prop
 * with a sensible default, because a name a caller can forget is a name that
 * will be forgotten. Filigree is the exception that proves it:
 * `FiligreeProps` has no label because the ornament carries no information at
 * all, and a name would make assistive technology announce pure decoration
 * four times per panel. So the svg is `aria-hidden="true"` and
 * `focusable="false"` unconditionally — not by default, unconditionally, in
 * all three roles. The caller cannot name it, which is the same discipline as
 * the caller not being able to *un*-name a pitch jewel. Nothing here is ever
 * the only carrier of anything: remove every ornament in the library and no
 * information is lost, which is what "decoration" has to mean to be honest.
 *
 * **Compliance.** `docs/DESIGN.md`: LSS's policy prohibits not merely copying
 * their marks but creating any *close semblance* to them. Every path below is
 * abstract scrollwork drawn from scratch — a volute, two crescent leaves and
 * a lozenge bead — with no reference to any Legend Story Studios logo, set
 * symbol or frame asset. It borrows the register (struck, angular, chiselled)
 * and none of the form.
 */
import type { OrnamentRole } from "optfall-theme";
import type { PlateCorner } from "../index";

interface Props {
  /**
   * Which of the three sanctioned roles this is. Required, with no default:
   * "wherever you happen to have dropped it" is not one of the three.
   */
  role: OrnamentRole;
  /**
   * Which corner of the frame this instance is drawing, in CSS logical order
   * — block axis first, then inline, exactly as `border-start-start-radius`
   * names them. It selects the mirroring of the motif and nothing else; the
   * host slot supplies the position. Ignored in the `section-rule` role.
   *
   * It defaults to `start-start` rather than being required so that the
   * single-corner case reads cleanly, but a host with four slots must pass
   * the id it already has — see `BevelledPlate`'s `corner` snippet.
   */
  corner?: PlateCorner;
}

const { role, corner = "start-start" }: Props = $props();

/* ---------------------------------------------------------------------- */
/* Geometry                                                                */
/* ---------------------------------------------------------------------- */

/*
 * All coordinates below are SVG user units inside a `viewBox`, so they are
 * proportions of the ornament rather than lengths — the rendered size comes
 * from the host slot for a corner and from `--of-ornament-filigree-size` for
 * the rule figure, and nothing here changes when either does.
 */

/** Stroked paths, drawn for the block-start/inline-start corner only. */
const PANEL_STROKES: readonly string[] = [
  /* The angular bracket. Mitred, not curved: the frame is square even where
       the ornament growing out of it is not. */
  "M 47 2 L 2 2 L 2 47",
  /* The volute — a sweep out of the corner that spirals back on itself.
       This is the shape that makes it scrollwork rather than a chevron. */
  "M 3 3 C 15.5 5.5 25.6 12.6 28.4 22.4 C 30.4 29.2 26.2 35 19.6 34.6" +
    " C 14.4 34.3 10.8 29.8 11.9 25.2 C 12.8 21.5 16.9 19.7 20 21.6",
];

/** Filled paths — crescent leaves and the lozenge at the eye of the scroll. */
const PANEL_FILLS: readonly string[] = [
  "M 6.5 3.4 C 13 8.4 20 9.6 27.4 6.6 C 21 10.2 13.6 9.4 7.6 5.2 Z",
  "M 3.4 6.5 C 8.4 13 9.6 20 6.6 27.4 C 10.2 21 9.4 13.6 5.2 7.6 Z",
  "M 20 23.6 L 22.4 26 L 20 28.4 L 17.6 26 Z",
];

/*
 * The card frame gets a lighter hand than the feature panel. Same motif,
 * fewer members and a thinner stroke: a card is one of many on a results
 * page, and filigree at panel weight around each of them would be the
 * "never on a list" failure by another route.
 */
const CARD_STROKES: readonly string[] = [
  "M 31 1.5 L 1.5 1.5 L 1.5 31",
  "M 2.5 2.5 C 10 4 15.6 8.4 17.6 14.6 C 19 19 16 22.8 12 22" +
    " C 8.8 21.4 7.2 17.8 9.2 15.4 C 10.6 13.7 13.4 13.7 14.6 15.6",
];

const CARD_FILLS: readonly string[] = [
  "M 4.6 2.6 C 9 6 13.6 6.8 18.4 4.8 C 14.2 7.2 9.2 6.6 5.2 3.8 Z",
  "M 13 16.4 L 14.8 18.2 L 13 20 L 11.2 18.2 Z",
];

/**
 * The section rule's figure, drawn as its left half and mirrored. Symmetry
 * about the centre is the point of a rule ornament, and a mirrored half
 * cannot drift out of true the way two hand-drawn halves can.
 */
const RULE_STROKES: readonly string[] = [
  "M 2 12 L 16 12",
  /* Opposed volutes, above and below the stem — the double scroll. */
  "M 16 12 C 22.6 12 26 8.4 24.2 5 C 22.7 2.2 18.7 2.4 17.6 5.4" +
    " C 16.7 7.9 18.9 10.2 21.2 9.4",
  "M 16 12 C 22.6 12 26 15.6 24.2 19 C 22.7 21.8 18.7 21.6 17.6 18.6" +
    " C 16.7 16.1 18.9 13.8 21.2 14.6",
  "M 25.6 12 L 31 12",
];

const RULE_FILLS: readonly string[] = ["M 9 9.4 L 11.6 12 L 9 14.6 L 6.4 12 Z"];

/** Drawn once, spanning the mirror line, so the centre is a single shape. */
const RULE_CENTRE = "M 36 5.6 L 40.6 12 L 36 18.4 L 31.4 12 Z";

const isRule = $derived(role === "section-rule");
const isPanel = $derived(role === "panel-corner");

const box = $derived(isPanel ? 48 : 32);
const strokes = $derived(isPanel ? PANEL_STROKES : CARD_STROKES);
const fills = $derived(isPanel ? PANEL_FILLS : CARD_FILLS);
const weight = $derived(isRule ? 1.4 : isPanel ? 1.6 : 1.3);

/**
 * The bevel offset, in user units. A light pass above and a dark pass below
 * the ink is the system's "light top edge, dark bottom edge" rule applied to
 * a line rather than to a plate.
 */
const lift = $derived(isPanel ? 1.1 : 0.8);

/** Ink last, so it sits on top of both relief passes. */
const passes = $derived([
  { tone: "relief-dark", shift: `translate(0 ${lift})` },
  { tone: "relief-light", shift: `translate(0 ${-lift})` },
  { tone: "ink", shift: "translate(0 0)" },
]);

/**
 * One motif, four placements. Mirroring rather than redrawing guarantees the
 * four corners agree, and keeps the drawing to one set of paths to audit.
 * Only the mirroring lives here — where the ornament *sits* is the host's.
 */
const MIRROR: Record<PlateCorner, string> = {
  "start-start": "translate(0 0)",
  "start-end": "scale(-1 1)",
  "end-start": "scale(1 -1)",
  "end-end": "scale(-1 -1)",
};

const facing = $derived(MIRROR[corner]);
</script>

{#if isRule}
  <!-- A bare figure. The separator role, the hairlines and the vertical rhythm
       are `OrnamentalRule`'s, because a rule is structure and this is not. -->
  <svg
    class="filigree figure"
    viewBox="0 0 72 24"
    aria-hidden="true"
    focusable="false"
    stroke-linecap="butt"
    stroke-linejoin="miter"
    stroke-width={weight}
  >
    {#each passes as pass (pass.tone)}
      <g class={pass.tone} transform={pass.shift}>
        {#each [1, -1] as half (half)}
          <g transform={half === 1 ? "translate(0 0)" : "translate(72 0) scale(-1 1)"}>
            {#each RULE_STROKES as d (d)}
              <path {d} fill="none" />
            {/each}
            {#each RULE_FILLS as d (d)}
              <path {d} stroke="none" />
            {/each}
          </g>
        {/each}
        <path d={RULE_CENTRE} stroke="none" />
      </g>
    {/each}
  </svg>
{:else}
  <!-- One corner, mirrored into place inside its own viewBox. Purely
       decorative, so it is hidden outright rather than merely unnamed. -->
  <svg
    class="filigree corner {role}"
    data-corner={corner}
    viewBox="0 0 {box} {box}"
    aria-hidden="true"
    focusable="false"
    stroke-linecap="butt"
    stroke-linejoin="miter"
    stroke-width={weight}
  >
    <!-- THE RELIEF PASS IS OUTSIDE THE MIRROR, AND THE ORDER IS THE POINT.
         Light comes from above in every corner of the frame, so the light pass
         has to sit above the ink in *screen* space. Nested the other way round,
         `end-start` and `end-end` — which mirror on the y axis — would carry
         their bevel upside down, lighting the plate from below on half the
         panel. Mirroring happens about the centre of the viewBox rather than
         about its origin, so one transform serves all four corners without a
         per-corner translate that has to be kept in step with `box`. -->
    {#each passes as pass (pass.tone)}
      <g class={pass.tone} transform={pass.shift}>
        <g transform="translate({box / 2} {box / 2}) {facing} translate({-box / 2} {-box / 2})">
          {#each strokes as d (d)}
            <path {d} fill="none" />
          {/each}
          {#each fills as d (d)}
            <path {d} stroke="none" />
          {/each}
        </g>
      </g>
    {/each}
  </svg>
{/if}

<style>
  /* The ink is inherited rather than painted per path, so a caller can retune
     the ornament with `color` alone and an adopted custom element picks up its
     host's colour. `fill` and `stroke` are inherited SVG properties, so setting
     them on the pass group is enough for every path inside it. */
  .filigree {
    color: var(--of-ornament-filigree-ink);
  }

  .ink {
    stroke: currentColor;
    fill: currentColor;
  }

  /* Light above, dark below: the same bevel the plates use, applied to a line.
     This is what stops the scrollwork reading as a decal on the surface. */
  .relief-light {
    stroke: var(--of-bevel-light);
    fill: var(--of-bevel-light);
  }

  .relief-dark {
    stroke: var(--of-bevel-dark);
    fill: var(--of-bevel-dark);
  }

  /* ---- The two corner roles ------------------------------------------- */

  /* Fills the slot it was handed and claims nothing else — no `position`, no
     `inset`, no size of its own. The host (`BevelledPlate`, or a card frame)
     places and sizes the ornament, which is the only arrangement in which the
     positioning context is the frame rather than one slot inside it.
     `overflow: visible` because the volute is drawn a little proud of its own
     viewBox, and the relief passes are offset out of it besides. */
  .corner {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }

  /* Logical insets move the host's four slots under RTL but cannot turn the
     drawing round with them, which would leave every scroll curling out of its
     own frame. Mirroring the motif as well makes the assembly whole again. */
  .corner:dir(rtl) {
    transform: scaleX(-1);
  }

  /* ---- The section rule's figure --------------------------------------- */

  /* Height from the token, width from the drawing's own proportions, so the
     ornament can never be squashed by its container. This is the one size the
     component sets, because the rule mounts it in an `auto` grid track that has
     no dimension to inherit. */
  .figure {
    display: block;
    flex: 0 0 auto;
    block-size: var(--of-ornament-filigree-size);
    inline-size: auto;
    overflow: visible;
  }

  /* A forced palette has no ink to spare for decoration, and the relief passes
     collapse onto the ink colour there anyway. What the ornament sat on — the
     plate's borders, the rule's own hairlines — is drawn elsewhere and
     survives, so nothing structural goes with it. */
  @media (forced-colors: active) {
    .filigree {
      display: none;
    }
  }

  /* Static by design. Declared so the absence of motion is a decision rather
     than an oversight, exactly as in `PitchJewel.svelte`. */
  @media (prefers-reduced-motion: reduce) {
    .filigree {
      transition: none;
    }
  }
</style>
