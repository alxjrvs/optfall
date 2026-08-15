/**
 * The brass seal — judge attribution on a verified ruling. React port.
 *
 * This is the single place brass is allowed to appear. `docs/DESIGN.md`: "Brass
 * is reserved for authority — the verified seal and nothing else. A material
 * used once is a signal; used twice it is a theme." So a second component
 * reaching for `color.brass` is not a styling choice, it is the signal being
 * spent. Nothing else may consume `--of-color-brass`, `--of-color-brass-ink` or
 * `--of-color-brass-edge`.
 *
 * **There is no `label` prop, and its absence is the same argument the reference
 * makes for having one.** `PitchJewel` takes a label because a jewel is a glyph
 * whose meaning lives outside its markup. Here the three facts that *are* the
 * accessible name are already required props, so the name is composed rather
 * than supplied — there is no spelling of `<BrassSeal />` that renders an
 * unnamed seal, which is strictly better than a default a caller can override to
 * nothing.
 *
 * **The rules version is a first-class field, not a parenthetical.**
 * `docs/PLAN.md` Phase 5: "every entry records the rules version it was answered
 * under; a bump flags it for review rather than silently serving stale law". A
 * version that a reader has to hunt for cannot do that job, so it gets its own
 * struck band across the foot of the plate rather than a trailing note in small
 * text.
 *
 * **Colour never carries the claim.** The word "Verified" is rendered as text,
 * so the brass says the same thing the plate already says. A reader who cannot
 * see the material loses nothing.
 */

import "./BrassSeal.css";

export interface BrassSealProps {
  /** The judge's name, exactly as they gave it. */
  readonly judge: string;
  /** Date the ruling was given, `YYYY-MM-DD`. */
  readonly date: string;
  /** The rules version the ruling was answered under. */
  readonly rulesVersion: string;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * `YYYY-MM-DD` expanded to "14 March 2026", by hand.
 *
 * Deliberately NOT `new Date(date).toLocaleDateString()`. A bare `YYYY-MM-DD` is
 * parsed as UTC midnight, so anywhere west of Greenwich that round-trip renders
 * the *previous day* — a ruling dated the 14th displayed as the 13th to a reader
 * in Los Angeles. On a surface whose entire value is being citable, a date that
 * changes with the reader's timezone is not a cosmetic bug. The `dateTime`
 * attribute below still carries the exact machine form, so nothing is lost by
 * formatting the visible text ourselves.
 *
 * An unparseable value renders as given rather than as "Invalid Date": if
 * upstream data is malformed, showing it is how anyone finds out.
 */
function readableDate(date: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return date;
  const [, year, month, day] = parts;
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name} ${year}` : date;
}

export function BrassSeal({ judge, date, rulesVersion }: BrassSealProps) {
  /*
    One statement, not three fragments.

    The visible plate is laid out as an eyebrow, a name, a date and a version
    band — read in isolation those are four orphan strings in a list of rulings.
    The joiner spans are the connective tissue: real text, in the accessibility
    tree in reading order, hidden only from sight. The seal therefore announces

        "Verified by Elena Ruiz on 14 March 2026, under rules version 2.11.0"

    as one sentence, while every visible element stays genuine text — selectable,
    translatable, and never duplicated into an `aria-label` that would drift from
    what is on screen. Only the version label is hidden from assistive
    technology, because the joiner ahead of it already says "rules version" and
    the visible label would otherwise be read twice.
  */
  return (
    <p className="of-seal">
      <span className="of-seal__face">
        <span className="of-seal__claim">Verified</span>
        <span className="of-seal__joiner"> by </span>
        <span className="of-seal__judge">{judge}</span>
        <span className="of-seal__joiner"> on </span>
        <time className="of-seal__date" dateTime={date}>
          {readableDate(date)}
        </time>
      </span>
      <span className="of-seal__joiner">, under rules version </span>
      <span className="of-seal__band">
        <span className="of-seal__version-label" aria-hidden="true">
          Rules version
        </span>
        <span className="of-seal__version">{rulesVersion}</span>
      </span>
    </p>
  );
}
