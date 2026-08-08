/**
 * `optfall-components` — the component library, and the contracts its
 * primitives are built against.
 *
 * The Svelte sources land in Phase 1 of the build plan, each one built in
 * Storybook, in both themes, before it appears on a product surface. What lives
 * here today is the part that has to be settled *before* anyone writes markup:
 * the prop contracts, and the two compliance obligations that are properties of
 * a component rather than of a page.
 *
 * Two rules govern everything added here:
 *
 * - **Compose, never restyle.** A screen that needs new CSS is a signal this
 *   library is missing a primitive; it gets added here, not in the page.
 * - **Tokens or nothing.** No component may name a colour or a size directly.
 *   Every visual value arrives through `optfall-theme`.
 *
 * @packageDocumentation
 */

import type {
  BevelEdge,
  OrnamentRole,
  PitchValue,
  StateTone,
  Voice,
} from "optfall-theme";

export type { BevelEdge, OrnamentRole, PitchValue, StateTone, Voice };

/* -------------------------------------------------------------------------- */
/* The primitive set                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Every primitive the library owes. The list is closed on purpose: it is both
 * the Phase 1 work queue and the check on the exit criterion, which is that a
 * complete product screen can be assembled from these with no new CSS.
 */
export type PrimitiveName =
  | "pitch-jewel"
  | "bevelled-plate"
  | "state-pill"
  | "brass-seal"
  | "citation"
  | "filigree-corner"
  | "ornamental-rule"
  | "mark";

export const PRIMITIVES: readonly PrimitiveName[] = [
  "pitch-jewel",
  "bevelled-plate",
  "state-pill",
  "brass-seal",
  "citation",
  "filigree-corner",
  "ornamental-rule",
  "mark",
];

/* -------------------------------------------------------------------------- */
/* Prop contracts                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The pitch jewel — an eight-sided cut stone carrying its numeral. Shape,
 * number and colour state the same fact three times.
 *
 * `value` is required and the numeral is always rendered: colour is the
 * redundant channel, not the primary one. There is deliberately no prop that
 * hides the numeral, because the accessible rendering is the only rendering.
 */
export interface PitchJewelProps {
  readonly value: PitchValue;
  /** Rendered size, in token steps rather than pixels. */
  readonly size?: "sm" | "md" | "lg";
  /** Accessible label. Defaults to the pitch value spoken in full. */
  readonly label?: string;
}

/** A struck plate: square corners, light top edge, dark bottom edge. */
export interface BevelledPlateProps {
  readonly emphasis?: "flat" | "raised" | "sunken";
  /** Which edges carry the bevel highlight. Defaults to both. */
  readonly edges?: readonly BevelEdge[];
  /** Feature panels may carry filigree at their corners; nothing else may. */
  readonly ornament?: Extract<OrnamentRole, "panel-corner">;
}

/**
 * A notched state pill. The clipped corner is the only ornament in the system
 * and it always means something: this thing carries state.
 */
export interface StatePillProps {
  readonly tone: StateTone;
  /** Label text, supplied by the caller and never composed by a component. */
  readonly label: string;
}

/**
 * The brass seal — judge attribution on a verified ruling, and the single
 * place brass is allowed to appear.
 */
export interface BrassSealProps {
  /** The judge's name, exactly as they gave it. */
  readonly judge: string;
  /** Date the ruling was given, `YYYY-MM-DD`. */
  readonly date: string;
  /** The rules version the ruling was answered under. */
  readonly rulesVersion: string;
}

/**
 * A citation: monospaced, wide-tracked, and pasteable into an argument. If it
 * is monospaced in this system, it is something you can cite.
 */
export interface CitationProps {
  /** Permanent rule identifier, such as `cr:8.3.4b`. */
  readonly ruleId: string;
  /** Permalink to the addressable section. */
  readonly href: string;
  /** Document version the citation was read from. */
  readonly version?: string;
}

/** Filigree, in one of its three sanctioned roles. Never on a control. */
export interface FiligreeProps {
  readonly role: OrnamentRole;
}

/**
 * The mark — a cut jewel, cleaved and falling. The same octagonal silhouette
 * as the pitch jewel, because the logo and the core interface primitive are
 * the same object.
 *
 * It is drawn from a game *mechanic* rather than from Legend Story Studios'
 * visual identity, which is what keeps it clear of the policy's prohibition on
 * any close semblance to their logos.
 */
export interface MarkProps {
  readonly size?: "sm" | "md" | "lg";
  readonly title?: string;
}

/* -------------------------------------------------------------------------- */
/* Compliance carried by the component, not the page                           */
/* -------------------------------------------------------------------------- */

/**
 * The copyright line that must accompany every card face Optfall renders.
 *
 * The component emits this constant itself. It is deliberately NOT a prop:
 * `docs/COMPLIANCE.md` §5 requires that the notice is "not a prop the caller
 * may omit, not a default that can be overridden to empty, and not the page's
 * responsibility". A required `copyright: string` prop satisfies only the first
 * of those three — `<CardImage copyright="" />` type-checks and renders a card
 * face with no notice, which is precisely the failure the contract exists to
 * design out. Making it unrepresentable beats making it mandatory.
 */
export const CARD_IMAGE_COPYRIGHT = "Card images © Legend Story Studios.";

/**
 * A card face.
 *
 * Card images are expressly permitted for building card databases, on the
 * condition that a copyright line accompanies them. The permission is
 * revocable; losing it should cost a rendering layer and nothing else, which is
 * why no legality or rules data ever travels through this type.
 *
 * **There is deliberately no `copyright` prop.** The implementation renders
 * {@link CARD_IMAGE_COPYRIGHT} unconditionally, so the notice cannot be
 * omitted, emptied, or quietly reworded by a caller — see the constant's
 * documentation for why "required prop" was not enough. A compliance
 * requirement that a caller can satisfy incorrectly is a convention, not a
 * contract.
 *
 * The pitch jewel stays an Optfall-drawn overlay rather than a crop of the
 * printed one, so the accessible rendering travels with the component.
 */
export interface CardImageProps {
  readonly src: string;
  /** The card's printed name, used as the accessible name. */
  readonly alt: string;
  /** Overlay drawn by us, never sampled from the artwork. */
  readonly pitch?: PitchValue;
}

/**
 * Typography assignments are fixed by role, not chosen per usage: serif for
 * names and questions, sans for interface text, mono for anything citable.
 */
export const VOICE_BY_ROLE: Readonly<
  Record<"card-name" | "question" | "heading" | "interface" | "label" | "citation", Voice>
> = {
  "card-name": "serif",
  question: "serif",
  heading: "serif",
  interface: "sans",
  label: "mono",
  citation: "mono",
};
