# Phase 1 — status

Written against the `phase-1-*` stack. Every claim here was checked by running
the thing, not by reading a summary.

## Deliverables

Quoted from `docs/PLAN.md` Phase 1.

| Deliverable | State |
|---|---|
| Theme package — light and dark token sets, no component styles | **done** |
| Component package — the eight primitives | **done** |
| Storybook — every primitive, both themes | **done** (62 stories); public deploy **not done** |
| Lint rule rejecting literal colour and spacing | **done**, in the gate as `tokens` |
| a11y checks wired into the aggregate gate | **done**, via the existing `test` job |
| Visual-regression checks wired into the gate | **not done** — see below |

## Accessibility runs on every primitive, in both themes

`packages/components/src/svelte/a11y.test.ts` renders all eight primitives — 25
meaningfully-different renderings — through Svelte's server renderer into jsdom
and runs axe-core over each, in both themes. 50 assertions, in `bun test`, which
is already a gated job.

**It uses jsdom rather than a headless browser deliberately.** Storybook's test
runner would download a browser on every CI run to assert facts about markup
that need no compositor. This takes about a second.

**Two things it cannot see, stated so a pass is not mistaken for coverage:**

- **Colour contrast.** axe's `color-contrast` rule needs a canvas to sample
  pixels. Probed against `#777777` on `#888888`, jsdom returns **incomplete** —
  not a violation. Incomplete is silent, so the rule is explicitly disabled;
  leaving it on would make the suite appear to cover contrast while covering
  nothing. Contrast is asserted numerically in `packages/theme/src/tokens.test.ts`
  instead, which computes WCAG ratios from the token values for both themes.
  That is the stronger check: it tests the palette rather than one rendering of
  it, and it cannot return "incomplete".
- **Focus rings, focus order, geometry, reduced motion.** These need layout.
  They belong to the visual-regression pass below.

The harness was verified to bite rather than merely to pass: probed with an
`img` missing `alt`, a nameless `button`, an emptied `aria-label` on
`role="img"`, and an unlabelled `input`, it caught all four. The third is
exactly the `PitchJewel` failure mode the `label?.trim() ||` guard exists to
prevent.

## Visual regression — blocked, and on what

`docs/PLAN.md` specifies "Playwright screenshots committed to the repo rather
than a hosted service, so the check keeps working after a trial lapses". The
harness is not built, and the blocker is environmental rather than technical:

**Baselines must be generated on the platform CI runs on.** Screenshots taken on
macOS arm64 differ from Linux CI in font rasterisation and antialiasing, so
committing macOS baselines would produce a check that fails on every pull
request for reasons unrelated to any change — worse than no check. There is no
container runtime on this machine (`docker` and `podman` both absent), so
correct Linux baselines cannot be produced here.

**What must not be done to work around it:** adding the job to the aggregate
gate before baselines exist. That repeats the mistake Phase 0 already made and
fixed with the drift check — a required check the repository cannot satisfy on
its own blocks every merge until a human intervenes, which is the exact
auto-merge deadlock Phase 0 exists to prevent. **A required check must be
something the repository can satisfy on its own.**

**The way in:** run Playwright in CI (`ubuntu-latest`) under `workflow_dispatch`
with `--update-snapshots`, commit the baselines it produces, and only then add
the comparison job to `gate`. One bootstrap run, and the check is satisfiable
from that point forward.

## Storybook's public deploy — not done, and why

The plan wants Storybook deployed publicly as its own build, because that is
what makes the component library documentation for anyone else adopting the
accessible pitch jewel. `bun run build:storybook` produces `storybook-static/`
and it builds clean. What is missing is the Netlify site to put it on — no
Netlify site exists for this project at all yet (Phase 0 handoff, step 4), so
there is nothing to deploy to rather than anything wrong with the build.

## The Storybook integration risk landed

`docs/PLAN.md` recorded it: "Storybook's Svelte support is the least mature of
the mainstream framework integrations... Pin versions deliberately rather than
taking latest-of-everything." Both failure modes were hit:

- Under **Vite 8** (rolldown), Storybook's Svelte docgen plugin runs `parseAst`
  over `.svelte` sources as JavaScript and fails on `<script lang="ts">` — the
  first line of every component.
- Under **Vite 7**, `@sveltejs/vite-plugin-svelte@6` is not applied at all, and
  Storybook's own `PreviewRender.svelte` fails import analysis instead.

Resolved in `.storybook/main.ts`'s `viteFinal`: drop the docgen plugin, add the
Svelte plugin explicitly rather than trusting the preset. The cost is autodocs'
automatic prop tables, so every stories file writes `argTypes` by hand — checked
by `svelte-check` rather than inferred at build time.

## Open, carried into Phase 2

- **The display face.** `docs/DESIGN.md` names Grenze, Cinzel and Eczar as
  candidates and flags that a licence must be confirmed for webfont embedding.
  Tokens ship a system serif stack, so this is a one-token change when decided.
- **Three tokens the primitives wanted and did not get**, composed around rather
  than invented: a named deep-bevel step, a muted brass for de-emphasis inside
  the seal, and an inverted bevel pair for recessed surfaces. None is blocking.
- **The site still runs Phase 0 placeholder styling.** `scripts/check-tokens.ts`
  defers `apps/site/src` for exactly this reason, and that deferral **fails once
  the path is clean** — so the entry must be deleted by whichever change rebuilds
  the site on these primitives, rather than whenever somebody notices.
