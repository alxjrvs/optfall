import { describe, expect, test } from "bun:test";

import { FORMATS, type FormatId, type RuleCitation } from "./index";
import {
  activeFormats,
  FORMAT_RULES,
  formatCitations,
  getFormatRules,
  isVerified,
  requireVerified,
  SOURCE_DOCUMENTS,
  sourcedEffectiveFrom,
  UnverifiedConstraintError,
  unverifiedConstraints,
  verifiedValue,
  type FormatRules,
  type RarityRestriction,
  type Sourced,
} from "./formats";

const everyFormat = (): readonly FormatRules[] =>
  FORMATS.map((format) => getFormatRules(format));

/** Every sourced constraint on a format, so a structural rule can sweep them all. */
const everySourced = (rules: FormatRules): readonly Sourced<unknown>[] => {
  const all: Sourced<unknown>[] = [
    rules.cardPoolMaximum,
    rules.deckSize.minimum,
    rules.copyLimit.perUniqueCard,
    rules.hero.required,
    rules.hero.count,
    rules.hero.subtype,
    rules.hero.excludedSubtypes,
    rules.hero.livingLegendHeroesLegal,
    rules.equipment.startOfGameSlots,
    rules.equipment.startOfGameSlotCounts,
    ...rules.rarity,
  ];
  if (rules.deckSize.maximum.kind === "stated")
    all.push(rules.deckSize.maximum.cards);
  if (rules.hero.rarity !== null) all.push(rules.hero.rarity);
  if (rules.equipment.registrationLimit !== null)
    all.push(rules.equipment.registrationLimit);
  if (rules.equipment.rarity !== null) all.push(rules.equipment.rarity);
  if (rules.status.kind === "retired") all.push(rules.status.since);
  return all;
};

/** Every rarity restriction on a format, wherever it is attached. */
const everyRarity = (
  rules: FormatRules,
): readonly Sourced<RarityRestriction>[] => [
  ...rules.rarity,
  ...(rules.hero.rarity === null ? [] : [rules.hero.rarity]),
  ...(rules.equipment.rarity === null ? [] : [rules.equipment.rarity]),
];

const citationIsUsable = (citation: RuleCitation): void => {
  expect(citation.ruleId.length).toBeGreaterThan(0);
  expect(citation.document.length).toBeGreaterThan(0);
  expect(citation.version.length).toBeGreaterThan(0);
  expect(citation.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  // A citation without a quotation is an assertion wearing a citation's
  // clothes, which is the exact thing this package refuses to ship.
  expect(citation.quote ?? "").not.toBe("");
  expect(citation.sourceUrl ?? "").toMatch(/^https:\/\//);
};

/**
 * The whole point of this package is that a number can be traced to a document
 * somebody actually fetched. These tests are therefore mostly about provenance
 * rather than about arithmetic: an incorrect deck size is a bug, but an
 * *uncited* deck size is the failure mode that produced the incumbent Optfall
 * exists to correct.
 */
describe("coverage", () => {
  test("every sanctioned format has a rule set", () => {
    for (const format of FORMATS) {
      expect(FORMAT_RULES[format].format).toBe(format);
    }
    expect(Object.keys(FORMAT_RULES)).toHaveLength(FORMATS.length);
  });

  test("getFormatRules rejects a format id that is not one of the six", () => {
    expect(() => getFormatRules("sealed-deck" as FormatId)).toThrow(TypeError);
  });

  test("Commoner is retired and every other format is active", () => {
    const commoner = getFormatRules("commoner");
    expect(commoner.status.kind).toBe("retired");
    if (commoner.status.kind === "retired") {
      // Retirement is a fact with a source like any other.
      expect(
        requireVerified(commoner.status.since, "commoner.status.since"),
      ).toBe("2026-01-01");
      expect(commoner.status.replacedBy).toBe("silver-age");
    }

    expect(activeFormats().map((rules) => rules.format)).toEqual([
      "classic-constructed",
      "blitz",
      "living-legend",
      "silver-age",
      "ultimate-pit-fight",
    ]);
  });

  test("a retired format keeps its rules, because time travel needs them", () => {
    // Deleting Commoner would make every archived Commoner decklist
    // uninterpretable — the same mistake as publishing only the current banned
    // list.
    const commoner = getFormatRules("commoner");
    expect(verifiedValue(commoner.cardPoolMaximum)).toBe(52);
    expect(verifiedValue(commoner.deckSize.minimum)).toBe(40);
  });
});

describe("the honesty contract", () => {
  test("every verified constraint carries at least one usable citation", () => {
    for (const rules of everyFormat()) {
      for (const citation of formatCitations(rules)) citationIsUsable(citation);
    }
  });

  test("every citation prefix resolves to a document that was retrieved", () => {
    const known = new Set(SOURCE_DOCUMENTS.map((document) => document.id));
    for (const rules of everyFormat()) {
      for (const citation of formatCitations(rules)) {
        const prefix = citation.ruleId.split(":")[0] ?? "";
        expect(known.has(prefix)).toBe(true);
      }
    }
  });

  test("every source document records how its version was determined", () => {
    for (const document of SOURCE_DOCUMENTS) {
      expect(document.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect([
        "printed-in-document",
        "http-last-modified",
        "page-last-updated-line",
      ]).toContain(document.versionProvenance);
      // Anything whose version is not printed on the document itself must say
      // where the date came from, or the date is just a number in a file.
      if (document.versionProvenance !== "printed-in-document") {
        expect(document.note ?? "").not.toBe("");
      }
    }
  });

  test("every unverified constraint says why, and never claims a citation it lacks", () => {
    for (const rules of everyFormat()) {
      const sourcedValues: Sourced<unknown>[] = [
        rules.cardPoolMaximum,
        rules.deckSize.minimum,
        rules.copyLimit.perUniqueCard,
        rules.hero.subtype,
        rules.hero.livingLegendHeroesLegal,
      ];
      for (const sourced of sourcedValues) {
        if (isVerified(sourced)) {
          expect(sourced.citations.length).toBeGreaterThan(0);
        } else {
          expect(sourced.reason.length).toBeGreaterThan(20);
        }
      }
    }
  });

  test("verifiedValue refuses to hand back an unverified reading", () => {
    const upf = getFormatRules("ultimate-pit-fight");
    // The Tournament Rules and Policy number is present on the record...
    expect(upf.copyLimit.perUniqueCard.value).toBe(2);
    // ...and the ordinary accessor still will not return it.
    expect(verifiedValue(upf.copyLimit.perUniqueCard)).toBeUndefined();
  });

  test("requireVerified throws rather than guessing, and names the constraint", () => {
    const upf = getFormatRules("ultimate-pit-fight");
    const path = "ultimate-pit-fight.copyLimit.perUniqueCard";
    expect(() => requireVerified(upf.copyLimit.perUniqueCard, path)).toThrow(
      UnverifiedConstraintError,
    );

    try {
      requireVerified(upf.copyLimit.perUniqueCard, path);
      throw new Error("expected requireVerified to throw");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(UnverifiedConstraintError);
      const thrown = error as UnverifiedConstraintError;
      expect(thrown.constraint).toBe(path);
      expect(thrown.message).toContain(path);
      expect(thrown.reason.length).toBeGreaterThan(20);
    }
  });

  test("requireVerified returns the value when the constraint is verified", () => {
    const cc = getFormatRules("classic-constructed");
    expect(
      requireVerified(
        cc.deckSize.minimum,
        "classic-constructed.deckSize.minimum",
      ),
    ).toBe(60);
  });

  test("unverifiedConstraints is the visible inventory of what is unconfirmed", () => {
    // Locked deliberately. This list growing is a regression in what Optfall
    // can assert, and it should show up in a diff rather than in a wrong
    // verdict.
    expect(
      unverifiedConstraints(getFormatRules("classic-constructed")),
    ).toEqual([]);
    expect(unverifiedConstraints(getFormatRules("living-legend"))).toEqual([]);

    // Blitz is fully confirmed: LSS's own format page answers the living
    // legend hero question outright, and marking it open left `requireVerified`
    // throwing on a rule nobody could then evaluate.
    expect(unverifiedConstraints(getFormatRules("blitz"))).toEqual([]);

    // Silver Age and Commoner require a young hero and are then silent about
    // any further subtype exclusion. An empty list is the best reading of that
    // silence, and a reading is not a confirmation.
    expect(unverifiedConstraints(getFormatRules("silver-age"))).toEqual([
      "silver-age.hero.excludedSubtypes",
      "silver-age.hero.livingLegendHeroesLegal",
    ]);
    expect(unverifiedConstraints(getFormatRules("commoner"))).toEqual([
      "commoner.hero.excludedSubtypes",
      "commoner.hero.livingLegendHeroesLegal",
    ]);

    // Ultimate Pit Fight's two sources agree on the card-pool maximum and the
    // deck size and disagree only about the hero and the copy limit, so only
    // the latter are unevaluable.
    expect(unverifiedConstraints(getFormatRules("ultimate-pit-fight"))).toEqual(
      [
        "ultimate-pit-fight.copyLimit.perUniqueCard",
        "ultimate-pit-fight.hero.subtype",
        "ultimate-pit-fight.hero.excludedSubtypes",
        "ultimate-pit-fight.hero.livingLegendHeroesLegal",
      ],
    );
  });

  test("a recorded conflict names the constraints it poisons", () => {
    const upf = getFormatRules("ultimate-pit-fight");
    expect(upf.conflicts).toHaveLength(1);
    const conflict = upf.conflicts[0];
    expect(conflict).toBeDefined();
    if (conflict === undefined) return;

    // Both sides of the disagreement are cited, not just the one we followed.
    const documents = new Set(
      conflict.citations.map((citation) => citation.document),
    );
    expect(documents.size).toBeGreaterThan(1);

    const unconfirmed = new Set(unverifiedConstraints(upf));
    for (const constraint of conflict.constraints) {
      expect(unconfirmed.has(constraint)).toBe(true);
    }
  });
});

describe("deck size", () => {
  test("Classic Constructed: minimum 60, no stated maximum", () => {
    const cc = getFormatRules("classic-constructed");
    expect(requireVerified(cc.deckSize.minimum, "cc.deckSize.minimum")).toBe(
      60,
    );
    expect(cc.deckSize.exact).toBe(false);
    // trp:7.1 states a minimum only. The deck is capped by the card-pool less
    // the arena-cards registered, and that ceiling is not a published number.
    expect(cc.deckSize.maximum.kind).toBe("bounded-by-card-pool");
  });

  test("Living Legend inherits Classic Constructed's deck size", () => {
    const cc = getFormatRules("classic-constructed");
    const ll = getFormatRules("living-legend");
    expect(requireVerified(ll.deckSize.minimum, "ll.deckSize.minimum")).toBe(
      requireVerified(cc.deckSize.minimum, "cc.deckSize.minimum"),
    );
    expect(ll.deckSize.maximum.kind).toBe("bounded-by-card-pool");

    // ...and it cites the inheritance as well as the inherited rule, because a
    // citation pointing at a section that does not contain the number is not a
    // citation.
    const ruleIds = formatCitations(ll).map((citation) => citation.ruleId);
    expect(ruleIds).toContain("trp:7.2");
    expect(ruleIds).toContain("trp:7.1");
  });

  test("the exactly-40 formats state both bounds and agree with each other", () => {
    // Ultimate Pit Fight belongs here: trp:9.3 and LSS's own format page state
    // the same 40 independently, so the number is corroborated rather than
    // contested. It was previously excluded on the strength of a conflict that
    // did not cover it.
    for (const format of [
      "blitz",
      "silver-age",
      "commoner",
      "ultimate-pit-fight",
    ] as const) {
      const rules = getFormatRules(format);
      expect(rules.deckSize.exact).toBe(true);
      expect(rules.deckSize.maximum.kind).toBe("stated");
      if (rules.deckSize.maximum.kind !== "stated") continue;
      const minimum = requireVerified(
        rules.deckSize.minimum,
        `${format}.deckSize.minimum`,
      );
      const maximum = requireVerified(
        rules.deckSize.maximum.cards,
        `${format}.deckSize.maximum`,
      );
      expect(minimum).toBe(40);
      expect(maximum).toBe(40);
    }
  });

  test("no format's deck minimum can exceed its card-pool maximum", () => {
    for (const rules of everyFormat()) {
      const pool = rules.cardPoolMaximum.value;
      const minimum = rules.deckSize.minimum.value;
      expect(pool).not.toBeNull();
      expect(minimum).not.toBeNull();
      if (pool === null || minimum === null) continue;
      expect(minimum).toBeLessThanOrEqual(pool);
    }
  });
});

describe("card-pool size", () => {
  test("the published card-pool maxima", () => {
    expect(
      verifiedValue(getFormatRules("classic-constructed").cardPoolMaximum),
    ).toBe(80);
    expect(verifiedValue(getFormatRules("living-legend").cardPoolMaximum)).toBe(
      80,
    );
    expect(verifiedValue(getFormatRules("blitz").cardPoolMaximum)).toBe(52);
    // Silver Age is 55, not 52. It is the number most likely to be assumed
    // wrong by analogy with Blitz, so it is pinned here on its own.
    expect(verifiedValue(getFormatRules("silver-age").cardPoolMaximum)).toBe(
      55,
    );
    expect(verifiedValue(getFormatRules("commoner").cardPoolMaximum)).toBe(52);
    expect(
      verifiedValue(getFormatRules("ultimate-pit-fight").cardPoolMaximum),
    ).toBe(52);
  });

  test("Ultimate Pit Fight's two sources corroborate the pool and the deck, and are both cited", () => {
    const upf = getFormatRules("ultimate-pit-fight");
    const documents = new Set(
      upf.cardPoolMaximum.citations.map((citation) => citation.document),
    );
    expect(documents.size).toBe(2);

    // The corroborating sentence is the format page's own start-of-game
    // procedure. Quoting only the part of that page that disagreed is what
    // turned a narrow conflict into three unevaluable constraints.
    const quotes = upf.cardPoolMaximum.citations
      .map((citation) => citation.quote ?? "")
      .join(" ");
    expect(quotes).toContain("52 card-pool");
    expect(quotes).toContain("52 arena-cards and deck-cards");
  });

  test("the card-pool maximum excludes the hero in every format", () => {
    for (const rules of everyFormat()) {
      expect(rules.hero.count.value).toBe(1);
      expect(rules.hero.required.value).toBe(true);
    }
  });
});

describe("copy limits", () => {
  test("the published per-unique-card limits", () => {
    expect(
      verifiedValue(
        getFormatRules("classic-constructed").copyLimit.perUniqueCard,
      ),
    ).toBe(3);
    expect(
      verifiedValue(getFormatRules("living-legend").copyLimit.perUniqueCard),
    ).toBe(3);
    expect(verifiedValue(getFormatRules("blitz").copyLimit.perUniqueCard)).toBe(
      1,
    );
    expect(
      verifiedValue(getFormatRules("silver-age").copyLimit.perUniqueCard),
    ).toBe(2);
    expect(
      verifiedValue(getFormatRules("commoner").copyLimit.perUniqueCard),
    ).toBe(2);
  });

  test("every format records the overrides its single number cannot express", () => {
    // A validator that applies `perUniqueCard` alone passes a deck holding
    // three copies of a restricted card, so the overrides are part of the rule.
    for (const rules of everyFormat()) {
      expect(rules.copyLimit.overrides.length).toBeGreaterThan(0);
      for (const override of rules.copyLimit.overrides) {
        expect(override.maximum).toBe(1);
        expect(override.citations.length).toBeGreaterThan(0);
      }
    }
  });

  test("the four Tournament Rules and Policy constructed formats carry the restricted-card override", () => {
    for (const format of [
      "classic-constructed",
      "living-legend",
      "blitz",
      "silver-age",
    ] as const) {
      const kinds = getFormatRules(format).copyLimit.overrides.map(
        (override) => override.kind,
      );
      expect(kinds).toContain("restricted-card");
    }
    // Commoner never appeared in that document, so it cannot borrow its
    // preamble. Its only sourced override is the meta-static one printed on the
    // Commoner page itself.
    expect(
      getFormatRules("commoner").copyLimit.overrides.map((o) => o.kind),
    ).toEqual(["meta-static-ability"]);
  });

  test("Blitz's restricted-card override records that the list it governs was abolished", () => {
    // LSS: "The Blitz Banned and Restricted list has also been abolished."
    // Keeping the override without that note would have the package asserting a
    // rule against a list that no longer exists.
    const override = getFormatRules("blitz").copyLimit.overrides.find(
      (candidate) => candidate.kind === "restricted-card",
    );
    expect(override).toBeDefined();
    expect(override?.note ?? "").toContain("abolished");
    const quotes = (override?.citations ?? [])
      .map((citation) => citation.quote ?? "")
      .join(" ");
    expect(quotes).toContain(
      "Banned and Restricted list has also been abolished",
    );
  });
});

describe("heroes", () => {
  test("Classic Constructed excludes young and pit-fighter heroes", () => {
    const cc = getFormatRules("classic-constructed");
    expect(requireVerified(cc.hero.subtype, "cc.hero.subtype")).toBe(
      "young-excluded",
    );
    expect(
      requireVerified(cc.hero.excludedSubtypes, "cc.hero.excludedSubtypes"),
    ).toEqual(["Young", "Pit-Fighter"]);
    expect(requireVerified(cc.hero.livingLegendHeroesLegal, "cc.hero.ll")).toBe(
      false,
    );
  });

  test("Living Legend differs from Classic Constructed in exactly one hero rule", () => {
    const cc = getFormatRules("classic-constructed");
    const ll = getFormatRules("living-legend");
    expect(requireVerified(ll.hero.subtype, "ll.hero.subtype")).toBe(
      requireVerified(cc.hero.subtype, "cc.hero.subtype"),
    );
    expect(
      requireVerified(ll.hero.excludedSubtypes, "ll.hero.excludedSubtypes"),
    ).toEqual(
      requireVerified(cc.hero.excludedSubtypes, "cc.hero.excludedSubtypes"),
    );
    expect(requireVerified(ll.hero.livingLegendHeroesLegal, "ll.hero.ll")).toBe(
      true,
    );
  });

  test("the young-hero formats require a young hero", () => {
    for (const format of ["blitz", "silver-age", "commoner"] as const) {
      expect(
        requireVerified(
          getFormatRules(format).hero.subtype,
          `${format}.hero.subtype`,
        ),
      ).toBe("young-required");
    }
  });

  test("living legend hero eligibility is unresolved only where no document answers it", () => {
    // Silver Age, Commoner and Ultimate Pit Fight: nothing retrieved says
    // either way, and the Card Legality Policy that governs it has not been
    // read.
    for (const format of [
      "silver-age",
      "commoner",
      "ultimate-pit-fight",
    ] as const) {
      const sourced = getFormatRules(format).hero.livingLegendHeroesLegal;
      expect(isVerified(sourced)).toBe(false);
      expect(verifiedValue(sourced)).toBeUndefined();
      expect(sourced.value).toBeNull();
    }
  });

  test("Blitz living legend heroes are legal, and the rule carries the date it changed", () => {
    // LSS's Blitz page: "any heroes that attained Living Legend status in Blitz
    // have become legal for official tournament play again", as of 2026-01-01.
    // Marking this open was not the cautious choice — `requireVerified` threw,
    // so nothing could evaluate it, and a consumer falling back to the Classic
    // Constructed threshold would reject every hero on LSS's own archive table.
    const blitz = getFormatRules("blitz");
    const sourced = blitz.hero.livingLegendHeroesLegal;
    expect(requireVerified(sourced, "blitz.hero.livingLegendHeroesLegal")).toBe(
      true,
    );

    // It is a *dated* fact. Before 2026-01-01 the answer was the opposite, and
    // this package's whole wedge is answering "was it legal on the day of that
    // tournament".
    expect(sourcedEffectiveFrom(sourced)).toBe("2026-01-01");
    for (const citation of sourced.citations) {
      expect(citation.effectiveFrom).toBe("2026-01-01");
    }
  });

  test("every dated constraint's citations agree with the date recorded on it", () => {
    // A value dated 2026-01-01 whose quotations are dated otherwise is a claim
    // with no evidence for the part that matters most.
    for (const rules of everyFormat()) {
      for (const sourced of everySourced(rules)) {
        const effectiveFrom = sourcedEffectiveFrom(sourced);
        if (effectiveFrom === undefined) continue;
        expect(sourced.citations.length).toBeGreaterThan(0);
        for (const citation of sourced.citations) {
          expect(citation.effectiveFrom).toBe(effectiveFrom);
        }
      }
    }
  });
});

describe("rarity", () => {
  test("only Commoner and Silver Age restrict rarity at all", () => {
    const restricted = everyFormat()
      .filter(
        (rules) =>
          rules.rarity.length > 0 ||
          rules.hero.rarity !== null ||
          rules.equipment.rarity !== null,
      )
      .map((rules) => rules.format);
    expect(restricted.toSorted()).toEqual(["commoner", "silver-age"]);
  });

  test("Commoner is the split case: deck common-only, arena and hero common or rare", () => {
    const commoner = getFormatRules("commoner");

    const deckRarity = commoner.rarity[0];
    expect(deckRarity).toBeDefined();
    if (deckRarity === undefined) return;
    const deck = requireVerified(deckRarity, "commoner.rarity[0]");
    expect(deck.scope).toBe("deck-cards");
    expect(deck.allowed).toEqual(["basic", "common"]);
    expect(deck.allowed).not.toContain("rare");

    expect(commoner.equipment.rarity).not.toBeNull();
    if (commoner.equipment.rarity !== null) {
      const arena = requireVerified(
        commoner.equipment.rarity,
        "commoner.equipment.rarity",
      );
      expect(arena.scope).toBe("arena-cards");
      expect(arena.allowed).toContain("rare");
    }

    expect(commoner.hero.rarity).not.toBeNull();
    if (commoner.hero.rarity !== null) {
      const hero = requireVerified(
        commoner.hero.rarity,
        "commoner.hero.rarity",
      );
      expect(hero.scope).toBe("hero");
      expect(hero.allowed).toContain("rare");
    }
  });

  test("Silver Age restricts the whole card-pool uniformly, unlike Commoner", () => {
    const silverAge = getFormatRules("silver-age");
    const restriction = silverAge.rarity[0];
    expect(restriction).toBeDefined();
    if (restriction === undefined) return;
    const rarity = requireVerified(restriction, "silver-age.rarity[0]");
    expect(rarity.scope).toBe("card-pool");
    expect(rarity.allowed).toEqual(["basic", "common", "rare"]);
    expect(silverAge.equipment.rarity).toBeNull();
  });

  test("every rarity a restriction allows is named somewhere in its own citations", () => {
    /*
     * A citation that points at a section not mentioning the value is not a
     * citation, and this is the one place the rule can be enforced mechanically
     * rather than by review. It caught a real defect: Commoner's arena-card
     * restriction allows `basic` — correctly, since the page folds basic rarity
     * into common — while citing only the two sentences that say "common or
     * rare". The sentence that actually establishes it was two fields away and
     * uncited.
     */
    for (const rules of everyFormat()) {
      for (const restriction of everyRarity(rules)) {
        const quoted = restriction.citations
          .map((citation) => citation.quote ?? "")
          .join(" ")
          .toLowerCase();
        for (const rarity of restriction.value?.allowed ?? []) {
          expect(quoted).toContain(rarity);
        }
        // `everPrinted` is a claim in its own right, and the documents that
        // support it all use the same phrase.
        if (restriction.value?.everPrinted === true) {
          expect(quoted).toContain("ever been");
        }
      }
    }
  });

  test("every rarity restriction is decided by ever-printed, never by the copy in hand", () => {
    // Both documents say "has ever been officially printed with". Reading this
    // as the printing in hand would reject legal cards — the incumbent's exact
    // failure.
    for (const rules of everyFormat()) {
      const restrictions = [
        ...rules.rarity,
        ...(rules.hero.rarity === null ? [] : [rules.hero.rarity]),
        ...(rules.equipment.rarity === null ? [] : [rules.equipment.rarity]),
      ];
      for (const restriction of restrictions) {
        expect(restriction.value?.everPrinted).toBe(true);
      }
    }
  });
});

describe("equipment and weapons", () => {
  test("no format caps registered weapons or equipment separately", () => {
    // A real finding, not an omission: the Tournament Rules and Policy states
    // one combined card-pool maximum and never an arena-card count.
    for (const rules of everyFormat()) {
      expect(rules.equipment.registrationLimit).toBeNull();
    }
  });

  test("the start-of-game allowance is a Comprehensive Rules rule, identical in every format", () => {
    for (const rules of everyFormat()) {
      const slots = requireVerified(
        rules.equipment.startOfGameSlots,
        `${rules.format}.equipment.startOfGameSlots`,
      );
      expect(slots.toSorted()).toEqual([
        "arms",
        "chest",
        "head",
        "legs",
        "weapon",
      ]);

      const counts = requireVerified(
        rules.equipment.startOfGameSlotCounts,
        `${rules.format}.equipment.startOfGameSlotCounts`,
      );
      // cr:3.0.2 — one of each equipment zone, and two weapon zones.
      expect(counts).toEqual({
        arms: 1,
        chest: 1,
        head: 1,
        legs: 1,
        weapon: 2,
      });

      const ruleIds = rules.equipment.startOfGameSlotCounts.citations.map(
        (citation) => citation.ruleId,
      );
      expect(ruleIds).toContain("cr:3.0.2");
      expect(ruleIds).toContain("cr:4.1.4a");
      // A hero's meta-static ability can change the zone count, so the rule
      // that says so travels with the number.
      expect(ruleIds).toContain("cr:4.1.2a");
    }
  });
});
