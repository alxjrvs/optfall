/**
 * `/sets` — the browsable spine.
 *
 * `docs/SCRYFALL-GAP.md` §2 item 7: "a browsable spine … gives the corpus a
 * shape you can walk without knowing what to type". Search answers a question;
 * this answers "what is there". They are different needs and the field cannot
 * serve the second — an empty search box is a demand, not an invitation.
 *
 * AND FOR A HUNDRED AND TWELVE SETS THAT WAS NOT ENOUGH, WHICH IS WHAT CHANGED.
 * The spine was a flat column of near-identical hairlines with no way in but
 * the browser's own find; a reader after the Armory Decks scrolled past sixteen
 * of them scattered over three years. The list is an island now — see
 * `islands/SetIndex.tsx` for what the filters are permitted to be, which is the
 * whole design question — and it is grouped into release years, which gives a
 * hundred rows a spine of their own.
 *
 * WHAT THIS FILE STILL OWNS is the data. Every figure the island draws is
 * computed here, at build time, from the corpus: the island receives an array
 * of flat records as JSON and never imports `cards.ts`. That division is not
 * stylistic — `Island` documents it — the 16 MB corpus stays on the build
 * machine and about 34 kB of derived facts cross to the browser.
 *
 * NEWEST FIRST, because somebody opening a set list is far more often looking
 * for what just came out than for what came out in 2019. Undated sets sort last
 * rather than first, which is where an empty string would put them; calling an
 * undated set the oldest is a claim the data does not support. That order is
 * `SETS_BY_RELEASE`'s, and the island's two date orders are both derived from
 * it rather than re-sorted — see the note there.
 *
 * NO SET SYMBOLS, and that is a compliance constraint rather than a stylistic
 * one. `docs/COMPLIANCE.md`: product set logos count as FAB logos, and the
 * policy bars them. Set identity here was purely typographic — the name, the
 * code and the date — which `docs/DESIGN.md` notes "pushed the design somewhere
 * more original than it would otherwise have gone", and the rarity bar under
 * each row is where that push arrived: a per-set mark DERIVED from the corpus,
 * which is the only kind this project may draw, and which carries information a
 * logo never did.
 *
 * NO RIGHTS NOTICE IN THE BODY. This page used to end on `SETS.rights`, in the
 * same faint legal type the footer sets three paragraphs of a few hundred pixels
 * below it: a rights notice stated twice on one screen, once where it reads as
 * content and once where it reads as chrome. The shell's copy is the one a page
 * cannot omit, so the shell's is the one that stays.
 *
 * WHAT THE SHELL CARRIES IS NOT THIS STRING, and that is worth stating exactly
 * rather than waving at, because `SETS.rights` is now rendered on no page of the
 * site. The footer emits `CORPUS.rights` — the CARD corpus's envelope — plus
 * `CARD_IMAGE_COPYRIGHT` and `LSS_DISCLAIMER`. Both of the sets envelope's
 * claims survive that, in other words: `LSS_DISCLAIMER` names set names as LSS
 * trademarks in its own sentence, and `CORPUS.rights` licenses "Optfall's
 * structural work over the dataset", which is the same claim `SETS.rights` made
 * about "this data". Nothing this page asserted stopped being asserted; it is
 * asserted by a different string, which is what a future audit needs to know.
 */

import { SET_PROFILES } from "../../src/lib/set-profiles";
import { hrefForSet, SETS_BY_RELEASE } from "../../src/lib/sets";
import { Island } from "../Island";
import { type SetIndexEntry, SetIndex } from "../islands/SetIndex";
import type { PageModule, PageResult } from "../types";
import "./sets.css";

/**
 * Every set the corpus carries a card from, newest first, with its figures.
 *
 * SETS NO CARD BELONGS TO ARE OMITTED RATHER THAN SHOWN EMPTY, which is the
 * rule the set pages follow too: "a page listing nothing is a 404 that
 * renders", and upstream publishes several sets with no cards in this corpus.
 * `SET_PROFILES` has an entry only for a set with printings, so the presence of
 * a profile IS that filter — there is no second condition to keep in step.
 *
 * COUNTED IN NAMES RATHER THAN PITCH VERSIONS, and the reason is that the set
 * page counts the same way. A set page draws one row per NAME — Head Jab red,
 * yellow and blue are one cell with three bands — so a list saying "307 cards"
 * beside a page whose own masthead leads with 155 would be two true numbers
 * arguing. `set-profiles.ts` carries all three counts under their own names for
 * exactly this reason; this list prints the one the set page leads with.
 */
const entries: readonly SetIndexEntry[] = SETS_BY_RELEASE.flatMap((set) => {
  const profile = SET_PROFILES.get(set.id);
  if (profile === undefined) return [];

  return [
    {
      id: set.id,
      name: set.name,
      href: hrefForSet(set.id),
      released: set.released,
      outOfPrint: set.outOfPrint,
      names: profile.names,
      exclusive: profile.exclusive,
      rarities: profile.rarities,
    },
  ];
});

function page(): PageResult {
  return {
    title: "Sets — Optfall",
    description:
      "Every Flesh and Blood set Optfall carries a card from, newest first, with its release date, its size and the rarity mix of its print run.",
    section: "sets",
    /*
      THE FIRST PAGE OF THE LIST IS THE WHOLE LIST, because `Island` renders its
      child on the server. What the script adds is the field, the two selects
      and the era grouping's response to them; what it does not add is the sets.
    */
    islands: true,
    children: (
      <>
        <h1 className="of-sets__heading">Sets</h1>

        {/*
          THE WHOLE LIST CROSSES AS PROPS, and what that costs is worth stating
          because the same paragraph on `set.page.tsx` exists for a page that
          got it wrong once. 112 records of a code, a name, a date, two counts
          and a handful of rarity slices is 34 kB of JSON in an attribute,
          against a 512 kB per-page ceiling `assertPageBudget` fails the build
          over. There is no pager here — a set list is not long enough to want
          one — so every row has to be present for the filter to reach it.
        */}
        <Island name="SetIndex" props={{ entries }}>
          <SetIndex entries={entries} />
        </Island>

        {/*
          THE PROVENANCE LINE IS GONE, and this is the last page that carried
          one. Card pages dropped their Source fold, set pages deleted the same
          paragraph across 112 of them, and `/search` removed both of its
          build-metadata paragraphs — each on the one argument, which applies
          here unchanged: a repository name and a forty-character commit with
          nothing around them are a gesture at auditability rather than the
          thing itself. `/about` states this exact envelope once, as a row in
          `SOURCES` — "Four more files from the same compilation, at the same
          commit", linked to the tree at that commit beside the file names —
          which is the version of the claim a reader can actually check.

          THE SECOND SENTENCE IS THE ONE THAT COST SOMETHING, and it is worth
          being exact about where it went. "N further sets carry no card here
          and are not listed" was the page's only disclosure that it filters,
          and no other surface repeats it. What replaced it is the meta
          description, which used to promise "Every Flesh and Blood set" and
          now promises every set Optfall carries a card from — the sentence was
          correcting an overclaim made two lines above it, so correcting the
          overclaim directly is the smaller page and the same disclosure. The
          COUNT the island prints is honest in the same way: it counts what is
          listed, and has never called that number every set.
        */}
      </>
    ),
  };
}

export const setsPage: PageModule = {
  pattern: "/sets",
  page,
};
