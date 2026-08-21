/**
 * The pitch box — a column of the pitch colour with the value written down it.
 *
 * THIS IS THE MARK FOR A LIST OR A GRID, and that is the whole of the division
 * of labour between it and {@link PitchJewel}. The jewel is a stone: one card,
 * one value, set beside the name of the thing it belongs to on a page about
 * that thing. A list is the other case — a row standing for a NAME, which in
 * this game is commonly three cards — and there the stones became a scatter of
 * cut gems down the left of the page, each one an ornament competing with the
 * name it was captioning. The box says the same fact as a label instead: a
 * square-cornered spine, filled with the pitch colour, reading `PITCH 1`.
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
 * grammar of. "PITCH 1" is the fact spelled out, so the colour is left doing
 * what colour should do in this system — repeating something already said.
 *
 * THE TEXT RUNS DOWN THE BOX rather than across it, which is what makes the
 * mark a spine rather than a tag. A horizontal "PITCH 1" beside every name in
 * a list is a column of prose wide enough to be read as part of the name; set
 * vertically it is an edge — the eye takes the colour and the shape as one
 * object and reads the words only when it wants them. It also keeps the mark's
 * WIDTH fixed and independent of the value, so three boxes on one row are
 * three equal columns rather than a ragged strip.
 *
 * HOW THE SURFACE GETS ITS BEVEL. `PitchJewel` lists the four sanctioned
 * spellings and says the choice is made by geometry rather than by taste. This
 * is a flat-topped, flat-bottomed, unclipped rectangle, which is spelling (2),
 * the bordered plate: `border-block-start-color` / `border-block-end-color`,
 * exactly as `BevelledPlate` does it. Not the jewel's paired `drop-shadow()` —
 * that spelling exists for an arbitrary alpha silhouette and costs a filter
 * pass to draw what two border colours draw here for nothing.
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
   * Set in sentence case and uppercased by the stylesheet, which is the house
   * treatment for a label: `text-transform` is a rendering, so a screen reader
   * that falls back to the text node still gets a word rather than a shout.
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
        The text is its own element because the writing mode is a fact about
        the TEXT, not about the box: rotating the box would rotate its padding
        and its bevel with it, so the light edge would end up down one side
        instead of along the top.
      */}
      <span className="of-pitch-box__text" aria-hidden="true">
        {written}
      </span>
    </span>
  );
}
