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
 * NO RIGHTS NOTICE IN THE BODY, for the same reason. `CORPUS.rights` closed this
 * page in faint legal type, and `ssg/document.tsx` then emitted the identical
 * paragraph in the footer immediately beneath it — the corpus's own envelope,
 * printed twice, once as content. The provenance paragraphs above stay: those
 * are facts about THIS page's data, computed at build time. The rights notice is
 * a fact about the whole site, and the shell is where the whole site's notices
 * live, because a page has no way to omit what the shell emits.
 */

import rulesJson from "../../../../data/rules/cr-2.14.0.json";

import { buildCardIndex } from "../../src/lib/card-search";
import {
  CARD_PAGES,
  CARD_ROUTES,
  CORPUS,
  LAST_CONFIRMED,
} from "../../src/lib/cards";
import {
  buildKeywordVocabulary,
  keywordCoverage,
} from "../../src/lib/keywords";
import type { RulesCorpus } from "../../src/lib/search";
import { SETS } from "../../src/lib/sets";
import { Island } from "../Island";
import {
  CARDS_HINT_ID,
  CardSearch,
  HEADER_FIELD_ID,
} from "../islands/CardSearch";
import type { PageModule, PageResult } from "../types";
import "./search.css";

/*
 * Built here, once, at build time, from the same shaped pages `/card/<slug>`
 * renders — which is what makes it impossible for a search result and the page
 * it links to to disagree about a slug, a label, a legality verdict or a face.
 * The 16 MB corpus stays on the build machine.
 */
/*
 * THE DATES ARE RESOLVED HERE RATHER THAN INSIDE THE ENGINE, because
 * `card-search.ts` ships to the browser through the island and `sets.ts` loads a
 * corpus. The build knows the answer; the client only needs the 1.2 KB of dates
 * the index encodes. See `CardIndexSource`.
 */
const index = buildCardIndex(CARD_PAGES, {
  commit: CORPUS.source.commit,
  confirmed: LAST_CONFIRMED,
  releasedBySet: new Map(SETS.sets.map((set) => [set.id, set.released])),
});

const cards = CORPUS.counts.cards.toLocaleString("en-GB");
const printings = CORPUS.counts.printings.toLocaleString("en-GB");
/*
 * EVERY ROUTE, NOT EVERY CARD ROUTE — because the sentence this feeds names the
 * printings in the same breath, and "16,502 printings at 5,841 permanent URLs"
 * invites exactly the conclusion that the printings are not addressable.
 */
const permalinks = CARD_ROUTES.length.toLocaleString("en-GB");
const upstream = `https://github.com/${CORPUS.source.repository}`;

/**
 * THE JOIN'S COVERAGE, STATED RATHER THAN IMPLIED. A join that quietly drops
 * what it cannot answer is asserting a completeness it does not have. The number
 * is computed rather than typed, so it cannot rot when either document is
 * re-synced.
 */
const coverage = keywordCoverage(
  buildKeywordVocabulary(rulesJson as unknown as RulesCorpus),
  CORPUS.cards.flatMap((card) =>
    card.card_keywords.concat(card.ability_and_effect_keywords),
  ),
);
const unmatchedList = coverage.unmatched.join(", ");

function page(): PageResult {
  return {
    title: "Search the cards — Optfall",
    description:
      "Lexical search over every Flesh and Blood card. Every card has a permanent, citable URL, with per-format legality and the upstream flags it was derived from.",
    section: "cards",
    headerSearchDescribedBy: CARDS_HINT_ID,
    /*
      THE HEADER'S FIELD IS THIS PAGE'S FIELD. It was suppressed here because
      the page rendered a hero of its own, which made the results screen look
      like a second front door — `docs/SCRYFALL-GAP.md` §5.2 gives the hero to
      the door and the header's field to every other screen. The island adopts
      it; see `HEADER_FIELD_ID` in `CardSearch.tsx`.
    */
    islands: true,
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
          far too late: this page's HTML is 934 kB and its island bundle another
          230, so a reader who searched "banned:cc" on the front door arrived at
          a results page whose SEARCH BOX WAS EMPTY until all of that had landed.
          The results were right and the field looked like it had forgotten the
          question.

          Worse without scripting at all, which this page has a `noscript` block
          precisely because it expects: the box stayed empty for good, and so did
          it after any hydration failure — `islands.client.ts` swallows those and
          keeps the static markup.

          Four lines, inline, running during parse and therefore before the first
          paint. Same trade and same shape as the `?pitch=` redirect in
          `CardEntry`: an island to do this would ship a runtime to beat the
          runtime it is compensating for.

          IT DOES NOT FIGHT THE ISLAND. `CardSearch`'s adoption effect seeds its
          state from whatever is in the field, so this becomes the island's
          starting query rather than something it overwrites.
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

        <Island name="CardSearch" props={{ index, ornament: true }}>
          <CardSearch index={index} ornament />
        </Island>

        {/*
          Degrade visibly, on the surface that serves the data rather than on the
          one that links to it.
        */}
        <p className="of-search-page__provenance">
          {cards} cards and {printings} printings at {permalinks} permanent
          URLs, from <a href={upstream}>{CORPUS.source.repository}</a> at{" "}
          <code>{CORPUS.source.commit}</code>, confirmed {LAST_CONFIRMED}.
          Legality is present day only; the query language says so rather than
          guessing.
        </p>

        <p className="of-search-page__provenance">
          Card keywords are matched to the Comprehensive Rules section that
          defines each one, and every card page cites the rules that govern it.
          Coverage is <strong>{coverage.percent}%</strong> —{" "}
          {coverage.direct + coverage.viaFamily} of {coverage.baseForms}{" "}
          distinct keywords, {coverage.direct} matched directly and{" "}
          {coverage.viaFamily} through a rule the document parameterises. The{" "}
          {coverage.unmatched.length} it cannot resolve are named rather than
          hidden: {unmatchedList}. A keyword the rules do not define carries no
          citation instead of a guessed one.
        </p>
      </>
    ),
  };
}

export const searchPage: PageModule = {
  pattern: "/search",
  page,
};
