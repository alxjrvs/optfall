<script lang="ts">
/**
 * The pitch jewel — an eight-sided cut stone carrying its numeral.
 *
 * This is the reference component for the library. Every convention here is
 * deliberate and every other primitive follows it:
 *
 * - **Styles name tokens and nothing else.** Not one literal colour or
 *   length. `scripts/check-tokens.ts` fails the build otherwise, and the
 *   `tokens` CI job is in the aggregate gate.
 * - **Square corners, bevelled surfaces.** Light top edge, dark bottom edge,
 *   so a plate reads as struck metal rather than as a rectangle.
 * - **The accessible name is a prop with a sensible default**, never absent
 *   — and "absent" includes `""`. See `spoken` below: the guard is
 *   `label?.trim() ||`, never `label ??`, because `??` falls through on
 *   `null`/`undefined` only, so `label=""` type-checks and silently strips
 *   the name off a `role="img"` whose only text node is `aria-hidden`. Every
 *   other primitive uses this same idiom; copy it verbatim.
 *
 * HOW A SURFACE GETS ITS BEVEL. "A light top edge and a dark bottom edge on
 * every plate" is a system rule, and the mechanism is chosen by geometry, not
 * by taste. There are exactly four sanctioned spellings and this is the list:
 *
 * 1. **Clipped surface with a FLAT top and bottom** (`StatePill`) — an
 *    *inset* `box-shadow` pair. A border cannot follow a `clip-path`; an
 *    inset shadow is clipped by the same polygon, so the bevel takes the
 *    chamfer with it. The flatness is the precondition, not a description:
 *    the band runs along the top of the *box*, so it only lands on an edge
 *    where the shape has one there.
 * 2. **Bordered plate** (`BevelledPlate`, `BrassSeal`, `Citation`) —
 *    `border-block-start-color` / `border-block-end-color`. The plate already
 *    pays for a border; the bevel is then free, and `BevelledPlate` adds an
 *    inset ring on top only to model *depth*, which is a separate axis.
 * 3. **Alpha silhouette** (`Mark`, and THIS JEWEL) — a paired `drop-shadow()`
 *    filter, the only spelling that traces an arbitrary outline. The mark has
 *    no box to put a border on; the jewel is a vertex-up diamond, which has
 *    no flat top for spelling (1) to sit on. It moved here when the shape
 *    changed, which is this list's own rule working: the mechanism follows
 *    the geometry. Note the filter must be declared on a PARENT of the
 *    clipped element — see the style block — because `filter` is applied
 *    before `clip-path` on the same element.
 * 4. **Hairline** (`OrnamentalRule`) — an *outset* zero-blur `box-shadow`
 *    pair. The special case, and the reason it is one: a rule must stay
 *    exactly one hairline of layout, and borders would make it three.
 *
 * `docs/DESIGN.md`: shape, number and colour state the same fact three
 * times, and the silhouette is reserved — nothing else in the interface is
 * ever this shape, which is what lets pitch and the blood accent share a hue
 * without ever being confused.
 *
 * THE NUMERAL IS THE PRIMARY CHANNEL, not an accessibility fallback. Red and
 * yellow are the classic deuteranopia confusion pair, pitch is the most-read
 * value on a card, and it is the same pair the leading commercial scanner
 * app misreads. So the numeral is always rendered, at every size — there is
 * no compact variant that drops it, because that variant would be the one
 * that breaks for the people this design exists to serve.
 */
import type { PitchValue } from "optfall-theme";

interface Props {
  /** 1, 2 or 3 — or 0 for a card with no pitch value at all. */
  value: PitchValue;
  size?: "sm" | "md" | "lg";
  /** Accessible name. Defaults to the pitch value spoken in full. */
  label?: string;
}

const { value, size = "md", label }: Props = $props();

/**
 * `?.trim() ||`, not `??`. A default that only fires on `undefined` is a
 * default a caller can displace with `""` or `"   "` — and here that would
 * leave `aria-label=""` on a `role="img"` whose only text node is
 * `aria-hidden`, i.e. an unnamed image whose meaning is carried by fill
 * colour alone. `||` falls through on the empty string and `.trim()` catches
 * whitespace, so the computed name cannot be erased, only replaced.
 */
const spoken = $derived(
  label?.trim() || (value === 0 ? "No pitch value" : `Pitch ${value}`),
);

/** Rendered glyph. Zero is an absence, and reads as one. */
const glyph = $derived(value === 0 ? "–" : String(value));

const tone = $derived(
  (["none", "one", "two", "three"] as const)[value] ?? "none",
);
</script>

<span
  class="jewel {size} tone-{tone}"
  role="img"
  aria-label={spoken}
  data-pitch={value}
>
  <!-- The stone is its own element so the bevel can be a filter on the parent.
       `filter` is applied before `clip-path` on the same element, so a
       drop-shadow declared beside the clip is clipped away by it; on the parent
       it traces the child's already-clipped alpha instead. See the style block. -->
  <span class="stone">
    <span class="glyph" aria-hidden="true">{glyph}</span>
  </span>
</span>

<style>
  .jewel {
    /*
      THE RESERVED SILHOUETTE: the pitch diamond. Vertex up, vertex down,
      widest across the middle, with all four corners cut — eight sides, and a
      stone rather than a button.

      IT USED TO BE EDGE-UP, a chamfered square with `--cut: 30%`, and that was
      drift rather than a decision: `scripts/build-design-system.ts` drew the
      diamond, this drew the square, and `docs/DESIGN.md` said only "an
      eight-sided cut stone" — true of both, so nothing ever failed while the
      published design-system cards advertised a shape the product did not
      render. Orientation is the whole of the difference and it is what makes
      the shape read as a gem at a glance, before the numeral is legible.

      The polygon is a TOKEN rather than a literal here, which is the same rule
      every colour and length in this file already follows and the one that
      would have prevented the drift outright: `scripts/check-tokens.ts` fails
      the build on a `var(--of-*)` the theme does not define, so the shape
      cannot be redrawn in one surface and not the other. `GameSymbol.svelte`
      takes `--of-ornament-cut-crown` the same way.
    */
    position: relative;
    display: inline-flex;
    inline-size: var(--of-ornament-jewel-base);
    block-size: var(--of-ornament-jewel-base);

    /* Struck, not printed: a light top edge and a dark bottom one, exactly as
       every plate in the system carries.

       THE MECHANISM CHANGED WITH THE SHAPE, which is this file's own rule —
       "the mechanism is chosen by geometry, not by taste". It was spelling (1),
       an inset `box-shadow` pair, and that is correct for an EDGE-UP octagon,
       where a hairline band along the top of the box lands on a full-width flat
       edge. On the diamond there is no flat top: that band meets the polygon
       only in a sliver a few units wide at the apex, so the bevel degenerated
       into a glint on the one component every other primitive is supposed to
       follow.

       (Written without a digit-and-unit anywhere, deliberately: this is a
       `<style>` block, and `scripts/check-tokens.ts` reads prose inside one as
       CSS. Describing a literal is how you accidentally commit one.)

       So the jewel now takes spelling (3), the paired `drop-shadow()` filter
       that `Mark` uses — the only one of the four that traces an arbitrary
       alpha silhouette, which is what the diamond's four diagonal edges need.

       It has to sit on the PARENT. `filter` is applied before `clip-path` on
       the same element, so a drop-shadow declared next to the clip is drawn and
       then clipped away by it; on the parent it traces the child's
       already-clipped shape. That is what the extra span in the markup buys,
       and it is the whole reason for it. */
    filter: drop-shadow(0 calc(-1 * var(--of-bevel-width)) 0 var(--of-bevel-light))
      drop-shadow(0 var(--of-bevel-width) 0 var(--of-bevel-dark));

    user-select: none;
  }

  /* The stone itself: the reserved silhouette, filled, carrying the numeral. */
  .stone {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: 100%;
    block-size: 100%;
    clip-path: var(--of-ornament-cut-jewel);
    background: var(--stone);
    color: var(--ink);
  }

  .sm {
    inline-size: var(--of-ornament-jewel-small);
    block-size: var(--of-ornament-jewel-small);
  }

  .lg {
    inline-size: var(--of-ornament-jewel-large);
    block-size: var(--of-ornament-jewel-large);
  }

  /* The facet highlight. A cut stone catches light on its crown, which is what
     separates it from a coloured hexagon — and the reason the shape reads as a
     jewel at a glance, before the numeral is legible.

     THE CROWN STOPS ABOVE THE GLYPH, AND THAT IS A CONTRAST FIX RATHER THAN A
     TASTE ONE. The numeral paints above this overlay, but the overlay lightens
     the stone BEHIND it, so a white wash reaching the cap-height line reduces
     the very channel `docs/DESIGN.md` calls primary. At 50% block-size and
     0.22 the residual alpha under the top of the glyph was ~8.5%, which takes
     pitch three from 4.66:1 to ~4.00:1 in dark mode — a 1.4.3 failure — and
     pitch one from 5.53:1 to ~4.91:1. A third of the block size ends the
     gradient at the cap line at every one of the three sizes, so the numeral
     sits on undiluted stone; the lower opacity is headroom, since pitch three
     clears the threshold by only 0.16 before any overlay at all. The crown
     highlight survives both changes, which is the point. */
  /* On the stone rather than the jewel, so the highlight is clipped by the
     silhouette that now lives there. On a diamond the band is cut to a triangle
     by the two upper edges, which is what a crown facet actually looks like. */
  .stone::before {
    content: "";
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    block-size: 33%;
    background: linear-gradient(
      var(--of-color-pitch-facet) 0%,
      transparent 100%
    );
    opacity: 0.14;
    pointer-events: none;
  }

  .glyph {
    position: relative;
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-small);
    font-weight: var(--of-type-weight-bold);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-normal);
  }

  .lg .glyph {
    font-size: var(--of-type-size-large);
  }

  .sm .glyph {
    font-size: var(--of-type-size-micro);
  }

  .tone-none {
    --stone: var(--of-color-pitch-none);
    --ink: var(--of-color-pitch-none-ink);
  }

  .tone-one {
    --stone: var(--of-color-pitch-one);
    --ink: var(--of-color-pitch-one-ink);
  }

  .tone-two {
    --stone: var(--of-color-pitch-two);
    --ink: var(--of-color-pitch-two-ink);
  }

  .tone-three {
    --stone: var(--of-color-pitch-three);
    --ink: var(--of-color-pitch-three-ink);
  }

  /* Honour a reduced-motion preference by never introducing motion here at
     all; the jewel is static by design. Declared so the intent is explicit
     rather than accidental. */
  @media (prefers-reduced-motion: reduce) {
    .jewel {
      transition: none;
    }
  }
</style>
