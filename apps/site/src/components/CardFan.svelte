<script lang="ts">
  /**
   * The fan of faces at the foot of the front door.
   *
   * WHY A DOOR THAT REFUSES DECORATION HAS ONE ANYWAY. `docs/DESIGN.md` rules
   * out a marketing hero and an illustration above the fold, and this is
   * neither: it sits BELOW the field, at the bottom edge, in the roughly 650px
   * of empty screen the door already had. Measured — the page is exactly the
   * height of the fold with the field at 145px and nothing under it.
   *
   * What it buys is the one thing a paragraph of copy cannot: it says *this is
   * a card database* in the time it takes to look at it, which is the job the
   * five deleted paragraphs of "what this is" were failing to do. Scryfall puts
   * a fan of art in exactly this slot for exactly this reason, and it is the one
   * place on that site where decoration is doing work rather than filling space.
   *
   * IT IS ALSO EIGHT REAL LINKS. The door had two content links; a reader who
   * arrives without a card in mind now has somewhere to go that is a card rather
   * than a list of cards. Nothing here is an image of a card — every face is the
   * card, and clicking it lands on its page.
   *
   * COMPLIANCE IS WHY IT COMPOSES `CardFaceGroup` RATHER THAN WRITING `<img>`.
   * Card images are permitted on the condition that a copyright line accompanies
   * them, and `docs/COMPLIANCE.md` §5 designs that so a caller cannot get it
   * wrong: `CardFace` emits the notice itself unless an ancestor group is
   * carrying one, and `CardFaceGroup` is the only thing that can say so — via
   * context, so markup cannot forge it. Eight faces under one group is one
   * notice, correctly, and there is no arrangement of this file that produces a
   * face without one.
   *
   * NOT HYDRATED. It renders on the build machine and ships as markup; there is
   * no state here and a fan that costs JavaScript on the page whose whole point
   * is to be cheap would be the wrong trade twice over.
   */
  import { CardFace, CardFaceGroup } from "optfall-components/svelte";

  import { FACE_TIERS, faceUrl } from "../lib/faces";

  /** One card in the fan, resolved on the build machine. */
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
  links to eight cards; a screen-reader user is entitled to the same eight
  destinations a sighted one gets, and calling the block decorative to save
  announcing it would be taking them away.
-->
<nav class="fan" aria-label="Cards to look at">
  <CardFaceGroup>
    <!--
      THE CLIP IS ON THIS WRAPPER, NOT ON THE FAN, and that is a compliance
      detail rather than a layout preference. `CardFaceGroup` emits the
      copyright notice as a sibling AFTER its children, so a clip on the outer
      element cropped the one line that is not allowed to be cropped — the
      notice rendered half-visible under the hand. Clipping an inner window
      leaves the notice outside it, in normal flow, always legible.
    -->
    <div class="window">
      <ul class="hand">
      {#each cards as card, index (card.slug)}
        <!--
          The stagger is an index-driven custom property rather than eight
          hand-written rules, so adding or removing a card cannot leave a gap in
          the arc. `--i` is the distance from the middle of the hand, signed, so
          the two halves lean away from each other.
        -->
        <li style={`--i: ${index - (cards.length - 1) / 2}`}>
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
  </CardFaceGroup>
</nav>

<style>
  /*
    A WINDOW, NOT A BOX — and it has to be a window or the fan stops being
    decoration and starts being content that pushes the page around.

    The faces are rotated and lifted, so their bounding boxes are taller and
    wider than the images; laid out normally they added most of a screen to the
    document and shunted the provenance line off the bottom of it on a phone.
    The front door's whole property is that it fits the fold, so a decoration
    that makes it scroll has taken more than it gave.

    So the fan is a fixed-height window that CROPS. The hand is anchored to the
    top of it and the bottoms of the cards run off the edge, which is also the
    effect the plan asked for: art bleeding off the frame rather than eight
    thumbnails in a row. `clip` on both axes — the vertical crop is the whole
    mechanism, and the horizontal one keeps the rotation from ever reaching the
    scrollbar.

    The height is viewport-relative so it takes what the screen has left rather
    than a number chosen against one screen. A viewport unit is neither an
    absolute nor a typographic length, which is why it is a legal literal here:
    there is no token for "whatever is left", and inventing one would be naming
    a value the layout has to compute.
  */
  .fan {
    margin-block-start: var(--of-space-looser);
  }

  .window {
    block-size: 34vh;
    overflow: clip;
  }

  .hand {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /*
    THE OVERLAP IS THE WHOLE EFFECT. A negative inline margin pulls each face
    over its neighbour, and the rotation and lift are driven from `--i` so the
    hand curves. The middle card sits highest because `--i` is zero there and
    the translation is proportional to its square.
  */
  .hand li {
    flex: 0 0 auto;
    margin-inline: calc(-1 * var(--of-card-face-thumb) / 3);
    transform: rotate(calc(var(--i) * 4deg))
      translateY(calc(var(--i) * var(--i) * var(--of-space-tight)));
    transform-origin: bottom center;
  }

  /* Later cards lie over earlier ones on the left half and under them on the
     right, which is how a real hand of cards is held. Without this the fan
     reads as a stack leaning one way. */
  .hand li:nth-child(-n + 4) {
    z-index: 1;
  }

  .hand li a {
    display: block;
    inline-size: var(--of-card-face-thumb);
    transition: transform var(--of-motion-fast) var(--of-motion-ease);
  }

  /* The one interaction: the card you are pointing at comes out of the hand. */
  .hand li a:hover,
  .hand li a:focus-visible {
    transform: translateY(calc(-1 * var(--of-space-loose)));
  }

  .hand li a:focus-visible {
    outline: calc(var(--of-bevel-width) * 2) solid var(--of-color-focus);
    outline-offset: var(--of-space-tighter);
  }

  /*
    Honour a reduced-motion preference by removing the transition, not the
    layout: the fan is a static arrangement and only the lift moves.
  */
  @media (prefers-reduced-motion: reduce) {
    .hand li a {
      transition: none;
    }
  }

  /*
    NO BREAKPOINT, AND IT DOES NOT NEED ONE. A narrower screen simply crops more
    of the hand against the window above — which is the same effect the design
    asks for rather than a degradation of it. The overlap is a fraction of the
    face width, so the arc keeps its shape at every size and the outer cards run
    off the edge instead of shrinking.
  */
</style>
