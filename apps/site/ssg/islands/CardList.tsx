/**
 * A list of cards that is not a search result. The set page's island.
 *
 * WHY THIS EXISTS BESIDE `CardSearch` RATHER THAN INSIDE IT. Both render the
 * same `CardIndex` and both page with the same `Pagination`, and neither is a
 * special case of the other: a search has a query and this has none, which
 * changes where the state has to live. On `/search` the display mode is a QUERY
 * TERM — clicking "Names" rewrites the box to `dominate display:names`, because
 * the URL is the product and a screen the address bar cannot reproduce is a
 * screen you cannot cite. A set page has no box to rewrite, so the mode is a
 * plain parameter beside the page and the page size.
 *
 * Twenty lines of state, then. The alternative was one island carrying a "is
 * there a query" flag through every handler, which is two components wearing a
 * trench coat.
 *
 * WHAT IT IS NOT: a search over the set. `docs/DESIGN.md`, quoted in
 * `set.page.tsx`: "a set page is a LIST, not a search result". The whole corpus
 * index is 732 KB and this page does not load it — the rows arrive already
 * built, from the build, as this island's props.
 *
 * THE FIRST PAGE IS IN THE HTML. `Island` renders its child on the server, so
 * a set's first sixty cards are markup before any script runs; hydration adds
 * the view switch and takes the pager's navigation client-side.
 *
 * `Pagination`'s REAL LINKS DO NOT MAKE THIS PAGE WORK WITHOUT JAVASCRIPT, and
 * it is worth saying so because they look as though they would. Every page of a
 * set is served from ONE static file — the URL carries `?page=`, the bytes do
 * not — so with scripting off, following the pager arrives back at the same
 * server-rendered first page under an address claiming otherwise. That is a
 * silent wrong answer, which is the one shape "degrade visibly" forbids.
 *
 * So the complete list of the set still ships in a `<noscript>` on the page
 * itself; see `set.page.tsx`, which is where the honesty about it lives. The
 * links are still right to have: with JavaScript they are what makes a page of
 * a set an address somebody can paste.
 */

import { useCallback, useEffect, useState } from "react";

import { Pagination } from "optfall-components/react";

import {
  PAGE_PARAM,
  PAGE_SIZES,
  type PageSize,
  paginate,
  parsePage,
  parsePageSize,
  SIZE_PARAM,
} from "../../src/lib/pagination";
import {
  CardIndex,
  type CardIndexDisplay,
  type CardIndexEntry,
} from "../components/CardIndex";

/** The parameter this page adds to the two `pagination.ts` already owns. */
const DISPLAY_PARAM = "display";

export interface CardListProps {
  /**
   * Every card in the list, in the order it should be read.
   *
   * ALL OF THEM, unlike `CardIndex`'s own `entries`, which is one page. This
   * island is what does the cutting, because it is what knows the page number.
   */
  readonly entries: readonly CardIndexEntry[];
  /**
   * What the list is a list OF, named, for the sentence over it — "Mistveil".
   *
   * A string rather than a rendered sentence because these props cross the
   * island boundary as JSON in an attribute; see `Island.tsx`.
   */
  readonly subject: string;
}

/**
 * `?display=`, in every spelling the search operator accepts.
 *
 * `card-search/` maps `images` onto grid and `rows` onto list, so a reader
 * who learned a word on `/search` and typed it here should not find that only
 * one of the site's two card lists understands it.
 *
 * `text`, `names` AND `checklist` LAND ON `list` FOR THE SAME REASON THEY DO
 * IN THE ENGINE: they named a names-only view that turned out to be this one
 * with its metadata removed. They resolve rather than fall through to `null` —
 * falling through would answer "the reader said nothing", which is a different
 * claim from "the reader asked for a view that moved", and would silently hand
 * back the grid to somebody who explicitly asked not to see pictures.
 *
 * NO NOTICE HERE, UNLIKE THE OPERATOR. A set page has no query, so it has
 * nowhere to put one and no parse to attach it to — and this is a parameter on
 * a followed link rather than something typed just now. `CardSearch`'s
 * `displayFromUrl` makes the same call for the same reason.
 */
function displayFrom(raw: string | null): CardIndexDisplay | null {
  if (raw === "list" || raw === "rows") return "list";
  if (raw === "text" || raw === "names" || raw === "checklist") return "list";
  if (raw === "grid" || raw === "images") return "grid";
  return null;
}

/** The three things this page keeps in the address bar. */
function stateFromUrl(): {
  readonly display: CardIndexDisplay | null;
  readonly page: number;
  readonly size: PageSize;
} {
  if (typeof window === "undefined") {
    return { display: null, page: 1, size: parsePageSize(null) };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    display: displayFrom(params.get(DISPLAY_PARAM)),
    page: parsePage(params.get(PAGE_PARAM)),
    size: parsePageSize(params.get(SIZE_PARAM)),
  };
}

export function CardList({ entries, subject }: CardListProps) {
  const [display, setDisplay] = useState<CardIndexDisplay>("grid");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(parsePageSize(null));
  /*
    FALSE ON THE SERVER AND ON THE FIRST CLIENT RENDER. The view switch is a
    radio group, which does nothing without JavaScript — a control that looks
    operable and is not. The PAGER is not gated this way and does not need to
    be: it is made of real links. Flipping this in an effect keeps the two first
    renders identical, which is what hydration checks.
  */
  const [interactive, setInteractive] = useState(false);

  /*
    THE URL IS READ IN AN EFFECT, NOT AT INITIALISATION, for the reason
    `CardSearch` and `RulesSearch` both record at length: the server has no
    `window`, so initialising from `?page=` renders a different tree than the
    server did and hydration fails with React error #418.
  */
  useEffect(() => {
    const fromUrl = stateFromUrl();
    if (fromUrl.display !== null) setDisplay(fromUrl.display);
    setPage(fromUrl.page);
    setSize(fromUrl.size);
    setInteractive(true);
  }, []);

  /*
    CLAMPED AGAINST THE REAL TOTAL, which is why this is `paginate` and not the
    arithmetic done by hand. A set can lose cards between one corpus sync and
    the next, so a saved link to page 7 of a set that now has five is not a
    hypothetical — and an empty grid under a heading naming 412 cards reads as a
    broken page rather than as an out-of-date link.
  */
  const slice = paginate(entries.length, page, size);
  const shown = entries.slice(slice.offset, slice.offset + slice.limit);

  /** Where a given page and size live. Defaults are omitted, never written. */
  const linkTo = useCallback(
    (nextPage: number, nextSize: PageSize, nextDisplay: CardIndexDisplay) => {
      const params = new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      );
      /*
        THE DEFAULTS ARE SPELT AS ABSENCE. `/sets/mst`, `?display=grid` and
        `?page=1` would otherwise be three addresses for one view — and this is
        a reference work whose claim is that a view has an address, singular.
      */
      if (nextDisplay === "grid") params.delete(DISPLAY_PARAM);
      else params.set(DISPLAY_PARAM, nextDisplay);
      if (nextPage <= 1) params.delete(PAGE_PARAM);
      else params.set(PAGE_PARAM, String(nextPage));
      if (nextSize === parsePageSize(null)) params.delete(SIZE_PARAM);
      else params.set(SIZE_PARAM, String(nextSize));

      const query = params.toString();
      const path =
        typeof window === "undefined" ? "" : window.location.pathname;
      return query === "" ? path : `${path}?${query}`;
    },
    [],
  );

  const goTo = useCallback(
    (nextPage: number, nextSize: PageSize, nextDisplay: CardIndexDisplay) => {
      setPage(nextPage);
      setSize(nextSize);
      setDisplay(nextDisplay);
      if (typeof window === "undefined") return;
      const target = linkTo(nextPage, nextSize, nextDisplay);
      if (target !== `${window.location.pathname}${window.location.search}`) {
        window.history.pushState({}, "", target);
      }
      /* The pager is at the foot of a long page, so without this the next page
         arrives already scrolled past its own start. */
      window.scrollTo({ top: 0 });
    },
    [linkTo],
  );

  /** Back and forward have to work, which means listening for them. */
  useEffect(() => {
    const onPop = () => {
      const fromUrl = stateFromUrl();
      setDisplay(fromUrl.display ?? "grid");
      setPage(fromUrl.page);
      setSize(fromUrl.size);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /*
    THE SENTENCE NAMES THE SLICE, NOT THE TOTAL, because the masthead above it
    already gives the total. Two counts saying one number is one of them being
    noise; "cards 61–120 of 412" is the fact the masthead cannot state.
  */
  const summary =
    entries.length === 0
      ? `Optfall carries no cards from ${subject}.`
      : slice.pages === 1
        ? `${entries.length.toLocaleString("en-GB")} card${entries.length === 1 ? "" : "s"} from ${subject}.`
        : `Cards ${slice.from.toLocaleString("en-GB")}–${slice.to.toLocaleString("en-GB")} of ${slice.total.toLocaleString("en-GB")} from ${subject}.`;

  return (
    <CardIndex
      entries={shown}
      display={display}
      /* THE PAGE IS KEPT ACROSS A VIEW CHANGE, unlike a size change. Every
         view has the same page size, so page 3 holds the same sixty cards
         whichever way they are drawn — and a reader who has paged into the
         middle of a set and then wants the names of what they are looking at
         should get the names of what they are looking at. */
      onDisplayChange={(next) => goTo(slice.page, size, next)}
      summary={summary}
      controlName="set-display"
      interactive={interactive}
      pagination={
        slice.needed ? (
          <Pagination
            from={slice.from}
            href={(next) => linkTo(next, size, display)}
            label={`Pages of cards from ${subject}`}
            onNavigate={(next) => goTo(next, size, display)}
            /* CHANGING THE SIZE GOES BACK TO PAGE ONE: page 4 of 60-row pages
               and page 4 of 240-row pages are different rows of one answer, and
               no reading of "4" is true of both. */
            onResize={(next) => goTo(1, next, display)}
            page={slice.page}
            pages={slice.pages}
            size={slice.size}
            sizeHref={(next) => linkTo(1, next, display)}
            sizes={PAGE_SIZES}
            to={slice.to}
            total={slice.total}
            unit="cards"
          />
        ) : null
      }
    />
  );
}
