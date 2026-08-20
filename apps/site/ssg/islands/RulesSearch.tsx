/**
 * The rules search field, and the results under it. The first ported island.
 *
 * THREE THINGS IT HAS TO GET RIGHT, unchanged from the Svelte original.
 *
 * 1. **Every view is a URL.** `/cr?q=dominate` is a real address that renders
 *    those results: the query is read from the URL on load, written back as you
 *    type (`replaceState`, so the back button is not filled with keystrokes) and
 *    pushed on submit. A search box whose results cannot be linked breaks the
 *    thing this project is for — `docs/PLAN.md` Phase 4: "the permalink is the
 *    product".
 * 2. **The form degrades to a static browse; live results need JavaScript.**
 *    The form is a real `GET`, so a browser with no islands running still
 *    produces a shareable URL and still reaches the chapter list and every
 *    `/cr/<id>` page under it. What it cannot do is answer the query: the
 *    ranking runs here, and a static build has no server to render `?q=` into
 *    results. That is a real limit, not a hedge, so the page says so in a notice
 *    above the field rather than letting a submitted query vanish in silence.
 * 3. **Nothing here composes prose.** Every string a user reads is either
 *    verbatim corpus text, an identifier, or interface wording written by a
 *    person and checked in.
 *
 * WHAT THE PORT CHANGED, AND IT IS ALL THE SAME CHANGE. Svelte's `$state`,
 * `$derived` and `$effect` become `useState`, plain computation, and
 * `useEffect`. Two things are worth naming because they are easy to get subtly
 * wrong:
 *
 * The decoded index is `useMemo`, not a bare call. `decodeIndex` walks 1,278
 * sections; doing that on every keystroke is the difference between a field that
 * feels instant and one that does not. Svelte's `$derived` was lazy and cached
 * for the same reason, and the original's comment argues the same point.
 *
 * The URL sync and the announcement are two separate debounced effects, as they
 * were. Merging them looks tidier and is wrong: the address bar should follow
 * the field, and a screen reader should be told once the typing has stopped —
 * the same delay, but for different reasons, and one of them will change.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Citation,
  OrnamentalRule,
  Pagination,
  SearchField,
} from "optfall-components/react";

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
import {
  chapters,
  decodeIndex,
  type EncodedIndex,
  search,
  type SearchResult,
} from "../../src/lib/search";

import "./RulesSearch.css";

export interface RulesSearchProps {
  /** Built at build time by `buildIndex`; see `search.ts` for the format. */
  readonly index: EncodedIndex;
  /*
    NO `ornament` PROP ANY MORE, and no caller ever passed one. It existed to
    spend the screen's single filigree on this component's section rule — the
    rule marks the end of the fold, between the hint and the chapter browse, and
    both of those are rendered HERE, so a page placing its own rule could only
    put it after the browse, ten rows below the fold it was meant to terminate.
    The reasoning was sound and the flag was dead: `cr.page.tsx` mounted this
    island without it from the day it was written, so the rule it was meant to
    decorate was the plain hairline the whole time. `OrnamentalRule` draws the
    centre mark unconditionally now, which gets the argument's intended result
    with nothing to pass.
  */
}

/** Settle time before the live region speaks, and before the URL is rewritten. */
const SETTLE = 600;

/** The query, read from the URL. Empty on the server, which is correct there. */
function queryFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
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

/** Why a row is on the page, in the words of the ranking that put it there. */
function why(result: SearchResult): string {
  switch (result.matchedIn) {
    case "id":
      return "section id";
    case "children":
      return `under ${result.matchedTerms.join(" ")}`;
    case "title":
      return "heading";
    default:
      return result.matchedTerms.join(" · ");
  }
}

export function RulesSearch({ index }: RulesSearchProps) {
  const rules = useMemo(() => decodeIndex(index), [index]);

  /**
   * THE QUERY STARTS EMPTY, THEN THE URL IS READ IN AN EFFECT, AND THAT ORDER
   * IS FORCED BY HYDRATION RATHER THAN CHOSEN.
   *
   * `useState(queryFromUrl)` is the obvious spelling and it is wrong here. The
   * server renders this island with no `window`, so it renders the empty query
   * — the chapter browse. The client, initialising from `?q=dominate`, renders
   * nine results. React compares the two and throws **error #418, "the server
   * rendered text didn't match the client"**, which it reported on the first
   * page this island was mounted on.
   *
   * Svelte tolerated the same mismatch silently, which is why the original could
   * read the URL during initialisation. React's contract is stricter and the
   * strictness is right: a hydration mismatch means the markup a crawler sees
   * and the markup a reader sees are different documents.
   *
   * So the first client render reproduces the server's, and the effect corrects
   * it immediately after. The cost is one extra render on a URL that carries a
   * query — the same brief browse-then-results the Astro island did, since it
   * was also server-rendered without one.
   */
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fromUrl = queryFromUrl();
    if (fromUrl !== "") setQuery(fromUrl);
    const paging = pagingFromUrl();
    setPage(paging.page);
    setSize(paging.size);
  }, []);

  /**
   * TYPING RESETS THE PAGE, AND READING THE URL MUST NOT — which is why this is
   * a handler on the field rather than an effect on `query`.
   *
   * An effect watching `query` cannot tell the two apart. It would fire when
   * the mount effect lifts `?q=` out of the URL, and reset the page to 1 before
   * the reader's `?q=dominate&page=3` had finished loading — a pasted link
   * that silently opens on the wrong page, which is the exact failure paging
   * exists to fix. The field knows something different: a keystroke is always a
   * new answer, and a new answer is always page one.
   */
  const type = useCallback((next: string): void => {
    setQuery(next);
    setPage(1);
  }, []);

  /**
   * ONE PASS, EXCEPT FOR A PAGE PAST THE END — see the same note on
   * `CardSearch`. This one runs on every keystroke, so the ordinary path being
   * a single ranking pass is not a nicety: the second pass happens only when
   * the URL asked for a page a shrinking answer no longer has.
   */
  const outcome = useMemo(() => {
    const wanted = requestFor(page, size);
    const first = search(rules, query, wanted.limit, wanted.offset);
    if (first.results.length > 0 || first.total === 0) return first;
    const clamped = paginate(first.total, page, size);
    return search(rules, query, clamped.limit, clamped.offset);
  }, [rules, query, page, size]);

  const asked = query.trim() !== "";
  const slice = paginate(outcome.total, page, size);

  /** Wording for the live region and the count line. Written, never generated. */
  const summary = (() => {
    if (!asked) return "";
    if (outcome.total === 0) return `Nothing matches ${query.trim()}.`;
    const sections = `${outcome.total} section${outcome.total === 1 ? "" : "s"}`;
    /* The RANGE is the pager's sentence. This one keeps the total and adds the
       position, because this string is what the live region announces and a
       listener told the count but not the page has been told the answer moved
       without being told where to. */
    const where =
      slice.pages > 1 ? ` Page ${slice.page} of ${slice.pages}.` : "";
    return `${sections} match${outcome.total === 1 ? "es" : ""}.${where}`;
  })();

  /**
   * What the live region says, deliberately behind the results.
   *
   * The results update on every keystroke because that is what makes the field
   * feel like a tool; announcing on every keystroke would make a screen reader
   * unusable, since each interruption cancels the last. So the region settles
   * after typing stops and announces once. Same information, at the speed a
   * listener can actually take it.
   */
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setAnnouncement(summary), SETTLE);
    return () => clearTimeout(timer);
  }, [summary]);

  /**
   * Keep the address bar in step with the field.
   *
   * `replaceState` while typing: a query is one navigation, not one per letter,
   * and a back button that walks backwards through "domin", "domi", "dom" is a
   * back button nobody can use. Submitting is the deliberate act, so that one
   * gets a `pushState` and a real history entry.
   */
  const syncUrl = useCallback(
    (
      mode: "replace" | "push",
      value: string,
      nextPage: number,
      nextSize: PageSize,
    ): void => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const trimmed = value.trim();
      if (trimmed === "") url.searchParams.delete("q");
      else url.searchParams.set("q", value);
      withPageParams(url.searchParams, nextPage, nextSize);
      const target = `${url.pathname}${url.search}`;
      if (target === `${window.location.pathname}${window.location.search}`) {
        return;
      }
      if (mode === "push") window.history.pushState({}, "", target);
      else window.history.replaceState({}, "", target);
      /*
       * `useCallback` WITH NO DEPENDENCIES, because it has none: every value it
       * reads is a parameter or a global. Without it the function is a new
       * identity each render, so the effect below either lists a dependency that
       * changes every time — an infinite loop — or omits it and lies about what
       * it closes over. Stabilising the function is the honest third option.
       */
    },
    [],
  );

  useEffect(() => {
    // Debounced so the browser's own rate limit on history writes is never the
    // thing that decides whether the URL is right.
    const timer = setTimeout(
      () => syncUrl("replace", query, page, size),
      SETTLE,
    );
    return () => clearTimeout(timer);
  }, [query, page, size, syncUrl]);

  /**
   * The address of another page of this answer, built off the live URL so that
   * anything this component does not own survives the click.
   */
  const linkTo = useCallback(
    (nextPage: number, nextSize: PageSize): string => {
      /* Unreachable in the server render rather than merely unused there: the
         pager is drawn under results, and there are none without `window`. */
      if (typeof window === "undefined") {
        return pageHref("/cr", query, nextPage, nextSize);
      }
      const url = new URL(window.location.href);
      if (query.trim() === "") url.searchParams.delete("q");
      else url.searchParams.set("q", query);
      withPageParams(url.searchParams, nextPage, nextSize);
      return `${url.pathname}${url.search}`;
    },
    [query],
  );

  /**
   * Turning a page is a deliberate act, so it gets a real history entry and the
   * top of the list — the pager sits below the results, and a page turned in
   * place leaves the reader looking at the end of a list they have not seen the
   * start of.
   *
   * `push` rather than the `replace` typing gets, on the same rule the submit
   * handler follows: a query is one navigation however many letters it took,
   * and moving through its pages is a series of them.
   */
  const goTo = useCallback(
    (nextPage: number, nextSize: PageSize): void => {
      setPage(nextPage);
      setSize(nextSize);
      syncUrl("push", query, nextPage, nextSize);
      window.scrollTo({ top: 0 });
    },
    [query, syncUrl],
  );

  /** Back and forward have to work, which means listening for them. */
  useEffect(() => {
    const onPop = () => {
      setQuery(queryFromUrl());
      const paging = pagingFromUrl();
      setPage(paging.page);
      setSize(paging.size);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /**
   * `/` focuses the field, the way every reference tool worth using does.
   *
   * Ignored while the caret is already in a control, so it can never eat a
   * character somebody meant to type — including in a field on some other part
   * of the page that this component knows nothing about.
   */
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

  const browse = useMemo(() => chapters(rules), [rules]);

  return (
    <>
      <SearchField
        label="Search the Comprehensive Rules"
        region="Comprehensive Rules"
        action="/cr"
        placeholder="dominate"
        value={query}
        onValueChange={type}
        inputRef={field}
        onSubmit={(event) => {
          // Only once hydrated. Without JavaScript this handler does not exist
          // and the form navigates to the same URL by itself.
          event.preventDefault();
          syncUrl("push", query, page, size);
          field.current?.blur();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && query !== "") {
            event.preventDefault();
            type("");
          }
        }}
        hint={
          /*
            THE PAGE'S ONE HINT LINE, AND IT LIVES HERE. One hint containing
            both halves — written once, in the component that owns the field it
            describes and is wired to it by `aria-describedby`. A page that adds
            a second hint of its own gets two hint lines on one screen and
            orphans the teaching from the field.
          */
          <>
            <code>dominate</code> searches the text · <code>cr:dominate</code>{" "}
            names the corpus · <code>8.3.4b</code> goes straight to that section
            — <a href="/search">card operators</a> are answered on the card
            search.
          </>
        }
      />

      {/* Always present, never emptied: a live region added to the page at the
          moment it has something to say is a live region that says nothing. */}
      <p className="of-rules__announcement" role="status" aria-live="polite">
        {announcement}
      </p>

      {outcome.notices.length > 0 ? (
        <ul className="of-rules__notices">
          {outcome.notices.map((notice) => (
            /* The wording is the engine's, not this component's: a notice is a
               statement about what the query engine did, and a surface free to
               rephrase it is a surface free to describe behaviour it does not
               have. */
            <li className="of-rules__notice" key={notice.kind + notice.text}>
              {notice.text}
            </li>
          ))}
        </ul>
      ) : null}

      {/* The break between the field and what is under it: results once
          something has been asked, the chapter browse before that. */}
      <OrnamentalRule label={asked ? "Results" : "Chapters"} />

      {asked ? (
        outcome.results.length > 0 ? (
          <>
            <p className="of-rules__count">{summary}</p>
            <ol className="of-rules__results">
              {outcome.results.map((result) => (
                <li className="of-rules__result" key={result.id}>
                  <Citation
                    ruleId={result.id}
                    href={result.href}
                    version={index.version}
                  />
                  <div className="of-rules__body">
                    <p className="of-rules__line">
                      {result.title ? (
                        <span className="of-rules__title">{result.title}</span>
                      ) : null}
                      {result.lede}
                    </p>
                    <p className="of-rules__meta">
                      <span className="of-rules__level">{result.level}</span>
                      <span className="of-rules__why">{why(result)}</span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {/*
              WHERE "N MORE MATCH. NARROW THE QUERY." USED TO BE. It counted
              sections it then refused to show; the count has not moved and the
              sections are now reachable. `?per=all` renders every one of them,
              which on this corpus is at most 1,278 rows of text.
            */}
            {slice.needed ? (
              <Pagination
                from={slice.from}
                href={(next) => linkTo(next, size)}
                label="Pages of rule results"
                onNavigate={(next) => goTo(next, size)}
                onResize={(next) => goTo(1, next)}
                page={slice.page}
                pages={slice.pages}
                size={slice.size}
                sizeHref={(next) => linkTo(1, next)}
                sizes={PAGE_SIZES}
                to={slice.to}
                total={slice.total}
                unit="sections"
              />
            ) : null}
          </>
        ) : (
          <p className="of-rules__count">
            Nothing in the Comprehensive Rules {index.version} matches every
            word of <strong>{query.trim()}</strong>. Words match whole words and
            the start of words, so <code>banis</code> finds{" "}
            <code>banished</code> — but every word you type has to appear
            somewhere in the section.
          </p>
        )
      ) : (
        <>
          {/*
            THE INVITATION ONLY. This line used to open with the section count
            and the rules version — and `cr.page.tsx` prints both, plus the
            publication date and a link to the source, in the provenance
            paragraph directly beneath this list. Two sentences on one screen
            saying "1,278 sections, version 2.14.0" is not emphasis.

            THE PROVENANCE LINE IS THE ONE THAT STAYS, and the choice between
            them is not arbitrary: `docs/PLAN.md` requires every surface to show
            when its data was last confirmed, so that paragraph is load-bearing
            and this one is a greeting. It is also the more complete of the two,
            and it is always on the page, where this appears only until the
            reader types.
          */}
          <p className="of-rules__count">
            Start with a chapter, or type above.
          </p>
          <ol className="of-rules__results">
            {browse.map((chapter) => (
              <li className="of-rules__result" key={chapter.id}>
                <Citation
                  ruleId={chapter.id}
                  href={chapter.href}
                  version={index.version}
                />
                <div className="of-rules__body">
                  <p className="of-rules__line">
                    <span className="of-rules__title">{chapter.title}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
