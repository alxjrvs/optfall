# Optfall — design pass

Scryfall's ethos — a reference work that respects your time — forged in the
language of Rathe: black, blood and brass.

> Published version with rendered mockups:
> <https://claude.ai/code/artifact/7cb29b44-9250-48bb-a733-e9f4c8a5eb64>

---

## What we take, and what changes

Copying Scryfall's look would produce a Magic site with different words in it.
The transferable thing is its *ethos*: it behaves like a well-made reference book
rather than a product with a marketing department. Each principle survives the
move; each expression of it does not.

| The principle we keep | How it changes for Flesh and Blood |
|---|---|
| **The search field is the hero.** No marketing hero, no illustration above the fold. The first thing on the page is the thing you came to do. | **The grammar is inherited, not invented.** LSS's own Card Vault already has a syntax. We adopt it verbatim and extend it to rules and interactions, so a query someone already knows keeps working. |
| **Density without clutter.** Enormous information per screen, held together by tight vertical rhythm and hairline rules rather than cards, shadows and padding. | **Same discipline, forged rather than printed.** Square corners, bevelled plates, angular notches on anything carrying state. The chrome should feel struck from metal, not laid out in a design tool. |
| **Colour must mean something.** Scryfall's chrome is neutral; colour is reserved for the colour pie, rarity and legality. It is data, never decoration. | **Pitch is data, blood red is chrome.** They can share a hue because they never share a shape. Pitch appears only as a cut jewel; the interface never uses that form for anything else. |
| **Typography carries hierarchy.** Weight, size and rhythm do the work that boxes, gradients and accent bars do on lesser sites. | **Two voices, strictly assigned.** A serif for names and questions, a sans for everything else. ~~a wide-tracked mono for labels and anything citable~~ — see below. |
| **Every view is a URL.** Scryfall's real product is the link you paste into a conversation to settle it. | **The unit is the card**, and the rules and rulings attach to it. Card pages are the shareable object; `/cr/…` sections are addressable too and a card links into them. ~~The unit is the verdict, not the card.~~ — see below. |
| **Dark mode is not an inversion.** It is designed, and for many users it is the only mode they will ever see. | **Black is the native key.** Near-black ground, blood accent, brass for anything authoritative. Light mode is the printed-rulebook translation — ash and iron, not paper white. |

---

## The mark

A cut jewel, cleaved and falling — the crown separating from the pavilion. It is
the pitch diamond, the same reserved silhouette as the gem, which means **the
logo and the core interface primitive are the same object**: the thing you see a
thousand times a session is the thing on the tab. The pavilion keeps the girdle
and the bottom apex, so the half that falls is the half still recognisable as
the jewel.

Two solids and a hairline, so it survives a favicon. The gap between crown and
pavilion is the whole idea and it is the last thing to disappear at small sizes.

**One compliance constraint shaped this.** LSS's policy does not merely prohibit
using their logos in third-party applications — it prohibits creating any *close
semblance* to them. So the mark takes the register (angular, chiselled, struck
from metal) and nothing of the form. Working from the game's own furniture rather
than its branding turned out to be the better idea anyway: a jewel is a mechanic,
and a mechanic cannot be confused with a trademark.

---

## The system

Boldness is spent in two places — the pitch jewel and the blood accent — and
everything around them stays quiet.

### Black, ash and iron

Neutrals with no colour cast at all — the grey of unpolished steel. Every surface
is bevelled with a light top edge and a dark bottom one, so panels read as struck
plate rather than as flat rectangles.

### The pitch jewel

A **diamond**: vertex up, vertex down, widest across the middle, with all four
corners cut — eight sides, and a facet highlight, carrying its numeral. Shape,
number and colour state the same fact three times, and the silhouette is
reserved: nothing else in the interface is ever this shape.

**The orientation is part of the specification, not a drawing detail.** This
section used to say only "an eight-sided cut stone", which is equally true of an
edge-up chamfered square — and so, for a while, the component drew one of those
while the design-system cards drew the diamond, and the logo followed the
component. Nothing failed, because nothing disagreed with the words. An edge-up
octagon reads as a *button*; a vertex-up one reads as a *gem*. The exact
polygon lives in `JEWEL_SILHOUETTE` in `optfall-components`. The design-system
generator reads it directly; the jewel component keeps a copy, because a Svelte
`<style>` block cannot interpolate a constant and putting it on an inline style
would ship the polygon on every jewel on every card page. A test asserts the two
agree — so what binds them is a check, not a shared read, and that distinction
is the point: an unchecked copy is how this drifted in the first place.

The numeral is the **primary** channel, not an accessibility fallback. Red and
yellow are the classic deuteranopia confusion pair, pitch is the most-read value
on a card, and it is the same pair the leading commercial scanner app misreads.
Designing colour as the redundant channel costs nothing and fixes it for everyone
downstream.

### Blood and brass

Red is the game's own accent, and refusing it made an earlier pass read like a
museum catalogue. Brass is reserved for authority — the verified seal and nothing
else. A material used once is a signal; used twice it is a theme.

### State

Notched corners mark anything carrying state: `Legal`, `Banned`, `Unverified`,
`Not in format`. The clipped corner is the only ornament in the system and it
always means something.

### Filigree, rationed

Scrollwork is central to how the game's frames feel, and leaving it out made the
first pass read as austere Swiss rather than as Rathe. It earns a place in
exactly three roles: the corners of a feature panel, the corners of a card frame,
and a section rule. Never on a control, never on a list, never twice on one
screen.

### Two voices

- **Serif** — card names, questions, headings.
- **Sans** — everything else, including labels and citations.

**There were three, and the third was retired.** The rule was: *mono,
wide-tracked uppercase, for labels and anything citable — if it is monospaced,
you can paste it into an argument.* It is a good rule and the implementation
stopped honouring it. The same face ended up on eyebrows, state pills, stat
labels, set codes, view switches and provenance lines — chrome, none of it
citable — so by the time a reader met an actual rule identifier the signal had
already been spent seventeen files ago. A mark that appears everywhere marks
nothing.

So a citation is marked by **being** one: a link, in the accent, beside the
thing it cites. The wide tracking survives as a label treatment, because that is
a tracking step rather than a face — the token is named `type.tracking.wide`
now, for what it does.

---

## The query language — inherited, then extended

LSS's own Card Vault already has a search syntax, and that changes the strategy
entirely: **we do not invent a grammar, we adopt theirs.** A second dialect would
fragment the thing it claims to consolidate, and would ask people to learn a
language to use a tool they came to in a hurry.

| Operator | What it does |
|---|---|
| `pitch:3 class:guardian` | **Inherited.** Card Vault's own operators, supported verbatim — same names, same semantics. Anything that works there works here. |
| `cr:dominate` | **Ours.** Search the Comprehensive Rules, tournament policy and penalty guide as first-class objects. |
| `"command and conquer" + "sink below"` | **Ours.** The card-pair operator — two cards joined returns the interaction between them. The query the whole product exists to answer. |
| `legal:cc@2026-03-14` | **Ours, and unavailable anywhere else.** Legality as of a date. No first-party or third-party tool can currently answer this. |
| `is:verified` | **Ours.** Judge-signed rulings only — the difference between something you can cite at a table and something you cannot. |
| `changed:2.11.0` | **Ours.** Everything a rules version touched, including which cards and interactions it affects downstream. |

The design consequence: the search field must teach the extensions without
teaching the basics — people arrive already fluent. Hints show one inherited
operator alongside two of ours.

> **Unverified.** The inherited half of the grammar above is inferred rather than
> read — Card Vault blocked every automated attempt during research. Reconcile
> against the real documentation before implementing; the extensions were
> designed to slot into a shape that may not be exactly this one.

---

## Screens

Five views, in the order the phased plan builds them. Rendered mockups are in the
published version linked at the top.

### 1. Home — `optfall.com`

One search field, one hint line, one daily object. The hint pairs an operator
people already know from Card Vault with two of ours, so the extension is
discovered where fluency already exists — teaching by example rather than by
documentation.

**Today's chain link is the delight moment**, and deliberately not a borrowed
one. A rules reference is high-value but low-frequency: you visit when confused,
which is rare. A daily interaction with a hidden answer gives people a reason to
return on a day they are not stuck, teaches the hardest part of the game one
pairing at a time, and makes the corpus itself the content engine.

### 2. Deck check — `optfall.com/check/classic-constructed?as-of=2026-03-14`

The wedge, and the only screen with a deadline attached. The date control sits in
the header rather than in settings, because "as of when" is a first-class
question. Every verdict carries the citation that produced it, so the tool is
auditable rather than merely assertive — which matters when the
commercially-backed incumbent ships incorrect flags. The closing line is the
feature nobody else has: it tells you when the deck *stopped* being legal.

### 3. Interaction record — `optfall.com/i/command-and-conquer-x-sink-below`

The destination, and the thing that ends arguments. The URL is the product: two
card names in, one ruling out. Keying by *card pair* rather than by question makes
the corpus enumerable, which yields both a coverage metric and a work queue. The
brass seal is the only place brass appears — attribution is the moat, so it gets
the one material nothing else is allowed to use.

### 4. Rules section — `optfall.com/cr/8.3.4b?v=2.11.0`

Addressable, versioned, diffable. The phase that needs nobody's permission, and a
complete product on its own. The diff is the recurring content event: rules
updates here are consequential and currently arrive as a changelog nobody can
cross-reference against cards. Note the reverse link — a rule knows which
interactions cite it, so a change tells you exactly what it invalidates.

### 5. Card page — `optfall.com/card/command-and-conquer`

**The destination.** ~~Supporting cast, explicitly not a destination.~~ That was
this document's position and it is now wrong: `PLAN.md` was rewritten on
2026-08-11 to make the card layer the product, and this page was not updated
with it. The correction is recorded rather than silently applied, because the
old position was argued at length and a reader deserves to see what replaced it.

**Two columns.** The printed face and a rail of every printing on the left; the
name, the stat strip, the printed text and the legality verdict on the right.
Everything answering *what is this card* is above the fold, and the apparatus —
printings table, flavour, related cards, source — sits below it.

**Pitch versions are tabs, not separate pages.** A player calls the red, yellow
and blue versions one card, so they share one page and one heading, switched by
a strip of real links. Each version keeps its own permanent URL, so a tab is
something you can paste.

**The verdict shows its working, in proportion.** Every format's pills are
always visible. The raw upstream flags behind them open unasked whenever the
verdict claims anything other than plain `Legal` — a ban, a suspension, a
restriction, a Living Legend, or a format the dataset cannot answer for — and
fold away for the routine majority. An unusual claim shows its evidence; a
boring one stops shouting.

Two things still exist nowhere else: the *printed versus true text* diff, which
matters to anyone holding a physical card with outdated wording, and legality
that knows about time.

---

## Decisions worth arguing about

- **Red came back.** An earlier pass gave the accent to verdigris to avoid
  colliding with pitch, and the result read like a museum catalogue rather than a
  game about hitting people with axes. Pitch and chrome can share a hue because
  they never share a *shape*: pitch appears only as a cut jewel, and nothing else
  in the interface is ever that silhouette. It is exactly why coloured mana pips
  coexist with coloured UI.
- **Brass is rationed to one job.** Verified judge attribution, and nothing else.
- **Filigree earns three roles and no more.** Feature-panel corners, card-frame
  corners, and the section rule. Scrollwork is how the game's frames signal that
  a thing is *an object of value*, so spending it on ordinary controls would
  spend the signal.
- **Everything is bevelled, nothing is rounded.** A light top edge and a dark
  bottom edge on every plate, so surfaces read as struck metal. Combined with
  square corners and chamfered stat blocks, it lands in the game's register
  without borrowing a single official asset.
- **The mark is the primitive.** The logo and the most-repeated element in the
  interface are one object rather than two things that happen to coexist.
- **"Close semblance" is the operative phrase, not "copy".** LSS's policy
  prohibits third-party apps from creating any close semblance to their logos,
  which rules out an angular-chiselled wordmark in their idiom even if drawn from
  scratch. Building the mark from a *mechanic* sidesteps that entirely.
- **Adopt the grammar, do not invent one.** Every operator we add must feel like
  it was always part of the same language — a constraint on naming, not just
  engineering.
- **The daily puzzle instead of a random button.** Every reference site has a
  "random" affordance and it is the obvious thing to copy. A daily chain link
  builds a habit, teaches the mechanic the game is hardest at, and turns the
  corpus into the content engine.
- **No official logos, by construction.** Set identity is typographic here, never
  a symbol — a constraint that pushed the design somewhere more original than it
  would otherwise have gone.

---

## Implementation

The design language is not a mockup — it is Phase 1 of the build plan, shipped as
a theme package and a Svelte component library with Storybook as its workbench.
Tokens are the only source of truth, a lint rule fails the build on a raw hex or
pixel value inside a component, and accessibility checks run against every story
in CI.

The same component source compiles to custom elements, so the accessible pitch
jewel can be adopted by other Flesh and Blood tools without them adopting our
stack. That is the only mechanism by which the accessibility work reaches beyond
our own edges.

See [`PLAN.md`](PLAN.md) Phase 1.

---

## Open questions

- **The display face.** The mockups use a system serif stack so they render
  identically everywhere without a webfont. A licensed face — sharper, more
  condensed and more chiselled than Palatino — is the single highest-leverage
  upgrade available. There is no official FaB font available for third-party use:
  card typefaces are licensed *to* LSS by foundries and are not LSS's to
  sublicense. Community tools that bundle "official fonts" are not a licence.
  Candidates in the right register that can be legitimately self-hosted: **Grenze**
  (angular, faintly medieval, uncommon), **Cinzel** (inscriptional but the default
  fantasy choice), **Eczar** (high contrast, distinctive). A commercial display
  weight would beat all three — confirm the licence covers webfont embedding.
- ~~**Card rendering.**~~ **Settled, and it went the other way.** This entry said
  the card face is drawn from primitives rather than showing real art. Real art
  is now the rendering: 11,377 faces are served from Optfall's own host at two
  WebP tiers, and the drawn plate survives as the NO IMAGE placeholder for the
  printings upstream publishes no face for. The half of the entry that was right
  is kept and enforced — the pitch jewel stays an Optfall-drawn overlay rather
  than a crop, so the accessible rendering travels with the component, and the
  copyright line is emitted by `CardFace` itself with no prop and no variant that
  can drop it.
- **Illustrative content.** Card names in the mockups are real; specific legality
  states, rule numbers, stat lines and ruling text are placeholders chosen to
  exercise the layouts.
