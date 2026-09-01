# Optfall — roadmap

**Scryfall, for Flesh and Blood.** A card search engine and reference, with a
rules engine attached — every card, every printing, every rule, each citable and
each with a permanent URL.

> **Supersedes `docs/PLAN.md`,** which was retired on 2026-09-01. That file was
> 1,122 lines and carried three jobs at once: the LSS disclaimer specification,
> a project-wide rules section, and this roadmap. The first is now
> [`DISCLAIMER.md`](DISCLAIMER.md) — a legally load-bearing string should not
> live inside a document people reflow. The second is stated where each rule is
> enforced: no language model in [`../LLM_STATEMENT.md`](../LLM_STATEMENT.md),
> composition and the mobile widths in [`DESIGN.md`](DESIGN.md) and
> `CLAUDE.md`. What remains — the phases not yet finished, and the reasoning
> behind what is out of scope — is here.
>
> **Completed phases are summarised rather than reproduced.** Phases 0, 1, 2 and
> 6 shipped; their step-by-step deliverables and exit criteria were a working
> document for work that is done, and the git history is the better record. The
> phases that have *not* finished are reproduced in full, because for Phase 5
> this file is the only specification that exists.

| Phase | | State | |
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
> EXITED.** Phases 3 and 4 both exit on adoption — "at least one other tool has
> adopted the library", "a citation appears in a community discussion without
> you putting it there" — and neither is a fact this repository can report on
> itself. Phase 4's surface is live at `/cr` and `/rule/:number` against a
> committed CR 2.14.0 corpus; whether anyone has cited it is not something this
> table should claim.
>
> Phase 3's chip reads *blocked* rather than *in progress*, and the distinction
> matters: `packages/legality` exists and is tested, but its headline export
> `isLegal` throws `NotImplementedError` and nothing under `apps/` imports the
> package. Nobody is working around a blocker — the work has not started,
> because what it needs is `data/legality`. The live legality logic is
> `apps/site/src/lib/cards.ts`, which reads upstream's flags rather than
> computing a timeline.

---

## What shipped, in one line each

Detail lives in the git history and in the code's own docblocks, which are
maintained. This section exists so that a citation to "Phase 1" still resolves.

- **Phase 0 — Repo and infrastructure.** Personal ownership, MIT, TypeScript on
  Bun, Cloudflare hosting, repository settings as a `gh api` script rather than
  Terraform. Everything the permission envelope in [`DISCLAIMER.md`](DISCLAIMER.md)
  requires, satisfied before the first public commit.
- **Phase 1 — Theme and components.** The token layer
  (`packages/theme/src/tokens.ts`) and the primitive library
  (`packages/components`), with the rule that a raw hex or raw length inside a
  component fails the build. The difference between a design language and a
  folder of screenshots is enforcement rather than intent.
- **Phase 2 — The card layer.** Search, card pages, printings — the product.
  This phase is why the positioning changed; see *Out of scope* below.
- **Phase 6 — Off Astro.** Astro and Svelte deleted in favour of a static
  generator this project owns (`apps/site/ssg/`), React rendered statically,
  Vite building the island bundles alone. TanStack Query and Store inside the
  islands and nowhere else; no Router, because every view is a document served
  at its own URL and a router would take that away.

---

## Phase 3 — Legality that remembers

**2–4 weeks. The differentiator.** ![Blocked][chip-blocked]

Is this deck legal in this format — and *was* it legal on the day of that
tournament?

**This follows the card layer rather than preceding it**, which reverses an
earlier revision of this plan. The reasoning then was that legality is the only
surface with a deadline attached — a tournament organiser holding 32 decklists
at 6:50pm has a problem right now, where card data is reference material visited
once people know it exists. That is still true, and it is still the sharpest
unmet need in the game.

### What blocks it

`packages/legality` is written, tested and imported by nothing. What it needs is
`data/legality`: a machine-readable record of past banned-and-restricted
revisions.

**That dataset is a scraping job, not an excavation** — this was the headline
question and it is settled. The Wayback Machine carries **202 archived
announcement URLs spanning 2021-03-18 to 2025-11-14**, and a capture retrieves
as readable content carrying date, author, card, format and action. The one
caveat: the announcements are editorial prose rather than tables, so extraction
is closed-vocabulary matching against known card names with human review, never
a language model. `packages/legality/src/sources/wayback.ts` is the built half
of this.

### The upstream licence request

A drafted request to the maintainers of
[`the-fab-cube/flesh-and-blood-cards`](https://github.com/the-fab-cube/flesh-and-blood-cards)
— the community card dataset — **was never sent.** It lived at
`docs/upstream-licence-issue.md` until 2026-09-01; the text is in the git
history if it is wanted.

**It is not a gate, and treating it as one was an error this file has already
corrected once.** The dataset ships no `LICENSE` file, and earlier revisions
called that a hard blocker. It is not: what legality checking needs from it are
*facts*, LSS publishes the same information, and the realistic worst case is a
maintainer asking us to stop. Asking is still worth five minutes. It is not
something to clear before building.

Verified 2026-08-08 and not re-checked since: the repository is actively
maintained (last push 2026-08-03, default branch `develop`, releases tagged off
`main`).

---

## Phase 4 — The rules, made addressable

**Built and serving.** ![Live][chip-live]

Every Comprehensive Rules paragraph at a permanent URL, citable by number.
`/cr` and `/rule/:number` are live against the committed CR 2.14.0 corpus;
`packages/rules` is the parser.

**The exit criterion is external and this repository cannot report on it:** a
citation appearing in a community discussion without the author putting it
there. Nothing in CI can tell you whether that has happened.

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

**Quarter → ongoing. Gated on people, not code.** ![Planned][chip-planned]

A searchable, judge-attributed, permanently-linkable record of what happens when
card X meets card Y.

**The destination, and it won every vote that mattered** — first place from four
of five independent analyses, present in all five top threes, the only category
in the landscape with zero incumbents, and the only thing here LSS would
plausibly link to from its own site.

Today, resolving an interaction means reading the rules on your phone or asking
a human in a 4,854-member Discord. The official rules Q&A forum is described *by
LSS's own guidance* as a relatively slow way to get answers. Talishar, the
online client with a claimed ten thousand daily players, explicitly warns it
should not be taken as an indication of how the game works.

**The asset exists and nobody has collected it.** Thousands of adjudicated
interactions live only as unsearchable Discord scrollback. The unit is the *card
pair*, not the question, because pairs are enumerable — which yields both a
coverage metric and a work queue.

**No language model — and not merely "not in version one".** Lexical and
structured search over the Phase 4 corpus. The tool never composes prose, so a
confident wrong answer to a player mid-round is structurally impossible rather
than mitigated. This is the surface where the temptation is strongest and
[`../LLM_STATEMENT.md`](../LLM_STATEMENT.md) admits no exception for it: no
retrieval-augmented answer, no summarised ruling, no "AI assist" behind a
toggle.

**Recruit authors, do not mine an archive.** Retroactive consent from thousands
of people is impossible, and asking would itself be the hostile act. Forward
consent from a few dozen active certified judges is not. Judges get bylines,
moderation power and a distinct identity for this surface — contributing must
read as co-ownership, never as donating labour to someone else's database.

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
quietly rewritten because it is an instance of a failure this project records
repeatedly: a claim about state that nobody re-measures drifts in whichever
direction is least visible, and the summary of what is settled is exactly the
kind of prose nobody re-reads.*

**Settled: Grenze, SIL Open Font License 1.1, self-hosted.**
[`DESIGN.md`](DESIGN.md) called the display face "the single highest-leverage
upgrade available" and named three candidates that can be legitimately
self-hosted. Grenze is the one it describes as angular, faintly medieval and
*uncommon*, against Cinzel's "the default fantasy choice" — uncommon being worth
more than familiar on a face whose job is to be recognised.

The OFL permits webfont embedding and self-hosting, which is the licence
question this was blocked on. It is served from our own origin rather than a
font CDN, for the same reason nothing else here depends on a third party staying
up, and `data/fonts/fonts.json` records its URL and SHA-256 because
[`COMPLIANCE.md`](COMPLIANCE.md) §3 wants an origin for every binary served
publicly.

*A previous revision of this paragraph marked this closed while it was open, and
was wrong on both halves it asserted: the token layer said the opposite, and
`check-tokens.ts` has no font rule to enforce anything with. That retraction is
left in the history rather than smoothed over — closing a licensing item on an
assumption is exactly the failure this section keeps recording.*

**One closed, one still open.** The domain question is answered by the site
being on it: `optfall.com` serves the build. The state-backend question that sat
here is gone rather than answered — dropping Terraform removed the thing that
needed a backend, which is the cheapest way to close a question.

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
