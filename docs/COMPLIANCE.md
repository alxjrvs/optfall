# Compliance

Optfall exists inside a written grant from Legend Story Studios. This document is
the operational form of that grant: what we were given, what we owe in return,
where each obligation is enforced in the codebase, and what would break it.

It is derived from the **Permission envelope** section of
[`PLAN.md`](PLAN.md) and does not supersede it. Where the two disagree,
`PLAN.md` is the specification and this file has a bug.

**Treat this as a checklist, not an essay.** Every requirement below has an
enforcement point. A requirement whose only enforcement is "remember it" is not
enforced, and should be read as an open action rather than a satisfied one.

---

## The source

| | |
|---|---|
| Document | *Terms of Use for Game and Studio Assets and IP* |
| Publisher | Legend Story Studios |
| URL | <https://fabtcg.com/resources/terms-use-licensed-assets/> |
| Commercial licensing contact | `ip@legendstory.com` |
| Last checked | 2026-08-08 |

> **Verification caveat — read this before relying on a quotation below.**
> `fabtcg.com` returns **HTTP 403 to automated fetches**, which is consistent
> with `PLAN.md`'s note that the official site blocks automated access. The
> clause summaries in this document were assembled from search-engine excerpts
> of that page plus the envelope already recorded in `PLAN.md`. They are
> faithful to the best available reading, but they have **not** been read
> character-for-character off the live page by a human.
>
> **Action, before the first public deploy:** a human opens that URL, reads it
> end to end, and either confirms this document or corrects it — in particular
> the exact disclaimer wording, the exact copyright line, and the logo clause.
> Until that happens, treat this file as high-confidence but unratified.
>
> The one string in this repository that is **not** subject to that caveat is
> the disclaimer, which is reproduced from `PLAN.md` and cross-checks
> byte-for-byte against `README.md`.

---

## Granted

What the policy affirmatively permits, and which we are relying on:

| Granted | What Optfall does with it |
|---|---|
| **Card databases** and related services | The card layer (Phase 3) and the legality dataset |
| **Rules enforcement applications** | The legality checker (Phase 2) and the rulings archive (Phase 5) |
| **APIs** transferring game content, if not directly monetised | Committed JSON served as static files — simultaneously our storage, our API and our audit trail |
| **Card face images**, for building card databases | Card rendering (Phase 3), under the copyright line below |
| **Indirect monetisation** — Patreon and ad-sense are named | Nothing today. Available if hosting costs ever need covering |

Two of these are *conditional* grants rather than unconditional ones: the API
permission is conditioned on no direct monetisation **and** on the recipient's
own compliance, and the image permission is conditioned on the copyright line.
Both conditions appear in the checklist below.

---

## Required of us

Six obligations. Each is a section: the requirement, where it is enforced, what
would break it, and how we would find out.

Enforcement points name files that mostly do not exist yet — Phase 0 is the
phase that creates them. Status is marked honestly.

### 1. Individual, never a commercial entity

**Requirement.** The policy bars third-party applications built by commercial
entities, and reserves immediate legal action for violations by a commercial
entity or in the course of a commercial undertaking. Optfall is a personal
project of an individual and must stay one.

**Enforced at.**

- [`scripts/repo-settings.sh`](../scripts/repo-settings.sh) — the repository is
  declared as a script pinned to `alxjrvs/optfall`, and its `--check` mode
  asserts against the live repository that the owner is that account **and that
  the owner's type is `User`, not `Organization`**. That second assertion is the
  compliance control: a transfer to an org is the failure this section exists to
  catch, and it fails the build rather than waiting to be noticed.
- `.github/workflows/repo-settings-check.yml` — runs that check **weekly**, not
  per pull request, and opens an issue when it fails. It is deliberately not a
  required check: reading the settings needs administrative read, which no
  workflow token can be granted, so gating merges on it would block every pull
  request until a human installed a personal access token. See the workflow's
  own header for the full reasoning.
- `LICENSE` — copyright held by `alxjrvs`, an individual, not an entity.
- The Netlify site, the domain and any future Patreon are held on the same
  personal account.

**Status. Partially enforced, and an open action.** The ownership assertion is
real and machine-checked, but it runs weekly rather than continuously, and until
the `REPO_SETTINGS_TOKEN` secret exists the scheduled run warns and stops — so
today this control is *declared but not yet active*. Per this document's own
preamble, that makes it an open action rather than an enforced control. The
Netlify, domain and funding accounts are caught only by a human noticing, and
always were.

**Open action:** create `REPO_SETTINGS_TOKEN` (see `docs/PHASE-0-STATUS.md`,
handoff step 3) to activate the weekly assertion.

**What would break it.**

- Transferring the repo to a GitHub **organisation** — including a non-profit or
  a "just for tidiness" org. The policy's line is the entity, not the intent.
- Incorporating, or accepting the project into a company's portfolio.
- A sponsor, employer or client acquiring any ownership interest.
- Accepting contributions under a corporate CLA that vests rights in a company.

`PLAN.md` is explicit that this is expensive to undo, which is why it is decided
before the first commit rather than after.

**How we would find out.** The drift check above fails the build on an owner
change or an org transfer. Everything outside the repository — the Netlify
account, the domain registrar, a funding account — is caught by a human
noticing, which is exactly why it is written down here.

### 2. No direct monetisation

**Requirement.** No sales, no subscriptions, no selling products inside the app,
and no directly monetised API. Indirect monetisation — Patreon, ad-sense — is
explicitly permitted.

**Enforced at.**

- Structurally, by the stack. There is no server, no account system, no
  payment integration and no private tier, because the whole product is static
  output plus committed JSON. Charging for something requires building the
  machinery to charge, which is a conspicuous diff.
- `package.json` dependency review — a payments SDK appearing in a lockfile is
  the earliest visible signal.

**Status.** In force by construction.

**What would break it.** A paid tier, a subscription, a rate-limited "pro" API
key, selling the dataset, or selling placement *within* game content.

**Open question for a human.** Affiliate links on card pages (a "buy this card"
link paying a commission) sit on the boundary: it resembles the permitted
ad-sense case, but it monetises the game content itself rather than the page
around it. **Do not add affiliate links without asking LSS first.** Recorded
here rather than decided.

### 3. No FAB or LSS logos — and no close semblance of them

**Requirement.** No Flesh and Blood or Legend Story Studios logos anywhere in
the application. **Product set logos count as FAB logos.** Card faces are fine;
set symbols used as filter icons are not.

The policy goes further than "do not use our logos" — per `DESIGN.md`, it
prohibits creating any **close semblance** to them. That constrains our own
mark, not just borrowed assets.

**Enforced at.**

- **The design tokens.** `PLAN.md` requires the no-logo constraint be written
  into the token layer rather than left as a thing to remember. Concretely:
  set identity is **typographic** — a set code rendered in type — and there is
  no set-symbol icon token, no icon slot on set chrome that could accept one,
  and no `set-symbol` asset directory. The absence is the enforcement; adding
  one is an additive, reviewable diff rather than a config flag.
- **The icon registry** in the component package is a closed set. A set symbol
  cannot be rendered without being added to it by name.
- **The lint rule** already required by Phase 1 (no raw hex, no raw pixel value
  in a component) is the same seam that rejects a raw asset import in a
  component.
- **The mark** (`DESIGN.md`, "The mark") is drawn from a game *mechanic* — the
  pitch jewel — not from LSS's branding idiom. A mechanic cannot be confused
  with a trademark. This is why the mark is not an angular chiselled wordmark,
  even one drawn from scratch.
- **Asset provenance.** Every binary asset committed under a public directory
  needs a recorded origin. An asset with no provenance entry is treated as
  non-compliant until it has one.

**Status.** Specified in `DESIGN.md` and `PLAN.md`; enforced once Phase 1's
token package and lint rule land.

**What would break it.**

- Set symbols as filter icons, sort affordances, or favicons — the single most
  likely violation, because it is the obvious UI move and every card site does it.
- A set logo in a card-detail header, a release-timeline graphic, or an OG image.
- The FAB or LSS logo on an "about", "credits" or "data sources" page — including
  as a link decoration next to a citation of an official document.
- Redrawing either logo "in our own style". Close semblance is the operative
  phrase.
- A community-made set-symbol icon font pulled in as a dependency.

**Adjacent, and often confused with it.** There is **no official FaB font**
available to third parties — the card typefaces are licensed *to* LSS by
foundries and are not LSS's to sublicense, so community tools bundling "official
fonts" are not a licence and are not a precedent. Any display face we adopt must
be independently licensed for webfont embedding (`DESIGN.md`, open questions).

**How we would find out.** Today: review, and nothing else — **this one is an
open action, not a satisfied requirement.** The intended enforcement is a CI
check over built output and committed assets that fails on a known set-symbol
filename pattern, which catches the careless case; it lands with Phase 1's asset
pipeline, since there are no committed binary assets to scan yet. The deliberate
case is caught in review either way, which is why the constraint is written into
the tokens: it makes the deliberate case look deliberate.

### 4. The verbatim disclaimer

**Requirement.** The disclaimer appears in the footer, verbatim.

**The canonical text.** This is the single source of truth for the string. It is
reproduced from `PLAN.md` ("Required disclaimer") and cross-checks against
`README.md`. Line wrapping is not significant; the character sequence is,
including the `®` after *Legend Story Studios* and the `™` after
*Flesh and Blood*.

```text
Optfall is in no way affiliated with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are trademarks of Legend Story Studios. Flesh and Blood characters, cards, logos, and art are property of Legend Story Studios.
```

LSS's template begins `[Your app name] is in no way affiliated with…`. The
substitution of `Optfall` for the app name is the **only** permitted variation.
Not the punctuation, not the trademark symbols, not "aren't" for "are not", and
not a shortened version because the footer is crowded.

**Enforced at.**

- One exported constant in the site source — `LSS_DISCLAIMER` in
  [`apps/site/src/lib/compliance.ts`](../apps/site/src/lib/compliance.ts). Every
  surface that renders the disclaimer imports that constant. Nobody retypes it,
  and there is exactly one place a typo can live.
- The site layout footer
  ([`ComplianceFooter.astro`](../apps/site/src/components/ComplianceFooter.astro),
  rendered by `BaseLayout`), so it appears on every page rather than on an
  about page.
- [`scripts/canonical-disclaimer.ts`](../scripts/canonical-disclaimer.ts) reads
  the canonical text out of `PLAN.md` itself, so no check compares a copy
  against another copy. `scripts/canonical-disclaimer.test.ts` asserts that the
  site constant, `README.md` and this document all still say exactly that, and
  runs in the `test` job.
- [`scripts/check-disclaimer.ts`](../scripts/check-disclaimer.ts) asserts the
  exact byte string appears in every built HTML page under the site's output
  directory, and reports a reflow distinctly from an omission. It runs as the
  `disclaimer` job in CI, which is wired into the aggregate `gate`. An empty
  output directory fails rather than passing vacuously.

**Status.** Enforced. Text canonicalised in `PLAN.md`, rendered from one
constant, and asserted in CI on both the source and the built output.

**What would break it.** Paraphrasing it. Reflowing it into a component that
inserts soft hyphens. An editor autocorrecting `®`/`™`. A page rendered outside
the shared layout — an error page, an embed, a standalone Storybook build, an
OG-image route. Rendering it only on `/about`. Hiding it behind a collapsed
"legal" disclosure. Shipping it in an image rather than text.

**Where it must also appear.** `README.md` carries it (it already does), and any
standalone published surface — Storybook, the docs site, embedded custom
elements distributed to other tools — needs its own copy. An embeddable
component handed to a third party carries our compliance obligation into their
page; that is a design constraint on the custom-element build, not an
afterthought.

### 5. The copyright line on card images

**Requirement.** Wherever FAB card images are used, the appropriate copyright
disclaimer must be provided: **`© Legend Story Studios`**.

**Enforced at.**

- **The card component contract.** The component that renders a card image
  renders the copyright line **itself**. It is not a prop the caller may omit,
  not a default that can be overridden to empty, and not the page's
  responsibility. A caller who wants the image gets the line.
- The image-serving layer (Phase 3, "own bucket, copyright line, no set logos in
  chrome") applies it at the serving boundary as well, so a hotlinked image is
  not an unmarked image.
- A Storybook story per card-rendering component, so removal shows up as a
  visual-regression diff rather than as nothing.

**Status.** Specified as a component contract; enforced when Phase 1's component
package and Phase 3's card layer land.

**What would break it.** Making the line a prop. Adding a `compact` or
`bare` variant that drops it. A tooltip or hover-preview path that renders the
image outside the component. An OG image or share card generated from raw
artwork. Bulk-exporting images without the notice travelling with them.

**Note on scope.** This obligation attaches to *images*. It is not a substitute
for the footer disclaimer, and the footer disclaimer is not a substitute for it.
Both are required, in different places, for different reasons.

### 6. Terms on our own published data

**Requirement.** The grant binds recipients too: the API permission is
conditioned on the recipient's use also being compliant. So anything Optfall
publishes must carry terms that pass LSS's conditions downstream rather than
silently dropping them.

**Enforced at.**

- [`DATA-TERMS.md`](DATA-TERMS.md) — the governing document. It splits what we
  own from what LSS owns, licenses only the former, and passes LSS's conditions
  through on the latter.
- Every published dataset directory ships its terms as a sibling file, so a
  bulk download carries them without the website.
- Every published JSON payload carries a metadata block naming the terms URL,
  the licence of the structural work, and the source commit — so a file that has
  been copied three times still says what it is.
- `LICENSE` is deliberately **pure, unmodified MIT** so that licence detectors
  and SPDX matching identify it cleanly. It therefore says nothing about data.
  The code/data split is stated in `README.md` and governed by `DATA-TERMS.md`.

**Status.** `DATA-TERMS.md` lands with this document. The per-dataset files and
the metadata block are enforced when the first dataset ships in Phase 2.

**What would break it.** Publishing a dataset with a bare `LICENSE` implying the
whole file is ours to license. Applying an open licence to card names, card text
or card art. Shipping a bulk export with no terms file. Letting a downstream
consumer reasonably believe they may redistribute card images without the
copyright line.

---

## Revocation, not litigation

The policy describes enforcement as friendly warnings before escalation, with
immediate legal action reserved for commercial entities and deliberate
non-compliance. Optfall is neither. **So the realistic bad outcome is that the
grant is withdrawn, not that anyone is sued.**

That changes what "compliance risk" means here. It is not a legal-exposure
problem to be insured against; it is an **architecture** problem. The question
is not *how bad would it be* but *how much of the product is standing on
borrowed ground*.

The answer we are committing to: **a rendering layer, and nothing else.**

### What that requires, concretely

- **Rulings, rules and legality data are ours.** They are derived from published
  official documents and from named human authors, not from licensed assets.
- **The legality package keys on stable identifiers, never on card text.**
  `isLegal(deck, format, asOf)` resolves ids against a timeline of ban and
  retirement events. Card *names* are a display-layer join, not a load-bearing
  key. A legality verdict that requires the card's rules text to compute has
  welded the product to the licence.
- **Card images are a separate, droppable layer.** Phase 3 exists to serve the
  other phases, not to be a product — which is also why it is one week and
  explicitly minimal.
- **Every dataset is a committed file, not a service.** If the grant were
  withdrawn tomorrow, the corpus already exists in every clone and every fork.

### The revocation drill

Before each phase ships, answer in writing: *if the image and card-text licence
disappeared this afternoon, what stops working?* The permitted answer is "cards
render as typographic placeholders". Any other answer is a design defect found
early, which is the entire point of asking.

The testable form: the legality package and the rules corpus must build, pass
their test suites, and produce correct verdicts **with the card text and image
layers removed**. If that test cannot be written, the separation is notional.

---

## Standing checks

Related constraints that are enforced continuously rather than reviewed. They
are not part of the LSS grant, but they are load-bearing for the same reason —
they are properties that erode silently unless something fails loudly.

- **No language model in the shipped product.** The `no-llm-dependencies` job in
  CI reads every tracked `package.json` and fails on any LLM or AI-SDK
  dependency, by exact name or by scope. No dataset Optfall publishes contains
  model-generated content; see [`DATA-TERMS.md`](DATA-TERMS.md), which states
  this as a warranty to consumers rather than an internal preference.
- **Upstream dataset licence.** The community card dataset we depend on ships no
  licence. See [`upstream-licence-issue.md`](upstream-licence-issue.md) for the
  status and the interim position. Until it resolves, we do not republish that
  dataset's files verbatim.

---

## Review triggers

Re-run this checklist when any of the following happens. Not on a calendar —
calendars are ignored; these are events that are hard to miss.

1. **LSS publishes a policy update.** The terms have been revised before.
2. **Before the first public deploy**, and before each phase's first public
   surface — the revocation drill above.
3. **Any change to who owns the repo, the domain, or a funding account.**
4. **Any new binary asset** committed under a public directory.
5. **Any money enters the picture**, in any form, including donations.
6. **Any embeddable artefact published for third parties** — the custom-element
   build carries our obligations into someone else's page.
7. **Before opening the upstream licence request**, since it cites LSS's grant
   and should not cite it wrongly.

---

## Open actions

Carried, not closed. Each needs a human.

| # | Action | Blocks |
|---|---|---|
| 1 | Read the LSS terms page end to end and ratify or correct this document — especially the disclaimer wording, the copyright line, and the logo clause | First public deploy |
| 2 | Decide the affiliate-link question (§2), or decide not to decide it and record that | Any revenue |
| 3 | Confirm the display typeface is licensed for webfont embedding (`DESIGN.md`) | Phase 1 |
| 4 | Post the upstream licence request | Phase 2/3 data work |
| 5 | Write the revocation-drill test once the legality package exists | Phase 2 exit |
