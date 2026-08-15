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
 * The mark — three interlocked links.
 *
 * It says what the tool DOES rather than what the game is: Optfall's whole
 * claim is the joins it makes, and a chain is that drawn. `docs/DESIGN.md`
 * records why the cut jewel it replaced was retired.
 *
 * It is drawn from a game *mechanic* and from plain geometry rather than from
 * Legend Story Studios' visual identity, which is what keeps it clear of the
 * policy's prohibition on any close semblance to their logos.
 */
export interface MarkProps {
  readonly size?: "sm" | "md" | "lg";
  /**
   * Which fill set.
   *
   * `pitch` is canonical — one link per pitch value — and is the one place this
   * system spends the pitch palette on something that is not a pitch value; see
   * `docs/DESIGN.md`. `ink` fills the outer links with `currentColor`, so a
   * lockup takes the colour of the word beside it and lights up as one object.
   *
   * It is on the published type because it was missing from it: the component
   * accepted `variant` and this interface did not, so a consumer typing against
   * the package could not express `variant="ink"` at all.
   */
  readonly variant?: "pitch" | "ink";
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
 * The mark's geometry, in `viewBox` units — the one place it is written down.
 *
 * THE MARK IS A CHAIN OF THREE INTERLOCKED LINKS. What it replaced was the
 * pitch diamond, cleaved, on the argument that the logo and the core interface
 * primitive should be the same object; `docs/DESIGN.md` records why that
 * argument was retired. The jewel is still the interface primitive and still
 * has its own token, `ornament.cut.jewel`, which `PitchJewel.svelte` clips
 * itself with — the mark simply stopped being it.
 *
 * IT LIVES HERE BECAUSE IT HAS TWO CONSUMERS AND MUST NOT HAVE TWO DEFINITIONS.
 * `Mark.svelte` draws the chain and `apps/site/src/pages/favicon.svg.ts` draws
 * one link of it at build time. A second copy of these numbers is a second
 * drawing, and a second drawing drifts — which is the failure the previous mark
 * had, in this same file, before it was rewritten as a derivation.
 *
 * The favicon's link is not a variant of the geometry: it is `link` under
 * `single.placement`, so there is nothing to keep in step.
 */
export interface MarkGeometry {
  /** The box the whole chain sits in, at its own aspect. */
  readonly viewBox: string;
  /**
   * One link, as a single path: the outer ring followed by the window it
   * encloses. Drawn with `fill-rule="evenodd"` so the window is a hole rather
   * than a second shape in a second colour.
   */
  readonly link: string;
  /**
   * Where each link sits, in paint order, as a ready-made SVG `transform`.
   * Ready-made because two consumers draw this — the component and the favicon
   * endpoint — and a transform composed twice is a transform that can differ.
   */
  readonly placements: readonly string[];
  /**
   * The clips that make the chain interlock.
   *
   * Paint order alone settles both of a pair's crossings the same way, which
   * reads as one link lying wholly over its neighbour. Each entry names a link
   * to redraw and the rectangle to redraw it inside, which puts it back on top
   * at one crossing and nowhere else.
   */
  readonly scopes: readonly {
    /** Index into {@link placements}. */
    readonly link: number;
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }[];
  /**
   * One link alone, upright, in its own box — what the favicon draws.
   *
   * NOT A SECOND DRAWING. It is the same `link` path under a different
   * transform, because three links at this aspect are a smudge at 16px and one
   * ring is still a ring. Measured, not assumed.
   */
  readonly single: {
    readonly viewBox: string;
    readonly placement: string;
  };
}

/**
 * THE MARK IS A CHAIN OF THREE LINKS, AND EVERY NUMBER BELOW IS DERIVED.
 *
 * `docs/DESIGN.md` had the mark as a cut jewel — the pitch diamond, cleaved —
 * on the argument that the logo and the core interface primitive should be one
 * object. The chain replaces it and makes a different argument: what Optfall
 * does is JOIN things. A card to the rule that governs it, a rule to the cards
 * it governs, a printing to its legality and the flags that produced it. The
 * jewel said "Flesh and Blood"; the chain says what this tool is for.
 *
 * THREE LINKS BECAUSE THE INTERLOCK NEEDS THREE. Two links can be drawn
 * interlocking, but three is where the pattern is visibly a CHAIN rather than
 * two rings that happen to overlap — and three is also what carries the pitch
 * palette, one link per value.
 *
 * NOTHING HERE IS HAND-PLACED. The step between links is the run of a rotated
 * link minus the overlap that makes them interlock; the box is the union of
 * their rotated corners; the clips are the empty band between each pair's two
 * crossings. Change the angle and everything else follows, which is the whole
 * reason the previous mark was rewritten as a derivation rather than left as
 * coordinates somebody typed.
 */

/** How far a link leans off the horizontal. Shallow: the chain lies flat. */
const LINK_ANGLE = 25;

/** One link's box, before rotation. */
const LINK_WIDTH = 20;
const LINK_HEIGHT = 12;

/**
 * How far two neighbouring links reach into one another.
 *
 * This is the only chosen number in the file and it is chosen against one
 * constraint: the links must overlap enough that neither can be lifted away,
 * and little enough that both windows stay open. Everything else is arithmetic.
 */
const LINK_OVERLAP = 8;

/** Where the middle link sits. The other two are placed relative to it. */
const CHAIN_CENTRE_X = 32;
const CHAIN_CENTRE_Y = 16;

/** The links, left to right. Paint order, and the order `placements` is in. */
const LINK_ORDER = [-1, 0, 1] as const;

const radians = (degrees: number): number => (degrees * Math.PI) / 180;
const round = (value: number): number => Number(value.toFixed(2));

/**
 * The horizontal step between link centres.
 *
 * A rotated link's run is `width × cos(angle)`; the links interlock by giving
 * `LINK_OVERLAP` of that back. Derived rather than measured off a drawing,
 * which is what keeps the chain evenly spaced at any angle.
 */
const LINK_STEP = LINK_WIDTH * Math.cos(radians(LINK_ANGLE)) - LINK_OVERLAP;

/** Alternating lean, so the chain zigzags rather than shearing one way. */
const angleOf = (index: number): number =>
  Math.abs(index % 2) === 0 ? LINK_ANGLE : -LINK_ANGLE;

const centreOf = (index: number): readonly [number, number] => [
  CHAIN_CENTRE_X + index * LINK_STEP,
  CHAIN_CENTRE_Y,
];

/** One link's four corners after rotation — the input to the bounding box. */
function cornersOf(
  index: number,
  angle = angleOf(index),
): readonly (readonly [number, number])[] {
  const [cx, cy] = centreOf(index);
  const a = radians(angle);
  return (
    [
      [-LINK_WIDTH / 2, -LINK_HEIGHT / 2],
      [LINK_WIDTH / 2, -LINK_HEIGHT / 2],
      [LINK_WIDTH / 2, LINK_HEIGHT / 2],
      [-LINK_WIDTH / 2, LINK_HEIGHT / 2],
    ] as const
  ).map(([dx, dy]) => [
    cx + dx * Math.cos(a) - dy * Math.sin(a),
    cy + dx * Math.sin(a) + dy * Math.cos(a),
  ]);
}

/** The smallest box holding the given links, with a unit of air around it. */
function boxOf(
  indices: readonly number[],
  angle?: number,
): {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
} {
  const pad = 1;
  const points = indices.flatMap((index) => cornersOf(index, angle));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;

  return {
    minX: round(minX),
    minY: round(minY),
    width: round(Math.max(...xs) + pad - minX),
    height: round(Math.max(...ys) + pad - minY),
  };
}

const placementOf = (index: number, angle = angleOf(index)): string => {
  const [cx, cy] = centreOf(index);
  return (
    `rotate(${round(angle)},${round(cx)},${round(cy)}) ` +
    `translate(${round(cx - LINK_WIDTH / 2)},${round(cy - LINK_HEIGHT / 2)})`
  );
};

/**
 * One link: an elongated octagon, and the smaller one it encloses.
 *
 * Eight sides rather than a rounded rectangle because `docs/DESIGN.md` allows
 * no rounded corners anywhere in this system — the chamfer is how this project
 * spells "not a rectangle", on the jewel, on every plate, and here.
 */
const LINK_PATH =
  "M4,0 L16,0 L20,4 L20,8 L16,12 L4,12 L0,8 L0,4 Z " +
  "M5,3 L15,3 L17,5 L17,7 L15,9 L5,9 L3,7 L3,5 Z";

const CHAIN_BOX = boxOf([...LINK_ORDER]);
const SINGLE_BOX = boxOf([0], 0);

export const MARK_GEOMETRY: MarkGeometry = {
  viewBox: `${CHAIN_BOX.minX} ${CHAIN_BOX.minY} ${CHAIN_BOX.width} ${CHAIN_BOX.height}`,
  link: LINK_PATH,
  placements: LINK_ORDER.map((index) => placementOf(index)),

  /*
    ONE SCOPE PER PAIR, and the rectangle is the empty band between that pair's
    two crossings rather than a shape cut around either of them.

    Two links leaning opposite ways about the same row of centres cross twice,
    symmetrically above and below that row — so the row itself is the boundary
    with the most clearance on both sides, and a rectangle from the top of the
    box down to it contains exactly one crossing. Redrawing the left link there
    puts it over its neighbour at the upper crossing while paint order leaves
    the neighbour on top at the lower one. No subtraction, no mask, no cut
    edges: the interlock is entirely a question of what is drawn last where.
  */
  scopes: LINK_ORDER.slice(0, -1).map((index, position) => ({
    link: position,
    x: round(centreOf(index)[0]),
    y: CHAIN_BOX.minY,
    width: round(LINK_STEP),
    height: round(CHAIN_CENTRE_Y - CHAIN_BOX.minY),
  })),

  single: {
    viewBox: `${SINGLE_BOX.minX} ${SINGLE_BOX.minY} ${SINGLE_BOX.width} ${SINGLE_BOX.height}`,
    placement: placementOf(0, 0),
  },
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
  Record<
    "card-name" | "question" | "heading" | "interface" | "label" | "citation",
    Voice
  >
> = {
  "card-name": "serif",
  question: "serif",
  heading: "serif",
  interface: "sans",
  label: "sans",
  citation: "sans",
};
