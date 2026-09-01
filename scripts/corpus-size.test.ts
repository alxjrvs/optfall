/**
 * The size of `data/cards/cards.json`, as claimed in prose, against the size it
 * actually is.
 *
 * WHY THIS EXISTS. CLAUDE.md forbids reading or grepping that file, and the
 * reason it gives is the number: it is too big to put in a context window. That
 * makes the figure load-bearing rather than decorative — a reader deciding
 * whether to open it is deciding on the strength of this one value.
 *
 * The figure was written when the corpus was 16 MB and stayed there while the
 * corpus grew to 18. It was repeated in twenty-one places across CLAUDE.md,
 * `docs/PLAN.md` and eighteen docblocks, so by the time anyone noticed, the
 * correction was a sweep rather than an edit. That is the shape of defect this
 * repository corrects most often, and the only durable answer is to stop
 * asserting the number by hand.
 *
 * So this test derives it. Every "N MB" written near a mention of the corpus has
 * to equal the real size, rounded. Nothing has to remember to update prose; the
 * gate fails with the file to change and the number to write.
 *
 * ROUNDED, AND THE UNIT DOES NOT MATTER — which is luck rather than design, and
 * is worth stating so nobody "fixes" it. 18,357,117 bytes is 18.4 MB decimal and
 * 17.5 MiB binary, and both round to 18. If the corpus ever lands where the two
 * conventions disagree, this test fails and whoever sees it has to pick one and
 * write it down. That is the right moment to have the argument, not now.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";

/** The file whose size the prose keeps claiming. */
const CORPUS_PATH = "data/cards/cards.json";

/**
 * Files that state the corpus size. Enumerated rather than discovered by
 * scanning the tree, for the reason `routes.ts` gives about its own registry: an
 * explicit list is a decision visible in a diff. A new docblock that quotes the
 * size and is not added here is not caught — but a wrong number in one of the
 * twenty places that already do is, and that is the failure that happened.
 */
const CLAIMANTS: readonly string[] = [
  "CLAUDE.md",
  "apps/site/ssg/build.ts",
  "apps/site/ssg/hostConfig.ts",
  "apps/site/ssg/components/CardIndex.tsx",
  "apps/site/ssg/pages/search.page.tsx",
  "apps/site/src/lib/cards.ts",
  "apps/site/src/lib/cards.test.ts",
  "apps/site/src/lib/printings.ts",
  "apps/site/src/lib/typeahead.ts",
  "apps/site/src/lib/card-versions.ts",
  "apps/site/src/lib/card-search.test.ts",
  "apps/site/src/lib/card-search/build.ts",
  "apps/site/src/lib/card-search/decode.ts",
  "apps/site/src/lib/card-search/grammar.ts",
  "apps/site/src/lib/card-search/index.ts",
  "apps/site/src/lib/card-search/wire.ts",
  "scripts/build-card-sample.ts",
  "scripts/build-card-sample.test.ts",
];

/**
 * The shapes a corpus-size claim actually takes in this repository.
 *
 * ANCHORED TO THE WORD, AND IT HAS TO BE. The first draft matched every `N MB`
 * in these files and failed on seven of them — because the same docblocks quote
 * the 9.28 MB island bundle, the 9.74 MB file the service worker refused to
 * precache, and the 235 MB of stylesheet duplication the token file used to
 * cause. Those are different, correct numbers about different things. A test
 * that cannot tell them apart from the corpus figure is a test that will be
 * silenced rather than fixed.
 *
 * So a figure counts only when the prose ties it to the corpus itself: sitting
 * directly in front of "corpus", or directly behind a phrase naming the thing
 * being measured.
 */
const CLAIM_PATTERNS: readonly RegExp[] = [
  /\b(\d+(?:\.\d+)?)\s*MB\b(?=\s+(?:card\s+|JSON\s+)?corpus)/g,
  /\bcorpus is\s+(\d+(?:\.\d+)?)\s*MB\b/g,
  /cards\.json`?\*{0,2}\.?\*{0,2}\s*(?:It )?is\s+(\d+(?:\.\d+)?)\s*MB\b/g,
  /\bloads (?:the |a )?(\d+(?:\.\d+)?)\s*MB\b/g,
  /\bpulls the\s+(\d+(?:\.\d+)?)\s*MB\b/g,
  /\binstead of an?\s+(\d+(?:\.\d+)?)\s*MB\b/g,
  /\bin an?\s+(\d+(?:\.\d+)?)\s*MB\s+JSON\b/g,
];

/** Every corpus-size figure a file states, as numbers. */
function megabytesClaimedIn(path: string): readonly number[] {
  const source = readFileSync(path, "utf8");
  return CLAIM_PATTERNS.flatMap((pattern) =>
    [...source.matchAll(pattern)].map((match) => Number(match[1])),
  );
}

describe("the corpus size in prose", () => {
  const bytes = statSync(CORPUS_PATH).size;
  const decimal = bytes / 1_000_000;
  const binary = bytes / 1_048_576;
  const expected = Math.round(decimal);

  test("rounds the same way under both conventions", () => {
    /* If this fails, the number below is ambiguous and the fix is to write the
       unit rather than to nudge the figure. See the header. */
    expect(Math.round(binary)).toBe(expected);
  });

  for (const path of CLAIMANTS) {
    test(`${path} states ${expected} MB`, () => {
      const claimed = megabytesClaimedIn(path);

      /* A file listed here and no longer claiming a size is a silent hole: the
         list would keep passing while covering nothing. */
      expect(claimed.length).toBeGreaterThan(0);

      for (const value of claimed) {
        expect(value).toBe(expected);
      }
    });
  }
});
