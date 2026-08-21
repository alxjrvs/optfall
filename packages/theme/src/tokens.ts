/**
 * The two token tables — the only place a literal colour, size or duration is
 * allowed to appear in this project.
 *
 * `docs/DESIGN.md` is the specification. Three constraints from it shape almost
 * every value here, and none of them is a matter of taste:
 *
 * 1. **Neutrals carry no colour cast at all** — "the grey of unpolished steel".
 *    Every neutral below has equal red, green and blue components. A neutral
 *    that is faintly blue reads as a website; a neutral that is faintly warm
 *    reads as parchment. Both are somewhere other than Rathe.
 *
 * 2. **Dark is the native key, light is a translation, and neither is derived
 *    from the other.** Light mode is "ash and iron, not paper white", so its
 *    ground is a mid grey rather than `#fff` with the tokens flipped. An
 *    inverted palette is how one mode ends up quietly unusable.
 *
 * 3. **Colour is data, never decoration.** Boldness is spent in exactly two
 *    places — the pitch jewel and the blood accent. Brass appears once, on
 *    verified attribution, and nowhere else.
 *
 * Both tables must define exactly the same token ids; a test asserts it, so a
 * token added to one mode and forgotten in the other fails the build rather
 * than rendering as an unset custom property.
 */

import type { TokenTable } from "./index";

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Values identical in both modes. Type, space and motion are structural rather
 * than tonal — a heading is the same size in the dark, and reading distance
 * does not change with the lights.
 *
 * The display face WAS an open question in `docs/DESIGN.md` — the candidates
 * (Grenze, Cinzel, Eczar) all needed a licence check for webfont embedding.
 * Grenze is in, under SIL OFL 1.1, self-hosted. What follows described the
 * placeholder that shipped that renders identically everywhere and gets
 * replaced in one token when that decision lands.
 */
const STRUCTURE: TokenTable = {
  /* Three voices, strictly assigned. Serif for names and questions, sans for
     interface text. TWO VOICES, not three: the monospace face was retired
     because it was doing chrome's job. It marked eyebrows, pills, stat labels
     and set codes as much as it marked identifiers, so "monospaced means
     citable" had stopped being true long before anyone read it that way. The
     sans carries all of it now, and a citation is marked by BEING a citation —
     a link, in the accent, next to the thing it cites. */
  /* THE DISPLAY FACE, AND IT IS A REAL ONE NOW. `docs/DESIGN.md` called this
     "the single highest-leverage upgrade available" and listed three candidates
     that can be legitimately self-hosted; Grenze is the one it describes as
     angular, faintly medieval and UNCOMMON, against Cinzel's "the default
     fantasy choice". Uncommon is worth more than familiar on a mark that has to
     be recognised.

     SIL Open Font License 1.1. The grant names `embed` outright — "to use,
     study, copy, merge, embed, modify, redistribute" — so this does not rest on
     reading "redistribute" generously; `data/fonts/fonts.json` quotes the clause
     rather than summarising it, along with condition 2, which obliges us to ship
     the copyright notice and licence beside the file. That is
     `apps/site/public/fonts/OFL.txt`.

     Served from our own origin rather than a font CDN, for the same reason
     nothing else here depends on a third party staying up.

     The stack falls back to the serif below, so a blocked or failed font
     download degrades to what the site rendered before rather than to
     Times. */
  "type.family.display":
    "Grenze, Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
  "type.family.serif":
    "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
  "type.family.sans":
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",

  /* A restrained scale. Density without clutter means fewer sizes used more
     deliberately, not more sizes used approximately.

     THE FLOOR MOVED UP ONE STEP, and the reason is a measurement rather than a
     preference. Half of the type on a card page — 50.7% of it — was set below
     12px, which is where text stops being read and starts being merely present.
     Scryfall, the density benchmark this project measures itself against, has
     no interface text below 12px at all. Raising the bottom three steps by 1px
     each takes the share of sub-12px type on that page from 50.7% to about 12%,
     and that remainder is `legal` doing the one job it exists for.

     Density is not the same claim as small. It is information per screen, and
     type nobody can read contributes none — so this buys legibility at a real
     cost in fold space (roughly 10px added to each preamble) and the rest of
     the fold pass is what pays it back. It is deliberately the FIRST change of
     that pass, so every later measurement is taken against the honest baseline
     rather than one flattered by unreadable text. */
  /* Fine print. Smaller than `micro`, which is the label step — a legal notice
     that has to accompany every card image should recede below the smallest
     thing a reader is meant to READ, not sit level with it. It is the one step
     allowed under 12px, and it stays under: the gap to `micro` is what makes it
     legible AS fine print. */
  "type.size.legal": "0.6875rem",
  "type.size.micro": "0.75rem",
  "type.size.small": "0.875rem",
  "type.size.base": "0.9375rem",
  "type.size.large": "1.125rem",
  "type.size.title": "1.5rem",
  "type.size.display": "2.25rem",

  "type.weight.regular": "400",
  "type.weight.medium": "500",
  "type.weight.bold": "700",

  "type.leading.tight": "1.15",
  "type.leading.base": "1.5",
  "type.leading.loose": "1.7",

  /* Wide tracking is what makes the mono voice read as a label rather than as
     code. It is the voice's defining property, so it is a token. */
  "type.tracking.wide": "0.09em",
  "type.tracking.tight": "-0.01em",
  "type.tracking.normal": "0",

  /* The measure — maximum line length for running prose. A typographic
     constraint rather than a layout one, which is why it lives on the type
     axis: it is chosen from how far an eye can track a line and return to the
     right next one, not from any container. */
  "type.measure": "46rem",

  /* A 4px base step. Tight vertical rhythm is what holds density together
     without boxes and shadows. */
  "space.hair": "1px",
  "space.tightest": "0.125rem",
  "space.tighter": "0.25rem",
  "space.tight": "0.5rem",
  "space.base": "0.75rem",
  "space.loose": "1rem",
  "space.looser": "1.5rem",
  "space.loosest": "2.5rem",

  /* Everything is bevelled, nothing is rounded. Square corners are a system
     rule, so the radius token exists only to be zero — a component asking for
     a radius gets one, and it is none. */
  "bevel.width": "1px",
  "bevel.radius": "0",

  /* The notch on a value a card carries out of a fixed set. The clipped corner
     is the only ornament in the system and it always means something.

     IT SAID "ANYTHING CARRYING STATE" AND THAT WAS NARROWER THAN THE SET IT
     DESCRIBES. `StatePill` was the only user while legality verdicts were the
     only such value on the page; `PitchBox` draws the same notch at the same
     depth for pitch, which is the other one — a short label, one of five, that
     a card either has or does not. What the corner rules out is unchanged and
     is the part that matters: it never appears on a control, on a heading, or
     as decoration. */
  "ornament.notch.size": "0.5rem",
  "ornament.rule.width": "1px",
  "ornament.filigree.size": "1.25rem",

  /* The jewel is sized here rather than in the component, because it is the
     one silhouette reserved to a single meaning — it appears at these three
     sizes and no others, and a component free to pick its own would erode
     that. */
  /* The stat plate, and THE SIZE EVERY SYMBOL IN THE CARD PANEL IS MATCHED TO.
     Pitch, cost, power, defence, life, intellect and arcane all sit in the same
     two bands of that panel, so a reader compares them against each other
     before comparing any of them to the type around them.

     IT USED TO BE THE LARGER OF TWO SIZES, AND THAT WAS DRIFT RATHER THAN A
     DECISION. The note here read "larger than the jewel … the jewel must stay
     the smallest reserved shape on the card", which is a sentence about the
     silhouette's PRIVILEGE wearing the clothes of a sentence about its SIZE: a
     1.75rem stone beside a 2.25rem plate, on the same line, 29% apart in the
     one dimension the eye compares first. Reserved means nothing else may take
     the shape. It never meant the stone has to be the runt of the row. */
  "ornament.stat.size": "2.25rem",

  /* How far a symbol plate drops below the text baseline when it is set INLINE
     in a sentence. A stat plate never needs this — it sits in a grid cell — but
     `+1{p}` mid-paragraph does, and without it a line of six plates opens the
     paragraph's leading and the text loses its rhythm. Held here because it is
     an optical constant of the plate against the type, not a component's
     choice. */
  "ornament.symbol.shift": "-0.15em",

  /* -- The silhouettes ------------------------------------------------------
     THE SHAPE TABLE, IN THE TOKEN LAYER, because two components read it.

     `StatGlyph` carries a printed VALUE and `GameSymbol` carries the marker
     that names it, and the point of the pair is that `+1{p}` inline and `4` in
     the stat block are recognisably the same plate. Held as two copies of a
     `clip-path`, that equivalence lasts exactly until somebody adjusts one
     chamfer — so it is held once, here, and each component reads it.

     Each cut is written against `--chamfer`, which the COMPONENT sets, so one
     shape serves every size without a second table for small plates.

     NEVER EIGHT-SIDED. `PitchJewel`'s octagon is reserved — "nothing else in
     the interface is ever this shape" — which is why `chi` takes two corners
     rather than the four it would naturally want, and why the effect symbols
     are cut down a side instead. */
  /* THE RESERVED SILHOUETTE: the pitch diamond. Vertex up, vertex down, widest
     across the middle, all four corners cut — the eight-sided shape the note
     above forbids everything else from taking.

     It is a token because it had been a *drawing*, twice, and the two
     disagreed: `PitchJewel.svelte` clipped an edge-up chamfered square while
     `scripts/build-design-system.ts` drew this diamond, so the published
     design-system cards advertised a shape the product did not render, and the
     logo — built from the component — inherited the wrong one. Nothing failed,
     because `docs/DESIGN.md` said only "an eight-sided cut stone", which is
     true of both.

     Here, it is one value that both surfaces name, and `scripts/check-tokens.ts`
     fails the build on a surface naming a token that does not exist — so the
     shape cannot be quietly redrawn in one place ever again. Orientation is the
     whole of the difference: edge-up reads as a button, vertex-up as a gem. */
  "ornament.cut.jewel":
    "polygon(50% 0%, 85% 15%, 100% 50%, 85% 85%, 50% 100%, 15% 85%, 0% 50%, 15% 15%)",
  /* FIVE CUTS WENT, AND THE REASON IS THAT NOTHING WORE THEM. `hexagon`,
     `lean.start`, `lean.end`, `plain` and `diagonal.start` were defined here and
     used by no component and no page — so every one of the 12,776 pages
     downloaded five custom properties that could not affect a pixel.

     A token is a shared vocabulary, and an entry nobody says is not vocabulary,
     it is a suggestion. `plain` is the clearest case: a token whose value is
     `none` is a way of writing "no clip-path" that reads like a decision, and
     the components that want no clip-path simply do not set one.

     Do not restore one speculatively. The seven that remain — `disc`, `jewel`,
     `shield`, `crown`, `diagonal.end`, `side.start`, `side.end` — are each worn
     by something, and `scripts/check-tokens.ts` fails the build on a surface
     naming a token that does not exist, so adding one back when a component
     needs it is a two-line change with a gate behind it. */
  "ornament.cut.diagonal.end":
    "polygon(0 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% 100%, var(--chamfer) 100%, 0 calc(100% - var(--chamfer)))",
  "ornament.cut.crown":
    "polygon(var(--chamfer) 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% 100%, 0 100%, 0 var(--chamfer))",
  /* Cut down a whole side rather than at a corner: the CR distinguishes symbols
     that represent a VALUE from those that represent an EFFECT, and the
     silhouettes say which is which before the letter is read. */
  "ornament.cut.side.end":
    "polygon(0 0, calc(100% - var(--chamfer)) 0, 100% var(--chamfer), 100% calc(100% - var(--chamfer)), calc(100% - var(--chamfer)) 100%, 0 100%)",
  "ornament.cut.side.start":
    "polygon(var(--chamfer) 0, 100% 0, 100% 100%, var(--chamfer) 100%, 0 calc(100% - var(--chamfer)), 0 var(--chamfer))",

  /* -- The three printed shapes ---------------------------------------------
     THE CARD'S OWN FURNITURE OUTRANKS THE HOUSE RULE, for these three and
     nothing else.

     "Everything is bevelled, nothing is rounded" is a system rule and
     `bevel.radius` exists only to be zero. A disc breaks it. It is allowed here
     because power, defence and cost are not chrome the system invented — they
     are three values a player reads off a physical card, and on that card they
     are a disc, a shield and a disc. A chamfered square carrying a `4` is the
     system being consistent with itself at the reader's expense; the reader has
     the card in their hand.

     The scope of the exemption is exactly these three tokens. Everything else
     in the interface stays square, and the pitch diamond stays reserved. */
  "ornament.cut.disc": "circle(50% at 50% 50%)",
  /* A shield: square shoulders, a deep body, and a point at the foot that takes
     the bottom quarter rather than the bottom half. Drawn shallow deliberately —
     at a half-height point the silhouette stops reading as a shield and starts
     reading as a downward arrow, which is a different thing to have put next to
     a number. Percentages, so it holds at every plate size. */
  "ornament.cut.shield": "polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)",

  /* THE BASE STEP IS THE STAT PLATE'S SIZE PLUS AN OPTICAL SIXTEENTH, and the
     sixteenth is arithmetic rather than taste.

     Two shapes of the same bounding box do not read as the same size; the eye
     compares ink, not boxes. Against a unit square the disc `ornament.cut.disc`
     covers π/4 ≈ 0.785 of it and the diamond `ornament.cut.jewel` covers 0.700
     — its four cut corners are what the shoelace of that polygon gives back. So
     matching the ink means scaling the stone by √(0.785 / 0.700) ≈ 1.059, and
     2.25rem × 1.059 lands here. Set the two equal instead and the stone reads a
     shade small beside the cost disc it shares a line with, which is the whole
     complaint this step exists to answer.

     `large` moves with it so the top of the scale keeps its ~1.4 step off
     `base` instead of collapsing onto it. Nothing in the product asks for `lg`
     today — only the design-system page renders it — so that half is
     housekeeping, not a change anybody will see.

     `small` DELIBERATELY STAYS PUT, which does widen the gap under `base` to
     ~1.9. It is not the same job: `small` is the stone set inline beside micro
     type — the version tabs, a related-cards link, a search result's lead — and
     it is sized against that type rather than against the stat plates it never
     appears next to. Dragging it up to preserve a tidy ratio would resize four
     surfaces to fix an arithmetic itch on none of them. */
  "ornament.jewel.small": "1.25rem",
  "ornament.jewel.base": "2.375rem",
  "ornament.jewel.large": "3.375rem",

  /* THE MARK IS SIZED BY HEIGHT, NOT BY A SQUARE, because it is no longer a
     square. The chain is roughly twice as wide as it is tall, so one dimension
     is set and the other follows from the `viewBox` — asking for a 20×20 box
     would letterbox it and asking for 20×43 would put a second number here to
     keep in step with the geometry.

     It borrowed `ornament.jewel.*` while the mark WAS the jewel. That stopped
     being true, and the jewel steps stayed with the pitch stone they are named
     for: `PitchJewel` is still square and still the interface primitive. */
  "ornament.mark.small": "0.875rem",
  "ornament.mark.base": "1.25rem",
  "ornament.mark.large": "1.75rem",

  /* THE PITCH BAND'S WIDTHS, AND THEY ARE ITS OWN FOR THE REASON THE MARK'S
     ARE. `PitchRule` shipped borrowing `ornament.filigree.size` for its base
     step and `ornament.mark.small` for its small one — two other reserved
     objects' sizes, chosen because the numbers happened to look right. That is
     the same shape of borrow the block above records the mark escaping from,
     and it fails the same way: a future change to filigree sizing would
     silently resize every pitch band in the card index, on a commit about
     scrollwork.

     The values are what the borrowed tokens hold today, so this is a rename
     rather than a redesign. What changes is that they can now move
     independently, which is the whole point of a token having a name.

     NO THICKNESS TOKEN, deliberately. The band is `calc(bevel.width * 3)`, and
     that is a real relationship rather than a borrow: the band carries a bevel
     edge top and bottom, so it must never be thinner than the two of them plus
     the colour between. Expressed as a constant it would be a number that
     silently stops being true the day the bevel changes. */
  "ornament.band.small": "0.875rem",
  "ornament.band.base": "1.25rem",

  /* NO `ornament.pitch-box.*`, DELIBERATELY, AND THIS NOTE IS WHY THERE IS NO
     ENTRY RATHER THAN A GAP. `PitchBox` is a label in a clipped plate — its
     words plus the pill's padding — so both of its dimensions fall out of the
     type and space tokens it already reads. A width token here would be a
     number kept in step with the length of "NO PITCH" at whatever size the box
     is set: a second copy of a measurement the text owns, which is the failure
     `MARK_GEOMETRY` exists to avoid one primitive over. It briefly had two,
     from a draft where the mark was a vertical spine of fixed width. */

  /* The two widths a card face is published at, for exactly the reason the
     jewel's sizes are here: the face host serves `thumb` and `normal` and
     nothing else, so a surface free to pick its own width would be asking for a
     size that does not exist. 180px and 450px, stated in rem so a reader who
     scales their text scales the grid with it.

     The heights are deliberately absent. A card is 63:88 and the `width`/
     `height` attributes carry the real pixel box per image — a second copy of
     the ratio in CSS is a second place for it to be wrong. */
  "card.face.thumb": "11.25rem",
  "card.face.normal": "28.125rem",

  /* The two container widths, separated from the measure they used to borrow.

     `page.measure` is the same number as `type.measure` and that is not a
     redundancy — it is the whole point. A page of prose wants a container the
     width of a line because it holds nothing but lines; a page holding a card
     face and a column of facts does not. Stating them as two tokens that happen
     to agree is what lets one move without dragging the other, and until they
     were separate every attempt to widen a page was a proposal to change the
     reading measure of the entire site.

     `page.wide` is a face, a gutter and a measure, added up — and it is written
     as references rather than as numbers so it stays that way. Every term is a
     value the system already committed to elsewhere, so there is no chosen
     number here to drift from the other two, which is the property the card
     page's inline `calc()` had and could not share with anything else.

     NOTE THE ASYMMETRY, WHICH IS DELIBERATE. `page.wide` refers to
     `type.measure` and `page.measure` does not, even though they agree today.
     The wide page genuinely IS a face beside a column of prose, so its width
     should follow the measure wherever the measure goes. The narrow page is a
     container that happens to be measure-sized right now and must be free to
     stop being — if it referred to `type.measure` the two would be one token
     again under a second name, and this whole layer would have bought nothing. */
  "layout.page.measure": "46rem",
  "layout.page.wide":
    "calc(var(--of-card-face-normal) + var(--of-space-loosest) + var(--of-type-measure))",

  /* HOW WIDE A CARD IS DRAWN IN AN INDEX, WHICH IS NOT A TIER.

     `card.face.*` above are the two widths the host SERVES, and their comment
     is right that a surface may not invent a third — asking for one would be
     asking for a URL that 404s. This is the different question: how wide the
     browser LAYS the picture out, which is a fact about a grid rather than
     about a store. The join between them is `srcset`, so a cell this wide is
     satisfied by the 450px tier on a dense screen and by the 180px one on a
     phone, and neither number is chosen here.

     240px, and it is measured rather than picked. Scryfall — the reference
     `docs/SCRYFALL-GAP.md` names — draws its image results at 245px in a grid
     capped at 1000px, four across. That is the size at which a card face is
     readable as a card rather than as a stamp: the name and the pitch colour
     carry at a glance and the art is still art. Our thumb tier is 180px, which
     is why the grid it used to draw read as a contact sheet.

     `layout.card.cell`, NOT `card.face.cell`, and the namespace is the whole of
     the distinction. Anything under `card.face` is a promise the face host
     keeps. This is a promise the layout keeps. */
  "layout.card.cell": "15rem",

  /* HOW WIDE A CARD IS DRAWN AT THE HEAD OF A LIST ROW.

     THE LIST VIEW USED TO CARRY NO PICTURE AT ALL, which made it the one
     screen where this site contradicts its own argument: `docs/DESIGN.md`
     calls recognising a card by its face "the single largest difference
     between this and every text-list card tool in the game", and the densest
     card list we publish was a text-list card tool. Scryfall's checklist has
     the same hole and it is the weakest of its four views for exactly this
     reason — sixty rows of set, number, name and cost, with the one channel
     that identifies a card at a glance left out.

     44px, AND IT IS THE DENSITY THAT CHOSE IT RATHER THAN THE PICTURE. A row
     is 72px with no face. Measured across the three candidates: this takes it
     to 86px, 3.5rem takes it to 103px and 4.5rem to 126px — so the sizes that
     render the art comfortably cost a third to nearly half of the rows on a
     screen, in the view whose entire reason to exist is density. A sixth is
     the price worth paying.

     IT IS A RECOGNITION THUMBNAIL, NOT A LEGIBLE ONE, and the difference is
     the whole argument for going this small. The card's own printed name is
     unreadable here and does not need to be read — the name is set beside it
     in serif at `type.size.large`. What survives at this size is the frame
     colour, the class border and the silhouette of the art, which is what
     lets a reader find a card they have seen before without reading anything.
     Bigger starts competing with the name for the eye, which is the grid's
     job and not this view's.

     `layout.card.row`, NOT `card.face.row`, for the reason `layout.card.cell`
     states beside it: anything under `card.face` is a width the face host
     promises to serve, and this is a width the layout draws at. The row is
     satisfied by the `thumb` tier, which is 180px and therefore a comfortable
     downscale rather than a new tier nobody publishes. */
  "layout.card.row": "2.75rem",

  /* THE POINTER-TARGET FLOOR — 24px, which is what WCAG 2.5.8 (AA) sets.
     Anything that is the ONLY way to reach a destination must be at least this
     across, in both axes.

     IT IS A TOKEN BECAUSE IT WAS ARITHMETIC, AND THE ARITHMETIC BROKE. It was
     spelled once, in a comment beside `.of-card__pitch-link`: the mark inside
     was `ornament.jewel.small`, 1.25rem, and `space.tightest` a side "takes the
     box to exactly 24px". True of a 20px stone; the day the stone became a
     `PitchBox` — a shorter object — the padding stayed, the sum fell to about
     17px, and the comment went on asserting compliance. A floor stated as a
     minimum holds whatever is put inside it; a floor stated as a sum holds
     until someone changes an addend in another file.

     `min-*-size` RATHER THAN A PADDING, for the same reason. Padding that adds
     up to the floor has to be recomputed every time the content changes size;
     a minimum simply cannot be under it. */
  "layout.target.min": "1.5rem",

  /* FOUR CELLS AND THE GUTTERS BETWEEN THEM, added up — written as references
     for the same reason `page.wide` is, so there is no chosen number here to
     drift from the cell size it is built out of.

     `page.wide` could not do this job. It is a FACE BESIDE A COLUMN OF PROSE,
     which is what a card page is, and a list of cards is neither of those
     things — using it would have made the index's width follow the reading
     measure, so tuning line length on `/cr` would have silently changed how
     many cards fit in a row on `/search`.

     Four is the count rather than an accident of the arithmetic: the grid is
     `auto-fill`, so a narrower viewport takes three or two and a wider one
     cannot take five, because this is where the container stops. Four card
     faces is the widest row a reader scans without losing the left edge, and it
     is what the reference settled on. 61.5rem — 984px — against Scryfall's
     1000. */
  "layout.page.index":
    "calc(4 * var(--of-layout-card-cell) + 3 * var(--of-space-tight))",

  /* Quick enough not to be noticed, slow enough not to flicker. */
  "motion.fast": "120ms",
  "motion.base": "180ms",
  "motion.slow": "280ms",
  "motion.ease": "cubic-bezier(0.2, 0, 0.2, 1)",
};

/* -------------------------------------------------------------------------- */
/* Dark — the native key                                                       */
/* -------------------------------------------------------------------------- */

export const DARK_TOKENS: TokenTable = {
  ...STRUCTURE,

  /* Near-black ground, and true neutrals throughout. */
  "color.ground": "#1a1a1a",
  "color.sunken": "#131313",
  "color.surface": "#232323",
  "color.surface.raised": "#2c2c2c",

  "color.ink": "#ededed",
  "color.ink.muted": "#a6a6a6",
  /* LIFTED FROM `#6e6e6e`, WHICH CLEARED ITS OWN FLOOR ON ONLY SOME GROUNDS.
     `ink.faint` is the large-text ink and `tokens.test.ts` holds it to 3:1
     rather than 4.5:1 — but it asserted that against `color.ground` alone,
     where the old value scored 3.41 and passed. On `surface` it was 3.08, and
     on `surface.raised` 2.74: below the threshold this token is allowed to
     stop at, on the ground a raised plate gives it.

     Light mode was already clear on all four (3.06 to 4.51), so this was the
     exact asymmetry that file's opening comment names — "a palette that passes
     in the mode its author uses and fails in the other is the normal outcome".
     It survived because the assertion was narrower than the usage.

     `#787878` clears 3:1 on every dark ground with room to spare — 3.94, 3.56,
     3.16, 4.21 — and stays a true neutral, equal in all three channels, which
     is the constraint at the top of this file. */
  "color.ink.faint": "#787878",
  "color.ink.inverse": "#0b0b0b",

  /* Hairline rules rather than cards and shadows. */
  "color.rule": "#2b2b2b",
  "color.rule.strong": "#3f3f3f",

  /* Blood. The game's own accent, and chrome rather than data — it can share a
     hue with pitch because it never shares a shape. */
  "color.accent": "#cf1f2b",
  "color.accent.hover": "#d92531",
  "color.accent.ink": "#ffffff",

  /*
    LINK TEXT IS ITS OWN TOKEN, because on a near-black ground the accent was
    being asked to be two incompatible things at once.

    As a SURFACE — the `NEW` badge, the search well's rule, a focus outline —
    it has to stay dark enough to carry `accent.ink`, and white on `#cf1f2b`
    is 5.41:1. As TEXT it has to stand off the ground, and `#cf1f2b` on
    `color.ground` is 3.22:1, which is below AA for body text. Every route to
    fixing one broke the other, so the two uses are separated instead.

    `color.link` is the same blood hue lightened and pulled back from full
    chroma — 5.62:1 on the ground, and it still clears 4.5:1 on `sunken`,
    `surface` and `surface.raised`, which is what `tokens.test.ts` asserts.
    That is also why it reads as toned DOWN while being easier to read: the
    old value was loud in saturation and quiet in luminance, and only
    luminance is what contrast is made of.

    The accent itself is unchanged. Nothing that paints a background moved.
  */
  "color.link": "#e17076",
  "color.link.hover": "#e98388",

  /* Brass, reserved for authority: the verified judge seal and nothing else.
     A material used once is a signal; used twice it is a theme. */
  "color.brass": "#b08d3f",
  "color.brass.ink": "#141007",
  "color.brass.edge": "#d8b45f",

  /* Pitch. The numeral is the primary channel and colour is redundant — red and
     yellow are the classic deuteranopia confusion pair, and pitch is the
     most-read value on a card. Each value carries its own ink so the numeral
     stays legible on its own stone rather than on an average of the three. */
  "color.pitch.none": "#4a4a4a",
  "color.pitch.none.ink": "#ededed",
  "color.pitch.one": "#c62b30",
  "color.pitch.one.ink": "#ffffff",
  "color.pitch.two": "#d9a520",
  "color.pitch.two.ink": "#171307",
  "color.pitch.three": "#3277bd",
  "color.pitch.three.ink": "#ffffff",

  /* PITCH FOUR IS A TOKEN NOBODY CAN RENDER YET, AND THAT IS THE POINT OF IT.
     A fourth pitch value has been shown on a preview of a Shadow resource gem
     — a purple strip, card code IAR000.

     THE ONE THING THIS REPOSITORY CAN BACK IS THE NARROW CLAIM: no card in
     `data/cards` carries `pitch: "4"` — zero of the current 4,941 — so nothing
     here renders this stone today. Note what is NOT claimed, because an earlier
     wording claimed it and was wrong: the corpus does hold `IAR` cards already
     ("Baalghor, Omen of the End" at IAR159 among them — one card, and the
     comma is part of its name), so "no card from that set" is
     false. What `data/sets/sets.json` says is set-level and still true — `IAR`
     is "??? Set 20 ???" with `released: null`. Whether the gem ships as
     previewed is upstream's business and not ours to assert.

     THE PALETTE IS READY AHEAD OF THE DATA ON PURPOSE. The alternative is
     discovering the gap on the day a `pitch: "4"` card enters the corpus — that
     is the trigger, not the day `IAR` lands, which has partly happened already —
     in a decoder that answers `0` and a stylesheet that answers grey, neither of
     which fails anything. Cheap now, silent later; that is the whole trade, and
     it does not need the card to be certain to be worth taking.

     It is a token because it is exactly the shape of fact that gets hard-coded
     at the call site and then found again, wrong, in four places: the jewel,
     the band, the card panel's overline and the design-system page all read
     this one id.

     PURPLE IS THE CARD'S OWN COLOUR, not a slot chosen off a wheel. The other
     three stones are the printed strips' hues and this is no different.

     IT IS THE ONE STONE WHOSE COLOUR CHANNEL IS WEAKEST, and that is worth
     stating rather than discovering. Purple sits next to blue in luminance
     wherever it is also legible under white ink — brighter than this and the
     numeral fails contrast, darker and the stone disappears into the ground —
     so pitch three and pitch four are separated by hue alone for a reader with
     deuteranopia or protanopia, where red and yellow at least have the
     luminance gap the test below pins. The numeral is what tells them apart,
     which is the arrangement this whole block is built around: colour has never
     been the channel, and here it is carrying less than usual rather than
     something new. */
  "color.pitch.four": "#8a4fbf",
  "color.pitch.four.ink": "#ffffff",
  "color.pitch.facet": "#ffffff",

  /* State. The notch says "this carries state"; the colour says which. */
  /* Every coloured chip carries its own ink, exactly as every pitch stone does.
     A single shared ink token forces every state to sit in the same luminance
     band to stay legible — which is how `verified` would have ended up as a
     muddy brown rather than brass. */
  "color.state.legal": "#2f7d4f",
  "color.state.legal.ink": "#ffffff",
  "color.state.banned": "#a3131b",
  "color.state.banned.ink": "#ffffff",
  "color.state.suspended": "#8f5415",
  "color.state.suspended.ink": "#ffffff",
  "color.state.restricted": "#6f5aa6",
  "color.state.restricted.ink": "#ffffff",
  "color.state.living-legend": "#46606f",
  "color.state.living-legend.ink": "#ffffff",
  "color.state.not-in-format": "#4a4a4a",
  "color.state.not-in-format.ink": "#ffffff",
  "color.state.verified": "#b08d3f",
  "color.state.verified.ink": "#141007",
  "color.state.unverified": "#8a6a12",
  "color.state.unverified.ink": "#ffffff",

  /* Stats. The third place boldness is spent, and the argument is the same one
     that justified the first two: this is DATA, not decoration — the colour
     says which stat you are reading, exactly as the pitch stone's does.

     Power takes the game's yellow and cost its red, and those are deliberately
     the same two inks as `pitch.two` and `pitch.one` rather than two new hues
     invented to avoid a collision. They are the game's own two colours; a
     reader who has held a card already reads yellow as attack and red as
     resource. What is reserved to pitch is the OCTAGON, not the hue, and a disc
     is not a cut stone.

     Defence is steel — a true neutral, like every other neutral here, because a
     shield that is faintly blue reads as a website's icon rather than as metal.
     It carries dark ink in the dark theme and light ink in the light one, which
     is the opposite of every other chip on this list and is why it needs its
     own ink token rather than a shared one. */
  "color.stat.power": "#d9a520",
  "color.stat.power.ink": "#171307",
  "color.stat.defence": "#a9a9a9",
  "color.stat.defence.ink": "#141414",
  /* GRAPHITE, NOT RED, and the reason is a collision rather than a preference.
     Cost was given `pitch.one`s exact red on the argument that the reserved
     thing is the octagon and not the hue. That argument died when the jewel
     became a vertex-up octagon with all four corners cut: at the size these are
     read, a red cut stone and a red disc are the same object, and the pitch
     jewel — the one silhouette this system reserves — stopped being findable on
     the page it heads. The card agrees: its cost plate is dark, and the
     COLOURED circle is the pitch. */
  /* Lifted off `surface.raised`. At `#3a3a3a` the disc was ~1.2:1 against the
     plate it sits on, so the SHAPE — one of the three redundant channels this
     component promises — was gone in the dark theme and only the numeral read.
     Dark enough to be graphite rather than steel, light enough to have an
     edge. */
  "color.stat.cost": "#5e5e5e",
  "color.stat.cost.ink": "#ededed",

  /* Intellect and life, and THE RULE THAT DECIDES WHICH STATS GET A COLOUR IS
     NOT "the important ones" — it is whether the game prints a notation for
     them.

     The Comprehensive Rules name eight symbols at 1.12.4, and intellect ({i},
     1.12.4b) and life ({h}, 1.12.4c) are two of them. Both are published as
     discs on LSS's own rules site — light blue and green — and this project
     already ships those exact files, with provenance, for the inline `{i}` and
     `{h}` a reader meets in card text. So a hero's intellect was being drawn as
     a grey forward-leaning square directly beneath the blue disc that means
     intellect, which is the "private notation" failure this repository has
     already diagnosed once and reversed.

     Arcane is deliberately NOT here, and it is the case that proves the rule
     rather than an omission: 1.12.4 does not name it, LSS publishes no icon for
     it, and there is no printed register to take. It keeps the house plate — a
     chamfered square in the default ink — which is now what "this stat has no
     printed notation" looks like.

     THE REGISTER, NOT THE ARTWORK, exactly as cost, power and defence took it.
     The disc and the hue are the card's; every byte here is ours, and the
     motifs LSS strikes into their discs — the crown, the koru — are not
     redrawn, because those are drawings rather than mechanics.

     WHICH SEPARATIONS ARE LOAD-BEARING, since six plates cannot all be pairwise
     distinct by luminance and pretending otherwise is how a threshold gets
     quietly dropped. Only the pairs that share a card matter:

       intellect / life   — every hero prints both
       power / life       — 44 non-hero permanents print both, `Aegis,
                            Archangel of Protection` among them

     Green and yellow at a shared lightness is the deuteranopia pair all over
     again, which is why life is driven well clear of power rather than left at
     the mid green it wants to be. intellect / power is NOT pinned: no card
     prints both, so spending contrast on it would cost one of the pairs above.
     `tokens.test.ts` asserts exactly these two. */
  "color.stat.intellect": "#7ec4e6",
  "color.stat.intellect.ink": "#0b1519",
  "color.stat.life": "#5aa544",
  "color.stat.life.ink": "#0a1405",

  /* THE SLOT EXISTS AND IS EMPTY — which is a different statement from a zero,
     and the reason this is a colour rather than a missing element.

     1,648 cards print a cost of 0, 191 a defence of 0 and 13 a power of 0. So
     "0" is a real, common, printed value, and a card page that answered "no
     printed power" by rendering nothing at all left the reader to infer an
     absence from a gap — indistinguishable from a layout they had not scrolled
     to. An absent stat now keeps its silhouette, because the shape is what says
     WHICH stat is missing, and takes this recessed plate with an en dash in it.

     RECESSED RATHER THAN TINTED. It is darker than every other chip in this
     table here and lighter than every one of them in the light table, so on
     either ground it reads as a socket rather than as a seventh stat with a
     colour of its own. It is deliberately far from `stat.defence`, the other
     neutral, which is a mid steel in both themes. Same idiom as the pitch
     jewel's `none` stone, which has meant exactly this since it was drawn.

     IT IS ~1.4:1 AGAINST THE PANEL AND THAT IS NOT THE CHANNEL. Receding is the
     stated goal, so the fill deliberately sits close to the ground — but the
     SHAPE is what says which stat is missing, and the shape is drawn by the
     inset bevel `.of-stat` puts on every plate, which `.of-stat--absent` does
     not touch. A test in `primitives.test.tsx` pins that it does not. Nor is
     the ratio out of family: the weakest existing plate, cost in this table, is
     2.42:1 against the same panel, so fill-against-ground is not a threshold
     any plate here is held to. What is held, and asserted in `tokens.test.ts`,
     is the ink on the plate. */
  "color.stat.absent": "#3a3a3a",
  "color.stat.absent.ink": "#c8c8c8",

  /* Rarity. Ten of them, and the honest note at the top has been overtaken:
     SIX OF THESE ARE NOW READ OFF A PRINTED CARD, AND FOUR ARE STILL OURS.

     This block used to open "THESE ARE OPTFALL'S COLOURS, NOT LEGEND STORY
     STUDIOS'" — nothing in the published dataset names a colour for a rarity,
     so the hue was a grouping and never a claim. The dataset still names none.
     The CARD does: every printing carries its rarity as a filled disc with a
     single letter in its bottom margin, and that disc has a colour anybody can
     read off an image. Refusing to look at it was not caution, it was declining
     to check.

     SAMPLED, WITH THE PRINTING NAMED, SO THE CLAIM IS RE-DERIVABLE. Median of
     the disc body over its interquartile range, letter and rim excluded, taken
     from the card images this project already serves:

       Rare        blue                 MPW075
       Super Rare  violet               SUP021
       Majestic    red                  MST131
       Legendary   amber                EVR154
       Fabled      gold, and a DIAMOND  ANQ002
       Promo       green                GEM088

     WHERE THE CARD SAYS NOTHING, WE STILL DO. Common, Token and Basic are the
     same grey on the card — three samples inside about two ΔE of each other —
     so the card distinguishes them by their letter alone and has nothing to
     tell us about telling them apart at a glance. They keep the values they
     had. So does Marvel: no printing was found rendering a Marvel mark on its
     face, and inventing one to complete the set is the exact move the original
     note was written to prevent.

     THE HUE IS THE CARD'S AND THE LUMINANCE IS OURS, which is the whole of the
     adaptation. A printed disc is a foil mark a few millimetres across and
     carries a white letter at about 2.9:1; the same colour in a bubble on a
     page is a UI element held to AA by `tokens.test.ts`. So each sampled hue
     was kept and darkened until white cleared 4.5 — Rare and Promo needed it,
     Super Rare and Majestic already passed — while Legendary and Fabled keep
     the card's value and take the dark ink Legendary already used, because
     darkening an amber far enough for white ink is how you stop having an
     amber.

     BRASS IS STILL NOT AVAILABLE, including to Promo, where it was the obvious
     choice before the card answered the question. "A material used once is a
     signal; used twice it is a theme", and brass is spent on verified
     attribution. Promo is green because the card is green.

     WHAT THIS COST THE OLD RAMP, named rather than quietly dropped. Legendary
     was a lemon yellow chosen to sit one rank from Majestic's gold and measured
     against it at 29 ΔE dark and 24 light; Majestic is red now and Legendary
     amber, so that pair is 41.9 ΔE dark and 37.1 light — further apart than the
     arrangement the measurement was defending. The pair `tokens.test.ts` pins
     is the same pair; only the colours under it changed.

     FABLED IS THE ONE PLACE FIDELITY STOPS. The card prints it as a gold
     diamond with no letter — the only rarity it separates by SHAPE rather than
     by hue — and this table has no shape to give. Colour alone clears the
     ramp's floor against Legendary at 15.6 ΔE dark and 13.7 light, so the gold
     is taken and the diamond is not. If that ever feels too close in use, the
     answer is `ornament.cut.*` and not a hue nobody printed. */
  "color.rarity.common": "#6e6e6e",
  "color.rarity.common.ink": "#ffffff",
  "color.rarity.rare": "#3c79a6",
  "color.rarity.rare.ink": "#ffffff",
  /* SUPER RARE IS VIOLET, AND IT USED TO BE A BLUE. Two notes lived here and
     both are worth keeping, because between them they are the reason this whole
     block now cites a printing.

     ~~It was `#4a7fa8`, on which white lands at 4.29:1 — under the 4.5 the
     letter needs — and it was darkened by a hair to `#3d6e95` to clear it.~~
     That fix was right and the colour under it was not: the card prints Super
     Rare violet, and the blue it was being carefully adjusted toward belongs to
     Rare. Two rarities one rank apart had been given each other's rough
     neighbourhood, and no amount of contrast tuning was going to find that —
     nothing in the dataset says what colour a rarity is, so there was nothing
     to be wrong against until somebody looked at a card.

     The sampled violet needs no adjustment: white lands on it at 6.12:1. */
  "color.rarity.super": "#79538c",
  "color.rarity.super.ink": "#ffffff",
  "color.rarity.majestic": "#a64339",
  "color.rarity.majestic.ink": "#ffffff",
  "color.rarity.legendary": "#dc9f58",
  "color.rarity.legendary.ink": "#171307",
  "color.rarity.fabled": "#d5b766",
  "color.rarity.fabled.ink": "#171307",
  "color.rarity.token": "#4a4a4a",
  "color.rarity.token.ink": "#ededed",
  "color.rarity.basic": "#3f5764",
  "color.rarity.basic.ink": "#ffffff",
  "color.rarity.marvel": "#2f7d6f",
  "color.rarity.marvel.ink": "#ffffff",
  "color.rarity.promo": "#3e8340",
  "color.rarity.promo.ink": "#ffffff",

  /* Bevel: light top edge, dark bottom edge, so plates read as struck metal. */
  "bevel.light": "rgba(255, 255, 255, 0.09)",
  "bevel.dark": "rgba(0, 0, 0, 0.6)",

  "ornament.filigree.ink": "#3f3f3f",

  /* BRASS RATHER THAN BLUE. The focus ring was a pale system blue — the one
     colour on the page that belonged to no part of the palette, and the more
     visible for it on every field and pill. Brass is already the site's second
     metal, it is nothing like the accent so a focused control is never mistaken
     for a selected or errored one, and it clears contrast against both grounds
     — asserted in `tokens.test.ts`, which had no reference to `color.focus` at
     all when an earlier revision of this comment said it did. */
  "color.focus": "#d8b45f",
};

/* -------------------------------------------------------------------------- */
/* Light — the printed-rulebook translation                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ash and iron. The ground is deliberately a mid grey rather than white: this
 * is a rulebook printed on stock, not a web page. Accent and brass are darkened
 * rather than reused, because the same hue that reads as blood on near-black
 * reads as pink on ash and fails contrast besides.
 */
export const LIGHT_TOKENS: TokenTable = {
  ...STRUCTURE,

  "color.ground": "#d5d5d5",
  "color.sunken": "#c4c4c4",
  "color.surface": "#e0e0e0",
  "color.surface.raised": "#ececec",

  "color.ink": "#161616",
  "color.ink.muted": "#474747",
  "color.ink.faint": "#6b6b6b",
  "color.ink.inverse": "#f2f2f2",

  "color.rule": "#b4b4b4",
  "color.rule.strong": "#8f8f8f",

  "color.accent": "#94101a",
  "color.accent.hover": "#7a0d15",
  "color.accent.ink": "#ffffff",

  /*
    LIGHT NEVER HAD THE PROBLEM DARK HAD, so the link takes the accent's own
    values rather than a lightened relative of them: `#94101a` on `#d5d5d5` is
    6.09:1, and its worst ground here is `sunken` at 5.13:1. Ash darkens the
    accent already, which is the whole reason this theme has its own red.

    Written out rather than aliased so the two themes stay independently
    readable, and so a future change to one cannot silently move the other.
  */
  "color.link": "#94101a",
  "color.link.hover": "#7a0d15",

  "color.brass": "#6d541b",
  "color.brass.ink": "#f5efdd",
  "color.brass.edge": "#8d7029",

  /* Pitch two keeps a light stone with dark ink here rather than being forced
     dark to match its neighbours. Driving yellow dark enough for white text
     turns it olive, which loses the hue AND collapses its luminance onto red's
     — leaving the deuteranopia confusion pair separated by nothing but the
     numeral. Letting it stay yellow keeps two channels working. */
  "color.pitch.none": "#6b6b6b",
  "color.pitch.none.ink": "#ffffff",
  "color.pitch.one": "#a81f25",
  "color.pitch.one.ink": "#ffffff",
  "color.pitch.two": "#c9971f",
  "color.pitch.two.ink": "#1a1405",
  "color.pitch.three": "#245d99",
  "color.pitch.three.ink": "#ffffff",

  /* Pitch four re-checked against this ground rather than translated from the
     dark table, exactly as every other stone here is: the dark table's violet
     on an ash ground is a lavender sitting on top of the page instead of a
     stone struck into it. Deepened until it reads as the same material as the
     red and the blue beside it, which also buys the numeral more headroom than
     it has in the other key. */
  "color.pitch.four": "#6f3aa0",
  "color.pitch.four.ink": "#ffffff",
  "color.pitch.facet": "#ffffff",

  "color.state.legal": "#1f6039",
  "color.state.legal.ink": "#ffffff",
  "color.state.banned": "#8c1016",
  "color.state.banned.ink": "#ffffff",
  "color.state.suspended": "#8a4f11",
  "color.state.suspended.ink": "#ffffff",
  "color.state.restricted": "#57458a",
  "color.state.restricted.ink": "#ffffff",
  "color.state.living-legend": "#3f5764",
  "color.state.living-legend.ink": "#ffffff",
  "color.state.not-in-format": "#5c5c5c",
  "color.state.not-in-format.ink": "#ffffff",
  "color.state.verified": "#6d541b",
  "color.state.verified.ink": "#ffffff",
  "color.state.unverified": "#6f5410",
  "color.state.unverified.ink": "#ffffff",

  /* Power keeps a light stone with dark ink for the same reason `pitch.two`
     does — driving yellow dark enough for white text turns it olive. Defence
     inverts between the themes: silver on near-black is a light plate with dark
     ink, and on an ash ground it has to darken to stay a plate at all, so it
     takes light ink here. That inversion is why defence carries its own ink
     token rather than sharing one. */
  "color.stat.power": "#c9971f",
  "color.stat.power.ink": "#1a1405",
  "color.stat.defence": "#767676",
  "color.stat.defence.ink": "#ffffff",
  "color.stat.cost": "#5c5c5c",
  "color.stat.cost.ink": "#ffffff",

  /* Intellect and life, re-checked here rather than translated from the dark
     table — see it for why these two stats have a colour at all and arcane does
     not.

     THE TWO DO NOT DARKEN TOGETHER, which is the whole difficulty of this pair
     on an ash ground. Blue and green both want to go dark to hold against a
     light surface, and taken independently they land within 0.01 of each other
     in luminance — indistinguishable on a hero card, which is the one card that
     prints both. So they are split deliberately: intellect stays a mid blue
     with dark ink, life goes dark enough to carry white. That also keeps life
     clear of power, the other pair that shares a card.

     The direction is the opposite of the dark table's for life, which is the
     same thing defence does one block up and for the same reason: what recedes
     or holds is a fact about the ground, not a property of the hue. */
  "color.stat.intellect": "#3f96bd",
  "color.stat.intellect.ink": "#0b1519",
  "color.stat.life": "#2f6b28",
  "color.stat.life.ink": "#ffffff",

  /* The empty socket, translated rather than reused: on an ash ground it is
     LIGHTER than every other chip, where in the dark table it is darker than
     every one of them. Both readings are "recessed"; the direction is whatever
     recedes against the ground it is on. Checked against its own ink here
     rather than carried over, which is the rule this whole table follows. */
  "color.stat.absent": "#b8b8b8",
  "color.stat.absent.ink": "#2a2a2a",

  /* Darkened to hold the same separation against an ash ground, and every one
     of them re-checked for contrast against its own ink rather than translated
     by formula from the dark table — which is the rule this whole file follows.
     See the dark table for why these are ours and not LSS's, and for why brass
     is unavailable to Promo. */
  "color.rarity.common": "#5c5c5c",
  "color.rarity.common.ink": "#ffffff",
  "color.rarity.rare": "#376e97",
  "color.rarity.rare.ink": "#ffffff",
  "color.rarity.super": "#79538c",
  "color.rarity.super.ink": "#ffffff",
  "color.rarity.majestic": "#a64339",
  "color.rarity.majestic.ink": "#ffffff",
  "color.rarity.legendary": "#c68f4f",
  "color.rarity.legendary.ink": "#1a1405",
  "color.rarity.fabled": "#b79d58",
  "color.rarity.fabled.ink": "#1a1405",
  "color.rarity.token": "#767676",
  "color.rarity.token.ink": "#ffffff",
  "color.rarity.basic": "#334855",
  "color.rarity.basic.ink": "#ffffff",
  "color.rarity.marvel": "#1f6155",
  "color.rarity.marvel.ink": "#ffffff",
  "color.rarity.promo": "#38763a",
  "color.rarity.promo.ink": "#ffffff",

  "bevel.light": "rgba(255, 255, 255, 0.85)",
  "bevel.dark": "rgba(0, 0, 0, 0.22)",

  "ornament.filigree.ink": "#9a9a9a",

  "color.focus": "#6d541b",
};
