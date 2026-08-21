/**
 * The pitch box — a rectangle carrying the pitch colour, reading `Pitch 1` on
 * it in the card's own face.
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
 * state" a few centimetres from four objects that mean it literally. The notch
 * went back to being state's alone, and `tokens.ts` says so.
 *
 * IT WAS THEN A HAIRLINE BAND OVER A NEUTRAL WELL, AND THAT IS HISTORY TOO.
 * Retiring the plate retired the fill along with the notch, which was one
 * channel too many to give up: only ONE of the two things making that mark loud
 * was the colour, and the silhouette was the other. What the band bought
 * instead was two renderings of one fact — a struck edge in a list, a filled
 * surface in the card page's row — so a reader met pitch in two costumes on two
 * screens, and the component carried a variant whose whole job was to say which
 * costume.
 *
 * SO THE HUE TAKES THE SURFACE EVERYWHERE, AND THE MARK GOT SHORT INSTEAD.
 * Loudness is a product of area as much as of saturation, and the area is what
 * this spends now: no block padding at all and mild padding to the sides, so
 * the box is its own line of type wearing a colour rather than a tag with a
 * line of type inside it. That is the reduction the band was reaching for,
 * taken on the axis that does not cost a channel — and it leaves ONE rendering
 * of pitch in every list in the product.
 *
 * `variant` IS A WIDTH NOW RATHER THAN A COSTUME. Both spellings paint the same
 * surface; the difference is only whether the mark is sized by its own words or
 * by the row it is a member of. See {@link PitchBoxProps.variant}.
 */

import type { PitchValue } from "optfall-theme";

import "./PitchBox.css";

export interface PitchBoxProps {
  /** 1, 2, 3 or 4 — or 0 for a card with no pitch value at all. */
  readonly value: PitchValue;
  readonly size?: "sm" | "md";
  /**
   * `inline` — the default — is the mark set into a line of type, as wide as
   * its own words and no taller than them. `bar` is the same surface with no
   * width of its own, for the one place a row of these IS the furniture of a
   * section rather than a mark inside a line: the card page's "Alternate pitch
   * values" links, which divide the column between them.
   *
   * IT WAS `band` AND `bar`, WHICH WAS A CHOICE OF RENDERING; this is a choice
   * of measurement. Nothing here decides how loud the mark is any more.
   */
  readonly variant?: "inline" | "bar" | undefined;
  /** Accessible name. Defaults to the pitch value spoken in full. */
  readonly label?: string;
}

const TONES = ["none", "one", "two", "three", "four"] as const;

export function PitchBox({
  value,
  size = "md",
  variant = "inline",
  label,
}: PitchBoxProps) {
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
      className={`of-pitch-box of-pitch-box--${size} of-pitch-box--tone-${tone} of-pitch-box--${variant}`}
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
