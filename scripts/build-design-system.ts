/**
 * Build the Optfall design-system bundle — the cards published to Claude Design.
 *
 * Every preview reads its palette, type scale, spacing ramp and bevel geometry
 * out of `optfall-theme` at build time, so no colour or size on a card can
 * disagree with the product.
 *
 * THE MARKUP IS NOT GENERATED FROM THE COMPONENTS, AND THAT IS THE KNOWN
 * WEAKNESS. Each card hand-authors the shape it is illustrating, so a component
 * change does not propagate — and it did not: the card screen went on showing a
 * stat block that had become glyphs and an "Upstream flags" row that had been
 * removed, until somebody looked at the mockup and asked why it disagreed with
 * the site.
 *
 * This file lives in the repository for that reason. It was written in a
 * scratch directory, which is precisely why nothing prompted a re-run when the
 * components moved underneath it. `bun run design-system` now regenerates the
 * bundle from one command, and the output is committed so a drift is a diff
 * rather than a discovery.
 *
 * Rendering the real React components into these cards would remove the
 * weakness rather than manage it, and is the right next step. (It said "Svelte"
 * until Phase 6 deleted those sources.)
 *
 * WHAT THE COVERAGE GATE DOES AND DOES NOT REACH. `design-system-coverage.test.ts`
 * checks that every primitive has a card, that the taxonomy is closed, that the
 * title is derived from the primitive id, and that the committed HTML is
 * byte-identical to what this file renders. It CANNOT check that a card's
 * CONTENT still matches the primitive it names, because the markup here is
 * hand-authored rather than derived — which is precisely the weakness above.
 * So the gate makes the catalog's SHAPE enforceable and leaves its FIDELITY to
 * review, and the two exceptions are `MARK_GEOMETRY` and `FILIGREE_PATHS`,
 * drawn from the contract module so those two cannot drift at all.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  FILIGREE_PATHS,
  MARK_GEOMETRY,
  type PlateCorner,
  type PrimitiveName,
} from "../packages/components/src/index";
import {
  DARK_TOKENS,
  LIGHT_TOKENS,
  THEME_ATTRIBUTE,
  lightTheme,
  themeStylesheet,
  toCssDeclarations,
} from "../packages/theme/src/index";

/**
 * Where the bundle is written. Overridable so a scratch run does not clobber
 * the checked-in one.
 */
const OUT =
  process.env["OPTFALL_DS_OUT"] ?? join(import.meta.dir, "..", "design-system");
const TOKENS = themeStylesheet();

const FACE = "https://images.optfall.com";

/**
 * A pitch jewel, in the two-element shape `PitchJewel.tsx` renders.
 *
 * THE NESTING IS THE BEVEL. Every plate in this system carries a light top edge
 * and a dark bottom one, and on the diamond that has to be a `drop-shadow()`
 * filter — an inset shadow meets a vertex-up polygon only in a sliver at the
 * apex. `filter` is applied before `clip-path` on the same element, so the
 * shadow has to be declared on a parent of the clipped stone or it is drawn and
 * immediately clipped away.
 *
 * These cards had no bevel on the jewel at all, so they published a flat
 * diamond against a component that ships a struck one — the same "cards
 * advertise a rendering the product does not have" gap that let the silhouette
 * itself drift, one axis over.
 */
function jewel(pitch: string | number, size = ""): string {
  const value = String(pitch);
  // Zero is an absence and reads as one, exactly as the component renders it.
  const glyph = value === "0" ? "–" : value;
  return `<span class="jewel${size ? ` ${size}` : ""}"><span class="stone p${value}">${glyph}</span></span>`;
}

/**
 * A pitch box, in the two-element shape `PitchBox.tsx` renders.
 *
 * THE NESTING IS THE ROTATION, and it is on the inner span deliberately:
 * `writing-mode` on the box would swap what `inline-size` and `padding-block`
 * mean, turning the token width into a height and standing the bevel on its
 * side. Same reason the component carries the extra element, and the same
 * reason `jewel()` above carries one for its filter — a card that drew the
 * shape a different way would be advertising a rendering the product does not
 * ship, which is the drift both of those comments exist to record.
 */
function pitchBox(pitch: string | number, size = ""): string {
  const value = String(pitch);
  // Sentence case here too: the shouting is `text-transform`, in both places.
  const words = value === "0" ? "No pitch" : `Pitch ${value}`;
  return `<span class="pbox p${value}${size ? ` ${size}` : ""}"><span>${words}</span></span>`;
}

/**
 * A stat plate, in the shape `StatGlyph` actually renders.
 *
 * WRITTEN ONCE HERE BECAUSE IT WAS WRITTEN TWICE INLINE, AND BOTH COPIES WERE
 * WRONG. The stat-glyph primitive page and the card screen each carried their
 * own hand-spelled `<span style="…">` per stat, from before the component took
 * the card's own furniture for the three the card draws — so the gallery
 * published a hexagon for cost and a chamfered square for power against a
 * product that ships a red disc and a yellow one, in a repository whose token
 * comments already tell the story of a silhouette drifting exactly this way.
 *
 * The three things a copy can get wrong are the three things this reads rather
 * than states: the SHAPE comes out of `ornament.cut.*` via `cutValue`, the INK
 * out of `color.stat.*`, and the SIZE out of `ornament.stat.size` scaled by the
 * same optical factor `StatGlyph.css` derives from the silhouette's area.
 */
const STAT_PLATES: Readonly<
  Record<string, { cut: string; tone: string | null; optical: number }>
> = {
  cost: { cut: "cut.disc", tone: "cost", optical: 1 },
  power: { cut: "cut.disc", tone: "power", optical: 1 },
  defence: { cut: "cut.shield", tone: "defence", optical: 0.956 },
  life: { cut: "cut.disc", tone: "life", optical: 1 },
  intellect: { cut: "cut.disc", tone: "intellect", optical: 1 },
  /* The only stat left with no tone, because it is the only one the rules print
     no symbol for — 1.12.4 names eight and arcane is not among them. The bare
     plate is now what "no printed notation" looks like rather than a default
     five stats happened to share. */
  arcane: { cut: "cut.diagonal.end", tone: null, optical: 0.908 },
};

function statPlate(kind: string, value: string): string {
  const spec = STAT_PLATES[kind];
  // Same argument as `cutValue`: a stat the component knows and this table does
  // not is drift, and the gallery should say so rather than render a blank.
  if (spec === undefined) throw new Error(`no such stat plate: ${kind}`);

  const size = `calc(var(--of-ornament-stat-size) * ${spec.optical})`;
  /* AN EN DASH IS THE ABSENT VALUE, and it takes the empty-socket fill whatever
     the stat's own tone is — the component overrides `background` and `color`
     and leaves the silhouette alone, so this does the same. */
  const absent = value === "–";
  const surface = absent
    ? "background:var(--of-color-stat-absent);color:var(--of-color-stat-absent-ink)"
    : spec.tone === null
      ? "background:var(--of-color-surface-raised);color:var(--of-color-ink)"
      : `background:var(--of-color-stat-${spec.tone});color:var(--of-color-stat-${spec.tone}-ink)`;
  /* The shield's point takes the bottom of the square, so the numeral is
     centred in the BODY rather than in the box — the component's own note. */
  const seat =
    kind === "defence" ? `;padding-block-end:calc(${size} * 0.28)` : "";
  /* THE DASH IS LIGHTER THAN A NUMERAL, exactly as `StatGlyph.css` draws it —
     a stat that is not there should not shout as loudly as one that is. Stated
     here because a card publishing a bold dash against a product shipping a
     regular one is the same shape/ink/size drift this helper exists to end. */
  const weight = absent ? "regular" : "bold";

  return `<span style="display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;inline-size:${size};block-size:${size};${surface};font-family:var(--of-type-family-sans);font-size:var(--of-type-size-base);font-weight:var(--of-type-weight-${weight});line-height:1;clip-path:${cutValue(spec.cut)};box-shadow:inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light), inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark)${seat}">${value}</span>`;
}

/**
 * A stat and its word, side by side, in the arrangement the card panel uses.
 *
 * THE PLATE TAKES THE OUTER POSITION AND THE WORD THE INNER ONE. On the panel
 * that means the symbols form a column down each edge and the words face in
 * toward the name between them.
 *
 * NO `outboard` PARAMETER, and it was written and then removed. The gallery
 * draws these as a left-aligned row with no edges to face away from, so an
 * argument for mirroring would have had exactly one caller and one value
 * forever — a knob illustrating a rule rather than obeying one. The prose beside
 * the row carries the mirroring instead, which is what a gallery is for.
 */
function statBadge(kind: string, label: string, value: string): string {
  return `<div style="display:flex;align-items:center;gap:var(--of-space-tight)">${statPlate(kind, value)}<span class="eyebrow" style="margin:0">${label}</span></div>`;
}

/**
 * The light palette, scoped so it can apply to a SUBTREE rather than a document.
 *
 * `themeStylesheet()` keys every block on `:root`, which is correct for a page
 * that is in one theme at a time and useless to a card showing both at once.
 * The side-by-side panes were marked up with a `data-theme` attribute that
 * appears in no stylesheet anywhere — `THEME_ATTRIBUTE` is `data-optfall-theme`
 * — so the selector matched nothing and BOTH panes rendered the dark palette
 * under labels reading "Dark" and "Light". A card whose whole subject is the
 * two themes was showing one of them twice.
 *
 * Generated from `lightTheme` by the same function that builds the stylesheet's
 * own blocks, so this is a re-scoping of the palette and not a second copy of
 * it. `color-scheme` rides along for the reason it does everywhere else: a pane
 * with a light ground should get light form controls inside it.
 */
const LIGHT_PANE = `
[${THEME_ATTRIBUTE}="light"] {
  color-scheme: light;
${toCssDeclarations(lightTheme)}
}
`;

/*
 * Shared chrome for every card: the token layer plus preview scaffolding.
 *
 * THE SILHOUETTES BELOW ARE NAMED, NOT REDRAWN, and that is the fix for how
 * this file went wrong before: its hand-drawn pitch diamond was the ONLY place
 * that shape existed, while the shipped `PitchJewel` clipped an edge-up
 * chamfered square. These cards published a shape the product did not render —
 * the "hand-authored markup does not propagate" weakness at the top of this
 * file, realised. A named token cannot drift from the component naming the same
 * one, and `scripts/check-tokens.ts` fails on a name the theme does not define.
 *
 * NOTE FOR ANYONE EDITING THE CSS BELOW: `SHELL` is a template literal, so a
 * CSS comment written inside it is emitted verbatim into all 13 published
 * cards, and a backtick inside it terminates the string. Notes to future
 * editors — this one included — belong out here in JavaScript, not in there.
 */
const SHELL = `
${TOKENS}
${LIGHT_PANE}
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2rem;
  background: var(--of-color-ground);
  color: var(--of-color-ink);
  font-family: var(--of-type-family-sans);
  font-size: var(--of-type-size-base);
  line-height: var(--of-type-leading-base);
}
h1, h2, h3 { font-family: var(--of-type-family-serif); font-weight: 600; margin: 0; }
.eyebrow {
  font-family: var(--of-type-family-sans);
  font-size: var(--of-type-size-micro);
  letter-spacing: var(--of-type-tracking-wide);
  text-transform: uppercase;
  color: var(--of-color-ink-faint);
  margin: 0 0 var(--of-space-tight);
}
.note { color: var(--of-color-ink-muted); font-size: var(--of-type-size-small); margin: 0; }
.stack { display: flex; flex-direction: column; gap: var(--of-space-looser); }
.row { display: flex; flex-wrap: wrap; gap: var(--of-space-loose); align-items: flex-start; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--of-space-loosest); }
.theme-pane { padding: var(--of-space-loose); border: 1px solid var(--of-color-rule); }
code, .mono { font-family: var(--of-type-family-sans); font-size: var(--of-type-size-small); }

/* -- the primitives, drawn from tokens only -- */
/* THE NUMERAL'S SIZE IS PART OF THE JEWEL, and this had been leaving it to the
   page. \`PitchJewel.css\` sets \`base\` on the stone and \`title\` on \`lg\`; the
   gallery set nothing on the default and \`base\` on \`lg\`, so the default
   inherited whatever prose size it landed in and the large stone published a
   numeral two steps under the component's. Same class of drift the
   \`statPlate\` helper above exists to end, one primitive over. */
.jewel {
  display: inline-flex;
  inline-size: var(--jewel-size); block-size: var(--jewel-size);
  font-family: var(--of-type-family-sans); font-weight: var(--of-type-weight-bold);
  font-size: var(--of-type-size-base);
  line-height: var(--of-type-leading-tight);
  --jewel-size: var(--of-ornament-jewel-base);
  filter: drop-shadow(0 calc(-1 * var(--of-bevel-width)) 0 var(--of-bevel-light))
    drop-shadow(0 var(--of-bevel-width) 0 var(--of-bevel-dark));
}
.jewel .stone {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  inline-size: 100%; block-size: 100%;
  clip-path: var(--of-ornament-cut-jewel);
}
.jewel.sm { --jewel-size: var(--of-ornament-jewel-small); font-size: var(--of-type-size-micro); }
.jewel.lg { --jewel-size: var(--of-ornament-jewel-large); font-size: var(--of-type-size-title); }
.pbox {
  display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box;
  inline-size: var(--pbox-size);
  padding-block: var(--of-space-tighter);
  border-style: solid; border-width: var(--of-bevel-width);
  border-radius: var(--of-bevel-radius);
  border-block-start-color: var(--of-bevel-light);
  border-block-end-color: var(--of-bevel-dark);
  vertical-align: middle;
  --pbox-size: var(--of-ornament-pitch-box-base);
}
.pbox > span {
  writing-mode: vertical-rl; white-space: nowrap;
  font-family: var(--of-type-family-sans); font-weight: var(--of-type-weight-bold);
  font-size: var(--of-type-size-micro);
  line-height: var(--of-type-leading-tight);
  letter-spacing: var(--of-type-tracking-wide); text-transform: uppercase;
}
.pbox.sm { --pbox-size: var(--of-ornament-pitch-box-small); padding-block: var(--of-space-tightest); }
.pbox.sm > span { font-size: var(--of-type-size-legal); }
.pbox.p0 { background: var(--of-color-pitch-none); color: var(--of-color-pitch-none-ink); border-inline-color: var(--of-color-pitch-none); }
.pbox.p1 { background: var(--of-color-pitch-one); color: var(--of-color-pitch-one-ink); border-inline-color: var(--of-color-pitch-one); }
.pbox.p2 { background: var(--of-color-pitch-two); color: var(--of-color-pitch-two-ink); border-inline-color: var(--of-color-pitch-two); }
.pbox.p3 { background: var(--of-color-pitch-three); color: var(--of-color-pitch-three-ink); border-inline-color: var(--of-color-pitch-three); }
.pbox.p4 { background: var(--of-color-pitch-four); color: var(--of-color-pitch-four-ink); border-inline-color: var(--of-color-pitch-four); }
.stone.p0 { background: var(--of-color-pitch-none); color: var(--of-color-pitch-none-ink); }
.stone.p1 { background: var(--of-color-pitch-one); color: var(--of-color-pitch-one-ink); }
.stone.p2 { background: var(--of-color-pitch-two); color: var(--of-color-pitch-two-ink); }
.stone.p3 { background: var(--of-color-pitch-three); color: var(--of-color-pitch-three-ink); }
.stone.p4 { background: var(--of-color-pitch-four); color: var(--of-color-pitch-four-ink); }

.pill {
  display: inline-block; padding: var(--of-space-tightest) var(--of-space-tight);
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-micro);
  letter-spacing: var(--of-type-tracking-wide); text-transform: uppercase;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - var(--of-ornament-notch-size)), calc(100% - var(--of-ornament-notch-size)) 100%, 0 100%);
}
.plate {
  padding: var(--of-space-loose);
  border: var(--of-bevel-width) solid var(--of-color-rule);
  border-radius: var(--of-bevel-radius);
  border-block-start-color: var(--of-bevel-light);
  border-block-end-color: var(--of-bevel-dark);
  background: var(--of-color-surface);
}
.plate.raised { background: var(--of-color-surface-raised); }
.plate.sunken {
  background: var(--of-color-sunken);
  border-block-start-color: var(--of-bevel-dark);
  border-block-end-color: var(--of-bevel-light);
}
hr.rule { border: 0; border-top: var(--of-ornament-rule-width) solid var(--of-color-rule); margin: 0; }
.copyright {
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-legal);
  letter-spacing: var(--of-type-tracking-tight); color: var(--of-color-ink-faint);
}
figure { margin: 0; display: flex; flex-direction: column; gap: var(--of-space-hair); }
figure img {
  display: block; max-inline-size: 100%; border-radius: var(--of-bevel-radius);
  border-block-start: var(--of-bevel-width) solid var(--of-bevel-light);
  border-block-end: var(--of-bevel-width) solid var(--of-bevel-dark);
  border-inline: var(--of-bevel-width) solid var(--of-color-rule);
  background: var(--of-color-sunken);
}

/* -- the seven primitives that had no card of their own until the gate -- */
/* Each block mirrors the component's own stylesheet rather than approximating
   it. That is the same discipline the \`statPlate\` and \`.jewel\` blocks above
   already follow, and for the same reason: a card that invents its own
   rendering is a card that can disagree with the product without anything
   noticing. */

.rule-ornamented {
  display: grid; grid-template-columns: 1fr auto 1fr;
  align-items: center; column-gap: var(--of-space-base);
}
.rule-mark {
  inline-size: var(--of-ornament-filigree-size);
  block-size: calc(var(--of-ornament-filigree-size) / 2);
  background: var(--of-ornament-filigree-ink);
  border-radius: var(--of-bevel-radius);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.citation {
  display: inline-flex; align-items: baseline; gap: var(--of-space-tighter);
  padding-block: var(--of-space-tightest); padding-inline: var(--of-space-tight);
  border-block-start: var(--of-bevel-width) solid var(--of-bevel-light);
  border-block-end: var(--of-bevel-width) solid var(--of-bevel-dark);
  border-inline: var(--of-bevel-width) solid var(--of-color-rule);
  border-radius: var(--of-bevel-radius);
  background: var(--of-color-surface); color: var(--of-color-ink);
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-small);
  font-weight: var(--of-type-weight-medium);
  letter-spacing: var(--of-type-tracking-wide);
  text-decoration: none; white-space: nowrap;
}
.citation .version { color: var(--of-color-ink-muted); font-size: var(--of-type-size-micro); }
.citation.sunk {
  background: var(--of-color-sunken);
  border-block-start-color: var(--of-bevel-dark);
  border-block-end-color: var(--of-bevel-light);
}

.seal {
  display: inline-grid; margin: 0;
  border: var(--of-bevel-width) solid var(--of-color-brass-edge);
  border-block-start-color: var(--of-bevel-light);
  border-block-end-color: var(--of-bevel-dark);
  border-radius: var(--of-bevel-radius);
  background: var(--of-color-brass); color: var(--of-color-brass-ink);
}
.seal .face { display: grid; row-gap: var(--of-space-tightest); padding: var(--of-space-tight) var(--of-space-base); }
.seal .claim {
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-micro);
  font-weight: var(--of-type-weight-bold); letter-spacing: var(--of-type-tracking-wide);
  text-transform: uppercase;
}
.seal .judge {
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-base);
  font-weight: var(--of-type-weight-bold); letter-spacing: var(--of-type-tracking-tight);
}
.seal .date {
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-micro);
  letter-spacing: var(--of-type-tracking-wide); text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}
.seal .band {
  display: flex; align-items: baseline; justify-content: space-between;
  column-gap: var(--of-space-loose);
  padding: var(--of-space-tighter) var(--of-space-base);
  border-block-start: var(--of-ornament-rule-width) solid var(--of-color-brass-edge);
  background: var(--of-color-brass-ink); color: var(--of-color-brass);
}
.seal .band .label {
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-micro);
  letter-spacing: var(--of-type-tracking-wide); text-transform: uppercase;
}
.seal .band .version {
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-small);
  font-weight: var(--of-type-weight-bold); letter-spacing: var(--of-type-tracking-wide);
  font-variant-numeric: tabular-nums;
}

.mark {
  display: inline-block; block-size: var(--of-ornament-mark-base);
  inline-size: auto; overflow: visible;
  filter: drop-shadow(0 calc(-1 * var(--of-bevel-width)) 0 var(--of-bevel-light))
    drop-shadow(0 var(--of-bevel-width) 0 var(--of-bevel-dark));
}
.mark.sm { block-size: var(--of-ornament-mark-small); }
.mark.lg { block-size: var(--of-ornament-mark-large); }
.mark .l0 { fill: var(--of-color-pitch-one); }
.mark .l1 { fill: var(--of-color-pitch-two); }
.mark .l2 { fill: var(--of-color-pitch-three); }
.mark.ink .l0, .mark.ink .l2 { fill: currentColor; }
.mark.ink .l1 { fill: var(--of-color-accent); }

.result {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--of-space-tight);
  padding-block: var(--of-space-base);
  border-block-start: var(--of-ornament-rule-width) solid var(--of-color-rule);
}
.result .body { flex: 1 1 60%; min-inline-size: 0; }
.result .name {
  font-family: var(--of-type-family-serif); font-size: var(--of-type-size-large);
  letter-spacing: var(--of-type-tracking-tight);
  color: var(--of-color-ink); text-decoration: none;
}
.result .meta {
  display: flex; flex-wrap: wrap; gap: var(--of-space-tight);
  margin-block: var(--of-space-tightest) 0;
  font-family: var(--of-type-family-sans); font-size: var(--of-type-size-micro);
  letter-spacing: var(--of-type-tracking-wide); text-transform: uppercase;
  color: var(--of-color-ink-faint);
}
.result .meta span { color: var(--of-color-ink-muted); }
.result .line { margin: 0; }
ul.results { list-style: none; margin: 0; padding: 0; }

/* The plate's four ornament slots — placed and sized by the plate, drawn by
   whatever the caller mounts into them. */
.plate.ornamented { position: relative; padding: var(--of-space-loosest); }
.corner {
  position: absolute;
  inline-size: calc(var(--of-ornament-filigree-size) * 2);
  block-size: calc(var(--of-ornament-filigree-size) * 2);
  color: var(--of-ornament-filigree-ink);
}
.corner[data-corner="start-start"] { inset-block-start: 0; inset-inline-start: 0; }
.corner[data-corner="start-end"] { inset-block-start: 0; inset-inline-end: 0; }
.corner[data-corner="end-start"] { inset-block-end: 0; inset-inline-start: 0; }
.corner[data-corner="end-end"] { inset-block-end: 0; inset-inline-end: 0; }
.corner svg { display: block; inline-size: 100%; block-size: 100%; overflow: visible; }
.filigree-figure {
  display: block; block-size: var(--of-ornament-filigree-size);
  inline-size: auto; overflow: visible; color: var(--of-ornament-filigree-ink);
}
.filigree-ink { stroke: currentColor; fill: currentColor; }
/* Light above, dark below: the same bevel the plates use, applied to a line.
   This is what stops the scrollwork reading as a decal on the surface. */
.filigree-relief-light { stroke: var(--of-bevel-light); fill: var(--of-bevel-light); }
.filigree-relief-dark { stroke: var(--of-bevel-dark); fill: var(--of-bevel-dark); }
`;

/* -------------------------------------------------------------------------- */
/* The taxonomy                                                                */
/* -------------------------------------------------------------------------- */

/**
 * THE SANCTIONED TOP-LEVEL GROUPS, in sidebar order. Closed on purpose.
 *
 * `docs/DESIGN.md` is the prose half of this; `design-system-coverage.test.ts`
 * is the executable one. The vocabulary is three words because the bundle
 * answers exactly three questions, and a card belongs to whichever one it
 * answers:
 *
 * - **Foundations** — the material the system is made of, before any component
 *   exists. Tokens: colour, type, spacing. Free-form titles, because these
 *   document the system rather than living in it.
 * - **Primitives** — one card per entry in `PRIMITIVES`, and nothing else. The
 *   leaf IS the primitive id, so the card cannot drift from what it documents.
 * - **Screens** — whole product surfaces assembled from primitives, which is
 *   the exit criterion `PRIMITIVES` exists to check. Free-form titles, because
 *   a screen is named by its route rather than by a component.
 *
 * Adding a fourth group is a real decision: put it here with its gloss and
 * write it into `docs/DESIGN.md`. Do NOT invent one in a card.
 */
export const DS_GROUPS = ["Foundations", "Primitives", "Screens"] as const;

export type DsGroup = (typeof DS_GROUPS)[number];

/**
 * Which directory each group is emitted into.
 *
 * The group and the path prefix are two spellings of one fact, so they are
 * derived from each other here rather than typed twice per card — the bundle
 * already shipped `group: "Primitives"` beside `path: "primitives/…"` thirteen
 * times, which is thirteen chances for the two to disagree.
 */
export const GROUP_DIR: Readonly<Record<DsGroup, string>> = {
  Foundations: "foundations",
  Primitives: "primitives",
  Screens: "screens",
};

/**
 * A primitive id, spelled as the card title: `pitch-jewel` → `Pitch jewel`.
 *
 * Sentence case rather than Title Case because that is what the six primitive
 * cards that predate this check already used, unprompted and unanimously. The
 * point is not the casing — it is that the title is DERIVED from the id, so
 * there is no spelling for an author to choose and therefore none to drift.
 */
export function primitiveCardTitle(id: PrimitiveName): string {
  const words = id.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface Card {
  path: string;
  group: DsGroup;
  title: string;
  body: string;
  /** Rendered twice, once per theme, when the card is about colour. */
  bothThemes?: boolean;
}

export function page(card: Card): string {
  const inner = card.bothThemes
    ? `<div class="pair">
         <div class="theme-pane" ${THEME_ATTRIBUTE}="dark"><p class="eyebrow">Dark — the native key</p>${card.body}</div>
         <div class="theme-pane" ${THEME_ATTRIBUTE}="light"><p class="eyebrow">Light — the printed rulebook</p>${card.body}</div>
       </div>`
    : card.body;

  return `<!-- @dsCard group="${card.group}" -->
<!doctype html>
<html lang="en" ${THEME_ATTRIBUTE}="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${card.title} — Optfall</title>
<style>${SHELL}</style>
</head>
<body>
<div class="stack">
  <div>
    <p class="eyebrow">${card.group}</p>
    <h1>${card.title}</h1>
  </div>
  ${inner}
</div>
</body>
</html>
`;
}

const swatch = (id: string, label: string) => `
<div style="display:flex;align-items:center;gap:var(--of-space-tight)">
  <span style="inline-size:var(--of-space-loosest);block-size:var(--of-space-looser);background:var(${id});border:1px solid var(--of-color-rule);display:inline-block"></span>
  <span class="mono">${label}</span>
</div>`;

/**
 * The mark, DRAWN FROM `MARK_GEOMETRY` rather than from a copy of its numbers.
 *
 * That constant's own documentation says it exists because the geometry "has
 * two consumers and must not have two definitions" — the component and the
 * favicon endpoint. This card is the third, and it takes the same route rather
 * than becoming the second drawing that drifts.
 */
let markSeq = 0;
function markSvg(variant: "pitch" | "ink" = "pitch", size = ""): string {
  /*
    Ids are per-instance because this card renders the mark six times. Every
    `url(#…)` reference resolves to the FIRST matching id in the document, so a
    shared id would clip every later mark against the first one's rectangles —
    the same failure `Mark.tsx` uses `useId` to avoid.
  */
  markSeq += 1;
  const id = `mark-${markSeq}`;
  const link = (index: number) =>
    `<path class="l${index}" d="${MARK_GEOMETRY.link}" fill-rule="evenodd"/>`;

  const defs = MARK_GEOMETRY.scopes
    .map(
      (scope, i) =>
        `<clipPath id="${id}-s${i}"><rect x="${scope.x}" y="${scope.y}" width="${scope.width}" height="${scope.height}"/></clipPath>`,
    )
    .join("");

  // Every link, left to right — this settles each pair's LOWER crossing.
  const links = MARK_GEOMETRY.placements
    .map((placement, i) => `<g transform="${placement}">${link(i)}</g>`)
    .join("");

  // And the UPPER crossing, by redrawing the left-hand link inside a rectangle
  // that contains only that crossing.
  const upper = MARK_GEOMETRY.scopes
    .map(
      (scope, i) =>
        `<g clip-path="url(#${id}-s${i})"><g transform="${MARK_GEOMETRY.placements[scope.link]}">${link(scope.link)}</g></g>`,
    )
    .join("");

  const cls = ["mark", size, variant === "ink" ? "ink" : ""]
    .filter(Boolean)
    .join(" ");

  return `<svg class="${cls}" viewBox="${MARK_GEOMETRY.viewBox}" role="img" aria-label="Optfall" focusable="false"><defs>${defs}</defs>${links}${upper}</svg>`;
}

/**
 * Filigree, in one of its three sanctioned roles, drawn from `FILIGREE_PATHS`.
 *
 * Same argument as `markSvg`: the paths moved into the contract module so this
 * card and `FiligreeCorner` cannot disagree about what the scrollwork is. The
 * sizing below is deliberately NOT shared — box, stroke weight and relief lift
 * are presentation, and the component picks its own by role.
 */
function filigreeSvg(
  role: "panel-corner" | "card-corner" | "section-rule",
  corner: PlateCorner = "start-start",
): string {
  const isPanel = role === "panel-corner";
  const isRule = role === "section-rule";
  const weight = isRule ? 1.4 : isPanel ? 1.6 : 1.3;
  const lift = isPanel ? 1.1 : 0.8;

  /* Ink last, so it sits on top of both relief passes. */
  const passes = [
    ["filigree-relief-dark", lift],
    ["filigree-relief-light", -lift],
    ["filigree-ink", 0],
  ] as const;

  const draw = (paths: {
    strokes: readonly string[];
    fills: readonly string[];
  }) =>
    paths.strokes.map((d) => `<path d="${d}" fill="none"/>`).join("") +
    paths.fills.map((d) => `<path d="${d}" stroke="none"/>`).join("");

  const attrs = `aria-hidden="true" focusable="false" stroke-linecap="butt" stroke-linejoin="miter" stroke-width="${weight}"`;

  if (isRule) {
    const half = draw(FILIGREE_PATHS.rule);
    const body = passes
      .map(
        ([tone, shift]) =>
          `<g class="${tone}" transform="translate(0 ${shift})">` +
          `<g transform="translate(0 0)">${half}</g>` +
          `<g transform="translate(72 0) scale(-1 1)">${half}</g>` +
          `<path d="${FILIGREE_PATHS.rule.centre}" stroke="none"/>` +
          `</g>`,
      )
      .join("");
    return `<svg class="filigree-figure" viewBox="${FILIGREE_PATHS.rule.viewBox}" ${attrs}>${body}</svg>`;
  }

  const set = isPanel ? FILIGREE_PATHS.panel : FILIGREE_PATHS.card;
  const box = isPanel ? 48 : 32;
  const motif = draw(set);

  /*
    THE RELIEF PASS IS OUTSIDE THE MIRROR, AND THE ORDER IS THE POINT. Light
    comes from above in every corner of the frame, so the light pass has to sit
    above the ink in SCREEN space. Nested the other way round, the two `end-*`
    corners would carry their bevel upside down.
  */
  const body = passes
    .map(
      ([tone, shift]) =>
        `<g class="${tone}" transform="translate(0 ${shift})">` +
        `<g transform="translate(${box / 2} ${box / 2}) ${FILIGREE_PATHS.mirror[corner]} translate(${-box / 2} ${-box / 2})">${motif}</g>` +
        `</g>`,
    )
    .join("");

  return `<svg viewBox="0 0 ${box} ${box}" ${attrs}>${body}</svg>`;
}

export const cards: Card[] = [];

/* ---------------------------------------------------------------- Foundations */

cards.push({
  path: "foundations/colour.html",
  group: "Foundations",
  title: "Colour",
  bothThemes: true,
  body: `
  <p class="note">Neutrals with no colour cast — the grey of unpolished steel. Boldness is spent in two places and nowhere else.</p>
  <div class="stack" style="gap:var(--of-space-loose);margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">Ground and surface</p>
      ${swatch("--of-color-ground", "ground")}${swatch("--of-color-sunken", "sunken")}${swatch("--of-color-surface", "surface")}${swatch("--of-color-surface-raised", "surface.raised")}
    </div>
    <div>
      <p class="eyebrow">Ink</p>
      ${swatch("--of-color-ink", "ink")}${swatch("--of-color-ink-muted", "ink.muted")}${swatch("--of-color-ink-faint", "ink.faint")}
    </div>
    <div>
      <p class="eyebrow">Spent once each</p>
      ${swatch("--of-color-accent", "accent — blood")}${swatch("--of-color-brass", "brass — authority only")}
    </div>
    <div>
      <p class="eyebrow">Pitch — data, never decoration</p>
      ${swatch("--of-color-pitch-one", "pitch.one")}${swatch("--of-color-pitch-two", "pitch.two")}${swatch("--of-color-pitch-three", "pitch.three")}${swatch("--of-color-pitch-four", "pitch.four")}
    </div>
  </div>`,
});

cards.push({
  path: "foundations/type.html",
  group: "Foundations",
  title: "Two voices",
  body: `
  <p class="note">Strictly assigned by role, never chosen per usage. There were three; the monospace face was retired because it had spread to chrome and stopped marking anything.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">Serif — card names, questions, headings</p>
      <p style="font-family:var(--of-type-family-serif);font-size:var(--of-type-size-display);margin:0">Command and Conquer</p>
      <p style="font-family:var(--of-type-family-serif);font-size:var(--of-type-size-title);margin:0">Head Jab</p>
      <p style="font-family:var(--of-type-family-serif);font-size:var(--of-type-size-large);margin:0">Winter's Wail</p>
    </div>
    <hr class="rule">
    <div>
      <p class="eyebrow">Sans — interface text</p>
      <p style="margin:0">Legality is present-day only, and every verdict prints the upstream flags it was derived from.</p>
      <p class="note" style="margin:0">Small — apparatus and provenance.</p>
    </div>
    <hr class="rule">
    <div>
      <p class="eyebrow">Sans, wide-tracked uppercase — labels</p>
      <p class="mono" style="letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;margin:0">Classic Constructed</p>
      <p class="mono" style="margin:0">cr:8.3.4b &nbsp; MST131 &nbsp; cc_banned_start</p>
    </div>
  </div>`,
});

cards.push({
  path: "foundations/space.html",
  group: "Foundations",
  title: "Spacing and the bevel",
  body: `
  <p class="note">A restrained ramp: density without clutter means fewer sizes used deliberately, not more used approximately.</p>
  <div class="stack" style="gap:var(--of-space-tight);margin-block-start:var(--of-space-loose)">
    ${[
      "hair",
      "tightest",
      "tighter",
      "tight",
      "base",
      "loose",
      "looser",
      "loosest",
    ]
      .map(
        (
          step,
        ) => `<div style="display:flex;align-items:center;gap:var(--of-space-base)">
          <span class="mono" style="inline-size:5rem;color:var(--of-color-ink-muted)">${step}</span>
          <span style="block-size:var(--of-space-tight);inline-size:var(--of-space-${step});background:var(--of-color-accent);display:inline-block"></span>
        </div>`,
      )
      .join("")}
  </div>
  <hr class="rule" style="margin-block:var(--of-space-looser)">
  <p class="eyebrow">Everything is bevelled, nothing is rounded</p>
  <div class="row">
    <div class="plate">flat</div>
    <div class="plate raised">raised</div>
    <div class="plate sunken">sunken</div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-tight)">A light top edge and a dark bottom edge, so surfaces read as struck plate. <code>bevel.radius</code> exists only to be zero.</p>`,
});

/* ----------------------------------------------------------------- Primitives */

cards.push({
  path: "primitives/pitch-jewel.html",
  group: "Primitives",
  title: "Pitch jewel",
  body: `
  <p class="note">An eight-sided cut stone carrying its numeral. Shape, number and colour state the same fact three times — and the numeral is the <strong>primary</strong> channel, not a fallback.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);align-items:center">
    ${jewel("0")}${jewel("1")}${jewel("2")}${jewel("3")}${jewel("4")}
    ${jewel("1", "sm")}${jewel("1")}${jewel("1", "lg")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">Red and yellow are the classic deuteranopia confusion pair, pitch is the most-read value on a card, and it is the same pair the leading commercial scanner misreads. Designing colour as the <em>redundant</em> channel costs nothing and fixes it for everyone downstream. The silhouette is reserved: nothing else in the interface is ever this shape.</p>
  <p class="note"><strong>Pitch four is drawn here before it is drawn anywhere in the product.</strong> A fourth value has been previewed — a purple strip on a Shadow resource gem, card code <code>IAR000</code> — and no card in the pinned corpus carries <code>pitch: "4"</code> yet, though the corpus does already hold other cards from that set. It sits beside the other four rather than being kept as a special case, because a stone the reader meets once is the one whose colour they will not have learned. It is also the stone whose colour channel is weakest: purple sits beside blue in luminance wherever it is still legible under white ink, so for a reader with deuteranopia or protanopia the numeral is what separates three from four.</p>`,
});

cards.push({
  path: "primitives/pitch-box.html",
  group: "Primitives",
  title: "Pitch box",
  body: `
  <p class="note">The same value as the jewel, written out and stood on end. This is the rendering for a LIST or a GRID — the card index, the version tabs, the related links, the breadcrumb — and it replaced the stone at every one of those sites.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);align-items:center">
    ${pitchBox("0")}${pitchBox("1")}${pitchBox("2")}${pitchBox("3")}${pitchBox("4")}
    ${pitchBox("1", "sm")}${pitchBox("1")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>Why the stones left the lists.</strong> A jewel is an object: one card, one value, set beside the name of the thing it belongs to on a page about that thing. Down the left of a list it became a scatter of cut gems, each one an ornament competing with the name it was captioning — and a row in this index stands for a NAME, which in this game is commonly three cards, so it was three of them per row.</p>
  <p class="note"><strong>The words are the point, not a caption on an icon.</strong> Red and yellow are the classic deuteranopia confusion pair and pitch is the most-read value on a card; the jewel answers that with a numeral, which is still one glyph a reader has to know the grammar of. "PITCH 1" is the fact spelled, which leaves colour doing what colour should do in this system — repeating something already said.</p>
  <p class="note"><strong>The text runs down the box rather than across it</strong>, which is what makes the mark a spine rather than a tag: horizontally it is a column of prose wide enough to be read as part of the name beside it, vertically it is an edge. It also keeps the WIDTH fixed and independent of the value, so three boxes on one row are three equal columns rather than a ragged strip. Sized across by a token and along by its own words — a height token would be a second copy of a measurement the text already owns.</p>`,
});

/**
 * A pitch band, in the shape `PitchRule` renders — one per value, ascending.
 *
 * Struck like every other plate: a light edge above and a dark one below,
 * carried on a zero-blur shadow so the band stays exactly its own thickness of
 * layout. Named tokens only, so this card cannot draw a mark the product does
 * not.
 */
function band(pitch: string | number): string {
  return `<span style="display:block;inline-size:var(--of-ornament-band-base);block-size:calc(var(--of-bevel-width) * 3);background:var(--of-color-pitch-${["none", "one", "two", "three", "four"][Number(pitch)]});border-radius:var(--of-bevel-radius);box-shadow:0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-light), 0 var(--of-bevel-width) 0 0 var(--of-bevel-dark)"></span>`;
}

cards.push({
  path: "primitives/pitch-rule.html",
  group: "Primitives",
  title: "Pitch rule",
  body: `
  <p class="note">The same value as the jewel, rendered for under a card face. Not a replacement and not a variant: the jewel goes wherever there is a line of type to sit a stone beside, and this goes in the one place a stone cannot — under a picture.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);gap:var(--of-space-loosest);align-items:flex-start">
    ${[
      ["Head Jab", ["1"]],
      ["Head Jab", ["1", "2", "3"]],
      ["Aether Ironweave", ["0"]],
    ]
      .map(
        ([name, values]) => `<div style="text-align:center">
          <p style="font-family:var(--of-type-family-serif);font-size:var(--of-type-size-small);color:var(--of-color-ink);margin:0 0 var(--of-space-tighter)">${name}</p>
          <span style="display:flex;justify-content:center;gap:var(--of-space-tighter)">${(values as string[]).map(band).join("")}</span>
        </div>`,
      )
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>Plural where the jewel is singular.</strong> A card page shows one card and has one pitch; a cell in a card index stands for a NAME, and a name in this game is commonly three cards. One band per value is a fact the jewel has no way to state — and what it replaced was the words "pitch 1, pitch 2", printed only when SOME versions matched, so the ordinary case said nothing and a reader could not tell a single-version card from a collapsed one.</p>
  <p class="note"><strong>Colour carries more weight here than this system otherwise allows, and that is the stated cost.</strong> A band has no room for a numeral, so the redundancy moves to the accessible layer: the element is a <code>role="img"</code> with a written name, always, spelling the values out — "Pitch 1, 2 and 3". The COUNT of bands and their fixed ascending ORDER are the two non-colour channels that remain, and both text views of the same index carry numbered stones instead.</p>
  <p class="note">A card with no pitch — equipment, weapons — draws the grey <code>none</code> tone rather than nothing, exactly as the jewel draws a grey stone with a dash. An empty list is the different claim that the pitch is unknown, and draws no mark at all.</p>`,
});

cards.push({
  path: "primitives/state-pill.html",
  group: "Primitives",
  title: "State pill",
  body: `
  <p class="note">The notched corner is the only ornament in the system and it always means something: this thing carries state.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose)">
    ${[
      ["legal", "Legal"],
      ["banned", "Banned"],
      ["suspended", "Suspended"],
      ["restricted", "Restricted"],
      ["living-legend", "Living Legend"],
      ["not-in-format", "Not in format"],
      ["verified", "Verified"],
      ["unverified", "Unverified"],
    ]
      .map(
        ([tone, label]) =>
          `<span class="pill" style="background:var(--of-color-state-${tone});color:var(--of-color-state-${tone}-ink)">${label}</span>`,
      )
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">The label <strong>names the state</strong> — "Banned", never "Classic Constructed" — because the text is the primary channel and colour is the redundant one. A verdict is a <em>list</em> of these: one card is banned <em>and</em> a Living Legend, and a scheme that picked one would discard a true fact.</p>`,
});

cards.push({
  path: "primitives/card-face.html",
  group: "Primitives",
  title: "Card face",
  body: `
  <p class="note">The printed image, and the copyright line that is the condition of being allowed to show it. There is no prop and no variant that can drop the notice — a caller who wants the image gets the line.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose)">
    <figure>
      <img src="${FACE}/normal/MST131.webp" alt="Command and Conquer" width="240" height="335">
      <figcaption class="copyright">Card images © Legend Story Studios.</figcaption>
    </figure>
    <figure>
      <img src="${FACE}/placeholder/portrait.svg" alt="No image published" width="240" height="335">
      <figcaption class="copyright">Card images © Legend Story Studios.</figcaption>
    </figure>
    <figure>
      <img src="${FACE}/thumb/MST131.webp" alt="Command and Conquer" width="120" height="167">
      <figcaption class="copyright">Card images © Legend Story Studios.</figcaption>
    </figure>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">Two tiers — <code>thumb</code> 180&times;251 and <code>normal</code> 450&times;628 — dictated by the narrowest upstream source rather than chosen, because Optfall does not invent pixels. NO IMAGE is a real asset at the card's own 63:88, so a grid never reflows around a hole.</p>`,
});

cards.push({
  path: "primitives/stat-glyph.html",
  group: "Primitives",
  title: "Stat glyph",
  body: `
  <p class="note">A printed stat in a struck plate whose silhouette says which stat it is. <code>docs/DESIGN.md</code> asked for "cost in a hexagonal plate, power and defence in chamfered plates at the corners"; the three the card itself draws have since taken the card's own geometry instead, and the note below says why.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);align-items:center;gap:var(--of-space-looser);flex-wrap:wrap">
    ${[
      ["cost", "0"],
      ["power", "3"],
      ["defence", "2"],
      ["life", "20"],
      ["intellect", "4"],
      ["arcane", "1"],
    ]
      .map(([kind, value]) => statBadge(kind ?? "", kind ?? "", value ?? ""))
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-looser)"><strong>A stat the card does not print — which is not a stat printed 0.</strong></p>
  <div class="row" style="margin-block-start:var(--of-space-tight);align-items:center;gap:var(--of-space-looser);flex-wrap:wrap">
    ${[
      ["cost", "0"],
      ["cost", "–"],
      ["power", "0"],
      ["power", "–"],
      ["defence", "0"],
      ["defence", "–"],
    ]
      .map(([kind, value]) => statBadge(kind ?? "", kind ?? "", value ?? ""))
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-tight)">1,648 cards print a cost of 0, 191 a defence of 0 and 13 a power of 0, so both members of each pair above are real and a reader has to be able to tell them apart. <strong>The silhouette survives the absence</strong> — the shape is what says WHICH stat is missing — and only the fill changes, to a plate that recedes against the ground rather than a seventh colour with a meaning of its own. Spoken as "no printed power", never as a dash. The card page draws these three whether or not a card fills them, because the frame reserves the positions; a hero, which has none of them, gets none.</p>
  <p class="note" style="margin-block-start:var(--of-space-loose)">The house vocabulary is a square plate, chamfered differently, and arcane is the last stat wearing it — see below for what the other five took instead. <strong>None is eight-sided:</strong> the pitch jewel owns that outline and the system promises it means pitch, so a stat glyph that happened to be an octagon would spend the one shape that is spoken for. That still binds every plate here, discs included. The numeral stays the primary channel and the label stays visible; the silhouette is the third redundant carrier, never the only one — which is what lets four of the six share the disc without a value becoming unreadable.</p>
  <p class="note"><strong>Five of the six break the vocabulary on purpose</strong>, and the test is whether the game prints a notation for the stat. Cost, power and defence are the three a player knows by sight, so they take the card's own geometry rather than a grey square that has to be read to be identified: two discs and a shield. Intellect and life earn it the same way — the Comprehensive Rules name <code>{i}</code> at 1.12.4b and <code>{h}</code> at 1.12.4c, and LSS publishes both as discs — so they take the card's blue and green. All of it drawn by us in tokens from our own palette: the register, none of the artwork. A player looking for attack is looking for a yellow disc.</p>
  <p class="note"><strong>Arcane is the exception, and it is the one that proves the rule.</strong> 1.12.4 names eight symbols and arcane is not among them, so there is no printed register to take. It keeps the chamfered plate in the default ink, which is now exactly what "this stat has no notation of its own" looks like rather than a default the others happened to share.</p>
  <p class="note"><strong>One size, three areas, so the boxes are not all the same.</strong> The eye compares ink rather than bounding boxes: a chamfered plate keeps about 21% more of its box than a disc does. Each plate is therefore scaled by the square root of its silhouette's area against the disc's π/4. Four of the six are discs and so take the reference factor untouched — only the shield and arcane's chamfered plate are still being compensated, which is what makes the row above read as one size.</p>
  <p class="note"><strong>The word sits beside the plate, never above it</strong> — and on the card panel it sits <em>inboard</em> of it, so the plates line the two edges of the panel and the words face in toward the name and the type line between them.</p>
  <p class="note">No LSS symbol is reproduced. These are the system's own plates carrying our numerals — the same move the mark made: take the register, none of the form.</p>`,
});

/**
 * A silhouette, read out of the token table rather than copied beside it.
 *
 * THE GALLERY IS STATIC HTML, so every earlier primitive page hardcoded its own
 * `clip-path` — harmless while the prose made no claim about it, and not
 * harmless on the symbol page, which says the shapes are "read from
 * `ornament.cut.*` so the two cannot drift". A claim stronger than its
 * mechanism is worse than no claim: it tells the next reader a guarantee exists
 * where none does. This makes the mechanism match.
 *
 * `--chamfer` is substituted with the notch token's own value, because the
 * gallery has no component setting it — the shipped components do.
 */
function cutValue(id: string): string {
  const raw = DARK_TOKENS[`ornament.${id}`];
  const chamfer = DARK_TOKENS["ornament.notch.size"];
  // A missing token is a renamed or deleted cut, and the gallery should fail
  // loudly rather than silently render an unclipped square that looks like a
  // deliberate shape.
  if (raw === undefined)
    throw new Error(`no such silhouette token: ornament.${id}`);
  if (chamfer === undefined) throw new Error("ornament.notch.size is missing");
  return raw.replaceAll("var(--chamfer)", chamfer);
}

cards.push({
  path: "primitives/game-symbol.html",
  group: "Primitives",
  title: "Game symbol",
  body: `
  <p class="note">The markers upstream prints inside card text — <code>{p}</code>, <code>{r}</code>, <code>{t}</code> — as struck plates. <strong>The same silhouettes the stat glyph uses</strong>, read from <code>ornament.cut.*</code> in the token layer so the two cannot drift: the plate you meet inline in <code>+1{p}</code> is the plate carrying <code>4</code> in the stat block above it.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);align-items:flex-start;gap:var(--of-space-looser);flex-wrap:wrap">
    ${(
      [
        /* READ OFF `GameSymbol.css`, NOT REMEMBERED. Four of these were wrong:
           this table advertised `cut.lean.end` for power, `cut.hexagon` for
           resource and `cut.lean.start` for defence long after the component
           moved all three to the card's own geometry, and every plate here was
           drawn in the bare surface ink while the component gave the value
           symbols the stat tones. A gallery whose whole claim is "the same
           silhouettes the stat glyph uses" was the one surface publishing
           shapes the product does not render — the exact drift `ornament.cut.*`
           was lifted into the token layer to end, arriving through the colour
           and the table instead of through the shape. */
        ["{p}", "P", "power", "cut.disc", "power"],
        ["{r}", "R", "resource", "cut.disc", "cost"],
        ["{d}", "D", "defence", "cut.shield", "defence"],
        ["{h}", "H", "life", "cut.disc", "life"],
        ["{i}", "I", "intellect", "cut.disc", "intellect"],
        /* The three with no stat of their own keep the bare plate: chi is a
           value the stat block never carries, and tap and untap are effects. */
        ["{c}", "C", "chi", "cut.crown", null],
        ["{t}", "T", "tap", "cut.side.end", null],
        ["{u}", "U", "untap", "cut.side.start", null],
      ] as readonly (readonly [string, string, string, string, string | null])[]
    )
      .map(
        ([
          token,
          letter,
          name,
          cut,
          tone,
        ]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:var(--of-space-tight)">
          <span style="display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;inline-size:2.25rem;block-size:2.25rem;${
            tone === null
              ? "background:var(--of-color-surface-raised);color:var(--of-color-ink)"
              : `background:var(--of-color-stat-${tone});color:var(--of-color-stat-${tone}-ink)`
          };font-weight:var(--of-type-weight-bold);clip-path:${cutValue(cut)}${
            /* The shield seats its numeral in the body, not the box — the same
               fraction the component uses, for the same reason. */
            name === "defence" ? ";padding-block-end:calc(2.25rem * 0.28)" : ""
          };box-shadow:inset 0 1px 0 0 var(--of-bevel-light), inset 0 -1px 0 0 var(--of-bevel-dark)">${letter}</span>
          <span class="eyebrow" style="margin:0">${name}</span>
          <code style="font-size:var(--of-type-size-micro);color:var(--of-color-ink-faint)">${token}</code>
        </div>`,
      )
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>The table is the rules', not ours.</strong> The Comprehensive Rules defines all eight at 1.12.4a&ndash;h — "the power symbol is {p} and represents a power value" — so rendering them is the same join this site already makes between a keyword and the rule that governs it, and every symbol on a card page links to the rule that defines it. A ninth marker, <code>{x}</code>, appears on two cards and is <em>not</em> in that table; it is drawn as a plain italic letter and flagged as inferred rather than filed with the rest.</p>
  <p class="note"><strong>The last two are cut differently on purpose.</strong> The rules distinguish symbols that represent a <em>value</em> from those that represent an <em>effect</em> — 1.12.4g says tap "represents the tap effect" — so tap and untap are cut down a whole side rather than at a corner, and read as verbs before the letter is read. None is eight-sided: that outline belongs to the pitch jewel, which is why chi takes two corners rather than the four it wants.</p>
  <p class="note">The letter is upstream's, never a tidier one: life is <strong>H</strong> because the marker is <code>{h}</code>. Calling it L would make this the one surface in the project that spells the game's own marker differently. The accessible name says "life" in full.</p>
  <p class="note">No LSS symbol is reproduced. These are not redrawn resource or attack pips — they are the system's own plates carrying the letter upstream itself writes between the braces.</p>`,
});

cards.push({
  path: "primitives/search-field.html",
  group: "Primitives",
  title: "Search field",
  body: `
  <p class="note">The hero control, shared by every search surface. It is a <strong>form</strong>, not a text box — the <code>method="get"</code> is what makes the no-JS path work.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">Search the cards</p>
      <div class="plate sunken" style="display:flex;gap:var(--of-space-tight);align-items:center">
        <span style="flex:1;font-family:var(--of-type-family-serif);font-size:var(--of-type-size-title);color:var(--of-color-ink-faint)">command and conquer</span>
        <span class="pill" style="background:var(--of-color-surface-raised);color:var(--of-color-ink);clip-path:none;border:1px solid var(--of-color-rule)">Search</span>
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)"><code>pitch:3 class:guardian</code> is Card Vault's own syntax · <code>banned:cc</code> is ours · <code>/</code> returns here.</p>
    </div>
    <div>
      <p class="eyebrow">With typeahead open</p>
      <div class="plate sunken" style="display:flex;gap:var(--of-space-tight);align-items:center">
        <span style="flex:1;font-family:var(--of-type-family-serif);font-size:var(--of-type-size-title)">head jab</span>
      </div>
      <ul style="list-style:none;margin:var(--of-space-tight) 0 0;padding:0;border-top:1px solid var(--of-color-rule)">
        ${(
          [
            ["Head Jab", "123"],
            ["Sever Head Jab", "12"],
          ] as const
        )
          .map(
            (
              [name, pitches],
              i,
            ) => `<li style="display:flex;align-items:center;gap:var(--of-space-base);padding-block:var(--of-space-tight);${i === 0 ? "box-shadow:inset var(--of-bevel-width) 0 0 0 var(--of-color-accent);padding-inline-start:var(--of-space-tight);color:var(--of-color-accent)" : ""}">
              <span style="display:inline-flex;gap:var(--of-space-tightest)">${[...(pitches as string)].map((p) => jewel(p, "sm")).join("")}</span>
              <span style="font-family:var(--of-type-family-serif);font-size:var(--of-type-size-large)">${name}</span>
            </li>`,
          )
          .join("")}
      </ul>
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">Every suggestion is a <strong>destination</strong>, not a result — picking one navigates to that card. Nothing re-ranks while you type.</p>`,
});

/*
  THE SEVEN CARDS BELOW REPLACE ONE.

  `primitives/rule-and-citation.html` was a gallery: one card titled "Rules,
  citations and brass" standing in for three primitives, while four more —
  bevelled plate, filigree corner, mark, result row — had no card at all. Seven
  of the thirteen entries in `PRIMITIVES` were undemonstrated, which is what
  `design-system-coverage.test.ts` now fails on.

  A gallery is the specific failure worth naming, because it looks like
  coverage. Two of the three primitives it covered had ALREADY drifted inside
  it, unnoticed, exactly as a shared card invites:

  - The citation was captioned "monospaced, so you can paste it". The monospace
    face was retired from this system — `Citation.css` sets the sans label voice
    — so the card advertised a rendering the component does not have, and named
    the retired face as the reason the primitive works.
  - The brass seal was a flat inline badge reading "Verified · judge name ·
    2026-08-12". The component is a two-part struck plate whose lower band
    carries the rules version in inverted material, which `docs/PLAN.md` Phase 5
    requires be impossible to miss. The card had no band and no version.

  One card per primitive is what makes that kind of drift a diff.
*/

cards.push({
  path: "primitives/bevelled-plate.html",
  group: "Primitives",
  title: "Bevelled plate",
  body: `
  <p class="note">The substrate everything else sits on. A light top edge and a dark bottom edge, so a surface reads as struck plate rather than as a box. <code>bevel.radius</code> exists only to be zero.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">Emphasis — the depth axis</p>
      <div class="row">
        <div class="plate">flat</div>
        <div class="plate raised">raised</div>
        <div class="plate sunken">sunken</div>
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)">Raised is lit from above, which is where light comes from. Sunken keeps the same light source and drops the surface below the ground, so the shadow falls on the near edge — inverting the bevel is the whole of it, and the face darkens to agree with the geometry rather than to replace it.</p>
    </div>
    <hr class="rule">
    <div>
      <p class="eyebrow">Ornament — the one place filigree may sit on a plate</p>
      <div class="plate raised ornamented">
        <span class="corner" data-corner="start-start">${filigreeSvg("panel-corner", "start-start")}</span>
        <span class="corner" data-corner="start-end">${filigreeSvg("panel-corner", "start-end")}</span>
        <span class="corner" data-corner="end-start">${filigreeSvg("panel-corner", "end-start")}</span>
        <span class="corner" data-corner="end-end">${filigreeSvg("panel-corner", "end-end")}</span>
        <p class="eyebrow" style="margin:0">Feature panel</p>
        <p style="margin:var(--of-space-tight) 0 0">A feature panel is the one surface in this system allowed to be emphatic.</p>
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)"><strong>The plate hosts the filigree; it does not draw it.</strong> It opens four slots and places and sizes them — only the plate knows where its corners are — and the caller composes the ornament in. That keeps scrollwork rationed by the call site, which can see the whole screen, rather than by a plate that can only see itself. The padding steps up to <code>space.loosest</code> so the first line of text clears its own corner.</p>
    </div>
  </div>`,
});

cards.push({
  path: "primitives/ornamental-rule.html",
  group: "Primitives",
  title: "Ornamental rule",
  body: `
  <p class="note">The primitive that replaces the card. Where a lesser system would box a section, this one draws a line and moves on — <em>density without clutter, held together by tight vertical rhythm and hairline rules rather than cards, shadows and padding</em>.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">The rule — a thematic break, and every one on the site is this</p>
      <div class="rule-ornamented">
        <hr class="rule">
        <span class="rule-mark"></span>
        <hr class="rule">
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)">Line, ornament, line. The centre is a real gap rather than a masked overlay, so the ornament never depends on sitting against a surface of a particular colour to hide the line behind it. The mark is drawn by the primitive itself: a gap with nothing in it is a bug that looks like a design, so it draws its own centre rather than opening a hole and trusting the caller.</p>
    </div>
    <div>
      <p class="eyebrow">With a filigree mounted — the slot, when a caller fills it</p>
      <div class="rule-ornamented">
        <hr class="rule">
        <span style="display:flex;align-items:center;justify-content:center;color:var(--of-ornament-filigree-ink)">${filigreeSvg("section-rule")}</span>
        <hr class="rule">
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)">Nothing on the site fills it today; the mark above is what a rule draws. The slot stays because the ornament arriving as a slot rather than as an import is what keeps this primitive from deciding, on the caller's behalf, how much scrollwork a screen has already spent.</p>
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>The ornament used to be rationed, and is not.</strong> An <code>ornament</code> flag defaulted to false on the argument that scrollwork is spent on three roles — panel corners, card-frame corners, the section rule — so a screen gets one marked rule and the rest plain. Exactly one caller ever passed it. A flag with one caller was not choosing between rules; it was making a single rule look like a different component from its siblings on the next page down, so the mark is now what a section rule <em>is</em>. The ration still governs <code>FiligreeCorner</code>, which is where panel and card-frame scrollwork is spent.</p>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>A rule may also be a container's own edge.</strong> The header's closing line, the line under the card index's control bar, the one that opens the footer and the one above a pager were each a <code>border-block-start</code> or <code>border-block-end</code> on the box itself — the same hairline, at the same weight and in the same ink, spelled a second way. The cost of the second spelling was that a border has no middle, so those four were the only dividers on the site that could not carry the centre mark. They compose this primitive now; <code>flush</code> drops the rhythm a border never had, because at an edge the host already owns the space on both sides.</p>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>Semantics are the point of this primitive.</strong> A divider is either a thematic break or it is furniture, and the two must not render as the same thing: a real <code>&lt;hr&gt;</code> is a <code>separator</code> in the accessibility tree and is announced, a decorative line is <code>aria-hidden</code> and is not. The expensive mistake runs in one direction only — a screen reader announcing "separator" between every header and its body, on every card page, is noise that trains people to ignore the one that meant something. So <code>decorative</code> exists, defaults to false, and is the only way to get a line that is not a break.</p>
  <p class="note"><strong>This primitive owns the rule; the slot supplies a drawing.</strong> Both halves had to be written down: the rule and the filigree were each built to the same three-role ration and each concluded independently that the section rule was its job, so following the instructions used to yield four hairlines at two weights, doubled rhythm, and a <code>separator</code> buried inside an <code>aria-hidden</code> mount where the accessibility tree threw it away.</p>`,
});

cards.push({
  path: "primitives/filigree-corner.html",
  group: "Primitives",
  title: "Filigree corner",
  body: `
  <p class="note">Scrollwork, rationed. Leaving it out made the first pass read as austere Swiss rather than as Rathe, so it comes back — but it earns a place in <strong>exactly three roles</strong>: the corners of a feature panel, the corners of a card frame, and a section rule. Never on a control, never on a list, never twice on one screen — except in the section rule, where the ration was retired and every rule now draws a centre mark. See the ornamental rule card for the argument.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">Panel corner — the fullest hand</p>
      <div class="row" style="color:var(--of-ornament-filigree-ink)">
        <span style="inline-size:calc(var(--of-ornament-filigree-size) * 2);block-size:calc(var(--of-ornament-filigree-size) * 2);display:inline-block">${filigreeSvg("panel-corner")}</span>
      </div>
    </div>
    <div>
      <p class="eyebrow">Card corner — same motif, fewer members, thinner stroke</p>
      <div class="row" style="color:var(--of-ornament-filigree-ink)">
        <span style="inline-size:calc(var(--of-ornament-filigree-size) * 2);block-size:calc(var(--of-ornament-filigree-size) * 2);display:inline-block">${filigreeSvg("card-corner")}</span>
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)">A card is one of many on a results page, and filigree at panel weight around each of them would be the "never on a list" failure by another route.</p>
    </div>
    <div>
      <p class="eyebrow">Section rule — a bare figure, no lines of its own</p>
      <div style="color:var(--of-ornament-filigree-ink)">${filigreeSvg("section-rule")}</div>
    </div>
    <hr class="rule">
    <div>
      <p class="eyebrow">One motif, four mirrorings</p>
      <div class="row" style="color:var(--of-ornament-filigree-ink)">
        ${(["start-start", "start-end", "end-start", "end-end"] as const)
          .map(
            (c) =>
              `<div style="display:flex;flex-direction:column;align-items:center;gap:var(--of-space-tight)">
                <span style="inline-size:calc(var(--of-ornament-filigree-size) * 2);block-size:calc(var(--of-ornament-filigree-size) * 2);display:inline-block">${filigreeSvg("panel-corner", c)}</span>
                <code style="font-size:var(--of-type-size-micro);color:var(--of-color-ink-faint)">${c}</code>
              </div>`,
          )
          .join("")}
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)">Mirroring rather than redrawing guarantees the four corners agree and keeps the drawing to one set of paths to audit. The corners are named on the <strong>logical</strong> axes — <code>start-start</code>, not <code>top-left</code> — because a plate flips with writing direction and its ornament flips with it.</p>
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>It draws scrollwork and owns no layout.</strong> One instance is one ornament; every role is hosted by a primitive that already knows where the ornament goes. There is deliberately no label prop, and this is the one primitive where an absent accessible name is correct: the ornament carries no information, so it is <code>aria-hidden</code> in all three roles. Remove every ornament in the library and nothing is lost — which is what "decoration" has to mean.</p>
  <p class="note">The relief pass sits outside the mirror, and the order is the point: light comes from above in every corner of the frame, so the light pass has to be above the ink in <em>screen</em> space. Nested the other way round, the two <code>end-*</code> corners would light the plate from below.</p>`,
});

cards.push({
  path: "primitives/citation.html",
  group: "Primitives",
  title: "Citation",
  body: `
  <p class="note">The thing you paste into an argument to end it. <strong>The permalink is the product</strong> — a judge pasting <code>cr:8.3.4b</code> into Discord instead of describing which paragraph they mean is the whole share moment, so this primitive has two jobs: make the identifier look copyable, and make it genuinely clickable.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">With the document version</p>
      <span class="citation">cr:8.3.4b<span class="version">· 2.14.0</span></span>
    </div>
    <div>
      <p class="eyebrow">Without — an unversioned record renders no separator</p>
      <span class="citation">cr:8.3.4b</span>
    </div>
    <div>
      <p class="eyebrow">Pressed — the bevel inverts and the plate sinks</p>
      <span class="citation sunk">cr:8.3.4b<span class="version">· 2.14.0</span></span>
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>It is an <code>&lt;a&gt;</code>, not a styled span with a click handler.</strong> Middle click, "copy link address", ⌘-click and the browser's own focus order all arrive free with the right element and are unrecoverable without it. The focus ring is a real outline at twice the bevel width; <code>outline: none</code> appears nowhere in the stylesheet, because a citation nobody can tab to is a permalink nobody can share.</p>
  <p class="note"><strong>The identifier is not uppercased, and that is a deliberate departure.</strong> The label voice is wide-tracked uppercase and the tracking is here — it is what makes this read as a label rather than as code. The casing is not: a rule id is an identifier, <code>8.3.4b</code> and <code>8.3.4B</code> are not interchangeable, and browsers disagree about whether <code>text-transform</code> follows text onto the clipboard. A citation that pastes back differently than it was printed is the one failure this primitive exists to prevent.</p>
  <p class="note"><strong>It is no longer monospaced, and this card used to say it was.</strong> The face marked citations on the rule "if it is monospaced in this system, you can cite it"; that rule stopped being true as the same face spread to eyebrows, pills and stat labels — chrome, not identifiers — so it was retired. A citation is now marked by being one: a struck plate, in the label voice, next to the thing it cites.</p>`,
});

cards.push({
  path: "primitives/brass-seal.html",
  group: "Primitives",
  title: "Brass seal",
  body: `
  <p class="note">Judge attribution on a verified ruling, and <strong>the single place brass is allowed to appear</strong>. A material used once is a signal; used twice it is a theme. Nothing else in the system may consume <code>color.brass</code>.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">The seal</p>
      <p class="seal">
        <span class="face">
          <span class="claim">Verified</span>
          <span class="judge">Elena Ruiz</span>
          <span class="date">14 March 2026</span>
        </span>
        <span class="band">
          <span class="label">Rules version</span>
          <span class="version">2.11.0</span>
        </span>
      </p>
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>The rules version is a first-class field, not a parenthetical.</strong> Every entry records the version it was answered under so a bump can flag it for review rather than silently serving stale law — and a version a reader has to hunt for cannot do that job. So it gets its own struck band across the foot of the plate, in inverted material: plate ink as the ground, plate metal as the text, so the one field a version bump has to invalidate is the thing you cannot miss.</p>
  <p class="note"><strong>Colour never carries the claim.</strong> "Verified" is rendered as text, so the brass says only what the plate already says and a reader who cannot see the material loses nothing. Hierarchy is carried by size and weight rather than by fading text down — the only lower-contrast brass available is the edge tone, and it drops under 4.5:1 on this plate in light mode, so nothing here is dimmed.</p>
  <p class="note"><strong>There is no <code>label</code> prop, and its absence is the argument.</strong> The three facts that <em>are</em> the accessible name are already required props, so the name is composed rather than supplied: the seal announces "Verified by Elena Ruiz on 14 March 2026, under rules version 2.11.0" as one sentence, carried by visually-hidden joiners that keep every visible element genuine text. There is no spelling of this component that renders an unnamed seal.</p>`,
});

cards.push({
  path: "primitives/mark.html",
  group: "Primitives",
  title: "Mark",
  body: `
  <p class="note">Three interlocked links. It says what the tool <em>does</em> rather than what the game is: Optfall's whole claim is the joins it makes — a card to the rule that governs it, a printing to its legality — and a chain is that drawn.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">Pitch — the canonical fill, one link per value</p>
      <div class="row" style="align-items:flex-end">
        ${markSvg("pitch", "sm")}${markSvg("pitch")}${markSvg("pitch", "lg")}
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)">The one place this system spends pitch colour on something that is not a pitch value: the links are the three-value system itself rather than any one of its values.</p>
    </div>
    <div>
      <p class="eyebrow">Ink — blood in the middle, <code>currentColor</code> outside</p>
      <div class="row" style="align-items:flex-end;color:var(--of-color-ink)">
        ${markSvg("ink", "sm")}${markSvg("ink")}${markSvg("ink", "lg")}
      </div>
      <p class="note" style="margin-block-start:var(--of-space-tight)">The outer two inherit, so a lockup takes the ink of the word beside it and lights up as one object.</p>
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>There is no reduced form.</strong> A single upright link used to sit here, and it was drawn by whichever surface was too small for three — the favicon, then the installed-app icon. Both went back to the chain: three links at this aspect really are a smudge at 16px, measured, but an icon that is not the logo is worse at every size than the logo is at its worst one. The tab and the home screen now draw <code>MARK_GEOMETRY</code> exactly as this card does.</p>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>Nothing here is hand-placed.</strong> The step between links is the run of a rotated link minus the overlap that makes them interlock; the box is the union of their rotated corners; the clips are the empty band between each pair's two crossings. Change the angle and everything else follows — which is why the mark it replaced was rewritten as a derivation rather than left as coordinates somebody typed. <strong>This card renders <code>MARK_GEOMETRY</code> directly</strong>, so it cannot show a chain the product does not draw.</p>
  <p class="note"><strong>Three links, because the interlock needs three.</strong> Two can be drawn interlocking, but three is where the pattern is visibly a chain rather than two rings that happen to overlap — and three is what carries the pitch palette, one link per value. Each link is an elongated octagon: the chamfer is how this system spells "not a rectangle", on the jewel, on every plate, and here.</p>
  <p class="note">It is drawn from a game <em>mechanic</em> and from plain geometry rather than from Legend Story Studios' visual identity, which is what keeps it clear of the policy's prohibition on any close semblance to their logos.</p>`,
});

cards.push({
  path: "primitives/result-row.html",
  group: "Primitives",
  title: "Result row",
  body: `
  <p class="note">One hairline between rows and nothing else — no card, no shadow, no padding a reader has to look past. The row wraps intrinsically rather than at a breakpoint, since the theme publishes no breakpoint tokens and a raw one is not available to write.</p>
  <div class="plate" style="margin-block-start:var(--of-space-loose)">
    <ul class="results">
      ${(
        [
          ["Head Jab", "1", ["BEN010", "Ninja Action - Attack"]],
          ["Command and Conquer", "3", ["MST131", "Guardian Action - Attack"]],
          ["Bonds of Ancestry", "2", ["OUT057", "Generic Action"]],
        ] as const
      )
        .map(
          ([name, pitch, [key, kind]]) => `<li class="result">
            <span>${jewel(pitch)}</span>
            <div class="body">
              <p class="line"><a class="name" href="#">${name}</a></p>
              <p class="meta"><span>${key}</span><span>${kind}</span></p>
            </div>
          </li>`,
        )
        .join("")}
    </ul>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">The name is set in the serif — the voice assigned to names — and the metadata in wide-tracked uppercase sans, which is the label voice. The row's <code>lead</code> slot takes whatever identifies the record: a pitch jewel here, a card face on a results grid, nothing at all in the rules index.</p>
  <p class="note"><strong>It is an <code>&lt;li&gt;</code>, and the caller owns the list.</strong> A row that wrapped itself in its own <code>&lt;ul&gt;</code> would publish a list of one to a screen reader for every result on the page, which is the same count that tells a reader how much there is to get through.</p>`,
});

cards.push({
  path: "primitives/pagination.html",
  group: "Primitives",
  title: "Pagination",
  body: `
  <p class="note">The control that replaced "N more match. Narrow the query." — a line that counted rows it then refused to show. The count was never the problem and has not moved; what is new is that the rows it counts are reachable.</p>
  <div class="plate" style="margin-block-start:var(--of-space-loose);padding:var(--of-space-loose)">
    <p class="note" style="margin:0 0 var(--of-space-base)">Showing 61–120 of 1,204 cards</p>
    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:var(--of-space-tight)">
      <span class="mono" style="font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-muted)">Previous</span>
      ${[1, 2, 3]
        .map(
          (n) =>
            `<span class="mono" style="min-inline-size:var(--of-ornament-jewel-base);display:inline-flex;align-items:center;justify-content:center;padding:var(--of-space-tighter) var(--of-space-tight);border:var(--of-bevel-width) solid ${n === 2 ? "var(--of-color-ink)" : "var(--of-color-rule)"};border-block-start-color:${n === 2 ? "var(--of-color-ink)" : "var(--of-bevel-light)"};border-block-end-color:${n === 2 ? "var(--of-color-ink)" : "var(--of-bevel-dark)"};background:${n === 2 ? "var(--of-color-ink)" : "var(--of-color-surface)"};color:${n === 2 ? "var(--of-color-surface)" : "var(--of-color-ink-muted)"};font-size:var(--of-type-size-micro)">${n}</span>`,
        )
        .join("")}
      <span style="color:var(--of-color-ink-muted);font-size:var(--of-type-size-micro)">…</span>
      <span class="mono" style="min-inline-size:var(--of-ornament-jewel-base);display:inline-flex;align-items:center;justify-content:center;padding:var(--of-space-tighter) var(--of-space-tight);border:var(--of-bevel-width) solid var(--of-color-rule);border-block-start-color:var(--of-bevel-light);border-block-end-color:var(--of-bevel-dark);background:var(--of-color-surface);color:var(--of-color-ink-muted);font-size:var(--of-type-size-micro)">21</span>
      <span class="mono" style="font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-accent)">Next</span>
    </div>
    <p class="note" style="margin-block-start:var(--of-space-base)">Per page &nbsp; <span class="mono" style="font-size:var(--of-type-size-micro)">30 · <strong style="color:var(--of-color-ink)">60</strong> · 120 · 240 · All</span></p>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>Every control is a real <code>&lt;a href&gt;</code>.</strong> That is what makes a page of an answer an address somebody can paste, and it is why the pager works before any script has run. A caller may pass <code>onNavigate</code> to take the same links client-side; without it they are ordinary links and the page reloads, which is the correct fallback rather than a degraded one.</p>
  <p class="note"><strong>The ends are always shown.</strong> A pager rendering <code>‹ 14 15 16 ›</code> inside a 21-page answer has hidden both the size of the answer and the two destinations anybody navigates to directly — the start and the end.</p>
  <p class="note"><strong><code>All</code> removes the cap rather than raising it.</strong> It resolves to an infinite limit, so a reader who asks for every row gets every row. It is the last step offered because it is the expensive one — the grid is card images.</p>
  <p class="note"><strong>The current page is marked, not disabled.</strong> A disabled control leaves the tab order, so paging with the keyboard would drop the reader out of the pager every time they landed somewhere.</p>`,
});

cards.push({
  path: "primitives/icon-button.html",
  group: "Primitives",
  title: primitiveCardTitle("icon-button"),
  body: `
  <p class="note">A call to action that carries somebody else's mark. It was extracted because the card page needed the same control twice — under the face, for the printing being read, and once per row in a buy section — and two placements of one control is this library's own signal that a primitive is missing rather than a licence to write the CSS in the page. <strong>That second placement has since gone</strong>: the buy section was removed and the face button is the only one left. The extraction is not being argued backwards on that account — a primitive is where a control's box, bevel, focus ring and <code>rel</code> contract live, and the reasons below for each of those are unchanged by there being one caller.</p>
  <div class="plate" style="margin-block-start:var(--of-space-loose);padding:var(--of-space-loose);display:flex;flex-wrap:wrap;gap:var(--of-space-loose);align-items:center">
    <span style="display:inline-flex;align-items:center;gap:var(--of-space-tight);padding-block:var(--of-space-base);padding-inline:var(--of-space-loose);background:var(--of-color-surface-raised);border-radius:var(--of-bevel-radius);border-block-start:var(--of-bevel-width) solid var(--of-bevel-light);border-block-end:var(--of-bevel-width) solid var(--of-bevel-dark);font-family:var(--of-type-family-sans);font-size:var(--of-type-size-small);font-weight:var(--of-type-weight-medium);letter-spacing:var(--of-type-tracking-wide);color:var(--of-color-ink);white-space:nowrap">
      <span aria-hidden="true" style="inline-size:var(--of-ornament-mark-small);block-size:var(--of-ornament-mark-small);background:var(--of-color-rule);border-radius:var(--of-bevel-radius);display:inline-flex"></span>
      Buy on TCGplayer
    </span>
    <span class="note" style="margin:0">— the icon is a slot, so the grey square here is standing in for a vendor's mark.</span>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>Nothing in the component knows what TCGplayer is.</strong> A caller hands in a node; this owns the box, the bevel, the focus ring and the relationship between the two. A second marketplace needs a different node and no new component — which matters, because <code>docs/COMPLIANCE.md</code> §2 permits singles commerce generally rather than for one vendor.</p>
  <p class="note"><strong>It is an <code>&lt;a&gt;</code>, never a <code>&lt;button&gt;</code>.</strong> The same argument the citation makes: middle click, "copy link address", ⌘-click and the browser's own focus order all arrive free with the right element and are unrecoverable without it.</p>
  <p class="note"><strong><code>rel</code> is required rather than defaulted</strong>, and that is a compliance decision rather than a fussy one. An affiliate link that omits <code>sponsored</code> is the failure <code>tcgplayer.ts</code> exists to prevent, and a default here would let a caller ship a paid link that discloses nothing simply by not thinking about it.</p>
  <p class="note"><strong>The label is the accessible name and the icon is <code>aria-hidden</code>.</strong> A mark and the word beside it are one thing to a reader and would otherwise be two to a screen reader. Where a page renders several of these, <code>detail</code> adds an off-screen qualifier — five links all named "Buy on TCGplayer" is WCAG 2.4.4. The card page renders one now and still passes a <code>detail</code>, for a different reason: it names which printing the link buys, which is the only place that fact is stated.</p>`,
});

/* -------------------------------------------------------------------- Screens */

cards.push({
  path: "screens/door.html",
  group: "Screens",
  title: "The door — optfall.com",
  body: `
  <p class="note">Name in, navigation out. 194 words and five links, down from 474 and thirty-two.</p>
  <div class="plate" style="margin-block-start:var(--of-space-loose);padding:var(--of-space-loosest)">
    <p class="mono" style="font-size:var(--of-type-size-small);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-muted);margin:0 0 var(--of-space-looser)">Optfall</p>
    <p class="eyebrow">Search the cards</p>
    <div class="plate sunken" style="display:flex;gap:var(--of-space-tight);align-items:center">
      <span style="flex:1;font-family:var(--of-type-family-serif);font-size:var(--of-type-size-title);color:var(--of-color-ink-faint)">command and conquer</span>
      <span class="mono" style="color:var(--of-color-accent);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;font-size:var(--of-type-size-micro)">Search</span>
    </div>
    <p class="note" style="margin-block-start:var(--of-space-tight)"><code>pitch:3 class:guardian</code> is Card Vault's own syntax · <code>banned:cc</code> is ours · <code>/</code> returns here.</p>
    <div style="display:flex;flex-wrap:wrap;gap:var(--of-space-base) var(--of-space-looser);margin-block-start:var(--of-space-loosest);font-size:var(--of-type-size-small)">
      <span style="color:var(--of-color-accent)">Browse all 4,941 cards</span>
      <span style="color:var(--of-color-accent)">Search the rules</span>
      <span style="color:var(--of-color-accent)">A card that is two things at once</span>
      <span style="color:var(--of-color-accent)">A rules permalink</span>
    </div>
    <!-- The door carries no provenance stamp: the claim moved to the footer,
         where it is stated once for every page rather than per screen. -->
  </div>`,
});

cards.push({
  path: "screens/results.html",
  group: "Screens",
  title: "The room — /cards",
  body: `
  <p class="note">The face is the row. Pitch versions collapse to one result, and a partial match names the versions it is talking about.</p>
  <div class="plate" style="margin-block-start:var(--of-space-loose);padding:var(--of-space-loosest)">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:var(--of-space-base)">
      <p class="note" style="margin:0">35 cards match.</p>
      <p class="mono" style="margin:0;font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-muted)"><span style="color:var(--of-color-ink)">Grid</span> · List</p>
    </div>
    <hr class="rule" style="margin-block:var(--of-space-loose)">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:var(--of-space-loose)">
      ${[
        ["MST131", "Command and Conquer", ""],
        ["OUT057", "Bonds of Ancestry", "pitch 2, pitch 3"],
        ["HVY140", "Crown of Providence", ""],
        ["LGS282-RF", "Enlightened Strike", ""],
      ]
        .map(
          ([
            key,
            name,
            versions,
          ]) => `<div style="display:flex;flex-direction:column;gap:var(--of-space-tight)">
            <figure>
              <img src="${FACE}/thumb/${key}.webp" alt="${name}" width="180" height="251">
              <figcaption class="copyright">Card images © Legend Story Studios.</figcaption>
            </figure>
            <span style="font-family:var(--of-type-family-serif);font-size:var(--of-type-size-small)">${name}</span>
            ${versions ? `<span class="mono" style="font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-muted)">${versions}</span>` : ""}
          </div>`,
        )
        .join("")}
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">"Bonds of Ancestry" carries its matched versions because it is banned at pitch 2 and 3 and <em>legal</em> at pitch 1. A row that named the card and stopped would put it on a banned list without saying which version was banned.</p>`,
});

cards.push({
  path: "screens/card.html",
  group: "Screens",
  title: "The card page — /card/head-jab",
  body: `
  <p class="note">Two columns: face and printings rail on the left, identity and legality on the right. Pitch versions are tabs, because a player calls the red, yellow and blue versions one card.</p>
  <div class="plate" style="margin-block-start:var(--of-space-loose);padding:var(--of-space-loosest)">
    <div style="display:flex;flex-wrap:wrap;gap:var(--of-space-loosest);align-items:flex-start">
      <div style="flex:0 0 auto;display:flex;flex-direction:column;gap:var(--of-space-base)">
        <figure>
          <img src="${FACE}/normal/BEN010.webp" alt="Head Jab — Ninja Action - Attack" width="260" height="363">
          <figcaption class="copyright">Card images © Legend Story Studios.</figcaption>
        </figure>
        <div style="display:flex;gap:var(--of-space-base);flex-wrap:wrap">
          ${["BEN010", "KAT013", "KSU011"]
            .map(
              (
                k,
                i,
              ) => `<div style="display:flex;flex-direction:column;align-items:center;gap:var(--of-space-hair)">
              <img src="${FACE}/thumb/${k}.webp" alt="${k}" width="64" height="89" style="border:var(--of-bevel-width) solid var(--of-color-${i === 0 ? "accent" : "rule"});border-radius:var(--of-bevel-radius)">
              <span class="mono" style="font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);color:var(--of-color-ink-muted)">${k}</span>
            </div>`,
            )
            .join("")}
        </div>
      </div>

      <div style="flex:1 1 18rem;min-inline-size:0;display:flex;flex-direction:column;gap:var(--of-space-looser)">
        <div>
          <p class="eyebrow">Ninja Action - Attack</p>
          <div style="display:flex;align-items:center;gap:var(--of-space-base)">
            ${jewel("1", "lg")}
            <h2 style="font-size:var(--of-type-size-display)">Head Jab</h2>
          </div>
        </div>

        <div>
          <div style="display:flex;gap:var(--of-space-tight);border-bottom:1px solid var(--of-color-rule)">
            ${[1, 2, 3]
              .map(
                (
                  p,
                ) => `<span style="display:inline-flex;align-items:center;gap:var(--of-space-tight);padding:var(--of-space-tight) var(--of-space-base);border-bottom:var(--of-bevel-width) solid ${p === 1 ? "var(--of-color-accent)" : "transparent"};color:var(--of-color-ink${p === 1 ? "" : "-muted"})">
                ${jewel(p, "sm")}
                <span class="mono" style="font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase">Pitch ${p}</span>
              </span>`,
              )
              .join("")}
          </div>
          <p class="note" style="margin-block-start:var(--of-space-tight)">Same name, different card. Each version has its own printed text, stats and legality — the tabs are permanent URLs.</p>
        </div>

        <div>
          <p class="eyebrow">Stats</p>
          <!-- A STRAY DOLLAR SIGN USED TO PRINT HERE, at the head of the row:
               the line was one hand-spelled 4,000-character blob and an
               interpolation had lost its brace, so the published card screen
               carried it as the first stat. It survived because nobody reads a
               line that long. (Writing the character out in this very comment
               reproduced the fault — inside a template literal it opens an
               interpolation whatever it is sitting in — which is as good a
               demonstration as the original.) -->
          <div style="display:flex;align-items:center;gap:var(--of-space-loose);flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:var(--of-space-tight)">${jewel("1")}<span class="eyebrow" style="margin:0">Pitch</span></div>
            ${statBadge("cost", "Cost", "0")}
            ${statBadge("power", "Power", "3")}
            ${statBadge("defence", "Defence", "2")}
          </div>
          <p class="note" style="margin-block-start:var(--of-space-tight)">Pitch is labelled like every other corner, and every plate here is one visual size — the stone is scaled up and the shield down, because the eye compares ink rather than boxes.</p>
        </div>

        <div>
          <p class="eyebrow">Legality</p>
          <div style="display:flex;flex-direction:column;gap:var(--of-space-base)">
            <div>
              <div class="mono" style="font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-muted);margin-block-end:var(--of-space-tightest)">Classic Constructed</div>
              <span class="pill" style="background:var(--of-color-state-legal);color:var(--of-color-state-legal-ink)">Legal</span>
            </div>
            <div>
              <div class="mono" style="font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-muted);margin-block-end:var(--of-space-tightest)">Living Legend</div>
              <span class="pill" style="background:var(--of-color-state-banned);color:var(--of-color-state-banned-ink)">Banned</span>
              <span class="pill" style="background:var(--of-color-state-living-legend);color:var(--of-color-state-living-legend-ink)">Living Legend</span>
              <div class="note" style="margin-block-start:var(--of-space-tightest)">since 2024-07-08</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">The upstream flags are no longer rendered here: the row was restating the pills in upstream's key names rather than evidencing them. Auditability lives in the openly-licensed corpus, which is the artefact a second tool would check us against.</p>`,
});

/* ------------------------------------------------------------------ Emit */

/**
 * WRITING IS GUARDED, EXPORTS ARE NOT.
 *
 * `design-system-coverage.test.ts` imports `cards` and `page` to check the
 * registry against `PRIMITIVES` and the committed bundle against the generator.
 * Without this guard, importing the registry would rewrite `design-system/` as
 * a side effect of running the test suite — a checker that mutates the artefact
 * it is checking can never fail.
 */
if (import.meta.main) {
  for (const dir of Object.values(GROUP_DIR)) {
    mkdirSync(join(OUT, dir), { recursive: true });
  }

  for (const card of cards) {
    writeFileSync(join(OUT, card.path), page(card));
  }

  // Sanity: the palettes the previews render must be the shipped ones.
  const shipped = Object.keys(DARK_TOKENS).length;
  const light = Object.keys(LIGHT_TOKENS).length;
  console.log(`${cards.length} cards written to ${OUT}`);
  console.log(`tokens inlined: ${shipped} dark, ${light} light`);
  for (const card of cards)
    console.log(`  ${card.group.padEnd(12)} ${card.path}`);
}
