/**
 * The pitch box — a rectangle banded in the pitch colour along its top edge,
 * reading `Pitch 1` underneath in the card's own face.
 *
 * THIS IS THE MARK FOR A LIST OR A GRID, and that is the whole of the division
 * of labour between it and {@link PitchJewel}. The jewel is a stone: one card,
 * one value, set beside the name of the thing it belongs to on a page about
 * that thing. A list is the other case — a row standing for a NAME, which in
 * this game is commonly three cards — and there the stones became a scatter of
 * cut gems down the left of the page, each one an ornament competing with the
 * name it was captioning. The box says the same fact as a label instead.
 *
 * `PitchRule` is the third rendering and the three do not overlap. Bands go
 * under a card face, where there is no line of type at all; the jewel goes on
 * the card page; this goes in the index rows, the version tabs, the related
 * links and the breadcrumb — everywhere a list or a grid used to draw a stone.
 *
 * THE WORDS ARE THE POINT, not a caption on an icon. `PitchJewel` records the
 * reason at length and it applies with more force here: red and yellow are the
 * classic deuteranopia confusion pair, pitch is the most-read value on a card,
 * and a numeral inside a stone is one glyph a reader has to already know the
 * grammar of. "Pitch 1" is the fact spelled out, so the colour is left doing
 * what colour should do in this system — repeating something already said.
 *
 * IT WAS THE LEGALITY FLAG'S PLATE AND IT IS NOT ANY MORE — history, not the
 * rule. This shipped as `StatePill`'s notched silhouette filled in the pitch
 * colour, on the argument that a reader who has learned the verdicts at the
 * foot of a card page has learned this at the top of one. What that bought
 * alongside the familiarity was a mark that is loud twice: the hue as a
 * background behind its own words, and a silhouette that says "this carries
 * state" a few centimetres from four objects that mean it literally.
 *
 * SO THE COLOUR IS A BAND ACROSS THE TOP AND NOTHING ELSE, which is the mark
 * `PitchRule` already draws under a card face — one object in two places, and
 * here it gets the words a band under a picture has no room for. The
 * stylesheet carries the rest: why the words take the display family the card
 * name is set in rather than the pill's wide-tracked uppercase, and why a mark
 * with no filled surface carries no bevel.
 *
 * The notch goes back to being state's alone with it. `tokens.ts` says so.
 */

import type { PitchValue } from "optfall-theme";

import "./PitchBox.css";

export interface PitchBoxProps {
  /** 1, 2, 3 or 4 — or 0 for a card with no pitch value at all. */
  readonly value: PitchValue;
  readonly size?: "sm" | "md";
  /** Accessible name. Defaults to the pitch value spoken in full. */
  readonly label?: string;
}

const TONES = ["none", "one", "two", "three", "four"] as const;

export function PitchBox({ value, size = "md", label }: PitchBoxProps) {
  /**
   * `?.trim() ||`, not `??` — the house idiom, and `PitchJewel` sets out why:
   * a default that only fires on `undefined` is one a caller can displace with
   * `""` or `"   "`, leaving `aria-label=""` on a `role="img"` whose only text
   * node is `aria-hidden`.
   */
  const spoken =
    label?.trim() || (value === 0 ? "No pitch value" : `Pitch ${value}`);

  /**
   * The written mark. Zero is an absence and says so in words — the jewel
   * draws a dash for it, which is the most a stone can manage, and the whole
   * reason this component exists is that it has room to be plainer than that.
   *
   * Sentence case in the DOM and on the screen alike. It was uppercased by the
   * stylesheet — the house treatment for a LABEL — and that went with the
   * label voice: a mark set in the card's own display face is read as part of
   * the name beside it, and names in this game are not shouted.
   */
  const written = value === 0 ? "No pitch" : `Pitch ${value}`;

  const tone = TONES[value] ?? "none";

  return (
    <span
      className={`of-pitch-box of-pitch-box--${size} of-pitch-box--tone-${tone}`}
      role="img"
      aria-label={spoken}
      data-pitch={value}
    >
      {/*
        The text is its own element for the reason the jewel's glyph is: the
        box is a `role="img"` named by `aria-label`, so its visible words have
        to be `aria-hidden` or a caller's label and the mark's own text both
        reach the anchor around it. `StatePill` needs no such span because a
        pill IS its text — this one stands for the value rather than printing
        it, which is what the label prop exists to override.
      */}
      <span className="of-pitch-box__text" aria-hidden="true">
        {written}
      </span>
    </span>
  );
}
