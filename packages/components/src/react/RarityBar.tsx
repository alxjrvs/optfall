/**
 * The rarity bar — what a print run is MADE OF, as one proportional band.
 *
 * IT IS A DISTRIBUTION, WHICH IS THE ONE THING THE OTHER RARITY RENDERING
 * CANNOT DO. `CardEntry`'s rarity bubble is a fact about ONE printing: a letter
 * in a coloured disc, the way the card itself prints it. This stands for a
 * SET — hundreds of printings at once — and the question it answers is not
 * "what rarity is this" but "what shape is this release": a booster set is a
 * long common tail under a thin gold edge, a preconstructed deck is commons and
 * rares and nothing else, and a promo run is one colour end to end. Those three
 * are distinguishable at a glance here and are three identical-looking numbers
 * in a table.
 *
 * NO SET SYMBOL EXISTS TO DRAW, AND THAT IS WHY THIS DOES. `docs/COMPLIANCE.md`
 * bars product set logos, so `/sets` has always been a wall of typography with
 * nothing per-set to look at — the constraint `docs/DESIGN.md` says "pushed the
 * design somewhere more original than it would otherwise have gone". A mark
 * derived from the corpus is the version of set identity this project is
 * actually allowed to draw, and it carries information the logo never did.
 *
 * THE SLICES ARE THE CALLER'S, IN THE CALLER'S ORDER, and that is the same
 * split `StatePill` makes about its label: the corpus owns the wording, and
 * here it owns the ladder too. `RARITY_RANK` lives in the app's search grammar
 * with a paragraph arguing why Promo sits last and Marvel above Fabled; a
 * second ordering invented in this package would be a second answer to a
 * question that already has one, in a package that cannot import the first.
 *
 * COLOUR IS DOING MORE WORK HERE THAN THIS SYSTEM USUALLY ALLOWS, and the
 * accounting is `PitchRule`'s, arrived at the same way. A slice has no room for
 * a letter, so the redundancy moves to the accessible layer: the element is a
 * `role="img"` with a written name, always, and the name spells the mix out in
 * full — "282 Common, 243 Rare, 110 Majestic". The non-colour channels that
 * remain are the ORDER, which is the rarity ladder and therefore stable across
 * every bar on the page, and the WIDTHS, which are the proportions themselves.
 * Every surface that draws this also prints the counts as text beside it.
 *
 * A SLICE IS NEVER NARROWER THAN A HAIRLINE, AND THAT IS A DELIBERATE LIE ABOUT
 * THE PROPORTION. Two Fabled printings among Monarch's 1,182 is a slice about a
 * pixel wide — which rounds to nothing, so the bar would say the set has no
 * Fabled cards at all. Being invisible is a worse error than being slightly
 * too wide, so `min-inline-size` floors every slice at two pixels and the bar
 * stops being exactly proportional in the tail. The exact numbers are in the
 * accessible name and in the legend the caller prints; what the bar is for is
 * the shape.
 */

import "./RarityBar.css";

export interface RaritySlice {
  /**
   * The rarity's slug — `common`, `super`, `majestic`. The key its colour is
   * written against in CSS, and the app derives it with `raritySlug` so that a
   * rarity upstream adds tomorrow gets a slug from the same function that gives
   * it a name.
   *
   * An unrecognised slug draws the faint grey the stylesheet defaults to,
   * exactly as `CardEntry`'s bubble does — a visible gap rather than an unset
   * `var()` and no fill at all.
   */
  readonly rarity: string;
  /** The rarity's published name — "Super Rare". Spoken, never composed here. */
  readonly name: string;
  /** How many printings carry it. Non-positive slices are not drawn. */
  readonly count: number;
}

export interface RarityBarProps {
  /**
   * The mix, in the order it should read. Not sorted here; see the note above.
   *
   * An empty list — or one whose every count is zero — renders nothing rather
   * than an empty trough, which is the same claim `PitchRule` makes for an
   * empty `values`: no mark at all says "unknown", where a drawn mark with
   * nothing in it says "none", and those are different.
   */
  readonly slices: readonly RaritySlice[];
  readonly size?: "sm" | "md";
  /** Accessible name. Defaults to the mix spoken in full. */
  readonly label?: string;
}

/**
 * `[{Common,282},{Rare,243}]` → `"282 Common and 243 Rare"`. Written, not
 * joined.
 *
 * IT NAMES EVERY SLICE IT DRAWS, which is the property `PitchRule`'s own
 * spoken name lost once and had to have restored: the label is the only channel
 * a screen-reader user has here, so a slice the bar renders and the sentence
 * omits is a rarity that reader is simply not told about. The list is the
 * FILTERED one for that reason — the same array the render walks.
 */
function spokenFor(slices: readonly RaritySlice[]): string {
  const parts = slices.map(
    (slice) => `${slice.count.toLocaleString("en-GB")} ${slice.name}`,
  );

  const last = parts[parts.length - 1] ?? "";
  if (parts.length === 1) return last;
  return `${parts.slice(0, -1).join(", ")} and ${last}`;
}

export function RarityBar({ slices, size = "md", label }: RarityBarProps) {
  /*
   * ZERO AND NEGATIVE COUNTS ARE DROPPED HERE RATHER THAN TRUSTED AWAY. A
   * caller assembling a mix from a `Map` of tallies has no zeroes to pass, but
   * one filling a fixed ten-rarity template does, and a zero-count slice is a
   * `flex-grow: 0` box floored to two pixels by the rule below — a rarity the
   * set does not contain, drawn, in its own colour. That is the exact failure
   * the floor exists to prevent, arrived at from the other side.
   */
  const drawn = slices.filter((slice) => slice.count > 0);

  if (drawn.length === 0) return null;

  /*
   * `?.trim() ||`, not `??`, for the reason `PitchJewel` sets out and
   * `StatePill` repeats: a default that only fires on `undefined` is one a
   * caller can displace with `""`, leaving `aria-label=""` on a `role="img"`
   * whose meaning is carried entirely by fill colour. Here that would be the
   * whole of the information.
   */
  const spoken = label?.trim() || spokenFor(drawn);

  return (
    <span
      className={`of-rarity-bar of-rarity-bar--${size}`}
      role="img"
      aria-label={spoken}
    >
      {drawn.map((slice) => (
        <span
          className="of-rarity-bar__slice"
          data-rarity={slice.rarity}
          key={slice.rarity}
          /*
            THE PROPORTION IS `flex-grow`, NOT A PERCENTAGE WIDTH, and the
            difference is what the floor above costs. Percentages are computed
            against the container, so a floored slice would overflow the bar and
            every other slice would keep the width it would have had; grow
            factors are shared out of what is LEFT after the floors are paid, so
            the bar is always exactly its container and the rounding is
            absorbed by the slices that can afford it.
          */
          style={{ flexGrow: slice.count }}
        />
      ))}
    </span>
  );
}
