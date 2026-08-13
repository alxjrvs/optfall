<script lang="ts">
  /**
   * A printed stat, in a struck plate whose silhouette says which stat it is.
   *
   * `docs/DESIGN.md` described this and it was never built: "the face follows
   * the game's own furniture — jewel top-left, cost in a hexagonal plate
   * top-right, power and defence in chamfered plates at the corners". The card
   * page has been rendering a definition list of words and numerals instead, so
   * COST and POWER were told apart by reading two labels rather than by
   * recognising two shapes.
   *
   * EVERY SILHOUETTE IS CUT FROM ONE VOCABULARY — a square plate with corners
   * chamfered differently — so the set reads as one family rather than as six
   * icons somebody drew. That is the same argument the bevel makes everywhere
   * else: the chrome should feel struck from metal, not assembled from a
   * picker.
   *
   * THE OCTAGON IS NOT AVAILABLE, and that constraint is load-bearing rather
   * than incidental. `PitchJewel` owns it: "the silhouette is reserved: nothing
   * else in the interface is ever this shape." A stat glyph that happened to be
   * eight-sided would spend the one shape the system has promised means pitch.
   * So `life` is a plain plate and the diagonals are two-corner cuts, none of
   * which can be mistaken for a cut stone.
   *
   * THE NUMERAL IS THE PRIMARY CHANNEL, exactly as on the jewel. The shape is
   * redundant, the label is redundant, and the accessible name spells the stat
   * out in full — a reader who cannot tell a hexagon from a chamfered square,
   * or who is hearing the page rather than seeing it, loses nothing.
   *
   * NO LSS SYMBOL IS REPRODUCED. `docs/COMPLIANCE.md` bars their logos and any
   * close semblance, and the game's own resource and attack pips are not ours
   * to draw. These are plates — the system's own furniture — carrying our
   * numerals, which is the same move the mark made: take the register, none of
   * the form.
   */
  import type { StatKind } from "../index";

  interface Props {
    /** Which stat this is. Decides the silhouette and the spoken name. */
    kind: StatKind;
    /**
     * The printed value, verbatim. A string because upstream prints `X`, `XX`
     * and `*` as often as it prints a number, and coercing those to a number is
     * how a card acquires a cost it was never printed with.
     */
    value: string;
    /** Rendered size, in token steps rather than pixels. */
    size?: "sm" | "md";
  }

  const { kind, value, size = "md" }: Props = $props();

  /**
   * How each stat is spoken. Written out rather than derived from the key, so
   * "defence" is not read aloud as "def" and the wording is a decision rather
   * than a side effect of a variable name.
   */
  const SPOKEN: Record<StatKind, string> = {
    cost: "Cost",
    power: "Power",
    defence: "Defence",
    life: "Life",
    intellect: "Intellect",
    arcane: "Arcane",
  };
</script>

<span class="stat {kind} {size}" role="img" aria-label={`${SPOKEN[kind]} ${value}`}>
  <span class="value" aria-hidden="true">{value}</span>
</span>

<style>
  .stat {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--stat-size);
    block-size: var(--stat-size);
    background: var(--of-color-surface-raised);
    color: var(--of-color-ink);
    /* Struck, like every other surface: light above, dark below. Drawn with a
       shadow rather than a border because the clip-path below would cut a
       border's corners off along with the plate's. */
    box-shadow:
      inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light),
      inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark);
    --stat-size: var(--of-ornament-stat-size);
    --chamfer: var(--of-ornament-notch-size);
  }

  .sm {
    --stat-size: calc(var(--of-ornament-stat-size) * 0.75);
  }

  .value {
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-base);
    font-weight: var(--of-type-weight-bold);
    line-height: 1;
  }

  /* -- The silhouettes ------------------------------------------------------
     ONE VOCABULARY, AND IT NOW LIVES IN THE TOKEN LAYER as `ornament.cut.*`,
     because `GameSymbol` reads the same table.

     That pairing is the point rather than a tidy-up. A reader meets `+1{p}`
     inline in the card's printed text and `4` here in the stat block, and they
     are the same plate — so the notation is legible from the stat block without
     anyone consulting a legend. Held as two copies of a `clip-path`, that
     equivalence would last until somebody adjusted one chamfer.

     Still never eight-sided: that shape belongs to the pitch jewel and to
     nothing else. */

  /* Cost — the hexagon. It is the RESOURCE silhouette, which is the same fact
     said twice rather than a reuse: CR 1.12.4e makes `{r}` a resource value,
     and a cost is the resource value you pay. */
  .cost {
    clip-path: var(--of-ornament-cut-hexagon);
  }

  /* Power — chamfered at the leading corner: the plate leans forward. */
  .power {
    clip-path: var(--of-ornament-cut-lean-end);
  }

  /* Defence — the mirror, so the pair reads as opposed at a glance. */
  .defence {
    clip-path: var(--of-ornament-cut-lean-start);
  }

  /* Life — the plain plate. Nothing is cut, which is its own signal in a set
     where everything else is. */
  .life {
    clip-path: var(--of-ornament-cut-plain);
  }

  /* Intellect and Arcane — opposed diagonals, so the two hero stats are
     distinguishable from each other and from the three combat stats.

     ARCANE IS THE ONE STAT WITH NO PRINTED SYMBOL. The CR's table at 1.12.4
     names eight and arcane is not among them, so this plate has no `GameSymbol`
     counterpart and never appears inline in card text. The silhouette is ours
     alone, which is exactly why it is worth saying here. */
  .intellect {
    clip-path: var(--of-ornament-cut-diagonal-start);
  }

  .arcane {
    clip-path: var(--of-ornament-cut-diagonal-end);
  }
</style>
