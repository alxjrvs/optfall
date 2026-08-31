# Data terms

**Terms governing data published by Optfall.**

Optfall publishes datasets — the legality timeline, the rules corpus, diffs
between document versions, and the rulings record. This document says who owns
what in those files, what you may do with them, and what conditions travel with
them.

It exists because Optfall's own permission to handle Flesh and Blood content
comes from a conditional grant by Legend Story Studios, and **that grant binds
recipients too**. So these terms are not a formality: passing LSS's conditions
downstream intact is one of the six things we owe in exchange for being allowed
to exist. See [`COMPLIANCE.md`](COMPLIANCE.md) for the full obligation set and
[`PLAN.md`](PLAN.md) for the envelope it derives from.

The short version, before the detail:

> The structure is ours and it is **CC0** — take it, no conditions, no
> attribution required (though we would like it). The card names, card text and
> card art inside it are **not ours**, are **not** relicensed here, and remain
> the property of Legend Story Studios under their terms.

---

## Three layers, and only one of them is ours to license

Every file Optfall publishes is a mixture. Reading it as a single work with a
single licence is the mistake this document exists to prevent.

| Layer | Examples | Owner | Terms |
|---|---|---|---|
| **1. Structural work** | Rule section identifiers, permalinks, the legality timeline, version diffs, cross-references, schemas, our annotations | Optfall (`alxjrvs`) | **CC0 1.0 Universal** — public domain dedication |
| **2. Game content** | Card names, card text, set names, card images and art | Legend Story Studios | **Not ours. Not relicensed.** LSS's terms apply to you directly |
| **3. Human-authored contributions** | Judge-authored ruling text (Phase 5) | The named author | Licensed to Optfall for publication; author keeps the byline. Not yet finalised — see below |

A file containing all three is not "CC0 data with some caveats". It is a
compilation in which our contribution is dedicated to the public domain and
someone else's contribution is not ours to give away.

---

## Layer 1 — the structural work: CC0 1.0 Universal

**Licence:** [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
(SPDX: `CC0-1.0`). To the extent we hold any rights in it, we waive them
worldwide, including the EU *sui generis* database right.

### What this covers

Precisely and exhaustively — this is the enumeration, not an illustration:

- **Rule identifiers and permalinks.** The stable ids we mint for sections of
  the Comprehensive Rules, the tournament policy and the penalty guide, and the
  URL scheme that addresses them. The identifier is ours; the rule text it points
  at is not.
- **The legality timeline.** Records of the form *(format, card identifier,
  legality, effective date, source citation)* — every banned-and-restricted
  revision and Living Legend threshold, date-stamped.
- **Version diffs.** The computed difference between two versions of an official
  document — the structure of the change, our section mapping across versions,
  and which cards a change touches.
- **Cross-references.** The card ↔ rules join, and any mapping table we build.
- **Schemas and identifiers.** JSON schemas, field names, our own id namespace,
  and the mappings between our ids and upstream ids.
- **Annotations.** Our own editorial notes, freshness stamps and provenance
  metadata.

### What this does not cover

**No card names. No card text. No set names. No card art.** Those are Layer 2
and appear below. If a field in one of our files contains a card's printed or
oracle text, that field's *contents* are LSS's; the schema around it, the id
beside it, and the legality verdict attached to it are ours.

A diff of an official rules document is a particularly sharp case: the *diff
structure* is our computation, and the *quoted text on both sides of it* is
LSS's document. Both ship in the same file. Only the first is CC0.

### Why CC0 rather than CC BY-SA 4.0

This was a real choice and it went to CC0. The reasoning, since it should be
possible to disagree with it on the merits:

1. **Adoption is the point, and ShareAlike is friction exactly where we cannot
   afford friction.** Phase 2's exit criterion is that another tool in the
   ecosystem adopts the library or the published JSON. The tools that would adopt
   it — Talishar, Fabrary, the meta sites — have their own codebases and their own
   licences. A copyleft obligation of uncertain scope ("does embedding your
   timeline in my app trigger this?") does not get lawyered; it gets skipped. A
   dataset nobody dares embed has failed at the only job it had.

2. **Our copyright claim here is genuinely thin, and CC0 is the honest response
   to that.** A ban date is a fact. A card's legality on a given day is a fact.
   Facts attract no copyright, and US law gives no "sweat of the brow" protection
   to a compilation of them — only original selection and arrangement is
   protectable, which for a chronological list of announcements is close to
   nothing. Asserting a ShareAlike obligation over material we may not own would
   be unenforceable *and* misleading: we would be telling people they owe us
   something they do not. CC0 also explicitly waives the EU database right, which
   is the one right in this area that actually does bite — so CC0 does more real
   work than BY-SA would, in the jurisdiction where it matters.

3. **We are asking upstream for a permissive licence.** Optfall's dependency on
   the community card dataset turns on that maintainer choosing permissive terms
   (see [`upstream-licence-issue.md`](upstream-licence-issue.md)). Asking for
   permissive while giving copyleft is bad faith, and it weakens the ask.

4. **ShareAlike over a mixed corpus is a trap for the people who trust us.**
   Our files embed LSS-owned strings. A ShareAlike condition would purport to
   impose obligations across a work we cannot fully license, handing every
   downstream consumer a compatibility problem we created and cannot resolve.
   CC0 over our layer keeps the boundary legible: the only conditions on the file
   are LSS's, stated plainly, and none of them are ours.

5. **It has to survive us.** `PLAN.md` commits that if the site disappears, the
   corpus does not. That only holds if a stranger can fork the data without
   consulting a lawyer first. Three Flesh and Blood tools have already died or
   decayed; the licence should assume we are the fourth.

6. **Consistency with the code.** Optfall's code is MIT. A permissive code
   licence beside a copyleft data licence makes downstream reason about two
   regimes for one project, for no gain.

**The strongest argument the other way**, stated fairly: BY-SA would compel a
competitor who builds on our timeline to give their improvements back, and would
guarantee attribution rather than requesting it. We are rejecting it because the
asset that matters is *being right and being current*, which is a maintenance
property rather than a licensing one — a stale copy of our data is not a threat,
it is an advertisement — and because attribution obtained as a community norm
has worked better in this category than attribution obtained as a condition
nobody can afford to enforce.

### Attribution: requested, not required

CC0 means you owe us nothing. We would still like a credit, because it is how
people find corrections and how errors get reported back:

```text
Legality and rules data from Optfall — https://optfall.com
```

Please do **not** imply endorsement, and please do not present a modified copy
as ours. Neither is a licence condition; both are how to be a good neighbour.

### CC0 is irrevocable, and that is deliberate

A CC0 dedication cannot be withdrawn from data already published. If Optfall is
abandoned, sold, or has its LSS grant revoked, the structural work stays free
forever. That is a feature, and it is the licensing half of "survive
revocation".

---

## Layer 2 — game content: not ours, never relicensed

Card names, card text (printed and oracle), set and edition names, and all card
images and art are the property of **Legend Story Studios**. Optfall handles
them under LSS's *Terms of Use for Game and Studio Assets and IP*, and
**publishes no licence over them whatsoever**.

Nothing in this document grants you any right in that material. Your right to
use it comes from LSS directly, on LSS's terms, and you are responsible for
reading them:

<https://fabtcg.com/resources/terms-use-licensed-assets/>

### Conditions that travel with our data

Because LSS's grant is conditioned on the recipient's compliance, these pass
through to you. They are LSS's conditions, restated — not additional Optfall
terms:

- **The disclaimer.** Any application built on this data must carry LSS's
  required disclaimer, with your own application's name substituted. Ours reads:

  ```text
  Optfall is in no way affiliated with Legend Story Studios. Legend Story Studios®, Flesh and Blood™, and set names are trademarks of Legend Story Studios. Flesh and Blood characters, cards, logos, and art are property of Legend Story Studios.
  ```

- **The copyright line on images.** Wherever card images are shown, display
  `© Legend Story Studios`.
- **No LSS or Flesh and Blood logos**, including product **set logos**, which
  count as FAB logos. Card faces are fine; set symbols as filter icons are not.
  The policy also prohibits creating a close semblance of those logos.
- **No direct monetisation** of this content — no sales, no subscriptions, no
  selling products within the app, no directly monetised API. Indirect
  monetisation (Patreon, ad-sense) is permitted by LSS.
- **Individuals, not commercial entities.** LSS's third-party application policy
  does not extend to commercial entities. If you are one, contact
  `ip@legendstory.com` rather than relying on this.

If LSS's terms and this document ever conflict, **LSS's terms win** and this
document has a bug worth reporting.

### Upstream provenance, and an honest limitation

Optfall's card data derives from the community dataset at
[`the-fab-cube/flesh-and-blood-cards`](https://github.com/the-fab-cube/flesh-and-blood-cards),
consumed on a schedule and pinned by commit.

**That dataset currently ships no licence.** By default that means all rights
reserved in the *compilation* — the data-entry and structuring work its
maintainer and contributors did — regardless of LSS's separate grant over the
underlying game content. So, until that resolves:

- We **do not republish its files verbatim**. We publish our own derived
  structural records, and we cite the upstream commit rather than mirroring it.
- Consumers who want the card corpus itself should go to the upstream repository
  and form their own view of what its absent licence permits.

We have drafted a courteous request for an explicit licence
([`upstream-licence-issue.md`](upstream-licence-issue.md)). This section gets
rewritten when it resolves.

---

## Layer 3 — human-authored contributions (Phase 5)

Not yet in effect. Recorded now so the terms exist before the first contributor
does, rather than being invented under pressure afterwards.

Judge-authored ruling text is neither ours by default nor LSS's. The commitments
that shape whatever licence lands here, from `PLAN.md`:

- **Authors keep their byline.** Every verified entry carries a name, a date and
  the rules version it was answered under. Contributing must read as
  co-ownership, never as donating labour to someone else's database.
- **Forward consent only.** No mining of existing Discord archives.
  Retroactive consent from thousands of people is impossible, and asking would
  itself be the hostile act.
- **Attribution survives redistribution.** Whatever licence is chosen, a bulk
  export must carry the author's name with the text.

Because Layer 3 is likely to be attribution-bearing, it will be published as a
**separate dataset** from the CC0 structural work rather than mixed into it, so
the CC0 dedication over Layer 1 stays unambiguous.

---

## What we warrant

These are promises about the data, not legal warranties. They are the reason to
prefer this dataset over a scrape.

- **No model-generated content. Ever.** No dataset Optfall publishes contains
  text produced by a language model. This rules out LLM-assisted parsing in the
  document pipeline exactly as much as it rules out generated prose. Parsers are
  deterministic code whose output diffs cleanly and fails loudly. **Every string
  we serve traces to a parsed official document or a named human author.**
- **Everything is citable.** Every legality record carries the announcement that
  produced it. Every rule section carries a permanent identifier. Every ruling
  carries an author and a rules version.
- **Everything is version-stamped**, and every surface shows when its data was
  last confirmed. A stale Optfall is required to look stale.
- **Everything is a committed file.** Each dataset lives versioned in a public
  git repository and is served as a static file — simultaneously the storage
  layer, the public API, the backup and the audit trail. There is no state you
  cannot see and no history you have to ask us for.

## What we do not warrant

- **Not an official source.** Optfall has no affiliation with Legend Story
  Studios (see the disclaimer below). Where we disagree with an official
  document, the official document is correct and we have a bug.
- **Not a tournament authority.** A head judge's ruling at an event beats
  anything here. Use this to prepare and to cite, not to overrule a judge.
- **Correctness is the goal, not a guarantee.** Being right is the entire
  product, which is why every record is citable — so you can check us. Please
  report errors.

---

## Machine-readable form

So that terms survive a file being copied somewhere we will never see:

- Every published dataset directory ships a `LICENSE.txt` (the CC0 dedication)
  and a copy of these terms as a sibling file, so a bulk download carries them
  without the website.
- Every published JSON payload carries a metadata block naming the terms URL,
  the licence of the structural work, the generation timestamp, and the upstream
  source commit.

```json
{
  "_meta": {
    "terms": "https://optfall.com/data-terms",
    "structural_licence": "CC0-1.0",
    "game_content": "Card names, card text and card art are property of Legend Story Studios and are not licensed by this file.",
    "generated_at": "2026-01-01T00:00:00Z",
    "source_commit": "0000000000000000000000000000000000000000"
  }
}
```

---

## Changes to these terms

We may revise this document — to correct an error, to reflect a change in LSS's
terms, or to settle Layer 3. Two things are fixed:

1. **The CC0 dedication over already-published structural work cannot be
   withdrawn.** A revision can only affect data published after it.
2. **Layer 2 will never be relicensed by us**, because it was never ours.

Material changes are recorded in the repository history, which is public.

---

*Optfall is in no way affiliated with Legend Story Studios. Legend Story
Studios®, Flesh and Blood™, and set names are trademarks of Legend Story
Studios. Flesh and Blood characters, cards, logos, and art are property of
Legend Story Studios.*
