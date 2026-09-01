#!/usr/bin/env bun
/**
 * Proves the ONE required status check actually gates every job in `ci.yml`.
 *
 * WHY THIS EXISTS
 * ---------------
 * The ruleset in `scripts/repo-settings.sh` requires exactly one status check
 * on the default branch. That job is `if: always()` and decides pass/fail by
 * reading `toJSON(needs)` — so its verdict covers precisely the jobs listed in
 * its hand-maintained `needs:` array, and NOTHING else. A job missing from that
 * list still runs, still goes red, and still cannot fail the merge: it is
 * invisible to the only check anyone requires.
 *
 * That is the worst failure mode a gate can have. It does not break — it stops
 * gating, silently, and every pull request keeps showing green. Nothing in
 * GitHub Actions warns about it, because a `needs:` list that omits a job is
 * perfectly valid YAML and a perfectly valid workflow. The omission is visible
 * only to someone diffing two lists by eye, which is exactly the review step
 * that gets skipped when a job is being added under time pressure.
 *
 * So: diff the two lists mechanically, on `bun run check` and in CI.
 *
 * IT HARDCODES NOTHING ABOUT WHICH JOBS EXIST, INCLUDING THE GATE'S OWN NAME.
 * Both sides of the diff are derived from the workflow at runtime, and the
 * aggregate job is located by the status-check context declared in
 * `scripts/repo-settings.sh` (`GATE_JOB`) rather than by a name written here.
 * That is deliberate: the aggregate job's identity IS the required check, so
 * the one place that already has to be right is the one place to read it from.
 * Rename the job and the context together and this check follows; rename one
 * without the other and it fails, which is the failure you want.
 *
 * WHY A HAND-ROLLED PARSE AND NOT A YAML LIBRARY
 * ----------------------------------------------
 * There is no YAML parser in this repository's dependencies, and adding one so
 * that a gate can read one file would make the gate fail the day that
 * dependency moves. The parse below is deliberately narrow: it reads job keys,
 * job names and one `needs:` list out of a file whose shape this repository
 * controls, and it hard-errors rather than guesses when the file does not look
 * the way it expects. A parse that silently returns nothing is a gate that
 * silently passes, which is the bug this file is about.
 *
 * WHAT IT CANNOT SEE: `needs:` reaches inside one workflow file only, so this
 * check speaks for `ci.yml` and nothing else. The other workflows in
 * `.github/workflows/` are listed in the output for exactly that reason — see
 * `otherWorkflows()` below.
 *
 * Exit codes: 0 — every job is gated; 1 — a job is un-gated, or the workflow
 * could not be read in the shape this check requires.
 *
 * Usage: bun run check:ci-aggregator [--job=<name-or-key>]
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib/root";

const REPO_ROOT = ROOT;

const WORKFLOW = ".github/workflows/ci.yml";
const WORKFLOW_DIR = ".github/workflows";
const SETTINGS = "scripts/repo-settings.sh";

/**
 * Jobs deliberately outside the gate, each with the reason it is outside.
 *
 * EMPTY IS THE CORRECT STATE, and an entry here is a hole in the required
 * check that someone signed for. It is an allowlist rather than a silent
 * omission so that the hole is a line in a diff with a name on it.
 *
 * Note what does NOT belong here: a job that a `paths:` filter skips on most
 * pull requests. The gate treats `skipped` as a pass, so a path-filtered job is
 * already gated — it is in `needs:`, and it fails the gate on the runs where it
 * actually executes. Excluding it would remove it on the runs that matter.
 */
const UNGATED: ReadonlyArray<{ job: string; reason: string }> = [];

/** Job keys sit at exactly two spaces under the top-level `jobs:` mapping. */
const JOB_KEY = /^ {2}([A-Za-z0-9_-]+):[ \t]*(#.*)?$/;

/** `    name:` / `    needs:` / … — a job property, so exactly four spaces. */
const JOB_PROP = /^ {4}([A-Za-z0-9_-]+):[ \t]*(.*)$/;

/** `      - job-name` — a sequence item under `needs:`, six spaces. */
const NEEDS_ITEM = /^ {6}-[ \t]+([A-Za-z0-9_-]+)[ \t]*(#.*)?$/;

/** A block-scalar indicator (`run: |`, `run: >-`, …) opens literal content. */
const BLOCK_SCALAR = /^\s*[^#\s][^\n]*[|>][-+]?\d*[ \t]*$/;

/** `GATE_JOB="gate"` in scripts/repo-settings.sh. */
const GATE_JOB = /^GATE_JOB=["']?([^"'#\n]+?)["']?[ \t]*(#.*)?$/m;

export class WorkflowParseError extends Error {}

export type WorkflowJob = {
  /** The mapping key under `jobs:`. What `needs:` entries refer to. */
  key: string;
  /** The display name — what GitHub reports as the status-check context. */
  name: string;
  /** Job keys listed in `needs:`. */
  needs: string[];
  /** Whether a `needs:` key appeared at all, as distinct from an empty one. */
  declaresNeeds: boolean;
};

/**
 * The `jobs:` block as `[lineIndex, text]` pairs, with every block-scalar body
 * (the shell in `run:` steps) removed.
 *
 * Stripping block scalars is the whole reason this is a state machine and not a
 * grep: a `run: |` body is arbitrary text, and a two-space-indented shell line
 * ending in a colon inside one would otherwise read as a job key.
 */
function jobsBlockLines(source: string): Array<[number, string]> {
  const lines = source.split("\n");

  const jobsAt = lines.findIndex((line) => /^jobs:[ \t]*(#.*)?$/.test(line));
  if (jobsAt === -1) {
    throw new WorkflowParseError("no top-level `jobs:` mapping found");
  }

  const out: Array<[number, string]> = [];
  let blockIndent: number | null = null;

  for (let i = jobsAt + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const indent = line.length - line.trimStart().length;
    const blank = line.trim() === "";

    // Inside a block scalar: every more-indented line, and every blank line, is
    // opaque content rather than structure.
    if (blockIndent !== null) {
      if (blank || indent > blockIndent) continue;
      blockIndent = null;
    }

    // A column-0 key ends the `jobs:` block. A trailing top-level comment does
    // not, since comments carry no indentation of their own.
    if (!blank && indent === 0 && !line.startsWith("#")) break;

    if (blank) continue;
    if (line.trimStart().startsWith("#")) continue;

    if (BLOCK_SCALAR.test(line)) {
      blockIndent = indent;
      continue;
    }

    out.push([i, line]);
  }

  return out;
}

/** `"CI Success"` / `'gate'` / `gate` → `gate`. */
function scalar(raw: string): string {
  return raw.trim().replace(/^["']|["']$/g, "");
}

/**
 * Every job in the workflow, in file order, with its display name and `needs:`.
 *
 * A job with no `name:` is reported under its key, which is what GitHub does —
 * the status-check context of an unnamed job is its key.
 */
export function parseJobs(source: string): WorkflowJob[] {
  const block = jobsBlockLines(source);

  const jobs: WorkflowJob[] = [];
  let current: WorkflowJob | null = null;
  let collectingNeeds = false;

  for (const [, line] of block) {
    const key = line.match(JOB_KEY)?.[1];
    if (key) {
      current = { key, name: key, needs: [], declaresNeeds: false };
      collectingNeeds = false;
      jobs.push(current);
      continue;
    }
    if (!current) continue;

    const prop = line.match(JOB_PROP);
    if (prop) {
      const [, property = "", rest = ""] = prop;

      if (property === "needs") {
        current.declaresNeeds = true;
        collectingNeeds = true;

        // Inline flow form: `needs: [a, b]`.
        const inline = rest.trim();
        if (inline.startsWith("[")) {
          for (const raw of inline.replace(/^\[|\][ \t]*$/g, "").split(",")) {
            const name = scalar(raw);
            if (name) current.needs.push(name);
          }
          collectingNeeds = false;
        }
        continue;
      }

      // Any other job property ends a block-form `needs:` list.
      collectingNeeds = false;
      if (property === "name") current.name = scalar(rest) || current.key;
      continue;
    }

    if (collectingNeeds) {
      const item = line.match(NEEDS_ITEM)?.[1];
      if (item) current.needs.push(item);
    }
  }

  if (jobs.length === 0) {
    throw new WorkflowParseError(
      "parsed zero jobs — the parse is wrong, not the workflow",
    );
  }

  return jobs;
}

/**
 * The required status-check context, read from `scripts/repo-settings.sh`.
 *
 * That script is the declared source of truth for branch protection, so it is
 * also the source of truth for which job the gate is. Reading it here is what
 * keeps this check from carrying a third copy of the name.
 */
export function requiredContext(settingsSource: string): string {
  const context = settingsSource.match(GATE_JOB)?.[1];
  if (!context) {
    throw new WorkflowParseError(
      `no \`GATE_JOB=\` assignment found in ${SETTINGS}`,
    );
  }
  return scalar(context);
}

export type Audit = {
  /** The aggregate job, or null when the required context matches no job. */
  aggregator: WorkflowJob | null;
  /** Job keys the aggregator gates, in file order. */
  gated: string[];
  /** One line per finding. Empty means the gate covers everything. */
  problems: string[];
};

/**
 * Diffs the workflow's job keys against the aggregate job's `needs:` list.
 *
 * The aggregate job is EXCLUDED from its own expected set. A job cannot
 * `needs:` itself — GitHub rejects the workflow outright — so a naive key-set
 * comparison reports the gate as un-gated on every single run.
 */
export function audit(options: {
  jobs: WorkflowJob[];
  context: string;
  ungated?: ReadonlyArray<{ job: string; reason: string }>;
}): Audit {
  const { jobs, context } = options;
  const ungated = options.ungated ?? UNGATED;
  const problems: string[] = [];

  const keys = new Set(jobs.map((job) => job.key));

  // Match on the display name first, since that is the status-check context;
  // fall back to the key so that `--job=` accepts either spelling.
  const aggregator =
    jobs.find((job) => job.name === context) ??
    jobs.find((job) => job.key === context) ??
    null;

  if (!aggregator) {
    problems.push(
      `no job in ${WORKFLOW} is named \`${context}\`, which is the required ` +
        `status check. Either the job was renamed without updating ` +
        `${SETTINGS}, or the reverse — and until they agree, the required ` +
        `check is a context nothing reports.`,
    );
    return { aggregator: null, gated: [], problems };
  }

  if (!aggregator.declaresNeeds || aggregator.needs.length === 0) {
    problems.push(
      `\`${aggregator.key}\` has no parseable \`needs:\` list. With an empty ` +
        `needs list the required check gates NOTHING at all.`,
    );
    return { aggregator, gated: [], problems };
  }

  const excused = new Map(ungated.map((entry) => [entry.job, entry.reason]));
  const has = new Set(aggregator.needs);

  const expected = jobs
    .filter((job) => job.key !== aggregator.key && !excused.has(job.key))
    .map((job) => job.key);

  for (const job of expected) {
    if (!has.has(job)) {
      problems.push(
        `job \`${job}\` is NOT in \`${aggregator.key}.needs\` — it can never ` +
          `fail the required check.`,
      );
    }
  }

  for (const entry of aggregator.needs) {
    if (!keys.has(entry)) {
      problems.push(
        `\`${aggregator.key}.needs\` lists \`${entry}\`, which is not a job ` +
          `in this workflow — a stale entry that makes the whole workflow ` +
          `invalid.`,
      );
    }
  }

  // An exemption that has outlived its subject is worse than none: it reads as
  // a considered decision about a job that no longer exists.
  for (const [job] of excused) {
    if (!keys.has(job)) {
      problems.push(
        `\`UNGATED\` excuses \`${job}\`, which is not a job in ${WORKFLOW} — ` +
          `delete the entry.`,
      );
    } else if (has.has(job)) {
      problems.push(
        `\`UNGATED\` excuses \`${job}\`, but \`${aggregator.key}.needs\` ` +
          `lists it anyway — delete the entry, it describes nothing.`,
      );
    }
  }

  return { aggregator, gated: expected, problems };
}

/**
 * The other workflow files, which this check cannot speak for.
 *
 * `needs:` does not reach across files, so a required context contributed by
 * another workflow would be entirely invisible here. Today the ruleset requires
 * exactly one context and `ci.yml` provides it — `scripts/repo-settings.sh`
 * asserts that in its `--check` mode — but the day that stops being true, this
 * output should already have named the files nobody checked.
 */
export function otherWorkflows(dir: string): string[] {
  return readdirSync(dir)
    .filter((file) => /\.ya?ml$/.test(file))
    .filter((file) => join(WORKFLOW_DIR, file) !== WORKFLOW)
    .sort();
}

function fail(message: string): never {
  console.error(`[check-ci-aggregator] ${message}`);
  process.exit(1);
}

function read(relative: string): string {
  try {
    return readFileSync(join(REPO_ROOT, relative), "utf8");
  } catch {
    fail(`ERROR: cannot read ${relative}.`);
  }
}

export function main(argv: string[] = Bun.argv.slice(2)): never {
  const override =
    argv.find((arg) => arg.startsWith("--job="))?.slice("--job=".length) ??
    process.env["CI_AGGREGATOR_JOB"];

  let context: string;
  let jobs: WorkflowJob[];
  try {
    context = override?.trim() || requiredContext(read(SETTINGS));
    jobs = parseJobs(read(WORKFLOW));
  } catch (error) {
    if (error instanceof WorkflowParseError) fail(`ERROR: ${error.message}.`);
    throw error;
  }

  const { aggregator, gated, problems } = audit({ jobs, context });

  if (problems.length === 0 && aggregator) {
    console.log(
      `[check-ci-aggregator] ✓ "${aggregator.name}" (${aggregator.key}) ` +
        `gates all ${gated.length} job(s) in ${WORKFLOW}.`,
    );
    for (const job of gated) console.log(`    ${job}`);
    for (const { job, reason } of UNGATED) {
      console.log(`  ungated by allowlist: ${job} — ${reason}`);
    }
    const others = otherWorkflows(join(REPO_ROOT, WORKFLOW_DIR));
    if (others.length > 0) {
      console.log("");
      console.log(`  Scope: ${WORKFLOW} only.`);
      console.log("  `needs:` does not reach across workflow files, so this");
      console.log(`  says nothing about ${others.join(", ")}.`);
      console.log(
        `  The ruleset requires exactly one context ("${aggregator.name}"),`,
      );
      console.log(`  which this workflow provides — see ${SETTINGS}.`);
    }
    process.exit(0);
  }

  console.error(`[check-ci-aggregator] FAIL — ${WORKFLOW}`);
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error("");
  console.error(
    `  "${context}" is the ONLY required status check on the default branch,`,
  );
  console.error("  and it can only fail on a job it `needs:`. Fix it here:");
  console.error(
    aggregator
      ? `    ${WORKFLOW} → ${aggregator.key}: → needs:`
      : `    ${WORKFLOW}, or GATE_JOB in ${SETTINGS} — the two disagree.`,
  );
  process.exit(1);
}

if (import.meta.main) main();
