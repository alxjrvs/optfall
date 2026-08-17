import type { CardPage } from "../cards";
import { orientationOf } from "../faces";
import { facesOf } from "../printings";

import { FORMAT_NAMES } from "./grammar";
import { tokeniseCard } from "./tokenise";
import { TONE_BIT } from "./wire";
import type { EncodedCardIndex } from "./wire";

/* -------------------------------------------------------------------------- */
/* Building                                                                    */
/* -------------------------------------------------------------------------- */

/** How many type lines the empty state offers as a browse. */
const BROWSE_LIMIT = 24;

export function dictionary(values: readonly string[]): {
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
    `apps/site/src/lib/card-search/grammar.ts: FORMAT_NAMES is [${FORMAT_NAMES.join(", ")}] but ` +
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
export function encodePostings(
  map: ReadonlyMap<string, readonly number[]>,
): string[] {
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
  /** The upstream commit the corpus was pinned at. */ readonly commit: string;
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
  const faceSets: string[] = [];
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
    const faces = facesOf(page.card);
    arts.push(
      faces
        .slice(1)
        .map((ref) => {
          /* Per ART, not per card — see `ArtRef.landscape`. The card-level
             half of the rule is passed in beside the printing-level half so
             this is the SAME function the card page and the set page call,
             rather than a second evaluation of the same rule. */
          const landscape =
            orientationOf({
              playedHorizontally: page.card.played_horizontally,
              rotationDegrees: ref.printing.image_rotation_degrees,
            }) === "landscape";
          return `${sets.idOf.get(ref.printing.set_id) ?? 0} ${landscape ? 1 : 0} ${ref.key}`;
        })
        .join("\t"),
    );
    /*
      THE DEFAULT FACE'S SET, TAKEN FROM THE SAME LIST THE ARTS COME FROM.
      `faces[0]` is by construction the face `faceOf` chose for `page.face` —
      both walk `card.printings` in order and take the first with an image — so
      reading the set off a second source here would be a second evaluation of
      one rule, which is the shape of bug this file's `nameSlugs` note is about.
      Zero where there is no face at all; see `EncodedCardIndex.faceSets` for
      why the id is offset by one.
    */
    const faceSetId = sets.idOf.get(faces[0]?.printing.set_id ?? "");
    faceSets.push(pad2(faceSetId === undefined ? 0 : faceSetId + 1));
    faceLandscape.push(page.face.orientation === "landscape" ? "1" : "0");
    pitches.push(String(page.pitch));
    typeAt.push(pad2(types.idOf.get(page.card.type_text) ?? 0));
    stats.push(
      [
        page.card.cost,
        page.card.power,
        page.card.defense,
        page.card.health,
        page.card.intelligence,
        page.card.arcane,
      ].join("\t"),
    );

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
    faceSets: faceSets.join(""),
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
