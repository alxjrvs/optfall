<script lang="ts">
  /**
   * The row of faces along the foot of the front door.
   *
   * WHY A DOOR THAT REFUSES DECORATION HAS ONE. `docs/DESIGN.md` rules out a
   * marketing hero and an illustration above the fold, and this is neither: it
   * sits BELOW the field, below the links, in the empty half of the screen the
   * door already had — measured, the page was exactly the height of the fold
   * with the field at 145px and nothing under it.
   *
   * What it buys is the one thing a paragraph cannot: it says *this is a card
   * database* in the time it takes to look at it, which is the job the five
   * deleted paragraphs of "what this is" were failing to do. Scryfall puts a
   * row of art in exactly this slot for exactly this reason, and it is the one
   * place on that site where decoration is doing work rather than filling
   * space.
   *
   * IT IS A BAND, NOT AN ORNAMENT AT THE END OF THE PAGE. The cards run off the
   * bottom of their box and the document carries on beneath them, which is what
   * makes them read as the top of a pile rather than as a finishing flourish.
   *
   * EVERY NAME STAYS READABLE, and that constraint drove the layout more than
   * any other. A card's name is a banner across its top spanning nearly the
   * full width, so an overlap that hides a third of a card takes half its name
   * with it. The step across is therefore a quarter of a card and no more, and
   * the alternating rise is what keeps each name clear of its neighbour's
   * shoulder rather than a decorative wobble.
   *
   * IT IS ALSO SIX REAL LINKS. The door had two content links; a reader who
   * arrives without a card in mind now has somewhere to go that is a card
   * rather than a list of cards. Nothing here is a picture OF a card — every
   * face is the card, and clicking it lands on its page.
   *
   * COMPLIANCE IS WHY IT COMPOSES `CardFaceGroup` RATHER THAN WRITING `<img>`.
   * Card images are permitted on the condition that a copyright line accompanies
   * them, and `docs/COMPLIANCE.md` §5 designs that so a caller cannot get it
   * wrong: `CardFace` emits the notice itself unless an ancestor group is
   * carrying one, and `CardFaceGroup` is the only thing that can say so — via
   * context, so markup cannot forge it. Six faces under one group is one
   * notice, correctly, and there is no arrangement of this file that produces a
   * face without one.
   *
   * A GROUP HERE IS SIX DIFFERENT CARDS, which `CardFaceGroup` permits on the
   * test that matters: the faces are one row on one screen with the notice
   * directly beneath them, so the line accompanies every image it covers. That
   * contract tests visibility rather than counting cards, and this row is the
   * caller it was rewritten for.
   *
   * NOT HYDRATED. It renders on the build machine and ships as markup; there is
   * no state here, and a decoration that costs JavaScript on the page whose
   * whole point is to be cheap would be the wrong trade twice over.
   */
  import { CardFace, CardFaceGroup } from "optfall-components/svelte";

  import { FACE_TIERS, faceUrl } from "../lib/faces";

  /** One card in the row, resolved on the build machine. */
  export interface FanCard {
    readonly slug: string;
    /** The card's name, verbatim. */
    readonly label: string;
    /** The type line, verbatim, or the empty string where there is none. */
    readonly typeLine: string;
    /** The blob key for this card's face. */
    readonly faceKey: string;
  }

  interface Props {
    cards: readonly FanCard[];
  }

  const { cards }: Props = $props();

  const tier = FACE_TIERS.thumb;

  /**
   * Composed from verbatim fields with a fixed separator, exactly as the card
   * page composes it. Nothing here writes prose about a picture.
   */
  function altFor(card: FanCard): string {
    return card.typeLine === "" ? card.label : `${card.label} — ${card.typeLine}`;
  }
</script>

<!--
  `aria-hidden` is deliberately NOT set, and the nav is labelled. These are
  links to six cards; a screen-reader user is entitled to the same six
  destinations a sighted one gets, and calling the block decorative to save
  announcing it would be taking them away.
-->
<nav class="fan" aria-label="Cards to look at">
  <CardFaceGroup>
    <!--
      THE CLIP IS ON THIS WRAPPER, NOT ON THE NAV, and that is a compliance
      detail rather than a layout preference. `CardFaceGroup` emits the
      copyright notice as a sibling AFTER its children, so a clip on the outer
      element cropped the one line that is not allowed to be cropped — the
      notice rendered half-visible under the row. Clipping an inner window
      leaves the notice outside it, in normal flow, always legible.
    -->
    <div class="window">
      <!--
        TWO ELEMENTS FOR TWO AXES, because one element cannot do it. Setting
        `overflow-x: auto` and `overflow-y: clip` on the same box does not give
        a horizontally-scrolling, vertically-cropped band: per CSS Overflow 3,
        `clip` COMPUTES TO `hidden` when the other axis is `auto` — so the box
        becomes a scroll container on both axes and the vertical crop is
        scrollable after all. The window crops; the track scrolls.
      -->
      <div class="track">
        <ul class="row">
        {#each cards as card, index (card.slug)}
          <!--
            Two index-driven properties rather than six hand-written rules, so
            adding or removing a card cannot leave a gap in the row.

            `--rise` is the alternating step down that keeps each name clear of
            its neighbour's shoulder. `--z` is the paint order, written out
            rather than left to document order, because hover has to be able to
            beat it.

            There is deliberately no index property for the step ACROSS: every
            card pulls left by the same amount, so that is a constant in the
            stylesheet rather than a number computed per card. An earlier draft
            emitted one and nothing read it.
          -->
          <li style={`--rise: ${index % 2}; --z: ${index + 1}`}>
            <a href={`/card/${card.slug}`}>
              <CardFace
                src={faceUrl(card.faceKey, "thumb")}
                alt={altFor(card)}
                width={tier.width}
                height={tier.height}
                loading="lazy"
              />
            </a>
          </li>
          {/each}
        </ul>
      </div>
    </div>
  </CardFaceGroup>
</nav>

<style>
  .fan {
    margin-block-start: var(--of-space-looser);
  }

  /*
    A WINDOW THAT CROPS, and it has to be one or the row stops being decoration
    and starts being content that pushes the page around.

    A card face is tall. Six of them at full height added most of a screen to
    the document and pushed the provenance line off the bottom on a phone; the
    front door's whole property is that it fits the fold, so a decoration that
    makes it scroll has taken more than it gave.

    So the cards are anchored to the TOP of a short box and run off the bottom
    of it — which is also the effect the reference has: a band of card tops
    along the foot of the page with the document carrying on beneath, rather
    than six complete thumbnails in a row.

    The height is viewport-relative so it takes what the screen has left rather
    than a number chosen against one screen. A viewport unit is neither an
    absolute nor a typographic length, which is why it is a legal literal here:
    there is no token for "whatever is left", and inventing one would name a
    value the layout has to compute.
  */
  .window {
    block-size: 22vh;

    /*
      CLIPPED DOWNWARD, SCROLLING SIDEWAYS, and the two axes are set separately
      because they are doing different jobs. The vertical clip is the effect —
      cards running off the bottom of a band with the page carrying on beneath.
      The horizontal scroll is the escape hatch for a screen too narrow to seat
      six readable cards.

      Shrinking them to fit was the first answer and it was the wrong one:
      measured on a phone the cards came out well under half a thumb, which
      satisfies "the row fits" and defeats the point of the row — a name at that
      size is legible to a measuring script and to nobody else. A card has a
      size below which it stops being a card, so the row keeps that size and
      gives up fitting instead.
    */
    /*
      `clip`, NOT `hidden`, and on its own axis on its own element.

      The two crop identically and differ in the thing that matters: `hidden` is
      a SCROLL CONTAINER that simply has no scrollbar, so tabbing onto a card
      lets the browser's scroll-into-view move the vertical axis — dragging the
      card tops, which are the names this layout exists to protect, up out of
      the band with no way to put them back. `clip` is not scrollable.

      Writing `overflow-x: auto` beside it does not work, and the reason is
      worth knowing: `clip` computes to `hidden` when the other axis is `auto`,
      so the pair silently collapses back to a scroll container on both axes.
      That is why the horizontal scroll lives on `.track` inside this box.
      Nothing here scrolls; the vertical crop is final.
    */
    overflow-y: clip;

    /*
      HEADROOM FOR THE LIFT AND THE FOCUS RING. Half the cards sit flush with
      the top of the band, and both the hover lift and a focus outline are drawn
      ABOVE the card's box — straight into the crop. The padding is the lift
      plus the ring's offset and width, so neither is ever cut.

      `box-sizing: border-box` because this site resets it on `body` alone, so
      padding would otherwise ADD to the fixed `block-size` and the band would
      render taller than the value above claims. `StatGlyph.svelte` documents
      the same trap.
    */
    box-sizing: border-box;
    padding-block-start: calc(
      var(--of-space-loose) + var(--of-space-tighter) + var(--of-bevel-width) * 2
    );
  }

  /*
    The scrolling half. It has no height of its own, so there is no vertical
    overflow here to scroll even though `overflow-x: auto` computes this box's
    other axis to `auto` as well — the crop is the window's job and the window
    cannot be scrolled.
  */
  .track {
    overflow-x: auto;
  }

  .row {
    display: flex;
    align-items: flex-start;
    margin: 0;
    padding: 0;
    list-style: none;

    /*
      THE ROW HAS TO FIT, OR THE END CARDS LOSE THEIR NAMES to the window's own
      edge — which is the same defect as an overlap that is too deep, arriving
      from the other direction. A fixed card width overflowed at every viewport
      narrower than the row, and centring made it worse by clipping BOTH ends.

      Half the published thumb is the size: large enough to read a name and to
      tell one piece of art from another, small enough that six of them are a
      band rather than a gallery. It is a fixed size rather than a share of the
      container, because a share makes the cards shrink on exactly the screen
      where they are already hardest to read.

      `safe center` rather than `center`, because a centred flex row that
      overflows its scroll container puts its first item at a NEGATIVE offset —
      unreachable, no matter how far back you scroll. `safe` falls back to
      start-alignment the moment centring would do that, so the first card is
      always reachable and the row still centres whenever it fits.
    */
    --card: calc(var(--of-card-face-thumb) / 2);

    justify-content: safe center;
  }

  /*
    A QUARTER OF A CARD, AND NOT MORE. The name is a banner across the top of a
    card spanning nearly its full width, so every unit of overlap costs a
    readable name — which is what "stacked so the titles can always be read"
    actually constrains. A third was too much: it left the last cards captioned
    by fragments.

    The alternating rise does the rest. A card sitting a little lower than the
    one before it keeps its own name clear of that card's shoulder, and gives
    the row the slight unevenness of a real spread rather than the machined
    look of six equal steps.
  */
  .row li {
    flex: 0 0 auto;
    margin-inline-start: calc(-0.25 * var(--card));
    transform: translateY(calc(var(--rise) * var(--of-space-loose)));
    z-index: var(--z);
  }

  /* The first card needs no pull, or the whole row sits left of centre. */
  .row li:first-child {
    margin-inline-start: 0;
  }

  .row li a {
    display: block;
    inline-size: var(--card);
    transition: transform var(--of-motion-fast) var(--of-motion-ease);
  }

  /*
    HOVER BRINGS THE CARD TO THE FRONT AND LIFTS IT, and both halves matter.
    Lifting alone moves a card that is still behind its neighbours, so the one
    under the cursor is the one you cannot see.

    `z-index` goes on the LIST ITEM rather than the link, because the item is
    what the stacking order is established on. `:focus-within` covers keyboard
    focus with the same rule — the anchor is the only focusable thing inside.
  */
  .row li:hover,
  .row li:focus-within {
    z-index: calc(var(--z) + 100);
  }

  .row li:hover a,
  .row li a:focus-visible {
    transform: translateY(calc(-1 * var(--of-space-loose)));
  }

  .row li a:focus-visible {
    outline: calc(var(--of-bevel-width) * 2) solid var(--of-color-focus);
    outline-offset: var(--of-space-tighter);
  }

  /*
    Honour a reduced-motion preference by removing the transition, not the
    behaviour: the card still comes to the front, it just arrives rather than
    travels. Taking the lift away entirely would remove the only feedback that
    the hover did anything.
  */
  @media (prefers-reduced-motion: reduce) {
    .row li a {
      transition: none;
    }
  }
</style>
