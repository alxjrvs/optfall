# Optfall — design pass

Scryfall's ethos — a reference work that respects your time — forged in the
language of Rathe: black, blood and brass.

---

## What we take, and what changes

Copying Scryfall's look would produce a Magic site with different words in it.
The transferable thing is its *ethos*: it behaves like a well-made reference book
rather than a product with a marketing department. Each principle survives the
move; each expression of it does not.

| The principle we keep | How it changes for Flesh and Blood |
|---|---|
| **The search field is the hero.** No marketing hero, no illustration above the fold. The first thing on the page is the thing you came to do. | **The grammar is inherited, not invented.** LSS's own Card Vault already has a syntax. We adopt it verbatim and extend it to rules and interactions, so a query someone already knows keeps working. |
| **Density without clutter.** Enormous information per screen, held together by tight vertical rhythm and hairline rules rather than cards, shadows and padding. | **Same discipline, forged rather than printed.** Square corners, bevelled plates, angular notches on ~~anything carrying state~~ a value the card carries out of a fixed set — legality, and now pitch; see `PitchBox`. The chrome should feel struck from metal, not laid out in a design tool. |
| **Colour must mean something.** Scryfall's chrome is neutral; colour is reserved for the colour pie, rarity and legality. It is data, never decoration. | **Pitch is data, blood red is chrome.** They can share a hue because they never share a shape. Pitch wears ~~a cut jewel~~ **a ring of three sockets** on a card's own page, and under a card face a band — ~~two forms, both reserved, neither used for anything else~~ three now: in a list or a grid it wears the legality flag's notched plate, spelled `PITCH 1`, which is the one form deliberately NOT reserved. Sharing that silhouette is the point of it — a reader learns the plate once, at the foot of a card page, and meets it again at the top of one. See `PitchBox`. ~~The mark is the single sanctioned exception to the jewel's silhouette~~ — the mark is a chain and the jewel is a ring, so there is no reserved silhouette left to except; all three are argued below. |
| **Typography carries hierarchy.** Weight, size and rhythm do the work that boxes, gradients and accent bars do on lesser sites. | **Two voices, strictly assigned.** A serif for names and questions, a sans for everything else. ~~a wide-tracked mono for labels and anything citable~~ — see below. |
| **Every view is a URL.** Scryfall's real product is the link you paste into a conversation to settle it. | **The unit is the card**, and the rules and rulings attach to it. Card pages are the shareable object; `/cr/…` sections are addressable too and a card links into them. ~~The unit is the verdict, not the card.~~ — see below. |
| **Dark mode is not an inversion.** It is designed, and for many users it is the only mode they will ever see. | **Black is the native key.** Near-black ground, blood accent, brass for anything authoritative. Light mode is the printed-rulebook translation — ash and iron, not paper white. |

---

## The mark

**Three interlocked links, leaning at 25°, in the three pitch colours.**

The mark used to be a cut jewel — the pitch diamond, cleaved — on the argument
that the logo and the core interface primitive should be the same object. That
was a good argument for a mark that says *Flesh and Blood*. It is the wrong
argument for this one, because what the jewel says is what the GAME is, and what
this tool does is **join things**.

A card to the rule that governs it. A rule back to every card that prints its
keyword. A printing to its legality, and that verdict to the upstream flags it
was derived from. `docs/SCRYFALL-GAP.md` calls the card↔rules cross-reference
"the join nothing currently makes", and it is the one thing here no other tool
has. A chain is that, drawn.

Three links rather than two, because two rings that overlap are two rings; three
is where it reads as a chain — and three is what carries one pitch value each.

**The interlock is paint order and nothing else.** Each link crosses its
neighbour twice, and a real chain is over at one crossing and under at the
other. No mask, no subtraction, no cut edges: a link is redrawn inside a
rectangle containing only its upper crossing, and the rectangle sits in the
empty band between the two — so nothing is ever clipped through a link's own
edge. Earlier attempts cut the shapes instead and produced angled bites out of
the rings, which is the failure this arrangement is designed against.

### The one place pitch colour is spent on something that is not pitch

The system's rule is that **colour is data**: the pitch palette means a pitch
value and nothing else, and boldness is rationed. A three-colour mark reads
against that, so the exception is argued here rather than left as an
inconsistency somebody finds later.

**The mark is not a card.** Its links are not a pitch *value* — there is no card
here to have one. They are the three-value system itself, spent once, as
identity. That is the same shape of argument the jewel already made for putting
the reserved silhouette on a logo, and it holds for exactly one object.

An **Ink** alternate exists for surfaces that cannot take three colours: ink on
the outside links, blood in the middle. It is the more legible of the two when
small, which is worth knowing before choosing one.

### It has to survive a favicon, and at three links it does not

~~The chain is about twice as wide as it is tall. Measured at 16, 32, 48 and
128px: at 16 in a square box the three rings are a smudge, and **one link
upright is still legibly a ring**. So the tab icon is one link.~~

~~That is not a second drawing. `MARK_GEOMETRY.single` is the same path under a
different transform, in a box derived from the same corners, so the favicon
cannot drift from the mark — there is nothing to keep in step. `faviconSvg()` in
`apps/site/ssg/assets.ts` generates it at build time from that constant (it was
an Astro endpoint at `apps/site/src/pages/favicon.svg.ts` until
[#107](https://github.com/alxjrvs/optfall/pull/107)), and one link has no value
to carry, so it takes the accent rather than the pitch palette: the ordinary
rule, not the exception above.~~

**Reversed. Every icon is the chain.** The measurement above still holds — at
16px in a square box the three rings really are a smudge — and it was answered
with the wrong move. What the reduced mark bought was a tab icon that is *not
the logo*: an unfamiliar lozenge sitting next to every other tab, when the whole
point of a mark is that the thing you see a thousand times a session is the
thing on the tab. The favicon went back to the chain first; the installed-app
icon followed, and that one was the worse of the two to have wrong — a favicon
is 16px of furniture, a home-screen icon is the entire identity at 512px, where
none of the argument for reducing applies.

So `apps/site/ssg/assets.ts` paints one chain and hands it three boxes:
`/favicon.svg` at the mark's own aspect, and `/icon.svg` and
`/icon-maskable.svg` on a square over the ground, rasterised to PNG for the
engines that will not read a vector. Squaring a 45.45 × 21.33 mark letterboxes
it to about 47% of the height, and that is a real cost taken deliberately rather
than designed around. The links keep the pitch palette everywhere — the
exception argued above, spent once — so nothing takes the accent and there is
nothing to swap between themes. `MARK_GEOMETRY.single` was deleted with the last
surface that drew it, rather than left as a variant the product does not use.

**One compliance constraint shaped this.** LSS's policy does not merely prohibit
using their logos in third-party applications — it prohibits creating any *close
semblance* to them. So the mark takes the register (angular, chiselled, struck
from metal) and nothing of the form. Nothing here is heraldic, bladed or
lettered, and the chamfered links carry the system's own rule that there are no
rounded corners anywhere.

---

## The system

Boldness is spent in two places — the pitch jewel and the blood accent — and
everything around them stays quiet.

### Black, ash and iron

Neutrals with no colour cast at all — the grey of unpolished steel. Every surface
is bevelled with a light top edge and a dark bottom one, so panels read as struck
plate rather than as flat rectangles.

### The pitch jewel

A **ring**: a disc in the pitch tone holding ~~its numeral~~ **three bezelled
sockets in an equilateral triangle, filled to the card's pitch value**. Shape,
count and colour state the same fact three times.

~~A **diamond**: vertex up, vertex down, widest across the middle, with all four
corners cut — eight sides, and a facet highlight. The silhouette is reserved:
nothing else in the interface is ever this shape.~~

~~**The orientation is part of the specification, not a drawing detail.** This
section used to say only "an eight-sided cut stone", which is equally true of an
edge-up chamfered square — and so, for a while, the component drew one of those
while the design-system cards drew the diamond, and the logo followed the
component. Nothing failed, because nothing disagreed with the words. An edge-up
octagon reads as a *button*; a vertex-up one reads as a *gem*.~~

**The reservation is retired, and the incident behind it is the reason this
paragraph survives.** What the diamond bought was a silhouette that meant one
thing and could be found on a page at a glance. What it cost was the corner
disagreeing with the card, which prints a ring — and once every other mark on
the card panel was the game's own artwork, the stone was the last object still
insisting on a shape the game does not draw.

**What did not change is the rule the drift taught.** The exact polygon is still
the `ornament.cut.jewel` token in `optfall-theme`, still defined in both tables,
and still what `index.test.ts` pins as vertex-up — it is simply no longer read
by the jewel. A shape spelled out in a component rather than named is the
failure mode, whatever the shape is, and `scripts/check-tokens.ts` plus that
test are what hold it. The token is kept rather than deleted because it is the
record of what the mark used to mean, and `Mark`'s own history is written
against it.

**The facet went with the silhouette.** A cut stone catches light on its crown;
a ring does not, and the card's ring is a flat field inside a bezel. The
gradient also had a bug in it — an absolutely positioned band that `clip-path`
used to cut to the octagon, which a `border-radius` does not clip, so it painted
as a rectangle overhanging the disc. See `PitchJewel.css`, which keeps the
contrast measurement the facet was tuned against in case anything is ever laid
over the stone again.

**The sockets are the game's own resource symbol.** A pitch value *is* a
resource value — CR 1.12.4e — so a filled socket holds `{r}`, the same file the
marker renders with inline in card text, and an empty one is a hole. Both wear
the same light bezel, which is what lets a red pip sit on the red stone at pitch
one. Small stones — indexes, version tabs — fall back to a drawn pip in the same
red, because a socket a few pixels across cannot resolve the artwork.

~~The numeral is~~ **The count is** the **primary** channel, not an
accessibility fallback. Red and yellow are the classic deuteranopia confusion
pair, pitch is the most-read value on a card, and it is the same pair the leading
commercial scanner app misreads. Designing colour as the redundant channel costs
nothing and fixes it for everyone downstream.

**The channel changed and the constraint did not, which is why the sentence
above is struck rather than deleted.** The stone carried a numeral until the
marks on the card panel became the game's own. The printed card counts instead:
three slots in the top-left corner, filled from the apex down — one for pitch
one, two for pitch two, three for pitch three — with no numeral anywhere on the
frame. Counting is not a hue, so every word of the paragraph above still holds;
what it costs is a numeral's exactness at a glance, which for a three-valued
closed set is a smaller loss than it sounds. The accessible name says "Pitch 3"
in words at every size.

**Three slots, not `value` slots.** A single filled pip and one pip out of three
are different statements, and only the second says "this card pitches for one of
a possible three". The empty slots are the denominator. They take the stone's own
ink at a quarter opacity, which is the one colour on the component already
guaranteed to clear AA against every tone.

**The card's field is a circle and ours stays an octagon.** The silhouette is the
one shape this system reserves, and at the size a stone is read a cut octagon and
a disc are the same object; giving it up to match the frame would spend a
promise to gain nothing a reader can see.

**There are four stones, not three, and the fourth is why the numeral rule is
load-bearing.** A pitch 4 has been previewed — a purple strip on a Shadow
resource gem, card code `IAR000` — and the palette carries it. Nothing on the
site draws this stone today, and the claim behind that is deliberately narrow:
no card in `data/cards` carries `pitch: "4"`. Not "no `IAR` card" — the corpus
holds several of those already; only `data/sets` still records the set itself as
`"??? Set 20 ???"` with a null release date. The stone is here so the day a
pitch-4 card lands is not also the day somebody picks a purple under deadline.
Purple is the one hue in this
palette that cannot be given a luminance gap: bright enough to separate from
pitch three and its own numeral fails contrast; dark enough for white ink and it
sits where blue sits. So three and four are told apart by hue alone for a reader
with deuteranopia or protanopia — and the count cannot help, because there are
three slots and both values fill all of them. ~~by the numeral for everybody~~
**The accessible name is what separates them for everybody else**, which is
weaker than a visible numeral was and is the one place the change above costs
something real. It is the first stone where the redundant channel is genuinely
carrying less, and it is written down here rather than discovered later.

### The pitch rule — the jewel's one exception, and where it applies

**Under a card face, the jewel becomes an underline.** A grid of card art has
nowhere to put a stone: forty jewels scattered over forty pictures are forty
objects competing with what the reader is there to look at, and there is no line
of type for one to sit beside. So in the images view of a card index — and
nowhere else — pitch is drawn as coloured bands under the centred name, one band
per value, ascending. `PitchRule` in `optfall-components`.

**Every text surface keeps the jewel**, which is what stops this from being a
weakening of the rule above. The card page, the rows view and the names view all
carry ~~numbered~~ **slotted** stones, so the value remains available one click —
usually zero clicks — away, and the reserved silhouette still appears wherever
there is room for it.

**What the bands give up, and what replaces it.** A band cannot carry the stone's
slots, so on that one surface colour carries more weight than this document
otherwise allows. Three things stand in for it: the element is a `role="img"`
with a written name that spells the values out ("Pitch 1, 2 and 3"); the COUNT
of bands is a non-colour channel, ~~which is new information the old rendering
did not have at all~~ **which is now the same channel the jewel itself uses,
counting versions where the stone counts pips**; and the ORDER is fixed
ascending, so the leftmost band is always the lowest pitch. The honest summary is that this is a trade rather than a free
win, and it is confined to the surface that could not take the jewel.

**It is plural where the jewel is singular, and that is why it is a second
primitive rather than a variant.** A card page shows one card and one pitch. A
cell in a card index stands for a NAME, and a name in this game is commonly three
cards — the rendering has to be able to say so. What the grid replaced was worse
on both counts: the words "pitch 1, pitch 2", printed only when *some* versions
matched, so the ordinary case said nothing and a reader could not tell a
single-version card from a collapsed one.

**Where the row stands for several versions, the mark is a control.** The name
goes to the name's lowest-pitch version — the page `/card/head-jab` now 301s to — and each
band goes to the version it is drawn in the colour of, so a reader who means the
blue one aims at the blue third of the rule instead of arriving at red and
correcting. The stones in the two text views are the same control drawn the way
those views draw pitch. Three consequences worth stating, because each one is a
rule rather than an implementation detail:

- **Only the versions on offer are drawn.** A search draws the versions that
  matched and a set page the versions that set printed, so a band is never a
  door to a card the surface has just said is not in the answer.
- **One version means no control.** A row standing for a single card draws the
  plain unlinked mark: a link there would be a second, smaller target for the
  destination the name beside it already has.
- **A band carries no text, so it carries a name.** Each is a `role="img"` named
  for the card and the version — "Head Jab (pitch 2)" — inside its own link,
  which is what stops three coloured rectangles from being three anonymous
  links. This is also why the bands are one rule each rather than one rule with
  three anchors in it: the children of a `role="img"` are not exposed, so links
  inside one would be links nothing could reach.

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
and a section rule. Never on a control, never on a list, ~~never twice on one
screen~~.

**The "never twice" clause is retired for the section rule, and holds for the
other two.** It was implemented as an `ornament` flag on `OrnamentalRule`,
defaulting to off, so a screen spent its one mark on a single rule and drew the
rest as bare hairlines. Exactly one call site ever set it. A flag with one caller
was not rationing anything between rules — it was making one divider look like a
different component from the divider on the next page down, which is the
inconsistency the ration exists to prevent, arrived at from the other side. The
centre mark is now what a section rule *is*, on every one of them. Panel corners
and card frames are still spent once each, and are still `FiligreeCorner`'s.

**And "every one of them" was four short.** The header's closing line, the line
under the card index's control bar, the one above a pager and the one that opens
the footer were not `OrnamentalRule`s at all — each was a `border-block-start` or
`border-block-end` on the box itself, the same hairline at the same weight in the
same ink, spelled a second way. A border has no middle, so those four were the
only dividers on the site that *could not* carry the mark, and they were four of
the most-seen: the footer's is on all 12,776 built pages and the header's on
12,775 of them — the front door is the one surface that opts the header out.
They compose the primitive now, with a `flush` variant that drops the vertical
rhythm a border never had: at a container's edge the host already owns the space
on both sides.

Row hairlines are deliberately not in that set. `ResultRow`, the browse list, the
sets list and the printings table each rule *between items of one list*, which is
the "never on a list" clause still doing its job; a mark on every row is the
clutter the density principle is written against.

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

### 5. Card page — `optfall.com/card/arc/159/command-and-conquer`

**The destination.** ~~Supporting cast, explicitly not a destination.~~ That was
this document's position and it is now wrong: `PLAN.md` was rewritten on
2026-08-11 to make the card layer the product, and this page was not updated
with it. The correction is recorded rather than silently applied, because the
old position was argued at length and a reader deserves to see what replaced it.

**Two columns.** The printed face on the left; the name, the stat strip, the
printed text and the legality verdict on the right. Everything answering *what
is this card* is above the fold, and the apparatus — printings table, flavour,
related cards, source — sits below it.

**The printings table is how a reader reaches another art.** A rail of
thumbnails under the face used to do it, and the table below did it better
without being asked: a tile could caption three facts about a printing where a
row names seven of them in columns, and 279 tiles in this corpus read
identically to a sibling — a control offering two choices under one name. So
each row's collector number is a link to the art that row is published with, and
a card page shows ONE printing. The rarity beside the face is that printing's,
the back named beside it is that printing's, and none of it needs scripting: the
address decides, at build time. Where two rows share a number and reach
different arts, the anchor carries a hidden qualifier — the edition, the foiling,
or the art's own key, whichever actually separates the two addresses.

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
  they never share a *shape*: pitch appears as a cut jewel or, under a card face,
  as a short band under the name — and nothing else in the interface is ever
  either. It is exactly why coloured mana pips coexist with coloured UI. The mark
  is the one object that spends the pitch PALETTE without being a pitch value —
  see "The mark" above for why that is an identity rather than a datum, and note
  that it does not touch this rule, since a chain link is neither silhouette.

  **The band is the form that has to be watched**, and it is worth saying so
  where the rule lives rather than only where the component does. A red bar under
  a name is one step from a link underline, and the name above it IS a link that
  turns accent-red on hover. Three things keep them apart: the band is detached
  from the text by a gap, it is a fixed short width rather than the width of the
  name, and the names it sits under are never underlined at rest. If a future
  pass gives grid names a resting underline, that separation is gone and this
  is the entry that should stop it.
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
a theme package and a React component library, with the `design-system/` bundle
as its workbench. Tokens are the only source of truth, a lint rule fails the
build on a raw hex or pixel value inside a component, and axe-core runs over
every primitive in CI.

See [`PLAN.md`](PLAN.md) Phase 1.

### What the accessibility work covers

**This site, and it is enforced rather than asserted.** Every primitive in
`PRIMITIVES` — the count is `PRIMITIVES.length`, deliberately not spelled here,
because it was written as "13" and stayed 13 through two additions — is
rendered through axe-core by
`packages/components/src/react/a11y.test.tsx`, which runs under `bun run check`
and in the gate. The table those runs come from, `CASES`, is itself asserted
against `PRIMITIVES` — so a primitive added without a case **fails the suite**
rather than being reported green by a run that never rendered it. That
assertion is the point: a passing count says nothing about the component that
has no case at all, which is the same "looks like coverage" failure the
design-system gate catches one layer up.

Two boundaries, stated here so a pass is not read as more than it is. Colour
contrast is **not** checked by that suite — axe's `color-contrast` rule needs a
canvas to sample rendered pixels and returns *incomplete* under jsdom, so it is
disabled explicitly and contrast is asserted numerically instead, from the token
values themselves, in `packages/theme/src/tokens.test.ts`. And focus order,
focus-visible styling, element geometry and any media query jsdom does not
evaluate belong to the visual-regression pass; the harness's own header
enumerates them.

**Whether that work reaches other Flesh and Blood tools is an open question, not
a settled retirement.** This document used to claim that "the same component
source compiles to custom elements, so the accessible pitch jewel can be adopted
by other Flesh and Blood tools without them adopting our stack" — described as
*the only mechanism by which the accessibility work reaches beyond our own
edges*. That mechanism was Svelte's custom-element compilation, and it went with
Svelte in [#107](https://github.com/alxjrvs/optfall/pull/107). **Nothing
replaced it.** React does not compile to custom elements without an explicit
wrapper; no test covered the capability and no check asserted it, which is
exactly why it could leave with nothing failing.

The claim is quoted rather than deleted because it is the only evidence the
capability ever existed, and deleting it is how it was lost the first time. Two
honest outcomes remain open — ship the React primitives as custom elements,
which is a real feature with a real API surface (which primitives, what props,
what versioning) and deserves its own scoping; or decide that reaching other
tools is not a goal and record the retirement deliberately. **That decision has
not been taken**, and it is tracked as
[#156](https://github.com/alxjrvs/optfall/issues/156). Until it is, this
document claims neither: the accessibility work is for this site, and the goal
of it travelling further is parked rather than abandoned.

### The design-system bundle

`design-system/` is the workbench: a small set of static HTML cards, generated
from the theme's own tokens by `bun run design-system` and **committed**, so a
drift between the cards and the product is a diff rather than a discovery.

Its rule, in one line:

> **One primitive = one card = one nav leaf, titled `Group/Primitive`, with the
> leaf pinned to the primitive's own id.**

**The taxonomy is closed.** Three top-level groups, and a card belongs to
whichever question it answers:

| Group | What it answers | Titles |
|---|---|---|
| `Foundations` | What the system is made of, before any component exists — colour, type, spacing. | Free-form. These document the system rather than living in it. |
| `Primitives` | What one primitive is, how it varies, and why. **Exactly one card per entry in `PRIMITIVES`, and nothing else.** | Derived: the primitive's id in sentence case, so `pitch-jewel` is titled `Pitch jewel`. |
| `Screens` | What the primitives assemble into — the exit criterion `PRIMITIVES` exists to check, which is that a complete product screen needs no new CSS. | Free-form. A screen is named by its route. |

Adding a fourth group is a real decision: write it here and add it to
`DS_GROUPS`. Do not invent one in a card.

**The title is derived, not chosen.** A title is the only thing that puts a
primitive somewhere findable, so a hand-written one drifts into naming something
the code does not have. Deriving it from the id removes the choice rather than
policing it.

**Why it is enforced rather than asked for.** `scripts/design-system-coverage.test.ts`
is the executable half of this section and runs under `bun run check`. It exists
because the bundle had already rotted in both of the ways the rule prevents, and
this repository is the third to arrive at the same conclusion —
[`SU-SRD`](https://github.com/alxjrvs/SU-SRD) and `binfinite-app` each invented
it independently, and each recorded that presence alone was not enough:

- **Seven of thirteen primitives had no card at all**, so the bundle documented
  just over half the library while looking complete.
- **`rule-and-citation.html` was a gallery** — one card standing in for the
  ornamental rule, the citation and the brass seal. Two of the three had already
  drifted inside it, unnoticed: the citation was captioned *"monospaced, so you
  can paste it"* after that face had been retired from the system, and the brass
  seal was a flat badge with no version band — the one field Phase 5 requires be
  impossible to miss.

A gallery is the failure worth naming, because it looks like coverage. The
allowlist for genuine exceptions starts **empty**, and a test fails if an entry
in it goes stale.

**The bundle is checked against its generator**, not just against the taxonomy:
every committed card must be byte-identical to what `build-design-system.ts`
renders. Without that, the gate would police a declaration the published HTML
need not resemble — which is exactly how the bundle went stale the first time,
built from a scratch directory with nothing to prompt a re-run.

**What the gate does NOT reach — stated here rather than discovered later.** The
cards hand-author the markup they illustrate rather than rendering the real
components, so a component change does not propagate on its own. That bounds the
gate precisely:

| The gate checks | The gate cannot check |
|---|---|
| Every primitive has a card | That the card still *looks like* its primitive |
| The group vocabulary is closed | — |
| The title is derived from the id | — |
| The committed HTML is byte-identical to what the generator renders | That the generator's hand-written markup agrees with the component's |

So the catalog's **shape** is enforceable and its **fidelity** is left to review.
That is the same class of problem the generator's own header describes — a card
that went on showing a stat block after the component had become glyphs — and
this gate does not solve it. It makes the missing-card and mis-titled-card half
impossible, which is the half that was silently wrong at scale.

The mark and the filigree are the two exceptions, and are immune: both draw from
geometry published in `packages/components/src/index.ts` precisely so there is
one drawing rather than two. Rendering the real React components into every card
would extend that immunity to the whole bundle, removing the weakness rather
than managing it, and remains the right next step.

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
- **Does the accessibility work leave this repo?** It covers this site
  completely and is gated (see *What the accessibility work covers* above). What
  it no longer has is a way *out*: the custom-element export that let another
  Flesh and Blood tool adopt the accessible pitch jewel was Svelte's, and it
  went with Svelte in [#107](https://github.com/alxjrvs/optfall/pull/107)
  unreplaced and unnoticed — a distribution capability riding on a framework
  rather than part of it, so nothing failed when it left. Restoring it means
  scoping a real published surface; dropping it means saying so. Tracked as
  [#156](https://github.com/alxjrvs/optfall/issues/156). **Open**, and it is the
  one question in this document whose answer changes who the design system is
  for.
- **Illustrative content.** Card names in the mockups are real; specific legality
  states, rule numbers, stat lines and ruling text are placeholders chosen to
  exercise the layouts.
