<script lang="ts">
/**
 * The struck plate — the substrate every other primitive sits on.
 *
 * `docs/DESIGN.md`: "Everything is bevelled, nothing is rounded. A light top
 * edge and a dark bottom edge on every plate, so surfaces read as struck
 * metal." That sentence is the entire component. Density without clutter
 * means the separation between one region and the next is carried by a
 * hairline and a bevel rather than by a shadow, a radius and 24px of padding
 * — so this plate is the thing that replaces the card, and it has to be
 * cheap enough to nest without the page turning into a stack of boxes.
 *
 * Conventions inherited from `PitchJewel.svelte`, the reference component:
 *
 * - **Styles name tokens and nothing else.** Not one literal colour or
 *   length; `scripts/check-tokens.ts` fails the build otherwise. Every local
 *   `--plate-*` property below is composed from `var(--of-*)`.
 * - **Square corners.** `border-radius` is stated rather than omitted, and it
 *   resolves to `bevel.radius`, which exists only to be zero. Saying it out
 *   loud is what stops a host stylesheet rounding the substrate of the whole
 *   interface.
 * - **Logical properties throughout**, so the bevel's "top" stays the top and
 *   the inline edges follow writing direction.
 *
 * WHY THERE IS NO `label` PROP. The jewel is an image with a meaning, so its
 * accessible name is a prop with a default. A plate is the opposite: it is
 * chrome, it carries no information, and `emphasis` is a material property
 * rather than a state. So it renders a plain `<div>` with no role and no
 * name — the correct accessible rendering for a generic container is to be
 * invisible to assistive technology and let the semantics come from the
 * content inside it. A landmark, heading or list belongs in `children`; a
 * `role` invented here would be a name nobody asked for on every panel in the
 * product. Colour is likewise never the sole carrier of meaning here for the
 * simplest possible reason: nothing about `emphasis` is meaning. It is depth,
 * and depth is decoration.
 *
 * THE ORNAMENT HOOK. Filigree earns exactly three roles and `panel-corner` is
 * one of them — "never on a control, never on a list, never twice on one
 * screen". `ornament="panel-corner"` therefore does not draw scrollwork
 * itself; it opens four correctly-placed, ornament-sized slots
 * (`.of-panel-corner`) and renders the `corner` snippet into each, passing
 * which corner it is. The caller composes `FiligreeCorner` in, which keeps
 * the ornament rationed by the call site that can see the whole screen rather
 * than by a plate that can only see itself.
 *
 * **THE PLATE OWNS PLACEMENT AND SIZE; THE ORNAMENT OWNS THE DRAWING.** That
 * split is the contract, it is recorded in `FiligreeProps` in
 * `packages/components/src/index.ts`, and it is the reason the id passed to
 * the snippet has somewhere to go:
 *
 * ```svelte
 * <BevelledPlate ornament="panel-corner">
 *   {#snippet corner(id)}
 *     <FiligreeCorner role="panel-corner" corner={id} />
 *   {/snippet}
 * </BevelledPlate>
 * ```
 *
 * `PlateCorner` is imported from the contract layer rather than declared here
 * so that these four ids and `FiligreeCorner`'s four mirrorings agree by
 * construction instead of by coincidence.
 */
import type { Snippet } from "svelte";
import type { BevelEdge } from "optfall-theme";
import type { PlateCorner } from "../index";

interface Props {
  /** Depth of the strike. `raised` and `sunken` invert each other's bevel. */
  emphasis?: "flat" | "raised" | "sunken";
  /** Which edges carry the bevel highlight. Defaults to both. */
  edges?: readonly BevelEdge[];
  /** Feature panels may carry filigree at their corners; nothing else may. */
  ornament?: "panel-corner";
  /** Plate contents. The semantics of the region live in here, not out here. */
  children?: Snippet;
  /**
   * Rendered once per corner when `ornament="panel-corner"`, receiving the
   * corner id. Intended for `FiligreeCorner role="panel-corner"`.
   */
  corner?: Snippet<[PlateCorner]>;
}

const {
  emphasis = "flat",
  edges = ["top", "bottom"],
  ornament,
  children,
  corner,
}: Props = $props();

const CORNERS: readonly PlateCorner[] = [
  "start-start",
  "start-end",
  "end-start",
  "end-end",
];

/**
 * An edge left out of `edges` does not lose its border — it falls back to the
 * hairline rule. A plate with no boundary at all is a div, and the system
 * separates regions with rules rather than with whitespace.
 */
const bevelsBlockStart = $derived(edges.includes("top"));
const bevelsBlockEnd = $derived(edges.includes("bottom"));
</script>

<div
  class="plate {emphasis}"
  class:bevel-block-start={bevelsBlockStart}
  class:bevel-block-end={bevelsBlockEnd}
  class:ornamented={ornament === "panel-corner"}
  data-emphasis={emphasis}
  data-ornament={ornament}
>
  {@render children?.()}

  {#if ornament === "panel-corner"}
    {#each CORNERS as id (id)}
      <span class="of-panel-corner" data-corner={id} aria-hidden="true">
        {@render corner?.(id)}
      </span>
    {/each}
  {/if}
</div>

<style>
  .plate {
    /* Both edges start as the hairline rule; `edges` promotes one or both to
       the bevel. Depth is a separate axis, set by the emphasis classes. */
    --plate-edge-block-start: var(--of-color-rule);
    --plate-edge-block-end: var(--of-color-rule);
    --plate-pad: var(--of-space-loose);

    position: relative;
    display: block;
    box-sizing: border-box;
    padding: var(--plate-pad);
    border-style: solid;
    border-width: var(--of-bevel-width);
    /* Stated, not omitted. The token exists only to be zero. */
    border-radius: var(--of-bevel-radius);
    border-block-start-color: var(--plate-edge-block-start);
    border-block-end-color: var(--plate-edge-block-end);
    border-inline-color: var(--of-color-rule);
    background: var(--plate-face);
    color: var(--of-color-ink);
    box-shadow: var(--plate-depth);
  }

  /* Flat is the default substrate: surface tone, and the bevel is exactly one
     hairline deep. No inner ring, so nesting a flat plate inside a flat plate
     costs a single rule rather than a visible step. */
  .flat {
    --plate-face: var(--of-color-surface);
    --plate-bevel-block-start: var(--of-bevel-light);
    --plate-bevel-block-end: var(--of-bevel-dark);
    --plate-depth: none;
  }

  /* Raised: lit from above, which is where light comes from. The inner ring is
     what separates it from flat — the edge is modelled rather than merely
     coloured, so the plate reads as proud of the ground at a glance and does
     not depend on the tone difference alone. */
  .raised {
    --plate-face: var(--of-color-surface-raised);
    --plate-bevel-block-start: var(--of-bevel-light);
    --plate-bevel-block-end: var(--of-bevel-dark);
    --plate-depth:
      inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light),
      inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark);
  }

  /* Sunken is raised with the light source unchanged and the surface below the
     ground: the shadow falls on the near edge and the far edge catches the
     light. Inverting the bevel is the whole of it — the face darkens to
     `color.sunken` to agree with the geometry, never to replace it. */
  .sunken {
    --plate-face: var(--of-color-sunken);
    --plate-bevel-block-start: var(--of-bevel-dark);
    --plate-bevel-block-end: var(--of-bevel-light);
    --plate-depth:
      inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-dark),
      inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-light);
  }

  /* Declared after `.plate` so equal specificity resolves in favour of the
     opt-in. An omitted edge keeps the hairline set above. */
  .bevel-block-start {
    --plate-edge-block-start: var(--plate-bevel-block-start);
  }

  .bevel-block-end {
    --plate-edge-block-end: var(--plate-bevel-block-end);
  }

  /* Filigree sits inside the padding box, so the padding has to clear it —
     otherwise the first line of a feature panel collides with its own
     scrollwork. `space.loosest` is the smallest step that clears a panel
     corner at the emphatic size set below. */
  .ornamented {
    --plate-pad: var(--of-space-loosest);
  }

  /* The hook. Positioned AND sized here; drawn by whatever the caller renders
     into the `corner` snippet, because rationing filigree is the call site's
     job and placing it is the frame's. `aria-hidden` is on the markup:
     ornament is never content.

     A feature panel is the one place in the system allowed to be emphatic, so
     its corners are two steps of the ornament token where a card frame takes
     one. Both are computed from the token — neither is a length. Sizing the
     slot rather than the drawing is what lets `FiligreeCorner` be a pure
     drawing that fills whatever it is given. */
  .of-panel-corner {
    position: absolute;
    inline-size: calc(var(--of-ornament-filigree-size) * 2);
    block-size: calc(var(--of-ornament-filigree-size) * 2);
    color: var(--of-ornament-filigree-ink);
    pointer-events: none;
  }

  .of-panel-corner[data-corner="start-start"] {
    inset-block-start: 0;
    inset-inline-start: 0;
  }

  .of-panel-corner[data-corner="start-end"] {
    inset-block-start: 0;
    inset-inline-end: 0;
  }

  .of-panel-corner[data-corner="end-start"] {
    inset-block-end: 0;
    inset-inline-start: 0;
  }

  .of-panel-corner[data-corner="end-end"] {
    inset-block-end: 0;
    inset-inline-end: 0;
  }

  /* Honour a reduced-motion preference by never introducing motion here at
     all; the plate is static by design. Declared so the intent is explicit
     rather than accidental. */
  @media (prefers-reduced-motion: reduce) {
    .plate {
      transition: none;
    }
  }
</style>
