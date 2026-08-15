/**
 * The pitch rule — a card's pitch values, struck as coloured bands under its
 * name.
 *
 * THIS IS THE MARK FOR UNDER A CARD FACE, AND ONLY FOR THERE. It is not a
 * replacement for `PitchJewel` and does not compete with it: the jewel is the
 * rendering wherever there is a LINE OF TYPE to sit a stone beside — the card
 * page, and both text views of the card index — and this is the rendering for
 * the one place a stone cannot go, which is under a picture. Forty stones
 * scattered across a grid of forty card faces are forty objects competing with
 * the art they are captioning; an underline is a caption's mark and reads as
 * belonging to the name above it.
 *
 * A BAND PER PITCH VALUE, WHICH IS WHY IT IS PLURAL. A cell in a card index
 * stands for a NAME, and a name in this game is commonly three cards — Head Jab
 * red, yellow and blue. The grid this replaces said so in words ("pitch 1,
 * pitch 2"), which is four times the ink for a fact three coloured bands state
 * at a glance, and it said it only when SOME versions matched, so the ordinary
 * case rendered nothing at all and the reader had no way to tell a
 * single-version card from a collapsed one.
 *
 * THE COLOUR IS NOT THE ONLY CHANNEL, AND THAT MATTERS MORE HERE THAN ANYWHERE.
 * `PitchJewel` records the reason at length: red and yellow are the classic
 * deuteranopia confusion pair, and pitch is the most-read value on a card. A
 * band has no room for a numeral, so the redundancy moves to the accessible
 * layer — the element is a `role="img"` with a written name, always, and the
 * name spells the values out ("Pitch 1, 2 and 3"). That is a real reduction in
 * what a sighted colour-blind reader gets from the GRID, and it is the stated
 * cost of the trade rather than an oversight: the COUNT and the ORDER of the
 * bands are both non-colour channels — they are laid out ascending, so the
 * leftmost band is always the lowest pitch — the two text views of the same
 * index carry numbered stones instead, and the card page one click away carries
 * the jewel too.
 *
 * WIDTH IS FIXED PER BAND RATHER THAN SPLIT ACROSS THE NAME. A rule whose
 * segments divided the name's width would make one band mean "pitch 1" under a
 * short name and "pitch 1" at three times the length under a long one, so the
 * same fact would render at a different weight in every cell. Fixed bands read
 * as a legend, which is what they are.
 */

import type { PitchValue } from "optfall-theme";

import "./PitchRule.css";

export interface PitchRuleProps {
  /**
   * The pitch values this row stands for. Deduplicated and sorted ascending
   * before rendering, so a caller cannot produce two orderings of one fact.
   *
   * `0` is a card with no pitch value — equipment, weapons — and renders in the
   * `none` tone rather than rendering nothing, exactly as the jewel renders a
   * grey stone with a dash. An EMPTY array is the different claim that no pitch
   * is known, and renders nothing at all.
   */
  readonly values: readonly PitchValue[];
  readonly size?: "sm" | "md";
  /** Accessible name. Defaults to the values spoken in full. */
  readonly label?: string;
}

const TONES = ["none", "one", "two", "three"] as const;

/**
 * `[1, 2, 3]` → `"Pitch 1, 2 and 3"`. Written, never generated from a join.
 *
 * IT HAS TO NAME EVERY BAND IT DRAWS, and an earlier version did not. It
 * dropped `0` before composing, while the component went on rendering a
 * `tone-none` band for it — so a row carrying both drew four bands and
 * announced three. That is not a cosmetic mismatch here: this label is the
 * ONLY non-colour channel the images view has, so a band it does not mention
 * is a pitch value a screen-reader user is not told about.
 *
 * The mixed row is real rather than hypothetical. `cards.ts` documents Hyper
 * Driver — a pitch-0 token sharing its name with three pitched actions — and
 * `unique:names` collapses that group to `[0, 1, 2, 3]`.
 */
function spokenFor(values: readonly PitchValue[]): string {
  const real = values.filter((value) => value !== 0);
  const none = values.length > real.length;

  if (real.length === 0) return "No pitch value";

  const last = real[real.length - 1];
  const pitched =
    real.length === 1
      ? `Pitch ${last}`
      : `Pitch ${real.slice(0, -1).join(", ")} and ${last}`;

  /* The no-pitch band is drawn FIRST, because the values are sorted ascending
     and zero is the lowest — so it is named first too. */
  return none ? `No pitch value, and ${pitched.toLowerCase()}` : pitched;
}

export function PitchRule({ values, size = "md", label }: PitchRuleProps) {
  /*
   * Sorted and deduplicated HERE rather than trusted from the caller. The two
   * consumers assemble these lists from different sources — a search collapses
   * pitch versions of a matched name, a set page walks a set's printings — and
   * a cell that rendered blue before red would be stating the same fact in a
   * different order on the same screen. Deduplication matters for the set page
   * in particular: a card printed twice in one set arrives with its pitch twice.
   */
  const shown = [...new Set(values)].toSorted((a, b) => a - b);

  if (shown.length === 0) return null;

  /*
   * `?.trim() ||`, not `??`, for the reason `PitchJewel` sets out: a default
   * that only fires on `undefined` is one a caller can displace with `""`,
   * leaving `aria-label=""` on a `role="img"` whose meaning is carried by fill
   * colour alone. Here that would be the whole of the information.
   */
  const spoken = label?.trim() || spokenFor(shown);

  return (
    <span
      className={`of-pitch-rule of-pitch-rule--${size}`}
      role="img"
      aria-label={spoken}
    >
      {shown.map((value) => (
        <span
          key={value}
          className={`of-pitch-rule__band of-pitch-rule__band--tone-${TONES[value] ?? "none"}`}
        />
      ))}
    </span>
  );
}
