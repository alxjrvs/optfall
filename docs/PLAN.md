# Optfall — phased build plan

**Scryfall, for Flesh and Blood.** A card search engine and reference, with a
rules engine attached — every card, every printing, every rule, each citable and
each with a permanent URL.

| Phase | | | |
|---|---|---|---|
| 0 | Repo and infrastructure | ![Done][chip-done] | |
| 1 | Theme and components | ![Done][chip-done] | |
| 2 | The card layer — search, cards, printings | ![Done][chip-done] | |
| 3 | Legality that remembers | ![Blocked][chip-blocked] | on a dataset, not on code |
| 4 | The rules, made addressable | ![Live][chip-live] | built; the exit criterion is external |
| — | *Gate: are the questions actually novel?* | | days |
| 5 | The interaction record | ![Planned][chip-planned] | |
| 6 | Off Astro | ![Done][chip-done] | |

The chips are Optfall's own state palette, and
[`COMPLIANCE.md`](COMPLIANCE.md#how-to-read-a-chip) carries the legend that says
what each word commits to.

> **The chips describe what is BUILT, which is not the same as what has
> EXITED.** Phases 3 and 4 both exit on adoption — "at least one other
> tool has adopted the library", "a citation appears in a community discussion
> without you putting it there" — and neither is a fact this repository can
> report on itself. Phase 4's surface is live at `/cr` and `/rule/:number`
> against a committed CR 2.14.0 corpus; whether anyone has cited it is not
> something this table should claim.
>
> Phase 3's chip reads *blocked* rather than *in progress*, and the distinction
> matters: `packages/legality` exists and is tested, but its headline export
> `isLegal` throws `NotImplementedError` and nothing under `apps/` imports the
> package. Nobody is working around a blocker — the work has not started,
> because what it needs is `data/legality`, which needs the licence request in
> [`upstream-licence-issue.md`](upstream-licence-issue.md) to be sent by a
> person. The live legality logic is `apps/site/src/lib/cards.ts`, which reads
> upstream's flags rather than computing a timeline.

> **This document was reordered on 2026-08-11**, when the owner settled the
> positioning: Optfall is *mostly a card browser and lookup with a rules engine
> attached* — a copy of Scryfall's functionality for Flesh and Blood. Earlier
> revisions had the card layer as "supporting cast, not a product" and listed a
> card-search destination under *out of scope*. Both are now wrong and both have
> been rewritten. The change is recorded rather than silently applied, because
> the previous reasoning was argued at length and a reader deserves to see what
> replaced it.

---

## The thesis

**Be the reference.** Scryfall's position in Magic is not that it found an
unoccupied niche — it is that it became the thing everyone links to, because it
was complete, fast, precise, and the link always worked. Flesh and Blood has no
equivalent. That is the opening.

Optfall optimises for being **right**: correct card text, correct legality,
correct rules, each citable and each version-stamped. Everything else follows
from that — the search grammar, the permalinks, the refusal to compose prose.

**Why enter a category that already has tools.** An earlier revision of this plan
ruled card search out because Opt existed and had gone stale. That reads the
evidence backwards. Opt going stale is the *opportunity*, and it names the thing
to solve: a card database dies when keeping it current needs a human in the loop.
So the answer is structural rather than diligent — **sync, never curate**, from an
actively-maintained upstream, so staleness requires active decay rather than
passive neglect. If that discipline holds, the treadmill that claimed three
Flesh and Blood tools is not a risk we share.

**Three things make it ours rather than a fifth copy.**

1. **Legality that knows about time.** Every card database answers *is this legal
   now*. None answers *was this legal on the day of that tournament* — and
   Living Legend retirements and banned-list revisions move constantly, so every
   archived decklist in the game is currently uninterpretable. This is the
   feature nobody has, and it is the reason the card layer is worth building
   again rather than pointing at what exists.
2. **Rules that are addressable.** The Comprehensive Rules parsed to permanent
   identifiers, so a card can link to the rule that governs it and a judge can
   paste a citation instead of describing which paragraph they meant.
3. **No language model anywhere.** Search is lexical and deterministic; the tool
   never composes prose. A confidently wrong answer is structurally impossible
   rather than mitigated.

**The order now follows the product rather than what unblocks what.** Cards come
first because cards are what people arrive for, and because present-day legality
already ships inside the card data — so the first release is useful on its own.
Every phase still ships a complete thing: if you stop after any of them, what
exists still works.

---

## Permission envelope

LSS publishes a *Terms of Use for Game and Studio Assets and IP* containing an
explicit third-party application policy that names these exact use cases. It is
a written grant with conditions, and both halves are load-bearing. All of Phase
0 exists to satisfy it before the first public commit.

### Granted

- **Card databases** and related services, named in the policy.
- **Rules enforcement applications** — a separately blessed category covering
  both legality checking and a rulings archive.
- **APIs** transferring game content, provided they are not directly monetised.
- **Card face images**, specifically for building card databases.
- **Indirect monetisation** — Patreon and ad-sense by name, if costs ever need
  covering.

### Required of us

- **Individual, never a commercial entity.** The policy bars third-party
  applications built by commercial entities. Repo, domain and any future Patreon
  stay on the personal account.
- **No direct monetisation.** No sales, no subscriptions.
- **No FAB or LSS logos in the app** — and product set logos count as FAB logos.
  Card faces are fine; set symbols as filter icons are not.
- **Verbatim disclaimer** in the footer.
- **Copyright line** on card images.
- **Terms on our own published data** echoing LSS's, since the grant binds
  recipients too.

### Required disclaimer

> Optfall is in no way affiliated with Legend Story Studios. Legend Story
> Studios®, Flesh and Blood™, and set names are trademarks of Legend Story
> Studios. Flesh and Blood characters, cards, logos, and art are property of
> Legend Story Studios.

Enforcement is described as friendly warnings before escalation, with immediate
legal action reserved for commercial entities and deliberate non-compliance. The
real risk is therefore **revocation, not litigation** — so keep rulings, rules
and legality data ours and portable. Losing the art licence should cost a
rendering layer and nothing else.

---

## Stack

Chosen to satisfy one constraint above all others: **nothing here should stop
working because its maintainer stopped paying attention.** No database, no
server, no runtime bill. The whole product is static output plus versioned JSON
in a git repository.

- **TypeScript on Bun.** One workspace across the library, the parsers and the
  site. The legality package publishes with zero runtime dependencies.
- **React 19, rendered statically.** One component library, rendered to HTML at
  build time and hydrated only on the surfaces that are genuinely interactive.
- **A static generator this project owns** (`apps/site/ssg/`) — static output
  with client islands, Vite building the island bundles alone. The checker is
  interactive but needs no server; validation runs in the browser against the
  shipped dataset.
- **TanStack inside the islands, and nowhere else.** Query for the two search
  indexes, which are content-hashed files the islands fetch rather than payload
  the pages carry; Store for the one value two islands share, the text in the
  header's field. No Router and no Start — every view is a document served at
  its own URL, which is what a router would take away. See Phase 6, where this
  was predicted and then decided, along with the two pieces measured and
  declined.
- **The committed `design-system/` bundle as the workbench, run locally.**
  Primitives built and reviewed in isolation, in both themes, with axe-core
  running over every primitive in CI. Not deployed — see Phase 1 for why the
  public build was dropped.

  *These three bullets read "Svelte, compiled two ways", "Astro" and "Storybook
  as the workbench" until Phase 6 deleted all three, and went on reading that
  way after they were gone — the same drift recorded under "Settled, and still
  open" below. One half of the Svelte bullet was a capability rather than a
  spelling, and rewriting it does not restore it: "the same source compiled to
  custom elements for everyone else… so the accessible pitch jewel can be
  dropped into a React or vanilla site without anyone adopting our stack" was
  this project's only route out to other tools, and nothing replaced it. Quoted
  rather than deleted, and open as*
  [#156](https://github.com/alxjrvs/optfall/issues/156).
- **Cloudflare Workers.** Production from `main`, a preview URL on every pull
  request. Previews matter more than usual here: a legality bug is visible in a
  preview and invisible in a diff. The site ships as static assets with no
  Worker script; only the card-face host runs code.
- **A shell script, not Terraform.** Repository settings and ruleset live in a
  checked-in `gh api` script, re-runnable at any time, with a CI job asserting
  the live settings still match. Reproducible from scratch rather than
  archaeology — which was Terraform's whole pitch, minus a state file that has to
  live somewhere durable, minus a provider dependency, minus a language nobody
  here writes. Terraform earns its keep across many repos or real cloud
  resources; this is one repo and a twelve-line checklist.
- **Data as committed JSON.** Every dataset lives versioned in the repo and is
  served as a static file — simultaneously the storage layer, the public API,
  the backup and the audit trail.
- **Scheduled jobs, not services.** Ingestion runs as a scheduled workflow that
  opens a pull request when upstream changes. Nothing runs continuously, so
  nothing can silently fall over.
- **MIT code, open data.** MIT so any FaB tool can embed our components freely.
  Datasets are openly licensed only over the structural work we own: rule ids,
  the legality timeline, diffs and annotations. Card text and art remain LSS
  property and are never relicensed by us.

> **Operational note.** The permission rules on this machine deny the Bash path
> to secret resolution, so anything needing a deploy or storage credential runs
> from a human terminal rather than from inside an agent session. The
> repo-settings script is
> deliberately not in that category: it authenticates with `gh`, which an agent
> session already has, so the settings stay reproducible without a human in the
> loop.

---

## Phase 0 — Repo and infrastructure

**1–2 days. Nothing blocks it.**

`alxjrvs/optfall` — settings in a script, deploying to Cloudflare, compliant
before the first line of product code.

**Personal ownership is a compliance requirement, not a preference.** LSS's
policy bars third-party applications built by commercial entities, so the repo,
the domain and any future Patreon live on the personal account. Putting it under
an org later would be expensive to undo.

**Script the repo settings, don't click them.** The agent-friendly configuration
is a real specification: squash-only merges, rebase-preferred branch updates,
required linear history, a single aggregate status check rather than per-job
checks, no required human review, and an empty bypass list so nobody — including
you — can route around it. That set is fiddly enough to drift when applied by
hand, so it lives in `scripts/repo-settings.sh` and is checked on a schedule.

**Asserted, not merely declared.** A settings file that nobody re-runs is a
description of the past. The script has a `--check` mode that reads the live
repository and exits non-zero on any divergence, and a weekly workflow runs it
and opens an issue when it finds one. That check is the part Terraform would not
have given us for free, since `plan` only detects drift when somebody remembers
to run it.

**The drift check is deliberately not a required check, and the reason
generalises.** Reading the merge settings needs a token with administrative
read, and a workflow's `permissions:` block has no `administration` scope — so
`GITHUB_TOKEN` cannot be raised to it and only a hand-made personal access token
works. Gating merges on that would leave every pull request red until a human
installed a token: the exact auto-merge deadlock this phase exists to prevent,
reintroduced by the mechanism meant to protect it. It is also simply the wrong
trigger, since settings drift when somebody changes a setting rather than when
somebody changes code. The general rule: **a required check must be something
the repository can satisfy on its own.** Anything needing a human-issued
credential belongs on a schedule, reporting to an issue.

**The aggregate gate is the part most often got wrong.** Requiring each
individual CI job as a status check strands required checks in "pending" forever
on path-filtered pull requests. One `gate` job that depends on every other job
and always runs is the shape that actually works with auto-merge.

**Compliance boilerplate ships before product code.** Disclaimer in the layout,
copyright line in the card component contract, data terms, and the no-logo
constraint written into the design tokens rather than left as a thing to
remember.

**One five-minute task with outsized leverage:** open an issue upstream on the
community card dataset asking for an explicit licence. It currently ships none,
which by default means all rights reserved and no granted right to redistribute
the compilation — and every phase below depends on it. LSS's own published grant
strengthens the ask.

### Deliverables

- `alxjrvs/optfall` — public, personal account, TypeScript workspace on Bun
- `scripts/repo-settings.sh` — repository settings and ruleset as a re-runnable
  `gh api` script, with a `--check` mode run weekly to catch drift
- Cloudflare configuration in `apps/*/wrangler.jsonc`, alongside the site it builds
- Agent-friendly settings — squash-only, linear history required, branch
  deletion on merge, no required human review, empty bypass list
- CI with a single aggregate gate — one always-run job depending on all others,
  set as the sole required check
- Cloudflare — production deploy from `main`, a preview URL on every PR
- Compliance boilerplate — disclaimer, data terms, copyright line, no-logo rule
  in the design tokens
- Licence issue opened upstream on the card dataset

### Exit criteria

A trivial pull request opens a deploy preview, passes the aggregate gate, and
auto-merges with no human approval — and the repo configuration can be wiped and
restored by running `scripts/repo-settings.sh` alone.

---

## Phase 1 — Theme and components

**~1 week. Nothing blocks it.**

The design language is infrastructure, not decoration — so it gets built as a
library with a workbench, before any product surface can invent its own styles
under deadline.

**Tokens are the only source of truth.** Colour, type, spacing, bevel and
ornament live in one theme layer. Components consume tokens and never literals,
and themes swap at the token layer alone — a component never knows which theme
it is in, which is precisely what keeps light and dark equally considered rather
than one being a hasty inversion of the other.

**Enforced, not requested.** A lint rule fails the build on a raw hex or a raw
pixel value inside a component. A design system maintained by good intentions is
a design system that erodes the first time someone is shipping at midnight; the
rule is the whole difference between a language and a folder of screenshots.

**Storybook is the workbench, not the documentation afterthought.** Every
primitive gets built there first, rendered in both themes, before it appears in
a product surface. The accessibility addon runs on every story in CI, which
turns the pitch jewel's contract — shape, numeral and colour carrying the same
fact three times — from an intention into a test.

**Visual regression without a subscription.** Playwright screenshots committed
to the repo rather than a hosted service, so the check keeps working after a
trial lapses or a card expires.

**Storybook is local-only, and that is a deliberate narrowing.** An earlier
version of this plan had it deploying publicly as its own build, on the
reasoning that a hosted workbench is how the library becomes documentation for
anyone adopting the accessible pitch jewel. It is dropped because it was the
weaker half of that argument: what actually carries the accessibility promise
past our own edges is the **published component**, compiled to a custom element
so a React or vanilla site can drop the jewel in without adopting our stack. A
hosted Storybook would have made that easier to *discover*, not possible.

So the cost is discoverability, paid against a second deploy target, a second
build to keep green, and a public surface to keep compliant — for a project
whose whole premise is that nothing should stop working because its maintainer
stopped paying attention. `bun run storybook` is the workbench; every primitive
is still built there first, in both themes, before it reaches a product surface.

Revisit if someone actually asks to adopt a primitive. Until then, publishing a
workbench nobody has asked for is the shape of maintenance that outlives its
reason.

> **This argument lost the half it rested on, and the loss was not noticed at
> the time.** The passage above drops the hosted workbench on the grounds that
> the *published component, compiled to a custom element*, is what carries the
> accessibility promise past our own edges — so discoverability was the only
> cost. That compilation was Svelte's. Phase 6 deleted Svelte and nothing
> replaced it, which retired the stronger half of the argument while leaving the
> weaker half dropped on its authority. The workbench is now the committed
> `design-system/` bundle (`bun run design-system`), still local-only, and the
> reasoning for that is now the second paragraph alone. Whether the component
> ever ships to other tools is open as
> [#156](https://github.com/alxjrvs/optfall/issues/156); the a11y coverage
> itself survived the port intact as
> `packages/components/src/react/a11y.test.tsx`.

### Deliverables

- Theme package — light and dark token sets, no component styles whatsoever
- Component package — pitch jewel, bevelled plate, notched state pill, brass
  seal, citation, filigree corner, ornamental rule, the mark
- Storybook — every primitive, both themes, run locally (`bun run storybook`)
- Lint rule rejecting literal colour and spacing in component source
- a11y and visual-regression checks wired into the aggregate gate

### Exit criteria

A complete product screen can be assembled from the library with **no new CSS**,
and CI fails if anyone writes a raw hex. If either is untrue, the system is
decoration rather than infrastructure and the next phase will quietly abandon it.

> **Known risk.** Storybook's Svelte support is the least mature of the
> mainstream framework integrations, and Svelte 5's runes are recent enough that
> the integration has rough edges. Pin versions deliberately rather than taking
> latest-of-everything.

---

## Phase 2 — The card layer

**The product. Everything else attaches to this.**

Search, card pages, printings. The thing people arrive for, and the surface every
later phase hangs off.

**The dataset makes this tractable today.** The community dataset carries **4,862
cards** with the fields search needs — name, pitch, cost, power, defence, health,
intelligence, arcane, types, traits, keywords, functional text, printings — *and*
per-format legality already computed: `cc_legal`, `blitz_legal`, `cc_banned`,
`ll_restricted`, `upf_banned` and the rest. So the first release answers "is this
legal" without any of our own legality work. Phase 3 adds the part the dataset
structurally cannot answer.

**Sync, never curate — the anti-staleness decision, and the one that decides
whether this lasts.** Card data comes from the actively-maintained upstream on a
scheduled pull, pinned by commit, with fixes contributed upstream rather than
forked. Opt went stale because something needed a human in the loop. Consume an
upstream someone else already maintains and staleness requires active decay
rather than passive neglect. **If this discipline slips, the project becomes the
fourth tool on the treadmill** — it is the single most important operational rule
in this document.

**The grammar is inherited, not invented.** LSS's Card Vault already has a search
syntax and people arrive fluent in it. Adopt it verbatim — `pitch:3
class:guardian` — and extend it with ours: `cr:` for the rules, `legal:cc@DATE`
for time travel, `is:verified` for judge-signed rulings. A second dialect would
fragment the thing it claims to consolidate. Every operator we add must feel like
it was always part of the same language, which is a constraint on naming as much
as on engineering.

**Every view is a URL.** `/card/<set>/<number>/<name>` and `/search?q=…` are the
product, not decoration on it. Scryfall's real artefact is the link you paste
into a conversation to settle it, and a card page that cannot be linked is a
lookup rather than a reference.

**Accessibility ships here, by default.** Pitch is encoded red, yellow and blue —
red and yellow being the classic deuteranopia confusion pair, on the most-read
value on a card. Tellingly they are *also* the pair Dragon Shield's scanner
misreads: same physics, two independent confirmed failures. The pitch jewel built
in Phase 1 already carries a non-colour primary channel — ~~the numeral~~ **the
count of three slots filled to the value, which is what the printed card draws;
see `docs/DESIGN.md`** — so every consumer inherits the fix without deciding to.

### Deliverables

- Scheduled card sync, pinned by commit, published as versioned JSON
- Search with the inherited Card Vault grammar, running client-side against a
  static index — no backend, no query service
- `/card/<name>` permalinks: full text, printings, per-format legality, and links
  into the rules corpus
- Printed text vs true text — the errata split surfaced honestly, with a diff
- Card images with the required copyright line, and no set logos in chrome
- Bulk export of everything structural we own

### Exit criteria

Somebody links an Optfall card page in a conversation instead of describing the
card — and a card's legality, text and printings are correct enough that a second
tool would rather consume our export than build its own.

---

## Phase 3 — Legality that remembers

**2–4 weeks. The differentiator.**

Is this deck legal in this format — and *was* it legal on the day of that
tournament?

**This follows the card layer rather than preceding it**, which reverses an
earlier revision of this plan. The reasoning then was that legality is the only
surface with a deadline attached — a tournament organiser holding 32 decklists at
6:50pm has a problem right now, where card data is reference material visited
once people know it exists. That is still true, and it is still the sharpest
unmet need in the game.

What changed is the finding that **present-day legality already ships inside the
card dataset**. `cc_banned`, `blitz_legal`, `ll_restricted` and the rest are
computed upstream, so the card layer answers the 6:50pm question on its own
without waiting for this phase. What remains here is the half no dataset carries:
**time**. Building it second costs the organiser nothing and gives the historical
work a surface to appear on.

**The gap is real and demonstrable.** Seeds of Agony was banned from Classic
Constructed in LSS's announcement of 21 September 2021. The current dataset
records it as `cc_banned: false, cc_legal: true` — it was unbanned since. Both
facts are correct; the dataset simply has no way to express the first. Every
archived decklist in the game sits in that gap.

The evidence of unmet need is the cleanest in the study. GEM — LSS's own
official tournament platform — ships no legality validation at all, and official
guidance still recommends a paper backup. Dragon Shield's app, with real
commercial backing, ships *incorrect* banned flags on legal cards. Being right is
the entire product.

**Time travel is the part nobody has.** Living Legend retirements and banned-list
revisions move constantly, so every archived decklist in the game is currently
uninterpretable without knowing the rules state on its date.

**Library first, website second.** A zero-dependency package running entirely
client-side carries no uptime dependency on a solo maintainer — precisely what
makes Fabrary, Talishar and the meta sites able to adopt it at zero risk. The
site exists to prove correctness and generate the bug reports that get it there.

**The document pipeline gets built here, underneath it.** The Comprehensive
Rules, banned-and-restricted announcements and Living Legend thresholds are the
same problem wearing three hats: official documents that change by announcement
and need to be addressable, versioned and diffable. Build that machinery once
and Phases 4 and 5 consume something that already exists. Prove it on
banned-list announcements rather than the full rules document — they are short,
they change visibly, and getting them wrong is cheap.

**Deliberately not shipped as standalone infrastructure.** Publishing a pipeline
and waiting for adopters is how these projects die unnoticed. Ship a tool whose
*byproduct* is the infrastructure, and distribution and reusability arrive in the
same artifact.

### Deliverables

- **Research spike, first task** — establish whether past banned-and-restricted
  revisions are publicly archived. The time-travel feature depends on it, and
  the answer decides whether backfill is a scrape or an excavation
- The document pipeline — fetch, parse to stable sections, assign permanent ids,
  version, diff, publish; running on a schedule
- `optfall-legality` — zero-dependency TypeScript, `isLegal(deck, format, asOf)`,
  per-card verdicts each citing the rule that produced them
- Six formats — Classic Constructed, Blitz, Living Legend, Commoner, Silver Age,
  Ultimate Pit Fight
- Historical timeline backfilled — every banned-list revision and Living Legend
  threshold, date-stamped, published as open JSON
- Static checker — single deck or organiser batch paste, shareable permalinks,
  no backend

### Exit criteria

It correctly validates a corpus of known-good and known-bad decklists *including
historical ones* — decks legal then and illegal now — and at least one other tool
in the ecosystem has adopted the library or the published JSON.

---

## Phase 4 — The rules, made addressable

**2–4 weeks. Still nobody's permission.**

Everything the rulings archive needs, built entirely from published sources —
and a complete product if Phase 5 never happens.

**This is the de-risking phase, and splitting it out is the most important
structural decision in the plan.** The Comprehensive Rules, tournament policy and
the penalty guide are all published deliberately as plain text. Parsing them into
stable, addressable, version-diffable sections requires no consent from anyone,
and none of it exists today: the official rules site is a document hub with a
search box, and nothing cross-references rules against card text.

**The permalink is the product.** A judge pasting a citation into Discord instead
of describing which paragraph they mean is the unprompted-share moment, and it
happens on day one rather than after five hundred curated entries.

**The diff view is a recurring content event.** Rules updates in Flesh and Blood
are consequential and currently arrive as a changelog nobody can cross-reference
against cards. "Here is exactly what changed in this version, and which cards it
touches" reaches the judge community organically — which is precisely the
constituency Phase 5 depends on. This phase earns the standing that phase
requires.

**The offline penalty lookup matters more than it sounds.** Pick enforcement
level, pick infraction, get the remedy and the citation, in three taps, at a
table, on venue wifi. Nobody reads a PDF standing at a table.

### Deliverables

- Rules corpus — Comprehensive Rules, tournament policy and penalty guide,
  parsed to permanent addressable ids
- Permalink per section, stable across versions
- Version diffs — what changed, and which cards it affects
- Offline penalty lookup, usable at a table
- Card ↔ rules cross-reference, the join nothing currently makes
- Openly licensed bulk export of the whole corpus

### Exit criteria

A rules citation from Optfall appears in a community discussion without you
putting it there — and a rules version bump ships as a diff post the same week
LSS publishes it.

---

## Gate — decide before starting Phase 5

**Costs days. Saves a quarter.**

Read six months of judge-channel history and classify each question: genuinely
**novel**, or resolvable by a rules-paragraph lookup. Pick the threshold before
you look.

If novel questions turn out to be rare, then Phase 4 already *is* the product,
Phase 5 collapses into a better search interface over it, and you have saved a
quarter by spending three days. That is a good outcome, not a failure.

---

## Phase 5 — The interaction record

**Quarter → ongoing. Gated on people, not code.**

A searchable, judge-attributed, permanently-linkable record of what happens when
card X meets card Y.

**The destination, and it won every vote that mattered** — first place from four
of five independent analyses, present in all five top threes, the only category
in the landscape with zero incumbents, and the only thing here LSS would
plausibly link to from its own site.

Today, resolving an interaction means reading the rules on your phone or asking a
human in a 4,854-member Discord. The official rules Q&A forum is described *by
LSS's own guidance* as a relatively slow way to get answers. Talishar, the online
client with a claimed ten thousand daily players, explicitly warns it should not
be taken as an indication of how the game works.

**The asset exists and nobody has collected it.** Thousands of adjudicated
interactions live only as unsearchable Discord scrollback. The unit is the *card
pair*, not the question, because pairs are enumerable — which yields both a
coverage metric and a work queue.

**No language model — and not merely "not in version one".** Lexical and
structured search over the Phase 4 corpus. The tool never composes prose, so a
confident wrong answer to a player mid-round is structurally impossible rather
than mitigated. This is the surface where the temptation is strongest and the
project-wide rule below admits no exception for it: no retrieval-augmented
answer, no summarised ruling, no "AI assist" behind a toggle.

**Recruit authors, do not mine an archive.** Retroactive consent from thousands
of people is impossible, and asking would itself be the hostile act. Forward
consent from a few dozen active certified judges is not. Judges get bylines,
moderation power and a distinct identity for this surface — contributing must
read as co-ownership, never as donating labour to someone else's database.

### Deliverables

- Two irreconcilable tiers — judge-signed *verified* versus amber *unverified*;
  the latter never permalinkable, never citable at an event
- Version pinning — every entry records the rules version it was answered under;
  a bump flags it for review rather than silently serving stale law
- Published abstention rate — when no verified ruling exists, say so and offer
  one click to the judge queue. The number is public; if we will not publish it,
  we do not ship the feature
- Permalink per interaction, keyed by card pair
- Judge attribution — name, date, rules version, on every verified entry

### Exit criteria

A judge links an Optfall permalink in the Discord instead of retyping the answer.
That single behaviour is the entire thesis working, and it is directly
observable.

---

## Phase 6 — Off Astro

**The goal, in the words it was asked in: Optfall should be an installable PWA
running TypeScript 7, built on the stack SU-SRD already uses.** This phase is
last because nothing above it depends on it and everything above it survives it.

### The premise had a factual error in it, and finding it changed the target

The ask was to steal "a tanstack stack that is ssg and static with offline"
from SU-SRD. Read directly, that repository does not contain one. It contains
**two frontends with two stacks**, and the properties are split across them:

| App | Stack | Static? | Offline? | TanStack? |
|---|---|---|---|---|
| `apps/srd` | React 19 + a **hand-written SSG**, Vite for the client bundle only, Workbox `generateSW` | ~1,039 prerendered pages | yes | **no — none at all** |
| `apps/itun` | **TanStack Router + Query**, Vite SPA, `vite-plugin-pwa` | no — pure SPA, `index.html` fallback | yes | yes |

TanStack Start is in neither. Neither app prerenders through TanStack.

So "the TanStack one" and "the SSG, static, offline one" are different
programs, and only one of them can be copied here.

**IT IS `apps/srd`, AND THE DECIDING ARGUMENT IS OPTFALL'S OWN THESIS.** "Every
view is a URL" is the first line of Phase 2 and the reason 12,776 pages are
emitted at build time. A SPA cannot serve those: a pasted card link has to
arrive as HTML carrying that card's `<title>`, description and canonical,
because the thing reading it is a chat client's unfurler that runs no
JavaScript. Adopting the SPA half would trade the product's central claim for a
router.

There is a second argument, and it is the stronger one: **`apps/srd` IS this
migration, already performed once, by the same author. It was an Astro site.**
The target is not a design; it is a working precedent with 1,039 pages on it.

If TanStack Router is wanted later it belongs *inside* a client island — the
card search is the only surface with enough state to justify one — and that is
a decision this phase deliberately does not make.

**Made since, and the prediction held: TanStack is in, inside the islands, and
Router is not part of it.** Three pieces landed, each for a named problem rather
than because the stack lists them:

- **Query**, because the search indexes moved out of the pages. `/search`
  carried 909,626 bytes of encoded card index inside a `data-props` attribute
  and `/cr` carried 204,137 — bytes in the page cache, which the service worker
  drops on every deploy and cannot share between two documents. They are
  content-hashed files now (`ssg/searchIndexes.ts`), fetched by the island. What
  Query supplies is not caching — the URL carries a digest and the worker
  answers it from disk — it is the three states a fetched index has and a
  carried one does not: not here yet, here, failed. "Degrade visibly" makes the
  third non-optional, and an empty result list while the index is in flight is a
  confident wrong answer. `/search` went 921 kB → 11 kB, `/cr` 215 kB → 15 kB.
- **Store**, because the header's field belongs to two islands. The results
  island used to reach out of its own tree and adopt `#site-search` by id —
  about 150 lines, and three bugs came out of it. This document's own "two
  islands sharing a store" is what shipped.
- **Nothing else.** Router still has no job here: every view is a URL served as
  a real document, which is the argument this section already makes.

**Two were measured and declined, which is the part worth recording.** *Virtual*
for `?per=all`: measured on a real build at 2,943 results — initial render is no
slower than `?per=60` (both ~3.5 s, dominated by fetching the index rather than
by rows), scrolling costs 0.2 ms either way, and the worst case, re-ranking and
re-rendering every row from grid to list, is 717 ms once. Against that,
virtualising breaks Ctrl-F and the server-rendered first paint. *Pacer* for the
two debounced effects in `RulesSearch`: six lines of `setTimeout`, correct, and
deliberately kept separate — a dependency to replace them buys nothing.

*(An earlier measurement of the same `?per=all` re-render read as tens of
seconds and would have justified Virtual outright. It was an artifact:
`requestAnimationFrame` is throttled while a tab is in the background, so the
probe was timing the throttle rather than the render. Recorded because the wrong
number was convincing, and because the fix — time the DOM changing, not the
frame — applies to anything measured through an automated browser.)*

### The receipt this phase exists for

Recorded under "Rules that hold": `astro check` **cannot run under TypeScript
7**, and `svelte-check` needs a 6.x install alongside. "Optfall runs TypeScript
7" and "Optfall is an Astro site" are mutually exclusive as measured. SU-SRD is
the existence proof of the other side — `typescript: 7.0.2`, checked with plain
`tsc --noEmit`, with a `typescript-classic: npm:typescript@6.0.3` alias kept
only for two tools that call the TS 6 compiler API.

### What survives, which is most of it

The valuable half of this codebase does not know Astro exists:

- **`apps/site/src/lib/*.ts` — 6,064 lines.** The search engine, the query
  grammar, the corpus shaping, the legality derivation, the face keys, the
  keyword↔CR join. Framework-free, and it moves by changing an import path.
- **`packages/theme`, `packages/rules`, `packages/legality`** — untouched.
- **The tests.** 551 of them, almost all against the libraries.
- **Every URL.** This is a rendering change, not a routing change.

What is rewritten is the view layer: **17 `.astro` files (5,531 lines) and 33
Svelte components (2,339 in the app, the rest in `packages/components`)**.

### Why the port is mechanical rather than a redesign

`apps/srd`'s SSG kept **Astro's own page contract** on purpose:

```ts
export type PageModule<Params, Props> = {
  pattern: string                                  // '/card/[slug]'
  getStaticPaths?: () => StaticPath<Params, Props>[]
  page: (ctx: RouteContext<Params, Props>) => PageResult
}
```

That is `getStaticPaths` with a different spelling, so each Astro page maps to
one page module of the same shape, and `CARD_ROUTES` — which already returns
`{ params, props }` — feeds it unchanged. The renderer is Bun importing TSX
directly; there is no SSR Vite build at all.

### The order, and what each step is worth on its own

Each is a stack layer that leaves the site shippable.

| # | Step | Standing value if the phase stops here |
|---|---|---|
| **1** | Biome replaces the current lint/format toolchain | One formatter, and it is what SU-SRD uses |
| **2** | The SSG harness — `ssg/{build,routes,render,document,outputPath}.ts`, rendering ONE trivial page beside Astro | A second renderer proven against the real build |
| **3** | Port `packages/components` Svelte → React, keeping every token and the `CardFaceGroup` compliance contract | The library stops being framework-bound |
| **4** | Port the pages, cheapest first: `/data-terms`, `/syntax`, `/sets`, `/cr`, `/card`, `/search`, `/` | Each page is one reviewable PR |
| **5a** | Port the Svelte-only test coverage — the axe suite and the `GameSymbol` cascade guard — to React | The deletion below becomes a move rather than a loss |
| **5b** | Delete Astro and Svelte; the generator's output becomes `dist/`; `tsc --noEmit` replaces `astro check` | One renderer, one resolver, no framework |
| **5c** | **TypeScript 7 lands here** | The receipt above is paid |
| **6** | Workbox `generateSW` + a web app manifest — installable, offline | The PWA the ask named |

**What layer 6 found, which was not a service-worker bug at all.** Workbox
refused to precache a 9.74 MB file and said so, which is the only reason anybody
looked: **the island bundle was 9.28 MB, and roughly 9.2 MB of it was the card
corpus.** `card-search.ts` value-imported two pure helpers from `cards.ts`,
`cards.ts` loads the 18 MB corpus at module scope, and the island entry reaches
`card-search.ts` through `CardSearch.tsx` — so Rollup did exactly as asked and
shipped the corpus to every reader who opened the front page, `/search`, `/cr` or
any card page. Every check was green while that shipped, because **a bundle
nobody measures is a bundle that can be any size at all**. The helpers moved to
`src/lib/printings.ts`, which is corpus-free; the bundle is **233 kB**; and
`build.ts` now fails over a stated ceiling so it cannot come back.

The service worker had its own version of the same lesson. A Workbox
`urlPattern` callback is serialized with `Function.prototype.toString`, so a
matcher that referenced a module-scope constant emitted a worker where that
identifier does not exist — every request threw inside route matching, which
aborted matching entirely, so **both** the page cache and the COMPLIANCE §5
guard against caching card art were dead. The build was green, the worker
registered and activated, and the precache populated correctly; the only visible
symptom was an empty `pages` cache. The build now reads the emitted worker back
and asserts the rules are in it.

Step 5 split into three once it was under way, and the split is worth recording
rather than smoothing over. 5a exists because deleting `src/svelte` would have
silently deleted 50 accessibility assertions and the only guard on a CSS cascade
bug this project actually shipped; porting them first is what makes the deletion
reviewable. 5c is separate because a compiler swap that lands in the same diff as
a framework deletion cannot be bisected.

**What 5b found that page-count parity could not see.** The generator had linked
`/favicon.svg` from every one of its 12,776 pages since layer 2 and never emitted
it. Astro produced that file from an endpoint route — a `.ts` under `src/pages/`
exporting `GET` — and the port had no equivalent, so the file was not a page, no
count included it, and nothing missed it. It is now an explicit
`generatedAssets()` registry in `ssg/assets.ts`, deliberately a list rather than a
directory convention: a convention is precisely the mechanism that produces
nothing, silently, when it is not followed.

Two checks were rewritten in the same layer and both got stronger for it.
`check-built-tokens.ts` used to grep every page for the token DEFINITIONS Astro
inlined into it; the generator links one cached stylesheet instead, so the check
now asserts three separate facts — every page links a sheet, every href resolves
to a file that exists, and the sheets together define every token. The middle one
is new, and it is the failure the move introduced: the sheets are content-hashed,
so a page can link a stylesheet that no longer exists and look perfectly correct
in the HTML. `check-dev-server.ts` lost the asymmetry it was written for (there
is no second module resolver left to disagree with the first) and gained the
favicon and a `public/` asset, which reach the output by two other mechanisms
that can each fail in silence.

### Two decisions taken up front, because they are cheap now and expensive later

**Precache the shell, never the pages.** `apps/srd` globs
`**/*.{js,css,woff2,svg}` and deliberately excludes HTML and images, with
`navigateFallback: null` — an unvisited page should 404 offline rather than
resolve to a stale shell that lies. Optfall has **12,776 pages**, so this is not
a preference here, it is the only option.

*As implemented, with the two amendments the review of layer 6 forced.* Visited
pages get **`NetworkFirst`** with a 3-second timeout, not `StaleWhileRevalidate`:
every asset is content-hashed and asset deploys are atomic, so serving
stored HTML first meant a returning reader got a document linking the previous
deploy's stylesheets, which 404 — an unstyled page with no islands on every
deploy. And **exactly one document is precached**, `/`, because it is the
manifest's `start_url` and an install that cannot cold-start offline is not an
install. That is one file chosen as the app's entry point, not a category; the
other 13,674 remain the runtime cache's business. It is the door rather than
`/search` because the door is 47 kB gzipped against 245 kB and carries the
typeahead, which is what somebody who just tapped an app icon wants.

**Card images are never precached.** `docs/COMPLIANCE.md` §5 — the licence is
revocable, and a service worker that has already stored the art is a cache we
cannot recall. Faces stay network-fetched, and losing them offline costs a
rendering layer exactly as "Survive revocation" says it should.

### Exit criteria

`bun run typecheck` passes on TypeScript 7 with no Astro in the dependency
tree; all 12,776 URLs still resolve with their titles and canonicals intact;
the site installs to a home screen and a card page visited once opens again
with the network off.

✅ **Met.** TypeScript 7.0.2 across every workspace with `astro`, `svelte` and
`storybook` absent from the lockfile; 12,776 pages built and checked by
`check-disclaimer`, `check-built-tokens` and `check-card-notice`; the manifest
parses and the worker activates; and both halves of the offline claim were
verified by killing the origin server rather than by reading the config — a
visited card page renders complete, and an unvisited one fails with the
browser's own network error rather than a shell that pretends to know.

---

## Rules that hold across every phase

Three Flesh and Blood tools have now died or decayed, none of them from lack of
demand. This is the part of the plan that is not about features.

- **No language model in the shipped product.** Nothing a user touches calls one,
  and no dataset Optfall publishes contains model-generated content — which rules
  out LLM-assisted parsing in the document pipeline exactly as much as it rules
  out a chat box. Parsers are deterministic code whose output diffs cleanly and
  fails loudly; a model's does neither. Every string served traces to a parsed
  official document or a named human author. Treat this as structural rather than
  a quality bar: the positioning is *being right*, and a tool with no capacity to
  compose prose cannot state a confident wrong rule to a player mid-round. The
  boundary is output, not tooling — a model used off to the side while building is
  fine right up until its words reach a user or a published file.
- **Compose, never restyle.** Every surface is assembled from the component
  library. A screen that needs new CSS is a signal the library is missing a
  primitive — add it there, not in the page.
- **Mobile is a number, not an adjective.** "Looks good on mobile" is not a
  check anybody can fail, so these are the widths every surface is verified at,
  and the measured facts that make them the interesting ones:

  | CSS px | What it is | What it costs us |
  |---|---|---|
  | **320** | The narrowest viewport still in use (SE-class). The floor. | The card face overflows by 130px. Nothing may scroll sideways here. |
  | **360** | The common Android width. | Face overflows by 90px. |
  | **390** | The common iPhone width — the single most likely visitor. | Face overflows by 60px. |
  | **430** | Large phones, and small tablets in portrait. | Face overflows by 20px. |
  | **964** | Where the card page stops being two columns. Measured, not chosen. | Below it the face sits above the details rather than beside them. |
  | **1226** | `layout.page.wide` — the content column's own maximum. | Above it the page stops widening; the margins take the rest. |

  **964 AND 1226 ARE DIFFERENT KINDS OF NUMBER, and an earlier version of this
  table said they were the same one.** It listed 1226 as "the two-column
  threshold — below it the card page is one column", and that is false in both
  halves. `layout.page.wide` is
  `card.face.normal + space.loosest + type.measure` = exactly 1226px, and it is
  a `max-inline-size` on `main[data-width="wide"]` — a ceiling on how wide the
  CONTENT column may grow, which says nothing about when its two columns stop
  fitting side by side. Measured on the shipped site, the card page is still two
  columns at 1225, at 1100, at 1000, and flips to one column between 963 and
  964.

  That 964 is emergent rather than declared is the point rather than an
  oversight: the layout is `flex-wrap` over a face with a 450px basis and a
  details column with `flex: 1 1 min(450px, 100%)`, so the wrap point is
  whatever those widths plus the gutter add up to. Nothing names it, nothing can
  drift from it, and it moves on its own if the face token moves. It is written
  down here because a number nobody has measured is a number nobody can check —
  not so that anything may branch on it.

  **THE FACE IS WIDER THAN THE PHONE, AND THAT IS THE WHOLE MOBILE PROBLEM.**
  `card.face.normal` is 28.125rem — 450px — because that is a width the image
  host actually publishes, and it exceeds *every* viewport in the table above.
  So a card page on a phone is never the desktop page made smaller: the face
  must scale below its published width, the two-column layout can never apply,
  and any element sized from the face rather than from the viewport is a
  horizontal scrollbar waiting for a visitor. Every horizontal-overflow bug
  found while landing the mobile work was some version of a box that knew its
  own width but not the window's.

  ✅ **Verified on the live site after Phase 6.** Six surfaces — a card page,
  `/search` with results, the door, `/cr`, `/sets` and `/syntax` — rendered at
  every width in the table plus 1225, and in all **36 combinations
  `documentElement.scrollWidth === clientWidth`**: nothing scrolls sideways
  anywhere, which is the one rule the 320 row states as absolute.

  Measured by loading each page in an iframe of the target width rather than by
  resizing the window, because the window resize available here moves the OS
  frame without changing the viewport the layout sees — an iframe gets its own
  layout viewport, so intrinsic sizing and any media condition resolve exactly
  as they would on a device of that width.

  Two findings worth keeping, both of which look like bugs and are not:

  - **The printings table does scroll sideways — inside its own box.** It is
    736px wide at every viewport and sits in `.of-card__scroller`, whose
    `overflow-x: auto` contains it. The page body never moves, which is the
    distinction the rule turns on: a wide table is allowed to be wide, it is
    just not allowed to drag the document with it.
  - **The legality grid drops to one column on its own**, through
    `repeat(auto-fit, minmax(min(…, 100%), 1fr))`. The `min(…, 100%)` is what
    makes it safe at 320 — without it the track keeps its declared minimum and
    overflows the viewport, which is the single most common way this rule gets
    broken.

  **These are widths to TEST at, never widths to branch on.** `check-tokens.ts`
  rejects raw `px`/`rem` in component CSS and a media condition cannot take a
  custom property, so a breakpoint is not expressible here at all. That
  constraint is kept rather than worked around, because every time it has forced
  the intrinsic answer — `clamp`, `minmax`, `fit-content`, container queries —
  the intrinsic answer has also been the one that holds at widths nobody
  enumerated. The numbers above are where the browser is pointed to confirm it,
  not values any stylesheet may name.
- **One TypeScript, and it is 7.0.2.** ✅ **Paid, Phase 6 layer 5c.** Every
  workspace resolves the same compiler, so "does it typecheck" has one answer
  regardless of which directory asks.

  **The history is kept because the reasoning is the argument that moved this
  project off Astro, and it was a measurement rather than a preference.** Three
  compilers were once installed and running against this repo at once — 7.0.2 at
  the root, 6.0.3 for the site, 5.9.3 for the components package. The two
  framework workspaces were pinned to 6.0.3 because TypeScript 7 is the native
  Go compiler and does not expose the programmatic API the framework checkers
  are built on:

  - `astro check` refused outright — *"TypeScript's native compiler (7.0 and
    later) does not ship this API yet … run `astro check` with a TypeScript
    version that still provides it (6.x)"* (withastro/roadmap#1321).
  - `svelte-check` could use it, but only alongside a 6.x install and behind
    `--tsgo`, so **6 remained the primary compiler either way**.

  "Optfall should run TypeScript 7" and "Optfall is an Astro site" were not two
  goals to sequence — measured, they were mutually exclusive. So TS 7 was made
  an OUTCOME of leaving Astro rather than a prerequisite for it, and that is
  exactly how it landed: layer 5b replaced `astro check` with `tsc --noEmit` and
  deleted `svelte-check`, after which layer 5c was deleting two `~6.0.3` pins.
  **Nothing in this repository calls the TypeScript API programmatically**, which
  is what made the last step that small.

  The native compiler is also considerably faster on this codebase: the site's
  own typecheck went from 7.26s to 2.80s, and each library workspace from
  roughly 200ms to 150ms.
- **Tokens or nothing.** No component may name a colour or a size directly. The
  lint rule is what makes this real; a design system defended by prose lasts
  about six weeks.
- **Publish the data, not just the site.** Every dataset ships as an openly
  licensed bulk dump from day one. If the site disappears the corpus does not.
- **Static by default.** No backend means no uptime story to fail, no bill to
  lapse, and no service that quietly dies six months after attention moves on.
- **Sync, never curate.** Automated pulls from maintained upstreams.
  Hand-curation only for the small announcement-driven feeds where no upstream
  exists.
- **Degrade visibly.** Every surface shows when its data was last confirmed. A
  stale Optfall must look stale — a tool that lies about freshness is worse than
  one obviously behind.
- **Contribute upstream, never fork.** Being the ecosystem's best downstream
  contributor is more durable than being its fragile single point of failure.
- **Show up before you need them.** Phase 5's code is late but its relationships
  are not. Be present in the judge community from the first shipped surface
  onward — answering, citing, being useful — so the eventual ask comes from a
  familiar name rather than a stranger with a URL.
- **Survive revocation.** The art licence is revocable at LSS's discretion.
  Rulings, rules and legality data are ours. Losing images costs a rendering
  layer, never the product.

---

## Out of scope, and why

- **A better Fabrary.** Not merely the leading deckbuilder — the ecosystem's
  sharing layer, which LSS's own deck builder imports *from*. Its predecessor
  died in that slot without the network effect transferring.
- ~~**A card search destination.**~~ **This is now the product** — see Phase 2.
  The earlier entry ruled it out because Opt occupied the category and had gone
  stale. That reads the evidence backwards: Opt's decay is the opening, and it
  names the thing to solve structurally rather than by diligence. Kept visible
  rather than deleted, because the argument was made at length and a reader
  should see what replaced it.
- **A tournament results database.** Paper results split across two incompatible
  platforms with no export; one site tried and fell back to manual submission.
  Not permanently dead — the cross-platform player-identity join is a moat LSS
  can never replicate, since they do not own the rival platform — but gate it on
  a day of work first: hand-resolve 200 players appearing in both systems
  against a pre-committed precision threshold.
- **Anything in the collector economy.** The most contested territory in the
  game: six price aggregators, sealed expected-value calculators already
  modelling FaB's own post-draw sift, live buyout and arbitrage detection,
  population reports from three grading companies, and a mature scanner app with
  commercial backing.

  **Amended 2026-08-17: a purchase link is not this, and the line is drawn at
  whether a claim rots.** Card pages carry a per-printing "buy" link
  (`apps/site/src/lib/tcgplayer.ts`), which says *this printing is purchasable,
  here* — a fact that is as true a month after a sync as on the day of it.
  **A price is still out**, and the reason is this document's own model rather
  than squeamishness: the corpus is committed JSON pinned by commit, so a price
  would be the one field on the page with no version to cite and no way to be
  right between syncs. TCGplayer's API being closed to new applicants is the
  lesser objection and would not change this if it reopened.

  The permission question that kept even the link out until now is settled in
  [`COMPLIANCE.md`](COMPLIANCE.md) §2 — indirect monetisation, which LSS's terms
  permit to card databases by name.
- **Tournament software.** The white space is total and empty for a reason: GEM
  is mandatory for sanctioned play, so anything touching pairings or results
  demands double entry of every player.
- **Deck-math tooling** — parked, not rejected. Flesh and Blood decks are
  *queues, not bags*: pitched cards go to the bottom in an order you choose, so
  every hypergeometric calculator in the ecosystem may be importing an
  assumption from Magic that does not hold. Two checks before any code: verify
  the pitch-ordering rule against the current Comprehensive Rules, then test
  whether strong players *disagree with each other* on ordering in comparable
  spots. Disagreement means the skill has depth; convergence means it is
  folklore that already works.

---

## Settled, and still open

**Settled.** `alxjrvs/optfall`, personal ownership, MIT, TypeScript on Bun,
**React components and a static generator this project owns**, **TanStack Query
and Store inside the client islands and no router**, Cloudflare hosting,
repository settings as a `gh api` script rather than Terraform, no direct
monetisation, and no language model in anything shipped. **The positioning is
settled too: a card search engine and reference, Scryfall-shaped, with the rules
engine attached.**

*This line read "Svelte components, Astro site" until Phase 6 deleted both, and
went on reading that way after they were gone. It is corrected rather than
quietly rewritten because it is the third instance of the same failure this
document now records twice elsewhere: a summary line nobody re-measures drifts in
whichever direction is least visible, and the summary of what is settled is
exactly the kind of prose nobody re-reads.*

**Settled, and it was the headline question.** Past banned-and-restricted
revisions *are* publicly archived — the Wayback Machine carries 202 archived
announcement URLs spanning 2021-03-18 to 2025-11-14, and a capture retrieves as
readable content carrying date, author, card, format and action. **Time travel is
a scraping job, not an excavation.** See `docs/PHASE-2-REPORT.md` for the
evidence and for the one caveat: the announcements are editorial prose rather
than tables, so extraction is closed-vocabulary matching against known card names
with human review, never a language model.

**Settled, and it removes a licence worry.** The card dataset ships no `LICENSE`
file, and earlier revisions treated that as a hard blocker. It is not. What
legality checking needs from it are facts, LSS publishes the same information,
and the realistic worst case is a maintainer asking us to stop. Asking for a
licence is still worth five minutes; it is not a gate to clear before building.

**One closed, one still open.** The domain question is answered by the site
being on it: `optfall.com` serves the build. The state-backend question that sat
here is gone rather than answered — dropping Terraform removed the thing that
needed a backend, which is the cheapest way to close a question.

**Settled: Grenze, SIL Open Font License 1.1, self-hosted.**
`docs/DESIGN.md` called the display face "the single highest-leverage upgrade
available" and named three candidates that can be legitimately self-hosted.
Grenze is the one it describes as angular, faintly medieval and *uncommon*,
against Cinzel's "the default fantasy choice" — uncommon being worth more than
familiar on a face whose job is to be recognised.

The OFL permits webfont embedding and self-hosting, which is the licence
question this was blocked on. It is served from our own origin rather than a
font CDN, for the same reason nothing else here depends on a third party staying
up, and `data/fonts/fonts.json` records its URL and SHA-256 because
`docs/COMPLIANCE.md` §3 wants an origin for every binary served publicly.

*A previous revision of this paragraph marked this closed while it was open, and
was wrong on both halves it asserted: the token layer said the opposite, and
`check-tokens.ts` has no font rule to enforce anything with. That retraction is
left in the history rather than smoothed over — closing a licensing item on an
assumption is exactly the failure this section keeps recording.*

**Unverified.** The pitch-queue mechanic behind the parked deck-math work was
never confirmed against the current rules — the official site blocks automated
access. Community pain-point evidence is largely inferential, since research was
blocked from Reddit: the gaps are well evidenced, the intensity of demand for
them is not.

<!--
  Chip definitions for the phase table. The colours are hexes from the DARK set
  of `packages/theme/src/tokens.ts` — the light set gives the same names
  different values — namely `color.state.legal`, `color.brass`,
  `color.state.restricted` and `color.ink.faint`. The legend that says what each
  word commits to is in `COMPLIANCE.md`, under "How to read a chip". Markdown
  has no link table shared across files, so `README.md` and `COMPLIANCE.md` each
  repeat the definitions they use.
-->

[chip-done]: https://img.shields.io/badge/done-2f7d4f?style=flat-square
[chip-live]: https://img.shields.io/badge/live-b08d3f?style=flat-square
[chip-blocked]: https://img.shields.io/badge/blocked-6f5aa6?style=flat-square
[chip-planned]: https://img.shields.io/badge/planned-787878?style=flat-square
