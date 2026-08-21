/**
 * The React primitives — `optfall-components/react`.
 *
 * THE ONLY ENTRY POINT NOW, and a second one when it was written. Phase 6
 * ported the library one component at a time while Astro was still building
 * the site, so `optfall-components/svelte` had to keep working untouched
 * throughout; two entries made that a fact about the package rather than a
 * promise, since nothing here was reachable from the Svelte entry or vice
 * versa. Layer 5 deleted the Svelte sources and `package.json` now exports
 * `.` and `./react` only.
 *
 * The subpath is kept rather than flattened into `.`. `../index` is the
 * framework-free contract layer — `CARD_IMAGE_COPYRIGHT`, the geometry, the
 * types — and the split is what keeps a renderer's concerns out of it. That
 * was what stopped two ports drifting on the things that actually matter (one
 * copyright string, not two; one `MARK_GEOMETRY`), and it is what would keep a
 * third from drifting if one ever arrived.
 *
 * THE COMPLIANCE PAIR WAS PORTED FIRST AND ALONE, because they are the only
 * two whose failure is silent: every other primitive in this library is wrong
 * in a way you can see. The rest followed.
 *
 * ALL OF THEM ARE HERE NOW, and `parity.test.ts` checks the list against
 * `PRIMITIVES` in `../index` rather than against a second implementation — a
 * port that forgets a component is a port that looks finished.
 *
 * NO COUNT IS SPELLED IN THIS PROSE, and that is a correction rather than a
 * style. It read "all fourteen" while the list below held fifteen, which is the
 * failure `CLAUDE.md` names outright when it says to cite `PRIMITIVES.length`
 * rather than write the number down: a count in a comment is a claim that ages
 * every time somebody does the thing this file exists to make easy.
 *
 * TWO ARRIVED AFTER THE PORT, by the same route and for the same reason.
 * `Pagination` is what `docs/SCRYFALL-GAP.md` §4 asked for when it called the
 * hard 60-result cap "a refusal where Scryfall paginates". `IconButton` is what
 * the card page's purchase links asked for once they were wanted under the face
 * AND in the buy table. Both are the library's rule working: a screen needing
 * new CSS is a signal a primitive is missing rather than a licence to write it
 * in the page.
 */

export { BevelledPlate, type BevelledPlateProps } from "./BevelledPlate";
export { BrassSeal, type BrassSealProps } from "./BrassSeal";
export { CardFace, type CardFaceProps } from "./CardFace";
export { Citation, type CitationProps } from "./Citation";
export { FiligreeCorner, type FiligreeCornerProps } from "./FiligreeCorner";
export { GameSymbol, type GameSymbolProps } from "./GameSymbol";
export { IconButton, type IconButtonProps } from "./IconButton";
export { Mark, type MarkProps } from "./Mark";
export { OrnamentalRule, type OrnamentalRuleProps } from "./OrnamentalRule";
export { Pagination, type PaginationProps } from "./Pagination";
export { PitchBox, type PitchBoxProps } from "./PitchBox";
export { PitchJewel, type PitchJewelProps } from "./PitchJewel";
export { PitchRule, type PitchRuleProps } from "./PitchRule";
export { ResultRow, type ResultRowProps } from "./ResultRow";
export { SearchField, type SearchFieldProps } from "./SearchField";
export { StatePill, type StatePillProps } from "./StatePill";
export { StatGlyph, type StatGlyphProps } from "./StatGlyph";
