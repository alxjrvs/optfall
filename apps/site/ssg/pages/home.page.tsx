/**
 * `/` — the front door. Ported.
 *
 * ONE BOX, ONE DOMINANT SURFACE. `docs/DESIGN.md`: no marketing hero, no
 * illustration above the fold — the first thing on the page is the thing you
 * came to do. The wordmark's only job is to say where you are.
 *
 * THE MARK IS PART OF THE NAME HERE, not an illustration above it, and that
 * distinction is the whole reason it is allowed on this page: a mark set beside
 * the word at the word's own size is a masthead, while the same mark given its
 * own line above the word is the hero the door refuses. It is `lg` — one step up
 * from the header bar's `sm`, because this is the only page where the wordmark
 * is the masthead rather than a way home — and decorative, since the `<h1>`
 * beside it already carries the name.
 *
 * AND IT IS THE CANONICAL PITCH VARIANT, which the header bar's is not. This is
 * the one surface where the mark is identity rather than chrome, so it is the
 * one that spends the three-value palette.
 *
 * THE ROW IS NOT AN ISLAND. `CardFan` is rendered as ordinary markup, so the row
 * costs the page six images and no JavaScript at all — hovering pops a card
 * forward in CSS. Only the typeahead hydrates.
 *
 * THE SIX ARE NOT A RANDOM SELECTION. THEY ARE THE JOKE. Every name points at
 * the fact that this project is a tonal copy of Scryfall — Homage to Ancestors,
 * Preserve Tradition, Path Well Traveled, Retrace the Past, Light Fingers,
 * Semblance. The build throws if any of them stops resolving to exactly one
 * card, so the row is reviewable rather than incidental.
 */

import { Mark } from "optfall-components/react";

import { CARD_PAGES } from "../../src/lib/cards";
import { buildNameIndex } from "../../src/lib/typeahead";
import { CardFan, type FanCard } from "../components/CardFan";
import { Island } from "../Island";
import { CardTypeahead } from "../islands/CardTypeahead";
import type { PageModule, PageResult } from "../types";
import "./home.css";

const names = buildNameIndex(CARD_PAGES);

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

const cards = CARD_PAGES.length.toLocaleString("en-GB");

function page(): PageResult {
  return {
    title: "Optfall — Flesh and Blood card search",
    description:
      "Search every Flesh and Blood card. Every card has a permanent, citable URL with its printed text, its printings and its per-format legality — and every legality verdict shows the upstream flags it was derived from.",
    section: "none",
    islands: true,
    children: (
      <div className="of-door">
        <h1 className="of-door__wordmark">
          {/*
            Decorative because the heading it sits in already carries the name —
            a named mark would make the page's one heading announce itself twice.
          */}
          <Mark size="lg" decorative />
          Optfall
        </h1>

        <noscript>
          <p className="of-door__noscript">
            Live results need JavaScript. Every card is addressable without it:{" "}
            <code>/card/command-and-conquer</code> is that card, and a name
            shared by several cards — <code>/card/head-jab</code> — is that card
            too, with its pitch versions as tabs.
          </p>
        </noscript>

        <Island
          name="CardTypeahead"
          props={{ index: names, action: "/search" }}
        >
          <CardTypeahead index={names} action="/search" />
        </Island>

        {/*
          Four links, each going somewhere that ANSWERS a question rather than
          describing the answer. The five paragraphs of "what this is" that used
          to sit here were the page explaining itself to somebody who had already
          arrived.
        */}
        <nav className="of-door__ways-in" aria-label="Elsewhere in Optfall">
          <a href="/search">Browse all {cards} cards</a>
          <a href="/sets">Browse by set</a>
          <a href="/cr">Search the rules</a>
          <a href="/card/winters-wail">A card that is two things at once</a>
          <a href="/cr/8.3.4b">A rules permalink</a>
        </nav>

        {/*
          BELOW THE FIELD AND BELOW THE LINKS, in the empty half of the screen
          the door already had.
        */}
        <CardFan cards={fan} />
      </div>
    ),
  };
}

export const homePage: PageModule = {
  pattern: "/",
  page,
};
