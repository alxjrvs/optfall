/**
 * The generator's own invariants.
 *
 * These are not tests of React or of the filesystem. Every one of them asserts
 * a failure that is SILENT by default — a page written to the wrong address, a
 * page overwriting another, a page shipped without the disclaimer. The build
 * reports success in all three cases, which is why they are worth a test each.
 */

import { readFileSync } from "node:fs";

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CARD_PAGES,
  CARD_ROUTES,
  CORPUS as CARDS,
  variantSuffix,
} from "../src/lib/cards";
import { LSS_DISCLAIMER } from "../src/lib/compliance";
import { facesOf, hrefForPrinting } from "../src/lib/printings";
import { editionLabel, setFor, setName } from "../src/lib/sets";
import { CardIndex } from "./components/CardIndex";
import { canonicalFor, Document } from "./document";
import {
  HEADERS,
  headersFor,
  REDIRECTS,
  renderHeaders,
  renderRedirects,
} from "./hostConfig";
import { outputPathFor } from "./outputPath";
import { HEADER_FIELD_ID } from "./islands/HeaderSearch";
import { fillPattern, renderRoute, resolveRoutes } from "./render";
import { routes } from "./routes";
import type { PageModule, PageResult } from "./types";

/**
 * Where a card lives, by slug.
 *
 * THE TESTS BELOW NAME CARDS, NOT PATHS, AND THEY HAVE TO NOW. A card's URL is
 * `/card/<set>/<number>/<slug>` and the set and number come from whichever
 * printing upstream lists first — so `/card/head-jab-1` is no longer something
 * a test can spell, and a hard-coded `/card/ben/010/head-jab-1` would fail the
 * day upstream reorders that card's printings without anything being wrong.
 *
 * Resolved through the router's own table, so a test asking for a card gets the
 * page the site would actually serve.
 *
 * IT COVERS DEFAULT PRINTINGS ONLY, AND THE LITERALS ELSEWHERE IN THIS FILE ARE
 * DELIBERATE. A handful of assertions spell an ALTERNATE art's URL out —
 * `/card/lgs/017-rf/head-jab-1`, `/card/wtr/u-wtr098/head-jab-1` — because those
 * tests are about that specific art: the rainbow-foil promo, the Unlimited
 * printing that shares a collector number with Alpha. "Whichever alternate comes
 * first" would make them assert something else, so the address is named. What is
 * derivable is which of a card's printings is its DEFAULT, and that is the thing
 * a corpus resync moves.
 */
function addressOf(slug: string): string {
  const route = CARD_ROUTES.find(
    (candidate) => candidate.slug === slug && candidate.isDefault,
  );
  if (route === undefined) {
    throw new Error(
      `ssg.test.ts: no default printing route for "${slug}". Either the card ` +
        `left the corpus or its slug changed; fix the test's card, not this ` +
        `lookup.`,
    );
  }
  return route.href;
}

/* -------------------------------------------------------------------------- */
/* URLs to files                                                               */
/* -------------------------------------------------------------------------- */

describe("outputPathFor", () => {
  test("every route is a directory index, because the live URLs are", () => {
    /*
     * `/syntax/index.html` and not `/syntax.html`. A static host serves the
     * first at both `/syntax` and `/syntax/`, and the second only at
     * `/syntax.html`. All 12,776 URLs already shipped are the directory form,
     * so this is a compatibility requirement rather than a preference.
     */
    expect(outputPathFor("/syntax")).toBe("syntax/index.html");
    expect(outputPathFor("/card/ksu/011/head-jab-1")).toBe(
      "card/ksu/011/head-jab-1/index.html",
    );
  });

  test("the root and 404 are the two that are not", () => {
    expect(outputPathFor("/")).toBe("index.html");
    expect(outputPathFor("/404")).toBe("404.html");
  });

  test("a trailing slash does not produce a different file", () => {
    // Otherwise `/syntax` and `/syntax/` are two pages, and one of them wins.
    expect(outputPathFor("/syntax/")).toBe(outputPathFor("/syntax"));
  });
});

/* -------------------------------------------------------------------------- */
/* Patterns                                                                    */
/* -------------------------------------------------------------------------- */

describe("fillPattern", () => {
  test("fills every bracketed segment", () => {
    expect(fillPattern("/card/[slug]", { slug: "head-jab-1" })).toBe(
      "/card/head-jab-1",
    );
    expect(
      fillPattern("/card/[set]/[number]/[slug]", {
        set: "ksu",
        number: "011",
        slug: "head-jab-1",
      }),
    ).toBe("/card/ksu/011/head-jab-1");
    expect(
      fillPattern("/card/[slug]/[set]/[number]", {
        slug: "head-jab-1",
        set: "ksu",
        number: "011",
      }),
    ).toBe("/card/head-jab-1/ksu/011");
  });

  test("a missing parameter throws rather than emitting /card/undefined", () => {
    /*
     * THE FAILURE THIS PREVENTS IS INVISIBLE IN A BUILD LOG. Interpolating
     * `undefined` produces a real file at a URL nobody meant, linked from
     * nothing, found later by a crawler — and the build says it wrote a page.
     */
    expect(() => fillPattern("/card/[slug]", {})).toThrow(/Missing parameter/);
  });
});

describe("resolveRoutes", () => {
  test("a page with no getStaticPaths owns exactly its pattern", () => {
    const module: PageModule = {
      pattern: "/data-terms",
      page: () => ({ title: "", description: "", children: null }),
    };
    const resolved = resolveRoutes(module);
    expect(resolved.length).toBe(1);
    expect(resolved[0]?.route).toBe("/data-terms");
  });

  test("a parameterised pattern with no getStaticPaths is a build error", () => {
    // It owns no URLs, so it can never render. Caught where the mistake is,
    // rather than downstream as `undefined` in a path.
    const module: PageModule = {
      pattern: "/card/[slug]",
      page: () => ({ title: "", description: "", children: null }),
    };
    expect(() => resolveRoutes(module)).toThrow(/no getStaticPaths/);
  });

  test("it fans a module out over its paths, in order", () => {
    const module: PageModule<{ slug: string }, { n: number }> = {
      pattern: "/card/[slug]",
      getStaticPaths: () => [
        { params: { slug: "a" }, props: { n: 1 } },
        { params: { slug: "b" }, props: { n: 2 } },
      ],
      page: () => ({ title: "", description: "", children: null }),
    };
    expect(resolveRoutes(module).map((r) => r.route)).toEqual([
      "/card/a",
      "/card/b",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* The document shell                                                          */
/* -------------------------------------------------------------------------- */

describe("the document shell", () => {
  const render = (result: PageResult, route: string) =>
    renderRoute(
      {
        module: { pattern: route, page: () => result },
        path: { params: {}, props: undefined },
        route,
      },
      (r) => Document({ result: r, route, styles: [] }),
    );

  test("EVERY page carries the disclaimer, and a page cannot opt out", () => {
    /*
     * The whole reason the shell emits it rather than a component a page
     * chooses to include. `check-disclaimer.ts` reads built HTML and asserts
     * this against the real output; this asserts it against the renderer, so a
     * regression is caught before a build exists to check.
     */
    const html = render(
      { title: "t", description: "d", children: null },
      "/anything",
    );
    expect(html).toContain(LSS_DISCLAIMER);
  });

  test("EVERY page carries the Impact verification tag, spelled `value`", () => {
    /*
     * Two failures in one assertion, and neither is loud. The tag going
     * missing from a page unverifies the domain the moment Impact re-checks
     * against that URL; the attribute being tidied from `value` to the
     * `content` that HTML actually defines for `<meta>` does the same while
     * looking like a fix. So the literal is spelled here rather than imported
     * from the shell — an assertion against the shell's own constant would
     * agree with any edit made to it.
     */
    const html = render(
      { title: "t", description: "d", children: null },
      "/anything",
    );
    expect(html).toContain(
      '<meta name="impact-site-verification" value="1134ebd0-ee7d-4058-a57f-b6f3da79a0d9"/>',
    );
  });

  test("the canonical is absolute and trailing-slashed", () => {
    // Relative canonicals are ignored by some crawlers, and the site serves
    // directories — so a canonical without the slash names a URL that redirects.
    expect(canonicalFor("/syntax")).toBe("https://optfall.com/syntax/");
    expect(canonicalFor("/syntax/")).toBe("https://optfall.com/syntax/");
  });

  test("a page may point its canonical somewhere else", () => {
    // 6,437 printing pages do exactly this: they are views of a card, and they
    // say so rather than competing with it.
    expect(canonicalFor("/card/omn/243-cf/x", "/card/omn/001/x")).toBe(
      "https://optfall.com/card/omn/001/x/",
    );
  });

  test("it emits a doctype, which React cannot render on its own", () => {
    const html = render({ title: "t", description: "d", children: null }, "/x");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  test("no hydration markers, because no root here hydrates", () => {
    // `renderToStaticMarkup`, not `renderToString`. The pages are documents;
    // interactivity arrives as islands in their own containers. Hydration
    // scaffolding on 12,776 pages would describe a handover that never happens.
    const html = render({ title: "t", description: "d", children: null }, "/x");
    expect(html).not.toContain("data-reactroot");
    expect(html).not.toContain("<!--$-->");
  });
});

/* -------------------------------------------------------------------------- */
/* The registry                                                                */
/* -------------------------------------------------------------------------- */

describe("the route registry", () => {
  test("no two routes resolve to the same file", () => {
    /*
     * The generator throws on this too, at build time. It is asserted here as
     * well because the build's guard only fires when a build runs, and the
     * corpus this site is derived from resyncs on a schedule — the collision
     * would arrive in a pull request nobody expected to be about routing.
     */
    const seen = new Map<string, string>();
    for (const registration of routes) {
      for (const resolved of registration.resolve()) {
        const file = outputPathFor(resolved.route);
        expect(seen.get(file)).toBeUndefined();
        seen.set(file, resolved.route);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  test("every route is an absolute path with no leftover brackets", () => {
    for (const registration of routes) {
      for (const resolved of registration.resolve()) {
        expect(resolved.route.startsWith("/")).toBe(true);
        expect(resolved.route).not.toContain("[");
        expect(resolved.route).not.toContain("undefined");
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The ported pages                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Every route the registry owns, resolved once and shared by the two describes
 * that only need to READ the table.
 *
 * Each of them used to build its own — 12,776 route resolutions twice, which
 * walks the 4,941-card corpus twice for an answer that cannot differ between
 * them. `routes` is a module-scope constant and `resolve()` is pure over it, so
 * one list is not merely cheaper, it is the same list.
 *
 * NOT "ONCE FOR THE WHOLE FILE", which is what this said first and was not
 * true. `describe("the route registry")` calls `resolve()` itself in two tests,
 * and should: what those assert is that resolution produces no duplicate output
 * path and no duplicate route, which is a claim about the ACT of resolving.
 * Handing them a list somebody else already resolved would test the list rather
 * than the function.
 */
const RESOLVED = routes.flatMap((registration) => [...registration.resolve()]);

describe("the ported pages", () => {
  const all = RESOLVED;
  const paths = all.map((resolved) => resolved.route);

  test("every set that carries a card has a page, and none that does not", () => {
    /*
     * ASSERTED FROM THE CORPUS RATHER THAN FROM A NUMBER. This began as a
     * parity check: measured against the real `astro build` when the page was
     * ported, 113 files under `dist/sets` and 113 under `dist-next/sets`. There
     * is only one generator now, so the claim it defends changed from "the two
     * agree" to the thing that made agreement meaningful in the first place —
     * the route table is derived from the corpus and cannot drift from it.
     *
     * Derived here the way the page derives it, so a set gaining or losing its
     * last card moves both sides together.
     */
    const withCards = new Set<string>();
    for (const card of CARDS.cards) {
      for (const printing of card.printings) {
        if (setFor(printing.set_id) !== undefined) {
          withCards.add(printing.set_id.toLowerCase());
        }
      }
    }

    const setRoutes = paths
      .filter((route) => route.startsWith("/sets/"))
      .map((route) => route.slice("/sets/".length));

    expect(setRoutes.toSorted()).toEqual([...withCards].toSorted());
  });

  test("a set code in a URL is lowercase, because a URL is not shouted", () => {
    for (const route of paths) {
      expect(route).toBe(route.toLowerCase());
    }
  });

  test("the pages ported so far are all present", () => {
    // A registry is an explicit list; this is the assertion that it says what
    // the migration thinks it says. Grows by one line per ported page.
    expect(paths).toContain("/data-terms");
    expect(paths).toContain("/syntax");
    expect(paths).toContain("/sets");
  });

  /* ------------------------------------------------------------------------ */

  const monarch = all.find((resolved) => resolved.route === "/sets/mon");
  const monarchHtml =
    monarch === undefined ? "" : monarch.render([], "islands.js");

  /**
   * The island's props, parsed back out of the attribute they cross in.
   *
   * READ FROM THE RENDERED HTML RATHER THAN FROM THE PAGE MODULE, because the
   * attribute is the channel — `Island` serialises with `JSON.stringify` and
   * the client parses what survived React's escaping. A test against the
   * in-memory object would pass on props that cannot make the trip.
   */
  const monarchProps = (() => {
    const match = /data-island="CardList" data-props="(.*?)"/s.exec(
      monarchHtml,
    );
    if (match?.[1] === undefined) return null;
    const decoded = match[1]
      .replaceAll("&quot;", '"')
      .replaceAll("&#x27;", "'")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");
    return JSON.parse(decoded) as {
      entries: {
        label: string;
        href: string;
        faceKey: string | null;
        versions: { pitch: number; href: string; label: string }[];
      }[];
      subject: string;
    };
  })();

  test("a set page shows THAT SET'S printing, not each card's first one", () => {
    /*
     * THE FAILURE WAS SILENT AND IT LOOKED RIGHT, which is the only reason this
     * is worth a test. `page.face` is the card's first printing that publishes
     * art in corpus order, so Monarch's page rendered Monarch's cards wearing
     * Heavy Hitters' and Uprising's art — the right cards, the wrong print run,
     * on the one page whose entire subject IS the print run.
     *
     * 2,239 of the 4,941 cards are printed in more than one set and every one
     * of them has at least one set whose art differs from its default, so this
     * was most of the reprints in the game rather than a long tail.
     */
    expect(monarchProps).not.toBeNull();
    const entries = monarchProps?.entries ?? [];
    expect(entries.length).toBeGreaterThan(100);

    const strays = entries.filter(
      (entry) =>
        entry.faceKey !== null &&
        !entry.faceKey.toUpperCase().startsWith("MON"),
    );
    expect(strays).toEqual([]);
  });

  test("a set page carries a live region, so a page turn is audible", () => {
    /*
     * THE DEFECT THIS IS FOR, AND IT WAS SILENT IN BOTH SENSES. `/search` and
     * `/cr` each render their own `role="status"` paragraph; the set pages
     * never got one. So paging through a set changed four hundred cards and
     * announced nothing at all — the visible count updated, and a visible
     * count is not a live region.
     *
     * ASSERTED ON THE STATIC HTML, because that is where the failure lived: the
     * region has to be in the document BEFORE the text changes, or assistive
     * technology has nothing it was already watching. A region that arrives
     * with its first message is a region that never announces one.
     */
    expect(monarchHtml).toContain('role="status"');
    expect(monarchHtml).toContain('aria-live="polite"');
    expect(monarchHtml).toContain("of-index__announcement");

    /* And the count is the focus target the island aims at after a turn. */
    expect(monarchHtml).toMatch(/class="of-index__count"[^>]*tabindex="-1"/);
  });

  test("a set page without JavaScript still lists every card in the set", () => {
    /*
     * THE PAGER IS A BUTTON, so a reader with scripting off gets the island's
     * server-rendered first page and no way to reach the rest. That would be a
     * regression: this page WAS a complete column of names. So the complete
     * list ships in a `<noscript>`, and this counts it — an anchor per card,
     * not a promise in a comment.
     */
    /*
     * BOTH SIDES ARE PINNED TO A REAL NUMBER FIRST, because otherwise this
     * passes on a page with no list at all. `monarchProps` is `null` when the
     * props regex misses — it depends on `Island` emitting `data-island`
     * immediately before `data-props`, so reordering two attributes is enough
     * — and `null` gives `entries = []`. If the `<noscript>` were also absent
     * that is `expect(0).toBe(0)`, and the test whose whole purpose is "every
     * card is still listed without JavaScript" goes green over a page that
     * lists none of them.
     */
    const entries = monarchProps?.entries ?? [];
    expect(entries.length).toBeGreaterThan(100);

    /*
     * COUNTED IN VERSIONS, NOT IN ROWS, AND THE DIFFERENCE IS THE COLLAPSE.
     * The index above draws one row per NAME — Head Jab red, yellow and blue
     * are one cell with three bands — while this list is the fallback for a
     * reader who cannot page or switch views, so it stays one line per card.
     * Measured on Monarch: 155 rows over 307 cards, and it is the 307 that has
     * to survive the `<noscript>`.
     */
    const versions = entries.flatMap((entry) => entry.versions);
    expect(versions.length).toBeGreaterThan(entries.length);

    const noscript =
      /<noscript>(.*?)<\/noscript>/s.exec(monarchHtml)?.[1] ?? "";
    const anchors = noscript.match(/<a href="\/card\//g) ?? [];
    expect(anchors.length).toBe(versions.length);
  });

  test("the pitch versions of one name are ONE row, with a door each", () => {
    /*
     * THE SCREENSHOT THIS CAME FROM: three consecutive cells of Angelic Wrath
     * on the Local Game Store Promos page, identical art, identical name,
     * identical type line, differing in one coloured band and in a qualifier
     * the index deliberately hides. A player calls those three one card, and
     * `card-search/` has collapsed them on exactly that rule since it was
     * written; this page was where the two surfaces disagreed.
     *
     * WHAT THE COLLAPSE MAY NOT COST is any version's address, which is the
     * half worth asserting: the row is one cell, and every version it stands for
     * is reachable from inside that cell.
     *
     * ASSERTED INSIDE ONE `<li>` RATHER THAN ACROSS THE PAGE, which is stricter
     * than it looks. The old version of this counted captions globally and then
     * checked three hrefs anywhere in the document — so a page that had gone
     * back to rendering three separate cells would have passed every line of it
     * except the caption count. Cutting the cell out first is what makes "one
     * row, with a door each" a single claim instead of two that happen to agree.
     */
    const lgs = all.find((resolved) => resolved.route === "/sets/lgs");
    const html = lgs?.render([], "islands.js") ?? "";
    expect(html).not.toBe("");

    const cells = [...html.matchAll(/<li class="of-index__cell">(.*?)<\/li>/gs)]
      .map((match) => match[1] ?? "")
      .filter((cell) => cell.includes("Angelic Wrath"));
    expect(cells).toHaveLength(1);
    const cell = cells[0] ?? "";

    /* Three cards in the one cell — the front one and the two stacked behind
       it — and three anchors, so every version is a door rather than a
       picture. */
    expect([...cell.matchAll(/<a class="of-index__card/g)]).toHaveLength(3);

    for (const pitch of [1, 2, 3]) {
      expect(cell).toContain(`href="${addressOf(`angelic-wrath-${pitch}`)}"`);
    }

    /* Each named for the CARD and not merely for a pitch value: a fanned face
       carries no text, so its `alt` is all a screen reader has to tell one
       version from the next. The front card is the row itself, so it wears the
       bare name and its type line; the two behind it name their pitch. */
    expect(cell).toContain('alt="Angelic Wrath (pitch 2)"');
    expect(cell).toContain('alt="Angelic Wrath (pitch 3)"');

    /* And the row goes to the name's own version — `/card/angelic-wrath` is a
       301 now, so the row resolves it here rather than sending a reader
       through a hop. It is the pitch-1 card, which is what that URL rendered. */
    expect(cell).toContain(
      `<a class="of-index__card" href="${addressOf("angelic-wrath-1")}"`,
    );
  });

  test("the sets index counts what the set page lists", () => {
    /*
     * TWO PAGES, ONE NUMBER. `/sets` prints a card count per set and
     * `sets.page.tsx` says why it counts cards rather than printings: "a set
     * listing 412 printings beside a page showing 380 rows is two true numbers
     * arguing." Collapsing rows made that argument true again in the other
     * direction — the index would have said 307 for Monarch over a page leading
     * with 155 — so both count NAMES.
     */
    const index = all.find((resolved) => resolved.route === "/sets");
    const indexHtml = index?.render([], undefined) ?? "";
    const monarchRows = monarchProps?.entries.length ?? 0;
    expect(monarchRows).toBeGreaterThan(100);

    /* The row for Monarch in the index names the same count the set page's
       island was handed. */
    const row = /Monarch<\/a>.{0,400}?([\d,]+)\s*cards/s.exec(indexHtml)?.[1];
    expect(row).toBe(monarchRows.toLocaleString("en-GB"));
  });

  test("a set that printed only some versions links to one it printed", () => {
    /*
     * A BARE NAME RESOLVES TO THE CORPUS'S LOWEST-PITCH VERSION, which a set
     * that published only the higher ones does not contain. Aurora prints Spark
     * Spray at pitch 2 and 3: the collapsed row wears AUR022's art and draws two
     * bands, and sending its name to the name's default would open the pitch-1
     * card Aurora never published — on the one page whose whole subject is what
     * this set contains. 23 (set, name) groups in this corpus are that shape.
     *
     * It is the same rule `card-search/` states beside its own `partial` flag,
     * and `set:aur` in the search box already answered `/card/spark-spray-2`.
     */
    const aurora = all.find((resolved) => resolved.route === "/sets/aur");
    const html = aurora?.render([], "islands.js") ?? "";
    expect(html).not.toBe("");

    /* Every Spark Spray link on the page is a version Aurora printed — the
       bare name would resolve to the pitch-1 card, and it is nowhere. */
    const links = html.match(/href="\/card\/[^"]*spark-spray[^"]*"/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    expect(new Set(links)).toEqual(
      new Set([
        `href="${addressOf("spark-spray-2")}"`,
        `href="${addressOf("spark-spray-3")}"`,
      ]),
    );
  });

  test("the set page carries card faces, which it did not before", () => {
    // The whole point of the change, asserted at its coarsest: there are
    // images of cards on a set page. `check-card-notice.ts` separately proves
    // every one of them came from `CardFace` and carries the attribution.
    //
    // NAMED FOR THE CARD RATHER THAN FOR THE CAPTION IT USED TO HAVE. This read
    // `of-index__cell-link` and `of-pitch-rule__band` — the anchor around a
    // face-and-name pair, and the coloured rule under it. The images view has
    // neither now: a cell is a card, and a name's versions are the cards behind
    // it rather than a stripe. So the coarse claim is asserted against what
    // carries it, which is the face itself.
    expect(monarchHtml).toContain("of-index__card");
    expect(monarchHtml).toContain("of-card-face");
  });
});

/* -------------------------------------------------------------------------- */
/* The card page's empty stat sockets                                          */
/* -------------------------------------------------------------------------- */

describe("a card page shows the combat positions it does not fill", () => {
  const all = RESOLVED;
  const render = (route: string) =>
    all.find((resolved) => resolved.route === route)?.render([], undefined) ??
    "";

  /*
   * ASSERTED ON REAL PAGES rather than on a fixture, because the rule is about
   * WHICH cards get sockets and that is a fact about the corpus. Shapes
   * measured across all 4,941 cards: 1,902 print cost+power+defence, 1,363
   * print cost and defence and no power, 525 print defence alone, 151 are
   * heroes printing life and intellect only, 181 print nothing at all.
   */

  test("an action with no attack draws the power plate, empty", () => {
    /* `Absorb in Aether` is a Wizard Defense Reaction: cost and defence, no
       power. The 1,363-card case, and the reason for the change. */
    const html = render(addressOf("absorb-in-aether-1"));
    expect(html).not.toBe("");
    expect(html).toContain('aria-label="No printed power"');
    /* The plate it drew is still the POWER plate — the silhouette is what says
       which stat is missing. */
    expect(html).toContain("of-stat--power");
  });

  test("equipment draws cost and power empty, because the frame has them", () => {
    /* `Aether Ironweave` is Runeblade Equipment: defence only. */
    const html = render(addressOf("aether-ironweave"));
    expect(html).not.toBe("");
    expect(html).toContain('aria-label="No printed cost"');
    expect(html).toContain('aria-label="No printed power"');
  });

  test("a hero gets no sockets, because it has no combat positions", () => {
    /*
     * THE LIMIT ON THE RULE, and why it is not "always draw three". A hero
     * prints life and intellect; cost, power and defence are not values it is
     * missing but positions its frame does not have. Three dashes on a hero
     * would be inventing slots rather than reporting an absence.
     */
    /*
     * THE ADDRESS COMES FROM `CARD_PAGES`, NOT FROM SLUGGING THE NAME HERE.
     * Re-implementing it diverges from `slugify`'s NFKD and transliteration
     * pass — an apostrophe becomes `-` in a naive version and vanishes in the
     * real one — and the failure is SILENT: a hero sharing its name with
     * another card lives under `<slug>-<pitch>`, so a hand-built path would
     * miss the page entirely — and there is no `/card/<slug>` left to land on
     * by accident either, since that form is a redirect now. Every
     * assertion below would then pass against a page that could never have
     * carried a socket.
     */
    const hero = CARD_PAGES.find(
      (page) =>
        page.card.health !== "" &&
        page.card.intelligence !== "" &&
        page.card.cost === "" &&
        page.card.power === "" &&
        page.card.defense === "",
    );
    expect(hero).toBeDefined();

    const html = render(hero?.href ?? "");
    /* Not the disambiguation page and not nothing: this has to be the card. */
    expect(html).toContain("of-card__name");
    expect(html).not.toContain("No printed cost");
    expect(html).not.toContain("No printed power");
    expect(html).not.toContain("No printed defence");
  });

  test("a weapon draws cost and defence empty, and that is a decision", () => {
    /*
     * 81 cards print power and nothing else. They get the trio for the same
     * reason the 525 equipment cards do — "this card has no cost" is a fact
     * worth stating about a card you never pay for — and the case is pinned
     * here because it is the one somebody will want to move: both are
     * permanents, and it is arguable their printed frames carry no cost bubble
     * at all. A card printing LIFE is where the line actually falls; see the
     * ally test below.
     */
    /* `intelligence` is constrained as well as `health`, because
       `usesCombatFrame` rejects a card printing EITHER permanent stat. No card
       prints intellect without life today, so leaving it out passed — but a
       resync introducing one that sorted earlier would fail this test on
       "No printed cost" with nothing saying it was disqualified by intellect. */
    const weapon = CARD_PAGES.find(
      (page) =>
        /* A DIGIT, not merely non-empty. `Plasma Barrel Shot` prints power `X`
           and satisfies every other clause; it sorts after a numeric match
           today, so the `Power \d+` assertion below passes by luck. Upstream
           prints `X`, `XX` and `*` — that is why `value` is a string — so a
           resync could turn this red for a reason with nothing to do with
           sockets. */
        /^\d+$/.test(page.card.power) &&
        page.card.cost === "" &&
        page.card.defense === "" &&
        page.card.health === "" &&
        page.card.intelligence === "",
    );
    expect(weapon).toBeDefined();

    const html = render(weapon?.href ?? "");
    expect(html).toContain("of-card__name");
    expect(html).toContain('aria-label="No printed cost"');
    expect(html).toContain('aria-label="No printed defence"');
    expect(html).toMatch(/aria-label="Power \d+"/);
  });

  test("a cost-only card draws both of the positions it leaves empty", () => {
    /*
     * THE LARGEST GROUP THE RULE ADMITS, and the one an earlier draft of the
     * rationale never named: 409 cards print a cost and nothing else — items,
     * instants, tokens. They get an empty attack plate AND an empty defence
     * shield, which is two sockets from one printed value.
     *
     * Pinned as an explicit decision rather than left as a side effect of
     * "prints a combat stat and no permanent one". It is the same call as
     * equipment and weapons: the positions exist on the frame and the card
     * leaves them empty, which is a fact worth drawing.
     */
    const costOnly = CARD_PAGES.find(
      (page) =>
        page.card.cost !== "" &&
        page.card.power === "" &&
        page.card.defense === "" &&
        page.card.health === "" &&
        page.card.intelligence === "",
    );
    expect(costOnly).toBeDefined();

    const html = render(costOnly?.href ?? "");
    expect(html).toContain("of-card__name");
    expect(html).toContain('aria-label="No printed power"');
    expect(html).toContain('aria-label="No printed defence"');
    expect(html).not.toContain("No printed cost");
  });

  test("an ally gets no sockets either, because its frame is not that frame", () => {
    /*
     * THE SHAPE THE FIRST VERSION OF THIS RULE MISSED, and the reason the test
     * for it is a `describe` of its own rather than a line in the hero one. 198
     * cards print life and only 154 are heroes; the other 44 are allies,
     * angels, dragons, demons and token creatures. `Aegis, Archangel of
     * Protection` prints power and life and nothing else, so a rule reading
     * "prints any combat stat" qualified it on the power and handed it an empty
     * cost bubble and an empty defence shield — the latter immediately left of
     * the life plate, since `CORNER_FOR` puts both at `end`. An absence
     * asserted in the exact corner the card prints life in.
     */
    const ally = CARD_PAGES.find(
      (page) =>
        page.card.health !== "" &&
        page.card.intelligence === "" &&
        /* A digit, for the reason the weapon probe gives: the assertion below
           reads `Power \d+`, and upstream prints `X`, `XX` and `*`. */
        /^\d+$/.test(page.card.power),
    );
    expect(ally).toBeDefined();

    const html = render(ally?.href ?? "");
    expect(html).toContain("of-card__name");
    expect(html).not.toContain("No printed cost");
    expect(html).not.toContain("No printed defence");
    /* And it still shows what it DOES print. */
    expect(html).toMatch(/aria-label="Power \d+"/);
  });

  test("a printed zero is still a printed zero", () => {
    /*
     * The distinction from the other side. 1,648 cards print a cost of 0, and
     * rendering those as absences would have replaced one wrong answer with
     * another.
     *
     * IT HAS TO BE A CARD THAT ACTUALLY PRINTS 0, which the first version was
     * not: it matched `Cost \d+` against a card costing 1, so it passed however
     * a zero rendered and could not fail for the regression its own comment
     * described. Found from the corpus rather than hard-coded, so it cannot
     * drift onto a card whose printed cost changes under it.
     */
    const zero = CARD_PAGES.find(
      (page) =>
        page.card.cost === "0" &&
        page.card.health === "" &&
        page.card.intelligence === "" &&
        page.card.power === "",
    );
    expect(zero).toBeDefined();

    const html = render(zero?.href ?? "");
    expect(html).toContain("of-card__name");
    /* The zero is drawn as a zero… */
    expect(html).toContain('aria-label="Cost 0"');
    expect(html).not.toContain("No printed cost");
    /* …on the same page where a real absence is drawn as one, which is exactly
       the pair this change exists to keep apart. */
    expect(html).toContain('aria-label="No printed power"');
  });
});

/* -------------------------------------------------------------------------- */
/* The last crumb                                                             */
/* -------------------------------------------------------------------------- */

describe("a card's breadcrumb ends in the fact that crumb is for", () => {
  const render = (route: string) =>
    RESOLVED.find((resolved) => resolved.route === route)?.render(
      [],
      undefined,
    ) ?? "";

  const crumbsIn = (html: string) =>
    /<ol class="of-card__crumbs">.*?<\/ol>/s.exec(html)?.[0] ?? "";

  test("a disambiguated card ends in its stone, named by the whole label", () => {
    /*
     * THE TRAIL USED TO SAY THE NAME TWICE — "Head Jab › Head Jab (pitch 1)" —
     * with the one fact distinguishing the two crumbs spelled out in
     * parentheses at the end. The stone is that fact, in the silhouette the
     * page already reserves for it.
     *
     * THE LABEL IS THE HALF A TEST HAS TO HOLD. `PitchJewel` falls back to
     * speaking its numeral, so dropping `label` would leave the page
     * pixel-identical, keep every other test green, and rename the current-page
     * crumb to "Pitch 1" on every disambiguated card — a crumb that no longer
     * names the page, and the WCAG 2.4.4 hazard `labelFor` exists to prevent.
     */
    const crumbs = crumbsIn(render(addressOf("head-jab-1")));
    expect(crumbs).not.toBe("");
    expect(crumbs).toContain('aria-label="Head Jab (pitch 1)"');
    /* And the name is not printed a second time beside it. */
    expect(
      crumbs.replace(/aria-label="[^"]*"/g, "").match(/Head Jab/g),
    ).toEqual(["Head Jab"]);
  });

  test("a card whose name identifies it keeps the name", () => {
    /* There is no name crumb above it to avoid repeating, and its pitch — which
       may be none at all — is not what tells it apart from anything. */
    const crumbs = crumbsIn(render(addressOf("crouching-tiger")));
    expect(crumbs).toContain("Crouching Tiger");
    expect(crumbs).not.toContain("of-jewel");
  });

  test("a no-pitch version still gets a stone, and it says so", () => {
    /*
     * `hyper-driver` is the one group in the corpus disambiguated by an ABSENCE
     * — a pitch-0 token sharing its name with three pitched actions — so the
     * crumb is the grey stone with a dash, and the label is what carries the
     * distinction to anything reading it aloud.
     */
    const crumbs = crumbsIn(render(addressOf("hyper-driver-0")));
    expect(crumbs).toContain('aria-label="Hyper Driver (no pitch)"');
    expect(crumbs).toContain("of-jewel--tone-none");
  });
});

/* -------------------------------------------------------------------------- */
/* The version tabs, which move between pitches and nothing else              */
/* -------------------------------------------------------------------------- */

describe("the pitch tabs stay in the set the reader is already in", () => {
  const render = (route: string) =>
    RESOLVED.find((resolved) => resolved.route === route)?.render(
      [],
      undefined,
    ) ?? "";

  /** Where each version tab goes, in the strip's order. The current one is not
      a link, so it is deliberately absent. */
  const tabsIn = (html: string) =>
    [
      ...(
        /<nav class="of-card__versions".*?<\/nav>/s.exec(html)?.[0] ?? ""
      ).matchAll(/<a class="of-card__version-tab" href="([^"]+)"/g),
    ].map((tab) => tab[1] ?? "");

  test("a version printed in this set is reached at its address in this set", () => {
    /*
     * HEAD JAB IS PRINTED THREE PITCHES WIDE IN SIX SETS, so a reader on the
     * Welcome to Rathe printing asking for pitch 2 is asking for WTR099 — the
     * card in the same box, four numbers along. The tabs used to send them to
     * `ben/017`: a different set, a different art and a different number, for a
     * click that asked to change one thing.
     *
     * THE ALTERNATE ART IS WHERE THIS MOSTLY BITES, WHICH IS WHY THE TEST
     * NAMES ONE. A card and its siblings usually share the set they are first
     * listed in, so the default page's tabs were already in the right box:
     * measured, 1,982 of the 2,601 pages this rule moves are non-default
     * printings. The other 619 are default pages whose sibling's default sat in
     * a different set, which is the same fault in a place a reader is likelier
     * to be.
     */
    const tabs = tabsIn(render("/card/wtr/098/head-jab-1"));
    expect(tabs).toEqual([
      "/card/wtr/099/head-jab-2",
      "/card/wtr/100/head-jab-3",
    ]);
  });

  test("a version that set never printed falls back to its own address", () => {
    /*
     * `ira` PRINTS THE PITCH 3 HEAD JAB AND NEITHER OF THE OTHER TWO, which is
     * the ordinary case rather than the corner one: a set is free to publish
     * one version of a name. So "the same set" is a preference, and the tab
     * still has to go somewhere — the version's default address, which is what
     * every tab pointed at before this rule existed.
     */
    const tabs = tabsIn(render("/card/ira/008/head-jab-3"));
    expect(tabs).toEqual([addressOf("head-jab-1"), addressOf("head-jab-2")]);
  });

  test("the tabs are the same set on every art of one printing's set", () => {
    /*
     * TWO EDITIONS, ONE SET. `wtr/u-wtr098` is the Unlimited art of the card
     * whose Alpha art is `wtr/098`, and both are WTR — so both strips offer
     * WTR's other pitches. The set is what a tab preserves; which art of it the
     * other version opens on is that set's own default, the same one its set
     * page links to.
     */
    expect(tabsIn(render("/card/wtr/u-wtr098/head-jab-1"))).toEqual(
      tabsIn(render("/card/wtr/098/head-jab-1")),
    );
  });

  test("every tab on every page addresses a card the site actually serves", () => {
    /*
     * THE FAILURE THIS RULE COULD INTRODUCE IS A TAB POINTING AT NOTHING —
     * a same-set address assembled from the wrong card's slug or the wrong
     * face's number is still a well-formed URL, and a 404 on the one control
     * that exists to move between versions. Checked against the router's own
     * table.
     *
     * OVER ROUTES RATHER THAN OVER CARDS, which is the half that matters: on a
     * card's default printing "the same set" and "the default address" are
     * usually the same answer, so a sweep of the 4,941 default pages would
     * exercise the fallback and not the rule. The stride is coarser to pay for
     * the larger list — 11,378 printings, every twenty-fifth.
     */
    const served = new Set(CARD_ROUTES.map((route) => route.href));
    for (const route of CARD_ROUTES.filter((_, index) => index % 25 === 0)) {
      for (const href of tabsIn(render(route.href))) {
        expect(served.has(href)).toBe(true);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The printings table, which is the picker now                               */
/* -------------------------------------------------------------------------- */

describe("the printings table is how a reader reaches another art", () => {
  const render = (route: string) =>
    RESOLVED.find((resolved) => resolved.route === route)?.render(
      [],
      undefined,
    ) ?? "";

  const tableIn = (html: string) =>
    /<table class="of-card__printings">.*?<\/table>/s.exec(html)?.[0] ?? "";

  /** Every collector-number link in the table: its accessible name and target. */
  const numbersIn = (html: string) =>
    [
      ...tableIn(html).matchAll(/<a href="(\/card\/[^"]+)"[^>]*>(.*?)<\/a>/gs),
    ].map((link) => ({
      href: link[1] ?? "",
      spoken: (link[2] ?? "").replace(/<[^>]+>/g, "").trim(),
    }));

  test("a row's number opens the art that row is published with", () => {
    /*
     * THE RAIL OF THUMBNAILS IS GONE AND THIS IS WHERE IT WENT. A tile could
     * caption three facts about a printing; this row names seven of them in
     * columns, and the number is the link. Head Jab is printed in seven places
     * and its Welcome to Rathe entry is two different arts under one number.
     */
    const html = render(addressOf("head-jab-1"));
    expect(html).not.toBe("");
    expect(html).not.toContain("of-picker");

    const numbers = numbersIn(html);
    expect(numbers.length).toBeGreaterThan(5);
    /* EVERY row addresses its own art, the first one included — there is no
       "the card's page" left for face 0 to be. */
    expect(numbers.map((link) => link.href)).toContain(addressOf("head-jab-1"));
    expect(numbers.map((link) => link.href)).toContain(
      "/card/wtr/u-wtr098/head-jab-1",
    );
  });

  test("two arts under one number are told apart, inaudibly to the eye", () => {
    /*
     * THE FAILURE THE LINKS INTRODUCED, AND THE FIX. Upstream publishes two
     * printings under one collector number whenever a set had two editions —
     * `WTR098` is Alpha and Unlimited, two different pieces of art — so both
     * rows carried an anchor reading "WTR098" pointing somewhere different.
     * That is WCAG 2.4.4, and it was 6,726 card pages the moment the numbers
     * became links.
     *
     * The qualifier is hidden, so the table still reads as bare numbers.
     */
    const html = render(addressOf("head-jab-1"));
    const spoken = numbersIn(html).map((link) => link.spoken);
    expect(spoken).toContain("WTR098 (Alpha)");
    expect(spoken).toContain("WTR098 (Unlimited)");

    /* Visibly, both are just the number. */
    const visible = tableIn(html)
      .replace(/<span class="of-card__visually-hidden">[^<]*<\/span>/g, "")
      .replace(/<[^>]+>/g, " ");
    expect(visible).not.toContain("(Alpha)");
  });

  test("where edition cannot separate two arts, something else does", () => {
    /*
     * `DYN088` IS THE CASE THAT BROKE THE FIRST RULE. Both of its arts are
     * edition `N`, so edition separates nothing; foiling separates the ROWS and
     * not the ADDRESSES, because Standard and Rainbow Foil are one picture. The
     * art's own key is the backstop — it is what the URL is built from — and it
     * is left off the row whose key is already the number, which would
     * otherwise be announced as "DYN088 DYN088".
     */
    const spoken = numbersIn(render(addressOf("hanabi-blaster"))).map(
      (link) => link.spoken,
    );
    expect(new Set(spoken)).toEqual(new Set(["DYN088", "DYN088 (DYN088-MV)"]));
  });

  /*
   * THE SAME RULE, FOR THE COLUMN THAT LEAVES THE SITE. `numbersIn` matches
   * `href="/card/…"` only, so it is structurally blind to the buy links — and a
   * buy link is the one place where two rows can share an ADDRESS (Standard and
   * Rainbow Foil are one art, so one page) while addressing two different
   * PRODUCTS. That is the axis `numberQualifier` does not cover.
   */
  /**
   * The nth cell of every body row, counting the row header as cell 0.
   *
   * Columns are Number, Set, Rarity, Edition, Foiling, Artist, Other face — so
   * `cellsAt(html, 3)` is Edition. There was a Buy column on the end until the
   * buy links became a section of their own — and that section has since gone
   * too, leaving one button under the face. Neither removal moved any index the
   * callers here use, which is precisely why a wrong map would have gone
   * unnoticed. Positional rather than pattern-matched
   * because a cell's contents vary (`Set` holds an anchor, `Edition` holds bare
   * text or a dash) and a regex counting `</td>`s lazily reads a different
   * column on different rows.
   */
  const cellsAt = (html: string, index: number) =>
    [...tableIn(html).matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)]
      .map((row) =>
        [...(row[1] ?? "").matchAll(/<t([hd])[^>]*>(.*?)<\/t\1>/gs)].map(
          (cell) => cell[2] ?? "",
        ),
      )
      .filter((cells) => cells.length > index)
      .map((cells) => cells[index] ?? "");

  /*
    THE WHOLE PAGE, NOT THE TABLE, and it has twice been a different part of the
    page. Buy links were the printings table's eighth column, then a section of
    their own plus one button under the card face; the section is gone and that
    button is all that is left. Scoping this to `tableIn` would have quietly
    matched nothing and passed every assertion below by vacuity, which is why the
    tests that use it also assert a count.

    IT STILL SCANS THE WHOLE PAGE THOUGH THERE IS ONE LINK TO FIND. That is the
    point: the count assertion below is what would catch a second buy link
    arriving somewhere — and a second one is not a small change, because the
    disclosure's "exactly once" rule and the argument for a bare unqualified
    label both rest on there being only this one.
  */
  const buysIn = (html: string) =>
    [
      ...html.matchAll(
        /<a class="of-icon-button" href="([^"]+)"[^>]*>(.*?)<\/a>/gs,
      ),
    ].map((link) => ({
      href: link[1] ?? "",
      spoken: (link[2] ?? "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    }));

  test("a card page carries at most one buy link", () => {
    /*
     * THE INVARIANT THE REST OF THIS BLOCK NOW RESTS ON. There was a "Buy"
     * section listing a row per purchasable printing; it is gone, and what is
     * left is the button under the face. Two things downstream assume that and
     * would be wrong without it: the disclosure is asserted to appear exactly
     * once, and `faceBuyLabel` no longer disambiguates its name against any
     * other link on the page because there is no other link to collide with.
     *
     * WRITTEN AS A TEST RATHER THAN TRUSTED, because it is the kind of fact a
     * later change breaks incidentally — a second placement is one JSX line,
     * and nothing else here would fail loudly when it lands.
     */
    for (const page of CARD_PAGES.filter((_, index) => index % 12 === 0))
      expect(buysIn(render(page.href)).length).toBeLessThan(2);
  });

  test("a buy link names the edition, not just the number and foiling", () => {
    /*
     * WTR098 IS STILL THE CASE, AND IT MOVED FROM TWO ROWS TO TWO PAGES. Head
     * Jab's Welcome to Rathe printing exists in Alpha and Unlimited, both
     * Standard, under one collector number. That used to be two rows of a "Buy"
     * section, and this test read them off one page and required them to differ.
     * With the section gone there is one buy link per page — so the same pair is
     * now two pages, and the assertion is that THEY differ.
     *
     * IT IS A SHARPER TEST THAN THE ONE IT REPLACES, which is worth saying
     * because a rewritten test usually is not. These two printings share a
     * `tcgplayer_product_id` (225142) as well as a number and a foiling, so the
     * old "two names, two addresses" check could not have caught a label that
     * dropped the edition here — the addresses are identical. The edition is
     * the only thing that distinguishes them anywhere on either page.
     *
     * THE ADDRESSES ARE SPELLED OUT for the reason the note on `addressOf`
     * gives: these tests are about two specific arts, so "whichever alternate
     * comes first" would quietly make them about something else.
     */
    const alpha = buysIn(render("/card/wtr/098/head-jab-1"));
    const unlimited = buysIn(render("/card/wtr/u-wtr098/head-jab-1"));

    expect(alpha).toHaveLength(1);
    expect(unlimited).toHaveLength(1);

    /* Anchored on `editionLabel` rather than on the words, so a rename upstream
       fails this test instead of silently passing it — and asserted non-null
       first, because `editionLabel` returns `null` for an edition it declines
       to name and "contains null" is not the check anybody wants. */
    const alphaEdition = editionLabel("A");
    const unlimitedEdition = editionLabel("U");
    expect(alphaEdition).not.toBeNull();
    expect(unlimitedEdition).not.toBeNull();

    expect(alpha[0]?.spoken).toContain(String(alphaEdition));
    expect(unlimited[0]?.spoken).toContain(String(unlimitedEdition));
    expect(alpha[0]?.spoken).not.toBe(unlimited[0]?.spoken);
  });

  test("a buy link never speaks an empty segment", () => {
    /*
     * DISTINCTNESS IS NOT WELL-FORMEDNESS, and this test exists because the
     * first version of the check above could not tell the difference. The name
     * is assembled from optional parts, and `editionLabel` returns `null` —
     * not `undefined` — for `N`, the commonest edition in the corpus. A filter
     * that dropped only `undefined` produced "buy MST131, , Standard", which
     * is perfectly distinct from its siblings and perfectly broken.
     *
     * The whole corpus at the usual stride, because the bug was on 11,551 of
     * 16,502 printings and a narrow sample would still have found it — the
     * point is that nothing narrow was looking.
     */
    for (const page of CARD_PAGES.filter((_, index) => index % 12 === 0)) {
      for (const link of buysIn(render(page.href))) {
        expect(link.spoken).not.toContain(", ,");
        expect(link.spoken).not.toContain(",,");
        expect(link.spoken).not.toMatch(/,\s*,/);
        expect(link.spoken).not.toMatch(/buy\s*,/);
      }
    }
  });

  /*
    A THIRD TEST STOOD HERE — "no card page names two buy links alike and sends
    them elsewhere" — and it is gone rather than kept, which is the one deletion
    in this block worth arguing for.

    It walked every buy link on a page, grouped them by spoken name, and failed
    where one name reached two addresses. That is WCAG 2.4.4, and it was a real
    check while a page carried a row per purchasable printing. A page carries
    one buy link now. The test could still be run and would pass on every page
    in the corpus, for the same reason it would pass on a page with no links at
    all: there is no second name for the first one to collide with.

    KEEPING IT WOULD HAVE BEEN WORSE THAN DELETING IT. A test that cannot fail
    reads, to the next person, as coverage of the rule it names — so the rule
    looks guarded when nothing is guarding it. What actually guards it now is
    the count assertion above: two buy links on one page is the condition under
    which this test had teeth, and that is the thing now asserted not to happen.
  */

  test("the disclosure appears only where there are buy links", () => {
    /*
     * A CLAIM ON A PAGE MUST BE TRUE OF THAT PAGE. A card whose every printing
     * is a promo has no purchase links at all, and a notice describing links
     * that are not there is exactly the kind of confidently-wrong sentence this
     * project exists to not print.
     *
     * THE LINK IS THE GATE NOW, AND IT HAS BEEN THREE THINGS. It started as a
     * `hasBuyLinks` boolean computed in `CardEntry` and handed down to gate a
     * paragraph under the printings table — two passes over one predicate, and
     * two places for it to disagree. Then the "Buy" section derived the list it
     * was about to render and returned `null` when it was empty. That section
     * is gone: the face button and this sentence are now inside one branch on
     * one `faceBuyHref`, so there is a single predicate and the disclosure
     * cannot outlive the link.
     */
    for (const page of CARD_PAGES.filter((_, index) => index % 12 === 0)) {
      const html = render(page.href);
      expect(html.includes("Buy links go to TCGplayer")).toBe(
        buysIn(html).length > 0,
      );
      /* And exactly once — an assertion that outlived the reason it was
         written. It guarded against the sentence appearing under the "Buy"
         section AND again beside the face button, on the argument that printing
         it twice is not more conspicuous, it is the noise that teaches a reader
         to skip a disclosure. There is one link now and the sentence sits beside
         it, so what this catches is a second copy arriving from anywhere. */
      expect(html.split("Buy links go to TCGplayer").length - 1).toBeLessThan(
        2,
      );
    }
  });

  test("no card page names two printings alike and sends them elsewhere", () => {
    /*
     * THE WHOLE CORPUS, at the stride the related-lists test uses and for the
     * same reason: corpus order is a name sort, so a prefix is the letter A.
     * A full scan of the built site is clean — 6,726 pages before the hidden
     * qualifier, zero after — and this is the guard that keeps it so.
     */
    for (const page of CARD_PAGES.filter((_, index) => index % 12 === 0)) {
      const byName = new Map<string, Set<string>>();
      for (const link of numbersIn(render(page.href))) {
        const found = byName.get(link.spoken) ?? new Set<string>();
        found.add(link.href);
        byName.set(link.spoken, found);
      }
      for (const [spoken, hrefs] of byName)
        if (hrefs.size > 1)
          expect(`${page.href}: ${spoken} -> ${[...hrefs].join(", ")}`).toBe(
            `${page.href}: one destination`,
          );
    }
  });

  test("the marked row IS the page, and says the strong thing", () => {
    /*
     * THIS TEST USED TO ASSERT THE OPPOSITE, AND THE REASON EXPIRED.
     * `/card/head-jab` rendered the first version's card at a URL of its own,
     * so the row whose art was shown addressed a DIFFERENT page and
     * `aria-current="page"` would have told a screen reader the link led where
     * the reader already was. `"true"` — current item, unspecified — was the
     * only value true on every route.
     *
     * Every route is a printing now and the marked row's href is the URL being
     * rendered, on every one of the 11,378. So the accurate value is `"page"`,
     * and that is the one a screen reader announces as *this page*.
     *
     * ASSERTED ON BOTH A DEFAULT AND AN ALTERNATE, because "the row addresses
     * itself" is exactly the claim that used to be false on one route shape
     * and true on the others.
     */
    for (const route of [
      addressOf("head-jab-1"),
      "/card/lgs/017-rf/head-jab-1",
    ]) {
      const table = tableIn(render(route));
      expect(`${route}: ${table === ""}`).toBe(`${route}: false`);
      expect(table).not.toContain('aria-current="true"');

      const marked = [...table.matchAll(/aria-current="page"/g)];
      expect(`${route}: ${marked.length}`).toBe(`${route}: 1`);

      /* And it marks the row that addresses THIS url, not merely some row. */
      expect(table).toContain(`href="${route}" aria-current="page"`);
    }
  });

  test("a printing with no edition says so with a dash, not a sentence", () => {
    /*
     * `N` IS UPSTREAM EXPLAINING AN ABSENCE AT LENGTH: "No specified edition
     * (used for promos, non-set releases, etc.)", 60 characters, and the
     * commonest edition in the corpus — printed in full on most rows of most
     * cards, in a column whose question it does not answer.
     *
     * ASSERTED ON THE WHOLE PAGE, not on the cell, because the same decode
     * reached the set page's masthead: a promo set's line read "Editions: No
     * specified edition (used for promos, non-set releases, etc.)", which is a
     * set saying it has no editions in the most words available.
     */
    const html = render(addressOf("head-jab-1"));
    expect(html).not.toContain("No specified edition");

    /*
     * ANCHORED ON THE EDITION CELL, NOT ON ANY EM DASH ON THE PAGE. The Buy
     * column renders `<td>—</td>` for the 1,336 productless printings, which
     * satisfied a bare `toContain("<td>—</td>")` regardless of what the Edition
     * cell did — so adding that column silently disarmed the regression this
     * test was written for. The dash is now located: it is the fourth cell of a
     * row, which is Edition.
     */
    const editionCells = cellsAt(html, 3);
    expect(editionCells.length).toBeGreaterThan(1);
    expect(editionCells).toContain("—");
    /* The same column, not some other one that also holds a dash. */
    expect(editionCells).toContain("Alpha");

    /* And a real edition still decodes: Head Jab's Welcome to Rathe rows. */
    expect(tableIn(html)).toContain("<td>Alpha</td>");
    expect(tableIn(html)).toContain("<td>Unlimited</td>");
  });

  test("the row being shown is marked, and a face-less printing is not a link", () => {
    /*
     * A CONTROL THAT CANNOT SAY WHICH OPTION IS SELECTED IS A LIST OF LINKS.
     * The rail said it with an accent outline; the row says it with
     * `aria-current`, which is announced rather than only drawn.
     *
     * `"page"` RATHER THAN `"true"`, and the assertion below names the value on
     * purpose. It was `"true"` while `/card/<name>` existed — that page rendered
     * the first version's card, so its marked row pointed somewhere else and the
     * stronger claim would have been a lie. Every route addresses itself now.
     * See the test below it.
     *
     * AND FOUR PRINTINGS IN THIS CORPUS PUBLISH NO IMAGE, so there is no page
     * for their number to open. `Toughness`'s `SUP241` is one: its row keeps
     * every other column and carries no anchor.
     */
    const table = tableIn(render("/card/lgs/017-rf/head-jab-1"));
    expect([...table.matchAll(/aria-current="page"/g)]).toHaveLength(1);
    expect(table).toMatch(
      /<tr class="of-card__printing--shown">.*?LGS017.*?<\/tr>/s,
    );

    const faceless = tableIn(render(addressOf("toughness")));
    expect(faceless).toContain("SUP241");
    expect(faceless).not.toMatch(/<a[^>]*>\s*SUP241/);
  });

  test("the scroller keeps the table's measure floor off the document", () => {
    /*
     * THE OTHER HALF OF A RULE THAT READ AS IF IT ALREADY DID THIS.
     *
     * `.of-card__printings` takes a `min-inline-size` of one measure so that a
     * seven-column table on a phone degrades into a sideways scroll rather than
     * into a column of single words. `.of-card__scroller` is the box that floor
     * is supposed to be trapped inside, and for as long as that rule existed it
     * was not: the box scrolled internally AND the document scrolled sideways,
     * 376px of empty ground beside every card page with printings, at 320, 360,
     * 390 and 430. It shipped to production that way.
     *
     * `overflow-x` alone does not do it and `contain` is what does, which is
     * precisely the kind of fact a stylesheet states once and nothing checks.
     * Asserted here for the same reason the `@container` test below exists:
     * markup cannot show it, jsdom computes no layout, so deleting the
     * declaration would restore the bug with the whole suite green.
     *
     * On `contain` rather than on the exact value: `layout` fixes it
     * identically, so pinning `paint` would fail a legitimate change for
     * disagreeing about a synonym. `inline-size` would NOT fix it — it sizes
     * the box instead of clipping the overflow — so it is named as excluded.
     */
    const css = readFileSync(
      new URL("./components/CardEntry.css", import.meta.url),
      "utf-8",
    );
    const scroller = /\.of-card__scroller\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(scroller).toContain("overflow-x: auto");
    expect(scroller).toMatch(/contain:\s*(paint|layout)/);

    /* The floor this is containing. If it ever goes, this test is measuring
       nothing and should be reconsidered rather than quietly left passing. */
    expect(css).toMatch(
      /\.of-card__printings\s*\{[^}]*min-inline-size:\s*var\(--of-type-measure\)/,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* The credit line                                                             */
/* -------------------------------------------------------------------------- */

describe("the credit line spaces every fact, not a clump", () => {
  const render = (route: string) =>
    RESOLVED.find((resolved) => resolved.route === route)?.render(
      [],
      undefined,
    ) ?? "";

  const footerOf = (html: string) =>
    html.match(
      /<footer class="of-card__band of-card__band--credits">(.*?)<\/footer>/s,
    )?.[1] ?? "";

  /**
   * ASSERTED ON THE CHILD COUNT, WHICH IS THE THING THAT WAS WRONG.
   *
   * `justify-content: space-between` was already on the footer and was already
   * correct; what made the line read as a clump plus a count was that rarity
   * and the artist shared a paragraph, so the rule had two children to
   * distribute instead of three. A test of the CSS declaration would have been
   * green throughout the bug. The count is the fact.
   */
  /*
    MATCHED ON THE CLASS PREFIX, NOT THE WHOLE ATTRIBUTE, because the footer
    grew a kind of item whose class list carries modifiers — the other face, on
    a double-faced printing. An exact `class="of-card__credit"` match would have
    gone on reporting fewer items than the line shows, which is a test that
    stops describing the thing it is named after.
  */
  const creditsIn = (html: string) =>
    [...footerOf(html).matchAll(/<p class="of-card__credit[ "]/g)].length;

  test("rarity, citation and artist are three siblings", () => {
    const html = render(addressOf("adaptive-plating"));
    expect(html).toContain("of-card__band--credits");
    expect(creditsIn(html)).toBe(3);

    /* And they are in reading order: what grade, which printing, who drew it. */
    const footer = footerOf(html);
    expect(footer.indexOf("of-card__rarity")).toBeLessThan(
      footer.indexOf("of-card__printing-code"),
    );
    expect(footer.indexOf("of-card__printing-code")).toBeLessThan(
      footer.indexOf("Illustrated by"),
    );
  });

  /*
    THE COUNT IS GONE, AND THIS IS THE TEST THAT SAYS SO. Three assertions above
    used to pin an `N printings` anchor into this footer — its position, its
    presence on every page, and the child count that included it. Deleting them
    would have left the removal unasserted, so the claim they made is inverted
    here rather than dropped: nothing in the credit line points at the table.
  */
  test("the credit line does not link the printings table", () => {
    const footer = footerOf(render(addressOf("adaptive-plating")));
    expect(footer).not.toContain('href="#printings"');
    /* Not "no anchor at all": the set and the other face are both links down
       here. The one that pointed at this page's own table is what is gone. */
    expect(footer).not.toContain("#printings");
  });

  test("the citation names the set and only the set is a link", () => {
    /*
     * `Bright Lights #013`, NOT `EVO013` AND NOT `Bright Lights #EVO013`. Two
     * ways to get this wrong and the markup rules out both: the anchor carries
     * the set's NAME, which is what makes the link a name rather than a lookup;
     * and the number is sliced at its own set prefix rather than printed whole,
     * because upstream already concatenated the code onto it.
     */
    const footer = footerOf(render(addressOf("adaptive-plating")));
    expect(footer).toContain(
      '<span class="of-card__printing-code"><a href="/sets/evo">' +
        "Bright Lights</a> " +
        '<span class="of-card__printing-number">#013</span></span>',
    );

    /* The number is not inside the anchor: it names a position in a set and
       has nowhere of its own to go. */
    expect(footer).not.toMatch(/<a href="\/sets\/evo">[^<]*013/);
  });

  test("the citation names the printing on screen, on every route", () => {
    /*
     * THE SAME RULE THE RARITY FOLLOWS, AND FOR THE SAME REASON: a page shows
     * one printing, so the caption under the picture states THAT printing's
     * number. A per-art route is where this can go wrong — the code came off
     * `card.printings[0]` in an early pass and captioned every art of a card
     * with the first one's number.
     *
     * ASSERTED ON THE ROUND TRIP, NOT ON A SECOND COPY OF THE SLICING RULE.
     * What the citation owes upstream is that its halves concatenate back to
     * the number upstream published — `EVO` + `013` is `EVO013` — so the test
     * puts the set code back in front of what it read and compares THAT. A test
     * that re-implemented the prefix slice would agree with a wrong slice.
     */
    const codeIn = (html: string) =>
      footerOf(html)
        .match(
          /<span class="of-card__printing-code">(.*?)<\/span>\s*<\/p>/s,
        )?.[1]
        ?.replace(/<[^>]*>/g, "") ?? "";

    let perArt = 0;
    for (const page of CARD_PAGES.filter((_, index) => index % 53 === 0)) {
      const faces = facesOf(page.card);
      /* Every face has a route of its own now, face 0 included — so the loop
         no longer has to know which one is the card's own address. */
      faces.forEach((face, index) => {
        const route = hrefForPrinting(face.setCode, face.number, page.slug);
        const html = render(route);
        if (html === "") return;
        if (index > 0) perArt += 1;

        const { id, set_id } = face.printing;
        const cite = codeIn(html);
        const [name = "", number = ""] = cite.split(" #");

        expect(`${route}: ${name}`).toBe(`${route}: ${setName(set_id)}`);
        /* The number is printed whole where it does not carry its set's code,
           which is the one case the halves do not concatenate. */
        const rejoined = id.toUpperCase().startsWith(set_id.toUpperCase())
          ? `${set_id}${number}`
          : number;
        expect(`${route}: ${rejoined}`).toBe(`${route}: ${id}`);
      });
    }

    /* A route form this test never reached would make it green by not looking,
       and the per-art form is the one it exists for. */
    expect(perArt).toBeGreaterThan(0);
  });

  test("what the line carries follows the printing, not the card", () => {
    /*
     * THE COUNT IS NO LONGER FIXED, AND THAT IS THE CHANGE. The line used to
     * publish every rarity the card has and every card it is backed with, all
     * but one of each hidden, because a picker could swap the picture without
     * the page changing. The printings table is the control now: a page shows
     * ONE printing, so the line states that printing's rarity and that
     * printing's back, and carries neither where upstream publishes neither.
     *
     * So what is asserted is the RULE rather than a number: the artist and the
     * citation are always there, the rarity is there exactly when this printing
     * has one, and the back exactly when it has one.
     */
    for (const page of CARD_PAGES.filter((_, index) => index % 37 === 0)) {
      const html = render(page.href);
      const footer = footerOf(html);
      const shown = facesOf(page.card)[0];

      expect(`${page.label}: artist`).toBe(
        `${page.label}: ${footer.includes("Illustrated by") || footer.includes("No artist is credited") ? "artist" : "none"}`,
      );
      expect(
        `${page.label}: ${footer.includes("of-card__printing-code")}`,
      ).toBe(`${page.label}: true`);

      const rarity = shown?.printing.rarity ?? "";
      expect(`${page.label}: ${footer.includes("of-card__rarity")}`).toBe(
        `${page.label}: ${rarity !== ""}`,
      );
      /* One bubble, never a list. */
      expect(
        `${page.label}: ${[...footer.matchAll(/class="of-card__rarity"/g)].length}`,
      ).toBe(`${page.label}: ${rarity === "" ? 0 : 1}`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Bare names in a related-cards list                                          */
/* -------------------------------------------------------------------------- */

describe("a related-cards list is one row per name, stones beside it", () => {
  const render = (route: string) =>
    RESOLVED.find((resolved) => resolved.route === route)?.render(
      [],
      undefined,
    ) ?? "";
  const listIn = (html: string) =>
    html.match(/<ul class="of-card__links">.*?<\/ul>/s)?.[0] ?? "";

  test("three versions of one name are one row and three stones", () => {
    /*
     * A LIST THAT NAMED ONE CARD THREE TIMES BECOMES ONE ROW. The pitch was the
     * only thing that differed between those rows, which is exactly what a
     * stone is for. Grouping took 10,868 rows to 6,816 when it landed.
     *
     * THIS ASKED HEAD JAB ABOUT ITS OWN VERSIONS UNTIL "Other versions" WAS
     * RETIRED — the printings table is the control for those now. Fist Pump
     * names Hyper Driver, whose three pitch versions are one row here, so the
     * shape under test is unchanged and it is now asserted on the kind of list
     * that still exists: one about OTHER cards.
     */
    const list = listIn(render(addressOf("fist-pump")));
    expect(list).not.toBe("");

    /* One row… */
    expect([...list.matchAll(/<li class="of-card__link">/g)].length).toBe(1);
    /* …one name, which is itself a link. The visible text is bare; the
       qualifier that follows it is hidden, and is what stops the anchor
       colliding with the other lists' rows for the same name. */
    expect(
      [
        ...list.matchAll(
          /<a class="of-card__link-name" href="[^"]+">Hyper Driver(<span class="of-card__visually-hidden">[^<]*<\/span>)?<\/a>/g,
        ),
      ].length,
    ).toBe(1);
    /* …and a link per version the row stands for. */
    const pitchLinks = [
      ...list.matchAll(/<a class="of-card__pitch-link" href="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(pitchLinks).toEqual([
      addressOf("hyper-driver-1"),
      addressOf("hyper-driver-2"),
      addressOf("hyper-driver-3"),
    ]);
  });

  test("each stone is a link named for the card it reaches", () => {
    /*
     * THE STONE CARRIES THE ACCESSIBLE NAME, through `PitchJewel`'s `label`
     * rather than a hidden span. A `role="img"` with an `aria-label` inside an
     * anchor contributes that string to the anchor's name, so the link is
     * called "Hyper Driver (pitch 2)" with no text in the DOM — which is what
     * keeps two stones on one row from being two links called the same thing
     * (WCAG 2.4.4), and leaves nothing for a drag-select to pick up.
     *
     * ASSERTED AS A PAIRING, not merely as presence: the label has to match the
     * href it sits inside, since a row of stones all correctly labelled but
     * wired to the wrong cards would pass any weaker check.
     */
    const list = listIn(render(addressOf("fist-pump")));
    for (const [, href, label] of list.matchAll(
      /<a class="of-card__pitch-link" href="([^"]+)"><span class="of-jewel[^"]*" role="img" aria-label="([^"]+)"/g,
    )) {
      const pitch = href?.match(/-(\d)$/)?.[1];
      expect(`${href}:${label}`).toBe(`${href}:Hyper Driver (pitch ${pitch})`);
    }
    /* And the loop above has to have run. */
    expect(list).toContain('aria-label="Hyper Driver (pitch 2)"');
  });

  test("the name is a link on every row, whatever the version count", () => {
    /*
     * THE RECONCILIATION, AND THE REGRESSION IT UNDOES. `CardIndex` publishes
     * the rule — "a stone is a link only where there is something to choose
     * between" — with the name as the destination in both cases. A first pass
     * at this list dropped the name's anchor on multi-version rows and left the
     * stones as the only way in, so a reader who learned on a set page that the
     * name is the card found it inert on a card page.
     *
     * `Runechant` is named because its lists carry both version counts at once,
     * which is the only way to assert the rule holds across them rather than
     * one shape having replaced the other.
     */
    const list = listIn(render(addressOf("runechant")));
    const rows = [
      ...list.matchAll(/<li class="of-card__link">(.*?)<\/li>/gs),
    ].map((m) => m[1] ?? "");
    expect(rows.length).toBeGreaterThan(1);

    let sole = 0;
    let several = 0;
    for (const row of rows) {
      /* Every row, without exception, names a destination on the name. */
      expect(row).toMatch(
        /<a class="of-card__link-name" href="\/card\/[^"]+">/,
      );

      const stoneLinks = [...row.matchAll(/<a class="of-card__pitch-link"/g)]
        .length;
      const stones = [...row.matchAll(/role="img"/g)].length;
      if (stones === 1) {
        /* A SOLE VERSION DRAWS A PLAIN STONE. Linking it would be a second
           control, in a smaller target, for where the name already points. */
        expect(stoneLinks).toBe(0);
        sole += 1;
      } else {
        /* Several, and then every one of them is its own way in. */
        expect(stoneLinks).toBe(stones);
        several += 1;
      }
    }

    /* Both branches have to have been exercised, or the loop proved nothing. */
    expect(sole).toBeGreaterThan(0);
    expect(several).toBeGreaterThan(0);
  });

  test("a partial group lands its name on a version it is showing", () => {
    /*
     * `set.page.tsx`'s `collapsed && whole` test, arrived at here for the same
     * reason: a surface showing two of three versions must not send its name to
     * the shared page, which would offer a third it is not showing.
     *
     * THE PARTIAL CASE USED TO BE GUARANTEED AND IS NOW RARE, which is why this
     * names a different card than it used to. "Other versions" was always
     * partial — `variants` excludes the card being read by definition — and
     * that list is retired. What is left is partial only where upstream's
     * `referenced_cards` names some versions of a name and not others: 55 rows
     * of 20,372 on the shipped build.
     *
     * Fist Pump is one of them. Four cards are called Hyper Driver — three
     * pitch versions and a token with no pitch — and Fist Pump's text reaches
     * only the three, so the row lands on one of those three and NOT on the
     * bare name's default, which would offer the token this row does not show.
     */
    const list = listIn(render(addressOf("fist-pump")));
    const nameHref = list.match(
      /<a class="of-card__link-name" href="([^"]+)"/,
    )?.[1];
    expect(nameHref).toBe(addressOf("hyper-driver-1"));

    const stoneHrefs = [
      ...list.matchAll(/<a class="of-card__pitch-link" href="([^"]+)"/g),
    ].map((m) => m[1]);
    /* And it is one the row is actually showing. */
    expect(stoneHrefs).toContain(nameHref);
  });

  test("no row SHOWS the pitch as words, and one row still says it", () => {
    /*
     * THE CLAIM WEAKENED FROM "NOWHERE IN THE MARKUP" TO "NOWHERE ON SCREEN",
     * and the difference is a bug this test used to enforce. The stones do name
     * themselves in an attribute, which is why the words left the list — but a
     * row whose name points at ONE version has to carry that version's
     * qualifier inside its anchor, or two rows reading "Count Your Blessings"
     * go to two different cards with nothing to tell them apart. See
     * `groupTarget`. So the suffix is hidden rather than absent, exactly as
     * `of-index__variant` is in the card index.
     */
    for (const route of [addressOf("fist-pump"), addressOf("runechant")]) {
      const list = listIn(render(route));
      /* THE PAGE HAS TO EXIST. These were spelled `/card/fist-pump` — redirect
         sources rather than routes — so `render` returned `""`, the regexes
         below found no pitch words in no markup, and both assertions passed
         against an empty string. */
      expect(list).not.toBe("");
      /* Strip the hidden spans, then the tags: what is left is what a reader
         sees, and it carries no pitch words. */
      const seen = list
        .replace(/<span class="of-card__visually-hidden">[^<]*<\/span>/g, "")
        .replace(/<[^>]+>/g, "");
      expect(`${route}:${/\(pitch \d\)/.test(seen)}`).toBe(`${route}:false`);
      expect(`${route}:${/\(no pitch\)/.test(seen)}`).toBe(`${route}:false`);
    }

    /*
      And the hidden half is really there on a row that needs it — NAMED FOR
      EVERY VERSION IT STANDS FOR, not for the one its href opens. Fist Pump's
      row covers the three pitched Hyper Drivers, not the fourth card of that
      name, and lands on the lowest of the three. Calling it "(pitch 1)" would
      be true of the destination and false of the row, and would announce the
      same string as the first stone beside it.
    */
    const versions = listIn(render(addressOf("fist-pump")));
    expect(versions).toContain(
      `<a class="of-card__link-name" href="${addressOf("hyper-driver-1")}">Hyper Driver<span class="of-card__visually-hidden"> (pitch 1, 2 and 3)</span></a>`,
    );

    /* And a row standing for ONE version is named for that one, through
       `variantSuffix` exactly as every other surface names a card. Crouching
       Tiger is referenced by Growl at pitch 1 and by no other version of it —
       the only shape in the corpus where a group has one disambiguated member,
       which is why this names an odd pair of cards. */
    expect(render(addressOf("crouching-tiger"))).toContain(
      `<a class="of-card__link-name" href="${addressOf("growl-1")}">Growl<span class="of-card__visually-hidden"> (pitch 1)</span></a>`,
    );
  });

  test("no card page has two links reading alike that go to different cards", () => {
    /*
     * THE REGRESSION THIS PAIR OF TESTS MISSED, ASSERTED DIRECTLY ON THE PAGE.
     * WCAG 2.4.4, and the exact failure `variantSuffix` exists to prevent:
     * `/card/count-your-blessings-1` carried "Count Your Blessings" twice, once
     * to `/card/count-your-blessings-2` in Other versions and once to
     * `/card/count-your-blessings` in References. Measured on that build: 3,583
     * card pages had a pair, and on 12 of them BOTH sides were related-list
     * rows.
     *
     * THAT PARTICULAR PAIRING CANNOT RECUR — Other versions is retired, the
     * printings table being the control for versions — but the hazard is not
     * retired with it, and this test is deliberately not narrowed to match. It
     * scans every `/card/` anchor on the page, so the qualifier is still held
     * to account on the 55 rows that carry one, and the day a third list is
     * added it is already covered.
     *
     * ACCESSIBLE NAMES, NOT TEXT NODES, which is what makes this test able to
     * see the stones as well as the names: a pitch link's name comes from the
     * `aria-label` on the `role="img"` inside it, and its only text node is an
     * `aria-hidden` numeral shared by every row on the page.
     */
    const nameOf = (anchor: string) => {
      const labelled = /aria-label="([^"]*)"/.exec(anchor);
      return labelled?.[1] ?? anchor.replace(/<[^>]+>/g, "").trim();
    };

    /*
     * EVERY 12th PAGE, NOT THE FIRST 400, and the difference is what the sample
     * can see. Corpus order is upstream's name sort, so a prefix is the letter
     * A and a little of B — and whether a name is shared is not distributed
     * evenly through the alphabet. Striding covers the same number of pages
     * across the whole corpus for the same cost.
     *
     * A FULL SCAN IS CLEAN AND IS NOT RUN HERE: 4,941 pages take about 11.5
     * seconds, against roughly one for this. It was run once by hand over the
     * built site — 3,583 pages with a pair before the fix, zero after — and the
     * number in the doc block beside `groupTarget` is that scan's, not this
     * sample's.
     */
    let collisions = 0;
    const sampled = CARD_PAGES.filter((_, index) => index % 12 === 0);
    expect(sampled.length).toBeGreaterThan(400);
    for (const page of sampled) {
      const html = render(page.href);
      const targets = new Map<string, Set<string>>();
      for (const anchor of html.matchAll(
        /<a[^>]*href="(\/card\/[^"]+)"[^>]*>(.*?)<\/a>/gs,
      )) {
        const spoken = nameOf(anchor[2] ?? "");
        if (spoken === "") continue;
        const found = targets.get(spoken) ?? new Set<string>();
        found.add(anchor[1] ?? "");
        targets.set(spoken, found);
      }
      for (const [spoken, hrefs] of targets)
        if (hrefs.size > 1) {
          collisions += 1;
          expect(`${page.href}: ${spoken} -> ${[...hrefs].join(", ")}`).toBe(
            `${page.href}: no collision`,
          );
        }
    }
    expect(collisions).toBe(0);
  });

  test("grouping by name never merges two links at one pitch", () => {
    /*
     * THE ASSUMPTION THE ROW SHAPE RESTS ON, measured rather than trusted. Two
     * cards sharing a name in these lists are the pitch versions of one card,
     * so a name plus a pitch identifies a link — and if that ever stopped being
     * true, a group would render two stones with the same numeral and a reader
     * would have no way to tell which went where.
     *
     * Zero today, across every list a card page renders. `page.variants` is no
     * longer one of them — the printings table is the control for versions —
     * so it is not scanned here; it still feeds the version tabs, which show
     * one card per stone and cannot group.
     */
    let collisions = 0;
    for (const page of CARD_PAGES)
      for (const links of [page.references, page.referencedBy]) {
        const byName = new Map<string, number[]>();
        for (const link of links) {
          const found = byName.get(link.name) ?? [];
          found.push(link.pitch);
          byName.set(link.name, found);
        }
        for (const pitches of byName.values())
          if (new Set(pitches).size < pitches.length) collisions += 1;
      }
    expect(collisions).toBe(0);
  });

  test("the lists that carry no pitch mark are left alone", () => {
    /*
     * THE LIMIT ON THE CHANGE, pinned so somebody does not "finish the job" and
     * break two pages. A rule page's governed-cards list and a set page's
     * `<noscript>` list are plain anchors with NO stone beside them — nothing
     * else on those rows says which version a name is, so their qualifier is
     * load-bearing text rather than a restatement of a glyph.
     */
    const rule =
      RESOLVED.find((resolved) => resolved.route.startsWith("/rules/"))?.render(
        [],
        undefined,
      ) ?? "";
    const governs = rule.match(/<ul class="of-rule__governs">.*?<\/ul>/s)?.[0];
    if (governs !== undefined)
      expect(governs).not.toContain("of-card__pitch-link");
  });
});

/* -------------------------------------------------------------------------- */
/* The card on the other face                                                  */
/* -------------------------------------------------------------------------- */

describe("a double-faced printing names the card on its back", () => {
  const render = (route: string) =>
    RESOLVED.find((resolved) => resolved.route === route)?.render(
      [],
      undefined,
    ) ?? "";

  test("the credit line links to the other face", () => {
    /*
     * THE CARD A READER'S COPY IS PHYSICALLY ATTACHED TO was named on this page
     * only in the printings table below the fold. A Drop in the Ocean is one
     * physical card with Inner Chi.
     */
    const html = render(addressOf("a-drop-in-the-ocean"));
    expect(html).toContain("Backed with");
    /*
     * INNER CHI'S OWN ADDRESS, WHICH IS THE BACK OF THIS VERY PRINTING. Under
     * the old scheme this read `/card/inner-chi` — the card, at whatever art it
     * happened to open on. A card link is a printing link now, and the printing
     * `linkTo` picks for Inner Chi is ENG025's back face: the physical other
     * side of the card this page is showing.
     */
    expect(html).toContain(`<a href="${addressOf("inner-chi")}">Inner Chi</a>`);
  });

  test("which card is on the back follows the printing the page shows", () => {
    /*
     * WHICH CARD IS ON THE BACK IS A FACT ABOUT THE PRINTING, and Agility is
     * the card that proves it: printed on the back of Gold in Heavy Hitters, of
     * Might in Part the Mistveil, and alone in six other products.
     *
     * THE HIDDEN SLOTS ARE GONE WITH THE PICKER. The page used to publish every
     * back the card has and reveal one by a stamp on the root element; each
     * printing has its own page now, so each states its own back and nothing
     * else — which is the same simplification the rarity beside it got.
     */
    const backs = (route: string) =>
      [...render(route).matchAll(/Backed with\s*<a href="([^"]+)"/g)].map(
        (match) => match[1],
      );

    expect(backs("/card/hvy/240/agility")).toEqual([addressOf("gold")]);
    expect(backs("/card/kyo/027/agility")).toEqual([addressOf("might")]);

    /*
     * AND THE DEFAULT PRINTING NAMES NEITHER, which is the honest answer rather
     * than a gap: Agility's own address shows AKO027, an Ako printing of a
     * token that Ako published on its own.
     */
    expect(backs(addressOf("agility"))).toEqual([]);
    expect(render(addressOf("agility"))).not.toContain("Backed with");
  });
});

/* -------------------------------------------------------------------------- */
/* Bare names in a card index                                                  */
/* -------------------------------------------------------------------------- */

describe("a card index prints the name and not the pitch qualifier", () => {
  /*
   * LOCAL GAME STORE PROMOS RATHER THAN MONARCH, and the swap is a consequence
   * of the collapse rather than a preference. Monarch prints every version of
   * every name it carries, so after the collapse not one of its 155 rows stands
   * for a single version of a shared name — there is no qualifier left on that
   * page to assert about, and this test went green-by-vacancy. LGS is the set
   * from the screenshot: 432 cards in 344 rows, of which some are whole names
   * collapsed and some are ONE version of a name printed elsewhere. The second
   * kind is what still needs the hidden qualifier.
   */
  const promos = RESOLVED.find((resolved) => resolved.route === "/sets/lgs");
  const html = promos?.render([], "islands.js") ?? "";

  test("the images view prints no title, and the alt still carries the pitch", () => {
    /*
     * WHY THE QUALIFIER CANNOT SIMPLY BE DELETED. 900 names in this corpus
     * belong to more than one card, so "Belly Buster" is three anchors that
     * differ only in where they point — a WCAG 2.4.4 failure, and the exact one
     * `variantSuffix` was written to prevent.
     *
     * WHERE IT LIVES IN THIS VIEW CHANGED, AND THAT IS WHAT THIS PINS. The
     * grid used to print the name under every face with the suffix hidden
     * inside the anchor as `.of-index__variant`; it prints no name at all now,
     * so the anchor's accessible name is the face's `alt` alone — and `alt` has
     * always carried the QUALIFIED label. So the disambiguation did not move
     * house, it lost its duplicate: what the reader used to see twice, they now
     * see once, and what a screen reader announces is unchanged.
     *
     * BOTH HALVES ARE ASSERTED, because either alone would pass on a page that
     * had simply stopped listing cards. The caption must be absent AND the
     * suffix must be in an `alt`.
     *
     * A ROW THAT STANDS FOR EVERY VERSION HAS NOTHING TO QUALIFY and carries no
     * suffix at all — see the collapse tests above. This is about the other
     * kind: one version of a name whose siblings were printed somewhere else.
     */
    expect(html).not.toBe("");
    /* No printed caption, and therefore no hidden span inside one. */
    expect(html).not.toContain("of-index__cell-name");
    expect(html).not.toContain("of-index__variant");
    /* And the suffix is still in the accessible name of a face. */
    expect(html).toMatch(/alt="[^"]*\(pitch \d\)[^"]*"/);
  });

  test("a card whose name is unique carries no qualifier at all", () => {
    /*
     * ASSERTED THROUGH `entryFor`'s OWN INPUT, not by restating `labelFor`.
     * The first version of this checked `label === card.name` — true of
     * `variantSuffix` and true before this change, so it said nothing about
     * whether the page had started hiding the right thing. It also named a
     * function that does not exist in the repository.
     */
    const unique = CARD_PAGES.find((page) => !page.disambiguated);
    expect(unique).toBeDefined();
    expect(
      variantSuffix(unique?.pitch ?? 0, unique?.disambiguated ?? false),
    ).toBe("");

    /* And a card that DOES need one supplies it, so the empty case above is a
       result rather than the only case there is. */
    const versioned = CARD_PAGES.find((page) => page.disambiguated);
    expect(versioned).toBeDefined();
    expect(
      variantSuffix(versioned?.pitch ?? 0, versioned?.disambiguated ?? false),
    ).toMatch(/^ \((?:no pitch|pitch \d)\)$/);
  });

  test("a row with nothing to qualify renders no span at all", () => {
    /*
     * THE EMPTY ONE USED TO SHIP ANYWAY. Most rows have nothing to qualify — a
     * collapsed row stands for every version it draws a band for, and a unique
     * name never needed a suffix — and two of the three views rendered the span
     * regardless, so `<span class="of-index__variant"></span>` went out on the
     * majority of rows.
     *
     * THE CLASS IS GONE NOW AND THIS STILL ASSERTS ON IT, DELIBERATELY. The
     * grid stopped printing a caption and the names view was retired, so the
     * one surface left that hides a qualifier is `ResultRow`, which has always
     * guarded the case. Zero is therefore trivially true today — and that is
     * the point: this is the assertion that fails if somebody reintroduces a
     * hand-rolled qualifier span in this component rather than using the
     * primitive. The test below is what proves the guard is actually working
     * where the qualifier IS rendered.
     */
    expect(html).not.toBe("");
    expect([...html.matchAll(/class="of-index__variant"/g)].length).toBe(0);
  });

  test("in both views, which needs its own render to reach the list", () => {
    /*
     * THE SET PAGE ONLY EVER PROVES THE GRID. The switch between views is
     * client state, so a route render can only ever exercise the default one —
     * the test above would stay green with the guard reverted in the list. So
     * this renders the COMPONENT, which is the only way to reach the other view.
     *
     * WHAT IS BEING GUARDED MOVED WHEN THE NAMES VIEW WENT. This component used
     * to carry its own `Variant` helper, because the grid and the names list
     * both hid the qualifier inside an anchor and neither guarded the empty
     * case. The grid stopped printing a caption, the names view is gone, and
     * what is left renders the qualifier through `ResultRow` — which has always
     * guarded it. So the helper is deleted rather than kept, and this test now
     * pins the two facts that outlived it: the suffix still reaches the
     * accessible name in BOTH views, and no empty span is emitted in either.
     *
     * IT IS WORTH KEEPING RATHER THAN DELETING WITH THE HELPER. 900 names in
     * this corpus belong to more than one card, so anchors that differ only in
     * where they point are a live WCAG 2.4.4 hazard here — the guard moving
     * into a primitive is not the same as the requirement going away.
     */
    const entries = [
      {
        href: "/card/anothos",
        label: "Anothos",
        name: "Anothos",
        /* Nothing to qualify: a name belonging to one card. */
        qualifier: "",
        typeLine: "Guardian Weapon - Hammer (2H)",
        faceKey: null,
        faceLandscape: false,
        versions: [
          {
            pitch: 0 as const,
            href: "/card/anothos",
            label: "Anothos",
            faceKey: null,
            faceLandscape: false,
          },
        ],
      },
      {
        href: "/card/head-jab-2",
        label: "Head Jab (pitch 2)",
        name: "Head Jab",
        /* And one that needs it, so an empty count cannot pass by rendering
           nothing at all. */
        qualifier: " (pitch 2)",
        typeLine: "Ninja Attack Action",
        faceKey: null,
        faceLandscape: false,
        versions: [
          {
            pitch: 2 as const,
            href: "/card/head-jab-2",
            label: "Head Jab (pitch 2)",
            faceKey: null,
            faceLandscape: false,
          },
        ],
      },
    ];

    for (const display of ["grid", "list"] as const) {
      /* `createElement` rather than JSX: this file is `.ts`, and renaming it to
         `.tsx` to render one component would be a change to every other test in
         it. */
      const markup = renderToStaticMarkup(
        createElement(CardIndex, {
          entries,
          display,
          onDisplayChange: () => undefined,
          summary: "2 cards",
          controlName: "test",
          interactive: false,
        }),
      );
      /* The suffix is on the page in both views — as a face's `alt` in the
         grid, as `ResultRow`'s hidden span in the list. */
      expect(`${display}: ${markup.includes(" (pitch 2)")}`).toBe(
        `${display}: true`,
      );
      /* And Anothos, which has nothing to qualify, contributes no empty one.
         Matches ANY class, so it cannot be satisfied by the guarded element
         merely being renamed. */
      expect(
        `${display}: ${[...markup.matchAll(/<span class="[^"]*"><\/span>/g)].length}`,
      ).toBe(`${display}: 0`);
    }
  });

  test("the list row leads with a face, at the tier a 44px box wants", () => {
    /*
     * THE VIEW USED TO CARRY NO PICTURE, which made the densest card list on
     * this site the one screen contradicting `docs/DESIGN.md`'s claim that
     * recognising a card by its face is what separates this from every
     * text-list card tool in the game.
     *
     * THE TIER IS THE HALF WORTH PINNING. `thumb` is 180px and the box is
     * 44px; `normal` is 450px and is what the GRID asks for, because a 240px
     * cell upscaled the smaller one. Getting that backwards costs nothing
     * visible and ships a 450px picture sixty times a page to paint 44 points
     * of it, so it would survive any test that only looked at the markup.
     */
    /*
     * A FIXTURE WITH A REAL FACE KEY AND ONE WITHOUT, because the two take
     * different paths — `faceUrl` for the first, `placeholderUrl` for the
     * second — and a row that publishes no art must still hold the column open
     * rather than collapsing and leaving one name out of line with the rest.
     */
    const faced = [
      {
        href: "/card/head-jab-2",
        label: "Head Jab (pitch 2)",
        name: "Head Jab",
        qualifier: " (pitch 2)",
        typeLine: "Ninja Attack Action",
        faceKey: "WTR166",
        faceLandscape: false,
        versions: [
          {
            pitch: 2 as const,
            href: "/card/head-jab-2",
            label: "Head Jab (pitch 2)",
            faceKey: "WTR166",
            faceLandscape: false,
          },
        ],
      },
      {
        href: "/card/anothos",
        label: "Anothos",
        name: "Anothos",
        qualifier: "",
        typeLine: "Guardian Weapon - Hammer (2H)",
        /* Four printings in the corpus publish no image at all. */
        faceKey: null,
        faceLandscape: false,
        versions: [
          {
            pitch: 0 as const,
            href: "/card/anothos",
            label: "Anothos",
            faceKey: null,
            faceLandscape: false,
          },
        ],
      },
    ];

    const markup = renderToStaticMarkup(
      createElement(CardIndex, {
        entries: faced,
        display: "list" as const,
        onDisplayChange: () => undefined,
        summary: "2 cards",
        controlName: "test",
        interactive: false,
      }),
    );

    expect([...markup.matchAll(/of-index__row-face/g)]).toHaveLength(
      faced.length,
    );
    expect(markup).toContain("/thumb/");
    expect(markup).not.toContain("/normal/");

    /*
     * AND IT IS NOT A LINK, which is the accessibility half. The name beside
     * it already points at the row, so an anchor here would be a second
     * control for one destination in a smaller target. `alt=""` follows: the
     * picture repeats what the row says in text.
     */
    expect(markup).not.toMatch(/<a[^>]*>\s*<img[^>]*of-index__row-face/);
    for (const fragment of markup.split("of-index__row-face").slice(1)) {
      expect(fragment.slice(0, 200)).toContain('alt=""');
    }

    /* The grid is untouched by any of this and still asks for the big tier. */
    const grid = renderToStaticMarkup(
      createElement(CardIndex, {
        entries: faced,
        display: "grid" as const,
        onDisplayChange: () => undefined,
        summary: "2 cards",
        controlName: "test",
        interactive: false,
      }),
    );
    expect(grid).not.toContain("of-index__row-face");
    expect(grid).toContain("/normal/");
  });
});

/* -------------------------------------------------------------------------- */
/* The fan                                                                     */
/* -------------------------------------------------------------------------- */

describe("a fan holds the versions it was handed, once each", () => {
  /**
   * The grid, rendered on its own, and the cards it dealt.
   *
   * Returns the `src` of every face in document order — the front card first,
   * then the ones behind it — which is the whole of what these tests assert on.
   */
  const dealt = (entry: Parameters<typeof CardIndex>[0]["entries"][number]) => {
    const markup = renderToStaticMarkup(
      createElement(CardIndex, {
        entries: [entry],
        display: "grid" as const,
        onDisplayChange: () => undefined,
        summary: "1 card",
        controlName: "test",
        interactive: false,
      }),
    );
    return [...markup.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map(
      (match) => match[1] ?? "",
    );
  };

  /* The address is DERIVED FROM THE FACE, so a fixture cannot quietly hand the
     component a version whose picture and page are different cards — which is
     the exact defect these tests are about, and it would make them pass by
     accident if it were written out twice by hand. */
  const version = (pitch: 1 | 2 | 3, faceKey: string) => ({
    pitch,
    href: `/card/mpw/${faceKey.slice(3, 6)}/hit-and-run-${pitch}`,
    label: `Hit and Run (pitch ${pitch})`,
    faceKey,
    faceLandscape: false,
  });

  test("every card in the hand is a different one", () => {
    /*
     * THE HAND HELD A DUPLICATE AND WAS MISSING A CARD, and both came from one
     * cause: the row's picture and the row's link were resolved from different
     * versions. `card-search/` now takes a row's face from the version it
     * opens, so this is that fix seen from the surface it broke — the engine
     * test names the mechanism, this names the symptom.
     *
     * Three versions in, three DISTINCT faces out, and the one the cell points
     * at is the one in front.
     */
    const faces = dealt({
      href: "/card/mpw/112/hit-and-run-1",
      label: "Hit and Run",
      name: "Hit and Run",
      qualifier: "",
      typeLine: "Warrior Action",
      faceKey: "MPW112.webp",
      faceLandscape: false,
      versions: [
        version(1, "MPW112.webp"),
        version(2, "MPW113.webp"),
        version(3, "MPW114.webp"),
      ],
    });

    expect(faces.length).toBe(3);
    expect(new Set(faces).size).toBe(3);
    /* The front card is the row's own, so the cell's picture and its
       destination are one card. */
    expect(faces[0]?.includes("MPW112")).toBe(true);
  });

  test("a row standing for one version deals no hand at all", () => {
    /*
     * THE ADDRESS FILTER ALONE WAS NOT ENOUGH, and `unique:art` is where that
     * showed. Such a row stands for ONE picture of one card: its href is that
     * printing's URL while its single version points at the card's default
     * page, so the two differ, the filter kept the version, and a cell with no
     * choice in it dealt a two-card fan whose back card was the same card's
     * other art. A row with one version is one card and one link.
     */
    const faces = dealt({
      href: "/card/mpw/112/hit-and-run-1",
      label: "Hit and Run · MPW112",
      name: "Hit and Run · MPW112",
      qualifier: "",
      typeLine: "Warrior Action",
      faceKey: "MPW112.webp",
      faceLandscape: false,
      /* The address an `unique:art` row's version carries: the card's own
         default page, which is NOT the printing the row is showing. */
      versions: [
        {
          pitch: 1 as const,
          href: "/card/cru/091/hit-and-run-1",
          label: "Hit and Run (pitch 1)",
          faceKey: "CRU091.png",
          faceLandscape: false,
        },
      ],
    });

    expect(faces.length).toBe(1);
    expect(faces[0]?.includes("MPW112")).toBe(true);
  });

  test("what the caller hands over is the whole hand, and nothing else", () => {
    /*
     * A FILTER THAT EXCLUDES A PITCH EXCLUDES IT FROM THE FAN. This component
     * draws the versions it is given and never reaches for a sibling, so a
     * `pitch:1` search cannot be answered with a picture of the blue one — the
     * same promise `card-search/` keeps on its side of the boundary, pinned
     * here so neither half can start assuming the other does it.
     */
    const faces = dealt({
      href: "/card/mpw/112/hit-and-run-1",
      label: "Hit and Run",
      name: "Hit and Run",
      qualifier: "",
      typeLine: "Warrior Action",
      faceKey: "MPW112.webp",
      faceLandscape: false,
      versions: [version(1, "MPW112.webp"), version(3, "MPW114.webp")],
    });

    expect(faces.length).toBe(2);
    expect(faces.some((src) => src.includes("MPW113"))).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* The files the host reads and never serves                                   */
/* -------------------------------------------------------------------------- */

describe("_headers and _redirects say what the host is told", () => {
  /*
   * THESE ASSERT A FORMAT, WHICH IS UNUSUAL AND IS THE POINT. Both files are
   * consumed by a platform we cannot run in a unit test, and a malformed line
   * in either is accepted silently — Cloudflare skips a rule it cannot parse
   * and deploys green. So the failure is invisible in exactly the way the rest
   * of this file exists to catch: the site serves every page it knows about,
   * and only the rule nobody re-tested is gone.
   */

  test("every redirect is an exact path, and none points at another's source", () => {
    const sources = new Set(REDIRECTS.map((rule) => rule.from));

    for (const rule of REDIRECTS) {
      expect(rule.from.startsWith("/")).toBe(true);
      expect(rule.to.startsWith("/")).toBe(true);
      /* No placeholders and no wildcards. Two earlier versions of the retired
         card table used them and both shipped an infinite redirect; the habit
         is worth keeping now that the table is small enough to be tempting. */
      expect(rule.from).not.toMatch(/[:*]/);
      expect(rule.to).not.toMatch(/[:*]/);
      /* A chain is a loop the browser reports as ERR_TOO_MANY_REDIRECTS rather
         than as the 404 it should have been. */
      expect(sources.has(rule.to)).toBe(false);
    }
  });

  test("the rendered _redirects is one rule per line, from-to-status", () => {
    const lines = renderRedirects().trimEnd().split("\n");
    expect(lines.length).toBe(REDIRECTS.length);
    expect(lines).toContain("/cards /search 301");
  });

  test("/cards still answers, because query strings survive a 301", () => {
    /* `/cards?q=banned:cc` is a link people have pasted. The rule is what keeps
       it answering after the results page moved to `/search`. */
    const cards = REDIRECTS.find((rule) => rule.from === "/cards");
    expect(cards?.to).toBe("/search");
    expect(cards?.status).toBe(301);
  });

  test("the rendered _headers indents every header under its pattern", () => {
    const text = renderHeaders();

    for (const rule of HEADERS) {
      expect(text).toContain(`\n${rule.pattern}\n`.slice(1));
      for (const [name, value] of Object.entries(rule.headers)) {
        expect(text).toContain(`  ${name}: ${value}`);
      }
    }

    /* A pattern that is not at the start of a line is a header value, and a
       header line that is not indented is a pattern. Getting either wrong is
       how a block silently attaches to the wrong path. */
    for (const line of text.trimEnd().split("\n")) {
      if (line === "") continue;
      expect(line.startsWith("  ") || line.startsWith("/")).toBe(true);
    }
  });

  test("the security posture the site ships with is stated here", () => {
    const wildcard = HEADERS.find((rule) => rule.pattern === "/*");
    expect(wildcard?.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(wildcard?.headers["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );

    /* Declared rather than left to the host's default, so that `nosniff` above
       is making a TRUE claim binding rather than a guessed one. */
    const manifest = HEADERS.find(
      (rule) => rule.pattern === "/manifest.webmanifest",
    );
    expect(manifest?.headers["Content-Type"]).toBe("application/manifest+json");
  });

  test("no two rules share a pattern, because the later one would win", () => {
    /*
     * MEASURED, NOT ASSUMED. Cloudflare's docs say a request matching several
     * rules "inherits all rules' headers", which reads as a merge. Served by
     * real workerd, a SECOND `/*` block REPLACED the first outright: the
     * response carried the second block's header and neither of the first's.
     *
     * So a duplicate pattern is a silent deletion. This is the assertion that
     * stops one being introduced.
     */
    const patterns = HEADERS.map((rule) => rule.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  test("a preview build adds noindex WITHOUT dropping the security headers", () => {
    /*
     * THE REGRESSION THIS EXISTS FOR. The obvious way to noindex a preview is
     * to append a `/*` block in the deploy workflow. Done that way the preview
     * served `X-Robots-Tag: noindex` and silently lost `X-Content-Type-Options`
     * and `Referrer-Policy` — a security posture dropped on every preview,
     * visible nowhere. `headersFor` merges instead, and this pins that.
     */
    const preview = headersFor({ preview: true });
    const wildcard = preview.find((rule) => rule.pattern === "/*");

    expect(wildcard?.headers["X-Robots-Tag"]).toBe("noindex");
    expect(wildcard?.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(wildcard?.headers["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin",
    );

    /* Still one `/*` rule, not two. */
    const patterns = preview.map((rule) => rule.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);

    /* And the webmanifest rule is carried through untouched. */
    expect(
      preview.find((rule) => rule.pattern === "/manifest.webmanifest")?.headers[
        "Content-Type"
      ],
    ).toBe("application/manifest+json");
  });

  test("production is never noindexed, which is the other half of that", () => {
    const rendered = renderHeaders(headersFor({ preview: false }));
    expect(rendered).not.toContain("X-Robots-Tag");
    expect(headersFor({ preview: false })).toBe(HEADERS);
  });

  test("both files stay under Cloudflare's ceilings", () => {
    /* 100 rules and 2,000 characters per line for _headers; 2,000 static rules
       for _redirects. Nowhere near either — asserted so that the day somebody
       adds a table here, the limit is a failing test rather than a surprise in
       production. */
    expect(HEADERS.length).toBeLessThanOrEqual(100);
    expect(REDIRECTS.length).toBeLessThanOrEqual(2000);
    for (const line of renderHeaders().split("\n")) {
      expect(line.length).toBeLessThanOrEqual(2000);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The header's search field                                                   */
/* -------------------------------------------------------------------------- */

describe("every screen but the front door carries the header's search", () => {
  const all = RESOLVED;
  const render = (route: string) =>
    all
      .find((resolved) => resolved.route === route)
      ?.render([], "islands.js") ?? "";

  test("the id CardSearch adopts is the id SiteHeader renders", () => {
    /*
     * THE ONE THING NOTHING ELSE CAN CATCH. The header is rendered by the
     * document shell and `CardSearch` is mounted inside `<main>`, so there is
     * no prop between them.
     *
     * ~~The island finds its field with `document.getElementById`.~~ It does
     * not any more — `HeaderSearch` renders the field and declares the id, and
     * the two islands share a store rather than a DOM node. What this still
     * asserts is narrower and still worth asserting: the id reaches the BUILT
     * PAGE. `search.page.tsx` writes an inline script that fills the field from
     * `?q=` before any bundle loads, and that script looks the node up by this
     * id — so a rename that missed it would leave a results page whose search
     * box is empty until the island lands, exactly the regression that script
     * was added to remove.
     */
    expect(render("/search")).toContain(`id="${HEADER_FIELD_ID}"`);
  });

  test("/search has exactly one field, and it is the header's", () => {
    /*
     * IT USED TO HAVE TWO. The page rendered a hero field of its own and
     * suppressed the header's, which made the results screen look like a second
     * front door. `docs/SCRYFALL-GAP.md` §5.2 gives the hero to the door.
     */
    const html = render("/search");
    expect([...html.matchAll(/<input\b/g)]).toHaveLength(1);
    expect(html).toContain(`id="${HEADER_FIELD_ID}"`);

    /* AND NO EXAMPLE-QUERY LINE UNDER IT. The examples outlived the hero field
       they hung off and were then saying, next to the header's own search box,
       what that box already says. `Syntax` in the nav carries the grammar link
       now — see `SiteHeader`. Asserted as an absence so it cannot drift back.

       ON THE ID RATHER THAN ON `aria-describedby`, deliberately. The bare
       attribute was asserted absent first, which passes today and would fail
       the moment any control on this page grew a description of its own — a
       test that forbids an accessibility attribute site-wide to check one
       paragraph is gone. The id covers both the element and any attribute
       pointing at it, which is the whole of what was removed. */
    expect(html).not.toContain("cards-search-hint");
  });

  test("the field carries the query before any bundle loads", () => {
    /*
     * THE FRONT DOOR SUBMITS TO `/search?q=…`, AND THE BOX HAS TO SAY SO.
     *
     * The header's input lives in the shell, which is ONE document serving
     * every query, so it cannot be server-rendered with a value. Filling it
     * from the island's effect was correct and far too late: this page is
     * 934 kB of HTML plus a 230 kB bundle, so a reader who searched on the door
     * arrived at a results page whose search box was empty until all of it
     * landed — right answers, and a field that looked like it had forgotten the
     * question. It also covers a hydration FAILURE, which `islands.client.ts`
     * swallows in favour of the static markup.
     *
     * It does NOT cover scripting being off — an inline script is still a
     * script — and it does not need to: the results are gone in that case too,
     * which is what the page's `noscript` block is for.
     *
     * Asserted on the SERVED MARKUP rather than through a DOM, because that is
     * the whole claim: the fix has to be in the bytes, ahead of the bundle.
     */
    const html = render("/search");
    expect(html).toContain(`document.getElementById("${HEADER_FIELD_ID}")`);
    expect(html).toContain(
      'new URLSearchParams(window.location.search).get("q")',
    );

    /* AFTER the header, or it runs before the input it is looking for exists. */
    expect(html.indexOf(`id="${HEADER_FIELD_ID}"`)).toBeLessThan(
      html.indexOf("URLSearchParams"),
    );
  });

  test("the front door has a hero and no header at all", () => {
    /*
     * `section: "none"` removes the whole bar there, so the door cannot have
     * two fields by construction — which is the case `headerSearch` exists to
     * refuse the day the door grows a header.
     */
    const html = render("/");
    expect(html).not.toContain(`id="${HEADER_FIELD_ID}"`);
    expect(html).not.toContain("of-bar__find");
    expect(html).toContain("of-search__field");
  });

  test("/cr carries both, because they search different corpora", () => {
    /*
     * The usual objection to two fields — two places to type and one of them
     * wrong — does not apply here: the hero searches the Comprehensive Rules
     * and the header searches cards, neither can answer the other's question,
     * and each says which it is in its `aria-label`.
     */
    const html = render("/cr");
    expect(html).toContain(`id="${HEADER_FIELD_ID}"`);
    expect(html).toContain("of-search__field");
    expect(html).toContain('aria-label="Flesh and Blood cards"');
  });

  test("every other screen carries the header field", () => {
    /* The rule is "all screens after the landing page", so it is asserted over
       the screens rather than over the two that were changed. */
    for (const route of ["/sets", "/syntax", "/about", "/data-terms"]) {
      const has = render(route).includes(`id="${HEADER_FIELD_ID}"`);
      expect(`${route}: ${has}`).toBe(`${route}: true`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The header's menu                                                           */
/* -------------------------------------------------------------------------- */

describe("the nav collapses to a disclosure without a script", () => {
  const all = RESOLVED;
  const render = (route: string) =>
    all
      .find((resolved) => resolved.route === route)
      ?.render([], "islands.js") ?? "";

  /** The `<nav>` only, because the page is full of anchors. */
  const navIn = (html: string) =>
    /<nav class="of-bar__nav"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? "";

  test("every link is in the markup, open or closed", () => {
    /*
     * THE POINT OF USING `<details>` RATHER THAN A SCRIPT. The panel is closed
     * on arrival and the links are still in the document — crawlable, findable,
     * and reachable with scripting off, which a JavaScript menu cannot promise.
     * A collapse that removes the nav from the page is a collapse that removes
     * the site's navigation from anything that does not run JavaScript.
     *
     * SCOPED TO THE NAV, because `/sets` is 112 rows of anchors: matching
     * `>Sets</a>` against the whole document would have stayed green with the
     * header link deleted, on the strength of a set named the same thing.
     */
    const nav = navIn(render("/sets"));
    expect(nav).not.toBe("");
    for (const label of [
      "Cards",
      "Sets",
      "Rules",
      "Syntax",
      "Random",
      "About",
    ]) {
      expect(`${label}: ${nav.includes(`>${label}</a>`)}`).toBe(
        `${label}: true`,
      );
    }
  });

  test("the list is the disclosure's SIBLING, and the summary says so", () => {
    /*
     * THE LOAD-BEARING SHAPE, ASSERTED SO IT CANNOT BE TIDIED AWAY.
     *
     * Nesting the list inside `<details>` is the obvious markup and it breaks
     * the header on every engine older than Chrome 131 / Safari 18.4 /
     * Firefox 139: a closed disclosure stops rendering the shadow slot its
     * children are assigned to, which no light-DOM `display` can override, so
     * the wide layout — which hides the summary — would leave no navigation and
     * no way to open any. Reproduced in a live page before this structure
     * landed.
     *
     * The relationship the nesting would have expressed is stated by
     * `aria-controls` instead, and the two have to agree.
     */
    const html = render("/sets");
    const nav = navIn(html);
    expect(nav).toContain("</details>");
    /* The list opens AFTER the disclosure closes: a sibling, not a child. */
    expect(nav.indexOf("</details>")).toBeLessThan(
      nav.indexOf('<ul class="of-bar__links"'),
    );

    const controls = /aria-controls="([^"]+)"/.exec(nav)?.[1];
    expect(controls).toBeDefined();
    expect(nav).toContain(`<ul class="of-bar__links" id="${controls}">`);
  });

  test("the toggle is a summary, and it is named", () => {
    /*
     * A `<summary>` is a real disclosure control: focusable, operable with
     * Enter and Space, and announced with its expanded state — none of which a
     * `<div>` with a glyph in it would be, and none of which we would have to
     * reimplement. The glyph is `aria-hidden` and the name comes from text
     * beside it, because a screen reader cannot read three lines.
     */
    const html = render("/sets");
    expect(html).toContain('<summary class="of-bar__menu-button"');
    expect(html).toContain("of-bar__menu-glyph");
    expect(html).toContain('<span class="of-bar__sr">Sections</span>');
  });

  test("the glyph is drawn rather than typed", () => {
    /* `☰` is a CJK character a screen reader may announce as "trigram for
       heaven" and a font may not carry at all. Three paths are three paths. */
    const html = render("/sets");
    expect(html).not.toContain("☰");
    expect(html).toContain('stroke="currentColor"');
  });

  test("the current section is still marked inside the menu", () => {
    /* The collapse may not cost the one thing the nav says about where you
       are. `aria-current` has to survive being wrapped in a disclosure. */
    expect(render("/sets")).toMatch(
      /<a href="\/sets" aria-current="page">Sets<\/a>/,
    );
  });

  test("the collapse is actually wired, container name and all", () => {
    /*
     * THE ONE PART OF THIS FEATURE MARKUP CANNOT SHOW.
     *
     * Every other test here reads rendered HTML, and the HTML is identical at
     * both widths — the collapse lives entirely in the stylesheet. Delete the
     * `@container` block, or rename `container-name`, and every desktop page
     * silently becomes a hamburger with the whole suite green. That is the same
     * class of silent regression the sibling-structure test exists for, and it
     * is worth a cheap assertion given `check-tokens.ts` grew an exemption
     * specifically so this one breakpoint could be written down.
     *
     * The NAME is the half that rots quietly: a query naming a container that
     * no longer exists does not error, it just never matches.
     */
    const css = readFileSync(
      new URL("./SiteHeader.css", import.meta.url),
      "utf-8",
    );
    const declared = /container-name:\s*([a-z-]+)/.exec(css)?.[1];
    expect(declared).toBe("bar");
    expect(css).toContain(`@container ${declared} (min-inline-size:`);

    /* Range syntax is not parsed by Safari 16.0–16.3, which would drop the
       whole block and leave a desktop permanently collapsed. */
    expect(css).not.toMatch(/@container[^{]*(?:>=|<=|[^:]>[^=])/);
  });

  test("the front door has no bar at all, so it has no menu", () => {
    const html = render("/");
    /* `render` returns "" for a route that does not resolve, and two
       `not.toContain` assertions pass beautifully against nothing. */
    expect(html).not.toBe("");
    expect(html).not.toContain("of-bar__menu");
    expect(html).not.toContain("of-bar__nav");
  });
});
