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
const deployWorkflow = read(".github/workflows/deploy-cloudflare.yml");
const setupAction = read(".github/actions/setup/action.yml");

/*
  THE PIN MOVED INTO A COMPOSITE ACTION, SO THIS FOLLOWS IT — and then asserts
  the move was total.

  `ci.yml` and `deploy-cloudflare.yml` used to carry ten and two copies of the
  setup-bun step respectively; they now call `.github/actions/setup`. Scanning
  only `ci.yml`, as this did, would find zero setup-bun steps and report that
  the workflow had stopped reading `.bun-version` at all.

  The consolidation also creates a NEW way to go wrong that did not exist when
  every job spelled it out: a single job quietly reintroducing its own
  setup-bun with a different pin, while the composite action keeps the other
  eleven honest and this check keeps passing. So the workflows are asserted to
  contain none, rather than merely not counted.
*/
const setupBunSteps =
  setupAction.match(/uses:[ \t]*oven-sh\/setup-bun@/g)?.length ?? 0;
const fromFile =
  setupAction.match(/^[ \t]*bun-version-file:[ \t]*\.bun-version[ \t]*$/gm)
    ?.length ?? 0;

const strayWorkflows = (
  [
    [".github/workflows/ci.yml", workflow],
    [".github/workflows/deploy-cloudflare.yml", deployWorkflow],
  ] as const
).filter(([, text]) => /uses:[ \t]*oven-sh\/setup-bun@/.test(text));
// `[ \t]` rather than `\s`, deliberately: `\s` crosses newlines, so the job
// named `bun-version:` below matched as a hardcoded pin whose "value" was the
// `name:` on the next line.
const hardcoded = [workflow, deployWorkflow, setupAction].flatMap(
  (text) => text.match(/^[ \t]*bun-version:[ \t]*\S+/gm) ?? [],
);

const workflowProblems: string[] = [];

for (const [name] of strayWorkflows) {
  workflowProblems.push(
    `${name} uses setup-bun directly — \`.github/actions/setup\` is the only place it belongs, so that one pin governs every job.`,
  );
}
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

/*
  THE RUNNING BINARY, WHICH THIS SCRIPT USED TO IGNORE ENTIRELY.

  Everything above compares DECLARATIONS to each other: `.bun-version`,
  `engines.bun`, the `@types/bun` pin, the setup-bun steps. All of them can
  agree perfectly while the Bun actually executing is a different version — and
  on 2026-09-01 that was exactly the case, with this check reporting success on
  a 1.3.11 runtime against a 1.4.0 pin.

  `ci.yml` states the risk this is supposed to cover: "Bun here is the runtime,
  the test runner and the script runner, so a laptop on a different Bun runs
  different tests — not merely a different install resolution." That is a claim
  about the binary, and nothing was checking the binary.

  IT WARNS RATHER THAN FAILS, and that is deliberate. A hard failure would make
  every `bun run check` unusable the moment someone's toolchain lags a patch
  release, including in a container they do not control — which is how a check
  gets commented out rather than fixed. CI pins exactly via setup-bun, so the
  gate is unaffected either way; what this buys is that a local run says so out
  loud instead of quietly testing something else.
*/
const running = Bun.version;
if (running !== expected) {
  console.warn(`⚠ Running Bun ${running}, but .bun-version pins ${expected}.`);
  console.warn(
    "  Declarations agree with each other; the binary executing this does not.",
  );
  console.warn(
    "  CI uses the pin, so the gate is unaffected — but local results here are",
  );
  console.warn(
    `  from ${running}, and the test runner is part of what the pin exists for.`,
  );
}

console.log(
  `✓ Bun ${expected} pinned consistently: ${setupBunSteps} CI step(s) read .bun-version, ${surfaces.length} declaration(s) agree with it, and the running binary is ${running}.`,
);
