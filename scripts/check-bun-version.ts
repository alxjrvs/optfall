#!/usr/bin/env bun
/**
 * Fails the build when any surface disagrees with `.bun-version`.
 *
 * Bun in this repository is not just the package manager. It is the runtime,
 * the test runner and the script runner, so two machines on different Bun
 * versions do not merely resolve installs differently — they run different
 * tests and build different output. `.bun-version` is the one file a developer's
 * toolchain and CI both read, which is why it is the source of truth here.
 *
 * It cannot be the ONLY place the number appears, though. `engines.bun` and the
 * `@types/bun` pin are npm metadata and cannot reference a file, so each carries
 * the number literally — and a number written in three places is a number that
 * drifts. SU-SRD's copy of this check was written after its CI had been testing
 * on 1.3.10 while a production site built on 1.3.14, which is the precise shape
 * of "the gate was green for a build nobody shipped".
 *
 * THE TWO HOST SURFACES THAT USED TO BE HERE ARE GONE, and that is a real
 * reduction rather than a gap: the build ran on an image that took its Bun from
 * a hand-maintained `BUN_VERSION` variable and read no version file. It now runs
 * in CI, where every step reads `.bun-version` directly, so there is nothing
 * left to drift.
 *
 * So: `.bun-version` is read, every other surface is compared against it, and
 * this fails naming the ones that disagree.
 *
 * WHAT THIS DOES NOT DO: decide whether the pinned version is a good one, or
 * whether it is current. Bumping Bun means editing `.bun-version` and then
 * making this pass again — which is the whole point, because that edit is now a
 * diff that names every surface the bump has to reach.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const read = (path: string) => readFileSync(join(root, path), "utf-8");

const expected = read(".bun-version").trim();

if (!/^\d+\.\d+\.\d+$/.test(expected)) {
  console.error(
    `✗ .bun-version is "${expected}", which is not an exact version.`,
  );
  console.error(
    "  → a range or a floating line here would defeat the file: every surface",
  );
  console.error(
    "    below pins exactly, so there would be nothing to compare them to.",
  );
  process.exit(1);
}

const rootPkg = JSON.parse(read("package.json")) as {
  engines?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type Surface = { label: string; actual: string | undefined; expected: string };

const surfaces: Surface[] = [
  {
    // A floor rather than an exact pin, because `engines` is a compatibility
    // statement to anything that installs this workspace, not a toolchain
    // selector. It still has to move with the pin: an `engines.bun` older than
    // the version we actually build with is a claim we have stopped testing.
    label: "package.json engines.bun",
    actual: rootPkg.engines?.["bun"],
    expected: `>=${expected}`,
  },
  {
    // Exact, and it is `@types/bun` here rather than SU-SRD's `bun-types`.
    // Types from a different Bun than the one running the code is the failure
    // this repo would notice last: it typechecks green and diverges at runtime.
    label: "package.json devDependencies['@types/bun']",
    actual: rootPkg.devDependencies?.["@types/bun"],
    expected,
  },
];

const drifted = surfaces.filter((s) => s.actual !== s.expected);

/**
 * The workflow reads `.bun-version` and must keep doing so.
 *
 * Without this, the file is decorative the moment somebody answers a CI problem
 * by typing a version back into `bun-version:` — every check above would still
 * pass, and CI would be running a Bun the pin does not describe. A hardcoded
 * version in the workflow is the exact state this change removed.
 */
const workflow = read(".github/workflows/ci.yml");
const setupBunSteps =
  workflow.match(/uses:[ \t]*oven-sh\/setup-bun@/g)?.length ?? 0;
const fromFile =
  workflow.match(/^[ \t]*bun-version-file:[ \t]*\.bun-version[ \t]*$/gm)
    ?.length ?? 0;
// `[ \t]` rather than `\s`, deliberately: `\s` crosses newlines, so the job
// named `bun-version:` below matched as a hardcoded pin whose "value" was the
// `name:` on the next line.
const hardcoded = workflow.match(/^[ \t]*bun-version:[ \t]*\S+/gm) ?? [];

const workflowProblems: string[] = [];

if (setupBunSteps === 0) {
  workflowProblems.push(
    "ci.yml sets up Bun nowhere — this check cannot see what CI runs on, which is a failure, not a pass.",
  );
}
if (hardcoded.length > 0) {
  workflowProblems.push(
    `ci.yml pins Bun inline in ${hardcoded.length} step(s) (\`bun-version:\`) — use \`bun-version-file: .bun-version\`.`,
  );
}
if (fromFile !== setupBunSteps) {
  workflowProblems.push(
    `ci.yml has ${setupBunSteps} setup-bun step(s) but ${fromFile} read .bun-version — every one of them must.`,
  );
}

if (drifted.length > 0 || workflowProblems.length > 0) {
  console.error(`✗ Bun version drift — .bun-version pins ${expected}, but:`);
  for (const s of drifted) {
    console.error(
      `    ${s.label} = ${s.actual ?? "(missing)"} (expected ${s.expected})`,
    );
  }
  for (const problem of workflowProblems) console.error(`    ${problem}`);
  console.error(
    "  → update the drifted surface(s), or bump .bun-version and all of them together.",
  );
  process.exit(1);
}

console.log(
  `✓ Bun ${expected} pinned consistently: ${setupBunSteps} CI step(s) read .bun-version, and ${surfaces.length} declaration(s) agree with it.`,
);
