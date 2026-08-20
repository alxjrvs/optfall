/**
 * The card query engine, pinned.
 *
 * Two properties are being defended here, and they are the two `docs/PLAN.md`
 * trades on.
 *
 * **The engine never answers a question it did not understand.** A silently
 * dropped operator is worse than an error: `legal:cc@2026-03-14` ignored would
 * return today's legal cards and *look* like it answered a question about
 * March. Every assertion about a notice below is really an assertion that the
 * engine said so out loud.
 *
 * **The filters read the column they claim to read.** `legal:cc` resolves a
 * format alias to a *positional* index into a bitmask vector, which is the kind
 * of thing that keeps working and starts being wrong. So the counts are pinned
 * against the same anchors `cards.test.ts` pins the derivation on: 51 banned in
 * Classic Constructed, 20 restricted in Living Legend, 2 banned in Ultimate Pit
 * Fight, and — the one that matters — zero cards legal in Ultimate Pit Fight,
 * because that format publishes no legal flag and Optfall does not have an
 * opinion it cannot source.
 */

import { describe, expect, test } from "bun:test";

import {
  CARD_PAGES,
  CARD_ROUTES,
  CORPUS,
  FORMATS,
  LAST_CONFIRMED,
  STAT_ORDER,
  hrefForPrinting,
  numberFor,
} from "./cards";
import {
  buildCardIndex,
  decodeCardIndex,
  parseCardQuery,
  parseDisplayParam,
  searchCards,
  STAT_LABELS,
  tokeniseCard,
  FORMAT_NAMES,
  type CardIndex,
} from "./card-search";
import { SETS } from "./sets";

const encoded = buildCardIndex(CARD_PAGES, {
  commit: CORPUS.source.commit,
  confirmed: LAST_CONFIRMED,
  releasedBySet: new Map(SETS.sets.map((set) => [set.id, set.released])),
});
const index: CardIndex = decodeCardIndex(encoded);

/**
 * A card's address, derived exactly as the search module derives it.
 *
 * THREE TESTS BUILT THIS BY HAND AS `/card/${slug}` AND ALL THREE WENT QUIET
 * when the scheme moved: they select rows by `href`, no href has that shape any
 * more, the selection returns nothing, and an assertion loop over nothing
 * passes. That is worse than a failure — the bug each of them was written to
 * catch could come back with the suite green. One helper, so there is one place
 * for this to be wrong and it is a place that fails loudly.
 */
function addressOf(ordinal: number): string {
  const key = index.faceKeys[ordinal] ?? "";
  const setCode = index.faceSets[ordinal] ?? "";
  return hrefForPrinting(
    setCode,
    numberFor(key, setCode),
    index.slugs[ordinal] ?? "",
  );
}

/**
 * A card's address UNDER A SET-SCOPED QUERY, which is not {@link addressOf}.
 *
 * A row now opens the printing it is showing, so a test that selects rows by
 * `href` under `set:X` and builds that href from the DEFAULT face selects
 * nothing on exactly the cards the feature is about — the reprints, where the
 * default printing is in another set. That is the silent-selection failure the
 * note above `addressOf` describes, one filter down.
 *
 * `focusPrinting`'s three cases, read from the same index it reads: the default
 * printing where it is already in the set, that set's art where the card has
 * one, and the default printing again where the set published no distinct art.
 *
 * Takes a decoded index rather than closing over the module's, because one
 * caller runs against a CONSTRUCTED one — see the divergent-orientation test.
 */
function addressInSetOf(
  from: CardIndex,
  ordinal: number,
  setCode: string,
): string {
  const slug = from.slugs[ordinal] ?? "";
  if (from.faceSets[ordinal] === setCode) {
    const key = from.faceKeys[ordinal] ?? "";
    return hrefForPrinting(setCode, numberFor(key, setCode), slug);
  }
  const art = (from.arts[ordinal] ?? []).find((ref) => ref.setCode === setCode);
  if (art === undefined) {
    const key = from.faceKeys[ordinal] ?? "";
    const own = from.faceSets[ordinal] ?? "";
    return hrefForPrinting(own, numberFor(key, own), slug);
  }
  return hrefForPrinting(art.setCode, art.number, slug);
}

const total = (query: string) => searchCards(index, query).total;
const labels = (query: string) =>
  searchCards(index, query).results.map((row) => row.label);
const notices = (query: string) =>
  searchCards(index, query).notices.map((n) => n.kind);

/* -------------------------------------------------------------------------- */
/* The index                                                                   */
/* -------------------------------------------------------------------------- */

describe("the index", () => {
  test("restates the format list, and the build asserts the restatement", () => {
    expect([...FORMAT_NAMES]).toEqual(FORMATS.map((format) => format.name));
  });

  test("round-trips every card without losing one", () => {
    expect(index.size).toBe(CARD_PAGES.length);
    expect(index.size).toBe(4941);
    expect(index.labels[0]).toBe(CARD_PAGES[0]?.label);
    expect(index.slugs[0]).toBe(CARD_PAGES[0]?.slug);
    expect(
      index.verdicts.every((vector) => vector.length === FORMATS.length),
    ).toBe(true);
  });

  test("carries no card text, only an inverted index over it", () => {
    // The corpus is 18 MB; what ships is the index. A regression that started
    // shipping the text would be invisible except as a page-weight change, so
    // it is asserted rather than trusted.
    const serialised = JSON.stringify(encoded);
    const longest = CARD_PAGES.map(
      (page) => page.card.functional_text,
    ).toSorted((a, b) => b.length - a.length)[0];
    expect(longest).toBeDefined();
    expect(serialised.includes(longest ?? "")).toBe(false);
    expect(serialised.includes("image_url")).toBe(false);
    expect(serialised.includes("flavor_text")).toBe(false);
  });

  test("is a pure function of its input", () => {
    const again = buildCardIndex(CARD_PAGES, {
      commit: CORPUS.source.commit,
      confirmed: LAST_CONFIRMED,
      releasedBySet: new Map(SETS.sets.map((set) => [set.id, set.released])),
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(encoded));
  });

  test("every card's derived address is a URL this build emits", () => {
    /*
     * THE CLIENT DERIVES A CARD URL RATHER THAN BEING HANDED ONE, and this is
     * what says the derivation agrees with the router. `defaultHrefOf` builds
     * `/card/<set>/<number>/<slug>` from `faceKeys` + `faceSets` + `slugs` —
     * three columns shipped for other reasons — so a change to any of them, or
     * to `numberFor`, silently points every result row at a 404. There is no
     * `/card/<slug>` fallback page left to absorb that any more.
     */
    const emitted = new Set(CARD_ROUTES.map((route) => route.href));
    for (let ordinal = 0; ordinal < index.slugs.length; ordinal += 1) {
      const key = index.faceKeys[ordinal];
      const setCode = index.faceSets[ordinal] ?? "";
      expect(key).not.toBeNull();
      expect(setCode).not.toBe("");
      const href = hrefForPrinting(
        setCode,
        numberFor(key ?? "", setCode),
        index.slugs[ordinal] ?? "",
      );
      expect(emitted.has(href)).toBe(true);
    }
  });

  test("every result row links to a URL this build emits", () => {
    /*
     * THE DERIVATION AND THE ROWS ARE DIFFERENT FACTS. The check above proves
     * a card's own address resolves; this one walks what `search` actually
     * puts in an anchor, which includes the `unique:art` printing rows and the
     * collapsed `unique:names` rows that pick a sibling version. Those are the
     * two paths that do NOT go through the common case.
     */
    const emitted = new Set(CARD_ROUTES.map((route) => route.href));
    for (const query of [
      "banned:cc",
      "head jab",
      "hyper driver",
      "set:mst unique:art",
      "set:wtr unique:cards",
    ]) {
      const outcome = searchCards(index, query, 60);
      expect(outcome.results.length).toBeGreaterThan(0);
      for (const result of outcome.results) {
        expect(emitted.has(result.href)).toBe(true);
        for (const version of result.matchedVersions) {
          expect(emitted.has(version.href)).toBe(true);
        }
      }
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Legality filters                                                            */
/* -------------------------------------------------------------------------- */

describe("legality filters read the format they name", () => {
  /*
   * THESE COUNTS ARE CARDS, NOT CORPUS ROWS, AND THE DIFFERENCE IS THE POINT.
   *
   * A player calls the red, yellow and blue versions of a card one card, so a
   * result row stands for a card and `total` counts rows a reader can click.
   * The corpus carries 51 Classic-Constructed-banned *entries*; those are 35
   * distinct cards, because 16 of them are pitch versions sharing a name.
   *
   * Both numbers are true and they answer different questions. The one a
   * search reports has to be the one that matches what it displays, or the
   * count is describing a page nobody is looking at.
   *
   * The per-version truth is not lost — see the `matchedVersions` tests below,
   * which cover the four cards whose ban DIFFERS between versions.
   */
  test("banned:cc is the 35 cards behind the corpus's 51 banned entries", () => {
    expect(total("banned:cc")).toBe(35);
    expect(total("banned:classic-constructed")).toBe(35);
    expect(total("banned:blitz")).toBe(29);
    expect(total("banned:ll")).toBe(5);
    expect(total("banned:commoner")).toBe(8);
    expect(total("banned:silver-age")).toBe(41);
    expect(total("banned:upf")).toBe(2);
  });

  test("legal:cc is the pool minus every excluded card", () => {
    expect(total("legal:cc")).toBe(2943);
    expect(total("legal:blitz")).toBe(2984);
    expect(total("legal:commoner")).toBe(1396);
  });

  test("nothing is legal in Ultimate Pit Fight, because nothing says so", () => {
    expect(total("legal:upf")).toBe(0);
    expect(total("banned:upf")).toBe(2);
  });

  test("restricted and suspended read their own columns", () => {
    expect(total("restricted:ll")).toBe(10);
    // Upstream publishes the suspension flags and no card carries one today, so
    // this is a real zero rather than a missing filter.
    expect(total("suspended:cc")).toBe(0);
    expect(total("suspended:blitz")).toBe(0);
  });

  test("banned and legal never return the same card", () => {
    const banned = new Set(labels("banned:cc"));
    for (const label of labels("legal:cc"))
      expect(banned.has(label)).toBe(false);
  });

  test("an unknown format is named, not silently ignored", () => {
    expect(notices("legal:standard")).toEqual(["operand-unknown"]);
    expect(total("legal:standard")).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* What the engine refuses to guess at                                         */
/* -------------------------------------------------------------------------- */

describe("the engine never answers a question it did not understand", () => {
  test("legality as of a date is refused, loudly, and returns nothing", () => {
    const outcome = searchCards(index, "legal:cc@2026-03-14");
    expect(outcome.total).toBe(0);
    expect(outcome.notices).toHaveLength(1);
    expect(outcome.notices[0]?.kind).toBe("operator-pending");
    expect(outcome.notices[0]?.text).toContain("not built yet");
  });

  test("comparisons answer a stated partial order rather than refusing", () => {
    // THIS TEST USED TO ASSERT THE OPPOSITE, and the reversal is the point of
    // the phase. The old engine refused `cost>=3` outright, on the correct
    // observation that 4,941 printed costs include `X`, `XX`, `X1` and blanks,
    // so there is no total order over them.
    //
    // That is true and it over-reached. A comparison is now answered as "this
    // value is numeric AND satisfies the comparison", which is a real answer to
    // a real question, and the notice states the limit rather than leaving it
    // to be discovered.
    const outcome = searchCards(index, "cost>=3", 5000);
    expect(outcome.total).toBeGreaterThan(0);

    // Narrowing narrows, which is the property a comparison has to have.
    expect(total("cost>=3")).toBeGreaterThan(total("cost>=6"));
    expect(total("cost>3")).toBeLessThan(total("cost>=3"));

    // And the non-numeric printings are excluded rather than sorted somewhere.
    // `cost:X` is a real query returning real cards, and none of them can
    // satisfy a comparison.
    const anyX = searchCards(index, "cost:X", 5000).results.map(
      (row) => row.href,
    );
    const compared = searchCards(index, "cost>=0", 5000).results.map(
      (row) => row.href,
    );
    for (const href of anyX) expect(compared).not.toContain(href);

    // The limit is SAID, not left to be found by getting a surprising count.
    expect(outcome.notices.some((notice) => notice.text.includes("X"))).toBe(
      true,
    );
  });

  test("a comparison on a field with no order is refused, and says so", () => {
    // Cost, power and defence are the only printed values with any order at
    // all. `type>=3` is a reader misunderstanding the grammar, and answering it
    // with something would be worse than saying no.
    const outcome = searchCards(index, "type>=3");
    expect(outcome.filters).toHaveLength(0);
    expect(
      outcome.notices.some((notice) => notice.kind === "operator-unknown"),
    ).toBe(true);
  });

  test("operators belonging to unbuilt phases say which phase", () => {
    expect(notices("is:verified")).toEqual(["operator-pending"]);
    expect(notices("changed:2.11.0")).toEqual(["operator-pending"]);
    expect(notices("cr:8.3.4b")).toEqual(["operator-pending"]);
  });

  test("an unknown operator lists the ones that exist", () => {
    const outcome = searchCards(index, "colour:red");
    expect(outcome.notices[0]?.kind).toBe("operator-unknown");
    expect(outcome.notices[0]?.text).toContain("name");
    expect(outcome.notices[0]?.text).toContain("legal");
  });

  test("a quoted phrase says adjacency is not checked", () => {
    expect(notices('"command and conquer"')).toContain("phrase-approximate");
  });

  test("an operator typed with no operand is reported rather than dropped", () => {
    expect(notices("pitch:")).toEqual(["operand-unknown"]);
  });
});

/* -------------------------------------------------------------------------- */
/* Field operators                                                             */
/* -------------------------------------------------------------------------- */

describe("field operators", () => {
  test("a multi-word quoted operand stays attached to its operator", () => {
    // The naïve chunker splits `type:"Illusionist Action` from `- Aura"`, which
    // turns a precise filter into junk free terms and returns nothing. 674
    // printed type lines contain a space, so this is the common case.
    const parsed = parseCardQuery('type:"Illusionist Action - Aura"');
    expect(parsed.terms).toEqual([]);
    expect(parsed.filters.map((filter) => filter.value)).toEqual([
      "illusionist",
      "action",
      "aura",
    ]);
    expect(total('type:"Illusionist Action - Aura"')).toBe(19);
  });

  test("class: is type:, because upstream publishes one list", () => {
    expect(total("class:guardian")).toBe(total("type:guardian"));
    expect(total("class:guardian")).toBeGreaterThan(0);
  });

  test("text: searches printed text and not the name", () => {
    const named = searchCards(index, 'name:"command and conquer"');
    expect(named.total).toBe(1);
    expect(named.results[0]?.label).toBe("Command and Conquer");
    // The card's own name appears in no card's printed text but its own, so a
    // text search for it must not return the card merely for being called that.
    expect(total("text:conquer")).toBeLessThan(total("name:conquer") + 40);
  });

  test("set, rarity, pitch, cost, power and defence match printed values", () => {
    expect(total("set:MST")).toBe(total("set:mst"));
    expect(total("set:MST")).toBeGreaterThan(0);
    expect(total("pitch:none")).toBe(
      CARD_PAGES.filter((page) => page.pitch === 0).length,
    );
    expect(total("pitch:3")).toBe(
      CARD_PAGES.filter((page) => page.pitch === 3).length,
    );
    expect(total("cost:X")).toBe(
      CARD_PAGES.filter((page) => page.card.cost === "X").length,
    );
    // `cost:x` must not also match `X1` and `XX`; an opaque value is matched
    // whole rather than tokenised.
    expect(total("cost:X")).toBeLessThan(
      CARD_PAGES.filter((page) => page.card.cost.startsWith("X")).length,
    );
  });

  test("filters combine as AND", () => {
    const both = total("legal:cc pitch:1");
    expect(both).toBeLessThan(total("legal:cc"));
    expect(both).toBeLessThan(total("pitch:1"));
    expect(total('name:"head jab" pitch:2')).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

describe("ranking", () => {
  test("the whole name you typed is the first result", () => {
    const outcome = searchCards(index, "command and conquer");
    expect(outcome.results[0]?.label).toBe("Command and Conquer");
    expect(outcome.results[0]?.matchedIn).toBe("name-exact");
  });

  test("the pitch versions of a card are ONE result, not three", () => {
    // A player calls the red, yellow and blue Head Jab one card. This used to
    // return three rows differing only by a jewel, all of which are now one
    // row pointing at the card page, where the versions are tabs.
    const outcome = searchCards(index, "head jab");
    const headJab = outcome.results.filter((row) => row.label === "Head Jab");

    expect(headJab).toHaveLength(1);
    /*
     * THE LOWEST-PITCH VERSION'S OWN PRINTING, NOT `/card/head-jab`. That URL
     * used to be the collapsed row's destination and is a 301 now, so the row
     * carries the address the redirect would have sent it to. See
     * `nameDefaultHref` — the version is picked by `byPitch`'s rule, which is
     * the same one the tab strip on the destination is ordered by.
     */
    expect(headJab[0]?.href).toBe("/card/ben/010/head-jab-1");
    // The bare name, because the row stands for the card rather than for one
    // version of it — and the destination shows all three.
    expect(headJab[0]?.label).not.toContain("pitch");
    expect(headJab[0]?.totalVersions).toBe(3);
    expect(headJab[0]?.matchedVersions.map((version) => version.pitch)).toEqual(
      [1, 2, 3],
    );
  });

  test("a collapsed row carries an address for every version it drew", () => {
    /*
     * THE MARK IS A CONTROL, AND A CONTROL NEEDS SOMEWHERE TO GO. A row
     * standing for three cards renders three coloured bands; each of them is a
     * link to the version it is drawn for, so the engine has to say where each
     * one lives rather than handing the surface three pitch values and one
     * destination. See `CardIndexEntry.versions`.
     */
    const headJab = searchCards(index, "head jab").results.find(
      (row) => row.label === "Head Jab",
    );

    expect(
      headJab?.matchedVersions.map(({ pitch, href, label }) => ({
        pitch,
        href,
        label,
      })),
    ).toEqual([
      {
        pitch: 1,
        href: "/card/ben/010/head-jab-1",
        label: "Head Jab (pitch 1)",
      },
      {
        pitch: 2,
        href: "/card/ben/017/head-jab-2",
        label: "Head Jab (pitch 2)",
      },
      {
        pitch: 3,
        href: "/card/ben/024/head-jab-3",
        label: "Head Jab (pitch 3)",
      },
    ]);

    /*
     * AND EACH VERSION CARRIES ITS OWN PICTURE, WHICH IS WHAT MAKES A FAN OF
     * THEM WORTH DRAWING. `CardIndex` stacks the versions of a name behind the
     * row's face and spreads them on hover; three copies of one image in three
     * colours would be a decoration rather than a choice between cards.
     *
     * ASSERTED AS DISTINCT RATHER THAN BY KEY, because the keys are upstream
     * basenames and pinning them here would fail on the next corpus sync for a
     * reason that has nothing to do with this claim. What has to hold is that
     * three versions produce three faces.
     */
    const faces = (headJab?.matchedVersions ?? []).map((v) => v.faceKey);
    expect(faces.every((key) => key !== null)).toBe(true);
    expect(new Set(faces).size).toBe(3);
    /* The row's own link is the LOWEST-PITCH version — which is the page
       `/card/head-jab` used to render and now 301s to. The versions beside it
       are how a reader who means one of the others says so. */
    expect(headJab?.href).toBe("/card/ben/010/head-jab-1");
  });

  test("only the matched versions get a door, on every row", () => {
    /*
     * THE FILTER HAS TO REACH THE MARK. `pitch:1` draws one band under Head
     * Jab because only one version matched; if the bands were built from the
     * card rather than from the match, the row would offer a reader two
     * versions the query is false of — and on `banned:cc` that is the legal
     * version of a card the page has just put on a banned list.
     */
    for (const row of searchCards(index, "pitch:1", 200).results) {
      expect(row.matchedVersions.map((version) => version.pitch)).toEqual([1]);
    }

    const banned = searchCards(index, "banned:cc", 5000).results.find(
      (row) => row.label === "Electromagnetic Somersault",
    );
    expect(banned?.matchedVersions.map((version) => version.href)).toEqual([
      "/card/ast/019/electromagnetic-somersault-1",
      "/card/ros/086/electromagnetic-somersault-2",
    ]);
  });

  test("a partial version match links to a version that ACTUALLY matched", () => {
    // THE BUG THIS EXISTS TO PREVENT WAS SHIPPED. `/card/<nameSlug>` renders
    // the LOWEST-PITCH version, so a row matching only pitches 2 and 3 sent the
    // reader to pitch 1. Measured on the shipped build, `banned:cc` produced
    // four such rows, and on two of them — Bonds of Ancestry and Orb-Weaver
    // Spinneret — a result clicked from a BANNED list opened a page reading
    // "Legal", with nothing on either surface saying the version had changed.
    const rows = searchCards(index, "banned:cc", 5000).results.filter(
      (row) => row.matchedVersions.length < row.totalVersions,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // A partial row must NOT point at the bare name, because the bare name
      // resolves to a version this row may not be talking about.
      const slug = row.href.replace("/card/", "");
      expect(slug).toMatch(/-\d$/);
      // And the version it points at is one of the ones that matched. Compared
      // as strings so the assertion does not need a cast to `PitchValue` — the
      // slug suffix is a character, and widening it back is noise.
      expect(
        row.matchedVersions.map((version) => String(version.pitch)),
      ).toContain(slug.slice(-1));
    }
  });

  test("a partial version match says WHICH versions, because legality differs", () => {
    // Electromagnetic Somersault is banned in Classic Constructed at pitch 1
    // and 2, and legal at pitch 3. A row that named the card and stopped would
    // put a card on a banned list without saying which version was banned —
    // the exact "collapses two true facts into one" failure the verdict model
    // exists to prevent.
    const banned = searchCards(index, "banned:cc", 5000).results.find(
      (row) => row.label === "Electromagnetic Somersault",
    );

    expect(banned).toBeDefined();
    expect(banned?.totalVersions).toBe(3);
    expect(banned?.matchedVersions.map((version) => version.pitch)).toEqual([
      1, 2,
    ]);
    // Fewer matched than exist, which is what makes the row render the
    // qualifier rather than staying silent.
    expect(
      (banned?.matchedVersions.length ?? 0) < (banned?.totalVersions ?? 0),
    ).toBe(true);
  });

  test("matching is AND — an extra word narrows", () => {
    expect(total("lightning")).toBeGreaterThan(total("lightning flow"));
  });

  test("results are identical on repeated runs, in the same order", () => {
    const a = searchCards(index, "dominate attack");
    const b = searchCards(index, "dominate attack");
    expect(a.results.map((row) => row.href)).toEqual(
      b.results.map((row) => row.href),
    );
  });

  test("a second decode of the same bytes ranks identically", () => {
    const other = decodeCardIndex(encoded);
    expect(
      searchCards(other, "guardian pitch:1").results.map((row) => row.href),
    ).toEqual(
      searchCards(index, "guardian pitch:1").results.map((row) => row.href),
    );
  });

  test("every row says which field put it there", () => {
    for (const row of searchCards(index, "dominate").results) {
      expect([
        "name-exact",
        "name-prefix",
        "name",
        "type",
        "keyword",
        "text",
      ]).toContain(row.matchedIn);
    }
  });

  test("the reported total is the true total, not the page size", () => {
    const outcome = searchCards(index, "legal:cc", 10);
    expect(outcome.results).toHaveLength(10);
    expect(outcome.total).toBe(2943);
  });

  test("an empty query returns nothing rather than everything", () => {
    expect(total("")).toBe(0);
    expect(total("   ")).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Tokenising                                                                  */
/* -------------------------------------------------------------------------- */

describe("the tokeniser", () => {
  test("keeps single digits and drops single letters", () => {
    expect(tokeniseCard("Arcane Barrier 2")).toEqual([
      "arcane",
      "barrier",
      "2",
    ]);
    expect(tokeniseCard("a b card")).toEqual(["card"]);
  });

  test("keeps rules vocabulary that ordinary stopword lists throw away", () => {
    // "may" is the difference between an option and an obligation, "if" is a
    // condition and "target" is a rules term — all three are ordinary English
    // stopwords and all three stay. "you" is dropped on a measured threshold
    // (51.2% of cards) rather than because it looks like a stopword.
    expect(tokeniseCard("you may target")).toEqual(["may", "target"]);
    expect(tokeniseCard("if your hero may")).toEqual([
      "if",
      "your",
      "hero",
      "may",
    ]);
  });

  test("the stopword list is only words in a majority of cards", () => {
    const df = new Map<string, number>();
    for (const page of CARD_PAGES) {
      for (const term of new Set(tokeniseCard(page.card.functional_text))) {
        df.set(term, (df.get(term) ?? 0) + 1);
      }
    }
    // Nothing that survives tokenising is in more than half the corpus — which
    // is the property the list exists to produce, stated as a test rather than
    // as an intention.
    const majority = [...df.entries()].filter(
      ([, count]) => count > CARD_PAGES.length / 2,
    );
    expect(majority).toEqual([]);
  });
});

/* -------------------------------------------------------------------------- */
/* The empty state                                                             */
/* -------------------------------------------------------------------------- */

describe("the browse", () => {
  test("counts CARDS rather than corpus rows, matching what the link opens", () => {
    // The browse count and the result count have to be the same quantity. A
    // link promising 33 that renders 19 rows is lying about its own
    // destination — so both are counted over distinct bare-name slugs.
    expect(index.browse.length).toBe(24);
    for (const [line, count] of index.browse) {
      const cards = new Set(
        CARD_PAGES.filter((page) => page.card.type_text.trim() === line).map(
          (page) => page.nameSlug,
        ),
      );
      expect(count).toBe(cards.size);
    }
  });

  test("a browse count never overstates what its own query returns", () => {
    // AT LEAST, NOT EXACTLY — and the gap is a property of the grammar rather
    // than a rounding error. The browse counts cards whose printed type line is
    // EXACTLY this string; `type:` tokenises its operand and matches any card
    // whose line contains all of those words, so "Illusionist Action - Aura"
    // also finds "Illusionist Action - Aura - Attack". The query is therefore a
    // superset, which is the safe direction: a link can show more than it
    // promised, and must never show less.
    for (const [line, count] of index.browse.slice(0, 5)) {
      expect(total(`type:"${line}"`)).toBeGreaterThanOrEqual(count);
    }
  });

  test("every browse entry is a query that returns at least that many cards", () => {
    for (const [line, count] of index.browse.slice(0, 5)) {
      expect(total(`type:"${line}"`)).toBeGreaterThanOrEqual(count);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The expression grammar                                                      */
/* -------------------------------------------------------------------------- */

describe("negation, OR and grouping", () => {
  test("negation narrows, and composes with a field operator", () => {
    // BOTH HALVES CAUGHT A BUG. `-type:attack` reaches the bare-word branch of
    // the tokeniser, because the field alternative requires a leading letter —
    // and emitting the remainder as a TERM made the engine negate the literal
    // text "type:attack", so this query returned exactly as many cards as the
    // unnegated one. The remainder is re-tokenised now.
    const all = total("type:guardian");
    const without = total("type:guardian -type:attack");

    expect(all).toBeGreaterThan(0);
    expect(without).toBeGreaterThan(0);
    expect(without).toBeLessThan(all);
  });

  test("negation of a bare word still works", () => {
    expect(total("attack -dominate")).toBeLessThan(total("attack"));
  });

  test("OR widens, and never beyond the sum of its sides", () => {
    const cc = total("banned:cc");
    const blitz = total("banned:blitz");
    const either = total("banned:cc or banned:blitz");

    expect(either).toBeGreaterThanOrEqual(Math.max(cc, blitz));
    expect(either).toBeLessThanOrEqual(cc + blitz);
    // The sides genuinely overlap, so this is not accidentally a union of
    // disjoint sets — which would make the test pass without proving anything.
    expect(either).toBeLessThan(cc + blitz);
  });

  test("parentheses group, and change the answer", () => {
    const grouped = total("type:action (banned:cc or banned:blitz)");
    expect(grouped).toBeGreaterThan(0);
    // Grouped is a subset of the OR, because the AND restricts it further.
    expect(grouped).toBeLessThan(total("banned:cc or banned:blitz"));
  });

  test("adjacency binds tighter than OR", () => {
    // `a b or c` is `(a AND b) OR c`, which is what every search engine people
    // already use does. If OR bound tighter this would be `a AND (b OR c)` and
    // the count would be larger.
    const tight = total("type:guardian type:attack or banned:cc");
    const loose = total("type:guardian (type:attack or banned:cc)");
    expect(tight).not.toBe(loose);
  });

  test("an exact name matches the BARE name, suffix and all", () => {
    // `index.folded` folds "Head Jab (pitch 1)", so comparing against it made
    // `!"Head Jab"` match nothing on the 900 names carrying a variant suffix —
    // which is most of the names anybody would reach for this operator to pin.
    const outcome = searchCards(index, '!"Head Jab"', 50);
    expect(outcome.total).toBeGreaterThan(0);
    for (const row of outcome.results) expect(row.label).toBe("Head Jab");
  });

  test("an unclosed group is answered rather than refused", () => {
    // Somebody mid-keystroke has an unbalanced paren. Emptying the results
    // under their cursor is a worse answer than closing it for them.
    expect(total("type:action (banned:cc")).toBe(
      total("type:action banned:cc"),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Ordering                                                                    */
/* -------------------------------------------------------------------------- */

/** The printed value of one stat, per result, in the order returned. */
const statColumn = (query: string, label: string) =>
  searchCards(index, query).results.map(
    (row) => (row.stats ?? []).find(([name]) => name === label)?.[1] ?? null,
  );

describe("ordering results", () => {
  test("defaults to relevance, which is not a printed value", () => {
    // `key: null` is deliberately distinct from `key: "name"`. Relevance is a
    // property of the QUERY — an exact name match outranking a text match —
    // and collapsing the default into a field sort would throw that away on
    // every search nobody ordered.
    expect(parseCardQuery("dominate").sort).toEqual({
      key: null,
      direction: "asc",
    });
  });

  test("sorts by a printed value, in both directions", () => {
    const ascending = statColumn("type:guardian order:cost", "Cost")
      .filter((value): value is string => value !== null)
      .map(Number);
    const descending = statColumn("type:guardian order:cost dir:desc", "Cost")
      .filter((value): value is string => value !== null)
      .map(Number);

    expect(ascending).toEqual(ascending.toSorted((a, b) => a - b));
    expect(descending).toEqual(descending.toSorted((a, b) => b - a));
    // And the two ends are genuinely different cards, so this is not asserting
    // a sort over one repeated value.
    expect(ascending[0]!).toBeLessThan(descending[0]!);
  });

  test("sorts by name, which is the one key with an alphabet", () => {
    const names = labels("type:guardian order:name");
    expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, "en")));

    const reversed = labels("type:guardian order:name dir:desc");
    expect(reversed).toEqual(
      reversed.toSorted((a, b) => b.localeCompare(a, "en")),
    );
  });

  test("a card with no value sorts last in BOTH directions", () => {
    /*
     * THE ASSERTION THIS SECTION EXISTS FOR. Printed costs include `X`, `XX`
     * and blanks; a card with no defence has no defence rather than zero of
     * it. Sorting those to the front under `desc` claims they are the largest
     * and under `asc` that they are the smallest — they are neither. It is the
     * same refusal `cost>=3` already makes by not matching them.
     */
    for (const direction of ["asc", "desc"] as const) {
      const column = statColumn(
        `type:equipment order:cost dir:${direction}`,
        "Cost",
      );
      const missing = column.map((value) => value === null);
      const firstMissing = missing.indexOf(true);
      if (firstMissing !== -1) {
        // Once the first absent value appears, everything after it is absent.
        expect(missing.slice(firstMissing).every(Boolean)).toBe(true);
      }
    }
  });

  test("an unknown key or direction is refused out loud, not ignored", () => {
    // The whole point of the engine's notices: a dropped `order:` would return
    // a relevance-sorted list that LOOKS like it honoured the request.
    expect(parseCardQuery("dominate order:vibes").sort.key).toBeNull();
    expect(notices("dominate order:vibes")).toContain("operand-unknown");

    expect(parseCardQuery("dominate dir:sideways").sort.direction).toBe("asc");
    expect(notices("dominate dir:sideways")).toContain("operand-unknown");

    // A comparison is meaningless on an ordering.
    expect(notices("dominate order>cost")).toContain("operator-unknown");
  });

  test("an ordering with nothing to order says so", () => {
    // `order:cost` alone matches nothing, which on the page is
    // indistinguishable from a search that found nothing.
    const outcome = searchCards(index, "order:cost");
    expect(outcome.results).toHaveLength(0);
    expect(outcome.notices.map((n) => n.text).join(" ")).toContain(
      "not which ones to find",
    );
  });

  test("the ordering is reported back, so the interface can say which it used", () => {
    expect(searchCards(index, "dominate order:pitch dir:desc").sort).toEqual({
      key: "pitch",
      direction: "desc",
    });
  });

  test("an ordering is a query-level option, not a term", () => {
    // Stripped from the token stream before the tree is built, so it can never
    // become a text search for the literal string — and the result set is
    // exactly the one the query without it returns.
    expect(total("type:guardian order:cost")).toBe(total("type:guardian"));
    expect(parseCardQuery("type:guardian order:cost").terms).toEqual(
      parseCardQuery("type:guardian").terms,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Artist and flavour                                                          */
/* -------------------------------------------------------------------------- */

describe("artist and flavour search", () => {
  test("finds a card by any artist credited on any of its printings", () => {
    const surname = total("a:fikri");
    expect(surname).toBeGreaterThan(0);

    // A full name asks for both words rather than for the literal string —
    // which is what `WORD_VALUED` buys, and what a reader typing a name expects.
    expect(total('artist:"faizal fikri"')).toBe(surname);
    expect(total("artist:fikri")).toBe(surname);
  });

  test("flavour text and rules text are different indexes, not one", () => {
    /*
     * THE ASSERTION THIS PAIR EXISTS FOR. `text:blood` is a claim about what a
     * card DOES; a card whose flavour quotes a poem about blood does not do
     * anything of the sort. Folding the two together would make every `text:`
     * search quietly wrong on the 864 cards that carry flavour.
     */
    const rules = total("text:blood");
    const flavour = total("ft:blood");

    expect(rules).toBeGreaterThan(0);
    expect(flavour).toBeGreaterThan(0);
    expect(flavour).not.toBe(rules);

    // And a bare word does not reach flavour at all: free terms search what a
    // card does, so `ft:` is opt-in.
    expect(total("blood")).toBe(
      total("blood -ft:blood") + total("blood ft:blood"),
    );
  });

  test("both spellings of each operator resolve to the same field", () => {
    expect(total("ft:blood")).toBe(total("flavour:blood"));
    expect(total("ft:blood")).toBe(total("flavor:blood"));
    expect(total("a:fikri")).toBe(total("artist:fikri"));
  });

  test("they compose with the rest of the grammar", () => {
    // Printing-level fields joining card-level ones is the whole reason these
    // are worth having: "which guardians did this artist draw" is a question
    // neither half can answer alone.
    const combined = total("a:fikri type:guardian");
    expect(combined).toBeGreaterThan(0);
    expect(combined).toBeLessThan(total("a:fikri"));
    expect(combined).toBeLessThan(total("type:guardian"));
  });

  test("the index round-trips both without losing a card", () => {
    expect(index.artists.length).toBe(index.size);
    // Every card in this corpus is credited to somebody.
    expect(index.artists.every((names) => names.length > 0)).toBe(true);
    // Flavour is the opposite: most cards have none, and the index says so by
    // simply not listing them rather than by storing an empty string each.
    expect(index.flavourTerms.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* unique:                                                                     */
/* -------------------------------------------------------------------------- */

/** The Head Jab rows of an outcome — printed at three pitches, so it is the
 *  worked example for every level of collapsing. */
function headJabRows(outcome: ReturnType<typeof searchCards>) {
  return outcome.results.filter((row) => row.label.startsWith("Head Jab"));
}

describe("unique:", () => {
  test("the three levels are progressively finer, and names is the default", () => {
    const names = searchCards(index, "head jab", 5000);
    const cards = searchCards(index, "head jab unique:cards", 5000);
    const art = searchCards(index, "head jab unique:art", 5000);

    expect(names.unique).toBe("names");
    expect(cards.unique).toBe("cards");
    expect(art.unique).toBe("art");

    // Strictly increasing: a name holds one or more cards, a card one or more
    // pictures. Equality anywhere would mean a level that collapses nothing.
    expect(cards.total).toBeGreaterThan(names.total);
    expect(art.total).toBeGreaterThan(cards.total);

    /*
     * AND IT AGREES WITH THE CORPUS RATHER THAN MERELY BEING BIGGER. Head Jab
     * is printed at three pitches, so the default owes exactly one row for it
     * and `unique:cards` owes three — a difference of two, from one name.
     * Asserting the counts against each other would have passed on any
     * expansion at all, including a wrong one.
     */
    expect(headJabRows(searchCards(index, '!"head jab"', 5000)).length).toBe(1);
    expect(
      headJabRows(searchCards(index, '!"head jab" unique:cards', 5000)).length,
    ).toBe(3);
  });

  test("EVERY unique:art row links to a page that exists", () => {
    /*
     * THE TEST THAT EARNED ITS PLACE. The set code arrives here through
     * `setDict`, which holds upstream's spelling — `WTR` — while the router
     * lowercases when it builds the path. The first working version of this
     * feature emitted `/card/WTR/098/head-jab-1` for a page built at
     * `/card/wtr/098/head-jab-1`: every alternate-art result was a 404, and
     * every one of them looked correct in the list.
     *
     * Nothing inside the search module could have caught that, because both
     * halves were self-consistent. It needs the router's own route table.
     */
    const routes = new Set(CARD_ROUTES.map((route) => route.href));

    const rows = searchCards(index, "unique:art type:guardian", 5000).results;
    expect(rows.length).toBeGreaterThan(400);

    for (const row of rows) {
      expect(routes.has(row.href)).toBe(true);
    }
  });

  test("prints is an alias for art, because this corpus cannot tell them apart", () => {
    // 16,502 printing rows, 11,378 distinct pictures. Asking for every printing
    // gets every printing this data can distinguish. See `UNIQUE_MODES`.
    const art = searchCards(index, "head jab unique:art", 5000);
    const prints = searchCards(index, "head jab unique:prints", 5000);
    expect(prints.unique).toBe("art");
    expect(prints.total).toBe(art.total);
  });

  test("an unknown level is said out loud rather than guessed at", () => {
    const out = searchCards(index, "head jab unique:foil", 5000);
    expect(out.unique).toBe("names");
    expect(
      out.notices.some((notice) => notice.kind === "operand-unknown"),
    ).toBe(true);
    // And it still searches: a bad option must not eat the query.
    expect(out.total).toBeGreaterThan(0);
  });

  test("expanding happens before the limit, not after", () => {
    /*
     * `unique:art` builds its rows from `ranked`, not from the collapsed map.
     * Building from the collapsed map would have kept one version per name and
     * then listed only that version's arts — so a card's alternate arts
     * belonging to a SIBLING pitch version would vanish silently.
     */
    const rows = searchCards(index, "head jab unique:art", 5000).results;
    const versions = new Set(rows.map((row) => row.href.split("/")[2]));
    expect(versions.size).toBeGreaterThan(1);
  });
});

/* -------------------------------------------------------------------------- */
/* display:                                                                    */
/* -------------------------------------------------------------------------- */

describe("display:", () => {
  test("the two modes parse, under either of their spellings", () => {
    expect(parseCardQuery("dominate display:grid").display).toBe("grid");
    expect(parseCardQuery("dominate display:images").display).toBe("grid");
    expect(parseCardQuery("dominate display:list").display).toBe("list");
    expect(parseCardQuery("dominate display:rows").display).toBe("list");
  });

  test("the PARAMETER and the OPERATOR answer every spelling the same way", () => {
    /*
     * THE REGRESSION THIS EXISTS FOR ALREADY SHIPPED, and nothing failed while
     * it was live. `display` has two entry points — the `display:` operator you
     * type and the legacy `?display=` parameter you arrive on — and they read
     * two different tables. The operator took all seven spellings; `/search`'s
     * parameter reader took four of them. So `?display=rows` gave a GRID on the
     * one page where typing `display:rows` gives a list, and a set page, which
     * had the full list, gave a list for the same URL.
     *
     * ASSERTED AS AGREEMENT RATHER THAN AS A LIST, deliberately. A test that
     * spelled the seven words again would be a third copy of the table, and the
     * next spelling added would be added to the table and to the operator and
     * not to this. Reading the answer out of `parseCardQuery` means the two are
     * compared, so a spelling either one gains alone fails here.
     */
    for (const spelling of [
      "grid",
      "images",
      "list",
      "rows",
      "text",
      "checklist",
      "names",
    ]) {
      expect(parseDisplayParam(spelling)).toBe(
        parseCardQuery(`dominate display:${spelling}`).display,
      );
    }
  });

  test("a parameter nobody recognises is not an answer", () => {
    /* `null` rather than a default, so the caller decides — `/search` lets a
       `display:` in the query outrank the parameter, and cannot do that if an
       unrecognised parameter has already resolved to `grid`. */
    expect(parseDisplayParam("sideways")).toBeNull();
    expect(parseDisplayParam("")).toBeNull();
    expect(parseDisplayParam(null)).toBeNull();
    expect(parseDisplayParam(undefined)).toBeNull();
  });

  test("the parameter is read case- and space-insensitively", () => {
    /* It arrives on links people paste and edit by hand, unlike an operand the
       parser has already lowercased. */
    expect(parseDisplayParam(" ROWS ")).toBe("list");
    expect(parseDisplayParam("Grid")).toBe("grid");
  });

  test("the retired names-only view resolves to list, and says so", () => {
    /*
     * THE BOOKMARK KEEPS WORKING AND THE READER IS TOLD WHY. `display:text`
     * named a third view — names one per line — that turned out to be `list`
     * with the metadata removed rather than a kind of its own. Refusing these
     * spellings would break links that are documented at `/syntax`; resolving
     * them in silence would leave a reader who typed one wondering why the
     * page ignored them.
     */
    for (const spelling of ["text", "checklist", "names"]) {
      const out = searchCards(index, `dominate display:${spelling}`, 5000);
      expect(out.display).toBe("list");
      expect(
        out.notices.some((notice) => notice.kind === "operand-retired"),
      ).toBe(true);
      // Translated, not dropped: the query still answers.
      expect(out.total).toBeGreaterThan(0);
    }
  });

  test("the surviving spellings are quiet — a synonym is not a retirement", () => {
    /*
     * `rows` and `list` have always been one view under two names, so neither
     * has anything to announce. Without this the notice would fire on every
     * spelling in the table and the distinction it exists to draw would be
     * lost.
     */
    for (const spelling of ["grid", "images", "list", "rows"]) {
      const out = searchCards(index, `dominate display:${spelling}`, 5000);
      expect(
        out.notices.some((notice) => notice.kind === "operand-retired"),
      ).toBe(false);
    }
  });

  test("silence is null, not grid", () => {
    /*
     * THE DISTINCTION THE COMPONENT DEPENDS ON. `null` means the query said
     * nothing, which is the only case where the legacy `?display=` parameter
     * gets a vote. Defaulting to "grid" here would have made every link shared
     * before this operator existed silently revert to the grid.
     */
    expect(parseCardQuery("dominate").display).toBeNull();
    expect(parseCardQuery("").display).toBeNull();
  });

  test("it is an option, not a term — it never becomes something to match", () => {
    // The whole hazard of an option: left in the token stream it would be a
    // text search for the literal string on every card that does not carry it.
    const parsed = parseCardQuery("dominate display:list");
    expect(parsed.terms).toEqual(["dominate"]);
    expect(parsed.filters.some((filter) => filter.field === "text")).toBe(
      false,
    );

    // And it does not change WHICH cards match, only how they are shown.
    const plain = searchCards(index, "dominate", 5000);
    const shown = searchCards(index, "dominate display:list", 5000);
    expect(shown.total).toBe(plain.total);
    expect(shown.results.map((row) => row.href)).toEqual(
      plain.results.map((row) => row.href),
    );
  });

  test("an unknown mode is said out loud and does not eat the query", () => {
    const out = searchCards(index, "dominate display:gallery", 5000);
    expect(out.display).toBeNull();
    expect(
      out.notices.some((notice) => notice.kind === "operand-unknown"),
    ).toBe(true);
    expect(out.total).toBeGreaterThan(0);
  });

  test("it composes with the other two options", () => {
    const parsed = parseCardQuery(
      "type:guardian display:list unique:art order:cost",
    );
    expect(parsed.display).toBe("list");
    expect(parsed.unique).toBe("art");
    expect(parsed.sort.key).toBe("cost");
    expect(parsed.filters.some((filter) => filter.field === "type")).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Release dates                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `year:`, `date:` and `order:released` — the last three operators
 * `docs/SCRYFALL-GAP.md` §7 listed and the corpus could not answer.
 *
 * PINNED AGAINST THE SET CORPUS RATHER THAN AGAINST TYPED NUMBERS, wherever a
 * number would otherwise be a second copy of the data. `set:wtr` and
 * `year:2019` have to agree because every Welcome to Rathe card was released on
 * the day Welcome to Rathe was; asserting that equality tests the join, while
 * asserting "116" would only test that nobody re-synced the corpus.
 */
describe("release dates", () => {
  const wtr = SETS.sets.find((set) => set.id === "WTR");
  const wtrYear = (wtr?.released ?? "").slice(0, 4);

  test("the corpus still has the set this section is anchored on", () => {
    // Every assertion below is worthless if this drifts, so it fails loudly
    // rather than letting the rest pass vacuously.
    expect(wtr?.released).toBe("2019-10-11");
  });

  test("a set's cards are all released in that set's year", () => {
    const bySet = total("set:wtr");
    expect(bySet).toBeGreaterThan(0);
    expect(total(`set:wtr year:${wtrYear}`)).toBe(bySet);
    expect(total(`set:wtr -year:${wtrYear}`)).toBe(0);
  });

  test("the day and the year agree with each other", () => {
    expect(total(`date:${wtr?.released}`)).toBeGreaterThanOrEqual(
      total("set:wtr"),
    );
    expect(total("year>=2024")).toBe(total("date>=2024-01-01"));
  });

  test("the two halves cover every dated card and nothing else", () => {
    /*
     * `unique:cards` because the default collapses pitch versions into one row,
     * and this is a claim about CARDS. Counted as a union rather than a sum:
     * a card printed in 2019 and reprinted in 2021 satisfies both halves, since
     * `year:` asks whether ANY printing matches — so `236 + 4855` overruns the
     * corpus while the union lands exactly on it.
     */
    const covered = searchCards(
      index,
      "(year<2020 or year>=2020) unique:cards",
      20000,
    ).total;
    expect(covered).toBe(4941 - index.undatedCards);

    // And the overlap is real rather than incidental — reprints exist.
    const before = searchCards(index, "year<2020 unique:cards", 20000).total;
    const after = searchCards(index, "year>=2020 unique:cards", 20000).total;
    expect(before + after).toBeGreaterThan(covered);
  });

  test("an operand that is not a year or a date is refused, not guessed", () => {
    for (const query of ["year:24", "year:twenty", "date:june", "date:2024"]) {
      const out = searchCards(index, query, 5000);
      expect(notices(query)).toContain("operand-unknown");
      expect(out.total).toBe(0);
    }
  });

  /*
   * THE MISSING 53 ARE NAMED RATHER THAN DROPPED. Seventeen sets carry no
   * upstream release date, so 53 cards match no date filter that can ever be
   * written. A search that quietly returned 4,888 answers to a question about
   * 4,941 cards would be exactly the confident wrongness this engine exists to
   * avoid.
   */
  test("a date filter says how many cards it cannot see", () => {
    expect(index.undatedCards).toBeGreaterThan(0);
    expect(notices("year:2024")).toContain("coverage-partial");
    // And only where a date is actually being filtered on.
    expect(notices("set:wtr")).not.toContain("coverage-partial");
    expect(notices("dominate order:released")).not.toContain(
      "coverage-partial",
    );
  });

  test("order:released is oldest first, and dir:desc reverses it", () => {
    /*
     * `unique:cards`, SO EVERY ROW STANDS FOR THE CARD IT WAS SORTED BY.
     *
     * The default mode collapses pitch siblings, and a collapsed row's href is
     * the LOWEST-PITCH sibling's address while the row itself is the
     * BEST-RANKED one — under `order:released`, the earliest-released. So
     * looking a row's date up by its href reads a different card's date, and
     * the monotonicity claim is checked against the wrong card. It passes today
     * only because siblings are almost always printed in the same sets, which
     * is the kind of accident that makes a test look like it works.
     */
    const asc = searchCards(
      index,
      "dominate order:released unique:cards",
      5000,
    );
    const desc = searchCards(
      index,
      "dominate order:released dir:desc unique:cards",
      5000,
    );
    expect(asc.sort.key).toBe("released");
    expect(asc.total).toBe(desc.total);
    expect(asc.results[0]?.label).not.toBe(desc.results[0]?.label);

    /* The ordering is the claim, so it is checked over the whole page rather
       than at the ends: every card's first release is at least as late as the
       one before it. */
    /* KEYED ON THE ROW'S HREF, WHICH IS NOW A PRINTING URL. This used to strip
       `/card/` and look the remainder up in `slugs`; that returned -1 for every
       row the moment addresses gained segments, so `dated` was empty and the
       assertion compared [] to []. The ordering claim went unchecked. Every row
       is one card here, so its href IS its own address. */
    const ordinalByHref = new Map(
      index.slugs.map((_, ordinal) => [addressOf(ordinal), ordinal]),
    );
    const dates = asc.results.map((row) => {
      const ordinal = ordinalByHref.get(row.href);
      return ordinal === undefined ? "" : (index.released[ordinal]?.[0] ?? "");
    });
    const dated = dates.filter((date) => date !== "");
    /* EVERY row has to resolve, not merely one — a lookup that silently missed
       some rows would check monotonicity over a subsequence, which is a weaker
       claim that can hold while the sort is wrong. */
    expect(dates.filter((date) => date === "")).toEqual([]);
    expect(dated.length).toBeGreaterThan(0);
    expect(dated).toEqual([...dated].toSorted());
  });

  /*
   * `!=` IS REFUSED RATHER THAN ANSWERED, and this test is the argument.
   *
   * The first version applied it per printing, so a card printed in 2019 and
   * reprinted in 2024 satisfied `year:2024` AND `year!=2024` — a query and its
   * own negation. Applying it to the whole card fixes that and then disagrees
   * with `-year:` by exactly the undated cards: `-` is a boolean NOT over a
   * match that did not happen and so includes them, while `!=` would be
   * asserting a release date for cards upstream publishes none for.
   *
   * No meaning is both consistent and honest, so the engine offers the spelling
   * that has one and names the one that does not.
   */
  test("year!= is refused, and says which spelling to use instead", () => {
    for (const query of ["year!=2024", "date!=2024-06-21"]) {
      const out = searchCards(index, query, 20000);
      expect(notices(query)).toContain("operator-unknown");
      expect(out.total).toBe(0);
    }
  });

  test("-year: keeps the cards with no published date", () => {
    /* The behaviour `!=` could not have matched: a card upstream gives no date
       for is not known to have been released in 2024, so excluding it from
       `year:2024` is right and dropping it from `-year:2024` would not be. */
    const positive = total("year:2024 unique:cards");
    const negative = total("-year:2024 unique:cards");
    expect(positive + negative).toBe(4941);
    expect(negative - (4941 - index.undatedCards - positive)).toBe(
      index.undatedCards,
    );
  });

  test("`release` is accepted as a spelling of `released`", () => {
    expect(parseCardQuery("dominate order:release").sort.key).toBe("released");
  });
});

/* -------------------------------------------------------------------------- */
/* Field-to-field comparison                                                   */
/* -------------------------------------------------------------------------- */

/**
 * `power>defence` — a comparison whose right-hand side is another printed value
 * on the same card, and the last `partial` row in `docs/SCRYFALL-GAP.md`'s
 * capability table.
 */
describe("comparing two printed values", () => {
  test("the three comparisons partition the cards that have both", () => {
    /*
     * THE STRONGEST AVAILABLE ASSERTION, and the reason it is worth the setup:
     * every card with two numeric values must satisfy exactly one of >, < and =,
     * so the three totals have to sum to the population and cannot overlap. A
     * matcher that read the wrong field, or compared strings, or treated a
     * missing value as zero breaks this identity immediately — none of which a
     * spot-check of one card would catch.
     */
    const both = total("power>=0 defence>=0 unique:cards");
    const gt = total("power>defence unique:cards");
    const lt = total("power<defence unique:cards");
    const eq = total("power=defence unique:cards");

    expect(both).toBeGreaterThan(0);
    expect(gt + lt + eq).toBe(both);
  });

  test("the short spellings are the same query as the long ones", () => {
    /*
     * THIS TEST USED TO READ `pow>tou`, AND THAT IS THE CHANGE. It asserted
     * that a reader arriving from Scryfall could type that other game's
     * spelling and get ours — which was true, and was the argument for
     * accepting `tou` at all.
     *
     * `tou` is gone. Toughness is a Flesh and Blood TOKEN, an aura, not a stat,
     * so the operator named after it was answering a question about defence
     * while the thing actually called Toughness stayed unreachable. `pow` and
     * `def` stay: power and defense are words this game uses, so a short
     * spelling of them is a convenience rather than a foreign import.
     *
     * Both sides of a comparison still have to accept the short forms, which is
     * what this asserts — `pow>def` resolving on one side only is the failure
     * the original comment warned about, and it survives the vocabulary change.
     */
    const long = searchCards(index, "power>defence unique:cards", 20000);
    const short = searchCards(index, "pow>def unique:cards", 20000);
    expect(long.total).toBe(short.total);
    expect(long.results.map((row) => row.href)).toEqual(
      short.results.map((row) => row.href),
    );
  });

  test("the rules' own spelling of defence is a query too", () => {
    /* CR 2.3 is titled "Defense" and upstream keys the field `defense`; this
       project prints "Defence". A reader copying the word out of the rules must
       not be told it is not an operator. */
    const ours = searchCards(index, "defence>=3 unique:cards", 20000);
    const theirs = searchCards(index, "defense>=3 unique:cards", 20000);
    expect(ours.total).toBe(theirs.total);
    expect(ours.total).toBeGreaterThan(0);
  });

  test("the retired spellings say what to type instead", () => {
    /*
     * A retired operator must not fall through to "is not an operator here".
     * Query state lives in the URL, so `o:dominate` and `tou:3` links exist in
     * conversations that outlive this change, and the reader following one did
     * nothing wrong.
     */
    for (const [query, replacement] of [
      ["o:dominate", "text:"],
      ["tou:3", "defence:"],
      ["toughness:3", "defence:"],
    ] as const) {
      const notices = parseCardQuery(query).notices;
      expect(notices.map((notice) => notice.kind)).toContain("operand-retired");
      expect(notices.map((notice) => notice.text).join(" ")).toContain(
        replacement,
      );
    }
  });

  test("a card with an unprintable value on either side is excluded", () => {
    /* Cards printing X, XX or nothing have no place in an order — the same
       decision `cost>=3` already makes, applied to both sides at once. */
    expect(total("power>=0 defence>=0 unique:cards")).toBeLessThan(4941);
  });

  test("an operand that is neither a number nor a field is refused", () => {
    expect(notices("power>fish")).toContain("operand-unknown");
    expect(total("power>fish")).toBe(0);
  });

  test("comparing a field to a literal still works", () => {
    expect(total("power>2")).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* Which printing's art a row carries                                          */
/* -------------------------------------------------------------------------- */

describe("one card index, one stat vocabulary", () => {
  test("a search row and a set-page row name the same printed values", () => {
    /*
     * THE ROWS VIEW IS ONE COMPONENT ON TWO SURFACES, and for a while it spoke
     * two vocabularies. A set page builds its rows from `CardPage.stats`, which
     * `statsOf` assembles as Cost / Power / Defence / Life / Intellect;
     * a search row was built from an index that carried only the first three.
     * So a hero read `Life 20 · Intellect 4` on `/sets/mon` and carried no
     * stats at all on `/search?q=set:mon` — in the one rendering `CardIndex`
     * exists to make identical.
     *
     * Two lists in two files is a drift waiting to happen, so this pins them
     * against each other rather than trusting that both get edited together.
     */
    const fromCorpus = new Set(
      CARD_PAGES.flatMap((page) => page.stats.map((stat) => stat.label)),
    );
    const fromIndex: readonly string[] = STAT_LABELS;

    /* More than the three the index used to carry, or this test would pass on
       the version it was written against. */
    expect(fromCorpus.size).toBeGreaterThan(3);
    expect([...fromCorpus].toSorted()).toEqual([...fromIndex].toSorted());
  });

  test("and they name them in the same ORDER, which is the load-bearing half", () => {
    /*
     * THE TEST ABOVE SORTS BOTH SIDES, so it pins membership and not sequence —
     * and sequence is the whole reason `STAT_ORDER` exists as a named export.
     * `toResult` maps `STAT_LABELS` against a positional tuple, `passesFilter`
     * and the sort keys read cost, power and defence at indices 0-2, and the
     * card page draws its sockets in this order. Two lists agreeing on their
     * contents while disagreeing on their order would put a card's defence
     * under the word "Power" and pass the check next to this one.
     */
    expect([...STAT_LABELS]).toEqual([...STAT_ORDER]);

    /* The three the comparison operators index positionally, stated separately
       so a reordering of the tail cannot quietly move them. */
    expect([...STAT_ORDER].slice(0, 3)).toEqual(["Cost", "Power", "Defence"]);
  });

  test("a hero carries its life and intellect on a search row", () => {
    /* The concrete consequence, on the card type that has nothing else to
       show: before this, `type:hero` rendered rows with an empty stat line. */
    const hero = searchCards(index, "type:hero unique:cards", 20000).results[0];
    expect(hero).toBeDefined();
    const labels = (hero?.stats ?? []).map(([label]) => label);
    expect(labels).toContain("Life");
    expect(labels).toContain("Intellect");
  });

  test("the comparison operators still index the first three positionally", () => {
    /* Cost, power and defence stay at positions 0-2 so `passesFilter` and the
       sort keys keep reading the column they name. The three added values are
       display-only and no filter reads them. */
    expect(STAT_LABELS.slice(0, 3)).toEqual(["Cost", "Power", "Defence"]);
    expect(total("power>2")).toBeGreaterThan(0);
    expect(total("cost>=3")).toBeGreaterThan(0);
    expect(total("defence>=2")).toBeGreaterThan(0);
  });
});

describe("a set-scoped search shows that set's printing", () => {
  /*
   * THE BUG THIS PINS WAS SILENT AND IT LOOKED RIGHT. Every row carried its
   * card's DEFAULT face — the first printing that publishes art, in corpus
   * order — so `set:MON` returned Monarch's cards wearing Heavy Hitters' art.
   * A picture of the right card from the wrong print run, on a query whose
   * entire subject is the print run, with nothing on the page to say so.
   *
   * Measured while writing these: 2,239 of the 4,941 cards are printed in more
   * than one set, and all 2,239 have at least one set whose art differs from
   * the default. This was most of the reprints in the game.
   */
  test("every face on a single-set query comes from that set", () => {
    const outcome = searchCards(index, "set:mon unique:cards", 20000);
    expect(outcome.setFocus).toBe("mon");
    expect(outcome.results.length).toBeGreaterThan(100);

    const strays = outcome.results.filter(
      (row) =>
        row.faceKey !== null && !row.faceKey.toUpperCase().startsWith("MON"),
    );
    expect(strays).toEqual([]);
  });

  /*
   * AND THE LINK GOES WHERE THE PICTURE IS, WHICH IS THE SECOND HALF AND WAS
   * MISSING FOR LONGER. Swapping the art left every row pointing at the card's
   * DEFAULT printing, so a `set:MON` grid drew Monarch faces over links into
   * Heavy Hitters: click the picture and land on a different set, a different
   * collector number and a different painting of the same card — a wrong answer
   * of the kind nothing on the page could show, because a link looks correct
   * until it is followed.
   *
   * ASSERTED AS "THE ADDRESS NAMES THE PICTURE" RATHER THAN AS A SET PREFIX,
   * and the difference is the fallback. A card can match `set:MON` on a printing
   * whose art is shared with an earlier set — Regular / Rainbow Foil / Cold Foil
   * are three rows and one image — and then the honest answer is the card's own
   * face at its own address, which is NOT under `/card/mon/`. A prefix test
   * would have to carve that case out and would stop being an invariant; this
   * states the property both cases actually share.
   */
  const addressNamesThePicture = (query: string) => {
    const outcome = searchCards(index, query, 20000);
    expect(outcome.results.length).toBeGreaterThan(0);

    const wrong = outcome.results
      .filter((row) => row.faceKey !== null)
      .map((row) => {
        const [, , setCode = "", number = ""] = row.href.split("/");
        return {
          href: row.href,
          faceKey: row.faceKey,
          expected: numberFor(row.faceKey ?? "", setCode),
          number,
        };
      })
      .filter((row) => row.expected !== row.number);
    expect(wrong).toEqual([]);
  };

  test("a row opens the printing it is showing, in every mode", () => {
    /*
     * EVERY MODE, because each resolves the pair differently and each got the
     * pairing wrong in its own way: `unique:names` from the version it opens,
     * `unique:cards` from the row's own focus printing, `unique:art` from the
     * art row itself. One invariant over all three is what stops a later change
     * fixing one and quietly breaking another.
     */
    addressNamesThePicture("set:mon unique:cards");
    addressNamesThePicture("set:mon unique:names");
    addressNamesThePicture("set:mon unique:art");
    addressNamesThePicture("set:lgs unique:cards");
    /* And with no set named at all, where the printing is the default one. */
    addressNamesThePicture("dominate");
  });

  test("a reprint's row links into the set the reader named", () => {
    /*
     * THE INVARIANT ABOVE IS TRUE OF THE OLD BEHAVIOUR TOO on a card printed in
     * one set — face and address both default, both agreeing — so it needs the
     * cards where the two answers genuinely differ. Those are the reprints, and
     * they are most of the game: 2,239 of 4,941 cards.
     *
     * SELECTED FROM THE INDEX, NOT FROM THE RESULTS, because "which rows did
     * this change move" is a fact about the corpus and asking the results is
     * asking the thing under test. A card whose DEFAULT printing is outside
     * Monarch and which has a Monarch art is a row that used to leave the set
     * on a click; every one of them must now stay.
     */
    const moved = index.arts
      .map((arts, ordinal) => ({ ordinal, arts }))
      .filter(
        ({ ordinal, arts }) =>
          index.faceSets[ordinal] !== "mon" &&
          arts.some((art) => art.setCode === "mon"),
      );
    expect(moved.length).toBeGreaterThan(50);

    const outcome = searchCards(index, "set:mon unique:cards", 20000);
    const byHref = new Map(outcome.results.map((row) => [row.href, row]));

    const missing: string[] = [];
    const stale: string[] = [];
    for (const { ordinal } of moved) {
      const here = addressInSetOf(index, ordinal, "mon");
      /* Present at its Monarch address. */
      if (!byHref.has(here)) missing.push(here);
      /*
        AND ABSENT AT ITS OLD ONE, which is the half that can actually fail.
        "Is it at the new address" alone would pass on a result set that
        offered both; this says the row MOVED. The old address is a printing of
        this card outside Monarch, so no other row in this answer can be
        carrying it — every row here is addressed by its own card.
      */
      if (byHref.has(addressOf(ordinal))) stale.push(addressOf(ordinal));
    }
    expect(missing).toEqual([]);
    expect(stale).toEqual([]);
  });

  test("no row loses its picture to the resolution", () => {
    /*
     * A straight reprint carries no new art, and Regular / Rainbow Foil / Cold
     * Foil in one set are three printing rows sharing one image — so "this set
     * published no distinct art for this card" is a real answer, and the
     * fallback to the card's own face is correct rather than a miss. What must
     * never happen is a row that HAD a face ending up with none, which is what
     * a lookup treated as authoritative would produce.
     */
    const scoped = searchCards(index, "set:sup unique:cards", 20000);
    const blank = scoped.results.filter((row) => row.faceKey === null);
    expect(scoped.results.length).toBeGreaterThan(0);
    /* The four cards in the whole corpus with no published art are the only
       ones entitled to a null face, and none of them is in this set. */
    expect(blank).toEqual([]);
  });

  test("two sets, or a negated one, resolve to no focus at all", () => {
    /*
     * AMBIGUITY ANSWERS `null`, WHICH IS THE WHOLE SAFETY PROPERTY. Picking
     * either side of `set:mon or set:mst` would answer an unknown fraction of
     * the rows with art from a set the reader did not name — and it would look
     * exactly as correct as the right answer does.
     */
    expect(searchCards(index, "set:mon or set:mst").setFocus).toBeNull();
    expect(searchCards(index, "-set:mon dominate").setFocus).toBeNull();
    expect(searchCards(index, "dominate").setFocus).toBeNull();
    /* A set named beside another filter is still one set. */
    expect(searchCards(index, "set:mon pitch:1").setFocus).toBe("mon");
  });

  test("the orientation travels with the face, never with the card", () => {
    /*
     * THE HALF-SWAP THAT ALMOST SHIPPED. The first pass overrode `faceKey` with
     * the focus set's art and went on reading `faceLandscape` from the default
     * face's — so a rotated alternate would have been drawn inside a portrait
     * box, visible at a glance, and only on the printings this feature exists
     * to show.
     *
     * `orientationOfFace` reads the ART'S OWN measured key (`faces.ts`,
     * `LANDSCAPE_FACE_KEYS`), so two arts of one card genuinely differ.
     *
     * THIS IS A LIVE FAILURE, AND THIS NOTE USED TO CALL IT LATENT. It said
     * "zero cards diverge today", which was true only of the rule it was written
     * against: orientation came from `played_horizontally`, a property of the
     * CARD, so every face of a card got one answer and divergence was
     * unreachable by construction. Measured against the stored bytes, **12 cards
     * diverge** — `Vaporize // Shock` ships `LGS346-CF` portrait and `ROS011`
     * landscape, and the `Runechant` token is landscape on both faces while
     * being neither played horizontally nor rotated.
     *
     * Asserted as an invariant over the whole index rather than against a
     * fixture card, which is what makes it keep holding as the corpus moves.
     *
     * THE ROW IS FOUND BY ITS CARD, NOT BY ITS FACE. Selecting it with
     * `faceKey === art.key` and then asserting `faceKey` back is a tautology —
     * it can only find rows that already agree, so the swap this test is named
     * after would have passed by simply not matching anything.
     *
     * AND THE ASSERTION IS PAIR-MEMBERSHIP RATHER THAN A NAMED ART, because
     * addressing by card turned up a case the first version had not considered:
     * a card can have SEVERAL arts in one set. `A Bit Off the Side` carries both
     * `OMN243.webp` and `OMN243-CF.webp` in Omen, and a row shows one picture,
     * so "the row wears THIS art" is not a property any single art has.
     *
     * What is always true is the thing the half-swap broke: the key and the
     * orientation come from the SAME printing. So the row's pair has to be one
     * of the pairs the card actually has. Pairing an art's key with the default
     * face's orientation — exactly the bug — produces a pair that is in neither.
     */
    let checked = 0;
    for (const [ordinal, arts] of index.arts.entries()) {
      /* Every face this card could legitimately be shown by, as a pair. */
      const known = [
        {
          key: index.faceKeys[ordinal] ?? null,
          landscape: index.faceLandscape[ordinal] === true,
        },
        ...arts.map((art) => ({ key: art.key, landscape: art.landscape })),
      ].map((pair) => JSON.stringify(pair));

      for (const setCode of new Set(arts.map((art) => art.setCode))) {
        /* THE ROW'S ADDRESS UNDER THIS SCOPE, NOT THE CARD'S DEFAULT ONE. It
           was the default, and every iteration that mattered `continue`d the
           moment a row started opening the printing it shows — the arts in
           this loop are by definition from sets other than the default one, so
           this test would have gone on passing while checking only the cards
           it was not about. */
        const href = addressInSetOf(index, ordinal, setCode);
        const row = searchCards(
          index,
          `set:${setCode} unique:cards`,
          20000,
        ).results.find((result) => result.href === href);
        if (row === undefined) continue;
        checked += 1;
        expect({
          href,
          setCode,
          pair: JSON.stringify({
            key: row.faceKey,
            landscape: row.faceLandscape,
          }),
          known: known.includes(
            JSON.stringify({
              key: row.faceKey,
              landscape: row.faceLandscape,
            }),
          ),
        }).toMatchObject({ href, setCode, known: true });
      }
      /* Only the first few ordinals: the loop above runs a full search per set
         and there are 6,437 arts. The property is structural, so a sample that
         covers both orientations proves the wiring. */
      if (ordinal > 40) break;
    }

    /* AND IT LOOKED AT SOMETHING. The row lookup is by href, so a scheme change
       that leaves `addressOf` out of step with the search module makes every
       `find` return undefined and every iteration `continue` — the loop passes
       having asserted nothing, which is exactly how this test died once. */
    expect(checked).toBeGreaterThan(0);
  });

  test("a divergent art is drawn at ITS orientation, not the default face's", () => {
    /*
     * THE TEST ABOVE CANNOT FAIL TODAY, AND THIS ONE CAN. Zero cards in this
     * corpus have an alternate art whose orientation differs from their default
     * face, so the invariant holds vacuously — reintroduce the half-swap and it
     * still passes. That makes it a statement of the property rather than a
     * guard on it, which is worth having and is not worth mistaking for a
     * regression test.
     *
     * So the divergence is CONSTRUCTED. The encoded index is a bag of strings
     * by design, and `arts` is `<setId> <landscapeBit> <key>` per entry — so
     * flipping one bit produces the corpus this repository does not have yet,
     * decodes through the real decoder, and runs the real search. Under the
     * half-swap this fails; under the fix it passes.
     */
    const artLines = encoded.arts.split("\n");
    /*
     * THE ART HAS TO BE FROM A SET THE DEFAULT FACE IS NOT IN, or the override
     * never runs: `toResult` returns the card's own face as soon as
     * `faceSets[ordinal]` equals the focus, which is the common case and the
     * cheap path. The first card tried had both its Omen arts under `set:omn`,
     * so it took that branch and the test was measuring nothing.
     */
    const target = index.arts.findIndex(
      (arts, ordinal) =>
        arts.length > 0 &&
        arts[0] !== undefined &&
        arts[0].setCode !== index.faceSets[ordinal] &&
        index.faceLandscape[ordinal] === false &&
        arts[0].landscape === false,
    );
    expect(target).toBeGreaterThanOrEqual(0);

    const entry = artLines[target]?.split("\t")[0] ?? "";
    const [setId = "", bit = "", key = ""] = entry.split(" ");
    /* The card's own face must be PORTRAIT for the flip to be a divergence. */
    expect(bit).toBe("0");
    expect(encoded.faceLandscape[target]).toBe("0");

    const flipped = decodeCardIndex({
      ...encoded,
      arts: artLines
        .map((line, ordinal) =>
          ordinal === target
            ? [`${setId} 1 ${key}`, ...line.split("\t").slice(1)].join("\t")
            : line,
        )
        .join("\n"),
    });

    const art = flipped.arts[target]?.[0];
    expect(art?.landscape).toBe(true);

    /* The row's address UNDER THIS SCOPE, which is the flipped art's own page:
       the row shows that art, and a row opens the printing it shows. Built
       against `flipped` rather than the module index, because that is the
       corpus this search runs over. */
    const href = addressInSetOf(flipped, target, art?.setCode ?? "");
    const row = searchCards(
      flipped,
      `set:${art?.setCode} unique:cards`,
      20000,
    ).results.find((result) => result.href === href);

    /* The row must wear the alternate art AND its landscape box. Reading the
       orientation off the default face gives `false` here, which is the bug. */
    expect({ key: row?.faceKey, landscape: row?.faceLandscape }).toEqual({
      key: art?.key,
      landscape: true,
    });
  });

  test("in unique:art no card shows one picture on two of its rows", () => {
    /*
     * `unique:art` expands a card into its DEFAULT face plus one row per
     * alternate, so every row in this mode is already a printing and none of
     * them wants the focus set's art.
     *
     * THE FIRST GUARD ONLY COVERED THE ROWS THE EXPANSION ADDED. It tested
     * `art !== undefined`, true of the alternates and false of the row being
     * expanded — so under `set:lgs` the card row took the LGS art and the LGS
     * art row rendered the identical picture directly beneath it.
     *
     * This assertion counts duplicates PER CARD because the obvious one does
     * not catch it: ">1 distinct key across the result set" is true of a page
     * full of adjacent duplicate pairs.
     */
    const arts = searchCards(index, "set:lgs unique:art", 20000);
    expect(arts.total).toBeGreaterThan(0);

    /*
     * THE CARD IS THE LAST SEGMENT, AND IT USED TO BE THE FIRST THREE.
     * `/card/<slug>/…` meant the leading `/card/<slug>` identified the card;
     * addresses are `/card/<set>/<number>/<slug>` now, so the same expression
     * yields `/card/lgs` and buckets every row in the set together. That breaks
     * this test in BOTH directions: the regression it guards escapes whenever a
     * card's default printing comes from another set (its two rows land in
     * different buckets), and two distinct cards sharing one image inside `lgs`
     * would fail it spuriously.
     *
     * The slug is unique per card — `SLUG_BY_ID` throws otherwise — so the
     * trailing segment is the card, exactly as the leading one used to be.
     */
    const byCard = new Map<string, string[]>();
    for (const row of arts.results) {
      if (row.faceKey === null) continue;
      const card = row.href.split("/").at(-1) ?? "";
      const seen = byCard.get(card);
      if (seen) seen.push(row.faceKey);
      else byCard.set(card, [row.faceKey]);
    }
    /* Grouped by CARD, so there are many buckets — one per set would be one,
       which is what the broken expression produced and what nothing caught. */
    expect(byCard.size).toBeGreaterThan(50);

    const duplicated = [...byCard.entries()].filter(
      ([, keys]) => new Set(keys).size !== keys.length,
    );
    expect(duplicated).toEqual([]);
  });

  test("every card in a fan comes from the set the reader named", () => {
    /*
     * THE FAN DEALT FROM TWO DECKS. `toResult` resolved the ROW's picture
     * through the focus set and the collapse loop built the pitch versions
     * straight out of `faceKeys` — the card's first-ever printing — so
     * `set:MPW` on Hit and Run put MPW112 in front of the 1HP red and blue.
     * Hovering opened a hand holding one card from the set the reader named and
     * two from a set they did not, and the frames differ enough that it read as
     * a rendering fault.
     *
     * ASSERTED OVER EVERY VERSION OF EVERY ROW, not over the rows. The row's
     * own face has been right since the focus feature landed; what shipped
     * wrong is the part nothing looked at.
     */
    const outcome = searchCards(index, "set:mon", 20000);
    expect(outcome.setFocus).toBe("mon");

    const fanned = outcome.results.filter(
      (row) => row.matchedVersions.length > 1,
    );
    /* Monarch prints whole pitch cycles, so there are hands to look at. If this
       ever goes to zero the test below is vacuous and this is what says so. */
    expect(fanned.length).toBeGreaterThan(20);

    const strays = fanned.flatMap((row) =>
      row.matchedVersions
        .filter(
          (version) =>
            version.faceKey !== null &&
            !version.faceKey.toUpperCase().startsWith("MON"),
        )
        .map((version) => `${row.name}: ${version.faceKey}`),
    );
    expect(strays).toEqual([]);
  });

  test("the front card and its own version agree, picture for picture", () => {
    /*
     * THE INVARIANT UNDERNEATH THE ONE ABOVE, and it holds for every query
     * rather than only for a set-scoped one. A collapsed row IS one of the
     * versions it stands for — the best-ranked one — so the row's face and that
     * version's face are two renderings of a single fact and must never
     * disagree.
     *
     * `CardStack` drops the version whose address is the row's and draws the
     * row's own face in front, so a disagreement here is invisible in the grid:
     * the picture simply comes from whichever of the two paths the fix missed.
     * That is precisely how the two-decks bug survived — the front card looked
     * right because it WAS right, and the loop feeding the rest of the hand was
     * a second, older answer to the same question.
     */
    for (const query of ["set:mon", "set:mpw", "dominate", "pitch:1 set:mst"]) {
      const outcome = searchCards(index, query, 500);
      for (const row of outcome.results) {
        const own = row.matchedVersions.find(
          (version) => version.href === row.href,
        );
        if (own === undefined) continue;
        expect({
          query,
          href: row.href,
          key: own.faceKey,
          landscape: own.faceLandscape,
        }).toEqual({
          query,
          href: row.href,
          key: row.faceKey,
          landscape: row.faceLandscape,
        });
      }
    }
  });

  test("a filter that excludes a pitch excludes it from the hand", () => {
    /*
     * THE OTHER HALF OF "THE FAN SHOWS THE PRINTINGS THAT MATCHED". The faces
     * being right is worth nothing if the hand holds a card the query is false
     * of, so this pins the membership rather than the pictures.
     *
     * It has held since `matchedVersions` replaced the bare pitch list — the
     * collapse walks the RANKED rows, which are the matches — and it is pinned
     * here anyway, beside the faces, because the two claims are one promise to
     * a reader and a later change to either loop could break just this one.
     */
    const scoped = searchCards(index, "set:mon pitch:1", 20000);
    expect(scoped.results.length).toBeGreaterThan(10);
    for (const row of scoped.results) {
      expect(row.matchedVersions.map((version) => version.pitch)).toEqual([1]);
    }

    /* And a name whose whole cycle is in the set keeps the whole cycle, so the
       assertion above is a filter doing its job rather than a fan that has
       quietly stopped being drawn. */
    const whole = searchCards(index, "set:mon", 20000).results.filter(
      (row) => row.matchedVersions.length === 3,
    );
    expect(whole.length).toBeGreaterThan(20);
  });
});

/* -------------------------------------------------------------------------- */
/* Paging                                                                      */
/* -------------------------------------------------------------------------- */

describe("offset pages the ranked rows without changing the answer", () => {
  test("consecutive pages are disjoint and reassemble the whole list", () => {
    /*
     * THE CAP BECAME A PAGE SIZE. The engine used to return the first sixty
     * matches and the interface told the reader to narrow the query, which is a
     * reference work saying the question was wrong. Paging has to be a cut of
     * ONE ranked list rather than a second ranking — otherwise page 2 could
     * repeat or skip rows and nothing on the page would show it.
     */
    const all = searchCards(index, "type:action", 20000).results.map(
      (row) => row.href,
    );
    expect(all.length).toBeGreaterThan(120);

    const first = searchCards(index, "type:action", 60, 0);
    const second = searchCards(index, "type:action", 60, 60);
    const third = searchCards(index, "type:action", 60, 120);

    expect(first.results.map((row) => row.href)).toEqual(all.slice(0, 60));
    expect(second.results.map((row) => row.href)).toEqual(all.slice(60, 120));
    expect(third.results.map((row) => row.href)).toEqual(all.slice(120, 180));
  });

  test("the total is the whole answer on every page, never the page", () => {
    /* This is what lets the interface say "1,204 cards match, page 3 of 21".
       A total that shrank to the page size would make the pager unbuildable. */
    const first = searchCards(index, "type:action", 60, 0);
    const later = searchCards(index, "type:action", 60, 120);
    expect(later.total).toBe(first.total);
    expect(later.total).toBeGreaterThan(later.results.length);
  });

  test("an offset past the end is an empty page, not an error or a wrap", () => {
    /* `?page=` is a number somebody can edit. Wrapping to the first page would
       be the worst outcome: a URL showing page 1 while claiming page 99. The
       interface walks the page back; the engine's job is to not lie meanwhile. */
    const past = searchCards(index, "type:action", 60, 100000);
    expect(past.results).toEqual([]);
    expect(past.total).toBeGreaterThan(0);
  });
});

/* -------------------------------------------------------------------------- */
/* What a row shows and what it is called                                      */
/* -------------------------------------------------------------------------- */

describe("name, qualifier and label are three different jobs", () => {
  test("an art row keeps its art key in the VISIBLE half", () => {
    /*
     * THE BUG THIS PINS SURVIVED A REVIEW ROUND. `qualifier` was derived as
     * `label` minus `name`, which looks equivalent and is not: an art row's
     * label is "Head Jab (pitch 2) · MST131", so the subtraction hid the art
     * key along with the pitch. In a view with no pictures in it — rows, names
     * — every art row of one card then read identically: same name, same
     * stones, same type line, same stats, differing only in where they pointed.
     * The picture separates them in the grid, and the KEY has to separate them
     * without one.
     */
    const arts = searchCards(index, "set:lgs unique:art", 20000).results;
    const withKey = arts.filter((row) => row.name.includes(" · "));
    expect(withKey.length).toBeGreaterThan(0);

    for (const row of withKey.slice(0, 50)) {
      /* The key is visible… */
      expect(row.name).toMatch(/ · [A-Za-z0-9._-]+$/);
      /* …and the hidden half is only ever the pitch. */
      expect(row.qualifier).not.toContain("·");
      expect(
        row.qualifier === "" ||
          /^ \((?:no pitch|pitch \d)\)$/.test(row.qualifier),
      ).toBe(true);
    }
  });

  test("visible plus hidden names the card as fully as the label does", () => {
    /*
     * The property the split has to preserve: whatever a surface chooses to
     * show, the anchor is still NAMED by something that identifies the card.
     * 900 names in this corpus belong to more than one card, so a bare name on
     * its own is a WCAG 2.4.4 failure waiting for a second version to exist.
     */
    for (const row of searchCards(index, "head jab unique:cards", 200)
      .results) {
      expect(`${row.name}${row.qualifier}`).toBe(row.label);
    }
  });

  test("a row standing for a whole name has nothing to qualify", () => {
    /* `unique:names` collapses the pitch versions, so the row IS the card and
       the bare name is already unambiguous. A qualifier there would be naming a
       version the row does not stand for. */
    const collapsed = searchCards(index, "head jab", 200).results;
    expect(collapsed.length).toBeGreaterThan(0);
    for (const row of collapsed) {
      if (row.matchedVersions.length === row.totalVersions) {
        expect(row.qualifier).toBe("");
      }
    }
  });
});
