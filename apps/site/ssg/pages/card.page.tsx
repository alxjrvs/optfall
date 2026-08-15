/**
 * The `/card/` route — 12,278 URLs, every one a permalink. Ported.
 *
 * `docs/PLAN.md` Phase 2: **"Every view is a URL. `/card/command-and-conquer`
 * and `/search?q=…` are the product, not decoration on it … a card page that
 * cannot be linked is a lookup rather than a reference."**
 *
 * THREE KINDS OF ROUTE, AND THE UNION IS EXHAUSTIVE BY CONSTRUCTION. `CardRoute`
 * is a discriminated union, so a fourth kind added to `cards.ts` fails the
 * typecheck here rather than silently rendering as a card. That guard paid off
 * literally during Stack E: adding the printing route broke this file's build,
 * which is exactly what it was written to do.
 *
 * EVERY PATH IS EMITTED AT BUILD TIME. There is no fallback renderer: a URL
 * either names a card Legend Story Studios has printed or it 404s, which is the
 * honest behaviour for a reference index.
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
  hrefForSlug,
  NAME_PAGES,
  titleFor,
} from "../../src/lib/cards";
import { setName } from "../../src/lib/sets";
import { CardEntry } from "../components/CardEntry";
import type { PageModule, PageResult, RouteContext } from "../types";

type Params = { readonly slug: string };
type Props = { readonly route: CardRoute };

function getStaticPaths() {
  return CARD_ROUTES.map((route) => ({
    params: { slug: route.slug },
    props: { route },
  }));
}

/**
 * `/card/head-jab` and `/card/head-jab-1` render the same card at the same
 * version, so one of them has to say which is the real address.
 *
 * The BARE NAME wins, because it is the URL a person guesses, types and pastes —
 * `slugify` exists to make it guessable — and because it is the one that
 * survives upstream printing a fourth pitch version. Roughly 900 pairs; without
 * this they are 900 requests to a search engine to pick for us.
 */
const DEFAULT_SLUG_BY_NAME = new Map(
  NAME_PAGES.map((name) => [name.slug, name.cards[0]?.slug]),
);

function page({ props }: RouteContext<Params, Props>): PageResult {
  const { route } = props;

  /**
   * THE BARE NAME SLUG IS THE CARD, NOT AN INDEX OF CARDS.
   *
   * `/card/head-jab` used to be a disambiguation page: a list of links asking
   * the reader to pick a pitch before they were shown anything. That was the
   * wrong document, because a player calls the red, yellow and blue versions ONE
   * card — so the guessable URL serves the card itself, at its lowest-pitch
   * version, with the tab strip in `CardEntry` switching between them.
   */
  const card = route.kind === "name" ? route.page.cards[0] : route.page;

  if (card === undefined) {
    /* Unreachable — a name page exists only where a group has more than one
       card — and written rather than asserted, because a `!` here would be a
       claim about another module's invariant. */
    return { title: "", description: "", children: null };
  }

  const canonical = (() => {
    // The name route IS the bare name; it canonicals to itself by default.
    if (route.kind === "name") return hrefForSlug(card.nameSlug);

    const isDefault = DEFAULT_SLUG_BY_NAME.get(card.nameSlug) === card.slug;

    /*
     * A PRINTING PAGE IS A VIEW OF A CARD, NOT A SECOND CARD. It carries the
     * same name, rules text, legality and rulings as the card's own page; one
     * image differs. That is a near-duplicate by every measure a search engine
     * has, and there are 6,437 of them — enough to bury the 4,941 pages that are
     * the actual index if each competed on its own.
     */
    if (route.kind === "printing") {
      return hrefForSlug(isDefault ? card.nameSlug : card.slug);
    }

    // A variant page duplicates the bare name ONLY if it is the version that
    // page renders — the lowest-pitch one. Pitch 2 and pitch 3 are different
    // cards with different text and different legality.
    return isDefault ? hrefForSlug(card.nameSlug) : undefined;
  })();

  /**
   * A PRINTING PAGE SAYS WHICH PRINTING IN ITS TITLE, and it has to. 6,437 of
   * these exist and every one shares a name with the card. A browser with three
   * of them open, a bookmark bar, a pasted link's preview card — each shows the
   * title and nothing else.
   */
  const title = (() => {
    if (route.kind === "name") return titleFor(card, route.page.name);
    if (route.kind === "printing") {
      const { printing } = route.ref;
      return titleFor(
        card,
        `${card.label} · ${setName(printing.set_id)} ${printing.id}`,
      );
    }
    return titleFor(card);
  })();

  return {
    title,
    description: descriptionFor(card),
    canonical,
    section: "cards",
    width: "wide",
    islands: true,
    children: (
      <CardEntry
        page={card}
        selected={route.kind === "printing" ? route.index : 0}
      />
    ),
  };
}

export const cardPage: PageModule<Params, Props> = {
  pattern: "/card/[slug]",
  getStaticPaths,
  page,
};
