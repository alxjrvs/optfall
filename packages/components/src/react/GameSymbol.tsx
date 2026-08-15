/**
 * A printed game symbol — `{p}`, `{r}`, `{t}` — as a struck plate. React port.
 *
 * ONE VOCABULARY WITH `StatGlyph`, and that is the whole reason this exists
 * rather than an icon font. The plate a reader meets inline in `+1{p}` is the
 * same silhouette carrying `4` in the stat block above it, so the notation is
 * legible from the stat block without anyone consulting a legend. Two
 * components, one shape table: the shape table lives in the TOKEN layer as
 * `ornament.cut.*`, read by both, so a cut can never drift between the place it
 * is defined and the place it is read.
 *
 * IT RENDERS THE REAL SYMBOL WHEN IT IS GIVEN ONE, and the drawn plate is the
 * fallback rather than the point.
 *
 * The comment used to read "NO LSS SYMBOL IS REPRODUCED … the game's own
 * resource and attack pips are not ours to draw", which was a wider reading of
 * `docs/COMPLIANCE.md` than §3 supports: §3 bars FAB and LSS **logos**, product
 * **set logos** and close semblances of them, says card faces are fine, and
 * explicitly blesses drawing from a game MECHANIC — the stated reason this
 * project's own mark is a pitch jewel. `{p}` is defined in the Comprehensive
 * Rules at 1.12.4d as the notation for a power value. It identifies no brand.
 *
 * The drawn plates were honest and they were a private notation. A reader meets
 * `{p}` mid-sentence with no label beside it, and a shape they have to learn is
 * a shape that sends them to a legend; the symbol on the card in their hand is
 * the one they already know. So when `src` is supplied — see `assetForSymbol`
 * in the site's `card-symbols.ts`, backed by the ingest script's provenance
 * record — this renders LSS's own artwork, unmodified.
 *
 * THE PLATE REMAINS, FOR THE ONE SYMBOL WITH NO ARTWORK. 1.12.4 names eight and
 * `{x}` is not among them, so LSS publishes no icon for it and there is nothing
 * to render. The fallback also keeps this component usable in a story, where the
 * site's `public/` is not mounted.
 *
 * THE LETTER IS UPSTREAM'S, NOT A NICER ONE. Life is `H`, because the marker is
 * `{h}` — calling it `L` would be tidier and would break the one job the
 * fallback plate has, which is to let a reader connect what they see rendered to
 * what they see in the raw view. The accessible name says "life" in full, so
 * nobody has to decode `H` to read the card.
 *
 * THE NUMBER IS NOT ABSORBED. `+1{p}` renders as the text "+1" followed by this
 * plate, not as a plate containing "+1". Two reasons: the card says "plus one
 * power" and that is the order it should be read aloud in, and a plate carrying
 * a number is already `StatGlyph`'s meaning — a printed VALUE. A symbol is not a
 * value, and conflating them would make `{t}` unrenderable.
 */

import type { SymbolKind } from "../index";

import "./GameSymbol.css";

export interface GameSymbolProps {
  readonly kind: SymbolKind;
  /** The letter struck on the fallback plate, from the symbol table. */
  readonly letter: string;
  /** How the rules name it — spoken in full, never the letter. */
  readonly name: string;
  readonly size?: "sm" | "md";
  /**
   * LSS's own artwork for this symbol, where they publish one.
   *
   * Omitted for `{x}`, which the rules' symbol table does not list, and in a
   * story, where the site's `public/` is not mounted. Both fall back to the
   * drawn plate.
   */
  readonly src?: string | undefined;
  /**
   * Intrinsic box of `src`. Required with it, for the reason `CardFace`
   * requires one: an image with no box reflows the paragraph it sits in.
   */
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

export function GameSymbol({
  kind,
  letter,
  name,
  size = "sm",
  src,
  width,
  height,
}: GameSymbolProps) {
  /*
   * `role="img"` with the rules' word as the name, so a screen reader says
   * "plus one power" rather than "plus one P". The letter, and the artwork, are
   * decorative in the strict sense: each is a second rendering of a fact the
   * accessible name already carries.
   */
  const className = [
    "of-symbol",
    `of-symbol--${kind}`,
    `of-symbol--${size}`,
    src !== undefined ? "of-symbol--art" : null,
  ]
    .filter((part) => part !== null)
    .join(" ");

  return (
    <span className={className} role="img" aria-label={name}>
      {src !== undefined ? (
        /*
          `alt=""` because the wrapping `role="img"` already owns the accessible
          name. Announcing both would read the symbol twice, and `loading="lazy"`
          is deliberately absent: these are inline with the text, so deferring
          them is how a sentence reflows under the reader's eye.
        */
        <img src={src} alt="" width={width} height={height} decoding="async" />
      ) : (
        <span className="of-symbol__letter" aria-hidden="true">
          {letter}
        </span>
      )}
    </span>
  );
}
