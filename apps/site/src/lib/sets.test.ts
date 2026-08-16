/**
 * The sets corpus and its decode tables, against the real card corpus.
 *
 * The property that matters is the JOIN: a set index that does not cover the
 * sets the cards reference leaves printings resolving to nothing, and the page
 * silently shows a code where a name should be.
 */
import { describe, expect, test } from "bun:test";

import { CORPUS as CARDS } from "./cards";
import {
  SETS,
  SETS_BY_RELEASE,
  editionName,
  foilingName,
  hrefForSet,
  rarityName,
  raritySlug,
  setFor,
  setName,
} from "./sets";

/**
 * THE CREDIT LINE'S "CLOSED SET" CLAIM, MADE ENFORCEABLE.
 *
 * `CardEntry.css` colours the rarity bubble with one rule per rarity, and its
 * comment defends the enumeration by saying the set is closed — `sets.json`
 * decodes exactly these, and every slug comes from that table via `raritySlug`.
 *
 * That was asserted in prose and checked by nothing. A rarity added upstream
 * fails SILENTLY: `rarityName` falls through to the raw code, the bubble
 * renders, no build step complains, and the bubble is then a plain grey disc on
 * every page it appears on because no rule names its slug.
 *
 * HALF OF THIS BLOCK RETIRED WITH THE PICKER, and the reason is worth keeping
 * rather than the test. A second enumeration used to REVEAL one bubble out of a
 * hidden list — `:root[data-printing-rarity="x"] .of-card__rarity[…]`, ten
 * paired selectors — because an island could swap the picture without the page
 * changing, and this file asserted the pairing so a copy-paste could not wire
 * one rarity's stamp to another's bubble. The printings table is the control
 * now: a page shows one printing and renders one bubble, so there is nothing to
 * reveal and no pairing to get wrong. What survives is the colour, which is the
 * half that can still fail quietly.
 *
 * READ OUT OF THE STYLESHEET RATHER THAN RESTATED HERE, because a second
 * hand-written list of ten slugs is the thing that drifts.
 */
describe("every rarity the corpus decodes can be shown", () => {
  /*
   * RESOLVED AGAINST THIS FILE, NOT THE WORKING DIRECTORY. A bare
   * `apps/site/ssg/…` path only resolves when `bun test` is invoked from the
   * repo root; run from `apps/site` it is an ENOENT rather than a failed
   * assertion, which is a test that reports the wrong thing when it breaks.
   * `symbol-assets.test.ts` reaches for its fixtures the same way.
   */
  const STYLESHEET = new URL(
    "../../ssg/components/CardEntry.css",
    import.meta.url,
  );

  /*
   * WHITESPACE-NORMALISED BEFORE MATCHING, because the formatter decides where
   * these selectors wrap and the test must not. `legendary` is long enough that
   * biome breaks it across two lines while its nine siblings stay on one, so a
   * literal substring match would pass for nine rarities and fail for the tenth
   * on nothing but line length.
   */
  const sheet = async (): Promise<string> =>
    (await Bun.file(STYLESHEET).text()).replace(/\s+/g, " ");

  test("has a colour, so no bubble falls back to grey unnoticed", async () => {
    const css = await sheet();

    /*
     * THE ONE REMAINING SILENT FAILURE. `--rarity` defaults to the muted ink of
     * the line, so an unnamed rarity is not a missing bubble but a grey one —
     * legible, plausible, and wrong about a fact this page exists to state.
     */

    const uncoloured = Object.keys(SETS.decode.rarity)
      .map((code) => raritySlug(code))
      .filter(
        (slug) => !css.includes(`--rarity: var(--of-color-rarity-${slug})`),
      );

    expect(uncoloured).toEqual([]);
  });
});

describe("the decode tables", () => {
  test("turn a rarity code into the slug its CSS is written against", () => {
    /* The one two-word name in the table, and therefore the only case where
       "first word only" decides anything. */
    expect(raritySlug("S")).toBe("super");
    expect(raritySlug("M")).toBe("majestic");
    /* Falls through to the raw code, lower-cased, rather than throwing — the
       same fallback `rarityName` makes, reached the same way. */
    expect(raritySlug("Z")).toBe("z");
  });

  test("turn upstream's storage letters into words", () => {
    expect(rarityName("R")).toBe("Rare");
    expect(rarityName("C")).toBe("Common");
    expect(rarityName("M")).toBe("Majestic");
    expect(editionName("U")).toBe("Unlimited");
    expect(foilingName("R")).toBe("Rainbow Foil");
    expect(setName("MST")).toBe("Part the Mistveil");
  });

  test("an unknown code keeps its code rather than blanking", () => {
    // A visible gap beats a silent one: if upstream adds a rarity Optfall has
    // not re-synced, the page should read `Z`, not an empty cell.
    expect(rarityName("Z")).toBe("Z");
    expect(editionName("Q")).toBe("Q");
    expect(setName("ZZZ")).toBe("ZZZ");
  });
});

describe("over the real card corpus", () => {
  const setsUsed = new Set(
    CARDS.cards.flatMap((card) =>
      card.printings.map((printing) => printing.set_id),
    ),
  );

  test("every set a printing references resolves to a named set", () => {
    // THE LOAD-BEARING JOIN. An unresolved set id renders as a bare code with a
    // dead link, and it would do so silently.
    const unresolved = [...setsUsed].filter((id) => setFor(id) === undefined);
    expect(unresolved).toEqual([]);
  });

  test("every rarity, edition and foiling a printing carries decodes", () => {
    const printings = CARDS.cards.flatMap((card) => card.printings);
    const undecoded = new Set<string>();

    for (const printing of printings) {
      if (
        printing.rarity !== "" &&
        rarityName(printing.rarity) === printing.rarity
      ) {
        undecoded.add(`rarity:${printing.rarity}`);
      }
      if (
        printing.edition !== "" &&
        editionName(printing.edition) === printing.edition
      ) {
        undecoded.add(`edition:${printing.edition}`);
      }
      if (
        printing.foiling !== "" &&
        foilingName(printing.foiling) === printing.foiling
      ) {
        undecoded.add(`foiling:${printing.foiling}`);
      }
    }

    expect([...undecoded]).toEqual([]);
  });
});

describe("release order", () => {
  test("is newest first", () => {
    const dated = SETS_BY_RELEASE.filter((set) => set.released !== null);
    for (let i = 1; i < dated.length; i += 1) {
      expect(dated[i - 1]!.released! >= dated[i]!.released!).toBe(true);
    }
  });

  test("puts undated sets last rather than first", () => {
    // An empty string sorts before every date, which would put an undated set
    // at the top of a newest-first list and assert it is the newest thing
    // published. It is not; it is a set with no published date.
    const firstUndated = SETS_BY_RELEASE.findIndex(
      (set) => set.released === null,
    );
    const lastDated = SETS_BY_RELEASE.map(
      (set) => set.released !== null,
    ).lastIndexOf(true);
    if (firstUndated !== -1) expect(firstUndated).toBeGreaterThan(lastDated);
  });

  test("is total, so two builds cannot disagree", () => {
    const ids = SETS_BY_RELEASE.map((set) => set.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(SETS.sets.length);
  });
});

describe("addressing", () => {
  test("a set URL is its lowercased code", () => {
    expect(hrefForSet("MST")).toBe("/sets/mst");
    expect(hrefForSet("1HP")).toBe("/sets/1hp");
  });
});
