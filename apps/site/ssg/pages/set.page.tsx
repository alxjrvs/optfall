/**
 * `/sets/<code>` — one set, and the cards Optfall carries from it. Ported.
 *
 * A SET PAGE IS A LIST, NOT A SEARCH RESULT, and the distinction is why this
 * exists rather than redirecting to `/search?q=set:MST`. The query answers "what
 * matches"; this answers "what is in this set", which is a fact about the set
 * rather than about a question somebody asked. It also gives the set a permanent
 * URL, which a query string is not — `docs/DESIGN.md`: "Every view is a URL …
 * the link you paste into a conversation to settle it."
 *
 * Emitted only for sets that carry a card. A page listing nothing is a 404 that
 * renders, and upstream publishes several sets with no cards in this corpus.
 *
 * THE FIRST PORTED PAGE WITH `getStaticPaths`, WHICH IS THE CONTRACT'S WHOLE
 * CLAIM. Phase 6's premise is that keeping Astro's page shape makes this a port
 * rather than a rewrite; this function is copied across with its body unchanged
 * and its type annotations simplified, and the generator fans it out exactly as
 * Astro did. 112 pages, from one pass over the corpus.
 */

import { readableDate } from "optfall-components";

import {
  CARD_PAGES,
  type CardPage,
  facesOf,
  hrefForPrinting,
  variantSuffix,
} from "../../src/lib/cards";
import { orientationOfFace } from "../../src/lib/faces";
import { editionLabel, setFor } from "../../src/lib/sets";
import type { CardIndexEntry } from "../components/CardIndex";
import { Island } from "../Island";
import { CardList } from "../islands/CardList";
import type { PageModule, PageResult, RouteContext } from "../types";
import "./set.css";

type Params = { readonly code: string };
type Props = { readonly id: string; readonly cards: readonly CardPage[] };

/**
 * The printing this card is shown BY on this set's page: its face, and the
 * address of the page that face belongs to.
 *
 * A CARD IS LISTED UNDER EVERY SET IT WAS PRINTED IN — the line at the foot of
 * this page has always said so — and `page.face` is the card's FIRST printing
 * that publishes art, in corpus order. So a card first printed in Welcome to
 * Rathe and reprinted in Mistveil carried the Rathe art on Mistveil's page:
 * the right card, the wrong picture, on the one surface whose entire subject is
 * a print run. Measured on this corpus: 2,239 of the 4,941 cards are printed in
 * more than one set, and every one of those 2,239 has at least one set whose art
 * differs from the default — so this is not a long-tail correction, it is most
 * of the reprints in the game. Monarch's page went from 307 rows carrying a mix
 * of other sets' art to 307 carrying Monarch's. (Those 307 cards are 155 rows
 * now — see `entryFor` — and every one of them still wears this set's face,
 * because the collapse chooses a version and this chooses that version's
 * printing.)
 *
 * IT RETURNS THE ADDRESS BECAUSE IT PICKED THE PRINTING, and that is the whole
 * of the second fix. Fixing the picture left the LINK on `page.href`, the
 * card's default printing — so Mistveil's page drew MST095, and clicking it
 * arrived at `/card/eng/025/…`: a different set, a different collector number
 * and a different picture from the one the reader clicked. Measured across the
 * 112 set pages this route builds: they carry 9,118 (set, card) links — a row's
 * own, one per fanned version, one per `<noscript>` line — and 4,173 of them
 * pointed outside the set the picture came from, touching 3,365 of the 6,555
 * rows and 109 of the 112 sets. Face and address are one decision, so they are
 * one return value and cannot be resolved apart.
 *
 * `facesOf` IS THE ROUTER'S LIST, so every key this can return is one the face
 * host has been asked to store, and every address it builds is one `CARD_ROUTES`
 * emits — `hrefForPrinting` from the same `PrintingRef` the router uses.
 * Deriving the set's art any other way would be a second evaluation of a rule
 * that already has one home — the failure `cards.ts` and `printings.ts` both
 * spend paragraphs on.
 *
 * FALLING BACK TO THE CARD'S OWN FACE IS CORRECT, NOT A MISS. A straight reprint
 * carries no new art, and Regular / Rainbow Foil / Cold Foil in one set are
 * three printing rows sharing one image. "This set published no distinct art for
 * this card" is a real answer, and the honest rendering of it is the card's
 * face rather than a placeholder — and its own address, which is the page that
 * face is on.
 */
function printingForSet(page: CardPage, setId: string) {
  const faces = facesOf(page.card);
  const own =
    faces.find((ref) => ref.printing.set_id === setId) ?? faces[0] ?? null;

  if (own === null) {
    return {
      key: null,
      landscape: page.face.orientation === "landscape",
      href: page.href,
    };
  }

  return {
    key: own.key,
    landscape:
      orientationOfFace({
        key: own.key,
        playedHorizontally: page.card.played_horizontally,
        rotationDegrees: own.printing.image_rotation_degrees,
      }) === "landscape",
    href: hrefForPrinting(own.setCode, own.number, page.slug),
  };
}

/**
 * One row of the set's index: a NAME, and the versions of it this set printed.
 *
 * THIS PAGE USED TO LIST CARDS, AND THE ARGUMENT FOR IT WAS WRONG. The note
 * here said that Head Jab red, yellow and blue are three separate entries
 * upstream with three collector numbers, so collapsing them "would be inventing
 * a row the print run does not have". What it actually produced was the
 * screenshot this change came from: three consecutive cells of Angelic Wrath,
 * identical art, identical name, identical type line, differing in one coloured
 * band and in a pitch qualifier the index deliberately hides — so the reader
 * saw the same card three times and had no visible way to tell which was which.
 * That is not the print run being honest, it is a list repeating itself.
 *
 * A player calls those three ONE card. `card-search/` has said so since it was
 * written and collapses on exactly this rule; this page is where the two
 * surfaces stopped agreeing.
 *
 * NOTHING IS HIDDEN BY THE COLLAPSE, WHICH IS THE CONDITION FOR MAKING IT. Each
 * version keeps a destination of its own — it is the band drawn in its own
 * colour, and hovering one says which card it is — so the row is a name with
 * three doors rather than a name that has swallowed two cards. The collector
 * numbers were never on this page to lose; they are on the card page, in the
 * printings table, where a print run is actually described.
 *
 * THE VERSIONS ARE THE ONES THIS SET PRINTED, never all the ones that exist.
 * A set that published only the blue Head Jab draws one band, because the
 * question this page answers is what is in the set.
 */
function entryFor(
  /** The versions of one name in this set, pitch ascending. At least one. */
  group: readonly CardPage[],
  setId: string,
): CardIndexEntry {
  /*
   * THE ROW WEARS THE LOWEST PITCH'S FACE, TYPE LINE AND PRINTED VALUES, and
   * the stats are the half of that worth stating plainly: the three versions of
   * a name differ in cost and often in power, so the rows view shows one
   * version's numbers on a row standing for three. That is the same trade
   * `card-search/` already makes on a collapsed result — the alternative is
   * either three rows again or a row printing three costs in one socket — and
   * the honest bound on it is that the numbers belong to the version the bands'
   * leftmost door opens.
   */
  const first = group[0];
  if (first === undefined) throw new Error("entryFor: an empty name group");

  const shown = printingForSet(first, setId);
  const collapsed = group.length > 1;

  return {
    /*
     * THE ROW OPENS THE PRINTING IT IS SHOWING, WHICH IS THIS SET'S.
     *
     * A ROW LANDS ON A VERSION THIS SET ACTUALLY PRINTED, and that is the same
     * rule `card-search/` states at length beside its own `partial` flag rather
     * than a second one invented here. `/card/<nameSlug>` renders the corpus's
     * LOWEST-PITCH version, which a set that printed only the higher ones does
     * not contain: Aurora prints Spark Spray at pitch 2 and 3, so a collapsed
     * row wore AUR022's art, drew two bands — and sent the reader to the pitch-1
     * card Aurora never published. So the row opens `first`, the lowest version
     * PRESENT by the sort, whether or not the set printed the whole name.
     *
     * IT USED TO SPLIT ON `collapsed && whole` AND SEND THE WHOLE-NAME CASE TO
     * `HREF_BY_NAME_SLUG` — "the name goes to the name". Both halves of that
     * are gone. `/card/<nameSlug>` is a 301 now, so the map held the lowest
     * version's DEFAULT PRINTING, which on a reprint is another set's page; and
     * on a whole group `first` IS the corpus's lowest-pitch version, so the two
     * branches named the same CARD and differed only in which printing of it
     * they opened. One branch, and it opens the one on screen.
     *
     * WHICH PRINTING IS `printingForSet`'S ANSWER, NOT A SECOND ONE HERE. The
     * face above and the address are the same value, so a row cannot draw one
     * set's art over another set's link.
     */
    href: shown.href,
    label: collapsed ? first.card.name : first.label,
    /* The bare name; the pitch qualifier `label` carries is hidden in the
       markup and kept for the accessible name. See `CardIndexEntry`. */
    name: first.card.name,
    /* The pitch suffix `label` carries, taken from the function that composes
       it rather than sliced back off the label — one evaluation of the rule.
       A collapsed row has nothing left to qualify: it stands for every version
       it draws a band for, so a suffix naming one of them would be false. */
    qualifier: collapsed ? "" : variantSuffix(first.pitch, first.disambiguated),
    typeLine: first.card.type_text ?? "",
    faceKey: shown.key,
    faceLandscape: shown.landscape,
    /*
      EACH VERSION WEARS THIS SET'S ART AND OPENS THIS SET'S PRINTING, which is
      the same rule `printingForSet` states for the row and applied to every
      card in the fan rather than only to the one on top. The images view stacks
      these behind the row's face and spreads them on hover, so a Mistveil page
      whose fanned versions carried Welcome to Rathe art would be the exact
      defect `printingForSet` exists to fix, one layer down and only visible on
      hover — and one whose fanned faces LINKED to Welcome to Rathe was that
      defect surviving the fix, invisible until the click.

      A set page is about a PRINT RUN: every picture on it, fanned or not, is
      what this set printed, and every door under those pictures opens the
      printing the picture is of.
    */
    versions: group.map((version) => {
      const versionPrinting = printingForSet(version, setId);
      return {
        pitch: version.pitch,
        href: versionPrinting.href,
        label: version.label,
        faceKey: versionPrinting.key,
        faceLandscape: versionPrinting.landscape,
      };
    }),
    stats: first.stats.map(
      (stat) => [stat.label, stat.value] as readonly [string, string],
    ),
  };
}

/**
 * The set's cards, grouped into one row per name, each group pitch ascending.
 *
 * ORDER IS THE CORPUS'S, TAKEN FROM THE FIRST VERSION SEEN. Corpus order is
 * upstream's name sort, so a name's versions are already adjacent and the group
 * lands where the first of them was — which means the page reads in the same
 * order it did before, with three cells replaced by one rather than moved.
 *
 * SORTED WITHIN THE GROUP BECAUSE THE MARK IS, and the two orders have to be the
 * same one. `PitchRule` draws bands ascending whatever it is handed; a group
 * left in corpus order would then link its leftmost band to whichever version
 * upstream happened to list first, and the leftmost band is by construction the
 * lowest pitch. The `href` and `label` a collapsed row carries come from the
 * FIRST member of the group, so this sort is also what makes those the lowest
 * version's rather than an arbitrary one's.
 */
function groupByName(
  cards: readonly CardPage[],
): readonly (readonly CardPage[])[] {
  const groups = new Map<string, CardPage[]>();
  for (const card of cards) {
    const existing = groups.get(card.nameSlug);
    if (existing) existing.push(card);
    else groups.set(card.nameSlug, [card]);
  }
  return [...groups.values()].map((group) =>
    group.toSorted((a, b) => a.pitch - b.pitch),
  );
}

function getStaticPaths() {
  /*
    Built once for the whole route rather than per page: 112 set pages each
    re-scanning 4,941 cards is that work 112 times for an answer that does not
    change. One pass, grouped.
  */
  const bySet = new Map<string, CardPage[]>();
  for (const page of CARD_PAGES) {
    for (const id of new Set(
      page.card.printings.map((printing) => printing.set_id),
    )) {
      const existing = bySet.get(id);
      if (existing) existing.push(page);
      else bySet.set(id, [page]);
    }
  }

  return [...bySet.entries()]
    .filter(([id]) => setFor(id) !== undefined)
    .map(([id, cards]) => ({
      params: { code: id.toLowerCase() },
      props: { id, cards },
    }));
}

function page({ props }: RouteContext<Params, Props>): PageResult {
  const set = setFor(props.id);
  /* Corpus order is upstream's name sort, which is the order a set list wants. */
  const listed = props.cards;

  if (set === undefined) {
    /*
     * UNREACHABLE, AND WRITTEN OUT RATHER THAN ASSERTED. `getStaticPaths`
     * filters on this exact condition, so a set with no entry never becomes a
     * route — but a `!` here would be a claim about that function holding
     * forever, and the same reasoning is already written into
     * `card/[...slug].astro`. The empty page is what a broken filter would
     * produce, which is visible.
     */
    return { title: "", description: "", children: null };
  }

  /*
    AFTER THE GUARD, NOT BEFORE IT. This sat above the early return, so the
    branch that exists to render nothing still walked `facesOf` and
    `orientationOf` once per card in the set first — inverting the ordering the
    guard is for. Unreachable today and free either way; the point is that a
    guard which does not actually guard the work below it is a guard that will
    stop reading as one.
  */
  const entries = groupByName(listed).map((group) => entryFor(group, props.id));

  /**
   * The editions this set was released in, minus the one that is not an
   * edition. See `editionLabel`: `N` is upstream's code for "no specified
   * edition", glossed as a sentence, so a promo set's masthead read "Editions:
   * No specified edition (used for promos, non-set releases, etc.)".
   */
  const editions = set.editions
    .map((code) => editionLabel(code))
    .filter((name): name is string => name !== null);

  /*
    TWO COUNTS, AND THE PAGE HAS TO SAY WHICH IS WHICH.

    `entries.length` is what this page LISTS — names, one row each. `listed`
    is what upstream carries, which counts Head Jab three times. Before the
    collapse they were one number; now they differ on most sets, and printing
    the larger one over an index of the smaller would be the masthead
    contradicting the list under it.

    THE MASTHEAD USED TO RECONCILE THEM IN A SENTENCE — "243 cards in this
    corpus, 423 counting each pitch version" — which put the reader through a
    subordinate clause to learn two numbers, and dropped the second one
    entirely on a set where the two agree. They are two rows of the fact list
    now, each with its own label, and BOTH are always printed: a set whose two
    counts are equal is a set that printed no pitch cycles, which is a real
    answer to the question rather than a reason to withhold it, and a list
    whose rows appear and vanish is one a reader cannot compare across sets.
  */
  const versions = listed.length;
  const rows = entries.length;

  return {
    title: `${set.name} — Optfall`,
    /* THE SAME TWO NUMBERS THE MASTHEAD PRINTS, because this string is what a
       pasted link says about itself and a description claiming 155 cards over a
       page that also says 307 is the disagreement `counted` exists to end. */
    description: `The ${rows} Flesh and Blood cards Optfall carries from ${set.name} (${set.id})${versions === rows ? "" : `, ${versions} counting each pitch version`}, each with its printed text, its printings and its per-format legality.`,
    section: "sets",
    /*
      THE SAME COLUMN `/search` USES, because it is the same `CardIndex` showing
      the same grid — and a set page is the surface the argument for pictures is
      strongest on, since a set is a print run. Two card lists at two widths
      would be the split this component was written to end, reappearing in the
      layout.
    */
    width: "index",
    /*
      THE FIRST PAGE OF THIS SET IS STILL IN THE HTML, because `Island` renders
      its child on the server. What the script adds is the view switch and the
      pager; what it does not add is the cards.
    */
    islands: true,
    children: (
      <>
        <nav className="of-lineage" aria-label="Breadcrumb">
          <ol className="of-crumbs">
            <li>
              <a href="/">Optfall</a>
            </li>
            <li>
              <a href="/sets">Sets</a>
            </li>
            <li>
              <span aria-current="page">{set.name}</span>
            </li>
          </ol>
        </nav>

        {/*
          A FACT LIST, NOT A SENTENCE, and the sentence is what this replaced:

              Released 2022-05-06. 243 cards in this corpus, 423 counting each
              pitch version. Out of print.

          Five facts strung into prose, in an order nothing but grammar chose,
          each one reachable only by reading past the ones before it. A reader
          arriving at a set page is looking one of them up — when did this come
          out, is it still in print, how big is it — and prose makes that a
          scan of a paragraph rather than a glance across a strip. The list is
          also comparable BETWEEN sets, which the sentence never was: the same
          labels in the same order on all 112 pages.

          IT READS ACROSS RATHER THAN DOWN, which is a layout change and not a
          content one. Stacked, five or six one-line facts cost that many rows
          of leading before the card index began — most of a phone's first
          screen spent on a date and four short values, none of them the thing
          the reader came for. Across, the whole list is a single 21 px line on
          a desktop and three short ones on a phone; `set.css` carries the
          measurements, including the variant that made a phone worse.

          `<dl>` STILL, RATHER THAN A TABLE OR A ROW OF SPANS, because these
          are term-and-value pairs and that is the element for them — every
          label is announced with its value, in order, with no `aria-*` doing
          work the markup already does. A `<table>` would be the wrong one
          twice over: this is one record rather than a grid of them, so the
          column headers a table promises a screen reader do not exist.

          THE `<div>` AROUND EACH PAIR IS LOAD-BEARING, not tidiness. It is the
          grouping HTML allows inside a `<dl>` for exactly this, and it is what
          keeps a label attached to its own value when the strip wraps: without
          it every `dt` and `dd` is placed independently, and a wrap can put a
          term at the end of one line and its value at the start of the next.

          THE MACHINE DATE DID NOT GO ANYWHERE. `readableDate` prints "6 May
          2022" for a reader and `dateTime` still carries `2022-05-06` for
          anything parsing the page — and the ISO string was never the reason
          to keep it visible, since a reader wanting to cite the page has the
          URL.
        */}
        <header className="of-masthead">
          <h1>{set.name}</h1>
          <dl className="of-masthead__facts">
            <div className="of-masthead__fact">
              <dt>Released</dt>
              <dd>
                {set.released === null ? (
                  /* Not "unknown": upstream publishes no date for this set,
                     which is a fact about the record rather than a gap in it. */
                  "No published date"
                ) : (
                  <time dateTime={set.released}>
                    {readableDate(set.released)}
                  </time>
                )}
              </dd>
            </div>

            <div className="of-masthead__fact">
              <dt>Card names</dt>
              <dd>{rows.toLocaleString("en-GB")}</dd>
            </div>

            <div className="of-masthead__fact">
              <dt>Pitch versions</dt>
              <dd>{versions.toLocaleString("en-GB")}</dd>
            </div>

            <div className="of-masthead__fact">
              <dt>Print status</dt>
              {/* `outOfPrint` is true only when EVERY printing of the set is
                  out of print — see `SetRecord` — so the negative case is
                  "still in print somewhere" rather than a claim about every
                  printing. */}
              <dd>{set.outOfPrint ? "Out of print" : "In print"}</dd>
            </div>

            <div className="of-masthead__fact">
              <dt>Set code</dt>
              {/* THE EYEBROW OVER THE TITLE SAID THIS FIRST — "SET 1HP" — and
                  it went when the list arrived. The code is a fact about the
                  set like the other five; printing it twice on one masthead is
                  the page saying the same thing in two registers. */}
              <dd>{set.id}</dd>
            </div>

            {/* The cell goes when there is nothing to name, rather than
                printing an em dash for the commonest case: `editionLabel`
                already resolves upstream's "no specified edition" to nothing,
                and a set with no editions has no edition cell. */}
            {editions.length > 0 ? (
              <div className="of-masthead__fact">
                <dt>Editions</dt>
                <dd>{editions.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        {/*
          THE SAME LIST OF CARDS THE SEARCH PAGE RENDERS, because it is the same
          thing. This page used to show a bare column of names — no art, no way
          to ask for any — which meant the one surface whose subject is a PRINT
          RUN was the one surface with no pictures on it. `CardIndex` is that
          rendering now, and the pictures are this set's own printings — as are
          the pages under them; see `printingForSet`.

          WHAT THE PROPS COST, STATED, because the whole set crosses here as
          JSON in an attribute and React escapes every quote in it. Measured:
          the largest set page in this corpus is 273 kB of HTML — props, the
          sixty server-rendered cells, and the noscript list together — against
          a 40 kB median, and about 20 kB over the wire, since a list of cards
          compresses extremely well.

          IT WAS 215 kB BEFORE THE VERSIONS CARRIED THEIR ADDRESSES, measured on
          `main` rather than remembered, because that is exactly the drift the
          paragraph below is about: an href and a label per version is a field
          paid once per card and then escaped. Collapsing rows gave some of it
          back — a three-version name is one set of stats and one face key now
          instead of three — and the net on the largest set is +52 kB, inside
          the ceiling `assertPageBudget` holds by a wide margin.

          It is not left to a comment to stay true. `assertPageBudget` in
          `ssg/build.ts` fails the build over a per-page ceiling, for the reason
          the island budget beside it exists: a page nobody measures is a page
          that can be any size at all, and `assertIslandBudget` weighs only the
          JavaScript. Sending the whole set is deliberate — the pager is client
          side, so page 6 has to be reachable without a request — but "the whole
          set" must stay the set's ROWS and never grow a field per row that only
          one view reads.
        */}
        <Island name="CardList" props={{ entries, subject: set.name }}>
          <CardList entries={entries} subject={set.name} />
        </Island>

        {/*
          WHAT A READER WITH NO SCRIPTING GETS, WRITTEN OUT RATHER THAN LOST.
          The island's server-rendered markup is the first sixty cards; the
          pager that reaches the other 350 is a button, and a button does
          nothing here without JavaScript. So the complete list ships too, as
          the column of names this page was before — the whole set, addressable,
          in the markup.

          It is a `<noscript>` rather than a second visible list because with
          scripting on it would be four hundred duplicate anchors under the
          index, which is worse than useless to a screen reader. Costed on the
          largest set in this corpus: about 25 kB of markup, uncompressed, on a
          page that already carries the index above it.
        */}
        <noscript>
          <h2 className="of-set-noscript__heading">Every card in {set.name}</h2>
          <p className="of-set-noscript__note">
            The index above pages and switches views with JavaScript. This is
            the whole set, in one list — one line per pitch version, where the
            index above draws one row per name.
          </p>
          <ul className="of-set-noscript__list">
            {/* THIS SET'S PRINTINGS, LIKE THE INDEX ABOVE. `card.href` is the
                card's DEFAULT printing, which on a reprint is another set's
                page — so the fallback list for the reader with no scripting
                pointed somewhere else than the list it stands in for. Same
                function, so the two cannot drift. */}
            {listed.map((card) => (
              <li key={card.slug}>
                <a href={printingForSet(card, props.id).href}>{card.label}</a>
              </li>
            ))}
          </ul>
        </noscript>

        {/*
          THE PROVENANCE LINE IS GONE, and it is deleted rather than folded away.

          It repeated, on 112 pages, an envelope the site states elsewhere: the
          upstream repository and the pinned commit are the same two values on
          every set page, and `/about` states them once beside the file path and
          the retrieval address — which is the version of the claim that can
          actually be checked. A repository name and a commit with none of that
          around them are a gesture at auditability rather than the thing
          itself. (Card pages carried the same envelope in a Source fold until
          that fold went for this reason too; `/about` is now the only place it
          is stated.)

          The second sentence went with it for a different reason: "a card is
          listed under every set it was printed in" describes the list directly
          above it, which the list already demonstrates.
        */}
      </>
    ),
  };
}

export const setPage: PageModule<Params, Props> = {
  pattern: "/sets/[code]",
  getStaticPaths,
  page,
};
