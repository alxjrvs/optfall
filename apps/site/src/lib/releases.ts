/**
 * Which sets are RELEASES, as opposed to the decks and armory products that
 * share a shelf with them.
 *
 * THIS WAS `home.page.tsx`'S PRIVATE CONSTANT AND IT IS NOT PRIVATE ANY MORE.
 * The front door needed "the newest three sets" for its `NEW` list; `/search`'s
 * browse state needs "the newest one" for the row of faces it opens on. Two
 * surfaces asking the same question is the moment the answer stops being a
 * page's local business — a second copy of `RELEASE_SIZE` would be a second
 * number to move, and the one that did not move would be the one advertising a
 * demo deck as the newest thing in Flesh and Blood.
 *
 * The reasoning below is the front door's, moved verbatim rather than
 * paraphrased: it is the argument that produced the number, and rewriting it
 * here would be rewriting evidence.
 *
 * BUILD-TIME ONLY. This module reads `./cards`, which reads the 18 MB corpus at
 * module scope. Nothing an island bundle can see may import it as a value —
 * that line is what `build.ts`'s island budget exists to police, and crossing
 * it once shipped a 9.28 MB bundle to every reader.
 */

import { CARD_PAGES } from "./cards";
import { SETS_BY_RELEASE, type SetRecord } from "./sets";

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
export const RELEASE_SIZE = 200;

const PRINTINGS_PER_SET = new Map<string, number>();
for (const page of CARD_PAGES) {
  for (const printing of page.card.printings) {
    const id = printing.set_id.toUpperCase();
    PRINTINGS_PER_SET.set(id, (PRINTINGS_PER_SET.get(id) ?? 0) + 1);
  }
}

/**
 * Every dated set big enough to be a release, newest first.
 *
 * DATED, because `SETS_BY_RELEASE` puts the undated sets last — the judge and
 * organised-play lines — and a set with no date cannot be the newest anything.
 * The order is `SETS_BY_RELEASE`'s, which is total, so two builds cannot
 * disagree about which set is at the front.
 *
 * NOT SLICED HERE. The door takes three and `/search` takes one; a module that
 * decided the count for both would be making a layout decision on behalf of two
 * layouts that do not share one.
 */
export const RECENT_RELEASES: readonly SetRecord[] = SETS_BY_RELEASE.filter(
  (set) =>
    set.released !== null &&
    (PRINTINGS_PER_SET.get(set.id.toUpperCase()) ?? 0) >= RELEASE_SIZE,
);
