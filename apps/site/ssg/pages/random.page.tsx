/**
 * `/random` — one card, chosen without being asked for. Ported.
 *
 * Every reference site has this and Scryfall's is at `/random`, so ours is too.
 * `docs/DESIGN.md` argues a daily puzzle would build a habit better than a
 * random button; that remains true and this is not the puzzle. It is the
 * affordance somebody reaches for when they want to look at a card and have no
 * card in mind, and it costs one page.
 *
 * CHOSEN IN THE BROWSER, because there is no server to choose on. The page ships
 * the name index — the same one the front door uses — and navigates. A
 * build-time choice would be random once per deploy, which is a fixed link
 * wearing a random name.
 */

import { CARD_PAGES, HREF_BY_NAME_SLUG } from "../../src/lib/cards";
import { buildNameIndex } from "../../src/lib/typeahead";
import { Island } from "../Island";
import { RandomCard } from "../islands/RandomCard";
import type { PageModule, PageResult } from "../types";
import "./random.css";

const names = buildNameIndex(CARD_PAGES, HREF_BY_NAME_SLUG);

function page(): PageResult {
  return {
    title: "A random card — Optfall",
    description: "One Flesh and Blood card, chosen at random.",
    islands: true,
    children: (
      <>
        <h1 className="of-random__heading">A random card</h1>

        <Island name="RandomCard" props={{ index: names }}>
          <RandomCard index={names} />
        </Island>

        <noscript>
          <p className="of-random__note">
            Choosing a card at random needs scripting, because Optfall is a
            static site with no server to choose on.{" "}
            <a href="/search">Search the cards</a> instead, or{" "}
            <a href="/sets">browse by set</a>.
          </p>
        </noscript>
      </>
    ),
  };
}

export const randomPage: PageModule = {
  pattern: "/random",
  page,
};
