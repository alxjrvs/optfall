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
 * THE COLOUR IS NOT THE ONLY CHANNEL, AND IT WAS ONCE. The band shipped
 * wordless on the argument that it had no room for a numeral, with the
 * redundancy pushed onto the accessible layer — a `role="img"` whose written
 * name spells the values out. That was fine for a screen reader and not fine
 * for a sighted reader who cannot separate red from yellow: they are the
 * classic deuteranopia confusion pair, pitch is the most-read value on a card,
 * and the grid is the one view with no jewel in it to fall back on. It was the
 * exact failure `PitchJewel` was drawn to avoid, one surface over.
 *
 * So the band makes room. It is tall enough to seat a digit and carries one,
 * which is the smallest change that gives the redundant channel back without
 * turning the mark into a second cut stone — still wider than tall, still
 * square-cornered, still struck top and bottom, still reading as an underline
 * under a name. The written name stays; the numeral is `aria-hidden` because it
 * is the sighted half of the same fact.
 *
 * The COUNT and the ORDER remain non-colour channels too — bands are laid out
 * ascending, so the leftmost is always the lowest pitch.
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
 * announced three. That is not a cosmetic mismatch: a band this label does not
 * mention is a pitch value a screen-reader user is not told about, and the band
 * itself is `aria-hidden`, so nothing else in the accessibility tree covers for
 * it.
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
        >
          {/*
            THE NUMERAL IS INSIDE THE BAND, and it is what lets this be the only
            pitch mark on a surface.

            Without it the band carried its value in hue alone, and the grid —
            the one view with no jewel in it — separated two same-named cells by
            colour and nothing else. Red and yellow are the classic deuteranopia
            confusion pair and pitch is the most-read value on a card, so that
            was precisely the failure `PitchJewel` exists to avoid, reintroduced
            one surface over.

            `aria-hidden`, because the wrapper is already a `role="img"` with the
            values spoken in full. This is the SIGHTED reader's redundant
            channel, which is the one that was missing.

            Zero draws the dash the jewel draws, for the reason it does there: an
            absence should read as an absence rather than as a numeral.
          */}
          <span className="of-pitch-rule__glyph" aria-hidden="true">
            {value === 0 ? "–" : value}
          </span>
        </span>
      ))}
    </span>
  );
}
