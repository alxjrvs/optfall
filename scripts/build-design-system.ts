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
 * Rendering the real Svelte components into these cards would remove the
 * weakness rather than manage it, and is the right next step.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

const FACE = "https://optfall-images.netlify.app";

/**
 * A pitch jewel, in the two-element shape `PitchJewel.svelte` renders.
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
  life: { cut: "cut.plain", tone: null, optical: 0.886 },
  intellect: { cut: "cut.diagonal.start", tone: null, optical: 0.908 },
  arcane: { cut: "cut.diagonal.end", tone: null, optical: 0.908 },
};

function statPlate(kind: string, value: string): string {
  const spec = STAT_PLATES[kind];
  // Same argument as `cutValue`: a stat the component knows and this table does
  // not is drift, and the gallery should say so rather than render a blank.
  if (spec === undefined) throw new Error(`no such stat plate: ${kind}`);

  const size = `calc(var(--of-ornament-stat-size) * ${spec.optical})`;
  const surface =
    spec.tone === null
      ? "background:var(--of-color-surface-raised);color:var(--of-color-ink)"
      : `background:var(--of-color-stat-${spec.tone});color:var(--of-color-stat-${spec.tone}-ink)`;
  /* The shield's point takes the bottom of the square, so the numeral is
     centred in the BODY rather than in the box — the component's own note. */
  const seat =
    kind === "defence" ? `;padding-block-end:calc(${size} * 0.28)` : "";

  return `<span style="display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;inline-size:${size};block-size:${size};${surface};font-family:var(--of-type-family-sans);font-size:var(--of-type-size-base);font-weight:var(--of-type-weight-bold);line-height:1;clip-path:${cutValue(spec.cut)};box-shadow:inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light), inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark)${seat}">${value}</span>`;
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
 * that shape existed, while the shipped `PitchJewel.svelte` clipped an edge-up
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
.stone.p0 { background: var(--of-color-pitch-none); color: var(--of-color-pitch-none-ink); }
.stone.p1 { background: var(--of-color-pitch-one); color: var(--of-color-pitch-one-ink); }
.stone.p2 { background: var(--of-color-pitch-two); color: var(--of-color-pitch-two-ink); }
.stone.p3 { background: var(--of-color-pitch-three); color: var(--of-color-pitch-three-ink); }

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
`;

interface Card {
  path: string;
  group: string;
  title: string;
  body: string;
  /** Rendered twice, once per theme, when the card is about colour. */
  bothThemes?: boolean;
}

function page(card: Card): string {
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

const cards: Card[] = [];

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
      ${swatch("--of-color-pitch-one", "pitch.one")}${swatch("--of-color-pitch-two", "pitch.two")}${swatch("--of-color-pitch-three", "pitch.three")}
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
    ${jewel("0")}${jewel("1")}${jewel("2")}${jewel("3")}
    ${jewel("1", "sm")}${jewel("1")}${jewel("1", "lg")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)">Red and yellow are the classic deuteranopia confusion pair, pitch is the most-read value on a card, and it is the same pair the leading commercial scanner misreads. Designing colour as the <em>redundant</em> channel costs nothing and fixes it for everyone downstream. The silhouette is reserved: nothing else in the interface is ever this shape.</p>`,
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
  <p class="note" style="margin-block-start:var(--of-space-loose)">One vocabulary — a square plate, chamfered differently — so the six read as a family rather than as six icons. <strong>None is eight-sided:</strong> the pitch jewel owns that outline and the system promises it means pitch, so a stat glyph that happened to be an octagon would spend the one shape that is spoken for. The numeral stays the primary channel and the label stays visible; the silhouette is the third redundant carrier, never the only one.</p>
  <p class="note"><strong>Cost, power and defence break the vocabulary on purpose.</strong> They are the three a player already knows by sight, so they take the card's own geometry rather than a forward-leaning grey square that has to be read to be identified: two discs and a shield, drawn by us in tokens from our own palette. A player looking for attack is looking for a yellow disc.</p>
  <p class="note"><strong>One size, six areas, so the boxes are not all the same.</strong> The eye compares ink rather than bounding boxes, and an uncut square keeps 27% more of its box than a disc does. Each plate is therefore scaled by the square root of its silhouette's area against the disc's π/4, which is what makes the row above read as one size instead of four.</p>
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
    ${[
      ["{p}", "P", "power", "cut.lean.end"],
      ["{r}", "R", "resource", "cut.hexagon"],
      ["{d}", "D", "defence", "cut.lean.start"],
      ["{h}", "H", "life", "cut.plain"],
      ["{i}", "I", "intellect", "cut.diagonal.start"],
      ["{c}", "C", "chi", "cut.crown"],
      ["{t}", "T", "tap", "cut.side.end"],
      ["{u}", "U", "untap", "cut.side.start"],
    ]
      .map(([token, letter, name, cut]) => [
        token,
        letter,
        name,
        cutValue(cut as string),
      ])
      .map(
        ([
          token,
          letter,
          name,
          clip,
        ]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:var(--of-space-tight)">
          <span style="display:inline-flex;align-items:center;justify-content:center;inline-size:2.25rem;block-size:2.25rem;background:var(--of-color-surface-raised);color:var(--of-color-ink);font-weight:var(--of-type-weight-bold);clip-path:${clip};box-shadow:inset 0 1px 0 0 var(--of-bevel-light), inset 0 -1px 0 0 var(--of-bevel-dark)">${letter}</span>
          <span class="eyebrow" style="margin:0">${name}</span>
          <code style="font-size:var(--of-type-size-micro);color:var(--of-color-ink-faint)">${token}</code>
        </div>`,
      )
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>The table is the rules', not ours.</strong> The Comprehensive Rules defines all eight at 1.12.4a&ndash;h — "the power symbol is {p} and represents a power value" — so rendering them is the same join this site already makes between a keyword and the rule that governs it, and every symbol on a card page links to the rule that defines it. A ninth marker, <code>{x}</code>, appears on two cards and is <em>not</em> in that table; it is drawn as a plain italic letter and flagged as inferred rather than filed with the rest.</p>
  <p class="note"><strong>The last two are cut differently on purpose.</strong> The rules distinguish symbols that represent a <em>value</em> from those that represent an <em>effect</em> — 1.12.4g says tap "represents the tap effect" — so tap and untap are cut down a whole side rather than at a corner, and read as verbs before the letter is read. None is eight-sided: that outline belongs to the pitch jewel, which is why chi takes two corners rather than the four it wants.</p>
  <p class="note">The letter is upstream's, never a tidier one: life is <strong>H</strong> because the marker is <code>{h}</code>. Calling it L would break the one job the plate has, which is to connect the rendered view to the raw one. The accessible name says "life" in full.</p>
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

cards.push({
  path: "primitives/rule-and-citation.html",
  group: "Primitives",
  title: "Rules, citations and brass",
  body: `
  <p class="note">Hairlines rather than cards. Filigree earns three roles and no more — never on a control, never on a list, never twice on one screen.</p>
  <div class="stack" style="margin-block-start:var(--of-space-loose)">
    <div>
      <p class="eyebrow">Plain section rule</p>
      <hr class="rule">
    </div>
    <div>
      <p class="eyebrow">Citation — monospaced, so you can paste it</p>
      <span class="mono" style="letter-spacing:var(--of-type-tracking-wide);color:var(--of-color-accent)">cr:8.3.4b</span>
      <span class="note">· Comprehensive Rules 2.14.0</span>
    </div>
    <div>
      <p class="eyebrow">Brass — authority, and nothing else</p>
      <span style="display:inline-block;padding:var(--of-space-tight) var(--of-space-base);background:var(--of-color-brass);color:var(--of-color-brass-ink);font-family:var(--of-type-family-sans);font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;border:1px solid var(--of-color-brass-edge)">Verified · judge name · 2026-08-12</span>
      <p class="note" style="margin-block-start:var(--of-space-tight)">A material used once is a signal; used twice it is a theme.</p>
    </div>
  </div>`,
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

mkdirSync(join(OUT, "foundations"), { recursive: true });
mkdirSync(join(OUT, "primitives"), { recursive: true });
mkdirSync(join(OUT, "screens"), { recursive: true });

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
