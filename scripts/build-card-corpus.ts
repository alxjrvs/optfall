#!/usr/bin/env bun
/**
 * Regenerates the committed card corpus at `data/cards/`.
 *
 * `docs/PLAN.md` Phase 2 makes the card layer the product, and makes one
 * operational rule the thing the project lives or dies by: **"Sync, never
 * curate … Card data comes from the actively-maintained upstream on a scheduled
 * pull, pinned by commit, with fixes contributed upstream rather than forked …
 * it is the single most important operational rule in this document."** This
 * script is that pull. It fetches one file from one upstream repository at one
 * immutable commit, drops the fields the product does not serve, and writes the
 * result as committed JSON — which `docs/PLAN.md`, Stack, calls "simultaneously
 * the storage layer, the public API, the backup and the audit trail".
 *
 * It is a sibling of `scripts/build-rules-corpus.ts` and deliberately shares
 * its guarantees, because those guarantees are what make a dataset citable.
 *
 * WHY THE COMMIT SHA IS THE PIN. `main` is not a version. Fetching
 * `raw.githubusercontent.com/…/main/…` records nothing about *which* main, so
 * two people running this on the same afternoon can get different bytes and
 * neither file can say so. This script asks the GitHub API which commit last
 * touched the path, fetches the raw file **at that commit**, and records the
 * sha. `--ref` reproduces any earlier corpus exactly. That is the difference
 * between "synced from upstream" and "synced from upstream commit
 * 7a4822f…", and only the second one is a claim anybody can check.
 *
 * WHY THERE IS NO TIMESTAMP IN THE OUTPUT. Two runs against the same upstream
 * commit must produce byte-identical files, so that a non-empty diff means *the
 * cards changed* rather than *the tool ran again*. There is no `generatedAt`,
 * no hostname and no tool version anywhere below. The one date recorded —
 * {@link CorpusSource.committedAt} — is the upstream commit's own date, which
 * is a property of the commit rather than of our run, so it is stable under
 * regeneration and still answers "how fresh is this?" for `docs/PLAN.md`'s
 * "degrade visibly" rule.
 *
 * WHY THE FILES ARE PRETTY-PRINTED. Cards are errata'd, banned, unbanned and
 * retired to Living Legend, and when that happens **the diff is the changelog**.
 * A line-oriented diff answers "which cards changed, and in which field"; a
 * single 6 MB line answers nothing. The compression a minified file would buy
 * is the web server's job, not the repository's.
 *
 * WHY UPSTREAM ORDER IS PRESERVED VERBATIM. Cards arrive sorted by name and
 * printings arrive in upstream's own order, which carries information we would
 * destroy by re-sorting — and re-sorting 4,941 records once would produce a
 * diff that looks like a total rewrite. Determinism does not require *our*
 * order, only *an* order that is a function of the retrieved bytes, and
 * upstream's is exactly that.
 *
 * WHY TWO FILES. `cards.json` is everything a card page renders. `cards-search.json`
 * is the subset a search index needs — no printings, no images, no artists, no
 * flavour text — and it is a third of the size, so a third-party consumer who
 * wants "every card, its stats and its legality" does not have to download
 * 16,502 printings to get it. Both carry the same envelope, so either one alone
 * says which commit it came from.
 *
 * WHAT IS DELIBERATELY NOT HERE. No slug, no permalink, no derived legality
 * verdict, no reworded text. Addressing belongs to the site (`apps/site/src/lib`
 * derives `/cr/…` from the rules corpus the same way), and a corpus that
 * invents fields is a corpus that has to re-verify them on every sync.
 *
 * USAGE
 *
 *   bun run corpus:cards                     # fetch the newest upstream commit and write
 *   bun run corpus:cards -- --check          # regenerate and fail on any drift; writes nothing
 *   bun run corpus:cards -- --ref <sha>      # pin to a specific upstream commit
 *   bun run corpus:cards -- --source f.json  # use a local copy (requires --ref)
 *   bun run corpus:cards -- --out-dir dir    # write somewhere other than data/cards
 *   bun run corpus:cards -- --allow-warnings
 *
 * A run that produces warnings does **not** write by default, and the warning
 * that matters is `unknown-field`: upstream added something this script does
 * not know about, so the trim is silently discarding data nobody decided to
 * discard. That is the one failure mode a trimming script must not have, so it
 * is loud. `--allow-warnings` exists for the case where a human has read the
 * list and decided the new field is not wanted.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Format of the envelope and of the trimmed records.
 *
 * Bumped when the *shape* changes — a field dropped, added or renamed — so a
 * consumer can refuse a file it does not understand instead of silently reading
 * a field that moved.
 */
const SCHEMA_VERSION = 2;

/** Where the committed corpus lives, relative to the repository root. */
const CORPUS_DIRECTORY = "data/cards";

/** The full corpus: everything a card page renders. */
const FULL_FILE = "cards.json";

/** The compact corpus: what a search index needs and nothing else. */
const SEARCH_FILE = "cards-search.json";

/**
 * The upstream, named in `docs/PLAN.md` Phase 2 as "the actively-maintained
 * upstream". One repository, one file, one commit — a fork is what this project
 * has promised not to do ("Contribute upstream, never fork").
 */
const UPSTREAM_REPOSITORY = "the-fab-cube/flesh-and-blood-cards";
const UPSTREAM_PATH = "json/english/card.json";

/**
 * The repository root, derived from this file rather than from the cwd, so the
 * corpus lands in the same place no matter where the script is invoked from.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The rights notice carried by both files.
 *
 * `docs/PLAN.md`, "Required of us" and "MIT code, open data": card names and
 * card text are Legend Story Studios' property, displayed under their
 * third-party application policy, and **never relicensed by us**. What Optfall
 * openly licenses is its structural work — the selection, the pinning, the
 * envelope. A bulk export that travels without this line is an export that
 * invites the one thing the permission envelope forbids, so it is a field in
 * the data rather than a paragraph in a README nobody ships alongside it.
 *
 * It is a constant, so it costs the diff nothing.
 */
const RIGHTS =
  "Card names, card text and card images are the property of Legend Story Studios. " +
  "Optfall is in no way affiliated with Legend Story Studios. This dataset displays that " +
  "content under LSS's third-party application policy and does not relicense it. Only " +
  "Optfall's structural work over the dataset — the field selection, the upstream pin and " +
  "this envelope — is openly licensed. The upstream compilation is " +
  `https://github.com/${UPSTREAM_REPOSITORY}, which publishes no licence of its own.`;

/* -------------------------------------------------------------------------- */
/* The trim                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Upstream card fields this corpus does **not** carry, each with the reason.
 *
 * Printed on every run and asserted against the retrieved file, so a dropped
 * field is a decision on the record rather than an absence somebody has to
 * notice. `docs/PLAN.md` is explicit that being right is the product; quietly
 * losing a field is the cheapest way to stop being right.
 */
const DROPPED_CARD_FIELDS: Readonly<Record<string, string>> = {
  functional_text_plain:
    "the same text as functional_text with the ** emphasis markers removed; the marked-up form is the superset, and cards-search.json carries the plain form verbatim for the lede",
  cards_referenced_by:
    "the exact inverse of referenced_cards, verified across all 4,941 cards; the site derives it in one pass, exactly as apps/site/src/lib/rules.ts derives children from parentId",
};

/** Upstream printing fields this corpus does **not** carry, each with the reason. */
const DROPPED_PRINTING_FIELDS: Readonly<Record<string, string>> = {
  set_printing_unique_id:
    "an opaque join key into an upstream table this corpus does not ship; (set_id, id, edition) identifies the same grouping in fields we do carry",
  flavor_text_plain:
    "the same text as flavor_text with the ** emphasis markers removed; differs on 2 of 16,502 printings",
};

/**
 * Card fields carried into `cards.json`, in written order.
 *
 * Names are upstream's, verbatim and snake_case, while the envelope around them
 * is ours and camelCase. That inconsistency is deliberate and it is the honest
 * one: a renamed field is a curation step that has to be re-verified every time
 * upstream's schema moves, and a reader who wants to check us against the source
 * can diff the two files field for field. The envelope is ours, so it reads like
 * the rest of the repository.
 */
const CARD_FIELDS = [
  "unique_id",
  "name",
  "color",
  "pitch",
  "cost",
  "power",
  "defense",
  "health",
  "intelligence",
  "arcane",
  "types",
  "traits",
  "card_keywords",
  "abilities_and_effects",
  "ability_and_effect_keywords",
  "granted_keywords",
  "removed_keywords",
  "interacts_with_keywords",
  "functional_text",
  "type_text",
  "played_horizontally",
  "referenced_cards",
] as const;

/** Printing fields carried into `cards.json`, in written order. */
const PRINTING_FIELDS = [
  "unique_id",
  "id",
  "set_id",
  "edition",
  "foiling",
  "rarity",
  "expansion_slot",
  "artists",
  "art_variations",
  "flavor_text",
  "image_url",
  "image_rotation_degrees",
  "double_sided_card_info",
  "tcgplayer_product_id",
  "tcgplayer_url",
] as const;

/**
 * Every per-format legality boolean, in upstream's order.
 *
 * All of them are carried into **both** files. `docs/PLAN.md` Phase 2:
 * "per-format legality already computed … So the first release answers 'is this
 * legal' without any of our own legality work." This is that answer, so it is
 * the last thing to trim.
 *
 * ── A TRAP, MEASURED RATHER THAN ASSUMED ───────────────────────────────────
 *
 * `*_legal` and `*_banned` are **not** complements upstream, and reading the
 * first one alone is how a card database ships wrong verdicts. In this commit:
 *
 *   cc_legal && cc_banned          51   (every cc_banned card is also cc_legal)
 *   cc_legal && cc_living_legend   42
 *   cc_banned && !cc_legal          0
 *   blitz_legal && blitz_banned    45
 *   ll_legal && ll_banned           5
 *   ll_restricted && ll_legal      20
 *
 * So `cc_legal` means "in the Classic Constructed card pool", not "you may play
 * it": a consumer that renders `cc_legal` as a Legal pill marks all 51 banned
 * cards legal. `docs/PLAN.md` Phase 3 names the commercially-backed incumbent
 * shipping "incorrect banned flags on legal cards" as the reason this project
 * exists, and this is the exact shape of that bug. A verdict is
 * `legal && !banned && !suspended && !living_legend`, computed by the consumer;
 * this corpus mirrors upstream's flags and does not pre-chew them, because a
 * derived verdict is a field that has to be re-verified on every sync.
 */
const LEGALITY_FLAGS = [
  "blitz_legal",
  "cc_legal",
  "commoner_legal",
  "ll_legal",
  "silver_age_legal",
  "blitz_living_legend",
  "cc_living_legend",
  "blitz_banned",
  "cc_banned",
  "commoner_banned",
  "ll_banned",
  "silver_age_banned",
  "upf_banned",
  "blitz_suspended",
  "cc_suspended",
  "commoner_suspended",
  "ll_restricted",
] as const;

/**
 * Dates on which a legality flag started applying, present only on the cards it
 * applies to.
 *
 * These are the most valuable fields in the file relative to their size — 7 KB
 * that are the only machine-readable seed anywhere for `docs/PLAN.md` Phase 3's
 * "legality that knows about time". Trimming them to save bytes would have cut
 * the one thing no other card database carries.
 */
const LEGALITY_START_FIELDS = [
  "blitz_banned_start",
  "cc_banned_start",
  "commoner_banned_start",
  "ll_banned_start",
  "silver_age_banned_start",
  "upf_banned_start",
  "blitz_living_legend_start",
  "cc_living_legend_start",
  "ll_restricted_start",
] as const;

/**
 * Restriction that applies to a whole card cycle rather than one card.
 *
 * Separate from {@link LEGALITY_FLAGS} because upstream writes it only on the
 * 20 cards it applies to, so counting it beside flags that are on every card
 * would compare two different things.
 */
const LEGALITY_EXTRA_FLAGS = ["ll_restricted_affects_full_cycle"] as const;

/**
 * The complete boolean vocabulary of `cards-search.json`'s `flags`, published
 * in the envelope as `legalityFlags` so the compact encoding is legible without
 * this file.
 */
const SEARCH_FLAG_FIELDS = [
  ...LEGALITY_FLAGS,
  ...LEGALITY_EXTRA_FLAGS,
] as const;

/* -------------------------------------------------------------------------- */
/* The committed shape                                                         */
/* -------------------------------------------------------------------------- */

/** One face of a double-faced printing. */
interface DoubleSidedFace {
  readonly other_face_unique_id: string;
  readonly is_front: boolean;
  readonly is_DFC: boolean;
}

/** A printing as committed — {@link PRINTING_FIELDS}, in that order. */
interface CorpusPrinting {
  readonly unique_id: string;
  readonly id: string;
  readonly set_id: string;
  readonly edition: string;
  readonly foiling: string;
  readonly rarity: string;
  readonly expansion_slot: boolean;
  readonly artists: readonly string[];
  readonly art_variations: readonly string[];
  readonly flavor_text: string;
  /**
   * `null` on the four SUP token printings — `Confidence` SUP239, `Might`
   * SUP240, `Toughness` SUP241 and `Vigor` SUP242 — which upstream carries with
   * no published face. Kept as `null` rather than coerced to `""`, because
   * "there is no image" and "the image is the empty string" are different
   * claims and only one of them is true.
   */
  readonly image_url: string | null;
  readonly image_rotation_degrees: number;
  readonly double_sided_card_info?: readonly DoubleSidedFace[];
  /**
   * TCGplayer's identifier for this printing, and the storefront URL built from
   * it. Both are upstream's, carried verbatim.
   *
   * OPTIONAL BECAUSE UPSTREAM OMITS THE KEYS, rather than publishing them as
   * `null` or `""`. 1,336 of 16,502 printings have neither, concentrated in
   * promotional and organised-play sets — WIN, SBL, SBA, SLY, SGB and the
   * armory sets carry none at all. Omitting them here mirrors that exactly, so
   * a reader can tell "upstream published no product" from "we dropped it",
   * which is the same distinction `image_url`'s `null` is protecting one field
   * up.
   *
   * THE URL IS CARRIED RATHER THAN DERIVED, even though it is a function of the
   * id. It encodes the foiling — `?Language=English&Printing=Rainbow+Foil` —
   * and rebuilding that would mean maintaining our own foiling-code table and
   * re-verifying it every time upstream moves. A derived link is a claim we
   * manufactured; a carried one is a claim we can diff against the source.
   *
   * These were in `DROPPED_PRINTING_FIELDS` until the permission question they
   * were dropped over was answered — see `docs/COMPLIANCE.md` §2.
   */
  readonly tcgplayer_product_id?: string;
  readonly tcgplayer_url?: string;
}

/** Per-format legality, flags then start dates. Keys are upstream's. */
type CorpusLegality = Readonly<Record<string, boolean | string>>;

/** A card as committed — {@link CARD_FIELDS}, then legality, then printings. */
interface CorpusCard {
  readonly unique_id: string;
  readonly name: string;
  readonly color: string;
  readonly pitch: string;
  readonly cost: string;
  readonly power: string;
  readonly defense: string;
  readonly health: string;
  readonly intelligence: string;
  readonly arcane: string;
  readonly types: readonly string[];
  readonly traits: readonly string[];
  readonly card_keywords: readonly string[];
  readonly abilities_and_effects: readonly string[];
  readonly ability_and_effect_keywords: readonly string[];
  readonly granted_keywords: readonly string[];
  readonly removed_keywords: readonly string[];
  readonly interacts_with_keywords: readonly string[];
  readonly functional_text: string;
  readonly type_text: string;
  readonly played_horizontally: boolean;
  readonly referenced_cards: readonly string[];
  readonly legality: CorpusLegality;
  readonly printings: readonly CorpusPrinting[];
}

/**
 * A card as it appears in the compact search file.
 *
 * The test applied to every field here: **can a query in `docs/DESIGN.md`'s
 * grammar be answered without it?** `pitch:3`, `class:guardian`, `type:attack`,
 * `cost:2` and a text search all land in the fields below; `set:` and `rarity:`
 * land via the two derived ones. What is absent is what only a card *page*
 * needs — printings, images, artists, flavour text, the rules cross-reference —
 * because a search index carrying those is one nobody can afford to download.
 */
interface SearchCard {
  readonly unique_id: string;
  readonly name: string;
  readonly color: string;
  readonly pitch: string;
  readonly cost: string;
  readonly power: string;
  readonly defense: string;
  readonly health: string;
  readonly intelligence: string;
  readonly arcane: string;
  readonly types: readonly string[];
  readonly traits: readonly string[];
  readonly card_keywords: readonly string[];
  readonly type_text: string;
  /** `functional_text_plain`, verbatim: the search text and the result lede. */
  readonly text: string;
  /** Distinct `set_id`s, first-appearance order. Derived, for `set:`. */
  readonly sets: readonly string[];
  /** Distinct printing rarities, first-appearance order. Derived, for `rarity:`. */
  readonly rarities: readonly string[];
  /**
   * The legality flags that are **true** for this card, in {@link LEGALITY_FLAGS}
   * order. Absence means false; the full vocabulary is in the envelope's
   * `legalityFlags`, so the file explains its own encoding.
   *
   * The one place this dataset re-encodes rather than mirrors, and the trade is
   * measured: written out as seventeen booleans per card, legality was 2.19 MB
   * of a 6.22 MB file — 35% of a file whose entire reason to exist is being
   * small enough to hand to a client. About 4.3 flags per card are true, so the
   * list form costs a quarter of that. It is lossless (a boolean vocabulary with
   * a fixed key set), it stays line-oriented (a ban shows up as one added line
   * naming the format), and `cards.json` still carries the explicit object for
   * anyone who wants every flag spelled out.
   */
  readonly flags: readonly string[];
  /**
   * Start dates, carried only where upstream has them — the same fields
   * `cards.json` nests inside `legality`. They stay in the compact file because
   * they are ~7 KB and they are the seed for `legal:cc@DATE`, which
   * `docs/DESIGN.md` calls the operator "unavailable anywhere else".
   */
  readonly since?: Readonly<Record<string, string>>;
}

/** Provenance of the exact bytes this corpus was built from. */
interface CorpusSource {
  /** `the-fab-cube/flesh-and-blood-cards`. */
  readonly repository: string;
  /** Path within that repository. */
  readonly path: string;
  /**
   * The upstream commit this corpus was built from — the pin.
   *
   * `docs/PLAN.md` Phase 2: "pinned by commit". Re-run with `--ref <commit>`
   * and the output is byte-identical, forever, regardless of what upstream has
   * done since.
   */
  readonly commit: string;
  /** That commit's own date, ISO 8601. A property of the commit, not of this run. */
  readonly committedAt: string;
  /** The immutable raw URL the bytes came from. */
  readonly url: string;
  /** Size of the retrieved file in bytes. */
  readonly bytes: number;
  /**
   * SHA-256 of the retrieved file, lowercase hex. Re-download `url`, hash it,
   * and compare: that is how a reader verifies this corpus against the source
   * without trusting us.
   */
  readonly sha256: string;
}

/** Counts that make the file self-checking. Every one is derived from the data. */
interface CorpusCounts {
  readonly cards: number;
  readonly printings: number;
  /** Distinct card names — lower than `cards`, because pitch variants share one. */
  readonly names: number;
  /** Distinct `set_id`s across every printing. */
  readonly sets: number;
  /** How many cards carry each legality flag, keyed by {@link LEGALITY_FLAGS}. */
  readonly legality: Readonly<Record<string, number>>;
}

/** The envelope both committed files share. */
interface CorpusEnvelope {
  readonly schemaVersion: number;
  readonly source: CorpusSource;
  readonly rights: string;
  /**
   * Every legality flag in this dataset's vocabulary, in order.
   *
   * `cards.json` writes each one explicitly on every card; `cards-search.json`
   * lists only the true ones. Publishing the vocabulary is what makes the second
   * encoding readable on its own — absence means false, and this is the list
   * absence is measured against.
   */
  readonly legalityFlags: readonly string[];
  readonly counts: CorpusCounts;
}

interface CardCorpus extends CorpusEnvelope {
  readonly cards: readonly CorpusCard[];
}

interface CardSearchCorpus extends CorpusEnvelope {
  readonly cards: readonly SearchCard[];
}

/** Something the retrieved file did that this script did not act on. */
interface Warning {
  readonly kind: "unknown-field" | "duplicate-id";
  readonly detail: string;
}

/* -------------------------------------------------------------------------- */
/* Reading the upstream record                                                 */
/* -------------------------------------------------------------------------- */

type JsonRecord = Record<string, unknown>;

function describe(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  return `a ${typeof value}`;
}

/**
 * Readers that throw rather than coerce.
 *
 * A card whose `name` is not a string is upstream breaking its own schema, and
 * the honest response is a crash naming the card — not a corpus with the string
 * `"undefined"` in it. `docs/PLAN.md`: "Parsers are deterministic code whose
 * output diffs cleanly and **fails loudly**."
 */
function text(record: JsonRecord, key: string, where: string): string {
  const value = record[key];
  if (typeof value === "string") return value;
  throw new Error(
    `${where}: expected a string at "${key}", found ${describe(value)}`,
  );
}

/**
 * A string that upstream is allowed to publish as `null`.
 *
 * Used in exactly one place — a printing's `image_url` — so the accommodation
 * names the field it was made for rather than loosening every reader. If a
 * second field starts arriving null, {@link text} throws and somebody decides
 * about it, which is the behaviour that caught this one.
 */
function nullableText(
  record: JsonRecord,
  key: string,
  where: string,
): string | null {
  if (record[key] === null) return null;
  return text(record, key, where);
}

/**
 * A string upstream is allowed to leave out entirely.
 *
 * Distinct from {@link nullableText}, and the distinction is upstream's rather
 * than ours: `image_url` is always present and sometimes `null`, while the
 * TCGplayer fields are simply absent on printings that have no product. A key
 * that IS present still has to be a string, so a field that starts arriving as
 * a number or a null fails the build instead of being waved through.
 */
function optionalText(
  record: JsonRecord,
  key: string,
  where: string,
): string | undefined {
  if (!(key in record)) return undefined;
  return text(record, key, where);
}

/**
 * `tcgplayer_url`, checked at the boundary rather than trusted.
 *
 * THE ONLY UPSTREAM STRING THAT BECOMES AN `href`. Card images are ingested to
 * our own host, so `image_url` never reaches markup; this value does, on 15,166
 * rows. That makes this the one field where a vandalised or compromised sync of
 * a community repository — which publishes no licence, has no release process
 * and is pinned here precisely because it can change under us — turns into
 * script execution on every card page, via a `javascript:` or `data:` value that
 * is a perfectly valid string.
 *
 * So it is rejected here, where `text()`'s throwing already lives, rather than
 * noticed later by a test over the pinned corpus. A refusal at the boundary
 * fails the sync that introduced it and names the printing; a downstream
 * assertion only fails once the bad value is already committed.
 *
 * The origin is pinned, not merely the scheme: every one of the 15,166 URLs
 * upstream publishes today is on this exact host, so anything else is a change
 * worth a human rather than a value worth carrying.
 */
function storefrontUrl(
  printing: JsonRecord,
  where: string,
): string | undefined {
  const value = optionalText(printing, "tcgplayer_url", where);
  if (value === undefined) return undefined;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `${where}: expected an absolute URL at "tcgplayer_url", found ${describe(value)}`,
    );
  }
  if (parsed.origin !== STOREFRONT_ORIGIN) {
    throw new Error(
      `${where}: expected "tcgplayer_url" on ${STOREFRONT_ORIGIN}, found ${parsed.origin}`,
    );
  }
  return value;
}

/** The only origin a carried storefront link may point at. */
const STOREFRONT_ORIGIN = "https://www.tcgplayer.com";

function flag(record: JsonRecord, key: string, where: string): boolean {
  const value = record[key];
  if (typeof value === "boolean") return value;
  throw new Error(
    `${where}: expected a boolean at "${key}", found ${describe(value)}`,
  );
}

function count(record: JsonRecord, key: string, where: string): number {
  const value = record[key];
  if (typeof value === "number") return value;
  throw new Error(
    `${where}: expected a number at "${key}", found ${describe(value)}`,
  );
}

function list(
  record: JsonRecord,
  key: string,
  where: string,
): readonly string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(
      `${where}: expected an array at "${key}", found ${describe(value)}`,
    );
  }
  return value.map((entry, index) => {
    if (typeof entry === "string") return entry;
    throw new Error(
      `${where}: expected a string at "${key}[${String(index)}]", found ${describe(entry)}`,
    );
  });
}

function records(
  record: JsonRecord,
  key: string,
  where: string,
): readonly JsonRecord[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(
      `${where}: expected an array at "${key}", found ${describe(value)}`,
    );
  }
  return value.map((entry, index) => {
    if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
      return entry as JsonRecord;
    }
    throw new Error(
      `${where}: expected an object at "${key}[${String(index)}]", found ${describe(entry)}`,
    );
  });
}

/* -------------------------------------------------------------------------- */
/* The transform                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Legality, assembled from the flags that are always present and the start
 * dates that are present only where they apply.
 *
 * `exactOptionalPropertyTypes` is why the dates are added conditionally rather
 * than written as `undefined`: an absent start date and a null one say different
 * things, and `JSON.stringify` erases the difference by dropping `undefined`
 * silently. Adding the key only when upstream has it keeps the file's shape a
 * statement about the card.
 */
function toLegality(card: JsonRecord, where: string): CorpusLegality {
  const legality: Record<string, boolean | string> = {};
  for (const field of LEGALITY_FLAGS)
    legality[field] = flag(card, field, where);
  for (const field of LEGALITY_EXTRA_FLAGS) {
    if (field in card) legality[field] = flag(card, field, where);
  }
  for (const field of LEGALITY_START_FIELDS) {
    if (field in card) legality[field] = text(card, field, where);
  }
  return legality;
}

function toFace(face: JsonRecord, where: string): DoubleSidedFace {
  return {
    other_face_unique_id: text(face, "other_face_unique_id", where),
    is_front: flag(face, "is_front", where),
    is_DFC: flag(face, "is_DFC", where),
  };
}

/**
 * Copy one printing into the committed shape, field by field.
 *
 * Explicit rather than a pass-through, for the reason
 * `scripts/build-rules-corpus.ts` gives about sections: the committed file's key
 * order is a decision made here, so a change upstream cannot silently reorder
 * 16,502 records and produce a diff that looks like a data change.
 */
function toCorpusPrinting(printing: JsonRecord, where: string): CorpusPrinting {
  const faces =
    "double_sided_card_info" in printing
      ? records(printing, "double_sided_card_info", where).map((face) =>
          toFace(face, where),
        )
      : undefined;

  const productId = optionalText(printing, "tcgplayer_product_id", where);
  const productUrl = storefrontUrl(printing, where);

  const copy: CorpusPrinting = {
    unique_id: text(printing, "unique_id", where),
    id: text(printing, "id", where),
    set_id: text(printing, "set_id", where),
    edition: text(printing, "edition", where),
    foiling: text(printing, "foiling", where),
    rarity: text(printing, "rarity", where),
    expansion_slot: flag(printing, "expansion_slot", where),
    artists: list(printing, "artists", where),
    art_variations: list(printing, "art_variations", where),
    flavor_text: text(printing, "flavor_text", where),
    image_url: nullableText(printing, "image_url", where),
    image_rotation_degrees: count(printing, "image_rotation_degrees", where),
    ...(faces === undefined ? {} : { double_sided_card_info: faces }),
    ...(productId === undefined ? {} : { tcgplayer_product_id: productId }),
    ...(productUrl === undefined ? {} : { tcgplayer_url: productUrl }),
  };
  return copy;
}

/** Copy one card into the committed shape, field by field. */
function toCorpusCard(card: JsonRecord, where: string): CorpusCard {
  const copy: CorpusCard = {
    unique_id: text(card, "unique_id", where),
    name: text(card, "name", where),
    color: text(card, "color", where),
    pitch: text(card, "pitch", where),
    cost: text(card, "cost", where),
    power: text(card, "power", where),
    defense: text(card, "defense", where),
    health: text(card, "health", where),
    intelligence: text(card, "intelligence", where),
    arcane: text(card, "arcane", where),
    types: list(card, "types", where),
    traits: list(card, "traits", where),
    card_keywords: list(card, "card_keywords", where),
    abilities_and_effects: list(card, "abilities_and_effects", where),
    ability_and_effect_keywords: list(
      card,
      "ability_and_effect_keywords",
      where,
    ),
    granted_keywords: list(card, "granted_keywords", where),
    removed_keywords: list(card, "removed_keywords", where),
    interacts_with_keywords: list(card, "interacts_with_keywords", where),
    functional_text: text(card, "functional_text", where),
    type_text: text(card, "type_text", where),
    played_horizontally: flag(card, "played_horizontally", where),
    // Present on 1,423 of 4,941 cards upstream; written as `[]` on the rest so
    // every record has the same shape and a consumer never has to test for the
    // key. The inverse relation is not written at all — see DROPPED_CARD_FIELDS.
    referenced_cards:
      "referenced_cards" in card ? list(card, "referenced_cards", where) : [],
    legality: toLegality(card, where),
    printings: records(card, "printings", where).map((printing) =>
      toCorpusPrinting(printing, `${where} printing`),
    ),
  };
  return copy;
}

/** Distinct values in first-appearance order — a deterministic derivation. */
function distinct(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (value === "" || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * The compact record.
 *
 * `text` is `functional_text_plain` taken **verbatim** from upstream rather than
 * derived by stripping the markers off `functional_text`. Both files therefore
 * carry LSS's text exactly as the upstream publishes it, and neither one
 * contains a string this script composed — which is the shipped-product rule in
 * `docs/PLAN.md` applied to the data layer.
 */
function toSearchCard(card: JsonRecord, where: string): SearchCard {
  const printings = records(card, "printings", where);
  const since: Record<string, string> = {};
  for (const field of LEGALITY_START_FIELDS) {
    if (field in card) since[field] = text(card, field, where);
  }
  const copy: SearchCard = {
    unique_id: text(card, "unique_id", where),
    name: text(card, "name", where),
    color: text(card, "color", where),
    pitch: text(card, "pitch", where),
    cost: text(card, "cost", where),
    power: text(card, "power", where),
    defense: text(card, "defense", where),
    health: text(card, "health", where),
    intelligence: text(card, "intelligence", where),
    arcane: text(card, "arcane", where),
    types: list(card, "types", where),
    traits: list(card, "traits", where),
    card_keywords: list(card, "card_keywords", where),
    type_text: text(card, "type_text", where),
    text: text(card, "functional_text_plain", where),
    sets: distinct(
      printings.map((printing) => text(printing, "set_id", where)),
    ),
    rarities: distinct(
      printings.map((printing) => text(printing, "rarity", where)),
    ),
    flags: SEARCH_FLAG_FIELDS.filter(
      (field) => field in card && flag(card, field, where),
    ),
    ...(Object.keys(since).length === 0 ? {} : { since }),
  };
  return copy;
}

/* -------------------------------------------------------------------------- */
/* Counting, and catching what the trim did not account for                     */
/* -------------------------------------------------------------------------- */

const KNOWN_CARD_FIELDS: ReadonlySet<string> = new Set<string>([
  ...CARD_FIELDS,
  ...LEGALITY_FLAGS,
  ...LEGALITY_EXTRA_FLAGS,
  ...LEGALITY_START_FIELDS,
  "functional_text_plain",
  "printings",
  ...Object.keys(DROPPED_CARD_FIELDS),
]);

const KNOWN_PRINTING_FIELDS: ReadonlySet<string> = new Set<string>([
  ...PRINTING_FIELDS,
  ...Object.keys(DROPPED_PRINTING_FIELDS),
]);

/**
 * Every upstream key this script has no opinion about.
 *
 * The whole risk of a trimming script is that it drops something nobody decided
 * to drop, and that failure is invisible in the output by definition — the field
 * simply is not there. So an unknown key is a warning that blocks the write. A
 * new upstream field arrives as a build failure naming it, which is the only
 * moment at which somebody can actually make the decision.
 */
function unknownFields(cards: readonly JsonRecord[]): readonly Warning[] {
  const cardKeys = new Map<string, string>();
  const printingKeys = new Map<string, string>();

  for (const card of cards) {
    const name = typeof card["name"] === "string" ? card["name"] : "(unnamed)";
    for (const key of Object.keys(card)) {
      if (!KNOWN_CARD_FIELDS.has(key) && !cardKeys.has(key))
        cardKeys.set(key, name);
    }
    const printings = card["printings"];
    if (!Array.isArray(printings)) continue;
    for (const printing of printings) {
      if (typeof printing !== "object" || printing === null) continue;
      for (const key of Object.keys(printing as JsonRecord)) {
        if (!KNOWN_PRINTING_FIELDS.has(key) && !printingKeys.has(key)) {
          printingKeys.set(key, name);
        }
      }
    }
  }

  const warnings: Warning[] = [];
  for (const [key, name] of cardKeys) {
    warnings.push({
      kind: "unknown-field",
      detail: `card field "${key}" (first seen on ${name}) is new upstream — decide whether to carry or drop it`,
    });
  }
  for (const [key, name] of printingKeys) {
    warnings.push({
      kind: "unknown-field",
      detail: `printing field "${key}" (first seen on ${name}) is new upstream — decide whether to carry or drop it`,
    });
  }
  return warnings;
}

/** Identifiers must be unique: they are what the site addresses records by. */
function duplicateIds(cards: readonly CorpusCard[]): readonly Warning[] {
  const warnings: Warning[] = [];
  const cardIds = new Set<string>();
  const printingIds = new Set<string>();
  for (const card of cards) {
    if (cardIds.has(card.unique_id)) {
      warnings.push({
        kind: "duplicate-id",
        detail: `two cards share unique_id ${card.unique_id} (${card.name})`,
      });
    }
    cardIds.add(card.unique_id);
    for (const printing of card.printings) {
      if (printingIds.has(printing.unique_id)) {
        warnings.push({
          kind: "duplicate-id",
          detail: `two printings share unique_id ${printing.unique_id} (${card.name} ${printing.id})`,
        });
      }
      printingIds.add(printing.unique_id);
    }
  }
  return warnings;
}

function countCorpus(cards: readonly CorpusCard[]): CorpusCounts {
  const names = new Set<string>();
  const sets = new Set<string>();
  let printings = 0;
  const legality: Record<string, number> = {};
  for (const field of LEGALITY_FLAGS) legality[field] = 0;

  for (const card of cards) {
    names.add(card.name);
    printings += card.printings.length;
    for (const printing of card.printings) sets.add(printing.set_id);
    for (const field of LEGALITY_FLAGS) {
      if (card.legality[field] === true)
        legality[field] = (legality[field] ?? 0) + 1;
    }
  }

  return {
    cards: cards.length,
    printings,
    names: names.size,
    sets: sets.size,
    legality,
  };
}

/* -------------------------------------------------------------------------- */
/* Retrieval                                                                    */
/* -------------------------------------------------------------------------- */

interface UpstreamCommit {
  readonly sha: string;
  readonly committedAt: string;
}

/**
 * Ask GitHub for a commit — the newest one touching the path, or a named one.
 *
 * `GITHUB_TOKEN` is used when present, purely for the rate limit on a scheduled
 * job. It is read into a header and never written to the corpus, never logged
 * and never echoed.
 */
async function resolveCommit(ref: string | undefined): Promise<UpstreamCommit> {
  const base = `https://api.github.com/repos/${UPSTREAM_REPOSITORY}/commits`;
  const url =
    ref === undefined
      ? `${base}?path=${encodeURIComponent(UPSTREAM_PATH)}&per_page=1`
      : `${base}/${encodeURIComponent(ref)}`;

  const token = process.env["GITHUB_TOKEN"];
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "optfall-card-corpus",
      ...(token === undefined || token === ""
        ? {}
        : { authorization: `Bearer ${token}` }),
    },
  });
  if (!response.ok) {
    throw new Error(
      `Asking GitHub which commit to pin returned HTTP ${String(response.status)} ${response.statusText}. ` +
        "Not falling back to `main`: an unpinned corpus is the thing this script exists to prevent.",
    );
  }

  const payload: unknown = await response.json();
  const commit = Array.isArray(payload) ? payload[0] : payload;
  if (typeof commit !== "object" || commit === null) {
    throw new Error(`GitHub returned no commit for ${UPSTREAM_PATH}.`);
  }

  const record = commit as JsonRecord;
  const sha = record["sha"];
  const detail = record["commit"];
  const committer =
    typeof detail === "object" && detail !== null
      ? (detail as JsonRecord)["committer"]
      : undefined;
  const date =
    typeof committer === "object" && committer !== null
      ? (committer as JsonRecord)["date"]
      : undefined;

  if (typeof sha !== "string" || typeof date !== "string") {
    throw new Error(
      "GitHub's commit payload carried no sha or no date; refusing to write an unpinned corpus.",
    );
  }
  return { sha, committedAt: date };
}

/** The immutable raw URL for a commit — never `main`, which is not a version. */
function rawUrl(commit: string): string {
  return `https://raw.githubusercontent.com/${UPSTREAM_REPOSITORY}/${commit}/${UPSTREAM_PATH}`;
}

/* -------------------------------------------------------------------------- */
/* Serialising, and drift                                                       */
/* -------------------------------------------------------------------------- */

/** Two-space indent and a trailing newline — POSIX-text and `git diff`-shaped. */
function serialise(corpus: CardCorpus | CardSearchCorpus): string {
  return `${JSON.stringify(corpus, null, 2)}\n`;
}

/** First line at which two texts differ, 1-indexed, or `null` if they match. */
function firstDifferingLine(a: string, b: string): number | null {
  const left = a.split("\n");
  const right = b.split("\n");
  const limit = Math.max(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index + 1;
  }
  return null;
}

function argumentAfter(argFlag: string): string | undefined {
  const index = process.argv.indexOf(argFlag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(argFlag: string): boolean {
  return process.argv.includes(argFlag);
}

/* -------------------------------------------------------------------------- */
/* Run                                                                          */
/* -------------------------------------------------------------------------- */

const checkOnly = hasFlag("--check");
const allowWarnings = hasFlag("--allow-warnings");
const pinnedRef = argumentAfter("--ref");
const sourcePath = argumentAfter("--source");
const outDirectory = argumentAfter("--out-dir") ?? join(ROOT, CORPUS_DIRECTORY);

const log: string[] = [];

if (sourcePath !== undefined && pinnedRef === undefined) {
  throw new Error(
    "--source needs --ref: a file on disk cannot say which upstream commit it came from, " +
      "and a corpus that cannot name its commit is not pinned.",
  );
}

// ---------------------------------------------------------------------------
// Retrieve. The hash is of the retrieved bytes either way — a local file is
// hashed exactly as a downloaded one is, so `--source` with the right `--ref`
// produces a corpus indistinguishable from a fetched one.
// ---------------------------------------------------------------------------

const commit = await resolveCommit(pinnedRef);
const url = rawUrl(commit.sha);

let bytes: Uint8Array;
if (sourcePath === undefined) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Fetching ${url} returned HTTP ${String(response.status)} ${response.statusText}. ` +
        "Not writing a file; an error page is not the card database.",
    );
  }
  bytes = new Uint8Array(await response.arrayBuffer());
  log.push(`retrieved ${url}`);
} else {
  bytes = new Uint8Array(readFileSync(sourcePath));
  log.push(`read ${sourcePath} (local, pinned to ${commit.sha})`);
}

const source: CorpusSource = {
  repository: UPSTREAM_REPOSITORY,
  path: UPSTREAM_PATH,
  commit: commit.sha,
  committedAt: commit.committedAt,
  url,
  bytes: bytes.byteLength,
  sha256: createHash("sha256").update(bytes).digest("hex"),
};

// ---------------------------------------------------------------------------
// Read and trim.
// ---------------------------------------------------------------------------

const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
if (!Array.isArray(parsed)) {
  throw new Error(
    `${url} is not a JSON array of cards; it is ${describe(parsed)}.`,
  );
}

const upstream: readonly JsonRecord[] = parsed.map((entry, index) => {
  if (typeof entry === "object" && entry !== null && !Array.isArray(entry)) {
    return entry as JsonRecord;
  }
  throw new Error(
    `card ${String(index)} is ${describe(entry)}, not an object.`,
  );
});

const cards = upstream.map((card, index) =>
  toCorpusCard(
    card,
    `card ${String(index)} (${String(card["name"] ?? "unnamed")})`,
  ),
);
const searchCards = upstream.map((card, index) =>
  toSearchCard(
    card,
    `card ${String(index)} (${String(card["name"] ?? "unnamed")})`,
  ),
);

const counts = countCorpus(cards);
const warnings = [...unknownFields(upstream), ...duplicateIds(cards)];

log.push(
  `upstream  ${UPSTREAM_REPOSITORY} ${UPSTREAM_PATH}`,
  `commit    ${source.commit} (${source.committedAt})`,
  `sha256    ${source.sha256} (${String(source.bytes)} bytes)`,
  "",
  `cards     ${String(counts.cards)}`,
  `names     ${String(counts.names)}`,
  `printings ${String(counts.printings)}`,
  `sets      ${String(counts.sets)}`,
  "",
  ...LEGALITY_FLAGS.map(
    (field) => `${field.padEnd(20)} ${String(counts.legality[field] ?? 0)}`,
  ),
  "",
  "dropped from cards.json:",
  ...Object.entries(DROPPED_CARD_FIELDS).map(
    ([field, why]) => `  ${field} — ${why}`,
  ),
  ...Object.entries(DROPPED_PRINTING_FIELDS).map(
    ([field, why]) => `  printings[].${field} — ${why}`,
  ),
  "",
  `warnings  ${String(warnings.length)}`,
);
for (const warning of warnings)
  log.push(`  [${warning.kind}] ${warning.detail}`);

if (warnings.length > 0 && !allowWarnings) {
  log.push(
    "",
    "Refusing to write a corpus this script could not fully account for.",
    "An unknown field means the trim is discarding data nobody decided to discard.",
    "Carry it, add it to DROPPED_*_FIELDS with a reason, or pass --allow-warnings once a human has read the list.",
  );
  process.stdout.write(`${log.join("\n")}\n`);
  process.exitCode = 1;
} else {
  const envelope: CorpusEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    source,
    rights: RIGHTS,
    legalityFlags: [...SEARCH_FLAG_FIELDS],
    counts,
  };

  const outputs: readonly { readonly path: string; readonly body: string }[] = [
    {
      path: join(outDirectory, FULL_FILE),
      body: serialise({ ...envelope, cards }),
    },
    {
      path: join(outDirectory, SEARCH_FILE),
      body: serialise({ ...envelope, cards: searchCards }),
    },
  ];

  log.push("");

  for (const output of outputs) {
    const shown = relative(ROOT, output.path) || output.path;

    if (checkOnly) {
      let committed: string | null = null;
      try {
        committed = readFileSync(output.path, "utf8");
      } catch {
        committed = null;
      }

      if (committed === null) {
        log.push(
          `MISSING ${shown} — run \`bun run corpus:cards\` and commit the result.`,
        );
        process.exitCode = 1;
      } else if (committed === output.body) {
        log.push(`up to date  ${shown} (${String(output.body.length)} bytes)`);
      } else {
        const line = firstDifferingLine(committed, output.body);
        log.push(
          `DRIFT ${shown} — the committed corpus does not match this upstream commit.`,
          line === null
            ? "  (differs in trailing content)"
            : `  first difference at line ${String(line)}`,
          "  Run `bun run corpus:cards` and review the diff: it is the card changelog.",
        );
        process.exitCode = 1;
      }
    } else {
      mkdirSync(dirname(output.path), { recursive: true });
      writeFileSync(output.path, output.body, "utf8");
      log.push(`wrote ${shown} (${String(output.body.length)} bytes)`);
    }
  }

  process.stdout.write(`${log.join("\n")}\n`);
}
