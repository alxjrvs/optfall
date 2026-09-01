<!--
  Delete anything that does not apply. A one-line PR needs a one-line body.
  New here? CONTRIBUTING.md is short and routes to the traps worth knowing.
-->

## What this changes


## Why


## Checks

- [ ] `bun run check` passes
- [ ] **`bun run check:full` passes** — required if this touches rendered
      output, the disclaimer, attribution or licence copy, or the token
      stylesheet. A green `check` is not a green gate for those.

<!--
  If you touched any of these, say so here and say what you verified:

  - docs/DISCLAIMER.md          parsed programmatically; five surfaces are
                                asserted against it character by character
  - packages/theme tokens       check:tokens, and the built stylesheet
  - a card-search operator      .claude/skills/add-a-search-filter
  - a design-system primitive   .claude/skills/add-a-design-system-primitive
                                (the committed design-system/ must be
                                byte-identical to the generator's output)
-->

## Anything you are unsure about

<!--
  Genuinely useful. "I could not tell whether X was deliberate" saves a review
  round, and in this repository the answer is usually written down somewhere
  neither of us thought to look.
-->
