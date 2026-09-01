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
import { fileURLToPath } from "node:url";

import {
  FIELD_OPERATORS,
  parseCardQuery,
  QUERY_OPTIONS,
  STATE_OPERATORS,
} from "../../src/lib/card-search/grammar";
/* The tables themselves, not their source text: the examples below are run
   through the parser rather than pattern-matched, which is the whole point of
   the last describe block in this file. */
import { BOOLEANS, FIELDS, LEGALITY, ORDERING, type Row } from "./syntax.page";

/**
 * The page's own source, resolved from THIS FILE rather than from the working
 * directory.
 *
 * It was the bare repository-relative string, which is a path that only exists
 * when `bun test` is run from the repository root — and running it from
 * anywhere else made this file throw ENOENT during import, taking the whole
 * suite's exit code with it while reporting zero failed assertions. The same
 * defect was swept out of `scripts/` (see `scripts/lib/root.ts`); this was the
 * last one left, and it is simpler here because the file being read is the
 * test's own neighbour.
 *
 * `fileURLToPath` rather than `new URL(...).pathname`: the latter is
 * percent-encoded, so a checkout under a path with a space in it — which
 * `.claude/worktrees/` is one `git worktree add` away from — yields an ENOENT
 * naming a path that visibly exists.
 */
const PAGE = fileURLToPath(new URL("./syntax.page.tsx", import.meta.url));
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

/**
 * The page's own examples, run through the parser.
 *
 * WHY THE TEXT SEARCH ABOVE WAS NOT ENOUGH. Everything above compares operator
 * NAMES, and `pow>tou` shipped straight through it: `pow` is a real operator
 * and the page named it, so both directions agreed while the example itself
 * had stopped working. A reader who copied the page's own clickable example
 * got no results and a message saying it was not a number. The extractor above
 * could not even see it — it matches `example: "name:` and that row has no
 * colon.
 *
 * So this asserts the stronger, still-checkable thing: every example and every
 * alias PARSES. That is not the same as being true — the docblock at the top
 * of this file is right that prose around a live name needs a human — but an
 * example is not prose. It is the one part of the page a reader copies
 * verbatim, and it can be executed.
 */
describe("every example on the page still parses", () => {
  /*
   * ORDERING IS DOCUMENTED AS MODIFIERS, AND HAS TO BE PROBED AS ONE. `order:`
   * says how to arrange results, not which ones to find, and the engine
   * declines it on its own — deliberately, with a notice that says exactly
   * that. Running those rows bare would fail all eight for a reason that is
   * the parser being right, so they are paired with a term, which is how the
   * page's own prose tells a reader to use them.
   */
  const ROWS: readonly (Row & { readonly needsTerm?: boolean })[] = [
    ...FIELDS,
    ...BOOLEANS,
    ...ORDERING.map((row) => ({ ...row, needsTerm: true })),
    ...LEGALITY,
  ];

  const probe = (row: (typeof ROWS)[number], query: string) =>
    row.needsTerm ? `dash ${query}` : query;

  /** The notice kinds that mean "the engine did not understand this". */
  const REFUSALS = new Set([
    "operator-unknown",
    "operand-unknown",
    "operand-retired",
    "operator-pending",
    "quote-unbalanced",
  ]);

  const refusals = (query: string) =>
    parseCardQuery(query)
      .notices.map((notice) => notice.kind)
      .filter((kind) => REFUSALS.has(kind));

  test("there are rows to check", () => {
    // Guards against an import that silently resolves to nothing, which would
    // make every assertion below vacuously true.
    expect(ROWS.length).toBeGreaterThan(30);
  });

  for (const row of ROWS) {
    test(`${row.example} parses`, () => {
      expect(refusals(probe(row, row.example))).toEqual([]);
    });
  }

  /**
   * An alias is written three ways in these tables, and all three are a thing
   * a reader copies:
   *
   *   `class:`   a prefix — swap it for the example's operator
   *   `pow>def`  a whole expression — use it as written
   *   `defense`  an operand — swap it into the example's operand slot
   *
   * Rather than normalise the tables, the rule that tells them apart is
   * written here: a table is a piece of documentation and its shape should
   * suit the reader, not the test.
   */
  const asQuery = (row: Row, alias: string): string => {
    if (alias.endsWith(":")) {
      return `${alias}${row.example.replace(/^[a-z]+:/, "")}`;
    }
    if (alias.startsWith("!") || /[:<>=]/.test(alias)) return alias;
    return row.example.replace(/:[^\s]+$/, `:${alias}`);
  };

  for (const row of ROWS) {
    for (const alias of row.aliases ?? []) {
      const query = probe(row, asQuery(row, alias));
      test(`${alias} (as ${query}) parses`, () => {
        expect(refusals(query)).toEqual([]);
      });
    }
  }
});
