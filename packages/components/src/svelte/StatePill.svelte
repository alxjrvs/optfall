<script lang="ts">
  /**
   * The notched state pill — legality, verification, and anything else a card
   * or ruling *is* right now.
   *
   * Conventions follow `PitchJewel.svelte`, the reference primitive: runes,
   * tokens-only styles, square corners, a light top edge and a dark bottom one.
   * Three things are specific to this component and each is deliberate.
   *
   * **The notch is the system's only ornament, and it is load-bearing.**
   * `docs/DESIGN.md`: "Notched corners mark anything carrying state. The
   * clipped corner is the only ornament in the system and it always means
   * something." So exactly one corner is clipped — the inline-end top one, cut
   * across the *light* bevel edge, because that is the edge the eye catches
   * first and the ornament exists to be noticed. A second notch would make it
   * decoration; a rounded corner would make it a button. Neither is available
   * here, and `--of-bevel-radius` is zero precisely so a component that asks
   * for a radius is answered with none.
   *
   * **THE LABEL IS THE STATE, NOT A CAPTION FOR IT.** This is the same argument
   * the pitch jewel makes about its numeral, applied to a set of eight fills
   * that includes green-versus-red (`legal`/`banned`) and two browns a whole
   * grade apart in consequence (`suspended`/`unverified`). Text always renders,
   * at full length, never truncated, never ellipsed, never swapped for an
   * icon-only variant — because that variant would be the one that fails the
   * people this design exists to serve. Colour and the notch are the redundant
   * channels. It follows that **`label` must name the state** (`"Banned"`, not
   * `"Blitz"`); a caller who labels a pill with something other than the state
   * it carries has made colour the sole carrier again, and no styling here can
   * undo that.
   *
   * **The accessible name cannot be forgotten because it cannot be absent.**
   * `StatePillProps` makes `label` required and it renders as real text, so the
   * accessible name *is* the visible name — one string, selectable and
   * copyable, with no `aria-label` shadowing it and no chance of the two
   * drifting apart. Nothing here is interactive, announces itself, or updates
   * in place, so the element is a plain `<span>`: no `role="img"` (which would
   * hide the text it is meant to describe), no `role="status"` (which would
   * make a static verdict shout every time a list re-renders).
   *
   * REQUIRED IS NOT THE SAME AS NON-EMPTY, WHICH IS WHY {@link FALLBACK} EXISTS.
   * `label: string` makes the prop mandatory, and `<StatePill tone="banned"
   * label="" />` still type-checks — rendering a coloured chip with no text
   * node at all, which is precisely the "colour and the notch are the sole
   * carriers" failure the paragraph above stakes the component on preventing.
   * A required prop a caller can satisfy incorrectly is a convention, not a
   * contract, so the empty case is made unrepresentable *at render time*: the
   * trimmed label wins whenever there is one, and the tone's own name is
   * spoken when there is not. Every real call keeps the caller's wording; the
   * only calls this changes are the ones that were broken.
   */
  import type { StateTone } from "optfall-theme";

  interface Props {
    /** Which state this carries. Selects the fill and its matching ink. */
    tone: StateTone;
    /**
     * Label text, supplied by the caller and never composed here — the corpus
     * owns the wording of a verdict. Must name the state; see above.
     */
    label: string;
  }

  const { tone, label }: Props = $props();

  /**
   * The state spoken in full, one entry per `StateTone`. Not a wording the
   * corpus is expected to use — it is the floor under a caller who passed
   * nothing, so that "no label" degrades to a correct-if-plain verdict rather
   * than to an empty swatch. `Record<StateTone, string>` means a tone added to
   * the union fails the build here rather than shipping a blank chip.
   */
  const FALLBACK: Record<StateTone, string> = {
    legal: "Legal",
    banned: "Banned",
    suspended: "Suspended",
    restricted: "Restricted",
    "living-legend": "Living Legend",
    "not-in-format": "Not in format",
    verified: "Verified",
    unverified: "Unverified",
  };

  /**
   * Trimmed so stray whitespace cannot pad the accessible name, and `?.` so a
   * JavaScript caller passing nothing gets the fallback rather than a
   * `TypeError`. The `?.trim() ||` idiom is `PitchJewel.svelte`'s; it is the
   * house spelling for "a default that cannot be displaced by a blank".
   */
  const spoken = $derived(label?.trim() || FALLBACK[tone] || tone);
</script>

<span class="pill tone-{tone}" data-tone={tone}>{spoken}</span>

<style>
  .pill {
    /* One corner, clipped. The size is a token because the notch means the
       same thing everywhere it appears, and a component free to pick its own
       depth would erode that. */
    --notch: var(--of-ornament-notch-size);
    /* Clip geometry is physical, so the inline-end corner is named once here
       and mirrored under `:dir(rtl)` below rather than being hard-coded right.
       Where `:dir()` is unsupported the pill keeps its LTR notch — still one
       corner, still meaning the same thing. */
    --notch-near: 0%;
    --notch-far: 100%;

    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    padding-block: var(--of-space-tighter);
    padding-inline: var(--of-space-tight);

    clip-path: polygon(
      var(--notch-near) 0%,
      calc(var(--notch-far) - var(--notch)) 0%,
      var(--notch-far) var(--notch),
      var(--notch-far) 100%,
      var(--notch-near) 100%
    );
    /* Square corners are a system rule, so the rule is stated rather than
       relied upon: the token exists only to be zero. */
    border-radius: var(--of-bevel-radius);

    background: var(--fill);
    color: var(--ink);

    /* Struck plate: light top edge, dark bottom edge. The clip cuts across
       both, which is what makes the notch read as a chamfer taken out of metal
       rather than as a triangle drawn on top of it. */
    box-shadow:
      inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light),
      inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark);
  }

  .pill:dir(rtl) {
    --notch-near: 100%;
    --notch-far: 0%;
  }

  /* The mono voice: if it is monospaced in this system, you can paste it into
     an argument. Wide tracking is what separates a label from code. */
  .pill {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    font-weight: var(--of-type-weight-medium);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-mono);
    text-transform: uppercase;

    /* Deliberately absent: `overflow: hidden`, `text-overflow: ellipsis`, and
       any `max-inline-size`. A clipped verdict is a wrong verdict, and this is
       the channel that has to survive when colour does not. A long label wraps
       — ugly beats unreadable — and `anywhere` keeps a single long token
       inside its container instead of pushing out under an ancestor that does
       clip. */
    overflow-wrap: anywhere;
  }

  /* Every tone carries its own ink rather than sharing one, so each fill is
     free to sit where its meaning wants it — which is how `verified` gets to
     be brass instead of being dragged into a common luminance band and landing
     on muddy brown. */
  .tone-legal {
    --fill: var(--of-color-state-legal);
    --ink: var(--of-color-state-legal-ink);
  }

  .tone-banned {
    --fill: var(--of-color-state-banned);
    --ink: var(--of-color-state-banned-ink);
  }

  .tone-suspended {
    --fill: var(--of-color-state-suspended);
    --ink: var(--of-color-state-suspended-ink);
  }

  .tone-restricted {
    --fill: var(--of-color-state-restricted);
    --ink: var(--of-color-state-restricted-ink);
  }

  .tone-living-legend {
    --fill: var(--of-color-state-living-legend);
    --ink: var(--of-color-state-living-legend-ink);
  }

  .tone-not-in-format {
    --fill: var(--of-color-state-not-in-format);
    --ink: var(--of-color-state-not-in-format-ink);
  }

  .tone-verified {
    --fill: var(--of-color-state-verified);
    --ink: var(--of-color-state-verified-ink);
  }

  .tone-unverified {
    --fill: var(--of-color-state-unverified);
    --ink: var(--of-color-state-unverified-ink);
  }

  /* Forced-colours mode discards the fill and the bevel, which is the design
     working rather than failing: the label and the notch are what remain, and
     between them they still say both "this carries state" and which one. */

  /* No motion here at all — a verdict does not animate into place. Declared so
     the absence is intent rather than oversight. */
  @media (prefers-reduced-motion: reduce) {
    .pill {
      transition: none;
    }
  }
</style>
