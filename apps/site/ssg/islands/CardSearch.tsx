/**
 * The card search field, and the results under it. React port.
 *
 * SUBMIT-DRIVEN, NOT LIVE, and that is the load-bearing difference from
 * `RulesSearch`. `docs/SCRYFALL-GAP.md` §5.2: results do NOT re-rank on every
 * keystroke. A grid of card faces reflowing under a cursor is noise, it makes
 * the image layer fight the search layer for bandwidth, and the URL is the
 * product — a submit is the moment a query becomes a link worth pasting, and
 * live filtering blurs the point at which that happens.
 *
 * That is why there are two pieces of state rather than one: `query` is what is
 * in the box, `submitted` is what the results answer. The rules search has one,
 * because it is live.
 *
 * ONE RESULT IS NOT A RESULT SET, IT IS THE ANSWER — the same behaviour Scryfall
 * has, and for the same reason: a page whose entire content is a single row
 * asking to be clicked has made the reader press twice for one destination.
 * Deliberately only on SUBMIT: arriving at a pasted `/search?q=…` link does NOT
 * redirect, because the sender chose to share a search and silently turning it
 * into a card page would rewrite what they sent.
 *
 * `display:` IS A QUERY TERM, and `?display=` is only read. The mode is taken
 * from the parsed query first; the legacy parameter gets a vote only where the
 * query says nothing. Writing it in both places would produce URLs that
 * contradict themselves.
 *
 * THE URL IS READ IN AN EFFECT, NOT AT INITIALISATION, for the reason
 * `RulesSearch` records at length: the server has no `window`, so initialising
 * from `?q=` renders a different tree than the server did and hydration fails
 * with React error #418.
 *
 * THE PAGE IS PART OF THE ADDRESS, not part of this component's state — `?page=`
 * and `?per=`, read on mount and on `popstate` exactly as `?q=` is, written on
 * every deliberate act exactly as `?q=` is. There is no cap left anywhere in
 * the path: `?per=all` resolves to an infinite limit and the reader is looking
 * at every row that matched. See `../../src/lib/pagination.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  OrnamentalRule,
  Pagination,
  SearchField,
} from "optfall-components/react";

import {
  type CardDisplayMode,
  type CardMatchField,
  decodeCardIndex,
  type EncodedCardIndex,
  searchCards,
} from "../../src/lib/card-search";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_PARAM,
  PAGE_SIZES,
  type PageSize,
  pageHref,
  paginate,
  parsePage,
  parsePageSize,
  requestFor,
  SIZE_PARAM,
  withPageParams,
} from "../../src/lib/pagination";
import { CardIndex, type CardIndexEntry } from "../components/CardIndex";

import "./CardSearch.css";

export interface CardSearchProps {
  readonly index: EncodedCardIndex;
  readonly ornament?: boolean;
}

/** Why a row is on the page, in the words of the ranking that put it there. */
const WHY: Record<CardMatchField, string> = {
  "name-exact": "exact name",
  "name-prefix": "name starts with",
  name: "name",
  type: "type line",
  keyword: "keyword",
  text: "card text",
  filter: "filter",
};

function queryFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function displayFromUrl(): CardDisplayMode | null {
  if (typeof window === "undefined") return null;
  const wanted = new URLSearchParams(window.location.search).get("display");
  if (wanted === "list") return "list";
  if (wanted === "text" || wanted === "checklist") return "text";
  if (wanted === "grid") return "grid";
  return null;
}

/** Which page, and how many rows on it. Read from the URL, like the query. */
function pagingFromUrl(): { page: number; size: PageSize } {
  if (typeof window === "undefined")
    return { page: 1, size: DEFAULT_PAGE_SIZE };
  const params = new URLSearchParams(window.location.search);
  return {
    page: parsePage(params.get(PAGE_PARAM)),
    size: parsePageSize(params.get(SIZE_PARAM)),
  };
}

/** The versions that matched, spoken. Written, never generated. */
function versionsMatched(pitches: readonly number[]): string {
  return pitches
    .map((pitch) => (pitch === 0 ? "no pitch" : `pitch ${pitch}`))
    .join(", ");
}

export function CardSearch({ index, ornament = false }: CardSearchProps) {
  const cards = useMemo(() => decodeCardIndex(index), [index]);

  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [paramDisplay, setParamDisplay] = useState<CardDisplayMode | null>(
    null,
  );
  /*
    FALSE ON THE SERVER AND ON THE FIRST CLIENT RENDER. The view switch is a
    radio group and does nothing without JavaScript — a control that looks
    operable and is not. The PAGER is not gated this way and must not be: it is
    made of real links, which is what lets a page of a search be an address.
    Flipping this in an effect keeps the two first renders identical, which is
    what hydration checks.
  */
  const [interactive, setInteractive] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInteractive(true);
    const fromUrl = queryFromUrl();
    if (fromUrl !== "") {
      setQuery(fromUrl);
      setSubmitted(fromUrl);
    }
    const paging = pagingFromUrl();
    setPage(paging.page);
    setSize(paging.size);
    setParamDisplay(displayFromUrl());
  }, []);

  /**
   * THE QUERY RUNS TWICE ONLY FOR A PAGE PAST THE END, and never otherwise.
   *
   * The slice the URL asks for is known before the query runs; how many pages
   * there are is not. So the common path is one pass at the requested offset,
   * and the only way to get an empty page out of a non-empty answer is a `?page=`
   * beyond the last one — a stale link, where a second pass against the clamped
   * offset is worth a ranking pass to avoid answering with a blank list.
   */
  const outcome = useMemo(() => {
    const wanted = requestFor(page, size);
    const first = searchCards(cards, submitted, wanted.limit, wanted.offset);
    if (first.results.length > 0 || first.total === 0) return first;
    const clamped = paginate(first.total, page, size);
    return searchCards(cards, submitted, clamped.limit, clamped.offset);
  }, [cards, submitted, page, size]);

  const asked = submitted.trim() !== "";
  const slice = paginate(outcome.total, page, size);
  const display = outcome.display ?? paramDisplay ?? "grid";

  const summary = (() => {
    if (!asked) return "";
    if (outcome.total === 0) return `Nothing matches ${submitted.trim()}.`;
    const found = `${outcome.total} card${outcome.total === 1 ? "" : "s"}`;
    /* The RANGE is the pager's sentence; this one states the total and, when
       there is more than one page, where in it the reader is standing. Said
       here as well as there because this string is what the live region
       announces, and a screen reader that is told the count but not the page
       has been told the answer moved without being told where to. */
    const where =
      slice.pages > 1 ? ` Page ${slice.page} of ${slice.pages}.` : "";
    return `${found} match${outcome.total === 1 ? "es" : ""}.${where}`;
  })();

  /**
   * The rows, in the shape every list of cards on this site is rendered from.
   *
   * THE MAPPING IS THE WHOLE OF WHAT SEARCH ADDS. A result knows why it is on
   * the page and which versions it stands for; a set page's row knows neither
   * and carries a printing instead. Both are `CardIndexEntry`, which is what
   * makes them one rendering rather than two that look alike.
   */
  const entries: readonly CardIndexEntry[] = outcome.results.map((result) => ({
    href: result.href,
    label: result.label,
    name: result.name,
    qualifier: result.qualifier,
    typeLine: result.typeLine,
    faceKey: result.faceKey,
    faceLandscape: result.faceLandscape,
    /*
      THE MATCHED VERSIONS, NOT EVERY VERSION. A `pitch:1` search that drew
      three bands under Head Jab would be answering a question about red with a
      picture of red, yellow and blue.

      AND EACH BAND IS A DOOR TO THE VERSION IT DREW, which is the whole of what
      carrying the addresses buys: the row goes to the card, the blue band goes
      to the blue one. A filtered search keeps that honest for free — only the
      versions that matched are drawn, so only the versions that matched can be
      clicked, and `banned:cc` cannot offer a reader the legal version of a card
      it has just put on a banned list.
    */
    versions: result.matchedVersions,
    stats: result.stats,
    /*
      ONLY SOME PITCH VERSIONS MATCHED, AND SAYING SO IS NOT OPTIONAL. Four
      names in this corpus carry versions whose Classic Constructed ban differs.
      A `banned:cc` row that named the card and stopped would put a card on a
      banned list without saying which version was banned.
    */
    note:
      result.matchedVersions.length < result.totalVersions
        ? versionsMatched(result.matchedVersions.map((v) => v.pitch))
        : undefined,
    why: WHY[result.matchedIn],
  }));

  /**
   * `written` is what the URL should say, and it is NOT always the box.
   *
   * A submit writes what was just asked; switching the view writes what is
   * *currently answered*. Both writing `query` meant that typing a new query
   * without submitting and then toggling the view pushed a URL carrying the
   * un-submitted text while the screen showed results for the old one.
   */
  const syncUrl = useCallback(
    (
      mode: "replace" | "push",
      written: string,
      dropParam: boolean,
      nextPage: number,
      nextSize: PageSize,
    ): void => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const trimmed = written.trim();
      if (trimmed === "") url.searchParams.delete("q");
      else url.searchParams.set("q", written);
      withPageParams(url.searchParams, nextPage, nextSize);
      /* The parameter is never written again, only read. A stale
         `?display=list` beside a `display:text` query is exactly the ambiguity
         the operator removed. */
      if (dropParam) url.searchParams.delete("display");
      const target = `${url.pathname}${url.search}`;
      if (target === `${window.location.pathname}${window.location.search}`) {
        return;
      }
      if (mode === "push") window.history.pushState({}, "", target);
      else window.history.replaceState({}, "", target);
    },
    [],
  );

  /**
   * The address of another page of THIS answer, built off the live URL.
   *
   * Off the URL rather than from `pageHref` so that everything this component
   * does not own survives the click — `?display=list` in particular, which is
   * read but never written, and which a from-scratch href would silently drop
   * and so change the view as a side effect of turning a page.
   *
   * `submitted` rather than `query`, for the reason `syncUrl`'s own comment
   * gives: the box may hold text that has not been asked yet, and a link
   * carrying it would point at a page of a search nobody has run.
   */
  const linkTo = useCallback(
    (nextPage: number, nextSize: PageSize): string => {
      /* The pager renders only under results, and results exist only after
         hydration — so this branch is unreachable in the server render rather
         than merely unused there. */
      if (typeof window === "undefined") {
        return pageHref("/search", submitted, nextPage, nextSize);
      }
      const url = new URL(window.location.href);
      if (submitted.trim() === "") url.searchParams.delete("q");
      else url.searchParams.set("q", submitted);
      withPageParams(url.searchParams, nextPage, nextSize);
      return `${url.pathname}${url.search}`;
    },
    [submitted],
  );

  /**
   * Turning a page returns the reader to the top of the results.
   *
   * The pager is BELOW the list, so a page turned in place leaves the reader
   * looking at the end of a list they have not seen the start of. No smooth
   * behaviour: this is a jump between two views of one answer, and animating it
   * would suggest the intervening rows exist.
   */
  const goTo = useCallback(
    (nextPage: number, nextSize: PageSize): void => {
      setPage(nextPage);
      setSize(nextSize);
      syncUrl("push", submitted, false, nextPage, nextSize);
      window.scrollTo({ top: 0 });
    },
    [submitted, syncUrl],
  );

  /** Back and forward have to work, which means listening for them. */
  useEffect(() => {
    const onPop = () => {
      const next = queryFromUrl();
      setQuery(next);
      setSubmitted(next);
      const paging = pagingFromUrl();
      setPage(paging.page);
      setSize(paging.size);
      setParamDisplay(displayFromUrl());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** `/` focuses the field, the way every reference tool worth using does. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      field.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /**
   * Switching view rewrites the QUERY, because the view is part of the query.
   *
   * The control and the syntax are two ways of saying one thing, so clicking
   * "Text" has to leave the box reading `dominate display:text` — otherwise the
   * reader copies what is on screen and gets a link that does not reproduce what
   * they were looking at. Any existing `display:` term is replaced rather than
   * appended: two of them would apply the last and silently ignore the first.
   */
  function show(next: CardDisplayMode): void {
    const withoutMode = submitted.replace(/(^|\s)display:\S+/gi, "$1").trim();
    const written = `${withoutMode} display:${next}`.trim();
    setQuery(written);
    setSubmitted(written);
    setParamDisplay(null);
    /* THE PAGE IS KEPT, and that is the point of switching views: the rows are
       the same rows in a different shape, so a reader six pages into an answer
       who wants to read the names instead of look at the faces has not asked to
       start over. */
    syncUrl("push", written, true, page, size);
  }

  return (
    <>
      <SearchField
        label="Search the cards"
        region="Flesh and Blood cards"
        action="/search"
        placeholder="command and conquer"
        value={query}
        onValueChange={setQuery}
        inputRef={field}
        onSubmit={(event) => {
          event.preventDefault();
          /*
            THE NEW QUERY IS RANKED HERE, NOT READ OFF `outcome`, and that is a
            React correction rather than a detail of the port.

            `outcome` is a `useMemo` over `submitted`, so inside this handler it
            still holds the PREVIOUS query's results: `setSubmitted` schedules a
            re-render, it does not recompute anything synchronously. The Svelte
            original could read its `$derived` on the line after assigning
            because a `$derived` recomputes when read; reading the memo here is
            one submit behind.

            That staleness is not cosmetic in either place it was used. The
            redirect would send the reader to the PREVIOUS query's single match
            — asking `dominate` right after a one-result query navigates to that
            earlier card and discards what was just typed — and `display` would
            decide whether to strip the legacy `?display=` parameter from the
            previous query's parse, leaving exactly the self-contradicting URL
            the operator exists to remove.

            It does mean the index is ranked twice per submit — here, and again
            in the memo when the re-render lands. That is accepted rather than
            overlooked: `searchCards` is pure, this is a submit rather than a
            keystroke, and the alternative is caching machinery to save one pass
            over an index the same interaction already pays for once.
          */
          const next = searchCards(cards, query, requestFor(1, size).limit);
          setSubmitted(query);
          /*
            A NEW QUERY IS PAGE ONE. Keeping the page across a submit would land
            the reader on page 6 of an answer they have not seen the top of —
            and on a shorter answer, on a page that does not exist. The SIZE is
            kept, because that is a preference about how they read rather than a
            position in one particular answer.
          */
          setPage(1);
          /*
            THE LEGACY PARAMETER IS FORGOTTEN EXACTLY WHEN IT IS DROPPED, and
            those two have to be one condition rather than two.

            `paramDisplay` was cleared in `show()` and on `popstate` but not
            here, so it outlived the URL it came from: arrive at
            `?q=x&display=list`, submit `x display:text` — the parameter is
            stripped from the address bar — then submit a plain `winter`, and the
            URL says nothing about display while the retained state still
            resolves it to `list`.

            Clearing it unconditionally produces the mirror image of that bug:
            arrive at `?q=winter&display=list` and press Enter without editing,
            and `next.display` is null so the parameter STAYS in the URL while
            the cleared state falls back to `grid` — the view changes under the
            reader and now contradicts the address bar it did not leave.

            So the state is forgotten on precisely the submits that drop the
            parameter, which is the same expression `syncUrl` is given.
          */
          const droppingParam = next.display !== null;
          if (droppingParam) setParamDisplay(null);
          syncUrl("push", query, droppingParam, 1, size);
          field.current?.blur();

          const only = next.total === 1 ? next.results[0] : undefined;
          if (only) window.location.assign(only.href);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query !== "") {
            event.preventDefault();
            setQuery("");
          }
        }}
        hint={
          /*
            THE PAGE'S ONE HINT LINE, AND IT IS THREE EXAMPLES AND A LINK. The
            first is Card Vault's, the second is ours, the third is the one
            nobody guesses. What it stopped doing is teaching the grammar in a
            paragraph — a hint is a doorway, not a manual, and `/syntax` is the
            manual it points at.
          */
          <>
            <code>pitch:3 class:guardian</code> · <code>banned:cc</code> ·{" "}
            <code>text:dominate</code> — <a href="/syntax">all operators</a>
          </>
        }
      />

      {/* Always present, never emptied. */}
      <p className="of-cards__announcement" role="status" aria-live="polite">
        {summary}
      </p>

      {outcome.notices.length > 0 ? (
        <ul className="of-cards__notices">
          {outcome.notices.map((notice) => (
            <li className="of-cards__notice" key={notice.kind + notice.text}>
              {notice.text}
            </li>
          ))}
        </ul>
      ) : null}

      <OrnamentalRule
        ornament={ornament}
        label={asked ? "Results" : "Browse"}
      />

      {asked ? (
        outcome.results.length > 0 ? (
          <>
            {/*
              EVERY LIST OF CARDS ON THIS SITE IS THIS COMPONENT, and search is
              one of its two callers rather than the only place a card grid
              exists. What was a hundred lines of grid, rows and names markup
              here is a mapping from `CardResult` to `CardIndexEntry` — see
              `entries` below — and the pager is handed in as a slot, because
              only this surface knows that a page of a search is
              `?q=…&page=…&per=…`.

              THE DISPLAY MODE STAYS HERE, because on this page it lives in the
              QUERY. `display:text` is a search operator, so clicking "Names"
              has to rewrite the box; a component that owned the mode would have
              no way to know that and the URL would stop reproducing the screen.
            */}
            <CardIndex
              entries={entries}
              display={display}
              onDisplayChange={show}
              summary={summary}
              controlName="display"
              interactive={interactive}
              pagination={
                /*
                  WHERE "N MORE MATCH. NARROW THE QUERY." USED TO BE.

                  That line counted rows it then refused to show, which
                  `docs/SCRYFALL-GAP.md` §4 named as the thing to delete: "a
                  refusal where Scryfall paginates. A grid makes it worse — 60
                  images is under one scroll." The count was never the problem
                  and it has not moved; what is new is that the rows it counts
                  are reachable, and that "all of them" is one of the things a
                  reader can ask for.

                  CHANGING THE SIZE GOES BACK TO PAGE ONE, because a page number
                  does not survive the change: page 4 of 60-row pages and page 4
                  of 240-row pages are different rows of the same answer, and
                  there is no reading of "4" that is true of both. Page one is
                  the one page that means the same thing at every size.
                */
                slice.needed ? (
                  <Pagination
                    from={slice.from}
                    href={(next) => linkTo(next, size)}
                    label="Pages of card results"
                    onNavigate={(next) => goTo(next, size)}
                    onResize={(next) => goTo(1, next)}
                    page={slice.page}
                    pages={slice.pages}
                    size={slice.size}
                    sizeHref={(next) => linkTo(1, next)}
                    sizes={PAGE_SIZES}
                    to={slice.to}
                    total={slice.total}
                    unit="cards"
                  />
                ) : null
              }
            />
          </>
        ) : (
          <p className="of-cards__count">
            Nothing in the {cards.size.toLocaleString("en-GB")} cards matches
            every part of <strong>{submitted.trim()}</strong>. Words match whole
            words and the start of words, so <code>domin</code> finds{" "}
            <code>dominate</code> — but every word you type has to appear in the
            name, the type line, a keyword or the printed text.
          </p>
        )
      ) : (
        <>
          <p className="of-cards__count">
            {cards.size.toLocaleString("en-GB")} cards, pinned to upstream
            commit <code>{cards.commit.slice(0, 7)}</code> and last confirmed{" "}
            {cards.confirmed}. Start with a type, or type above.
          </p>
          {/*
            The empty state is a browse, not a blank rectangle — and it is
            derived from the corpus rather than curated, so it cannot go stale
            and cannot express an opinion about which types matter. The count
            beside each is the real number of cards carrying that printed type
            line.
          */}
          <ul className="of-cards__browse">
            {cards.browse.map(([line, count]) => (
              <li key={line}>
                <a
                  className="of-cards__browse-link"
                  href={`/search?q=${encodeURIComponent(`type:"${line}"`)}`}
                >
                  {line}
                </a>
                <span className="of-cards__browse-count">{count}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
