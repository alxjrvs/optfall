/**
 * The syntax page against the grammar it documents.
 *
 * `syntax.page.tsx` says it outright at the top: when the parser changes, this
 * page is wrong and no test will say so. CLAUDE.md repeats it as the one file
 * everyone forgets in the four-file dance of adding an operator. This is the
 * test that says so.
 *
 * IT RUNS IN BOTH DIRECTIONS, and each catches a different mistake. An operator
 * the grammar accepts and the page omits is a feature nobody can find —
 * `toughness` has been exactly that. An operator the page documents and the
 * grammar rejects is worse: a reader follows the documentation, types it, and
 * is told it does not exist.
 *
 * IT IS A TEXT SEARCH, NOT A RENDER, and that is a deliberate limit. The page
 * is mostly prose — a `<code>` in a sentence about what `ft:` means is a real
 * mention, and nothing short of reading English tells you whether the sentence
 * around it is still true. So this asserts the weaker, checkable thing: the
 * operator is NAMED here. Prose that has gone stale around a name it still
 * contains is not something a test can find, and pretending otherwise would be
 * worse than the honest gap.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  FIELD_OPERATORS,
  QUERY_OPTIONS,
  STATE_OPERATORS,
} from "../../src/lib/card-search/grammar";

const PAGE = "apps/site/ssg/pages/syntax.page.tsx";
const source = readFileSync(PAGE, "utf8");

/**
 * Operators the grammar accepts and the page deliberately does not document.
 *
 * EMPTY, AND THAT IS THE STATE TO KEEP IT IN. It briefly held `toughness`,
 * `tou` and `o` — the three the grammar accepted because another game's did —
 * and the honest options were to document them or to stop accepting them. The
 * second was right, so the list emptied itself. An entry here is a promise that
 * something works and is findable nowhere, which is worth making only with a
 * reason written beside it.
 */
const UNDOCUMENTED: readonly string[] = [];

/** Every operator name the grammar answers to. */
const ACCEPTED: readonly string[] = [
  ...Object.keys(FIELD_OPERATORS),
  ...Object.keys(STATE_OPERATORS),
  ...QUERY_OPTIONS,
];

/**
 * Whether the page names an operator.
 *
 * THE COMPARISON FORMS COUNT, and the first draft of this got it wrong. It
 * looked for `date:` and reported `date` undocumented — while the page
 * documents it as `date>=2024-06-21`, which is the spelling that operator is
 * actually used in. The test was wrong, not the page, and a matcher that
 * demands the colon would have had somebody "fix" correct documentation.
 *
 * So: the name, followed by anything that makes it an operator rather than an
 * English word. The word boundary in front is what keeps `a:` from matching the
 * indefinite article and `def` from matching "defence".
 */
function mentions(operator: string): boolean {
  return new RegExp(`\\b${operator}(?:[:<>=]|</code>)`).test(source);
}

describe("the syntax page documents the grammar", () => {
  for (const operator of ACCEPTED) {
    if (UNDOCUMENTED.includes(operator)) continue;
    test(`${operator}: is named on the page`, () => {
      expect(mentions(operator)).toBe(true);
    });
  }

  test("the exception list has not outlived its reason", () => {
    /* An entry the grammar no longer accepts is an exception for an operator
       that does not exist — the list describing a ghost, which is the state
       every allowlist drifts into if nothing checks it. */
    for (const operator of UNDOCUMENTED) {
      expect(ACCEPTED).toContain(operator);
    }
  });
});

describe("the page documents nothing the grammar refuses", () => {
  /*
   * Scoped to the operators the page presents as EXAMPLES rather than to every
   * `<code>` on it, because the page legitimately shows operands (`display:grid`),
   * comparisons (`cost>=3`) and whole queries. The example table is the part
   * that reads as "type this".
   */
  const examples = [...source.matchAll(/example: "([a-z]+):/g)].map(
    (match) => match[1] ?? "",
  );

  test("the page has examples to check", () => {
    // A regex that quietly stops matching would make every assertion below
    // vacuous, so the count is asserted before the contents.
    expect(examples.length).toBeGreaterThan(5);
  });

  for (const operator of [...new Set(examples)]) {
    test(`${operator}: in an example is a real operator`, () => {
      expect(ACCEPTED).toContain(operator);
    });
  }
});
