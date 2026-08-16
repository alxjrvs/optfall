/**
 * A VISUAL LIST OF CARDS. The one rendering, wherever cards are listed.
 *
 * WHY THIS IS ONE COMPONENT AND NOT THREE. Before it, the site listed cards in
 * three unrelated ways and the differences were accidents rather than decisions:
 * `/search` rendered a grid of faces with a view switcher, `/sets/<code>`
 * rendered a bare `<ul>` of names in CSS columns with no images and no way to
 * change that, and neither could be paged. A reader who found a card by its art
 * on one page and then opened the set it came from lost the pictures entirely —
 * on the surface most obviously ABOUT pictures, since a set is a print run.
 *
 * `docs/DESIGN.md` calls recognising a card by its face "the single largest
 * difference between this and every text-list card tool in the game". That was
 * true of one page.
 *
 * SO WHAT A LIST OF CARDS *IS* LIVES HERE: the three views, the switch between
 * them, the pagination, the centred name, the pitch rule under it. A caller
 * supplies rows and owns the state; it does not get to invent a fourth way to
 * show a card.
 *
 * IT IS PRESENTATIONAL AND CONTROLLED, WHICH IS WHAT LETS BOTH CALLERS USE IT.
 * The two disagree about where the state lives and they are both right:
 * `CardSearch` keeps the display mode in the QUERY, because `display:text` is a
 * search operator and the URL is the product; the set page keeps it in the
 * address bar's parameters, because a set page has no query to put it in.
 * Owning that state here would have forced one of them to lie about its own
 * URL, so this component owns none of it.
 *
 * `entries` IS ONE PAGE, NOT THE WHOLE LIST. Both callers can cut a page more
 * cheaply than this component could — the search engine slices ranked rows
 * before building results at all — and passing the whole list to render a
 * sixtieth of it is the shape that makes a 4,000-row index expensive.
 *
 * NOTHING HERE MAY IMPORT `cards.ts`. It is reached from an island bundle, and
 * `faces.ts` records what that costs: the corpus is 16 MB and it once shipped.
 */

import type { ReactNode } from "react";

import {
  CardFace,
  PitchJewel,
  PitchRule,
  ResultRow,
} from "optfall-components/react";
import type { PitchValue } from "optfall-theme";

import { boxFor, faceUrl, placeholderUrl } from "../../src/lib/faces";

import "./CardIndex.css";

/**
 * The three shapes a list of cards comes in.
 *
 * The same union `card-search.ts` parses `display:` into. The buttons are
 * labelled with the operator's own synonyms — see `VIEWS` — so a reader meets
 * the vocabulary before the syntax.
 *
 * IT DOES NOT ROUND-TRIP, AND THIS NOTE USED TO CLAIM IT DID. Clicking "Names"
 * writes the CANONICAL spelling into the box, `display:text`, not `display:names`
 * — `show()` composes from these three values, and it should, because the URL
 * is the product and one view wants one address rather than three synonyms of
 * it. So the labels teach the words and the box teaches the canonical form.
 * That is a weaker claim than "the reader has learned the grammar without being
 * taught it", and it is the true one.
 */
export type CardIndexDisplay = "grid" | "list" | "text";

/**
 * One row.
 *
 * SERIALISABLE THROUGHOUT, because the set page hands an array of these across
 * the island boundary as JSON in an attribute. No `Map`, no `undefined` inside
 * an array — see `Island.tsx`.
 */
export interface CardIndexEntry {
  /** Where the row goes. Every row in this index is a destination. */
  readonly href: string;
  /**
   * The full text the anchor must be NAMED by, qualifier and all.
   *
   * 900 names in this corpus belong to more than one card, and two anchors that
   * differ only in where they point are a WCAG 2.4.4 failure — so this stays
   * qualified even though it is no longer what a reader sees.
   */
  readonly label: string;
  /**
   * The card's name with nothing appended — what a reader actually sees.
   *
   * THE QUALIFIER MOVED OUT OF THE TYPE AND INTO THE MARK. Every row used to
   * print "Belly Buster (pitch 3)", which said in four words what the pitch
   * rule under the name and the jewel beside it already say in a glyph — three
   * times over on the three versions of a card, in the one place the reader is
   * scanning names rather than reading them.
   *
   * It is not deleted, only made invisible: {@link qualifier} is rendered
   * inside the anchor as visually-hidden text, so `name` + `qualifier` names
   * the anchor exactly as `label` does and the versions are still told apart by
   * anything reading them aloud.
   *
   * VISUALLY, THE GRID IS LEFT WITH COLOUR, and that is worth stating plainly.
   * The rows and names views carry a numbered stone, so hue is redundant there.
   * The grid carries `PitchRule`, which is bands — its accessible name spells
   * the values out, but a sighted reader comparing two same-named cells has the
   * band colour and the card art, both of which are hue. See the note in
   * `CardIndex.css` beside the cell name.
   */
  readonly name: string;
  /**
   * The part of {@link label} this index may hide — " (pitch 2)", or `""`.
   *
   * SUPPLIED, NOT SUBTRACTED. Deriving it as `label` minus `name` looked
   * equivalent and was not: an `unique:art` row's label carries the art key as
   * well as the pitch, so the subtraction hid the key too and left several rows
   * of one card reading identically in both text views — same name, same
   * stones, same type line, same stats, differing only in where they pointed.
   * The picture is what separates them in the grid, and the key is what has to
   * separate them without one.
   */
  readonly qualifier: string;
  readonly typeLine: string;
  /** Face blob key, or `null` where no printing publishes art. */
  readonly faceKey: string | null;
  readonly faceLandscape: boolean;
  /**
   * The pitch values this row stands for.
   *
   * PLURAL BECAUSE A ROW IS A NAME. Head Jab is three cards at three pitches
   * and one row, and the mark under the name is how the row says so.
   *
   * TWO RENDERINGS, CHOSEN BY VIEW, AND THAT IS A DESIGN DECISION RATHER THAN
   * AN INCONSISTENCY. Under a card face there is no room for a stone carrying a
   * numeral without it competing with the art, so the grid draws
   * {@link PitchRule} — coloured bands, one per value, as an underline. The two
   * text views have a line of type to put a jewel beside and no picture to
   * compete with, so they keep {@link PitchJewel}, which carries the numeral
   * that `docs/DESIGN.md` calls the primary channel. The information is
   * identical; what differs is what the surface can afford to say it with.
   */
  readonly pitches: readonly PitchValue[];
  /**
   * The card's printed values, label and value. Rows view only.
   *
   * ALL SIX, NOT THREE — Cost, Power, Defence, Life, Intellect, Arcane, in the
   * order `docs/DESIGN.md` reads a card. This said "cost, power, defence" while
   * both callers already supplied six, which is the exact three-value
   * vocabulary this component exists to stop the two surfaces disagreeing
   * about. Only the values a card actually prints are present, so an ordinary
   * action carries three and a hero carries three different ones.
   */
  readonly stats?: readonly (readonly [string, string])[] | undefined;
  /**
   * A short qualifier under the name — which versions this row is talking
   * about, which printing it stands for. Shown in the images and rows views.
   *
   * IT IS ABOUT THE CARD, which is what separates it from {@link why}. A note
   * qualifies the row's claim, so dropping it can make the row false: a
   * `banned:cc` result covering two of three pitch versions has to say so, or
   * it puts a card on a banned list without naming the version that is banned.
   */
  readonly note?: string | undefined;
  /**
   * Why this row is on the page, in the words of the ranking that put it there.
   *
   * ROWS VIEW ONLY, AND IT IS ABOUT THE QUERY RATHER THAN THE CARD. That is why
   * it is a separate field and not more `note`: a set page has no ranking and
   * therefore nothing true to say here, while every search result does. Under a
   * grid of faces it would be a line of engine chatter under every picture.
   */
  readonly why?: string | undefined;
}

export interface CardIndexProps {
  /** The rows on THIS page, already cut by the caller. */
  readonly entries: readonly CardIndexEntry[];
  readonly display: CardIndexDisplay;
  readonly onDisplayChange: (display: CardIndexDisplay) => void;
  /**
   * The pager, rendered under the list. A `Pagination` from the library.
   *
   * A SLOT RATHER THAN PROPS, BECAUSE THE PAGER'S URLS ARE THE SURFACE'S.
   * `Pagination` is built out of real `<a href>`s — that is what makes paging
   * work with no JavaScript — and only the caller knows what a page's address
   * looks like: `/search` writes `?q=…&page=…&per=…`, a set page writes
   * `/sets/mst?page=…`. Passing the control in keeps one rendering of a card
   * list while letting each surface own its own addresses, which is the same
   * split `display` already makes.
   *
   * Optional: a list short enough not to need one passes nothing.
   */
  readonly pagination?: ReactNode | undefined;
  /** Printed above the views. The caller's own sentence, in its own units. */
  readonly summary: ReactNode;
  /**
   * The radio group's `name`, and the stem of the pagination's labels.
   *
   * REQUIRED, because a page may carry two indexes one day and two radio groups
   * sharing a name are ONE group — clicking a view in the second would silently
   * clear the first. Cheaper to require than to debug.
   */
  readonly controlName: string;
  /**
   * Whether the controls are live yet.
   *
   * FALSE ON THE SERVER AND ON THE FIRST CLIENT RENDER, always. The switch and
   * the pager do nothing without JavaScript — they are buttons, not links, and
   * they cannot be links because the pages they would address are not
   * separately generated. Rendering them into static markup would be a control
   * that looks operable and is not, which is the one shape "degrade visibly"
   * forbids. The caller flips this in an effect, so the first client render
   * still matches the server's and hydration does not fail; see `CardSearch`
   * for the same reasoning applied to reading the URL.
   */
  readonly interactive: boolean;
}

/**
 * The views, and what to call them.
 *
 * THE LABELS ARE THE OPERATOR'S OWN SYNONYMS, not new words. `card-search.ts`
 * already accepts `display:images`, `display:rows` and `display:names` as
 * spellings of grid, list and text, so these three buttons say exactly what a
 * reader would type. They used to read "Grid", "List" and "Text" — three words
 * describing the MARKUP rather than the content, and none of the three is what
 * the grammar calls them.
 */
const VIEWS = [
  ["grid", "Images"],
  ["list", "Rows"],
  ["text", "Names"],
] as const;

/**
 * The pitch values as jewels — the rendering the two TEXT views use.
 *
 * ONE STONE PER VALUE, so a row standing for three pitch versions of a name
 * carries three, exactly as the grid carries three bands. `PitchJewel` is
 * singular by contract because a card page shows one card; the plurality is a
 * fact about a list, so it lives in the list.
 *
 * Deduplicated and ascending here for the reason `PitchRule` does it
 * internally: three call sites build these arrays and a row rendering blue
 * before red would be stating one fact in two orders on one screen. A card
 * printed twice in a set arrives with its pitch twice.
 */
function PitchStones({ pitches }: { readonly pitches: readonly PitchValue[] }) {
  const shown = [...new Set(pitches)].toSorted((a, b) => a - b);
  if (shown.length === 0) return null;
  return (
    <span className="of-index__stones">
      {shown.map((value) => (
        <PitchJewel key={value} value={value} size="sm" />
      ))}
    </span>
  );
}

function altFor(entry: CardIndexEntry): string {
  return entry.typeLine === ""
    ? entry.label
    : `${entry.label} — ${entry.typeLine}`;
}

function faceSrc(entry: CardIndexEntry): string {
  const orientation = entry.faceLandscape ? "landscape" : "portrait";
  return entry.faceKey === null
    ? placeholderUrl(orientation)
    : faceUrl(entry.faceKey, "thumb");
}

export function CardIndex({
  entries,
  display,
  onDisplayChange,
  pagination,
  summary,
  controlName,
  interactive,
}: CardIndexProps) {
  return (
    <>
      <div className="of-index__head">
        <p className="of-index__count">{summary}</p>

        {/*
          A radio group rather than a row of buttons, because that is what "pick
          exactly one" is, and it gets arrow keys and a group name for free.
          Hidden until hydration for the reason `interactive` gives.
        */}
        {interactive ? (
          <fieldset className="of-index__views">
            <legend className="of-index__views-legend">Show cards as</legend>
            {VIEWS.map(([mode, label]) => (
              <label className="of-index__view" key={mode}>
                <input
                  type="radio"
                  name={controlName}
                  value={mode}
                  checked={display === mode}
                  onChange={() => onDisplayChange(mode)}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
      </div>

      {display === "grid" ? (
        /*
          THE FACE IS THE ROW, and it is the default everywhere now rather than
          on one page. Recognising a card by its art is faster than reading its
          name, which is the whole argument for a visual index — and a set is a
          print run, so it is the surface where the argument is strongest.

          `CardFace` is the only sanctioned way to put a card image on a page:
          COMPLIANCE.md §5 forbids a variant that drops the attribution the
          universal footer carries.
        */
        <ul className="of-index__grid">
          {entries.map((entry) => {
            const box = boxFor(
              "thumb",
              entry.faceLandscape ? "landscape" : "portrait",
            );
            return (
              <li className="of-index__cell" key={entry.href}>
                <a className="of-index__cell-link" href={entry.href}>
                  <CardFace
                    src={faceSrc(entry)}
                    alt={altFor(entry)}
                    width={box.width}
                    height={box.height}
                    loading="lazy"
                  />
                  {/*
                    CENTRED UNDER THE FACE, which is a real change and not a
                    preference. The name used to be start-aligned under a
                    centred image, so in a row of six cells the type sat six
                    different distances from the art above it wherever a face
                    was narrower than its track. Centring binds the name to its
                    picture; the pitch rule under it is centred for the same
                    reason and would look like a stray mark otherwise.
                  */}
                  <span className="of-index__cell-name">
                    {entry.name}
                    <span className="of-index__variant">{entry.qualifier}</span>
                  </span>
                  <PitchRule values={entry.pitches} />
                  {entry.note !== undefined && entry.note !== "" ? (
                    <span className="of-index__cell-note">{entry.note}</span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      ) : display === "list" ? (
        /*
          Dense rows: the view for comparing printed values down a column, and
          `ResultRow` is exactly the primitive for it — a leading slot, a name,
          and facts underneath. THE JEWEL LEADS, because this view has a line of
          type to sit a stone beside and no card face to compete with, so it can
          afford the rendering that carries the numeral.

          ONE JEWEL PER PITCH VALUE, exactly as the grid draws one band per
          value. A row stands for a NAME and a name is commonly three cards, so
          a single stone would be picking one of the three versions to speak for
          the other two — which is the same "collapses two true facts into one"
          failure the engine builds its whole verdict model to avoid.
        */
        <ol className="of-index__rows">
          {entries.map((entry) => (
            <ResultRow
              key={entry.href}
              href={entry.href}
              label={entry.name}
              qualifier={entry.qualifier}
              lead={<PitchStones pitches={entry.pitches} />}
              meta={
                <>
                  <span>{entry.typeLine}</span>
                  {(entry.stats ?? []).map(([label, value]) => (
                    <span key={label}>
                      {label} {value}
                    </span>
                  ))}
                  {entry.note !== undefined && entry.note !== "" ? (
                    <span>{entry.note}</span>
                  ) : null}
                  {entry.why !== undefined && entry.why !== "" ? (
                    <span className="of-index__row-why">{entry.why}</span>
                  ) : null}
                </>
              }
            />
          ))}
        </ol>
      ) : (
        /*
          NAMES, ONE PER LINE. The view whose output is meant to LEAVE the page:
          a player writing a deck list wants forty names they can select and
          paste. Each name is still a link, because a text list that cannot be
          clicked would be a worse version of the other views rather than a
          different one.

          THE JEWEL SURVIVES THE PASTE, WHICH IS WHY IT CAN BE HERE AT ALL. Its
          numeral is a real text node, so a drag-select across this list would
          ordinarily yield "1Head Jab" and forty lines needing cleaning
          afterwards — the exact thing this view exists to avoid. `PitchJewel`
          sets `user-select: none` on itself, so the selection skips it and what
          leaves the page is the names. That property was there before this view
          used it; it is load-bearing now.
        */
        <ol className="of-index__names">
          {entries.map((entry) => (
            <li key={entry.href}>
              <PitchStones pitches={entry.pitches} />
              <a href={entry.href}>
                {entry.name}
                <span className="of-index__variant">{entry.qualifier}</span>
              </a>
            </li>
          ))}
        </ol>
      )}

      {pagination}
    </>
  );
}
