/**
 * `/sets`, filtered — the browsable spine with a way to walk it.
 *
 * THE PAGE ANSWERS "WHAT IS THERE" AND HAD NO WAY TO ANSWER "WHERE IS THAT".
 * `sets.page.tsx` has always argued that search and this list are different
 * needs — "an empty search box is a demand, not an invitation" — and the list
 * it grew into is 112 near-identical hairlines, newest first, with no way in
 * except the browser's own find. A reader looking for the Armory Decks scrolled
 * past sixteen of them scattered across three years.
 *
 * WHAT THE FILTERS ARE ALLOWED TO BE IS THE WHOLE DESIGN QUESTION HERE, and the
 * answer is: only facts the data states. A "kind" facet — booster set, deck,
 * promo — is the one every reader wants and the one nothing upstream supplies.
 * It would have to be inferred from the set's NAME, and a taxonomy invented in
 * this file and printed as a category is exactly the claim `CLAUDE.md` says not
 * to make. So the name is searched rather than parsed: typing "blitz deck"
 * finds the thirty-two of them because that is what they are called, and the
 * suggestions below are that same search offered in one press. A chip fills the
 * field and the field's text is visible, so the reader can always see that what
 * they have is a text match rather than a classification somebody asserted.
 *
 * THE CONTROLS EXIST ONLY AFTER HYDRATION, and the whole list is in the markup
 * either way. `interactive` is false on the server and on the first client
 * render — `CardList` and `CardSearch` both carry the same flag with the same
 * reasoning — because a text field and two `<select>`s that do nothing are
 * controls that look operable and are not. What a reader with no scripting gets
 * is the page as it was: every set, newest first, in year order.
 *
 * THE ERA HEADINGS ARE PART OF THE LIST RATHER THAN CHROME ON IT. A run of a
 * hundred rows with no landmarks is a page you scroll rather than read; the
 * years give it a spine, and they give a screen reader's heading list one too.
 * They are drawn only in the two DATE orders, because a year heading over a
 * list sorted by size would be a grouping the order does not respect.
 */

import { readableDate } from "optfall-components";
import { RarityBar } from "optfall-components/react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Choice, Joiner } from "../components/Choice";

import "./SetIndex.css";

/** One rarity's share of a set. The shape `RarityBar` draws. */
export interface SetIndexSlice {
  readonly rarity: string;
  readonly name: string;
  readonly count: number;
}

/**
 * One set, as this list needs it.
 *
 * FLAT AND ALREADY DERIVED, because the whole array crosses into the browser as
 * JSON in an attribute — see `Island`. Nothing here is a `Map`, a `Date` or a
 * function, and the counts are numbers rather than the formatted strings a row
 * prints, so the sort can use them.
 */
export interface SetIndexEntry {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  /** `YYYY-MM-DD`, or `null` where upstream publishes no date. */
  readonly released: string | null;
  readonly outOfPrint: boolean;
  /** Distinct card names — the number the row prints as "cards". */
  readonly names: number;
  /** Names this set printed that no other set in the corpus did. */
  readonly exclusive: number;
  readonly rarities: readonly SetIndexSlice[];
}

export interface SetIndexProps {
  /** Every listed set, in the page's own order: newest first, undated last. */
  readonly entries: readonly SetIndexEntry[];
}

type Status = "all" | "in-print" | "out-of-print";
type Order = "newest" | "oldest" | "largest" | "name";

const STATUSES: readonly (readonly [Status, string])[] = [
  ["all", "All sets"],
  ["in-print", "In print"],
  ["out-of-print", "Out of print"],
];

const ORDERS: readonly (readonly [Order, string])[] = [
  ["newest", "Newest first"],
  ["oldest", "Oldest first"],
  ["largest", "Most cards first"],
  ["name", "Name, A to Z"],
];

/**
 * The searches worth offering as a press rather than as typing.
 *
 * EACH ONE IS A LITERAL SUBSTRING OF THE SET NAMES IT FINDS, which is the
 * condition for offering it at all. Pressing one fills the field, so what the
 * reader ends up looking at is a text search they can see, edit and clear —
 * never a category this file decided a set belongs to. The counts are what they
 * are: "blitz deck" finds thirty-two sets because thirty-two sets are called
 * that, and if Legend Story Studios renames the line tomorrow this chip finds
 * nothing and is visibly a search that found nothing.
 *
 * FOUR, AND CHOSEN BY SIZE. In this corpus they find 32, 16, 15 and 8 sets
 * respectively; the next-largest line, the Hero Decks, is four, and a
 * chip for the two Mastery Packs would be furniture for a scroll of two rows.
 */
const SUGGESTIONS: readonly string[] = [
  "Blitz Deck",
  "Armory Deck",
  "Silver Age",
  "Promo",
];

/**
 * Lower case, and stripped of the marks a reader will not type.
 *
 * "Armory Deck Origins - Jarl Vetreiði" is in this corpus, and a reader typing
 * "vetreidi" is not making a mistake — they are typing what their keyboard
 * offers. `NFD` splits the base letter from its diacritic and the class removes
 * the diacritic, so the fold is one pass and needs no table of substitutions.
 */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Every term must match, in any order, anywhere in the name or the code.
 *
 * TERMS RATHER THAN THE WHOLE STRING, because the alternative fails on the
 * commonest query this list will get: "armory prism" is how somebody asks for
 * "Armory Deck Legends - Prism", and a substring match on the raw text finds
 * nothing. This is deliberately NOT the card grammar — there are no operators
 * here and there should not be, since the only two facts a set carries beyond
 * its name have controls of their own.
 */
function matches(haystack: string, terms: readonly string[]): boolean {
  return terms.every((term) => haystack.includes(term));
}

/**
 * The row's facts after the date, as one string — " · 155 cards · 42 only here".
 *
 * THE EXCLUSIVE COUNT IS OMITTED WHEN IT IS ZERO rather than printed as a zero.
 * "0 only here" is a row of noise on the fifteen Silver Age chapter decks and
 * on every Blitz Deck, and the absence of the phrase says the same thing more
 * quietly — this release printed nothing you cannot get elsewhere. It is the
 * one figure on this page no upstream field states, which is why it earns a
 * place beside the count and the date.
 */
function factsOf(entry: SetIndexEntry): string {
  const facts = [`${entry.names.toLocaleString("en-GB")} cards`];
  if (entry.exclusive > 0) {
    facts.push(`${entry.exclusive.toLocaleString("en-GB")} only here`);
  }
  if (entry.outOfPrint) facts.push("out of print");
  return ` · ${facts.join(" · ")}`;
}

/** The year a set belongs to, or `null` where it has no published date. */
function yearOf(entry: SetIndexEntry): string | null {
  return entry.released === null ? null : entry.released.slice(0, 4);
}

export function SetIndex({ entries }: SetIndexProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [order, setOrder] = useState<Order>("newest");
  /*
    FALSE ON THE SERVER AND ON THE FIRST CLIENT RENDER, exactly as `CardList`
    has it. The field and the two selects do nothing without JavaScript; the
    LIST is not gated this way and must not be, because it is made of real
    links and is the whole point of the page.
  */
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    setInteractive(true);
  }, []);

  const terms = useMemo(
    () => fold(query).split(/\s+/).filter(Boolean),
    [query],
  );

  const shown = useMemo(() => {
    const kept = entries.filter((entry) => {
      if (status === "in-print" && entry.outOfPrint) return false;
      if (status === "out-of-print" && !entry.outOfPrint) return false;
      return matches(fold(`${entry.name} ${entry.id}`), terms);
    });

    /*
      `entries` ARRIVES NEWEST FIRST, which is the page's own order and the one
      `SETS_BY_RELEASE` documents at length — undated last, tiebroken by code,
      total so that two builds cannot disagree. So "newest" does no work at all
      and "oldest" is that order reversed, which keeps both date orders derived
      from the one sort rather than from a second implementation of it here.
    */
    if (order === "newest") return kept;
    if (order === "oldest") return kept.toReversed();
    if (order === "name") {
      return kept.toSorted((a, b) => a.name.localeCompare(b.name, "en-GB"));
    }
    return kept.toSorted((a, b) =>
      /* Most cards first, tiebroken by the corpus order so the sort is total. */
      a.names === b.names ? 0 : b.names - a.names,
    );
  }, [entries, order, status, terms]);

  /**
   * The list, cut into eras — or one era with no heading.
   *
   * A HEADING PER YEAR ONLY IN THE DATE ORDERS. "2024" over a run sorted by
   * size would be a grouping the order does not respect, and the reader would
   * have to work out which of the two claims to believe.
   */
  const eras = useMemo(() => {
    if (order !== "newest" && order !== "oldest") {
      return [{ year: null, sets: shown }];
    }

    const grouped: { year: string | null; sets: SetIndexEntry[] }[] = [];
    for (const entry of shown) {
      const year = yearOf(entry);
      const last = grouped[grouped.length - 1];
      if (last !== undefined && last.year === year) last.sets.push(entry);
      else grouped.push({ year, sets: [entry] });
    }
    return grouped;
  }, [order, shown]);

  const suggest = useCallback((term: string) => {
    setQuery(term);
  }, []);

  /**
   * Whether the era headings are being drawn at all.
   *
   * The two size and name orders collapse to a single era with no year, and a
   * heading over that group would either name a year the order does not respect
   * or say "No published date" about a list that is mostly dated.
   */
  const headed = order === "newest" || order === "oldest";

  const summary =
    shown.length === entries.length
      ? `${entries.length.toLocaleString("en-GB")} sets`
      : `${shown.length.toLocaleString("en-GB")} of ${entries.length.toLocaleString("en-GB")} sets`;

  return (
    <>
      {/*
        HIDDEN UNTIL HYDRATION, for the reason `interactive` gives. The
        `<label>` is visible rather than clipped: this is the page's only field
        and it is not the site header's card search, so a reader has to be told
        which corpus they are about to filter.
      */}
      {interactive ? (
        <div className="of-sets__filter">
          <label className="of-sets__filter-label" htmlFor="sets-filter">
            Filter by set name or code
          </label>
          <input
            autoCapitalize="off"
            autoComplete="off"
            className="of-sets__filter-field"
            id="sets-filter"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="mistveil, ARM, blitz deck…"
            spellCheck={false}
            type="search"
            value={query}
          />

          {/*
            THE SUGGESTIONS ARE BUTTONS AND NOT LINKS, because there is nowhere
            for a link to go — this page has one address and the filter is not
            in it. A `<button>` says "this acts here", which is the truth.
          */}
          <p className="of-sets__suggestions">
            <span className="of-sets__suggestions-label">Try</span>
            {SUGGESTIONS.map((term) => (
              <button
                className="of-sets__suggestion"
                key={term}
                onClick={() => suggest(term)}
                type="button"
              >
                {term}
              </button>
            ))}
            {query === "" ? null : (
              <button
                className="of-sets__suggestion of-sets__suggestion--clear"
                onClick={() => setQuery("")}
                type="button"
              >
                Clear
              </button>
            )}
          </p>

          {/*
            THE SAME CONTROL SENTENCE THE CARD INDEX READS AS, from the same
            component. "All sets sorted by Newest first" is one statement about
            the list rather than two independent switches, which is the shape
            `CardIndex.tsx` argues for at length and `Choice.tsx` now carries.
          */}
          <div className="of-sets__controls">
            <Choice
              id="sets-status"
              label="Print status"
              onChange={setStatus}
              options={STATUSES}
              value={status}
            />
            <Joiner>sorted by</Joiner>
            <Choice
              id="sets-order"
              label="Order by"
              onChange={setOrder}
              options={ORDERS}
              value={order}
            />
          </div>
        </div>
      ) : null}

      {/*
        OFF-SCREEN, CARRYING THE SAME WORDS THE COUNT PRINTS. Two elements
        rather than one made live, which is the arrangement `.of-index__count`
        and `.of-index__announcement` already use: a visible count that is also
        a live region re-announces itself on every unrelated re-render.

        ONLY ONCE THE CONTROLS EXIST. Before hydration nothing can change the
        list, so a live region has nothing to report and would announce the
        starting count as though it were news.
      */}
      {interactive ? (
        <p aria-live="polite" className="of-sets__announcement" role="status">
          {summary}
        </p>
      ) : null}

      <p className="of-sets__count">{summary}</p>

      {shown.length === 0 ? (
        <p className="of-sets__empty">
          {query === "" ? (
            "No set in this corpus has that print status."
          ) : (
            <>
              No set matches <strong>{query}</strong>
              {status === "all" ? null : " in that print status"}. Set names are
              searched as written — try a shorter word, or the three-letter
              code.
            </>
          )}
        </p>
      ) : null}

      {eras.map((era) => (
        <section className="of-sets__era" key={era.year ?? "undated"}>
          {!headed ? null : era.year === null ? (
            /* NOT "UNKNOWN": upstream publishes no date for these sets, which
               is a fact about the record rather than a gap in it — the same
               wording the set page's masthead uses for the same absence. */
            <h2 className="of-sets__year">No published date</h2>
          ) : (
            <h2 className="of-sets__year">{era.year}</h2>
          )}

          <ul className="of-sets">
            {era.sets.map((entry) => (
              <li className="of-sets__set" key={entry.id}>
                <a className="of-sets__name" href={entry.href}>
                  {entry.name}
                </a>
                <span className="of-sets__code">{entry.id}</span>
                <span className="of-sets__meta">
                  {entry.released === null ? (
                    "undated"
                  ) : (
                    <time dateTime={entry.released}>
                      {readableDate(entry.released)}
                    </time>
                  )}
                  {/*
                    THE REST OF THE LINE IS ONE STRING RATHER THAN FIVE
                    EXPRESSIONS, and that is markup rather than style. React
                    separates adjacent text children with `<!-- -->` so that
                    hydration can tell them apart, so `{count} cards` renders
                    as `155<!-- --> cards` — a comment in the middle of a
                    phrase, which anything reading the page as text has to
                    know to strip. Composed once, it is one text node.
                  */}
                  {factsOf(entry)}
                </span>
                {/*
                  THE ROW'S DIVIDER IS THE SET'S OWN RARITY MIX, which is the
                  whole of what this page gained. `docs/COMPLIANCE.md` bars set
                  logos, so there has never been a per-set mark to draw; the
                  bar is one derived from the corpus, and it is drawn at the
                  small size — two pixels — precisely so that a hundred of them
                  read as the hairlines this list has always used to separate
                  rows rather than as a hundred coloured bands.

                  EVERY LISTED SET HAS ONE. The page lists a set only when the
                  corpus carries a card from it, so the set has printings, so
                  the mix has at least one slice. A set that somehow had none
                  loses its divider rather than its row, which is visible.
                */}
                <span className="of-sets__mix">
                  {/*
                    NO `label`, DELIBERATELY. The component composes the mix
                    into a sentence itself, and a prefix naming the set would
                    mean this file composing that sentence a second time — the
                    duplication `RarityBar`'s own docblock refuses on the
                    ordering and refuses here for the same reason. The bar is
                    inside the `<li>` whose first element is the set's name, so
                    the context a reader needs is the previous thing announced.
                  */}
                  <RarityBar size="sm" slices={entry.rarities} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
