/**
 * The disclaimer says the same thing everywhere it is written down.
 *
 * `docs/PLAN.md` is the specification; `apps/site/src/lib/compliance.ts` is the
 * constant the site renders; `README.md` and `docs/COMPLIANCE.md` each carry a
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

const expected = readCanonicalDisclaimer();

describe("the canonical disclaimer", () => {
  test("is extracted from docs/PLAN.md and is not empty", () => {
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
    expect(normalizeProse(readFileSync("README.md", "utf8"))).toContain(expected);
  });

  test("appears in docs/COMPLIANCE.md", () => {
    expect(normalizeProse(readFileSync("docs/COMPLIANCE.md", "utf8"))).toContain(
      expected,
    );
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
