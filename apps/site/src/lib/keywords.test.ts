/**
 * The keyword↔rules join, asserted against both real documents.
 *
 * The unit cases are cheap. The corpus-wide ones are the point: a join that is
 * right on six hand-written examples and 40% wrong on the real corpus would put
 * a citation to the wrong paragraph beside a card, which is worse than no
 * citation at all — a reference work that cites incorrectly is not a weaker
 * reference work, it is an unusable one.
 */
import { describe, expect, test } from "bun:test";

import corpusJson from "../../../../data/rules/cr-2.14.0.json";

import { CORPUS as CARDS } from "./cards";
import {
  baseKeyword,
  buildKeywordVocabulary,
  keywordCoverage,
  ruleForKeyword,
  rulesForCard,
} from "./keywords";
import type { RulesCorpus } from "./search";

const rules = corpusJson as unknown as RulesCorpus;
const vocabulary = buildKeywordVocabulary(rules);

const everyCardKeyword = CARDS.cards.flatMap((card) =>
  card.card_keywords.concat(card.ability_and_effect_keywords),
);

describe("the vocabulary the rules publish", () => {
  test("is extracted from chapter 8 and nowhere else", () => {
    expect(vocabulary.size).toBe(101);
    // Spot-check the definitions rather than the count alone: a regex that
    // matched the wrong thing would still produce a plausible count.
    expect(vocabulary.get("dominate")?.number).toBe("8.3.4");
    expect(vocabulary.get("go again")?.number).toBe("8.3.5");
    expect(vocabulary.get("blade break")?.number).toBe("8.3.3");
  });

  test("takes the DEFINING rule, not a later subrule that mentions it", () => {
    // `8.3.4a` and `8.3.4b` elaborate Dominate and repeat its name. Citing one
    // of those would send a reader to a footnote instead of the definition.
    expect(vocabulary.get("dominate")?.number).toBe("8.3.4");
    expect(vocabulary.get("dominate")?.number).not.toContain("a");
  });

  test("matches multi-word keywords whole", () => {
    // A greedy or single-word extractor yields "Blade" here.
    expect(vocabulary.has("blade break")).toBe(true);
    expect(vocabulary.has("blade")).toBe(false);
  });
});

describe("baseKeyword", () => {
  test("strips an operand, which is a parameter and not a keyword", () => {
    expect(baseKeyword("Ward 10")).toBe("ward");
    expect(baseKeyword("Arcane Barrier 2")).toBe("arcane barrier");
    expect(baseKeyword("Opt X")).toBe("opt");
    expect(baseKeyword("Amp 1")).toBe("amp");
  });

  test("leaves a name that merely ends in a word alone", () => {
    expect(baseKeyword("Go again")).toBe("go again");
    expect(baseKeyword("Blade Break")).toBe("blade break");
  });
});

describe("resolving a card keyword", () => {
  test("direct hits cite the keyword's own rule", () => {
    expect(ruleForKeyword(vocabulary, "Dominate")).toEqual({
      keyword: "dominate",
      ruleId: "cr:8.3.4",
      number: "8.3.4",
      via: "direct",
    });
    // Operand stripped, same rule.
    expect(ruleForKeyword(vocabulary, "Ward 10")?.via).toBe("direct");
  });

  test("a parameterised family resolves to the head term the rules define", () => {
    // The rules define `Specialization` once; cards instantiate it per hero.
    // Resolving Briar Specialization to it is reading the document correctly,
    // and `via` says which kind of claim is being made.
    const briar = ruleForKeyword(vocabulary, "Briar Specialization");
    expect(briar?.via).toBe("family");
    expect(briar?.ruleId).toBe(ruleForKeyword(vocabulary, "Specialization")?.ruleId);

    for (const keyword of ["Ice Fusion", "Earth Bond", "Essence of Earth", "Channel Lightning"]) {
      expect(ruleForKeyword(vocabulary, keyword)?.via).toBe("family");
    }
  });

  test("an unknown keyword is null rather than a guess", () => {
    // THE LOAD-BEARING NEGATIVE. A join that reaches for the nearest match
    // would cite a paragraph that does not govern the card, which is the
    // confidently-wrong answer this project exists not to give.
    expect(ruleForKeyword(vocabulary, "Stealth")).toBeNull();
    expect(ruleForKeyword(vocabulary, "Wardrobe")).toBeNull();
    expect(ruleForKeyword(vocabulary, "")).toBeNull();
  });
});

describe("rulesForCard", () => {
  test("deduplicates keywords that share a rule", () => {
    // `Ward 1` and `Ward 3` on one card are one citation, not two.
    const resolved = rulesForCard(vocabulary, ["Ward 1", "Ward 3", "Dominate"]);
    expect(resolved.map((rule) => rule.keyword)).toEqual(["ward", "dominate"]);
  });

  test("drops what it cannot resolve rather than inventing a citation", () => {
    expect(rulesForCard(vocabulary, ["Stealth"])).toEqual([]);
  });
});

describe("coverage over the real corpus", () => {
  const coverage = keywordCoverage(vocabulary, everyCardKeyword);

  test("is 94% of 145 base forms, and the split is stated", () => {
    expect(coverage.baseForms).toBe(145);
    expect(coverage.direct).toBe(71);
    expect(coverage.viaFamily).toBe(66);
    expect(coverage.percent).toBe(94);
  });

  test("names every keyword it cannot resolve", () => {
    // PUBLISHED, NOT SWALLOWED. If this list shrinks, the join got better and
    // the test should be updated deliberately. If it GROWS, upstream added
    // vocabulary the rules corpus has not caught up with, and a card is
    // silently losing a citation — which is exactly what the number on the page
    // exists to make visible.
    expect(coverage.unmatched).toEqual([
      "and lightning",
      "attack reaction",
      "ice",
      "instant",
      "pairs",
      "stealth",
      "the crowd boos",
      "the crowd cheers",
    ]);
  });

  test("every resolved rule number exists in the rules corpus", () => {
    // The join is worthless if it cites a paragraph that is not there. Checked
    // against the corpus rather than assumed from the extractor.
    const numbers = new Set(rules.sections.map((section) => section.number));
    const cited = new Set(
      [...new Set(everyCardKeyword)]
        .map((keyword) => ruleForKeyword(vocabulary, keyword)?.number)
        .filter((number): number is string => number !== undefined),
    );

    expect(cited.size).toBeGreaterThan(0);
    for (const number of cited) expect(numbers.has(number)).toBe(true);
  });
});
