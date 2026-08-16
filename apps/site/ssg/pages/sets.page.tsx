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
 */

import { CORPUS as CARDS, slugify } from "../../src/lib/cards";
import { hrefForSet, SETS, SETS_BY_RELEASE } from "../../src/lib/sets";
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
      "Every Flesh and Blood set, newest first, with its release date and the number of cards Optfall carries from it.",
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

        <p className="of-sets__provenance">
          From{" "}
          <a href={`https://github.com/${SETS.source.repository}`}>
            {SETS.source.repository}
          </a>{" "}
          at <code>{SETS.source.commit}</code>, the same snapshot as the cards.{" "}
          {SETS.counts.sets - listed.length} further sets carry no card here and
          are not listed.
        </p>

        <p className="of-sets__legal">{SETS.rights}</p>
      </>
    ),
  };
}

export const setsPage: PageModule = {
  pattern: "/sets",
  page,
};
