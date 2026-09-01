---
name: change-the-disclaimer
description: Change the LSS disclaimer, the attribution or credit line, the permission envelope, or any legally load-bearing copy. Use when asked to edit the disclaimer, update attribution, change compliance or licence wording, or when check:disclaimer, canonical-disclaimer.test.ts or check:card-notice fails. Covers the parsed specification, the five surfaces asserted against it, and why a green `bun run check` is not enough here.
---

# Changing the disclaimer

The disclaimer is a **specification with a parser attached**. One file is the
source; five other places are asserted against it character by character; a
sixth is enforced against the built site. Editing any copy except the source is
how this goes wrong.

## Before anything else

**The wording is Legend Story Studios' requirement, not ours.** If the change
is to the disclaimer's own text rather than to where it appears, stop and check
that a person has decided that — `docs/COMPLIANCE.md` §4–§5 is the policy, and
this is one of the few things in the repository that is not ours to improve.

Fixing a typo in surrounding prose, adding a surface, or repairing a broken
assertion: proceed.

## The source

`docs/DISCLAIMER.md`, the blockquote under `### Required disclaimer`.

`scripts/canonical-disclaimer.ts` extracts it. Three properties of that
extractor decide everything about how you may edit the file:

- **Reflowing is safe.** `normalizeProse` collapses all whitespace on both
  sides before comparing, so line wrapping carries no meaning. Rewrap freely.
- **A character is not.** A `®`, a `™`, a comma — any character change is a
  change to the specification, and it will fail in five places at once. That is
  the check working.
- **A blank line inside the blockquote ends the extraction.** It used to
  truncate silently to a PREFIX of the real disclaimer — which is still present
  on every built page, so `check-disclaimer.ts` found the prefix and passed.
  `MINIMUM_LENGTH` now rejects a short extraction, so it fails loudly. Still do
  not do it.

## The surfaces

`scripts/canonical-disclaimer.test.ts` asserts the extracted string appears in
each of these. Change the source, then propagate:

1. `apps/site/src/lib/compliance.ts` — the exported constant the site renders
2. `README.md`
3. `docs/COMPLIANCE.md`
4. `docs/DATA-TERMS.md` — **twice**. The test asserts `occurrences >= 2`, and
   the second copy is the one downstream consumers of Optfall's published data
   reproduce, so it is the one that matters most and the one most easily missed.

A fifth copy exists that no test covers: a partial sentence in
`apps/images/public/robots.txt`. `check-disclaimer.ts` reads only
`apps/site/dist/**/*.html`, so nothing governs that file. Check it by hand.

## Verify, in this order

```sh
bun test scripts/canonical-disclaimer.test.ts   # the five surfaces agree
bun run check                                   # nothing else broke
bun run check:full                              # REQUIRED — see below
```

**`bun run check` is not sufficient here and that is the whole trap.**
`check:disclaimer` reads BUILT output — it walks all 12,776 pages of
`apps/site/dist` — so it only runs under `check:full`, which needs the build.
A green `check` on a disclaimer change tells you the sources agree with each
other, not that the site says it.

`check:card-notice` is in the same position and covers the card-image
attribution notice, which is a separate requirement from the disclaimer and
lives in `docs/COMPLIANCE.md` §5.

## If a check is already failing

- **`canonical-disclaimer.test.ts` fails** — the sources disagree. Its output
  names the surface. Fix the surface, never the expectation.
- **`canonicalDisclaimer()` throws about length** — a blank line got into the
  blockquote, or the heading moved. Fix `docs/DISCLAIMER.md`.
- **`check:disclaimer` fails but the tests pass** — the sources agree and the
  built site does not. That is a rendering problem: look at
  `apps/site/src/lib/compliance.ts`'s consumer, not at the copy.
