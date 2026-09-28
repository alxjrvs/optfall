#!/bin/bash
#
# Give a Claude Code on the web session the pinned Bun and the dependencies.
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
# THE PINNED BUN, FROM NPM. The cloud image ships a Bun of its own, and
# `.bun-version` is the one CI builds, tests and reads `bun.lock` with. The
# session's proxy answers 403 for release assets of repositories the session is
# not attached to, so oven-sh/bun's GitHub releases are out, and bun.sh is not
# on its Trusted list. The npm registry is, and `bun@<version>` there is the
# same release. It goes into a prefix of its own and onto PATH through
# `$CLAUDE_ENV_FILE`, which Claude Code sources before every Bash call.
#
# --frozen-lockfile, DELIBERATELY. A plain `bun install` may rewrite `bun.lock`,
# which would leave every session starting with a dirty tree in a repository
# whose entire doctrine is exact pinning. It is also what CI runs, so a session
# installs what the gate installs. If the lockfile is genuinely out of sync this
# fails, which `.github/actions/setup` argues is the correct outcome: "the only
# thing an `else` could ever do is let a pull request that DELETES the lockfile
# silently downgrade every job to an unpinned install and still go green".
#
# ONE RETRY, AGAINST THE NPM REGISTRY. Bun has known problems with the cloud
# proxy (https://code.claude.com/docs/en/cloud-environments). A failed install
# is retried once with registry.npmjs.org named explicitly and the system CA
# bundle as its roots, since Bun otherwise ships its own. The retry is still
# `--frozen-lockfile`, so it is not the unpinned `else` quoted above.
#
# NEVER BLOCKS THE SESSION. Every failure is printed to stdout, which Claude
# reads at session start, and the hook exits 0: a session that starts and says
# why nothing runs is better than one that does not start.
#
# Synchronous rather than async. The first thing a session here does is usually
# `bun run check`, so finishing the install before the agent starts is worth
# more than a faster start — an async install races exactly the command most
# likely to be run first.

set -uo pipefail

# Local machines already have their own toolchain and their own opinions about
# when to install. This is for Claude Code on the web.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

say() { echo "optfall: $*"; }
log="$(mktemp "${TMPDIR:-/tmp}/optfall-session-start.XXXXXX")" || exit 0
trap 'rm -f "$log"' EXIT
tail_log() { tail -15 "$log" | sed 's/^/optfall:   /'; }

want=""
[ -f .bun-version ] && want="$(tr -d '[:space:]' <.bun-version)"
have="$(bun --version 2>/dev/null || echo none)"
if [ -n "$want" ] && [ "$have" != "$want" ]; then
  prefix="$HOME/.local/share/optfall-bun/$want"
  if [ ! -x "$prefix/bin/bun" ]; then
    say "Bun $have here, .bun-version pins $want; installing it from npm…"
    npm install --global --prefix "$prefix" --no-audit --no-fund \
      --loglevel=error "bun@$want" >"$log" 2>&1 || tail_log
  fi
  if [ "$("$prefix/bin/bun" --version 2>/dev/null)" = "$want" ]; then
    export PATH="$prefix/bin:$PATH"
    line="export PATH=\"$prefix/bin:\$PATH\""
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      grep -qxF "$line" "$CLAUDE_ENV_FILE" 2>/dev/null ||
        echo "$line" >>"$CLAUDE_ENV_FILE"
    else
      say "CLAUDE_ENV_FILE is unset, so later commands see Bun $have."
      say "Run this first: $line"
    fi
  else
    say "could not install Bun $want from npm; carrying on with Bun $have."
  fi
fi

# Skip the install when node_modules was built from this exact bun.lock. A
# resume, /clear or compaction runs this hook again, and the stamp lives inside
# node_modules, so deleting the tree clears it.
stamp=node_modules/.optfall-lockhash
lockhash="$({ sha256sum bun.lock || shasum -a 256 bun.lock; } 2>/dev/null |
  cut -d' ' -f1)"
if [ -n "$lockhash" ] && [ "$(cat "$stamp" 2>/dev/null)" = "$lockhash" ]; then
  exit 0
fi

say "installing dependencies (bun install --frozen-lockfile)…"
if bun install --frozen-lockfile >"$log" 2>&1; then
  installed=true
else
  say "bun install failed; retrying against registry.npmjs.org…"
  set -- --frozen-lockfile --registry=https://registry.npmjs.org/
  ca=/etc/ssl/certs/ca-certificates.crt
  [ -f "$ca" ] && set -- "$@" --cafile="$ca"
  bun install "$@" >"$log" 2>&1 && installed=true
fi

if [ "${installed:-}" = true ]; then
  [ -n "$lockhash" ] && echo "$lockhash" >"$stamp"
  say "ready. \`bun run check\` is the loop; \`bun run check:full\` the gate."
else
  say "bun install --frozen-lockfile FAILED twice. Last lines:"
  tail_log
  say "nothing that needs node_modules will run until it succeeds."
fi
exit 0
