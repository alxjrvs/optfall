# Optfall against Scryfall — the gap, and the plan to close it

**Card search is the product. Rules ride along on the result. Cards have faces.**

This document is a comparative analysis of Optfall as it stands on `main` against
Scryfall, and a remove/update/extend plan to close the distance. It exists
because the repository currently contradicts itself: `docs/PLAN.md` was rewritten
on 2026-08-11 to make the card layer the product, and `docs/DESIGN.md` was not.
Every symptom below traces back to that one unreconciled edit.

---

## 1. The confusion, named

Three concrete contradictions, all cheap to fix and all currently shaping the
build.

**The front door serves the wrong thing.** `/` is a *rules* search box
(`apps/site/src/pages/index.astro` mounts `RulesSearch`). Card search lives at
`/cards`, reachable from one sentence of body copy eleven rows below the fold.
Scryfall's homepage is the card search; ours buries it behind the surface the
plan calls "supporting cast" — except the plan no longer says that.

**`docs/DESIGN.md` still encodes the abandoned position, in two named places.**

- The principles table, row 5: *"The unit is the verdict, not the card. Card
  pages exist, but the shareable objects are `/i/…` interactions and `/cr/…`
  rules."*
- Screen 5: *"Card page — **supporting cast, explicitly not a destination.**"*

`docs/PLAN.md` Phase 2 now says the opposite in as many words: *"cards are what
people arrive for,"* and *"a card page that cannot be linked is a lookup rather
than a reference."* Both documents are checked in, both are published, and they
disagree about what the product is.

**The two searches are strangers.** `/search` answers rules, `/cards` answers
cards, and the card query parser explicitly refuses to bridge them —
`PENDING_OPERATORS` in `apps/site/src/lib/card-search.ts` documents `cr:` as
*"searches the Comprehensive Rules — that lives at /search, not here."* A card
page links to no rule; a rule page lists no card. `docs/PLAN.md` Phase 4 lists
*"Card ↔ rules cross-reference, the join nothing currently makes"* as a
deliverable, and it is scheduled two phases after the surface that needs it.

**And no card has ever had a face.** `image_url` is present on 16,498 of 16,502
printings, typed on `CardPrinting`, carried through the corpus build — and
rendered in exactly zero places. `grep -rn image_url` returns five hits, all of
them type declarations and parser code.

---

## 2. What Scryfall actually is

Copying the look would produce a Magic site with different words in it —
`docs/DESIGN.md` already argues this correctly and it still holds. What
transfers is the *operating model*, which decomposes into eight things:

1. **One box, one dominant surface.** The homepage is the card search. Sets,
   syntax docs, the advanced form and random are chrome around it.
2. **Results are images by default.** The card face *is* the row. `display:`
   switches to checklist, text or full for people who want density instead.
3. **The printing is the addressable unit.** `/card/mh3/197/ajani-nacatl-pariah`.
   `unique:cards|prints|art` controls how duplicates collapse, and the card page
   has a printings rail that swaps the image.
4. **Search is an algebra, not a filter set.** Negation, `OR`, parentheses,
   comparisons, regex, exact-name `!`, plus `unique:`, `order:`, `dir:`,
   `display:` and `prefer:` as query terms rather than as UI chrome.
5. **Every state is in the URL** — including display mode, sort and uniqueness.
6. **Rulings ride on the card.** Official rulings are pulled onto the card page,
   dated and sourced. This is the thing that makes a card page settle arguments
   instead of merely describing a card.
7. **A browsable spine.** `/sets` and per-set pages give the corpus a shape you
   can walk without knowing what to type.
8. **Bulk data, published.** The reason the rest of the ecosystem consumes it
   rather than rebuilding it.

Items 1, 2, 3, 6 and 7 are the gap. Item 8 we already have. Item 4 we have a
fraction of. Item 5 we do correctly.

---

## 3. Side by side

| Capability | Scryfall | Optfall today | |
|---|---|---|---|
| Card search on the homepage | yes | `/` is rules search | **gap** |
| Card images | six variants | none rendered | **gap** |
| Image grid results | default view | text rows only | **gap** |
| Display modes | `display:grid/checklist/text/full` | one fixed list | **gap** |
| Sort control | `order:` × 15, `dir:` | corpus order only | **gap** |
| Printing-level URLs | `/card/<set>/<num>/<name>` | name-level only | **gap** |
| Duplicate collapsing | `unique:cards/prints/art` | n/a | **gap** |
| Negation, `OR`, parentheses | yes | none — flat AND only | **gap** |
| Numeric comparison | `cmc>=3`, `pow>tou` | refused by design | **partial** |
| Exact name | `!"Lightning Bolt"` | ranked tier, no operator | **partial** |
| Artist / flavour search | `a:`, `ft:` | declared pending; data present | **gap** |
| Set index and set pages | `/sets` | none | **gap** |
| Rulings on the card | official rulings, dated | none | **gap** |
| Random card | `/random` | none | **gap** |
| Name autocomplete | yes | none | **declined** — §5.2 |
| `/` focuses search | yes | yes (rules search) | **have** |
| Related cards | tokens, meld, combo | `references` / `referencedBy` | **have, better** |
| Legality table | ~12 formats, one state each | 6 formats, **multi-state, with the upstream evidence printed** | **have, better** |
| Every view is a URL | yes | yes | **have** |
| Bulk export | yes | rules + cards, committed | **have** |
| Prices, colour identity, EDHREC, tagger | yes | — | **not applicable** |

Two rows are worth dwelling on, because they are the reason this is worth
building rather than pointing at what exists.

**Our legality table is already better than Scryfall's**, and it is better in
precisely the way the project claims to care about: a format verdict is a *list*
of states rather than one, so a card that is banned *and* a Living Legend stays
both; every verdict prints the upstream flags it was derived from; and the
absence of a flag renders as "we do not know" rather than as `false`. Scryfall
prints one word per format. Keep this, and put it on the card page above the
fold — it is the differentiator that is already finished.

**Our related-cards graph is better too.** `referenced_cards` is resolved in
both directions across 4,941 cards, deduplicated, with the duplicates explained.
Scryfall's equivalent is narrower. This is free ground already taken.

---

## 4. Remove

Deletions first, because most of the confusion is *surplus*, not absence.

- **`/` as the rules search.** Card search moves to the homepage. This is the
  single highest-signal change in the document.
- **The home page's two body-copy sections.** "What this is" and "What is built"
  are five paragraphs between the field and nothing. They become the explainer
  link row of §5.2. The provenance and rights lines stay — "degrade visibly" is
  not negotiable — but they belong under the results, not between the reader and
  the search.
- **Live-as-you-type result updating.** The card field re-ranks on every
  keystroke today. It becomes submit-driven (§5.2), which deletes the debounce,
  the partial-query ranking path and the case for autocomplete along with it.
- **`/cards` as a distinct route.** It becomes a Netlify 301 to `/`, so every
  pasted `/cards?q=…` link keeps working. Query strings survive a 301.
- **`docs/DESIGN.md` principles table, row 5** — *"The unit is the verdict, not
  the card."* Replaced by the card as the unit, with interactions and rules as
  objects that attach to it. Record the change in place rather than deleting it,
  the way `PLAN.md` records its own reordering.
- **`docs/DESIGN.md` Screen 5's framing** — *"supporting cast, explicitly not a
  destination."* It is now Screen 1.
- **`docs/DESIGN.md` open question "Card rendering"** — the position that the
  card face is drawn from primitives rather than showing real art. Real art is
  expressly permitted for card databases with a copyright line, and it is what
  people came for. The drawn face survives as the *fallback* for the four
  printings with no published image, and the pitch jewel stays an Optfall-drawn
  overlay exactly as that entry argues.
- **The hard 60-result cap with "narrow the query".** `CARD_RESULT_LIMIT` is a
  refusal where Scryfall paginates. A grid makes it worse — 60 images is under
  one scroll. Replace with paging, keeping the true total honest as it is now.
- **`PENDING_OPERATORS` entries `artist` and `flavor`/`flavour`.** The data is in
  the corpus. They are pending only because nothing indexed them.
- **The `cr:` "that lives at /search, not here" entry.** Section 8 makes it
  answerable.
- **One of the two search islands.** `RulesSearch.svelte` (593 lines) and
  `CardSearch.svelte` (551) are near-duplicates, and both carry a comment naming
  the same two missing primitives: `SearchField` and `ResultRow`. Extract them
  into `optfall-components` and the duplication goes with them.

Nothing in the legality, rules-parsing or compliance layers is removed. Those
are the parts that are right.

---

## 5. Add

### 5.1 Card images — the decision, with the arithmetic

The corpus carries 11,377 distinct image URLs across four hosts, all
LSS-controlled:

| Host | Printings |
|---|---|
| `storage.googleapis.com` (fabmaster) | 10,155 |
| `legendstory-production-s3-public.s3.amazonaws.com` | 4,313 |
| `d2wlb52bya4y8z.cloudfront.net` | 1,587 |
| `dhhim4ltzu1pj.cloudfront.net` | 443 |

A sampled face is a **695 KB PNG**. Mirroring all 11,377 at full size is
**~7.7 GB** — categorically not committable to git, and the first thing in this
project that would need storage, a bill and a maintainer.

Three options, and the trade is not close:

1. **Hotlink upstream directly.** Zero infrastructure — and 695 KB PNGs on a
   60-card grid is a 40 MB page. Unusable as the default view.
2. **Mirror and resize into the repo or a bucket.** Full control, and it
   introduces the exact dependency the Stack section exists to refuse: storage
   that costs money and rots when nobody is watching.
3. **Transform on demand at the edge, from the upstream source.** ✅

**Take option 3: Netlify Image CDN over remote sources.** It transforms images
from external domains listed in a `netlify.toml` allowlist, with no storage on
our side:

```toml
[images]
  remote_images = [
    "https://storage\\.googleapis\\.com/fabmaster/.*",
    "https://legendstory-production-s3-public\\.s3\\.amazonaws\\.com/.*",
    "https://d2wlb52bya4y8z\\.cloudfront\\.net/.*",
    "https://dhhim4ltzu1pj\\.cloudfront\\.net/.*",
  ]
```

Requests become `/.netlify/images?url=<upstream>&w=<width>&fm=webp&q=75`, cached
at the edge. Zero bytes stored, zero build cost, WebP and AVIF for free.

This does add the project's first vendor-specific dependency, and that should be
stated plainly rather than discovered later. It is acceptable on two grounds:
the failure mode is graceful — a `<picture>` whose `<source>` points at the
transform and whose `<img src>` points at the raw upstream URL degrades to
"correct but heavy" if Netlify is ever left behind, never to "broken" — and
`docs/PLAN.md` already rules that losing the art layer must cost a rendering
layer and nothing else. Images are the one part of Optfall that is allowed to
depend on somebody else.

**Three tiers, and deliberately not six.**

| Tier | Width | Where |
|---|---|---|
| `thumb` | 180 | grid cells, list rows |
| `normal` | 488 | card page primary face |
| `full` | upstream PNG | linked, never embedded |

**No art crop.** Scryfall's comes from first-party data. Ours would be a crop we
invented off a licensed face — a derivative work we have no grant to
manufacture, to save a rectangle nobody asked for.

**A `CardFace` primitive in `optfall-components`** carries the whole contract in
one place, so no surface can render an image and forget half of it:

- `srcset` across tiers, `loading="lazy"`, `decoding="async"`, and **explicit
  `width`/`height`** — a grid of 60 lazy images with no intrinsic size is a
  layout-shift generator.
- `alt` composed from *verbatim fields* — label plus type line — by the same rule
  `titleFor` already follows. Fixed labels around real values. Nothing composed.
- The **required copyright line**, structurally attached rather than left to the
  page. `docs/COMPLIANCE.md` requires it on card images; extend
  `scripts/check-disclaimer.ts` to fail the build on an `<img>` of a card face
  outside this component.
- The **drawn-primitive fallback** for the four printings with no `image_url`,
  and for any future null. "There is no published image" is a fact to render,
  not an error.
- `image_rotation_degrees` and `played_horizontally` honoured — some cards are
  printed sideways, and a grid that ignores that shows them wrong.

**One rule the index needs: which printing is a card's face.** A card averages
3.3 printings. The default must be deterministic and stated — *first printing in
upstream order* is the cheapest defensible rule, and pulling `set.json` (§5.3)
allows the better one, *earliest `initial_release_date`, ties broken by
collector number*. Pick one, write it down, and let `unique:prints` show the
rest.

### 5.2 The search surface Scryfall actually has

**The home screen is three things, in this order: the search field as the hero,
a short row of explainer links, and the results.** Nothing else above the fold,
and no fourth element earning its way in later.

**Search is submit-driven, not live.** The field does not re-rank on every
keystroke and the page is not a single-page app. You type, you submit, the
address becomes `/?q=…`, and the results render below the hero. This is how
Scryfall behaves, and it is the better model here for reasons beyond imitation:

- A grid of card faces re-flowing under a cursor on every keystroke is noise,
  and it makes the image layer fight the search layer for bandwidth.
- The URL is the product. A submit is the moment the query becomes a link worth
  pasting, and live filtering blurs the point at which that happens.
- It removes the pressure for the whole apparatus of live search — debounce,
  race handling, partial-query ranking, autocomplete — none of which the corpus
  needs and all of which is surface to keep correct.
- The no-JS path stops being a special case. The form submits to the same URL
  the island reads; the difference between scripting on and off narrows to who
  renders the list, not whether the page works.

Query execution still happens in the browser against the shipped index, because
there is no server and there will not be one. What changes is *when*: on submit
and on load from `?q=`, rather than on input.

- **Card search at `/`,** with the grid as the default result view.
- **Explainer links, not explainer paragraphs.** Today's home page carries two
  sections of body copy under the field. They become a compact row of links —
  syntax, the rules browser, bulk data, data terms, the plan — because a
  reference tool that explains itself before letting you search has misunderstood
  what it is, and that principle is already written into `index.astro`'s own
  header comment.
- **`display:grid` (default) / `list` / `text`**, in the URL. The existing dense
  row is not thrown away — it becomes `display:list`, and it is genuinely better
  than Scryfall's checklist.
- **`order:` and `dir:`** — name, set, released, rarity, pitch, cost, power,
  defence. Every one must be a *total* order so two browsers cannot disagree,
  which is the same discipline the current corpus-order tiebreak already keeps.
- **Paging**, replacing the 60-cap refusal. Page state in the URL like
  everything else.
- **`unique:cards|prints`**, once printings are addressable.
- **`/random`.**
- **`/sets` and `/sets/<code>`** — the browsable spine, typographic only, no set
  symbols (compliance: product set logos count as FAB logos).

**Dropped from this plan:** name autocomplete. It was on the list as
Scryfall parity, and a submit-driven field does not need it — it is live search
wearing a different hat, and the empty-state browse already covers "I do not
know what to type."

### 5.3 Second and third corpora — cheap, high yield

The upstream repository publishes more than `card.json`, and two files close
real gaps for the cost of a scheduled fetch:

- **`set.json`** — set names and `initial_release_date`. Unlocks `/sets`,
  `order:released`, `year:`/`date:`, and the default-printing rule. Today
  Optfall knows sets only as three-letter codes.
- **`rarity.json`, `edition.json`, `foiling.json`, `type.json`,
  `keyword.json`, `artist.json`** — the decode tables for the single letters the
  card page currently prints raw. `rarity: R`, `edition: N`, `foiling: S` are
  upstream's codes shown uncooked; Scryfall would say "Rare", "Unlimited",
  "Standard". This is a small change that makes the card page stop looking like a
  database dump.

Both go through `scripts/build-card-corpus.ts` with the same pinned-commit,
fail-on-unknown-field discipline the card corpus already has.

---

## 6. The rules join — measured, not hoped for

This is the user-facing half of "rules associations come along on the card
results", and the part that has to survive the no-language-model rule. It does,
and here is the measurement rather than the intention.

The Comprehensive Rules' Chapter 8 is *Keywords*. Its rules are not titled, but
the parsed text of every keyword-defining rule opens with the keyword name
repeated — `"Dominate Dominate is a static ability that means…"`. That yields a
**closed vocabulary of 101 keyword→rule-id pairs**, extracted deterministically
from a published document with one regex, no judgement and no model.

Against it, the card corpus carries 167 distinct keyword strings, which reduce to
**145 base forms** once numeric operands are stripped (`Ward 10` → `ward`,
`Arcane Barrier 2` → `arcane barrier`). Matching:

| Pass | Resolved |
|---|---|
| Exact match against the CR vocabulary | 71 |
| Parameterised family — `<Hero> Specialization`, `<Element> Fusion`, `<Element> Bond`, `Essence of <X>`, `Channel <X>` | 66 |
| **Total** | **137 of 145 — 94%** |

The eight that do not resolve are named rather than swept up: `attack reaction`,
`instant`, `stealth` and `pairs` are card *types* and belong to CR 8.1/8.2 rather
than 8.3; `the crowd boos` and `the crowd cheers` are real keywords absent from
the extracted vocabulary; `ice` and `and lightning` are upstream tokenisation
artifacts. All eight are a day of work, and until then they render as "no rule
found" — which is the honest output and exactly what "degrade visibly" asks for.

**What this buys, on three surfaces:**

- **On a card page**, each keyword becomes a citation to the rule that governs
  it. `Dominate` on the card, `cr:8.3.4` beside it, one click to the text.
- **On a rule page**, the reverse — the cards carrying that keyword. This is the
  join `docs/PLAN.md` calls "the join nothing currently makes", and it is the
  content that makes a rules corpus worth visiting.
- **In the query language**, `cr:8.3.4` finds every card the rule governs, and
  `cr:dominate` resolves the name to the same set. The operator stops being an
  apology and starts being the thing no other tool has.

**Publish the coverage number and the unmatched list**, as a page and in the bulk
export. A join that quietly drops 6% is the kind of confident partial answer this
project exists not to give.

**This moves from Phase 4 to Phase 2.** It is what makes a card page a reference
rather than a stat block, and the rules corpus is already parsed and on `main` —
there is nothing to wait for.

---

## 7. Extend the grammar

Today's parser produces a flat list of ANDed filters. Scryfall's produces an
expression. That is a real rewrite — an AST rather than an array — and it is the
largest engineering item here, so it goes last, after the surfaces that make the
tool usable.

- **Negation (`-`), `OR`, and parentheses.** The three most-missed operators, and
  they need the AST. Everything else on this list is additive.
- **Comparisons, honestly.** The current refusal is well argued — 4,941 printed
  costs include `X`, `XX`, `X1` and blanks, so there is no total order. But it is
  over-applied. `cost>=3` can mean *"cost is numeric and at least 3"*, with `X`
  and blank simply not matching and a notice saying so. Scryfall does exactly
  this for `*` power. A stated partial order beats a refusal.
- **`!"exact name"`** — the exact-name tier already exists in the ranker; this
  exposes it as an operator.
- **`artist:` and `flavor:`** — index what the corpus already carries.
- **`year:` / `date:`** — needs `set.json`.
- **`is:`** — reserved. It stays pending until the interaction corpus exists, and
  it should keep saying so.

Keep the two properties the current engine has and Scryfall does not advertise:
**every result reports which field put it there** (`matchedIn`), and **every
operator the engine cannot answer says so out loud** rather than silently
returning everything. Those are better than what we are copying. Do not lose
them in the rewrite.

---

## 8. Phasing

Ordered so each step ships something visible, and so the cheap reconciliation
happens before anyone builds against the wrong position.

| | Step | Cost | Ships |
|---|---|---|---|
| **A** | Reconcile `DESIGN.md` with `PLAN.md`; move the card↔rules join into Phase 2 | hours | The repo stops contradicting itself |
| **B** | `CardFace` primitive + Netlify Image CDN + copyright enforcement | ~2 days | Cards have faces |
| **C** | Card search at `/` as hero + explainer links + results; submit-driven, not live; `/cards` → 301; grid default; `display:`/`order:`/paging | ~3 days | The front door is right |
| **D** | The keyword↔CR join, both directions, with published coverage | ~2 days | The thing nobody else has |
| **E** | `set.json` + decode tables; `/sets`; printing-level URLs; `unique:` | ~3 days | The corpus gets a spine |
| **F** | Grammar: AST, negation/`OR`/parens, comparisons, `artist:`/`flavor:` | ~1 week | Search becomes a language |
| **G** | `/random`, shared `SearchField`/`ResultRow`/`ResultGrid` primitives | ~2 days | The polish that reads as finished |

A through D is the version worth showing anyone. E through G is what makes it
the reference.

---

## 9. Still out of scope, and why

- **Prices, collector economy, colour identity, EDHREC-style popularity.** The
  first is the most contested territory in the game (`docs/PLAN.md`); the last
  two have no Flesh and Blood analogue.
- **A tagger.** Scryfall's art and oracle tags are a community-curation
  programme with a moderation burden. "Sync, never curate" rules it out until
  there is a community asking for it.
- **Art crops.** §5.1 — a derivative we have no grant to manufacture.
- **The interaction record.** Unchanged: Phase 5, gated on judges rather than on
  code.
- **Anything that composes prose.** Unchanged, and load-bearing. Every addition
  above is a lookup, a filter, a join over published documents, or an image
  served from its publisher's own CDN. The `alt` text is fixed labels around
  verbatim fields; the keyword join is closed-vocabulary matching with a
  published miss list. Nothing here needs a model, and the plan is better for it.

---

## 10. The one-sentence version

Make the homepage a card search hero over explainer links over results, give
every card its face through an edge-transformed image tier, let the keyword→rule
join carry the Comprehensive Rules onto the card page and the cards back onto the
rule page — and reconcile `DESIGN.md` with the position `PLAN.md` already
settled, before anything else is built against the old one.
