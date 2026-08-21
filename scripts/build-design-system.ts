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
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
 * A pitch jewel, in the shape `PitchJewel.tsx` renders.
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
 *
 * AND IT DRIFTED AGAIN, WHICH IS WHY THIS NOTE KEEPS GROWING. The stone carried
 * a numeral here and in the component; the component now carries three slots
 * filled to the pitch value, the way the printed card does, and for one build
 * this helper went on publishing the numeral. A gallery that shows a rendering
 * the product retired is worse than no gallery, because it is consulted by
 * somebody trying to find out what the product does.
 */
function jewel(pitch: string | number, size = ""): string {
  const value = Number(pitch);
  /* THREE SLOTS ALWAYS, filled from the apex — the denominator is half the
     statement. Zero fills none of them, which is the same claim the grey
     `none` stone makes and is why it needs no branch here. */
  /* THE SOCKETS THE CARD PAYS FOR HOLD THE RESOURCE SYMBOL, and the rest are
     holes. A pitch value IS a resource value — CR 1.12.4e — so the pip is the
     thing being counted rather than a dot standing in for it. The artwork is
     drawn at the base size and the drawn red at `sm`, exactly as the component
     splits it: a socket a few pixels across cannot resolve the swirl. */
  const art = size === "sm" ? null : symbolArt("cost");
  const slots = [0, 1, 2]
    .map((slot) => {
      const filled = slot < value;
      const pip =
        filled && art !== null
          ? `<img class="pip" src="${art}" alt="" width="105" height="105">`
          : "";
      return `<span class="slot" data-filled="${filled ? "true" : "false"}">${pip}</span>`;
    })
    .join("");
  return `<span class="jewel${size ? ` ${size}` : ""}"><span class="stone p${value}"><span class="slots">${slots}</span></span></span>`;
}

/**
 * The game's own artwork for a stat's symbol, inlined.
 *
 * A DATA URI BECAUSE A CARD IS ONE FILE. These pages are opened from disk and
 * from Claude Design, where neither `apps/site/public/` nor any origin of ours
 * is mounted — a root-relative `/symbols/icon_p.png` resolves to nothing in
 * both. The card face above reaches a live host because a card image is 50 kB
 * and there are thousands; a symbol is four, there are five, and inlining them
 * is what makes the gallery show the product's own rendering without depending
 * on a deploy.
 *
 * READ FROM THE SITE'S `public/`, which is the same byte the site serves and
 * the one `check-asset-provenance.ts` has a recorded origin for. Copying them
 * into the design system would create a second copy with no provenance entry,
 * which that check exists to fail.
 */
const SYMBOL_FILE: Readonly<Record<string, string>> = {
  cost: "icon_r.png",
  power: "icon_p.png",
  defence: "icon_d.png",
  life: "icon_h.png",
  intellect: "icon_i.png",
};

function symbolArt(kind: string): string | null {
  const file = SYMBOL_FILE[kind];
  if (file === undefined) return null;
  const bytes = readFileSync(
    join(import.meta.dir, "..", "apps", "site", "public", "symbols", file),
  );
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/**
 * A pitch box, in the two-element shape `PitchBox.tsx` renders.
 *
 * IT WAS THE STATE PILL'S PLATE AND IS NOT ANY MORE. The CSS above was `.pill`'s
 * with the pitch palette; it is the hue on a plain rectangle now, with the value
 * written on it in the display face and no notch anywhere, which is what
 * `PitchBox.css` draws and why. The one declaration the gallery drops is
 * `user-select: none` — a product concern rather than a gallery one, since a
 * card nobody drags names off has nothing to keep out of a paste.
 *
 * IT WAS ALSO, BRIEFLY, A BAND OVER A `color.sunken` WELL, and this card drew
 * that too. The fill came back once the notch was the only thing that had to
 * go; the mark is kept quiet by having no height beyond its own line rather
 * than by giving up the surface.
 *
 * A card that drew either retired rendering would advertise a mark the product
 * does not ship, which is the drift `jewel()`'s comment above exists to record.
 */
function pitchBox(pitch: string | number, size = ""): string {
  const value = String(pitch);
  // Sentence case on the screen as well as in the markup, in both places: the
  // `text-transform` that shouted this went with the label voice.
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

/**
 * THE PLATE IS THE FALLBACK NOW, AND ARCANE IS THE ONLY STAT THAT MEETS IT.
 * `StatGlyph` renders LSS's own file wherever the rules publish one, which is
 * every stat the card panel prints; the silhouettes below are what it draws
 * when no `src` is supplied — in a story, and on the one stat with no printed
 * notation. Both renderings are on the gallery card, labelled as what they are.
 *
 * `absent` is passed rather than inferred from an en dash, because the absent
 * state no longer draws a character: beside a mark, where every printed value
 * now sits, a dash reads as something the card prints.
 */
function statPlate(kind: string, value: string, absent = false): string {
  const spec = STAT_PLATES[kind];
  // Same argument as `cutValue`: a stat the component knows and this table does
  // not is drift, and the gallery should say so rather than render a blank.
  if (spec === undefined) throw new Error(`no such stat plate: ${kind}`);

  const size = `calc(var(--of-ornament-stat-size) * ${spec.optical})`;
  /* THE SILHOUETTE IS UNTOUCHED BY AN ABSENCE and only the fill changes — the
     component overrides `background` and `color` and leaves the clip alone, so
     this does the same. */
  const surface = absent
    ? "visibility:hidden"
    : spec.tone === null
      ? "background:var(--of-color-surface-raised);color:var(--of-color-ink)"
      : `background:var(--of-color-stat-${spec.tone});color:var(--of-color-stat-${spec.tone}-ink)`;
  /* The shield's point takes the bottom of the square, so the numeral is
     centred in the BODY rather than in the box — the component's own note. */
  const seat =
    kind === "defence" ? `;padding-block-end:calc(${size} * 0.28)` : "";

  return `<span style="display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;inline-size:${size};block-size:${size};${surface};font-family:var(--of-type-family-sans);font-size:var(--of-type-size-base);font-weight:var(--of-type-weight-bold);line-height:1;clip-path:${cutValue(spec.cut)};box-shadow:inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light), inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark)${seat}">${absent ? "" : value}</span>`;
}

/**
 * A printed stat mark — the game's artwork, with the value beside it.
 *
 * WHAT THE PRODUCT ACTUALLY RENDERS, and therefore what this gallery leads
 * with. The card sets its combat values `{p} 4 … 2 {d}` with the symbol
 * outboard and the numeral inboard of it, and sets COST alone inside the
 * resource disc — the one exception, and the reason this branches.
 *
 * `mirror` puts the numeral first, which is what the panel's end corner does so
 * that the artwork stays against the frame on both sides.
 *
 * An absent stat greys the artwork and prints no character. That is the one
 * thing the plate above could do better: a recessed fill is a token and a
 * greyscale filter is not, which is the price of rendering somebody else's
 * file.
 */
function statMark(
  kind: string,
  value: string,
  { absent = false, mirror = false } = {},
): string {
  const art = symbolArt(kind);
  if (art === null) return statPlate(kind, value, absent);

  /* AN EMPTY POSITION PAINTS NOTHING AND KEEPS ITS WIDTH. It was greyed here
     for one build — the artwork desaturated and dropped back — and on a page
     that read as a rendering fault rather than a statement. `visibility` is the
     spelling, because the width is the whole reason the position renders. */
  const dim = absent ? ";visibility:hidden" : "";
  const img = `<img src="${art}" alt="" width="105" height="105" style="display:block;inline-size:var(--of-ornament-stat-size);block-size:var(--of-ornament-stat-size);object-fit:contain;flex:none${dim}">`;
  const numeral = absent ? "" : value;

  if (kind === "cost") {
    return `<span style="display:inline-grid;place-items:center"><span style="grid-area:1/1">${img}</span><span style="grid-area:1/1;font-family:var(--of-type-family-serif);font-size:var(--of-type-size-large);font-weight:var(--of-type-weight-bold);line-height:1;color:var(--of-color-stat-cost-ink)">${numeral}</span></span>`;
  }

  const text = `<span style="font-family:var(--of-type-family-serif);font-size:var(--of-type-size-large);font-weight:var(--of-type-weight-bold);line-height:1;color:var(--of-color-ink);font-variant-numeric:tabular-nums">${numeral}</span>`;
  const order = mirror ? `${text}${img}` : `${img}${text}`;
  return `<span style="display:inline-flex;align-items:center;gap:var(--of-space-tight)">${order}</span>`;
}

/**
 * A stat mark and the word for it, for the gallery's own catalogue.
 *
 * THE CARD PANEL PRINTS NO WORD, AND THIS ONE DOES. That is not drift, it is
 * the difference between a product surface and a catalogue of one: the panel
 * shows a reader the card they are looking at, where the marks are the game's
 * own and a label is a translation of a language they already speak. A gallery
 * shows somebody every mark at once with no card around it, and has to say
 * which is which. The prose beside each row carries the fact that the product
 * does not.
 *
 * NO `outboard` PARAMETER, and it was written and then removed. The gallery
 * draws these as a left-aligned row with no edges to face away from, so an
 * argument for mirroring would have had exactly one caller and one value
 * forever — a knob illustrating a rule rather than obeying one. The prose
 * carries the mirroring instead, which is what a gallery is for.
 */
function statBadge(
  kind: string,
  label: string,
  value: string,
  absent = false,
): string {
  return `<div style="display:flex;align-items:center;gap:var(--of-space-tight)">${statMark(kind, value, { absent })}<span class="eyebrow" style="margin:0">${label}</span></div>`;
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
  --slot-size: calc(var(--jewel-size) * 0.38);
  /* Equilateral, and centred on the centroid rather than the bounding box —
     both derived in \`PitchJewel.css\`, which explains why the row spacing is
     not the column spacing and why the cluster rides up by a sixth of its
     height. */
  --slot-gap: calc(var(--slot-size) * 0.2);
  --slot-step: calc(var(--slot-size) + var(--slot-gap));
  --slot-rise: calc(var(--slot-step) * 0.866);
  filter: drop-shadow(0 calc(-1 * var(--of-bevel-width)) 0 var(--of-bevel-light))
    drop-shadow(0 var(--of-bevel-width) 0 var(--of-bevel-dark));
}
/* A DISC, BECAUSE THE CARD PRINTS A RING. This clipped itself to
   \`ornament.cut.jewel\` — the reserved eight-sided silhouette — for most of the
   project's life. See \`PitchJewel.css\` and \`docs/DESIGN.md\`, where the
   reservation is struck through rather than deleted. */
.jewel .stone {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  inline-size: 100%; block-size: 100%;
  border-radius: 50%;
}
/* THE TRIANGLE THE CARD PRINTS: one slot above, two below, filled from the top.
   Spanning the first across both columns centres the apex over the gap beneath
   it without positioning anything, so the arrangement survives a change of
   size with no second number to keep in step — the component's own geometry,
   read from \`PitchJewel.css\` rather than re-invented. */
.jewel .slots {
  position: relative; display: grid;
  grid-template-columns: repeat(2, auto);
  justify-content: center; justify-items: center; align-content: center;
  column-gap: var(--slot-gap);
  row-gap: calc(var(--slot-rise) - var(--slot-size));
  transform: translateY(calc(var(--slot-rise) / -6));
}
/* THE APEX SPANS BOTH COLUMNS, which is the whole of the triangle — and
   leaving it out of this copy published a gallery card with two pips above one
   instead of one above two, against a product that had it right. Exactly the
   drift this file's other notes are about, committed within the same change
   that wrote them. */
.jewel .slot:first-child { grid-column: 1 / -1; }
/* EVERY SOCKET WEARS THE SAME LIGHT BEZEL, filled or not, exactly as the card
   draws it — and that hairline is what lets a red pip sit on the red stone at
   pitch one without the two merging. An outset shadow rather than a border,
   because a border would eat into the socket and leave it a different size from
   the artwork inside it. */
.jewel .slot {
  position: relative; display: inline-flex; align-items: center; justify-content: center;
  box-sizing: border-box;
  inline-size: var(--slot-size); block-size: var(--slot-size);
  border-radius: 50%;
  background: var(--of-color-pitch-socket);
  box-shadow: 0 0 0 var(--of-space-hair) var(--of-color-pitch-facet);
}
.jewel .slot[data-filled="true"] { background: var(--of-color-pitch-pip); }
.jewel .pip {
  display: block; inline-size: 100%; block-size: 100%;
  border-radius: 50%; object-fit: contain;
}
.jewel.sm { --jewel-size: var(--of-ornament-jewel-small); font-size: var(--of-type-size-micro); }
.jewel.lg { --jewel-size: var(--of-ornament-jewel-large); font-size: var(--of-type-size-title); }
.pbox {
  display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
  border-radius: var(--of-bevel-radius);
  padding-block: 0;
  padding-inline: var(--of-space-tighter);
  background: var(--band);
  box-shadow:
    inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light),
    inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark);
  font-family: var(--of-type-family-display); font-weight: var(--of-type-weight-medium);
  font-size: var(--of-type-size-small);
  line-height: var(--of-type-leading-tight);
  letter-spacing: var(--of-type-tracking-normal);
  vertical-align: middle;
}
.pbox > span { white-space: nowrap; }
.pbox.sm { font-size: var(--of-type-size-micro); }
.pbox.p0 { --band: var(--of-color-pitch-none); color: var(--of-color-pitch-none-ink); }
.pbox.p1 { --band: var(--of-color-pitch-one); color: var(--of-color-pitch-one-ink); }
.pbox.p2 { --band: var(--of-color-pitch-two); color: var(--of-color-pitch-two-ink); }
.pbox.p3 { --band: var(--of-color-pitch-three); color: var(--of-color-pitch-three-ink); }
.pbox.p4 { --band: var(--of-color-pitch-four); color: var(--of-color-pitch-four-ink); }
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
  <p class="note">An eight-sided cut stone carrying three slots, filled to the card's pitch value. Shape, count and colour state the same fact three times — and the <strong>count</strong> is the primary channel, not a fallback.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);align-items:center">
    ${jewel("0")}${jewel("1")}${jewel("2")}${jewel("3")}${jewel("4")}
    ${jewel("1", "sm")}${jewel("1")}${jewel("1", "lg")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>It carried a numeral until now, and the requirement did not change with it.</strong> Red and yellow are the classic deuteranopia confusion pair, pitch is the most-read value on a card, and it is the same pair the leading commercial scanner misreads — so pitch may never be carried by hue alone. A numeral satisfies that. So does counting, and counting is what the printed card does: three slots in the top-left corner, filled from the top down, with no numeral anywhere on the frame. Nobody miscounts three dots, and a reader who cannot separate the red stone from the yellow one still counts one pip against two.</p>
  <p class="note"><strong>Three slots, not <code>value</code> slots.</strong> A single filled pip and one pip out of three are different statements; only the second says "this card pitches for one of a possible three". The empty ones are the denominator, and they are drawn in the stone's own ink at a quarter opacity — the one colour on this component already guaranteed to clear AA against every tone, so an unfilled slot needs no contrast check of its own.</p>
  <p class="note">The silhouette is reserved: nothing else in the interface is ever this shape. The card's own field is a circle; the octagon is kept because it is the shape this system has promised means pitch, and at this size a cut stone and a disc read alike.</p>
  <p class="note"><strong>Pitch four is drawn here before it is drawn anywhere in the product.</strong> A fourth value has been previewed — a purple strip on a Shadow resource gem, card code <code>IAR000</code> — and no card in the pinned corpus carries <code>pitch: "4"</code> yet, though the corpus does already hold other cards from that set. It sits beside the other four rather than being kept as a special case, because a stone the reader meets once is the one whose colour they will not have learned. <strong>It is also the one value the slots cannot carry:</strong> there are three of them because the card prints three, so pitch four fills every one and is told from pitch three by its stone alone — and that stone's colour channel is the weakest here, since purple sits beside blue in luminance wherever it is still legible under white ink. The accessible name is what separates them, and it says so in words.</p>`,
});

cards.push({
  path: "primitives/pitch-box.html",
  group: "Primitives",
  title: "Pitch box",
  body: `
  <p class="note">The same value as the jewel, written out on a rectangle of its colour. This is the rendering for a LIST or a GRID — the card index, the version tabs, the related links, the breadcrumb — and it replaced the stone at every one of those sites.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);align-items:center">
    ${pitchBox("0")}${pitchBox("1")}${pitchBox("2")}${pitchBox("3")}${pitchBox("4")}
    ${pitchBox("1", "sm")}${pitchBox("1")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>Why the stones left the lists.</strong> A jewel is an object: one card, one value, set beside the name of the thing it belongs to on a page about that thing. Down the left of a list it became a scatter of cut gems, each one an ornament competing with the name it was captioning — and a row in this index stands for a NAME, which in this game is commonly three cards, so it was three of them per row.</p>
  <p class="note"><strong>The words are the point, not a caption on an icon.</strong> Red and yellow are the classic deuteranopia confusion pair and pitch is the most-read value on a card; the jewel answers that with a numeral, which is still one glyph a reader has to know the grammar of. "Pitch 1" is the fact spelled, which leaves colour doing what colour should do in this system — repeating something already said.</p>
  <p class="note"><strong>It was the legality flag's plate, and it is not any more.</strong> This shipped wearing <code>StatePill</code>'s notch at the same token depth, in the same label voice, filled in the pitch colour — on the argument that a reader who has learned the verdicts at the foot of a card page has learned this at the top of one. What that bought alongside the familiarity was a mark loud twice over: the hue as a background behind its own words, and a silhouette saying "this carries state" a few centimetres from four objects that mean it literally. The notch is state's alone again.</p>
  <p class="note"><strong>Then it was two hairlines over a dark well, and that is history too.</strong> Retiring the plate retired the fill along with the notch, which was one channel too many: only <em>one</em> of the two loud things was the colour, and the silhouette was the other. What the band bought instead was two renderings of one fact — a struck edge beside a line of type, a filled surface in the card page's row of links — so a reader met pitch in two costumes on two screens.</p>
  <p class="note"><strong>So the hue takes the surface, and the height is what pays for it.</strong> Loudness is a product of area as much as of saturation, and area is what this spends: no padding above or below the words at all, one mild step to each side, so the box is a line of type wearing a colour rather than a tag with a line of type inside it. The words take the display family a card's name is set in, because this mark is read as part of that name; the pill's wide-tracked uppercase was the voice of a flag and went with the plate. The ink is the tone's own <code>*.ink</code> value — the token that exists for exactly the case where a pitch colour is a background, and whose WCAG ratio <code>tokens.test.ts</code> computes for every pair in both themes.</p>
  <p class="note">No size token in either axis: the box is its words plus its padding, so two of them on a row are not equal columns any more than two verdicts are — a tag is as wide as what it says. The words never wrap, because a second line would double the height of a mark whose whole point is that it is one line tall. And the one place these <em>are</em> equal columns — the card page's "Alternate pitch values" row — asks for it by variant: same surface, same ink, no width of its own, sized by the row and held to the 24px pointer-target floor by the link around it rather than by padding of its own.</p>`,
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

/**
 * One rarity bar, in the shape `RarityBar` renders — slices in ladder order,
 * grown in proportion to their counts.
 *
 * Struck once around the whole band rather than per slice: the divisions are
 * parts of one object, and edging each of them would read as a row of chips.
 * Named tokens only, so this card cannot draw a mark the product does not.
 */
function rarityBar(
  mix: readonly (readonly [string, number])[],
  size: "sm" | "md" = "md",
): string {
  const slices = mix
    .map(
      ([slug, count]) =>
        `<span style="flex-basis:0;flex-grow:${count};min-inline-size:var(--of-space-tightest);background:var(--of-color-rarity-${slug})"></span>`,
    )
    .join("");
  const height = size === "sm" ? 2 : 3;
  return `<span style="display:flex;gap:0;inline-size:100%;block-size:calc(var(--of-bevel-width) * ${height});border-radius:var(--of-bevel-radius);overflow:hidden;box-shadow:0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-light), 0 var(--of-bevel-width) 0 0 var(--of-bevel-dark)">${slices}</span>`;
}

/**
 * Three real sets, named, with their real mixes — a booster set, a
 * preconstructed deck and a promo run.
 *
 * MEASURED FROM THE CORPUS RATHER THAN INVENTED, and named so the claim is
 * checkable: these are `SET_PROFILES.get("PEN")`, `("SVI")` and `("GEM")` at
 * the pinned commit. A demonstration of a distribution drawn from made-up
 * numbers is a demonstration of nothing, and this card's whole argument is that
 * three kinds of release are distinguishable at a glance.
 */
const RARITY_BAR_EXAMPLES: readonly {
  readonly caption: string;
  readonly mix: readonly (readonly [string, number])[];
}[] = [
  {
    caption: "Compendium of Rathe — 681 printings",
    mix: [
      ["common", 282],
      ["rare", 243],
      ["majestic", 110],
      ["legendary", 8],
      ["marvel", 38],
    ],
  },
  {
    caption: "Silver Age Chapter 1 — Viserai — 34 printings",
    mix: [
      ["basic", 1],
      ["common", 14],
      ["rare", 19],
    ],
  },
  {
    caption: "GEM Pack Promos — 308 printings",
    mix: [["promo", 308]],
  },
];

cards.push({
  path: "primitives/rarity-bar.html",
  group: "Primitives",
  title: "Rarity bar",
  body: `
  <p class="note">Rarity again, and the first mark here that stands for MANY printings rather than one. The bubble on a card row says what a single printing is; this says what a whole print run is made of.</p>
  <div style="margin-block-start:var(--of-space-loose);display:grid;gap:var(--of-space-loose)">
    ${RARITY_BAR_EXAMPLES.map(
      ({ caption, mix }) => `<div>
          <p style="font-family:var(--of-type-family-sans);font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-faint);margin:0 0 var(--of-space-tighter)">${caption}</p>
          ${rarityBar(mix)}
        </div>`,
    ).join("")}
    <div>
      <p style="font-family:var(--of-type-family-sans);font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-faint);margin:0 0 var(--of-space-tighter)">The small size, for a dense row — The Hunted, 541 printings, two of them Fabled</p>
      ${rarityBar(
        [
          ["token", 16],
          ["common", 253],
          ["rare", 134],
          ["majestic", 90],
          ["legendary", 12],
          ["fabled", 2],
          ["marvel", 34],
        ],
        "sm",
      )}
    </div>
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>It exists because the set symbol may not.</strong> <code>docs/COMPLIANCE.md</code> counts product set logos as FAB logos and the policy bars them, so <code>/sets</code> has always been a wall of typography with nothing per-set to look at. A mark derived from the corpus is the version of set identity this project is allowed to draw — and it carries information a logo never did: the three bars above are a booster set, a preconstructed deck and a promo run, told apart at a glance where three numbers in a table cannot be.</p>
  <p class="note"><strong>The ladder is the caller's, not this component's.</strong> <code>RARITY_RANK</code> lives in the app's search grammar with a paragraph arguing why Promo sits last and Marvel above Fabled. A second ordering invented in a package that cannot import the first would be a second answer to a settled question, so the slices arrive in the order they should read — the same split <code>StatePill</code> makes about its label.</p>
  <p class="note"><strong>Colour carries more weight here than this system otherwise allows, and that is the stated cost.</strong> A slice has no room for a letter, so the redundancy moves to the accessible layer: a <code>role="img"</code> with a written name, always, spelling the mix out in full — "282 Common, 243 Rare, 110 Majestic". What remains as non-colour channels is the ORDER, which is the same ladder in every bar on the page, and the WIDTHS, which are the proportions themselves. Every surface that draws this prints the counts as text beside it.</p>
  <p class="note"><strong>No slice is narrower than two pixels, and that is a deliberate inexactness.</strong> Two Fabled printings among Monarch&rsquo;s 1,182 is about a pixel, which rounds away — so the bar would state the opposite of the truth about a rarity the set does contain. Being invisible is the worse error, so the floor is paid out of the slices that can afford it: <code>flex-grow</code> shares out what is left after the floors, which is also why the bar is always exactly its container.</p>`,
});

/**
 * One fact chip, in the shape `FactChip` renders — a plate at chip scale, the
 * label and the value in the masthead's own two voices.
 *
 * Named tokens only, so this card cannot draw a mark the product does not.
 */
function factChip(label: string | null, value: string): string {
  const half = (cls: string, text: string): string =>
    cls === "label"
      ? `<span style="font-family:var(--of-type-family-sans);font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);text-transform:uppercase;color:var(--of-color-ink-faint);white-space:nowrap">${text}</span>`
      : `<span style="font-family:var(--of-type-family-sans);font-size:var(--of-type-size-small);color:var(--of-color-ink-muted);white-space:nowrap">${text}</span>`;
  return `<span style="display:inline-flex;align-items:baseline;gap:var(--of-space-tighter);box-sizing:border-box;padding-block:var(--of-space-tightest);padding-inline:var(--of-space-tight);border-radius:var(--of-bevel-radius);background:var(--of-color-surface);box-shadow:inset 0 var(--of-bevel-width) 0 0 var(--of-bevel-light), inset 0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-dark);line-height:var(--of-type-leading-tight)">${label === null ? "" : half("label", label)}${half("value", value)}</span>`;
}

cards.push({
  path: "primitives/fact-chip.html",
  group: "Primitives",
  title: "Fact chip",
  body: `
  <p class="note">One datum, on its own plate. It exists because facts were being set as <em>sentences</em>: <code>7 August 2026 &middot; 24 cards &middot; 7 only here &middot; out of print</code> is a line a reader has to parse to find where one fact ends and the next begins, and a middot is a conjunction.</p>
  <div class="row" style="margin-block-start:var(--of-space-loose);gap:var(--of-space-tight);flex-wrap:wrap">
    ${factChip("Released", "7 May 2021")}${factChip("Card names", "155")}${factChip("Pitch versions", "307")}${factChip("Print status", "Out of print")}${factChip("Only here", "42")}
  </div>
  <div class="row" style="margin-block-start:var(--of-space-tight);gap:var(--of-space-tight);flex-wrap:wrap">
    ${factChip(null, "7 May 2021")}${factChip(null, "155 cards")}${factChip(null, "42 only here")}${factChip(null, "Out of print")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>No notch.</strong> <code>docs/DESIGN.md</code>: "notched corners mark anything carrying state &mdash; the clipped corner is the only ornament in the system and it always means something". A release date is not state, so this is a plain rectangle and <code>StatePill</code> is still the only object wearing the chamfer. A chip that borrowed it would spend the system's one ornament on its commonest object.</p>
  <p class="note"><strong>No colour either.</strong> Every filled mark here carries a DATA colour &mdash; the pitch palette, the rarity ramp, the state tones &mdash; and a fact has no value to be coloured by. So the plate is <code>color.surface</code> with the system's bevel pair struck into it: one step off the ground, saying nothing beyond "this is one thing". Where a fact <em>does</em> have a colour, the caller passes the mark that carries it into the chip's <code>mark</code> slot &mdash; which is how a set page's rarity legend is a row of these with a one-slice <code>RarityBar</code> in each.</p>
  <p class="note"><strong>The label is optional, and which surfaces use it is a rule rather than a taste.</strong> The first row above is a set's own page: one chip per fact, and the label is the question the reader arrived with. The second is an INDEX row, where the same four facts are drawn on a hundred rows &mdash; the labels would be a column of identical words, and the values already carry their units. One object either way; what changes is whether the page has already said the label a hundred times.</p>
  <p class="note"><strong>Two spellings, one plate.</strong> A row of chips is a pair of <code>&lt;span&gt;</code>s, because the grouping is visual and the markup should not invent a structure the page does not have. A masthead is a <code>&lt;dl&gt;</code> &mdash; those are term-and-value pairs and that is the element for them &mdash; so the chip renders a <code>&lt;div&gt;</code> holding a <code>&lt;dt&gt;</code> and a <code>&lt;dd&gt;</code> instead, which is the grouping HTML allows inside a description list and what keeps a label attached to its own value when the strip wraps.</p>
  <p class="note">No width token in either axis, on <code>PitchBox</code>'s argument: the chip is its words plus its padding, both of which are tokens, so both dimensions fall out of them. Two chips on a row are not equal columns &mdash; a fact is as wide as what it says.</p>`,
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
  <p class="note">A printed stat: the game's own mark, with the value the card prints beside it. <code>docs/DESIGN.md</code> asked for "cost in a hexagonal plate, power and defence in chamfered plates at the corners" and the component drew exactly that for several phases. It renders LSS's published symbols now, and the note below says what changed and what the plates are still for.</p>
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
  <p class="note" style="margin-block-start:var(--of-space-tight)"><strong>The symbol sits outboard and the numeral inboard of it</strong>, which is how the card sets its combat bar: <code>{p} 4</code> at one end and <code>2 {d}</code> at the other, with the artwork against the frame in both corners. On the card panel the end corner mirrors, so the marks line the two edges and the numerals face in toward the type line between them. <strong>Cost is the one exception</strong> — the card sets that numeral <em>inside</em> the resource disc, and so does this.</p>
  <p class="note"><strong>Nothing on the card panel is labelled.</strong> The words above are the gallery naming what it is showing you; the product prints none, because the card prints none and the marks are the ones a reader has already met. What the label used to carry lives in the accessible name, which spells the stat out in full — "Power 3", "No printed power" — at every size.</p>
  <p class="note" style="margin-block-start:var(--of-space-looser)"><strong>A stat the card does not print — which is not a stat printed 0.</strong></p>
  <div class="row" style="margin-block-start:var(--of-space-tight);align-items:center;gap:var(--of-space-looser);flex-wrap:wrap">
    ${[
      ["cost", "0", ""],
      ["cost", "", "absent"],
      ["power", "0", ""],
      ["power", "", "absent"],
      ["defence", "0", ""],
      ["defence", "", "absent"],
    ]
      .map(([kind, value, state]) =>
        statBadge(kind ?? "", kind ?? "", value ?? "", state === "absent"),
      )
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-tight)">1,648 cards print a cost of 0, 191 a defence of 0 and 13 a power of 0, so both members of each pair above are real and a reader has to be able to tell them apart. <strong>The mark survives the absence</strong> — it is what says WHICH stat is missing — and it greys out rather than disappearing, with <strong>no character at all</strong> in the value position. An en dash sat there until the values moved out of the plates; beside a mark, where every printed value now is, a dash reads as something the card prints. Spoken as "no printed power", which is where a claim about what is <em>not</em> on a card belongs.</p>
  <p class="note"><strong>This is the one thing the drawn plates did better.</strong> An absence used to be a recessed fill — a token, in the theme, checked like every other colour. An ingested PNG takes no token, so the greyed state is a filter instead. That is the price of rendering the game's own file, and it is stated here rather than discovered.</p>
  <p class="note">The card page draws these three whether or not a card fills them, because the frame reserves the positions; a hero, which has none of them, gets none.</p>
  <p class="note" style="margin-block-start:var(--of-space-loose)"><strong>The plates are the fallback, and they are still here.</strong> The component draws them wherever no artwork is supplied — in a story, where the site's <code>public/</code> is not mounted, and for the one stat the rules print no symbol for. The house vocabulary is a square plate, chamfered differently, and <strong>none of them is eight-sided</strong>: the pitch jewel owns that outline and the system promises it means pitch.</p>
  <div class="row" style="margin-block-start:var(--of-space-tight);align-items:center;gap:var(--of-space-looser);flex-wrap:wrap">
    ${[
      ["cost", "0"],
      ["power", "3"],
      ["defence", "2"],
      ["life", "20"],
      ["intellect", "4"],
      ["arcane", "1"],
    ]
      .map(
        ([kind, value]) =>
          `<div style="display:flex;align-items:center;gap:var(--of-space-tight)">${statPlate(kind ?? "", value ?? "")}<span class="eyebrow" style="margin:0">${kind ?? ""}</span></div>`,
      )
      .join("")}
  </div>
  <p class="note" style="margin-block-start:var(--of-space-tight)"><strong>One size, three areas, so the boxes are not all the same.</strong> The eye compares ink rather than bounding boxes: a chamfered plate keeps about 21% more of its box than a disc does. Each plate is therefore scaled by the square root of its silhouette's area against the disc's π/4. Four of the six are discs and so take the reference factor untouched — only the shield and arcane's chamfered plate are compensated, which is what makes the row above read as one size. <strong>The marks do not need it:</strong> the files are all square and all full-bleed, so the artwork resets the factor to one.</p>
  <p class="note"><strong>Arcane is the exception, and it is the one that proves the rule.</strong> 1.12.4 names eight symbols and arcane is not among them, so LSS publishes no icon for it and there is no printed register to take. It is the only stat that meets the plate in the product — and the card panel never asks for it at all, because the card prints that number in its rules text instead.</p>
  <p class="note">The plates reproduce no LSS symbol: they are the system's own shapes carrying our numerals, every colour a token. The marks above them <em>are</em> LSS's files, unmodified, ingested from LSS's own rules site with the provenance record <code>docs/COMPLIANCE.md</code> §3 requires. §3 bars logos and close semblances of them and blesses drawing from a mechanic; <code>{p}</code> is defined at 1.12.4d as the notation for a power value and identifies no brand. Cost is the one place a numeral is set <em>over</em> the artwork rather than beside it — the file is unaltered, the numeral is a separate element, and the composite is ours.</p>`,
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
          <p class="note" style="margin-block-start:var(--of-space-tight)">The words are this gallery naming its own row; <strong>the card panel prints none of them</strong>, because the card prints none and the marks are the game's own. Every mark here is one visual size — the stone is scaled to the artwork's box, and the artwork needs no optical factor because the files are square and full-bleed.</p>
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
