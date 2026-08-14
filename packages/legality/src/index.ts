/**
 * `optfall-legality` — is this deck legal in this format, and *was* it legal on
 * the day of that tournament?
 *
 * Three properties are load-bearing and none of them are negotiable later:
 *
 * 1. **Zero runtime dependencies.** This package is meant to be adopted by
 *    other Flesh and Blood tools at zero risk, which means it must add nothing
 *    to their dependency tree and must run entirely in a browser.
 * 2. **Every verdict cites a rule.** A verdict without a citation is an
 *    assertion, and the whole positioning of this project is being auditable
 *    rather than merely confident.
 * 3. **No composed prose, anywhere.** Nothing here writes a sentence about a
 *    card. Verdicts are structured data plus verbatim quotations from parsed
 *    official documents; rendering them into English is the caller's job. This
 *    is why {@link CardVerdict} and {@link DeckViolation} have no `message`
 *    field and never will.
 *
 * The type surface below is the real, intended shape. {@link isLegal} validates
 * its arguments today and throws {@link NotImplementedError} instead of
 * evaluating, because evaluation needs the historical timeline dataset that
 * Phase 2 of the build plan produces.
 *
 * @packageDocumentation
 */

/* -------------------------------------------------------------------------- */
/* Primitives                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * An ISO 8601 calendar date, `YYYY-MM-DD`, interpreted as UTC.
 *
 * Deliberately a plain `string` rather than a branded type: callers pass date
 * literals from URLs and form fields, and a brand would force a cast at every
 * call site for no correctness gain. Use {@link isIsoDate} to validate.
 */
export type IsoDate = string;

/**
 * Stable identifier for a card, surviving errata and reprints. Supplied by the
 * card dataset (build-plan Phase 3); this package never invents one.
 */
export type CardId = string;

/** The six sanctioned constructed formats. */
export type FormatId =
  | "classic-constructed"
  | "blitz"
  | "living-legend"
  | "commoner"
  | "silver-age"
  | "ultimate-pit-fight";

/** Every {@link FormatId}, in the order they are presented in the interface. */
export const FORMATS: readonly FormatId[] = [
  "classic-constructed",
  "blitz",
  "living-legend",
  "commoner",
  "silver-age",
  "ultimate-pit-fight",
];

/** Official display names. Names as published, never restyled. */
export const FORMAT_NAMES: Readonly<Record<FormatId, string>> = {
  "classic-constructed": "Classic Constructed",
  blitz: "Blitz",
  "living-legend": "Living Legend",
  commoner: "Commoner",
  "silver-age": "Silver Age",
  "ultimate-pit-fight": "Ultimate Pit Fight",
};

/* -------------------------------------------------------------------------- */
/* Decks                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Where a card sits in a deck registration. Legality rules differ by zone —
 * copy limits apply to the deck, equipment limits to the inventory.
 */
export type DeckZone = "deck" | "inventory";

/** One line of a decklist. */
export interface DeckEntry {
  readonly cardId: CardId;
  /** Copies registered. Must be a positive integer. */
  readonly quantity: number;
  /** Defaults to `"deck"` when omitted. */
  readonly zone?: DeckZone;
}

/**
 * A registered decklist. The hero is separate because it is not a deck card:
 * it determines which cards are even eligible, and it is the card most often
 * retired by Living Legend.
 */
export interface Deck {
  readonly hero: CardId;
  readonly cards: readonly DeckEntry[];
}

/* -------------------------------------------------------------------------- */
/* Citations                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A pointer to the exact published rule that produced a verdict.
 *
 * Every field here is either an identifier we assign or text copied verbatim
 * from an official document. Nothing in this type is ever summarised.
 */
export interface RuleCitation {
  /**
   * Permanent, stable identifier for the section — `cr:8.3.4b` for a
   * Comprehensive Rules section, `br:2026-03-14#blitz` for an entry in a
   * banned-and-restricted announcement. Stable across document versions.
   */
  readonly ruleId: string;
  /** Title of the source document, exactly as published. */
  readonly document: string;
  /** Version or announcement date of that document. */
  readonly version: string;
  /** The date this rule took effect. */
  readonly effectiveFrom: IsoDate;
  /** Verbatim excerpt from the document. Quoted, never paraphrased. */
  readonly quote?: string;
  /** Optfall permalink for the section, when the corpus is published. */
  readonly permalink?: string;
  /** The publisher's own URL for the document, when one exists. */
  readonly sourceUrl?: string;
}

/* -------------------------------------------------------------------------- */
/* Verdicts                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The status of a single card in a format on a given date.
 *
 * `unknown-card` is the only status that may carry no citation — no rule
 * produced it; the card is simply absent from the dataset. It is reported
 * rather than swallowed, because a checker that silently ignores what it does
 * not recognise is worse than one that admits the gap.
 */
export type CardStatus =
  | "legal"
  | "banned"
  | "suspended"
  | "restricted"
  | "living-legend"
  | "not-in-format"
  | "unknown-card";

/**
 * Every {@link CardStatus}, as data.
 *
 * Exported for the same reason {@link FORMATS} is: the dataset validator has to
 * check a published entry's `status` against the vocabulary, and a second copy
 * of that list somewhere else is a second thing to forget to update. The
 * banned-list backfill is a prose scrape, so an unrecognised status string is
 * precisely what that pipeline will emit on a bad day.
 */
export const CARD_STATUSES: readonly CardStatus[] = [
  "legal",
  "banned",
  "suspended",
  "restricted",
  "living-legend",
  "not-in-format",
  "unknown-card",
];

/** The verdict for one line of the decklist. */
export interface CardVerdict {
  readonly cardId: CardId;
  readonly quantity: number;
  readonly zone: DeckZone;
  readonly status: CardStatus;
  /** True only when `status` is `"legal"`. Denormalised for convenience. */
  readonly legal: boolean;
  /**
   * The rules that produced this verdict. Non-empty for every status except
   * `"unknown-card"`.
   */
  readonly citations: readonly RuleCitation[];
  /** When the current status took effect, if the timeline records it. */
  readonly since?: IsoDate;
}

/** A deck-level rule, as opposed to a rule about one card. */
export type DeckRule =
  | "deck-size"
  | "copy-limit"
  | "equipment-limit"
  | "hero-eligibility"
  | "card-eligibility"
  | "unique-card";

/**
 * A broken deck-level rule. Carries the numbers and the citation; carries no
 * sentence, because this package does not write sentences.
 */
export interface DeckViolation {
  readonly rule: DeckRule;
  /** The card the violation concerns, when it concerns exactly one. */
  readonly cardId?: CardId;
  /** The measurement that broke the rule, when the rule is numeric. */
  readonly measured?: {
    readonly observed: number;
    readonly limit: number;
  };
  readonly citations: readonly RuleCitation[];
}

/**
 * Which dataset the verdict was computed against.
 *
 * Present on every result because a stale Optfall must look stale: any surface
 * rendering a verdict can show when the underlying data was last confirmed.
 */
export interface TimelineProvenance {
  readonly version: string;
  readonly generatedAt: IsoDate;
  readonly source: string;
}

/** The complete answer for one deck, in one format, on one date. */
export interface LegalityResult {
  readonly format: FormatId;
  readonly asOf: IsoDate;
  /** True when every card verdict is legal and there are no deck violations. */
  readonly legal: boolean;
  readonly cards: readonly CardVerdict[];
  readonly deck: readonly DeckViolation[];
  /**
   * The last date on or after `asOf` on which this deck is legal, when the
   * timeline already contains the announcement that ends it. Absent when the
   * deck is illegal at `asOf`, or when nothing published so far ends it.
   */
  readonly legalUntil?: IsoDate;
  readonly timeline: TimelineProvenance;
}

/* -------------------------------------------------------------------------- */
/* The timeline dataset                                                        */
/* -------------------------------------------------------------------------- */

/**
 * One interval of one card's status in one format. Backfilling these across
 * every banned-list revision and Living Legend threshold is what makes
 * `asOf` answerable, and it is the thing no other tool has.
 */
export interface TimelineEntry {
  readonly cardId: CardId;
  readonly format: FormatId;
  readonly status: CardStatus;
  readonly effectiveFrom: IsoDate;
  /** Absent while the status is still current. */
  readonly effectiveUntil?: IsoDate;
  readonly citation: RuleCitation;
}

/**
 * The published legality timeline: openly licensed JSON, served as a static
 * file, and simultaneously the storage layer, the public API and the audit
 * trail.
 */
export interface LegalityTimeline {
  readonly version: string;
  readonly generatedAt: IsoDate;
  /** Where this dataset was published. */
  readonly source: string;
  readonly entries: readonly TimelineEntry[];
}

/** Options for {@link isLegal}. */
export interface LegalityOptions {
  /**
   * The timeline to evaluate against. Explicitly passing one is how a consumer
   * pins a dataset version, and how tests get determinism.
   */
  readonly timeline?: LegalityTimeline;
}

/* -------------------------------------------------------------------------- */
/* Guards                                                                      */
/* -------------------------------------------------------------------------- */

const FORMAT_IDS: ReadonlySet<string> = new Set<string>(FORMATS);

const CARD_STATUS_IDS: ReadonlySet<string> = new Set<string>(CARD_STATUSES);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Whether `value` is one of the six sanctioned formats. */
export function isFormatId(value: string): value is FormatId {
  return FORMAT_IDS.has(value);
}

/**
 * Whether `value` is one of the seven recognised card statuses.
 *
 * Takes `string` rather than `CardStatus` on purpose: the interesting call site
 * is a published JSON row whose `status` field is only *typed* as a
 * `CardStatus` because somebody asserted it was.
 */
export function isCardStatus(value: string): value is CardStatus {
  return CARD_STATUS_IDS.has(value);
}

/**
 * Whether `value` is a real ISO 8601 calendar date in `YYYY-MM-DD` form.
 * Rejects dates that match the shape but do not exist, such as `2026-02-31`.
 */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString().startsWith(value);
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Thrown by a surface whose types are settled but whose implementation lands in
 * a later phase of the build plan. It is a deliberate placeholder, never a
 * runtime failure to be caught and ignored.
 */
export class NotImplementedError extends Error {
  /** The build-plan phase that lands the implementation. */
  readonly phase: number;

  constructor(subject: string, phase: number) {
    super(
      `${subject} is not implemented until Phase ${String(phase)} of the Optfall build plan (docs/PLAN.md).`,
    );
    this.name = "NotImplementedError";
    this.phase = phase;
  }
}

/* -------------------------------------------------------------------------- */
/* The entry point                                                             */
/* -------------------------------------------------------------------------- */

function assertFormat(format: FormatId): void {
  if (!isFormatId(format)) {
    throw new TypeError(
      `Unknown format ${JSON.stringify(format)}. Expected one of: ${FORMATS.join(", ")}.`,
    );
  }
}

function assertIsoDate(value: IsoDate, label: string): void {
  if (!isIsoDate(value)) {
    throw new TypeError(
      `${label} must be an ISO 8601 calendar date (YYYY-MM-DD); received ${JSON.stringify(value)}.`,
    );
  }
}

/**
 * Validates the whole deck, not the parts that happened to be easy.
 *
 * An earlier version checked `hero` and `quantity` and nothing else, while its
 * documentation and its test name both said "validates its arguments". That
 * gap was inert only because evaluation throws `NotImplementedError` before
 * anything reads the deck — the moment Phase 2 implements evaluation, it would
 * have inherited a blank `cardId` and a non-array `cards` along with a
 * docstring saying neither could happen.
 *
 * Every message names the offending value, because this library's whole claim
 * is that a verdict can be traced to its cause; a validator that says only
 * "invalid deck" fails that standard at the first step.
 */
function assertDeck(deck: Deck): void {
  if (typeof deck !== "object" || deck === null) {
    throw new TypeError(`deck must be an object; received ${String(deck)}.`);
  }

  if (typeof deck.hero !== "string" || deck.hero.trim().length === 0) {
    throw new TypeError(
      `deck.hero must be the non-empty card id of a hero; received ${JSON.stringify(deck.hero)}.`,
    );
  }

  if (!Array.isArray(deck.cards)) {
    throw new TypeError(
      `deck.cards must be an array of entries; received ${JSON.stringify(deck.cards)}.`,
    );
  }

  const seen = new Set<string>();
  for (const entry of deck.cards) {
    if (typeof entry !== "object" || entry === null) {
      throw new TypeError(
        `deck.cards entries must be objects; received ${String(entry)}.`,
      );
    }

    if (typeof entry.cardId !== "string" || entry.cardId.trim().length === 0) {
      throw new TypeError(
        `deck entry cardId must be a non-empty string; received ${JSON.stringify(entry.cardId)}.`,
      );
    }

    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      throw new TypeError(
        `deck entry ${JSON.stringify(entry.cardId)} must register a positive integer quantity; received ${String(entry.quantity)}.`,
      );
    }

    // A card listed twice is ambiguous rather than merely untidy: a format's
    // copy limit cannot be applied to two separate counts of the same card
    // without deciding whether to sum them, and that decision belongs to the
    // caller who wrote the list.
    if (seen.has(entry.cardId)) {
      throw new TypeError(
        `deck lists ${JSON.stringify(entry.cardId)} more than once; combine the entries into a single quantity.`,
      );
    }
    seen.add(entry.cardId);
  }
}

function assertTimeline(timeline: LegalityTimeline): void {
  assertIsoDate(timeline.generatedAt, "timeline.generatedAt");
  for (const entry of timeline.entries) {
    assertFormat(entry.format);
    assertIsoDate(
      entry.effectiveFrom,
      `timeline entry ${entry.cardId}.effectiveFrom`,
    );
    if (entry.effectiveUntil !== undefined) {
      assertIsoDate(
        entry.effectiveUntil,
        `timeline entry ${entry.cardId}.effectiveUntil`,
      );
    }
  }
}

/**
 * Evaluate a decklist against a format, as of a date.
 *
 * `asOf` is the whole point: Living Legend retirements and banned-list
 * revisions move constantly, so an archived decklist is uninterpretable
 * without knowing the rules state on the day it was played.
 *
 * Arguments are validated now — an invalid format, a malformed date or a
 * non-integer quantity throws `TypeError` today. Evaluation itself throws
 * {@link NotImplementedError} until the historical timeline exists.
 *
 * @param deck - The registered decklist.
 * @param format - One of the six sanctioned formats.
 * @param asOf - The date to judge against, `YYYY-MM-DD`, UTC.
 * @param options - Dataset overrides; see {@link LegalityOptions}.
 * @returns A verdict per card, each citing the rule that produced it.
 * @throws {TypeError} When an argument is malformed.
 * @throws {NotImplementedError} Until build-plan Phase 2.
 */
export function isLegal(
  deck: Deck,
  format: FormatId,
  asOf: IsoDate,
  options?: LegalityOptions,
): LegalityResult {
  assertFormat(format);
  assertIsoDate(asOf, "asOf");
  assertDeck(deck);

  const timeline = options?.timeline;
  if (timeline !== undefined) {
    assertTimeline(timeline);
  }

  throw new NotImplementedError("Legality evaluation", 2);
}

/* -------------------------------------------------------------------------- */
/* The rest of the public surface                                              */
/* -------------------------------------------------------------------------- */

/*
 * Two modules are finished and usable on their own, and they are re-exported
 * here so `optfall-legality` is one import rather than three.
 *
 * - `./formats` — deck-construction rules for the six formats, every constraint
 *   carrying either a verbatim quotation or a written reason it could not be
 *   confirmed. Answers "how big may a Blitz deck be" without any card data.
 * - `./timeline` — interval arithmetic over a published {@link LegalityTimeline}.
 *   Answers "what did the dataset record for this card on this day", including
 *   the answer "nothing", which it will never round to "legal".
 *
 * `isLegal` still throws {@link NotImplementedError}: joining these two needs
 * the card dataset, and the community dataset ships no licence (see
 * `docs/PHASE-2-STATUS.md`). Both halves work today regardless — a caller can
 * read `FORMAT_RULES` for construction limits and `statusAsOf` for card status
 * without waiting for that licence.
 *
 * This is a module cycle: both files import `isFormatId`/`isIsoDate`/`FORMATS`
 * from here. It is a safe one — neither reads a binding from this module at
 * evaluation time, only inside function bodies — but do not add a top-level
 * `FORMATS.map(...)` to either file without rechecking that.
 *
 * `./sources/wayback` is deliberately NOT here. It is ingestion machinery for a
 * scheduled job: it opens network connections and no browser consumer of
 * `isLegal` needs it in their bundle. It ships under the `optfall-legality/sources`
 * subpath instead.
 */

export * from "./formats";
export * from "./timeline";
