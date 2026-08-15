/**
 * A printed stat, in a struck plate whose silhouette says which stat it is.
 * React port.
 *
 * `docs/DESIGN.md` described this and it was never built: "the face follows the
 * game's own furniture — jewel top-left, cost in a hexagonal plate top-right,
 * power and defence in chamfered plates at the corners". The card page had been
 * rendering a definition list of words and numerals instead, so COST and POWER
 * were told apart by reading two labels rather than by recognising two shapes.
 *
 * EVERY SILHOUETTE IS CUT FROM ONE VOCABULARY — a square plate with corners
 * chamfered differently — so the set reads as one family rather than as six
 * icons somebody drew. That is the same argument the bevel makes everywhere
 * else: the chrome should feel struck from metal, not assembled from a picker.
 *
 * THE OCTAGON IS NOT AVAILABLE, and that constraint is load-bearing rather than
 * incidental. `PitchJewel` owns it: "the silhouette is reserved: nothing else in
 * the interface is ever this shape." A stat glyph that happened to be
 * eight-sided would spend the one shape the system has promised means pitch. So
 * `life` is a plain plate and the diagonals are two-corner cuts, none of which
 * can be mistaken for a cut stone.
 *
 * THE NUMERAL IS THE PRIMARY CHANNEL, exactly as on the jewel. The shape is
 * redundant, the label is redundant, and the accessible name spells the stat out
 * in full — a reader who cannot tell a hexagon from a chamfered square, or who
 * is hearing the page rather than seeing it, loses nothing.
 *
 * NO LSS ASSET IS REPRODUCED, AND THE EARLIER READING OF THAT RULE WAS TOO
 * WIDE. The comment used to say "the game's own resource and attack pips are not
 * ours to draw" and treated every printed shape as off limits.
 * `docs/COMPLIANCE.md` §3 does not say that: it bars FAB and LSS **logos**,
 * product **set logos** and any close semblance of them — "card faces are fine;
 * marks are not" — and it explicitly blesses drawing from a game MECHANIC, which
 * is why the project's own mark is a pitch jewel. A disc meaning "resource" is a
 * mechanic, not a trademark.
 *
 * What stays true is that nothing here is copied. Every shape is a `clip-path`
 * in the token layer and every colour is ours: the register, none of the
 * artwork. Shipping LSS's actual symbol files would be a different decision,
 * needing the provenance record §3 requires and the copyright line §5 requires,
 * and it is not what this does.
 */

import type { StatKind } from "../index";

import "./StatGlyph.css";

export interface StatGlyphProps {
  /** Which stat this is. Decides the silhouette and the spoken name. */
  readonly kind: StatKind;
  /**
   * The printed value, verbatim. A string because upstream prints `X`, `XX` and
   * `*` as often as it prints a number, and coercing those to a number is how a
   * card acquires a cost it was never printed with.
   */
  readonly value: string;
  /** Rendered size, in token steps rather than pixels. */
  readonly size?: "sm" | "md";
}

/**
 * How each stat is spoken. Written out rather than derived from the key, so
 * "defence" is not read aloud as "def" and the wording is a decision rather than
 * a side effect of a variable name.
 */
const SPOKEN: Record<StatKind, string> = {
  cost: "Cost",
  power: "Power",
  defence: "Defence",
  life: "Life",
  intellect: "Intellect",
  arcane: "Arcane",
};

export function StatGlyph({ kind, value, size = "md" }: StatGlyphProps) {
  return (
    <span
      className={`of-stat of-stat--${kind} of-stat--${size}`}
      role="img"
      aria-label={`${SPOKEN[kind]} ${value}`}
    >
      <span className="of-stat__value" aria-hidden="true">
        {value}
      </span>
    </span>
  );
}
