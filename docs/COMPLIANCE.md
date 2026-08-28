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
| Last checked | 2026-08-17 |

> **Verification caveat — narrowed on 2026-08-17, and worth reading for what it
> no longer says.**
>
> This block used to record that `fabtcg.com` "returns **HTTP 403 to automated
> fetches**", and that every clause below was therefore assembled from
> search-engine excerpts rather than from the page. **The first half was wrong.**
> The 403 is served to a default client User-Agent; a request carrying an
> ordinary browser one returns the document, and on 2026-08-17 the page was
> fetched whole and read end to end. Quotations in this file are now transcribed
> from the live text rather than reconstructed around it.
>
> That was not a small error to leave standing. "The source cannot be read"
> quietly converts every clause here into an argument from memory, and it is the
> reason §2 spent months recording a decision the document itself answers.
>
> **What is still outstanding is narrower, and it is unchanged in kind:** a
> *machine* has read the page; a *human* has not. Before the first public deploy
> somebody opens that URL and confirms this file — in particular the logo clause
> and the copyright line, both of which are judgement calls a transcription
> cannot settle.
>
> The disclaimer is no longer subject to any of this. It is asserted
> byte-for-byte against the live page's own Third Party Apps clause, and matches
> in all four documents that carry it — `README.md`, `PLAN.md`, `DATA-TERMS.md`
> and this one.

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
- The hosting account, the domain and any future Patreon are held on the same
  personal account.

**Status. Partially enforced, and an open action.** The ownership assertion is
real and machine-checked, but it runs weekly rather than continuously, and until
the `REPO_SETTINGS_TOKEN` secret exists the scheduled run warns and stops — so
today this control is *declared but not yet active*. Per this document's own
preamble, that makes it an open action rather than an enforced control. The
hosting, domain and funding accounts are caught only by a human noticing, and
always were.

**Open action:** create `REPO_SETTINGS_TOKEN` — a personal access token with
`repo` scope, added as an Actions secret — to activate the weekly assertion.
`scripts/repo-settings.sh` is what reads it; without it the scheduled run warns
and stops.

**What would break it.**

- Transferring the repo to a GitHub **organisation** — including a non-profit or
  a "just for tidiness" org. The policy's line is the entity, not the intent.
- Incorporating, or accepting the project into a company's portfolio.
- A sponsor, employer or client acquiring any ownership interest.
- Accepting contributions under a corporate CLA that vests rights in a company.

`PLAN.md` is explicit that this is expensive to undo, which is why it is decided
before the first commit rather than after.

**How we would find out.** The drift check above fails the build on an owner
change or an org transfer. Everything outside the repository — the hosting
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

**Affiliate links — decided 2026-08-17, and the interim answer was wrong.**

This paragraph read, for months: *"Affiliate links on card pages sit on the
boundary … it monetises the game content itself rather than the page around it.
**Do not add affiliate links without asking LSS first.**"* That was a careful
default reached without reading the policy, and the policy answers it directly.
It is quoted rather than deleted because the reasoning was reasonable and the
failure was not the reasoning — see the verification caveat at the top of this
file for the mechanism.

Three findings, in descending order of weight:

- **The Terms name the case.** Under *FAB Card Images → Platforms and Services*:
  "You may use the FAB Card Images for the creation of **card databases**,
  singles websites, and singles marketplaces. You may not monetize these
  platforms directly without express permission **except through the sale of the
  Game (including the sale of single cards in the case of singles websites)**.
  You may indirectly monetize this content (for example, Patreon and ad-sense)."
  LSS puts singles commerce on the permitted side *for card databases
  specifically*. A referral fee, where Optfall sells nothing, is strictly less
  than the thing already blessed.
- **"Indirect" is defined to include traffic.** The same document, three times
  over: "You may indirectly monetize this content (such as ad-sense on YouTube
  videos **and website traffic**)." An affiliate commission is payment for
  referred traffic. Note also what *direct* is exemplified as everywhere it
  appears — selling the app, selling subscriptions, selling the underlying IP,
  selling products *within* it. Never linking to a shop.
- **LSS recommends the specific programme.** Its own announcement, *FAB comes to
  TCGplayer*: "TCGplayer also offers support to the Flesh and Blood community
  with the **TCGplayer Affiliate Program**. Content creators can now earn rewards
  by referring customers to the digital marketplace." LSS and TCGplayer have been
  formally partnered since 2026-05-12.

**The precedent.** FaBrary — the ecosystem's most-used third-party app — has
shipped Impact affiliate links (account `4925001`) alongside five other vendors,
while carrying the LSS disclaimer, in public, for a long time.

> **A false friend, and the reason this paragraph names it.** The Terms say you
> may not create the appearance of "endorsements or **affiliate relationship to
> the Game and the Studio** without prior written approval." That is affiliation
> *with LSS* — the thing the mandatory disclaimer exists to deny — and has
> nothing to do with affiliate marketing. It is the **only** occurrence of the
> word "affiliate" in the document, so anybody re-checking this by searching the
> policy will land on it and read it as a prohibition. It is not one.

**What we therefore do.** One purchase link on a card page — the button below
the legality grid, for the printing that claimed the art shown; see §2 for where
it has been and why it is there — built by
[`apps/site/src/lib/tcgplayer.ts`](../apps/site/src/lib/tcgplayer.ts). ~~on the
printings table~~ — struck: they were the table's eighth column. ~~Per-printing
purchase links in a **Buy** section of their own on the card page, plus one under
the card face~~ — struck **2026-08-19**: the section was split out of the table
on the argument that "what exists" and "where do I get one" are different
questions, then removed outright, which answers the same question by subtraction.
The face button is what is left of commerce on a card page.
**No price, ever** — that is a separate decision on separate grounds, recorded in
that module and in `docs/PLAN.md`'s collector-economy exclusion.

**What is still not settled**, and should not be overstated: this is a reading of
published terms plus a live precedent, not written approval, and the grant is
revocable "at the sole discretion of the Studio" — which is equally true of every
other permission this project relies on. If a written answer is ever wanted,
`ip@legendstory.com` is the address, and the affiliate question and the Patreon
question should go in the same message.

**Enforced at.** [`apps/site/src/lib/tcgplayer.ts`](../apps/site/src/lib/tcgplayer.ts)
holds a single `AFFILIATE_ID` constant that drives the links, the `rel`, and the
disclosure sentence together, so the site cannot earn a commission while telling
readers it does not. `tcgplayer.test.ts` asserts both states, and its final block
fails deliberately the moment the constant is set — the flip cannot happen
without somebody reading that file.

**The flip happened, 2026-08-18.** TCGplayer accepted the partner application
filed 2026-08-17 and `AFFILIATE_ID` is now `7630689`, so every purchase link is
wrapped, every anchor carries `rel="sponsored"`, and the sentence under the buy
links says Optfall earns a commission. The tripwire did its job: the
final block asserted `null`, broke on the change, and was rewritten to assert
the live state — the same guarantee pointing the other way.

The disclosure now carries real weight rather than describing a hypothetical, so
it is worth naming what it rests on. TCGplayer's Partner Guidelines put FTC
compliance on the partner and require disclosure that is "clear, conspicuous,
prominent and unambiguous to the average member of your audience". Optfall's
sits adjacent to the link it describes rather than in the site footer — beside
the button, at every width — which is the whole reason `buyDisclosure` lives in
the same module as `buyHref`.

**There is one buy link on a card page, and the sentence shares its row** — to
the right of the button. ~~Where there is room, wrapped directly under that
button where there is not.~~ **Overtaken 2026-08-24**: the disclosure's flex
basis went to zero, so it takes whatever gutter the row has left instead of
dropping onto its own line when that gutter gets small. Beside is now the
arrangement at every width the site is measured at, phones included, which is
where "conspicuous to the average member of your audience" is hardest to satisfy
and most worth satisfying. What it costs is height: the sentence is four to
eight lines in a 91–201px gutter on a phone, against a one-line button.
~~The row sits under the card panel, above the fold either way.~~ **Overtaken 2026-08-20**: the row and the legality grid swapped places,
so the button now follows Legality rather than leading it — six format rows
further down, because `verdicts` is `FORMATS.map(…)` and every card page prints
all six whether upstream published a flag or not. What the
Partner Guidelines ask for is adjacency to the link, which is a property of the
row and not of its position on the page, so the swap did not touch it — the
button and the sentence moved together, as one element. The comment on
`.of-card__buy-verify` in `apps/site/ssg/components/CardEntry.css` records the
width and line count the sentence was measured at, at each of ten viewports.

**The sentence is two sentences, and was four** (2026-08-19). What ships is the
material connection and nothing else: where the link goes, and that Optfall is
paid when it is used. ~~The product each link addresses is recorded in the
community dataset this corpus is built from, not supplied by TCGplayer. No price
is shown and no endorsement is implied.~~ — struck. Both were true and neither
was required by the Partner Guidelines, by the FTC, or by the LSS terms this
document reads elsewhere: the first is provenance, which `/about` states once
with the file and the commit, and the second is a promise about the site made in
the site's own fine print, where "no price is shown" is a fact a reader can
check by looking and affiliation with LSS — the endorsement that does need
denying — is denied by the verbatim disclaimer §4 governs. What they cost was
length, on the one paragraph on a card page that most needs to be read.
Disclosure a reader skips is not conspicuous, so this is the "clear,
conspicuous, prominent and unambiguous" standard being served rather than traded
against.

**The clause carrying the obligation was not reworded.** "Optfall earns a
commission on purchases made through them" is what it was, word for word; it
lost a leading "and" and became its own sentence, matching the form the unpaid
state was already written in. `tcgplayer.test.ts` asserts both states, now
including that neither quotes a price and that neither outgrows the two lines
the button's height allows on a wide screen — the layout rule it is possible to
test from a repository that renders no CSS. On a phone the sentence is the
taller of the two, deliberately; the test says so, and says why.

~~There is one buy link on a card page, and the sentence is directly under it —
the button beneath the card face, above the fold.~~ **Overtaken 2026-08-19**:
the button and its disclosure became one flex row, so "under" is now only the
narrow-screen half of the answer. Adjacency is what the Partner Guidelines ask
for and it holds at every width; "directly under" no longer does. **And on
2026-08-24 it stopped being half of anything**: the narrow-screen case is beside
too.

~~One buy link on the page
does not have the sentence directly under it — the button beneath the card face,
which sits above the fold and well above the Buy section. That is deliberate
rather than an oversight: printing the disclosure twice on one page is not more
conspicuous, it is the repetition that teaches a reader to skip it. The claim
being made is that the sentence is clear and prominent *on the page carrying the
links*, which `ssg.test.ts` asserts by requiring it exactly once wherever any buy
link renders and never where none do. If that reading is ever judged too loose,
the fix is a second disclosure by the face rather than a quieter one below.~~
**Overtaken 2026-08-19**: the Buy section was removed, and with it every buy link
except that button. So the looser reading this paragraph was defending — that a
sentence somewhere on the page covers a link elsewhere on it — is no longer being
asked for, and the fix it named as the fallback is what shipped: the disclosure
moved up to sit with the face button.

`ssg.test.ts` still asserts the sentence appears exactly once wherever any buy
link renders and never where none do. Both halves now hold structurally rather
than by discipline — the button and the sentence render from one branch on one
`faceBuyHref` in `CardEntry`, so neither can appear without the other — and a
companion test asserts a card page carries **at most one** buy link, which is the
premise the "exactly once" rule rests on.

**Nothing here is coupled to the host**, which is worth stating outright. The
links are ordinary anchors in static
HTML: no redirect rule, no edge function, no header, no runtime. Attribution
travels in the URL path (`/c/7630689/…`), so it does not depend on the `Referer`
header — and could not, since `buyRel` puts `noreferrer` on every one of these
anchors in both states. The site's `Referrer-Policy` is therefore not an
affiliate dependency, and setting it is a general-hardening question rather than
one this section blocks on. **The hosting move carried this section with it
unchanged**; if that ever stops being true, the thing that changed is a new
coupling and belongs in this paragraph.

**The link was verified end to end, not merely assembled.** Both segments of the
partner path had to be right and neither was issued to us in writing: the
campaign segment (`21018`) is confirmed by Impact's own notifications, which are
headed with it, and the media segment (`1830156`) was inferred from Scryfall's
and FaBrary's published links. A wrong media id passes every assertion in the
suite and still produces a link that credits nobody, so on 2026-08-18 a built
link was requested and its redirect read:

- `301` to the correct product, with the `Printing=Normal` parameter intact —
  so the foiling survives the round trip, which is the regression the encoding
  test exists for.
- The destination carries `irpid=7630689` — this account — along with a
  generated `irclickid` and `utm_source=impact`. The click is attributed.

**What remains is one dashboard check, and only a human can do it:** confirming
that click surfaces in Impact's reporting. The redirect proves TCGplayer builds
an attributed destination; it cannot prove Impact recorded it. Until somebody
looks, treat revenue reporting as unconfirmed — but the failure mode the open
action was written to catch, a link crediting nobody, has been ruled out.

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
  non-compliant until it has one. **Enforced since the game symbols landed** —
  `scripts/check-asset-provenance.ts`, the `provenance` job, in the gate.

**The game symbols are in, and they are not an exception to this rule.** The
eight symbols the Comprehensive Rules defines at 1.12.4 — `{p}`, `{r}`, `{d}`,
`{h}`, `{i}`, `{c}`, `{t}`, `{u}` — are LSS's own artwork, ingested from LSS's
own rules site and rendered inline in card text. The line this section draws is
at **marks**: logos, product set logos, and close semblance of either. A symbol
that the rules define as notation for a power value is a **mechanic**, which is
the category this very section blesses two bullets up, in the sentence
explaining why the project's mark is a pitch jewel. `{p}` identifies no brand.

Three things make that argument checkable rather than asserted:

- They come from `rules.fabtcg.com`, where the symbols are published as part of
  the **rules**, not from `fabtcg.com/resources/marketing-assets/`, which is a
  brand kit and is off limits. A test asserts the recorded origin is the rules
  host, so the argument fails loudly if the source ever moves.
- The set is **closed at eight** and derived from the rules corpus. There is no
  argument to the ingest script that widens it, and `symbol-assets.test.ts`
  fails if the manifest and the rules table stop describing the same symbols.
- `data/symbols/symbols.json` records each file's URL, SHA-256, byte length and
  pixel box, plus a rights statement naming LSS and disclaiming relicensing.

**Status.** Specified in `DESIGN.md` and `PLAN.md`; the token constraint landed
with Phase 1, and the asset-provenance half is now enforced in CI.

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

**How we would find out.** This said "review, and nothing else — **this one is an
open action**" while the reason given was that "there are no committed binary
assets to scan yet". There are now, so the action is closed: the `provenance`
job walks **every** public directory — `apps/site/public` and
`apps/images/public` — and fails on any binary whose directory-relative path,
bytes and https origin are not recorded in that directory's manifest. It runs
offline, so it cannot go red because a third-party host is down.

Three details that are the difference between a control and a gesture. Assets
are matched on their **path within the directory**, not their basename, so a
copy of an approved file at a new depth does not inherit the original's approval
and a moved file is reported twice rather than zero times. A public directory
with **no manifest** is not exempt, it is empty of approved binaries — the first
PNG dropped into `apps/images/public` fails, rather than sailing through a
directory nobody remembered to list.

And an origin may be **`first-party:<script>`** as well as an https URL, because
some committed bytes are ours. `SCRYFALL-GAP.md` §5 plans generated NO IMAGE
placeholders shipped statically in `apps/images/public/`; they have no upstream,
and demanding a URL of them would have left the next person choosing between
disabling the check and inventing a plausible origin for a file nobody fetched.
The second is the likelier of the two, because it keeps the build green, and it
is exactly the weakening this section exists to prevent. A `first-party:` origin
is a positive claim that Optfall drew the file, checkable by reading the script
it names — not a way to skip the question.

**Be precise about what a green tick buys.** It proves an asset's origin is
*recorded*, not that the origin was *permitted*. Somebody who ingests a set
symbol and writes it a manifest entry passes this check and still violates the
policy. That is not a gap to be closed by a cleverer filename pattern — the
earlier plan here was to match "a known set-symbol filename pattern", which
catches a careless copy and nothing else. What the check actually changes is
that adding a governed asset is now a **visible diff naming a URL**, so the
deliberate case looks deliberate. That is the same argument the token constraint
makes, applied to bytes; review is still what judges the URL.

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
- The site layout footer, rendered by the shared document shell
  ([`apps/site/ssg/document.tsx`](../apps/site/ssg/document.tsx)), so it appears
  on every page rather than on an about page. (This was
  `ComplianceFooter.astro` under `BaseLayout` until Phase 6 deleted Astro; the
  obligation and the one-constant rule are unchanged — only the renderer moved,
  and the link above pointed at a file that no longer exists.)
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
the shared layout — an error page, an embed, a standalone workbench build, an
OG-image route. Rendering it only on `/about`. Hiding it behind a collapsed
"legal" disclosure. Shipping it in an image rather than text.

**Where it must also appear.** `README.md` carries it (it already does), and any
standalone published surface needs its own copy.

**The obligation is unchanged; two of the three examples it used to name are
gone.** This paragraph listed "Storybook, the docs site, embedded custom
elements distributed to other tools", and argued that an embeddable component
handed to a third party carries our compliance obligation into their page — *"a
design constraint on the custom-element build, not an afterthought."* Storybook
was deleted in [#107](https://github.com/alxjrvs/optfall/pull/107) and the
workbench that replaced it, the committed `design-system/` bundle, is not
published. The custom-element build went in the same PR and has no replacement;
whether it returns is open as
[#156](https://github.com/alxjrvs/optfall/issues/156).

The constraint is recorded rather than dropped **because it is a precondition,
not a consequence**: if the primitives are ever shipped to other tools, the
disclaimer travels with them or we have exported a compliance breach. That is a
requirement on any answer to #156, and it should be found by whoever scopes it
rather than rediscovered afterwards. Today there is nothing published outside
this site, so nothing is currently in breach.

### 5. The copyright line on card images

**Requirement.** Wherever FAB card images are used, the appropriate copyright
disclaimer must be provided: **`© Legend Story Studios`**.

**Enforced at.**

- **The universal footer.** Every built page carries the literal
  `© Legend Story Studios`, emitted by the document shell in `ssg/document.tsx`
  beside the corpus's own rights notice and the LSS disclaimer. A page cannot
  opt out: pages do not render the footer, the shell does.
- **`scripts/check-card-notice.ts`**, which reads the built HTML and is now the
  primary enforcement rather than a backstop. See below.
- The image-serving layer (Phase 3, "own bucket, copyright line, no set logos in
  chrome") applies it at the serving boundary as well, so a hotlinked image is
  not an unmarked image.

**THIS CHANGED, AND THE CHANGE IS A TRADE RATHER THAN A TIGHTENING.** The line
used to be emitted per image, by `CardFace`, with `CardFaceGroup` hoisting one
notice over faces shown together — the wording of this section demanded exactly
that: "not a prop the caller may omit… and not the page's responsibility". It
was moved to one notice per page.

*What that bought:* a card grid of sixty faces carried sixty short notices, and
they read as noise on every surface that shows more than one card — the grid,
the front-door fan. The requirement is that the disclaimer be
**provided wherever card images are used**, and a page that states it once,
unmissably, in the same footer as the rest of the rights position satisfies that.

*What it cost, stated plainly:* the old arrangement made the notice
**unforgeable**. A caller could not obtain the image without the line because one
component emitted both, and no page-level mistake could separate them. The new
arrangement puts the notice in a different file from the image. The coupling is
now an assertion over built HTML rather than a property of the component graph,
and an assertion can be deleted where a structural impossibility cannot.

*What did not change:* the check still proves **every card face on every page
came from `CardFace`**, which is the half that caught the real incident. That
never depended on the notice.

`CardFaceGroup` was deleted with the move. It existed solely to hoist the notice
— its wrapper and its context had no other behaviour — so keeping it would have
left a primitive whose documented reason for existing had gone. The closed
primitive set is `PRIMITIVES` in `packages/components/src/index.ts`, and the
count is deliberately not restated here: it was written down as thirteen and was
wrong at fourteen, sixteen and nineteen without anybody noticing.

**Status.** **Enforced in the built output.**

**Both failures this project has actually had were page-level**, which is why
the surviving enforcement is a check over built HTML rather than a component
test: printing thumbnails once rendered as bare `<img>` to avoid repeating the
line, putting 22 images under a single notice, and the front-door fan shipped
with a crop that cut the hoisted notice in half.

The second of those is worth re-reading against the current design. A notice in
the footer cannot be cropped by a card-row stylesheet, so that specific failure
is now structurally impossible — but a footer is further from the images than a
caption was, and "provided wherever images are used" is satisfied at page
granularity rather than at image granularity. That is the trade, and it was made
deliberately.

`scripts/check-card-notice.ts` runs in the `disclaimer` job and **catches the
first of those, not the second.** It counts: every `<img>` served from the face
host must correspond to a face `CardFace` rendered, so a bare `<img>` fails even
on a page that carries a notice from some other face. A presence test would not
have — one compliant face immunises any number of unmarked ones beside it, which
is exactly the shape of the incident, and is how the first draft of that check
was wrong.

**Still open, and neither is small.** The second failure is not covered by
anything: the check reads HTML, so it knows the notice is on the page and cannot
know whether a stylesheet has put it where nobody reads it. That is the
visual-regression bullet in [`PLAN.md`](PLAN.md) Phase 1 — committed Playwright
screenshots rather than a hosted service — still unbuilt, and framework-neutral
now that the Storybook it was once phrased against is gone. And the serving boundary is
unbuilt — nothing applies the line at the image host, so a hotlinked face is an
unmarked face.

The check knows every host a card image can come from — ours plus the four
upstream ones the corpus carries in `printings[].image_url`, derived from the
data rather than typed — because `<img src={printing.image_url}>` is one field
away at any call site and would otherwise have counted as no image at all.

**It also does not reach the search grid.** `/search` server-renders no results,
so its grid of up to sixty faces is built in the browser and never appears in
the HTML the check reads. That is the surface where a bare `<img>` is most
tempting — sixty separate notices look like a cost — and closing it needs a
rendered-DOM check. The check covers server-rendered faces, which is where the
incident happened, and not every face the site can show.

**The grouping that was on the wrong side of our own rule no longer exists.**
`PrintingPicker` grouped the whole printings rail under one hoisted notice as a
wrapping four-up grid — up to 22 tiles, six rows, notice last — which is exactly
the scrolling case `CardFaceGroup`'s rule excludes. It was corrected to a single
scrolling row, and then the rail was retired outright: the printings table is
how a reader reaches another art now, and a card page renders ONE face carrying
its own notice. The rule outlived the caller it was written for, which is the
better of the two ways that can end.

*(This line previously said "enforced when Phase 1 … and Phase 3 … land". Both
landed. `/data-terms` defers to this document where the two differ, so a stale
status here is a stale claim on the page a recipient would actually read.)*

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
| 1 | Read the LSS terms page end to end and ratify or correct this document — especially the copyright line and the logo clause. **Narrowed 2026-08-17**: the page has now been fetched and transcribed, and the disclaimer is asserted byte-for-byte against it, so what remains is a human confirming the judgement calls rather than the text | First public deploy |
| 2 | ~~Decide the affiliate-link question (§2), or decide not to decide it and record that~~ **Decided 2026-08-17** — permitted as indirect monetisation, with the clause quoted and the precedent named in §2. ~~Links ship unwrapped until the TCGplayer partner application is approved; setting `AFFILIATE_ID` is the whole of the remaining work~~ **Approved and set 2026-08-18** — `AFFILIATE_ID` is `7630689`, links are wrapped and disclosed as paid | — |
| 6 | ~~Click one live purchase link and confirm it lands and credits us~~ **Half closed 2026-08-18** — the redirect was read directly: `301` to the right product, `irpid=7630689` on the destination, so the inferred media segment is correct and clicks are attributed (§2). What is left is **confirming the click appears in Impact's own reporting**, which needs the dashboard | Trusting any revenue figure |
| 3 | ~~Confirm the display typeface is licensed for webfont embedding~~ **Done.** Grenze, SIL OFL 1.1 — the grant names `embed` outright. The clause is quoted in `data/fonts/fonts.json` rather than summarised, and condition 2's obligation (each copy carries the copyright notice and the licence) is met by `apps/site/public/fonts/OFL.txt` | Phase 1 |
| 4 | Post the upstream licence request | Phase 2/3 data work |
| 5 | Write the revocation-drill test once the legality package exists | Phase 2 exit |
| 7 | Resolve the rights position on TCGplayer's mark, or remove it. The manifest entry at `data/brand/brand.json` records its own rights as **unresolved** and says why: `help.tcgplayer.com` returns 403 to an automated fetch and the Partner Guidelines download did not complete, so what is established is the origin and the partnership — **not permission for this placement**. The mark ships on every card page today. A human should read Impact resource 3737 and either replace that sentence with the clause that permits it, or take the mark out. | Nothing yet — but it is a third party's trade mark on 12,776 pages |
