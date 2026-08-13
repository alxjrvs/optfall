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
 * The mark's geometry, in `viewBox` units — the one place it is written down.
 *
 * THE MARK IS THE PITCH DIAMOND, CLEAVED. The silhouette itself is
 * `ornament.cut.jewel` in `optfall-theme`, which `PitchJewel.svelte` clips
 * itself with and the design-system cards draw — vertex up, vertex down, widest
 * across the middle, all four corners cut. This is that same diamond parted
 * just above its girdle: a shallow crown above the break and a deeper pavilion
 * below it, as a cut stone has.
 *
 * IT CANNOT SHARE THE TOKEN, and the reason is a real one rather than an
 * excuse. That token is a `clip-path` in percentages of a box; this is two SVG
 * polygons in viewBox units — and a cleave is precisely what a single clipped
 * box cannot express, since the whole point is two pieces with ground between
 * them. So the relationship is documented rather than mechanical, and
 * `index.test.ts` asserts the properties that make it true: the crown carries
 * the top apex, the pavilion keeps the girdle and the bottom apex, and the gap
 * between them survives a favicon.
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
 * The reserved silhouette as points, in the mark's own 32×32 box.
 *
 * The same eight vertices `ornament.cut.jewel` names in percentages — apex,
 * two upper cut corners, the girdle at the widest points, two lower cut
 * corners, bottom apex — at 32 units instead of 100%.
 */
const JEWEL_POINTS: readonly (readonly [number, number])[] = [
  [16, 0],
  [27.2, 4.8],
  [32, 16],
  [27.2, 27.2],
  [16, 32],
  [4.8, 27.2],
  [0, 16],
  [4.8, 4.8],
];

/**
 * One half of a polygon, cut by a horizontal line. Sutherland–Hodgman, for the
 * one edge case it needs: a convex shape and a level blade.
 */
function cleaveAt(
  points: readonly (readonly [number, number])[],
  y: number,
  keep: "above" | "below",
): string {
  const inside = ([, py]: readonly [number, number]) => (keep === "above" ? py <= y : py >= y);
  const out: [number, number][] = [];

  points.forEach((point, index) => {
    const previous = points[(index + points.length - 1) % points.length]!;
    const crosses = inside(previous) !== inside(point);

    if (crosses) {
      const t = (y - previous[1]) / (point[1] - previous[1]);
      out.push([Number((previous[0] + t * (point[0] - previous[0])).toFixed(2)), y]);
    }
    if (inside(point)) out.push([point[0], point[1]]);
  });

  return out.map(([x, py]) => `${x},${py}`).join(" ");
}

/** Where the crown's cut face sits, and where the pavilion's does. */
const CROWN_BREAK = 9.5;
const PAVILION_BREAK = 13;

/** How wide the stone is at a given height — the ends of a cut at that line. */
function cutSpan(y: number): { left: number; right: number } {
  const crossings = JEWEL_POINTS.flatMap((point, index) => {
    const previous = JEWEL_POINTS[(index + JEWEL_POINTS.length - 1) % JEWEL_POINTS.length]!;
    const spans = (previous[1] - y) * (point[1] - y) < 0;
    if (!spans) return [];
    const t = (y - previous[1]) / (point[1] - previous[1]);
    return [Number((previous[0] + t * (point[0] - previous[0])).toFixed(2))];
  });

  return { left: Math.min(...crossings), right: Math.max(...crossings) };
}

/**
 * THE MARK IS THE JEWEL, CUT — DERIVED, NOT DRAWN.
 *
 * `docs/DESIGN.md` is unambiguous about what this is: "a cut jewel, cleaved and
 * falling … **it is the pitch diamond, the same reserved silhouette as the
 * gem**, which means the logo and the core interface primitive are the same
 * object". Both halves are now clipped out of {@link JEWEL_POINTS}, the same
 * eight vertices `ornament.cut.jewel` gives every pitch stone on the site, so
 * that sentence is true by construction rather than by somebody keeping two
 * drawings in step.
 *
 * They were not in step. The hand-drawn crown put its apex at `14,1` in a box
 * whose centre is 16, and the pavilion ran `1,17.5` on the left against
 * `31,17.5` on the right off a girdle that is not level with either — so the
 * mark read as a lopsided cap on a blob, which is what "an odd hexagon" is a
 * fair description of. Nothing caught it, because a hand-drawn constant agrees
 * with itself.
 *
 * The crown keeps the apex and its two cut corners. The pavilion keeps the
 * girdle — the widest points — and the bottom apex, "so the half that falls is
 * the half still recognisable as the jewel", which is why it is the half that
 * carries `currentColor`. Between them 3.5 units of ground: the gap is the
 * whole idea and the last thing to disappear, still over a device pixel at a
 * 16px favicon.
 */
export const MARK_GEOMETRY: MarkGeometry = {
  viewBox: "0 0 32 32",
  crown: cleaveAt(JEWEL_POINTS, CROWN_BREAK, "above"),
  pavilion: cleaveAt(JEWEL_POINTS, PAVILION_BREAK, "below"),
  /* Drawn along the pavilion's fresh face, edge to edge of the cut — and taken
     FROM that cut rather than typed beside it, because two hand-kept numbers
     drifting apart is the whole reason this constant is now derived. */
  cleave: {
    x1: cutSpan(PAVILION_BREAK).left,
    y1: PAVILION_BREAK,
    x2: cutSpan(PAVILION_BREAK).right,
    y2: PAVILION_BREAK,
    width: 1.5,
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
  Record<"card-name" | "question" | "heading" | "interface" | "label" | "citation", Voice>
> = {
  "card-name": "serif",
  question: "serif",
  heading: "serif",
  interface: "sans",
  label: "sans",
  citation: "sans",
};
