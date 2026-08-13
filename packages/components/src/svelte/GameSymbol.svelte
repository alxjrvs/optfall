<script lang="ts">
  /**
   * A printed game symbol — `{p}`, `{r}`, `{t}` — as a struck plate.
   *
   * ONE VOCABULARY WITH `StatGlyph`, and that is the whole reason this exists
   * rather than an icon font. The plate a reader meets inline in `+1{p}` is the
   * same silhouette carrying `4` in the stat block above it, so the notation is
   * legible from the stat block without anyone consulting a legend. Two
   * components, one shape table: the shape table lives in the TOKEN layer as `ornament.cut.*`, read by both, so a
   * cut can never drift between the place it is defined and the place it is
   * read.
   *
   * NO LSS SYMBOL IS REPRODUCED, and this is the constraint that decided the
   * form. `docs/COMPLIANCE.md` bars their logos "and any close semblance", and
   * the game's own resource and attack pips are not ours to draw — so this is
   * NOT a redrawn pip. It is the system's own furniture carrying the letter
   * upstream itself writes between the braces, which is the same move the mark
   * made and the same one `StatGlyph` made: take the register, none of the form.
   *
   * THE LETTER IS UPSTREAM'S, NOT A NICER ONE. Life is `H`, because the marker
   * is `{h}` — calling it `L` would be tidier and would break the one job this
   * plate has, which is to let a reader connect what they see rendered to what
   * they see in the raw view. The accessible name says "life" in full, so
   * nobody has to decode `H` to read the card.
   *
   * THE NUMBER IS NOT ABSORBED. `+1{p}` renders as the text "+1" followed by
   * this plate, not as a plate containing "+1". Two reasons: the card says
   * "plus one power" and that is the order it should be read aloud in, and a
   * plate carrying a number is already `StatGlyph`'s meaning — a printed VALUE.
   * A symbol is not a value, and conflating them would make `{t}` unrenderable.
   */
  import type { SymbolKind } from "../index";

  interface Props {
    kind: SymbolKind;
    /** The letter struck on the plate, from the symbol table. */
    letter: string;
    /** How the rules name it — spoken in full, never the letter. */
    name: string;
    size?: "sm" | "md";
  }

  const { kind, letter, name, size = "sm" }: Props = $props();
</script>

<!--
  `role="img"` with the rules' word as the name, so a screen reader says
  "plus one power" rather than "plus one P". The letter is decorative in the
  strict sense: it is a second rendering of a fact the label already carries.
-->
<span class="symbol {kind} {size}" role="img" aria-label={name}>
  <span class="letter" aria-hidden="true">{letter}</span>
</span>

<style>
  .symbol {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--symbol-size);
    block-size: var(--symbol-size);
    /* Sits on a text baseline rather than a grid, which a stat plate never has
       to do: without this the line-height of a paragraph containing six of them
       opens up and the text loses its rhythm. */
    vertical-align: var(--of-ornament-symbol-shift);
    background: var(--of-color-surface-raised);
    color: var(--of-color-ink);
    box-shadow:
      inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light),
      inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark);
    --symbol-size: calc(var(--of-ornament-stat-size) * 0.62);
    --chamfer: calc(var(--of-ornament-notch-size) * 0.62);
  }

  .md {
    --symbol-size: var(--of-ornament-stat-size);
    --chamfer: var(--of-ornament-notch-size);
  }

  .letter {
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-micro);
    font-weight: var(--of-type-weight-bold);
    line-height: 1;
    /* Tracked in, because a single capital in a small plate reads as offset
       otherwise — the letterform's own side bearings are not symmetric. */
    letter-spacing: 0;
  }

  .md .letter {
    font-size: var(--of-type-size-base);
  }

  /* -- The silhouettes ------------------------------------------------------
     Read from the token layer, which is where the shape table lives so that
     this component and `StatGlyph` cannot drift apart. See
     `ornament.cut.*` in `packages/theme/src/tokens.ts` for why each cut is
     the cut it is, and for the rule that none of them may be eight-sided. */

  /* -- The three the card itself draws --------------------------------------
     Resource, power and defence take the disc, the disc and the shield, in the
     card's own two inks — the same change `StatGlyph` made and for the same
     reason, held together by the same token table.

     THIS IS THE HALF THAT MATTERS MOST. A stat plate is read once, at the top
     of a page, beside a word that names it. These are read INLINE, mid-sentence,
     in "deal 3 {p} damage" — with no label anywhere near them. A marker that
     needed the legend to be decoded was doing its job only for a reader who had
     already scrolled to the legend, which is most of why that legend existed.

     Resource keeps `cost`'s red disc rather than getting one of its own: a cost
     is a resource value (CR 1.12.4e), and one concept gets one shape. */
  .resource {
    clip-path: var(--of-ornament-cut-disc);
    background: var(--of-color-stat-cost);
    color: var(--of-color-stat-cost-ink);
  }

  .power {
    clip-path: var(--of-ornament-cut-disc);
    background: var(--of-color-stat-power);
    color: var(--of-color-stat-power-ink);
  }

  .defence {
    clip-path: var(--of-ornament-cut-shield);
    background: var(--of-color-stat-defence);
    color: var(--of-color-stat-defence-ink);
    align-items: start;
    padding-block-start: var(--of-space-tightest);
  }

  /* Life — the plain plate. Nothing is cut, which is its own signal in a set
     where everything else is. */
  .life {
    clip-path: var(--of-ornament-cut-plain);
  }

  .intellect {
    clip-path: var(--of-ornament-cut-diagonal-start);
  }

  /* Chi — cut across the top, distinct from all five above without becoming
     the reserved pitch diamond. */
  .chi {
    clip-path: var(--of-ornament-cut-crown);
  }

  /*
    Tap and untap are EFFECTS, not values — the CR draws that line itself
    (1.12.4g "represents the tap effect", against 1.12.4a "represents a defense
    value") — so they are cut down one whole side rather than at a corner. The
    two are mirrors of each other, which is what they are.
  */
  .tap {
    clip-path: var(--of-ornament-cut-side-end);
  }

  .untap {
    clip-path: var(--of-ornament-cut-side-start);
  }

  /*
    X is the one marker the CR's symbol table does not list — 1.12.2 defines the
    LETTER X, not a symbol — so it is drawn as the plain letter it is, with no
    plate and no silhouette. The absence is the honesty: a reader can see at a
    glance that this one is not part of the published set.
  */
  .x {
    background: none;
    box-shadow: none;
    inline-size: auto;
    color: var(--of-color-ink);
  }

  .x .letter {
    font-style: italic;
    font-size: inherit;
  }
</style>
