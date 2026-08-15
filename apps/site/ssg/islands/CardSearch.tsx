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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  CardFace,
  OrnamentalRule,
  PitchJewel,
  ResultRow,
  SearchField,
} from "optfall-components/react";

import {
  CARD_RESULT_LIMIT,
  type CardDisplayMode,
  type CardMatchField,
  decodeCardIndex,
  type EncodedCardIndex,
  searchCards,
} from "../../src/lib/card-search";
import { boxFor, faceUrl, placeholderUrl } from "../../src/lib/faces";

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
  const [paramDisplay, setParamDisplay] = useState<CardDisplayMode | null>(
    null,
  );
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fromUrl = queryFromUrl();
    if (fromUrl !== "") {
      setQuery(fromUrl);
      setSubmitted(fromUrl);
    }
    setParamDisplay(displayFromUrl());
  }, []);

  const outcome = useMemo(
    () => searchCards(cards, submitted),
    [cards, submitted],
  );
  const asked = submitted.trim() !== "";
  const truncated = outcome.total > outcome.results.length;
  const display = outcome.display ?? paramDisplay ?? "grid";

  const summary = (() => {
    if (!asked) return "";
    if (outcome.total === 0) return `Nothing matches ${submitted.trim()}.`;
    const found = `${outcome.total} card${outcome.total === 1 ? "" : "s"}`;
    const shown = truncated ? `, showing the first ${CARD_RESULT_LIMIT}` : "";
    return `${found} match${outcome.total === 1 ? "es" : ""}${shown}.`;
  })();

  /**
   * `written` is what the URL should say, and it is NOT always the box.
   *
   * A submit writes what was just asked; switching the view writes what is
   * *currently answered*. Both writing `query` meant that typing a new query
   * without submitting and then toggling the view pushed a URL carrying the
   * un-submitted text while the screen showed results for the old one.
   */
  const syncUrl = useCallback(
    (mode: "replace" | "push", written: string, dropParam: boolean): void => {
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      const trimmed = written.trim();
      if (trimmed === "") url.searchParams.delete("q");
      else url.searchParams.set("q", written);
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

  /** Back and forward have to work, which means listening for them. */
  useEffect(() => {
    const onPop = () => {
      const next = queryFromUrl();
      setQuery(next);
      setSubmitted(next);
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
    syncUrl("push", written, true);
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
          const next = searchCards(cards, query);
          setSubmitted(query);
          /*
            THE LEGACY PARAMETER IS FORGOTTEN ON SUBMIT, not merely dropped from
            the URL. `paramDisplay` was cleared in `show()` and on `popstate` but
            not here, so it outlived the URL it came from: arrive at
            `?q=x&display=list`, submit `x display:text` — the parameter is
            stripped from the address bar — then submit a plain `winter`, and the
            URL says nothing about display while the retained state still
            resolves it to `list`. The screen and the address bar disagree, which
            is the exact failure making `display:` an operator was meant to end.

            Pre-existing, and faithful to the Svelte original — but this handler
            is what decides the parameter is gone, so it is where forgetting it
            belongs.
          */
          setParamDisplay(null);
          syncUrl("push", query, next.display !== null);
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
            <div className="of-cards__result-head">
              <p className="of-cards__count">{summary}</p>
              {/*
                Two views of the same answer. A radio group rather than a pair of
                buttons, because that is what "pick exactly one" is, and it gets
                arrow keys and a group name for free.
              */}
              <fieldset className="of-cards__views">
                <legend className="of-cards__views-legend">
                  Show results as
                </legend>
                {(
                  [
                    ["grid", "Grid"],
                    ["list", "List"],
                    ["text", "Text"],
                  ] as const
                ).map(([mode, label]) => (
                  <label className="of-cards__view" key={mode}>
                    <input
                      type="radio"
                      name="display"
                      value={mode}
                      checked={display === mode}
                      onChange={() => show(mode)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>
            </div>

            {display === "grid" ? (
              /*
                The face is the row. Results are images by default, because
                recognising a card by its face is faster than reading its name —
                the single largest difference between this and every text-list
                card tool in the game.

                `CardFace` carries the copyright line on every one of these, and
                that is not negotiable: COMPLIANCE.md §5 forbids a variant that
                drops it.
              */
              <ul className="of-cards__grid">
                {outcome.results.map((result) => {
                  const box = boxFor(
                    "thumb",
                    result.faceLandscape ? "landscape" : "portrait",
                  );
                  return (
                    <li className="of-cards__cell" key={result.href}>
                      <a className="of-cards__cell-link" href={result.href}>
                        <CardFace
                          src={
                            result.faceKey === null
                              ? placeholderUrl(
                                  result.faceLandscape
                                    ? "landscape"
                                    : "portrait",
                                )
                              : faceUrl(result.faceKey, "thumb")
                          }
                          alt={`${result.label} — ${result.typeLine}`}
                          width={box.width}
                          height={box.height}
                        />
                        <span className="of-cards__cell-name">
                          {result.label}
                        </span>
                        {result.matchedPitches.length < result.totalVersions ? (
                          /*
                            ONLY SOME PITCH VERSIONS MATCHED, AND SAYING SO IS
                            NOT OPTIONAL. Four names in this corpus carry
                            versions whose Classic Constructed ban differs. A
                            `banned:cc` row that named the card and stopped would
                            put a card on a banned list without saying which
                            version was banned.
                          */
                          <span className="of-cards__cell-versions">
                            {versionsMatched(result.matchedPitches)}
                          </span>
                        ) : null}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : display === "list" ? (
              <ol className="of-cards__results">
                {outcome.results.map((result) => (
                  <ResultRow
                    key={result.href}
                    href={result.href}
                    label={result.label}
                    lead={<PitchJewel value={result.pitch} size="sm" />}
                    meta={
                      <>
                        <span>{result.typeLine}</span>
                        {result.stats.map(([label, value]) => (
                          <span key={label}>
                            {label} {value}
                          </span>
                        ))}
                        {result.matchedPitches.length < result.totalVersions ? (
                          <span>{versionsMatched(result.matchedPitches)}</span>
                        ) : null}
                        <span className="of-cards__why">
                          {WHY[result.matchedIn]}
                        </span>
                      </>
                    }
                  />
                ))}
              </ol>
            ) : (
              /*
                NAMES, ONE PER LINE, AND NOTHING ELSE. The mode whose output is
                meant to LEAVE the page: a player writing a deck list wants forty
                names they can select and paste. Each name is still a link,
                because a text list that cannot be clicked would be a worse
                version of the other modes rather than a different one.
              */
              <ol className="of-cards__text-results">
                {outcome.results.map((result) => (
                  <li key={result.href}>
                    <a href={result.href}>{result.label}</a>
                  </li>
                ))}
              </ol>
            )}

            {truncated ? (
              <p className="of-cards__count">
                {outcome.total - outcome.results.length} more match. Narrow the
                query — every word you add has to appear on the card.
              </p>
            ) : null}
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
