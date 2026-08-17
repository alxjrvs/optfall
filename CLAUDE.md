# Optfall

Bun monorepo. **Never npm or yarn.** `bun install`, `bun test`, `bun run check`.

See the site: `bun run --cwd apps/site dev`.

This file routes. It does not restate — where a rule already lives somewhere
that is checked, this points at it rather than copying it, because a copy is
one more thing to drift.

## `bun run check` is not the whole gate

`check` covers seven of the ten jobs `CI Success` needs: format, lint, tokens,
bun-version, provenance, the no-language-model scan, the CI-aggregator
assertion, typecheck and tests. Ordered cheapest first, so the commonest
failures surface in under two seconds.

The other three need a full 12,776-page build and are `bun run check:full`
(~3 min): `build` itself, the `disclaimer`, `built-tokens` and `card-notice`
checks that read its output, and `dev-server`.

**Anything touching rendered output, the disclaimer, attribution copy or the
token stylesheet needs `check:full` before it is pushed.** A green `check` is
not a green gate.

Aim the loop — it is fast when scoped:

| Command | Time |
|---|---|
| `bun test packages/theme` | 0.2 s |
| `bun test packages/components` | 8.6 s |
| `bun test apps/site` | 18 s |
| `bun run check` | ~60 s |

## Before you touch these, read this

| Touching… | Read first |
|---|---|
| disclaimer, attribution, credit or licence copy | `docs/COMPLIANCE.md` §4–§5 |
| any prose in `docs/PLAN.md` | it is parsed — see below |
| a design token, or component CSS | `packages/theme/src/tokens.ts` |
| a search operator | the four-file list below |
| what a page is | `apps/site/ssg/routes.ts` |

**`docs/PLAN.md` is parsed programmatically.** `scripts/canonical-disclaimer.ts`
extracts its disclaimer blockquote and asserts it normalises identically against
`apps/site/src/lib/compliance.ts`, `README.md`, `docs/COMPLIANCE.md` and *both*
copies in `docs/DATA-TERMS.md`. Reflowing the README footer paragraph fails the
build. Tidying that prose is not a free action.

## Two rules no check can enforce

Roughly one commit in six on this repository is a correction, and these two
account for most of them. Neither is catchable by CI, which is why they are
here.

- **Never assert what you have not just verified.** If you are about to write
  "enforced by X", a count, or a status — open X and confirm before the
  sentence ships. This is the single most common defect in the history, and
  twice the commit *correcting* a false claim introduced a new one of its own.
  It applies to comments, docblocks, status tables, README prose and commit
  bodies equally.

- **Do not build a defensible thing nobody asked for.** If you notice you are
  arguing yourself into a feature, confirm intent before you write its test.
  One session built a partial-match note, wrote the repository's first island
  test for it, argued for it at length — and the next PR, from that same
  session, deleted the note, the field, the CSS class, both render sites and
  the test.

## House rules

All enforced somewhere, all easy to violate on a first pass.

- **Tokens or nothing.** No raw hex or length in a component. `check:tokens`
  fails the build.
- **Compose, never restyle.** A screen that needs new CSS is a signal that
  `packages/components` is missing a primitive. Add it there, not in the page.
- **Never reorder imports.** Biome's `organizeImports` is off deliberately: it
  hoists imports above the file docblock, stranding the prose that explains the
  file. Import order is maintained by hand.
- **80 columns.** Biome formats at 80 and `format:check` is a gate.
  `.editorconfig` agrees; if you ever change one, change both.
- **Upstream field names stay verbatim, and the bracket is the signal.**
  `card.legality["ll_restricted_affects_full_cycle"]` is deliberate —
  `CardLegality` is an index signature over names we did not choose.
  `useLiteralKeys` is off for exactly this. Do not convert to dot access.
- **`exactOptionalPropertyTypes` is on.** Optional fields are `?: T | undefined`,
  not `?: T`. They are different types.
- **Every `!` must be guarded on the line above it.** `noNonNullAssertion` is
  off, which is not a licence.
- **Fix present-tense Astro and Svelte claims; keep historical ones.** Both
  frameworks were deleted in Phase 6. A comment explaining what the port changed
  is worth keeping. A comment saying something "runs in Astro's frontmatter" is
  a lie about the current build.
- **The prose in this repository is load-bearing.** Do not strip explanatory
  comments to make a diff smaller.

## The corpus

- **Never `Read` or `grep` `data/cards/cards.json`.** It is 16 MB and will
  destroy your context in one call.
  - To see the **shape** — field names, how an absent stat is encoded, what a
    banned card looks like — read `data/cards/sample.json`. Twenty cards, same
    schema, ~90 kB, chosen to cover every axis that has needed its own branch.
    Regenerate with `bun run corpus:sample`.
  - To look up a **particular card**, query the real corpus through `cards.ts`'s
    exports with `bun -e`. The card you want is almost certainly not one of the
    twenty.
- **Stats are strings, and an absent stat is `""`, not `null`.** `pitch` is
  `"1"`, not `1`. A predicate written as `!== null` is true of every card in the
  corpus. This has already cost one bug.
- **Never regenerate `data/`** unless that is the task. The corpus builders hit
  the network, CI never runs them, and dozens of assertions are written against
  the committed figures.

## Skills

Two procedures in this repository are mechanical, multi-file, and have been
performed enough times to be worth encoding. Both are in `.claude/skills/`:

- **`add-a-search-filter`** — the four files a card-search operator touches, and
  the one of them with no test behind it.
- **`add-a-design-system-primitive`** — the seven places a primitive touches,
  all test-enforced.

## Pre-approved commands, and the two that are not

`.claude/settings.json` pre-approves the read-only and build commands that
recur here — `bun test`, `bun run build`, `rg`, the read-only `gh` subcommands,
and the `check:*` scripts **enumerated one by one**.

**The `check:*` entries are listed individually rather than globbed, and that is
deliberate.** A `Bash(bun run check:*)` wildcard reads as "the safe local
checks" and is not: it also covers `check:symbols`, which re-fetches every game
symbol from `rules.fabtcg.com`, and `check:repo-settings`, which makes
authenticated `gh api` calls against the live repository. Neither is a loop
command, and neither should run without someone deciding to run it.

**`bun run corpus:*` and `bun run symbols` are excluded for the same reason,
plus one more.** Both hit the network, and both rewrite committed provenance
data — `data/symbols/symbols.json` carries a per-file SHA-256 and a rights
statement that `check:provenance` verifies. Regenerating either is a decision
with a diff attached, not a step in a loop.

## Adding a search operator — four files, and one has no test

`apps/site/ssg/pages/syntax.page.tsx` says it outright: when the parser changes,
that page is wrong and no test will say so.

1. `apps/site/src/lib/card-search.ts` — `FIELD_OPERATORS`, `STATE_OPERATORS`,
   `FORMAT_ALIASES`, `STAT_FIELDS`, `SORT_KEYS`, `DISPLAY_MODES`,
   `UNIQUE_MODES`, `WORD_VALUED`
2. the hand-written `Supported: …` string in the unknown-operator error
3. `apps/site/src/lib/query.ts`, if tokenising changes
4. **`apps/site/ssg/pages/syntax.page.tsx`** — the one everyone forgets

Decide the negated form (`-op:`, `op!=`) in the same change. A filter once
shipped without one and needed a follow-up PR to refuse it.

`card-search.ts` must import `./cards` **type-only**. A value import once
shipped a 9.28 MB bundle to every reader.

## Adding a primitive — seven places, all test-enforced

1. the `PrimitiveName` union — `packages/components/src/index.ts`
2. the `PRIMITIVES` array — same file
3. the component `.tsx` and `.css` — `packages/components/src/react/`
4. the `react/index.ts` export
5. the count in `packages/components/src/index.test.ts`
6. `bun run design-system`, then commit `design-system/` — the committed card
   must be **byte-identical** to the generator's output
7. a case in `packages/components/src/react/a11y.test.tsx`

Cite `PRIMITIVES.length` rather than spelling the number in prose. It has been
wrong across two consecutive additions.

## Adding a page — two places, three with nav

1. `apps/site/ssg/pages/<name>.page.tsx`
2. import and `register(...)` in `apps/site/ssg/routes.ts`
3. for a nav entry, add the name to `HeaderSection` in
   `apps/site/ssg/SiteHeader.tsx`

`routes.ts` is an **explicit registry, not a directory scan** — deliberately, so
that what exists is a decision in a reviewable diff. An unregistered page file
silently is not a URL. Read its docblock before "fixing" it.

## Mobile is six numbers, not an adjective

320, 360, 390, 430, 964, 1226 — and `documentElement.scrollWidth ===
clientWidth` at every one. The card face is 450 px, wider than every phone, so
anything sized from the face rather than the viewport is a horizontal scrollbar
waiting to happen.

Verify in a fixed-width iframe. Resizing a browser window moves the OS frame
without changing the layout viewport, so it will not reproduce the bug.

## Documentation conventions

Both are already in use, and applying them inconsistently is what makes a stale
document indistinguishable from a current one.

- When a decision reverses, **strike the old text through** and say what
  replaced it. Do not delete it.
- When a status snapshot is overtaken, **banner it** `> **Historical.**` naming
  the document that replaces it.

## Worktrees

Agent worktrees live in `.claude/worktrees/` and are gitignored. Reap them with
`boom code reap` — squash-merge rewrites SHAs, so plain git will insist a fully
merged branch is still ahead.
