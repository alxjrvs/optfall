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
  setFor,
  setName,
} from "./sets";

describe("the decode tables", () => {
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
    CARDS.cards.flatMap((card) => card.printings.map((printing) => printing.set_id)),
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
      if (printing.rarity !== "" && rarityName(printing.rarity) === printing.rarity) {
        undecoded.add(`rarity:${printing.rarity}`);
      }
      if (printing.edition !== "" && editionName(printing.edition) === printing.edition) {
        undecoded.add(`edition:${printing.edition}`);
      }
      if (printing.foiling !== "" && foilingName(printing.foiling) === printing.foiling) {
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
    const firstUndated = SETS_BY_RELEASE.findIndex((set) => set.released === null);
    const lastDated = SETS_BY_RELEASE.map((set) => set.released !== null).lastIndexOf(true);
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
