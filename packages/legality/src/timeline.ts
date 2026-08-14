/**
 * Timeline mechanics — *what was this card's status on this day?*
 *
 * This module is the date logic underneath `isLegal`'s `asOf` parameter. It
 * holds no card data, no format rules and no banned list; it answers one
 * question against a {@link LegalityTimeline}, and it is deliberately the most
 * pedantic file in the package because every off-by-one here becomes a wrong
 * legality verdict for somebody's tournament.
 *
 * ## The rule that outranks the others
 *
 * **"This card was legal then" and "we have no record for then" are different
 * answers, and this module will never conflate them.** {@link statusAsOf}
 * returns a discriminated union, not a status: the {@link NoRecord} branch has
 * no `status` field and no `legal` field, so a caller physically cannot read a
 * status off an unknown answer without first narrowing on `kind`. There is
 * deliberately **no** `legalOn(): boolean` convenience wrapper anywhere in this
 * file — a boolean has two inhabitants and this question has three answers, so
 * any such helper would have to silently pick a lie for the third. If a
 * consumer wants one, they can write it themselves and own the choice.
 *
 * ## The boundary decisions, each made deliberately
 *
 * 1. **`effectiveFrom` is INCLUSIVE.** A ban effective 2026-03-14 applies to
 *    an event held on 2026-03-14. Announcements say "effective from <date>",
 *    and a player at a table on that date is bound by it.
 * 2. **`effectiveUntil` is EXCLUSIVE.** The interval is half-open,
 *    `[effectiveFrom, effectiveUntil)`. See {@link coversDate} for the full
 *    argument; the short version is that it makes consecutive intervals abut
 *    exactly, with no gap and no double-cover, on precisely the day that a
 *    status changes — which is the day people query.
 * 3. **Overlapping entries for the same card and format are INVALID INPUT.**
 *    They are a dataset defect, reported by {@link validateTimeline}. At query
 *    time, entries that disagree produce a {@link ConflictingRecords} result
 *    rather than a silently chosen winner, because silently choosing is exactly
 *    the confident-wrong-answer failure this project exists to prevent.
 * 4. **A query before any record is {@link NoRecord}, never "legal".** The
 *    timeline records status *changes*; the absence of a change is not evidence
 *    of legality, and this module has no standing to claim otherwise.
 *
 * ## What this module cannot know, stated rather than hidden
 *
 * - **The dataset's own coverage floor.** {@link LegalityTimeline} declares no
 *   "covers from" date, so a query before the earliest entry *for a given card*
 *   is reported as {@link NoRecordReason} `"before-first-record"` — but a query
 *   before the whole dataset's backfill horizon is indistinguishable from one
 *   for a card that simply was never banned. Both surface as no-record, which
 *   is honest but coarse. Narrowing it needs a field the published type does
 *   not have.
 * - **Whether "no record" means "legal".** For the real published dataset it
 *   very often will. Deciding that is a policy call for the layer that also
 *   knows the card set and the format's legal card pool. It is not made here.
 *
 * ## Provenance of the rules encoded here
 *
 * This module contains **no** card names, ban dates, deck sizes or format
 * constraints, and asserts nothing about Flesh and Blood. It is interval
 * arithmetic over whatever a dataset says. The one place it makes a claim
 * about the outside world is the inclusivity of `effectiveFrom`, and that
 * claim is marked UNVERIFIED at {@link coversDate}.
 *
 * @module
 */

import { isCardStatus, isFormatId, isIsoDate } from "./index";
import type {
  CardId,
  CardStatus,
  FormatId,
  IsoDate,
  LegalityTimeline,
  TimelineEntry,
} from "./index";

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Thrown when the *dataset* is malformed, as opposed to the caller's arguments
 * (which throw `TypeError`).
 *
 * This is deliberately loud. A malformed date in a published timeline is a
 * build-time defect that {@link validateTimeline} exists to catch in CI before
 * publication; if one reaches a query it must stop the caller rather than be
 * quietly skipped, because a skipped ban entry reads as "no record" and a
 * dataset that loses bans silently is worse than one that crashes.
 */
export class TimelineDataError extends Error {
  /** The offending entry, when the defect is attributable to exactly one. */
  readonly entry: TimelineEntry | undefined;

  constructor(message: string, entry?: TimelineEntry) {
    super(message);
    this.name = "TimelineDataError";
    this.entry = entry;
  }
}

/* -------------------------------------------------------------------------- */
/* Date primitives                                                             */
/* -------------------------------------------------------------------------- */

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Chronological comparison of two ISO calendar dates, `-1 | 0 | 1`.
 *
 * `YYYY-MM-DD` is fixed-width and big-endian, so lexicographic order **is**
 * chronological order — no `Date` construction, no timezone, no parsing cost.
 * That equivalence holds only for well-formed input, which is why every public
 * entry point in this module validates before it compares.
 */
export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * The calendar day before `date`, in UTC.
 *
 * Needed because this module's interval end is exclusive but a human-facing
 * "legal until" is inclusive: the last day covered by `[from, until)` is
 * `previousDay(until)`. Doing that subtraction in one audited place is the
 * point — an ad-hoc `-1` at a call site is how off-by-ones are born.
 *
 * @throws {TypeError} When `date` is not a real `YYYY-MM-DD` calendar date.
 */
export function previousDay(date: IsoDate): IsoDate {
  assertIsoDateArgument(date, "date");
  const millis = Date.parse(`${date}T00:00:00.000Z`) - MILLISECONDS_PER_DAY;
  return new Date(millis).toISOString().slice(0, 10);
}

function assertIsoDateArgument(value: IsoDate, label: string): void {
  if (!isIsoDate(value)) {
    throw new TypeError(
      `${label} must be an ISO 8601 calendar date (YYYY-MM-DD); received ${JSON.stringify(value)}.`,
    );
  }
}

function assertEntryDates(entry: TimelineEntry): void {
  if (!isIsoDate(entry.effectiveFrom)) {
    throw new TimelineDataError(
      `timeline entry for ${JSON.stringify(entry.cardId)} in ${JSON.stringify(entry.format)} has a malformed effectiveFrom: ${JSON.stringify(entry.effectiveFrom)}.`,
      entry,
    );
  }
  if (entry.effectiveUntil !== undefined && !isIsoDate(entry.effectiveUntil)) {
    throw new TimelineDataError(
      `timeline entry for ${JSON.stringify(entry.cardId)} in ${JSON.stringify(entry.format)} has a malformed effectiveUntil: ${JSON.stringify(entry.effectiveUntil)}.`,
      entry,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* The interval predicate                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Whether `entry` governs `asOf`.
 *
 * The interval is **half-open**: `effectiveFrom <= asOf < effectiveUntil`, with
 * an absent `effectiveUntil` meaning "still current" and therefore unbounded.
 *
 * ### Why `effectiveFrom` is inclusive
 *
 * Because a ban announced as effective on a date applies at events held on that
 * date. The alternative has no constituency.
 *
 * **UNVERIFIED:** the exact wording LSS uses on its announcements ("effective
 * from", "effective as of", a separate "in effect for events on or after")
 * has *not* been read from a retrieved announcement — `fabtcg.com` returns 403
 * to automated fetches and the archived captures have not been parsed yet
 * (`docs/PHASE-2-STATUS.md`). Inclusive is the reading this module implements
 * and the reading a judge would apply; it is not quoted from a source. When
 * the banned-list scrape lands, confirm it against one real announcement and
 * delete this note — or change the semantics if it turns out otherwise.
 *
 * ### Why `effectiveUntil` is exclusive
 *
 * The name reads inclusive — "until" — and that tension is real, but the field
 * belongs to a published type this module does not own, so the semantics get
 * documented rather than renamed. Exclusive wins on the merits:
 *
 * - **Consecutive intervals abut exactly.** A status that changes on
 *   2026-03-14 is encoded as `{ until: "2026-03-14" }` on the old entry and
 *   `{ from: "2026-03-14" }` on the new one. Every day is covered by exactly
 *   one interval, with no gap and no overlap, and the arithmetic that produces
 *   the pair is `until = successor.from` — no subtraction, so no off-by-one.
 * - **Inclusive would make the change day ambiguous.** Encoded the same natural
 *   way, both entries would claim 2026-03-14 — a conflict on precisely the day
 *   a judge is most likely to be asking about. Avoiding that would demand every
 *   dataset author remember to subtract a day, forever, correctly.
 * - **It is the convention every other half-open range in software uses**, so
 *   the surprising choice is the one that needs the defence.
 *
 * The cost is a specific, predictable authoring error: writing `effectiveUntil`
 * as "the last day this status held". Its signature is a zero-length interval
 * (`until === from`) or an interval ending one day short, and
 * {@link validateTimeline} flags the zero-length case explicitly for that
 * reason.
 *
 * ### An inverted or zero-length interval covers nothing
 *
 * `until <= from` yields `false` for every date rather than throwing. That
 * fails toward *unknown*, never toward a confident status — the safe direction
 * — while {@link validateTimeline} reports the defect loudly at build time,
 * which is where a malformed dataset should be caught.
 *
 * @throws {TimelineDataError} When either of the entry's dates is malformed.
 * @throws {TypeError} When `asOf` is not a real calendar date.
 */
export function coversDate(entry: TimelineEntry, asOf: IsoDate): boolean {
  assertIsoDateArgument(asOf, "asOf");
  assertEntryDates(entry);
  if (compareIsoDates(asOf, entry.effectiveFrom) < 0) return false;
  if (entry.effectiveUntil === undefined) return true;
  return compareIsoDates(asOf, entry.effectiveUntil) < 0;
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                     */
/* -------------------------------------------------------------------------- */

/** One card in one format — the pair a timeline is keyed by. */
export interface TimelineSelector {
  readonly cardId: CardId;
  readonly format: FormatId;
}

/**
 * A point-in-time question.
 *
 * An object rather than positional arguments on purpose: `cardId` and `format`
 * are both strings, and a positional API invites a silent swap that the type
 * system cannot catch once either side is held in a `string` variable.
 */
export interface TimelineQuery extends TimelineSelector {
  /** The date to judge against, `YYYY-MM-DD`, interpreted as UTC. */
  readonly asOf: IsoDate;
}

/* -------------------------------------------------------------------------- */
/* Results                                                                     */
/* -------------------------------------------------------------------------- */

/** Why the timeline has nothing to say about this card on this date. */
export type NoRecordReason =
  /**
   * The timeline holds no entry at all for this card in this format. Not a
   * claim that the card is legal, and not a claim that it does not exist: the
   * timeline records status *changes*, so a card that was never banned is
   * expected to be absent from it entirely.
   */
  | "no-entries-for-card"
  /**
   * Entries exist, but `asOf` falls before the earliest of them. The card's
   * status on that date is genuinely unrecorded — and note this is also what a
   * query before the dataset's whole backfill horizon looks like.
   */
  | "before-first-record"
  /**
   * `asOf` falls in a hole between two recorded intervals. Common and not
   * necessarily a defect: a dataset that records only the non-legal intervals
   * has a hole wherever the card was unremarkable.
   */
  | "between-records"
  /**
   * Every recorded interval for this card has ended, and `asOf` is after all of
   * them. Whatever happened next was not recorded.
   */
  | "after-last-record";

interface TimelineLookupBase {
  readonly cardId: CardId;
  readonly format: FormatId;
  readonly asOf: IsoDate;
  /**
   * True when `asOf` is later than the timeline's `generatedAt` — the answer
   * describes a *future* date, so it reflects only announcements published
   * before the dataset was built and a later announcement can still change it.
   *
   * Surfacing this is the type-level half of the plan's "degrade visibly" rule:
   * a verdict about next month is not the same kind of fact as a verdict about
   * last month, and a caller should be able to say so.
   */
  readonly provisional: boolean;
}

/** The timeline records exactly one status for this card on this date. */
export interface RecordedStatus extends TimelineLookupBase {
  readonly kind: "recorded";
  readonly status: CardStatus;
  /**
   * True only when `status` is `"legal"`. Denormalised to match
   * `CardVerdict.legal`, and reachable only after narrowing to this branch —
   * which is the entire point of the union.
   */
  readonly legal: boolean;
  /**
   * The entry that produced this answer, and therefore the one whose `citation`
   * a verdict should quote. Its own `effectiveFrom` / `effectiveUntil` are the
   * boundaries of that *entry*; {@link since} and {@link until} below are the
   * boundaries of the *status*, and the two differ whenever consecutive entries
   * agree.
   */
  readonly entry: TimelineEntry;
  /**
   * Every entry covering `asOf`, oldest first. Normally exactly one. More than
   * one means redundant entries that agree on the status — a defect
   * {@link validateTimeline} reports, but not an ambiguity, so the answer
   * stands and all citations are retained rather than dropped.
   */
  readonly entries: readonly TimelineEntry[];
  /**
   * The first day this status held without interruption — the start of the
   * maximal run of contiguous coverage that agrees on the status, not merely
   * the start of {@link entry}.
   *
   * A card banned on 2024-01-01 whose ban is restated by a second announcement
   * on 2025-06-01 has been banned *since 2024*, and `CardVerdict.since` means
   * "when the current status took effect". Reporting the later entry's own
   * start would answer a different question than the field name asks.
   */
  readonly since: IsoDate;
  /**
   * The first day this status no longer holds, exclusive. `undefined` while the
   * status is current or open-ended. For an inclusive "legal until" date, use
   * `previousDay(until)`.
   *
   * This is the end of the same maximal same-status run, for a reason that took
   * a defect to notice: two abutting entries that agree — `{legal, until
   * 2021-01-01}` followed by `{legal, from 2021-01-01}` — pass
   * {@link validateTimeline} with no complaint at all, and reporting the first
   * entry's own boundary would have produced a "legal until 2020-12-31" for a
   * card that was still legal in 2030. The run is clipped at the first entry
   * that records a *different* status, so a disagreement in the dataset can
   * only shorten this date, never extend it.
   */
  readonly until: IsoDate | undefined;
}

/**
 * The timeline has no record for this card on this date.
 *
 * Note what is **not** here: no `status`, no `legal`. Reading either requires
 * narrowing on `kind`, so unknown cannot be mistaken for legal by accident —
 * the mistake has to be typed out deliberately.
 */
export interface NoRecord extends TimelineLookupBase {
  readonly kind: "no-record";
  readonly reason: NoRecordReason;
  /**
   * The earliest `effectiveFrom` recorded for this card and format, when any
   * entry exists. Lets a surface say where coverage begins instead of only
   * that it is missing.
   */
  readonly earliestRecord: IsoDate | undefined;
}

/**
 * Two or more entries cover this date and **disagree** about the status.
 *
 * This is invalid input, surfaced rather than resolved. Any tie-break rule here
 * — latest announcement wins, most restrictive wins — would be a guess wearing
 * the costume of an answer, and would hide a dataset defect behind a verdict a
 * judge might rely on. The caller is handed the contradiction and must decide
 * what to do with it; there is no status to read.
 */
export interface ConflictingRecords extends TimelineLookupBase {
  readonly kind: "conflict";
  /** Every covering entry, oldest first. At least two. */
  readonly entries: readonly TimelineEntry[];
  /** The distinct statuses in contention, in the order first encountered. */
  readonly statuses: readonly CardStatus[];
}

/**
 * The answer to "what was this card's status on this day" — three-valued,
 * because the question is.
 */
export type TimelineLookup = RecordedStatus | NoRecord | ConflictingRecords;

/** Narrows a {@link TimelineLookup} to the branch that carries a status. */
export function isRecorded(lookup: TimelineLookup): lookup is RecordedStatus {
  return lookup.kind === "recorded";
}

/** Narrows a {@link TimelineLookup} to the branch that carries no status. */
export function isNoRecord(lookup: TimelineLookup): lookup is NoRecord {
  return lookup.kind === "no-record";
}

/** Narrows a {@link TimelineLookup} to the contradictory-data branch. */
export function isConflict(
  lookup: TimelineLookup,
): lookup is ConflictingRecords {
  return lookup.kind === "conflict";
}

/* -------------------------------------------------------------------------- */
/* Ordering                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Compares two exclusive end boundaries, treating `undefined` as unbounded and
 * therefore the greatest value. Ascending.
 */
function compareEnds(a: IsoDate | undefined, b: IsoDate | undefined): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return compareIsoDates(a, b);
}

/** Chronological order: earliest start first, then earliest end. */
function chronologically(a: TimelineEntry, b: TimelineEntry): number {
  const byStart = compareIsoDates(a.effectiveFrom, b.effectiveFrom);
  if (byStart !== 0) return byStart;
  return compareEnds(a.effectiveUntil, b.effectiveUntil);
}

/**
 * Precedence order for picking the governing entry among several that agree:
 * **widest coverage first** — latest end (unbounded winning), then latest
 * start, then original array order.
 *
 * End before start, and that order is the fix for a real defect. Ranking by
 * latest start first let a narrow entry nested inside a wider one outrank it:
 * `{legal, from 2020, open-ended}` plus `{legal, 2021-01 to 2021-02}` made the
 * governing entry the nested one, so a card legal forever reported an end
 * boundary of 2021-02-01, and the reported boundary moved backwards and
 * forwards as `asOf` walked through the year. Preferring the widest interval
 * makes the answer monotone in the only direction that matters.
 *
 * `Array.prototype.toSorted` is required to be stable, so leaving full ties to
 * fall through preserves the dataset's own ordering — deterministic, and
 * auditable against the published JSON rather than dependent on an engine's
 * sort.
 *
 * This is a *presentation* choice among entries that already agree on the
 * status, never a tie-break between entries that disagree. Those are a
 * {@link ConflictingRecords}.
 */
function byPrecedence(a: TimelineEntry, b: TimelineEntry): number {
  const byEnd = compareEnds(b.effectiveUntil, a.effectiveUntil);
  if (byEnd !== 0) return byEnd;
  return compareIsoDates(b.effectiveFrom, a.effectiveFrom);
}

/* -------------------------------------------------------------------------- */
/* Interval unions                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Whether an entry covers at least one day.
 *
 * A zero-length or inverted interval covers nothing (see {@link coversDate}),
 * so it must not be allowed to bridge a gap between two real intervals and
 * silently extend a run across it.
 */
function isInhabited(entry: TimelineEntry): boolean {
  return (
    entry.effectiveUntil === undefined ||
    compareIsoDates(entry.effectiveFrom, entry.effectiveUntil) < 0
  );
}

function earlierStart(a: IsoDate, b: IsoDate): IsoDate {
  return compareIsoDates(a, b) <= 0 ? a : b;
}

function laterEnd(
  a: IsoDate | undefined,
  b: IsoDate | undefined,
): IsoDate | undefined {
  return compareEnds(a, b) >= 0 ? a : b;
}

/** A half-open span `[start, end)`, with `undefined` meaning unbounded. */
interface Span {
  readonly start: IsoDate;
  readonly end: IsoDate | undefined;
}

/**
 * The maximal contiguous span around `asOf` built only from entries the
 * predicate accepts.
 *
 * Contiguity is by touching *or* overlapping: `[a, b)` and `[b, c)` join,
 * because that is exactly how a status change with no gap is encoded. The loop
 * runs to a fixpoint rather than in one pass because the dataset's own order
 * says nothing about which entry extends which — histories are a handful of
 * entries per card, so the cost is irrelevant and the correctness is not.
 */
function spanAround(
  seed: readonly TimelineEntry[],
  candidates: readonly TimelineEntry[],
  accept: (entry: TimelineEntry) => boolean,
): Span {
  const first = seed[0];
  if (first === undefined) {
    throw new TimelineDataError(
      "cannot build a span from an empty set of covering entries.",
    );
  }

  let start = first.effectiveFrom;
  let end = first.effectiveUntil;
  for (const entry of seed) {
    start = earlierStart(start, entry.effectiveFrom);
    end = laterEnd(end, entry.effectiveUntil);
  }

  const merged = new Set<TimelineEntry>(seed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const entry of candidates) {
      if (merged.has(entry) || !isInhabited(entry) || !accept(entry)) continue;

      const startsByEnd =
        end === undefined || compareIsoDates(entry.effectiveFrom, end) <= 0;
      const endsAfterStart =
        entry.effectiveUntil === undefined ||
        compareIsoDates(entry.effectiveUntil, start) >= 0;
      if (!startsByEnd || !endsAfterStart) continue;

      merged.add(entry);
      start = earlierStart(start, entry.effectiveFrom);
      end = laterEnd(end, entry.effectiveUntil);
      grew = true;
    }
  }

  return { start, end };
}

/**
 * Narrows a same-status span so it never runs through a day on which some other
 * entry records a *different* status.
 *
 * Such an entry cannot cover `asOf` itself — that is a
 * {@link ConflictingRecords} and is handled before this is reached — so it lies
 * wholly on one side, and clipping is unambiguous. Clipping only ever shortens
 * the span: a contradictory dataset can make Optfall claim less, never more.
 */
function clipToDisagreement(
  span: Span,
  history: readonly TimelineEntry[],
  asOf: IsoDate,
  status: CardStatus,
): Span {
  let { start, end } = span;

  for (const entry of history) {
    if (entry.status === status || !isInhabited(entry)) continue;

    if (
      entry.effectiveUntil !== undefined &&
      compareIsoDates(entry.effectiveUntil, asOf) <= 0
    ) {
      if (compareIsoDates(entry.effectiveUntil, start) > 0)
        start = entry.effectiveUntil;
    } else if (compareIsoDates(entry.effectiveFrom, asOf) > 0) {
      if (compareEnds(entry.effectiveFrom, end) < 0) end = entry.effectiveFrom;
    }
  }

  return { start, end };
}

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

function assertEntries(timeline: LegalityTimeline): readonly TimelineEntry[] {
  if (!Array.isArray(timeline.entries)) {
    throw new TypeError(
      `timeline.entries must be an array; received ${JSON.stringify(timeline.entries)}.`,
    );
  }
  return timeline.entries;
}

/**
 * Every entry for one card in one format, in chronological order.
 *
 * Matching is exact string equality on both keys. This module never normalises
 * a card id or a format name: inventing an equivalence between two identifiers
 * is how a checker starts answering questions about a card it was not asked
 * about.
 *
 * @throws {TimelineDataError} When a matching entry has a malformed date.
 */
export function historyFor(
  timeline: LegalityTimeline,
  selector: TimelineSelector,
): readonly TimelineEntry[] {
  const matches = assertEntries(timeline).filter(
    (entry) =>
      entry.cardId === selector.cardId && entry.format === selector.format,
  );
  for (const entry of matches) assertEntryDates(entry);
  return matches.toSorted(chronologically);
}

/**
 * The next date on which the timeline's answer changes.
 *
 * Three-armed for the same reason {@link TimelineLookup} is: "the record stops
 * here" is not "nothing changes", and a two-valued return forces one of them to
 * be told as the other.
 *
 * - `"entry"` — an announcement takes effect on {@link NextChange.on}.
 * - `"record-ends"` — coverage runs out on that date with nothing recorded
 *   after it. {@link statusAsOf} answers `no-record` from then on. This is a
 *   gap in Optfall's data, not a fact about the card.
 * - `"none"` — coverage is open-ended, or `asOf` is already past everything
 *   recorded. Nothing further is known either way.
 */
export type NextChange =
  | {
      readonly kind: "entry";
      /** The date the entry takes effect. Inclusive, like every `effectiveFrom`. */
      readonly on: IsoDate;
      readonly entry: TimelineEntry;
    }
  | {
      readonly kind: "record-ends";
      /** The first day no entry covers. Exclusive end of the current coverage. */
      readonly on: IsoDate;
    }
  | { readonly kind: "none" };

/**
 * The exclusive end of the contiguous coverage containing `asOf`, of whatever
 * status; `undefined` when `asOf` is uncovered or the coverage is open-ended.
 */
function coverageEnd(
  history: readonly TimelineEntry[],
  asOf: IsoDate,
): IsoDate | undefined {
  const covering = history.filter((entry) => coversDate(entry, asOf));
  if (covering.length === 0) return undefined;
  return spanAround(covering, history, () => true).end;
}

/**
 * When the timeline's answer for this card and format next changes, strictly
 * after `asOf`.
 *
 * "Strictly after" follows from `effectiveFrom` being inclusive: an entry
 * beginning *on* `asOf` is already in force and is therefore not a future
 * change.
 *
 * The caller decides which changes matter — this reports the next change of any
 * status, because whether a change ends legality depends on format rules this
 * module does not hold. `previousDay(change.on)` is the inclusive last day the
 * current answer holds, and that is true for both the `"entry"` and the
 * `"record-ends"` arm.
 *
 * The end of a closed interval counts as a change, and getting that wrong is
 * what this signature exists to prevent. A dataset holding `{legal, 2020-01-01
 * to 2021-01-01}` and then `{banned, from 2023-01-01}` passes
 * {@link validateTimeline} clean; an earlier version of this function looked
 * only at `effectiveFrom`, returned the 2023 entry, and so reported the card as
 * legal across 730 days it has no record of whatsoever — the precise
 * no-record-becomes-legal conflation this module's header promises never to
 * make.
 */
export function nextChange(
  timeline: LegalityTimeline,
  query: TimelineQuery,
): NextChange {
  assertIsoDateArgument(query.asOf, "asOf");
  const history = historyFor(timeline, query);

  const upcoming = history.find(
    (entry) => compareIsoDates(entry.effectiveFrom, query.asOf) > 0,
  );
  const ends = coverageEnd(history, query.asOf);

  // When an entry begins exactly where coverage ends, the two abut and the
  // change is the announcement, not a gap. Only a strictly later entry leaves a
  // hole, and then the hole is what happens next.
  const abutsOrPrecedes =
    ends === undefined ||
    compareIsoDates(upcoming?.effectiveFrom ?? ends, ends) <= 0;
  if (upcoming !== undefined && abutsOrPrecedes) {
    return { kind: "entry", on: upcoming.effectiveFrom, entry: upcoming };
  }
  if (ends !== undefined) return { kind: "record-ends", on: ends };
  return { kind: "none" };
}

/* -------------------------------------------------------------------------- */
/* The lookup                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * What the timeline records for one card, in one format, on one date.
 *
 * Read the module header before changing anything here; every branch below is
 * a decision with a written justification attached.
 *
 * @throws {TypeError} When `query.asOf` is malformed, or `timeline.entries` is
 *   not an array.
 * @throws {TimelineDataError} When `timeline.generatedAt` or a relevant entry
 *   date is malformed.
 */
export function statusAsOf(
  timeline: LegalityTimeline,
  query: TimelineQuery,
): TimelineLookup {
  assertIsoDateArgument(query.asOf, "asOf");
  if (!isIsoDate(timeline.generatedAt)) {
    throw new TimelineDataError(
      `timeline.generatedAt must be an ISO 8601 calendar date (YYYY-MM-DD); received ${JSON.stringify(timeline.generatedAt)}.`,
    );
  }

  const provisional = compareIsoDates(query.asOf, timeline.generatedAt) > 0;
  const base = {
    cardId: query.cardId,
    format: query.format,
    asOf: query.asOf,
    provisional,
  } as const;

  const history = historyFor(timeline, query);

  if (history.length === 0) {
    return {
      ...base,
      kind: "no-record",
      reason: "no-entries-for-card",
      earliestRecord: undefined,
    };
  }

  // `history` is chronological, so the first element carries the earliest start.
  const earliestRecord = history[0]?.effectiveFrom;

  const covering = history.filter((entry) => coversDate(entry, query.asOf));

  if (covering.length === 0) {
    return {
      ...base,
      kind: "no-record",
      reason: gapReason(history, query.asOf),
      earliestRecord,
    };
  }

  const statuses: CardStatus[] = [];
  for (const entry of covering) {
    if (!statuses.includes(entry.status)) statuses.push(entry.status);
  }

  if (statuses.length > 1) {
    return { ...base, kind: "conflict", entries: covering, statuses };
  }

  // Every covering entry agrees, so there is a real answer; picking which one
  // to cite among duplicates is presentation, not adjudication.
  const governing = covering.toSorted(byPrecedence)[0];
  if (governing === undefined) {
    // Unreachable: `covering.length > 0` was checked above. Kept because
    // `noUncheckedIndexedAccess` is on and a thrown error beats a non-null
    // assertion that a future edit could quietly make wrong.
    throw new TimelineDataError(
      "timeline lookup found covering entries but no governing entry.",
    );
  }

  // `since` and `until` describe the STATUS, not the governing entry: a status
  // restated by a second announcement did not restart on the day of that
  // announcement, and one continued by an abutting entry does not end on the
  // day of the handover.
  const run = clipToDisagreement(
    spanAround(covering, history, (entry) => entry.status === governing.status),
    history,
    query.asOf,
    governing.status,
  );

  return {
    ...base,
    kind: "recorded",
    status: governing.status,
    legal: governing.status === "legal",
    entry: governing,
    entries: covering,
    since: run.start,
    until: run.end,
  };
}

/**
 * Distinguishes the three shapes of "entries exist, but none cover this date".
 * `history` is non-empty, chronological, and already date-validated.
 */
function gapReason(
  history: readonly TimelineEntry[],
  asOf: IsoDate,
): NoRecordReason {
  const earliest = history[0]?.effectiveFrom;
  if (earliest !== undefined && compareIsoDates(asOf, earliest) < 0) {
    return "before-first-record";
  }

  // "After everything" requires every interval to be closed — a single
  // open-ended entry means the record continues, and a date not covered by it
  // must sit before that entry begins, which is a hole rather than an end.
  let latestEnd: IsoDate | undefined;
  for (const entry of history) {
    if (entry.effectiveUntil === undefined) return "between-records";
    if (
      latestEnd === undefined ||
      compareIsoDates(entry.effectiveUntil, latestEnd) > 0
    ) {
      latestEnd = entry.effectiveUntil;
    }
  }
  if (latestEnd !== undefined && compareIsoDates(asOf, latestEnd) >= 0)
    return "after-last-record";
  return "between-records";
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A structural defect in a published timeline.
 *
 * `"error"` means the dataset states something impossible or unreadable and
 * must not be published. `"warning"` means it states something redundant or
 * suspicious that a human should look at — most importantly the signature of
 * an author who read `effectiveUntil` as inclusive.
 */
export type TimelineDefectSeverity = "error" | "warning";

/** What is wrong. See {@link validateTimeline}. */
export type TimelineDefectKind =
  /** `timeline.generatedAt` is not a `YYYY-MM-DD` calendar date. */
  | "malformed-generated-at"
  /** An entry's `effectiveFrom` is not a `YYYY-MM-DD` calendar date. */
  | "malformed-effective-from"
  /** An entry's `effectiveUntil` is not a `YYYY-MM-DD` calendar date. */
  | "malformed-effective-until"
  /** An entry's `format` is not one of the six sanctioned formats. */
  | "unknown-format"
  /**
   * An entry's `status` is not one of the seven recognised {@link CardStatus}
   * values.
   *
   * The field is *typed* `CardStatus`, which means nothing about a row read out
   * of published JSON — and this is the one field that decides `legal`. The
   * backfill is a prose scrape, so `"Banned"`, `"unbanned"` and a trailing
   * space are the shapes it will produce on a bad day. Today an unrecognised
   * status fails safe, since `status === "legal"` is false for all of them; the
   * inverse does not, and `"legal"` written where `"living-legend"` was meant
   * would otherwise validate clean and publish as legal.
   */
  | "unknown-status"
  /** `effectiveUntil` is before `effectiveFrom`; the interval cannot exist. */
  | "inverted-interval"
  /**
   * `effectiveUntil` equals `effectiveFrom`. Under half-open semantics this
   * covers no day at all, which is almost never what an author meant — it is
   * the fingerprint of treating `effectiveUntil` as the last day the status
   * held. Flagged loudly for exactly that reason.
   */
  | "zero-length-interval"
  /** Two entries with identical `effectiveFrom`, `effectiveUntil` and `status`. */
  | "duplicate-entry"
  /**
   * Two entries for the same card and format overlap and **disagree** about the
   * status. The timeline is asserting two incompatible facts about one day.
   */
  | "contradictory-overlap"
  /**
   * Two entries overlap and agree. Not ambiguous, but the dataset is saying the
   * same thing twice with two citations and the intervals should be merged.
   */
  | "redundant-overlap";

/**
 * One defect found by {@link validateTimeline}.
 *
 * Carries identifiers and the offending entries, and **no prose** — same reason
 * `DeckViolation` carries none. Rendering a defect into a sentence is the
 * caller's job; this package does not compose sentences about cards.
 */
export interface TimelineDefect {
  readonly kind: TimelineDefectKind;
  readonly severity: TimelineDefectSeverity;
  /** Absent only for dataset-level defects such as a malformed `generatedAt`. */
  readonly cardId: CardId | undefined;
  /** Typed as `string` because an invalid format is one of the things checked. */
  readonly format: string | undefined;
  /** The entries the defect concerns: one, or the two that clash. */
  readonly entries: readonly TimelineEntry[];
}

/**
 * Checks a timeline for structural defects and returns every one it finds.
 *
 * Intended to run in CI over the published dataset, so it **reports rather than
 * throws**: one bad row should surface alongside the other nineteen, not hide
 * them. Returns an empty array for a clean timeline.
 *
 * This validates *structure*, not *truth*. It cannot tell you a ban date is
 * wrong — only that the shape of the claim is impossible. Verifying dates
 * against the archived announcements is human review, and the research spike
 * (`docs/PHASE-2-STATUS.md`) requires it before publication.
 *
 * Overlap detection is pairwise within each card-and-format group. Groups are
 * small — a handful of entries per card at most — so the quadratic term is
 * bounded by the data's shape rather than by the dataset's size.
 */
export function validateTimeline(
  timeline: LegalityTimeline,
): readonly TimelineDefect[] {
  const defects: TimelineDefect[] = [];
  const entries = assertEntries(timeline);

  if (!isIsoDate(timeline.generatedAt)) {
    defects.push({
      kind: "malformed-generated-at",
      severity: "error",
      cardId: undefined,
      format: undefined,
      entries: [],
    });
  }

  /** Only entries with usable dates can be compared for overlap. */
  const groups = new Map<string, TimelineEntry[]>();

  for (const entry of entries) {
    let datesUsable = true;

    if (!isIsoDate(entry.effectiveFrom)) {
      defects.push(defect("malformed-effective-from", "error", entry));
      datesUsable = false;
    }
    if (
      entry.effectiveUntil !== undefined &&
      !isIsoDate(entry.effectiveUntil)
    ) {
      defects.push(defect("malformed-effective-until", "error", entry));
      datesUsable = false;
    }
    // The list of sanctioned formats is imported, never restated here: a second
    // copy of that list is a second thing to forget to update. The status
    // vocabulary is imported for the same reason.
    if (!isFormatId(entry.format)) {
      defects.push(defect("unknown-format", "error", entry));
    }
    if (typeof entry.status !== "string" || !isCardStatus(entry.status)) {
      defects.push(defect("unknown-status", "error", entry));
    }

    if (!datesUsable) continue;

    if (entry.effectiveUntil !== undefined) {
      const order = compareIsoDates(entry.effectiveUntil, entry.effectiveFrom);
      if (order < 0) defects.push(defect("inverted-interval", "error", entry));
      else if (order === 0)
        defects.push(defect("zero-length-interval", "warning", entry));
    }

    const key = `${entry.cardId} ${entry.format}`;
    const group = groups.get(key);
    if (group === undefined) groups.set(key, [entry]);
    else group.push(entry);
  }

  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];
        if (a === undefined || b === undefined) continue;

        if (
          a.effectiveFrom === b.effectiveFrom &&
          a.effectiveUntil === b.effectiveUntil &&
          a.status === b.status
        ) {
          defects.push(pairDefect("duplicate-entry", "warning", a, b));
          continue;
        }

        if (!overlaps(a, b)) continue;

        defects.push(
          a.status === b.status
            ? pairDefect("redundant-overlap", "warning", a, b)
            : pairDefect("contradictory-overlap", "error", a, b),
        );
      }
    }
  }

  return defects;
}

/**
 * Half-open overlap: `a.from < b.until && b.from < a.until`, with an absent end
 * treated as unbounded. Two intervals that merely touch — one ending on the day
 * the other begins — do **not** overlap, which is the whole reason the exclusive
 * end was chosen.
 */
function overlaps(a: TimelineEntry, b: TimelineEntry): boolean {
  const aBeforeBEnd =
    b.effectiveUntil === undefined || a.effectiveFrom < b.effectiveUntil;
  const bBeforeAEnd =
    a.effectiveUntil === undefined || b.effectiveFrom < a.effectiveUntil;
  return aBeforeBEnd && bBeforeAEnd;
}

function defect(
  kind: TimelineDefectKind,
  severity: TimelineDefectSeverity,
  entry: TimelineEntry,
): TimelineDefect {
  return {
    kind,
    severity,
    cardId: entry.cardId,
    format: entry.format,
    entries: [entry],
  };
}

function pairDefect(
  kind: TimelineDefectKind,
  severity: TimelineDefectSeverity,
  a: TimelineEntry,
  b: TimelineEntry,
): TimelineDefect {
  return {
    kind,
    severity,
    cardId: a.cardId,
    format: a.format,
    entries: [a, b],
  };
}
