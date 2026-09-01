# Contributing

Pull requests are welcome, including small ones. This file **routes** — where a
rule already lives somewhere that is checked, this points at it rather than
copying it, because a copy is one more thing to drift.

## The short version

```sh
bun install          # never npm, never yarn
bun run check        # ~25 s — the fast gate
bun run check:full   # ~2 min — REQUIRED if you touched rendered output
```

`bun run --cwd apps/site dev` serves the site.

**A green `bun run check` is not a green gate.** It covers nine of the twelve
things CI runs. The other three need a full 12,777-page build and only
`check:full` does them. If your change touches **rendered output, the
disclaimer, attribution or licence copy, or the token stylesheet**, run
`check:full` before you push.

## Read this before your first PR

`CLAUDE.md` at the repository root is the real map. It is named for the coding
agents that work here, but it is not agent-only configuration — it is where
every trap in this repository is written down, and a human contributor gets
more out of it than out of this file. Read it.

These are the ones that surprise people, with pointers rather than
explanations:

| If you are about to… | Read first |
|---|---|
| edit the disclaimer, attribution, credit or licence copy | [`docs/DISCLAIMER.md`](docs/DISCLAIMER.md) and [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) §4–§5 |
| let your editor sort imports | `CLAUDE.md` → "Never reorder imports" |
| tidy `card.legality["ll_restricted_affects_full_cycle"]` into dot access | `CLAUDE.md` → "Upstream field names stay verbatim" |
| add CSS to a page | `CLAUDE.md` → "Compose, never restyle" |
| write a colour or a length in a component | `CLAUDE.md` → "Tokens or nothing" — `check:tokens` fails the build |
| open `data/cards/cards.json` | don't — it is 18 MB. Use `data/cards/sample.json` |
| run anything under `bun run corpus:*` or `bun run symbols` | `CLAUDE.md` → "Never regenerate `data/`" — these hit the network and rewrite committed provenance |
| add a search operator, or a design-system primitive | the skills in `.claude/skills/` document every file that must move together |

### The one that catches everybody

**`docs/DISCLAIMER.md` is parsed programmatically.** The blockquote under
"Required disclaimer" is the specification, and five other places are asserted
against it character by character.

- **Reflowing it is safe.** Both sides of every comparison are
  whitespace-normalised, so line wrapping carries no meaning.
- **Changing a character is not** — a `®`, a `™`, any punctuation — and it will
  fail in five places at once.
- **Never put a blank line inside the blockquote.** It ends the extraction.

The wording is Legend Story Studios' requirement, not ours, and is not ours to
edit. If you think it needs to change, open an issue rather than a PR.

## House style

- **80 columns.** Biome formats at 80 and `format:check` is a gate.
  `.editorconfig` agrees; changing one means changing both.
- **The prose in this repository is load-bearing.** Do not strip explanatory
  comments to make a diff smaller. If a comment is wrong, fix it — that is a
  genuinely valuable PR.
- **Never assert what you have not just verified.** If you are about to write
  "enforced by X", a count, or a status, open X and confirm it first. This is
  the most common defect in this repository's history, and it applies to
  comments, docs and commit messages equally.

## Commits and PRs

Commit subjects are imperative and describe the change rather than the file —
`Serve rule permalinks in dev, and check one`, not `update rules.ts`. PRs are
squash-merged, so the PR title and body become the commit.

CI must be green. `CI Success` is the one required check and it aggregates
everything else; a skipped job passes, a failed one does not.

## Reporting a wrong answer

A wrong ruling, wrong legality verdict or wrong card fact is the failure this
project cares most about — the entire positioning is *being right*. Please open
an [issue](https://github.com/alxjrvs/optfall/issues) with the card or rule and
what you expected. That is one of the most useful contributions available.

Security problems go to [`SECURITY.md`](SECURITY.md) instead — please do not
open a public issue for those.

## What is unlikely to be merged

Not to discourage you, but to save you the work:

- **A language model anywhere near the shipped product.** This is structural,
  not a quality bar — see [`LLM_STATEMENT.md`](LLM_STATEMENT.md). CI fails if
  one appears in a dependency manifest.
- **Prices, or anything in the collector economy.** The reasoning is in
  [`docs/ROADMAP.md`](docs/ROADMAP.md) → "Out of scope, and why".
- **A runtime on the main site.** It is static output with no Worker script,
  deliberately.
