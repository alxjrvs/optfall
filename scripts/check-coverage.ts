/**
 * Line coverage, measured and held at a committed floor.
 *
 * WHY THIS IS A SCRIPT RATHER THAN `coverageThreshold` IN `bunfig.toml`.
 * That setting applies to EVERY `bun test` invocation, including a scoped one.
 * `CLAUDE.md`'s timing table exists to encourage exactly those — `bun test
 * packages/theme` is a second, against thirty for the whole suite — and a
 * scoped run only loads the files it needs, so its whole-repository coverage is
 * legitimately low. A global threshold would fail the fast loop it is most
 * important not to discourage. This runs only when it is asked to.
 *
 * WHY LCOV RATHER THAN THE TEXT TABLE. `--coverage-reporter=lcov` writes a
 * machine format whose `LF:`/`LH:` records are a documented contract; the text
 * reporter is a human table whose columns can be re-laid-out in any Bun
 * release. A parser for the table would be a parser for a version of Bun.
 *
 * THE FLOOR IS A RATCHET, NOT A TARGET. {@link FLOOR} is the coverage this
 * repository already had when the check was added, rounded DOWN to a whole
 * percent. It exists so the number cannot quietly fall, and it should be raised
 * when it rises — never lowered to make a change pass. A threshold set above
 * what the tree achieves is how a project ends up writing tests that satisfy a
 * number rather than tests that would catch something, which is the failure the
 * audit that prompted this explicitly warned about.
 *
 * Run:  bun run check:coverage
 */

import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib/root";

/**
 * The floor, as a percentage of executable lines.
 *
 * MEASURED, NOT CHOSEN. The first CI run of this script reported **88.58%
 * (9491/10715 lines)** across 1,067 tests in 40 files. Eighty-eight is that
 * figure rounded DOWN to a whole percent, which leaves half a point of room —
 * enough that adding a file with no tests does not fail the build on the commit
 * that adds it, and little enough that a real regression still does.
 *
 * Raise it when coverage rises. Do not lower it to make a change pass; see the
 * header for why that is the failure this check exists to prevent.
 */
const FLOOR = 88;

const COVERAGE_DIR = join(ROOT, "coverage");
const LCOV = join(COVERAGE_DIR, "lcov.info");

/** Total executable lines and covered lines across every file in an lcov file. */
export function totalsFromLcov(lcov: string): {
  found: number;
  hit: number;
} {
  let found = 0;
  let hit = 0;
  for (const line of lcov.split(/\r?\n/)) {
    /* `LF` is lines found in a file, `LH` lines hit. One pair per file record;
       summing them across records gives repository-wide line coverage, which is
       the same thing the text reporter's "All files" row reports. */
    if (line.startsWith("LF:")) found += Number(line.slice(3)) || 0;
    else if (line.startsWith("LH:")) hit += Number(line.slice(3)) || 0;
  }
  return { found, hit };
}

/** Coverage as a percentage, or `0` when nothing executable was found. */
export function percentage(found: number, hit: number): number {
  return found === 0 ? 0 : (hit / found) * 100;
}

/** One file's line coverage, as lcov records it. */
export interface FileCoverage {
  readonly file: string;
  readonly found: number;
  readonly hit: number;
  readonly missed: number;
}

/**
 * Per-file coverage, worst first, ranked by MISSED LINES rather than by
 * percentage.
 *
 * That ranking is the point. A 40-line helper at 50% is missing twenty lines
 * and looks alarming; a 1,800-line renderer at 94% is missing over a hundred
 * and looks fine. Sorting by percentage puts the helper first and buries the
 * renderer, which is backwards for anyone trying to raise the total — moving
 * the number means covering LINES, and the file with the most uncovered lines
 * is where they are.
 *
 * This exists because per-suite coverage cannot answer the question. Running
 * one directory at a time reports a file as barely covered when another
 * directory's tests are what exercise it; only the whole-suite union is true,
 * and this is where that union gets read.
 */
export function worstFiles(
  lcov: string,
  limit: number,
): readonly FileCoverage[] {
  const files: FileCoverage[] = [];
  let file = "";
  let found = 0;
  let hit = 0;

  for (const line of lcov.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      file = line.slice(3);
      found = 0;
      hit = 0;
    } else if (line.startsWith("LF:")) found = Number(line.slice(3)) || 0;
    else if (line.startsWith("LH:")) hit = Number(line.slice(3)) || 0;
    else if (line === "end_of_record" && file !== "") {
      files.push({ file, found, hit, missed: found - hit });
      file = "";
    }
  }

  return files
    .filter((entry) => entry.missed > 0)
    .sort((a, b) => b.missed - a.missed)
    .slice(0, limit);
}

if (import.meta.main) {
  rmSync(COVERAGE_DIR, { recursive: true, force: true });

  const run = Bun.spawnSync({
    cmd: [
      "bun",
      "test",
      "--coverage",
      "--coverage-reporter=lcov",
      `--coverage-dir=${COVERAGE_DIR}`,
    ],
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });

  /* A failing suite is a failing suite. Reporting coverage for a run that did
     not finish would be reporting a number about less code than was meant to
     run — lower than the truth, and confusing on top of the real failure. */
  if (run.exitCode !== 0) {
    console.error(
      `::error::The test suite failed, so coverage was not measured. Fix the tests first.`,
    );
    process.exit(run.exitCode ?? 1);
  }

  if (!existsSync(LCOV)) {
    console.error(
      `::error::No lcov report at ${LCOV}. The suite passed, so this is a reporter problem rather than a test one — check that this Bun still supports --coverage-reporter=lcov.`,
    );
    process.exit(1);
  }

  const { found, hit } = totalsFromLcov(readFileSync(LCOV, "utf8"));
  const percent = percentage(found, hit);
  const rounded = Math.round(percent * 100) / 100;

  const summary = `Line coverage ${rounded}% (${hit}/${found} lines), floor ${FLOOR}%`;
  console.log(summary);

  /* Printed unconditionally, not only on failure. Someone raising the floor
     needs this list BEFORE the build is red, and the whole-suite union is the
     only place it is true — a per-directory run reports a file as uncovered
     when another directory's tests are what exercise it. */
  const worst = worstFiles(readFileSync(LCOV, "utf8"), 15);
  if (worst.length > 0) {
    console.log(`\nMost uncovered lines, worst first:`);
    for (const entry of worst) {
      const pct = Math.round(percentage(entry.found, entry.hit) * 10) / 10;
      const name = entry.file.replace(`${ROOT}/`, "");
      console.log(
        `  ${String(entry.missed).padStart(5)} missed  ${String(pct).padStart(5)}%  ${name}`,
      );
    }
  }

  /* GitHub renders this on the run's summary page, so the number is visible
     without opening a log. Absent locally, which is why it is guarded. */
  const stepSummary = process.env["GITHUB_STEP_SUMMARY"];
  if (stepSummary !== undefined && stepSummary !== "") {
    await Bun.write(stepSummary, `### Coverage\n\n${summary}\n`);
  }

  if (percent + 1e-9 < FLOOR) {
    console.error(
      `::error::Coverage ${rounded}% is below the committed floor of ${FLOOR}%. The floor is a ratchet: raise it when coverage rises, and do not lower it to make a change pass. If this drop is deliberate, say so in the commit and move the floor in the same change.`,
    );
    process.exit(1);
  }
}
