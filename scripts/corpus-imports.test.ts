/**
 * Who is allowed to import a corpus file directly.
 *
 * WHY THIS IS A GATE RATHER THAN A CONVENTION. Every corpus under `data/` has
 * exactly one module that reads it and re-exports it shaped and typed —
 * `lib/cards.ts`, `lib/rules.ts`, `lib/sets.ts`, `lib/card-symbols.ts`. A
 * second importer is not a style preference to lose an argument about; it is
 * the two failures this repository has already had.
 *
 * THE FIRST IS SIZE. `data/cards/cards.json` is 18 MB and `cards.ts` loads it
 * at module scope, so a VALUE import from the wrong side of the island boundary
 * once shipped a 9.28 MB bundle to every reader. `build.ts` carries an island
 * budget because of it, and `card-search/` imports `../cards` type-only for the
 * same reason. Those defences all assume the corpus has one door.
 *
 * THE SECOND IS DRIFT, and it happened while this test was being written. The
 * rules corpus was imported by literal path in seven files, each casting it
 * itself; consolidating them onto `lib/rules.ts`'s `CORPUS` was one change, and
 * a stack in flight that same day added an EIGHTH in a new module. Nothing
 * failed. It was caught by a merge conflict, which is luck rather than a
 * process — the version is in the filename, so the eighth importer would have
 * kept citing 2.14.0 after everything else moved to 2.15, and it would have
 * typechecked, passed and shipped.
 *
 * So: add a consumer, import the shaped export. Add a new corpus, add its
 * reader below and say why it is the reader. The list is short on purpose — if
 * it is getting long, the thing to question is the new entry.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

/**
 * The modules permitted to read a corpus straight off disk, and what each one
 * owes the rest of the tree in return.
 */
const READERS: Readonly<Record<string, string>> = {
  "apps/site/src/lib/cards.ts": "exports CORPUS, CARD_PAGES and CARD_ROUTES",
  "apps/site/src/lib/rules.ts": "exports CORPUS and the rule addressing",
  "apps/site/src/lib/sets.ts": "exports SETS",
  "apps/site/src/lib/card-symbols.ts": "exports the symbol lookup",
  /* Its own fixture generator: it reads the full corpus precisely so that
     everything else can read `sample.json` instead. */
  "scripts/build-card-sample.ts": "writes data/cards/sample.json",
  /* Asserts the committed manifest against the files it describes, which means
     reading the manifest rather than a shaped view of it. */
  "apps/site/src/lib/symbol-assets.test.ts": "checks the symbol manifest",
};

/** Any import whose specifier reaches into `data/`. */
const DATA_IMPORT = /^\s*import\s[^;]*?from\s+"([^"]*\/data\/[^"]*\.json)"/gm;

const ROOTS = ["apps", "packages", "scripts"] as const;
const SOURCE = new Set([".ts", ".tsx"]);
const SKIP = new Set(["node_modules", "dist", ".astro", "coverage"]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...sourceFiles(path));
      continue;
    }
    if (SOURCE.has(extname(path))) found.push(path);
  }
  return found;
}

describe("corpus files have one door each", () => {
  const offenders: { file: string; specifier: string }[] = [];

  for (const root of ROOTS) {
    for (const path of sourceFiles(root)) {
      const file = relative(".", path);
      if (file in READERS) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(DATA_IMPORT)) {
        offenders.push({ file, specifier: match[1] ?? "" });
      }
    }
  }

  test("nothing outside the readers imports a corpus directly", () => {
    /* The message matters more than the assertion here: whoever trips this is
       adding a consumer and needs to be told which export to use instead. */
    expect(offenders.map((o) => `${o.file} imports ${o.specifier}`)).toEqual(
      [],
    );
  });

  for (const [file, owes] of Object.entries(READERS)) {
    test(`${file} still reads a corpus and ${owes}`, () => {
      /* A reader that stops importing one has either moved or been retired, and
         either way this list is now describing something that is not there. */
      const source = readFileSync(file, "utf8");
      expect([...source.matchAll(DATA_IMPORT)].length).toBeGreaterThan(0);
    });
  }
});
