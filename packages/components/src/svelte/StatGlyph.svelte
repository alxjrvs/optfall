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
   * NO LSS ASSET IS REPRODUCED, AND THE EARLIER READING OF THAT RULE WAS TOO
   * WIDE. This comment used to say "the game's own resource and attack pips are
   * not ours to draw" and treated every printed shape as off limits.
   * `docs/COMPLIANCE.md` §3 does not say that: it bars FAB and LSS **logos**,
   * product **set logos** and any close semblance of them — "card faces are
   * fine; marks are not" — and it explicitly blesses drawing from a game
   * MECHANIC, which is why the project's own mark is a pitch jewel. A disc
   * meaning "resource" is a mechanic, not a trademark.
   *
   * What stays true is that nothing here is copied. Every shape below is a
   * `clip-path` in the token layer and every colour is ours: the register, none
   * of the artwork. Shipping LSS's actual symbol files would be a different
   * decision, needing the provenance record §3 requires and the copyright line
   * §5 requires, and it is not what this does.
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
    /* STATED, because nothing states it for us. The site resets `box-sizing` on
       `body` only, so padding ADDS to a fixed `block-size` — which made the
       defence shield 1.28x taller than wide, stretched its percentage polygon,
       and stood it out of line with the discs beside it. The design-system page
       ships a universal reset and therefore looked right while the real page
       did not, which is the worst way for the two to disagree. */
    box-sizing: border-box;
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

  /* -- The three the card itself draws --------------------------------------
     COST, POWER AND DEFENCE ARE NOT CHAMFERED PLATES ANY MORE, and the reason
     is that they were the three a reader already knows by sight.

     The plate vocabulary above is right for the stats the card does not give a
     shape to. It was wrong for these: a player looking for attack is looking
     for a yellow disc, and finding a forward-leaning grey square meant reading
     the label to identify a value the physical card identifies at a glance. The
     shape was carrying the system's consistency instead of the card's meaning.

     So these three take the card's own geometry and the card's own two inks —
     a red disc for cost, a yellow disc for power, a steel shield for defence —
     while the numeral stays the primary channel, the label stays visible and
     the accessible name still spells the stat out. Three redundant carriers, as
     before; one of them now agrees with the object being described.

     Drawn by us in tokens from our own palette. Nothing here is an LSS asset,
     and no set symbol or logo is reproduced: `docs/COMPLIANCE.md` §3 bars those
     and this takes the register rather than the artwork, which is the same move
     the mark made. */
  .cost {
    clip-path: var(--of-ornament-cut-disc);
    background: var(--of-color-stat-cost);
    color: var(--of-color-stat-cost-ink);
  }

  .power {
    clip-path: var(--of-ornament-cut-disc);
    background: var(--of-color-stat-power);
    color: var(--of-color-stat-power-ink);
  }

  /* CENTRED IN THE BODY, NOT IN THE BOX. The shield's point takes the bottom of
     the square, so `align-items: start` pinned the numeral to the very top and
     it read as a number sitting above a shield rather than struck into one.
     Padding out the point's share and centring normally puts it in the metal. */
  .defence {
    clip-path: var(--of-ornament-cut-shield);
    background: var(--of-color-stat-defence);
    color: var(--of-color-stat-defence-ink);
    padding-block-end: calc(var(--stat-size) * 0.28);
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
