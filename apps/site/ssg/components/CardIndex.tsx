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
 * SO WHAT A LIST OF CARDS *IS* LIVES HERE: the two views, the switch between
 * them, the pagination, the density of the grid, and how a row that stands for
 * several pitch versions offers them. A caller supplies rows and owns the
 * state; it does not get to invent a third way to show a card.
 *
 * A ROW IS A NAME, AND HOW THE READER PICKS A VERSION IS THE OTHER HALF OF IT.
 * Both callers hand over the pitch versions a row stands for — a search hands
 * the ones that matched, a set page the ones that set printed — and where there
 * is more than one, what this component draws for them are LINKS. That is the
 * difference between "three cells of Angelic Wrath that look identical" and one
 * cell that opens into the three cards it stands for.
 *
 * THE TWO VIEWS DRAW IT DIFFERENTLY BECAUSE THEY CAN AFFORD DIFFERENT THINGS.
 * The list view has a line of type to hang a mark off, so it puts a numbered
 * stone per version at the end of the name. The grid has a whole card, so it
 * draws the versions AS cards: stacked behind the front one, fanned on hover,
 * each face its own link. See {@link CardIndexEntry.versions} and `CardStack`.
 *
 * IT IS PRESENTATIONAL AND CONTROLLED, WHICH IS WHAT LETS BOTH CALLERS USE IT.
 * The two disagree about where the state lives and they are both right:
 * `CardSearch` keeps the display mode in the QUERY, because `display:` is a
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
 * `faces.ts` records what that costs: the corpus is 18 MB and it once shipped.
 */

/* Types only. `useState`/`useEffect` went with `CopyNames` — this component
   holds no state of its own now, which is the claim the docblock above makes
   about where the state lives. */
import type { ReactNode, Ref } from "react";

import {
  CardFace,
  OrnamentalRule,
  PitchJewel,
  ResultRow,
} from "optfall-components/react";
import type { PitchValue } from "optfall-theme";

import { FACE_TIERS, faceUrl, placeholderUrl } from "../../src/lib/faces";

import "./CardIndex.css";

/**
 * The two shapes a list of cards comes in.
 *
 * The same union `card-search/` parses `display:` into, and it argues there
 * at length for why two is the honest count. The short version: there was a
 * third, `text`, which printed names one per line — and that is this view with
 * its metadata removed, so the difference between them was DENSITY rather than
 * kind. A density knob offered as a peer of "show me pictures" is what let the
 * bar be driven to say "Names as Names".
 *
 * IT ROUND-TRIPS NOW, WHICH IT DID NOT BEFORE. The labels are "Grid" and
 * "List" — see `VIEWS` — and those are the CANONICAL operands rather than
 * synonyms of them, so what a reader clicks and what `show()` writes into the
 * box are the same word. The old labels were "Images", "Rows" and "Names":
 * real synonyms the grammar accepts, but clicking one wrote a different
 * spelling into the query, so the bar taught a vocabulary the URL then
 * contradicted.
 */
export type CardIndexDisplay = "grid" | "list";

/**
 * How much of the corpus one row stands for. The union `unique:` parses into.
 *
 * `names` IS THE DEFAULT AND IT IS THE INTERESTING ONE: Head Jab's red, yellow
 * and blue versions are one row, because that is what a player means by a card.
 * `cards` expands them; `art` expands further, to one row per distinct picture.
 * `card-search/` states the argument at length beside `CardUniqueMode`.
 */
export type CardIndexUnique = "names" | "cards" | "art";

/**
 * What the list is ordered by, or `relevance` where the reader has not asked.
 *
 * `relevance` IS A REAL VALUE HERE AND IS `null` IN THE ENGINE, which is a
 * deliberate translation rather than a leak. `CardSort.key` is nullable because
 * "no ordering was requested" is not the same claim as "ordered by name" — but a
 * `<select>` cannot offer `null`, and the option has to say what the list is
 * actually doing. The caller maps the two; see `CardSearch`.
 */
export type CardIndexOrder =
  | "relevance"
  | "name"
  | "released"
  | "pitch"
  | "cost"
  | "power"
  | "defence"
  | "rarity"
  | "set";

export type CardIndexDirection = "asc" | "desc";

/**
 * One pitch version of the card a row stands for: which pitch, and where it is.
 *
 * A ROW WITH ONE OF THESE IS A CARD; A ROW WITH SEVERAL IS A NAME. That is the
 * whole of the distinction, and every difference in how a row renders follows
 * from it — see {@link CardIndexEntry.versions}.
 */
export interface CardIndexVersion {
  readonly pitch: PitchValue;
  /**
   * This version's own picture, or `null` where it publishes none.
   *
   * REQUIRED BECAUSE THE GRID DRAWS THE VERSIONS AS CARDS. A row
   * standing for three pitch versions is a stack of three faces that fans on
   * hover, and the three Head Jabs are three different paintings — a stack of
   * one image repeated would be a decoration rather than a choice between
   * cards. The list view never looks at this; it draws stones.
   */
  readonly faceKey: string | null;
  /** True where this version's face is landscape and needs a transposed box. */
  readonly faceLandscape: boolean;
  /** This version's own page. `/card/head-jab-2`. */
  readonly href: string;
  /**
   * The version's full label — "Head Jab (pitch 2)".
   *
   * IT IS THE ACCESSIBLE NAME OF THIS VERSION'S MARK, which is why it is
   * qualified and why it is supplied rather than composed here. A row standing
   * for three versions renders three links that carry no text at all — a stone
   * is a numeral in a shape, a fanned card is a picture — so each one's name is
   * the only thing telling them apart, and "Pitch 2" alone would give a
   * screen-reader user three links named for a value with no card attached.
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
   * THE GRID PRINTS NEITHER, AND IS WHERE THIS FIELD IS NOT USED. It
   * carries no caption at all now — the face is the row, and the anchor's
   * accessible name is the face's `alt`, which has always carried the qualified
   * {@link label}. So the list view is the whole of this field's audience.
   *
   * WHAT A SIGHTED READER HAS IN THE GRID IS THE ART, and that is worth
   * stating plainly rather than leaving to be discovered. The list view
   * carries a numbered stone, so hue is redundant there; the grid has no
   * mark of any kind, so two cells the reader is comparing are told apart by
   * their pictures. That is a stronger channel than the coloured bands it
   * replaced — the versions of a name are DIFFERENT PAINTINGS, not one painting
   * in three colours — but it is a picture rather than a value, and a reader who
   * wants the value has two views that print it. It is recorded here because
   * this is where somebody will stand when they decide whether to put a caption
   * back.
   */
  readonly name: string;
  /**
   * The part of {@link label} this index may hide — " (pitch 2)", or `""`.
   *
   * SUPPLIED, NOT SUBTRACTED. Deriving it as `label` minus `name` looked
   * equivalent and was not: an `unique:art` row's label carries the art key as
   * well as the pitch, so the subtraction hid the key too and left several rows
   * of one card reading identically in the list view — same name, same
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
   * page and the marks under it were decoration, so a reader who wanted the blue
   * one specifically had to arrive at the name and then find it in the strip.
   * Now the row still goes to the row — the address for "this card", whichever
   * version you meant — and each MARK goes to the version it is drawn for: a
   * stone in the list view, the version's own card face in the grid.
   *
   * THE FIELD WAS `pitches: PitchValue[]` AND THE HREFS ARE NOT BESIDE IT.
   * Two arrays — values here, links there — is two orderings of one fact and
   * an invitation for a caller to supply three marks and two links. One array
   * of versions cannot disagree with itself.
   *
   * TWO RENDERINGS, CHOSEN BY VIEW, AND THAT IS A DESIGN DECISION RATHER THAN
   * AN INCONSISTENCY. The list view has a line of type to put a jewel at the
   * end of, so it draws {@link PitchJewel}, which carries the numeral
   * `docs/DESIGN.md` calls the primary channel. The grid has a whole card, so
   * it draws the versions as CARDS — a stack that fans on hover, each face a
   * link to its own version. The information is identical; what differs is
   * what the surface can afford to say it with.
   *
   * THE GRID USED TO DRAW BANDS — one `PitchRule` per version, as an
   * underline, on the argument that there was no room under a face for a stone
   * carrying a numeral. That was true and it answered the wrong question: the
   * thing a band stood for was a card, and there was room for the card. See
   * `CardStack`.
   */
  readonly versions: readonly CardIndexVersion[];
  /**
   * The card's printed values, label and value. Rows view only.
   *
   * ALL FIVE, NOT THREE — Cost, Power, Defence, Life, Intellect, in the order
   * `docs/DESIGN.md` reads a card. This said "cost, power, defence" while both
   * callers already supplied the full list, which is the exact three-value
   * vocabulary this component exists to stop the two surfaces disagreeing
   * about. Only the values a card actually prints are present, so an ordinary
   * action carries three and a hero carries three different ones.
   *
   * ARCANE WAS A SIXTH AND IS NOT A PRINTED VALUE — see `STAT_ORDER` in
   * `cards.ts`. It is gone from both callers, so the two surfaces still agree.
   */
  readonly stats?: readonly (readonly [string, string])[] | undefined;
  /**
   * Why this row is on the page, in the words of the ranking that put it there.
   *
   * LIST VIEW ONLY, AND IT IS ABOUT THE QUERY RATHER THAN THE CARD — which is
   * the distinction that decides what may appear under a name at all. A set
   * page has no ranking and therefore nothing true to say here, while every
   * search result does. Under a grid of faces it would be a line of engine
   * chatter under every picture.
   *
   * THIS IS THE ONLY SUCH LINE LEFT. There was a `note` beside it saying which
   * versions a partial match covered — "1 of 3 versions" — and it is gone:
   * every card list on this site now says which versions it stands for by
   * drawing them, and what it draws is what a reader can click. A row standing
   * for one version draws one stone or one card; the words under it were a
   * second telling of a fact the object had already told, and the site would
   * rather be read than narrated.
   */
  readonly why?: string | undefined;
}

export interface CardIndexProps {
  /** The rows on THIS page, already cut by the caller. */
  readonly entries: readonly CardIndexEntry[];
  readonly display: CardIndexDisplay;
  readonly onDisplayChange: (display: CardIndexDisplay) => void;
  /**
   * How much of the corpus one row stands for, and how the list is ordered.
   *
   * OPTIONAL IN PAIRS, AND THAT IS THE WHOLE OF HOW TWO SURFACES SHARE ONE BAR.
   * A control appears when its value AND its handler are supplied, so `/search`
   * — where all four are terms in a query the reader can also type — gets the
   * full sentence, and a set page gets the one control it can honour. The
   * ORDER of the controls is fixed here rather than composed by the caller: a
   * slot would let two card lists grow two different bars, which is the exact
   * divergence this component exists to end.
   *
   * WHY THE SET PAGE HAS ONLY `display`. `unique:` collapses pitch versions and
   * `order:` re-ranks, and both are answered by the QUERY ENGINE — a set page
   * has no query, it has a set, and its rows are grouped by the build. Offering
   * a sort it cannot perform would be a control that looks operable and is not.
   */
  readonly unique?: CardIndexUnique | undefined;
  readonly onUniqueChange?: ((unique: CardIndexUnique) => void) | undefined;
  readonly order?: CardIndexOrder | undefined;
  readonly onOrderChange?: ((order: CardIndexOrder) => void) | undefined;
  readonly direction?: CardIndexDirection | undefined;
  readonly onDirectionChange?:
    | ((direction: CardIndexDirection) => void)
    | undefined;
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
   * The same sentence again, off-screen, in a live region.
   *
   * WHY IT IS A SECOND COPY RATHER THAN `summary` MADE LIVE. The printed count
   * updates on every re-render, and on `/cr` that is every keystroke — a live
   * region on it would interrupt a screen reader once per letter, each
   * announcement cancelling the last. So the SURFACE decides when the words are
   * worth saying and passes them here, which is why `RulesSearch` hands in a
   * settled copy and the click-driven surfaces hand in the live one.
   *
   * OPTIONAL, BUT NEVER CONDITIONALLY PASSED. A live region added to the page
   * at the moment it has something to say is a live region that says nothing:
   * assistive technology announces CHANGES to a region it was already watching.
   * A caller either passes this on every render or never.
   */
  readonly announcement?: ReactNode | undefined;
  /**
   * A handle on the printed count, so a surface can put focus on it.
   *
   * WHAT IT IS FOR. Turning a page client-side is a `pushState`, and a
   * `pushState` moves no focus — so a reader who clicked "Next" is left with
   * focus on an anchor that now sits under a different page's results, and the
   * next Tab carries on from the FOOT of the new page rather than its start.
   *
   * THE COUNT RATHER THAN A WRAPPER, because a focus target has to say
   * something. A `<div tabindex="-1">` around the list announces nothing on
   * arrival, which is a focus move a screen-reader user cannot hear. The count
   * names the slice that just landed — "Cards 61–120 of 412" — which is
   * precisely what the reader asked for by clicking.
   */
  readonly countRef?: Ref<HTMLParagraphElement> | undefined;
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
 * THE LABELS ARE THE OPERATOR'S CANONICAL OPERANDS, which is a correction of
 * the rule rather than an abandonment of it. The old labels were "Images",
 * "Rows" and "Names" under a comment arguing that a button should say what a
 * reader would type — right in principle, wrong in execution, because those
 * are SYNONYMS the grammar accepts and `show()` writes the canonical spelling.
 * So the bar said "Names" and the box then said `display:text`. "Grid" and
 * "List" are what the URL actually carries, so the sentence, the query and the
 * address finally agree.
 *
 * AND THERE IS NO THIRD ROW HERE ANY MORE. See {@link CardIndexDisplay}: the
 * third view was this one at a lower density, and naming it cost the word the
 * `unique:` control was already using.
 */
const VIEWS = [
  ["grid", "Grid"],
  ["list", "List"],
] as const;

/**
 * The other three controls, and what to call each option.
 *
 * SAME RULE AS `VIEWS`: every label is a word the operator already accepts, so
 * a reader who learns the bar has learned the grammar. `unique:names`,
 * `order:defence`, `dir:desc` are all typable, and all three appear in
 * `/syntax`.
 *
 * "RELEVANCE" IS THE ONE LABEL THAT IS NOT AN OPERAND, because the thing it
 * names is the ABSENCE of one — a query with no `order:` is ranked by how well
 * each card matched, which is a real ordering and the default. Choosing it
 * removes the term rather than writing `order:relevance`, which would not parse.
 */
/**
 * THESE ARE PHRASES RATHER THAN BARE NOUNS, AND THAT IS THE WHOLE FIX.
 *
 * They read "Names", "Cards" and "Art", which is the operand and nothing else —
 * and a bare noun cannot be relied on to survive the sentence it is dropped
 * into. "Art as Rows" is not a sentence. "Cards as Names" does not say whether
 * "Names" is the unit or the rendering. Both were legible only to somebody who
 * already knew which control was which.
 *
 * The reference solves this and it is not luck: Scryfall's list is "Cards",
 * "All prints", "Unique art" — two of the three are phrases, chosen so that
 * every combination with its display list still parses as English, and no word
 * appears on both axes. "Pitch versions" is our "All prints": what
 * `unique:cards` actually expands a row into here is the pitch versions of a
 * name, which is the same relationship Scryfall's printings have to a card and
 * is worth saying in the label rather than leaving to `/syntax`.
 *
 * "Names" KEEPS ITS BARE NOUN because it is the one that already worked in
 * every position — "Names as Grid", "Names as List" — and because it is the
 * default, so it is the phrase most readers will see and the one with least to
 * gain from being longer.
 */
const UNIQUES = [
  ["names", "Names"],
  ["cards", "Pitch versions"],
  ["art", "Unique art"],
] as const;

const ORDERS = [
  ["relevance", "Relevance"],
  ["name", "Name"],
  ["released", "Released"],
  ["pitch", "Pitch"],
  ["cost", "Cost"],
  ["power", "Power"],
  ["defence", "Defence"],
  ["rarity", "Rarity"],
  ["set", "Set"],
] as const;

const DIRECTIONS = [
  ["asc", "Ascending"],
  ["desc", "Descending"],
] as const;

/**
 * One labelled `<select>` in the control bar.
 *
 * A SELECT RATHER THAN THE RADIO GROUP THE VIEW SWITCH USED TO BE, and the
 * reason is arithmetic rather than taste. One control with three options is a
 * legible row of radios; four such controls is sixteen radios in a line, which
 * is a wall. The reference solves it with four dropdowns reading as a sentence —
 * "Cards as Images sorted by Name" — and that is what this is.
 *
 * THE LABEL IS OFF-SCREEN AND THE CONNECTIVE WORDS ARE NOT. What a sighted
 * reader sees is the sentence; what a screen reader announces is "Order by,
 * combo box", because "sorted by" as an accessible name would be read out of the
 * sentence that gives it meaning. Both need naming, and they are not the same
 * name.
 */
function Choice<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: T;
  readonly options: readonly (readonly [T, string])[];
  readonly onChange: (value: T) => void;
}) {
  return (
    <span className="of-index__choice">
      <label className="of-index__choice-label" htmlFor={id}>
        {label}
      </label>
      <select
        className="of-index__select"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * The versions a row stands for, one per pitch, ascending.
 *
 * DEDUPLICATED AND SORTED HERE, ONCE, for the reason `PitchRule` does it
 * internally: several call sites build these lists from different sources, and
 * a row rendering blue before red would be stating one fact in two orders on
 * one screen. A card printed twice in one set arrives with its pitch twice, and
 * the two arrivals are the same destination — so the first wins and the second
 * is dropped rather than drawn as a fourth stone or a fourth card in the fan.
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
 * The pitch versions as jewels — the rendering the list view uses.
 *
 * ONE STONE PER VERSION, so a row standing for three pitch versions of a name
 * carries three, exactly as the grid draws three cards. `PitchJewel` is
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
 * A ROW WITH NO PITCH TO STATE DRAWS NO STONE AT ALL, which is what the guard
 * below is. Pitch is a value most of this corpus does not have — every hero,
 * every weapon, every piece of equipment — and for those the stone was a grey
 * diamond with a dash in it, one per row, down the whole page: a column of
 * marks saying *nothing here*, in the reserved silhouette that is supposed to
 * mean pitch. An absent value is absent; the row says so by not drawing it.
 *
 * IT IS `every`, NOT A FILTER, AND THE DIFFERENCE IS ONE GROUP IN THE CORPUS.
 * `Hyper Driver` is a pitch-0 token sharing its name with three pitched
 * actions — the one name disambiguated by an ABSENCE — so on a collapsed row
 * for that name the dash stone is the only thing distinguishing a real version
 * from its siblings, and it is a door to that version's page. Dropping every
 * zero would take that door away. What is being removed is a stone with nothing
 * to say, not the pitch-0 version.
 *
 * THE STONES SIT OUTSIDE THE NAME'S ANCHOR — `ResultRow` renders its `trail`
 * after the link rather than inside it — so this needs no markup contortion to
 * avoid nesting an anchor in an anchor. The grid did need one; see the cell.
 */
function PitchStones({
  versions,
}: {
  readonly versions: readonly CardIndexVersion[];
}) {
  const shown = versionsOf(versions);
  if (shown.length === 0) return null;
  if (shown.every((version) => version.pitch === 0)) return null;
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
 * The pitch versions as a STACK OF CARDS that fans on hover — the rendering the
 * grid uses, and what replaced the row of coloured bands under the name.
 *
 * WHY THE BANDS ARE GONE. They were an underline: three hairlines saying, in
 * hue alone, that this cell stood for three cards, with each one a link to the
 * version it was drawn the colour of. That worked and it was quiet to the point
 * of being invisible — a reader had to already know what the mark meant, the
 * colour was the entire channel, and the thing the mark stood for was a CARD
 * while the mark was a stripe. This draws the cards instead. The cell is a
 * stack; the versions behind the front one show as slivers at rest, so a
 * multi-version cell is legibly a stack of cards rather than a single one; and
 * hovering spreads them into a hand, each face its own link to its own version.
 *
 * THE FRONT CARD IS THE ROW'S OWN, NOT `versions[0]`, and the difference is a
 * feature rather than pedantry. The front is handed over whole and the tail is
 * every version that is not already it, matched by address rather than by
 * position: a caller whose first version is not the row would otherwise have
 * drawn the same card twice.
 *
 * EVERY CARD IN THE HAND COMES FROM ONE PRINT RUN, AND THAT IS THE CALLER'S
 * JOB RATHER THAN THIS COMPONENT'S. `set:MST` shows what Mistveil printed, so
 * the row's picture is Mistveil's — and so is every version's, because
 * `card-search/` resolves them all through one rule. This note used to say
 * the versions "deliberately wear their own default faces, because each one is
 * a link to a CARD", which shipped a fan holding one card from the set the
 * reader named and two from a set they did not. A fan is a comparison between
 * siblings; siblings drawn from different print runs is a rendering fault
 * wearing the costume of a design decision.
 *
 * WHAT THE FAN HOLDS IS WHAT MATCHED, for the same reason and by the same
 * route: the caller passes the versions the query returned, so a filter that
 * excludes a pitch excludes it from the hand as well as from the page. This
 * component draws what it is given and never reaches for a sibling.
 *
 * A ONE-VERSION ROW IS ONE CARD AND ONE LINK, with no stack, no fan and no
 * hover behaviour — there is nothing to choose between, and a cell that
 * gestured at a choice it does not have would be worse than the plain one.
 *
 * A TOUCH READER NEVER HOVERS, AND THAT IS AN ACCEPTED BOUND RATHER THAN AN
 * OVERSIGHT. The resting slivers still say the cell is a stack, and tapping it
 * opens the row's card, whose own page carries every version. What a pointer
 * buys is skipping that page; it is a shortcut, so losing it costs a tap rather
 * than a destination.
 */
function CardStack({ entry }: { readonly entry: CardIndexEntry }) {
  /*
    Matched by ADDRESS rather than by index — see the note above. `versionsOf`
    has already deduplicated and sorted, so this preserves pitch order.

    THE LENGTH GUARD IS NOT REDUNDANT WITH THE ADDRESS FILTER, and an
    `unique:art` row is where the difference showed. Such a row stands for ONE
    picture of one card: its own `href` is that printing's URL while its single
    version points at the card's default page, so the two addresses differ and
    the filter kept the version — dealing a two-card "fan" whose back card was
    the same card's default art, on a cell with no choice in it at all. A row
    standing for one version is one card and one link; that is a fact about how
    many versions it has, so it is asked of the count.
  */
  const behind =
    entry.versions.length < 2
      ? []
      : versionsOf(entry.versions).filter(
          (version) => version.href !== entry.href,
        );

  const face = (
    <CardFace
      src={faceSrc(entry.faceKey, entry.faceLandscape)}
      alt={altFor(entry)}
      width={GRID_BOX.width}
      height={GRID_BOX.height}
      loading="lazy"
    />
  );

  if (behind.length === 0) {
    return (
      <a className="of-index__card" href={entry.href}>
        {face}
      </a>
    );
  }

  /*
    `--n` IS ON THE STACK AND `--i` IS ON EACH CARD, because the tilt of one
    card is a function of BOTH — a fan is symmetric about its middle, so a card
    needs to know how many it is one of. Two custom properties rather than a
    pre-computed angle per card so the arithmetic lives in the stylesheet
    beside the value it is made of; see `.of-index__card` for what it computes.
  */
  const total = behind.length + 1;

  return (
    <span
      className="of-index__stack"
      style={{ "--n": total } as React.CSSProperties}
    >
      <a
        className="of-index__card"
        href={entry.href}
        style={{ "--i": 0 } as React.CSSProperties}
      >
        {face}
      </a>
      {behind.map((version, position) => (
        <a
          className="of-index__card of-index__card--behind"
          href={version.href}
          key={version.href}
          style={{ "--i": position + 1 } as React.CSSProperties}
        >
          {/*
            THE VERSION'S LABEL IS THE WHOLE ALT TEXT, with no type line after
            it. The row's own face carries `label — type line` because it is the
            cell's primary destination and the type line is a fact about the
            card; these are a choice BETWEEN versions of one card, which share
            a type line, so repeating it three times would be three identical
            suffixes on the one axis the reader is trying to tell apart.
          */}
          <CardFace
            src={faceSrc(version.faceKey, version.faceLandscape)}
            alt={version.label}
            width={GRID_BOX.width}
            height={GRID_BOX.height}
            loading="lazy"
          />
        </a>
      ))}
    </span>
  );
}

function altFor(entry: CardIndexEntry): string {
  return entry.typeLine === ""
    ? entry.label
    : `${entry.label} — ${entry.typeLine}`;
}

/**
 * THE GRID ASKS FOR THE `normal` TIER, AND IT USED TO ASK FOR `thumb`.
 *
 * The grid draws a card at `layout.card.cell` — 240px, the size the reference
 * settled on and the size at which a face reads as a card rather than as a
 * stamp. The thumb tier is 180px, so every cell was upscaling by a third: soft
 * art, soft type, and a grid that looked like a contact sheet of a card list
 * rather than a list of cards.
 *
 * THE COST IS BANDWIDTH AND IT IS REAL. Sixty normal faces is several megabytes
 * where sixty thumbs was a fraction of that. Three things make it the right
 * trade rather than an oversight: `CardFace` is `loading="lazy"`, so a reader
 * pays for the rows they scroll to; the page size is the reader's to choose and
 * defaults to the same 60 the reference uses; and the reference itself serves a
 * ~490px image into a 245px cell for exactly this reason.
 *
 * NO `srcset`, DELIBERATELY, AND THE REASON IS THE TOKEN RULE RATHER THAN THE
 * BROWSER. A `sizes` attribute has to carry a CSS LENGTH, and a length written
 * in this file is precisely what `scripts/check-tokens.ts` fails the build on —
 * it cannot be `var(--of-layout-card-cell)`, because `sizes` is parsed before
 * the cascade and custom properties are not available to it. So the choice was
 * a raw `15rem` smuggled past the design system, or one tier that is right at
 * the size the grid draws. The second is not a workaround: it is the honest
 * answer while the host publishes two tiers and the grid uses one of them.
 */
function faceSrc(key: string | null, landscape: boolean): string {
  const orientation = landscape ? "landscape" : "portrait";
  return key === null ? placeholderUrl(orientation) : faceUrl(key, "normal");
}

/**
 * The intrinsic box every face in the grid declares.
 *
 * ONE BOX FOR EVERY CELL, PORTRAIT, AND THE LANDSCAPE CARDS KEEP IT. `CardFace`
 * turns `width`/`height` into an `aspect-ratio` and letterboxes anything that
 * disagrees, which is what this needs: a grid whose cells changed shape for the
 * 15 horizontally-played cards would reflow its rows around them, and a fan
 * stacks faces on top of one another so a transposed member would not sit under
 * the card it is stacked with. The face itself is still drawn the right way
 * round inside the box — that is `object-fit: contain` doing its job.
 */
const GRID_BOX = FACE_TIERS.normal;

/**
 * The intrinsic box a face at the head of a list row declares.
 *
 * THE `thumb` TIER, WHICH IS THE ONE PLACE ON THIS SITE IT IS THE RIGHT
 * ANSWER. `faceSrc` records why the grid abandoned it: 180px drawn into a
 * 240px cell is a third of an upscale, so the grid asked for `normal` instead.
 * The row draws at `layout.card.row` — 44px — so the same tier is a 4×
 * DOWNSCALE here. Asking for `normal` would ship a 450px picture to paint
 * forty-four points of it, sixty times a page.
 *
 * PORTRAIT FOR THE LANDSCAPE CARDS TOO, exactly as {@link GRID_BOX} is, and
 * the reason is the same one restated for a different axis: a row that changed
 * height for the 15 horizontally-played cards would make the list's rhythm
 * depend on which cards matched. `CardFace` letterboxes inside the box and
 * draws the face the right way round.
 */
const ROW_BOX = FACE_TIERS.thumb;

/**
 * The row's face — small, silent, and not a link.
 *
 * IT IS A RECOGNITION MARK RATHER THAN A PICTURE TO LOOK AT. See the
 * `layout.card.row` token for the size argument; what matters here is what the
 * element is NOT.
 *
 * NOT A LINK, AND THAT IS THE ACCESSIBILITY CALL. The name beside it already
 * points at the row, so an anchor around the face would be a second control
 * for one destination in a smaller target — two links with the same
 * destination and different accessible names is the WCAG 2.4.4 shape this
 * component's own `label` field exists to avoid. It sits outside the anchor
 * for the same reason the stones do — `ResultRow` renders both of its marks
 * outside the link, the `lead` before it and the `trail` after it, so neither
 * can nest an anchor inside one.
 *
 * `alt=""` FOLLOWS FROM THAT. The picture repeats what the name, the type line
 * and the stones already say in text on the same row, so naming it again would
 * make every result announce itself twice. It is decorative in the precise
 * technical sense — not unimportant, but carrying nothing a screen reader
 * cannot already reach.
 *
 * ONE FACE, NOT A STACK, WHERE THE ROW STANDS FOR SEVERAL VERSIONS. The grid
 * draws a stack because a cell IS a card and there is room to fan it; here the
 * stones are already the version links, and three cards fanned at 44px would
 * be three slivers of nothing. A row that gestured at a choice it could not
 * legibly offer is worse than a row that leaves the choice to the stones.
 */
function RowFace({ entry }: { readonly entry: CardIndexEntry }) {
  return (
    <span className="of-index__row-face">
      <CardFace
        src={rowFaceSrc(entry.faceKey, entry.faceLandscape)}
        alt=""
        width={ROW_BOX.width}
        height={ROW_BOX.height}
        loading="lazy"
      />
    </span>
  );
}

function rowFaceSrc(key: string | null, landscape: boolean): string {
  const orientation = landscape ? "landscape" : "portrait";
  return key === null ? placeholderUrl(orientation) : faceUrl(key, "thumb");
}

/*
 * `CopyNames` WAS HERE, AND IT IS DELETED RATHER THAN HIDDEN BEHIND A PROP.
 *
 * It put every row's name on the clipboard, one per line, and it was the
 * argument for retiring the `display:text` view: a control reaches the rows
 * below the fold, needs no drag, cannot pick up a stray glyph, and works from
 * whichever view you are already in. That argument was sound and the control
 * did work — this is a decision about what belongs in this bar, not a bug
 * report.
 *
 * WHAT IS LOST, STATED PLAINLY rather than glossed, because the retirement of
 * `display:text` is written down in `grammar.ts` and pointed here. Taking forty
 * names off the page is a drag-select again. `PitchJewel` still carries
 * `user-select: none`, so a stone's numeral will not arrive in a deck list, but
 * the list view's type lines and pitch qualifiers will — which is exactly the
 * mess the control was better than. `grammar.ts` has been corrected to say so
 * instead of pointing at a button that is not there.
 */

export function CardIndex({
  entries,
  display,
  onDisplayChange,
  unique,
  onUniqueChange,
  order,
  onOrderChange,
  direction,
  onDirectionChange,
  pagination,
  summary,
  announcement,
  countRef,
  controlName,
  interactive,
}: CardIndexProps) {
  return (
    <>
      {/*
        EVERY CONTROL THAT SHAPES THE LIST, IN ONE BAR, ABOVE THE COUNT.

        WHAT THIS REPLACED. A single view switch sharing one `space-between` line
        with the count — so the control that changes what you are looking at sat
        at the far right of a sentence about what you are looking at, and on a
        narrow viewport the flex wrap dropped it BELOW that sentence, moving the
        page's only piece of chrome depending on the window width. Ordering
        controls did not exist on screen at all: `order:`, `dir:` and `unique:`
        were typable operators and nothing else, so a reader who did not read
        `/syntax` could not sort a result set.

        A SENTENCE RATHER THAN A TOOLBAR, which is the reference's shape and the
        right one: these four values are not independent switches, they compose
        into one statement about the list — "Names as Images sorted by Cost,
        Descending" — and reading them in a row is how you check you asked for
        what you meant.

        THE ORDER IS FIXED HERE AND THE CONTROLS ARE OPTIONAL. A caller supplies
        the pairs it can honour; it does not get to arrange them. See the props.

        Hidden until hydration for the reason `interactive` gives — these are
        `<select>`s driven by JavaScript, and the pager beneath is what stays
        operable without it, because it is made of links.
      */}
      {interactive ? (
        <div className="of-index__controls">
          {unique !== undefined && onUniqueChange !== undefined ? (
            <>
              <Choice
                id={`${controlName}-unique`}
                label="One row per"
                value={unique}
                options={UNIQUES}
                onChange={onUniqueChange}
              />
              <span className="of-index__joiner">as</span>
            </>
          ) : null}

          <Choice
            id={`${controlName}-display`}
            label="Show cards as"
            value={display}
            options={VIEWS}
            onChange={onDisplayChange}
          />

          {order !== undefined && onOrderChange !== undefined ? (
            <>
              <span className="of-index__joiner">sorted by</span>
              <Choice
                id={`${controlName}-order`}
                label="Order by"
                value={order}
                options={ORDERS}
                onChange={onOrderChange}
              />
            </>
          ) : null}

          {/*
            THE DIRECTION IS HIDDEN WHILE THE ORDER IS RELEVANCE, because there
            is nothing for it to reverse. Relevance is the ranking's own order —
            best match first — and `dir:desc` beside it would be a control that
            reads as if it would put the worst matches at the top and does not.
          */}
          {direction !== undefined &&
          onDirectionChange !== undefined &&
          order !== "relevance" ? (
            <Choice
              id={`${controlName}-direction`}
              label="Sort direction"
              value={direction}
              options={DIRECTIONS}
              onChange={onDirectionChange}
            />
          ) : null}
        </div>
      ) : null}

      {/*
        THE BAR'S CLOSING LINE, AND IT IS THE SECTION RULE RATHER THAN A BORDER
        OF THE BAR'S OWN. `border-block-end` on `.of-index__controls` drew the
        same hairline `OrnamentalRule` draws, which made this the one divider on
        a results page with no centre mark in it. `decorative`, because a border
        announced nothing and a `separator` between a control bar and the count
        it describes is noise; `flush`, because the bar's padding above and the
        count's margin below are already the space either side of it.

        INSIDE THE SAME CONDITION AS THE BAR. There is no line to close a bar
        that was never drawn — before hydration, and for a caller that hands in
        no controls at all.
      */}
      {interactive ? <OrnamentalRule decorative flush /> : null}

      {/*
        OFF-SCREEN, AND CARRYING THE SAME WORDS THE COUNT PRINTS. Two elements
        rather than one made live — see `announcement` for why, and note that
        the surface, not this component, decides when they are worth saying.
      */}
      {announcement !== undefined ? (
        <p aria-live="polite" className="of-index__announcement" role="status">
          {announcement}
        </p>
      ) : null}

      {/*
        `tabIndex={-1}` MAKES THIS FOCUSABLE BY SCRIPT AND NOT BY TAB, which is
        the whole of what a post-navigation focus target needs. It adds no stop
        to the tab order of a reader who never turns a page.
      */}
      <p className="of-index__count" ref={countRef} tabIndex={-1}>
        {summary}
      </p>

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
          {entries.map((entry) => (
            /*
              A CELL IS A PICTURE AND NOTHING ELSE — no printed name under it,
              no coloured rule under that. Both were removed together and for
              one reason: the face IS the row. A card is designed to be
              identified at a glance by its art and its frame, which is the
              claim `docs/DESIGN.md` makes for showing pictures at all, and a
              caption under every cell was the list saying it did not quite
              believe its own argument. The reference has carried captionless
              image results for a decade.

              NOTHING IS LOST TO ANYTHING READING THE PAGE ALOUD. The name was
              never the accessible name on its own — the face's `alt` carries
              the qualified label and the type line, and it still does — so the
              anchor announces exactly what it announced before. What is gone is
              a visible duplicate of it, and `Variant`, which existed to hide
              the pitch suffix inside that duplicate.

              WHAT A SIGHTED READER LOSES IS THE SPELLING OF A NAME THEY CAN
              SEE, and it is worth stating rather than glossing. 900 names in
              this corpus belong to more than one card; those versions are now
              ONE cell with the others stacked behind it, so the comparison that
              used to need a suffix is a fan inside a single cell instead of two
              cells that read alike. Where a query deliberately expands a name
              back into its versions — `unique:cards`, `unique:art` — the cells
              are told apart by their art, and by the list view, which prints
              the name and the qualifier in full.
            */
            <li className="of-index__cell" key={entry.href}>
              <CardStack entry={entry} />
            </li>
          ))}
        </ul>
      ) : (
        /*
          Dense rows: the view for comparing printed values down a column, and
          `ResultRow` is exactly the primitive for it — a leading slot, a name,
          a trailing slot, and facts underneath. THE FACE LEADS AND THE JEWEL
          TRAILS THE NAME, because this view has a line of type to hang a stone
          off, so it can afford the rendering that carries the numeral.

          THE JEWEL LED THE ROW UNTIL IT DID NOT EARN THE COLUMN. Beside the
          face it needed a slot as wide as three stones so that every row's name
          started at the same x, which meant a one-version row put an empty
          stone's width between a 44px picture and the name it labels. Trailing
          the name, the mark is a qualifier ON the name — where a reader looking
          up a pitch is already looking — and the names need no slot to line up
          because nothing variable precedes them. See `.of-index__stones`.

          ONE JEWEL PER PITCH VALUE, exactly as the grid draws one card
          per value. A row stands for a NAME and a name is commonly three cards, so
          a single stone would be picking one of the three versions to speak for
          the other two — which is the same "collapses two true facts into one"
          failure the engine builds its whole verdict model to avoid.

          AND NONE AT ALL WHERE THE CARD HAS NO PITCH, which most of the corpus
          does not — see `PitchStones` for why an absence is drawn by drawing
          nothing rather than by a grey stone with a dash in it.
        */
        <ol className="of-index__rows">
          {entries.map((entry) => (
            <ResultRow
              key={entry.href}
              href={entry.href}
              label={entry.name}
              qualifier={entry.qualifier}
              lead={<RowFace entry={entry} />}
              trail={<PitchStones versions={entry.versions} />}
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
      )}

      {pagination}
    </>
  );
}
