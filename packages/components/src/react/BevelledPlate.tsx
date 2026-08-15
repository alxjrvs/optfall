/**
 * The struck plate — the substrate every other primitive sits on. React port.
 *
 * `docs/DESIGN.md`: "Everything is bevelled, nothing is rounded. A light top
 * edge and a dark bottom edge on every plate, so surfaces read as struck
 * metal." That sentence is the entire component. Density without clutter means
 * the separation between one region and the next is carried by a hairline and
 * a bevel rather than by a shadow, a radius and 24px of padding — so this
 * plate is the thing that replaces the card, and it has to be cheap enough to
 * nest without the page turning into a stack of boxes.
 *
 * Conventions inherited from the Svelte original, all of them unchanged:
 *
 * - **Styles name tokens and nothing else.** Not one literal colour or length;
 *   `scripts/check-tokens.ts` fails the build otherwise, and it scans `.css`,
 *   so the port is held to the same rule.
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
 * rather than a state. So it renders a plain `<div>` with no role and no name —
 * the correct accessible rendering for a generic container is to be invisible
 * to assistive technology and let the semantics come from the content inside
 * it. A landmark, heading or list belongs in `children`; a `role` invented
 * here would be a name nobody asked for on every panel in the product. Colour
 * is likewise never the sole carrier of meaning here, for the simplest
 * possible reason: nothing about `emphasis` is meaning. It is depth, and depth
 * is decoration.
 *
 * THE ORNAMENT HOOK. Filigree earns exactly three roles and `panel-corner` is
 * one of them — "never on a control, never on a list, never twice on one
 * screen". `ornament="panel-corner"` therefore does not draw scrollwork
 * itself; it opens four correctly-placed, ornament-sized slots and renders the
 * `corner` function into each, passing which corner it is. The caller composes
 * `FiligreeCorner` in, which keeps the ornament rationed by the call site that
 * can see the whole screen rather than by a plate that can only see itself.
 *
 * **THE PLATE OWNS PLACEMENT AND SIZE; THE ORNAMENT OWNS THE DRAWING.** That
 * split is the contract, it is recorded in `FiligreeProps` in
 * `packages/components/src/index.ts`, and it is the reason the id passed to the
 * render prop has somewhere to go:
 *
 * ```tsx
 * <BevelledPlate
 *   ornament="panel-corner"
 *   corner={(id) => <FiligreeCorner role="panel-corner" corner={id} />}
 * />
 * ```
 *
 * `PlateCorner` is imported from the contract layer rather than declared here
 * so that these four ids and `FiligreeCorner`'s four mirrorings agree by
 * construction instead of by coincidence.
 */

import type { ReactNode } from "react";

import type { BevelEdge } from "optfall-theme";

import type { PlateCorner } from "../index";
import "./BevelledPlate.css";

export interface BevelledPlateProps {
  /** Depth of the strike. `raised` and `sunken` invert each other's bevel. */
  readonly emphasis?: "flat" | "raised" | "sunken";
  /** Which edges carry the bevel highlight. Defaults to both. */
  readonly edges?: readonly BevelEdge[];
  /** Feature panels may carry filigree at their corners; nothing else may. */
  readonly ornament?: "panel-corner";
  /** Plate contents. The semantics of the region live in here, not out here. */
  readonly children?: ReactNode;
  /**
   * Rendered once per corner when `ornament="panel-corner"`, receiving the
   * corner id. Intended for `FiligreeCorner role="panel-corner"`.
   */
  readonly corner?: (id: PlateCorner) => ReactNode;
}

const CORNERS: readonly PlateCorner[] = [
  "start-start",
  "start-end",
  "end-start",
  "end-end",
];

export function BevelledPlate({
  emphasis = "flat",
  edges = ["top", "bottom"],
  ornament,
  children,
  corner,
}: BevelledPlateProps) {
  /**
   * An edge left out of `edges` does not lose its border — it falls back to
   * the hairline rule. A plate with no boundary at all is a div, and the
   * system separates regions with rules rather than with whitespace.
   */
  const bevelBlockStart = edges.includes("top");
  const bevelBlockEnd = edges.includes("bottom");

  /*
   * CLASS NAMES ARE BUILT BY FILTERING A LIST, not by string concatenation
   * with `&&`. A falsy branch in a template literal leaves `false` or an empty
   * gap in the attribute — `class="of-plate  of-plate--flat"` — which is
   * harmless and also exactly the kind of output that makes a diff of rendered
   * HTML unreadable.
   */
  const className = [
    "of-plate",
    `of-plate--${emphasis}`,
    bevelBlockStart ? "of-plate--bevel-block-start" : null,
    bevelBlockEnd ? "of-plate--bevel-block-end" : null,
    ornament === "panel-corner" ? "of-plate--ornamented" : null,
  ]
    .filter((part) => part !== null)
    .join(" ");

  return (
    <div
      className={className}
      data-emphasis={emphasis}
      data-ornament={ornament}
    >
      {children}

      {ornament === "panel-corner"
        ? CORNERS.map((id) => (
            <span
              key={id}
              className="of-panel-corner"
              data-corner={id}
              aria-hidden="true"
            >
              {corner?.(id)}
            </span>
          ))
        : null}
    </div>
  );
}
