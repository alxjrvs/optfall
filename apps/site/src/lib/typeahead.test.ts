/**
 * The front door's name index: what it packs, what it unpacks, and what it
 * suggests.
 *
 * WHY IT WAS THE LEAST-COVERED LIBRARY IN THE TREE. Nothing imported it except
 * `random.page.tsx` and `RandomCard.tsx`, neither of which was covered either,
 * so `buildNameIndex` ran only inside a build and `suggest` ran only in a
 * browser. Forty of its lines were unreached — 42.9% — on the module that
 * answers the very first thing a reader types.
 *
 * THE INDEX IS THREE PARALLEL STRINGS, and that shape is the whole reason this
 * needs testing rather than reading. Names, addresses and pitch digits travel
 * as newline-joined text and are re-split on arrival, so every property that
 * matters is an INVARIANT BETWEEN THREE ARRAYS rather than anything visible in
 * one record: they have to be the same length, and row `i` of each has to be
 * the same card. A defect there is silent — a suggestion that shows one card's
 * name over another card's address is still a working link.
 *
 * SO THE ROUND TRIP IS ASSERTED OVER THE REAL CORPUS. Four-odd thousand names,
 * every one of them upstream's, including the ones with punctuation and
 * non-ASCII in them, which are exactly the rows a fold gets wrong. The small
 * fixtures below it are for the shapes the corpus does not happen to contain.
 */

import { describe, expect, test } from "bun:test";

import { CARD_PAGES, HREF_BY_NAME_SLUG } from "./cards";
import {
  buildNameIndex,
  decodeNameIndex,
  type EncodedNameIndex,
  suggest,
} from "./typeahead";

const encoded = buildNameIndex(CARD_PAGES, HREF_BY_NAME_SLUG);
const index = decodeNameIndex(encoded);

describe("the built index over the real corpus", () => {
  test("it has one row per distinct card name", () => {
    /* One row per NAME, not per printing: the front door offers cards, and the
       three Head Jabs are one thing to type. */
    const distinct = new Set(
      CARD_PAGES.filter((page) => HREF_BY_NAME_SLUG.has(page.nameSlug)).map(
        (page) => page.nameSlug,
      ),
    );
    expect(index.size).toBe(distinct.size);
    expect(index.size).toBeGreaterThan(1000);
  });

  test("the three arrays are the same length, row for row", () => {
    /* THE INVARIANT THE WIRE FORMAT CAN BREAK. Three strings split
       independently; if a name ever contained a newline, one array would gain a
       row and every row after it would carry another card's address. */
    expect(index.names.length).toBe(index.size);
    expect(index.hrefs.length).toBe(index.size);
    expect(index.pitches.length).toBe(index.size);
    expect(index.folded.length).toBe(index.size);
  });

  test("no name carries a newline, which is what the format assumes", () => {
    const broken = CARD_PAGES.map((page) => page.card.name).filter((name) =>
      name.includes("\n"),
    );
    expect(broken).toEqual([]);
  });

  test("every address is one the site actually publishes", () => {
    /* The index carries the destination outright, because a card's URL is
       `/card/<set>/<number>/<slug>` and neither set nor number is derivable
       from a name. So a wrong row here is a link to somebody else's card. */
    const published = new Set(HREF_BY_NAME_SLUG.values());
    const strays = index.hrefs.filter((href) => !published.has(href));
    expect(strays).toEqual([]);
  });

  test("each row's name and address belong to the same card", () => {
    /*
     * THE ONE ASSERTION THAT WOULD CATCH AN OFF-BY-ONE, and it is why the
     * lengths above are not enough: three arrays of equal length can still be
     * rotated against each other. The slug is in the address, so this compares
     * the name to the row it is filed under rather than to itself.
     */
    const nameBySlug = new Map(
      CARD_PAGES.map((page) => [page.nameSlug, page.card.name]),
    );
    const mismatched: string[] = [];
    for (const [slug, href] of HREF_BY_NAME_SLUG) {
      const at = index.hrefs.indexOf(href);
      if (at === -1) continue;
      if (index.names[at] !== nameBySlug.get(slug)) {
        mismatched.push(`${href}: ${index.names[at]}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  test("a card's pitch digits are sorted and free of duplicates", () => {
    /* Head Jab is red, yellow and blue, and the index carries all three under
       one name so the suggestion can draw the stones. Sorted so two builds
       cannot disagree about a set's iteration order. */
    const unsorted = index.pitches.filter(
      (pitches) =>
        pitches.some((value, at) => at > 0 && value < (pitches[at - 1] ?? 0)) ||
        new Set(pitches).size !== pitches.length,
    );
    expect(unsorted).toEqual([]);
  });
});

describe("folding, as it shows up in what can be typed", () => {
  /*
   * The fold is not exported, so it is exercised where it matters: a query and
   * a name that differ only in case or punctuation have to find each other.
   * `10,000 Year Reunion` is a real card and is the reason the fold splits on
   * non-alphanumerics rather than stripping them — "10 000 year reunion" and
   * "10,000 Year Reunion" have to be the same string afterwards.
   */
  test("case does not matter", () => {
    const upper = suggest(index, "HEAD JAB");
    const lower = suggest(index, "head jab");
    expect(upper).toEqual(lower);
    expect(upper.length).toBeGreaterThan(0);
  });

  test("punctuation in the name does not have to be typed", () => {
    const withComma = suggest(index, "10,000 year");
    const without = suggest(index, "10 000 year");
    expect(withComma.length).toBeGreaterThan(0);
    expect(withComma).toEqual(without);
  });

  test("a query of only punctuation asks nothing", () => {
    /* It folds to the empty string, which is not the same as a query that
       matched nothing — and returning every card for `---` would be worse than
       returning none. */
    expect(suggest(index, "---")).toEqual([]);
    expect(suggest(index, "   ")).toEqual([]);
    expect(suggest(index, "")).toEqual([]);
  });
});

describe("what `suggest` returns", () => {
  test("a prefix match, with the card's own address and pitches", () => {
    const [first] = suggest(index, "head jab");
    expect(first?.name.toLowerCase().startsWith("head jab")).toBe(true);
    expect(first?.href.startsWith("/card/")).toBe(true);
    expect((first?.pitches ?? []).length).toBeGreaterThan(0);
  });

  test("it never returns more than the limit", () => {
    /* `a` is in almost every name in the game. */
    expect(suggest(index, "a").length).toBeLessThanOrEqual(8);
    expect(suggest(index, "a", 3)).toHaveLength(3);
  });

  test("nothing matching is an empty list rather than a near miss", () => {
    expect(suggest(index, "zzzznotacard")).toEqual([]);
  });
});

describe("the two tiers, on a corpus small enough to see them", () => {
  /*
   * PREFIX BEFORE CONTAINS IS THE RANKING, and the real corpus cannot show it:
   * `suggest` stops scanning as soon as the prefix tier is full, so with four
   * thousand names a common query never reaches the second tier at all. That
   * early exit is correct and it is also what makes the ordering invisible, so
   * the ordering is asserted here, where six rows fit on the screen.
   */
  const fixture: EncodedNameIndex = {
    names: ["Jab", "Head Jab", "Jab Strike", "Sinister Jab"].join("\n"),
    hrefs: ["/card/a", "/card/b", "/card/c", "/card/d"].join("\n"),
    pitches: ["1", "123", "", "3"].join("\n"),
  };
  const small = decodeNameIndex(fixture);

  test("names starting with the query come before names containing it", () => {
    expect(suggest(small, "jab").map((hit) => hit.name)).toEqual([
      "Jab",
      "Jab Strike",
      "Head Jab",
      "Sinister Jab",
    ]);
  });

  test("the limit cuts the tail, not the head", () => {
    expect(suggest(small, "jab", 2).map((hit) => hit.name)).toEqual([
      "Jab",
      "Jab Strike",
    ]);
  });

  test("a card with no pitch digits decodes to no pitches, not to a zero", () => {
    /* An empty line is a card that publishes no pitch, which is a state rather
       than a defect — `""` is how this corpus encodes an absent stat, and a
       `0` stone would be a value nothing printed. */
    const strike = suggest(small, "jab strike")[0];
    expect(strike?.pitches).toEqual([]);
  });

  test("multiple digits decode in order", () => {
    const head = suggest(small, "head jab")[0];
    expect(head?.pitches).toEqual([1, 2, 3]);
  });
});

describe("the empty index", () => {
  /*
   * `"".split("\n")` IS `[""]`, NOT `[]`, which is the trap this format walks
   * straight into: without the guard, an empty index decodes to one nameless
   * card at no address, and the front door offers it.
   */
  const empty = decodeNameIndex({ names: "", hrefs: "", pitches: "" });

  test("decodes to nothing rather than to one blank row", () => {
    expect(empty.size).toBe(0);
    expect(empty.names).toEqual([]);
    expect(empty.hrefs).toEqual([]);
    expect(empty.pitches).toEqual([]);
  });

  test("and suggests nothing rather than throwing", () => {
    expect(suggest(empty, "anything")).toEqual([]);
  });
});

describe("building from pages the site does not publish", () => {
  test("a name with no address is dropped rather than carried blank", () => {
    /*
     * `hrefByNameSlug` is what the site actually publishes, and a page whose
     * slug is absent from it is a card with no URL. Carrying it would put a
     * name in the typeahead that leads nowhere — a suggestion that fails when
     * pressed, which is worse than one that was never offered.
     */
    const subset = new Map(
      [...HREF_BY_NAME_SLUG].filter((_, at) => at % 2 === 0),
    );
    const partial = decodeNameIndex(buildNameIndex(CARD_PAGES, subset));
    expect(partial.size).toBe(subset.size);
    expect(partial.size).toBeLessThan(index.size);
    expect(partial.hrefs.filter((href) => href === "")).toEqual([]);
  });
});
