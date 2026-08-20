/**
 * `/sets` — the browsable spine. Ported to the generator.
 *
 * `docs/SCRYFALL-GAP.md` §2 item 7: "a browsable spine … gives the corpus a
 * shape you can walk without knowing what to type". Search answers a question;
 * this answers "what is there". They are different needs and the field cannot
 * serve the second — an empty search box is a demand, not an invitation.
 *
 * NEWEST FIRST, because somebody opening a set list is far more often looking
 * for what just came out than for what came out in 2019. Undated sets sort last
 * rather than first, which is where an empty string would put them; calling an
 * undated set the oldest is a claim the data does not support.
 *
 * NO SET SYMBOLS, and that is a compliance constraint rather than a stylistic
 * one. `docs/COMPLIANCE.md`: product set logos count as FAB logos, and the
 * policy bars them. Set identity here is typographic — the name, the code and
 * the date — which `docs/DESIGN.md` notes "pushed the design somewhere more
 * original than it would otherwise have gone".
 *
 * THIS IS THE FIRST PORTED PAGE THAT READS THE CORPUS, which is the thing worth
 * proving about it. `/data-terms` and `/syntax` are prose; this one imports
 * `lib/sets.ts` and `lib/cards.ts` and counts over 4,941 cards at build time.
 * Those modules are framework-free and moved across untouched — the import
 * paths are the only thing that changed.
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

import { CORPUS as CARDS, slugify } from "../../src/lib/cards";
import { hrefForSet, SETS_BY_RELEASE } from "../../src/lib/sets";
import type { PageModule, PageResult } from "../types";
import "./sets.css";

/**
 * How many cards each set contains, counted once over the corpus.
 *
 * Counted in CARDS rather than printings, to match what the set page and the
 * search both report — a set listing "412 printings" beside a page showing 380
 * rows is two true numbers arguing.
 *
 * AND COUNTED IN NAMES RATHER THAN PITCH VERSIONS, for that same sentence's
 * reason rather than in spite of it. A set page draws one row per NAME now —
 * Head Jab red, yellow and blue are one cell with three bands — so counting
 * versions here would put "307 cards" beside a page whose own masthead leads
 * with 155, which is the argument this note was written to prevent, arrived at
 * from the other side. `slugify(name)` is the key the set page groups on; using
 * the same function is what keeps the two numbers one number.
 */
const cardsPerSet = new Map<string, Set<string>>();
for (const card of CARDS.cards) {
  for (const printing of card.printings) {
    const seen = cardsPerSet.get(printing.set_id);
    if (seen) seen.add(slugify(card.name));
    else cardsPerSet.set(printing.set_id, new Set([slugify(card.name)]));
  }
}

/** Sets no card in the corpus belongs to are omitted rather than shown empty. */
const listed = SETS_BY_RELEASE.filter(
  (set) => (cardsPerSet.get(set.id)?.size ?? 0) > 0,
);

function page(): PageResult {
  return {
    title: "Sets — Optfall",
    description:
      "Every Flesh and Blood set Optfall carries a card from, newest first, with its release date and the number of cards.",
    section: "sets",
    children: (
      <>
        <h1 className="of-sets__heading">Sets</h1>

        <p className="of-sets__lede">
          {listed.length} sets, newest first. Each links to the cards Optfall
          carries from it.
        </p>

        <ul className="of-sets">
          {listed.map((set) => (
            <li className="of-sets__set" key={set.id}>
              <a className="of-sets__name" href={hrefForSet(set.id)}>
                {set.name}
              </a>
              <span className="of-sets__code">{set.id}</span>
              <span className="of-sets__meta">
                {set.released === null ? (
                  "undated"
                ) : (
                  <time dateTime={set.released}>{set.released}</time>
                )}
                {" · "}
                {(cardsPerSet.get(set.id)?.size ?? 0).toLocaleString("en-GB")}{" "}
                cards
                {set.outOfPrint ? " · out of print" : null}
              </span>
            </li>
          ))}
        </ul>

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
          lede was already honest: it counts `listed`, and has never called
          that number every set.
        */}
      </>
    ),
  };
}

export const setsPage: PageModule = {
  pattern: "/sets",
  page,
};
