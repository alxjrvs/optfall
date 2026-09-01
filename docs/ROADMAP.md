# Optfall — roadmap

**Scryfall, for Flesh and Blood.** A card search engine and reference, with a
rules engine attached — every card, every printing, every rule, each citable and
each with a permanent URL.

> **Supersedes `docs/PLAN.md`,** retired 2026-09-01. That file was 1,122 lines
> and carried three jobs at once: the LSS disclaimer specification, a
> project-wide rules section, and this roadmap. The first is now
> [`DISCLAIMER.md`](DISCLAIMER.md) — a legally load-bearing string should not
> live inside a document people reflow. The second is stated where each rule is
> enforced: no language model in [`../LLM_STATEMENT.md`](../LLM_STATEMENT.md),
> composition and the mobile widths in [`DESIGN.md`](DESIGN.md) and `CLAUDE.md`.
>
> **This file is deliberately short.** It carries the phases that have not
> finished and nothing else. Completed phases are one line each; the git history
> is the better record of how they were done, and it is maintained. The
> out-of-scope survey and the settled-questions log that `PLAN.md` also carried
> were dropped rather than moved — a decision log nobody re-reads is how
> `PLAN.md` came to contain three false claims about its own state.

| Phase | | State | |
|---|---|---|---|
| 0 | Repo and infrastructure | ![Done][chip-done] | |
| 1 | Theme and components | ![Done][chip-done] | |
| 2 | The card layer — search, cards, printings | ![Done][chip-done] | |
| 4 | The rules, made addressable | ![Live][chip-live] | built; the exit criterion is external |
| — | *Gate: are the questions actually novel?* | | days |
| 5 | The interaction record | ![Planned][chip-planned] | |
| 6 | Off Astro | ![Done][chip-done] | |

The chips are Optfall's own state palette, and
[`COMPLIANCE.md`](COMPLIANCE.md#how-to-read-a-chip) carries the legend that says
what each word commits to.

> **PHASE 3 — "LEGALITY THAT REMEMBERS" — WAS DROPPED ON 2026-09-01, ALONG WITH
> ITS CODE.** It is missing from the table above rather than marked abandoned,
> because a phase nobody intends to build is not a phase.
>
> `packages/legality` was 6,505 lines and 185 passing tests against a headline
> export that threw `NotImplementedError`, imported by nothing, waiting on a
> `data/legality` dataset that was never built and on a licence request that was
> drafted and never sent. It was deleted in the same change that removed this
> section. **The work is recoverable in full from the git history** if the
> decision reverses; what is not worth keeping is a phase in a roadmap that had
> not moved in months and an implementation nothing could import.
>
> Legality on card pages today is upstream's own flags, read by
> `apps/site/src/lib/cards.ts` — which is what has always actually served
> readers. That is the position now, not a placeholder for something else.

---

## What shipped, in one line each

Detail lives in the git history and in the code's own docblocks, which are
maintained. This section exists so that a citation to "Phase 1" still resolves.

- **Phase 0 — Repo and infrastructure.** Personal ownership, MIT, TypeScript on
  Bun, Cloudflare hosting, repository settings as a `gh api` script rather than
  Terraform. Everything the permission envelope in
  [`DISCLAIMER.md`](DISCLAIMER.md) requires, satisfied before the first public
  commit.
- **Phase 1 — Theme and components.** The token layer
  (`packages/theme/src/tokens.ts`) and the primitive library
  (`packages/components`), with the rule that a raw hex or raw length inside a
  component fails the build. The difference between a design language and a
  folder of screenshots is enforcement rather than intent.
- **Phase 2 — The card layer.** Search, card pages, printings — the product.
- **Phase 6 — Off Astro.** Astro and Svelte deleted in favour of a static
  generator this project owns (`apps/site/ssg/`), React rendered statically,
  Vite building the island bundles alone. TanStack Query and Store inside the
  islands and nowhere else; no Router, because every view is a document served
  at its own URL and a router would take that away.

---

## Phase 4 — The rules, made addressable

**Built and serving.** ![Live][chip-live]

Every Comprehensive Rules paragraph at a permanent URL, citable by number.
`/cr` and `/rule/:number` are live against the committed CR 2.14.0 corpus;
`packages/rules` is the parser.

**The exit criterion is external and this repository cannot report on it:** a
citation appearing in a community discussion without the author putting it
there. Nothing in CI can tell you whether that has happened, which is why the
chip reads *live* rather than *done*.

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

<!--
  Chip definitions for the phase table. The colours are hexes from the DARK set
  of `packages/theme/src/tokens.ts` — the light set gives the same names
  different values — namely `color.state.legal`, `color.brass` and
  `color.ink.faint`. The legend that says what each word commits to is in
  `COMPLIANCE.md`, under "How to read a chip". Markdown has no link table shared
  across files, so `README.md` and `COMPLIANCE.md` each repeat the definitions
  they use.

  `chip-blocked` was defined here until 2026-09-01 and is gone with Phase 3, the
  only row that used it. `scripts/config-parity.test.ts` asserts every chip hex
  in this file, `README.md` and `COMPLIANCE.md` is a value in the DARK token
  set — it does not check whether a definition is still referenced, so this one
  was removed by hand because nothing uses it.
-->

[chip-done]: https://img.shields.io/badge/done-2f7d4f?style=flat-square
[chip-live]: https://img.shields.io/badge/live-b08d3f?style=flat-square
[chip-planned]: https://img.shields.io/badge/planned-787878?style=flat-square
