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
  | "card-face"
  | "card-face-group"
  | "search-field"
  | "result-row"
  | "stat-glyph"
  | "game-symbol";

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
  "card-face-group",
  "search-field",
  "result-row",
  "stat-glyph",
  "game-symbol",
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
/**
 * The symbols the Comprehensive Rules names, at 1.12.4a-h plus 1.12.2.
 *
 * Kept beside `StatKind` deliberately: the two overlap on `power`, `defence`,
 * `life` and `intellect`, and share their silhouettes through `ornament.cut.*`,
 * so a reader meets one plate for one concept whether it is carrying a printed
 * value or standing in for the marker that names it.
 *
 * They are not the same union, and the differences are the interesting part.
 * `resource` is a symbol and `cost` is the stat you pay with it. `tap` and
 * `untap` are effects, so they can never appear in a stat block. `arcane` is a
 * stat with NO printed symbol. `x` is the one marker the rules' own table does
 * not list.
 */
export type SymbolKind =
  | "power"
  | "resource"
  | "defence"
  | "life"
  | "intellect"
  | "chi"
  | "tap"
  | "untap"
  | "x";

/**
 * The printed stats a card can carry, in the order a card face reads.
 *
 * Closed on purpose: each one owns a silhouette in `StatGlyph`, and a seventh
 * stat would need a seventh shape that is not the pitch jewel's octagon — which
 * is a design decision rather than a type widening.
 */
export type StatKind =
  | "cost"
  | "power"
  | "defence"
  | "life"
  | "intellect"
  | "arcane";

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
 * A citation: a permanent identifier you can paste into an argument.
 *
 * It used to be marked by the monospace face, on the rule "if it is monospaced
 * in this system, you can cite it". That rule stopped being true as the same
 * face spread to eyebrows, pills and stat labels — chrome, not identifiers — so
 * the face was retired. A citation is now marked by being one: a link, in the
 * accent, next to the thing it cites.
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

/**
 * THE RESERVED SILHOUETTE, as a `clip-path` polygon — the pitch diamond.
 *
 * A vertex-up diamond with its four corners cut: eight sides, point at the top,
 * point at the bottom, widest across the middle. `docs/DESIGN.md` calls this
 * shape reserved — nothing else in the interface is ever it — which is what
 * lets pitch and the blood accent share a hue without ever being confused.
 *
 * IT IS WRITTEN DOWN HERE BECAUSE IT WAS WRITTEN DOWN TWICE AND THE TWO
 * DISAGREED. `PitchJewel.svelte` drew an edge-up octagon — a chamfered square,
 * flat on top — while `scripts/build-design-system.ts` drew this diamond, and
 * the published design-system cards therefore advertised a shape the product
 * did not render. Both are "an eight-sided cut stone", which is all
 * `docs/DESIGN.md` said, and that is exactly how two drawings of one reserved
 * silhouette drifted apart without anything failing.
 *
 * Orientation is the whole of the difference and it is not a detail: an
 * edge-up octagon reads as a *button*, a vertex-up one reads as a *gem*. The
 * diamond is the shape, and `packages/components/src/index.test.ts` now asserts
 * that the component's own `clip-path` still matches this string.
 */
export const JEWEL_SILHOUETTE =
  "polygon(50% 0%, 85% 15%, 100% 50%, 85% 85%, 50% 100%, 15% 85%, 0% 50%, 15% 15%)";

/**
 * The mark's geometry, in `viewBox` units — the one place it is written down.
 *
 * THE MARK IS `JEWEL_SILHOUETTE`, CLEAVED. Same diamond, parted just above its
 * girdle: a shallow crown above the break and a deeper pavilion below it, as a
 * cut stone has. It cannot literally share the constant above — that one is a
 * `clip-path` in percentages of a box, this one is two SVG polygons in viewBox
 * units, and a cleave is precisely the thing a single clipped box cannot
 * express — so what holds them together is that both are the diamond, stated
 * here, together, where a change to one is visibly a change beside the other.
 *
 * IT LIVES HERE BECAUSE IT HAS TWO CONSUMERS AND MUST NOT HAVE TWO DEFINITIONS.
 * `Mark.svelte` draws it on the page; `apps/site/src/pages/favicon.svg.ts`
 * draws it into the tab. `docs/DESIGN.md` stakes the whole idea on those being
 * the same object — "the thing you see a thousand times a session is the thing
 * on the tab" — and a second copy of these numbers is exactly how that stops
 * being true, quietly, the first time one of them is nudged.
 *
 * This is the argument `CARD_IMAGE_COPYRIGHT` makes a few lines down and the
 * one `themeStylesheet()` makes about the palette: the shared fact gets one
 * declaration, and the surfaces read it.
 *
 * COLOUR IS DELIBERATELY ABSENT. Geometry is the part both consumers share;
 * colour is the part they cannot. A component on the page names tokens and lets
 * the cascade resolve them, while a favicon is fetched as a standalone document
 * that never sees the page's stylesheet and must therefore carry literal
 * values. Putting colour here would force one of those two to be wrong.
 */
export interface MarkGeometry {
  readonly viewBox: string;
  /** The diamond above the break: apex, two cut corners, and the parted edge. */
  readonly crown: string;
  /**
   * The diamond below the break — girdle, two cut corners and the bottom apex.
   * Deeper than the crown, as a cut stone's is, and fallen clear of it.
   */
  readonly pavilion: string;
  /** The freshly exposed cleavage plane along the pavilion's cut face. */
  readonly cleave: {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly width: number;
  };
}

/**
 * The diamond, cleaved. Read it as a stone rather than as numbers:
 *
 * - The **crown** runs apex `14,1` → cut corners at `y 5` → the parted edge,
 *   which is off level (`1.5,10` to `27.5,11.5`). A crystal parts along its own
 *   lattice, not along a saw line, and that tilt is most of what stops the mark
 *   reading as a lid on a box.
 * - The **pavilion** keeps the girdle — `1,17.5` and `31,17.5`, the diamond's
 *   widest points — and tapers through its cut corners to the bottom apex at
 *   `16,31`. It is the half that still looks like the jewel, which is why it is
 *   the half that carries `currentColor`.
 * - Between them, 3.5 units of ground. That is the whole idea and the last
 *   thing to disappear: at a 16px favicon it is still 1.75 device pixels.
 *
 * The two halves are also ~1.5 units out of register, so they no longer line up
 * along the edge they parted on. Combined they span `1..31` of the 32 box,
 * leaving the margin the bevel's drop-shadow needs.
 */
export const MARK_GEOMETRY: MarkGeometry = {
  viewBox: "0 0 32 32",
  crown: "14,1 24.5,5 27.5,11.5 1.5,10 3.5,5",
  pavilion: "2.5,13.5 1,17.5 5.5,27.5 16,31 26.5,27.5 31,17.5 30,15",
  cleave: { x1: 2.5, y1: 13.5, x2: 30, y2: 15, width: 1.5 },
};

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
 * names and questions, sans for everything else.
 */
export const VOICE_BY_ROLE: Readonly<
  Record<"card-name" | "question" | "heading" | "interface" | "label" | "citation", Voice>
> = {
  "card-name": "serif",
  question: "serif",
  heading: "serif",
  interface: "sans",
  label: "sans",
  citation: "sans",
};
