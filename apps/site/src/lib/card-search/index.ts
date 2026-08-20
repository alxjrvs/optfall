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
 * THE SPLIT. {@link buildCardIndex} runs once at build time, in
 * `ssg/searchIndexes.ts`, over the same {@link CardPage} objects the card pages
 * themselves render — so the search and the page cannot disagree about a card's
 * slug, its label or its legality. {@link decodeCardIndex} and
 * {@link searchCards} run in the browser against what it produced.
 * The 18 MB corpus never reaches a client.
 *
 * IT USED TO RUN IN THE PAGE MODULE, and moving it changed one thing worth
 * knowing: the encoded index is written to a content-hashed file and FETCHED by
 * the island, rather than travelling inside `/search`'s HTML. So
 * {@link decodeCardIndex} runs against a parsed response rather than against a
 * prop, and the island has a state it did not have before — an index that has
 * not arrived yet, which is not the same as a query with no matches.
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

/**
 * ---
 *
 * **THIS FILE IS THE BARREL.** What is documented above was 3,221 lines in one
 * file. It is now one module per section, split on the section banners the
 * original already carried — so the seams are the ones its author drew, not
 * ones chosen afterwards:
 *
 * | Module | Was | Runs at |
 * |---|---|---|
 * | `wire.ts` | The wire format | both |
 * | `tokenise.ts` | Tokenising | both |
 * | `build.ts` | Building | **build only** |
 * | `decode.ts` | The decoded index | client |
 * | `grammar.ts` | The query language | client |
 * | `match.ts` | Matching | client |
 * | `rank.ts` | Ranking, and `searchCards` | client |
 *
 * Every existing import of `./card-search` resolves to this file, so no call
 * site changed.
 *
 * THE BUILD/CLIENT COLUMN IS WHY THE SPLIT IS WORTH HAVING, AND IT IS NOT
 * ENFORCED BY THE IMPORT GRAPH. `printings.ts` states the rule: anything an
 * island imports must not reach `cards.ts`. That was prose spread over 3,221
 * lines, and it is now at least locatable — `build.ts` is the only
 * corpus-adjacent module and `ssg/searchIndexes.ts` is its only caller. (It was
 * `pages/search.page.tsx` until the index moved out of that page's markup and
 * into a file the island fetches.)
 *
 * Be exact about what that buys, though. This barrel `export *`s every module,
 * `./build` included, and `islands/CardSearch.tsx` imports from the barrel — so
 * an island CAN reach the build-only module through it. Nothing structural
 * stops that.
 *
 * What keeps the corpus out of the bundle is tree-shaking, guarded by
 * `assertIslandBudget` in `ssg/build.ts` (400 kB; the bundle is 279 kB).
 * Measured on the built output: `assertFormatsAgree` and `encodePostings`
 * appear zero times in it. To make the guarantee structural rather than
 * measured, import the client modules directly from the island and stop
 * re-exporting `./build` here.
 *
 * It is not a decorative concern: a value import from `./cards` once shipped a
 * 9.28 MB bundle to every reader.
 */

/*
 * NAMED RE-EXPORTS, NOT `export *`, AND THE DIFFERENCE IS THE POINT.
 *
 * Splitting the file forced sixteen symbols that had been private to it —
 * `encodePostings`, `passesFilter`, `TONE_BIT`, `fold` and the rest — to be
 * exported so they could cross a module boundary. An `export *` barrel would
 * have republished every one, taking this module's public surface from 23
 * names to 39 and letting a caller couple to an internal that became reachable
 * only by accident of where the file was cut.
 *
 * The list below is exactly the 23 names the single file exported. The split
 * is invisible from outside: same surface, same import specifier.
 */

export type { EncodedCardIndex } from "./wire";
export { tokeniseCard } from "./tokenise";
export { buildCardIndex } from "./build";
export type { CardIndexSource } from "./build";
export { decodeCardIndex } from "./decode";
export type { ArtRef, CardIndex } from "./decode";
export { FORMAT_NAMES, parseCardQuery } from "./grammar";
export type {
  CardDisplayMode,
  CardFilter,
  CardNotice,
  CardSort,
  CardSortKey,
  CardUniqueMode,
  ParsedCardQuery,
} from "./grammar";
export { CARD_RESULT_LIMIT, STAT_LABELS, searchCards } from "./rank";
export type {
  CardMatchField,
  CardOutcome,
  CardResult,
  CardResultVersion,
} from "./rank";
