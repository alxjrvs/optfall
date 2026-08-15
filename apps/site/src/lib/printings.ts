/**
 * A card's faces, and the collector number that addresses one.
 *
 * WHY THIS IS ITS OWN MODULE, AND IT IS NOT ABOUT TIDINESS. Both functions here
 * lived in `cards.ts`, which imports the 16 MB card corpus and derives
 * `CARD_PAGES` and `CARD_ROUTES` at module scope. `card-search.ts` imported them
 * from there, `CardSearch.tsx` imports `card-search.ts`, and the island bundle
 * imports `CardSearch.tsx` — so the whole corpus was reachable from the client
 * entry and Rollup bundled it. **The shipped island bundle was 9.28 MB**, of
 * which roughly 9.2 MB was the card corpus, sent to every reader who opened a
 * page with an island on it.
 *
 * Nothing caught it. The build reported success, all 13,675 pages rendered, the
 * islands hydrated, and every compliance check passed — a bundle nobody measures
 * is a bundle that can be any size at all. **`assertIslandBudget` in
 * `ssg/build.ts` measures it now**, and fails the build over a ceiling.
 *
 * These two functions are pure over their arguments and touch no corpus, so the
 * fix is to put them where importing them does not drag one in. `cards.ts`
 * re-exports both, so every existing caller is unchanged; what changed is that
 * `card-search.ts` reaches them WITHOUT reaching the corpus.
 *
 * The rule this leaves behind: **anything imported by an island must not import
 * `cards.ts`.** The corpus belongs to the build. What the client gets is the
 * encoded index a page hands it, which is the entire point of `buildCardIndex`.
 */

import { faceKeyFor } from "./faces";
/*
 * TYPE-ONLY, AND THAT IS WHAT KEEPS THIS MODULE CLEAN. `verbatimModuleSyntax`
 * erases an `import type` entirely, so this names the corpus's shapes without
 * creating any runtime edge to the module that loads it — which is the whole
 * property this file exists to have. It reads as a cycle and compiles to
 * nothing.
 */
import type { Card, CardPrinting } from "./cards";

/**
 * One addressable printing of a card: a distinct FACE, and where it lives.
 *
 * `docs/SCRYFALL-GAP.md` §5.1c: "Scryfall treats the printing as the
 * addressable unit; so should we." This is that unit.
 *
 * IT IS A FACE, NOT A PRINTING ROW, and the difference is 5,124 of them. The
 * corpus carries 16,502 printing rows and only 11,376 distinct arts, because a
 * card printed Regular / Rainbow Foil / Cold Foil in one set is three rows
 * sharing one image. Giving each row its own URL would mint three addresses
 * that render the identical page — the definition of a duplicate — so the unit
 * is the art, and the rows that share it share its address.
 */
export interface PrintingRef {
  /** The face key, `MST131.webp`. Unique per distinct image. */
  readonly key: string;
  /** Set code, lowercased: the second path segment. */
  readonly setCode: string;
  /** The disambiguated collector number: the third. See {@link numberFor}. */
  readonly number: string;
  /** The printing row this face was first reached by. */
  readonly printing: CardPrinting;
}

/**
 * The third path segment of a printing URL, derived from the face key.
 *
 * THE COLLECTOR NUMBER ALONE CANNOT NAME AN ART. A set's number is shared by
 * every art of that card, so the segment is the face key with the set prefix
 * removed and the remainder collapsed to a URL alphabet: `MST095-MV.webp` under
 * `MST` becomes `095-mv`.
 *
 * Collapsing the alphabet can in principle make two keys agree; the collision
 * check where routes are assembled is what turns that from a silent overwrite
 * into a failed build.
 */
export function numberFor(key: string, setCode: string): string {
  const stem = key.replace(/\.webp$/, "");
  const prefix = setCode.toUpperCase();
  const bare = stem.toUpperCase().startsWith(prefix)
    ? stem.slice(prefix.length)
    : stem;
  return bare
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A card's distinct faces, in corpus order, each with its address.
 *
 * SHARED WITH THE PICKER ON PURPOSE. `CardEntry` used to derive this list
 * itself, and while it was the only consumer that was fine. It is not the only
 * consumer now: the routes emit a URL per entry, and a picker working from a
 * different list than the router would show a printing with no address or mint
 * an address for a printing that is not shown. One function, so the two cannot
 * disagree.
 */
export function facesOf(card: Card): readonly PrintingRef[] {
  const seen = new Set<string>();
  const faces: PrintingRef[] = [];

  for (const printing of card.printings) {
    const key = faceKeyFor(printing.image_url);
    if (key === null || seen.has(key)) continue;
    seen.add(key);
    faces.push({
      key,
      setCode: printing.set_id.toLowerCase(),
      number: numberFor(key, printing.set_id),
      printing,
    });
  }

  return faces;
}
