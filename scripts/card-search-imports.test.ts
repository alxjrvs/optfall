/**
 * Every corpus import under `card-search/` is type-only.
 *
 * THE REGRESSION THIS PREVENTS ALREADY HAPPENED, and it cost 9.28 MB shipped to
 * every reader. `apps/site/ssg/build.ts` records it: a value import of the card
 * corpus from a module the islands pull in drags the whole 18 MB JSON into the
 * browser bundle, because a value import is a runtime dependency and a type
 * import is erased.
 *
 * IT WAS ALREADY CAUGHT, BUT ONLY IN THE COMMAND PEOPLE SKIP. The island byte
 * budget in `build.ts` fails on it — after a full 12,776-page build, which is
 * `check:full` at about two minutes. This is the same rule as a static read of
 * eight small files, which puts it in the 25-second loop where a mistake is
 * cheap to find.
 *
 * THE PATH IS `../cards`, NOT `./cards`. `cards.ts` is a SIBLING of this
 * directory, not a member of it. `CLAUDE.md` and the search-filter skill both
 * said `./cards` until 2026-09-01, and the skill's snippet named `decode.ts`,
 * which does not import the corpus at all — so copying it produced an
 * unresolvable specifier. Matching on the specifier's tail rather than its
 * exact spelling means this test does not care which of them a future edit
 * uses; it cares that whatever resolves to `cards` is erased.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIRECTORY = join(ROOT, "apps/site/src/lib/card-search");

/**
 * Any import whose specifier ends in `cards`, however it is spelled.
 *
 * Deliberately loose on the path and strict on the `type` keyword: `./cards`,
 * `../cards` and a future `../../lib/cards` are all the same hazard, and the
 * thing being asserted is erasure rather than location.
 */
const CORPUS_IMPORT =
  /^\s*import\s+(type\s+)?[^;]*?from\s+["'][^"']*\/cards["']/gm;

const modules = readdirSync(DIRECTORY)
  .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts"))
  .toSorted();

describe("card-search corpus imports", () => {
  test("there are modules to check", () => {
    /* A glob that silently matches nothing is a test that passes forever. */
    expect(modules.length).toBeGreaterThan(0);
  });

  for (const name of modules) {
    test(`${name} imports the corpus type-only, or not at all`, () => {
      const source = readFileSync(join(DIRECTORY, name), "utf8");
      const offenders = [...source.matchAll(CORPUS_IMPORT)]
        .filter((match) => match[1] === undefined)
        .map((match) => match[0].trim());

      /* Naming the line rather than asserting a count: the failure is read by
         someone who has just added an import and needs to see which one. */
      expect(offenders).toEqual([]);
    });
  }
});
