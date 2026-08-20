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

import { Pagination } from "optfall-components/react";
import { useStore } from "@tanstack/react-store";

import {
  type CardDisplayMode,
  type CardIndex as DecodedCardIndex,
  type CardMatchField,
  type CardOutcome,
  decodeCardIndex,
  type EncodedCardIndex,
  parseCardQuery,
  searchCards,
} from "../../src/lib/card-search";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZES,
  type PageSize,
  queryHref,
  paginate,
  pagingFromUrl,
  queryFromUrl,
  requestFor,
  writeQueryUrl,
} from "../../src/lib/pagination";
import { CardIndex, type CardIndexEntry } from "../components/CardIndex";
import { HEADER_FIELD_ID } from "./HeaderSearch";
import {
  answerInPlace,
  headerSearchStore,
  setHeaderQuery,
} from "./headerSearchStore";
import { useFocusShortcut } from "./useFocusShortcut";
import { useSearchIndex } from "./useSearchIndex";

import "./CardSearch.css";

/**
 * The header's input, for FOCUS AND BLUR ONLY — and that restriction is the
 * whole of what is left of the adoption this island used to do.
 *
 * ~~A string shared with `SiteHeader.tsx` and nothing enforces it.~~ The id is
 * declared once now, by the component that renders the element
 * (`./HeaderSearch.tsx`), and imported here rather than spelled again.
 *
 * WHY A DOM LOOKUP SURVIVES AT ALL, since removing them is the point of the
 * change: focus is not state. There is no value to keep in step, nothing to
 * render, and no React equivalent — `/` focuses the field and a submit blurs it,
 * both of which are imperative acts on a node at a moment in time. Routing them
 * through the store would mean a counter per gesture and an effect per counter,
 * which is more machinery than the two calls it replaces.
 *
 * The distinction to hold on to: reading or writing this node's VALUE is state
 * synchronisation and belongs in the store; asking it to take the caret is not.
 * A `null` here costs a keyboard shortcut, never a wrong answer.
 */
function headerField(): HTMLInputElement | null {
  const found = document.getElementById(HEADER_FIELD_ID);
  return found instanceof HTMLInputElement ? found : null;
}

/**
 * Everything this island prints before anybody has searched.
 *
 * DECLARED HERE RATHER THAN IMPORTED FROM `ssg/searchIndexes.ts`, which is where
 * it is built. That module reads the 18 MB corpus at module scope, and this file
 * is reached by the island bundle — `build.ts`'s island budget exists because a
 * value import across exactly that line once shipped the whole corpus to every
 * reader. The two declarations are checked against each other at the one place
 * both are in scope, which is `search.page.tsx`.
 */
export interface CardCorpusBrief {
  /** How many cards the corpus carries. */
  readonly size: number;
  /** The upstream commit it is pinned at. Displayed, never parsed. */
  readonly commit: string;
  /** `YYYY-MM-DD` it was last confirmed against upstream. */
  readonly confirmed: string;
  /** Printed type lines and how many cards carry each. */
  readonly browse: readonly (readonly [string, number])[];
}

export interface CardSearchProps {
  /**
   * Where the encoded index is, NOT the index.
   *
   * It used to be the index — 909,626 bytes of it, in a `data-props` attribute,
   * which made `/search` a 921 kB document and earned it its own entry in
   * `build.ts`'s page-budget exceptions. `ssg/searchIndexes.ts` carries the
   * argument for the change; `./useSearchIndex.ts` carries the mechanism.
   */
  readonly indexUrl: string;
  /**
   * The count, the pin and the type-line browse.
   *
   * WHAT THE PAGE CAN SAY WITH NO INDEX, and the reason moving the index out
   * costs this surface nothing. `docs/PLAN.md` requires every surface to show
   * when its data was last confirmed, so the pin cannot wait on a request — a
   * provenance line that appears only once a fetch succeeds is missing exactly
   * when something has gone wrong. 805 bytes, against the 909,626 they replace.
   */
  readonly brief: CardCorpusBrief;
  /*
    NO `ornament` FLAG, because there is no rule left here to spend it on. See
    the note where that rule used to be rendered, below.
  */
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

/**
 * The legacy `?display=` parameter, which predates the operator.
 *
 * `text` AND `checklist` LAND ON `list` NOW, silently, and the silence is the
 * one difference from the operator's own handling. `parseCardQuery` raises an
 * `operand-retired` notice for a TYPED `display:text`, because somebody chose
 * those words just now and deserves to be told they moved. This is a parameter
 * on a link somebody followed — very likely one they did not write — so a
 * notice here would explain a vocabulary change to a reader who never used the
 * old vocabulary.
 */
function displayFromUrl(): CardDisplayMode | null {
  if (typeof window === "undefined") return null;
  const wanted = new URLSearchParams(window.location.search).get("display");
  if (wanted === "list" || wanted === "text" || wanted === "checklist")
    return "list";
  if (wanted === "grid") return "grid";
  return null;
}

/**
 * The answer when there is no index to ask.
 *
 * A REAL OUTCOME RATHER THAN A NULL, so every reader of `outcome` below is
 * unchanged and none of them has to learn the index may be absent. The component
 * branches on that where it renders, once, rather than at every field access.
 *
 * The defaults are the parser's own for an empty query — `sort` unkeyed, `unique`
 * collapsed to names — so nothing here invents a state the engine cannot produce.
 */
const NO_OUTCOME: CardOutcome = {
  query: "",
  terms: [],
  filters: [],
  notices: [],
  sort: { key: null, direction: "asc" },
  unique: "names",
  display: null,
  results: [],
  total: 0,
  setFocus: null,
};

export function CardSearch({ indexUrl, brief }: CardSearchProps) {
  /*
   * THE INDEX IS FETCHED, AND ON THE SERVER IT IS SIMPLY ABSENT — which is the
   * correct server render and always was. This island has never produced a
   * result without `window`: `?q=` is read in an effect (see below), so the
   * server renders the empty state, which is the pin and the type-line browse.
   * Both come from `brief` now, and neither ever needed the index.
   */
  const {
    index: cards,
    pending,
    failed,
  } = useSearchIndex<EncodedCardIndex, DecodedCardIndex>(
    indexUrl,
    decodeCardIndex,
  );

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
  /**
   * THE HEADER'S FIELD, AND THIS COMPONENT NO LONGER TOUCHES IT.
   *
   * `docs/SCRYFALL-GAP.md` §5.2 says the front door's hero is a search field and
   * every other screen carries the header's. This page used to have both: a hero
   * field of its own, with the header's suppressed by `headerSearch: false`,
   * which meant the results page looked like a second front door rather than
   * like the rest of the site. So it uses the shell's field, and the question has
   * always been how.

   * ~~So the island ADOPTS the field the shell already renders.~~ **It reads a
   * store instead.** `islands/HeaderSearch.tsx` renders that field now — it is
   * an island whose container IS the shell's form — and the two talk through
   * `./headerSearchStore.ts`. Neither reaches into the other's tree.
   *
   * WHAT WENT WITH THE ADOPTION, because the list is the argument for the
   * change: a `getElementById` for a node in another root, three
   * `addEventListener`s on it, a ref holding the latest submit closure so those
   * listeners could be bound once, a ref holding the latest Escape closure for
   * the same reason, and an effect writing state back into the DOM `value` with
   * a first-run skip and an inequality guard to keep the caret still. About a
   * hundred and fifty lines, and three bugs came out of them — text typed during
   * hydration erased, a paste-then-Enter running the previous query, a caret
   * jumping to the end mid-word.
   *
   * THE FORM IS STILL A REAL `GET`, which is the property none of this may cost.
   * `action="/search"` and `method="get"` are the shell's attributes on the
   * container element, untouched by React, so with no JavaScript the field
   * submits and navigates exactly as before.
   */
  const submissions = useStore(headerSearchStore, (state) => state.submissions);

  /*
   * CLAIM THE SUBMITS, AND GIVE THEM BACK ON UNMOUNT.
   *
   * `HeaderSearch` only calls `preventDefault()` while this is set — see
   * `answerInPlace`. Until this island has mounted, and after it goes away, the
   * header's form navigates instead, which is what keeps a page whose results
   * island failed to hydrate from having a search box that answers nothing.
   */
  useEffect(() => answerInPlace(), []);

  useEffect(() => {
    setInteractive(true);
    const fromUrl = queryFromUrl();
    if (fromUrl !== "") {
      setHeaderQuery(fromUrl);
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
    /* No index, no answer. The screen says which of the two reasons it is. */
    if (cards === undefined) return NO_OUTCOME;
    const wanted = requestFor(page, size);
    const first = searchCards(cards, submitted, wanted.limit, wanted.offset);
    if (first.results.length > 0 || first.total === 0) return first;
    const clamped = paginate(first.total, page, size);
    return searchCards(cards, submitted, clamped.limit, clamped.offset);
  }, [cards, submitted, page, size]);

  const asked = submitted.trim() !== "";
  /**
   * A QUESTION NOTHING CAN ANSWER YET, WHICH IS NOT THE SAME AS NO MATCHES.
   *
   * `docs/PLAN.md`'s "degrade visibly" is the whole of this distinction. The
   * empty-result copy names a number — "Nothing in the 4,941 cards matches" —
   * so rendering it while the index is in flight is not a vague inaccuracy, it
   * is a specific claim about a corpus that has not been read yet.
   */
  const waiting = asked && pending;
  const unanswerable = asked && failed;
  const slice = paginate(outcome.total, page, size);
  const display = outcome.display ?? paramDisplay ?? "grid";

  const summary = (() => {
    if (!asked) return "";
    /* Both said before the count, because both mean the count is not an answer.
       A listener told "nothing matches" while the index is still in flight has
       been told the wrong thing, and told it first. */
    if (waiting) return `Loading the card index to answer ${submitted.trim()}.`;
    if (unanswerable) {
      return `The card index did not load, so ${submitted.trim()} cannot be answered here.`;
    }
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
  /**
   * `written` is what the URL should say, and it is NOT always the box.
   *
   * A submit writes what was just asked; switching the view writes what is
   * *currently answered*. Both writing the box meant that typing a new query
   * without submitting and then toggling the view pushed a URL carrying the
   * un-submitted text while the screen showed results for the old one. That
   * distinction is why the calls below pass `submitted` rather than the field.
   *
   * ~~The write itself lived here.~~ It is `writeQueryUrl` in
   * `../../src/lib/pagination.ts` now, shared with `RulesSearch`, which had an
   * identical copy down to the no-op guard. The one difference survives as
   * `drop`: this surface deletes a legacy `?display=` on the submits that carry
   * a `display:` operator, because a stale parameter beside a contradicting
   * operator is the ambiguity the operator exists to remove. `/cr` has no such
   * parameter and passes nothing.
   */

  /**
   * The address of another page of THIS answer, built off the live URL.
   *
   * Off the URL rather than from `pageHref` so that everything this component
   * does not own survives the click — `?display=list` in particular, which is
   * read but never written, and which a from-scratch href would silently drop
   * and so change the view as a side effect of turning a page.
   *
   * `submitted` rather than the box, for the reason the note above `show` gives
   * gives: the box may hold text that has not been asked yet, and a link
   * carrying it would point at a page of a search nobody has run.
   */
  /**
   * The address of another page of THIS answer, built off the live URL.
   *
   * Off the URL rather than from `pageHref` so that everything this component
   * does not own survives the click — `?display=list` in particular, which is
   * read but never written, and which a from-scratch href would silently drop
   * and so change the view as a side effect of turning a page.
   *
   * `submitted` rather than the box, for the reason the note above `show`
   * gives: the field may hold text nobody has asked yet, and a link carrying it
   * would point at a page of a search that was never run.
   */
  const linkTo = useCallback(
    (nextPage: number, nextSize: PageSize): string =>
      queryHref("/search", submitted, nextPage, nextSize),
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
      writeQueryUrl({
        mode: "push",
        query: submitted,
        page: nextPage,
        size: nextSize,
      });
      window.scrollTo({ top: 0 });
    },
    [submitted],
  );

  /** Back and forward have to work, which means listening for them. */
  useEffect(() => {
    const onPop = () => {
      const next = queryFromUrl();
      setHeaderQuery(next);
      setSubmitted(next);
      const paging = pagingFromUrl();
      setPage(paging.page);
      setSize(paging.size);
      setParamDisplay(displayFromUrl());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useFocusShortcut(headerField);

  /**
   * Switching view rewrites the QUERY, because the view is part of the query.
   *
   * The control and the syntax are two ways of saying one thing, so clicking
   * "List" has to leave the box reading `dominate display:list` — otherwise the
   * reader copies what is on screen and gets a link that does not reproduce what
   * they were looking at. Any existing `display:` term is replaced rather than
   * appended: two of them would apply the last and silently ignore the first.
   */
  /**
   * Rewrite one operator in the submitted query, and answer the new one.
   *
   * ONE FUNCTION FOR ALL FOUR CONTROLS, and it started as `show()` for
   * `display:` alone. The bar now drives `unique:`, `display:`, `order:` and
   * `dir:`, and four copies of this would be four chances for one of them to
   * forget to strip the term it is replacing — which does not error, it silently
   * applies the LAST of two contradicting operators.
   *
   * `value === null` REMOVES THE TERM, which is what "Relevance" means. There is
   * no `order:relevance` to write: the absence of `order:` IS ranking by match,
   * so the option that says so has to delete rather than assign. Writing a term
   * the parser would reject as an unknown operand is the one outcome worse than
   * the control not existing.
   *
   * The page is KEPT, and that is deliberate for the view but arguable for the
   * others — see the call sites, which is where the difference is decided.
   */
  const rewrite = useCallback(
    (
      changes: readonly (readonly [string, string | null])[],
      resetPage: boolean,
    ): void => {
      let text = submitted;
      for (const [field, value] of changes) {
        const pattern = new RegExp(`(^|\\s)${field}:\\S+`, "gi");
        text = text.replace(pattern, "$1");
        if (value !== null) text = `${text} ${field}:${value}`;
      }
      /*
        THE SPACES ARE COLLAPSED, AND THAT IS NOT TIDINESS — IT IS THE PRODUCT.
        Stripping a term replaces " order:cost" with the single space that
        preceded it, so removing one from the middle left `wrath  dir:desc`:
        two spaces in the address bar, two spaces in the box the reader copies
        out of, and a link that does not look like something a person typed.
        The parser tokenises on whitespace and never minded; the reader would.
      */
      const written = text.replace(/\s+/g, " ").trim();
      const nextPage = resetPage ? 1 : page;
      setHeaderQuery(written);
      setSubmitted(written);
      setParamDisplay(null);
      if (resetPage) setPage(1);
      writeQueryUrl({
        mode: "push",
        query: written,
        page: nextPage,
        size,
        drop: ["display"],
      });
    },
    [page, size, submitted],
  );

  /**
   * Switching view rewrites the QUERY, because the view is part of the query.
   *
   * The control and the syntax are two ways of saying one thing, so choosing
   * "List" has to leave the box reading `dominate display:list` — otherwise the
   * reader copies what is on screen and gets a link that does not reproduce what
   * they were looking at. The label and the operand are now the same word, so
   * what the bar says and what the box says agree letter for letter.
   *
   * THE PAGE IS KEPT, and that is the point of switching views: the rows are the
   * same rows in a different shape, so a reader six pages into an answer who
   * wants to read the rows instead of look at the faces has not asked to start
   * over.
   */
  function show(next: CardDisplayMode): void {
    rewrite([["display", next]], false);
  }

  /**
   * What a submit does, lifted out of the JSX it used to live in.
   *
   * NAMED RATHER THAN INLINE BECAUSE THE FIELD IS NO LONGER OURS. The header's
   * input is a DOM node this island adopts, so the handler reaches it through
   * `submitRef` instead of through a prop — and a listener bound once on mount
   * would otherwise close over the first render's `query` forever.
   *
   * `raw` IS THE FIELD'S OWN VALUE AT SUBMIT, not `query`. See the note on
   * `submitRef`: state lags the input by a render, and the two can be read in
   * the same task.
   */
  function submitQuery(raw: string): void {
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
    /*
      AND IT IS PARSED EVEN WHEN IT CANNOT BE RANKED, which is the one thing
      the index arriving late is allowed to change here.

      A submit has two jobs: write the URL, and answer the query. Only the
      second needs the index. `parseCardQuery` is what decides `display` — the
      value the URL rewrite below turns on — so parsing it separately keeps
      the address exactly right whether or not the index has landed, and a
      reader who submits into a slow network still gets a link worth pasting
      and results the moment the fetch returns.

      What is lost while the index is absent is the single-result redirect
      below, and losing it is correct rather than merely acceptable: it fires
      on `next.total === 1`, and a total computed against no index is 0. It is
      a convenience on top of an answer, not the answer.
    */
    const next =
      cards === undefined
        ? parseCardQuery(raw)
        : searchCards(cards, raw, requestFor(1, size).limit);
    setHeaderQuery(raw);
    setSubmitted(raw);
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
      `?q=x&display=list`, submit `x display:grid` — the parameter is
      stripped from the address bar — then submit a plain `winter`, and the
      URL says nothing about display while the retained state still
      resolves it to `list`.

      Clearing it unconditionally produces the mirror image of that bug:
      arrive at `?q=winter&display=list` and press Enter without editing,
      and `next.display` is null so the parameter STAYS in the URL while
      the cleared state falls back to `grid` — the view changes under the
      reader and now contradicts the address bar it did not leave.

      So the state is forgotten on precisely the submits that drop the
      parameter, which is the same expression `drop` is given below.
    */
    const droppingParam = next.display !== null;
    if (droppingParam) setParamDisplay(null);
    writeQueryUrl({
      mode: "push",
      query: raw,
      page: 1,
      size,
      drop: droppingParam ? ["display"] : [],
    });
    headerField()?.blur();

    /* `in` rather than a cast: `parseCardQuery` returns no `total`, and the
       narrowing says out loud that this branch belongs to the ranked answer. */
    const only =
      "total" in next && next.total === 1 ? next.results[0] : undefined;
    if (only) window.location.assign(only.href);
  }

  /**
   * A SUBMIT HAPPENED, SO ANSWER IT.
   *
   * ~~Two refs holding the latest closures, assigned after every render~~ — the
   * refs existed because the submit listener was bound once on a DOM node this
   * component did not own, so it could not be allowed to close over a stale
   * render's `query`. There is no listener here any more: `HeaderSearch` owns
   * the form, and this reacts to the counter it increments.
   *
   * THE COUNTER IS THE DEPENDENCY, NOT THE TEXT, and that is the same
   * correctness the ref dance was protecting. Two submits of the same string are
   * two submits — which is exactly what a reader does when they press Enter on
   * an unchanged query — and an effect keyed on the text alone would fire once.
   *
   * `submittedQuery` IS READ RATHER THAN `query`, for the reason the store's own
   * docblock gives: `input` and `submit` can arrive in one task, and the two
   * fields are written together in one `setState` so they cannot disagree.
   *
   * SKIPPED ON THE FIRST RUN, because a fresh store starts at zero submissions
   * and an effect that ran anyway would answer a submit nobody made — clearing
   * `?q=` out of the URL of a link somebody had just followed.
   */
  const answered = useRef(0);
  useEffect(() => {
    if (submissions === answered.current) return;
    answered.current = submissions;
    submitQuery(headerSearchStore.state.submittedQuery);
  }, [submissions, submitQuery]);

  /**
   * The type-line browse, named once because two branches render it.
   *
   * It is the empty state — derived from the corpus rather than curated, so it
   * cannot go stale and cannot express an opinion about which types matter, and
   * the count beside each is the real number of cards carrying that printed type
   * line. It is ALSO what the failure branch offers instead of an answer, since
   * every row is an ordinary link that never needed the index. Spelling the list
   * twice would let the copies drift, and the one that drifts is the one nobody
   * looks at, which is the error path.
   */
  const browseList = (
    <ul className="of-cards__browse">
      {brief.browse.map(([line, count]) => (
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
  );

  return (
    <>
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

      {/*
        NO SECTION RULE HERE, AND THERE WAS ONE — an ornamented `OrnamentalRule`
        labelled "Results"/"Browse". It divided the example-query hint from what
        followed it, which was a real division for as long as the hint existed.
        The hint went (it repeated what the header's own field already says), and
        the rule stayed, so it became the first visible thing in `<main>` with
        nothing above it to divide from.

        A rule in that position separates the header from the page — a job the
        header already does with its own `border-block-end`, one hairline and
        40px further up. What was left was two lines with void between them, and
        the controls pushed 74px down the page while every other surface on the
        site starts its content 40px under the bar. Nothing replaces it: the
        divison it announced to a screen reader was between the header and the
        body, which is furniture rather than a thematic break.
      */}

      {asked && waiting ? (
        /*
          NOT A SPINNER, AND NOT AN EMPTY GRID. The index is one request against
          our own origin, and after the first search the service worker answers
          it from disk — so this is normally a frame or two. It says what it is
          waiting for anyway, because the case that matters is the slow one, and
          a results area that says nothing during it looks like an answer.
        */
        <p className="of-cards__count">
          Loading the card index to answer <strong>{submitted.trim()}</strong>.
        </p>
      ) : asked && unanswerable ? (
        <>
          {/*
            DEGRADE VISIBLY. Every card is still addressable — that is what the
            12,776 pages are for, and it does not depend on the index — so the
            failure is stated alongside the routes that still work rather than
            as a bare apology, and the browse is drawn under it for the same
            reason: those links are ordinary hrefs and they never needed an
            index either.
          */}
          <p className="of-cards__count">
            The card index did not load, so <strong>{submitted.trim()}</strong>{" "}
            cannot be answered here. Reloading may fix it. Every card is still
            reachable directly: <code>/card/head-jab</code> finds the card by
            name, and the type lines below are ordinary links.
          </p>
          {browseList}
        </>
      ) : asked ? (
        outcome.results.length > 0 ? (
          <>
            {/*
              EVERY LIST OF CARDS ON THIS SITE IS THIS COMPONENT, and search is
              one of its two callers rather than the only place a card grid
              exists. What was a hundred lines of grid and rows markup
              here is a mapping from `CardResult` to `CardIndexEntry` — see
              `entries` below — and the pager is handed in as a slot, because
              only this surface knows that a page of a search is
              `?q=…&page=…&per=…`.

              THE DISPLAY MODE STAYS HERE, because on this page it lives in the
              QUERY. `display:` is a search operator, so clicking "List"
              has to rewrite the box; a component that owned the mode would have
              no way to know that and the URL would stop reproducing the screen.
            */}
            <CardIndex
              entries={entries}
              display={display}
              onDisplayChange={show}
              /*
                THE OTHER THREE CONTROLS, WHICH ONLY THIS SURFACE CAN OFFER.
                `unique:` and `order:` are answered by the query engine, so a
                page with no query has nothing to hand over — see the props on
                `CardIndex`. All three read their CURRENT value off the outcome
                rather than off state of their own, exactly as `display` does:
                the query is the state, and a second copy of it is a second
                thing that can disagree with the address bar.

                EVERY ONE OF THESE RESETS TO PAGE ONE, and the view switch does
                not, which is not an inconsistency. A view shows the same rows
                in a different shape, so page 6 is still page 6. Re-ordering or
                re-collapsing changes WHICH rows are on a page — page 6 of a
                cost-sorted answer holds different cards than page 6 of a
                relevance-sorted one — so keeping the number would land the
                reader somewhere they did not ask to be, and `unique:art` can
                make the page they were on stop existing.
              */
              unique={outcome.unique}
              onUniqueChange={(next) => rewrite([["unique", next]], true)}
              order={outcome.sort.key ?? "relevance"}
              /*
                GOING BACK TO RELEVANCE TAKES `dir:` WITH IT, and it has to be
                one act rather than two.

                `dir:` only means anything beside an `order:`; relevance is the
                ranking's own order and reverses for nobody. Dropping the order
                alone left `wrath dir:desc` in the address bar with the direction
                control hidden — state that outlived the URL it came from, which
                a reader could neither see nor clear, and which would silently
                re-apply the moment they chose an ordering again. It is the same
                failure `paramDisplay` documents above, arrived at from the other
                side.
              */
              onOrderChange={(next) =>
                rewrite(
                  next === "relevance"
                    ? [
                        ["order", null],
                        ["dir", null],
                      ]
                    : [["order", next]],
                  true,
                )
              }
              direction={outcome.sort.direction}
              onDirectionChange={(next) => rewrite([["dir", next]], true)}
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
            Nothing in the {brief.size.toLocaleString("en-GB")} cards matches
            every part of <strong>{submitted.trim()}</strong>. Words match whole
            words and the start of words, so <code>domin</code> finds{" "}
            <code>dominate</code> — but every word you type has to appear in the
            name, the type line, a keyword or the printed text.
          </p>
        )
      ) : (
        <>
          <p className="of-cards__count">
            {brief.size.toLocaleString("en-GB")} cards, pinned to upstream
            commit <code>{brief.commit.slice(0, 7)}</code> and last confirmed{" "}
            {brief.confirmed}. Start with a type, or type above.
          </p>
          {browseList}
        </>
      )}
    </>
  );
}
