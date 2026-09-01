/**
 * Where the repository is, and how to name a file inside it.
 *
 * FIFTEEN SCRIPTS SPELLED THIS FIVE DIFFERENT WAYS, and two of the spellings
 * were wrong:
 *
 *   new URL("..", import.meta.url).pathname
 *   new URL("..", import.meta.url).pathname.replace(/\/$/, "")
 *
 * `URL.pathname` is PERCENT-ENCODED. A checkout under a path containing a
 * space — `/Users/alx/My Projects/optfall` — yields `/Users/alx/My%20Projects/
 * optfall`, and every `readFileSync` beneath it fails with an ENOENT naming a
 * path that visibly exists. Non-ASCII characters do the same.
 *
 * That is not hypothetical here. This project does its agent work in
 * `.claude/worktrees/`, which is one `git worktree add` away from a directory
 * name someone typed with a space in it.
 *
 * `fileURLToPath` exists precisely to decode it, and three scripts in the same
 * directory already used it. This module is that spelling, once.
 */

import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The repository root, as an absolute filesystem path with no trailing slash.
 *
 * `fileURLToPath` on a directory URL returns a trailing separator; callers
 * joining onto it do not want one, and `join` would swallow it anyway — but a
 * path that is sometimes `/repo` and sometimes `/repo/` compares unequal to
 * itself, which is the kind of thing that costs an hour.
 */
export const ROOT = fileURLToPath(new URL("../..", import.meta.url)).replace(
  /\/$/,
  "",
);

/**
 * A path inside the repository, from segments relative to its root.
 *
 * `repoFile("data", "cards", "sample.json")` and
 * `repoFile("data/cards/sample.json")` are the same thing; `join` flattens
 * either shape.
 */
export function repoFile(...segments: readonly string[]): string {
  return join(ROOT, ...segments);
}
