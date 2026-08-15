/**
 * Paging, pinned — the arithmetic, and the promise that nothing is capped.
 *
 * ONE PROPERTY IS BEING DEFENDED ABOVE ALL THE OTHERS: **every row the engine
 * matched is reachable.** That is the whole of what this change was for.
 * `docs/SCRYFALL-GAP.md` §4 called the old behaviour "a refusal where Scryfall
 * paginates", and a refusal is exactly what a paging bug reintroduces — a row
 * that falls between two pages is a row the interface counted and then declined
 * to show, which is the failure with the old name.
 *
 * So the interesting test here is not any single case: it is the sweep at the
 * bottom that walks every page of every size and asserts the concatenation is
 * the unpaged answer, exactly, in order. A row cannot be skipped, cannot be
 * repeated on two pages, and cannot arrive in a different position because of
 * which page it landed on.
 *
 * IT RUNS AGAINST BOTH ENGINES, because they slice at different points in their
 * own pipelines. `search` slices a ranked list; `searchCards` slices after
 * ranking, after the `unique:names` collapse and after the `unique:art`
 * expansion — so the row list it pages over is built by code the rules engine
 * does not have, and a proof about one is not a proof about the other.
 */

import { describe, expect, test } from "bun:test";

import {
  buildCardIndex,
  type CardIndex,
  decodeCardIndex,
  searchCards,
} from "./card-search";
import { CARD_PAGES, CORPUS, LAST_CONFIRMED } from "./cards";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_PARAM,
  PAGE_SIZES,
  type PageSize,
  pageHref,
  paginate,
  parsePage,
  parsePageSize,
  requestFor,
  SIZE_PARAM,
  withPageParams,
} from "./pagination";
import rulesCorpus from "../../../../data/rules/cr-2.14.0.json";

import {
  buildIndex,
  decodeIndex,
  type RulesCorpus,
  search,
  type SearchIndex,
} from "./search";
import { SETS } from "./sets";

const cards: CardIndex = decodeCardIndex(
  buildCardIndex(CARD_PAGES, {
    commit: CORPUS.source.commit,
    confirmed: LAST_CONFIRMED,
    releasedBySet: new Map(SETS.sets.map((set) => [set.id, set.released])),
  }),
);

const rules: SearchIndex = decodeIndex(
  buildIndex(rulesCorpus as unknown as RulesCorpus),
);

/* -------------------------------------------------------------------------- */
/* The steps on offer                                                          */
/* -------------------------------------------------------------------------- */

describe("the steps a reader can pick", () => {
  test("the default is the number the old cap was", () => {
    // Nothing about a first visit changed. What changed is that the 61st result
    // is now reachable.
    expect(DEFAULT_PAGE_SIZE).toBe(60);
    expect(PAGE_SIZES).toContain(DEFAULT_PAGE_SIZE);
  });

  test("there is a step below the default, and one that is uncapped", () => {
    // The step DOWN is the one a phone on a slow connection wants — the grid is
    // card images, and 60 of them is what made the cap hurt.
    expect(PAGE_SIZES[0]).toBe(30);
    expect(PAGE_SIZES).toContain("all");
  });
});

/* -------------------------------------------------------------------------- */
/* Reading the URL                                                             */
/* -------------------------------------------------------------------------- */

describe("reading the two parameters", () => {
  test("a size the interface does not offer is the default, silently", () => {
    /*
     * Silently, and that is the right failure. A notice about a URL parameter
     * would put an error message about typing above results that are perfectly
     * correct. An unparseable page size costs nothing to ignore — unlike an
     * unparseable QUERY, where guessing is exactly what the engine's notices
     * exist to refuse.
     */
    expect(parsePageSize("5000")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("banana")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize(null)).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("-30")).toBe(DEFAULT_PAGE_SIZE);
  });

  test("every offered size survives a round trip through a URL", () => {
    for (const size of PAGE_SIZES) {
      const href = pageHref("/search", "dominate", 3, size);
      const params = new URL(href, "https://optfall.com").searchParams;
      expect(parsePageSize(params.get(SIZE_PARAM))).toBe(size);
    }
  });

  test("`all` is spelled, not a number, so arithmetic cannot produce it", () => {
    expect(parsePageSize("all")).toBe("all");
    expect(parsePageSize("ALL")).toBe("all");
    expect(parsePageSize(" all ")).toBe("all");
  });

  test("anything that is not a page number is page one", () => {
    expect(parsePage("0")).toBe(1);
    expect(parsePage("-4")).toBe(1);
    expect(parsePage("two")).toBe(1);
    expect(parsePage(null)).toBe(1);
    expect(parsePage("7")).toBe(7);
  });
});

describe("writing the two parameters", () => {
  test("the defaults are deleted rather than written", () => {
    /*
     * `?page=1&per=60` says nothing the bare URL does not, and leaving either
     * behind would make the canonical address of a search depend on the route
     * the reader took to it — two links to one answer, which is the failure a
     * permalink exists to prevent.
     */
    expect(pageHref("/search", "dominate", 1, DEFAULT_PAGE_SIZE)).toBe(
      "/search?q=dominate",
    );
    const params = new URLSearchParams("q=x&page=4&per=120");
    withPageParams(params, 1, DEFAULT_PAGE_SIZE);
    expect(params.toString()).toBe("q=x");
  });

  test("parameters this module does not own are left alone", () => {
    // `?display=` is read by the card search and never written by it. A helper
    // that rebuilt the query string would drop it, and turning a page would
    // change the view as a side effect.
    const params = new URLSearchParams("q=x&display=list");
    withPageParams(params, 3, 120);
    expect(params.get("display")).toBe("list");
    expect(params.get(PAGE_PARAM)).toBe("3");
    expect(params.get(SIZE_PARAM)).toBe("120");
  });

  test("an empty query leaves no `q` behind", () => {
    expect(pageHref("/cr", "   ", 1, DEFAULT_PAGE_SIZE)).toBe("/cr");
  });
});

/* -------------------------------------------------------------------------- */
/* The arithmetic                                                              */
/* -------------------------------------------------------------------------- */

describe("resolving a page", () => {
  test("an empty answer has one page, not zero", () => {
    // `pages: 0` reads as "there is no page one", which would make every caller
    // special-case the empty state twice.
    const slice = paginate(0, 1, 60);
    expect(slice.pages).toBe(1);
    expect(slice.from).toBe(0);
    expect(slice.to).toBe(0);
  });

  test("the last page is a short one, and says so", () => {
    const slice = paginate(703, 12, 60);
    expect(slice.from).toBe(661);
    expect(slice.to).toBe(703);
    expect(slice.pages).toBe(12);
  });

  test("a page past the end is clamped rather than rejected", () => {
    /*
     * A stale link is overwhelmingly a link whose query still works and whose
     * answer has moved, and the last page is the closest true thing to what it
     * asked for. An empty list would be a worse answer than a wrong-numbered
     * one.
     */
    const slice = paginate(703, 900, 60);
    expect(slice.page).toBe(12);
    expect(slice.to).toBe(703);
  });

  test("`all` is one page with no cap on it", () => {
    const slice = paginate(4941, 1, "all");
    expect(slice.pages).toBe(1);
    expect(slice.offset).toBe(0);
    expect(slice.limit).toBe(Number.POSITIVE_INFINITY);
    expect(slice.to).toBe(4941);
  });

  test("the pager is not drawn where it could do nothing", () => {
    // A nine-result answer with a pager under it is a control that can do
    // nothing, spending a rule and a row of targets to say so.
    expect(paginate(9, 1, DEFAULT_PAGE_SIZE).needed).toBe(false);
    expect(paginate(31, 1, DEFAULT_PAGE_SIZE).needed).toBe(true);
    expect(paginate(120, 1, DEFAULT_PAGE_SIZE).needed).toBe(true);
  });

  test("a chosen size is always visible, so it can always be undone", () => {
    // A setting you cannot see is a setting you cannot undo.
    expect(paginate(9, 1, "all").needed).toBe(true);
    expect(paginate(9, 1, 30).needed).toBe(true);
  });

  test("the request is the unclamped half, known before the query runs", () => {
    expect(requestFor(3, 60)).toEqual({ offset: 120, limit: 60 });
    expect(requestFor(1, "all")).toEqual({
      offset: 0,
      limit: Number.POSITIVE_INFINITY,
    });
    expect(requestFor(900, 60).offset).toBe(53_940);
  });
});

/* -------------------------------------------------------------------------- */
/* Nothing is capped, and nothing is lost between the pages                    */
/* -------------------------------------------------------------------------- */

/** Walk every page at `size` and concatenate what each one showed. */
function walk<T>(
  total: number,
  size: PageSize,
  rowsOn: (limit: number, offset: number) => readonly T[],
): T[] {
  const seen: T[] = [];
  const pages = paginate(total, 1, size).pages;
  for (let page = 1; page <= pages; page += 1) {
    const slice = paginate(total, page, size);
    seen.push(...rowsOn(slice.limit, slice.offset));
  }
  return seen;
}

describe("every row that matched is reachable", () => {
  /*
   * The queries are chosen to be awkward rather than representative: one that
   * matches most of the corpus, one whose total is a prime so no size divides
   * it evenly, and one in each `unique:` mode — because that operator decides
   * how many ROWS a given number of MATCHES becomes, and the slice is applied
   * after it.
   */
  const CARD_QUERIES = [
    "attack",
    "type:action",
    "dominate unique:cards",
    "dominate unique:art",
    "class:guardian",
  ];

  for (const query of CARD_QUERIES) {
    test(`\`${query}\` survives being read a page at a time`, () => {
      const whole = searchCards(cards, query, Number.POSITIVE_INFINITY);
      expect(whole.results.length).toBe(whole.total);
      /* A query that fits on one page would make the walk below assert
         nothing, and the corpus moves. This is the guard against a test that
         passes because it stopped testing. */
      expect(paginate(whole.total, 1, 30).pages).toBeGreaterThan(1);

      for (const size of PAGE_SIZES) {
        const paged = walk(whole.total, size, (limit, offset) =>
          searchCards(cards, query, limit, offset).results.map(
            (row) => row.href,
          ),
        );
        expect(paged).toEqual(whole.results.map((row) => row.href));
      }
    });
  }

  test("the rules engine survives the same walk", () => {
    for (const query of ["card", "attack", "player", "zone"]) {
      const whole = search(rules, query, Number.POSITIVE_INFINITY);
      expect(whole.results.length).toBe(whole.total);
      expect(paginate(whole.total, 1, 30).pages).toBeGreaterThan(1);

      for (const size of PAGE_SIZES) {
        const paged = walk(whole.total, size, (limit, offset) =>
          search(rules, query, limit, offset).results.map((row) => row.id),
        );
        expect(paged).toEqual(whole.results.map((row) => row.id));
      }
    }
  });

  test("the reported total never changes with the slice", () => {
    /*
     * The count was always honest and paging must not cost that. `total` counts
     * the ranked list, not the page, so it has to be the same number at every
     * offset — including one past the end, where the page is empty and the
     * answer is not.
     */
    const query = "type:action";
    const whole = searchCards(cards, query, Number.POSITIVE_INFINITY).total;
    expect(whole).toBeGreaterThan(60);
    for (const [limit, offset] of [
      [60, 0],
      [30, 90],
      [240, 240],
      [Number.POSITIVE_INFINITY, 0],
      [60, whole + 600],
    ] as const) {
      expect(searchCards(cards, query, limit, offset).total).toBe(whole);
    }
  });

  test("`all` really is all of them, on the broadest query in the corpus", () => {
    // The one assertion that would fail if any cap survived anywhere in the
    // path — deliberately run on `unique:art`, which produces the most rows a
    // single query can.
    const outcome = searchCards(
      cards,
      "type:action unique:art",
      requestFor(1, "all").limit,
    );
    expect(outcome.results.length).toBe(outcome.total);
    expect(outcome.total).toBeGreaterThan(1000);
  });
});
