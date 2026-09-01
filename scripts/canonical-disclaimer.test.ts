/**
 * The disclaimer says the same thing everywhere it is written down.
 *
 * `docs/DISCLAIMER.md` is the specification; `apps/site/src/lib/compliance.ts`
 * is the constant the site renders; `README.md` and `docs/COMPLIANCE.md` each
 * carry a
 * copy for readers who never open the source. Four copies of one legally
 * load-bearing sentence is three chances for a typo, so their agreement is
 * asserted rather than assumed.
 *
 * This runs in `bun test`, which is a job in the aggregate gate — so an edit to
 * any one of them fails CI instead of shipping.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  canonicalDisclaimer,
  normalizeProse,
  readCanonicalDisclaimer,
} from "./canonical-disclaimer";
import { LSS_DISCLAIMER } from "../apps/site/src/lib/compliance";
import { CARD_IMAGE_COPYRIGHT } from "../packages/components/src/index";

const expected = readCanonicalDisclaimer();

describe("the canonical disclaimer", () => {
  test("is extracted from docs/DISCLAIMER.md and is not empty", () => {
    expect(expected.length).toBeGreaterThan(100);
    expect(expected.startsWith("Optfall is in no way affiliated")).toBe(true);
  });

  test("keeps the trademark symbols LSS's template requires", () => {
    expect(expected).toContain("Legend Story Studios®");
    expect(expected).toContain("Flesh and Blood™");
  });

  test("matches the constant the site renders", () => {
    expect(LSS_DISCLAIMER).toBe(expected);
  });

  test("appears in README.md", () => {
    expect(normalizeProse(readFileSync("README.md", "utf8"))).toContain(
      expected,
    );
  });

  test("appears in docs/COMPLIANCE.md", () => {
    expect(
      normalizeProse(readFileSync("docs/COMPLIANCE.md", "utf8")),
    ).toContain(expected);
  });

  // docs/DATA-TERMS.md carries two copies, and one of them is the text this
  // project instructs DOWNSTREAM CONSUMERS to reproduce. A typo there does not
  // just misstate our own position — it propagates into third-party
  // applications that took us at our word, which is the worst place for this
  // sentence to be wrong and the reason it cannot be left out of the check.
  test("appears in docs/DATA-TERMS.md, including the copy consumers reproduce", () => {
    const source = normalizeProse(readFileSync("docs/DATA-TERMS.md", "utf8"));
    expect(source).toContain(expected);

    const occurrences = source.split(expected).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

/**
 * The copyright line is a second, shorter piece of mandated text, and it is
 * spelled two legitimately different ways: the policy mandates the notice
 * `© Legend Story Studios`, while {@link CARD_IMAGE_COPYRIGHT} is Optfall's
 * rendering of it, which wraps that notice in a sentence.
 *
 * So this asserts containment rather than equality. Pinning the rendering to an
 * exact string in a test would make it *look* specified while the mandated form
 * and the rendering drifted apart independently — the failure the disclaimer
 * check above exists to prevent, reintroduced one requirement over.
 */
describe("the card-image copyright line", () => {
  const MANDATED_NOTICE = "© Legend Story Studios";

  test("is mandated in the same words by both compliance documents", () => {
    expect(
      normalizeProse(readFileSync("docs/COMPLIANCE.md", "utf8")),
    ).toContain(MANDATED_NOTICE);
    expect(
      normalizeProse(readFileSync("docs/DATA-TERMS.md", "utf8")),
    ).toContain(MANDATED_NOTICE);
  });

  test("is contained in the constant the card component renders", () => {
    expect(CARD_IMAGE_COPYRIGHT).toContain(MANDATED_NOTICE);
  });
});

describe("extraction", () => {
  test("fails loudly when the section is gone, rather than returning nothing", () => {
    expect(() => canonicalDisclaimer("# Plan\n\nNo such section.\n")).toThrow(
      /Required disclaimer/,
    );
  });

  test("fails loudly when the blockquote is gone", () => {
    expect(() =>
      canonicalDisclaimer("### Required disclaimer\n\nPlain paragraph.\n"),
    ).toThrow(/blockquote/);
  });

  test("normalisation collapses wrapping but not characters", () => {
    expect(normalizeProse("> one\n>  two\n>\ttrailing  space  ")).toBe(
      "one two trailing space",
    );
  });
});
