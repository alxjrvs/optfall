/**
 * A printed stat — the game's own mark, with the value the card prints beside
 * it. React port.
 *
 * IT RENDERS THE REAL SYMBOL WHEN IT IS GIVEN ONE, and the drawn plate is the
 * fallback rather than the point. That is the same arrangement `GameSymbol`
 * reached first, for the same reason, and this component has now followed it.
 *
 * WHAT CHANGED, AND WHAT THE CARD SAYS. Every stat this component draws was a
 * silhouette cut here — a disc for cost, power, intellect and life, a shield
 * for defence — carrying its numeral INSIDE. The shapes were honest and they
 * were a private notation: a reader had to learn that our grey shield is the
 * object printed on the card in their hand. Reading the printed cards settles
 * three things the drawn plates got wrong:
 *
 * - The symbol sits OUTBOARD and the numeral INBOARD OF IT, side by side. A
 *   card's combat bar is `{p} 4 … 2 {d}`, and a hero's is `{i} 4 … 19 {h}`.
 * - Cost is the one exception: the resource disc carries its numeral INSIDE,
 *   which is why `--cost` is the one kind that stacks rather than sits beside.
 * - Nothing is labelled. The card prints no word next to any of them, and the
 *   accessible name carries what a sighted reader gets from the shape.
 *
 * SO THE NUMERAL IS NO LONGER STRUCK INTO METAL, and it stops being the plate's
 * content. It is the value, in the card's own serif, next to the mark that says
 * what it is a value OF. `StatGlyph.css` carries the mirroring rule that keeps
 * the artwork at the outer edge on both sides of the panel.
 *
 * EVERY STAT THE CARD PANEL PRINTS HAS ARTWORK, which is why the fallback is a
 * fallback rather than a branch anybody meets in the product. `STAT_ORDER` in
 * the site's `cards.ts` is cost, power, defence, life and intellect — exactly
 * the five the Comprehensive Rules name at 1.12.4 and LSS publishes files for.
 * Arcane is not in it: the card prints that number in its rules text, so the
 * panel never asks for the glyph. The drawn plates below survive for the design
 * system's own page and for a story, where the site's `public/` is not mounted.
 *
 * THE SILHOUETTES ARE THEREFORE STILL HERE, AND STILL ONE VOCABULARY with
 * `GameSymbol` — the shape table lives in the token layer as `ornament.cut.*`
 * and both components read it. Deleting them would strand the design-system
 * card and leave `arcane`, the one stat with no printed notation, with nothing
 * to draw at all.
 *
 * NO LSS ASSET IS REDRAWN. `docs/COMPLIANCE.md` §3 bars FAB and LSS **logos**,
 * product **set logos** and any close semblance of them — "card faces are fine;
 * marks are not" — and it explicitly blesses drawing from a game MECHANIC,
 * which is why the project's own mark was once a pitch jewel. A disc meaning
 * "resource" is a mechanic, not a trademark. The files this renders are LSS's
 * own, ingested from LSS's own rules site with the provenance record §3
 * requires; the plates below are ours, every shape a `clip-path` in the token
 * layer and every colour a token.
 *
 * ONE THING THE ARTWORK COSTS US, stated rather than discovered. An ingested
 * PNG cannot take a token, so the ABSENT state — a stat the card does not print
 * — can no longer be a recessed fill. It desaturates the artwork instead. See
 * `StatGlyphProps.value`.
 */

import type { StatKind } from "../index";

import "./StatGlyph.css";

export interface StatGlyphProps {
  /** Which stat this is. Decides the silhouette and the spoken name. */
  readonly kind: StatKind;
  /**
   * The printed value, verbatim — or `null` where the card prints none.
   *
   * A STRING because upstream prints `X`, `XX` and `*` as often as it prints a
   * number, and coercing those to a number is how a card acquires a cost it was
   * never printed with.
   *
   * `null`, NOT `""`, AND THE TWO ARE NOT THE SAME CLAIM. Upstream writes an
   * absent stat as the empty string, so "this card has no power" and "this card
   * has power 0" arrive as one field carrying two different facts — and 0 is
   * not rare: 1,648 cards print a cost of 0, 191 a defence of 0, 13 a power of
   * 0. `null` is the explicit second claim.
   *
   * AN ABSENCE PRINTS NO CHARACTER AT ALL. It used to draw an en dash, on the
   * argument that the slot should say something. Beside a mark rather than
   * inside a plate, a dash reads as a value the card prints — the one thing the
   * absent state exists to deny — so the mark greys out and the value position
   * is simply empty. The accessible name still says the absence in words, which
   * is where that claim belongs.
   *
   * An empty string is passed through as-is and draws a mark with nothing next
   * to it, which is a caller's bug this component will not disguise as an
   * absence: the mark stays at full colour, so the two are distinguishable.
   */
  readonly value: string | null;
  /** Rendered size, in token steps rather than pixels. */
  readonly size?: "sm" | "md";
  /**
   * LSS's own artwork for this stat's symbol, where they publish one.
   *
   * Supplied by the card panel through `assetForSymbol`. Omitted for `arcane`,
   * which the rules' symbol table does not list, and in a story, where the
   * site's `public/` is not mounted. Both fall back to the drawn plate.
   */
  readonly src?: string | undefined;
  /**
   * Intrinsic box of `src`. Required with it, for the reason `CardFace`
   * requires one: an image with no box reflows the row it sits in.
   */
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

/**
 * How each stat is spoken. Written out rather than derived from the key, so
 * "defence" is not read aloud as "def" and the wording is a decision rather than
 * a side effect of a variable name.
 *
 * IT CARRIES THE WHOLE LABEL NOW. The card panel used to print the word beside
 * every mark and the card prints none, so the visible labels are gone; this
 * string is the only place the stat is named in words. That makes it load
 * bearing rather than a courtesy — a reader hearing the page gets exactly what
 * a reader seeing it gets, which is what the visible word used to guarantee.
 */
const SPOKEN: Record<StatKind, string> = {
  cost: "Cost",
  power: "Power",
  defence: "Defence",
  life: "Life",
  intellect: "Intellect",
  arcane: "Arcane",
};

export function StatGlyph({
  kind,
  value,
  size = "md",
  src,
  width,
  height,
}: StatGlyphProps) {
  const absent = value === null;

  /*
   * SPOKEN AS AN ABSENCE, IN WORDS. Nothing is drawn in the value position now,
   * so this is not a transcription of a dash — it is the only statement of the
   * fact anywhere in the markup. `PitchJewel` words its own zero the same way.
   */
  const spoken = absent
    ? `No printed ${SPOKEN[kind].toLowerCase()}`
    : `${SPOKEN[kind]} ${value}`;

  const className = [
    "of-stat",
    `of-stat--${kind}`,
    `of-stat--${size}`,
    src !== undefined ? "of-stat--art" : null,
    absent ? "of-stat--absent" : null,
  ]
    .filter((part) => part !== null)
    .join(" ");

  return (
    <span className={className} role="img" aria-label={spoken}>
      {src !== undefined ? (
        /*
          `alt=""` because the wrapping `role="img"` already owns the accessible
          name. Announcing both would read the stat twice, and `loading="lazy"`
          is deliberately absent: these sit in the card panel's own bands, above
          the fold on every card page, so deferring them is how a stat block
          reflows under the reader's eye.
        */
        <img
          className="of-stat__art"
          src={src}
          alt=""
          width={width}
          height={height}
          decoding="async"
        />
      ) : null}
      {/*
        RENDERED EVEN WHEN EMPTY, and that is a layout decision rather than an
        oversight. The cost mark stacks its numeral over the artwork, so the two
        share a grid cell; dropping the element on an absent cost would collapse
        that cell and shift the corner. An empty span costs nothing and keeps
        every mark the same object.
      */}
      <span className="of-stat__value" aria-hidden="true">
        {absent ? "" : value}
      </span>
    </span>
  );
}
