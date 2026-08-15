/**
 * The row of card faces on the front door. React port.
 *
 * NOT AN ISLAND, AND THAT IS THE POINT. The Astro original was rendered with no
 * `client:` directive, so it built to markup on the build machine and cost the
 * page six images and no JavaScript at all. It is a plain component here for the
 * same reason: hovering pops a card to the front, and that is done in CSS.
 *
 * `aria-hidden` is deliberately NOT set, and the nav is labelled. These are links
 * to six cards; a screen-reader user is entitled to the same six destinations a
 * sighted one gets, and calling the block decorative to save announcing it would
 * be taking them away.
 */

import { CardFace } from "optfall-components/react";

import { FACE_TIERS, faceUrl } from "../../src/lib/faces";

import "./CardFan.css";

export interface FanCard {
  readonly slug: string;
  readonly label: string;
  readonly typeLine: string;
  readonly faceKey: string;
}

export interface CardFanProps {
  readonly cards: readonly FanCard[];
}

const tier = FACE_TIERS.thumb;

function altFor(card: FanCard): string {
  return card.typeLine === "" ? card.label : `${card.label} — ${card.typeLine}`;
}

export function CardFan({ cards }: CardFanProps) {
  return (
    <nav className="of-fan" aria-label="Cards to look at">
      {/*
        THE CLIP STAYS ON THIS INNER WRAPPER even though the reason it was put
        here is gone. `CardFaceGroup` used to emit the copyright notice as a
        sibling after its children, and a clip on the outer element cropped the
        one line that was not allowed to be cropped. The notice now lives in the
        universal footer, so nothing here can crop it — but the window is also
        simply the right element to clip, and moving the clip outwards would be
        an unrelated change made because a comment stopped applying.
      */}
      <div className="of-fan__window">
        {/*
            TWO ELEMENTS FOR TWO AXES, because one element cannot do it. Setting
            `overflow-x: auto` and `overflow-y: clip` on the same box does not
            give a horizontally-scrolling, vertically-cropped band: per CSS
            Overflow 3, `clip` COMPUTES TO `hidden` when the other axis is
            `auto` — so the box becomes a scroll container on both axes and the
            vertical crop is scrollable after all. The window crops; the track
            scrolls.
          */}
        <div className="of-fan__track">
          <ul className="of-fan__row">
            {cards.map((card, index) => (
              /*
                  Two index-driven properties rather than six hand-written
                  rules, so adding or removing a card cannot leave a gap in the
                  row. `--rise` is the alternating step down that keeps each name
                  clear of its neighbour's shoulder. `--z` is the paint order,
                  written out rather than left to document order, because hover
                  has to be able to beat it.

                  There is deliberately no index property for the step ACROSS:
                  every card pulls left by the same amount, so that is a constant
                  in the stylesheet rather than a number computed per card.
                */
              <li
                key={card.slug}
                style={
                  {
                    "--rise": index % 2,
                    "--z": index + 1,
                  } as React.CSSProperties
                }
              >
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
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
