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
   * 1. **Clipped or filled surface** (this jewel, `StatePill`) — an *inset*
   *    `box-shadow` pair. A border cannot follow a `clip-path`; an inset shadow
   *    is clipped by the same polygon, so the bevel takes the chamfer with it.
   * 2. **Bordered plate** (`BevelledPlate`, `BrassSeal`, `Citation`) —
   *    `border-block-start-color` / `border-block-end-color`. The plate already
   *    pays for a border; the bevel is then free, and `BevelledPlate` adds an
   *    inset ring on top only to model *depth*, which is a separate axis.
   * 3. **Alpha silhouette** (`Mark`) — a paired `drop-shadow()` filter. The
   *    mark has no box to put a border on; the filter follows the glyph.
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
  <span class="glyph" aria-hidden="true">{glyph}</span>
</span>

<style>
  .jewel {
    /* The reserved silhouette: a regular octagon, cut rather than rounded. */
    --cut: 30%;

    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    inline-size: var(--of-ornament-jewel-base);
    block-size: var(--of-ornament-jewel-base);
    clip-path: polygon(
      var(--cut) 0%,
      calc(100% - var(--cut)) 0%,
      100% var(--cut),
      100% calc(100% - var(--cut)),
      calc(100% - var(--cut)) 100%,
      var(--cut) 100%,
      0% calc(100% - var(--cut)),
      0% var(--cut)
    );
    background: var(--stone);
    color: var(--ink);

    /* Struck, not printed: light top edge, dark bottom edge, exactly as every
       plate in the system carries. Inset rather than bordered because a border
       cannot follow a `clip-path` — the shadow is clipped by the same polygon,
       so the bevel takes the chamfers with it instead of drawing a ninth and
       tenth side across them. This is spelling (1) in the list above. */
    box-shadow:
      inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light),
      inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark);

    user-select: none;
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
  .jewel::before {
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
    font-family: var(--of-type-family-mono);
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
