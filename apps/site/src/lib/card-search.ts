/**
 * Lexical search over the card corpus — the index builder that runs at build
 * time, and the query engine that runs in the browser.
 *
 * It is the sibling of `./search.ts` and shares its two load-bearing
 * properties, for the same reasons:
 *
 * - **Deterministic.** No embedding, no learned ranking, no floating-point
 *   score anywhere in the sort, and every comparison ends in corpus order — so
 *   there is no tie left for an engine to break differently. `docs/PLAN.md`,
 *   "Rules that hold across every phase": no language model in the shipped
 *   product.
 * - **Explicable.** Every result carries {@link CardResult.matchedIn}: which
 *   field put it on the page. A user can look at a row and say why it is there.
 *
 * THE SPLIT. {@link buildCardIndex} runs once, in Astro's frontmatter, at build
 * time, over the same {@link CardPage} objects the card pages themselves render
 * — so the search and the page cannot disagree about a card's slug, its label
 * or its legality. {@link decodeCardIndex} and {@link searchCards} run in the
 * browser against what it produced. The 16 MB corpus never reaches a client.
 *
 * WHAT IS INDEXED AS POSTINGS, AND WHAT IS NOT. The inverted index covers the
 * printed card text and nothing else. Names, type lines, traits, keywords, sets
 * and rarities are shipped whole — as strings, or as a small dictionary plus a
 * per-card id — and matched by scanning them, which is both cheaper (674
 * distinct type lines, 167 distinct keywords) and *exact*: `text:attack` cannot
 * accidentally match a card merely named "Attack", because the two live in
 * different structures rather than in one namespace with prefixes stuck on.
 *
 * THE GRAMMAR IS INHERITED, NOT INVENTED. `docs/DESIGN.md`: LSS's Card Vault
 * already has a search syntax and people arrive fluent in it, so a second
 * dialect would fragment the thing it claims to consolidate. Operators this
 * corpus cannot answer are NAMED rather than ignored — see
 * {@link PENDING_OPERATORS} — because a query that silently does something
 * other than what it says is the one failure that breaks the grammar for good.
 */

import type { PitchValue, StateTone } from "optfall-theme";

/**
 * TYPE-ONLY, AND THAT IS LOAD-BEARING RATHER THAN STYLISTIC.
 *
 * `./cards` imports the 16 MB committed corpus and runs its assertions at
 * module load. This module is imported by an Astro island, so a *value* import
 * from `./cards` — even of one small constant — would make the bundler pull the
 * entire corpus into the browser bundle, which is exactly the thing the index
 * below exists to avoid. `import type` is erased before the bundler sees it.
 *
 * The consequence is {@link FORMAT_NAMES}: the one thing this module genuinely
 * needs from `./cards` at runtime is the six format names, for an error
 * message. They are restated here and then ASSERTED against the real list at
 * build time by {@link buildCardIndex} — so a format renamed, reordered or
 * added fails the build rather than silently making `legal:cc` filter the wrong
 * column.
 */
import type { CardPage } from "./cards";

/* -------------------------------------------------------------------------- */
/* The wire format                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The index as it crosses from the build into the page.
 *
 * NEWLINE-JOINED STRINGS AND BASE-36 IDS, NOT AN ARRAY OF OBJECTS, for the
 * reason `./search.ts` measures: an Astro island's props are JSON-serialised
 * into an HTML attribute, so every `"` in the payload becomes six bytes of
 * `&quot;`. An object per card would carry roughly a hundred thousand quotes;
 * this carries about twenty.
 *
 * THE SLUGS ARE SHIPPED RATHER THAN RE-DERIVED, and that is a deliberate trade
 * of about 100 KB. `slugify` is pure, so a browser could recompute a URL from a
 * name — but then the address a link points at would be produced by a second
 * evaluation of the rule rather than read off the one the build already
 * committed to, and a reference work should not have two places a permalink can
 * come from. The build's answer is the answer.
 */
export interface EncodedCardIndex {
  /** The upstream commit the corpus was pinned at. Displayed, never parsed. */
  readonly commit: string;
  /** `YYYY-MM-DD` the corpus was last confirmed against upstream. */
  readonly confirmed: string;
  /** Disambiguated card labels, one per line, in corpus order. */
  readonly labels: string;
  /** Card slugs, one per line. */
  readonly slugs: string;
  /**
   * The BARE NAME slug per card, one per line — `head-jab` for all three of
   * `head-jab-1`, `-2` and `-3`.
   *
   * This is what lets a search collapse the pitch versions of a card into one
   * result. It is shipped rather than derived by stripping a `-N` suffix,
   * because that would be a second, weaker evaluation of the slug rule: a card
   * genuinely named something ending in a digit would be mangled by it, and a
   * reference work should not have two places a permalink can come from.
   */
  readonly nameSlugs: string;
  /**
   * Face blob keys, one per line, empty where the card publishes no art.
   *
   * SHIPPED RATHER THAN DERIVED, for the same reason the slugs are: the key is
   * a pure function of an image URL, but the URL lives in the 16 MB corpus that
   * deliberately never reaches a browser. The build already resolved it, so the
   * index carries the answer rather than the input.
   *
   * About 130 KB across 4,941 cards, and it is what turns a text result list
   * into a grid of card faces.
   */
  readonly faceKeys: string;
  /**
   * One digit per card: `1` where the face is landscape, `0` where portrait.
   *
   * Needed because the box has to be right BEFORE the image loads, and a
   * portrait box around a landscape face is visible at a glance. 15 cards are
   * played horizontally.
   */
  readonly faceLandscape: string;
  /** One digit per card: `0`–`3`. */
  readonly pitches: string;
  /** Printed type lines, deduplicated, one per line. */
  readonly typeDict: string;
  /** Two base-36 characters per card, indexing {@link EncodedCardIndex.typeDict}. */
  readonly typeAt: string;
  /** `cost\tpower\tdefence` per card, one line each; empty where absent. */
  readonly stats: string;
  /** Keyword vocabulary, one per line. */
  readonly keywordDict: string;
  /** Trait vocabulary, one per line. */
  readonly traitDict: string;
  /** Set-code vocabulary, one per line. */
  readonly setDict: string;
  /** Rarity-code vocabulary, one per line. */
  readonly rarityDict: string;
  /**
   * Per-card membership lists, one line each, base-36 ids dot-separated and
   * the four groups tab-separated: keywords, traits, sets, rarities.
   */
  readonly memberships: string;
  /**
   * Distinct legality vectors, one per line: six comma-separated bitmasks in
   * {@link FORMATS} order, each a base-36 sum of {@link TONE_BIT}.
   */
  readonly verdictDict: string;
  /** Two base-36 characters per card, indexing {@link EncodedCardIndex.verdictDict}. */
  readonly verdictAt: string;
  /**
   * The inverted index over printed card text: one line per term, the term,
   * a space, then the ordinals of the cards containing it — ascending,
   * delta-encoded, base 36, dot-separated.
   */
  readonly postings: string;
  /** `type\tcount` for the commonest printed type lines. The empty state. */
  readonly browse: string;
}

/**
 * One bit per state a verdict can carry, so a card that is two things at once
 * stays two things. `unknown` gets its own bit rather than being spelled as
 * zero: "the dataset publishes nothing here" is a claim, and an all-zero mask
 * would be indistinguishable from a bug that forgot to set any.
 */
const TONE_BIT: Readonly<Record<StateTone | "unknown", number>> = {
  legal: 1,
  banned: 2,
  suspended: 4,
  restricted: 8,
  "living-legend": 16,
  "not-in-format": 32,
  unknown: 64,
  verified: 0,
  unverified: 0,
};

/* -------------------------------------------------------------------------- */
/* Tokenising                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Words carrying no discriminating power in card text.
 *
 * What is *absent* is the part worth reading. `may`, `if`, `when`, `each`,
 * `target`, `not`, `instead` and `until` are ordinary English stopwords and are
 * all load-bearing vocabulary on a Flesh and Blood card — "may" and "must" are
 * the difference between an option and an obligation, and "target" is a rules
 * term. Dropping them would make the most card-literate queries the ones that
 * work worst.
 *
 * THE THRESHOLD IS MEASURED, NOT TASTE. A word is here when it is a function
 * word AND it appears in a majority of cards, because a term in most documents
 * cannot separate one from another. Measured against this corpus, `you` is the
 * only content-ish word over half (2,528 of 4,941, 51.2%), and it is in the
 * list for that reason alone. `if` (47.4%), `your` (35.7%) and `may` (19.1%)
 * are all under it and all stay — the second-guess would have been to add
 * "obvious" stopwords by eye and quietly break `may` and `if`.
 */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "of", "to", "in", "on", "and", "or", "is", "are", "be",
  "it", "its", "as", "at", "by", "for", "from", "that", "this", "these",
  "those", "with", "their", "them", "they", "you",
]);

/**
 * The one tokeniser. Build time and query time call this same function, which
 * is what makes a query term and an indexed term comparable at all.
 *
 * Single letters are dropped; single digits are not — "Arcane Barrier 2" is a
 * real thing to search for and `2` is the discriminating half of it.
 */
export function tokeniseCard(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return raw.filter(
    (token) => !STOPWORDS.has(token) && (token.length > 1 || /\d/.test(token)),
  );
}

/** Case- and punctuation-insensitive form, for whole-name comparison. */
function fold(text: string): string {
  return tokeniseCard(text).join(" ");
}

/* -------------------------------------------------------------------------- */
/* Building                                                                    */
/* -------------------------------------------------------------------------- */

/** How many type lines the empty state offers as a browse. */
const BROWSE_LIMIT = 24;

function dictionary(values: readonly string[]): {
  readonly list: readonly string[];
  readonly idOf: ReadonlyMap<string, number>;
} {
  const list = [...new Set(values)].toSorted();
  const idOf = new Map(list.map((value, index) => [value, index]));
  return { list, idOf };
}

/** Fixed-width base-36, so a per-card id list needs no separator. */
function pad2(value: number): string {
  return value.toString(36).padStart(2, "0");
}

/**
 * One card's membership of a dictionary, as ascending base-36 ids.
 *
 * Deduplicated and sorted so the line is a function of the set rather than of
 * the order upstream happened to write the printings in — a card printed in the
 * same set twice must not produce a different byte string from one printed in
 * it once.
 */
function membershipIds(
  values: readonly string[],
  idOf: ReadonlyMap<string, number>,
): string {
  return [...new Set(values)]
    .map((value) => idOf.get(value))
    .filter((id): id is number => id !== undefined)
    .toSorted((a, b) => a - b)
    .map((id) => id.toString(36))
    .join(".");
}

/**
 * Fail the build if {@link FORMAT_NAMES} has drifted from the real format list.
 *
 * The failure it prevents is silent and total: `legal:cc` resolves a format
 * *alias* to a positional index into the verdict vector, so a format inserted,
 * removed or reordered in `cards.ts` would leave every state filter reading the
 * wrong column — returning a confident, wrong, plausible-looking answer. That
 * is the one failure mode this project exists to not have, so it throws rather
 * than degrades. The verdicts on any card carry the real format objects, in
 * order, which is what makes the check possible without a value import.
 */
function assertFormatsAgree(pages: readonly CardPage[]): void {
  const actual = (pages[0]?.verdicts ?? []).map((verdict) => verdict.format.name);
  const agrees =
    actual.length === FORMAT_NAMES.length &&
    actual.every((name, index) => name === FORMAT_NAMES[index]);
  if (agrees) return;
  throw new Error(
    `apps/site/src/lib/card-search.ts: FORMAT_NAMES is [${FORMAT_NAMES.join(", ")}] but ` +
      `apps/site/src/lib/cards.ts publishes [${actual.join(", ")}]. The state filters ` +
      `(legal:, banned:, suspended:, restricted:) index the verdict vector by ` +
      `position, so this mismatch would make every one of them read the wrong ` +
      `format. Update FORMAT_NAMES and FORMAT_ALIASES together.`,
  );
}

/**
 * Build the shipped index from the shaped card pages. Pure, run at build time.
 *
 * It takes {@link CardPage}s rather than the raw corpus on purpose: the slug,
 * the disambiguated label and the per-format verdict are all *derived*, the
 * derivation is the product, and deriving it twice is how a search result comes
 * to disagree with the page it links to.
 */
export function buildCardIndex(
  pages: readonly CardPage[],
  source: { readonly commit: string; readonly confirmed: string },
): EncodedCardIndex {
  assertFormatsAgree(pages);

  const labels: string[] = [];
  const slugs: string[] = [];
  const nameSlugs: string[] = [];
  const faceKeys: string[] = [];
  const faceLandscape: string[] = [];
  const pitches: string[] = [];
  const stats: string[] = [];
  const memberships: string[] = [];
  const postings = new Map<string, number[]>();

  const types = dictionary(pages.map((page) => page.card.type_text));
  const keywords = dictionary(pages.flatMap((page) => page.card.card_keywords));
  const traits = dictionary(pages.flatMap((page) => page.card.traits));
  const sets = dictionary(
    pages.flatMap((page) => page.card.printings.map((printing) => printing.set_id)),
  );
  const rarities = dictionary(
    pages.flatMap((page) => page.card.printings.map((printing) => printing.rarity)),
  );

  const typeAt: string[] = [];
  const verdictAt: string[] = [];
  const verdictVectors = new Map<string, number>();
  const verdictList: string[] = [];

  pages.forEach((page, ordinal) => {
    labels.push(page.label);
    slugs.push(page.slug);
    nameSlugs.push(page.nameSlug);
    faceKeys.push(page.face.key ?? "");
    faceLandscape.push(page.face.orientation === "landscape" ? "1" : "0");
    pitches.push(String(page.pitch));
    typeAt.push(pad2(types.idOf.get(page.card.type_text) ?? 0));
    stats.push([page.card.cost, page.card.power, page.card.defense].join("\t"));

    memberships.push(
      [
        membershipIds(page.card.card_keywords, keywords.idOf),
        membershipIds(page.card.traits, traits.idOf),
        membershipIds(
          page.card.printings.map((printing) => printing.set_id),
          sets.idOf,
        ),
        membershipIds(
          page.card.printings.map((printing) => printing.rarity),
          rarities.idOf,
        ),
      ].join("\t"),
    );

    const vector = page.verdicts
      .map((verdict) => {
        const mask = verdict.unknown
          ? TONE_BIT.unknown
          : verdict.states.reduce((sum, state) => sum + TONE_BIT[state.tone], 0);
        return mask.toString(36);
      })
      .join(",");
    let vectorId = verdictVectors.get(vector);
    if (vectorId === undefined) {
      vectorId = verdictList.length;
      verdictList.push(vector);
      verdictVectors.set(vector, vectorId);
    }
    verdictAt.push(pad2(vectorId));

    for (const term of new Set(tokeniseCard(page.card.functional_text))) {
      const list = postings.get(term);
      if (list) list.push(ordinal);
      else postings.set(term, [ordinal]);
    }
  });

  // Sorted so the artifact is a function of the corpus alone, exactly as the
  // rules index is: an index whose byte order tracks the corpus is an index
  // whose diff is unreadable the first time a card moves.
  const postingLines = [...postings.entries()]
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([term, docs]) => {
      let previous = 0;
      const deltas = docs.map((doc) => {
        const delta = doc - previous;
        previous = doc;
        return delta.toString(36);
      });
      return `${term} ${deltas.join(".")}`;
    });

  /**
   * The empty state's browse: the commonest printed type lines, counted.
   *
   * Derived from the corpus rather than curated, so it cannot go stale and
   * cannot express an opinion about which types matter. Ties break
   * alphabetically, so the list is a function of the corpus alone.
   */
  /*
   * COUNTED IN CARDS, NOT CORPUS ROWS, TO MATCH WHAT CLICKING THE LINK SHOWS.
   *
   * A search result stands for a card — the red, yellow and blue versions
   * collapse to one row — so a browse link promising "33" and then rendering
   * 21 rows would be lying about its own destination. The set is keyed on the
   * bare-name slug for exactly the reason the collapse is.
   */
  const typeCards = new Map<string, Set<string>>();
  for (const page of pages) {
    const line = page.card.type_text.trim();
    if (line === "") continue;
    const seen = typeCards.get(line);
    if (seen) seen.add(page.nameSlug);
    else typeCards.set(line, new Set([page.nameSlug]));
  }
  const typeCounts = new Map(
    [...typeCards.entries()].map(([line, names]) => [line, names.size]),
  );
  const browse = [...typeCounts.entries()]
    .toSorted((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, BROWSE_LIMIT)
    .map(([line, count]) => `${line}\t${count}`)
    .join("\n");

  return {
    commit: source.commit,
    confirmed: source.confirmed,
    labels: labels.join("\n"),
    slugs: slugs.join("\n"),
    nameSlugs: nameSlugs.join("\n"),
    faceKeys: faceKeys.join("\n"),
    faceLandscape: faceLandscape.join(""),
    pitches: pitches.join(""),
    typeDict: types.list.join("\n"),
    typeAt: typeAt.join(""),
    stats: stats.join("\n"),
    keywordDict: keywords.list.join("\n"),
    traitDict: traits.list.join("\n"),
    setDict: sets.list.join("\n"),
    rarityDict: rarities.list.join("\n"),
    memberships: memberships.join("\n"),
    verdictDict: verdictList.join("\n"),
    verdictAt: verdictAt.join(""),
    postings: postingLines.join("\n"),
    browse,
  };
}

/* -------------------------------------------------------------------------- */
/* The decoded index                                                           */
/* -------------------------------------------------------------------------- */

export interface CardIndex {
  readonly commit: string;
  readonly confirmed: string;
  readonly labels: readonly string[];
  /** Lowercased, punctuation-folded labels — built once, used every keystroke. */
  readonly folded: readonly string[];
  /** Tokenised labels, so a name match is whole-word-or-prefix like the rest. */
  readonly labelTokens: readonly (readonly string[])[];
  readonly slugs: readonly string[];
  /** Bare-name slug per card, shared by every pitch version. */
  readonly nameSlugs: readonly string[];
  /**
   * How many pitch versions the CORPUS carries per bare-name slug.
   *
   * Counted once here rather than per query, and counted over the corpus rather
   * than over the results — "2 of 3 versions matched" needs the 3, and the
   * result set only knows the 2.
   */
  readonly versionsByName: ReadonlyMap<string, number>;
  /** Face blob key per card; `null` where the card publishes no art. */
  readonly faceKeys: readonly (string | null)[];
  readonly faceLandscape: readonly boolean[];
  readonly pitches: readonly PitchValue[];
  readonly typeLines: readonly string[];
  readonly typeTokens: readonly (readonly string[])[];
  readonly stats: readonly (readonly [string, string, string])[];
  readonly keywords: readonly (readonly string[])[];
  readonly traits: readonly (readonly string[])[];
  readonly sets: readonly (readonly string[])[];
  readonly rarities: readonly (readonly string[])[];
  /** Six bitmasks per card, in {@link FORMATS} order. */
  readonly verdicts: readonly (readonly number[])[];
  readonly postings: ReadonlyMap<string, readonly number[]>;
  readonly terms: readonly string[];
  readonly browse: readonly (readonly [string, number])[];
  readonly size: number;
}

function splitIds(field: string, dict: readonly string[]): readonly string[] {
  if (field === "") return [];
  return field
    .split(".")
    .map((id) => dict[Number.parseInt(id, 36)])
    .filter((value): value is string => value !== undefined);
}

export function decodeCardIndex(encoded: EncodedCardIndex): CardIndex {
  const labels = encoded.labels === "" ? [] : encoded.labels.split("\n");
  const slugs = encoded.slugs === "" ? [] : encoded.slugs.split("\n");
  const faceKeyLines = encoded.faceKeys === "" ? [] : encoded.faceKeys.split("\n");
  const nameSlugLines =
    encoded.nameSlugs === "" ? [] : encoded.nameSlugs.split("\n");
  const nameSlugPerCard = labels.map((_, ordinal) => nameSlugLines[ordinal] ?? "");
  const typeDict = encoded.typeDict === "" ? [] : encoded.typeDict.split("\n");
  const keywordDict = encoded.keywordDict === "" ? [] : encoded.keywordDict.split("\n");
  const traitDict = encoded.traitDict === "" ? [] : encoded.traitDict.split("\n");
  const setDict = encoded.setDict === "" ? [] : encoded.setDict.split("\n");
  const rarityDict = encoded.rarityDict === "" ? [] : encoded.rarityDict.split("\n");
  const verdictDict = encoded.verdictDict === "" ? [] : encoded.verdictDict.split("\n");
  const statLines = encoded.stats === "" ? [] : encoded.stats.split("\n");
  const membershipLines =
    encoded.memberships === "" ? [] : encoded.memberships.split("\n");

  const typeLines: string[] = [];
  const pitches: PitchValue[] = [];
  const verdicts: number[][] = [];
  const keywords: string[][] = [];
  const traits: string[][] = [];
  const sets: string[][] = [];
  const rarities: string[][] = [];
  const stats: (readonly [string, string, string])[] = [];

  labels.forEach((_, ordinal) => {
    const typeId = Number.parseInt(encoded.typeAt.slice(ordinal * 2, ordinal * 2 + 2), 36);
    typeLines.push(typeDict[typeId] ?? "");

    const digit = Number(encoded.pitches[ordinal] ?? "0");
    pitches.push((digit === 1 ? 1 : digit === 2 ? 2 : digit === 3 ? 3 : 0) as PitchValue);

    const vectorId = Number.parseInt(
      encoded.verdictAt.slice(ordinal * 2, ordinal * 2 + 2),
      36,
    );
    verdicts.push(
      (verdictDict[vectorId] ?? "").split(",").map((mask) => Number.parseInt(mask, 36) || 0),
    );

    const [cost = "", power = "", defence = ""] = (statLines[ordinal] ?? "").split("\t");
    stats.push([cost, power, defence] as const);

    const [k = "", t = "", s = "", r = ""] = (membershipLines[ordinal] ?? "").split("\t");
    keywords.push([...splitIds(k, keywordDict)]);
    traits.push([...splitIds(t, traitDict)]);
    sets.push([...splitIds(s, setDict)]);
    rarities.push([...splitIds(r, rarityDict)]);
  });

  const postings = new Map<string, number[]>();
  if (encoded.postings !== "") {
    for (const line of encoded.postings.split("\n")) {
      const gap = line.indexOf(" ");
      const term = line.slice(0, gap);
      let running = 0;
      const docs = line
        .slice(gap + 1)
        .split(".")
        .map((delta) => {
          running += Number.parseInt(delta, 36);
          return running;
        });
      postings.set(term, docs);
    }
  }

  const browse: (readonly [string, number])[] =
    encoded.browse === ""
      ? []
      : encoded.browse.split("\n").map((line) => {
          const [value = "", count = "0"] = line.split("\t");
          return [value, Number(count)] as const;
        });

  return {
    commit: encoded.commit,
    confirmed: encoded.confirmed,
    labels,
    nameSlugs: nameSlugPerCard,
    versionsByName: (() => {
      const counts = new Map<string, number>();
      for (const name of nameSlugPerCard) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return counts;
    })(),
    faceKeys: labels.map((_, ordinal) => {
      const key = faceKeyLines[ordinal] ?? "";
      return key === "" ? null : key;
    }),
    faceLandscape: labels.map((_, ordinal) => encoded.faceLandscape[ordinal] === "1"),
    folded: labels.map(fold),
    labelTokens: labels.map((label) => tokeniseCard(label)),
    slugs,
    pitches,
    typeLines,
    typeTokens: typeLines.map((line) => tokeniseCard(line)),
    stats,
    keywords,
    traits,
    sets,
    rarities,
    verdicts,
    postings,
    terms: [...postings.keys()],
    browse,
    size: labels.length,
  };
}

/* -------------------------------------------------------------------------- */
/* The query language                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Operators from `docs/DESIGN.md`'s grammar that this corpus cannot answer yet,
 * and what each is waiting on.
 *
 * Named rather than ignored, because silence is the worse failure: `is:verified`
 * typed into a field that quietly dropped it would return every card and look
 * like it worked. This is the same table `./search.ts` keeps, minus the entries
 * the card layer has now answered — and those entries are removed *there* on
 * the same day they land *here*, because a hint advertising an operator the
 * build cannot answer is the lie "degrade visibly" prohibits.
 */
const PENDING_OPERATORS: Readonly<Record<string, string>> = {
  is: "filters judge-verified rulings, which are not published yet",
  changed: "lists what a rules version touched, which is not published yet",
  cr: "searches the Comprehensive Rules — that lives at /search, not here",
  artist: "is not indexed here yet; artists are listed on each card page",
  flavor: "is not indexed here yet; flavour text is listed on each card page",
  flavour: "is not indexed here yet; flavour text is listed on each card page",
};

/**
 * The six format names, in `FORMATS` order — restated rather than imported, for
 * the reason at the top of this file, and asserted against the real list by
 * {@link buildCardIndex} so the restatement cannot drift.
 */
export const FORMAT_NAMES: readonly string[] = [
  "Classic Constructed",
  "Blitz",
  "Living Legend",
  "Commoner",
  "Silver Age",
  "Ultimate Pit Fight",
];

/** Format aliases people actually type, mapped to a {@link FORMAT_NAMES} index. */
const FORMAT_ALIASES: Readonly<Record<string, number>> = {
  cc: 0,
  "classic-constructed": 0,
  classic: 0,
  constructed: 0,
  blitz: 1,
  ll: 2,
  "living-legend": 2,
  livinglegend: 2,
  commoner: 3,
  "silver-age": 4,
  silverage: 4,
  silver: 4,
  upf: 5,
  "ultimate-pit-fight": 5,
};

export interface CardNotice {
  readonly kind:
    | "operator-pending"
    | "operator-unknown"
    | "operand-unknown"
    | "term-ignored"
    | "phrase-approximate";
  readonly text: string;
}

/** One `field:value` restriction the engine will actually apply. */
export interface CardFilter {
  readonly field:
    | "name"
    | "text"
    | "type"
    | "trait"
    | "keyword"
    | "set"
    | "rarity"
    | "pitch"
    | "cost"
    | "power"
    | "defence"
    | "state";
  /** The operand, lowercased and trimmed. */
  readonly value: string;
  /** For `state` filters: the format index and the tone bit required. */
  readonly formatIndex?: number;
  readonly bit?: number;
  /** How the filter is described back to the reader. */
  readonly label: string;
}

export interface ParsedCardQuery {
  /** Free terms, deduplicated, in the order typed. */
  readonly terms: readonly string[];
  readonly filters: readonly CardFilter[];
  readonly notices: readonly CardNotice[];
  /** The whole query, folded — used only for the exact-name tier. */
  readonly folded: string;
}

/**
 * Splits on whitespace, keeping `"quoted groups"` whole — and keeping an
 * operator attached to the quoted group it introduces.
 *
 * THE OPERATOR PREFIX IS THE PART THAT IS EASY TO GET WRONG. A naïve
 * `/"([^"]*)"|(\S+)/` splits `type:"Illusionist Action"` into `type:"Illusionist`
 * and `Action"`, because the quote is not at the start of the chunk — which
 * silently turns a precise filter into two junk free terms and returns nothing.
 * Multi-word operands are not exotic here: 674 printed type lines contain a
 * space, and the browse links on the empty state are built out of them.
 */
function chunk(raw: string): { readonly value: string; readonly quoted: boolean }[] {
  const out: { value: string; quoted: boolean }[] = [];
  for (const match of raw.matchAll(/(?:([a-zA-Z][a-zA-Z-]*):)?"([^"]*)"|(\S+)/g)) {
    const prefix = match[1];
    const phrase = match[2];
    if (phrase !== undefined) {
      // A quoted group with an operator in front is that operator's operand;
      // one without is a phrase to search for.
      if (phrase.trim() === "") continue;
      out.push(
        prefix === undefined
          ? { value: phrase, quoted: true }
          : { value: `${prefix}:${phrase}`, quoted: false },
      );
      continue;
    }
    const value = match[3] ?? "";
    if (value.trim() !== "") out.push({ value, quoted: false });
  }
  return out;
}

const STATE_OPERATORS: Readonly<Record<string, StateTone>> = {
  legal: "legal",
  banned: "banned",
  suspended: "suspended",
  restricted: "restricted",
};

/** Operators that scope a word to one field. `class:` is discussed below. */
const FIELD_OPERATORS: Readonly<Record<string, CardFilter["field"]>> = {
  name: "name",
  text: "text",
  o: "text",
  // `class:` is an alias of `type:` because the upstream dataset publishes
  // classes and card types in ONE list — "Guardian", "Action" and "Attack" are
  // all entries in `types`. Separating them would need a class vocabulary
  // Optfall does not have and would have to invent, so the two operators are
  // documented as the same operator rather than one of them being wrong.
  type: "type",
  class: "type",
  trait: "trait",
  keyword: "keyword",
  kw: "keyword",
  set: "set",
  rarity: "rarity",
  pitch: "pitch",
  cost: "cost",
  power: "power",
  defence: "defence",
  defense: "defence",
  def: "defence",
};

/**
 * Fields whose operand is prose and is therefore tokenised into one requirement
 * per word. Everything else — a set code, a rarity letter, a printed cost — is
 * an opaque value and is matched whole.
 */
const WORD_VALUED: ReadonlySet<CardFilter["field"]> = new Set([
  "name",
  "text",
  "type",
  "trait",
  "keyword",
]);

/**
 * Parse the query into free terms and filters.
 *
 * COMPARISONS ARE NAMED AS UNSUPPORTED RATHER THAN GUESSED AT. `cost>=3` reads
 * like it should work, and it cannot here: 4,941 printed costs include `X`,
 * `XX`, `X1` and the empty string, so "greater than" has no total order over
 * the values this corpus actually carries. A silent no-op would be the worst of
 * the three options, so it produces a notice.
 */
export function parseCardQuery(raw: string): ParsedCardQuery {
  const terms: string[] = [];
  const filters: CardFilter[] = [];
  const notices: CardNotice[] = [];
  const seenTerm = new Set<string>();
  const seenNotice = new Set<string>();

  const note = (kind: CardNotice["kind"], text: string) => {
    const key = `${kind}:${text}`;
    if (seenNotice.has(key)) return;
    seenNotice.add(key);
    notices.push({ kind, text });
  };

  const addWords = (source: string) => {
    const kept = tokeniseCard(source);
    for (const term of kept) {
      if (seenTerm.has(term)) continue;
      seenTerm.add(term);
      terms.push(term);
    }
    const dropped = (source.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (token) => !kept.includes(token),
    );
    for (const word of new Set(dropped)) {
      note(
        "term-ignored",
        STOPWORDS.has(word)
          ? `“${word}” is in most cards, so it cannot narrow anything. Ignored.`
          : `“${word}” is a single letter — too short to search on. Ignored.`,
      );
    }
  };

  for (const { value, quoted } of chunk(raw)) {
    if (quoted) {
      note(
        "phrase-approximate",
        `“${value.trim()}” is matched word by word. The index carries no word positions, so adjacency is not checked.`,
      );
      addWords(value);
      continue;
    }

    if (value === "+") {
      note(
        "operator-pending",
        "the card-pair operator returns the interaction between two cards, which is not published yet.",
      );
      continue;
    }

    const comparison = /^([a-zA-Z][a-zA-Z-]*)\s*(>=|<=|>|<|!=)/.exec(value);
    if (comparison) {
      note(
        "operator-unknown",
        `${comparison[1]}${comparison[2]}: comparisons are not supported. Printed costs and powers include X, XX and blanks, so there is no order over them to compare against. Use an exact value — ${comparison[1]}:3.`,
      );
      continue;
    }

    const operator = /^([a-zA-Z][a-zA-Z-]*):(.*)$/.exec(value);
    if (!operator) {
      addWords(value);
      continue;
    }

    const name = (operator[1] ?? "").toLowerCase();
    const operandRaw = (operator[2] ?? "").trim();
    const operand = operandRaw.toLowerCase();

    if (operand === "") {
      note("operand-unknown", `${name}: was typed with nothing after it. Ignored.`);
      continue;
    }

    const stateTone = STATE_OPERATORS[name];
    if (stateTone) {
      const [formatName = "", asOf] = operand.split("@");
      if (asOf !== undefined) {
        note(
          "operator-pending",
          `${name}:${formatName}@${asOf} asks what was legal on a date. Optfall publishes present-day legality only; legality that remembers is not built yet, and answering with today's flags would be a wrong answer rather than a missing one.`,
        );
        continue;
      }
      const formatIndex = FORMAT_ALIASES[formatName];
      if (formatIndex === undefined) {
        note(
          "operand-unknown",
          `${name}:${formatName} names no format Optfall serves. The six are ${FORMAT_NAMES.join(", ")}.`,
        );
        continue;
      }
      filters.push({
        field: "state",
        value: formatName,
        formatIndex,
        bit: TONE_BIT[stateTone],
        label: `${stateTone} in ${FORMAT_NAMES[formatIndex] ?? formatName}`,
      });
      continue;
    }

    const field = FIELD_OPERATORS[name];
    if (field) {
      const label = `${name}:${operandRaw}`;
      // A WORD-VALUED OPERAND IS TOKENISED; A CODE-VALUED ONE IS NOT.
      // `type:"Illusionist Action - Aura"` has to become three requirements
      // that all hold, or a filter built from a printed type line matches
      // nothing. `set:MST`, `cost:X` and `pitch:none` are single opaque values
      // where splitting would be meaningless — `cost:x1` is not `cost:x` and
      // `cost:1`.
      if (WORD_VALUED.has(field)) {
        const tokens = tokeniseCard(operand);
        if (tokens.length === 0) {
          note(
            "operand-unknown",
            `${label} has nothing searchable in it once single letters and common words are dropped. Ignored.`,
          );
          continue;
        }
        for (const token of tokens) filters.push({ field, value: token, label });
      } else {
        filters.push({ field, value: operand, label });
      }
      continue;
    }

    const pending = PENDING_OPERATORS[name];
    if (pending) {
      note("operator-pending", `${name}: ${pending}.`);
      continue;
    }

    note(
      "operator-unknown",
      `${name}: is not an operator here. Supported: name, text (o), type (class), trait, keyword, set, rarity, pitch, cost, power, defence, and legal/banned/suspended/restricted with a format.`,
    );
    addWords(operandRaw);
  }

  return { terms, filters, notices, folded: fold(raw) };
}

/* -------------------------------------------------------------------------- */
/* Matching                                                                    */
/* -------------------------------------------------------------------------- */

/** Whole word, or a word beginning with the term. Never inside a word. */
function tokensMatch(tokens: readonly string[], term: string): boolean {
  return tokens.some((token) => token === term || token.startsWith(term));
}

function valuesMatch(values: readonly string[], term: string): boolean {
  return values.some((value) => {
    const lower = value.toLowerCase();
    return lower === term || tokensMatch(tokeniseCard(value), term);
  });
}

/** `""` is the printed blank; it is matched by `none`, never by the empty string. */
function statMatches(printed: string, wanted: string): boolean {
  if (wanted === "none") return printed === "";
  return printed.toLowerCase() === wanted;
}

/**
 * Whether one card satisfies one filter.
 *
 * `text` is deliberately absent from this switch and is asserted against below:
 * it is the only filter answered by the inverted index rather than by a scan,
 * so resolving it per card would redo a postings walk 4,941 times per keystroke.
 * {@link searchCards} resolves each text filter to a set once and tests
 * membership. A `text` filter reaching here would be a routing bug, and it
 * throws rather than quietly answering `false` — a silent `false` on a filter
 * returns an empty result set, which reads exactly like "no cards match".
 */
function passesFilter(index: CardIndex, ordinal: number, filter: CardFilter): boolean {
  const [cost = "", power = "", defence = ""] = index.stats[ordinal] ?? [];
  switch (filter.field) {
    case "text":
      throw new Error(
        "apps/site/src/lib/card-search.ts: a text filter reached passesFilter. Text filters are resolved through the postings index in searchCards; see the note above this function.",
      );
    case "name":
      return tokensMatch(index.labelTokens[ordinal] ?? [], filter.value);
    case "type":
      return tokensMatch(index.typeTokens[ordinal] ?? [], filter.value);
    case "trait":
      return valuesMatch(index.traits[ordinal] ?? [], filter.value);
    case "keyword":
      return valuesMatch(index.keywords[ordinal] ?? [], filter.value);
    case "set":
      return (index.sets[ordinal] ?? []).some(
        (code) => code.toLowerCase() === filter.value,
      );
    case "rarity":
      return (index.rarities[ordinal] ?? []).some(
        (code) => code.toLowerCase() === filter.value,
      );
    case "pitch":
      return filter.value === "none"
        ? index.pitches[ordinal] === 0
        : String(index.pitches[ordinal] ?? 0) === filter.value;
    case "cost":
      return statMatches(cost, filter.value);
    case "power":
      return statMatches(power, filter.value);
    case "defence":
      return statMatches(defence, filter.value);
    case "state": {
      const masks = index.verdicts[ordinal] ?? [];
      const mask = masks[filter.formatIndex ?? 0] ?? 0;
      return (mask & (filter.bit ?? 0)) !== 0;
    }
    default:
      return false;
  }
}

/** Cards whose printed text contains the term, whole word or by prefix. */
function textMatches(index: CardIndex, term: string): ReadonlySet<number> {
  const out = new Set<number>();
  for (const candidate of index.terms) {
    if (candidate !== term && !candidate.startsWith(term)) continue;
    for (const ordinal of index.postings.get(candidate) ?? []) out.add(ordinal);
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Which field put a result on the page. This is the ranking, in order.
 *
 * 1. `name-exact` — **the name you typed.** Somebody typing a card's whole name
 *    wants that card, not the eleven cards whose text mentions it. This is the
 *    card equivalent of `./search.ts`'s identifier tier, and for the same
 *    reason: it is a destination, not a search.
 * 2. `name-prefix` — the name *starts* with what you typed, which is what makes
 *    the field usable while you are still typing it.
 * 3. `name` — every word you typed is somewhere in the name.
 * 4. `type` — every word you typed is in the printed type line, which is how
 *    `guardian` finds the class rather than the eleven cards that say the word.
 * 5. `keyword` — every word is a printed keyword or trait.
 * 6. `text` — every word is somewhere in the printed card text.
 *
 * Matching is AND, never OR: adding a word must narrow the result set, because
 * that is what a person adding a word is trying to do.
 *
 * Within a tier, ties break on corpus order, which is upstream's name sort and
 * is total — so no comparison is ever left for the engine's own sort to settle,
 * and two browsers cannot order the same query differently.
 */
export type CardMatchField =
  | "name-exact"
  | "name-prefix"
  | "name"
  | "type"
  | "keyword"
  | "text"
  | "filter";

const FIELD_RANK: Readonly<Record<CardMatchField, number>> = {
  "name-exact": 0,
  "name-prefix": 1,
  name: 2,
  type: 3,
  keyword: 4,
  text: 5,
  filter: 6,
};

export interface CardResult {
  readonly label: string;
  readonly href: string;
  /**
   * Which pitch versions of this card matched, and how many the corpus has.
   *
   * A ROW STANDS FOR A CARD, BUT LEGALITY BELONGS TO A VERSION, and those two
   * facts collide. Measured on this corpus: four names carry pitch versions
   * whose Classic Constructed ban differs — Electromagnetic Somersault red and
   * yellow are banned and blue is legal, and Bonds of Ancestry is the other way
   * round. A `banned:cc` search that collapsed those to one bare row would put
   * a card on a banned list without saying which version was banned, which is
   * the exact "collapses two true facts into one" failure `cards.ts` builds the
   * whole verdict model to avoid.
   *
   * So the collapse keeps the count: when `matched` is shorter than `total`,
   * the row names the versions it is talking about. When they are equal — the
   * ordinary case, including every plain name search — there is nothing to
   * qualify and the row says nothing.
   */
  readonly matchedPitches: readonly PitchValue[];
  readonly totalVersions: number;
  /** Face blob key, or `null` where the card publishes no art. */
  readonly faceKey: string | null;
  /** True where the face is landscape and needs a transposed box. */
  readonly faceLandscape: boolean;
  readonly pitch: PitchValue;
  readonly typeLine: string;
  /** Cost, power and defence as printed; `""` where the card has none. */
  readonly stats: readonly (readonly [string, string])[];
  readonly matchedIn: CardMatchField;
}

export interface CardOutcome {
  readonly query: string;
  readonly terms: readonly string[];
  readonly filters: readonly CardFilter[];
  readonly notices: readonly CardNotice[];
  readonly results: readonly CardResult[];
  /** Matches found, which may exceed the number returned. */
  readonly total: number;
}

/** Rows rendered at once. The count reported is always the true total. */
export const CARD_RESULT_LIMIT = 60;

const STAT_LABELS = ["Cost", "Power", "Defence"] as const;

/** `"Head Jab (pitch 2)"` → `"Head Jab"`. The suffix `labelFor` added. */
function nameOf(label: string): string {
  return label.replace(/ \((?:no pitch|pitch \d)\)$/, "");
}

function toResult(
  index: CardIndex,
  ordinal: number,
  matchedIn: CardMatchField,
  matchedPitches: readonly PitchValue[],
  totalVersions: number,
): CardResult {
  const printed = index.stats[ordinal] ?? ["", "", ""];
  const slug = index.slugs[ordinal] ?? "";
  const nameSlug = index.nameSlugs[ordinal] ?? slug;
  const collapsed = nameSlug !== slug;

  return {
    // THE BARE NAME WHEN THE RESULT STANDS FOR SEVERAL VERSIONS. Everywhere a
    // row points at ONE card it must render the disambiguated label, or two
    // anchors differ only in where they point. Here the row points at the card
    // as a whole, whose name is unambiguous — and the destination shows the
    // versions as tabs, so nothing is lost by not choosing one in the link.
    label: collapsed ? nameOf(index.labels[ordinal] ?? "") : index.labels[ordinal] ?? "",
    href: `/card/${collapsed ? nameSlug : slug}`,
    matchedPitches,
    totalVersions,
    faceKey: index.faceKeys[ordinal] ?? null,
    faceLandscape: index.faceLandscape[ordinal] === true,
    pitch: index.pitches[ordinal] ?? 0,
    typeLine: index.typeLines[ordinal] ?? "",
    stats: STAT_LABELS.map(
      (label, position) => [label, printed[position] ?? ""] as const,
    ).filter(([, value]) => value !== ""),
    matchedIn,
  };
}

/**
 * Run a query. Pure: same index and same string, same array, every time.
 */
export function searchCards(
  index: CardIndex,
  raw: string,
  limit: number = CARD_RESULT_LIMIT,
): CardOutcome {
  const { terms, filters, notices, folded } = parseCardQuery(raw);

  const ranked: { ordinal: number; field: CardMatchField }[] = [];

  /* Text postings are the only lookup that is not a linear scan, so they are
     resolved once per term rather than once per card — for free terms and for
     `text:`/`o:` filters alike. */
  const textHits = terms.map((term) => textMatches(index, term));
  const textFilters = filters
    .filter((filter) => filter.field === "text")
    .map((filter) => textMatches(index, filter.value));
  const scanned = filters.filter((filter) => filter.field !== "text");

  for (let ordinal = 0; ordinal < index.size; ordinal += 1) {
    if (!textFilters.every((hits) => hits.has(ordinal))) continue;
    if (!scanned.every((filter) => passesFilter(index, ordinal, filter))) continue;

    if (terms.length === 0) {
      if (filters.length > 0) ranked.push({ ordinal, field: "filter" });
      continue;
    }

    const nameTokens = index.labelTokens[ordinal] ?? [];
    const typeTokens = index.typeTokens[ordinal] ?? [];
    const vocabulary = [
      ...(index.keywords[ordinal] ?? []),
      ...(index.traits[ordinal] ?? []),
    ];

    const inName = terms.every((term) => tokensMatch(nameTokens, term));
    const inType = terms.every((term) => tokensMatch(typeTokens, term));
    const inVocabulary = terms.every((term) => valuesMatch(vocabulary, term));
    const inText = terms.every((_, position) => textHits[position]?.has(ordinal) === true);

    if (!inName && !inType && !inVocabulary && !inText) continue;

    const label = index.folded[ordinal] ?? "";
    const field: CardMatchField = !inName
      ? inType
        ? "type"
        : inVocabulary
          ? "keyword"
          : "text"
      : label === folded
        ? "name-exact"
        : label.startsWith(folded)
          ? "name-prefix"
          : "name";

    ranked.push({ ordinal, field });
  }

  ranked.sort(
    (a, b) => FIELD_RANK[a.field] - FIELD_RANK[b.field] || a.ordinal - b.ordinal,
  );

  /**
   * PITCH VERSIONS COLLAPSE TO ONE RESULT.
   *
   * A player calls the red, yellow and blue versions of a card ONE card, and
   * searching "head jab" should not answer with three rows that differ only by
   * a jewel. So results are grouped by bare-name slug and the best-ranked
   * version of each stands for the group, linking to the card page — where the
   * versions are tabs.
   *
   * NOTHING IS HIDDEN BY THIS, and that distinction matters. The grouping runs
   * AFTER matching, so a query that only one version satisfies still finds the
   * card: `text:` terms unique to the blue version put the card on the page,
   * and the tab strip is one click from the text that matched. What collapses
   * is the presentation, never the search.
   *
   * `total` counts CARDS after collapsing rather than corpus rows, because it
   * is the number a reader is told — "3 cards match" has to mean three things
   * they can click, not three rows two of which go to the same page.
   */
  const bestByName = new Map<string, { ordinal: number; field: CardMatchField }>();
  const matchedByName = new Map<string, PitchValue[]>();
  for (const row of ranked) {
    const name = index.nameSlugs[row.ordinal] ?? index.slugs[row.ordinal] ?? "";
    const pitches = matchedByName.get(name);
    const pitch = index.pitches[row.ordinal] ?? 0;
    if (pitches) pitches.push(pitch);
    else matchedByName.set(name, [pitch]);
    // `ranked` is already in rank order, so the first sighting is the best one.
    if (!bestByName.has(name)) bestByName.set(name, row);
  }
  const collapsed = [...bestByName.entries()];

  return {
    query: raw,
    terms,
    filters,
    notices,
    results: collapsed
      .slice(0, limit)
      .map(([name, row]) =>
        toResult(
          index,
          row.ordinal,
          row.field,
          (matchedByName.get(name) ?? []).toSorted((a, b) => a - b),
          index.versionsByName.get(name) ?? 1,
        ),
      ),
    total: collapsed.length,
  };
}
