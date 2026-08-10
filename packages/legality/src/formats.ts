/**
 * Deck-construction rules for the six formats named in `docs/PLAN.md`, encoded
 * as data rather than as branches in a validator.
 *
 * These are *tournament* rules, not card data, so they can be written down
 * without the card dataset — which is why this file exists before the timeline
 * does. Every number below was read out of a document that was actually
 * retrieved, and the retrieval is recorded in {@link SOURCE_DOCUMENTS}.
 *
 * ## The honesty contract
 *
 * The commercially-backed incumbent ships incorrect banned flags, and that is
 * the entire reason Optfall exists. A confidently wrong constraint is therefore
 * worse here than a missing one, and the type system is what makes that
 * difference load-bearing rather than aspirational:
 *
 * - Every constraint is a {@link Sourced} value, and a `Sourced` value is
 *   either {@link VerifiedValue} — carrying at least one {@link RuleCitation}
 *   quoting the document it came from — or {@link UnverifiedValue}, carrying a
 *   reason it could not be confirmed.
 * - {@link verifiedValue} returns `undefined` for anything unverified, so the
 *   ordinary way of reading a constraint cannot silently return a guess.
 * - {@link requireVerified} throws {@link UnverifiedConstraintError}. That is
 *   the mechanism by which `isLegal` will later *refuse to assert* on an
 *   unverified rule instead of guessing at it.
 * - {@link unverifiedConstraints} enumerates what is unconfirmed in a format,
 *   so a surface can show it rather than hiding it.
 *
 * ## What this file does not do
 *
 * It does not know which *cards* are legal. Banned, restricted and living
 * legend status live in the timeline dataset and change by announcement; the
 * rules here change only when Legend Story Studios revises a document. The two
 * are deliberately separate, and {@link FormatRules} carries no card ids.
 *
 * @packageDocumentation
 */

import type { FormatId, IsoDate, RuleCitation } from "./index";
import { FORMATS } from "./index";

/* -------------------------------------------------------------------------- */
/* Sourced values — the honesty primitive                                      */
/* -------------------------------------------------------------------------- */

/** A constraint confirmed against a retrieved document. */
export interface VerifiedValue<T> {
  readonly confidence: "verified";
  readonly value: T;
  /**
   * Non-empty by construction. A "verified" value with no citation is exactly
   * the failure mode this package exists to prevent, so the tuple type makes it
   * unrepresentable rather than merely discouraged.
   */
  readonly citations: readonly [RuleCitation, ...RuleCitation[]];
  /**
   * Present when the rule *changed* on a known date, and the recorded value is
   * only correct on or after it. Absent means "as far as any retrieved document
   * says, this has always been the rule" — which is a weaker claim than it
   * looks and is why {@link sourcedEffectiveFrom} exists to make the difference
   * legible.
   *
   * Blitz's living legend hero eligibility is the case that forced this field:
   * LSS retired the Blitz living legend system on 2026-01-01, so `true` is the
   * right answer today and the wrong answer for a 2025 tournament. A format
   * rule set with no date on it would have quietly mis-answered every archived
   * Blitz decklist — the exact time-travel failure this project exists to fix.
   */
  readonly effectiveFrom?: IsoDate;
}

/**
 * A constraint that could not be confirmed.
 *
 * `value` is the best available reading — often a real number from a real
 * document that some *other* official document contradicts — and it is
 * deliberately `T | null` so that reaching it requires acknowledging it might
 * not be there. Nothing may treat it as a fact.
 */
export interface UnverifiedValue<T> {
  readonly confidence: "unverified";
  readonly value: T | null;
  /** Why this could not be confirmed. Written by a human, never composed. */
  readonly reason: string;
  /** Whatever evidence exists, including the documents that disagree. */
  readonly citations: readonly RuleCitation[];
  /** See {@link VerifiedValue.effectiveFrom}. */
  readonly effectiveFrom?: IsoDate;
}

/** A constraint together with its provenance. */
export type Sourced<T> = VerifiedValue<T> | UnverifiedValue<T>;

/** Whether a constraint was confirmed against a retrieved document. */
export function isVerified<T>(sourced: Sourced<T>): sourced is VerifiedValue<T> {
  return sourced.confidence === "verified";
}

/**
 * The value of a constraint, or `undefined` when it is unverified.
 *
 * This is the ordinary accessor, and it returns `undefined` rather than the
 * unverified reading on purpose: the default path through this library must not
 * be able to produce a guess.
 */
export function verifiedValue<T>(sourced: Sourced<T>): T | undefined {
  return isVerified(sourced) ? sourced.value : undefined;
}

/**
 * Thrown when something tries to assert on a constraint Optfall has not
 * confirmed. `isLegal` catching-and-defaulting this would defeat the point:
 * the correct response is to report the rule as unevaluated, not to invent a
 * verdict for it.
 */
export class UnverifiedConstraintError extends Error {
  /** Dotted path of the constraint, e.g. `ultimate-pit-fight.deckSize.minimum`. */
  readonly constraint: string;
  /** The reason recorded on the {@link UnverifiedValue}. */
  readonly reason: string;

  constructor(constraint: string, reason: string) {
    super(
      `${constraint} is not verified against a retrieved source and Optfall will not assert on it: ${reason}`,
    );
    this.name = "UnverifiedConstraintError";
    this.constraint = constraint;
    this.reason = reason;
  }
}

/** The value of a constraint, or a throw. Use where a guess is unacceptable. */
export function requireVerified<T>(sourced: Sourced<T>, constraint: string): T {
  if (!isVerified(sourced)) {
    throw new UnverifiedConstraintError(constraint, sourced.reason);
  }
  return sourced.value;
}

/**
 * The date from which a constraint's recorded value is known to hold, or
 * `undefined` when no retrieved document dates the rule.
 *
 * `undefined` is **not** "always" — it is "undated". A caller evaluating a
 * historical decklist should treat an undated constraint as unconfirmed for
 * that date rather than assume the current rule ran backwards forever.
 */
export function sourcedEffectiveFrom<T>(sourced: Sourced<T>): IsoDate | undefined {
  return sourced.effectiveFrom;
}

function verified<T>(
  value: T,
  citations: readonly [RuleCitation, ...RuleCitation[]],
  effectiveFrom?: IsoDate,
): VerifiedValue<T> {
  const base = { confidence: "verified", value, citations } as const;
  return effectiveFrom === undefined ? base : { ...base, effectiveFrom };
}

function unverified<T>(
  reason: string,
  value: T | null,
  citations: readonly RuleCitation[] = [],
): UnverifiedValue<T> {
  return { confidence: "unverified", value, reason, citations };
}

/* -------------------------------------------------------------------------- */
/* Source documents                                                            */
/* -------------------------------------------------------------------------- */

/** How the `version` of a source document was determined. */
export type VersionProvenance =
  /** Printed on the document itself — the only unambiguous case. */
  | "printed-in-document"
  /** Read off the `Last-Modified` header of the file that was fetched. */
  | "http-last-modified"
  /** Read off a "last updated" line in the page body. */
  | "page-last-updated-line";

/** A document Optfall actually fetched, and when. */
export interface SourceDocument {
  /** Prefix used in {@link RuleCitation.ruleId}, e.g. `trp` in `trp:7.1`. */
  readonly id: string;
  /** Title exactly as published. */
  readonly title: string;
  readonly version: string;
  readonly versionProvenance: VersionProvenance;
  /**
   * The date this version took effect. Where `versionProvenance` is not
   * `"printed-in-document"` this is a derived date and is only as good as its
   * provenance — which is why the provenance travels with it.
   */
  readonly effectiveFrom: IsoDate;
  readonly url: string;
  /** The date the bytes behind these citations were retrieved. */
  readonly retrievedAt: IsoDate;
  readonly note?: string;
}

/** The date every citation in this file was retrieved. */
const RETRIEVED_AT: IsoDate = "2026-08-10";

const TRP: SourceDocument = {
  id: "trp",
  title: "Flesh and Blood Tournament Rules and Policy",
  version: "2026-06-10",
  versionProvenance: "http-last-modified",
  effectiveFrom: "2026-06-10",
  url: "https://rules.fabtcg.com/txt/latest/en-fab-trp.txt",
  retrievedAt: RETRIEVED_AT,
  note:
    "The Tournament Rules and Policy carries no printed version number and " +
    "rules.fabtcg.com/pdf/en-fab-trp.pdf returns HTTP 403, so the version and " +
    "effective date here are the Last-Modified header of the published text " +
    "file (Wed, 10 Jun 2026 19:43:38 GMT). That is the same date the " +
    "Comprehensive Rules 2.14.0 carries on its title page, which is " +
    "corroboration, not proof.",
};

const CR: SourceDocument = {
  id: "cr",
  title: "Flesh and Blood Comprehensive Rules",
  version: "2.14.0",
  versionProvenance: "printed-in-document",
  effectiveFrom: "2026-06-10",
  url: "https://rules.fabtcg.com/pdf/en-fab-cr.pdf",
  retrievedAt: RETRIEVED_AT,
  note: 'Title page reads "Flesh and Blood / Comprehensive Rules / 2026-6-10 / 2.14.0".',
};

const COMMONER_PAGE: SourceDocument = {
  id: "fab-commoner",
  title: "Commoner — Flesh and Blood TCG (gameplay format page)",
  version: "2025-12-17",
  versionProvenance: "page-last-updated-line",
  effectiveFrom: "2025-12-17",
  url: "https://fabtcg.com/gameplay-formats/commoner/",
  retrievedAt: RETRIEVED_AT,
  note:
    "fabtcg.com returns HTTP 403 to automated fetches, so this was read from " +
    "the Wayback Machine capture of 2026-05-08 " +
    "(https://web.archive.org/web/20260508154704id_/https://fabtcg.com/gameplay-formats/commoner/). " +
    'The page footer reads "This document was last updated on December 17, 2025".',
};

const UPF_PAGE: SourceDocument = {
  id: "fab-upf",
  title: "Ultimate Pit Fight — Flesh and Blood TCG (gameplay format page)",
  version: "2025-12-17",
  versionProvenance: "page-last-updated-line",
  effectiveFrom: "2025-12-17",
  url: "https://fabtcg.com/gameplay-formats/ultimate-pit-fight-multi-player/",
  retrievedAt: RETRIEVED_AT,
  note:
    "Read from the Wayback Machine capture of 2026-05-08 " +
    "(https://web.archive.org/web/20260508154600id_/https://fabtcg.com/gameplay-formats/ultimate-pit-fight-multi-player/). " +
    "Both corroborates Tournament Rules and Policy 9.3 (its start-of-game " +
    "procedure names the same 52-card card-pool and 40-card deck) and " +
    "contradicts it (on the hero subtype and the copy limit). Reading only the " +
    "half that disagrees is how a conflict gets overstated, so both halves are " +
    "quoted below.",
};

const BLITZ_PAGE: SourceDocument = {
  id: "fab-blitz",
  title: "Blitz — Flesh and Blood TCG (gameplay format page)",
  version: "2025-12-17",
  versionProvenance: "page-last-updated-line",
  effectiveFrom: "2025-12-17",
  url: "https://fabtcg.com/gameplay-formats/blitz/",
  retrievedAt: RETRIEVED_AT,
  note:
    "Read from the Wayback Machine capture of 2026-05-08 " +
    "(https://web.archive.org/web/20260508154528id_/https://fabtcg.com/gameplay-formats/blitz/). " +
    "Corroborates Tournament Rules and Policy 7.3 on the numbers, and is the " +
    "only retrieved document that answers Blitz living legend hero eligibility " +
    "at all — its own section 7.3 is silent on it.",
};

const BLITZ_LL_ARCHIVE: SourceDocument = {
  id: "fab-blitz-ll",
  title: "Blitz Living Legend Leaderboard — Flesh and Blood TCG (archive)",
  version: "2025-12-16",
  versionProvenance: "page-last-updated-line",
  effectiveFrom: "2025-12-16",
  url: "https://fabtcg.com/gameplay-formats/blitz/blitz-living-legend-archive/",
  retrievedAt: RETRIEVED_AT,
  note:
    "Read from the Wayback Machine capture of 2026-01-18. It is a HISTORICAL " +
    "record and says so: the page states that Blitz stopped using the living " +
    "legend point system on 2026-01-01 and that its table does not dictate " +
    "current hero and card legality. An earlier revision of this file cited it " +
    "as evidence that Blitz still has a living legend mechanism, which is the " +
    "opposite of what the page says.",
};

/** Every document these rules were read out of, keyed by citation prefix. */
export const SOURCE_DOCUMENTS: readonly SourceDocument[] = [
  TRP,
  CR,
  COMMONER_PAGE,
  UPF_PAGE,
  BLITZ_PAGE,
  BLITZ_LL_ARCHIVE,
];

/** Optional overrides for {@link cite}. */
interface CiteOptions {
  /** Permalink for the section, when it differs from the document's own URL. */
  readonly sectionUrl?: string;
  /**
   * The date the *quoted rule* took effect, when the quotation names one and it
   * differs from the document's version date. `RuleCitation.effectiveFrom`
   * means the date the rule took effect, so a quote reading "as of January 1,
   * 2026" carries that date rather than the date its page was last edited.
   */
  readonly effectiveFrom?: IsoDate;
}

/**
 * Builds a citation. `quote` is always verbatim — including the source's own
 * typographical errors, because a quotation that has been tidied is no longer a
 * quotation.
 */
function cite(
  document: SourceDocument,
  section: string,
  quote: string,
  options: CiteOptions = {},
): RuleCitation {
  return {
    ruleId: `${document.id}:${section}`,
    document: document.title,
    version: document.version,
    effectiveFrom: options.effectiveFrom ?? document.effectiveFrom,
    quote,
    sourceUrl: options.sectionUrl ?? document.url,
  };
}

const TRP_CONSTRUCTED_URL = "https://rules.fabtcg.com/en/trp/07-constructed-formats/";
const TRP_SPECIAL_URL = "https://rules.fabtcg.com/en/trp/09-special-formats/";

/*
 * The Tournament Rules and Policy numbers sections but not the paragraphs
 * inside them, so `trp:7.1` is the finest addressable granularity that exists
 * upstream. Several constraints therefore share a section id and are told apart
 * by their quote — which is the right way round: the quote is the evidence and
 * the id is only the address.
 */

const TRP_7_RESTRICTED = cite(
  TRP,
  "7",
  "The official Card Legality Policy, specifies the legality of cards that can be used for each constructed format. If a card is restricted, a card-pool may only contain up to 1 copy of that unique card. If a card is banned, it cannot be included in a card-pool.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_1_POOL = cite(
  TRP,
  "7.1",
  "A Player's classic constructed card-pool comprises 1 hero card and a combined maximum of 80 arena-cards and deck-cards. Living legend heroes (hero cards that have more than 1000 living legend points) and their signature weapons are not legal. Young heroes and pit-fighter heroes are not legal.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_1_COPIES = cite(
  TRP,
  "7.1",
  "A card-pool may contain up to 3 copies of each unique card. A Player must start the game with a minimum of 60 cards in their deck.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_1_META_STATIC = cite(
  TRP,
  "7.1",
  "These specifications are subject to any meta-static abilities of the cards in the card-pool (e.g. Legendary).",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_2_INHERITS = cite(
  TRP,
  "7.2",
  "Living Legend follows the same format rules as Classic Constructed, with a separate banned and restricted list and the following changes:",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_2_HEROES = cite(
  TRP,
  "7.2",
  "Living legend heroes and their signature weapons are legal.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_3_POOL = cite(
  TRP,
  "7.3",
  "A Player's blitz card-pool comprises 1 young hero card and a combined maximum of 52 arena-cards and deck-cards.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_3_COPIES = cite(
  TRP,
  "7.3",
  "A card-pool may contain up to 1 copy of each unique card. A Player must start the game with exactly 40 cards in their deck.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_4_POOL = cite(
  TRP,
  "7.4",
  "A Player's silver age card-pool comprises 1 young hero card and a combined maximum of 55 arena-cards and deck-cards. Both the hero and cards in the card-poll must be common- or rare-rarity.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_4_COPIES = cite(
  TRP,
  "7.4",
  "A card-pool may contain up to 2 copies of each unique card. A Player must start the game with exactly 40 cards in their deck.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_4_COMMON = cite(
  TRP,
  "7.4",
  "A card is considered a common card for the silver age format if it has ever been officially printed with basic- or common-rarity.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_7_4_RARE = cite(
  TRP,
  "7.4",
  "A card is considered a rare card for the silver age format if it has ever been officially printed with rare-rarity and is not a common card.",
  { sectionUrl: TRP_CONSTRUCTED_URL },
);

const TRP_9_3_POOL = cite(
  TRP,
  "9.3",
  "A Player's Ultimate Pit Fight (UPF) card-pool comprises 1 young hero card and a combined maximum of 52 arena-cards and deck-cards.",
  { sectionUrl: TRP_SPECIAL_URL },
);

const TRP_9_3_COPIES = cite(
  TRP,
  "9.3",
  "A card-pool may contain up to 2 copies of each unique card. A Player must start the game with exactly 40 cards in their deck.",
  { sectionUrl: TRP_SPECIAL_URL },
);

const TRP_1_3_CATEGORIES = cite(
  TRP,
  "1.3",
  "Tournaments comprise one or more formats. There are three categories of tournament formats that Legend Story Studios supports: constructed, limited, and special.",
  { sectionUrl: "https://rules.fabtcg.com/en/trp/01-tournament-information/" },
);

const CR_3_0_2_ZONES = cite(
  CR,
  "3.0.2",
  "Each player has their own arms, arsenal, banished, chest, deck, graveyard, hand, head, hero, legs, and pitch zones; and has two weapon zones. The stack zone, permanent zone, and combat chain zone are shared by all players.",
);

const CR_4_1_4A_SLOTS = cite(
  CR,
  "4.1.4a",
  "A player may select up to one arena-card for each of their arms, chest, head, legs, and weapon zones. Each card will start the game equipped in its respective zone, based on its type and/or subtype.",
);

const CR_4_1_5A_ARENA = cite(CR, "4.1.5a", "Arena-cards cannot be included in a player's deck.");

const CR_4_1_2A_META_STATIC = cite(
  CR,
  "4.1.2a",
  "If the hero has a meta-static ability that modifies the start of game procedure, the number zones, or the ownership of zones, or the what cards in are placed in zones, that modification is independent of the ability during the game.",
);

const COMMONER_RETIRED = cite(
  COMMONER_PAGE,
  "retirement",
  "Commoner format is no longer in use as of January 1, 2026. For a fast, fun, and affordable young hero format, check out Silver Age.",
);

const COMMONER_POOL = cite(
  COMMONER_PAGE,
  "card-pool-construction-rules",
  "In Commoner, each player registers their young hero card (common or rare) and 52 cards that make up their card-pool. The card-pool includes arena-cards (weapons, equipment, etc. which may be common or rare), and deck-cards that will start in the player's deck (which may only be common).",
);

const COMMONER_QUICKSTART = cite(
  COMMONER_PAGE,
  "quickstart",
  "1 young hero card (common or rare) / 52 card-pool / weapons and equipment (common or rare) / cards in the deck (only common) / Start with exactly 40 cards in the deck / Up to 2 copies of each unique card",
);

const COMMONER_COPIES = cite(
  COMMONER_PAGE,
  "card-pool-construction-rules",
  "A card-pool may contain up to 2 copies of each unique card. A card is unique if it has a different name AND color from another card.",
);

const COMMONER_COMMON = cite(
  COMMONER_PAGE,
  "card-pool-construction-rules",
  "A card is considered a common card if it has ever been printed with the common rarity or basic rarity (formerly token rarity).",
);

const COMMONER_RARE = cite(
  COMMONER_PAGE,
  "card-pool-construction-rules",
  "A card is considered a rare card if it has ever been printed with at rare rarity and not at common rarity.",
);

const UPF_PAGE_ANY_FORMAT = cite(
  UPF_PAGE,
  "quickstart",
  "Ultimate Pit Fight can be based on any format, but expands the rules to include 3 or more players. / 1 hero card / Every card is legal, including special use promos",
);

const UPF_PAGE_COPIES = cite(
  UPF_PAGE,
  "card-pool-construction-rules",
  "The number of copies of each unique card you can include in your card-pool depends on the specific format you are basing your UPF game on.",
);

/**
 * The Ultimate Pit Fight page **agreeing** with trp:9.3 on the two numbers, in
 * its start-of-game procedure. An earlier revision of this file recorded the
 * card-pool maximum and the deck size as contested; they are not, and the
 * evidence was on the same page it quoted.
 */
const UPF_PAGE_START_OF_GAME = cite(
  UPF_PAGE,
  "start-of-game-procedure",
  "Each player chooses the equipment, weapon(s), and 40-card deck they will use for this game (chosen from their 52 card-pool).",
);

/**
 * The Ultimate Pit Fight page genuinely disagreeing with trp:9.3, which
 * requires a young hero. This sentence explicitly contemplates a non-young
 * hero, so it is the strongest evidence for the one conflict that is real.
 */
const UPF_PAGE_ADULT_HERO = cite(
  UPF_PAGE,
  "card-pool-construction-rules",
  "Ultimate Pit Fight can be based on any Flesh and Blood format, and it is recommended that all players adhere to the same card-pool standards (i.e. don’t use an Adult hero if everyone else is using Young heroes).",
);

const BLITZ_PAGE_QUICKSTART = cite(
  BLITZ_PAGE,
  "quickstart",
  "1 young hero card (all heroes with the “young” subtype are legal) / 52 card-pool (includes weapons, equipment, and cards in deck) / Start with exactly 40 cards in the deck / Up to 1 copy of each unique card (includes weapons and equipment)",
);

/**
 * The paragraph that answers Blitz living legend hero eligibility outright.
 *
 * `effectiveFrom` is 2026-01-01 rather than the page's own last-updated date,
 * because the quotation names that date as the day the rule changed. Before it,
 * the opposite was true — which is exactly why the value it supports carries a
 * date of its own.
 */
const BLITZ_PAGE_LIVING_LEGEND = cite(
  BLITZ_PAGE,
  "living-legend-and-roll-of-honor",
  "Blitz used the Living Legend leaderboard system until 1 January, 2026. As of this date, Living Legend points are no longer being recorded in this format, and any heroes that attained Living Legend status in Blitz have become legal for official tournament play again. The Blitz Banned and Restricted list has also been abolished. Below is a historical record of Blitz Living Legend points and Roll of Honor articles, preserved for archival purposes.",
  { effectiveFrom: "2026-01-01" },
);

const BLITZ_PAGE_ALL_CARDS_LEGAL = cite(
  BLITZ_PAGE,
  "card-pool-construction-rules",
  "All cards are legal in Blitz as of January 1, 2026, with the exception of special use promos. For an up to date list of cards legal in Blitz, check the Card Legality Policy.",
  { effectiveFrom: "2026-01-01" },
);

/**
 * The archive page's own framing of itself. Quoted because the table it heads
 * is the single most tempting thing in this whole corpus to misread as current
 * legality data, and the page pre-empts that misreading in its own words.
 */
const BLITZ_LL_ARCHIVE_IS_HISTORICAL = cite(
  BLITZ_LL_ARCHIVE,
  "leaderboard",
  "Below is a historical record of Living Legend points earned by heroes in Blitz format. Blitz stopped using the Living Legend point system as of January 1, 2026, so the data below is for archival purposes only and does not dictate current hero and card legality in Blitz.",
  { effectiveFrom: "2026-01-01" },
);

/* -------------------------------------------------------------------------- */
/* Constraint shapes                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Rarity names, restricted to the ones a format rule in this file actually
 * names. Deliberately not an attempt at the game's full rarity taxonomy: this
 * package should not carry a vocabulary it has not read out of a document.
 */
export type RarityName = "basic" | "common" | "rare";

/** Which part of a registration a rarity restriction covers. */
export type RarityScope = "hero" | "arena-cards" | "deck-cards" | "card-pool";

/** A rarity restriction on part of a registration. */
export interface RarityRestriction {
  readonly scope: RarityScope;
  readonly allowed: readonly RarityName[];
  /**
   * True when the format decides a card's rarity by whether it has *ever* been
   * printed at that rarity, rather than by the printing in hand. Both formats
   * with a rarity restriction say "ever", and getting this backwards would
   * wrongly reject a legal card — the incumbent's exact failure mode.
   */
  readonly everPrinted: boolean;
}

/**
 * A deck-size maximum.
 *
 * Some formats state one outright ("exactly 40"). Classic Constructed and
 * Living Legend state only a minimum, and bound the deck indirectly through the
 * card-pool maximum: registered arena-cards cannot be in the deck (`cr:4.1.5a`),
 * so the ceiling is `cardPoolMaximum` minus however many arena-cards were
 * registered. That ceiling is not a number in any document, so this type
 * refuses to invent one.
 */
export type DeckMaximum =
  | { readonly kind: "stated"; readonly cards: Sourced<number> }
  | { readonly kind: "bounded-by-card-pool"; readonly note: string };

/** Deck-size rule for a format. */
export interface DeckSizeRule {
  /** Minimum cards in the deck at the start of a game. */
  readonly minimum: Sourced<number>;
  readonly maximum: DeckMaximum;
  /** True when the document says "exactly N" rather than a range. */
  readonly exact: boolean;
}

/** A documented reason the format-level copy limit does not apply to a card. */
export interface CopyLimitOverride {
  readonly kind: "restricted-card" | "meta-static-ability";
  /** Copies permitted when the override applies. */
  readonly maximum: number;
  readonly citations: readonly RuleCitation[];
  /**
   * A qualification the rule text alone does not carry — most usefully, that a
   * format has no restricted list for the rule to apply to. Written by a human,
   * never composed.
   */
  readonly note?: string;
}

/** Copy limit for a format. */
export interface CopyLimitRule {
  /**
   * Maximum copies of each unique card in the card-pool. "Unique" is by name
   * *and* colour — `Sink Below` (red) and `Sink Below` (blue) are different
   * unique cards. Resolving that is the card dataset's job, not this file's.
   */
  readonly perUniqueCard: Sourced<number>;
  /**
   * Overrides that this single number does not capture. A validator that
   * applies `perUniqueCard` alone will pass a deck with three copies of a
   * restricted card, so these are part of the rule rather than a footnote.
   */
  readonly overrides: readonly CopyLimitOverride[];
}

/** Whether the format requires the hero to have (or not have) the Young subtype. */
export type HeroSubtypeRule = "young-required" | "young-excluded" | "unrestricted";

/** Hero rule for a format. */
export interface HeroRule {
  /** Every format here requires exactly one hero card; none makes it optional. */
  readonly required: Sourced<boolean>;
  /** How many hero cards are registered. */
  readonly count: Sourced<number>;
  readonly subtype: Sourced<HeroSubtypeRule>;
  /**
   * Hero subtypes the format excludes beyond what `subtype` already covers.
   * `Young` and `Pit-Fighter` are separate non-functional subtypes (`cr:2.10.6b`),
   * so excluding one does not exclude the other.
   */
  readonly excludedSubtypes: Sourced<readonly string[]>;
  /**
   * Whether a hero that has passed the living legend threshold may be used.
   * The threshold itself (more than 1000 living legend points) is stated in
   * `trp:7.1`; which heroes have passed it is timeline data, not a format rule.
   */
  readonly livingLegendHeroesLegal: Sourced<boolean>;
  /** Rarity restriction on the hero card, when the format has one. */
  readonly rarity: Sourced<RarityRestriction> | null;
}

/** An equipment or weapon zone a player may fill at the start of a game. */
export type EquipmentSlot = "arms" | "chest" | "head" | "legs" | "weapon";

/**
 * Equipment and weapon constraints.
 *
 * There are two different rules here and conflating them is the easy mistake.
 * *Registration* is deck construction: none of the six formats caps weapons or
 * equipment separately — arena-cards simply count against the shared card-pool
 * maximum. *Start of game* is a game rule from the Comprehensive Rules, and it
 * is what actually limits how much equipment reaches the table.
 */
export interface EquipmentRule {
  /**
   * Whether the format caps registered weapons/equipment independently of the
   * card-pool maximum. `null` means it does not; arena-cards are counted by
   * {@link FormatRules.cardPoolMaximum} like everything else.
   */
  readonly registrationLimit: Sourced<number> | null;
  /** Slot kinds a player may fill at the start of a game. */
  readonly startOfGameSlots: Sourced<readonly EquipmentSlot[]>;
  /** How many of each slot kind a player has by default. */
  readonly startOfGameSlotCounts: Sourced<Readonly<Record<EquipmentSlot, number>>>;
  /**
   * Rarity restriction on arena-cards specifically, when the format splits its
   * rarity rule between the deck and the arena. Commoner is the one that does.
   */
  readonly rarity: Sourced<RarityRestriction> | null;
}

/** Two official sources that disagree, recorded rather than silently resolved. */
export interface SourceConflict {
  /** Dotted path of the constraints the conflict affects. */
  readonly constraints: readonly string[];
  /** Plain description of the disagreement, written by a human. */
  readonly description: string;
  readonly citations: readonly RuleCitation[];
}

/** Whether a format is currently sanctioned. */
export type FormatStatus =
  | { readonly kind: "active" }
  | {
      readonly kind: "retired";
      /** First date on which the format was no longer in use. */
      readonly since: Sourced<IsoDate>;
      /** The format LSS pointed players at instead, when it named one. */
      readonly replacedBy: FormatId | null;
    };

/** Which of the Tournament Rules and Policy's three categories a format sits in. */
export type FormatCategory = "constructed" | "limited" | "special";

/** The complete deck-construction rule set for one format. */
export interface FormatRules {
  readonly format: FormatId;
  /** Name as published, never restyled. */
  readonly name: string;
  readonly category: FormatCategory;
  readonly status: FormatStatus;
  /**
   * Maximum combined arena-cards and deck-cards registered. The hero is *not*
   * counted: every source states it separately ("1 hero card and a combined
   * maximum of 80 arena-cards and deck-cards").
   */
  readonly cardPoolMaximum: Sourced<number>;
  readonly deckSize: DeckSizeRule;
  readonly copyLimit: CopyLimitRule;
  readonly hero: HeroRule;
  readonly equipment: EquipmentRule;
  /** Rarity restrictions over the whole card-pool. Empty for most formats. */
  readonly rarity: readonly Sourced<RarityRestriction>[];
  /** Disagreements between official sources affecting this format. */
  readonly conflicts: readonly SourceConflict[];
  /** Citations that describe the format as a whole. */
  readonly citations: readonly RuleCitation[];
}

/* -------------------------------------------------------------------------- */
/* Shared fragments                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The start-of-game arena-card allowance, identical in every format because it
 * comes from the Comprehensive Rules rather than from a format rule. Two weapon
 * zones per player (`cr:3.0.2`), one arena-card each (`cr:4.1.4a`) — subject to
 * a hero's meta-static abilities, which is why `cr:4.1.2a` is cited alongside.
 */
const START_OF_GAME_SLOTS: Sourced<readonly EquipmentSlot[]> = verified(
  ["arms", "chest", "head", "legs", "weapon"],
  [CR_4_1_4A_SLOTS],
);

const START_OF_GAME_SLOT_COUNTS: Sourced<Readonly<Record<EquipmentSlot, number>>> = verified(
  { arms: 1, chest: 1, head: 1, legs: 1, weapon: 2 },
  [CR_3_0_2_ZONES, CR_4_1_4A_SLOTS, CR_4_1_2A_META_STATIC],
);

/**
 * Registration is uncapped for weapons and equipment in every format below.
 * That is a real finding rather than an omission: the Tournament Rules and
 * Policy states one combined card-pool maximum and never a separate arena-card
 * count, and `cr:4.1.5a` is what keeps registered arena-cards out of the deck.
 */
const NO_REGISTRATION_LIMIT = null;

/** The restricted-card override, quoted from the section 7 preamble. */
const RESTRICTED_OVERRIDE: CopyLimitOverride = {
  kind: "restricted-card",
  maximum: 1,
  citations: [TRP_7_RESTRICTED],
};

/** The Legendary-style meta-static override. */
const META_STATIC_OVERRIDE: CopyLimitOverride = {
  kind: "meta-static-ability",
  maximum: 1,
  citations: [TRP_7_1_META_STATIC],
};

const CONSTRUCTED_OVERRIDES: readonly CopyLimitOverride[] = [
  RESTRICTED_OVERRIDE,
  META_STATIC_OVERRIDE,
];

const BOUNDED_BY_CARD_POOL: DeckMaximum = {
  kind: "bounded-by-card-pool",
  note:
    "No document states a deck-size maximum for this format. The deck is " +
    "bounded only by the card-pool maximum less the arena-cards registered, " +
    "which cr:4.1.5a keeps out of the deck. Computing that ceiling is the " +
    "caller's job; inventing a number for it here would be exactly the kind " +
    "of confident guess this package exists to avoid.",
};

/* -------------------------------------------------------------------------- */
/* The six formats                                                             */
/* -------------------------------------------------------------------------- */

const CLASSIC_CONSTRUCTED: FormatRules = {
  format: "classic-constructed",
  name: "Classic Constructed",
  category: "constructed",
  status: { kind: "active" },
  cardPoolMaximum: verified(80, [TRP_7_1_POOL]),
  deckSize: {
    minimum: verified(60, [TRP_7_1_COPIES]),
    maximum: BOUNDED_BY_CARD_POOL,
    exact: false,
  },
  copyLimit: {
    perUniqueCard: verified(3, [TRP_7_1_COPIES]),
    overrides: CONSTRUCTED_OVERRIDES,
  },
  hero: {
    required: verified(true, [TRP_7_1_POOL]),
    count: verified(1, [TRP_7_1_POOL]),
    subtype: verified("young-excluded", [TRP_7_1_POOL]),
    excludedSubtypes: verified(["Young", "Pit-Fighter"], [TRP_7_1_POOL]),
    livingLegendHeroesLegal: verified(false, [TRP_7_1_POOL]),
    rarity: null,
  },
  equipment: {
    registrationLimit: NO_REGISTRATION_LIMIT,
    startOfGameSlots: START_OF_GAME_SLOTS,
    startOfGameSlotCounts: START_OF_GAME_SLOT_COUNTS,
    rarity: null,
  },
  rarity: [],
  conflicts: [],
  citations: [TRP_7_1_POOL, TRP_7_1_COPIES, TRP_7_1_META_STATIC, CR_4_1_5A_ARENA],
};

/*
 * Living Legend is defined by delta: trp:7.2 says it "follows the same format
 * rules as Classic Constructed" and then names one change. So every constraint
 * it does not restate is Classic Constructed's, and both citations travel
 * together — the inheritance and the rule inherited — because a citation that
 * points at a section which does not mention the number is not a citation.
 */
const LIVING_LEGEND: FormatRules = {
  format: "living-legend",
  name: "Living Legend",
  category: "constructed",
  status: { kind: "active" },
  cardPoolMaximum: verified(80, [TRP_7_2_INHERITS, TRP_7_1_POOL]),
  deckSize: {
    minimum: verified(60, [TRP_7_2_INHERITS, TRP_7_1_COPIES]),
    maximum: BOUNDED_BY_CARD_POOL,
    exact: false,
  },
  copyLimit: {
    perUniqueCard: verified(3, [TRP_7_2_INHERITS, TRP_7_1_COPIES]),
    overrides: CONSTRUCTED_OVERRIDES,
  },
  hero: {
    required: verified(true, [TRP_7_2_INHERITS, TRP_7_1_POOL]),
    count: verified(1, [TRP_7_2_INHERITS, TRP_7_1_POOL]),
    // trp:7.2 lifts the living legend hero exclusion and nothing else, so the
    // young / pit-fighter exclusions carry over unchanged.
    subtype: verified("young-excluded", [TRP_7_2_INHERITS, TRP_7_1_POOL]),
    excludedSubtypes: verified(["Young", "Pit-Fighter"], [TRP_7_2_INHERITS, TRP_7_1_POOL]),
    livingLegendHeroesLegal: verified(true, [TRP_7_2_HEROES]),
    rarity: null,
  },
  equipment: {
    registrationLimit: NO_REGISTRATION_LIMIT,
    startOfGameSlots: START_OF_GAME_SLOTS,
    startOfGameSlotCounts: START_OF_GAME_SLOT_COUNTS,
    rarity: null,
  },
  rarity: [],
  conflicts: [],
  citations: [TRP_7_2_INHERITS, TRP_7_2_HEROES, TRP_7_1_POOL, TRP_7_1_COPIES],
};

/*
 * Blitz's living legend hero rule is answered, and answering it required
 * reading past section 7.3.
 *
 * trp:7.3 is silent, and an earlier revision of this file treated that silence
 * as an open question — citing the Blitz living legend leaderboard as evidence
 * that a mechanism still existed. That was wrong twice over. The Blitz format
 * page states in its own words that the system was retired on 2026-01-01 and
 * that retired heroes "have become legal for official tournament play again",
 * and the leaderboard page itself says its table "does not dictate current hero
 * and card legality in Blitz". Both documents were already cited here; only the
 * paragraph that answered the question was not quoted.
 *
 * The lesson worth keeping: an unverified marking is not automatically the safe
 * choice. `requireVerified` throwing means no consumer can evaluate the rule at
 * all, and a consumer that falls back to the Classic Constructed threshold
 * would then reject every hero on that archive table — the incumbent's failure
 * mode, arrived at by way of caution.
 */
const BLITZ_LIVING_LEGEND_HEROES_LEGAL_FROM: IsoDate = "2026-01-01";

/**
 * Blitz's restricted-card override, carrying the fact that the list it governs
 * was abolished. Inert today — Blitz already allows only 1 copy of a unique
 * card, so a restricted card's maximum of 1 changes nothing — but recorded
 * rather than deleted, because the trp:7 preamble does still apply to Blitz as
 * a constructed format and a decklist from before 2026-01-01 was judged against
 * a Blitz banned-and-restricted list that really existed.
 */
const BLITZ_RESTRICTED_OVERRIDE: CopyLimitOverride = {
  kind: "restricted-card",
  maximum: 1,
  citations: [TRP_7_RESTRICTED, BLITZ_PAGE_LIVING_LEGEND, BLITZ_PAGE_ALL_CARDS_LEGAL],
  note:
    "The trp:7 preamble applies to Blitz as a constructed format, but LSS " +
    "abolished the Blitz banned and restricted list on 2026-01-01, so on or " +
    "after that date this override has nothing to apply to. It is also inert " +
    "arithmetically: Blitz permits 1 copy of a unique card already.",
};

const BLITZ: FormatRules = {
  format: "blitz",
  name: "Blitz",
  category: "constructed",
  status: { kind: "active" },
  cardPoolMaximum: verified(52, [TRP_7_3_POOL, BLITZ_PAGE_QUICKSTART]),
  deckSize: {
    minimum: verified(40, [TRP_7_3_COPIES, BLITZ_PAGE_QUICKSTART]),
    maximum: { kind: "stated", cards: verified(40, [TRP_7_3_COPIES, BLITZ_PAGE_QUICKSTART]) },
    exact: true,
  },
  copyLimit: {
    perUniqueCard: verified(1, [TRP_7_3_COPIES, BLITZ_PAGE_QUICKSTART]),
    overrides: [BLITZ_RESTRICTED_OVERRIDE, META_STATIC_OVERRIDE],
  },
  hero: {
    required: verified(true, [TRP_7_3_POOL]),
    count: verified(1, [TRP_7_3_POOL]),
    subtype: verified("young-required", [TRP_7_3_POOL, BLITZ_PAGE_QUICKSTART]),
    // Sound, unlike its Silver Age and Commoner counterparts: the quotation
    // says "all heroes with the “young” subtype are legal", which is an
    // affirmative statement that nothing further is excluded rather than a
    // document declining to mention exclusions.
    excludedSubtypes: verified([], [BLITZ_PAGE_QUICKSTART]),
    livingLegendHeroesLegal: verified(
      true,
      [BLITZ_PAGE_LIVING_LEGEND, BLITZ_LL_ARCHIVE_IS_HISTORICAL],
      BLITZ_LIVING_LEGEND_HEROES_LEGAL_FROM,
    ),
    rarity: null,
  },
  equipment: {
    registrationLimit: NO_REGISTRATION_LIMIT,
    startOfGameSlots: START_OF_GAME_SLOTS,
    startOfGameSlotCounts: START_OF_GAME_SLOT_COUNTS,
    rarity: null,
  },
  rarity: [],
  conflicts: [],
  citations: [
    TRP_7_3_POOL,
    TRP_7_3_COPIES,
    BLITZ_PAGE_QUICKSTART,
    BLITZ_PAGE_ALL_CARDS_LEGAL,
    BLITZ_PAGE_LIVING_LEGEND,
  ],
};

const SILVER_AGE: FormatRules = {
  format: "silver-age",
  name: "Silver Age",
  category: "constructed",
  status: { kind: "active" },
  cardPoolMaximum: verified(55, [TRP_7_4_POOL]),
  deckSize: {
    minimum: verified(40, [TRP_7_4_COPIES]),
    maximum: { kind: "stated", cards: verified(40, [TRP_7_4_COPIES]) },
    exact: true,
  },
  copyLimit: {
    perUniqueCard: verified(2, [TRP_7_4_COPIES]),
    overrides: CONSTRUCTED_OVERRIDES,
  },
  hero: {
    required: verified(true, [TRP_7_4_POOL]),
    count: verified(1, [TRP_7_4_POOL]),
    subtype: verified("young-required", [TRP_7_4_POOL]),
    // NOT verified, and the distinction is the whole product. trp:7.4 requires
    // a young hero and then says nothing whatever about further exclusions —
    // so an empty list here would be an inference from silence, which is the
    // move this file refuses to make elsewhere. cr:2.10.6b makes Young and
    // Pit-Fighter separate subtypes, so a hero can carry both and a
    // wrongly-empty list would pass an ineligible one.
    excludedSubtypes: unverified(
      "trp:7.4 requires a young hero and states no further hero-subtype exclusion. " +
        "An empty exclusion list is the best reading of the section, but it rests on " +
        "the section's silence rather than on anything it says, and the Card Legality " +
        "Policy that governs hero eligibility has not been retrieved.",
      [],
      [TRP_7_4_POOL],
    ),
    livingLegendHeroesLegal: unverified(
      "trp:7.4 does not address living legend heroes for Silver Age. Silver Age " +
        "requires a young hero, and the living legend threshold in trp:7.1 is written " +
        "as a Classic Constructed rule, so whether it reaches this format at all is " +
        "a Card Legality Policy question Optfall has not read.",
      null,
      [TRP_7_4_POOL],
    ),
    rarity: verified(
      { scope: "hero", allowed: ["basic", "common", "rare"], everPrinted: true },
      [TRP_7_4_POOL, TRP_7_4_COMMON, TRP_7_4_RARE],
    ),
  },
  equipment: {
    registrationLimit: NO_REGISTRATION_LIMIT,
    startOfGameSlots: START_OF_GAME_SLOTS,
    startOfGameSlotCounts: START_OF_GAME_SLOT_COUNTS,
    rarity: null,
  },
  // One restriction over the whole registration: trp:7.4 says "Both the hero
  // and cards in the card-poll must be common- or rare-rarity" (the typo is the
  // document's), and its own definition folds basic-rarity into common.
  rarity: [
    verified({ scope: "card-pool", allowed: ["basic", "common", "rare"], everPrinted: true }, [
      TRP_7_4_POOL,
      TRP_7_4_COMMON,
      TRP_7_4_RARE,
    ]),
  ],
  conflicts: [],
  citations: [TRP_7_4_POOL, TRP_7_4_COPIES, TRP_7_4_COMMON, TRP_7_4_RARE],
};

/*
 * Commoner is retired. It stays in this file because Optfall's whole wedge is
 * answering "was this legal on the day of that tournament", and a decklist
 * registered for a Commoner event in 2024 is uninterpretable without these
 * numbers. Deleting a retired format would be the same mistake as serving only
 * the current banned list.
 *
 * It never appeared in the Tournament Rules and Policy that was retrieved, so
 * every constraint here comes from LSS's own format page, read through the
 * Wayback Machine because fabtcg.com refuses automated fetches.
 */
const COMMONER: FormatRules = {
  format: "commoner",
  name: "Commoner",
  category: "constructed",
  status: {
    kind: "retired",
    since: verified("2026-01-01", [COMMONER_RETIRED]),
    replacedBy: "silver-age",
  },
  cardPoolMaximum: verified(52, [COMMONER_POOL, COMMONER_QUICKSTART]),
  deckSize: {
    minimum: verified(40, [COMMONER_QUICKSTART]),
    maximum: { kind: "stated", cards: verified(40, [COMMONER_QUICKSTART]) },
    exact: true,
  },
  copyLimit: {
    perUniqueCard: verified(2, [COMMONER_COPIES, COMMONER_QUICKSTART]),
    // The section 7 preamble is a Tournament Rules and Policy rule about
    // constructed formats, and Commoner is not in that document. The
    // meta-static override is quoted on the Commoner page itself.
    overrides: [
      {
        kind: "meta-static-ability",
        maximum: 1,
        citations: [
          cite(
            COMMONER_PAGE,
            "card-pool-construction-rules",
            "Cards with “Legendary” limit themselves to only 1 in the card-pool.",
          ),
        ],
      },
    ],
  },
  hero: {
    required: verified(true, [COMMONER_POOL]),
    count: verified(1, [COMMONER_POOL]),
    subtype: verified("young-required", [COMMONER_POOL, COMMONER_QUICKSTART]),
    // Same reasoning as Silver Age: the Commoner page names a young hero and a
    // rarity restriction, and is silent on any further subtype exclusion.
    excludedSubtypes: unverified(
      "The Commoner page requires a young hero of common or rare rarity and states no " +
        "further hero-subtype exclusion. An empty exclusion list is the best reading, " +
        "but it rests on the page's silence, and Commoner never appeared in the " +
        "Tournament Rules and Policy at all.",
      [],
      [COMMONER_POOL, COMMONER_QUICKSTART],
    ),
    livingLegendHeroesLegal: unverified(
      "The Commoner format page does not address living legend heroes, and the " +
        "Tournament Rules and Policy never described Commoner at all.",
      null,
      [COMMONER_POOL],
    ),
    rarity: verified({ scope: "hero", allowed: ["basic", "common", "rare"], everPrinted: true }, [
      COMMONER_POOL,
      COMMONER_COMMON,
      COMMONER_RARE,
    ]),
  },
  equipment: {
    registrationLimit: NO_REGISTRATION_LIMIT,
    startOfGameSlots: START_OF_GAME_SLOTS,
    startOfGameSlotCounts: START_OF_GAME_SLOT_COUNTS,
    // Commoner is the clearest rarity case in the game and also the most
    // easily got wrong: the restriction is *not* uniform. Deck-cards may only
    // be common; arena-cards and the hero may be common or rare.
    //
    // The `basic` element and the `everPrinted` flag come from COMMONER_COMMON
    // and COMMONER_RARE, not from the two sentences that say "common or rare".
    // Citing only those two would stamp `basic` with a quotation that never
    // mentions it — the same defect this file corrects elsewhere.
    rarity: verified({ scope: "arena-cards", allowed: ["basic", "common", "rare"], everPrinted: true }, [
      COMMONER_POOL,
      COMMONER_QUICKSTART,
      COMMONER_COMMON,
      COMMONER_RARE,
    ]),
  },
  rarity: [
    verified({ scope: "deck-cards", allowed: ["basic", "common"], everPrinted: true }, [
      COMMONER_POOL,
      COMMONER_QUICKSTART,
      COMMONER_COMMON,
    ]),
  ],
  conflicts: [],
  citations: [COMMONER_RETIRED, COMMONER_POOL, COMMONER_QUICKSTART, COMMONER_COPIES],
};

/*
 * Ultimate Pit Fight is the format where two official LSS sources disagree, and
 * it is the reason `Sourced` exists rather than a plain number. It is also the
 * place where the disagreement is easiest to *overstate*, and an earlier
 * revision of this file did.
 *
 * What the two sources actually say, having read both in full:
 *
 * - **They agree on the numbers.** trp:9.3 gives a 52-card card-pool and
 *   exactly 40 cards in the deck; the format page's own start-of-game procedure
 *   reads "a 40-card deck … chosen from their 52 card-pool". Two independent
 *   official sources stating the same figure is the strongest evidence
 *   available anywhere in this file, so those three constraints are verified.
 * - **They disagree about the hero.** trp:9.3 requires "1 young hero card"; the
 *   page registers "1 hero card" and then explicitly contemplates a non-young
 *   one — "don't use an Adult hero if everyone else is using Young heroes".
 * - **They disagree about the copy limit.** trp:9.3 says up to 2 copies of each
 *   unique card; the page says the limit depends on the base format.
 *
 * The earlier version listed the card-pool maximum and both deck bounds as
 * contested, and described the page as saying only the half that supported the
 * conflict. Quoting selectively from a document read in full is the same defect
 * as quoting a document nobody read. Three constraints were unevaluable for no
 * reason, which on a batch checker means three rules silently skipped.
 *
 * The Tournament Rules and Policy governs sanctioned tournaments, so its
 * reading is the value recorded for the two constraints that really are
 * contested — but they stay unverified, because the alternative is failing a
 * legitimate UPF decklist on a disputed number.
 */
const UPF_CONFLICT: SourceConflict = {
  constraints: [
    "ultimate-pit-fight.copyLimit.perUniqueCard",
    "ultimate-pit-fight.hero.subtype",
    "ultimate-pit-fight.hero.excludedSubtypes",
  ],
  description:
    "Tournament Rules and Policy 9.3 requires 1 young hero card and permits up " +
    "to 2 copies of each unique card. LSS's Ultimate Pit Fight format page, " +
    "last updated 17 December 2025, registers \"1 hero card\", advises against " +
    "using an Adult hero only when everyone else is using Young heroes — which " +
    "presupposes an Adult hero is permitted — and says the copy limit depends " +
    "on the format the game is based on. The two documents agree on the " +
    "card-pool maximum (52) and the deck size (exactly 40), so those are not " +
    "in dispute. The Tournament Rules and Policy governs sanctioned " +
    "tournaments and is the more recent document, so its reading is the value " +
    "recorded here — but the disagreement is unresolved and Optfall will not " +
    "assert on it.",
  citations: [
    TRP_9_3_POOL,
    TRP_9_3_COPIES,
    UPF_PAGE_ANY_FORMAT,
    UPF_PAGE_ADULT_HERO,
    UPF_PAGE_COPIES,
  ],
};

const UPF_UNRESOLVED =
  "Tournament Rules and Policy 9.3 and LSS's Ultimate Pit Fight format page " +
  "disagree about whether Ultimate Pit Fight fixes the hero subtype and the " +
  "copy limit or inherits them from a base format. The value recorded is the " +
  "Tournament Rules and Policy reading; see the format's `conflicts`.";

const ULTIMATE_PIT_FIGHT: FormatRules = {
  format: "ultimate-pit-fight",
  name: "Ultimate Pit Fight",
  category: "special",
  status: { kind: "active" },
  // Verified: trp:9.3 and the format page's start-of-game procedure state the
  // same 52 and the same 40 independently of one another.
  cardPoolMaximum: verified(52, [TRP_9_3_POOL, UPF_PAGE_START_OF_GAME]),
  deckSize: {
    minimum: verified(40, [TRP_9_3_COPIES, UPF_PAGE_START_OF_GAME]),
    maximum: {
      kind: "stated",
      cards: verified(40, [TRP_9_3_COPIES, UPF_PAGE_START_OF_GAME]),
    },
    exact: true,
  },
  copyLimit: {
    perUniqueCard: unverified(UPF_UNRESOLVED, 2, [TRP_9_3_COPIES, UPF_PAGE_COPIES]),
    overrides: [META_STATIC_OVERRIDE],
  },
  hero: {
    // Both sources agree a hero is registered and that there is exactly one of
    // them, so those two are verified even though the subtype is not.
    required: verified(true, [TRP_9_3_POOL, UPF_PAGE_ANY_FORMAT]),
    count: verified(1, [TRP_9_3_POOL, UPF_PAGE_ANY_FORMAT]),
    subtype: unverified(UPF_UNRESOLVED, "young-required", [TRP_9_3_POOL, UPF_PAGE_ADULT_HERO]),
    excludedSubtypes: unverified(UPF_UNRESOLVED, [], [TRP_9_3_POOL, UPF_PAGE_ADULT_HERO]),
    livingLegendHeroesLegal: unverified(
      "Neither trp:9.3 nor the Ultimate Pit Fight format page addresses living " +
        "legend heroes. The format page's claim that “Every card is legal” is " +
        "qualified elsewhere on the same page by a pointer to the Card Legality " +
        "Policy, which Optfall has not read.",
      null,
      [TRP_9_3_POOL, UPF_PAGE_ANY_FORMAT],
    ),
    rarity: null,
  },
  equipment: {
    registrationLimit: NO_REGISTRATION_LIMIT,
    startOfGameSlots: START_OF_GAME_SLOTS,
    startOfGameSlotCounts: START_OF_GAME_SLOT_COUNTS,
    rarity: null,
  },
  rarity: [],
  conflicts: [UPF_CONFLICT],
  citations: [
    TRP_1_3_CATEGORIES,
    TRP_9_3_POOL,
    TRP_9_3_COPIES,
    UPF_PAGE_ANY_FORMAT,
    UPF_PAGE_START_OF_GAME,
  ],
};

/* -------------------------------------------------------------------------- */
/* Lookup                                                                      */
/* -------------------------------------------------------------------------- */

/** Deck-construction rules for every format, keyed by {@link FormatId}. */
export const FORMAT_RULES: Readonly<Record<FormatId, FormatRules>> = {
  "classic-constructed": CLASSIC_CONSTRUCTED,
  blitz: BLITZ,
  "living-legend": LIVING_LEGEND,
  commoner: COMMONER,
  "silver-age": SILVER_AGE,
  "ultimate-pit-fight": ULTIMATE_PIT_FIGHT,
};

/** Deck-construction rules for one format. */
export function getFormatRules(format: FormatId): FormatRules {
  const rules = FORMAT_RULES[format];
  if (rules === undefined) {
    throw new TypeError(
      `Unknown format ${JSON.stringify(format)}. Expected one of: ${FORMATS.join(", ")}.`,
    );
  }
  return rules;
}

/** Formats that are currently sanctioned. */
export function activeFormats(): readonly FormatRules[] {
  return FORMATS.map((format) => getFormatRules(format)).filter(
    (rules) => rules.status.kind === "active",
  );
}

/**
 * Every constraint in a format that Optfall has *not* confirmed, as dotted
 * paths.
 *
 * This exists so that unverified-ness is visible rather than merely
 * representable: a checker can list what it declined to evaluate, and a build
 * step can assert the list has not grown. An empty result means every constraint
 * in the format is backed by a quotation from a retrieved document.
 */
export function unverifiedConstraints(rules: FormatRules): readonly string[] {
  const paths: string[] = [];
  const record = (path: string, sourced: Sourced<unknown>): void => {
    if (!isVerified(sourced)) paths.push(`${rules.format}.${path}`);
  };

  record("cardPoolMaximum", rules.cardPoolMaximum);
  record("deckSize.minimum", rules.deckSize.minimum);
  if (rules.deckSize.maximum.kind === "stated") {
    record("deckSize.maximum", rules.deckSize.maximum.cards);
  }
  record("copyLimit.perUniqueCard", rules.copyLimit.perUniqueCard);
  record("hero.required", rules.hero.required);
  record("hero.count", rules.hero.count);
  record("hero.subtype", rules.hero.subtype);
  record("hero.excludedSubtypes", rules.hero.excludedSubtypes);
  record("hero.livingLegendHeroesLegal", rules.hero.livingLegendHeroesLegal);
  if (rules.hero.rarity !== null) record("hero.rarity", rules.hero.rarity);
  if (rules.equipment.registrationLimit !== null) {
    record("equipment.registrationLimit", rules.equipment.registrationLimit);
  }
  record("equipment.startOfGameSlots", rules.equipment.startOfGameSlots);
  record("equipment.startOfGameSlotCounts", rules.equipment.startOfGameSlotCounts);
  if (rules.equipment.rarity !== null) record("equipment.rarity", rules.equipment.rarity);
  rules.rarity.forEach((restriction, index) => {
    record(`rarity[${String(index)}]`, restriction);
  });
  if (rules.status.kind === "retired") record("status.since", rules.status.since);

  return paths;
}

/**
 * Every citation a format's rules rest on, deduplicated by rule id and quote.
 *
 * Useful for a "show your working" surface, and for a CI check that no format
 * has drifted into carrying a constraint with no source behind it.
 */
export function formatCitations(rules: FormatRules): readonly RuleCitation[] {
  const seen = new Set<string>();
  const out: RuleCitation[] = [];
  const add = (citation: RuleCitation): void => {
    const key = `${citation.ruleId} ${citation.quote ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(citation);
  };
  const addAll = (citations: readonly RuleCitation[]): void => {
    for (const citation of citations) add(citation);
  };
  const addSourced = (sourced: Sourced<unknown>): void => {
    addAll(sourced.citations);
  };

  addAll(rules.citations);
  addSourced(rules.cardPoolMaximum);
  addSourced(rules.deckSize.minimum);
  if (rules.deckSize.maximum.kind === "stated") addSourced(rules.deckSize.maximum.cards);
  addSourced(rules.copyLimit.perUniqueCard);
  for (const override of rules.copyLimit.overrides) addAll(override.citations);
  addSourced(rules.hero.required);
  addSourced(rules.hero.count);
  addSourced(rules.hero.subtype);
  addSourced(rules.hero.excludedSubtypes);
  addSourced(rules.hero.livingLegendHeroesLegal);
  if (rules.hero.rarity !== null) addSourced(rules.hero.rarity);
  if (rules.equipment.registrationLimit !== null) addSourced(rules.equipment.registrationLimit);
  addSourced(rules.equipment.startOfGameSlots);
  addSourced(rules.equipment.startOfGameSlotCounts);
  if (rules.equipment.rarity !== null) addSourced(rules.equipment.rarity);
  for (const restriction of rules.rarity) addSourced(restriction);
  for (const conflict of rules.conflicts) addAll(conflict.citations);
  if (rules.status.kind === "retired") addSourced(rules.status.since);

  return out;
}
