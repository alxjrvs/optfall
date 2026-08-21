/**
 * The pitch box — the state pill's object in the pitch palette, reading
 * `PITCH 1`.
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
 * grammar of. "PITCH 1" is the fact spelled out, so the colour is left doing
 * what colour should do in this system — repeating something already said.
 *
 * IT IS THE LEGALITY FLAG'S SHAPE, AND TAKING IT IS THE DECISION HERE. Same
 * notch, same depth token, same padding, same label voice, same bevel — see the
 * stylesheet, which is `StatePill.css` almost declaration for declaration. A
 * reader meets the pills at the foot of a card page and meets this at the top
 * of one; drawing a fifth silhouette for "a short value a card carries" would
 * be a new thing to learn in exchange for nothing.
 *
 * SO THE NOTCH IS NO LONGER STATE'S ALONE, and that is a real widening rather
 * than an accident. `tokens.ts` said the clipped corner meant "this carries
 * state"; it now means "this is one value out of a fixed set the card carries",
 * which state and pitch both are and which nothing else in the interface is.
 * The token comment has been corrected to say so rather than left standing as a
 * claim this component breaks.
 *
 * NOT LITERALLY `StatePill`, THOUGH. That component's tones are `StateTone`, a
 * closed union of legality verdicts, and widening it to carry pitch would make
 * "which tone" stop meaning "which verdict" — the distinction its stylesheet is
 * built around. Two components, one shape, no shared union.
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
