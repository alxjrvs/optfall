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
 * the since-retired build plan and eighteen docblocks, so by the time anyone
 * noticed, the correction was a sweep rather than an edit. That is the shape of defect this
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
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** The file whose size the prose keeps claiming. */
const CORPUS_PATH = "data/cards/cards.json";

/**
 * Files known to state the corpus size, kept as an EXPECTED MINIMUM rather than
 * as the search space.
 *
 * THIS LIST USED TO BE THE WHOLE TEST, and its own docblock conceded the hole:
 * "a new docblock that quotes the size and is not added here is not caught". On
 * 2026-09-01 three files were in exactly that position — `set-profiles.ts`,
 * `sets.page.tsx` and the search-filter skill all still said 16 MB, all matched
 * the patterns below, and none was on the list. The enumeration did not fail;
 * it simply was not looking.
 *
 * The scan below now looks at every source and prose file, which closes the
 * class rather than those three instances. This list survives for the opposite
 * job: a file that STOPS claiming a size is also a change worth noticing, and
 * only a named list can notice an absence.
 *
 * `routes.ts`'s explicit-registry argument does not transfer, and it is worth
 * saying why: that registry is a DECISION SURFACE — what exists as a URL is
 * chosen. This is not. Nobody decides which docblocks mention a number.
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

/** Directories with nothing hand-written in them. */
const SKIP = new Set([
  "node_modules",
  ".git",
  "dist",
  "data",
  "design-system",
  ".wrangler",
]);

const READ = new Set([".ts", ".tsx", ".md", ".css", ".jsonc", ".yml"]);

/** Every hand-written source and prose file in the repository. */
function scannable(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) scannable(path, out);
    else if (READ.has(extname(entry))) out.push(path);
  }
  return out;
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

  const files = scannable(ROOT);
  const claiming = files
    .map((path) => ({ path, claimed: megabytesClaimedIn(path) }))
    .filter((entry) => entry.claimed.length > 0);

  test("the scan found files to check", () => {
    /* A walker that silently matches nothing passes forever. */
    expect(files.length).toBeGreaterThan(100);
    expect(claiming.length).toBeGreaterThan(0);
  });

  test(`every corpus-size claim in the tree says ${expected} MB`, () => {
    /* Reported as paths rather than as a count, because the person reading
       this failure needs the list of files to edit. */
    const wrong = claiming
      .filter((entry) => entry.claimed.some((mb) => mb !== expected))
      .map((entry) => `${entry.path}: ${entry.claimed.join(", ")} MB`);

    expect(wrong).toEqual([]);
  });

  for (const path of CLAIMANTS) {
    test(`${path} still states the size`, () => {
      /* The absence half. A file that stops claiming a size is not caught by
         the scan above — the scan can only judge what it finds — so the named
         list is what notices the claim going missing. */
      const claimed = megabytesClaimedIn(join(ROOT, path));
      expect(`${path}: ${claimed.length > 0}`).toBe(`${path}: true`);
    });
  }
});
