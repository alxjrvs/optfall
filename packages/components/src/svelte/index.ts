/**
 * The Svelte primitives.
 *
 * Deliberately a SEPARATE entry point from `optfall-components`, which exports
 * the prop contracts, the compliance constants and the primitive list as plain
 * TypeScript. The split is what lets another Flesh and Blood tool depend on the
 * contracts — or on {@link CARD_IMAGE_COPYRIGHT} — without taking a Svelte
 * toolchain with them, which matters because `docs/PLAN.md` stakes the
 * accessibility promise on other tools being able to adopt this work at zero
 * risk to their own stack.
 *
 * The same sources also compile to custom elements, so the accessible pitch
 * jewel can be dropped into a React or vanilla page by someone who will never
 * write a line of Svelte. That is the only mechanism by which the accessibility
 * work here reaches past our own edges.
 *
 * @packageDocumentation
 */

export { default as PitchJewel } from "./PitchJewel.svelte";
export { default as BevelledPlate } from "./BevelledPlate.svelte";
export { default as StatePill } from "./StatePill.svelte";
export { default as BrassSeal } from "./BrassSeal.svelte";
export { default as Citation } from "./Citation.svelte";
export { default as FiligreeCorner } from "./FiligreeCorner.svelte";
export { default as OrnamentalRule } from "./OrnamentalRule.svelte";
export { default as Mark } from "./Mark.svelte";
export { default as CardFace } from "./CardFace.svelte";
export { default as CardFaceGroup } from "./CardFaceGroup.svelte";
export { default as SearchField } from "./SearchField.svelte";
export { default as ResultRow } from "./ResultRow.svelte";
export { default as StatGlyph } from "./StatGlyph.svelte";
export { default as GameSymbol } from "./GameSymbol.svelte";
