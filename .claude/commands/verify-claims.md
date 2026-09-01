---
description: Re-derive the numbers and lists this repository states in prose, and report any that no longer match.
---

Check the repository's own factual claims against the repository. Report only
what is WRONG, with the file, the claim, and the verified value.

`CLAUDE.md`'s first unenforceable rule is "never assert what you have not just
verified", and it names this as the most common defect in the history. Most
instances are not checkable by a test — but the numeric and structural ones
are, and this is that pass. Do not fix anything; report.

Derive each of these fresh. Do not trust a figure because another document
repeats it — repetition is how these drift.

1. **Primitive count.** `PRIMITIVES.length` from
   `packages/components/src/index.ts`, the number asserted in
   `packages/components/src/index.test.ts`, and `ls design-system/primitives |
   wc -l`. All three must agree.

2. **The `check` and `check:full` step lists.** Read `package.json`'s `check`
   and `check:full` scripts and compare, in order, against what `CLAUDE.md`
   says each one runs.

3. **Gate arithmetic.** Count the jobs in `.github/workflows/ci.yml` that
   `CI Success` lists in `needs:`, and how many of them `bun run check` covers.
   `CLAUDE.md` states both numbers.

4. **Network scripts.** Every `check:*`, `corpus:*` and other script in
   `package.json` that performs a network fetch, versus the list `CLAUDE.md`
   enumerates as deliberately not pre-approved, versus `.claude/settings.json`.
   Read each script to decide; do not infer from the name.

5. **Test and file counts.** Any count of tests, test files, pages, cards,
   rules or sets stated in `CLAUDE.md` or `README.md`. Compare against the live
   figure. `scripts/documented-counts.test.ts` already owns several — say which
   are owned and which are not, because an unowned figure is the one that rots.

6. **Timings.** The table in `CLAUDE.md`. Re-measure what is cheap to
   re-measure and report the delta. Note the hardware you measured on: the
   table names Apple silicon, and a figure from different hardware is a
   comparison rather than a replacement.

7. **Paths named in prose.** Every file path `CLAUDE.md` and the files in
   `.claude/skills/` mention — confirm each exists. A path that moved is the
   cheapest possible false claim to find and the most annoying to hit.

Then report:

- **Wrong** — claim, location, verified value.
- **Unverifiable here** — and what would settle it.
- **Checked and correct** — briefly, so a clean run is legible as a clean run
  rather than as a run that did nothing.
