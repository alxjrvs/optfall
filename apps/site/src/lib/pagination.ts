/**
 * Which slice of a long answer is on screen — the arithmetic, and the two URL
 * parameters that carry it.
 *
 * WHAT THIS REPLACED. Both search surfaces used to rank every match, render the
 * first 60, and print "N more match. Narrow the query." The count was honest
 * and the rest of the answer was unreachable — `docs/SCRYFALL-GAP.md` §4 calls
 * that "a refusal where Scryfall paginates", and notes a grid makes it worse
 * because 60 images is under one scroll. This module is the other half of the
 * fix; `Pagination` in `optfall-components/react` is the control.
 *
 * NO CAP SURVIVES ANYWHERE IN THE PATH. `"all"` is a real member of
 * {@link PageSize} rather than a large number, and it resolves to an infinite
 * limit — so the slice is `results.slice(0)` and the reader is looking at every
 * row the engine matched. That is a promise about the engine as much as about
 * this file: `search` and `searchCards` take an offset and a limit and apply
 * them at the very end, after ranking, so no page can contain a row that a
 * different page would have ranked differently.
 *
 * THE PAGE IS IN THE URL, WHICH IS THE WHOLE REASON IT IS HERE AND NOT IN A
 * COMPONENT'S STATE. `docs/PLAN.md` Phase 4: "the permalink is the product".
 * Page 4 of a search has to be an address, or comparing two pages of one answer
 * means two windows of the same one.
 *
 * IT IS TWO PARAMETERS RATHER THAN ONE. `?page=` moves and `?per=` does not, so
 * folding them into a single `?rows=120-180` would make the common action —
 * next — rewrite the setting as well as the position, and would put an
 * arithmetic relationship between two numbers into a string a person edits by
 * hand.
 */

import type { PageSize } from "optfall-components";

export type { PageSize };

/**
 * The rows-per-page steps this product offers, smallest first.
 *
 * THEY DOUBLE, and the run starts below the old cap rather than at it. Doubling
 * is what makes four steps span an order of magnitude without asking the reader
 * to read a list of numbers, and 30 exists because the step *down* is the one a
 * phone on a slow connection wants — the grid is card images, and 60 of them
 * was the size that made the cap hurt in the first place.
 *
 * 60 IS STILL THE DEFAULT, deliberately. Nothing about a reader's first visit
 * changed; what changed is that the 61st result is now reachable.
 *
 * `"all"` IS AN OFFERED STEP, NOT AN ESCAPE HATCH. A deck builder pasting a
 * hundred names wants one list, and a tool that makes them collect it four
 * pages at a time has answered a different question. It is last because it is
 * the expensive one: `unique:art` over a broad query is thousands of images,
 * lazily loaded but all in one document.
 */
export const PAGE_SIZES: readonly PageSize[] = [30, 60, 120, 240, "all"];

/** The size a reader who has asked for nothing gets. The historical cap. */
export const DEFAULT_PAGE_SIZE: PageSize = 60;

/** `?page=`, and `?per=`. Named here so no surface spells them itself. */
export const PAGE_PARAM = "page";
export const SIZE_PARAM = "per";

/**
 * One page of an answer, resolved: what to slice, and what to say about it.
 *
 * Every field is derived from `(total, page, size)` and nothing here reads the
 * URL or the DOM, so the whole of paging is one pure function with an
 * exhaustively testable output.
 */
export interface PageSlice {
  /** Rows per page, as asked for. */
  readonly size: PageSize;
  /** The page on screen, clamped into range. 1 when there is nothing. */
  readonly page: number;
  /** How many pages the answer has. `1` for an empty answer, not `0`. */
  readonly pages: number;
  /** First row of the slice, 0-based — the argument to `slice`. */
  readonly offset: number;
  /** How many rows to take. `Infinity` under `"all"`, which `slice` accepts. */
  readonly limit: number;
  /** First row on screen, 1-based and inclusive. `0` when there are none. */
  readonly from: number;
  /** Last row on screen, inclusive. `0` when there are none. */
  readonly to: number;
  /** The true total, untouched. */
  readonly total: number;
  /**
   * Whether the control is worth drawing at all.
   *
   * A nine-result answer with a pager under it is a control that can do
   * nothing, and the surface would be spending a rule and a row of targets to
   * say so. It becomes true when a size on offer would actually change what is
   * on screen — or when the reader has already chosen one, since a setting you
   * cannot see is a setting you cannot undo.
   */
  readonly needed: boolean;
}

/** The smallest step on offer — the threshold at which a pager can do work. */
const SMALLEST = PAGE_SIZES.reduce<number>(
  (least, size) => (size === "all" ? least : Math.min(least, size)),
  Number.POSITIVE_INFINITY,
);

/**
 * Read `?per=`.
 *
 * ANYTHING UNRECOGNISED IS THE DEFAULT, silently, and that is the right
 * failure. The alternative is a notice about a URL parameter, which would put
 * an error message about typing above results that are perfectly correct — the
 * reader asked for cards, not for a validator. An unparseable page size costs
 * nothing to ignore, unlike an unparseable *query*, where guessing is exactly
 * what `PENDING_OPERATORS` exists to refuse.
 *
 * Only sizes on the list are honoured, so `?per=5000` cannot be used to ask a
 * browser for a document the interface never offers. `?per=all` can, which is
 * the reader deliberately choosing the expensive thing from the menu.
 */
export function parsePageSize(raw: string | null | undefined): PageSize {
  if (raw === null || raw === undefined) return DEFAULT_PAGE_SIZE;
  const wanted = raw.trim().toLowerCase();
  if (wanted === "all") return "all";
  const asNumber = Number.parseInt(wanted, 10);
  if (!Number.isFinite(asNumber)) return DEFAULT_PAGE_SIZE;
  return PAGE_SIZES.includes(asNumber) ? asNumber : DEFAULT_PAGE_SIZE;
}

/** Read `?page=`. Same rule: anything that is not a page number is page one. */
export function parsePage(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 1;
  const wanted = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(wanted) || wanted < 1) return 1;
  return wanted;
}

/** How a size is written into a URL. `60` → `"60"`, `"all"` → `"all"`. */
function formatPageSize(size: PageSize): string {
  return String(size);
}

/**
 * Resolve a page of an answer.
 *
 * THE PAGE IS CLAMPED, NOT REJECTED. `?page=900` on a three-page answer shows
 * the third page rather than an error or an empty list: a stale link is
 * overwhelmingly a link whose query still works and whose answer has moved, and
 * the last page is the closest true thing to what it asked for. The URL is left
 * saying 900 rather than being rewritten underneath the reader — nothing is
 * lost, since the next click writes a real page number.
 *
 * AN EMPTY ANSWER HAS ONE PAGE, NOT ZERO. `pages: 0` reads as "there is no page
 * one", which would make every caller special-case the empty state twice — once
 * for the results and once for the pager.
 */
export function paginate(
  total: number,
  page: number,
  size: PageSize,
): PageSlice {
  const rows = Math.max(0, Math.trunc(total));
  const limit = size === "all" ? Number.POSITIVE_INFINITY : Math.max(1, size);
  const pages = Math.max(1, Math.ceil(rows / limit));
  const at = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const offset = size === "all" ? 0 : (at - 1) * limit;

  return {
    size,
    page: at,
    pages,
    offset,
    limit,
    from: rows === 0 ? 0 : offset + 1,
    to: rows === 0 ? 0 : Math.min(rows, offset + limit),
    total: rows,
    needed: pages > 1 || rows > SMALLEST || size !== DEFAULT_PAGE_SIZE,
  };
}

/**
 * What to ask the engine for, before anything knows how many matches there are.
 *
 * PAGING HAS A CHICKEN-AND-EGG IN IT: the page has to be clamped against the
 * number of pages, and that number is not known until the query has run. This
 * is the unclamped half — the slice the URL literally asked for — and
 * {@link paginate} is the clamped half, applied to the total that comes back.
 * A caller that gets an empty page out of a non-empty answer knows the URL
 * asked for a page past the end, and runs the query once more against the
 * clamped offset. That second pass costs a ranking pass and only happens on a
 * stale link, which is the right place to spend it.
 */
export function requestFor(
  page: number,
  size: PageSize,
): { readonly offset: number; readonly limit: number } {
  if (size === "all") return { offset: 0, limit: Number.POSITIVE_INFINITY };
  const at = Math.max(1, Math.trunc(page) || 1);
  return { offset: (at - 1) * size, limit: size };
}

/**
 * Write the paging parameters into a query string, or clear them.
 *
 * THE DEFAULTS ARE DELETED RATHER THAN WRITTEN, and that is why this mutates a
 * caller's parameters instead of building its own. `?page=1&per=60` says
 * nothing the bare URL does not, and leaving either behind would make the
 * canonical address of a search depend on the route the reader took to it — two
 * links to one answer, which is the failure a permalink exists to prevent.
 *
 * It takes the whole parameter set because both surfaces have parameters this
 * module knows nothing about — `?q=`, and the legacy `?display=` the card
 * search reads but never writes — and a helper that returned a fresh string
 * would silently drop them.
 */
export function withPageParams(
  params: URLSearchParams,
  page: number,
  size: PageSize,
): void {
  if (page > 1) params.set(PAGE_PARAM, String(page));
  else params.delete(PAGE_PARAM);

  if (size !== DEFAULT_PAGE_SIZE) params.set(SIZE_PARAM, formatPageSize(size));
  else params.delete(SIZE_PARAM);
}

/**
 * The query string an island starts from, read off `location`.
 *
 * BOTH ISLANDS HAD THEIR OWN COPY OF THIS, character for character, and so did
 * {@link pagingFromUrl} below. The odd part was that the halves they call —
 * {@link parsePage} and {@link parsePageSize} — were already shared from here,
 * so the extraction had been done and then stopped one function short. Two
 * copies is the arrangement where a fix to one of them never reaches the other.
 *
 * The `window` guard is not defensive padding: these modules are imported by
 * the generator while it renders the static page, where there is no `location`
 * to read.
 */
export function queryFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

/** Which page, and how many rows on it. Read from the URL, like the query. */
export function pagingFromUrl(): { page: number; size: PageSize } {
  if (typeof window === "undefined")
    return { page: 1, size: DEFAULT_PAGE_SIZE };
  const params = new URLSearchParams(window.location.search);
  return {
    page: parsePage(params.get(PAGE_PARAM)),
    size: parsePageSize(params.get(SIZE_PARAM)),
  };
}

/**
 * Put a query and its paging into the address bar, on a surface that has both.
 *
 * THE THIRD COPY OUT OF THE ISLANDS, and the one with the most in it. The
 * extraction that shared {@link queryFromUrl} and {@link pagingFromUrl} took the
 * READING half; `CardSearch` and `RulesSearch` each kept a `syncUrl` of their
 * own, and the two were identical apart from one extra parameter. Everything
 * below — the `window` guard, trimming to decide delete-or-set, deferring the
 * page parameters to {@link withPageParams}, the no-op guard, and push versus
 * replace — was written twice.
 *
 * THE NO-OP GUARD IS THE PART WORTH SHARING, because it is the part that looks
 * like an optimisation and is not. `RulesSearch` writes the URL from a debounced
 * effect on every keystroke, so without it a reader who types and then deletes
 * back to where they started gets two history entries for one address — and
 * browsers rate-limit `pushState`, so the entries that matter can be the ones
 * dropped. It is load-bearing on the live surface and merely tidy on the
 * submit-driven one, which is exactly the asymmetry that makes a second copy
 * likely to lose it.
 *
 * `drop` IS HOW THE ONE REAL DIFFERENCE SURVIVES. `/search` deletes a legacy
 * `?display=` when the submitted query carries a `display:` operator of its own,
 * because a stale parameter beside a contradicting operator is the ambiguity
 * that operator exists to remove. `/cr` has no such parameter and passes
 * nothing. Naming it as a list of parameters to remove keeps the rule at the
 * call site that owns it rather than teaching this function what `display` is.
 */
export function writeQueryUrl(options: {
  readonly mode: "replace" | "push";
  /** What the URL should say. NOT always what is in the box — see `CardSearch`. */
  readonly query: string;
  readonly page: number;
  readonly size: PageSize;
  /** Parameters to delete outright. `/search` passes `display` on some submits. */
  readonly drop?: readonly string[];
}): void {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  if (options.query.trim() === "") url.searchParams.delete("q");
  else url.searchParams.set("q", options.query);
  withPageParams(url.searchParams, options.page, options.size);
  for (const param of options.drop ?? []) url.searchParams.delete(param);

  const target = `${url.pathname}${url.search}`;
  if (target === `${window.location.pathname}${window.location.search}`) return;

  if (options.mode === "push") window.history.pushState({}, "", target);
  else window.history.replaceState({}, "", target);
}

/**
 * The address of another page of the answer on screen, built off the LIVE URL.
 *
 * THE COUNTERPART TO {@link pageHref}, AND THE DIFFERENCE IS THE WHOLE POINT.
 * That one builds an address from scratch, which is right when there is no
 * `location` to read or when the address bar is stale. This one starts from the
 * URL the reader is actually on, so everything the component does not own
 * survives the click — `?display=list` in particular, which `/search` reads and
 * never writes, and which a from-scratch href would silently drop, changing the
 * view as a side effect of turning a page.
 *
 * IT FALLS BACK TO {@link pageHref} WITHOUT A `window`, and that branch is
 * unreachable rather than merely unused: both callers draw their pager under
 * results, and there are no results in a server render. It is kept because
 * "unreachable" is a claim about today's callers and `pageHref` is the correct
 * answer either way.
 *
 * Both islands had this, identical apart from the fallback path and what they
 * call the query — `RulesSearch` passes what is in the field, `CardSearch`
 * passes what the results answer, which is a distinction that matters at the
 * call site and not here.
 */
export function queryHref(
  pathname: string,
  query: string,
  page: number,
  size: PageSize,
): string {
  if (typeof window === "undefined")
    return pageHref(pathname, query, page, size);

  const url = new URL(window.location.href);
  if (query.trim() === "") url.searchParams.delete("q");
  else url.searchParams.set("q", query);
  withPageParams(url.searchParams, page, size);
  return `${url.pathname}${url.search}`;
}

/**
 * The address of one page of a query, built from scratch.
 *
 * FROM A GIVEN SEARCH STRING RATHER THAN FROM `location`, because the two
 * disagree at exactly the moments this is useful: on the server there is no
 * `location` at all, and inside a submit handler the address bar still holds
 * the previous query — the same staleness `CardSearch` records at length about
 * its own results memo.
 */
export function pageHref(
  pathname: string,
  query: string,
  page: number,
  size: PageSize,
): string {
  const params = new URLSearchParams();
  if (query.trim() !== "") params.set("q", query);
  withPageParams(params, page, size);
  const search = params.toString();
  return search === "" ? pathname : `${pathname}?${search}`;
}
