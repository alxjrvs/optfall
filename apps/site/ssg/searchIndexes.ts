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
  buildCardIndex,
  decodeCardIndex,
  type EncodedCardIndex,
} from "../src/lib/card-search";
import { CARD_PAGES, CORPUS, LAST_CONFIRMED } from "../src/lib/cards";
import { orientationOfFace } from "../src/lib/faces";
import { facesOf, hrefForPrinting } from "../src/lib/printings";
import { RECENT_RELEASES } from "../src/lib/releases";
import {
  buildIndex,
  chapters,
  decodeIndex,
  type EncodedIndex,
  type SearchResult,
} from "../src/lib/search";
import { SETS } from "../src/lib/sets";

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

/**
 * The card index. Measured at 909,626 bytes on `main`.
 *
 * BUILT HERE RATHER THAN IN `search.page.tsx`, WHICH IS WHERE IT LIVED. Nothing
 * about the construction changed — it is still the same three fields fed to
 * `buildCardIndex` from the same shaped pages `/card/<slug>` renders, which is
 * what makes it impossible for a result and the page it links to to disagree
 * about a slug, a legality verdict or a face. What changed is that TWO
 * consumers need it now: the page, which links its address, and `assets.ts`,
 * which writes its bytes. A module scope is the only place both can read one
 * value rather than two derivations of it.
 */
export const CARD_INDEX: SearchIndexAsset<EncodedCardIndex> = indexAsset(
  "card-index",
  buildCardIndex(CARD_PAGES, {
    commit: CORPUS.source.commit,
    confirmed: LAST_CONFIRMED,
    releasedBySet: new Map(SETS.sets.map((set) => [set.id, set.released])),
  }),
);

/**
 * Everything `/search` prints before anybody has searched.
 *
 * THE SAME SEPARATION `RULES_BROWSE` MAKES, and it is worth stating that the
 * symmetry is real rather than a coincidence of shape. Both surfaces are a field
 * over a corpus, and both draw something from that corpus while the field is
 * empty — nine chapters there, twenty-four printed type lines here, each a link
 * into the search that answers it. Neither needs an index to do it, and until
 * now both loaded one anyway.
 *
 * IT CARRIES THE PIN, WHICH IS NOT DECORATION. `docs/DATA-TERMS.md`, "What we
 * warrant": "every surface shows when its data was last confirmed. A stale
 * Optfall is required to look stale." The count, the upstream commit and the
 * confirmation date are that sentence on this
 * page, so they have to render without a fetch — a provenance line that appears
 * only once a request succeeds is a provenance line that is absent exactly when
 * something is wrong.
 *
 * 805 bytes measured, against the 909,626 it replaces.
 */
export interface CardCorpusBrief {
  /** How many cards the corpus carries. */
  readonly size: number;
  /** The upstream commit it is pinned at. Displayed, never parsed. */
  readonly commit: string;
  /** `YYYY-MM-DD` it was last confirmed against upstream. */
  readonly confirmed: string;
  /** Printed type lines and how many cards carry each, for the empty state. */
  readonly browse: readonly (readonly [string, number])[];
}

/**
 * The newest release, and the first few of its cards, for `/search` to open on.
 *
 * WHY THIS PAGE GETS PICTURES AT ALL. `/search` with no query was a paragraph
 * of build metadata over twenty-four type lines in one column — the second-most
 * visited surface on a site whose subject is card art, rendering none of it. A
 * browse is an INVITATION, and an invitation made entirely of a database schema
 * is the shape `docs/SCRYFALL-GAP.md` §2 names about the empty field — "a
 * demand, not an invitation" — arrived at one level down.
 *
 * DERIVED, NEVER CURATED, which is the condition for it being here. Nothing in
 * this row is chosen: the set is whatever `RECENT_RELEASES` puts at the front,
 * the cards are that set's lowest collector numbers, and both move on the next
 * corpus sync with no edit to any file. A hand-picked row would be one more
 * thing to maintain and the first one to go stale.
 *
 * IT RIDES IN THE PAGE RATHER THAN IN THE INDEX, for the reason `CARD_BRIEF`
 * exists: the browse state must render with no fetch. A row of art that appears
 * only once a 900 kB request lands is a row of art that is missing on exactly
 * the connection it would have helped.
 *
 * IT SHOWS THE SET'S OWN PRINTINGS, WHICH IS THE WHOLE DIFFICULTY. A first
 * version read `CardPage.face` — the card's DEFAULT art, whichever set first
 * printed it — and headed the row "Newest: Mastery Pack Warrior" over four
 * faces keyed `DDD001`, `AHA001-RF` and `HVY093`. Every card in it really was
 * in the set, and not one of the pictures was: a mastery pack is reprints, so
 * the default face of almost every card in it belongs to an older set. The row
 * has to go through `facesOf`, which is the list the ROUTER mints printing URLs
 * from, so the picture, the address and the heading name one printing.
 *
 * PORTRAIT ONLY. The strip sets one aspect ratio, and the corpus's sideways
 * cards — measured, see `LANDSCAPE_FACES` in `src/lib/faces.ts` — would either
 * letterbox in a portrait cell or force every cell to the wider box for the
 * sake of one. Skipping them costs nothing: the row is the first few cards of a
 * set, never a claim to be all of them.
 */
export interface NewestRelease {
  /** The set's published name — "Part the Mistveil". */
  readonly name: string;
  /** The three-letter code, lowercased, for the search this row links to. */
  readonly code: string;
  /** `YYYY-MM-DD`. Non-null by construction: `RECENT_RELEASES` is dated. */
  readonly released: string;
  readonly cards: readonly {
    /** The face key, which is unique per art and so unique per cell. */
    readonly key: string;
    /** The PRINTING's address, not the card's. See the note above. */
    readonly href: string;
    readonly label: string;
    /** `""` where upstream publishes none — never the word "null". */
    readonly typeLine: string;
    readonly faceKey: string;
  }[];
}

/**
 * How many faces the row carries.
 *
 * FOUR, WHICH IS A LAYOUT FACT RATHER THAN A TASTE. The strip is drawn on the
 * same grid `CardIndex` draws results on — one `layout.card.cell` track per
 * card — and `layout.page.index`, which is this page's width, is defined as
 * exactly four of those cells plus their gutters. Four is therefore the number
 * that fills one row and wraps to none, at the width the page already has.
 *
 * A fifth card would not be more art, it would be a second row holding one.
 */
const NEWEST_FACES = 4;

export const CARD_NEWEST: NewestRelease | null = (() => {
  const set = RECENT_RELEASES[0];
  /* No qualifying set is a real state rather than a defect: a corpus whose
     newest dated set is under `RELEASE_SIZE` has no release to show, and the
     browse renders its type lines without a strip. Nothing downstream may
     assume the row is there. */
  if (set === undefined || set.released === null) return null;

  const code = set.id.toUpperCase();
  const numbered = CARD_PAGES.flatMap((page) => {
    /* THE FIRST FACE THIS CARD PUBLISHES IN THIS SET. `facesOf` is in corpus
       order and deduped by image, so a card struck Regular and Rainbow Foil
       from one picture contributes one entry, and a card with two arts in the
       set contributes its first. Filtering it is also the membership test: a
       card with no face here is not in this set, or is in it with no published
       art, and either way there is nothing to draw. */
    const face = facesOf(page.card).find(
      (ref) => ref.setCode.toUpperCase() === code,
    );
    if (face === undefined) return [];

    if (
      orientationOfFace({
        key: face.key,
        playedHorizontally: page.card.played_horizontally,
        rotationDegrees: face.printing.image_rotation_degrees,
      }) !== "portrait"
    )
      return [];

    return [
      {
        /* The collector number as PRINTED, which is what sorts a set into the
           order a reader would flip through it. `face.number` is the URL
           segment and collapses punctuation, so it is the wrong key here. */
        number: face.printing.id,
        card: {
          key: face.key,
          href: hrefForPrinting(face.setCode, face.number, page.slug),
          label: page.label,
          typeLine: page.card.type_text ?? "",
          faceKey: face.key,
        },
      },
    ];
  });

  /* Collector number ascending, then face key, so the order is total and two
     builds cannot draw the row differently. */
  const cards = numbered
    .toSorted((a, b) => {
      if (a.number !== b.number) return a.number < b.number ? -1 : 1;
      return a.card.key < b.card.key ? -1 : 1;
    })
    .slice(0, NEWEST_FACES)
    .map((entry) => entry.card);

  if (cards.length === 0) return null;
  return {
    name: set.name,
    code: set.id.toLowerCase(),
    released: set.released,
    cards,
  };
})();

export const CARD_BRIEF: CardCorpusBrief = (() => {
  /* Decoded once, at build time, purely to read four fields off it. The decode
     is the honest way to get them: `size` and `browse` are derivations of the
     wire format, and re-deriving them from the encoded strings here would be a
     second implementation of `decodeCardIndex` that could disagree with it. */
  const decoded = decodeCardIndex(CARD_INDEX.encoded);
  return {
    size: decoded.size,
    commit: decoded.commit,
    confirmed: decoded.confirmed,
    browse: decoded.browse,
  };
})();
