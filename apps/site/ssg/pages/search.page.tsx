/**
 * `/search` — and `/search?q=banned:cc`, which is the same page with an answer
 * on it. **The room the front door opens onto.** Ported.
 *
 * IT IS AT `/search` BECAUSE THAT IS WHERE PEOPLE LOOK. Scryfall's results live
 * at `/search?q=`, and `docs/DESIGN.md` settled that the grammar is inherited
 * rather than invented — "people arrive already fluent". The address is part of
 * the grammar.
 *
 * THE SPLIT FROM `/` IS UNCHANGED. The door takes a name and sends you
 * somewhere; this page renders the answer. The door ships names, slugs and
 * pitches; this ships the full index — inverted postings over printed text,
 * keyword and trait memberships, per-format verdict vectors. Somebody looking up
 * "head jab" never downloads the machinery.
 *
 * THE `<h1>` IS HIDDEN, NOT ABSENT, AND IT USED TO BE ABSENT FOR A REASON THAT
 * EXPIRED. It read "Search the cards" at display size, and the argument for
 * deleting it was that the field's own VISIBLE `<label>` said the same words
 * immediately beneath it — four statements of one fact, and the display-sized
 * one cost the most fold on the page that can least afford it.
 *
 * That label moved into the header when the field did, where it is clipped to a
 * pixel (`.of-bar__sr`). So the page briefly had no heading at all: the first
 * thing in `<main>` was the operator hint, and a screen reader's heading list
 * for the site's busiest surface was empty. The fold argument still holds, so
 * the heading is back at the same visual weight it had — none — and present in
 * the document where it belongs.
 *
 * NO RIGHTS NOTICE IN THE BODY. `CORPUS.rights` closed this page in faint legal
 * type, and `ssg/document.tsx` then emitted the identical paragraph in the
 * footer immediately beneath it — the corpus's own envelope, printed twice, once
 * as content. The rights notice is a fact about the whole site, and the shell is
 * where the whole site's notices live, because a page has no way to omit what
 * the shell emits.
 *
 * AND NO PROVENANCE PARAGRAPHS EITHER, WHICH IS A REVERSAL AND IS WORTH SAYING
 * SO. The note here used to argue they stayed — "facts about THIS page's data,
 * computed at build time" — and `docs/SCRYFALL-GAP.md` §"Deletions first" is
 * more explicit still: "The provenance and rights lines stay — 'degrade
 * visibly' is not negotiable — but they belong under the results".
 *
 * WHAT CHANGED IS THAT THEY WERE NOT UNDER THE RESULTS, THEY WERE UNDER SIXTY
 * OF THEM. This page paginates now, so the two paragraphs sat at the foot of a
 * grid the reader scrolls past rather than reads to the end of — nine lines of
 * build metadata and a list of eight unresolvable keywords, addressed to
 * somebody who came here to look up a card. That is not degrading visibly, it is
 * filing the disclosure where it will not be read.
 *
 * NOTHING IS UNSAID AS A RESULT, WHICH IS THE CONDITION FOR REMOVING THEM.
 * The corpus's pin — count, commit, last-confirmed date — is printed by
 * `CardSearch`'s own empty state, which is what this page shows before it is
 * asked anything, so it is the first thing a reader sees rather than the last.
 * "Legality is present day only" is said by the query engine itself, at the
 * moment it matters, as the notice `legal:cc@2024-01-01` returns. The keyword
 * coverage figure and the eight it cannot resolve are on `/about`, beside the
 * rest of the method, along with the upstream link and the pinned commit. Every
 * claim keeps a surface; each one moved to the surface that is about it.
 */

import { Island } from "../Island";
import { CardSearch } from "../islands/CardSearch";
import { HEADER_FIELD_ID } from "../islands/HeaderSearch";
import { CARD_BRIEF, CARD_INDEX, CARD_NEWEST } from "../searchIndexes";
import type { PageModule, PageResult } from "../types";
import "./search.css";

/**
 * WHAT THE ISLAND IS HANDED, AND IT IS NO LONGER THE INDEX.
 *
 * ~~Built here, once, at build time~~ — **the index is built in
 * `ssg/searchIndexes.ts` now, and this page links its address rather than
 * carrying its bytes.** Nothing about the construction moved except its
 * location: it is still made from the same shaped pages `/card/<slug>` renders,
 * which is what makes it impossible for a search result and the page it links to
 * to disagree about a slug, a label, a legality verdict or a face.
 * The 18 MB corpus still stays on the build machine.
 *
 * WHAT MOVED IS WHERE THE 909,626 BYTES GO. They were inside this page, in a
 * `data-props` attribute — the single largest document on the site, at 921 kB,
 * with its own entry in `build.ts`'s budget exceptions to say so. They are now a
 * content-hashed file, fetched by the island when there is a query to answer.
 * `ssg/searchIndexes.ts` carries the argument for the change.
 *
 * THE PIN STAYS IN THE PAGE, and that is the part that could not simply be
 * deleted. `docs/PLAN.md` requires every surface to show when its data was last
 * confirmed, and the card count, the upstream commit and the confirmation date
 * are how `/search` does it. They ride in `CARD_BRIEF` — 805 bytes, rendered
 * with no fetch — because a provenance line that appears only once a request
 * succeeds is absent exactly when something has gone wrong.
 */
const islandProps = {
  indexUrl: CARD_INDEX.url,
  brief: CARD_BRIEF,
  /*
    THE ROW OF FACES THE BROWSE STATE OPENS ON, and it rides in the page for
    the same reason the pin does: it has to render with no fetch. Six cards'
    worth of slug, address, label, type line and blob key — under a kilobyte
    against a document held to 512 — so the state a reader arrives on has
    pictures in it before the index has been asked for.

    `null` WHERE THE CORPUS HAS NO RELEASE TO SHOW, which `searchIndexes.ts`
    argues is a state rather than a defect. The island renders its type lines
    and no strip.

    THIS IS ALSO WHERE THE TWO DECLARATIONS OF EACH SHAPE MEET. `CardSearch`
    cannot import `searchIndexes.ts` — that module reads the 18 MB corpus at
    module scope and this island's bundle would carry it — so `CardCorpusBrief`
    and `NewestRelease` are each spelled twice, and this assignment is the one
    place a compiler sees both spellings at once.
  */
  newest: CARD_NEWEST,
};

function page(): PageResult {
  return {
    title: "Search the cards — Optfall",
    description:
      "Lexical search over every Flesh and Blood card. Every card has a permanent, citable URL, with per-format legality and the upstream flags it was derived from.",
    section: "cards",
    /*
      THE COLUMN IS THE GRID'S, NOT PROSE'S. This page's content is a list of
      card faces; at the reading measure the grid fitted its four columns only by
      drawing every card at 180px, which is a contact sheet rather than a list of
      cards. `index` is four cells and the gutters between them — see
      `layout.page.index`. The one paragraph left on the page, the empty state,
      is short enough not to mind the extra width.
    */
    width: "index",
    /*
      THE HEADER'S FIELD IS THIS PAGE'S FIELD. It was suppressed here because
      the page rendered a hero of its own, which made the results screen look
      like a second front door — `docs/SCRYFALL-GAP.md` §5.2 gives the hero to
      the door and the header's field to every other screen. The field is its
      own island here — see `headerSearchIsland` below and
      `islands/HeaderSearch.tsx` — so a submit is answered in place.
    */
    islands: true,
    /* The header's field is hydrated here, so Enter is answered without
       leaving the page. `types.ts` explains why one page and not all of them. */
    headerSearchIsland: true,
    children: (
      <>
        {/*
          THE PAGE'S HEADING, CARRIED BY THE DOCUMENT AND NOT BY THE LAYOUT.
          See the note at the top of this file: it is hidden rather than absent,
          because the fold argument that deleted it still holds and the reason
          it was safe to delete — a visible label saying the same words — left
          with the field.
        */}
        <h1 className="of-search-page__heading">Search the cards</h1>

        {/*
          THE FIELD SHOWS THE QUERY BEFORE ANY BUNDLE LOADS, and until this
          existed it did not.

          The header's input is in the shell, which is one document serving
          every query — so it cannot be server-rendered with a value the way
          Scryfall's is. The island filled it in an effect, which is correct and
          far too late: this page's HTML was 934 kB and its island bundle
          another 230, so a reader who searched "banned:cc" on the front door
          arrived at a results page whose SEARCH BOX WAS EMPTY until all of that
          had landed. The results were right and the field looked like it had
          forgotten the question.

          THE NUMBERS THAT MADE IT URGENT ARE GONE AND THE SCRIPT IS NOT. The
          index moved out of this page, so the HTML is 11 kB — but the bundle is
          still ~280 kB and still has to parse and hydrate before the field can
          be filled from state. Four lines that beat it are worth keeping at any
          document size; they are simply no longer beating an emergency.

          IT DOES NOT FIX THE NO-JS CASE, AND CANNOT: an inline script is still
          a script. With scripting off the box stays empty — though so do the
          results, which is what the `noscript` block below is for, so the field
          is not the thing that has failed there.

          What it DOES cover besides the slow bundle is a hydration FAILURE:
          `islands.client.ts` swallows those and keeps the static markup, and
          this has already run by then, so the field still says what was asked.

          Four lines, inline, running during parse and therefore before the first
          paint. Same trade and same shape as the `?pitch=` redirect in
          `CardEntry`: an island to do this would ship a runtime to beat the
          runtime it is compensating for.

          IT DOES NOT FIGHT THE ISLAND, and the mechanism moved without the
          guarantee changing. `HeaderSearch` renders this field now, and its
          mount effect seeds the shared store from whatever is already in it —
          so a value written here becomes the island's starting query rather
          than something it overwrites. React's own hydration protects the text
          itself: its DOM host skips the value assignment while hydrating an
          input it renders, so the string survives the handover.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `{
  const asked = new URLSearchParams(window.location.search).get("q");
  const field = document.getElementById(${JSON.stringify(HEADER_FIELD_ID)});
  if (asked !== null && field !== null) field.value = asked;
}`,
          }}
        />

        {/*
          THIS IS THE PAGE THE NO-JS FAILURE LANDS ON. The form submits here, so
          a reader with scripting off arrives at `/search?q=…` with a query in
          the address bar and no machinery on the page able to answer it.
          Without this block that reads as an empty field and nothing else — a
          silent failure, which is the one shape "degrade visibly" forbids.
        */}
        <noscript>
          {/*
            THE SCHEME IS WORTH SPELLING OUT HERE SPECIFICALLY. This paragraph
            is read by somebody who cannot search, so "type the URL" is the only
            route they have left — and the URL is now derivable from the card in
            their hand, which is the one thing the old `/card/<slug>` form could
            never offer. Set code and collector number are printed on every
            Flesh and Blood card.

            The name is still named as a way in, because it still works: it is a
            redirect rather than a page, and a reader does not need to be told
            the difference to use it.
          */}
          <p className="of-search-page__noscript">
            Live results need JavaScript. Every printing is addressable without
            it: <code>/card/mst/131/10-000-year-reunion</code> is the set code
            and collector number printed on the card, then its name. Typing a
            name alone — <code>/card/head-jab</code> — still finds the card, at
            its first printing, with its pitch versions as tabs.
          </p>
        </noscript>

        <Island name="CardSearch" props={islandProps}>
          <CardSearch {...islandProps} />
        </Island>
      </>
    ),
  };
}

export const searchPage: PageModule = {
  pattern: "/search",
  page,
};
