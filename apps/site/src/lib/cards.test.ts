/**
 * The legality derivation, pinned.
 *
 * WHY THIS FILE EXISTS, STATED PLAINLY. `verdictFor` is the single piece of
 * logic the project's positioning rests on: `README.md` names an incumbent
 * with real commercial backing that "ships incorrect banned flags on legal
 * cards", and `docs/DATA-TERMS.md` says "being right is the entire product".
 * Until this
 * file landed, nothing in the aggregate gate asserted that Optfall does not
 * ship the same bug. The derivation was correct, and a future edit could have
 * reintroduced exactly the incumbent failure and gone green.
 *
 * THE TRAP IT GUARDS. Upstream's `cc_legal` does NOT mean "you may play it" —
 * it means "in the Classic Constructed card pool", and it is `true` on all 51
 * `cc_banned` cards. A surface that reads the legal flag first, or reads it *as
 * well*, marks all 51 banned cards Legal. That is not a hypothetical: it is the
 * shape of the incumbent bug, and it is one `if` away at all times.
 *
 * WHAT THE NUMBERS IN HERE ARE. Every count is a **regression anchor measured
 * against this pinned corpus**, not a claim about Flesh and Blood. The corpus
 * is committed and pinned to an upstream commit, so these are facts about a
 * file in this repository — and when a scheduled sync moves that file, a
 * changed count here is the changelog, which is exactly what it is for. Each
 * one is asserted twice: once as a literal, and once against the corpus's own
 * published `counts.legality`, so a derivation that drifts and a corpus that
 * changes fail differently.
 */

import { describe, expect, test } from "bun:test";

import type { StateTone } from "optfall-theme";

import { tokeniseCard } from "./card-search/tokenise";

import {
  CARD_PAGES,
  CARD_ROUTES,
  CORPUS,
  FORMATS,
  LAST_CONFIRMED,
  descriptionFor,
  NAME_GROUPS,
  facesOf,
  hrefForPrinting,
  labelFor,
  pitchValueOf,
  slugify,
  variantSuffix,
  verdictFor,
  type Card,
  type CardPage,
} from "./cards";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const formatById = (id: string) => {
  const format = FORMATS.find((candidate) => candidate.id === id);
  if (format === undefined) throw new Error(`no format ${id}`);
  return format;
};

const cardsWithFlag = (flag: string): readonly Card[] =>
  CORPUS.cards.filter((card) => card.legality[flag] === true);

const tonesFor = (card: Card, formatId: string): readonly StateTone[] =>
  verdictFor(card, formatById(formatId)).states.map((state) => state.tone);

const pageNamed = (name: string): CardPage => {
  const page = CARD_PAGES.find((candidate) => candidate.card.name === name);
  if (page === undefined) throw new Error(`no card named ${name}`);
  return page;
};

/* -------------------------------------------------------------------------- */
/* The corpus this file is pinned to                                           */
/* -------------------------------------------------------------------------- */

describe("the pinned corpus", () => {
  test("is the shape every other assertion here assumes", () => {
    expect(CORPUS.schemaVersion).toBe(2);
    expect(CORPUS.counts.cards).toBe(4941);
    expect(CORPUS.cards.length).toBe(CORPUS.counts.cards);
    expect(CORPUS.counts.printings).toBe(16502);
    expect(CORPUS.counts.names).toBe(3158);
    expect(CORPUS.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(LAST_CONFIRMED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("carries TCGplayer's product on the printings that have one", () => {
    /*
     * THIS IS A DROP DETECTOR, not a coverage report. The fields sat in
     * `DROPPED_PRINTING_FIELDS` for most of this corpus's life, and the way
     * they would go missing again is a sync that quietly stops carrying them —
     * which looks like nothing at all in an 18 MB JSON diff. A count that has to
     * be updated deliberately is the cheapest alarm for that.
     */
    const printings = CORPUS.cards.flatMap((card) => card.printings);
    const withProduct = printings.filter(
      (printing) => printing.tcgplayer_url !== undefined,
    );

    expect(printings.length).toBe(16502);
    expect(withProduct.length).toBe(15166);

    // Absent, never empty or null — upstream omits the key and so do we.
    for (const printing of printings) {
      if (printing.tcgplayer_url === undefined) {
        expect(printing.tcgplayer_product_id).toBeUndefined();
        continue;
      }
      expect(printing.tcgplayer_url).toStartWith(
        "https://www.tcgplayer.com/product/",
      );
      expect(printing.tcgplayer_product_id).toMatch(/^\d+$/);
    }
  });

  test("keeps the foiling in the storefront url", () => {
    /*
     * The reason the link is on the printings row at all. If upstream ever
     * flattens these to one product per collector number, a Standard and a
     * Rainbow Foil would start sharing a link and the row would be lying —
     * so the distinction is asserted rather than assumed.
     */
    const shared = CORPUS.cards
      .flatMap((card) => card.printings)
      .filter((printing) => printing.tcgplayer_url !== undefined)
      .reduce<Map<string, Set<string>>>((seen, printing) => {
        const key = `${printing.set_id}${printing.id}`;
        const urls = seen.get(key) ?? new Set<string>();
        urls.add(printing.tcgplayer_url ?? "");
        return seen.set(key, urls);
      }, new Map());

    const withSeveral = [...shared.values()].filter((urls) => urls.size > 1);
    expect(withSeveral.length).toBeGreaterThan(0);
  });

  test("publishes the six flag counts this file is anchored on", () => {
    // Asserted against the corpus's own envelope as well as against literals,
    // so "the derivation drifted" and "the corpus changed" fail differently.
    const published = CORPUS.counts.legality;
    expect(published["cc_banned"]).toBe(51);
    expect(published["blitz_banned"]).toBe(45);
    expect(published["ll_banned"]).toBe(5);
    expect(published["commoner_banned"]).toBe(10);
    expect(published["silver_age_banned"]).toBe(78);
    expect(published["upf_banned"]).toBe(2);
    expect(published["cc_living_legend"]).toBe(42);
    expect(published["blitz_living_legend"]).toBe(21);
    expect(published["ll_restricted"]).toBe(20);

    expect(cardsWithFlag("cc_banned").length).toBe(51);
    expect(cardsWithFlag("blitz_banned").length).toBe(45);
    expect(cardsWithFlag("ll_banned").length).toBe(5);
    expect(cardsWithFlag("commoner_banned").length).toBe(10);
    expect(cardsWithFlag("silver_age_banned").length).toBe(78);
    expect(cardsWithFlag("upf_banned").length).toBe(2);
    expect(cardsWithFlag("cc_living_legend").length).toBe(42);
    expect(cardsWithFlag("blitz_living_legend").length).toBe(21);
    expect(cardsWithFlag("ll_restricted").length).toBe(20);
  });
});

/* -------------------------------------------------------------------------- */
/* The incumbent bug                                                           */
/* -------------------------------------------------------------------------- */

describe("exclusions are read before the legal flag", () => {
  test("every cc_banned card is Banned, and not one of them is Legal", () => {
    const banned = cardsWithFlag("cc_banned");
    expect(banned.length).toBe(51);

    for (const card of banned) {
      const tones = tonesFor(card, "classic-constructed");
      expect(tones).toContain("banned");
      expect(tones).not.toContain("legal");
    }
  });

  test("all 51 of them are ALSO cc_legal upstream — which is the whole trap", () => {
    // If this ever stops being true the trap has gone away and the assertion
    // above stops proving anything, so the premise is pinned too.
    const banned = cardsWithFlag("cc_banned");
    const alsoLegal = banned.filter(
      (card) => card.legality["cc_legal"] === true,
    );
    expect(alsoLegal.length).toBe(51);
  });

  test("no card anywhere derives Legal alongside an exclusion", () => {
    const EXCLUSIONS: ReadonlySet<StateTone> = new Set([
      "banned",
      "suspended",
      "restricted",
      "living-legend",
    ]);
    const offenders: string[] = [];
    for (const page of CARD_PAGES) {
      for (const verdict of page.verdicts) {
        const tones = verdict.states.map((state) => state.tone);
        if (!tones.includes("legal")) continue;
        if (tones.some((tone) => EXCLUSIONS.has(tone))) {
          offenders.push(`${page.card.name} in ${verdict.format.name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("the same rule holds in every format, not only Classic Constructed", () => {
    const pairs: readonly (readonly [string, string])[] = [
      ["blitz", "blitz_banned"],
      ["living-legend", "ll_banned"],
      ["commoner", "commoner_banned"],
      ["silver-age", "silver_age_banned"],
      ["ultimate-pit-fight", "upf_banned"],
    ];
    for (const [formatId, flag] of pairs) {
      for (const card of cardsWithFlag(flag)) {
        const tones = tonesFor(card, formatId);
        expect(tones).toContain("banned");
        expect(tones).not.toContain("legal");
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Simultaneous states                                                         */
/* -------------------------------------------------------------------------- */

describe("more than one state can be true at once, and none is discarded", () => {
  test("Winter's Wail is Banned AND Living Legend in Classic Constructed", () => {
    const card = pageNamed("Winter's Wail").card;
    expect(card.legality["cc_banned"]).toBe(true);
    expect(card.legality["cc_living_legend"]).toBe(true);

    const verdict = verdictFor(card, formatById("classic-constructed"));
    expect(verdict.states.map((state) => state.tone)).toEqual([
      "banned",
      "living-legend",
    ]);
    // Severity order, and each state carries its own start date rather than
    // sharing one — they began eighteen months apart.
    expect(verdict.states[0]?.since).toBe("2023-01-30");
    expect(verdict.states[1]?.since).toBe("2023-07-07");
  });

  test("it is the only card in the corpus carrying two states in one format", () => {
    const multiple = CARD_PAGES.flatMap((page) =>
      page.verdicts
        .filter((verdict) => verdict.states.length > 1)
        .map((verdict) => `${page.card.name} · ${verdict.format.name}`),
    );
    expect(multiple).toEqual(["Winter's Wail · Classic Constructed"]);
  });

  test("every card in every format has at least one state, or is unknown", () => {
    for (const page of CARD_PAGES) {
      for (const verdict of page.verdicts) {
        expect(verdict.states.length > 0 || verdict.unknown).toBe(true);
        // Never both: "we know nothing" and "here is what we know" are
        // contradictory claims, and a page that could render both would be
        // rendering a bug.
        expect(verdict.states.length > 0 && verdict.unknown).toBe(false);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Absence is not falsehood                                                    */
/* -------------------------------------------------------------------------- */

describe("a flag the dataset does not publish is never read as false", () => {
  test("Ultimate Pit Fight is unknown, not Not in format, on a card with no upf_banned", () => {
    const card = pageNamed("Command and Conquer").card;
    expect(card.legality["upf_legal"]).toBeUndefined();
    expect(card.legality["upf_banned"]).toBe(false);

    const verdict = verdictFor(card, formatById("ultimate-pit-fight"));
    expect(verdict.unknown).toBe(true);
    expect(verdict.states).toEqual([]);
    expect(verdict.states.map((state) => state.tone)).not.toContain(
      "not-in-format",
    );
  });

  test("Ultimate Pit Fight is unknown on 4,939 cards and Banned on 2", () => {
    const verdicts = CARD_PAGES.map((page) =>
      verdictFor(page.card, formatById("ultimate-pit-fight")),
    );
    expect(verdicts.filter((verdict) => verdict.unknown).length).toBe(4939);
    expect(
      verdicts.filter((verdict) =>
        verdict.states.some((state) => state.tone === "banned"),
      ).length,
    ).toBe(2);
    expect(
      verdicts.some((verdict) =>
        verdict.states.some((s) => s.tone === "legal"),
      ),
    ).toBe(false);
  });

  test("a false legal flag IS Not in format, which is a different claim", () => {
    // Commoner publishes `commoner_legal`, so `false` there is a statement
    // rather than a silence — 2,246 cards are outside that pool.
    const card = pageNamed("Command and Conquer").card;
    expect(card.legality["commoner_legal"]).toBe(false);
    expect(tonesFor(card, "commoner")).toEqual(["not-in-format"]);
  });

  test("evidence marks an absent key absent rather than printing false", () => {
    const verdict = verdictFor(
      pageNamed("Command and Conquer").card,
      formatById("ultimate-pit-fight"),
    );
    const start = verdict.evidence.find(
      (fact) => fact.key === "upf_banned_start",
    );
    expect(start).toEqual({
      key: "upf_banned_start",
      value: "—",
      present: false,
    });
  });

  test("every format's evidence covers every key that format claims", () => {
    for (const page of CARD_PAGES.slice(0, 200)) {
      page.verdicts.forEach((verdict, index) => {
        expect(verdict.evidence.map((fact) => fact.key)).toEqual([
          ...(FORMATS[index]?.keys ?? []),
        ]);
      });
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The derived tone census                                                     */
/* -------------------------------------------------------------------------- */

describe("the derived tone census", () => {
  test("is exactly this, per format", () => {
    const census = (formatId: string) => {
      const counts: Record<string, number> = {};
      for (const page of CARD_PAGES) {
        for (const tone of tonesFor(page.card, formatId)) {
          counts[tone] = (counts[tone] ?? 0) + 1;
        }
      }
      return counts;
    };

    // Classic Constructed: 4,798 cards are `cc_legal`, of which 51 are banned
    // and 42 are Living Legend, with Winter's Wail in both — so 4,798 − 92 =
    // 4,706 render Legal. That arithmetic is the whole point of the file.
    expect(census("classic-constructed")).toEqual({
      legal: 4706,
      "not-in-format": 143,
      banned: 51,
      "living-legend": 42,
    });
    expect(census("blitz")).toEqual({
      legal: 4751,
      "not-in-format": 124,
      banned: 45,
      "living-legend": 21,
    });
    expect(census("living-legend")).toEqual({
      legal: 4773,
      "not-in-format": 143,
      restricted: 20,
      banned: 5,
    });
    expect(census("commoner")).toEqual({
      legal: 2685,
      "not-in-format": 2246,
      banned: 10,
    });
    expect(census("silver-age")).toEqual({
      legal: 3780,
      "not-in-format": 1083,
      banned: 78,
    });
    expect(census("ultimate-pit-fight")).toEqual({ banned: 2 });
  });

  test("Legal plus the exclusions equals the cards in each format's pool", () => {
    for (const format of FORMATS) {
      const legalKey = format.flags.legal;
      if (legalKey === null) continue;
      const inPool = cardsWithFlag(legalKey).length;
      const derived = CARD_PAGES.filter((page) => {
        const tones = tonesFor(page.card, format.id);
        return tones.length > 0 && !tones.includes("not-in-format");
      }).length;
      expect(derived).toBe(inPool);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Addressing                                                                  */
/* -------------------------------------------------------------------------- */

describe("addressing", () => {
  test("every route has a distinct address, so no printing is unreachable", () => {
    const hrefs = CARD_ROUTES.map((route) => route.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);

    /*
     * ONE ROUTE PER DISTINCT FACE, AND THE DEFAULT IS NOT SPECIAL. The old
     * table was 4,941 card pages + 900 shared names + 6,437 non-default
     * printings; it is 11,378 printings and nothing else, because
     * `/card/<slug>` and `/card/<name>` are 301s.
     */
    expect(CARD_PAGES.length).toBe(4941);
    expect(NAME_GROUPS.length).toBe(900);
    expect(CARD_ROUTES.length).toBe(11378);
    expect(CARD_ROUTES.filter((route) => route.isDefault).length).toBe(4941);
  });

  test("set and number alone are NOT unique, which is why the name tail exists", () => {
    /*
     * THE MEASUREMENT BEHIND THE SCHEME. Runechant and the Embodiments are
     * printed on one physical double-sided token and share its art, so
     * `ros/257-v2` and `ros/257-v2-back` are each claimed by two different
     * cards. Scryfall's bare `/card/<set>/<number>` would be ambiguous here;
     * the slug tail is what makes these four addresses distinct.
     *
     * Asserted rather than noted, because the day this becomes true of a
     * hundred more printings is the day somebody proposes dropping the tail.
     */
    const bare = CARD_ROUTES.map((route) => `${route.setCode}/${route.number}`);
    const shared = new Set(
      bare.filter((address, index) => bare.indexOf(address) !== index),
    );
    expect([...shared].toSorted()).toEqual(["ros/257-v2", "ros/257-v2-back"]);
  });

  test("every card is addressable, and its own href is its default printing", () => {
    const byCard = new Map(
      CARD_ROUTES.filter((route) => route.isDefault).map((route) => [
        route.page.card.unique_id,
        route,
      ]),
    );
    expect(byCard.size).toBe(CARD_PAGES.length);

    for (const page of CARD_PAGES) {
      const route = byCard.get(page.card.unique_id);
      expect(route?.href).toBe(page.href);
      expect(route?.index).toBe(0);
    }
  });

  test("a shared name resolves to the version that URL used to render", () => {
    const jab = NAME_GROUPS.find((page) => page.slug === "head-jab");
    const lowest = jab?.cards[0];
    expect(lowest?.slug).toBe("head-jab-1");
    expect(jab?.href).toBe(lowest?.href);

    /*
     * THE ONE GROUP WHERE PITCH ORDER AND `byPitch` DISAGREE. Hyper Driver is
     * printed at pitch 1, 2 and 3 plus an unpitched version, and `pitchValueOf`
     * reports that last one as 0 — first by a naive sort, last by the rule the
     * site actually uses. `/card/hyper-driver` rendered the pitch 1 version
     * before the change, and the tab strip and the typeahead still have to
     * lead with it.
     */
    const hyperGroup = NAME_GROUPS.find((page) => page.slug === "hyper-driver");
    expect(hyperGroup?.cards[0]?.pitch).toBe(1);
    expect(hyperGroup?.href).toBe(hyperGroup?.cards[0]?.href);
  });

  test("no slug is empty, and none contains anything but a-z, 0-9 and hyphen", () => {
    /*
     * THE ALPHABET IS ASSERTED PER SEGMENT, NOT PER SLUG, and it caught
     * something. A printing route is three segments — `head-jab-1/ksu/011` —
     * so the old whole-string pattern could only have been satisfied by
     * loosening it to admit `/`, and a pattern loosened to let a new case pass
     * stops checking the old ones.
     *
     * Splitting first keeps the rule exactly as strict as it was on every
     * segment while letting the path have more than one. That strictness is
     * load-bearing: it is what failed on `dtd/009-mv_back` and `out/042.original`,
     * the 225 addresses where upstream's file-name alphabet had leaked into the
     * URL space. `numberFor` slugifies because this test refused them.
     */
    for (const route of CARD_ROUTES) {
      expect(route.slug).not.toBe("");
      for (const segment of [route.setCode, route.number, route.slug]) {
        expect(segment).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      }
      expect(route.href).toBe(
        `/card/${route.setCode}/${route.number}/${route.slug}`,
      );
    }
  });

  test("a printing route names a face the card actually publishes", () => {
    /*
     * The invariant that makes these addresses rather than guesses: every
     * route points at a face of the card it hangs off, at the index the page
     * will render, and its path is built from that face's own set and number.
     */
    for (const route of CARD_ROUTES) {
      const faces = facesOf(route.page.card);
      expect(faces[route.index]?.key).toBe(route.ref.key);
      expect(route.setCode).toBe(route.ref.setCode);
      expect(route.number).toBe(route.ref.number);
      expect(route.slug).toBe(route.page.slug);
      expect(route.isDefault).toBe(route.index === 0);
    }
  });

  test("the transliteration table handles the letters NFKD cannot fold", () => {
    // `ð` has no decomposition, so without the table "Jarl Vetreiði" would slug
    // to `jarl-vetrei-i` — a real name in this corpus.
    expect(slugify("Jarl Vetreiði")).toBe("jarl-vetreidi");
    expect(slugify("Nature's Path")).toBe("natures-path");
    expect(slugify("Ærlig")).toBe("aerlig");
    expect(slugify("Bloodrush Bellow")).toBe("bloodrush-bellow");
    expect(hrefForPrinting("wtr", "098", "head-jab-1")).toBe(
      "/card/wtr/098/head-jab-1",
    );
  });

  test("a disambiguated card's slug carries its pitch, and 0 means none", () => {
    const jab = NAME_GROUPS.find((page) => page.slug === "head-jab");
    expect(jab?.cards.map((card) => card.slug)).toEqual([
      "head-jab-1",
      "head-jab-2",
      "head-jab-3",
    ]);

    const driver = NAME_GROUPS.find((page) => page.slug === "hyper-driver");
    expect(driver?.cards.map((card) => card.slug)).toContain("hyper-driver-0");
  });
});

/* -------------------------------------------------------------------------- */
/* Link text                                                                   */
/* -------------------------------------------------------------------------- */

describe("links to same-named cards are distinguishable by their text alone", () => {
  test("no disambiguation page has two links with the same accessible name", () => {
    const offenders: string[] = [];
    for (const page of NAME_GROUPS) {
      const labels = page.cards.map((card) => card.label);
      if (new Set(labels).size !== labels.length) {
        offenders.push(`${page.slug}: ${labels.join(" / ")}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test("no variants, references or referenced-by list repeats a label either", () => {
    const offenders: string[] = [];
    for (const page of CARD_PAGES) {
      for (const [what, links] of [
        ["variants", page.variants],
        ["references", page.references],
        ["referencedBy", page.referencedBy],
      ] as const) {
        const labels = links.map((link) => link.label);
        if (new Set(labels).size !== labels.length) {
          offenders.push(`${page.slug} ${what}: ${labels.join(" / ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("a link's label matches the label on the page it points at", () => {
    const labelByHref = new Map(
      CARD_PAGES.map((page) => [page.href, page.label]),
    );
    for (const page of CARD_PAGES) {
      for (const link of [
        ...page.variants,
        ...page.references,
        ...page.referencedBy,
      ]) {
        expect(labelByHref.get(link.href)).toBe(link.label);
      }
    }
  });

  test("the suffix is present exactly when the name alone is ambiguous", () => {
    expect(variantSuffix(2, true)).toBe(" (pitch 2)");
    expect(variantSuffix(0, true)).toBe(" (no pitch)");
    expect(variantSuffix(2, false)).toBe("");
    expect(labelFor("Head Jab", 2, true)).toBe("Head Jab (pitch 2)");
    expect(labelFor("Command and Conquer", 1, false)).toBe(
      "Command and Conquer",
    );

    for (const page of CARD_PAGES) {
      expect(page.label).toBe(
        labelFor(page.card.name, pitchValueOf(page.card), page.disambiguated),
      );
      expect(page.label.startsWith(page.card.name)).toBe(true);
    }
  });

  test("every link resolves to a page this build emits", () => {
    const emitted = new Set(CARD_ROUTES.map((route) => route.href));
    for (const page of CARD_PAGES) {
      for (const link of [
        ...page.variants,
        ...page.references,
        ...page.referencedBy,
        ...page.printings.flatMap(({ otherFace }) =>
          otherFace === null ? [] : [otherFace],
        ),
      ]) {
        expect(emitted.has(link.href)).toBe(true);
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Stats                                                                       */
/* -------------------------------------------------------------------------- */

describe("stats", () => {
  test("a printed 0 is a stat; an absent one is not", () => {
    const zeroPower = CORPUS.cards.filter((card) => card.power === "0");
    expect(zeroPower.length).toBe(13);
    for (const card of zeroPower) {
      const page = CARD_PAGES.find(
        (candidate) => candidate.card.unique_id === card.unique_id,
      );
      expect(
        page?.stats.some(
          (stat) => stat.label === "Power" && stat.value === "0",
        ),
      ).toBe(true);
    }
    // And a card with no power carries no Power row at all.
    const noPower = pageNamed("Command and Conquer");
    expect(noPower.stats.map((stat) => stat.label)).toEqual([
      "Cost",
      "Power",
      "Defence",
    ]);
    expect(noPower.stats.some((stat) => stat.label === "Life")).toBe(false);
  });

  test("upstream's non-numeric values survive verbatim", () => {
    const x = CORPUS.cards.find((card) => card.cost === "XX");
    expect(x).toBeDefined();
    const page = CARD_PAGES.find(
      (candidate) => candidate.card.unique_id === x?.unique_id,
    );
    expect(page?.stats.find((stat) => stat.label === "Cost")?.value).toBe("XX");
  });
});

describe("descriptionFor", () => {
  /*
    THE WHOLE CORPUS, NOT A SAMPLE, and the reason is how this defect got out.
    `descriptionFor` collapsed whitespace and nothing else, under a docblock
    saying that was the only change it made — so `**bold**` reached 7,927 of
    11,378 card pages and `{p}` reached 5,704, on the one surface that renders
    neither. The page body was correct throughout, so nothing a reader looked at
    was wrong and no test that read the body would have caught it. A sample
    would have found this too; asserting over all 4,941 is what keeps a future
    upstream marker from reaching production on the cards the sample skipped.
  */
  test("no description carries upstream's markup", () => {
    const markdown: string[] = [];
    const tokens: string[] = [];

    for (const page of CARD_PAGES) {
      const description = descriptionFor(page);
      if (description.includes("**")) markdown.push(page.card.name);
      if (/\{[a-z]\}/.test(description)) tokens.push(page.card.name);
    }

    expect({
      markdown: markdown.slice(0, 5),
      tokens: tokens.slice(0, 5),
    }).toEqual({
      markdown: [],
      tokens: [],
    });
  });

  /*
    A SYMBOL BECOMES ITS NAME RATHER THAN VANISHING, which is the half a regex
    would have got wrong. Stripping `{}` leaves "6 or more during your action
    phase" — a sentence missing the noun it counts — so the parser hands back
    `GameSymbol.name`, the word the Comprehensive Rules use and the same one the
    page's `aria-label` already announces.
  */
  /*
    ADJACENT SYMBOLS KEEP A BOUNDARY, and this test exists because the first
    version of the fix did not. Upstream writes a two-resource cost as `{r}{r}`,
    so naming each and joining on "" produced `resourceresource` on 239 cards —
    which the markup assertion above passes cleanly, since it contains neither
    `**` nor `{x}`. A test that only asks whether the old markers are gone
    cannot see a new defect the replacement introduced.
  */
  test("two symbols in a row do not run together", () => {
    const runOn = CARD_PAGES.filter((page) =>
      /resourceresource|powerpower|defencedefence|lifelife/i.test(
        descriptionFor(page),
      ),
    ).map((page) => page.card.name);

    expect(runOn.slice(0, 5)).toEqual([]);

    /* The control: cards that DO print two symbols in a row still exist, so the
       assertion above is about the flatten rather than about absent input. */
    const doubled = CARD_PAGES.filter((page) =>
      /\{[a-z]\}\{[a-z]\}/.test(page.card.functional_text),
    );
    expect(doubled.length).toBeGreaterThan(0);
  });

  test("a symbol reads as the word the rules use", () => {
    const rhinar = CARD_PAGES.find((page) => page.card.name === "Rhinar");
    expect(rhinar).toBeDefined();
    if (rhinar === undefined) return;

    const description = descriptionFor(rhinar);
    expect(description).toContain("6 or more power");
    expect(description).not.toContain("{p}");
    expect(description).not.toContain("**");
  });
});

describe("a name folds the same way for a URL and for the index", () => {
  /*
    THE INVARIANT THIS FIX IS REALLY ABOUT. `slugify` builds the address and
    `tokeniseCard` builds what a reader's typing is matched against, and for the
    life of the site they folded differently: the first decomposed with NFKD and
    transliterated, the second was `toLowerCase().match(/[a-z0-9]+/g)`, which
    treats an accented letter as a SEPARATOR. So `Jarl Vetreiði` had the working
    URL `/card/ajv/001-rf/jarl-vetreidi` and could not be found by typing "jarl
    vetreidi" into the search box — reachable by address and not by name.

    Asserting over the whole corpus rather than over the five known cards,
    because the five are a symptom: what has to hold is that the two callers of
    `foldLatin` cannot disagree again, on any name, including ones upstream has
    not published yet.
  */
  test("every token of a name appears in that name's slug", () => {
    const disagreeing = CARD_PAGES.filter((page) => {
      const fromSlug = slugify(page.card.name)
        .split("-")
        .filter((part) => part.length > 0);
      return tokeniseCard(page.card.name).some(
        (token) => !fromSlug.includes(token),
      );
    }).map((page) => page.card.name);

    expect(disagreeing.slice(0, 5)).toEqual([]);
  });

  /*
    THE CONTROL. The assertion above is only meaningful while the corpus still
    contains names that NEED folding — otherwise it would pass on a corpus of
    plain ASCII and say nothing about the rule.
  */
  test("the corpus still carries names that need folding", () => {
    const accented = CARD_PAGES.filter((page) =>
      /[^\x20-\x7e]/.test(page.card.name),
    ).map((page) => page.card.name);

    expect(accented.length).toBeGreaterThan(0);

    /* And each of them tokenises to something an ASCII keyboard can type. */
    for (const name of accented) {
      expect(tokeniseCard(name).join(" ")).toMatch(/^[a-z0-9 ]*$/);
    }
  });
});
