/**
 * The React primitives — `optfall-components/react`.
 *
 * A SECOND ENTRY POINT RATHER THAN A REPLACEMENT, for as long as both
 * renderers exist. `docs/PLAN.md` Phase 6 ports the library one component at a
 * time while Astro keeps building the site, so `optfall-components/svelte` has
 * to keep working untouched throughout. Two entries make that a fact about the
 * package rather than a promise: nothing here is reachable from the Svelte
 * entry, and vice versa.
 *
 * Both import their shared vocabulary — `CARD_IMAGE_COPYRIGHT`, the geometry,
 * the types — from `../index`, which is framework-free and stays that way.
 * That is what keeps the two ports from drifting on the things that actually
 * matter: there is one copyright string, not two.
 *
 * THE COMPLIANCE PAIR WAS PORTED FIRST AND ALONE, because they are the only
 * two whose failure is silent: every other primitive in this library is wrong
 * in a way you can see. The rest follow here.
 */

export { BevelledPlate, type BevelledPlateProps } from "./BevelledPlate";
export { CardFace, type CardFaceProps } from "./CardFace";
export { CardFaceGroup, type CardFaceGroupProps } from "./CardFaceGroup";
export { OrnamentalRule, type OrnamentalRuleProps } from "./OrnamentalRule";
export { PitchJewel, type PitchJewelProps } from "./PitchJewel";
export { ResultRow, type ResultRowProps } from "./ResultRow";
