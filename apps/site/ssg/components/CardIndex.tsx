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
 * them, the pagination, the density of the grid, and how a row that stands for
 * several pitch versions offers them. A caller supplies rows and owns the
 * state; it does not get to invent a fourth way to show a card.
 *
 * A ROW IS A NAME, AND HOW THE READER PICKS A VERSION IS THE OTHER HALF OF IT.
 * Both callers hand over the pitch versions a row stands for — a search hands
 * the ones that matched, a set page the ones that set printed — and where there
 * is more than one, what this component draws for them are LINKS. That is the
 * difference between "three cells of Angelic Wrath that look identical" and one
 * cell that opens into the three cards it stands for.
 *
 * THE TWO VIEWS DRAW IT DIFFERENTLY BECAUSE THEY CAN AFFORD DIFFERENT THINGS.
 * The text views have a line of type and no picture competing with it, so they
 * put a numbered stone per version beside the name. The images view has a card,
 * so it draws the versions AS cards: stacked behind the front one, fanned on
 * hover, each face its own link. See {@link CardIndexEntry.versions} and
 * `CardStack`.
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

import { CardFace, PitchJewel, ResultRow } from "optfall-components/react";
import type { PitchValue } from "optfall-theme";

import { FACE_TIERS, faceUrl, placeholderUrl } from "../../src/lib/faces";

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
  /**
   * This version's own picture, or `null` where it publishes none.
   *
   * REQUIRED BECAUSE THE IMAGES VIEW DRAWS THE VERSIONS AS CARDS. A row
   * standing for three pitch versions is a stack of three faces that fans on
   * hover, and the three Head Jabs are three different paintings — a stack of
   * one image repeated would be a decoration rather than a choice between
   * cards. The two text views never look at this; they draw stones.
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
   * THE IMAGES VIEW PRINTS NEITHER, AND IS WHERE THIS FIELD IS NOT USED. It
   * carries no caption at all now — the face is the row, and the anchor's
   * accessible name is the face's `alt`, which has always carried the qualified
   * {@link label}. So the two text views are the whole of this field's audience.
   *
   * WHAT A SIGHTED READER HAS IN THE IMAGES VIEW IS THE ART, and that is worth
   * stating plainly rather than leaving to be discovered. The rows and names
   * views carry a numbered stone, so hue is redundant there; the grid has no
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
   * page and the marks under it were decoration, so a reader who wanted the blue
   * one specifically had to arrive at the name and then find it in the strip.
   * Now the row still goes to the row — the address for "this card", whichever
   * version you meant — and each MARK goes to the version it is drawn for: a
   * stone in the text views, the version's own card face in the images view.
   *
   * THE FIELD WAS `pitches: PitchValue[]` AND THE HREFS ARE NOT BESIDE IT.
   * Two arrays — values here, links there — is two orderings of one fact and
   * an invitation for a caller to supply three marks and two links. One array
   * of versions cannot disagree with itself.
   *
   * TWO RENDERINGS, CHOSEN BY VIEW, AND THAT IS A DESIGN DECISION RATHER THAN
   * AN INCONSISTENCY. The two text views have a line of type to put a jewel
   * beside and no picture to compete with, so they draw {@link PitchJewel},
   * which carries the numeral `docs/DESIGN.md` calls the primary channel. The
   * images view has a card, so it draws the versions as CARDS — a stack that
   * fans on hover, each face a link to its own version. The information is
   * identical; what differs is what the surface can afford to say it with.
   *
   * THE IMAGES VIEW USED TO DRAW BANDS — one `PitchRule` per version, as an
   * underline, on the argument that there was no room under a face for a stone
   * carrying a numeral. That was true and it answered the wrong question: the
   * thing a band stood for was a card, and there was room for the card. See
   * `CardStack`.
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
 * The pitch versions as jewels — the rendering the two TEXT views use.
 *
 * ONE STONE PER VERSION, so a row standing for three pitch versions of a name
 * carries three, exactly as the images view draws three cards. `PitchJewel` is
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
 * The pitch versions as a STACK OF CARDS that fans on hover — the rendering the
 * images view uses, and what replaced the row of coloured bands under the name.
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
 * feature rather than pedantry. `toResult` may swap a row's picture for the art
 * of the set a query named — `set:MST` shows what Mistveil printed — and the
 * versions behind it deliberately wear their own default faces, because each one
 * is a link to a CARD and a card page shows its own art. So the front is handed
 * over whole and the tail is every version that is not already it, matched by
 * address rather than by position: a caller whose first version is not the row
 * would otherwise have drawn the same card twice.
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
  */
  const behind = versionsOf(entry.versions).filter(
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

/**
 * THE IMAGES VIEW ASKS FOR THE `normal` TIER, AND IT USED TO ASK FOR `thumb`.
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
      {/*
        THE SWITCH COMES FIRST, ON ITS OWN ROW, AND THE COUNT FOLLOWS IT.

        The two used to share one line — count at the start, views at the end,
        `space-between`. That put the control that changes what you are looking
        at at the far right of a sentence about what you are looking at, and on
        a narrow viewport the flex wrap dropped it BELOW the count, so the one
        piece of chrome on the page moved depending on how wide the window was.

        Stacked, the bar is the first thing under the field: chrome, then the
        answer, then the answer's rows — which is the order the reference puts
        them in and the order they are read in. It is also the order they are
        used in, since a reader picks a view once and reads counts many times.

        A radio group rather than a row of buttons, because that is what "pick
        exactly one" is, and it gets arrow keys and a group name for free.
        Hidden until hydration for the reason `interactive` gives.
      */}
      {interactive ? (
        <div className="of-index__controls">
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
        </div>
      ) : null}

      <p className="of-index__count">{summary}</p>

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
              are told apart by their art, and by the two views whose entire job
              is names.
            */
            <li className="of-index__cell" key={entry.href}>
              <CardStack entry={entry} />
            </li>
          ))}
        </ul>
      ) : display === "list" ? (
        /*
          Dense rows: the view for comparing printed values down a column, and
          `ResultRow` is exactly the primitive for it — a leading slot, a name,
          and facts underneath. THE JEWEL LEADS, because this view has a line of
          type to sit a stone beside and no card face to compete with, so it can
          afford the rendering that carries the numeral.

          ONE JEWEL PER PITCH VALUE, exactly as the images view draws one card
          per value. A row stands for a NAME and a name is commonly three cards, so
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
