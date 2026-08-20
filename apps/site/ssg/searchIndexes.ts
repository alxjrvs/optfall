/**
 * The search indexes, as FILES the browser fetches rather than markup it parses.
 *
 * THE PROBLEM, IN ONE NUMBER PER PAGE. An island's props cross into the page as
 * JSON in a `data-props` attribute — see `Island.tsx`, which explains why that
 * is the only channel a static site has. That is the right mechanism for a row
 * of cards and the wrong one for a whole index: measured on `main`, `/cr`
 * carried **204,137 bytes** of encoded rules index inside its HTML, and
 * `/search` carried **909,626 bytes** of encoded card index inside its.
 *
 * IT IS NOT THE SIZE THAT SETTLES IT, IT IS WHICH CACHE THE BYTES LAND IN, and
 * that is the argument worth keeping. `serviceWorker.ts` precaches hashed
 * assets and serves pages `NetworkFirst`, dropping the page cache whenever a new
 * worker activates — so an index living inside a document is re-fetched after
 * every deploy, cannot be shared between two documents, and cannot be revalidated
 * separately from the page that carries it. The same bytes under a
 * content-hashed URL are fetched once, kept until their content changes, and
 * addressed by a name that changes only when they do.
 *
 * SO THE HASH IS THE POINT, AND IT IS COMPUTED HERE RATHER THAN READ FROM VITE.
 * `build.ts` states the rule this appears to break — "A HASHED FILENAME MUST BE
 * READ, NEVER CONSTRUCTED" — and that rule is about files VITE emits, where
 * guessing a name means linking a stylesheet that does not exist. Nothing here
 * is guessed: this module computes the digest, derives the path from it, and
 * hands the SAME object to the writer (`assets.ts`) and to the page that links
 * it. There is one declaration, so there is nothing for a second one to drift
 * from — which is the property the rule in `build.ts` exists to protect, reached
 * the other way round.
 *
 * WHAT MAY LIVE HERE. Anything that reads a corpus. This module is imported by
 * the BUILD and by PAGE MODULES, never by an island — `assets.ts` reaches it
 * through a dynamic import for that reason, and the island bundle reaches it not
 * at all. A value import of anything corpus-shaped from a file the client
 * bundle can see is the failure `build.ts`'s island budget exists to catch, and
 * it has already shipped a 9.28 MB bundle once.
 */

import { createHash } from "node:crypto";

/*
 * `CORPUS`, NOT THE RAW JSON. `src/lib/rules.ts` owns reading
 * `data/rules/cr-2.14.0.json` and asserting its shape once; six files were
 * importing the file and casting it themselves until that was consolidated, and
 * a seventh added here would have re-opened it. The corpus has one reader.
 *
 * ALIASED, BECAUSE THIS MODULE WILL HOLD TWO CORPORA. `src/lib/cards.ts` exports
 * a `CORPUS` of its own — the card one — and the card index is built here beside
 * this. Two bare `CORPUS` imports is a redeclaration; two spelled ones is a file
 * that says which corpus it means at every use.
 */
import { CORPUS as RULES_CORPUS } from "../src/lib/rules";
import {
  buildIndex,
  chapters,
  decodeIndex,
  type EncodedIndex,
  type SearchResult,
} from "../src/lib/search";

/**
 * One index, as the four things its two consumers between them need.
 *
 * `encoded` NEVER CROSSES TO A PAGE, and the type is the only thing saying so.
 * It is here because the build-time consumers — the chapter browse below, and
 * anything that wants to assert against the index without re-deriving it — hold
 * the decoded shape, while the page holds only `url`. Handing a page `encoded`
 * would put the bytes straight back into the attribute this file exists to empty.
 */
export interface SearchIndexAsset<Encoded> {
  /** The index itself. Build-time only. */
  readonly encoded: Encoded;
  /** Path under the output root, no leading slash. `assets.ts` writes it. */
  readonly path: string;
  /** The address a page links and an island fetches. */
  readonly url: string;
  /** The bytes at that address. */
  readonly contents: string;
}

/**
 * The digest length, and why eight hex characters is enough.
 *
 * This is a cache key, not a signature. It has to change when the content
 * changes and stay put when it does not; it does not have to resist anybody,
 * because nothing downstream trusts the name. Eight characters is 32 bits over a
 * corpus with two entries in it, which is the same trade every bundler makes and
 * for the same reason.
 */
const DIGEST_LENGTH = 8;

/**
 * A named index, hashed into its own address.
 *
 * THE JSON IS SERIALISED ONCE AND HASHED FROM THE SERIALISATION, rather than
 * hashing the object and serialising separately. Two passes over a 900 kB
 * structure would be the smaller objection; the real one is that they could
 * disagree — `JSON.stringify` is the thing that decides what the bytes ARE, so
 * anything hashed before it is a hash of something else.
 */
function indexAsset<Encoded>(
  name: string,
  encoded: Encoded,
): SearchIndexAsset<Encoded> {
  const contents = JSON.stringify(encoded);
  const digest = createHash("sha256")
    .update(contents)
    .digest("hex")
    .slice(0, DIGEST_LENGTH);
  const path = `assets/${name}-${digest}.json`;

  return { encoded, path, url: `/${path}`, contents };
}

/** The Comprehensive Rules index. Measured at 204,137 bytes on `main`. */
export const RULES_INDEX: SearchIndexAsset<EncodedIndex> = indexAsset(
  "rules-index",
  buildIndex(RULES_CORPUS),
);

/**
 * The chapter browse, derived at build time and passed as an ordinary prop.
 *
 * THIS IS THE HALF OF `/cr` THAT IS A DOCUMENT, and separating it from the half
 * that is a search is the whole reason moving the index out costs nothing here.
 * `RulesSearch` renders the browse under an empty query — nine links, 1,184
 * bytes — and it is what a reader with no JavaScript, and every crawler, sees.
 * Deriving it from the index in the browser meant the page could not draw its
 * own static content without first parsing a 204 kB index it needs only to
 * answer a query nobody has typed yet.
 *
 * So the nine rows travel as props, exactly as a set page's rows do, and the
 * index is fetched only when there is a query for it to answer.
 */
export const RULES_BROWSE: readonly SearchResult[] = chapters(
  decodeIndex(RULES_INDEX.encoded),
);
