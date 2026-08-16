/**
 * The generator's own invariants.
 *
 * These are not tests of React or of the filesystem. Every one of them asserts
 * a failure that is SILENT by default — a page written to the wrong address, a
 * page overwriting another, a page shipped without the disclaimer. The build
 * reports success in all three cases, which is why they are worth a test each.
 */

import { describe, expect, test } from "bun:test";

import { CARD_PAGES, CORPUS as CARDS } from "../src/lib/cards";
import { LSS_DISCLAIMER } from "../src/lib/compliance";
import { facesOf } from "../src/lib/printings";
import { setFor } from "../src/lib/sets";
import { canonicalFor, Document } from "./document";
import { outputPathFor } from "./outputPath";
import { fillPattern, renderRoute, resolveRoutes } from "./render";
import { routes } from "./routes";
import type { PageModule, PageResult } from "./types";

/* -------------------------------------------------------------------------- */
/* URLs to files                                                               */
/* -------------------------------------------------------------------------- */

describe("outputPathFor", () => {
  test("every route is a directory index, because the live URLs are", () => {
    /*
     * `/syntax/index.html` and not `/syntax.html`. A static host serves the
     * first at both `/syntax` and `/syntax/`, and the second only at
     * `/syntax.html`. All 13,675 URLs already shipped are the directory form,
     * so this is a compatibility requirement rather than a preference.
     */
    expect(outputPathFor("/syntax")).toBe("syntax/index.html");
    expect(outputPathFor("/card/head-jab-1")).toBe(
      "card/head-jab-1/index.html",
    );
    expect(outputPathFor("/card/head-jab-1/ksu/011")).toBe(
      "card/head-jab-1/ksu/011/index.html",
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
    expect(canonicalFor("/card/x/omn/243-cf", "/card/x")).toBe(
      "https://optfall.com/card/x/",
    );
  });

  test("it emits a doctype, which React cannot render on its own", () => {
    const html = render({ title: "t", description: "d", children: null }, "/x");
    expect(html.startsWith("<!doctype html>")).toBe(true);
  });

  test("no hydration markers, because no root here hydrates", () => {
    // `renderToStaticMarkup`, not `renderToString`. The pages are documents;
    // interactivity arrives as islands in their own containers. Hydration
    // scaffolding on 13,675 pages would describe a handover that never happens.
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
      entries: { label: string; faceKey: string | null }[];
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

    const noscript =
      /<noscript>(.*?)<\/noscript>/s.exec(monarchHtml)?.[1] ?? "";
    const anchors = noscript.match(/<a href="\/card\//g) ?? [];
    expect(anchors.length).toBe(entries.length);
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
    const html = render("/card/absorb-in-aether-1");
    expect(html).not.toBe("");
    expect(html).toContain('aria-label="No printed power"');
    /* The plate it drew is still the POWER plate — the silhouette is what says
       which stat is missing. */
    expect(html).toContain("of-stat--power");
  });

  test("equipment draws cost and power empty, because the frame has them", () => {
    /* `Aether Ironweave` is Runeblade Equipment: defence only. */
    const html = render("/card/aether-ironweave");
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
     * another card lives at `/card/<slug>-<pitch>`, leaving `/card/<slug>` as
     * the disambiguation page, which carries no stat block at all. Every
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
/* The printing picker's captions                                             */
/* -------------------------------------------------------------------------- */

describe("every picker tile says which printing it is", () => {
  const render = (route: string) =>
    RESOLVED.find((resolved) => resolved.route === route)?.render(
      [],
      undefined,
    ) ?? "";

  /**
   * The picker's tiles READ BACK OUT OF THE RENDERED PAGE, caption by caption.
   *
   * PARSED RATHER THAN RECOMPUTED, AND THE FIRST VERSION OF THIS FILE DID THE
   * OTHER THING. It derived each tile's caption from the corpus with its own
   * copy of the dedupe, then asserted a property of THAT — which is a test of
   * the corpus wearing a test of the page's clothes. Both tests below passed
   * with the feature deleted: one because `Cold Foil` also appears in the
   * printings table further down every card page, so `toContain` found it with
   * the picker caption gone; the other because it never rendered a page at all.
   *
   * Reading the markup is what makes the assertions about what a reader sees.
   * A regex over HTML is normally a poor idea; here the markup being matched is
   * three sibling spans emitted by one component ten lines long, and the
   * alternative — a DOM parser — would be a dependency to read three strings.
   *
   * THE ISLAND'S `data-props` JSON IS NOT MATCHED, and that is worth stating
   * because the same values appear there. The pattern anchors on the `<span
   * class="of-picker__…">` markup that only the server-rendered tiles carry, so
   * a component that stopped rendering a caption could not pass on the strength
   * of the props blob beside it.
   */
  const tilesIn = (html: string) =>
    [
      ...html.matchAll(/<label class="of-picker__tile[^"]*">(.*?)<\/label>/gs),
    ].map((tile) => {
      const span = (name: string) =>
        tile[1]?.match(
          new RegExp(`<span class="of-picker__${name}">([^<]*)</span>`),
        )?.[1] ?? "";
      return {
        setName: span("set"),
        id: span("id"),
        foiling: span("foiling"),
      };
    });

  test("two tiles under one number are told apart by their foiling", () => {
    /*
     * THE BUG, PINNED ON THE CARD THAT SHOWS IT WORST. `Aether Ashwing` has
     * four printings across two sets and three distinct arts under `UPR042`
     * alone: the standard art, a cold foil, and a second cold foil. All three
     * carried the caption "Uprising · UPR042" — a control offering three
     * choices with one name between them.
     *
     * Measured off the rendered captions before the fix: 1,735 tiles on 791
     * cards read identically to a sibling.
     */
    const tiles = tilesIn(render("/card/aether-ashwing"));
    expect(tiles.length).toBe(4);

    const upr = tiles.filter((tile) => tile.id === "UPR042");
    expect(upr.length).toBe(3);
    /*
     * THE ASSERTION IS THAT THE STANDARD ART IS SEPARABLE FROM THE FOILS, which
     * is the whole of what this change buys on this card. Two of the three are
     * the documented `art_variations` residue and remain identical to each
     * other; before the change all THREE were.
     */
    expect(upr.map((tile) => tile.foiling).toSorted()).toEqual([
      "Cold Foil",
      "Cold Foil",
      "Standard",
    ]);
    /* And the standard art says what IT is, rather than the foiling line being
       a badge only the odd ones out wear. */
    expect(tiles.find((tile) => tile.id === "DRO003")?.foiling).toBe(
      "Standard",
    );
  });

  test("a tile names every foiling its art is published at, not just the first", () => {
    /*
     * THE HALF THAT IS EASY TO GET WRONG, and the reason `foilingsByFace` is a
     * pass over all printings rather than a field read off the printing that
     * claimed the tile. 3,179 of the 9,328 tiles the site renders are shared by
     * printings at more than one foiling — one image published Standard AND
     * Rainbow Foil — and captioning such a tile "Standard" states one of the
     * two things the picture is.
     *
     * `Head Jab` is named rather than searched for because it is the card the
     * picker's own comments are written about, and its Welcome to Rathe entries
     * exercise this beside the edition disambiguation rather than instead of it:
     * one number, two editions, each of them one art published at two foilings.
     */
    const tiles = tilesIn(render("/card/head-jab-1"));
    const wtr = tiles.filter((tile) => tile.id.startsWith("WTR098"));
    expect(wtr.length).toBe(2);
    for (const tile of wtr) {
      /* The list, not the first of it. */
      expect(tile.foiling).toBe("Standard · Rainbow Foil");
      /* And the edition disambiguation is untouched — the two are separated by
         one fact each, on different lines. */
      expect(tile.id).toMatch(/^WTR098 · (Alpha|Unlimited)$/);
    }
  });

  test("what foiling cannot disambiguate is a marker in a file name", () => {
    /*
     * THE RESIDUE, ASSERTED SO IT CANNOT GROW QUIETLY. Foiling takes the 1,735
     * identical captions down to 279, and this pins BOTH halves: that the fix
     * lands, and that what survives it is the shape `PrintingPicker` names. A
     * resync that reintroduced a kind of collision foiling ought to have solved
     * would fail here rather than ship a picker with two nameless tiles on a
     * card nobody happened to open.
     *
     * What survives is arts upstream separates only by a marker in the image
     * file name, for which the corpus publishes no display vocabulary. 237 of
     * the 279 are one shape: a front and a back under one number at one foiling
     * — `DYN212-CF_BACK` beside `DYN212-MV_BACK` — which the printings table
     * answers in its `Other face` column. The rest are lettered or
     * `art_variations` variants: `MST158` beside `MST158-A` and `MST158-B`,
     * `FAB470-RFA` beside `-RFB` and `-RFC`, `UPR042-CF` beside `UPR042-MV`.
     * Naming those on the tile would mean inventing a vocabulary the source
     * does not define.
     *
     * COUNTED OFF THE RENDERED CAPTIONS, so it measures the control rather than
     * the corpus. Deleting the foiling line takes this to 1,735 and fails. An
     * earlier version of this test recomputed the captions from the corpus
     * instead and was wrong in both directions at once: it stayed green with
     * the feature removed, AND it overcounted — grouping by number alone, it
     * called all three of `Aether Ashwing`'s UPR042 tiles ambiguous when the
     * Standard one is plainly distinguishable from the two Cold Foils. That
     * is where the 1,410 and 359 in the first draft of this change came from.
     *
     * THE CANDIDATES ARE NARROWED FROM THE CORPUS, and only the narrowing is.
     * Two tiles can only caption identically if they share a set and a collector
     * number, which is cheap to find; those pages are rendered and every
     * survivor is judged on its markup. Rendering all 4,941 card pages to reach
     * the same number would spend the bulk of a test run proving that cards with
     * one printing have no collision.
     */
    const suspects = CARD_PAGES.filter((page) => {
      const numbers = facesOf(page.card).map(
        (ref) => `${ref.printing.set_id}/${ref.printing.id}`,
      );
      return new Set(numbers).size < numbers.length;
    });
    /* The narrowing has to actually find things; a selector that silently went
       empty would leave the count below trivially at zero. */
    expect(suspects.length).toBeGreaterThan(500);

    let ambiguous = 0;
    for (const page of suspects) {
      const byCaption = new Map<string, number>();
      for (const tile of tilesIn(render(page.href))) {
        /*
         * THE WHOLE CAPTION, WHICH IS THE POINT. Set name, collector number
         * (carrying the edition where `CardEntry` appended it) and foiling are
         * the three lines a reader has; two tiles agreeing on all three are two
         * choices the control cannot tell apart. Counting only the tiles that
         * actually collide — not every tile in a group containing a collision —
         * is what the corpus-side version got wrong.
         */
        const caption = `${tile.setName}|${tile.id}|${tile.foiling}`;
        byCaption.set(caption, (byCaption.get(caption) ?? 0) + 1);
      }
      for (const count of byCaption.values()) if (count > 1) ambiguous += count;
    }

    /*
     * AN EQUALITY, NOT A CEILING. A `toBeLessThan` would pass just as happily
     * if the count went to zero for the wrong reason — a face-keying change
     * that collapsed distinct arts into one tile — and losing a printing is a
     * worse outcome than captioning one ambiguously.
     */
    expect(ambiguous).toBe(279);
  });
});
