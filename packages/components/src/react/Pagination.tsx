/**
 * The pager — which slice of a long answer is on screen, and how to reach the
 * rest of it.
 *
 * IT EXISTS BECAUSE THE ALTERNATIVE WAS A REFUSAL. `docs/SCRYFALL-GAP.md` §4:
 * "The hard 60-result cap with 'narrow the query'. `CARD_RESULT_LIMIT` is a
 * refusal where Scryfall paginates. A grid makes it worse — 60 images is under
 * one scroll. Replace with paging, keeping the true total honest as it is now."
 * The honest total was never the problem; the missing thing was any way to see
 * the rows it counted.
 *
 * EVERY CONTROL IS A LINK, AND THAT IS THE LOAD-BEARING DECISION.
 *
 * A page of results is an ADDRESS — the same claim `docs/ROADMAP.md` Phase 4
 * makes about the rules corpus, a permanent URL for every paragraph, extended
 * to the one
 * part of the view a query string did not yet describe. Buttons would have made
 * page 4 of a search unshareable, unbookmarkable, and unopenable in a new tab,
 * which is precisely how a reader compares two pages of the same answer.
 *
 * So the caller supplies {@link PaginationProps.href}, every control renders as
 * a real `<a href>`, and the click handler is an ENHANCEMENT rather than the
 * mechanism: it is skipped for modified clicks, so cmd-click still opens a tab,
 * and a browser with no islands running follows the link and gets the same page
 * from the URL.
 *
 * THE ENDS ARE SPANS, NOT MISSING ELEMENTS. On page one there is no previous
 * page, and the control renders the word anyway as an inert `<span>`. Omitting
 * it would move every other control sideways at the two moments a reader is
 * most likely to be aiming at one — the first click into paging, and the last
 * click out of it. Measured on the reference and it does the same: Scryfall's
 * First and Previous are `<span class="button-n disabled">` on its first page
 * and `<a>` on its second, so this was never the divergence it looked like.
 *
 * ~~It does the same.~~ IT GOES ONE STEP FURTHER, AND THIS PAGER DELIBERATELY
 * DOES NOT FOLLOW IT THERE. Measured: the reference's spent controls also carry
 * `aria-hidden="true"` and `tabindex="-1"`, so they are greyed on screen and
 * absent from the accessibility tree entirely — a sighted reader sees four
 * steps and a screen-reader user is told there are two.
 *
 * Here the word stays announced. A spent step is not nothing: "Previous,
 * dimmed" is the answer to "can I go back", and a reader who is told nothing
 * has to infer it from silence. The layout argument above is about the control
 * not moving under a cursor; this is the same argument for a listener, who
 * pays for a changing control count in re-orientation rather than in a missed
 * click. The reference is not wrong to choose otherwise — GOV.UK omits the
 * control outright, which lands in the same place — but it is a choice about
 * what to say, not a detail of markup, so it is made here explicitly.
 *
 * `aria-disabled` IS NOT USED EITHER, by the reference or by this. A `<span>`
 * is not a control, so there is no disabled state for the attribute to report;
 * it belongs on something that could otherwise be operated.
 *
 * THERE ARE FOUR STEPS, AND THAT IS THE REFERENCE'S CONTROL SET. First,
 * Previous, Next, Last — Scryfall's whole pager, which carries no page numbers
 * at all. This one keeps its numbers and takes the words as well, so the two
 * ways of asking for the end are both available: the number says WHICH page it
 * is, the word just goes there. That is the one place the two shapes are
 * deliberately not the same, and it is a superset rather than a disagreement.
 *
 * NOTHING HERE KNOWS WHAT IS BEING PAGED. The noun in the range line arrives as
 * {@link PaginationProps.unit}, the counts on offer arrive as
 * {@link PaginationProps.sizes}, and both are decisions about a particular list:
 * a grid of card faces and a list of rule sections do not want the same steps.
 */

import type { MouseEvent } from "react";

import type { PageSize } from "../index";

import { OrnamentalRule } from "./OrnamentalRule";

import "./Pagination.css";

export interface PaginationProps {
  /** The page on screen, 1-based. */
  readonly page: number;
  /** How many there are. `1` means the whole answer is already on screen. */
  readonly pages: number;
  /** The rows-per-page currently in force. */
  readonly size: PageSize;
  /** The counts this list offers. Written by the surface, not by the control. */
  readonly sizes: readonly PageSize[];
  /** The true total — the number this component exists to make reachable. */
  readonly total: number;
  /** First row on screen, 1-based and inclusive. */
  readonly from: number;
  /** Last row on screen, inclusive. */
  readonly to: number;
  /**
   * The plural noun for a row: `"cards"`, `"sections"`.
   *
   * A prop rather than a guess, because this component cannot know what it is
   * counting and a component that invents the word for it would be composing
   * prose about data it has never seen.
   */
  readonly unit: string;
  /** Where a page lives. Called for every rendered control. */
  readonly href: (page: number) => string;
  /** Where a rows-per-page choice lives. */
  readonly sizeHref: (size: PageSize) => string;
  /**
   * Take the navigation client-side. Optional: without it the links are
   * ordinary links and the page reloads, which is the correct fallback rather
   * than a degraded one.
   */
  readonly onNavigate?: (page: number) => void;
  /** As {@link onNavigate}, for the rows-per-page choice. */
  readonly onResize?: (size: PageSize) => void;
  /**
   * Accessible name for the landmark. Defaults to `"Pages of results"`.
   *
   * Worth setting when a screen carries two pagers, which is the case this
   * default is wrong for: two `<nav>` elements with the same name are two
   * landmarks a screen reader cannot tell apart.
   */
  readonly label?: string;
}

/**
 * A gap in the numbered run, where pages were left out.
 *
 * A distinct value rather than a magic number, for the same reason `"all"` is a
 * string in {@link PageSize}: nothing arithmetic can produce it by accident.
 */
export const PAGE_GAP = "gap" as const;

/**
 * Which page numbers to draw, and where the runs of them break.
 *
 * THE FIRST AND LAST PAGE ARE ALWAYS DRAWN, and that is what makes this a
 * navigation rather than a nudge. "Jump to the end" is a real question about a
 * sorted list — the cheapest card, the last set alphabetically — and a control
 * that only offers the neighbours answers it with an unknown number of clicks.
 *
 * "JUMP TO THE END" NOW HAS TWO ANSWERS, and this is still one of them. The
 * pager gained First and Last as words, which reach the ends without reading a
 * number to find out where they are; drawing the numbers as well is what says
 * WHICH page the end is, and that is a different question from how to get
 * there. Neither makes the other redundant.
 *
 * THE WINDOW AROUND THE CURRENT PAGE IS FIXED WIDTH, so the control does not
 * grow as the reader walks into the middle of a long answer. `span` counts
 * pages on EACH side; the default of two gives a run of five.
 *
 * ~~Which is the widest that still fits beside "Previous" and "Next" on a
 * narrow screen.~~ THAT BUDGET IS GONE: there are four steps beside the run
 * now, not two, and "Next 60" is wider than "Next". The row is not sized to fit
 * on one line at 320px any more and is not meant to be — `.of-pages__list` is
 * `flex-wrap: wrap`, so the overflow becomes a second line rather than a
 * horizontal scrollbar, which is the constraint that actually has to hold.
 *
 * A GAP IS NEVER DRAWN OVER A SINGLE PAGE. `1 … 3 4 5` spends an ellipsis to
 * hide page 2, which is both longer than showing it and a worse answer — so a
 * gap of exactly one page collapses to that page.
 *
 * Exported for its own test rather than for callers: the interesting cases are
 * the boundaries — page 1, the last page, a total small enough that no gap is
 * possible — and asserting them through rendered markup would be asserting
 * this function through a second thing that can also be wrong.
 */
export function pageWindow(
  page: number,
  pages: number,
  span = 2,
): readonly (number | typeof PAGE_GAP)[] {
  if (pages <= 1) return pages === 1 ? [1] : [];

  const wanted = new Set<number>([1, pages]);
  for (let at = page - span; at <= page + span; at += 1) {
    if (at >= 1 && at <= pages) wanted.add(at);
  }

  const out: (number | typeof PAGE_GAP)[] = [];
  let previous = 0;
  for (const at of [...wanted].toSorted((a, b) => a - b)) {
    // A hole of exactly one page is cheaper to draw than to elide.
    if (at - previous === 2) out.push(previous + 1);
    else if (at - previous > 2) out.push(PAGE_GAP);
    out.push(at);
    previous = at;
  }
  return out;
}

/** `60` → `"60"`, `"all"` → `"All"`. The one place the word is spelled. */
function sizeLabel(size: PageSize): string {
  return size === "all" ? "All" : size.toLocaleString("en-GB");
}

export function Pagination({
  page,
  pages,
  size,
  sizes,
  total,
  from,
  to,
  unit,
  href,
  sizeHref,
  onNavigate,
  onResize,
  label = "Pages of results",
}: PaginationProps) {
  /**
   * A modified click is the reader asking the BROWSER for something, and this
   * component is not entitled to intercept it. Cmd/ctrl opens a tab, shift
   * opens a window, and a middle click arrives as `button === 1` — all three
   * are how somebody compares two pages of one answer side by side.
   */
  const intercept = (event: MouseEvent, take: () => void): void => {
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }
    event.preventDefault();
    take();
  };

  /**
   * One of the four steps — First, Previous, Next, Last — as a link or as an
   * inert word.
   *
   * A FUNCTION RATHER THAN FOUR COPIES, and it arrived when the count went from
   * two to four. The four differ in three values and agreed on everything else,
   * which is four chances for one of them to forget the modified-click guard.
   *
   * `spent` IS PASSED RATHER THAN DERIVED. It is a different question for each
   * step — First is spent on page one, Last on the last, Previous and Next at
   * either end — and a single expression clever enough to answer all four would
   * be one nobody could check by reading.
   */
  const step = (
    to: number,
    text: string,
    spent: boolean,
    options: { readonly rel?: "prev" | "next"; readonly name?: string } = {},
  ) =>
    spent ? (
      /* Inert rather than absent — see the note at the top about the control
         shifting under the cursor at the two moments it is most likely to be
         aimed at. The reference does the same: on its first page, First and
         Previous are disabled spans rather than gaps in the row. */
      <span className="of-pages__step of-pages__step--spent">{text}</span>
    ) : (
      <a
        aria-label={options.name ?? undefined}
        className="of-pages__step"
        href={href(to)}
        rel={options.rel ?? undefined}
        onClick={(event) =>
          onNavigate && intercept(event, () => onNavigate(to))
        }
      >
        {text}
      </a>
    );

  /**
   * "Next 60", or plain "Next" where the step has no fixed length.
   *
   * `"all"` cannot reach this — one page means no steps are drawn — but it is
   * spelled rather than asserted, because a size union that grows a second
   * non-numeric member should not silently print "Next all".
   */
  const nextText = size === "all" ? "Next" : `Next ${sizeLabel(size)}`;

  /** The numbered run, computed once so a gap can be keyed by what follows it. */
  const run = pageWindow(page, pages);
  const count = total.toLocaleString("en-GB");
  const showing =
    total === 0
      ? `No ${unit}.`
      : `Showing ${from.toLocaleString("en-GB")}–${to.toLocaleString("en-GB")} of ${count} ${unit}.`;

  return (
    <nav className="of-pages" aria-label={label}>
      {/*
        THE LINE ABOVE THE PAGER, AND IT IS THE SECTION RULE RATHER THAN THIS
        COMPONENT'S OWN BORDER. `border-block-start` on `.of-pages` drew the
        hairline `OrnamentalRule` owns, in a second spelling, which left the
        divider under every list of results as the one on the page with no
        centre mark. `decorative`, because a border announced nothing and a
        `separator` inside a navigation landmark would be read aloud as a
        division within the pager rather than as the division above it;
        `flush`, because the space either side is still this component's.
      */}
      <OrnamentalRule decorative flush />

      <p className="of-pages__range">{showing}</p>

      {pages > 1 ? (
        <ol className="of-pages__list">
          {/*
            FIRST AND LAST ARE THE REFERENCE'S ANSWER TO "TAKE ME TO THE END",
            and they are why the numbered run no longer has to be one.

            The pager was built without them because `pageWindow` always draws
            page 1 and the last page, which answers the same question by a
            different route — see its note. Both routes are worth having: the
            number tells you WHICH page the end is, and the word gets you there
            without reading a number to find out. The reference offers only the
            words; this offers both, which is the one place the two shapes are
            deliberately not the same.

            A WORD RATHER THAN THE REFERENCE'S CHEVRON. Its First and Last are
            icon-only with a visually-hidden label; every control in this pager
            is a word, and introducing the site's first icon-only button here
            would be a new primitive — seven files and a regenerated design
            system — bought to make one row look more like somebody else's.
          */}
          <li className="of-pages__item">
            {step(1, "First", page <= 1, { name: "First page" })}
          </li>

          <li className="of-pages__item">
            {step(page - 1, "Previous", page <= 1, { rel: "prev" })}
          </li>

          {run.map((entry, at) =>
            entry === PAGE_GAP ? (
              /*
                THE ELLIPSIS IS HIDDEN FROM ASSISTIVE TECHNOLOGY, which is the
                honest rendering: it carries no destination and names no page.
                A screen reader announcing "one, ellipsis, four, five, six" is
                being read punctuation as though it were a control.

                KEYED BY THE PAGE IT PRECEDES rather than by its index. A run can
                hold two gaps, so the key has to distinguish them — and the
                position does that only until the run changes length underneath
                it, which is every time the reader turns a page. The page after
                a gap is the one fact about it that survives.
              */
              <li
                aria-hidden="true"
                className="of-pages__gap"
                key={`gap-before-${run[at + 1] ?? "end"}`}
              >
                …
              </li>
            ) : (
              <li className="of-pages__item" key={entry}>
                {entry === page ? (
                  /*
                    THE CURRENT PAGE IS STILL A LINK, and `aria-current` is what
                    says so. A span here would remove the one control a reader
                    might use to get BACK to where they are after scrolling, and
                    would break the run of link shapes the eye follows across
                    the row.
                  */
                  <a
                    aria-current="page"
                    aria-label={`Page ${entry}`}
                    className="of-pages__page of-pages__page--here"
                    href={href(entry)}
                    onClick={(event) =>
                      onNavigate && intercept(event, () => onNavigate(entry))
                    }
                  >
                    {entry}
                  </a>
                ) : (
                  <a
                    aria-label={`Page ${entry}`}
                    className="of-pages__page"
                    href={href(entry)}
                    onClick={(event) =>
                      onNavigate && intercept(event, () => onNavigate(entry))
                    }
                  >
                    {entry}
                  </a>
                )}
              </li>
            ),
          )}

          {/*
            "NEXT 60" RATHER THAN "NEXT", WHICH IS THE REFERENCE'S WORDING AND
            A BETTER ONE. The step says how far it goes, so the size in force is
            legible from the control that spends it rather than only from the
            row of sizes below — and here it is more useful than at the
            reference, because there the number is always 60 and here the reader
            can change it.

            THE ASYMMETRY IS COPIED DELIBERATELY: the reference numbers Next and
            leaves Previous bare, and so does this. "Previous 60" would be
            counting rows already read, which is not a thing anybody wants to
            know, and it reads as though it moved a different distance.

            UNDER `"all"` NEITHER IS DRAWN, so there is no case where this
            promises a next 60 that does not exist: `pages` is 1 and the whole
            list is skipped.
          */}
          <li className="of-pages__item">
            {step(page + 1, nextText, page >= pages, { rel: "next" })}
          </li>

          <li className="of-pages__item">
            {step(pages, "Last", page >= pages, { name: "Last page" })}
          </li>
        </ol>
      ) : null}

      {sizes.length > 1 ? (
        <p className="of-pages__sizes">
          <span className="of-pages__sizes-label">Per page</span>
          {sizes.map((offered) => {
            const name = sizeLabel(offered);
            /*
              THE ACCESSIBLE NAME SAYS WHAT THE NUMBER MEANS. "60" alone is a
              link whose purpose is carried entirely by the sentence around it;
              "Show 60 per page" is one that survives being read out of a link
              list. The visible text is contained in the name, which is what
              WCAG 2.5.3 asks of a control whose label is shorter than its name.
            */
            return offered === size ? (
              <a
                aria-current="true"
                aria-label={`Show ${name} per page`}
                className="of-pages__size of-pages__size--here"
                href={sizeHref(offered)}
                key={String(offered)}
                onClick={(event) =>
                  onResize && intercept(event, () => onResize(offered))
                }
              >
                {name}
              </a>
            ) : (
              <a
                aria-label={`Show ${name} per page`}
                className="of-pages__size"
                href={sizeHref(offered)}
                key={String(offered)}
                onClick={(event) =>
                  onResize && intercept(event, () => onResize(offered))
                }
              >
                {name}
              </a>
            );
          })}
        </p>
      ) : null}
    </nav>
  );
}
