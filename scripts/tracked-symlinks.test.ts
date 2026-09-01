/**
 * No tracked file may be a symlink that points outside the repository.
 *
 * WHY THIS EXISTS, AND IT IS A SPECIFIC INCIDENT RATHER THAN A PRINCIPLE.
 * Three symlinks were committed to a branch in this repository:
 *
 *   node_modules                     -> /home/user/optfall/node_modules
 *   apps/site/node_modules           -> /home/user/optfall/apps/site/node_modules
 *   packages/components/node_modules -> /home/user/optfall/packages/components/node_modules
 *
 * They were made inside an agent worktree so the suite could run against the
 * root install instead of paying for a second one, and then swept in by
 * `git add -A`. Every CI job with an install step broke; the four jobs that
 * only run `setup-bun` passed. That split is a confusing signature to read
 * from the outside, and it cost three re-runs and a wrong diagnosis of
 * "runner incident" before anybody looked at the tree.
 *
 * `.gitignore` COULD NOT HAVE CAUGHT IT, which is the part that makes a test
 * worth having rather than a fixed ignore rule alone. The pattern was
 * `node_modules/`, and a trailing slash matches DIRECTORIES ONLY — a symlink
 * is a file. That is fixed too, in the same change, but the ignore rule only
 * covers this one name. This covers the class: any absolute symlink, under any
 * name, is a path that exists on exactly one machine.
 *
 * RELATIVE SYMLINKS INSIDE THE TREE ARE FINE and are deliberately allowed —
 * nothing here uses one today, but they are portable and there is no reason to
 * forbid them. What cannot survive a clone is a target that leaves the
 * repository, and that is what this refuses.
 */

import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

/**
 * The repository root, resolved from THIS FILE rather than from the working
 * directory, so the test means the same thing wherever it is run from.
 *
 * Spelled inline rather than imported from `scripts/lib/root.ts`, which does
 * not exist on this branch yet — it arrives with the consolidation wave. When
 * it does, this should import it instead of keeping a second copy.
 *
 * `fileURLToPath` rather than `new URL(...).pathname`: the latter is
 * percent-encoded, so a checkout under a path with a space in it yields a
 * directory `git` cannot find.
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");

/** One tracked symlink: where it lives, and the blob id holding its target. */
interface TrackedLink {
  readonly path: string;
  readonly blob: string;
}

/**
 * Every tracked symlink, read from the INDEX rather than from `HEAD`.
 *
 * THE BLOB ID IS CARRIED ALONG BECAUSE `git show HEAD:<path>` IS THE WRONG
 * SOURCE, and this test caught itself getting that wrong: a symlink that is
 * STAGED but not yet committed does not exist in `HEAD`, so `git show` fails,
 * the target reads as empty, and the check silently passes on exactly the file
 * somebody is about to commit. `git ls-files -s` already prints the blob id
 * for the staged content; reading that covers both states.
 */
function trackedSymlinks(): readonly TrackedLink[] {
  const listed = Bun.spawnSync({
    cmd: ["git", "ls-files", "-s"],
    cwd: ROOT,
  });
  if (listed.exitCode !== 0) {
    throw new Error(
      `git ls-files failed, so this test scanned nothing. A pass over zero files is not a pass.`,
    );
  }
  return listed.stdout
    .toString()
    .split("\n")
    .filter((line) => line.startsWith("120000 "))
    .flatMap((line) => {
      /* `<mode> <sha> <stage>\t<path>` — split on the tab, because a path may
         legitimately contain spaces. */
      const tab = line.indexOf("\t");
      const blob = line.split(" ")[1] ?? "";
      const path = tab === -1 ? "" : line.slice(tab + 1);
      return path === "" || blob === "" ? [] : [{ path, blob }];
    });
}

/** What a tracked symlink points at, read out of its blob. */
function targetOf(link: TrackedLink): string {
  const shown = Bun.spawnSync({
    cmd: ["git", "cat-file", "blob", link.blob],
    cwd: ROOT,
  });
  return shown.stdout.toString().trim();
}

describe("tracked symlinks", () => {
  const symlinks = trackedSymlinks();

  test("the scan ran against a real repository", () => {
    /* `git ls-files` returning nothing would make every assertion below
       vacuous, and this repository has thousands of tracked files. */
    const all = Bun.spawnSync({ cmd: ["git", "ls-files"], cwd: ROOT });
    expect(all.stdout.toString().split("\n").length).toBeGreaterThan(100);
  });

  test("none of them points outside the repository", () => {
    /* Reported as `path -> target` rather than as a count, because the person
       reading this failure needs to know which link and where it goes. */
    const escaping = symlinks
      .map((link) => ({ path: link.path, target: targetOf(link) }))
      .filter((link) => link.target.startsWith("/"))
      .map((link) => `${link.path} -> ${link.target}`);

    expect(escaping).toEqual([]);
  });

  test("no dependency directory is tracked at all", () => {
    /* The specific shape that caused the incident, asserted by name as well as
       by class: a `node_modules` entry of ANY kind — symlink, file or
       directory — is never something this repository should carry. */
    const tracked = Bun.spawnSync({
      cmd: ["git", "ls-files", "--", "node_modules", "*/node_modules"],
      cwd: ROOT,
    });
    expect(tracked.stdout.toString().trim()).toBe("");
  });
});
