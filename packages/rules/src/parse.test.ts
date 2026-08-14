import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  COMPREHENSIVE_RULES_URL,
  childrenOf,
  indexById,
  parseComprehensiveRules,
  pathOf,
  sectionById,
} from "./index";
import type { RuleLevel, RulesDocument } from "./index";

/**
 * The fixture is real `pdftotext -layout` output from Comprehensive Rules
 * 2.14.0 (sha256 fef01bb7c99da3d5e923521229c84b09ed544e8587dd0aaafaa666648fd44b85,
 * 413,462 bytes, retrieved from https://rules.fabtcg.com/pdf/en-fab-cr.pdf):
 * the title page, then the first five pages of chapter 1, form feeds and page
 * furniture intact. Sixty-one entries — enough to exercise every construct in
 * the document, small enough that committing it is not committing the corpus.
 */
const FIXTURE = new URL("./fixtures/cr-2.14.0-excerpt.txt", import.meta.url);
const fixtureText = readFileSync(FIXTURE, "utf8");

function parseFixture(): RulesDocument {
  const { document, warnings } = parseComprehensiveRules(fixtureText);
  expect(warnings).toEqual([]);
  return document;
}

function countByLevel(document: RulesDocument): Record<RuleLevel, number> {
  const counts: Record<RuleLevel, number> = {
    chapter: 0,
    section: 0,
    rule: 0,
    subrule: 0,
  };
  for (const entry of document.sections) counts[entry.level] += 1;
  return counts;
}

describe("the document stamp", () => {
  test("is read off the title page, never assumed", () => {
    const document = parseFixture();
    expect(document.game).toBe("Flesh and Blood");
    expect(document.title).toBe("Comprehensive Rules");
    expect(document.version).toBe("2.14.0");
    expect(document.publishedDate).toBe("2026-6-10");
    expect(document.publishedDateIso).toBe("2026-06-10");
    expect(document.sourceUrl).toBe(COMPREHENSIVE_RULES_URL);
  });

  test("stamps every single section with the version it was read from", () => {
    const document = parseFixture();
    expect(document.sections.length).toBeGreaterThan(0);
    for (const section of document.sections) {
      expect(section.version).toBe("2.14.0");
    }
  });

  test("refuses to guess when the title page is not the shape it expects", () => {
    expect(() =>
      parseComprehensiveRules(
        "Flesh and Blood\nComprehensive Rules\nsoon\n2.14.0\n",
      ),
    ).toThrow(/publication date/);
    expect(() =>
      parseComprehensiveRules(
        "Flesh and Blood\nComprehensive Rules\n2026-6-10\nlatest\n",
      ),
    ).toThrow(/document version/);
    expect(() => parseComprehensiveRules("")).toThrow(/fewer than four lines/);
  });
});

describe("the published numbering is the identifier", () => {
  test("ids are LSS's number with a cr: namespace and nothing else", () => {
    const document = parseFixture();
    for (const section of document.sections) {
      expect(section.id).toBe(`cr:${section.number}`);
      expect(section.number).toMatch(/^\d+(\.\d+){0,2}[a-z]?$/);
    }
  });

  test("cr:1.0.1a is the id of rule 1.0.1a, verbatim", () => {
    const document = parseFixture();
    const clause = sectionById(document, "cr:1.0.1a");
    expect(clause).toBeDefined();
    expect(clause?.level).toBe("subrule");
    expect(clause?.parentId).toBe("cr:1.0.1");
    expect(clause?.text).toBe(
      "If an effect directly contradicts a rule contained in this document, the effect supersedes that rule.",
    );
  });

  test("a bare published number resolves too, because that is what a judge pastes", () => {
    const document = parseFixture();
    expect(sectionById(document, "1.0.1a")?.id).toBe("cr:1.0.1a");
  });

  test("every parent named exists in the document", () => {
    const document = parseFixture();
    const index = indexById(document);
    for (const section of document.sections) {
      if (section.parentId === null) {
        expect(section.level).toBe("chapter");
        continue;
      }
      expect(index.get(section.parentId)).toBeDefined();
    }
  });

  test("the ancestor chain reads chapter to clause", () => {
    const document = parseFixture();
    expect(pathOf(document, "cr:1.0.1a").map((entry) => entry.id)).toEqual([
      "cr:1",
      "cr:1.0",
      "cr:1.0.1",
      "cr:1.0.1a",
    ]);
    expect(pathOf(document, "cr:9.9.9")).toEqual([]);
  });

  test("children come back in document order", () => {
    const document = parseFixture();
    expect(
      childrenOf(document, "cr:1.0.1").map((entry) => entry.number),
    ).toEqual(["1.0.1a", "1.0.1b"]);
    expect(childrenOf(document, "cr:1.0").map((entry) => entry.number)).toEqual(
      ["1.0.1", "1.0.2"],
    );
  });

  test("no id is claimed twice", () => {
    const document = parseFixture();
    const seen = new Set<string>();
    for (const section of document.sections) {
      expect(seen.has(section.id)).toBe(false);
      seen.add(section.id);
    }
  });
});

describe("what the fixture yields", () => {
  test("sixty-one entries across four levels", () => {
    const document = parseFixture();
    expect(countByLevel(document)).toEqual({
      chapter: 1,
      section: 5,
      rule: 19,
      subrule: 36,
    });
    expect(document.sections).toHaveLength(61);
  });

  test("chapter and section headings keep their titles; rules have none", () => {
    const document = parseFixture();
    expect(sectionById(document, "cr:1")?.title).toBe("Game Concepts");
    expect(sectionById(document, "cr:1.0")?.title).toBe("General");
    expect(sectionById(document, "cr:1.1")?.title).toBe("Players");
    expect(sectionById(document, "cr:1.0.1")?.title).toBeNull();
  });

  test("no rule or subrule is captured empty", () => {
    const document = parseFixture();
    for (const section of document.sections) {
      if (section.level === "rule" || section.level === "subrule") {
        expect(section.text.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("text fidelity", () => {
  test("soft-wrapped lines rejoin into one sentence", () => {
    const document = parseFixture();
    expect(sectionById(document, "cr:1.0.1b")?.text).toBe(
      "If a tournament rule contradicts a rule contained in this document or an effect, the tournament rule supersedes that rule or that effect.",
    );
  });

  test("examples are kept apart from the rule and kept verbatim", () => {
    const document = parseFixture();
    const rule = sectionById(document, "cr:1.0.2");
    expect(rule?.examples).toHaveLength(2);
    expect(rule?.examples[0]).toStartWith(
      "Example: “They can’t defend this with equipment”",
    );
    expect(rule?.examples[1]).toEndWith(
      "the player cannot play cards from their banished zone.",
    );
    expect(rule?.text).not.toContain("Example:");
  });

  test("inline bracketed cross-references become resolvable ids", () => {
    const document = parseFixture();
    expect(sectionById(document, "cr:1.1.2")?.references).toEqual([
      "cr:1.3.2a",
    ]);
    // Chapter- and section-level references appear too: "properties[2] and
    // located in a zone[3] or a player's inventory.[4.1.6]"
    expect(sectionById(document, "cr:1.2.1")?.references).toEqual([
      "cr:2",
      "cr:3",
      "cr:4.1.6",
    ]);
  });

  test("page furniture never reaches the corpus", () => {
    const document = parseFixture();
    for (const section of document.sections) {
      expect(section.text).not.toContain("CHAPTER 1. GAME CONCEPTS");
      expect(section.text).not.toMatch(/\f/);
    }
    // The running header and the page number sit between 1.1.2 and 1.1.2a in
    // the source text. If either leaked, it would land in one of these two.
    expect(sectionById(document, "cr:1.1.2")?.text).toBe(
      "A player’s hero is a hero-card.[1.3.2a]",
    );
    expect(sectionById(document, "cr:1.1.2a")?.text).toStartWith(
      "This document distinguishes the player",
    );
  });
});

describe("the extraction traps that fail silently", () => {
  const titlePage =
    "Flesh and Blood\nComprehensive Rules\n2026-6-10\n2.14.0\n\f";

  test("a compound word broken across lines keeps its hyphen and gains no space", () => {
    const text = `${titlePage}1.     Game Concepts\n\n1.0. General\n     1.0.1. A card can only defend one attack-\n          target at a time.\n`;
    const { document, warnings } = parseComprehensiveRules(text);
    expect(warnings).toEqual([]);
    expect(sectionById(document, "cr:1.0.1")?.text).toBe(
      "A card can only defend one attack-target at a time.",
    );
  });

  test("a free-standing dash at a line end keeps its space", () => {
    const text = `${titlePage}1.     Game Concepts\n\n1.0. General\n     1.0.1. If the condition is met, the effect is generated -\n          otherwise, it is not.\n`;
    const { document } = parseComprehensiveRules(text);
    expect(sectionById(document, "cr:1.0.1")?.text).toBe(
      "If the condition is met, the effect is generated - otherwise, it is not.",
    );
  });

  test("adjacent bullets with no blank line between them stay separate items", () => {
    const text = `${titlePage}1.     Game Concepts\n\n1.0. General\n     1.0.1. Colors.\n            • A card with a red color strip is considered red.\n            • A card with a yellow color strip is considered\n              yellow.\n`;
    const { document, warnings } = parseComprehensiveRules(text);
    expect(warnings).toEqual([]);
    expect(sectionById(document, "cr:1.0.1")?.bullets).toEqual([
      "A card with a red color strip is considered red.",
      "A card with a yellow color strip is considered yellow.",
    ]);
  });

  test("a short line of body text is not mistaken for a page number", () => {
    // Page numbers in this document are centred past column 52. A stray `2` at
    // the left margin is prose, and eating it would silently truncate a rule.
    const text = `${titlePage}1.     Game Concepts\n\n1.0. General\n     1.0.1. Its base defense is set to\n          2.\n\n                                                            1\n`;
    const { document } = parseComprehensiveRules(text);
    expect(sectionById(document, "cr:1.0.1")?.text).toBe(
      "Its base defense is set to 2.",
    );
  });
});

describe("warnings are how this fails loudly", () => {
  const titlePage =
    "Flesh and Blood\nComprehensive Rules\n2026-6-10\n2.14.0\n\f";

  test("an unlabelled continuation paragraph is reported, not swallowed", () => {
    const text = `${titlePage}1.     Game Concepts\n\n1.0. General\n     1.0.1. A rule.\n\n          A second paragraph with no label at all.\n`;
    const { document, warnings } = parseComprehensiveRules(text);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.kind).toBe("unclassified-paragraph");
    expect(warnings[0]?.id).toBe("cr:1.0.1");
    // Reported, and still kept. Dropping text is never the safe default.
    expect(sectionById(document, "cr:1.0.1")?.text).toContain(
      "A second paragraph",
    );
  });

  test("a subrule whose parent rule is absent is reported", () => {
    const text = `${titlePage}1.     Game Concepts\n\n1.0. General\n     1.0.1. A rule.\n          1.0.9a An orphan clause.\n`;
    const { warnings } = parseComprehensiveRules(text);
    expect(warnings.map((warning) => warning.kind)).toContain("missing-parent");
  });

  test("back matter ends the parse rather than being guessed at", () => {
    const text = `${titlePage}1.     Game Concepts\n\n1.0. General\n     1.0.1. A rule.\n\fGlossary\n\n(1H) A subtype of a weapon object.\n`;
    const { document, warnings } = parseComprehensiveRules(text);
    expect(warnings).toEqual([]);
    expect(document.sections.map((entry) => entry.id)).toEqual([
      "cr:1",
      "cr:1.0",
      "cr:1.0.1",
    ]);
  });
});
