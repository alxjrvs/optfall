/**
 * Lexical search over the Comprehensive Rules — the index builder that runs at
 * build time, and the query engine that runs in the browser.
 *
 * `docs/PLAN.md`, "Rules that hold across every phase": **no language model in
 * the shipped product.** Nothing here embeds, ranks by a learned model, or
 * composes prose. It is an inverted index and a comparison function, which
 * buys the two properties this project trades on:
 *
 * - **Deterministic.** The same query returns the same results, in the same
 *   order, every time — no floating-point score anywhere in the sort (see
 *   {@link RARITY_WEIGHT}), and every comparison ends in document order, so
 *   there is no tie left for an engine to break differently.
 * - **Explicable.** Every result carries {@link SearchResult.matchedIn} and
 *   {@link SearchResult.matchedTerms}: which field matched, and which indexed
 *   words did it. A user can look at a row and say why it is there, which is
 *   the property a generated answer cannot offer at any quality level.
 *
 * THE SPLIT. {@link buildIndex} runs once, in Astro's frontmatter, at build
 * time. {@link decodeIndex} and {@link search} run in the browser against what
 * it produced. The corpus itself — 651 KB of verbatim rules text — never
 * reaches the client: the index ships what *ranking* needs and one line of
 * context per section, and the full text lives on the permalink page, which is
 * the thing the search exists to send you to.
 */

/* -------------------------------------------------------------------------- */
/* The corpus                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The shape read out of `data/rules/cr-2.14.0.json`.
 *
 * Declared structurally rather than imported from `optfall-rules` on purpose:
 * the site does not depend on the parser package, and should not — the parser
 * is a build-time tool with a PDF extractor behind it, and the site consumes
 * its *output*, which is a committed JSON file. A structural type is the
 * honest description of that relationship, and it is checked against the real
 * file by the build the moment either side moves.
 */
export type RuleLevel = "chapter" | "section" | "rule" | "subrule";

export interface CorpusSection {
  readonly number: string;
  readonly level: RuleLevel;
  readonly title: string | null;
  readonly text: string;
  readonly bullets: readonly string[];
  readonly examples: readonly string[];
  readonly notes: readonly string[];
}

export interface RulesCorpus {
  readonly title: string;
  readonly version: string;
  readonly publishedDateIso: string;
  readonly sourceUrl: string;
  readonly sections: readonly CorpusSection[];
}

/** Namespace on every Comprehensive Rules identifier — `cr:1.0.1a`. */
export const RULE_NAMESPACE = "cr";

/** The permalink for a published section number. `docs/DESIGN.md`, screen 4. */
export function hrefForNumber(number: string): string {
  return `/${RULE_NAMESPACE}/${number}`;
}

/** The citable identifier for a published section number. */
export function idForNumber(number: string): string {
  return `${RULE_NAMESPACE}:${number}`;
}

/* -------------------------------------------------------------------------- */
/* Tokenising                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Words carrying no discriminating power in a rules document.
 *
 * The list is deliberately tiny, and what is *absent* from it is the part
 * worth reading. `may`, `must`, `not`, `before`, `after`, `when`, `each`,
 * `any` and `all` are ordinary English stopwords and are all load-bearing
 * vocabulary in a rules text — "before" and "after" are timing, "may" and
 * "must" are the difference between an option and an obligation. Dropping them
 * would make the most rules-literate queries the ones that work worst.
 *
 * Everything kept here is a word appearing in a majority of sections, which is
 * the same as appearing in none: it cannot separate one section from another.
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
  "been",
  "being",
  "was",
  "were",
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
  "there",
  "their",
  "they",
  "them",
]);

/**
 * The one tokeniser. Build time and query time call this same function, which
 * is what makes a query term and an indexed term comparable at all — two
 * tokenisers that agree today are two tokenisers that will disagree later.
 *
 * Single letters are dropped; single digits are not. "Arcane Barrier 2" is a
 * real thing to search for and `2` is the discriminating half of it.
 */
export function tokenise(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return raw.filter(
    (token) => !STOPWORDS.has(token) && (token.length > 1 || /\d/.test(token)),
  );
}

/** A published section number — `1`, `1.0`, `1.0.1`, `1.0.1a`. */
const SECTION_NUMBER = /^\d+(?:\.\d+)*[a-z]?$/;

export function isSectionNumber(candidate: string): boolean {
  return SECTION_NUMBER.test(candidate);
}

/* -------------------------------------------------------------------------- */
/* The wire format                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The index as it crosses from the build into the page.
 *
 * SIX STRINGS, NOT AN ARRAY OF OBJECTS, and the reason is measurable rather
 * than stylistic. An Astro island's props are JSON-serialised into an HTML
 * attribute, so every `"` in the payload becomes six bytes of `&quot;`. The
 * object-per-section shape carries roughly thirty thousand quotes; this one
 * carries twelve. Same data, and about a third off the page weight before
 * compression even starts.
 *
 * It also gives the format a single owner: {@link buildIndex} writes it,
 * {@link decodeIndex} reads it, and nothing else needs to know that levels are
 * a digit per entry.
 */
export interface EncodedIndex {
  /** Corpus version — `2.14.0`. Displayed, and stamped onto every citation. */
  readonly version: string;
  /** Published numbers, one per line, in document order. */
  readonly numbers: string;
  /** One digit per entry, indexing {@link LEVELS}. */
  readonly levels: string;
  /** Headings, one per line, empty where the section has none. */
  readonly titles: string;
  /** One line of context per section, empty where the section has no prose. */
  readonly ledes: string;
  /**
   * The inverted index: one line per term, `term` then a space, then the
   * ordinals of the sections containing it — ascending, delta-encoded, in base
   * 36, dot-separated. Deltas rather than absolutes because adjacent rules
   * discuss the same subject, so most gaps are 1.
   */
  readonly postings: string;
}

/** Level ordinals, in document hierarchy order. Index = the digit shipped. */
const LEVELS: readonly RuleLevel[] = ["chapter", "section", "rule", "subrule"];

/**
 * How much context travels with a result.
 *
 * One line at the measure, and no more. The whole section is one click away on
 * a page that already exists — shipping the full text would triple the index
 * to duplicate what the permalink is for. It is deliberately the *opening* of
 * the section rather than an excerpt around the match: an excerpt would need
 * term positions in the index, and the honest label for what this is ("the
 * start of the rule") beats a highlighted fragment bought at that price.
 */
const LEDE_LIMIT = 120;

function lede(section: CorpusSection): string {
  const source =
    section.text ||
    section.bullets[0] ||
    section.examples[0] ||
    section.notes[0] ||
    "";
  const flat = source.replace(/\s+/g, " ").trim();
  if (flat.length <= LEDE_LIMIT) return flat;
  const cut = flat.slice(0, LEDE_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Build the shipped index from the parsed corpus. Pure, and run at build time.
 *
 * Postings cover the heading, the prose, the bullets, the examples and the
 * notes — everything the section says. A section is one addressable unit, so
 * matching one part of it is matching it.
 */
export function buildIndex(corpus: RulesCorpus): EncodedIndex {
  const numbers: string[] = [];
  const levels: string[] = [];
  const titles: string[] = [];
  const ledes: string[] = [];
  const postings = new Map<string, number[]>();

  corpus.sections.forEach((section, ordinal) => {
    numbers.push(section.number);
    levels.push(String(LEVELS.indexOf(section.level)));
    titles.push((section.title ?? "").replace(/\s+/g, " ").trim());
    ledes.push(lede(section));

    const searchable = [
      section.title ?? "",
      section.text,
      ...section.bullets,
      ...section.examples,
      ...section.notes,
    ].join(" ");

    for (const term of new Set(tokenise(searchable))) {
      const list = postings.get(term);
      if (list) list.push(ordinal);
      else postings.set(term, [ordinal]);
    }
  });

  // Sorted so the artifact is a function of the corpus alone. Map iteration
  // order is insertion order, which is stable — but it is stable *given the
  // same corpus*, and an index whose byte order tracks the document is an
  // index whose diff is unreadable the first time a rule moves.
  const lines = [...postings.entries()]
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

  return {
    version: corpus.version,
    numbers: numbers.join("\n"),
    levels: levels.join(""),
    titles: titles.join("\n"),
    ledes: ledes.join("\n"),
    postings: lines.join("\n"),
  };
}

/* -------------------------------------------------------------------------- */
/* The decoded index                                                           */
/* -------------------------------------------------------------------------- */

/** The index as the query engine uses it. Built once, on island start-up. */
export interface SearchIndex {
  readonly version: string;
  readonly numbers: readonly string[];
  readonly levels: readonly RuleLevel[];
  readonly titles: readonly string[];
  readonly ledes: readonly string[];
  /** Term to ascending section ordinals. */
  readonly postings: ReadonlyMap<string, readonly number[]>;
  /** Terms in ascending order, so prefix expansion is a single scan. */
  readonly terms: readonly string[];
  /** Published number to ordinal, for the identifier lookup. */
  readonly byNumber: ReadonlyMap<string, number>;
  readonly size: number;
}

export function decodeIndex(encoded: EncodedIndex): SearchIndex {
  const numbers = encoded.numbers.split("\n");
  const titles = encoded.titles.split("\n");
  const ledes = encoded.ledes.split("\n");
  const levels = [...encoded.levels].map(
    (digit) => LEVELS[Number(digit)] ?? "subrule",
  );

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

  const byNumber = new Map<string, number>();
  numbers.forEach((number, ordinal) => {
    byNumber.set(number, ordinal);
  });

  return {
    version: encoded.version,
    numbers,
    levels,
    titles,
    ledes,
    postings,
    terms: [...postings.keys()],
    byNumber,
    size: numbers.length,
  };
}

/* -------------------------------------------------------------------------- */
/* The query language                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Operators from `docs/DESIGN.md`'s grammar that this corpus cannot answer
 * yet, and what each is waiting on.
 *
 * They are named rather than ignored because silence is the worse failure:
 * `pitch:3` typed into a field that quietly searched for the literal word
 * "pitch" would return rules about pitching cards and look like it worked.
 * The design's own rule is that an operator must "feel like it was always part
 * of the same language" — a language that answers a question it does not
 * understand is the one thing that breaks that feeling for good.
 */
const PENDING_OPERATORS: Readonly<Record<string, string>> = {
  // These seven searched nothing when this table was written, and the wording
  // said so. The card layer answers them now, so the sentence changed the day
  // it landed: an operator that WORKS ELSEWHERE is a redirection, not a
  // pending feature, and describing it as unbuilt would be the same lie in the
  // other direction. `docs/PLAN.md`, "degrade visibly".
  pitch: "searches cards, which live at /",
  class: "searches cards, which live at /",
  type: "searches cards, which live at /",
  set: "searches cards, which live at /",
  rarity: "searches cards, which live at /",
  cost: "searches cards, which live at /",
  name: "searches cards, which live at /",
  text: "searches printed card text, which lives at /cards",
  banned: "filters cards by present-day legality, which lives at /cards",
  // `legal:` alone is answerable at /cards; `legal:cc@2026-03-14` is not
  // answerable anywhere yet, and that is the half worth naming here.
  legal:
    "filters cards by present-day legality at /cards; legality as of a date is not published yet",
  format: "answers legality as of a date, which is not published yet",
  is: "filters judge-verified rulings, which are not published yet",
  changed: "lists what a rules version touched, which is not published yet",
};

/**
 * Something the query said that the engine did not act on, in a complete
 * sentence.
 *
 * The wording lives here rather than in the component on purpose: these are
 * statements about how the *engine* behaved, and a surface that phrased them
 * itself would be free to phrase them wrongly. It is also the whole of the
 * error vocabulary — a query never silently does something other than what it
 * says.
 */
export interface QueryNotice {
  readonly kind:
    | "operator-pending"
    | "operator-unknown"
    | "term-ignored"
    | "phrase-approximate";
  readonly text: string;
}

export interface ParsedQuery {
  /** Effective search terms, deduplicated, in the order typed. */
  readonly terms: readonly string[];
  /** Section numbers to resolve directly — `1.0.1a`, from `cr:1.0.1a` or bare. */
  readonly ids: readonly string[];
  readonly notices: readonly QueryNotice[];
}

/** Splits on whitespace, keeping `"quoted groups"` whole. */
function chunk(
  raw: string,
): { readonly value: string; readonly quoted: boolean }[] {
  const out: { value: string; quoted: boolean }[] = [];
  for (const match of raw.matchAll(/"([^"]*)"|(\S+)/g)) {
    const quoted = match[1] !== undefined;
    const value = (quoted ? match[1] : match[2]) ?? "";
    if (value.trim() !== "") out.push({ value, quoted });
  }
  return out;
}

/**
 * Parse the query string into terms and identifiers.
 *
 * The `cr:` operator is `docs/DESIGN.md`'s own — "search the Comprehensive
 * Rules … as first-class objects". The Comprehensive Rules are the only corpus
 * that exists today, so `cr:dominate` and `dominate` return the same thing;
 * writing the operator is how the query keeps working unchanged on the day
 * tournament policy and the penalty guide land beside it and a bare word means
 * "all three". That is the point of adopting a grammar rather than inventing
 * one: the query someone learns today is not retired by tomorrow's corpus.
 */
export function parseQuery(raw: string): ParsedQuery {
  const terms: string[] = [];
  const ids: string[] = [];
  const notices: QueryNotice[] = [];
  const seenTerm = new Set<string>();
  const seenNotice = new Set<string>();

  const note = (kind: QueryNotice["kind"], text: string) => {
    const key = `${kind}:${text}`;
    if (seenNotice.has(key)) return;
    seenNotice.add(key);
    notices.push({ kind, text });
  };

  const addWords = (source: string) => {
    const kept = tokenise(source);
    for (const term of kept) {
      if (seenTerm.has(term)) continue;
      seenTerm.add(term);
      terms.push(term);
    }
    // Report what was thrown away, so a query that returns nothing explains
    // itself rather than looking broken. The two reasons a word is dropped are
    // different enough to be worth separate sentences: one is about the word,
    // the other is about how much of it has been typed.
    const dropped = (source.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
      (token) => !kept.includes(token),
    );
    for (const word of new Set(dropped)) {
      note(
        "term-ignored",
        STOPWORDS.has(word)
          ? `“${word}” is in most sections of the document, so it cannot narrow anything. Ignored.`
          : `“${word}” is a single letter — too short to search on. Ignored.`,
      );
    }
  };

  /**
   * Route a chunk to either the section-number jump or the text search.
   *
   * A BARE NUMBER IS ONLY AN IDENTIFIER WHEN IT LOOKS LIKE ONE. An earlier
   * version sent anything matching the section-number shape to `ids`, which
   * meant a lone digit anywhere in a query was swallowed as a jump: "arcane
   * barrier 2" parsed to terms ["arcane","barrier"] and ids ["2"], and the
   * chapter-2 tier then placed roughly 150 sections numbered `2.*` ahead of
   * every text match — filling the whole result limit, so the rows the user
   * actually wanted were unreachable.
   *
   * That also contradicted this file's own tokeniser contract, which states
   * that single digits are deliberately kept because "Arcane Barrier 2" is a
   * real thing to search for and `2` is the discriminating half of it. The
   * tokeniser was right; the routing above it was throwing the digit away
   * before `tokenise` ever saw it.
   *
   * So a bare token counts as an identifier only when it is unambiguous:
   * it carries a `.` or a letter suffix (`8.3.4b`, `1.0`), or it is the entire
   * query (typing "2" alone plainly means chapter 2). Otherwise it is a search
   * term like any other.
   */
  const addValue = (value: string, soleChunk: boolean) => {
    const trimmed = value.trim();
    const looksStructural = /[.a-z]/i.test(trimmed);

    if (
      isSectionNumber(trimmed) &&
      (looksStructural || soleChunk) &&
      !ids.includes(trimmed)
    ) {
      ids.push(trimmed);
      return;
    }
    addWords(value);
  };

  const chunks = chunk(raw);
  // A lone chunk means the whole query is that token, which is the only case
  // where a bare number unambiguously means "jump to this section".
  const soleChunk = chunks.length === 1;

  for (const { value, quoted } of chunks) {
    if (quoted) {
      note(
        "phrase-approximate",
        `“${value.trim()}” is matched word by word. The index carries no word positions, so adjacency is not checked.`,
      );
      addWords(value);
      continue;
    }

    const operator = /^([a-zA-Z][a-zA-Z-]*):(.*)$/.exec(value);
    if (!operator) {
      addValue(value, soleChunk);
      continue;
    }

    const name = (operator[1] ?? "").toLowerCase();
    const operand = operator[2] ?? "";

    if (name === RULE_NAMESPACE) {
      // `cr:2` is an explicit request for a section, so the operand is always
      // treated as an identifier regardless of how many chunks there are.
      if (operand.trim() !== "") addValue(operand, true);
      continue;
    }

    const pending = PENDING_OPERATORS[name];
    if (pending) {
      note("operator-pending", `${name}: ${pending}.`);
      continue;
    }

    note(
      "operator-unknown",
      `${name}: is not an operator here. Supported today: cr: for the Comprehensive Rules.`,
    );
    addWords(operand);
  }

  return { terms, ids, notices };
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Which field put a result on the page. This is the ranking, in order.
 *
 * ── THE RANKING, AND WHY IT IS THIS ────────────────────────────────────────
 *
 * 1. `id` — **the number you typed.** `1.0.1a` is not a search, it is a
 *    destination, and typing an identifier into a field that made you pick it
 *    out of a list of eleven prose matches would be the single most annoying
 *    thing this page could do. A judge who knows the number is the user this
 *    whole phase exists for.
 * 2. `children` — **the sections under the number you typed.** `1.0.1` yields
 *    `1.0.1a`, `1.0.1b`. The hierarchy is LSS's own, so a partial number is a
 *    legitimate way to ask for a branch of it, in document order because that
 *    is the order the document argues in.
 * 3. `title` — **every word you typed is in the heading.** A section *called*
 *    "Attack Reactions" outranks eighty subrules that mention attack
 *    reactions, and the corpus makes this cheap: 96 of 1,278 sections carry a
 *    heading, so a title match is close to a hand-curated answer.
 * 4. `text` — **every word you typed is somewhere in the section.**
 *
 * Matching is AND, never OR. Adding a word must narrow the result set, because
 * that is what a person adding a word is trying to do; an OR engine rewards
 * typing more with more noise and there is no way to reason your way out of
 * it. Every term must appear, in the heading or the body, or the section is
 * not a result at all.
 *
 * Within tiers 3 and 4 the comparison is, in order:
 *
 * a. **Exact words before prefix expansions.** `go` finds `gold` because
 *    prefix matching is what makes the field work while you type; a section
 *    that literally says `go` should not lose to one that says `Goldkiss`.
 * b. **{@link rarityWeight}** — the rarer word carries the result, so in
 *    `attack dominate` it is `dominate` that decides the order.
 * c. **Earliest position in the text shown.** This is the one that turns a
 *    word search into a definition lookup: section 8.3.4 opens "Dominate
 *    Dominate is a static ability…", so the section *defining* the keyword
 *    beats the three subrules qualifying it and the eight rules mentioning it,
 *    without a hand-maintained list of keywords anywhere. It costs no index
 *    space, because the line it measures is the line already being displayed —
 *    which also makes it the tier a reader can verify by looking at the row.
 * d. **Document order**, which is total — so no comparison is ever left for
 *    the engine's sort to settle.
 */
export type MatchField = "id" | "children" | "title" | "text";

const FIELD_RANK: Readonly<Record<MatchField, number>> = {
  id: 0,
  children: 1,
  title: 2,
  text: 3,
};

/**
 * Rarity, as an integer, on purpose.
 *
 * The textbook weight is inverse document frequency — a logarithm, and
 * therefore a float, and therefore a sort key whose last bits are an engine's
 * business rather than ours. `size - df` is monotone in exactly the same
 * direction (a word in 4 sections beats a word in 400) and is an integer, so
 * two browsers cannot order the same query differently. Determinism is a
 * headline promise of this page; it should not rest on `Math.log`.
 */
function rarityWeight(size: number, df: number): number {
  return size - df;
}

export interface SearchResult {
  readonly number: string;
  /** `cr:1.0.1a` — the citable identifier. */
  readonly id: string;
  readonly href: string;
  readonly level: RuleLevel;
  readonly title: string;
  readonly lede: string;
  /** Which tier of the ranking above put this row here. */
  readonly matchedIn: MatchField;
  /** The indexed words that matched, so the row can explain itself. */
  readonly matchedTerms: readonly string[];
}

export interface SearchOutcome {
  readonly query: string;
  readonly terms: readonly string[];
  readonly ids: readonly string[];
  readonly notices: readonly QueryNotice[];
  readonly results: readonly SearchResult[];
  /** Matches found, which may exceed the number returned. */
  readonly total: number;
}

/**
 * Rows rendered at once, absent a choice. The count reported is always the true
 * total, and every row it counts is now reachable — see `./pagination.ts`,
 * which owns the steps a reader can pick and the two URL parameters that carry
 * them. This constant is the default one of those steps, kept at the number it
 * has always been.
 */
export const RESULT_LIMIT = 60;

interface Accumulator {
  ordinal: number;
  /** Rarity weight earned by each query term, or -1 where it did not match. */
  weights: number[];
  /** Whether each query term matched as a whole word rather than a prefix. */
  exactAt: boolean[];
  terms: Set<string>;
}

/**
 * Where in the displayed text the first query term appears — the (c) key of
 * the ranking above. `Number.MAX_SAFE_INTEGER` when none of them appears in
 * it, which is the honest answer: the section matched somewhere further in,
 * and it sorts behind everything that matched in view.
 *
 * `\b` rather than a bare `indexOf` so `chain` scores against "chain link" and
 * not against "unchained" — the same whole-word-or-prefix rule the index uses,
 * applied to the one string that is not in the index.
 *
 * The patterns are compiled once per query rather than once per row: this runs
 * over every matching section on every keystroke, and `xyz` matches 1,278 of
 * them.
 */
function firstPosition(haystack: string, patterns: readonly RegExp[]): number {
  const text = haystack.toLowerCase();
  let best = Number.MAX_SAFE_INTEGER;
  for (const pattern of patterns) {
    const found = pattern.exec(text);
    if (found && found.index < best) best = found.index;
  }
  return best;
}

/**
 * Expand one query term to the indexed terms it matches.
 *
 * A term matches a whole word and any word beginning with it, which is one
 * rule doing two jobs: it makes the field usable while you are still typing,
 * and it handles English inflection without a stemmer — `cost` finds `costs`
 * and `costed` without the guesswork a stemmer does on `arms`. It never
 * matches inside a word (`ost` does not find `cost`), which keeps the rule
 * something a person can state.
 */
function expand(index: SearchIndex, term: string): string[] {
  const out: string[] = [];
  for (const candidate of index.terms) {
    if (candidate === term || candidate.startsWith(term)) out.push(candidate);
  }
  return out;
}

function toResult(
  index: SearchIndex,
  ordinal: number,
  matchedIn: MatchField,
  matchedTerms: readonly string[],
): SearchResult {
  const number = index.numbers[ordinal] ?? "";
  return {
    number,
    id: idForNumber(number),
    href: hrefForNumber(number),
    level: index.levels[ordinal] ?? "subrule",
    title: index.titles[ordinal] ?? "",
    lede: index.ledes[ordinal] ?? "",
    matchedIn,
    matchedTerms,
  };
}

/**
 * Run a query. Pure: same index and same string, same array, every time.
 *
 * `limit` AND `offset` ARE APPLIED LAST, AFTER RANKING, and that ordering is
 * the correctness argument for paging rather than a detail of it: every page
 * comes off ONE ranked list, so a row cannot appear on two pages, cannot fall
 * between them, and cannot be ranked differently because of which page it
 * landed on. `total` counts the list before either is applied, so it stays what
 * it always was — the true number of matches.
 *
 * `limit` accepts `Number.POSITIVE_INFINITY`, which is how "show me all of
 * them" reaches here. `slice` clamps it to the length, so no cap survives.
 */
export function search(
  index: SearchIndex,
  raw: string,
  limit: number = RESULT_LIMIT,
  offset = 0,
): SearchOutcome {
  const { terms, ids, notices } = parseQuery(raw);
  const ordered: SearchResult[] = [];
  const placed = new Set<number>();

  const place = (
    ordinal: number,
    field: MatchField,
    matchedTerms: readonly string[],
  ) => {
    if (placed.has(ordinal)) return;
    placed.add(ordinal);
    ordered.push(toResult(index, ordinal, field, matchedTerms));
  };

  /* Tier 1 and 2 — the identifier and its branch. */
  for (const wanted of ids) {
    const exact = index.byNumber.get(wanted);
    if (exact !== undefined) place(exact, "id", [wanted]);
  }
  for (const wanted of ids) {
    index.numbers.forEach((number, ordinal) => {
      if (number.length <= wanted.length || !number.startsWith(wanted)) return;
      // `1.0.1` is the parent of `1.0.1a` and of `1.0.10`; only the first is a
      // child of it. The next character has to open a new level.
      const next = number[wanted.length] ?? "";
      if (next !== "." && !/[a-z]/.test(next)) return;
      place(ordinal, "children", [wanted]);
    });
  }

  /* Tiers 3 and 4 — the words. */
  if (terms.length > 0) {
    const hits = new Map<number, Accumulator>();
    const patterns = terms.map((term) => new RegExp(`\\b${term}`));

    terms.forEach((term, position) => {
      for (const indexed of expand(index, term)) {
        const docs = index.postings.get(indexed) ?? [];
        const weight = rarityWeight(index.size, docs.length);
        const isExact = indexed === term;
        for (const ordinal of docs) {
          let hit = hits.get(ordinal);
          if (!hit) {
            hit = {
              ordinal,
              weights: terms.map(() => -1),
              exactAt: terms.map(() => false),
              terms: new Set<string>(),
            };
            hits.set(ordinal, hit);
          }
          hit.terms.add(indexed);
          // An exact match settles the weight for that term. Without this, a
          // section containing both `go` and `goldkiss` would be scored on the
          // rarity of `goldkiss` — a prefix expansion inflating a result above
          // the sections that actually say the word typed.
          if (isExact) {
            hit.weights[position] = weight;
            hit.exactAt[position] = true;
          } else if (
            !hit.exactAt[position] &&
            weight > (hit.weights[position] ?? -1)
          ) {
            hit.weights[position] = weight;
          }
        }
      }
    });

    const scored = [...hits.values()]
      .filter((hit) => hit.weights.every((weight) => weight >= 0))
      .map((hit) => {
        const title = index.titles[hit.ordinal] ?? "";
        const titleTokens = tokenise(title);
        const inTitle =
          titleTokens.length > 0 &&
          terms.every((term) =>
            titleTokens.some(
              (token) => token === term || token.startsWith(term),
            ),
          );
        const field: MatchField = inTitle ? "title" : "text";
        const shown =
          title === ""
            ? (index.ledes[hit.ordinal] ?? "")
            : `${title} ${index.ledes[hit.ordinal] ?? ""}`;
        return {
          hit,
          field,
          exact: hit.exactAt.filter(Boolean).length,
          weight: hit.weights.reduce((sum, value) => sum + value, 0),
          position: firstPosition(shown, patterns),
        };
      })
      .toSorted(
        (a, b) =>
          FIELD_RANK[a.field] - FIELD_RANK[b.field] ||
          b.exact - a.exact ||
          b.weight - a.weight ||
          a.position - b.position ||
          a.hit.ordinal - b.hit.ordinal,
      );

    for (const row of scored) {
      place(row.hit.ordinal, row.field, [...row.hit.terms].toSorted());
    }
  }

  return {
    query: raw,
    terms,
    ids,
    notices,
    results: ordered.slice(offset, offset + limit),
    total: ordered.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Browsing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The nine chapters, for the empty state.
 *
 * A search page with nothing in the field should not be a blank rectangle: the
 * chapter list is the table of contents, it is already in the index, and it
 * costs nothing to render. It is also the honest answer to "what is in here",
 * which a hint line alone cannot give.
 */
export function chapters(index: SearchIndex): readonly SearchResult[] {
  const out: SearchResult[] = [];
  index.levels.forEach((level, ordinal) => {
    if (level === "chapter") out.push(toResult(index, ordinal, "title", []));
  });
  return out;
}
