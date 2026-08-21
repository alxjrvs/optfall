/**
 * `optfall-components` — the component library, and the contracts its
 * primitives are built against.
 *
 * This module is the contract layer: the prop types, the shared geometry, and
 * the compliance obligations that are properties of a component rather than of
 * a page. The implementations live in `./react`; the Svelte sources this file
 * was originally written against were deleted in Phase 6.
 *
 * Three rules govern everything added here:
 *
 * - **Compose, never restyle.** A screen that needs new CSS is a signal this
 *   library is missing a primitive; it gets added here, not in the page.
 * - **Tokens or nothing.** No component may name a colour or a size directly.
 *   Every visual value arrives through `optfall-theme`.
 * - **One primitive, one card.** Every entry in {@link PRIMITIVES} is
 *   demonstrated by its own card in the `design-system/` workbench, titled with
 *   its own id. `scripts/design-system-coverage.test.ts` fails the build on a
 *   primitive that has none, and `docs/DESIGN.md` records the taxonomy and why
 *   a shared "gallery" card does not count as coverage.
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
  | "pitch-box"
  | "pitch-rule"
  | "rarity-bar"
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
  | "game-symbol"
  | "pagination"
  | "icon-button";

export const PRIMITIVES: readonly PrimitiveName[] = [
  "pitch-jewel",
  "pitch-box",
  "pitch-rule",
  "rarity-bar",
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
  "pagination",
  "icon-button",
];

/* -------------------------------------------------------------------------- */
/* Prop contracts                                                              */
/* -------------------------------------------------------------------------- */

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

/**
 * How many rows a page of results carries — a count, or every one of them.
 *
 * `"all"` IS A MEMBER OF THE UNION RATHER THAN A SENTINEL NUMBER, and that is
 * the whole reason this type exists instead of a bare `number`. The obvious
 * spellings are `0` and `Infinity`, and both are values a caller can produce by
 * accident: `Number.parseInt("")` is `NaN`, a missing parameter is `undefined`
 * coerced to `0`, and either would silently mean "show 4,941 card images" at
 * the one place a mistake is most expensive. A string cannot be arrived at by
 * arithmetic.
 *
 * It lives in the framework-free layer because it has two consumers that must
 * not define it twice: the {@link PrimitiveName | pagination} primitive, which
 * renders the choice, and the query layer, which turns it into a slice.
 *
 * WHICH counts are offered is deliberately NOT here. That is a product
 * decision about a particular list — a grid of faces and a list of rule
 * sections do not want the same steps — so the control takes them as a prop and
 * the surface states them.
 */
export type PageSize = number | "all";

/**
 * The mark's geometry, in `viewBox` units — the one place it is written down.
 *
 * THE MARK IS A CHAIN OF THREE INTERLOCKED LINKS. What it replaced was the
 * pitch diamond, cleaved, on the argument that the logo and the core interface
 * primitive should be the same object; `docs/DESIGN.md` records why that
 * argument was retired. The jewel is still the interface primitive and still
 * has its own token, `ornament.cut.jewel`, which `PitchJewel` clips itself
 * with — the mark simply stopped being it.
 *
 * IT LIVES HERE BECAUSE IT HAS THREE CONSUMERS AND MUST NOT HAVE THREE
 * DRAWINGS. `Mark.tsx` draws the chain, `apps/site/ssg/assets.ts` draws it at
 * build time for the favicon and the installed-app icons, and the `mark`
 * design-system card draws it again in the workbench. A second copy of these
 * numbers is a second drawing, and a second drawing drifts — which is the
 * failure the previous mark had, in this same file, before it was rewritten as
 * a derivation.
 *
 * THERE IS NO REDUCED FORM HERE ANY MORE. `single` was one link upright in its
 * own box, drawn by whichever surface was too small for three; both surfaces
 * that used it — the favicon, then the install icon — went back to the chain,
 * because an icon that is not the logo is worse at every size than a logo that
 * is dense at one. It came out with the last of them rather than being left as
 * a variant nothing draws.
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
function cornersOf(index: number): readonly (readonly [number, number])[] {
  const [cx, cy] = centreOf(index);
  const a = radians(angleOf(index));
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
function boxOf(indices: readonly number[]): {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
} {
  const pad = 1;
  const points = indices.flatMap((index) => cornersOf(index));
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

const placementOf = (index: number): string => {
  const [cx, cy] = centreOf(index);
  return (
    `rotate(${round(angleOf(index))},${round(cx)},${round(cy)}) ` +
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
};

/**
 * The filigree drawing — the paths, and the mirror that places them.
 *
 * IT LIVES HERE FOR THE SAME REASON {@link MARK_GEOMETRY} DOES: it has two
 * consumers and must not have two definitions. `FiligreeCorner` draws it, and
 * `scripts/build-design-system.ts` draws it again on the `filigree-corner`
 * design-system card. A second copy of these paths is a second drawing, and a
 * second drawing drifts — which is the failure that generator's own header
 * documents ("the card screen went on showing a stat block that had become
 * glyphs"), one primitive over.
 *
 * ONLY THE PATHS ARE SHARED, NOT THE SIZING. The `box`, the stroke weight and
 * the relief `lift` are chosen per role by whoever renders, because those are
 * presentation; the scrollwork is the thing that must agree.
 *
 * All coordinates are SVG user units inside a `viewBox`, so they are
 * proportions of the ornament rather than lengths — the rendered size comes
 * from the host slot for a corner and from `--of-ornament-filigree-size` for
 * the rule figure, and nothing here changes when either does.
 */
export const FILIGREE_PATHS = {
  /** The feature panel's corner: the fullest hand in the system. */
  panel: {
    /* The angular bracket — mitred, not curved, because the frame is square
       even where the ornament growing out of it is not — and the volute, a
       sweep out of the corner that spirals back on itself. The volute is what
       makes this scrollwork rather than a chevron. */
    strokes: [
      "M 47 2 L 2 2 L 2 47",
      "M 3 3 C 15.5 5.5 25.6 12.6 28.4 22.4 C 30.4 29.2 26.2 35 19.6 34.6" +
        " C 14.4 34.3 10.8 29.8 11.9 25.2 C 12.8 21.5 16.9 19.7 20 21.6",
    ],
    /** Crescent leaves, and the lozenge at the eye of the scroll. */
    fills: [
      "M 6.5 3.4 C 13 8.4 20 9.6 27.4 6.6 C 21 10.2 13.6 9.4 7.6 5.2 Z",
      "M 3.4 6.5 C 8.4 13 9.6 20 6.6 27.4 C 10.2 21 9.4 13.6 5.2 7.6 Z",
      "M 20 23.6 L 22.4 26 L 20 28.4 L 17.6 26 Z",
    ],
  },
  /**
   * The card frame's corner: same motif, fewer members, thinner stroke. A card
   * is one of many on a results page, and filigree at panel weight around each
   * of them would be the "never on a list" failure by another route.
   */
  card: {
    strokes: [
      "M 31 1.5 L 1.5 1.5 L 1.5 31",
      "M 2.5 2.5 C 10 4 15.6 8.4 17.6 14.6 C 19 19 16 22.8 12 22" +
        " C 8.8 21.4 7.2 17.8 9.2 15.4 C 10.6 13.7 13.4 13.7 14.6 15.6",
    ],
    fills: [
      "M 4.6 2.6 C 9 6 13.6 6.8 18.4 4.8 C 14.2 7.2 9.2 6.6 5.2 3.8 Z",
      "M 13 16.4 L 14.8 18.2 L 13 20 L 11.2 18.2 Z",
    ],
  },
  /**
   * The section rule's figure, drawn as its LEFT HALF and mirrored. Symmetry
   * about the centre is the point of a rule ornament, and a mirrored half
   * cannot drift out of true the way two hand-drawn halves can.
   */
  rule: {
    viewBox: "0 0 72 24",
    strokes: [
      "M 2 12 L 16 12",
      /* Opposed volutes, above and below the stem — the double scroll. */
      "M 16 12 C 22.6 12 26 8.4 24.2 5 C 22.7 2.2 18.7 2.4 17.6 5.4" +
        " C 16.7 7.9 18.9 10.2 21.2 9.4",
      "M 16 12 C 22.6 12 26 15.6 24.2 19 C 22.7 21.8 18.7 21.6 17.6 18.6" +
        " C 16.7 16.1 18.9 13.8 21.2 14.6",
      "M 25.6 12 L 31 12",
    ],
    fills: ["M 9 9.4 L 11.6 12 L 9 14.6 L 6.4 12 Z"],
    /** Drawn once, spanning the mirror line, so the centre is a single shape. */
    centre: "M 36 5.6 L 40.6 12 L 36 18.4 L 31.4 12 Z",
  },
  /**
   * One motif, four placements. Mirroring rather than redrawing guarantees the
   * four corners agree, and keeps the drawing to one set of paths to audit.
   * Only the mirroring lives here — where the ornament *sits* is the host's.
   */
  mirror: {
    "start-start": "translate(0 0)",
    "start-end": "scale(-1 1)",
    "end-start": "scale(1 -1)",
    "end-end": "scale(-1 -1)",
  } as Readonly<Record<PlateCorner, string>>,
} as const;

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
 *
 * ---
 *
 * **THIS IS THE CONTRACT, AND `CardFaceProps` IS WHAT RENDERS.** Nothing
 * implements this type. `react/CardFace.tsx` declares its own
 * {@link CardFaceProps}, which is what `react/index.ts` exports and what every
 * card page actually uses; it carries nine fields where this carries eight, and
 * the two are kept in step by nobody.
 *
 * That matters more here than it would elsewhere, because `index.test.ts`
 * points its two compliance cases at **this** type rather than at the one that
 * renders. Only one of them actually holds:
 *
 * - *"is not caller-supplied"* is real. It is a type-level assertion that
 *   `"copyright" extends keyof CardImageProps` is `false`, so re-adding the
 *   prop stops it compiling.
 * - *"carries no legality or rules data"* **asserts nothing.** Its body is
 *   `const keys: Keys[] = ["src", "alt", "pitch"]` followed by
 *   `expect(keys).toHaveLength(3)` — a hand-written three-element array is
 *   three elements long. This interface already has eight fields, so the case
 *   is not even describing the type it names; adding a `legality` field would
 *   leave it green.
 *
 * Left as found rather than quietly strengthened, because making that case
 * mean what its title says is a decision about what the contract is — the
 * honest version is a `Record<keyof …, true>` exhaustiveness check, and it
 * would fail on the eight fields that exist today.
 *
 * Nine other `*Props` interfaces in this file duplicated their components'
 * shape and have been deleted: eight same-named, plus `FiligreeProps`, which
 * matched `FiligreeCornerProps` in shape but not in name — so that one dropped
 * a name from this package's surface rather than shedding a duplicate of one.
 *
 * This interface is neither. It is a second, divergent shape that nothing
 * implements, so removing it would delete the `copyright` assertion with it.
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

/* -------------------------------------------------------------------------- */
/* Dates                                                                       */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * `YYYY-MM-DD` expanded to "14 March 2026", by hand.
 *
 * Deliberately NOT `new Date(date).toLocaleDateString()`. A bare `YYYY-MM-DD` is
 * parsed as UTC midnight, so anywhere west of Greenwich that round-trip renders
 * the *previous day* — a ruling dated the 14th displayed as the 13th to a reader
 * in Los Angeles. On a surface whose entire value is being citable, a date that
 * changes with the reader's timezone is not a cosmetic bug. Every caller pairs
 * this with a `dateTime` attribute carrying the exact machine form, so nothing
 * is lost by formatting the visible text ourselves.
 *
 * An unparseable value renders as given rather than as "Invalid Date": if
 * upstream data is malformed, showing it is how anyone finds out.
 *
 * IT LIVED INSIDE `BrassSeal` UNTIL A SECOND SURFACE WANTED IT. The set page's
 * masthead prints a release date, and the timezone argument above is the whole
 * reason it cannot simply call `toLocaleDateString` — so the choice was a copy
 * of this function in `apps/site` or one function both surfaces call. It is
 * here rather than in the app because a package cannot import from an app, and
 * `BrassSeal` is the older caller.
 *
 * THE CONTRACT LAYER RATHER THAN `./react`, because it renders no markup and
 * `parity.test.ts` holds that entry to exactly the primitive set. A string in,
 * a string out, and no React in the module — the same reason `MARK_GEOMETRY`
 * and `VOICE_BY_ROLE` are here.
 */
export function readableDate(date: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!parts) return date;
  const [, year, month, day] = parts;
  const name = MONTHS[Number(month) - 1];
  return name ? `${Number(day)} ${name} ${year}` : date;
}
