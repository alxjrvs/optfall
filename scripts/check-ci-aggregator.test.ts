/**
 * The aggregate-gate check, exercised against fixtures AND against this
 * repository's own workflow.
 *
 * THE REAL-FILE CASE AT THE BOTTOM IS THE POINT OF THE FILE. It is what puts
 * this check inside the `test` job, which is itself in `gate`'s `needs:` list —
 * so a pull request that adds a job to `ci.yml` without wiring it into the gate
 * goes red in the fastest job in the workflow, minutes before the gate itself
 * gets a chance to say the same thing.
 *
 * The fixtures cover the two traps that make a naive version of this check
 * useless. The first is that the aggregate job must be excluded from its own
 * diff — a job cannot `needs:` itself, so a plain key-set comparison reports
 * the gate as un-gated on every run, and a check that fails on a correct
 * workflow gets deleted within the week. The second is that the aggregate job
 * is found by the required status-check CONTEXT, which is its display name and
 * not its key; those are the same string today and will not be after the job is
 * renamed to "CI Success".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib/root";

import { describe, expect, test } from "bun:test";

import {
  audit,
  otherWorkflows,
  parseJobs,
  requiredContext,
  WorkflowParseError,
} from "./check-ci-aggregator";

const REPO_ROOT = ROOT;

const read = (relative: string) =>
  readFileSync(join(REPO_ROOT, relative), "utf8");

/** A workflow with two real jobs and an aggregate one, in block `needs:` form. */
const WORKFLOW = `name: CI

on:
  pull_request:

jobs:
  typecheck:
    name: typecheck
    runs-on: ubuntu-latest
    steps:
      - name: Typecheck
        run: bun run typecheck

  lint:
    name: lint
    runs-on: ubuntu-latest
    steps:
      - name: Write a script whose body looks like a job mapping
        run: |
          set -euo pipefail
          impostor:
            echo "still shell"

      - name: Lint
        run: bun run lint

  gate:
    name: gate
    runs-on: ubuntu-latest
    if: always()
    needs:
      - typecheck
      - lint
    steps:
      - name: Aggregate
        run: echo ok
`;

/** The same shape after the rename in #132: key and display name differ. */
const RENAMED = WORKFLOW.replace(
  "  gate:\n    name: gate",
  "  ci-success:\n    name: CI Success",
);

describe("parseJobs", () => {
  test("reads every job key, its display name, and its needs", () => {
    const jobs = parseJobs(WORKFLOW);

    expect(jobs.map((job) => job.key)).toEqual(["typecheck", "lint", "gate"]);
    expect(jobs.map((job) => job.name)).toEqual(["typecheck", "lint", "gate"]);
    expect(jobs.at(-1)?.needs).toEqual(["typecheck", "lint"]);
  });

  test("does not read shell inside a block scalar as a job", () => {
    /* THE REGRESSION A GREP WOULD HAVE. `impostor:` above is indented two
       spaces inside a `run: |` body, which is exactly a job key's shape. */
    expect(parseJobs(WORKFLOW).map((job) => job.key)).not.toContain("impostor");
  });

  test("reads the inline flow form of needs", () => {
    const inline = WORKFLOW.replace(
      "    needs:\n      - typecheck\n      - lint\n",
      "    needs: [typecheck, lint]\n",
    );

    expect(parseJobs(inline).at(-1)?.needs).toEqual(["typecheck", "lint"]);
  });

  test("reports a job with no `name:` under its key, as GitHub does", () => {
    const unnamed = WORKFLOW.replace("  lint:\n    name: lint\n", "  lint:\n");

    expect(parseJobs(unnamed).find((job) => job.key === "lint")?.name).toBe(
      "lint",
    );
  });

  test("refuses to report zero jobs as a pass", () => {
    /* A parse that silently returns nothing is a gate that silently passes. */
    expect(() => parseJobs("name: CI\non:\n  pull_request:\n")).toThrow(
      WorkflowParseError,
    );
  });
});

describe("requiredContext", () => {
  test("reads GATE_JOB out of the settings script", () => {
    expect(requiredContext('set -euo pipefail\nGATE_JOB="gate"\n')).toBe(
      "gate",
    );
    expect(requiredContext('GATE_JOB="CI Success" # the context\n')).toBe(
      "CI Success",
    );
  });

  test("throws rather than guessing when the assignment is gone", () => {
    expect(() => requiredContext("set -euo pipefail\n")).toThrow(
      WorkflowParseError,
    );
  });
});

describe("audit", () => {
  const context = "gate";

  test("passes a workflow whose gate needs every other job", () => {
    const { problems, gated } = audit({ jobs: parseJobs(WORKFLOW), context });

    /* THE FIRST TRAP: the gate is excluded from its own expected set. A job
       cannot `needs:` itself, so counting it here fails every correct run. */
    expect(problems).toEqual([]);
    expect(gated).toEqual(["typecheck", "lint"]);
  });

  test("fails on a job that is not in needs", () => {
    const added = WORKFLOW.replace(
      "  gate:",
      "  test:\n    name: test\n    runs-on: ubuntu-latest\n    steps:\n      - run: bun test\n\n  gate:",
    );

    const { problems } = audit({ jobs: parseJobs(added), context });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("`test` is NOT in `gate.needs`");
  });

  test("fails on a stale needs entry naming no job", () => {
    const stale = WORKFLOW.replace(
      "      - lint\n",
      "      - lint\n      - gone\n",
    );

    const { problems } = audit({ jobs: parseJobs(stale), context });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("`gone`");
  });

  test("fails on a gate with no needs at all", () => {
    const empty = WORKFLOW.replace(
      "    needs:\n      - typecheck\n      - lint\n",
      "",
    );

    const { problems } = audit({ jobs: parseJobs(empty), context });

    expect(problems[0]).toContain("gates NOTHING");
  });

  test("finds the gate by display name, not by key", () => {
    /* THE SECOND TRAP, and #132 is what triggers it: the required status-check
       context is the job's `name:`, which stops matching its key the moment
       the job is renamed to "CI Success". */
    const { aggregator, problems } = audit({
      jobs: parseJobs(RENAMED),
      context: "CI Success",
    });

    expect(aggregator?.key).toBe("ci-success");
    expect(problems).toEqual([]);
  });

  test("fails when the required context matches no job", () => {
    const { problems } = audit({
      jobs: parseJobs(WORKFLOW),
      context: "CI Success",
    });

    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("required status check");
  });

  test("honours the ungated allowlist, and rejects a stale entry", () => {
    const added = WORKFLOW.replace(
      "  gate:",
      "  optional:\n    name: optional\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n\n  gate:",
    );
    const jobs = parseJobs(added);

    expect(
      audit({ jobs, context, ungated: [{ job: "optional", reason: "why" }] })
        .problems,
    ).toEqual([]);

    /* An exemption naming a job that does not exist reads as a considered
       decision about nothing. */
    expect(
      audit({
        jobs,
        context,
        ungated: [{ job: "ghost", reason: "why" }],
      }).problems.join("\n"),
    ).toContain("`ghost`");

    /* And one contradicted by the needs list describes nothing at all. */
    expect(
      audit({
        jobs,
        context,
        ungated: [{ job: "lint", reason: "why" }],
      }).problems.join("\n"),
    ).toContain("lists it anyway");
  });
});

describe("this repository", () => {
  test("gates every job in ci.yml", () => {
    /* THE LIVE ASSERTION. This is the check itself, running in the `test` job —
       which is in `gate`'s own `needs:` list, so it cannot pass unnoticed. */
    const context = requiredContext(read("scripts/repo-settings.sh"));
    const jobs = parseJobs(read(".github/workflows/ci.yml"));

    const { aggregator, problems } = audit({ jobs, context });

    expect(problems).toEqual([]);
    expect(aggregator).not.toBeNull();
    expect(jobs.length).toBeGreaterThan(1);
  });

  test("names the workflows it cannot speak for", () => {
    /* `needs:` does not reach across files. The other workflows exist, and the
       output has to say so rather than implying full coverage. */
    const others = otherWorkflows(join(REPO_ROOT, ".github/workflows"));

    expect(others).not.toContain("ci.yml");
    expect(others).toContain("dependabot-auto-merge.yml");
  });
});
