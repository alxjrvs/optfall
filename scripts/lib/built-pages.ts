/**
 * The scaffolding three built-output checkers each reimplemented.
 *
 * `check-disclaimer.ts`, `check-built-tokens.ts` and `check-card-notice.ts` all
 * do the same four things before they do anything interesting: read an optional
 * output directory off `argv`, notice `--verbose`, glob the HTML, and refuse to
 * pass on an empty result. Two of them carried a character-identical error
 * string for the last one.
 *
 * IT ALSO FIXES A REAL INCONSISTENCY RATHER THAN ONLY DEDUPLICATING. Only
 * `check-disclaimer.ts` checked that the directory EXISTS. The other two fell
 * through to the glob and reported "No HTML found in apps/site/dist" for a
 * directory that was not there — which is the wrong diagnosis for the
 * commonest cause by far, forgetting to build. Both messages now come from
 * here, and they are different messages.
 *
 * WHAT DELIBERATELY STAYS IN EACH SCRIPT: every domain-specific failure
 * message. The constraint on this merge was that no failure gets less
 * specific, and it holds because everything that differs between the three is
 * about what they assert, not about how they find the pages.
 */

import { existsSync } from "node:fs";

export interface BuiltPages {
  /** The directory that was scanned, as given or defaulted. */
  readonly directory: string;
  /** Every HTML file under it, relative to it, sorted. */
  readonly pages: readonly string[];
  /** Whether `--verbose` was passed. */
  readonly verbose: boolean;
}

/** Where the site build lands, when nobody says otherwise. */
export const DEFAULT_OUTPUT = "apps/site/dist";

/**
 * Read the arguments, find the pages, or exit 1 saying why.
 *
 * EXITS RATHER THAN THROWING, because every caller is a top-level script whose
 * only response to a missing build is to say so and stop. Returning an empty
 * list would make each caller re-derive that, which is how the two variants of
 * the message appeared in the first place.
 */
export function builtPages(
  argv: readonly string[] = process.argv.slice(2),
): BuiltPages {
  const verbose = argv.includes("--verbose");
  const directory = argv.find((arg) => !arg.startsWith("--")) ?? DEFAULT_OUTPUT;

  if (!existsSync(directory)) {
    console.error(
      `::error::${directory} does not exist. Run \`bun run build\` first — this checker reads BUILT output, which is why it is in \`check:full\` and not \`check\`.`,
    );
    process.exit(1);
  }

  const pages = [
    ...new Bun.Glob("**/*.html").scanSync({ cwd: directory, dot: false }),
  ].toSorted();

  if (pages.length === 0) {
    console.error(
      `::error::No HTML found in ${directory}. Run \`bun run build\` first — an empty build is a failure here, not a pass.`,
    );
    process.exit(1);
  }

  return { directory, pages, verbose };
}

/**
 * A reporter that stops after `max` lines.
 *
 * Each caller decides what a "failure" is and how to count what it suppressed;
 * this only owns the cap, which all three spelled as a bare `MAX_REPORTED = 10`
 * beside their own loop.
 */
export function capped(max = 10): {
  readonly max: number;
  report: (line: string, index: number, verbose: boolean) => void;
} {
  return {
    max,
    report(line, index, verbose) {
      if (verbose || index < max) console.error(line);
    },
  };
}
