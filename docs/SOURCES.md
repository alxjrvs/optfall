# Source verification

Every upstream Optfall depends on, re-verified against the live web on
**2026-08-16**. The question this answers: *is each source the most current one,
is it the one the community actually trusts, and is there an official
alternative we should be using instead?*

**Headline: the sourcing is right, and one thing changed under us.** The
community card dataset is confirmed as the community standard and is correctly
pinned. The rules corpus is unchanged and still current. But Legend Story
Studios now runs an **official card database with a public JSON API**, which
this project does not use and which no document here previously named — and
upstream spent the last three weeks re-syncing itself to it, which our pin is
six days on the wrong side of.

---

## The verdict per source

| Source | Used for | Current? | Trusted? | Official? |
|---|---|---|---|---|
| [`the-fab-cube/flesh-and-blood-cards`](https://github.com/the-fab-cube/flesh-and-blood-cards) | Card corpus, legality flags, printings | **Pin is 6 days stale, and it matters** | **Yes — confirmed community standard** | No — community |
| [`rules.fabtcg.com`](https://rules.fabtcg.com/) | Comprehensive Rules, TRP, PPG | **Yes — byte-identical to Phase 2** | n/a | **Yes** |
| `cardvault.fabtcg.com` + `api.cardvault.fabtcg.com` | *nothing yet* | n/a | n/a | **Yes — and unused** |
| `fabtcg.com` (via Wayback) | Card Legality Policy, announcements | Still 403 to automation | n/a | Yes, but unreachable |

---

## 1. The community card dataset is the right choice, and that is now measured

`the-fab-cube/flesh-and-blood-cards` was adopted on the reasoning in
[`PHASE-2-STATUS.md`](PHASE-2-STATUS.md) without a survey of alternatives. The
survey has now been done, and it confirms the choice on stronger grounds than
the original argument used.

**It is alive, not merely un-archived.** 30 commits in the 30 days to
2026-08-16; `develop` HEAD `0fc965a9` at 2026-08-16T03:48:55Z. 162 stars, 56
forks, not archived.

**The trust signal is structural, not reputational.** The README names 13
downstream consumers — Fabrary, Talishar, Rules of Rathe, FaB Proxy, Spellvoid
and others. The decisive detail is *how* the largest of them consumes it:
Fabrary does **not** fork. Its maintainer, Phillip Manwaring, is the repository's
**second-highest contributor** (49 commits, against maintainer Tyler Luce's
1,036), landing changes through pull requests from `fabrary/develop` into
upstream `develop`. The biggest downstream treats this repository as shared
infrastructure it maintains rather than a source it copies. That is a much
better answer to "does the community trust it" than a star count.

**No credible alternative exists.** The other named community projects
(Fabrary, Talishar, Rules of Rathe, FABREC) are *consumers* of this dataset,
not competing sources. `fabdb.net` is the historical alternative and is stale.
Third-party commercial APIs exist but are resellers, not authorities.

**Pin to commits, never to release tags.** The latest tag, `v8.2.0`, was
published 2026-06-30 and is now materially behind `develop` — see below. The
maintainer's own README is explicit: *"I do not go back and support past
major/minor releases with bugfixes, so if you want the most up-to-date data, you
will always need to be on the latest version."* Optfall's commit-pin approach in
`scripts/build-card-corpus.ts` is correct and should stay.

**The licence position is unchanged.** GitHub still reports `license: null`;
`GET /repos/…/license` still 404s. Issue
[#119](https://github.com/the-fab-cube/flesh-and-blood-cards/issues/119) is
still open with **0 comments** and has not been touched since 2022-09-13.
[`docs/upstream-licence-issue.md`](upstream-licence-issue.md) remains drafted
and unposted. Nothing here changes the interim position in
[`DATA-TERMS.md`](DATA-TERMS.md).

---

## 2. There is an official LSS card database, and we do not use it

This is the finding that was not previously recorded anywhere in `docs/`.

**`cardvault.fabtcg.com`** is Legend Story Studios' own card database. It
launched in public beta as `cards.fabtcg.com`, which today issues a 301 to
`cardvault.fabtcg.com`. LSS's stated goals for it are to search every card and
print they have published, to provide the most *"true text"* for every card —
the current wording as if the card were printed today — and to replace the card
gallery as the canonical presentation of card images. It is stated to be
groundwork for official online decklist submission.

**It has an unauthenticated public JSON API.** Discovered by reading the site's
own bundle; it is not documented on `fabtcg.com`, and `fabtcg.com` 403s to
automated fetches so the announcement cannot be read directly.

```
https://api.cardvault.fabtcg.com/api                      → endpoint index
https://api.cardvault.fabtcg.com/api/gem/v1/cards/        → 4,986 cards
https://api.cardvault.fabtcg.com/api/gem/v1/decklist_search/?q=…
```

Django REST Framework, `count`/`next`/`previous`/`results`, honours
`?page_size=`, no key required. Verified returning HTTP 200 on 2026-08-16.

**What it gives us that nothing else does:**

- **Official card text.** The `text` field is LSS's own current wording, with
  rules symbols already in Optfall's `{p}` / `{r}` notation and `{br}` line
  breaks. `textbox` is the same content as HTML with symbol images inlined.
- **An official identifier.** `card_id` is `slug-pitch` — `command-and-conquer-1`.
  A permanent, LSS-issued key, which is exactly the shape Optfall's citation
  thesis wants and is currently synthesising for itself.
- **Official image URLs**, on `legendstory-production-s3-public.s3.amazonaws.com`.
- **An official card page URL** per card, for citation.

**What it does not give us — and this is the load-bearing limit.** The record
has 17 fields:

```
back_face  card_id  card_type  cost  defense  display_name  image  intellect
life  name  object_type  pitch  power  text  textbox  typebox  url
```

**No legality data of any kind.** No format flags, no banned or restricted
status, no Living Legend, no set, no rarity, no printings, no artist. `typebox`
is one unparsed string. The detail endpoint returns the same 17 fields as the
list endpoint — there is no fuller representation behind it.

**So it cannot replace the community dataset, and it does not compete with it.**
The community dataset carries 39 fields including `cc_legal`, `cc_banned`,
`blitz_living_legend`, `ll_restricted`, `silver_age_banned`, `upf_banned`,
`printings`, `traits`, `types` and keyword arrays. Optfall's entire product is
the part CardVault omits.

**The correct reading is that they are complementary, and both are official-ish
in different halves:**

- **CardVault is authoritative for card text, ids and images.** Prefer it there.
- **Legality is not sourced from either.** Per
  [`PLAN.md`](PLAN.md), the community dataset's legality flags are the thing
  Optfall exists to improve on, and the authority is the official **Card
  Legality Policy** plus banned-and-restricted announcements. CardVault's
  silence on legality changes nothing about that plan — it confirms it.
- **The community dataset remains necessary** for printings, sets, rarities,
  types, traits and keywords, none of which CardVault exposes.

**Open question for a human: are we permitted to call this API?** LSS's
[Terms of Use for Game and Studio Assets and IP](https://fabtcg.com/resources/terms-use-licensed-assets/)
permit *third parties to build* card databases and APIs that are not directly
monetised. That is a different question from the terms of use of *LSS's own*
API, for which no published terms, rate limits or usage policy were found. The
API is unauthenticated and public, which is not the same as documented-as-public.
Treat polite, low-volume, cached access as reasonable and **do not build a
hard dependency on it** until someone asks LSS. See
[`COMPLIANCE.md`](COMPLIANCE.md).

---

## 3. Our pin sits on the wrong side of an upstream migration

This is the actionable finding, and it is time-sensitive rather than structural.

Between 2026-07-27 and 2026-08-16, upstream re-synchronised itself to CardVault:

| Date | Commit |
|---|---|
| 2026-07-27 | Update image URLs to use CardVault pt. 1 |
| 2026-08-13 | Remap card images to cardvault URLs and fix card data |
| 2026-08-16 | Update functional text to match Card Vault |

Optfall pins commit `7a4822f3` (2026-08-10), which lands **between** the first
and second of those. Measured across every printing record:

| Snapshot | Image hosts |
|---|---|
| `v8.2.0` tag, 2026-06-30 | 11,817 `storage.googleapis.com` · 2,282 LSS S3 · 1,660 + 487 CloudFront |
| **Optfall's pin `7a4822f3`** | **10,155 `storage.googleapis.com`** · 4,313 LSS S3 · 1,587 + 443 CloudFront |
| `develop` HEAD, 2026-08-16 | **16,532 LSS S3** · 11 `storage.googleapis.com` · 1 CloudFront |

Upstream has collapsed four image hosts into one, and that one is the official
LSS host. Optfall's snapshot is still majority-legacy.

**Both hosts currently serve HTTP 200**, so nothing is broken today — this is
staleness, not breakage, and there is no outage to race. But the legacy
`storage.googleapis.com/fabmaster` host is now a deprecated path that upstream
has deliberately migrated off, and it is the host Optfall's committed
`data/cards/cards.json` and `apps/site/src/lib/faces.test.ts` are written
against.

**Re-pinning to `develop` HEAD is the single largest "use official resources"
win available**, and it costs one script run: it moves ~10,000 image URLs onto
the official LSS host and picks up card text reconciled against the official
database, without adopting a new dependency or changing a line of ingest code.

---

## 4. The rules corpus is current and unchanged

Re-verified byte-for-byte against what [`PHASE-2-STATUS.md`](PHASE-2-STATUS.md)
recorded:

| Document | Result |
|---|---|
| `rules.fabtcg.com/pdf/en-fab-cr.pdf` | 200, **413,462 bytes**, SHA-256 `fef01bb7c9…8fd44b85` |
| `rules.fabtcg.com/txt/latest/en-fab-cr.txt` | 200, **322,134 bytes** |
| `rules.fabtcg.com/txt/latest/en-fab-trp.txt` | 200, 121,581 bytes |
| `rules.fabtcg.com/txt/latest/en-fab-ppg.txt` | 200, 87,563 bytes |
| `rules.fabtcg.com/en/` | 200 |

The PDF title page still reads **Comprehensive Rules 2026-6-10, 2.14.0**. The
SHA-256 is identical to the one Phase 2 computed, so the parser's 1,269 sections
remain valid and no re-parse is required. **No 2.15 release exists** — a search
for one returns nothing, and the `2.15.x` tokens in the extracted text are
*rule numbers* in chapter 2 (`2.15.6 Types are functional keywords…`), not
versions. Anyone grepping the text for a version string will find those and
should not mistake them for one.

`rules.fabtcg.com` remains the correct official host and is the one part of
LSS's estate that serves automated clients reliably.

---

## 5. `fabtcg.com` still refuses automation, including on its new URLs

Unchanged, and worth recording that the new URL scheme does not help:

| URL | Result |
|---|---|
| `fabtcg.com/rules-and-policy-center/card-legality-policy/` | 403 |
| `fabtcg.com/en/resources/rules-and-policy-center/card-legality-policy/` | **403** |
| `fabtcg.com/en/articles/card-database-beta/` | 403 |
| `fabtcg.com/living-legend/` | 403 |

Two notes. First, the Card Legality Policy **has moved** to
`/en/resources/rules-and-policy-center/…`; the path recorded elsewhere in
`docs/` is the old one. Both 403, so this changes the citation rather than the
retrieval route — the Wayback path in `sources/wayback.ts` still stands.

Second, Comprehensive Rules **9.4.2** names
`https://fabtcg.com/living-legend/` as *"the official Flesh and Blood living
legend resource page"*. That is the rules document pointing at an official
source for Living Legend status — and it 403s like everything else on that host.
Worth adding to any eventual request to LSS for automated access.

---

## What this changes

Nothing structural. In priority order:

1. **Re-pin the card corpus to `develop` HEAD** and rebuild. Highest value,
   lowest cost, and it is the change that most increases how much of Optfall
   comes from official LSS resources.
2. **Record CardVault in `COMPLIANCE.md`** as a known official source with
   unknown API terms, before anything depends on it.
3. **Evaluate CardVault as the source of card text and card ids** when Phase 3
   defines the published card record — not as a replacement for the community
   dataset, but as the authority for the fields it does carry.
4. **Correct the Card Legality Policy URL** where `docs/` records the old path.
5. Unchanged: post the licence request, keep consuming rather than mirroring.

---

## Method, and its limits

Checked 2026-08-16 via live HTTP probes, the read-only GitHub API, and web
search. Card-count and image-host figures were computed by downloading each
snapshot and counting, not read from documentation.

Two honest limits. **`fabtcg.com` was never read directly** — every claim about
LSS announcements comes from search excerpts and third-party coverage, the same
caveat [`COMPLIANCE.md`](COMPLIANCE.md) already records, and the reason the
licence-request draft tells a human to read the terms themselves. And **the
CardVault API is undocumented**: its shape here was determined by reading the
site's JavaScript bundle and probing endpoints, so field stability, pagination
limits and rate limits are unknown and unpromised.
