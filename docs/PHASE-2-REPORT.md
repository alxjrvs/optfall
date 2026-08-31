# Phase 2 — delivery report

![Archive][chip-archive]

> **Historical.** This is a snapshot of Phase 2 and is kept as the record of
> what was true then. Its verification run is the part to read carefully and
> not to trust: the table below reports `svelte-check`, `astro check` and
> `oxlint --deny-warnings` all passing, and **none of those three tools is in
> this project any more** — `grep -ci 'astro\|svelte\|storybook\|oxlint'
> bun.lock` is `0`. Phase 6 (#107) deleted Astro and Svelte; Biome replaced
> oxlint and brought the formatter the repo had never had, and its reasoning is
> in `biome.jsonc`'s own header. The gate as it stands now is described in
> [`CLAUDE.md`](../CLAUDE.md) — `bun run check` for the fast nine, `bun run
> check:full` for the three that need a build.
>
> The counts have moved with it. This document records 313 tests across 10
> files; `bun test` is now 934 across 32.
>
> What has **not** changed is the substance: `packages/legality` is still
> written, still passing, and still imported by nothing, because Phase 3 is the
> phase that wires it. [`README.md`](../README.md) says so, and
> [`docs/PLAN.md`](PLAN.md) carries the phase list. Read the sections below for
> why the legality model is shaped the way it is; read them for the state of
> the tooling and you will be reading about 2026-08-10.

**Written 2026-08-10, in two passes.** The first was a research spike and wrote
no code; its text is kept below under *The research spike*, because its findings
are still the reason the rest of this is shaped the way it is. Nothing there has
been edited or deleted — where re-running a claim this session produced a
different answer, a marked block follows the original rather than replacing it,
so the correction and the thing it corrects sit next to each other. The second
pass wrote the first Phase 2 code, and this half of the document describes what
now exists.

Every claim here was checked by running the thing. Commands and exit codes are
in the next section; where a value came off the network, the HTTP status and
byte count are quoted. Where the spike turned out to be wrong, it says so and
says by how much.

---

## Verification run

All from the repository root, this session. Exit codes captured, not inferred.

| Command | Result | Exit |
|---|---|---|
| `bun test` | 313 pass, 0 fail, 1,864 assertions, 10 files | **0** |
| `bun run typecheck` | root `tsc` + 5 workspaces; `svelte-check` 0 errors 0 warnings; `astro check` 0/0/0 | **0** |
| `bun run lint` | `oxlint --deny-warnings` | **0** |
| `bun run build` | all packages + site | **0** |

Per package: `packages/legality` 185 pass across 4 files (`formats` 37,
`timeline` 75, `sources/wayback` 58, `index` 15); `packages/rules` 24 pass
across 1 file.

The rules parser was also run end to end against the live document, which is the
only check that proves anything about the outside world:

```
$ bun packages/rules/src/cli.ts
retrieved 413462 bytes, sha256 fef01bb7c99da3d5e923521229c84b09ed544e8587dd0aaafaa666648fd44b85
Flesh and Blood — Comprehensive Rules, version 2.14.0, published 2026-6-10
chapters 9 | sections 87 | rules 548 | subrules 634 | total 1278 | warnings 0
```

The same URL fetched independently with `curl` returns the same byte count and
the same SHA-256, so the CLI is not reporting a cached artefact.

---

## Deliverables

Quoted from `docs/PLAN.md` Phase 2.

| Deliverable | State |
|---|---|
| Research spike on the banned-list archive | **done** — see below |
| Document pipeline — fetch, parse to stable sections, permanent ids, version, diff, publish, on a schedule | **partial** — fetch, parse, ids and version are done for the Comprehensive Rules. No diff, no publish, no schedule |
| `optfall-legality` — `isLegal(deck, format, asOf)` | **not done** — types and two of its three inputs exist; the function still throws `NotImplementedError` |
| Six formats — deck sizes, copy limits, rarity | **done**, with 8 constraints marked unverified (ledger below) |
| Historical timeline backfilled and published as JSON | **not done** — the date arithmetic and the retrieval layer exist; no dataset exists |
| Static checker — deck or batch paste, permalinks, no backend | **not done** — the site still has two pages |

The headline feature of the phase is *not shipped*. `isLegal` is a signature and
a validated argument list. Read the rest of this section as "the parts underneath
it", not as "the wedge is done".

---

## What is built

### `packages/legality` — 4 modules, zero runtime dependencies

`dependencies` is `{}` and the only non-relative import anywhere in `src` is
`bun:test` in the four test files.

**`src/index.ts`** — the type surface, plus `isLegal`, which validates its
arguments and then throws `NotImplementedError("Legality evaluation", 2)`. It
re-exports `./formats` and `./timeline`, so both are reachable from the package
root. `sources/wayback` is deliberately *not* on the root entry point — it opens
network connections and belongs to an ingestion job, so it ships under the
`optfall-legality/sources` subpath and stays out of a bundle whose whole pitch is
that it runs anywhere.

**`src/formats.ts`** — the six formats as data. Every constraint is a
`Sourced<T>`, which is either `VerifiedValue<T>` carrying a non-empty tuple of
citations — so a verified constraint with no citation is unrepresentable rather
than merely discouraged — or `UnverifiedValue<T>` carrying a written reason.
`verifiedValue()` returns `undefined` for anything unverified, so the ordinary
accessor cannot hand back a guess; `requireVerified()` throws
`UnverifiedConstraintError` with the dotted constraint path, which is the hook
`isLegal` is meant to use to refuse rather than assume.

The verified numbers, all read first-hand out of the Tournament Rules and Policy
this session:

| Format | Card pool | Deck | Copies | Hero |
|---|---|---|---|---|
| Classic Constructed | 80 | min 60, no stated max | 3 | non-young, non-pit-fighter; living legend heroes **not** legal |
| Living Legend | 80 | min 60, no stated max | 3 | as CC, but living legend heroes **are** legal |
| Blitz | 52 | exactly 40 | 1 | young required; living legend heroes legal from 2026-01-01 |
| Silver Age | **55** | exactly 40 | 2 | young required; common/rare/basic across the whole pool including the hero |
| Commoner *(retired)* | 52 | exactly 40 | 2 | young, common or rare; deck-cards common only, arena-cards common or rare |
| Ultimate Pit Fight | 52 | exactly 40 | 2 | contested — see the ledger |

Four things in that table are worth stating explicitly because each is a place
where a plausible guess would have been wrong:

- **Silver Age is 55, not 52.** Every other young-hero format is a 52-card pool.
  It is the single number most likely to be assumed by analogy, and the test file
  pins it on its own line.
- **Commoner is retired, not deleted.** It has not been sanctioned since
  2026-01-01, LSS points players at Silver Age, and it appears nowhere in the
  current Tournament Rules and Policy — I grepped, zero hits. It is encoded with
  `status: { kind: "retired", since, replacedBy: "silver-age" }`, because
  deleting it would make every archived Commoner decklist uninterpretable, which
  is the failure the time-travel wedge exists to fix. Its numbers come from LSS's
  own format page via the Wayback Machine, since the rules document never
  described it.
- **Commoner's rarity rule is split three ways, not uniform.** Deck-cards may be
  common only; arena-cards *and* the hero may be common or rare. "Commons only"
  is the common description and it would reject legal decks. Both Commoner and
  Silver Age decide rarity by *ever printed at*, so reading it as the printing in
  hand would also reject legal cards.
- **No format caps equipment or weapons separately.** That is a finding, not an
  omission — the Tournament Rules and Policy states one combined card-pool
  maximum and never an arena-card count, so `equipment.registrationLimit` is
  `null` in all six. What limits equipment is a *game* rule, not a construction
  rule: `cr:3.0.2` (two weapon zones per player) with `cr:4.1.4a` (one arena-card
  per zone at start of game), qualified by `cr:4.1.2a` because a hero's
  meta-static ability can change the zone count. Identical across all six,
  because it is not a format rule at all.

**`src/timeline.ts`** — the date arithmetic that answers *what was this card's
status on this day*. It asserts nothing about Flesh and Blood: no card names, no
ban dates, no deck sizes. Every test fixture is deliberately fictional, prefixed
`fixture:`, citing a document named "FIXTURE — not an official document", so that
no test data can be mistaken for a published claim.

Its four load-bearing decisions:

- `effectiveFrom` **inclusive**, `effectiveUntil` **exclusive** — a half-open
  interval, so `until = successor.from` encodes a status change with no gap, no
  double-cover and no subtraction anywhere.
- **Overlapping entries are surfaced, never resolved.** If two covering entries
  disagree, `statusAsOf` returns `kind: "conflict"` and that variant has no
  `status` and no `legal` field — there is nothing to read. Any tie-break would
  bury a dataset defect underneath an answer someone might rely on.
- **A date before any record is `no-record`, never `legal`,** and this is carried
  by the type rather than by discipline: `TimelineLookup` is a three-armed union
  and the `NoRecord` arm has no `status` and no `legal`, so a caller cannot read a
  verdict off an unknown answer without narrowing on `kind`. There is deliberately
  no `legalOn(): boolean` helper — a boolean has two inhabitants and this question
  has three answers.
- `nextChange` returns a three-armed `NextChange` for the same reason:
  `{kind:"entry"}` / `{kind:"record-ends"}` / `{kind:"none"}`. "The record stops
  here" is not "nothing changes", and an earlier two-valued version reported the
  first as the second — which produced a confident "legal until" date spanning
  730 days the dataset had no record of.

`validateTimeline` reports rather than throws, so one bad row surfaces alongside
the rest. It validates *structure*, not truth: it can tell you the shape of a
claim is impossible, never that a ban date is wrong.

**`src/sources/wayback.ts`** — CDX enumeration, de-duplication, capture retrieval
with full provenance, and de-markup. It stops there, deliberately: it extracts no
card, no format, no action and no effective date. There is a test asserting that
no exported symbol matches `/ban|card|format|extract/i`, so the boundary fails
loudly if someone widens it by accident. Tests never touch the network —
`globalThis.fetch` is replaced with a thrower for the whole file, so any function
that forgot its injected `FetchLike` fails rather than making a real request.

The hazard the module exists to keep visible: **three different dates live in one
announcement.** In the 21 Sep 2021 capture they are the crawl timestamp
(20210921012416), the printed publication date ("21st Sep 2021") and the
effective date ("Effective September 24, 2021") — three days apart. Only the
first is derivable structurally, and it is the only one the module returns. A
test asserts `captureTimestampToIsoDate("20210921012416") !== "2021-09-24"` so
that the distinction cannot be quietly erased.

### `packages/rules` — the Comprehensive Rules parser

Zero runtime dependencies; `pdftotext` (poppler) is an external tool invoked at
build time, not a package dependency.

The id is `cr:` plus LSS's own published number and nothing else — `cr:1.0.1a`.
`parentId` is derived from the number rather than tracked while walking the
document, so a misparse cannot invent a hierarchy the numbering does not support.
Every one of the 1,278 records carries `version: "2.14.0"`, because the document's
own preface instructs readers to cite the version.

It fails loudly by construction: an unrecognised title page **throws** rather
than stamping a guessed version, and unlabelled continuation paragraphs, missing
parents, duplicate ids and empty rules all produce warnings that the CLI prints
and exits non-zero on. Version 2.14.0 produces zero warnings, so the tests assert
the warning array is empty — meaning a future release that changes the document's
shape surfaces as a failure rather than as quietly missing rules.

Two extraction traps are closed and regression-tested, both of which fail
*silently* if you get them wrong: `pdftotext -layout` is mandatory (plain mode
discards the indentation that separates a heading from a rule from a wrapped
line, and welds compound words broken across lines — `attack-` + `target` becomes
`attacktarget`), and page-footer stripping requires ≥20 columns of indent so a
legitimate short body line reading `2` is not eaten.

Nothing bulky is committed: no PDF, no corpus. The fetch runs on demand into
`os.tmpdir()` and reports the SHA-256 of the bytes it read. The only committed
artefact is a 16 KB fixture of real `pdftotext -layout` output.

### What each piece deliberately does not do

- **`isLegal` does not evaluate.** It validates and throws.
- **`formats.ts` is an undated snapshot.** There is no `asOf` parameter, so it
  cannot answer what Classic Constructed's deck minimum was in 2023. Its numbers
  are the current documents' numbers.
- **`timeline.ts` knows no Flesh and Blood facts.** It is interval arithmetic over
  whatever a dataset says, and no dataset exists.
- **`wayback.ts` does not parse announcements.** Retrieval only.
- **`packages/rules` does not diff versions, publish a corpus, or run on a
  schedule.** Only one version has ever been retrieved.
- **No dataset of any kind is published yet.** No banned list, no Living Legend
  timeline, no rules corpus, no site surface.

---

## The unverified ledger

**This is the section that matters.** Optfall's whole claim is that it is right,
and the only way that claim survives contact with an incomplete source set is if
the incomplete parts are visible. What follows is everything the library holds
that it has *not* confirmed against a document it retrieved.

### Machine-enumerable — 8 constraints, from `unverifiedConstraints()`

These are reachable in code: `unverifiedConstraints(rules)` returns the dotted
paths, `requireVerified()` throws on them rather than answering, and the test
file pins the exact list so that it growing shows up in a diff instead of in a
wrong verdict. Classic Constructed, Living Legend and Blitz return an empty list.

| Constraint | Recorded value | Why it is not confirmed | What a human must read |
|---|---|---|---|
| `silver-age.hero.excludedSubtypes` | `[]` | `trp:7.4` requires a young hero and says nothing about further subtype exclusions. An empty list is the best reading, but it rests on silence | The Card Legality Policy's Silver Age section — see *Blockers* |
| `silver-age.hero.livingLegendHeroesLegal` | `null` | `trp:7.4` is silent. The 1000-point threshold in `trp:7.1` is written as a Classic Constructed rule and it is not established that it reaches Silver Age | Same |
| `commoner.hero.excludedSubtypes` | `[]` | The Commoner format page requires a young hero of common or rare rarity and states no further exclusion. Silence again, and Commoner never appeared in the Tournament Rules and Policy at all | An archived pre-2026 Card Legality Policy, or an archived Tournament Rules and Policy from the Commoner era |
| `commoner.hero.livingLegendHeroesLegal` | `null` | The format page does not address it | Same |
| `ultimate-pit-fight.hero.subtype` | `"young-required"` | `trp:9.3` says "1 young hero card"; LSS's UPF format page registers "1 hero card" and advises against an Adult hero *only* when everyone else is using Young heroes, which presupposes an Adult hero is permitted | Both, plus the Card Legality Policy's UPF section |
| `ultimate-pit-fight.hero.excludedSubtypes` | `[]` | Same conflict | Same |
| `ultimate-pit-fight.copyLimit.perUniqueCard` | `2` | `trp:9.3` says up to 2; the format page says the limit depends on the base format | Same |
| `ultimate-pit-fight.hero.livingLegendHeroesLegal` | `null` | Neither source addresses it. The format page's "Every card is legal" is qualified elsewhere on the same page by a pointer to the Card Legality Policy | Same |

The Ultimate Pit Fight group carries a `SourceConflict` citing **both** sides, so
a surface can show the disagreement rather than only the chosen reading. The
Tournament Rules and Policy governs sanctioned play and is the more recent
document, so its numbers are the recorded values — but a checker that failed a
legitimate UPF decklist on a contested number would be doing exactly what the
commercial incumbent does.

Worth recording that the conflict was **narrower than an earlier revision
claimed.** That revision had card-pool maximum and both deck bounds listed as
contested too. They are not: the UPF page's own start-of-game procedure reads
"chosen from their 52 card-pool" and names a 40-card deck, corroborating
`trp:9.3` rather than contradicting it. Quoting only the half of a page that
supports a conflict thesis is its own kind of wrong answer, and it happened here
before it was caught.

### Not machine-enumerable — read these before trusting the library

The eight above are visible in code and a build step can pin them. These ten are
not: they are assumptions, overloaded fields, and three outright defects found
while writing this document. Each is a place where the type system cannot help,
which is exactly why they need to be written down somewhere a human reads.

1. **The Tournament Rules and Policy's version and effective date, `2026-06-10`,
   is derived from an HTTP header.** The document carries no printed version — I
   grepped the 121,581 bytes and there is none — and the PDF path 403s. The date
   is `Last-Modified: Wed, 10 Jun 2026 19:43:38 GMT`, recorded on the source
   document as `versionProvenance: "http-last-modified"` with a note. **Every
   `trp:` citation in the library inherits this caveat** — 15 of the 34 distinct
   citations the six formats rest on. It is corroborated by the Comprehensive
   Rules 2.14.0 carrying the same date on its title page. Corroboration, not
   proof.
2. **Classic Constructed and Living Legend have no deck-size maximum, and
   `unverifiedConstraints` does not report it.** No document states one, so
   `DeckMaximum` is `{kind: "bounded-by-card-pool"}` rather than the tempting
   `80` — the ceiling is the card-pool maximum less the registered arena-cards,
   which `cr:4.1.5a` keeps out of the deck. That was the single easiest place in
   this work to fabricate a limit and it was not fabricated. But the enumeration
   only records `deckSize.maximum` when its kind is `"stated"`, so both formats
   report an empty unverified list while the docstring claims an empty result
   means every constraint is backed by a quotation. **A checker built on this API
   would believe it can fully evaluate a Classic Constructed deck and would
   silently skip the maximum.** Live defect, not a design choice.
3. **`effectiveFrom` being inclusive is an assumption about LSS's wording.** No
   archived announcement has been parsed to confirm whether "effective September
   24" means the ban applies on the 24th or from the 25th. Inclusive is the
   reading implemented and the reading a judge would apply; it is not quoted from
   a source. Marked `UNVERIFIED` in `coversDate`'s docstring.
4. **`effectiveUntil` being exclusive is our convention, not a published one.**
   The field name reads inclusive. A dataset author who writes it as "the last day
   the status held" is wrong by one day, and `validateTimeline` catches the
   zero-length-interval signature of that mistake but cannot catch the
   off-by-one-day version. **This is the largest correctness risk in the timeline
   module and it belongs in the dataset authoring contract, not only in a
   docstring.**
5. **`RuleCitation.effectiveFrom` is overloaded.** `index.ts` documents it as "the
   date this rule took effect", but most citations fill it from the *document's*
   publication date. So every `trp:` citation says its rule took effect
   2026-06-10, and the 60-card Classic Constructed minimum long predates that
   revision. One citation is set deliberately — Blitz's living-legend answer
   carries 2026-01-01, the date the rule changed, not the page's date. The rest
   are document dates wearing a rule-date label.
6. **Comprehensive Rules section-id stability across versions is inferred.** Only
   2.14.0 has ever been retrieved, so nothing measures whether `cr:1.0.1a` denotes
   the same rule in 2.13.x. The permalink promise rests on it. Closing it costs
   one archived older PDF and a set-diff of the ids, and should happen before
   permalinks are published to anyone.
7. **The Wayback announcement filter is a good net, not a proven-complete one.**
   Run unlimited this session, `urlkey:.*banned.*` returns 79 rows collapsing to
   67 distinct article URLs, covering every announcement slug family observed
   including the pre-rename `banned-suspended-*` — and one Japanese translation
   under `/articles-jp/`, which nothing yet filters out. Any legality-relevant
   announcement whose slug lacks "banned" is not returned at all. A
   `living.legend` filter was tried and deliberately not adopted because it is
   noisy — it returns `/api/oembed/` endpoints, tournament coverage pages and
   editorial.
8. **The `url-without-query` de-dupe assumes fabtcg.com article query strings
   never select different content.** True of every announcement URL retrieved; not
   guaranteed. It is not the default.
9. **`fab-blitz-ll` declares `versionProvenance: "page-last-updated-line"` and
   that page has no such line.** I fetched the capture and grepped: zero
   occurrences of "last updated". The recorded 2025-12-16 comes from a table
   caption, "Blitz Living Legend Leaderboard as of December 16, 2025". A
   leaderboard as-of date is not a document revision date. Live defect — small,
   but it is a false statement about provenance inside the module whose product
   is provenance.
10. **Two source files contain a literal NUL byte** (`formats.ts` offset 56547,
    `timeline.ts` offset 39440), used as a Map key separator. The choice is
    correct and uncollidable, but the raw byte makes both files binary to text
    tools — `grep` on `timeline.ts` prints nothing and exits 1. **The package's
    two most safety-critical files are invisible to code search.** The fix is the
    two-character escape `\0`, which is identical at runtime.

### The same mistake, three times, on one page

Worth recording in full, because it is the failure mode this project exists to
eliminate and it happened three times inside the project's own process — twice in
review, once in this document before I checked.

The Blitz Living Legend archive page carries **two** tables. The first is the
ranked leaderboard, topped by a hero at 975 points and descending to 2. The
second, below it, lists **twelve heroes with rank "LL" and totals from 1,005 to
1,178** — the heroes that actually attained the status. The page's only caption,
"as of December 16, 2025", sits between them.

1. The pass that first cited this page quoted the top of it and stopped, missing
   the paragraph three lines down that says Blitz retired the mechanism on
   2026-01-01 and that the table "does not dictate current hero and card
   legality". The page was cited as evidence for the opposite of what it says.
2. The review that caught that read the second table, cited the twelve heroes
   correctly, and was right.
3. The pass that applied the fix then "corrected" the review by reading only the
   *first* table, concluded no Blitz hero exceeded 1,000 points, and recorded the
   review's figures as fabricated. I copied that into this document, then checked:
   **the review was right and the correction was wrong.** All twelve heroes and
   totals are on the page, in the second table.

Three readings, three different wrong stopping points, on a page under 30 KB. No
hero name or point total entered the code at any stage, and the final recorded
answer — Blitz living legend heroes legal from 2026-01-01 — is correct and rests
on two verbatim quotes rather than on any leaderboard. But the near-miss is the
lesson: **partial reading of a source is how a confident wrong answer gets made,
and it survives review by being confidently made again.** Quoting a source in
code is not the same as having read it.

---

## Blockers, and the exact action that clears each

### 1. The card dataset licence — downgraded from blocker to courtesy

**This was over-weighted in earlier drafts of this document, and the owner has
settled it: the dataset is fine to use, and building proceeds.**

The reasoning, so the framing does not creep back. A missing `LICENSE` file makes
the *compilation* all-rights-reserved by default — but what legality checking
needs from it are facts: card names, costs, pitch values. Facts are not the part
a compilation licence protects, LSS publishes the same information themselves,
and the realistic worst case is a maintainer asking us to stop rather than any
kind of claim. Asking for a licence is still worth doing — it takes five minutes
and it makes the dependency robust rather than merely tolerated — but it is not
a gate to clear before writing code.

Everything below this line was written under the old framing and is kept for the
detail rather than the urgency.

`the-fab-cube/flesh-and-blood-cards`, checked via the GitHub API today:
pushed 2026-08-10, 164 stars, not archived, **licence: none**. By default that
means all rights reserved, and Phase 3 depends on redistributing the compilation.

**Action: post `docs/upstream-licence-issue.md`.** It is drafted and still
unposted. Five minutes of a human's time, it gates a whole phase, and the dataset
was pushed to today so somebody is there to answer.

It also gates more than Phase 3. The card dataset is the **closed vocabulary** the
announcement parser matches against, so the historical banned-list backfill
transitively depends on it.

### 2. The Card Legality Policy — no longer unlocated

Four of the eight unverified constraints blame a document recorded as never
retrieved. `trp:7` names it: *"The official Card Legality Policy, specifies the
legality of cards that can be used for each constructed format."* It is not on
`rules.fabtcg.com` — that host publishes exactly three documents — and the live
URL `https://fabtcg.com/rules-and-policy-center/card-legality-policy/` returns
**403**, like everything else on that host.

**It is archived, on the same Wayback route this project already uses.** Three
captures, verified today: `20251023221227`, `20251206040449`, `20251222092937`.
The last one retrieves as 26,732 bytes and contains, verbatim:

- **Blitz** — *"Blitz includes every Flesh and Blood card, with the following
  exceptions: Adult hero cards (A hero card must have the "Young" subtype to be
  legal in Blitz). Cards that have been banned. Special use promos."*
- **Silver Age** — the same "Young subtype" sentence, plus *"Heroes and signature
  weapons that have been rotated out of official tournament play (as of November
  13, 2025, all rare, common, and basic young heroes will be legal to play…)"*.
- **Ultimate Pit Fight** — *"UPF includes every Flesh and Blood card, including
  special use promos, with the following exceptions: Cards that have been banned
  (in official events only)."* No hero-subtype exclusion at all. That is a **third
  official source bearing on the UPF conflict**, and it does not side with
  `trp:9.3`.
- **Living Legend mechanics** — *"A Living Legend check will occur every Monday
  (United States time)… will no longer be legal for official tournament play
  effective from the Friday of that same week"*, and *"The threshold is 1000
  points."* That is the effective-date convention the timeline needs, stated
  outright.
- **Current banned and restricted lists, per format, as structured HTML lists** —
  not editorial prose.
- **Commoner: zero mentions**, consistent with its retirement.

Two honest limits. The latest capture is **2025-12-22**, which predates the
2026-01-01 changes to Blitz, so it cannot settle the present-day question on its
own. And a page-level "Last updated: August 19, 2025" sits next to the Living
Legend section while the Silver Age section references November 13, 2025, so the
document's own dating is not uniform and should not be read as one version stamp.

**Action, and it is code rather than a human:** ingest the Card Legality Policy
through the existing `sources/wayback.ts` path, cite it in `formats.ts`, and
resolve as many of the eight as its text actually supports. Where it does not
support one, leave it unverified. This is the highest-value unblocked task in the
package.

### 3. Present-day banned lists do not need prose parsing

This follows from (2) and reshapes the phase. The spike's caveat — that
announcements are editorial prose and extraction therefore needs a closed
vocabulary plus human review — is **true of the historical backfill and not of
the current state.** The Card Legality Policy publishes the current banned and
restricted lists per format as HTML lists. Extracting those needs no card
dictionary, no licence, and no language model.

So the work splits cleanly:

- **Current status per format** — structured extraction from one archived page.
  Unblocked today.
- **Historical backfill** — prose extraction from ~67 archived announcements,
  needs the card dataset as a dictionary, needs human review of every entry.
  Blocked behind (1).

### 4. `fabtcg.com` returns 403, and this is now load-bearing

Every LSS format page, and the Card Legality Policy, is reachable only through
the Wayback Machine. That means **Optfall's freshness on format rules is bounded
by the Internet Archive's crawl schedule**, which nobody controls. `docs/PLAN.md`
requires surfaces to degrade visibly; this is a case where the staleness is
structural rather than incidental, and the `retrievedAt` and `version` fields on
`SourceDocument` are what make it visible. Worth a human deciding whether to ask
LSS for access rather than routing around it indefinitely.

### 5. No scheduled ingestion exists

`.github/workflows/` contains `ci.yml`, `dependabot-auto-merge.yml` and
`repo-settings-check.yml`. Nothing runs the rules parser against the live
document on a schedule, so a 2.15.0 release that restructures the title page
surfaces only when a human runs the CLI by hand. The machinery to *detect* the
change exists — the parser throws on an unreadable title page and exits non-zero
on any warning — it is simply never invoked unattended.

**Action:** a scheduled workflow that installs poppler, runs the CLI, and opens
an issue when the exit code is non-zero or the reported version or SHA-256 differ
from the last recorded one. Keep it off the required-check gate: it depends on a
third-party host being up, which is exactly the class of check that must not be
able to block a merge.

---

## Should the phase order change?

**Yes, and not as a swap.** The spike already suspected this; the code settles it.

**Phase 4 is the most tractable body of work in the project, and it is now
two-thirds sourced.** The Comprehensive Rules parse cleanly — 1,278 addressable
records, zero warnings — and completeness was checked a second way that does not
use the parser at all: a plain grep of the extracted text for section-shaped
tokens, set-differenced against the parser's output, matches in both directions
with exactly one leftover, the version string `2.14.0`, which is not a rule.

The spike's remaining doubt on this phase has also been removed. It recorded
*"Tournament rules and the penalty guide are not confirmed"*, which is true of the
PDF paths and false of the documents — `rules.fabtcg.com` publishes all three as
plain text:

| URL | Result |
|---|---|
| `txt/latest/en-fab-cr.txt` | **200**, 322,134 bytes |
| `txt/latest/en-fab-trp.txt` | **200**, 121,581 bytes |
| `txt/latest/en-fab-ppg.txt` | **200**, 87,563 bytes |
| `pdf/en-fab-trp.pdf` | 403 |
| `pdf/en-fab-ppg.pdf` | 403 |

That is the *same mistake the spike itself diagnosed* — one 403 on one path
becoming a recorded blocker — repeated one path deeper, by the document that
diagnosed it. Phase 4's tournament-policy and penalty-guide deliverables are not
blocked, and the Tournament Rules and Policy is already load-bearing for
`formats.ts`.

**But Phase 2's headline is not simply behind Phase 4.** It is behind *one part*
of Phase 3 — the licence — and only for the historical half. The honest ordering
is not "do 4 before 2" but:

1. **Ingest the Card Legality Policy** and close what it closes of the eight
   unverified constraints. Small, unblocked, and it is the difference between a
   format library that answers and one that refuses.
2. **Implement `isLegal` against `formats.ts` alone** — construction rules only,
   no card status. That validates deck size, copy limits, rarity and hero
   eligibility, which is most of what a tournament organiser at 6:50pm actually
   needs, and it needs no card dataset and no timeline. `LegalityResult` will need
   a field for a rule it could not evaluate — an `unevaluated: readonly {rule,
   constraint, reason}[]` — because the only other honest option is to throw, and
   that is wrong for a batch checker.
3. **Phase 4's rules corpus**, in parallel and by a different agent: parse the
   Tournament Rules and Policy and the Penalty and Procedure Guide with the same
   machinery, then version-diff. The permalink is the product and it needs
   nobody's permission.
4. **Current banned and restricted status**, from the Card Legality Policy.
5. **Historical backfill**, once the licence lands, with human review of every
   entry.

The plan's stated reason for sequencing Phase 4 late — that it "needs nobody's
permission" — is more true than the plan knew: it also needs no licence
negotiation, no prose parsing, and no third-party crawl schedule. It is the only
part of the project where every input is a document that a host serves on
request.

---
---

# The research spike

*Written 2026-08-10, before any Phase 2 code existed. Preserved as written. Where
re-running it this session produced a different number, a marked correction
follows the claim; nothing has been silently edited.*

This document answers the three questions that decide the shape of Phases 2, 3
and 4. No code was written for Phase 2; the point of a spike is to find out what
is worth writing.

Every claim below was checked by running the request. Where a source could not
be read, it says so and says how it failed.

---

## 1. Are past banned-and-restricted revisions publicly archived?

`docs/PLAN.md` calls this the question that **decides a headline feature**:
*"If they are, time travel is a scraping job; if only the current list is
published, reconstructing history is an excavation and may drop behind the
rules work."*

### Answer: yes. It is a scraping job.

**LSS's own site is not the route.** `fabtcg.com` still returns **HTTP 403** to
automated fetches — reproduced today against
`https://fabtcg.com/articles/banned-and-restricted-announcement-sep02/`. That
is the same blocker the Phase 0 report recorded — that document was deleted in
[#219](https://github.com/alxjrvs/optfall/pull/219) — and it has not lifted.

**The Wayback Machine is the route, and it is a good one.** Its CDX API is
public, needs no key, and — decisively — serves the archived content that the
live host refuses. Verified end to end:

- **202 distinct archived URLs** under `fabtcg.com` match
  banned/restricted/living-legend with HTTP 200.
- Individual **dated announcements** are archived as their own articles, not
  merely a single rolling page:
  `banned-and-restricted-announcement-sept21`, `…-dec-14`, `…-oct02`,
  `…-sep02`, `…-06-10-25`, `…-28-10-25`, `…-errata-bulletin`, plus the older
  `banned-and-suspended-announcement` under its pre-rename slug.
- The rolling page `/articles/banned-and-restricted-announcement/` has 13
  captures spanning **2021-03-18 to 2025-11-14**, distributed across every year
  in between.
- A capture retrieves as **33 KB of real content**, and the body carries exactly
  the fields a timeline needs. From the 21 Sep 2021 announcement, verbatim:

  > Banned and Restricted Announcement 21st Sep 2021 James White … We believe
  > that removing Seeds of Agony from the Classic Constructed format will be
  > positive for the tournament experience…

  That is a **date**, an **author**, a **card**, a **format** and an **action**
  — the whole tuple.

> **Re-verified this session, against the live API.** The announcement CDX query
> returns **79 rows collapsing to 67 distinct article URLs**, and the sept21
> capture retrieves as **33,561 bytes** containing "Seeds of Agony" eleven times
> and `archive.org` zero times — which is what the `id_` modifier promises.
> **One addition the spike did not make:** the announcement carries *three*
> dates — crawl (`20210921012416`), printed publication ("21st Sep 2021") and
> effective ("Effective September 24, 2021") — three days apart in this very
> article. Only the crawl date is derivable structurally, and it is the wrong one.

### What this means for the plan

The Phase 2 estimate stands, and the risk the plan hedged against does not
materialise. Backfill is a scrape with a known shape:

1. Enumerate announcement URLs from the CDX API (one query, no key).
2. Fetch each capture through `web.archive.org/web/<timestamp>id_/<url>`, which
   returns the original bytes without the Wayback toolbar injected.
3. Parse card, format and action out of prose that is **not** structured — see
   the caveat below.
4. Publish as dated JSON.

Steps 1 and 2 are built. Steps 3 and 4 are not.

### The caveat, and it is the real work

The announcements are **editorial prose, not tables**. The sentence above says
"removing Seeds of Agony from the Classic Constructed format" — not a field
called `banned`. Extracting a timeline from that is parsing natural language,
and this project has ruled out the tool most people would reach for: **no
language model, in the product or in a published dataset.**

That is not a problem, but it does set the method. Card names are a **closed,
known vocabulary** — the card dataset gives every legal name — so extraction is
matching against a dictionary of card names and a small set of action verbs
near them, not general comprehension. Deterministic, auditable, and it fails
visibly rather than confidently.

**Every extracted entry must be reviewed against its source capture before
publication.** A wrong ban date is precisely the failure this project exists to
eliminate, and an automated parse of prose is exactly where one would enter.

> **Narrowed.** This holds for the *historical* backfill. It does not hold for
> present-day status: the Card Legality Policy publishes current banned and
> restricted lists per format as structured HTML lists, so that half needs no
> dictionary and no review of prose. See *Blockers* above.

---

## 2. The community card dataset

**`the-fab-cube/flesh-and-blood-cards` is real, and it is alive.** Verified via
the GitHub API today:

| Property | Value |
|---|---|
| Last push | **2026-08-10** (hours before this was written) |
| Stars | 164 |
| Archived | no |
| **Licence** | **NONE** |

**The licence gap is confirmed, not merely suspected.** GitHub reports no
licence. By default that means all rights reserved: there is no granted right to
redistribute the compilation, and Phase 3 depends on doing exactly that.

`docs/upstream-licence-issue.md` is drafted and still **unposted**. This is now
the single highest-leverage unblocked action in the project — it is five
minutes of a human's time, it gates a whole phase, and the dataset being
actively maintained means there is somebody there to answer.

> **Re-checked this session: unchanged on every row.** Still 164 stars, still not
> archived, still no licence, pushed 2026-08-10T02:19:27Z.

---

## 3. The rules corpus

### Answer: not blocked. The document is obtainable, and it is well-formed.

**The 403 was on the wrong host.** `fabtcg.com` refuses automated fetches, and
that led an earlier draft of this very document — and the Phase 0 report before
it — to record Phase 4 as blocked on unreachable source material. That
conclusion was wrong, and it was wrong because only one hostname was ever
tried.

**The rules live on a separate host, `rules.fabtcg.com`, and it serves them.**
Verified today:

| Request | Result |
|---|---|
| `https://rules.fabtcg.com/pdf/en-fab-cr.pdf` | **HTTP 200**, 413 KB, `application/pdf` |
| `https://rules.fabtcg.com/en/cr/` | **HTTP 200** (MkDocs-Material HTML) |
| `https://fabtcg.com/articles/…` | HTTP 403 — the old blocker, still true, still irrelevant here |

**The document is exactly the shape Phase 4 needs.** From the retrieved PDF:

- **Comprehensive Rules 2.14.0**, dated **2026-6-10**, read off its own title
  page rather than from a search result.
- **336,881 characters** of extractable text — `pdftotext` handles it, no OCR.
- **1,270 numbered sections** matching a strict hierarchical pattern, e.g.:

  ```
  1.0.   General
  1.0.1. The rules in this document apply to any game of Flesh and Blood.
  1.0.1a If an effect directly contradicts a rule contained in this document,
         the effect supersedes that rule.
  ```

That numbering — `chapter.section.rule` plus a letter for sub-clauses — **is**
the permanent identifier scheme. Phase 4 does not have to invent addressing; it
has to preserve what LSS already publishes. `cr:1.0.1a` is a citation that
exists today.

> **Two corrections, both measured this session against the same PDF (SHA-256
> `fef01bb…`, 413,462 bytes).**
>
> **The section count is 1,269, not 1,270, and the extra one is the version
> string.** 87 sections + 548 rules + 634 subrules = 1,269 (the parser reports
> 1,278 because it also emits 9 chapter records). The spike's 1,270 is the count
> of unique tokens matching `\d+\.\d+(\.\d+)?[a-z]?` anywhere in the extracted
> text; set-differencing that against the parser's output leaves exactly one
> token, `2.14.0` — the version printed on the title page, which matches the
> shape but is not a rule. The parser is right, and it correctly declines to make
> a section of it. This matters practically: anyone comparing the parser's honest
> 1,269 against 1,270 would conclude a rule is missing when none is.
>
> **The character count reproduces, but only if read as bytes.** `pdftotext`
> without `-layout` yields exactly **336,881 bytes** — the spike's figure — and
> **333,745 characters**; the difference is non-ASCII text. A later review
> reported the number as failing to reproduce, having measured characters. Both
> readings are defensible and that is precisely why a character count is a poor
> fingerprint for a document. The durable one is the SHA-256 over the PDF bytes,
> which the parser already computes and prints.

### What is still open here

- **The HTML chapter pages are inconsistent.** `/en/cr/` returns 200 but
  `/en/cr/cr1/` returned 403 in the same minute, which looks like rate limiting
  rather than policy. The PDF is the authoritative artefact and is reliably
  available, so this only affects whether parsing works from clean HTML or from
  extracted PDF text. Retry the HTML path before choosing.
- **Tournament rules and the penalty guide are not confirmed.**
  `rules.fabtcg.com/pdf/en-fab-trp.pdf` returned 403. Either the filename is
  different or those documents sit elsewhere; the Comprehensive Rules being
  reachable does not establish that they are.
- **Version-to-version section stability is inferred, not measured.** The
  numbering is clearly designed to be stable, but that should be checked by
  diffing two versions before permanent identifiers are promised to anyone.

> **These three, re-checked:**
>
> - **HTML pages: unchanged.** `/en/cr/` 200, `/en/cr/cr1/` **403**, in the same
>   minute, today. The parser works from the PDF, so this is not blocking — but
>   note the Tournament Rules permalinks used as `sourceUrl` in `formats.ts`
>   (`/en/trp/07-constructed-formats/`, `/en/trp/09-special-formats/`) both
>   return 200, so the inconsistency is not uniform across the host.
> - **Tournament rules and penalty guide: RESOLVED, and this line is now
>   wrong.** Both are served as plain text (121,581 and 87,563 bytes, HTTP 200).
>   The PDF paths still 403. The correct scope of the original claim was "the PDF
>   filenames", not "those documents".
> - **Section-id stability: still inferred.** Only 2.14.0 has ever been
>   retrieved. Unchanged.

### How this was nearly missed, which is the more useful finding

A subagent that died mid-run left a scratch directory containing
`en-fab-cr.pdf`, `en-fab-ppg.txt` and `en-fab-trp.txt`. I deleted it as
untracked debris, and only noticed on the way past that those filenames were
the rules documents — which is what prompted checking a second hostname at all.

Two things worth keeping from that:

1. **A failed agent's byproducts can be evidence.** The run reported nothing; it
   had nonetheless proven the documents were obtainable.
2. **"Source unreachable" deserves more scepticism than it got.** One 403 on one
   host became a recorded blocker in two documents and shaped a phase estimate.
   The correct test was five minutes of checking whether the material lived
   anywhere else.

> **And it happened again, in this document, about these same files.** The
> scratch directory contained `en-fab-trp.txt` — the plain-text Tournament Rules,
> the exact file the spike then recorded as unconfirmed on the strength of one
> 403 on the PDF path. The evidence was in the same paragraph as the lesson. Two
> occurrences is a pattern, so it is worth stating as a rule rather than an
> anecdote: **a 403 is a fact about a URL, never about a document.** Before
> recording a source as unreachable, try every path the host advertises — the
> root page of `rules.fabtcg.com` links all three plain-text documents, and
> reading it would have closed this in under a minute.

---

## What was not built, and why

*Superseded. Both pieces named below were built in the second pass; see* What is
built *above. Retained because the scoping was correct and the boundary
semantics it called out are exactly where the work turned out to be hardest.*

Per the repository owner's instruction — *build up to the blocker, then stop* —
no Phase 2 code was written in this pass. Two pieces are genuinely unblocked and
are the obvious next work:

- **Format rules** (`packages/legality`): deck sizes, copy limits and rarity
  restrictions for the six formats. These are published tournament rules rather
  than card data. Every constraint must cite a source or be marked UNVERIFIED in
  the code — a confidently wrong deck-size limit is the same class of failure as
  a wrong ban.
- **Timeline mechanics**: the date logic that answers *what was this card's
  status on this day*. Needs no card data at all, and its boundary semantics are
  where it will be wrong: whether `effectiveFrom` is inclusive, how overlapping
  entries resolve, and — most important — that "legal then" and "no record for
  then" must never be conflated.

Both were scoped and specified in this pass but not implemented: the agent fleet
that would have written them hit a **weekly usage limit** mid-run, which is a
capacity blocker rather than a technical one.

---

## Contradictions with `docs/PLAN.md` and with our own records

**One, and it is ours rather than the plan's.**
The Phase 0 report — since deleted in
[#219](https://github.com/alxjrvs/optfall/pull/219) — recorded *"The LSS terms
page has never been read. `fabtcg.com` returns 403 to automated fetches"* and
carried that forward as a constraint on Phase 4. The 403 is real, but the
inference drawn from it was too
broad: the rules documents are on `rules.fabtcg.com` and are served without
complaint. **Phase 4 is not blocked on source access.** That line should be
narrowed to what it actually established — the *terms* page, on `fabtcg.com`,
is unread — rather than the rules corpus as a whole.

Otherwise the plan holds. It hedged on whether the banned-list archive existed
and it does, so the optimistic branch of its own text applies. Two notes for
whoever edits it next:

- Line ~531, *"Open, and it decides a headline feature"* — **this is now
  answered.** Time travel is a scrape. The entry should move from open to
  settled, with the Wayback route recorded.
- The plan assumes the announcements can be parsed. They can, but they are
  prose rather than tables, and the no-language-model rule means the method has
  to be closed-vocabulary matching with human review. That is a constraint on
  *how*, not a contradiction of *whether* — but it belongs in the phase's
  description rather than being discovered during it.

> **Three more for whoever edits `docs/PLAN.md` next**, from the build rather
> than the spike. None is edited here; this document does not modify the plan.
>
> - **Phase 2 names six formats. It is five active plus one historical.**
>   Commoner has not been sanctioned since 2026-01-01 and does not appear in the
>   current Tournament Rules and Policy at all. It is still encoded, and should
>   be, but the plan should say so.
> - **The Tournament Rules and Policy defines more formats than the plan
>   models** — Sealed Deck, Booster Draft, Blitz Preconstructed, Crack Shuffle
>   Play, Ira Learn-to-Play, and Team. Not modelling limited formats is a
>   defensible scope decision; it is currently an unstated one.
> - **The no-language-model rule held throughout, and is now enforced.** CI's
>   `no-llm-dependencies` job scans every manifest and the lockfile. Both new
>   packages declare `"dependencies": {}`. Every quoted string in `formats.ts`
>   came from bytes retrieved over HTTP, verbatim including the Tournament Rules'
>   own typos — "card-poll" in 7.4, "the what cards in are placed" in `cr:4.1.2a`
>   — because a tidied quotation is not a quotation.

<!-- `color.rule.strong`, from the dark set of `packages/theme/src/tokens.ts`.
     The legend saying what each chip commits to is in `COMPLIANCE.md`, under
     "How to read a chip". -->

[chip-archive]: https://img.shields.io/badge/archive-3f3f3f?style=flat-square
