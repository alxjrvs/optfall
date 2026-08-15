# Phase 1 — status

Written against the `phase-1-*` stack. Every claim here was checked by running
the thing, not by reading a summary.

## Deliverables

Quoted from `docs/PLAN.md` Phase 1.

| Deliverable | State |
|---|---|
| Theme package — light and dark token sets, no component styles | **done** |
| Component package — the eight primitives | **done** |
| Storybook — every primitive, both themes | **done** — 62 stories, local-only by decision |
| Lint rule rejecting literal colour and spacing | **done**, in the gate as `tokens` |
| a11y checks wired into the aggregate gate | **done**, via the existing `test` job |
| Storybook's a11y addon, for interactive use | **done** — `test: "error"` in preview |
| Visual-regression checks wired into the gate | **not done** — see below |

## Accessibility runs on every primitive, in both themes

`packages/components/src/svelte/a11y.test.ts` renders all eight primitives — 25
meaningfully-different renderings — through Svelte's server renderer into jsdom,
injects both the theme stylesheet and the components' own compiled CSS, and runs
axe-core over each. 25 assertions, in `bun test`, which is already a gated job.

**It runs once per case rather than once per theme, and that is a correction.**
An earlier version looped over both themes and reported 50 assertions "in both
themes". It was not coverage: a theme is a swap of CSS custom-property values,
the markup is identical, and no enabled axe rule reads a colour — the one that
would, `color-contrast`, is disabled below because jsdom cannot evaluate it. The
second pass re-ran the same checks against the same DOM and could not fail
differently. Theme coverage lives in `tokens.test.ts`, numerically.

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

## Storybook is local-only, by decision

`bun run storybook` serves all 62 stories at `localhost:6006` — verified
running, 51 ms for the manager and 89 ms for the preview.
`bun run build:storybook` also produces a clean static build, so nothing
technical stands in the way of hosting it later.

The public deploy was dropped rather than deferred. What carries the
accessibility promise past our own edges is the **published component**,
compiled to a custom element; a hosted workbench would have made that easier to
discover, not possible. Against that: a second deploy target, a second build to
keep green, and a public surface to keep compliant. See `docs/PLAN.md` Phase 1.

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

- ~~**The display face.**~~ **Settled: Grenze.** SIL Open Font License 1.1,
  which permits webfont embedding and self-hosting; served from our own origin
  as a 38 kB variable woff2 covering the whole weight range, with its URL and
  hash recorded in `data/fonts/fonts.json`. Applied to `h1`, `h2` and the card
  name, and no further down: the face is angular and high-contrast, which is
  what makes it worth having at title size and tiring in a run of subheadings.
- **Three tokens the primitives wanted and did not get**, composed around rather
  than invented: a named deep-bevel step, a muted brass for de-emphasis inside
  the seal, and an inverted bevel pair for recessed surfaces. None is blocking.
- ~~**The site still runs Phase 0 placeholder styling.**~~ **Done.** The layout
  and the compliance footer are rebuilt on the token layer, `/data-terms` exists
  (the URL every published payload carries, which until now 404'd), and the
  `apps/site/src` deferral in `scripts/check-tokens.ts` is deleted — which was
  not optional, because that check fails on a deferral whose path has become
  clean. The rule then caught a raw `46rem` in the new layout, which is how
  `type.measure` came to be a token: the system was missing a value and said so,
  rather than a human deciding to add one.
