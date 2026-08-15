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
/*
 * TYPE-ONLY FROM `cards.ts`, AND THAT IS LOAD-BEARING RATHER THAN STYLISTIC.
 * `cards.ts` imports the 16 MB corpus at module scope, and this module is
 * reached from the island entry through `CardSearch.tsx` — so a VALUE import
 * here put the entire corpus in the client bundle. It did: 9.28 MB shipped to
 * every reader who opened a page with an island. `facesOf` and `numberFor` now
 * live in `printings.ts`, which is pure and corpus-free.
 */
import type { CardPage } from "./cards";
import { facesOf, numberFor } from "./printings";
import {
  evaluate,
  leaves,
  parse,
  tokenise,
  type QueryLeaf,
  type QueryNode,
  type Token,
} from "./query";

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
   * The card's OTHER arts — one line per card, `\t` between entries, each
   * entry `<setId> <faceKey>`.
   *
   * This is what `unique:art` needs and nothing else does, so it is worth
   * saying what it deliberately is not. It is NOT every printing: the corpus
   * has 16,502 printing rows and 11,378 distinct images, because Regular /
   * Rainbow Foil / Cold Foil in one set are three rows sharing one picture.
   * And it is NOT every art either — the card's own face is already in
   * `faceKeys`, so listing it again would be 4,941 duplicated strings to say
   * something the index already says.
   *
   * SO IT IS THE 6,437 NON-DEFAULT FACES, which is exactly the set `cards.ts`
   * emits a URL for. That is not a coincidence worth leaving implicit: a row
   * in `unique:art` is a link, the thing it links to is a per-printing page,
   * and those pages exist for precisely these faces. An index carrying arts
   * with no address would be offering the reader a result they cannot open.
   *
   * The set id rather than the set code, because `setDict` is already shipped
   * and 112 codes across 6,437 entries is 26 KB of repetition otherwise. The
   * collector number is not carried at all — it is a pure function of the key
   * and the code, and deriving it costs nothing next to shipping it.
   *
   * Measured: 69 KB on a 732 KB payload. Storing every art instead of the
   * non-default ones would have been 122 KB for the same feature.
   */
  readonly arts: string;
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
  /**
   * `YYYY-MM-DD` per entry of {@link EncodedCardIndex.setDict}, one per line,
   * EMPTY where upstream publishes no date for that set.
   *
   * Seventeen of the 118 sets are undated — the judge, organised-play and
   * promo lines — so the empty line is a real state carrying a real meaning
   * rather than a gap to be filled in later. A card known only from those sets
   * has no release date, and `order:released`, `year:` and `date:` all have to
   * say so rather than guess one.
   *
   * A parallel array rather than a `code=date` map, because the codes are
   * already shipped in `setDict` and repeating 101 of them would be most of the
   * payload. About 1.2 KB.
   */
  readonly setReleased: string;
  /** Rarity-code vocabulary, one per line. */
  readonly rarityDict: string;
  readonly artistDict: string;
  /**
   * Per-card membership lists, one line each, base-36 ids dot-separated and
   * the four groups tab-separated: keywords, traits, sets, rarities.
   */
  readonly memberships: string;
  /**
   * A SECOND POSTINGS INDEX, over flavour text rather than rules text.
   *
   * Separate rather than folded into `postings` because the two answer
   * different questions and must not bleed: `text:blood` is a claim about what
   * a card DOES, and a card whose flavour mentions blood does not do anything
   * of the sort. Merging them would make every `text:` search quietly wrong on
   * 864 cards.
   *
   * Postings rather than the strings themselves, which is a payload decision
   * with a measurement behind it: the corpus carries 206 KB of flavour prose,
   * and storing it verbatim would have grown a 665 KB index by 31% for one
   * operator. Tokenised and delta-encoded it is a fraction of that, and the
   * search page already pays for exactly this shape.
   */
  readonly flavour: string;
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
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "and",
  "or",
  "is",
  "are",
  "be",
  "it",
  "its",
  "as",
  "at",
  "by",
  "for",
  "from",
  "that",
  "this",
  "these",
  "those",
  "with",
  "their",
  "them",
  "they",
  "you",
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
  const actual = (pages[0]?.verdicts ?? []).map(
    (verdict) => verdict.format.name,
  );
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
/**
 * One postings map, as sorted delta-encoded lines.
 *
 * Shared by the rules-text and flavour-text indexes. They are two indexes for a
 * reason — a card whose flavour mentions blood does not DO anything with
 * blood — but they are the same shape, and one encoder means a change to the
 * format cannot land on one of them and not the other.
 */
function encodePostings(map: ReadonlyMap<string, readonly number[]>): string[] {
  return [...map.entries()]
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
}

/**
 * What the index needs that the card corpus does not carry.
 *
 * `releasedBySet` IS PASSED IN RATHER THAN IMPORTED, and that is a bundling
 * constraint rather than a style choice. This module is reached from the search
 * island through `CardSearch.tsx`, so anything it imports ships to the browser —
 * which is how the entire 16 MB card corpus once ended up in a 9.28 MB client
 * bundle. `sets.ts` loads a 21 KB corpus to answer a question worth 1.2 KB of
 * dates, so the build resolves it and hands over the answer. See
 * `src/lib/printings.ts` for the same rule stated at length.
 */
export interface CardIndexSource {
  /** The upstream commit the corpus was pinned at. */
  readonly commit: string;
  /** `YYYY-MM-DD` the corpus was last confirmed against upstream. */
  readonly confirmed: string;
  /**
   * `YYYY-MM-DD` per set code, or `null` where upstream publishes no date.
   *
   * REQUIRED, with no default, because the alternative is a build that emits an
   * index with no dates in it and a `order:released` that answers nothing while
   * reporting success. A missing argument should be a type error, not a quiet
   * feature outage.
   */
  readonly releasedBySet: ReadonlyMap<string, string | null>;
}

export function buildCardIndex(
  pages: readonly CardPage[],
  source: CardIndexSource,
): EncodedCardIndex {
  assertFormatsAgree(pages);

  const labels: string[] = [];
  const slugs: string[] = [];
  const nameSlugs: string[] = [];
  const faceKeys: string[] = [];
  const arts: string[] = [];
  const faceLandscape: string[] = [];
  const pitches: string[] = [];
  const stats: string[] = [];
  const memberships: string[] = [];
  const postings = new Map<string, number[]>();
  const flavourPostings = new Map<string, number[]>();

  const types = dictionary(pages.map((page) => page.card.type_text));
  const keywords = dictionary(pages.flatMap((page) => page.card.card_keywords));
  const traits = dictionary(pages.flatMap((page) => page.card.traits));
  const sets = dictionary(
    pages.flatMap((page) =>
      page.card.printings.map((printing) => printing.set_id),
    ),
  );
  const rarities = dictionary(
    pages.flatMap((page) =>
      page.card.printings.map((printing) => printing.rarity),
    ),
  );
  /* 311 distinct names across every printing in the corpus, so a dictionary
     and a membership list — the same shape sets and rarities already use, and
     for the same reason: a small closed vocabulary repeated thousands of
     times. */
  const artists = dictionary(
    pages.flatMap((page) =>
      page.card.printings.flatMap((printing) => printing.artists ?? []),
    ),
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
    /* `facesOf` is the router's list (see `cards.ts`), and `.slice(1)` drops
       the default — the one face that already has an address of its own. So
       every entry written here has a page waiting for it. */
    arts.push(
      facesOf(page.card)
        .slice(1)
        .map((ref) => `${sets.idOf.get(ref.printing.set_id) ?? 0} ${ref.key}`)
        .join("\t"),
    );
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
        membershipIds(
          page.card.printings.flatMap((printing) => printing.artists ?? []),
          artists.idOf,
        ),
      ].join("\t"),
    );

    const vector = page.verdicts
      .map((verdict) => {
        const mask = verdict.unknown
          ? TONE_BIT.unknown
          : verdict.states.reduce(
              (sum, state) => sum + TONE_BIT[state.tone],
              0,
            );
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

    /* Every printing's flavour, as one bag of words per card. A card whose
       reprint carries different flavour is findable by either — which is the
       same rule `set:` and `artist:` follow, because all three are
       printing-level facts hanging off a card-level row. */
    const flavourText = page.card.printings
      .map((printing) => printing.flavor_text ?? "")
      .filter((text) => text !== "")
      .join(" ");
    for (const term of new Set(tokeniseCard(flavourText))) {
      const list = flavourPostings.get(term);
      if (list) list.push(ordinal);
      else flavourPostings.set(term, [ordinal]);
    }
  });

  // Sorted so the artifact is a function of the corpus alone, exactly as the
  // rules index is: an index whose byte order tracks the corpus is an index
  // whose diff is unreadable the first time a card moves.
  const postingLines = encodePostings(postings);
  const flavourLines = encodePostings(flavourPostings);

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
    arts: arts.join("\n"),
    faceLandscape: faceLandscape.join(""),
    pitches: pitches.join(""),
    typeDict: types.list.join("\n"),
    typeAt: typeAt.join(""),
    stats: stats.join("\n"),
    keywordDict: keywords.list.join("\n"),
    traitDict: traits.list.join("\n"),
    setDict: sets.list.join("\n"),
    setReleased: sets.list
      .map((code) => source.releasedBySet.get(code) ?? "")
      .join("\n"),
    rarityDict: rarities.list.join("\n"),
    artistDict: artists.list.join("\n"),
    memberships: memberships.join("\n"),
    verdictDict: verdictList.join("\n"),
    verdictAt: verdictAt.join(""),
    postings: postingLines.join("\n"),
    flavour: flavourLines.join("\n"),
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
  /**
   * The card's other arts, decoded — everything a `unique:art` row needs to be
   * a link and a picture, and nothing else.
   *
   * The set CODE rather than the id, because by this point the dictionary has
   * been read and a row wants to say "Omen", not "37". The collector number is
   * derived here rather than shipped; see `numberOf`.
   */
  readonly arts: readonly (readonly ArtRef[])[];
  readonly faceLandscape: readonly boolean[];
  readonly pitches: readonly PitchValue[];
  readonly typeLines: readonly string[];
  readonly typeTokens: readonly (readonly string[])[];
  readonly stats: readonly (readonly [string, string, string])[];
  readonly keywords: readonly (readonly string[])[];
  readonly traits: readonly (readonly string[])[];
  readonly sets: readonly (readonly string[])[];
  /**
   * Every release date the card has, ascending, one entry per DATED set it was
   * printed in. Empty where every set it appears in is undated.
   *
   * Per card rather than per set because that is the shape both consumers want:
   * `order:released` takes the first, and `year:`/`date:` ask whether ANY of
   * them satisfies the test. Resolving the set codes once at decode beats doing
   * it 4,941 times per query.
   */
  readonly released: readonly (readonly string[])[];
  /**
   * How many cards have no release date at all — 53 of 4,941.
   *
   * Carried so a `year:`/`date:` query can SAY it excluded them. Seventeen of
   * the 118 sets are undated upstream (the judge, organised-play and promo
   * lines), and a card printed only there matches no date filter that will ever
   * be written. Silently returning 4,888 cards for a question asked about 4,941
   * is the kind of quiet wrongness this engine exists not to do.
   */
  readonly undatedCards: number;
  readonly rarities: readonly (readonly string[])[];
  /** Every artist credited on any printing of the card. */
  readonly artists: readonly (readonly string[])[];
  /** Six bitmasks per card, in {@link FORMATS} order. */
  readonly verdicts: readonly (readonly number[])[];
  readonly postings: ReadonlyMap<string, readonly number[]>;
  readonly terms: readonly string[];
  /** The flavour-text index, kept apart from the rules-text one on purpose. */
  readonly flavourPostings: ReadonlyMap<string, readonly number[]>;
  readonly flavourTerms: readonly string[];
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

/**
 * The inverse of {@link encodePostings}. Shared for the same reason.
 */
function decodePostings(encoded: string): Map<string, number[]> {
  const postings = new Map<string, number[]>();
  if (encoded === "") return postings;

  for (const line of encoded.split("\n")) {
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

  return postings;
}

/**
 * One alternate art of a card, as a result row needs it.
 *
 * Deliberately smaller than `PrintingRef` in `cards.ts`: that one carries the
 * whole printing row, which is a build-time object sitting in a 16 MB corpus
 * the browser never sees. This is the three fields that survive the wire.
 */
export interface ArtRef {
  readonly key: string;
  readonly setCode: string;
  readonly number: string;
}

export function decodeCardIndex(encoded: EncodedCardIndex): CardIndex {
  const labels = encoded.labels === "" ? [] : encoded.labels.split("\n");
  const slugs = encoded.slugs === "" ? [] : encoded.slugs.split("\n");
  const faceKeyLines =
    encoded.faceKeys === "" ? [] : encoded.faceKeys.split("\n");
  const artLines = encoded.arts === "" ? [] : encoded.arts.split("\n");
  const nameSlugLines =
    encoded.nameSlugs === "" ? [] : encoded.nameSlugs.split("\n");
  const nameSlugPerCard = labels.map(
    (_, ordinal) => nameSlugLines[ordinal] ?? "",
  );
  const typeDict = encoded.typeDict === "" ? [] : encoded.typeDict.split("\n");
  const keywordDict =
    encoded.keywordDict === "" ? [] : encoded.keywordDict.split("\n");
  const traitDict =
    encoded.traitDict === "" ? [] : encoded.traitDict.split("\n");
  const setDict = encoded.setDict === "" ? [] : encoded.setDict.split("\n");
  const setReleasedLines =
    encoded.setReleased === "" ? [] : encoded.setReleased.split("\n");
  /* Code → date, dated sets only. An undated set is absent rather than mapped
     to the empty string, so a lookup miss and "released on nothing" cannot be
     confused at the call site. */
  const releasedBySet = new Map<string, string>();
  setDict.forEach((code, position) => {
    const date = setReleasedLines[position] ?? "";
    if (date !== "") releasedBySet.set(code, date);
  });
  const rarityDict =
    encoded.rarityDict === "" ? [] : encoded.rarityDict.split("\n");
  const artistDict =
    encoded.artistDict === "" ? [] : encoded.artistDict.split("\n");
  const verdictDict =
    encoded.verdictDict === "" ? [] : encoded.verdictDict.split("\n");
  const statLines = encoded.stats === "" ? [] : encoded.stats.split("\n");
  const membershipLines =
    encoded.memberships === "" ? [] : encoded.memberships.split("\n");

  const typeLines: string[] = [];
  const pitches: PitchValue[] = [];
  const verdicts: number[][] = [];
  const keywords: string[][] = [];
  const traits: string[][] = [];
  const sets: string[][] = [];
  const released: string[][] = [];
  const rarities: string[][] = [];
  const artists: string[][] = [];
  const stats: (readonly [string, string, string])[] = [];

  labels.forEach((_, ordinal) => {
    const typeId = Number.parseInt(
      encoded.typeAt.slice(ordinal * 2, ordinal * 2 + 2),
      36,
    );
    typeLines.push(typeDict[typeId] ?? "");

    const digit = Number(encoded.pitches[ordinal] ?? "0");
    pitches.push(
      (digit === 1 ? 1 : digit === 2 ? 2 : digit === 3 ? 3 : 0) as PitchValue,
    );

    const vectorId = Number.parseInt(
      encoded.verdictAt.slice(ordinal * 2, ordinal * 2 + 2),
      36,
    );
    verdicts.push(
      (verdictDict[vectorId] ?? "")
        .split(",")
        .map((mask) => Number.parseInt(mask, 36) || 0),
    );

    const [cost = "", power = "", defence = ""] = (
      statLines[ordinal] ?? ""
    ).split("\t");
    stats.push([cost, power, defence] as const);

    const [k = "", t = "", s = "", r = "", a = ""] = (
      membershipLines[ordinal] ?? ""
    ).split("\t");
    keywords.push([...splitIds(k, keywordDict)]);
    traits.push([...splitIds(t, traitDict)]);
    const cardSets = [...splitIds(s, setDict)];
    sets.push(cardSets);
    released.push(
      cardSets
        .flatMap((code) => {
          const date = releasedBySet.get(code);
          return date === undefined ? [] : [date];
        })
        .toSorted(),
    );
    rarities.push([...splitIds(r, rarityDict)]);
    artists.push([...splitIds(a, artistDict)]);
  });

  const postings = decodePostings(encoded.postings);
  const flavourPostings = decodePostings(encoded.flavour);

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
    arts: labels.map((_, ordinal) => {
      const line = artLines[ordinal] ?? "";
      if (line === "") return [];
      return line.split("\t").flatMap((entry): ArtRef[] => {
        const gap = entry.indexOf(" ");
        if (gap === -1) return [];
        /* LOWERCASED, BECAUSE THE ROUTE IS. `setDict` holds upstream's
           spelling — `WTR` — and `facesOf` lowercases when it builds the path,
           so taking the dictionary's spelling verbatim produced
           `/card/head-jab-1/WTR/098` for a page emitted at `/wtr/098`. Every
           `unique:art` row would have been a 404, and every one of them would
           have looked right. */
        const setCode =
          setDict[Number.parseInt(entry.slice(0, gap), 10)]?.toLowerCase();
        const key = entry.slice(gap + 1);
        if (setCode === undefined || key === "") return [];
        return [{ key, setCode, number: numberFor(key, setCode) }];
      });
    }),
    faceLandscape: labels.map(
      (_, ordinal) => encoded.faceLandscape[ordinal] === "1",
    ),
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
    released,
    undatedCards: released.filter((dates) => dates.length === 0).length,
    rarities,
    artists,
    verdicts,
    postings,
    terms: [...postings.keys()],
    flavourPostings,
    flavourTerms: [...flavourPostings.keys()],
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
 *
 * THAT RULE WAS BROKEN ONCE, IN THE HARMLESS DIRECTION, AND IT IS STILL WORTH
 * NAMING. `artist`, `flavor` and `flavour` sat here describing themselves as
 * "not indexed here yet" for as long as they were indexed. Nothing failed —
 * a field that resolves returns before this table is consulted, so the entries
 * were unreachable — but "unreachable" is not "correct": this table is read as
 * the list of what the engine cannot do, and it was overstating that list.
 * An operator that WORKS is not pending, and saying so is the same obligation
 * as saying an operator that does not.
 */
const PENDING_OPERATORS: Readonly<Record<string, string>> = {
  is: "filters judge-verified rulings, which are not published yet",
  changed: "lists what a rules version touched, which is not published yet",
  cr: "searches the Comprehensive Rules — that lives at /search, not here",
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
    | "phrase-approximate"
    /* The engine answered, and is telling you what it could not see. Distinct
       from `operator-pending`, which means it did not answer at all. */
    | "coverage-partial";
  readonly text: string;
}

/** One `field:value` restriction the engine will actually apply. */
export interface CardFilter {
  readonly field:
    | "name"
    /* Present because `outcome.filters` reports it, NOT because `passesFilter`
       handles it — the `released` branch of the leaf test returns before that
       function is reached. Declared anyway: the union is what `toCardFilter`
       casts into, and a cast into a union that does not contain the value is a
       lie that stays quiet until somebody reorders the branches. */
    | "released"
    | "text"
    | "artist"
    | "flavour"
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

/** What a result set can be ordered by. */
export type CardSortKey =
  | "name"
  | "pitch"
  | "cost"
  | "power"
  | "defence"
  | "rarity"
  | "set"
  | "released";

/**
 * How the reader asked for the results to be ordered.
 *
 * `key` is `null` when they did not ask, which is not the same as asking for
 * name order: the default is RELEVANCE, and relevance is a property of the
 * query rather than of the cards. Collapsing the two would silently discard the
 * ranking on every unordered search.
 */
export interface CardSort {
  readonly key: CardSortKey | null;
  readonly direction: "asc" | "desc";
}

export interface ParsedCardQuery {
  /** Free terms, deduplicated, in the order typed. */
  readonly terms: readonly string[];
  readonly filters: readonly CardFilter[];
  readonly notices: readonly CardNotice[];
  /** The requested ordering, or the default. */
  readonly sort: CardSort;
  /** The level results collapse at. See {@link CardUniqueMode}. */
  readonly unique: CardUniqueMode;
  /** The shape asked for, or `null` where the query did not say. */
  readonly display: CardDisplayMode | null;
  /** The whole query, folded — used only for the exact-name tier. */
  readonly folded: string;
  /**
   * The query as an expression.
   *
   * `terms` and `filters` remain because they are what the interface describes
   * back to the reader, and because a flat list is the right shape for "what
   * did you ask for". They are derived FROM this tree rather than parsed
   * alongside it, so the two cannot disagree about what the query said.
   */
  readonly tree: QueryNode | null;
}

const STATE_OPERATORS: Readonly<Record<string, StateTone>> = {
  legal: "legal",
  banned: "banned",
  suspended: "suspended",
  restricted: "restricted",
};

/**
 * What `order:` can sort by, and what a reader may call each one.
 *
 * SEVEN KEYS, NOT SCRYFALL'S FIFTEEN, and the gap is honest rather than
 * unfinished: most of theirs sort on data this corpus does not carry — no
 * prices, no release date per card, no EDHREC rank, no colour identity. These
 * are the printed values Optfall actually has, plus the two identifiers a
 * reader browses by.
 */
/**
 * HOW MUCH OF THE CORPUS ONE ROW STANDS FOR.
 *
 * `docs/SCRYFALL-GAP.md` §5.1c asked for `unique:cards|prints|art`. The three
 * levels are real here, but they do not land where Scryfall's names suggest,
 * and pretending otherwise would have shipped an operator that lies:
 *
 * - **`names`** — one row per NAME. Head Jab's red, yellow and blue versions
 *   are one result. This is what the search has always done and it stays the
 *   default; the reasoning is in `searchCards`, and it is good — a reader told
 *   "3 cards match" should get three things to click.
 * - **`cards`** — one row per CARD. Those three versions separate, because the
 *   rest of this site already treats them as three cards: different text,
 *   different legality, different pages, and a canonical tag that says so.
 * - **`art`** — one row per distinct PICTURE, including alternate arts, each
 *   linking to that art's own page.
 *
 * `prints` IS AN ALIAS FOR `art`, AND THAT IS A CLAIM ABOUT THE DATA. On
 * Scryfall the two differ because a printing there is individually addressable.
 * Here the corpus has 16,502 printing rows and 11,378 distinct pictures — a
 * card printed Regular, Rainbow Foil and Cold Foil in one set is three rows
 * sharing one image, one collector number and one page. `unique:prints` as a
 * separate mode would emit three identical rows pointing at the same URL, which
 * is not a finer view of anything. So it resolves to `art` rather than being
 * refused: the reader asked for "show me every printing", and every printing
 * this corpus can distinguish is exactly what they get.
 */
/**
 * WHICH SHAPE THE ANSWER TAKES.
 *
 * `docs/SCRYFALL-GAP.md` §5.2 asked for `display:grid` (default) / `list` /
 * `text`, "in the URL" — and specifically as a QUERY TERM rather than as UI
 * chrome, because §5.2's fifth point is that every piece of state is in the
 * URL and its fourth is that the query is an algebra rather than a filter set.
 *
 * - **`grid`** — the card face IS the row. The default, because recognising a
 *   card by its picture is faster than reading its name.
 * - **`list`** — the dense row: jewel, name, type line, printed stats. The
 *   plan is right that this is better than Scryfall's checklist, so it is kept
 *   exactly as it was and merely given a name that can be typed.
 * - **`text`** — names, one per line, and nothing else. This is the mode that
 *   is not a nicer version of the others: it is the one you can SELECT AND
 *   COPY. A player building a deck list wants forty names, not forty pictures.
 *
 * `checklist` is accepted as a spelling of `text` because that is what
 * Scryfall calls it and a reader arriving with that vocabulary should not have
 * to discover ours.
 */
export type CardDisplayMode = "grid" | "list" | "text";

const DISPLAY_MODES: Readonly<Record<string, CardDisplayMode>> = {
  grid: "grid",
  images: "grid",
  list: "list",
  rows: "list",
  text: "text",
  checklist: "text",
  names: "text",
};

export type CardUniqueMode = "names" | "cards" | "art";

const UNIQUE_MODES: Readonly<Record<string, CardUniqueMode>> = {
  names: "names",
  name: "names",
  cards: "cards",
  card: "cards",
  art: "art",
  arts: "art",
  prints: "art",
  printings: "art",
};

/**
 * The three printed values a comparison may name on either side, and what a
 * reader may call each one.
 *
 * `pow` and `tou` are here because Scryfall uses them and this grammar is
 * inherited on purpose. `tou` maps to defence: Magic's toughness and Flesh and
 * Blood's defence are the same position on the card, and a reader who types the
 * word they know should get the value they meant rather than an error telling
 * them this game uses a different noun.
 */
const STAT_FIELDS: Readonly<Record<string, "cost" | "power" | "defence">> = {
  cost: "cost",
  power: "power",
  pow: "power",
  defence: "defence",
  defense: "defence",
  def: "defence",
  tou: "defence",
  toughness: "defence",
};

const SORT_KEYS: Readonly<Record<string, CardSortKey>> = {
  name: "name",
  released: "released",
  release: "released",
  pitch: "pitch",
  cost: "cost",
  power: "power",
  defence: "defence",
  defense: "defence",
  def: "defence",
  rarity: "rarity",
  set: "set",
};

/**
 * Rarity in scarcity order, which is the only order a reader means by it.
 *
 * The corpus stores upstream's single letters and `data/sets/sets.json` decodes
 * them to names; neither carries a RANK, because neither needs one until
 * something sorts by it. This is that rank, and it is stated here rather than
 * inferred from the decode table's key order — a JSON object's key order is not
 * a promise, and sorting a reference tool by an accident of serialisation is
 * the kind of thing nobody notices is wrong.
 *
 * Token and Basic sit below Common because they are not pulled from a pack.
 * Marvel sits at the top, above Fabled, which is where the game puts it.
 *
 * PROMO IS NOT A RARITY and is ranked last for that reason rather than as a
 * scarcity claim: it describes how a card was distributed, not how rare it is,
 * so it has no place on the ladder and sorting it into the middle would assert
 * one.
 */
const RARITY_RANK: Readonly<Record<string, number>> = {
  T: 0,
  B: 1,
  C: 2,
  R: 3,
  S: 4,
  M: 5,
  L: 6,
  F: 7,
  V: 8,
  P: 9,
};

/** Operators that scope a word to one field. `class:` is discussed below. */
const FIELD_OPERATORS: Readonly<Record<string, CardFilter["field"]>> = {
  name: "name",
  text: "text",
  o: "text",
  /* PRINTING-LEVEL, UNLIKE EVERY OPERATOR ABOVE IT, and the page says so.
     A card matches when ANY of its printings does — the same rule `set:` and
     `rarity:` already follow, because all of them are facts about a printing
     hanging off a card-level row. */
  artist: "artist",
  a: "artist",
  flavour: "flavour",
  flavor: "flavour",
  ft: "flavour",
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
  /* `pow` and `tou` for the same reason STAT_FIELDS carries them: the grammar is
     inherited, and a reader who types the spelling they know should get the
     value they meant. Both sides of a comparison have to accept them or
     `pow>tou` resolves on the right and fails on the left. */
  pow: "power",
  defence: "defence",
  defense: "defence",
  def: "defence",
  tou: "defence",
  toughness: "defence",
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
  /* Both are prose. `a:faizal fikri` has to ask for both words rather than for
     the literal string, or a reader who types a full name gets nothing. */
  "artist",
  "flavour",
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
  const notices: CardNotice[] = [];
  const seenNotice = new Set<string>();

  const note = (kind: CardNotice["kind"], text: string) => {
    const key = `${kind}:${text}`;
    if (seenNotice.has(key)) return;
    seenNotice.add(key);
    notices.push({ kind, text });
  };

  /**
   * Turn one token into a leaf, or reject it and say why.
   *
   * ALL THE OPERATOR KNOWLEDGE LIVES HERE, and the grammar in `./query` has
   * none of it: that module knows about `and`, `or`, `not` and grouping, and
   * this function knows what `banned:cc` means. Keeping them apart is what
   * makes the tree testable without a corpus and the operators testable
   * without a parser.
   */
  const toLeaf = (token: Token): QueryNode | null => {
    /* ---------------------------------------------------------- free word */
    if (token.kind === "term") {
      if (token.quoted) {
        note(
          "phrase-approximate",
          `“${token.value.trim()}” is matched word by word. The index carries no word positions, so adjacency is not checked.`,
        );
      }
      const kept = tokeniseCard(token.value);
      const dropped = (
        token.value.toLowerCase().match(/[a-z0-9]+/g) ?? []
      ).filter((word) => !kept.includes(word));
      for (const word of new Set(dropped)) {
        note(
          "term-ignored",
          STOPWORDS.has(word)
            ? `“${word}” is in most cards, so it cannot narrow anything. Ignored.`
            : `“${word}” is a single letter — too short to search on. Ignored.`,
        );
      }
      if (kept.length === 0) return null;
      const children = kept.map(
        (value): QueryNode => ({
          kind: "leaf",
          field: "any",
          value,
          label: value,
        }),
      );
      return children.length === 1 ? children[0]! : { kind: "and", children };
    }

    /* ------------------------------------------------------- exact name */
    if (token.kind === "exact") {
      const folded = fold(token.value);
      if (folded === "") {
        note("operand-unknown", "! was typed with no name after it. Ignored.");
        return null;
      }
      return {
        kind: "leaf",
        field: "name-exact",
        value: folded,
        label: `!${token.value}`,
      };
    }

    if (token.kind !== "field") return null;

    const name = token.field;
    const operandRaw = token.value;
    const operand = operandRaw.toLowerCase();

    if (operand === "") {
      note(
        "operand-unknown",
        `${name}: was typed with nothing after it. Ignored.`,
      );
      return null;
    }

    /* ------------------------------------------------------------- state */
    const stateTone = STATE_OPERATORS[name];
    if (stateTone) {
      if (token.compare !== undefined) {
        note(
          "operator-unknown",
          `${name}${token.compare}: a legality filter names a format, so there is nothing to compare. Use ${name}:cc.`,
        );
        return null;
      }
      const [formatName = "", asOf] = operand.split("@");
      if (asOf !== undefined) {
        note(
          "operator-pending",
          `${name}:${formatName}@${asOf} asks what was legal on a date. Optfall publishes present-day legality only; legality that remembers is not built yet, and answering with today's flags would be a wrong answer rather than a missing one.`,
        );
        return null;
      }
      const formatIndex = FORMAT_ALIASES[formatName];
      if (formatIndex === undefined) {
        note(
          "operand-unknown",
          `${name}:${formatName} names no format Optfall serves. The six are ${FORMAT_NAMES.join(", ")}.`,
        );
        return null;
      }
      return {
        kind: "leaf",
        field: "state",
        value: `${formatIndex}:${TONE_BIT[stateTone]}`,
        label: `${stateTone} in ${FORMAT_NAMES[formatIndex] ?? formatName}`,
      };
    }

    /* ----------------------------------------------------------- released */
    /*
      `year:` AND `date:` ARE ONE OPERATOR WITH TWO GRAINS, which is why they
      normalise to a single `released` leaf here rather than staying two fields
      the matcher has to tell apart. `year:2024` is `date:2024-01-01 …
      2024-12-31` said briefly, and a reader who writes one and then the other
      should get answers that agree.

      A CARD MATCHES IF ANY OF ITS PRINTINGS DOES. The corpus collapses a card
      across its sets, so "released in 2024" can only mean "printed in 2024 at
      least once" — the alternative, testing only the first printing, would
      answer `year:2024` with cards that came out in 2019 and were reprinted,
      excluded, which is not what anybody means by the question.
    */
    if (name === "year" || name === "date") {
      const grain = name === "year" ? "year" : "date";
      const pattern = grain === "year" ? /^\d{4}$/ : /^\d{4}-\d{2}-\d{2}$/;

      /*
        `!=` IS REFUSED, AND THE REASON IS THE 53 UNDATED CARDS RATHER THAN
        laziness about implementing it.

        There is no meaning for `year!=2024` that is both consistent and honest.
        Applied per printing it is wrong outright: a card printed in 2019 and
        reprinted in 2024 has a printing outside 2024, so it would come back
        from `year:2024` AND `year!=2024` — a query and its own negation.
        Applied to the whole card it becomes `-year:2024`, except on the cards
        with no published date at all, where the two part company: `-` is a
        boolean NOT over a match that did not happen, so it INCLUDES them, while
        `!=` would be asserting "this card was not released in 2024" about a
        card whose release date upstream does not publish. That is a claim this
        corpus cannot support.

        So the operator that has a defensible meaning is offered and the one
        that does not is named. `docs/PLAN.md`, "degrade visibly": an engine
        that cannot answer honestly says so rather than picking whichever
        answer looks reasonable.
      */
      if (token.compare === "!=") {
        note(
          "operator-unknown",
          `${name}!=${operandRaw}: there is no honest answer to "not this ${grain}". Use -${name}:${operandRaw}, which excludes the cards that match and keeps the ${
            grain === "year" ? "undated" : "undated"
          } ones — ${name}!= would have to claim a release date for cards upstream publishes none for.`,
        );
        return null;
      }

      if (!pattern.test(operand)) {
        note(
          "operand-unknown",
          grain === "year"
            ? `year:${operandRaw} is not a four-digit year. Use year:2024, or date: for a day.`
            : `date:${operandRaw} is not a date. Use date:2024-06-21, or year: for a whole year.`,
        );
        return null;
      }

      return {
        kind: "leaf",
        field: "released",
        value: operand,
        ...(token.compare === undefined ? {} : { compare: token.compare }),
        label:
          token.compare === undefined
            ? `released in ${operand}`
            : `released ${token.compare} ${operand}`,
      };
    }

    /* ------------------------------------------------------------ fields */
    const field = FIELD_OPERATORS[name];
    if (field) {
      const label = `${name}${token.compare ?? ":"}${operandRaw}`;

      if (token.compare !== undefined) {
        // COMPARISONS, HONESTLY. Only the three printed stats have any order at
        // all, and even there `X`, `XX` and blanks do not — so a comparison is
        // answered as "this value is numeric AND satisfies the comparison", and
        // a card printing `X` simply does not match. That is a stated partial
        // order, which beats the flat refusal this replaced.
        if (field !== "cost" && field !== "power" && field !== "defence") {
          note(
            "operator-unknown",
            `${name}${token.compare}: ${name} has no order to compare. Comparisons work on cost, power and defence.`,
          );
          return null;
        }
        /*
          FIELD-TO-FIELD, WHICH IS THE OTHER HALF OF A COMPARISON. `power>defence`
          asks a question about one card against itself — "is this attack worth
          more than it blocks" — and there is no number that expresses it.
          Scryfall spells it `pow>tou`; the aliases below make both spellings
          work, because a reader arriving from there types theirs.

          Encoded with a `@` prefix rather than as a bare field name so the
          matcher can tell `power>2` from `power>defence` without inspecting the
          string's shape. A printed stat is digits or `X`, never a word, so the
          prefix is belt-and-braces — but the alternative is a matcher that
          decides what a value means by guessing, and this file has already been
          bitten once by a comparison whose meaning depended on where it was
          evaluated.
        */
        const against = STAT_FIELDS[operand];
        if (against !== undefined) {
          note(
            "phrase-approximate",
            `${label} compares two printed values on the same card. Cards where either side is X, XX or blank have no place in that order and do not match.`,
          );
          return {
            kind: "leaf",
            field,
            value: `@${against}`,
            compare: token.compare,
            label: `${field} ${token.compare} ${against}`,
          };
        }

        if (!/^\d+$/.test(operand)) {
          note(
            "operand-unknown",
            `${label} compares against something that is neither a number nor another printed value. Comparisons take a number, or one of ${[...new Set(Object.values(STAT_FIELDS))].join(", ")}.`,
          );
          return null;
        }
        note(
          "phrase-approximate",
          `${label} matches printed ${field} values that are numeric. ${operandRaw === "" ? "" : ""}Cards printing X, XX or nothing at all have no place in that order and do not match.`,
        );
        return {
          kind: "leaf",
          field,
          value: operand,
          compare: token.compare,
          label,
        };
      }

      if (WORD_VALUED.has(field)) {
        const tokens = tokeniseCard(operand);
        if (tokens.length === 0) {
          note(
            "operand-unknown",
            `${label} has nothing searchable in it once single letters and common words are dropped. Ignored.`,
          );
          return null;
        }
        const children = tokens.map(
          (value): QueryNode => ({ kind: "leaf", field, value, label }),
        );
        return children.length === 1 ? children[0]! : { kind: "and", children };
      }

      return { kind: "leaf", field, value: operand, label };
    }

    const pending = PENDING_OPERATORS[name];
    if (pending) {
      note("operator-pending", `${name}: ${pending}.`);
      return null;
    }

    note(
      "operator-unknown",
      `${name}: is not an operator here. Supported: name, text (o), type (class), trait, keyword, artist (a), flavour (ft), set, rarity, pitch, cost, power, defence, year, date, order, dir, unique, display, and legal/banned/suspended/restricted with a format.`,
    );
    return toLeaf({ kind: "term", value: operandRaw, quoted: false });
  };

  /*
    `order:` AND `dir:` ARE OPTIONS ON THE QUERY, NOT TERMS IN IT, so they are
    taken out of the token stream before the tree is built rather than handled
    as leaves. A leaf has to match or not match a card; "sort by cost" does
    neither, and leaving it in would make `order:cost` a text search for the
    literal string on every card that does not carry it.

    Taken out WHEREVER THEY APPEAR, including inside parentheses. `(dominate or
    order:cost)` is not a meaningful thing to have written — an ordering does
    not belong to one branch of an or — so it is applied to the whole query and
    the group is evaluated without it.
  */
  let sortKey: CardSortKey | null = null;
  let sortDirection: CardSort["direction"] = "asc";
  /* `unique:` is the third option, and it is one for the same reason the other
     two are: "one row per name" is not a property a card can have, so it can
     never be a leaf. */
  let unique: CardUniqueMode = "names";
  /* `null` rather than `"grid"`, and the distinction is load-bearing: the
     component has to tell "the reader asked for the default" from "the reader
     said nothing", because only the second may be overridden by the legacy
     `?display=` parameter that predates this operator. */
  let display: CardDisplayMode | null = null;

  const remaining = tokenise(raw).filter((token) => {
    if (token.kind !== "field") return true;
    if (
      token.field !== "order" &&
      token.field !== "dir" &&
      token.field !== "unique" &&
      token.field !== "display"
    ) {
      return true;
    }

    if (token.compare !== undefined) {
      note(
        "operator-unknown",
        `${token.field}${token.compare}: names an ordering, so there is nothing to compare. Use ${token.field}:${token.field === "dir" ? "desc" : "cost"}.`,
      );
      return false;
    }

    const operand = token.value.toLowerCase();

    if (token.field === "display") {
      const mode = DISPLAY_MODES[operand];
      if (mode === undefined) {
        note(
          "operand-unknown",
          `display:${token.value} is not a way to show results. The three are grid, list and text.`,
        );
      } else {
        display = mode;
      }
      return false;
    }

    if (token.field === "unique") {
      const mode = UNIQUE_MODES[operand];
      if (mode === undefined) {
        note(
          "operand-unknown",
          `unique:${token.value} is not a level to collapse at. The three are names, cards and art.`,
        );
      } else {
        unique = mode;
      }
      return false;
    }

    if (token.field === "dir") {
      if (operand === "asc" || operand === "desc") sortDirection = operand;
      else {
        note(
          "operand-unknown",
          `dir:${token.value} is not a direction. The two are asc and desc.`,
        );
      }
      return false;
    }

    const key = SORT_KEYS[operand];
    if (key === undefined) {
      note(
        "operand-unknown",
        `order:${token.value} names nothing this can sort by. The seven are ${[...new Set(Object.values(SORT_KEYS))].join(", ")}.`,
      );
      return false;
    }

    sortKey = key;
    return false;
  });

  const tree = parse(remaining, toLeaf);

  /*
    AN ORDERING IS NOT A QUERY. `order:cost` on its own leaves nothing to
    match, so the tree is empty and the page shows no results — which looks
    identical to a search that found none, and is the silent failure this
    project's own rules forbid. Said out loud instead.
  */
  if (sortKey !== null && tree === null) {
    note(
      "operand-unknown",
      `order:${sortKey} says how to arrange results, not which ones to find. Add something to search for.`,
    );
  }

  /*
    `terms` and `filters` are DERIVED from the tree rather than collected
    alongside it, so the list the interface shows and the expression the engine
    evaluates cannot describe different queries.
  */
  const all = tree === null ? [] : leaves(tree);
  const terms = [
    ...new Set(
      all.filter((leaf) => leaf.field === "any").map((leaf) => leaf.value),
    ),
  ];
  const filters: CardFilter[] = all
    .filter((leaf) => leaf.field !== "any")
    .map((leaf) => toCardFilter(leaf));

  return {
    terms,
    filters,
    notices,
    sort: { key: sortKey, direction: sortDirection },
    unique,
    display,
    folded: fold(raw),
    tree,
  };
}

/** A leaf, in the shape the interface has always described a filter in. */
function toCardFilter(leaf: QueryLeaf): CardFilter {
  if (leaf.field === "state") {
    const [formatIndex = "0", bit = "0"] = leaf.value.split(":");
    return {
      field: "state",
      value: leaf.value,
      formatIndex: Number(formatIndex),
      bit: Number(bit),
      label: leaf.label,
    };
  }
  return {
    field: leaf.field as CardFilter["field"],
    value: leaf.value,
    label: leaf.label,
  };
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
function passesFilter(
  index: CardIndex,
  ordinal: number,
  filter: CardFilter,
): boolean {
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
    case "artist":
      return valuesMatch(index.artists[ordinal] ?? [], filter.value);
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

/**
 * A printed stat compared against a number.
 *
 * ONLY NUMERIC VALUES TAKE PART, and that is the honest reading rather than a
 * limitation. 4,941 printed costs include `X`, `XX`, `X1` and the empty string;
 * those have no place in an order, so `cost>=3` does not match them. The old
 * engine refused comparisons outright for this reason — a stated partial order
 * is strictly better than no answer, and the notice says which one is being
 * given.
 */
function comparePrinted(
  index: CardIndex,
  ordinal: number,
  leaf: QueryLeaf,
): boolean {
  const [cost = "", power = "", defence = ""] = index.stats[ordinal] ?? [];
  const at = (which: string) =>
    which === "cost" ? cost : which === "power" ? power : defence;

  const printed = at(leaf.field);
  if (!/^\d+$/.test(printed)) return false;

  /*
    A `@`-prefixed value names another printed field on the SAME card rather
    than a literal — `power>defence`. Both sides have to be numeric, for the
    reason the one-sided case already gives: a card printing X has no place in
    an order, and answering as though it were zero would be inventing a fact.
  */
  const other = leaf.value.startsWith("@") ? at(leaf.value.slice(1)) : null;
  if (other !== null && !/^\d+$/.test(other)) return false;

  const actual = Number(printed);
  const wanted = other === null ? Number(leaf.value) : Number(other);
  switch (leaf.compare) {
    case ">":
      return actual > wanted;
    case ">=":
      return actual >= wanted;
    case "<":
      return actual < wanted;
    case "<=":
      return actual <= wanted;
    case "!=":
      return actual !== wanted;
    default:
      return actual === wanted;
  }
}

/**
 * The free words that are being asked FOR, ignoring any under a negation.
 *
 * Ranking says which field put a card on the page, and a term the reader
 * excluded did not put it anywhere — ranking `guardian -attack` by "attack"
 * would report the reason a card was nearly rejected.
 */
function positiveFreeTerms(
  node: QueryNode,
  negated = false,
): readonly string[] {
  switch (node.kind) {
    case "leaf":
      return !negated && node.field === "any" ? [node.value] : [];
    case "not":
      return positiveFreeTerms(node.child, !negated);
    default:
      return node.children.flatMap((child) =>
        positiveFreeTerms(child, negated),
      );
  }
}

/** Cards whose flavour text contains the term, whole word or by prefix. */
function flavourMatches(index: CardIndex, term: string): ReadonlySet<number> {
  const out = new Set<number>();
  for (const candidate of index.flavourTerms) {
    if (candidate !== term && !candidate.startsWith(term)) continue;
    for (const ordinal of index.flavourPostings.get(candidate) ?? [])
      out.add(ordinal);
  }
  return out;
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
  /**
   * The ordering that produced these results.
   *
   * Reported rather than kept private because the interface has to be able to
   * say which order it is showing — a list sorted by cost and a list sorted by
   * relevance look identical until you read them, and a reader who typed
   * `order:` deserves to see it acknowledged.
   */
  readonly sort: CardSort;
  /**
   * The level these results collapse at.
   *
   * Reported for the same reason `sort` is: `unique:art` and the default return
   * different numbers of rows for the same query, and a reader who is told "62
   * results" needs to know whether that counts cards or pictures.
   */
  readonly unique: CardUniqueMode;
  /** The shape asked for, or `null`. Resolved by the caller, not here. */
  readonly display: CardDisplayMode | null;
  readonly results: readonly CardResult[];
  /** Matches found, which may exceed the number returned. */
  readonly total: number;
}

/**
 * Rows rendered at once, absent a choice. The count reported is always the true
 * total, and every row it counts is now reachable — see `./pagination.ts`,
 * which owns the steps a reader can pick and the two URL parameters that carry
 * them. This constant is the default one of those steps, kept at the number it
 * has always been.
 *
 * It used to be a hard cap with "narrow the query" printed under it, which
 * `docs/SCRYFALL-GAP.md` §4 named for what it was: "a refusal where Scryfall
 * paginates. A grid makes it worse — 60 images is under one scroll."
 */
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
  mode: CardUniqueMode = "names",
  /** Set when this row stands for one ALTERNATE art rather than for the card. */
  art?: ArtRef,
): CardResult {
  const printed = index.stats[ordinal] ?? ["", "", ""];
  const slug = index.slugs[ordinal] ?? "";
  const nameSlug = index.nameSlugs[ordinal] ?? slug;
  /*
   * ONLY `unique:names` COLLAPSES, WHICH IS WHAT THE OPERATOR MEANS.
   *
   * This flag decides both the label and the link, so it is the whole of the
   * difference between the modes at the row level: collapsed, the row is the
   * card and wears the bare name; not collapsed, it is one version and wears
   * the pitch qualifier that tells it from its siblings.
   */
  const collapsed = mode === "names" && nameSlug !== slug;

  /**
   * A PARTIAL MATCH MUST LAND ON A VERSION THAT MATCHED.
   *
   * `/card/<nameSlug>` renders the LOWEST-PITCH version. When every version
   * matched, that is fine — whichever one opens, the reader's query is true of
   * it. When only some matched, it is a wrong answer of the exact kind this
   * project exists not to give.
   *
   * Measured on the shipped build: `banned:cc` returned four such rows, and on
   * two of them — Bonds of Ancestry and Orb-Weaver Spinneret, banned at pitch 2
   * and 3 and legal at pitch 1 — the reader clicked a result from a BANNED list
   * and arrived at a page reading **Legal**, with nothing on either surface
   * saying the version had changed underneath them.
   *
   * So a partial match links to the best-ranked version that actually matched,
   * whose own slug is `slug`. The row already names the matched pitches, so the
   * tab it opens on is the one the row is talking about, and the other versions
   * are one click away in the strip.
   */
  const partial = matchedPitches.length < totalVersions;

  return {
    // THE BARE NAME WHEN THE ROW STANDS FOR THE WHOLE CARD. Everywhere a row
    // points at ONE version it must render the disambiguated label, or two
    // anchors differ only in where they point. A row that stands for the card
    // carries the bare name, which is unambiguous — and where the row is
    // partial, the version qualifier beside it does the disambiguating.
    /*
     * AN ART ROW SAYS WHICH ART IN ITS LABEL, because two rows for one card
     * differing only in picture are two identical anchors — the exact failure
     * the note above describes for pitch versions, arrived at from the other
     * direction. `ResultRow` takes a plain string for accessibility, so the
     * qualifier has to be in it rather than beside it.
     */
    label:
      art !== undefined
        ? `${index.labels[ordinal] ?? ""} · ${art.key.replace(/\.webp$/, "")}`
        : collapsed
          ? nameOf(index.labels[ordinal] ?? "")
          : (index.labels[ordinal] ?? ""),
    href:
      art !== undefined
        ? `/card/${slug}/${art.setCode}/${art.number}`
        : `/card/${collapsed && !partial ? nameSlug : slug}`,
    matchedPitches,
    totalVersions,
    faceKey: art !== undefined ? art.key : (index.faceKeys[ordinal] ?? null),
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
/**
 * The value a card sorts by, for one key.
 *
 * Returns a number where the key has an order and a string where it has an
 * alphabet, plus a flag for "this card has no value here at all". That third
 * state is the one that matters: a printed cost of `X`, or a card with no
 * defence, is not a zero and must not sort as one.
 */
function sortValue(
  index: CardIndex,
  ordinal: number,
  key: CardSortKey,
): {
  readonly text?: string;
  readonly rank?: number;
  readonly missing: boolean;
} {
  const stat = (position: 0 | 1 | 2) => {
    const raw = index.stats[ordinal]?.[position] ?? "";
    if (raw === "") return { missing: true };
    const numeric = Number(raw);
    return Number.isFinite(numeric)
      ? { rank: numeric, missing: false }
      : { missing: true };
  };

  switch (key) {
    case "name":
      return { text: index.labels[ordinal] ?? "", missing: false };
    case "pitch": {
      const pitch = index.pitches[ordinal] ?? 0;
      return pitch === 0 ? { missing: true } : { rank: pitch, missing: false };
    }
    case "cost":
      return stat(0);
    case "power":
      return stat(1);
    case "defence":
      return stat(2);
    case "rarity": {
      /* A printing-level field on a card-level row: a card sorts by the
         SCARCEST rarity it was ever printed at, because that is the one a
         reader means when they call a card rare. */
      const ranks = (index.rarities[ordinal] ?? [])
        .map((code) => RARITY_RANK[code.toUpperCase()])
        .filter((rank): rank is number => rank !== undefined);
      return ranks.length === 0
        ? { missing: true }
        : { rank: Math.max(...ranks), missing: false };
    }
    case "released": {
      /* THE EARLIEST DATE, which is when the card came out — a reprint is not a
         release. `released` is stored ascending, so the first entry is it.

         Compared as TEXT rather than parsed: `YYYY-MM-DD` sorts correctly as a
         string, and a Date would introduce a timezone to a value that has none.

         Missing where every set the card appears in is undated, which is 17 of
         118 sets — the judge, organised-play and promo lines. Those sort last
         in both directions, exactly as an unprinted cost does. */
      const first = index.released[ordinal]?.[0];
      return first === undefined
        ? { missing: true }
        : { text: first, missing: false };
    }
    case "set": {
      /* And by the FIRST set it appeared in, for the same reason in the other
         direction: a card belongs to where it came from, not to the most recent
         reprint that happens to sort last alphabetically. */
      const sets = (index.sets[ordinal] ?? []).toSorted();
      const first = sets[0];
      return first === undefined
        ? { missing: true }
        : { text: first, missing: false };
    }
  }
}

/**
 * Order results by a printed value.
 *
 * TWO RULES CARRY THE WHOLE THING, and both are about honesty rather than
 * ordering.
 *
 * A CARD WITH NO VALUE SORTS LAST, IN BOTH DIRECTIONS. Printed costs in this
 * corpus include `X`, `XX` and blanks; a card with no defence has no defence
 * rather than zero of it. Sorting those to the front under `dir:desc` would be
 * asserting they are the largest, and to the front under `asc` that they are
 * the smallest. They are neither, so they go to the end either way and the
 * direction applies only to the cards that have a value. It is the same
 * decision `cost>=3` already makes by not matching them.
 *
 * CORPUS ORDER IS THE FINAL TIEBREAK, never relevance. Once a reader has asked
 * for cost order, two cards costing 2 are equal and the result has to be
 * STABLE — the same query returning the same page in the same order every time
 * is worth more here than a second opinion about which of them is a better
 * match.
 */
function compareBySort(
  index: CardIndex,
  sort: CardSort,
  a: number,
  b: number,
): number {
  const key = sort.key;
  if (key === null) return 0;

  const left = sortValue(index, a, key);
  const right = sortValue(index, b, key);

  if (left.missing !== right.missing) return left.missing ? 1 : -1;
  if (left.missing) return a - b;

  const sign = sort.direction === "desc" ? -1 : 1;

  if (left.rank !== undefined && right.rank !== undefined) {
    const difference = left.rank - right.rank;
    if (difference !== 0) return sign * difference;
    return a - b;
  }

  const compared = (left.text ?? "").localeCompare(right.text ?? "", "en");
  if (compared !== 0) return sign * compared;
  return a - b;
}

/**
 * Run a card query.
 *
 * `limit` AND `offset` ARE APPLIED LAST, AFTER RANKING, COLLAPSING AND THE
 * `unique:` EXPANSION — which is what makes paging safe on this engine in
 * particular. `unique:names` collapses pitch versions to one row and
 * `unique:art` expands a row per picture, so the number of ROWS is decided long
 * after the number of MATCHES is; slicing any earlier would page over a list
 * that is not the list on screen, and the page boundaries would land in
 * different places depending on which mode was in force.
 *
 * `total` is the length of that final row list, so the count and the pages are
 * two statements about one number.
 *
 * `limit` accepts `Number.POSITIVE_INFINITY`, which is how "show me all of
 * them" reaches here. `slice` clamps it to the length, so no cap survives.
 */
export function searchCards(
  index: CardIndex,
  raw: string,
  limit: number = CARD_RESULT_LIMIT,
  offset = 0,
): CardOutcome {
  const { terms, filters, notices, sort, unique, display, folded, tree } =
    parseCardQuery(raw);

  /*
    SAID HERE RATHER THAN AT PARSE TIME, because only the index knows how many
    cards it cannot date and the parser has never seen it. A notice is the
    engine's way of refusing to answer more confidently than its data allows,
    and `year:`/`date:` is the one operator whose silent misses are invisible:
    the reader gets a plausible list and no reason to suspect it is short.
  */
  const dateFiltered =
    tree !== null && leaves(tree).some((leaf) => leaf.field === "released");
  const withNotices =
    dateFiltered && index.undatedCards > 0
      ? [
          ...notices,
          {
            kind: "coverage-partial" as const,
            /* ENTRIES, NOT CARDS, and the distinction is this corpus's
               oldest units trap: an index row is a pitch version, so the three
               Head Jabs are three entries and one card. The count beside the
               results is in whatever `unique:` mode is active — names by
               default — so calling this one "cards" would put two different
               units side by side and invite the reader to subtract them. */
            text: `${index.undatedCards} card entries are printed only in sets upstream publishes no release date for, so no year: or date: filter can match them. They are excluded rather than guessed at.`,
          },
        ]
      : notices;

  const ranked: { ordinal: number; field: CardMatchField }[] = [];

  if (tree === null) {
    return {
      query: raw,
      terms,
      filters,
      notices: withNotices,
      sort,
      unique,
      display,
      results: [],
      total: 0,
    };
  }

  /*
    TEXT POSTINGS ARE RESOLVED ONCE, BEFORE THE WALK. They are the only lookup
    that is not a linear scan, and the tree can mention the same term more than
    once — `text:strike or name:strike` — so resolving inside the per-card test
    would redo a postings walk 4,941 times per occurrence. Every distinct text
    value becomes a set here, and the leaf test is a membership check.
  */
  const textSets = new Map<string, ReadonlySet<number>>();
  const flavourSets = new Map<string, ReadonlySet<number>>();
  for (const leaf of leaves(tree)) {
    if (leaf.field === "text" || leaf.field === "any") {
      if (!textSets.has(leaf.value))
        textSets.set(leaf.value, textMatches(index, leaf.value));
    }
    if (leaf.field === "flavour" && !flavourSets.has(leaf.value)) {
      flavourSets.set(leaf.value, flavourMatches(index, leaf.value));
    }
  }

  /** Whether one card satisfies one leaf. The corpus half of the grammar. */
  const test = (leaf: QueryLeaf, ordinal: number): boolean => {
    if (leaf.field === "any") {
      // A free word matches the card anywhere it can: the name, the printed
      // type line, a keyword or trait, or the printed text. The TIER it matched
      // in decides ranking, and that is computed separately below.
      return (
        tokensMatch(index.labelTokens[ordinal] ?? [], leaf.value) ||
        tokensMatch(index.typeTokens[ordinal] ?? [], leaf.value) ||
        valuesMatch(index.keywords[ordinal] ?? [], leaf.value) ||
        valuesMatch(index.traits[ordinal] ?? [], leaf.value) ||
        textSets.get(leaf.value)?.has(ordinal) === true
      );
    }

    if (leaf.field === "text")
      return textSets.get(leaf.value)?.has(ordinal) === true;

    /* NOT FOLDED INTO THE FREE-WORD BRANCH ABOVE, deliberately. A bare word
       searches what a card DOES; flavour is what it says about itself, and a
       reader looking for cards that mention blood in their rules text is not
       asking for the one whose flavour quotes a poem about it. `ft:` is opt-in
       for that reason. */
    if (leaf.field === "flavour")
      return flavourSets.get(leaf.value)?.has(ordinal) === true;

    /*
      RELEASE DATES, COMPARED AS TEXT. `YYYY-MM-DD` and `YYYY` both sort
      correctly as strings, so a comparison needs no parsing and introduces no
      timezone to a value that has none. The year grain compares the first four
      characters of each date, which is the same operation the reader means.
    */
    if (leaf.field === "released") {
      const dates = index.released[ordinal] ?? [];
      if (dates.length === 0) return false;

      const grain = leaf.value.length === 4 ? 4 : 10;
      const wanted = leaf.value;
      const at = (date: string) => date.slice(0, grain);

      return dates.some((date) => {
        const value = at(date);
        switch (leaf.compare) {
          case ">":
            return value > wanted;
          case ">=":
            return value >= wanted;
          case "<":
            return value < wanted;
          case "<=":
            return value <= wanted;
          default:
            return value === wanted;
        }
      });
    }

    if (leaf.field === "name-exact") {
      // AGAINST THE BARE NAME, not the disambiguated label. `index.folded`
      // folds "Head Jab (pitch 1)", so `!"Head Jab"` matched nothing at all on
      // the 900 names that carry a variant suffix — which is most of the names
      // anybody would reach for the exact operator to pin down.
      return fold(nameOf(index.labels[ordinal] ?? "")) === leaf.value;
    }

    if (leaf.compare !== undefined) return comparePrinted(index, ordinal, leaf);

    return passesFilter(index, ordinal, toCardFilter(leaf));
  };

  /* The free words, for ranking. A word under a NOT is excluded: a card is not
     ranked by a term the reader asked it NOT to contain. */
  const positiveTerms = positiveFreeTerms(tree);

  for (let ordinal = 0; ordinal < index.size; ordinal += 1) {
    if (!evaluate(tree, ordinal, test)) continue;

    if (positiveTerms.length === 0) {
      ranked.push({ ordinal, field: "filter" });
      continue;
    }

    const nameTokens = index.labelTokens[ordinal] ?? [];
    const typeTokens = index.typeTokens[ordinal] ?? [];
    const vocabulary = (index.keywords[ordinal] ?? []).concat(
      index.traits[ordinal] ?? [],
    );

    const inName = positiveTerms.every((term) => tokensMatch(nameTokens, term));
    const inType = positiveTerms.every((term) => tokensMatch(typeTokens, term));
    const inVocabulary = positiveTerms.every((term) =>
      valuesMatch(vocabulary, term),
    );

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

  /*
    RELEVANCE UNLESS ASKED OTHERWISE. `order:` replaces the ranking rather than
    refining it: a reader who has asked for cost order wants cost order, and
    keeping "name match beats text match" as the primary key would give them a
    list that is only locally sorted and looks broken.
  */
  ranked.sort((a, b) =>
    sort.key === null
      ? FIELD_RANK[a.field] - FIELD_RANK[b.field] || a.ordinal - b.ordinal
      : compareBySort(index, sort, a.ordinal, b.ordinal),
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
  const bestByName = new Map<
    string,
    { ordinal: number; field: CardMatchField }
  >();
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

  /*
    THE OTHER TWO MODES EXPAND WHERE THE DEFAULT COLLAPSES, and they are built
    from `ranked` rather than from `collapsed` — which is the one thing that
    could have gone quietly wrong here. Collapsing first and expanding after
    would have kept only the best-ranked version of each name and then shown
    that one version's arts, so `unique:cards` would have returned exactly as
    many rows as the default and `unique:art` would have silently dropped every
    alternate art belonging to a sibling version.

    Rank order carries through untouched. `ranked` is already sorted, so the
    rows come out in the order the reader asked for, with a card's own picture
    ahead of its alternates because that is the order `arts` is stored in.
  */
  const rows: { ordinal: number; field: CardMatchField; art?: ArtRef }[] = [];
  if (unique === "names") rows.push(...bestByName.values());
  else if (unique === "cards") rows.push(...ranked);
  else {
    for (const row of ranked) {
      rows.push(row);
      for (const art of index.arts[row.ordinal] ?? []) {
        rows.push({ ordinal: row.ordinal, field: row.field, art });
      }
    }
  }

  /*
    A ROW STANDS FOR THE WHOLE NAME ONLY IN `unique:names`. In the other two
    modes it stands for one version, so the "2 of 3 versions matched" note is
    not merely unnecessary — it would be false, since the row no longer speaks
    for the versions it is sitting next to.
  */
  const nameOfRow = (ordinal: number) =>
    index.nameSlugs[ordinal] ?? index.slugs[ordinal] ?? "";

  return {
    query: raw,
    terms,
    filters,
    notices: withNotices,
    sort,
    unique,
    display,
    results: rows.slice(offset, offset + limit).map((row) => {
      const name = nameOfRow(row.ordinal);
      const pitches =
        unique === "names"
          ? (matchedByName.get(name) ?? []).toSorted((a, b) => a - b)
          : [index.pitches[row.ordinal] ?? 0];
      const versions =
        unique === "names"
          ? (index.versionsByName.get(name) ?? 1)
          : pitches.length;

      return toResult(
        index,
        row.ordinal,
        row.field,
        pitches,
        versions,
        unique,
        row.art,
      );
    }),
    total: rows.length,
  };
}
