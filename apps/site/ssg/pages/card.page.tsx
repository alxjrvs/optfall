/**
 * The `/card/` route — 11,378 URLs, every one of them a printing.
 *
 * `docs/DESIGN.md` keeps Scryfall's **"Every view is a URL"**, and a card page
 * that cannot be linked is a lookup rather than a reference.
 * `docs/SCRYFALL-GAP.md` §5.1c
 * says which URL: **"Scryfall treats the printing as the addressable unit; so
 * should we."** This file is where that stopped being half true.
 *
 * WHAT CHANGED, IN ONE LINE. The address was `/card/head-jab-1`, with
 * `/card/head-jab-1/wtr/098` bolted on for the alternate arts; it is
 * `/card/wtr/098/head-jab-1` for every art, and the two old forms are 301s. Set
 * and number lead because they are printed on the card — a reader holding one
 * can type its URL — and because they are upstream's identifiers rather than
 * ours, so a slug correction moves the tail and breaks nothing.
 *
 * ONE KIND OF ROUTE NOW, WHERE THERE WERE THREE. The old `CardRoute` was a
 * discriminated union of card / shared-name / printing, and its exhaustiveness
 * was load-bearing: it caught the printing route's own arrival at build time.
 * There is nothing left to discriminate — `/card/<slug>` and `/card/<name>` are
 * redirects — so the union collapsed to a record and the branching in this file
 * went with it.
 *
 * EVERY PATH IS EMITTED AT BUILD TIME. There is no fallback renderer: a URL
 * either names a printing Legend Story Studios has published or it 404s, which
 * is the honest behaviour for a reference index.
 *
 * THE `<title>` AND THE DESCRIPTION ARE BUILT IN `cards.ts`, NOT HERE. They are
 * fixed labels wrapped around verbatim values, and they live beside the data so
 * the two cannot drift. `descriptionFor` deliberately omits legality: an unfurl
 * preview is snapshotted at paste time and never revisited, so "Banned in
 * Classic Constructed" is exactly the sentence that must not be cached for six
 * months in the conversation where somebody is deciding what to sleeve.
 */

import {
  CARD_ROUTES,
  type CardRoute,
  descriptionFor,
  titleFor,
} from "../../src/lib/cards";
import { faceUrl } from "../../src/lib/faces";
import { setName } from "../../src/lib/sets";
import { CardEntry } from "../components/CardEntry";
import type { PageModule, PageResult, RouteContext } from "../types";

type Params = {
  readonly set: string;
  readonly number: string;
  readonly slug: string;
};
type Props = { readonly route: CardRoute };

function getStaticPaths() {
  return CARD_ROUTES.map((route) => ({
    params: { set: route.setCode, number: route.number, slug: route.slug },
    props: { route },
  }));
}

function page({ props }: RouteContext<Params, Props>): PageResult {
  const { route } = props;
  const card = route.page;

  /**
   * AN ALTERNATE ART CANONICALS TO THE CARD'S DEFAULT PRINTING, and the
   * argument for that survived the scheme change unchanged.
   *
   * A printing page is a VIEW of a card, not a second card. It carries the same
   * name, rules text, legality and rulings as every other printing of it; one
   * image differs. That is a near-duplicate by every measure a search engine
   * has, and there are 6,437 non-default ones — enough to bury the 4,941 pages
   * that are the actual index if each competed on its own.
   *
   * WHAT IS DIFFERENT IS WHERE THEY POINT. They used to canonical to
   * `/card/<slug>`, a page that no longer exists; they point at
   * `card.href` — the default printing — which is also where the 301s from the
   * old card and name URLs land. So every signal about a card, from a pasted
   * pre-change link and from an alternate art alike, consolidates on one
   * address, and that address names a real printing.
   *
   * A REVIEWER MAY WANT THE OTHER SIDE OF THIS. Scryfall lets every printing
   * self-canonical and indexes all of them. Doing that here is deleting this
   * block; the trade is 11,378 competing near-duplicates against 4,941 pages
   * that each stand for a card.
   */
  const canonical = route.isDefault ? undefined : card.href;

  /**
   * A PRINTING PAGE SAYS WHICH PRINTING IN ITS TITLE, and it has to. Every one
   * of the 11,378 shares a name with the card. A browser with three of them
   * open, a bookmark bar, a pasted link's preview card — each shows the title
   * and nothing else.
   *
   * THE DEFAULT PRINTING IS THE ONE EXCEPTION, and it is not an inconsistency.
   * That page is where the card LIVES: it is what every search result, every
   * reference link and every redirected old URL opens, so its title is the
   * card's title. Qualifying it would put a set code in front of a reader who
   * never chose a printing, on the 4,941 pages most likely to be seen.
   */
  const title = route.isDefault
    ? titleFor(card)
    : titleFor(
        card,
        `${card.label} · ${setName(route.ref.printing.set_id)} ${route.ref.printing.id}`,
      );

  return {
    title,
    description: descriptionFor(card),
    canonical,
    /*
      THE FACE THIS PAGE IS SHOWING, at the tier that already exists for it.

      `normal` rather than `thumb` because a preview card is rendered at a few
      hundred pixels wide and the thumb is 180 — upscaled, on the one image a
      reader judges the link by. It is the same URL the page itself loads, so
      the preview costs the image host nothing it was not already serving and
      arrives warm from its cache.

      THE PRINTING'S OWN FACE, NOT THE CARD'S DEFAULT. A link to a specific
      printing is overwhelmingly a link to that art, and previewing a different
      one would answer a question nobody asked.
    */
    image: faceUrl(route.ref.key, "normal"),
    section: "cards",
    width: "wide",
    /*
      NO ISLANDS, AND THIS LINE WENT WITH THE PICKER. It asked the shell for
      `islands.js`, which was right while the printing picker lived in the face
      column and is now a script tag on 11,378 pages that hydrates nothing —
      the largest route in the build fetching a bundle to find no
      `data-island` in the document. The printings table is the control, and it
      is markup.
    */
    children: <CardEntry page={card} selected={route.index} />,
  };
}

export const cardPage: PageModule<Params, Props> = {
  pattern: "/card/[set]/[number]/[slug]",
  getStaticPaths,
  page,
};
