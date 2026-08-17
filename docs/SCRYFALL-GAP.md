# Optfall against Scryfall — the gap, and the plan to close it

**Card search is the product. Rules ride along on the result. Cards have faces.**

This document is a comparative analysis of Optfall as it stands on `main` against
Scryfall, and a remove/update/extend plan to close the distance. It exists
because the repository currently contradicts itself: `docs/PLAN.md` was rewritten
on 2026-08-11 to make the card layer the product, and `docs/DESIGN.md` was not.
Every symptom below traces back to that one unreconciled edit.

---

## 1. The confusion, named

Three concrete contradictions, all cheap to fix and all shaping the build when
this document was written. They are ticked here as they close, the same way the
phase table below does it — a diagnosis nobody re-reads is how a fixed problem
goes on being described as live.

**The front door serves the wrong thing.** ✅ Fixed — §6b, phase row D. As
diagnosed: `/` was a *rules* search box, and card search lived at `/cards`,
reachable from one sentence of body copy eleven rows below the fold. Scryfall's
homepage is the card search; ours buried it behind the surface the plan calls
"supporting cast" — except the plan no longer says that. `/` is now the card
search door (`apps/site/ssg/pages/home.page.tsx`, shipping no JavaScript at
all), and `RulesSearch` mounts on `/cr`. The Astro page named here,
`apps/site/src/pages/index.astro`, no longer exists —
[#107](https://github.com/alxjrvs/optfall/pull/107) deleted it.

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
   addresses every art of a card at its own URL.
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

*Audited against the code on 2026-08-14. Ten rows moved that day — most of this
table had been written before the search grammar, the set pages, `/random`, the
typeahead and the card faces landed, and a stale capability table is worse than
no table: it is a list of things we believe about ourselves. Re-audit it when a
row's subject changes, not when someone notices.*

| Capability | Scryfall | Optfall today | |
|---|---|---|---|
| Card search on the homepage | yes | a plain field on `/` that submits to `/search` | **have** |
| Card images | six variants | two tiers, rendered | **narrowed** |
| Image grid results | default view | grid is the default | **have** |
| Display modes | `display:grid/checklist/text/full` | `display:grid/list/text`, a query term | **have** |
| Sort control | `order:` × 15, `dir:` | `order:` × 9, `dir:`, documented | **have** |
| Printing-level URLs | `/card/<set>/<num>/<name>` | `/card/<set>/<num>/<name>`, 11,378 of them — every distinct art, the default included | **have** |
| Duplicate collapsing | `unique:cards/prints/art` | `unique:names` (default), `cards`, `art` | **have** |
| Negation, `OR`, parentheses | yes | all three, documented at `/syntax` | **have** |
| Numeric comparison | `cmc>=3`, `pow>tou` | cost/power/defence, against a number **or against each other** | **have** |
| Exact name | `!"Lightning Bolt"` | `!"Head Jab"`, quoted or bare | **have** |
| Artist / flavour search | `a:`, `ft:` | `artist:`/`a:`, `flavour:`/`ft:`, separately indexed | **have** |
| Set index and set pages | `/sets` | `/sets`, and a page per set carrying the same card index the results do — with that set's printings | **have** |
| Paging | yes | `?page=`, on search results and set pages alike | **have** |
| Rulings on the card | official rulings, dated | none | **gap** |
| Random card | `/random` | `/random` | **have** |
| Name autocomplete | yes | nothing — §6b removed it | **gap, on purpose** |
| `/` focuses search | yes | yes | **have** |
| Related cards | tokens, meld, combo | `references` / `referencedBy` | **have, better** |
| Legality table | ~12 formats, one state each | 6 formats, **multi-state, with the upstream evidence printed** | **have, better** |
| Every view is a URL | yes | yes | **have** |
| Bulk export | yes | rules + cards, committed | **have** |
| Colour identity, EDHREC, tagger | yes | — | **not applicable** |
| Prices | yes, from a partner feed | — | **out of scope, on purpose** |
| Buy links | per printing, foil/nonfoil split | per printing, **foiling and all** | **have, better** |

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
  pasted `/search?q=…` link keeps working. Query strings survive a 301.
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
  **Done.** Both search surfaces page, through the `pagination` primitive and
  `apps/site/src/lib/pagination.ts`. The shape it took, and the two decisions
  worth arguing with later:
  - **The page is in the URL** — `?page=` and `?per=`, read and written exactly
    as `?q=` is, so page 4 of a search is an address. Every control in the pager
    is a real `<a href>` for the same reason. Defaults are omitted rather than
    written, so one answer has one canonical link.
  - **`per=all` is on the menu, and it removes the cap rather than raising it.**
    It resolves to an infinite limit, so a reader who asks for every row gets
    every row — 6,847 of them on `type:action unique:art`. Deliberate: a deck
    builder collecting names four pages at a time has been answered a different
    question. It is the last step offered because it is the expensive one.
  - What did **not** change is the count. `total` still reports matches rather
    than rows on screen, which was the one honest thing about the old
    behaviour.
  - **The set pages page through the same control**, which they could not do at
    all before: `/sets/<code>` was an unpaginated column of names. That they now
    share a pager with `/search` is a consequence of sharing a `CardIndex`, not
    a second implementation of one.
- **`PENDING_OPERATORS` entries `artist` and `flavor`/`flavour`.** The data is in
  the corpus. They are pending only because nothing indexed them.
- **The `cr:` "that lives at /search, not here" entry.** Section 8 makes it
  answerable.
- **One of the two search islands.** ✅ Done, and by the route this entry
  proposed. As written: `RulesSearch.svelte` (593 lines) and `CardSearch.svelte`
  (551) were near-duplicates, and both carried a comment naming the same two
  missing primitives — `SearchField` and `ResultRow` — so extracting those into
  `optfall-components` would take the duplication with them. Both primitives now
  exist there, both are in `PRIMITIVES`, both are axe-covered and both have a
  design-system card. The islands are `apps/site/ssg/islands/RulesSearch.tsx`
  (367 lines) and `CardSearch.tsx` (492), and each imports the shared primitives
  rather than restating them. The `.svelte` files named here were deleted by
  [#107](https://github.com/alxjrvs/optfall/pull/107).

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
   60-card grid is a 40 MB page. Unusable as the default view. It also leaves
   the product's most visible layer at the mercy of four hosts we do not
   control, any of which can add a referer check on a Tuesday.
2. **Commit resized images to the repo.** Even at WebP thumb + normal this is
   hundreds of megabytes of binary in git history, permanently. No.
3. **Our own asset host, bytes in object storage, sourced from upstream once.** ✅

**Take option 3, built as a second Netlify site inside this monorepo.** This is
a pattern that already exists and is in production next door:
`SU-SRD/apps/su-assets` serves `assets.salvageunion.io` from a Netlify Blobs
store, and its own header states the rule — **"the bytes live only in Blobs
(never in git)."** One Functions v2 handler bound to `path: '/*'`, an immutable
cache header so the edge answers and the function runs only on a miss, a
path-traversal guard and an extension allowlist. Optfall's copy differs in what
it stores and how keys are shaped, and in nothing else.

```
apps/images/                       →  a second Netlify site, same workspace
  netlify.toml                        publish = apps/images/public
  netlify/functions/face.ts           config.path = '/*'; reads the Blobs store
  public/                             the NO IMAGE placeholders, static
```

**Why a whole second site rather than a route on the main one.** The main site's
`netlify.toml` opens with a promise — *"static output only — no functions, no
edge handlers, no runtime"* — and that promise is load-bearing: it is the
"no uptime story to fail" the Stack section is built on. Serving images needs a
function. Putting that function on the main site would trade the guarantee for
the whole product; putting it on its own deploy confines the runtime to the one
layer `docs/PLAN.md` already designates as expendable: *"Losing images costs a
rendering layer, never the product."* The main site stays a pile of static
files, and if the image host is down, cards render as NO IMAGE and every fact on
every page is still correct.

**We are now a redistributor, and that is inside the grant but worth naming.**
LSS's policy permits **card face images specifically for building card
databases**, conditioned on the copyright line — `docs/COMPLIANCE.md` §5. Serving
them ourselves is the granted use rather than a stretch of it, but it moves us
from "pointing at LSS's bytes" to "serving copies of them", so the copyright
line stops being good manners and becomes the condition the permission rests on.
It is therefore enforced at *both* ends: structurally inside `CardFace`, and by
the ingest tool refusing to run without the rights envelope stamped in the
manifest.

**Two tiers, not six, and the widths are dictated by the sources.** Upstream
faces are not uniform — measured: `546×762` PNG from fabmaster, `450×628` PNG
from one CloudFront distribution, WebP of varying size from S3. The largest
width every source can satisfy **without upscaling** is 450, so that is the
ceiling. Inventing pixels to reach a rounder number would be the tool asserting
detail it does not have.

| Tier | Size | Where |
|---|---|---|
| `thumb` | 180 × 251 | grid cells, list rows |
| `normal` | 450 × 628 | card page primary face |
| `source` | upstream URL | linked from the printing, never embedded |

Both tiers are WebP. A 546×762 PNG at 695 KB becomes roughly 55 KB at `normal`
and 8 KB at `thumb` — the difference between a 40 MB grid and a 500 KB one.

**No art crop.** Scryfall's comes from first-party data. Ours would be a crop we
invented off a licensed face — a derivative work we have no grant to
manufacture, to save a rectangle nobody asked for.

### 5.1a The blob key, and why it is not the printing id

This is the detail that decides whether multiple printings work, and the obvious
answer is wrong.

`printing.id` is the collector number — `MST131` — and `cards.ts` calls it "the
citable identity of a printing". It is **not unique**: measured, 4,780 of them
appear on more than one printing row. The reason is visible in the data —
`MST131` occurs twice with the same edition and different foiling (`S` standard,
`R` rainbow), and **both point at the same image**. Foiling variants are distinct
printings that share a face.

`printing.unique_id` *is* unique, but keying on it would store 16,502 blobs where
only 11,377 distinct images exist — 45% of the store paying for bytes it already
has, and an opaque nanoid in every URL.

**Key on the source image's basename**, which is exactly the granularity upstream
publishes the art at:

```
thumb/MST131.webp        normal/MST131.webp
```

Measured across the 11,377 distinct URLs: **11,376 distinct basenames** — one
collision, `LGS387.webp`, served from two hosts under the same name. So the rule
is *basename, with a build-time assertion that it is unique*, and a deterministic
suffix for a genuine clash. The assertion is the point: it is the same discipline
`cards.ts` already applies to slug collisions, and for the same reason — a silent
key collision would serve one card's art under another card's name, which is a
wrong answer rather than a missing one.

A printing therefore resolves to a face by a pure function of its `image_url`,
and the 5,056 printings that share art with a sibling share a blob rather than
duplicating one.

### 5.1b NO IMAGE — a real asset, not a missing one

Four printings carry no `image_url`, upstream will add more, and the image host
can be down. All three states need the same thing: **an image of the correct
shape**, so a grid does not reflow and a card page does not collapse.

FaB cards are standard TCG stock, and every source measured lands on the same
ratio — 546/762 and 450/628 are both 63:88 (0.7159). So the placeholder is
generated at exactly the tier dimensions, ships **statically in
`apps/images/public/`** rather than from Blobs (it must resolve even when the
store does not), and is drawn from the design system: bevelled plate ground, the
mark, and NO IMAGE in the wide-tracked mono label voice.

Two orientations, because 15 cards are `played_horizontally` and 10 printings
carry a non-zero `image_rotation_degrees` — a portrait placeholder under a
landscape card is a bug visible at a glance.

**The function serves it, rather than 404ing.** A miss returns the placeholder
with `200` and a *short* cache lifetime, where a hit returns the face immutable
for a year. That way a card whose art lands next week starts showing it without a
purge, and a broken image icon never appears in a grid.

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

### 5.1c Multiple printings, as a first-class thing

A card averages 3.3 printings and the corpus carries 16,502 of them. Today the
card page renders them as a table of codes and the search index ignores them
entirely. Scryfall treats the printing as the addressable unit; so should we.

**The default face must be deterministic and stated.** Search results and a card
page's initial state each need one printing chosen out of several, and "whichever
came first in the JSON" is a rule that silently changes when upstream reorders.
The rule: **earliest `initial_release_date` from `set.json` (§5.3), ties broken
by collector number, then by `unique_id`** — total, so it cannot depend on
iteration order. Until `set.json` lands, first-in-upstream-order, written down as
a stopgap rather than left implicit.

**Three things follow, and they are the printings feature:**

- **The printings table on the card page.** Every printing in a row, with set,
  collector number, rarity, edition, foiling, artist and other face. The number
  is a link to the art that printing is published with. *(This was specified as
  a rail of thumbnails, and shipped as one: "the one interactive element the
  card page gets". The rail was retired — the table already named more per row
  than a tile could caption, and the card page now gets no interactive element
  at all.)*
- **Per-printing URLs** — `/card/<set>/<number>/<slug>`, resolving to the card
  page with that printing selected. This is Scryfall's canonical form and the
  thing that makes "the alternate art one" linkable.

  **Shipped in two steps, and the first one got the segment order wrong.** The
  original build emitted `/card/<slug>/<set>/<number>` and only for the 6,437
  NON-default arts, keeping `/card/<slug>` as the card's own page. That is not
  what this paragraph asked for and the table above said so for months: the
  printing was addressable, but the CARD was still the addressable unit, and the
  name led the path.

  It is now `/card/<set>/<number>/<slug>` for all 11,378 distinct arts, and
  there is no card-level URL at all — `/card/<slug>` and `/card/<name>` are
  301s. Three things fall out of the order that did not out of the old one:

  - **The identity is printed on the card.** A reader holding MST131 can type
    its URL. Nothing about a slug is legible off a physical object.
  - **A rename moves the tail, not the path.** Under the old form the slug led,
    so an upstream name correction — or a new pitch version forcing a
    disambiguation suffix — broke every printing URL beneath it.
  - **It is upstream's identifier, not ours.** Set code and collector number
    come from Legend Story Studios; the slug is a thing this project invented.

  **The name tail is not decoration, and the corpus proves it.** `ros/257-v2`
  and `ros/257-v2-back` are each claimed by two different cards — Runechant and
  the Embodiments share one physical double-sided token and therefore one art —
  so Scryfall's bare `/card/<set>/<num>` form would be ambiguous here. The slug
  is what tells those four addresses apart, which is also why the bare form is
  not offered as a convenience redirect.

  **A non-default art canonicals to the card's default printing**, which is
  where this deliberately does NOT follow Scryfall. Scryfall lets every printing
  self-canonical and indexes all of them; 11,378 pages differing only in one
  image would bury the 4,941 that stand for a card. The address is a printing;
  the indexed unit is still the card.
- **`unique:cards` (default) and `unique:prints`** in search — collapse to one
  row per card, or show every printing as its own result.

**Artist becomes searchable here, not later.** `artist:` was listed as pending
because nothing indexed it; artists live on the *printing*, so the same pass that
makes printings first-class is the pass that indexes them.

### 5.2 The search surface Scryfall actually has

**The home screen is three things, in this order: the search field as the hero,
a short row of explainer links, and the results.** Nothing else above the fold,
and no fourth element earning its way in later.

**Search is submit-driven, not live.** The RESULTS do not re-rank on every
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
  what it is. That principle was written into `index.astro`'s own header
  comment; that file went with
  [#107](https://github.com/alxjrvs/optfall/pull/107), and the principle now
  lives in `apps/site/ssg/pages/home.page.tsx`, whose header argues the door's
  job is to be the way in to the search page rather than a surface in its own
  right.
- **`display:grid` (default) / `list` / `text`**, in the URL. The existing dense
  row is not thrown away — it becomes `display:list`, and it is genuinely better
  than Scryfall's checklist.
- **`order:` and `dir:`** — name, set, released, rarity, pitch, cost, power,
  defence. Every one must be a *total* order so two browsers cannot disagree,
  which is the same discipline the current corpus-order tiebreak already keeps.
- **Paging**, replacing the 60-cap refusal. Page state in the URL like
  everything else. ✅ Built: `?page=`, on both the search results and the set
  pages, through one component.
- **`unique:cards|prints`**, once printings are addressable.
- **`/random`.**
- **`/sets` and `/sets/<code>`** — the browsable spine, typographic only, no set
  symbols (compliance: product set logos count as FAB logos).

  **"Typographic only" turned out to be one word too broad.** It was written to
  keep set LOGOS off the page, which is a compliance rule and still holds — and
  it was read as keeping CARD FACES off too, which nothing required. So the one
  page whose subject is a print run was the one page with no pictures on it,
  while `/search?q=set:MST` answered the same question in a grid of art. A set
  page now renders the same `CardIndex` the search results do. No set symbol
  appears anywhere on it.

**Dropped from this plan, then built anyway:** name autocomplete. The argument
here was that it is live search wearing a different hat, and the empty-state
browse already covers "I do not know what to type."

`CardTypeahead` shipped on the front door regardless, and the distinction that
made it defensible is one this paragraph did not draw: **every suggestion is a
destination, not a result.** It completed a NAME and took you to that card's
page; it did not re-rank results as you type, so the objection above — that
autocomplete smuggles live search in — did not apply to what was built.

**§6b then removed it, and the original argument was the better one after all.**
Not because it smuggled in live search, but because of what it made the door
*for*: a box that jumps straight to a card turns the entrance into a
disambiguator, when its job is to be the way in to the search page. It also cost
every visitor the name index before they had typed anything, on a page that now
ships no JavaScript at all. Name autocomplete is a real gap in the capability
table above, marked as one, and deliberate. The
capability table in §3 records it as shipped.

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

## 6b. The front door, specified against the thing it copies ✅

The door was ported through Phase 6 unchanged and then measured against
Scryfall's, and the gap is structural rather than cosmetic. Scryfall's homepage
is one sentence, one box, one row of destinations, a short list of what is new,
and a hand of cards along the bottom edge. Ours is a wordmark, a typeahead, a
column of links and a small row of cards floating in the middle of a lot of
nothing.

**The sentence.** `Optfall is a powerful Flesh and Blood card search`, set large,
with the product name and the game name carrying the weight. It replaces the
bare wordmark: a masthead says where you are, a sentence says what the thing
does, and the door is the one page where a visitor may not know.

**The box searches; it does not autocomplete.** The typeahead goes. It was a
live suggestion list that jumped straight to a card, which is a good feature and
the wrong one here — it makes the door a disambiguator when its job is to be the
entrance to the search page. A plain field that submits to `/search` is what
Scryfall has and what this needs. The typeahead's index build and island come
out with it; `/search` keeps its own submit-driven engine, unchanged.

**One row of destinations, not a column of links.** Bordered pills rather than a
stacked list: Advanced Search, Syntax, All Sets, Random. Same targets, one line,
scannable.

**A `NEW` list under them, and it is generated rather than typed.** Scryfall's
row of `NEW` badges links to searches for the sets that just came out. Ours can
be derived, which theirs cannot be: `SETS_BY_RELEASE` already sorts every set by
`initial_release_date`, and `order:released` and `year:` now exist to link to. So
the door lists the most recent sets with a `NEW` badge and links each to
`/search?q=set:<code> order:released`. No hand-curated feed, nothing to go stale
— "sync, never curate" applied to the one surface most tools hand-edit weekly.

**The fan is the floor of the first screen.** It sits at the base of the initial
viewport, cards large enough to read, overlapping — the bottom edge of the fold
rather than an ornament in the middle of it. Everything else on the page lives
below the fold, which is where the corpus counts, the provenance and the footer
go.

**The background stops being flat.** A single dead near-black is what makes the
current door read as unfinished. Scryfall's is a deep gradient; ours should be
the same idea in this palette, and it belongs in the token layer rather than in
the page, because a ground is a design-system value and `check-tokens.ts` will
refuse it anywhere else.

**And one link that is not about cards.** Scryfall carries "Help Good Law
Project fight for Trans Rights in the UK" on its homepage. Optfall will carry a
link of the same kind, in the same place, at the same weight. It is not
decoration and it is not a feature — a reference tool that a community relies on
has a front page, and what a front page points at is a statement about who it is
for.

✅ **Shipped**, and two things in it were only found by looking at the page.

The `NEW` list first advertised "Armory Deck - Olympia" and "Dorinthea Demo
Deck" as the newest things in Flesh and Blood, because they are dated latest.
Sorting by date is not the same question as "what just came out": the fourteen
most recent dated sets are either expansions — 272, 482, 681 printings — or
decks and armory products at 16 to 55, with nothing in between, so the list
filters on size and the threshold is measured rather than chosen.

And the fan stayed small through two attempts. The card size has to be declared
on `.of-fan__row`, because that is the element `CardFan.css` sets it on and an
inherited value loses to a declaration on the element itself — set on the
ancestor it did nothing at all, silently. The page also had to become `width:
"wide"`: six readable cards overlap to about 855px against a 736px measure, so
the last one was clipped by the window's own edge, which is the same defect §6a
records for the card page arriving from the other direction.

*It touched the door's markup, its stylesheet and the fan's sizing, and deleted
the typeahead island. It did not touch the card layer, the query engine or the
rules join.*

---

## 6a. The redesign — streamline, with Scryfall as north star

Images change the interface's job. A page that was a stack of tables is now a
page with a picture on it, and the chrome that made the tables legible is in the
way. This is the simplification pass, and most of it is **subtraction**.

**The card page becomes two columns.** Face and printings rail on the left,
sticky; identity, printed text and legality on the right. Everything that
answers "what is this card" lands above the fold, and the apparatus — printings
table, flavour, related, source — goes below it. Today the face-shaped hole is
filled by eight stacked sections and you scroll past three of them to reach the
legality verdict, which is the best thing on the page.

> **This shipped as markup and never once rendered.** Recorded here rather than
> quietly fixed, because the failure is more instructive than the fix and the
> row in the phase table below said ✅ for months while the page looked exactly
> the way the paragraph above complains about.
>
> `CardEntry.astro` grew a real two-column flex container, and `BaseLayout`
> capped `main` at `type.measure` on every page in the site. The face is
> `card.face.normal` and the facts column asked for a face-width basis beside
> it, so the flex line's hypothetical width was two faces and a gutter inside a
> container narrower than the two faces alone. Flex wraps on hypothetical width,
> before shrinking is considered — so it wrapped at every viewport, always, and
> what shipped was the eight stacked sections in a narrower column than before.
>
> Nobody caught it because every artefact agreed the work was done: the markup
> had two columns, the CSS had two columns, the comments explained the two
> columns at length, and the checks that gate this repo — typecheck, lint,
> tokens, tests — cannot see a layout. **A visual change needs a visual check.**
> The fix was one declaration in the layout; finding it took looking at the page.

~~**Stop spending filigree eight times a screen.**~~ **Withdrawn — the claim was
false.** This section asserted that `CardEntry.astro` violates the three-role
filigree ration eight times, once per `OrnamentalRule`. Checked before acting on
it: `OrnamentalRule` takes `ornament` and it **defaults to `false`**, and every
usage on the card page passes only `label`. They are plain labelled hairlines
spending no scrollwork at all — which is precisely the "hairline rules rather
than cards, shadows and padding" idiom this document praises two rows above.

The error is left visible rather than deleted, because it is the more useful
artefact: it was written by reading a component's *call sites* and inferring its
behaviour from its name, and the fix cost one `grep` that should have come first.
The card page's four rules are correct as they stand.

**Legality moves up and its evidence folds away.** Six formats × six keys is 36
rows of `cc_banned_start: —` rendered inline, above the printings. The evidence
is the auditability promise and it stays — but behind a `<details>` per format,
open on demand. The verdict pills stay always-visible, because they are the
answer.

**The stat block becomes the card's own furniture.** `docs/DESIGN.md` describes
it exactly — jewel top-left, cost in a hexagonal plate, power and defence in
chamfered plates — and the page renders a `<dl>` instead. With a real face
beside it, the stat strip should be compact and card-like rather than a
definition list restating what the image already shows.

**Search results lose the per-row explanation.** Every row currently carries a
`.why` badge naming the field that matched. It is honest and it is right for a
text list; on a grid of 60 faces it is 60 pieces of chrome explaining something
the reader did not ask. It moves to the row's `title`/detail affordance and stays
visible only in `display:list`, where it earns its place.

**One search chrome, not two.** `SearchField` and `ResultRow`/`ResultGrid` become
primitives, and 1,144 lines of near-duplicate island collapse into one. Both
files already carry a comment asking for exactly this.

**What does not change.** The token layer, the pitch jewel's three-channel
contract, the notched state pill, and the rule that a component may not name a
colour. The redesign is composition and subtraction — no new CSS in a page, per
*Compose, never restyle*.

---

## 7. Extend the grammar

Today's parser produces a flat list of ANDed filters. Scryfall's produces an
expression. That is a real rewrite — an AST rather than an array — and it is the
largest engineering item here, so it goes last, after the surfaces that make the
tool usable.

- **Negation (`-`), `OR`, and parentheses.** ✅ The three most-missed operators,
  and they need the AST. Everything else on this list is additive.
- **Comparisons, honestly.** ✅ The old refusal was well argued — 4,941 printed
  costs include `X`, `XX`, `X1` and blanks, so there is no total order. But it is
  over-applied. `cost>=3` can mean *"cost is numeric and at least 3"*, with `X`
  and blank simply not matching and a notice saying so. Scryfall does exactly
  this for `*` power. A stated partial order beats a refusal.
- **`!"exact name"`** — ✅ the exact-name tier already existed in the ranker;
  this exposed it as an operator. It matches the BARE name rather than the
  disambiguated label, so `!"Head Jab"` finds the card rather than nothing.
- **`artist:` and `flavor:`** — ✅ indexed, `flavour:`/`flavor:`/`ft:`. Flavour
  is a second postings index rather than a branch of the text one, because a
  card whose flavour mentions blood does not DO anything of the sort.
- **`year:` / `date:`** — needs `set.json`. ✅ Both, with comparisons. A card
  matches if ANY of its printings does, because the corpus collapses a card
  across its sets and "released in 2024" can only mean "printed in 2024 at least
  once". Seventeen of the 118 sets carry no upstream date, so 53 cards match no
  date filter that can ever be written — and the search says so rather than
  returning a plausible short list.
- **`is:`** — reserved. It stays pending until the interaction corpus exists, and
  it should keep saying so. It still does.

Keep the two properties the current engine has and Scryfall does not advertise:
**every result reports which field put it there** (`matchedIn`), and **every
operator the engine cannot answer says so out loud** rather than silently
returning everything. Those are better than what we are copying. Do not lose
them in the rewrite.

---

## 8. Phasing

Ordered so each step ships something visible, and so the infrastructure that
everything else renders against exists before anything tries to render.

| | Step | Cost | Ships |
|---|---|---|---|
| **A** ✅ | `apps/images` — the assets site: Blobs-backed face handler, NO IMAGE placeholders, deployed | done | A host to put faces on |
| **B** ✅ | Ingest — download, transcode to two WebP tiers, upload to Blobs; image manifest in the corpus build | ~1 day | 11,377 faces, addressable |
| **C** ✅ | `CardFace` primitive; card page face, printings rail, per-printing URLs | ~2 days | Cards have faces |
| **D** ✅ | Card search at `/` — hero, explainer links, results; submit-driven; grid default; `display:`/`order:`/paging; `/cards` → 301 | ~3 days | The front door is right |
| **E** ✅ | The redesign pass (§6a) — filigree back to one, evidence folded, one search chrome. **The two-column card page in this row was not true when it was ticked**; see the note in §6a | ~2 days | It reads as finished |
| **F** ✅ | The keyword↔CR join, both directions, with published coverage | ~2 days | The thing nobody else has |
| **G** ✅ | `set.json` + decode tables; `/sets`; `unique:`; `order:released` | ~2 days | The corpus gets a spine |
| **H** ✅ | Grammar: AST, negation/`OR`/parens, comparisons, `flavor:` | ~1 week | Search becomes a language |

Reconciling `DESIGN.md` with `PLAN.md` folded into **E**, as planned: the
redesign is where those positions became code.

**Every row has shipped.** One item planned for E landed in G instead —
extracting `SearchField`/`ResultRow` into primitives, a refactor of two working
components rather than a change anyone can see.

**F, G and H were ticked late, and the gap between the table and the code is
worth recording.** All three were finished across Phases 2–6 and this document
went on describing them as outstanding: the join shipped with its coverage
published on `/search` (94%, 137 of 145 keywords, with the 8 it cannot resolve
named rather than hidden), the grammar became a real AST with negation, `OR`,
parentheses and comparisons, and `artist:`, `ft:` and `!"exact name"` all
answer. Only three items were genuinely missing when this was audited —
`order:released`, `year:` and `date:` — and they are in now.

The lesson is the same one the Phase 6 work kept relearning: **a checklist
nobody re-measures drifts in whichever direction is least visible.** Here it
drifted toward understating what was built, which is the harmless direction and
still cost an audit to discover. `card-search.ts`'s own `PENDING_OPERATORS`
table had drifted the same way and has been corrected — it listed `artist`,
`flavor` and `flavour` as unbuilt for as long as they were built.

**What is deliberately still open is `is:`**, and it is not schedulable: it
filters judge-verified rulings, which need the interaction corpus from
`docs/PLAN.md` Phase 5, which is gated on judges rather than on code. The engine
says exactly that when anybody types it.

**One thing E gained that was not planned**: pitch versions became one tabbed
card rather than three pages plus a disambiguation index. That is a model change
rather than a visual one — a player calls the red, yellow and blue versions one
card — and it forced the search to collapse them, which in turn forced the
result row to name *which* versions matched, because four cards in this corpus
are banned at one pitch and legal at another.

---

## 9. Still out of scope, and why

- **Prices and the collector economy.** The most contested territory in the game
  (`docs/PLAN.md`), and the one addition here that would need a refresh cadence
  — which is the thing a corpus pinned by commit cannot give it. A stale price
  is the confidently-wrong answer this project claims it cannot produce.
  **Purchase links are not this**, and shipped separately: a link says "this
  printing is purchasable, here", which does not rot between syncs. See
  `apps/site/src/lib/tcgplayer.ts`.
- **Colour identity, EDHREC-style popularity.** No Flesh and Blood analogue.
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

Stand up our own image host as a second Netlify site with the bytes in Blobs and
never in git, give every printing a face and every card a printings rail, make
the homepage a card search hero over explainer links over results, let the
keyword→rule join carry the Comprehensive Rules onto the card page and the cards
back onto the rule page — and subtract enough chrome that what is left reads as
the reference it claims to be.
