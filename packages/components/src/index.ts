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
  | "mark"
  | "card-face";

export const PRIMITIVES: readonly PrimitiveName[] = [
  "pitch-jewel",
  "bevelled-plate",
  "state-pill",
  "brass-seal",
  "citation",
  "filigree-corner",
  "ornamental-rule",
  "mark",
  "card-face",
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

/**
 * Corner ids in CSS logical order — block axis first, then inline, exactly as
 * `border-start-start-radius` names them. Not `top-left`, because a plate flips
 * with writing direction and its ornament flips with it.
 *
 * It lives in the contract layer rather than inside either component because
 * two of them have to agree about it: `BevelledPlate` passes one of these ids
 * to its `corner` snippet, and `FiligreeCorner` consumes it to decide which way
 * to mirror the motif. Declared twice, the two sets agreed by coincidence.
 */
export type PlateCorner = "start-start" | "start-end" | "end-start" | "end-end";

export const PLATE_CORNERS: readonly PlateCorner[] = [
  "start-start",
  "start-end",
  "end-start",
  "end-end",
];

/**
 * A struck plate: square corners, light top edge, dark bottom edge.
 *
 * **The plate hosts panel filigree; it does not draw it.** With
 * `ornament="panel-corner"` it opens four slots — placed *and sized* by the
 * plate, since only the plate knows where its corners are — and renders a
 * `corner` snippet into each, passing the {@link PlateCorner} id. The caller
 * composes `FiligreeCorner role="panel-corner" corner={id}` in, which keeps
 * scrollwork rationed by the call site that can see the whole screen rather
 * than by a plate that can only see itself. The snippet prop is deliberately
 * not typed here: snippets are a Svelte concern and stay local to the
 * component, exactly as `children` does.
 */
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
  /**
   * Label text, supplied by the caller and never composed by a component — the
   * corpus owns the wording of a verdict — and it must *name the state*
   * (`"Banned"`, not `"Blitz"`), because the text is the primary channel and
   * colour is the redundant one.
   *
   * Required is not the same as non-empty, and the implementation closes that
   * gap: `label=""` type-checks but renders the tone spoken in full rather than
   * an empty coloured chip, which would leave colour and the notch as the sole
   * carriers of meaning. Same argument as {@link CARD_IMAGE_COPYRIGHT} — a
   * required prop a caller can satisfy incorrectly is a convention, not a
   * contract.
   */
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

/**
 * Filigree, in one of its three sanctioned roles. Never on a control.
 *
 * **It draws scrollwork and owns no layout.** One instance is *one* ornament,
 * and every role is hosted by a primitive that already knows where the ornament
 * goes — which is the contract both sides kept getting wrong, so it is written
 * here rather than in either component:
 *
 * | Role | Host | What the host owns | What this owns |
 * |---|---|---|---|
 * | `panel-corner` | `BevelledPlate` (`ornament="panel-corner"`) | Four slots, placed and sized; passes the {@link PlateCorner} id to its `corner` snippet | The drawing, mirrored per corner |
 * | `card-corner` | The card frame | The same four slots, at the lighter card size | The drawing, mirrored per corner |
 * | `section-rule` | `OrnamentalRule` (`ornament`) | The `<hr>`, both hairlines, the vertical rhythm | A bare centred figure — no lines, no `role="separator"` |
 *
 * There is deliberately no label prop, and this is the one primitive where an
 * absent accessible name is correct: the ornament carries no information, so it
 * is `aria-hidden` unconditionally in all three roles. Remove every ornament in
 * the library and nothing is lost — which is what "decoration" has to mean.
 */
export interface FiligreeProps {
  readonly role: OrnamentRole;
  /**
   * Which corner of the frame this instance draws. Selects the mirroring of the
   * motif and nothing else; the host slot supplies the position. Defaults to
   * `start-start`, and is ignored in the `section-rule` role.
   */
  readonly corner?: PlateCorner;
}

/**
 * The section rule — a hairline divider, optionally carrying the centred
 * filigree ornament. This is the primitive that replaces the card: where a
 * lesser system would box a section, this one draws a line and moves on.
 *
 * It owns every part of a rule that is not the drawing — the `<hr>`, both
 * hairlines and the vertical rhythm — because a rule is structure. See
 * {@link FiligreeProps} for the division of labour with the ornament.
 */
export interface OrnamentalRuleProps {
  /**
   * Open the centre of the rule and mount the filigree. Defaults to `false`
   * because ornament is rationed: a screen gets one of these at most, and the
   * plain hairline is overwhelmingly the common case.
   */
  readonly ornament?: boolean;
  /**
   * Render a line that is *not* a thematic break — furniture inside a plate
   * rather than a division between sections. Hidden from assistive technology
   * entirely, which is the honest rendering of a decoration.
   *
   * It defaults to `false` because the expensive mistake runs in one direction
   * only. A screen reader announcing "separator" between every header and its
   * body, on every card page, is noise that trains people to ignore the one
   * that meant something — so a decorative line has to be *asked for*, and the
   * default is the semantic `<hr>`.
   */
  readonly decorative?: boolean;
  /**
   * Accessible name for the break, such as the section it introduces.
   *
   * **Its default is deliberately absence**, which is the one place this
   * library departs from "the accessible name is a prop with a sensible
   * default". A `separator` needs no name to be understood — it is already
   * announced by its role — so a default here would be invented text read
   * aloud on every rule in the interface, which is the same noise `decorative`
   * exists to prevent. Supply one only when the break genuinely names
   * something, and never as a description of the line itself.
   */
  readonly label?: string;
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
  /**
   * Accessible name, defaulting to the product's own. A blank falls back to
   * that default rather than through it — `title=""` must not be able to strip
   * the name off a `role="img"`.
   */
  readonly title?: string;
  /**
   * Render the mark as pure decoration: `aria-hidden`, no role, no name.
   *
   * It exists so that "hide it" and "name it" are two questions rather than
   * one. Without it, the caller who legitimately wants a silent mark — beside a
   * visible "Optfall" wordmark, where announcing the name twice is noise —
   * reaches for `title=""`, which is the single spelling that produces an
   * unnamed image instead of a hidden one.
   */
  readonly decorative?: boolean;
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
  /**
   * Optional `srcset`, when more than one tier is worth offering, and the
   * `sizes` that goes with it.
   */
  readonly srcset?: string;
  readonly sizes?: string;
  /** The card's printed name, used as the accessible name. */
  readonly alt: string;
  /**
   * Intrinsic pixel box. REQUIRED rather than optional, and that is a
   * correctness property rather than a nicety: a grid of lazily-loaded faces
   * with no intrinsic size is a grid of layout shifts, and the landscape cases
   * are real — 15 cards are played horizontally and 10 printings carry a
   * rotation, so a portrait box around a landscape face is visible at a glance.
   */
  readonly width: number;
  readonly height: number;
  /** Overlay drawn by us, never sampled from the artwork. */
  readonly pitch?: PitchValue;
  /** Eager only for the one face above the fold on a card page. */
  readonly loading?: "lazy" | "eager";
}

/**
 * The URL grammar for card faces deliberately does NOT live in this package.
 *
 * `apps/site/src/lib/faces.ts` owns it, because it is shared with the ingest
 * that writes the blobs and the two must not be able to disagree. Keeping the
 * host name and the key rule out of here is also what keeps these primitives
 * adoptable by a Flesh and Blood tool that serves its faces from somewhere
 * else — which is the entire premise of publishing them.
 */

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
