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
 * A ROW IS A NAME, AND THE MARK UNDER IT IS HOW THE READER PICKS A VERSION.
 * Both callers hand over the pitch versions a row stands for — a search hands
 * the ones that matched, a set page the ones that set printed — and where there
 * is more than one, the bands and stones this component draws are LINKS to
 * them. That is the difference between "three cells of Angelic Wrath that look
 * identical" and one cell whose red, yellow and blue thirds each open the card
 * they are the colour of. See {@link CardIndexEntry.versions}.
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
 * One pitch version of the card a row stands for: which pitch, and where it is.
 *
 * A ROW WITH ONE OF THESE IS A CARD; A ROW WITH SEVERAL IS A NAME. That is the
 * whole of the distinction, and every difference in how a row renders follows
 * from it — see {@link CardIndexEntry.versions}.
 */
export interface CardIndexVersion {
  readonly pitch: PitchValue;
  /** This version's own page. `/card/head-jab-2`. */
  readonly href: string;
  /**
   * The version's full label — "Head Jab (pitch 2)".
   *
   * IT IS THE ACCESSIBLE NAME OF THIS VERSION'S MARK, which is why it is
   * qualified and why it is supplied rather than composed here. A row standing
   * for three versions renders three links that carry no text at all — a band
   * is a coloured rectangle — so each one's name is the only thing telling them
   * apart, and "Pitch 2" alone would give a screen-reader user three links
   * named for a value with no card attached to it.
   */
  readonly label: string;
}

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
   *
   * THE CASE THAT NOTE WAS WRITTEN ABOUT IS NARROWER THAN IT WAS. Two cells
   * with the same name were, in practice, the pitch versions of one card, and
   * both callers now hand those over as ONE row with a band per version — so
   * the comparison the reader was making with hue alone is a comparison between
   * bands inside a single cell instead of between cells. It still happens: a
   * search asking for `unique:cards` or `unique:art` deliberately expands a name
   * back into its versions, and that is the surface the paragraph above is now
   * about. What is new in both is that each band is a link carrying the version
   * in its accessible name, so "which one is this" has an answer that is not
   * colour, on hover and to anything reading the page aloud.
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
   * The pitch versions this row stands for, and where each one lives.
   *
   * PLURAL BECAUSE A ROW IS A NAME. Head Jab is three cards at three pitches
   * and one row, and the mark under the name is how the row says so.
   *
   * IT CARRIES HREFS BECAUSE THE MARK IS A CONTROL WHEN THERE IS MORE THAN ONE
   * OF THEM, and that is the change this type exists to record. A row standing
   * for three versions used to be one destination: the name went to the shared
   * page and the three coloured bands under it were decoration, so a reader who
   * wanted the blue one specifically had to arrive at the name and then find it
   * in the strip. Now the name still goes to the name — the address for "this
   * card", whichever version you meant — and each BAND goes to the version it
   * is drawn for. The colour was already saying which version; this makes the
   * thing it says clickable.
   *
   * THE FIELD WAS `pitches: PitchValue[]` AND THE HREFS ARE NOT BESIDE IT.
   * Two arrays — values here, links there — is two orderings of one fact and
   * an invitation for a caller to supply three bands and two links. One array
   * of versions cannot disagree with itself.
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
  readonly versions: readonly CardIndexVersion[];
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
   * Why this row is on the page, in the words of the ranking that put it there.
   *
   * ROWS VIEW ONLY, AND IT IS ABOUT THE QUERY RATHER THAN THE CARD — which is
   * the distinction that decides what may appear under a name at all. A set
   * page has no ranking and therefore nothing true to say here, while every
   * search result does. Under a grid of faces it would be a line of engine
   * chatter under every picture.
   *
   * THIS IS THE ONLY SUCH LINE LEFT. There was a `note` beside it saying which
   * versions a partial match covered — "1 of 3 versions" — and it is gone:
   * every card list on this site now says which versions it stands for with the
   * mark, and the mark is the thing a reader can click. A row that draws one
   * band draws one band; the words under it were a second telling of a fact the
   * colour had already told, and the site would rather be read than narrated.
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
 * The versions a row stands for, one per pitch, ascending.
 *
 * DEDUPLICATED AND SORTED HERE, ONCE, for the reason `PitchRule` does it
 * internally: several call sites build these lists from different sources, and
 * a row rendering blue before red would be stating one fact in two orders on
 * one screen. A card printed twice in one set arrives with its pitch twice, and
 * the two arrivals are the same destination — so the first wins and the second
 * is dropped rather than drawn as a fourth band.
 */
function versionsOf(
  versions: readonly CardIndexVersion[],
): readonly CardIndexVersion[] {
  const byPitch = new Map<PitchValue, CardIndexVersion>();
  for (const version of versions) {
    if (!byPitch.has(version.pitch)) byPitch.set(version.pitch, version);
  }
  return [...byPitch.values()].toSorted((a, b) => a.pitch - b.pitch);
}

/**
 * The pitch versions as jewels — the rendering the two TEXT views use.
 *
 * ONE STONE PER VERSION, so a row standing for three pitch versions of a name
 * carries three, exactly as the grid carries three bands. `PitchJewel` is
 * singular by contract because a card page shows one card; the plurality is a
 * fact about a list, so it lives in the list.
 *
 * A STONE IS A LINK ONLY WHERE THERE IS SOMETHING TO CHOOSE BETWEEN. On a row
 * standing for one card the stone would point where the name beside it already
 * points — a second control, in a smaller target, for the same destination —
 * so the single-version row keeps the plain mark it has always had. Where a row
 * stands for several, each stone goes to its own version: that is the whole
 * feature, and the numeral in the stone is what says which one is under the
 * pointer before it is clicked.
 *
 * BOTH TEXT VIEWS PUT THE STONES OUTSIDE THE NAME'S ANCHOR ALREADY —
 * `ResultRow` renders its `lead` before the link rather than inside it, and the
 * names view lists them as siblings — so this needs no markup contortion to
 * avoid nesting an anchor in an anchor. The grid did need one; see the cell.
 */
function PitchStones({
  versions,
}: {
  readonly versions: readonly CardIndexVersion[];
}) {
  const shown = versionsOf(versions);
  if (shown.length === 0) return null;
  return (
    <span className="of-index__stones">
      {shown.map((version) =>
        shown.length === 1 ? (
          <PitchJewel key={version.pitch} value={version.pitch} size="sm" />
        ) : (
          <a
            className="of-index__stone"
            href={version.href}
            key={version.pitch}
          >
            <PitchJewel value={version.pitch} size="sm" label={version.label} />
          </a>
        ),
      )}
    </span>
  );
}

/**
 * The pitch versions as bands — the rendering the IMAGES view uses.
 *
 * ONE `PitchRule` PER BAND WHERE THE BANDS ARE LINKS, WHICH IS NOT THE SAME
 * COMPONENT USED TWICE BY ACCIDENT. `PitchRule` is a `role="img"` with a
 * written name, and the children of a `role="img"` are not exposed — so three
 * anchors INSIDE one rule would be three links no assistive technology could
 * reach, which is the failure mode that looks fine in a browser and is a wall
 * to everyone else. A rule per version instead makes each band an image with
 * its own name inside its own link, and the link takes that name as its own.
 *
 * The row of them is spaced by the same token `PitchRule` puts between its own
 * bands, so a split mark and an unsplit one are the same object on screen.
 *
 * A SINGLE-VERSION ROW DRAWS THE PLAIN RULE, unlinked, for the reason the
 * stones do: there is nothing to choose between, and the cell's own anchor is
 * already the destination.
 */
function PitchSplits({
  versions,
}: {
  readonly versions: readonly CardIndexVersion[];
}) {
  const shown = versionsOf(versions);
  if (shown.length === 0) return null;
  if (shown.length === 1) {
    const only = shown[0];
    return only === undefined ? null : <PitchRule values={[only.pitch]} />;
  }

  return (
    <span className="of-index__splits">
      {shown.map((version) => (
        <a className="of-index__split" href={version.href} key={version.pitch}>
          <PitchRule values={[version.pitch]} label={version.label} />
        </a>
      ))}
    </span>
  );
}

/**
 * The pitch qualifier, hidden inside the anchor — and NOTHING where there is
 * none to carry.
 *
 * MOST ROWS HAVE NOTHING TO QUALIFY. A collapsed row stands for every version
 * it draws a band for, and a card whose name is unique never needed a suffix;
 * both hand over `""`. The two views below rendered the span regardless, so an
 * empty `<span class="of-index__variant"></span>` — 39 bytes saying nothing —
 * shipped on the majority of rows.
 *
 * THE SAVING IS SMALL AND IS STATED AS SMALL. Measured across the build: 3,096
 * empty spans over 112 set pages, 121 kB in total, and 55 of them (2.1 kB) on
 * the largest page of the largest set. That is not why the guard is here — dead
 * markup that says nothing is worth removing at any size, and `ResultRow` has
 * always guarded the identical case — but a comment that implied a budget
 * problem would be overselling it.
 *
 * THE BIGGER NUMBER IS NOT THIS ONE, and it is worth naming so nobody reads
 * this as having dealt with it. A set page hands the whole set to its island as
 * JSON in an attribute, and `"qualifier":""` appears there once per row with
 * every quote escaped to `&quot;` — 324 times on `/sets/lgs`, about 13 kB. That
 * is the entry FIELD rather than this markup, so removing the span does not
 * touch it; shrinking it means making `qualifier` optional in the props, which
 * is a change to what crosses the island boundary and belongs on its own.
 *
 * `ResultRow` GUARDS THE IDENTICAL CASE — `qualifier === undefined ||
 * qualifier === ""` — so the rows view was already clean and the other two were
 * not. This is that guard, in the one place both of them can share it, rather
 * than a third spelling of it.
 *
 * IT CHANGES NOTHING A READER OR A SCREEN READER GETS. An empty span
 * contributes no text to an anchor's accessible name; what names the versions
 * apart is the suffix, and the suffix is still rendered wherever there is one.
 */
function Variant({ qualifier }: { readonly qualifier: string }) {
  if (qualifier === "") return null;
  return <span className="of-index__variant">{qualifier}</span>;
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
                {/*
                  THE ANCHOR STOPS AT THE NAME, AND THE MARK IS ITS SIBLING.
                  It used to wrap the whole cell — face, name, rule and note —
                  which was the right shape while the rule was decoration. It
                  cannot survive the rule becoming a set of links: an anchor
                  inside an anchor is invalid HTML, and browsers repair it by
                  closing the outer one early, so the markup that reaches the
                  reader is not the markup that was written.

                  What the cell loses by the split is nothing a reader can
                  see. The face and the name were the accessible name of the
                  link; the rule contributed its spoken values to the end of
                  it, which is the one place they were redundant — the name is
                  the card, and which VERSIONS the row stands for is said by
                  controls that go to them, and by nothing else. The written
                  note that used to sit under this cell is gone for that reason:
                  see `CardIndexEntry.why`.
                */}
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
                    <Variant qualifier={entry.qualifier} />
                  </span>
                </a>
                <PitchSplits versions={entry.versions} />
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
              lead={<PitchStones versions={entry.versions} />}
              meta={
                <>
                  <span>{entry.typeLine}</span>
                  {(entry.stats ?? []).map(([label, value]) => (
                    <span key={label}>
                      {label} {value}
                    </span>
                  ))}
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
              <PitchStones versions={entry.versions} />
              <a href={entry.href}>
                {entry.name}
                <Variant qualifier={entry.qualifier} />
              </a>
            </li>
          ))}
        </ol>
      )}

      {pagination}
    </>
  );
}
