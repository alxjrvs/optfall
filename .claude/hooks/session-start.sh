#!/bin/bash
#
# Install dependencies so a fresh clone can actually run anything.
#
# WHY THIS EXISTS. Nothing in this repository works from a clean checkout until
# `bun install` has run, and that is not obvious from the outside: `bun test`
# needs `@happy-dom/global-registrator`, `react`, `react-dom`, `axe-core` and
# `jsdom`; `lint` and `format:check` need Biome; `typecheck` needs TypeScript.
# Every one of them is a devDependency. Without this hook, a web session's first
# `bun run check` fails on a missing module rather than on anything real.
#
# Nothing else needs to run. `bunfig.toml` has no `[test] preload` — it
# documents that the old one was deleted in Phase 6 and that `bun test` now
# works from any directory — and no codegen step gates the suite.
#
# --frozen-lockfile, DELIBERATELY. A plain `bun install` may rewrite `bun.lock`,
# which would leave every session starting with a dirty tree in a repository
# whose entire doctrine is exact pinning. It is also what all six CI jobs run,
# so a session installs what the gate installs. If the lockfile is genuinely out
# of sync this fails loudly, which `ci.yml` argues is the correct outcome: "the
# only thing an `else` could ever do is let a pull request that DELETES the
# lockfile silently downgrade every job to an unpinned install and still go
# green".
#
# Synchronous rather than async. The first thing a session here does is usually
# `bun run check`, so finishing the install before the agent starts is worth
# more than a faster start — an async install races exactly the command most
# likely to be run first.

set -euo pipefail

# Local machines already have their own toolchain and their own opinions about
# when to install. This is for Claude Code on the web.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

echo "optfall: installing dependencies (bun install --frozen-lockfile)…"
bun install --frozen-lockfile

echo "optfall: ready. \`bun run check\` is the loop; \`bun run check:full\` is the gate."
