/**
 * `/` — the front door. Specified in `docs/SCRYFALL-GAP.md` §6b.
 *
 * IT SHIPS NO JAVASCRIPT AT ALL, and that is the largest change here. The door
 * carried a typeahead island: a live suggestion list that jumped straight to a
 * card. Good feature, wrong page — it made the entrance a disambiguator when
 * its job is to be the way in to the search page, and it cost every visitor the
 * name index before they had typed anything. `SearchField` is a `<form
 * method="get">` with a `name="q"` input, so a plain uncontrolled render of it
 * submits to `/search` with no script involved. `islands` is false and there is
 * no bundle on this page.
 *
 * THE SENTENCE REPLACES THE WORDMARK. A masthead says where you are; a sentence
 * says what the thing does, and the door is the one page where a visitor may
 * not know. The name and the game carry the weight, the rest is quiet.
 *
 * THE `NEW` LIST IS DERIVED, WHICH IS THE WHOLE POINT OF IT. Scryfall
 * hand-maintains its equivalent; ours reads `SETS_BY_RELEASE`, which is sorted
 * by the corpus's own `initial_release_date`, and links each entry to a search
 * that `order:released` can answer. Nothing to curate, nothing to go stale, and
 * a set that ships next month appears here on the next corpus sync with no edit
 * to this file. "Sync, never curate", applied to the surface most tools
 * hand-edit weekly.
 *
 * THE FAN IS THE FLOOR OF THE FIRST SCREEN rather than an ornament in the
 * middle of it — see `home.css`, where the height arithmetic lives.
 *
 * THE SIX ARE NOT A RANDOM SELECTION. THEY ARE THE JOKE. Every name points at
 * the fact that this project is a tonal copy of Scryfall — Homage to Ancestors,
 * Preserve Tradition, Path Well Traveled, Retrace the Past, Light Fingers,
 * Semblance. The build throws if any of them stops resolving to exactly one
 * card, so the row is reviewable rather than incidental.
 */

import { SearchField } from "optfall-components/react";

import { CARD_PAGES } from "../../src/lib/cards";
import { SETS_BY_RELEASE } from "../../src/lib/sets";
import { CardFan, type FanCard } from "../components/CardFan";
import type { PageModule, PageResult } from "../types";
import "./home.css";

const FAN_NAMES = [
  "Homage to Ancestors",
  "Preserve Tradition",
  "Path Well Traveled",
  "Retrace the Past",
  "Light Fingers",
  "Semblance",
] as const;

const fan: readonly FanCard[] = FAN_NAMES.map((name) => {
  const matches = CARD_PAGES.filter((page) => page.card.name === name);
  if (matches.length !== 1) {
    throw new Error(
      `home.page.tsx: "${name}" resolves to ${matches.length} card pages, not 1. The front-door row names its six cards so the page is reviewable; fix the name or replace it rather than letting the row render short.`,
    );
  }

  const page = matches[0];
  if (page === undefined) throw new Error(`home.page.tsx: "${name}" vanished.`);

  /*
    BOTH HALVES, because they are two different absences. `face` is null when the
    page has no printing to show at all; `face.key` is null when there is a
    printing and upstream publishes no image for it. Either one renders a
    placeholder where the front page expects art, so either one is a build
    failure rather than a card quietly missing from the hand.
  */
  if (page.face === null || page.face.key === null) {
    throw new Error(
      `home.page.tsx: "${name}" has no face in the corpus, so the row would render a placeholder on the front page. Replace it with a card that has art.`,
    );
  }

  return {
    slug: page.slug,
    label: page.label,
    /* Nullable upstream — four cards publish no type line, and an alt text
       reading "Semblance — null" is worse than one that is just the name. */
    typeLine: page.card.type_text ?? "",
    faceKey: page.face.key,
  };
});

/**
 * The most recent sets, newest first, as searches rather than as set pages.
 *
 * THREE, DATED, AND BIG ENOUGH TO BE A RELEASE. `SETS_BY_RELEASE` puts the
 * undated sets last — the judge and organised-play lines — so an undated set can
 * never occupy a slot; `RELEASE_SIZE` keeps the decks and armory products out,
 * which is the filter that stopped this list advertising a demo deck as the
 * newest thing in the game.
 *
 * The link is a SEARCH, not `/sets/<code>`: the set page is a description of a
 * set, and somebody clicking `NEW` wants the cards in it. `order:released`
 * keeps a multi-set week in the order the sets actually came out.
 */
/**
 * How many printings a set needs before it counts as a release.
 *
 * MEASURED, NOT GUESSED, and the gap is an order of magnitude so the number is
 * not delicate. The fourteen most recent dated sets in this corpus are either
 * expansions — 272, 482, 681 printings — or decks and armory products: 16, 27,
 * 29, 30, 34, 36, 39, 42, 55. There is nothing between 55 and 272.
 *
 * Without this the door advertised "Armory Deck - Olympia" and "Dorinthea Demo
 * Deck" as the newest things in Flesh and Blood, because they are dated latest.
 * A reader clicking `NEW` wants the set that just came out, not the most
 * recently dated SKU.
 */
const RELEASE_SIZE = 200;

const PRINTINGS_PER_SET = new Map<string, number>();
for (const page of CARD_PAGES) {
  for (const printing of page.card.printings) {
    const id = printing.set_id.toUpperCase();
    PRINTINGS_PER_SET.set(id, (PRINTINGS_PER_SET.get(id) ?? 0) + 1);
  }
}

const RECENT_SETS = SETS_BY_RELEASE.filter(
  (set) =>
    set.released !== null &&
    (PRINTINGS_PER_SET.get(set.id.toUpperCase()) ?? 0) >= RELEASE_SIZE,
).slice(0, 3);

function searchHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

function page(): PageResult {
  return {
    title: "Optfall — Flesh and Blood card search",
    description:
      "Search every Flesh and Blood card. Every card has a permanent, citable URL with its printed text, its printings and its per-format legality — and every legality verdict shows the upstream flags it was derived from.",
    section: "none",
    /*
      WIDE, FOR THE FAN AND NOTHING ELSE. Six cards at a readable size overlap
      to about 855px, and the default `measure` column is 736 — so the last card
      was clipped by the window's own edge, which is the exact defect
      `CardFan.css` warns about arriving from the other direction. The text on
      this page keeps the measure through `.of-door > *`; only the fan is allowed
      out of it.
    */
    width: "wide",
    islands: false,
    children: (
      <div className="of-door">
        <h1 className="of-door__sentence">
          <strong>Optfall</strong> is a powerful{" "}
          <strong>Flesh and Blood</strong> card search
        </h1>

        {/*
          NO ISLAND, AND THEREFORE NO `onValueChange`. Rendered uncontrolled: the
          `value` is the initial value of a plain HTML input, the form is
          `method="get"` with `name="q"`, and submitting navigates to
          `/search?q=…`. There is no React on this page to control it.
        */}
        <SearchField
          label="Search the cards"
          region="Flesh and Blood cards"
          action="/search"
          value=""
          placeholder="command and conquer"
        />

        <nav className="of-door__ways-in" aria-label="Elsewhere in Optfall">
          <a href={searchHref("banned:cc")}>Advanced search</a>
          <a href="/syntax">Syntax</a>
          <a href="/sets">All sets</a>
          <a href="/random">Random card</a>
        </nav>

        <ul className="of-door__new" aria-label="Recent sets">
          {RECENT_SETS.map((set) => (
            <li key={set.id}>
              <a
                href={searchHref(`set:${set.id.toLowerCase()} order:released`)}
              >
                <span className="of-door__badge">New</span>
                {set.name}
              </a>
            </li>
          ))}
        </ul>

        {/*
          NOT ABOUT CARDS, AND THAT IS WHY IT IS HERE. A reference tool a
          community relies on has a front page, and what a front page points at
          is a statement about who it is for.
        */}
        <p className="of-door__cause">
          <a href="https://goodlawproject.org/" rel="noreferrer">
            Help Good Law Project fight for trans rights
          </a>
        </p>

        <CardFan cards={fan} />
      </div>
    ),
  };
}

export const homePage: PageModule = {
  pattern: "/",
  page,
};
