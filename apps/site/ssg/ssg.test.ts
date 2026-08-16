/**
 * The generator's own invariants.
 *
 * These are not tests of React or of the filesystem. Every one of them asserts
 * a failure that is SILENT by default — a page written to the wrong address, a
 * page overwriting another, a page shipped without the disclaimer. The build
 * reports success in all three cases, which is why they are worth a test each.
 */

import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CARD_PAGES,
  CARD_REDIRECTS,
  CARD_ROUTES,
  CORPUS as CARDS,
  ROUTE_SET_CODES,
  variantSuffix,
} from "../src/lib/cards";
import { LSS_DISCLAIMER } from "../src/lib/compliance";
import { facesOf, hrefForPrinting } from "../src/lib/printings";
import { setFor } from "../src/lib/sets";
import { CardIndex } from "./components/CardIndex";
import { canonicalFor, Document } from "./document";
import { outputPathFor } from "./outputPath";
import {
  legacyPrintingRules,
  matchRedirect,
  parseRedirects,
  redirectRules,
  renderRedirects,
} from "./redirects";
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
 * Each of them used to build its own — 13,676 route resolutions twice, which
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
     * `card-search.ts` has collapsed them on exactly that rule since it was
     * written; this page was where the two surfaces disagreed.
     *
     * WHAT THE COLLAPSE MAY NOT COST is any version's address, which is the
     * half worth asserting: the row names the card, and each band names and
     * opens the version it is drawn for.
     */
    const lgs = all.find((resolved) => resolved.route === "/sets/lgs");
    const html = lgs?.render([], "islands.js") ?? "";
    expect(html).not.toBe("");

    const cells = html.match(/of-index__cell-name[^>]*>Angelic Wrath/g) ?? [];
    expect(cells).toHaveLength(1);

    /* The three versions, each a link, each named for the card and not merely
       for a pitch value — a band carries no text, so its label is all a screen
       reader has to tell one from the next. */
    for (const pitch of [1, 2, 3]) {
      expect(html).toContain(
        `<a class="of-index__split" href="${addressOf(`angelic-wrath-${pitch}`)}">`,
      );
      expect(html).toContain(`aria-label="Angelic Wrath (pitch ${pitch})"`);
    }

    /* And the name goes to the name's own version — `/card/angelic-wrath` is a
       301 now, so the row resolves it here rather than sending a reader
       through a hop. It is the pitch-1 card, which is what that URL rendered. */
    expect(html).toContain(`href="${addressOf("angelic-wrath-1")}"`);
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
     * It is the same rule `card-search.ts` states beside its own `partial` flag,
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
    expect(monarchHtml).toContain("of-index__cell-link");
    expect(monarchHtml).toContain("of-pitch-rule__band");
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

  test("the shared page for a name does not claim a row is the page", () => {
    /*
     * `/card/head-jab` RENDERS THE FIRST VERSION'S CARD at a URL of its own, so
     * the row whose art is shown addresses `/card/head-jab-1` — a different
     * page. Marking it `aria-current="page"` told a screen reader the link led
     * where the reader already was, which is the one thing that attribute
     * means. The row is still the current ITEM, and says so.
     */
    const table = tableIn(render(addressOf("head-jab-1")));
    expect(table).not.toContain('aria-current="page"');
    expect([...table.matchAll(/aria-current="true"/g)]).toHaveLength(1);
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
    expect(tableIn(html)).toContain("<td>—</td>");

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
     * `"true"` RATHER THAN `"page"`, and the assertion below names the value on
     * purpose. `"page"` claims the link addresses the URL being read, which is
     * false on `/card/<name>` — the shared page for a name renders the first
     * version's card, so the marked row points at `/card/<name>-1`. See the
     * test below it.
     *
     * AND FOUR PRINTINGS IN THIS CORPUS PUBLISH NO IMAGE, so there is no page
     * for their number to open. `Toughness`'s `SUP241` is one: its row keeps
     * every other column and carries no anchor.
     */
    const table = tableIn(render("/card/lgs/017-rf/head-jab-1"));
    expect([...table.matchAll(/aria-current="true"/g)]).toHaveLength(1);
    expect(table).toMatch(
      /<tr class="of-card__printing--shown">.*?LGS017.*?<\/tr>/s,
    );

    const faceless = tableIn(render(addressOf("toughness")));
    expect(faceless).toContain("SUP241");
    expect(faceless).not.toMatch(/<a[^>]*>\s*SUP241/);
  });
});

/* -------------------------------------------------------------------------- */
/* The credit line                                                             */
/* -------------------------------------------------------------------------- */

describe("the credit line spaces every fact, not a clump and a count", () => {
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

  test("rarity, code, artist and printings are four siblings", () => {
    const html = render(addressOf("adaptive-plating"));
    expect(html).toContain("of-card__band--credits");
    expect(creditsIn(html)).toBe(4);

    /* And they are in reading order: what grade, which printing, who drew it,
       how many. */
    const footer = footerOf(html);
    expect(footer.indexOf("of-card__rarity")).toBeLessThan(
      footer.indexOf("of-card__printing-code"),
    );
    expect(footer.indexOf("of-card__printing-code")).toBeLessThan(
      footer.indexOf("Illustrated by"),
    );
    expect(footer.indexOf("Illustrated by")).toBeLessThan(
      footer.indexOf('href="#printings"'),
    );
  });

  test("the code is one word, and only its set half is a link", () => {
    /*
     * `EVO013`, NOT `EVO 013` AND NOT `EVOEVO013`. Two ways to get this wrong,
     * and the markup is what rules out both: the anchor and the number sit
     * inside ONE span, because the paragraph around them is a flex row with a
     * gap that would otherwise print the citation as two words; and the number
     * is sliced at its own set prefix rather than composed from `set_id` and
     * `id`, which upstream already concatenated.
     */
    const footer = footerOf(render(addressOf("adaptive-plating")));
    expect(footer).toContain(
      '<span class="of-card__printing-code"><a href="/sets/evo">EVO' +
        '<span class="of-card__visually-hidden"> (Bright Lights)</span>' +
        "</a>013</span>",
    );

    /* The number is not inside the anchor: it names a position in a set and
       has nowhere of its own to go. */
    expect(footer).not.toMatch(/<a href="\/sets\/evo">[^<]*013/);
  });

  test("the code names the printing on screen, on every route", () => {
    /*
     * THE SAME RULE THE RARITY FOLLOWS, AND FOR THE SAME REASON: a page shows
     * one printing, so the caption under the picture states THAT printing's
     * number. A per-art route is where this can go wrong — the code came off
     * `card.printings[0]` in an early pass and captioned every art of a card
     * with the first one's number.
     */
    const codeIn = (html: string) =>
      footerOf(html)
        .match(
          /<span class="of-card__printing-code">(.*?)<\/span>\s*<\/p>/s,
        )?.[1]
        ?.replace(/<[^>]*>/g, "")
        .replace(/\s*\([^)]*\)\s*/g, "") ?? "";

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
        expect(`${route}: ${codeIn(html)}`).toBe(
          `${route}: ${face.printing.id}`,
        );
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
     * printing count are always there, the rarity is there exactly when this
     * printing has one, and the back exactly when it has one.
     */
    for (const page of CARD_PAGES.filter((_, index) => index % 37 === 0)) {
      const html = render(page.href);
      const footer = footerOf(html);
      const shown = facesOf(page.card)[0];

      expect(`${page.label}: artist`).toBe(
        `${page.label}: ${footer.includes("Illustrated by") || footer.includes("No artist is credited") ? "artist" : "none"}`,
      );
      expect(`${page.label}: ${footer.includes('href="#printings"')}`).toBe(
        `${page.label}: true`,
      );

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

  test("the visible title is bare, and the qualifier is still in the anchor", () => {
    /*
     * WHY THE QUALIFIER CANNOT SIMPLY BE DELETED. 900 names in this corpus
     * belong to more than one card, so "Belly Buster" is three anchors that
     * differ only in where they point — a WCAG 2.4.4 failure, and the exact one
     * `variantSuffix` was written to prevent. What changed is that the pitch is
     * carried by the rule under the name and the stone beside it instead of by
     * four words repeated on every row, so the text is hidden rather than
     * dropped: still inside the anchor, still part of its accessible name.
     *
     * A ROW THAT STANDS FOR EVERY VERSION HAS NOTHING TO QUALIFY and carries no
     * suffix at all — see the collapse tests above. This is about the other
     * kind: one version of a name whose siblings were printed somewhere else.
     */
    expect(html).not.toBe("");
    /* The suffix is present in the markup… */
    expect(html).toContain("of-index__variant");
    expect(html).toMatch(/of-index__variant[^>]*>\s*\(pitch \d\)/);
    /* …and never sits loose in a title, which is what the reader was seeing. */
    expect(html).not.toMatch(/of-index__cell-name[^>]*>[^<]*\(pitch \d\)/);
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
     * name never needed a suffix — and both views rendered the span regardless,
     * so `<span class="of-index__variant"></span>` went out on the majority of
     * rows. `ResultRow` has always guarded the identical case, so the rows view
     * was clean while the grid and the names list were not.
     *
     * ASSERTED AS A COUNT OF THE EMPTY FORM, not as the absence of the class:
     * the same page must still carry real qualifiers, which the test above it
     * pins. One number says both things only if it counts the empty ones.
     */
    expect(html).not.toBe("");
    expect(html).toContain("of-index__variant");
    expect(
      [...html.matchAll(/<span class="of-index__variant"><\/span>/g)].length,
    ).toBe(0);
  });

  test("in every view, and the names view needs its own render to say so", () => {
    /*
     * THE SET PAGE ONLY EVER PROVES THE GRID. `CardIndex` has three views and
     * the switch between them is client state, so a route render can only ever
     * exercise the default one — the test above would stay green with the guard
     * reverted in the names list alone, which is exactly the shape of the bug
     * it is meant to catch. Measured: it does. So this renders the COMPONENT,
     * which is the only way to reach the other two.
     *
     * ROWS IS HERE TOO, AND IT IS THE CONTROL. `ResultRow` has always guarded
     * this case, so that view was correct before the change and must still be —
     * a fixture that produced an empty span there would mean the primitive had
     * regressed rather than this component.
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
          { pitch: 0 as const, href: "/card/anothos", label: "Anothos" },
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
          },
        ],
      },
    ];

    for (const display of ["grid", "list", "text"] as const) {
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
      expect(`${display}: ${markup.includes(" (pitch 2)")}`).toBe(
        `${display}: true`,
      );
      expect(
        `${display}: ${[...markup.matchAll(/class="[^"]*variant[^"]*"><\/span>/g)].length}`,
      ).toBe(`${display}: 0`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The redirect table                                                          */
/* -------------------------------------------------------------------------- */

describe("_redirects keeps every pre-change card URL alive", () => {
  const rules = redirectRules(CARD_REDIRECTS, ROUTE_SET_CODES);

  test("the table is what the build writes and what the server reads back", () => {
    /*
     * ROUND-TRIPPED, BECAUSE THE FILE IS THE INTERFACE. `build.ts` renders
     * these rules to `dist/_redirects` and `serve.ts` parses that file back —
     * two functions in this module and one artefact between them. A renderer
     * and a parser that disagree produce a dev server that resolves a redirect
     * nobody's host will, or misses one everybody's host applies, and neither
     * shows up as a failure anywhere else.
     */
    expect(parseRedirects(renderRedirects(rules))).toEqual([...rules]);
  });

  test("comments and blank lines are not rules", () => {
    // The rendered file leads with four comment lines and a blank one.
    const text = renderRedirects(rules);
    expect(text.split("\n")[0]?.startsWith("#")).toBe(true);
    expect(parseRedirects(text).length).toBe(rules.length);
  });

  test("an old card URL resolves to the page that card is served at", () => {
    const target = matchRedirect(rules, "/card/head-jab-1");
    expect(target).toBe(addressOf("head-jab-1"));

    // And a bare shared name lands on the version it used to render.
    expect(matchRedirect(rules, "/card/head-jab")).toBe(
      addressOf("head-jab-1"),
    );
  });

  test("one rule per set code permutes the old printing form", () => {
    /*
     * 6,437 URLs, 112 rules — one per set code the routes use. See
     * `legacyPrintingRules` for why it is not the single unconstrained
     * placeholder that would obviously do the same job.
     */
    expect(legacyPrintingRules(ROUTE_SET_CODES).length).toBe(
      ROUTE_SET_CODES.length,
    );
    expect(matchRedirect(rules, "/card/head-jab-1/lgs/017-rf")).toBe(
      "/card/lgs/017-rf/head-jab-1",
    );
    expect(matchRedirect(rules, "/card/a-drop-in-the-ocean/mst/095-mv")).toBe(
      "/card/mst/095-mv/a-drop-in-the-ocean",
    );
  });

  test("THE TABLE DOES NOT CYCLE, which the first version of it did", () => {
    /*
     * THE BUG THIS EXISTS FOR, STATED PLAINLY. The obvious spelling of the
     * permutation is one rule — `/card/:slug/:set/:number` →
     * `/card/:set/:number/:slug` — and it is a 3-cycle over unconstrained
     * placeholders: `(a,b,c) → (b,c,a) → (c,a,b) → (a,b,c)`. An unforced rule
     * is skipped only when a FILE exists at the REQUEST path; Netlify never
     * checks the target. So a mistyped card URL would 301 around that ring
     * forever and the reader would see `ERR_TOO_MANY_REDIRECTS` rather than a
     * 404 — on a path whose only sin was not existing.
     *
     * Pinning the set code to the segment the OLD form put it in separates the
     * two shapes, and this is the assertion that says so.
     */
    /* EXHAUSTIVE, AND SPLIT THE SAME WAY THE GUARD SPLITS IT. `matchRedirect`
       over all 5,953 rules, 5,953 times, is 35M comparisons — the first version
       of this test took 8s and failed on bun's 5s timeout rather than on a
       cycle, which is a worse outcome than not having written it. Exact sources
       answer from a Set; only the 112 patterns need matching. */
    const exact = new Set(
      rules.filter((rule) => !rule.from.includes(":")).map((rule) => rule.from),
    );
    const patterns = rules.filter((rule) => rule.from.includes(":"));
    expect(patterns.length).toBe(ROUTE_SET_CODES.length);

    for (const rule of rules) {
      const probe = rule.to.replace(/:[a-z]+/gi, "x");
      const next = exact.has(probe) ? probe : matchRedirect(patterns, probe);
      expect(`${rule.from} → ${next}`).toBe(`${rule.from} → undefined`);
    }
  });

  test("a dead card URL 404s after one hop, and a live one is untouched", () => {
    /* The permuted target of a real old URL is a page, so the browser stops
       there. `matchRedirect` returning undefined for it IS "the chain ends". */
    const moved = matchRedirect(rules, "/card/head-jab-1/lgs/017-rf");
    expect(moved).toBe("/card/lgs/017-rf/head-jab-1");
    expect(matchRedirect(rules, moved ?? "")).toBeUndefined();

    /* A three-segment path naming nothing: one hop, then nothing. Its second
       segment is a set code, so the old-form rule fires exactly once. */
    const dead = matchRedirect(rules, "/card/not-a-card/lgs/000");
    expect(dead).toBe("/card/lgs/000/not-a-card");
    expect(matchRedirect(rules, dead ?? "")).toBeUndefined();

    /* And one whose second segment is NOT a set code never enters the table at
       all — a mistyped NEW-form URL, which is the shape that used to loop. */
    expect(matchRedirect(rules, "/card/lgs/017-rf/head-jabb")).toBeUndefined();
  });

  test("three card slugs are spelled like set codes, and it does not matter", () => {
    /*
     * `fai`, `nuu` and `zen` are card slugs AND set codes. The old-form rules
     * pin the code in segment TWO and leave segment one an unconstrained slug,
     * so those cards' URLs are ordinary — measured here rather than argued,
     * because the mirror-image fix (pinning segment one) would have broken on
     * exactly this and it is not obvious which way round the hazard falls.
     */
    const overlapping = CARD_PAGES.filter((page) =>
      ROUTE_SET_CODES.includes(page.slug),
    ).map((page) => page.slug);
    expect(overlapping.toSorted()).toEqual(["fai", "nuu", "zen"]);

    expect(matchRedirect(rules, "/card/zen/lgs/017-rf")).toBe(
      "/card/lgs/017-rf/zen",
    );
  });

  test("a trailing slash does not defeat a rule", () => {
    // Netlify does not care about one, and neither may the dev server, or a
    // link pasted with a slash on the end would 404 locally and work in
    // production.
    expect(matchRedirect(rules, "/card/head-jab-1/")).toBe(
      addressOf("head-jab-1"),
    );
  });

  test("a live page is not matched by an exact rule", () => {
    /*
     * The placeholder DOES match a live printing URL — both forms are three
     * segments under `/card/` — and that is safe only because the rule is
     * unforced and `serve.ts` tries the file first. What must never happen is
     * an EXACT rule shadowing a page, which is why `cards.test.ts` asserts no
     * redirect source is also a route. Asserted from this side too: the two
     * checks fail for different reasons and a table can break either way.
     */
    const exact = rules.filter((rule) => !rule.from.includes(":"));
    const addresses = new Set(CARD_ROUTES.map((route) => route.href));
    for (const rule of exact) expect(addresses.has(rule.from)).toBe(false);
  });

  test("a duplicated source is a build failure, not a silent loser", () => {
    expect(() =>
      redirectRules(
        [
          { from: "/card/x", to: "/card/a/1/x" },
          { from: "/card/x", to: "/card/b/2/x" },
        ],
        ROUTE_SET_CODES,
      ),
    ).toThrow(/redirected twice/);
  });

  test("a rule whose target re-enters the table is a build failure", () => {
    /* The guard, exercised. A card redirect pointing at something the
       old-form rules still match is the same loop arriving from the other
       direction, and it has to stop the build rather than ship. */
    expect(() =>
      redirectRules([{ from: "/card/x", to: "/card/y/lgs/1" }], ["lgs"]),
    ).toThrow(/cycle/);
  });

  test("matchRedirect refuses a splat rather than ignoring it", () => {
    // A dev server that quietly drops a rule production applies is worse than
    // one that will not start.
    expect(() =>
      matchRedirect(
        [{ from: "/old/*", to: "/new/:splat", status: 301 }],
        "/old/x",
      ),
    ).toThrow(/does not implement splats/);
  });
});
