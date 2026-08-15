/**
 * The files the build emits that are not pages.
 *
 * WHY THIS EXISTS AT ALL. Astro had a shape for this — a `.ts` file under
 * `src/pages/` exporting `GET`, an "endpoint route", built once and written out
 * beside the HTML. The generator had no equivalent, and the gap was invisible
 * to every check: `document.tsx` has linked `/favicon.svg` since layer 2, page
 * parity was measured at 13,675 = 13,675, and the one file that made the link
 * resolve was not a page, so nothing counted it and nothing missed it. Every
 * generated page carried a broken icon link and the build reported success.
 *
 * So the registry is explicit rather than a directory convention. A convention
 * would have been the thing that silently produced nothing when it was not
 * followed, which is the failure this file was written to answer.
 *
 * Static files that need no build step do NOT belong here — they go in
 * `public/`, which Vite copies wholesale. This is only for bytes that are
 * DERIVED, and derived is what earns the extra machinery: the favicon is drawn
 * from the same geometry and the same token tables the on-page mark uses, so
 * there is no second declaration to drift.
 */

import { MARK_GEOMETRY } from "optfall-components";
import { type TokenId, type TokenTable, themes } from "optfall-theme";

/**
 * The colour the platform paints around the app, and the one the browser paints
 * behind the page before the first byte of CSS lands.
 *
 * EXPORTED SO THE `<meta name="theme-color">` AND THE MANIFEST CANNOT DISAGREE.
 * They are two declarations of one fact read by different consumers — the meta
 * tag by the browser's own chrome on a live page, the manifest field by the
 * installer — and a site whose address bar is one colour installed and another
 * in a tab is exactly the drift that is invisible until somebody installs it.
 */
export const THEME_COLOUR: string = literal(themes.dark.tokens, "color.ground");

export interface GeneratedAsset {
  /** Path relative to the output root. No leading slash. */
  readonly path: string;
  readonly contents: string;
}

/**
 * A token's literal value, or a build failure.
 *
 * `TokenTable` is a `Partial` record, so every lookup is `string | undefined`
 * and the tempting spelling is `?? "#000"`. That fallback is the bug: a token
 * renamed in `packages/theme` would leave the tab showing a black lozenge and
 * nothing anywhere would say so. This runs at build time, so throwing means a
 * failed build rather than a wrong favicon — the loud failure is free here.
 */
function literal(tokens: TokenTable, id: TokenId): string {
  const value = tokens[id];
  if (value === undefined) {
    throw new Error(
      `favicon.svg: optfall-theme defines no ${id}. The favicon reads token values directly because it cannot see the page stylesheet; fix the token id rather than inlining a colour here.`,
    );
  }
  return value;
}

/**
 * `/favicon.svg` — the mark, in the tab.
 *
 * WHAT THIS FIXES. `docs/DESIGN.md` says of the mark that "the logo and the
 * core interface primitive are the same object: the thing you see a thousand
 * times a session is the thing on the tab", and `Mark.tsx` carries forward the
 * claim that it "IS DRAWN AS AN SVG BECAUSE IT HAS TO SURVIVE A FAVICON" — a
 * claim it justifies down to the device pixel. Without this the constraint that
 * dictated the mark's whole form is paid for and never spent.
 *
 * IT IS GENERATED RATHER THAN A FILE IN `public/`, and that is the point. A
 * checked-in `favicon.svg` is a second drawing of the mark: it cannot import
 * anything, so it carries its own copy of the geometry and its own copy of the
 * palette, and both drift silently — nothing fails when a hand-copied hex stops
 * matching `color.accent`, because a favicon has no test that looks at it.
 *
 * WHAT IT DELIBERATELY DROPS FROM THE ON-PAGE MARK:
 *
 * - **The bevel.** `Mark` carries a light top edge and a dark bottom one as two
 *   1px drop-shadows, and needs `overflow: visible` so an SVG root does not
 *   shear them off at the viewBox. A favicon is rasterised at 16px inside
 *   exactly that clip, where a 1px edge is both uncuttable and mud. The bevel is
 *   the "struck metal" reading, and it is the right thing to lose first.
 * - **`currentColor`.** There is no inherited colour in a document nobody
 *   styles, so the link gets a literal accent — see the theme note below.
 *
 * WHAT IT KEEPS is the one thing that has to survive: a ring with an open
 * window. The window is what makes it a link rather than a lozenge, and it is
 * the last thing to close as the icon gets smaller.
 *
 * THE FAVICON IS THEMED, AND IT HAS TO BE, because it is composited against
 * furniture we do not own. A tab strip is the browser's chrome, not our ground,
 * so the link sits on near-black in a dark browser and on light grey in a light
 * one, and has to hold against both.
 *
 * It is the accent in either: `docs/DESIGN.md` rations boldness to two places
 * and a logo is one of them, and a single link has no pitch value to carry, so
 * it takes blood rather than a third of a palette. The light palette darkens its
 * accent rather than reusing the dark one, which is a decision the theme already
 * made and this file only has to not undo.
 *
 * `prefers-color-scheme` inside the SVG's own `<style>` is what carries this. A
 * referenced SVG gets no page CSS but does get its own media queries, so this is
 * the one mechanism available — and where it is unsupported the media block is
 * simply skipped and the dark palette below stands, which is the correct default
 * for a project whose native key is black.
 *
 * CACHING IS NOT SET HERE, AND CANNOT BE. This is a file on disk; Netlify serves
 * it with revalidation and an `ETag`, which is the correct policy for an asset
 * at a fixed address whose bytes change with the palette. If it ever needs to be
 * something else it belongs in `netlify.toml` beside the other header rules.
 */
function faviconSvg(): string {
  const { single, link } = MARK_GEOMETRY;
  const dark = themes.dark.tokens;
  const light = themes.light.tokens;

  /*
   * Presentation attributes rather than a fill on each element, so the media
   * query has something to override — an inline `fill` would win against a
   * stylesheet rule and pin the mark to one palette.
   */
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${single.viewBox}">
<style>
.link { color: ${literal(dark, "color.accent")} }
@media (prefers-color-scheme: light) {
.link { color: ${literal(light, "color.accent")} }
}
</style>
<g transform="${single.placement}"><path class="link" d="${link}" fill-rule="evenodd" fill="currentColor"/></g>
</svg>
`;
}

/**
 * `/icon.svg` — the mark again, at install size.
 *
 * SEPARATE FROM `favicon.svg` FOR ONE REASON: `purpose: "maskable"`. An
 * installed icon is cropped to whatever silhouette the platform uses — a circle
 * on Android, a squircle on iOS — and the mark is a wide, thin ring. Dropped
 * into a maskable slot at its own proportions it loses both ends.
 *
 * So this is the same path, on a square canvas, inside the **safe zone the spec
 * defines**: a maskable icon is guaranteed only the centre 80% of each axis, so
 * the mark is scaled to fit a circle of 40% radius about the centre rather than
 * to the full square. It also paints the ground, because a maskable icon with a
 * transparent background gets a platform-chosen fill behind it, and this
 * project's whole visual key is that the mark sits on near-black.
 *
 * IT IS NOT THEMED, unlike the favicon, and that is deliberate rather than an
 * omission. A favicon composites against browser chrome we do not own, so it has
 * to hold on both. An installed icon sits on the user's home screen as OUR
 * surface — one identity, the dark one, which `docs/DESIGN.md` calls the native
 * key.
 */
function iconSvg(): string {
  const { single, link } = MARK_GEOMETRY;
  const dark = themes.dark.tokens;

  /*
   * The viewBox is `x y w h`; the mark is wider than it is tall, so the square
   * canvas is built from the LONGER side and the shorter one is centred in it.
   * Read from the geometry rather than restated — the numbers below are
   * arithmetic on the source of truth, not a second copy of it.
   */
  const [vx = 0, vy = 0, vw = 1, vh = 1] = single.viewBox
    .split(/\s+/)
    .map(Number);

  /* The safe zone: the centre 80%, so the canvas is the mark's longer side
     divided by 0.8, with the mark centred inside it. */
  const side = Math.max(vw, vh) / 0.8;
  const x = vx + vw / 2 - side / 2;
  const y = vy + vh / 2 - side / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${side} ${side}">
<rect x="${x}" y="${y}" width="${side}" height="${side}" fill="${literal(dark, "color.ground")}"/>
<g transform="${single.placement}"><path d="${link}" fill-rule="evenodd" fill="${literal(dark, "color.accent")}"/></g>
</svg>
`;
}

/**
 * `/manifest.webmanifest` — what makes the site installable.
 *
 * THE ICON IS SVG AND THERE IS NO PNG, which is a real limitation stated rather
 * than hidden. Producing a raster icon needs a rasteriser in the build, and the
 * alternative — hand-drawing the mark once more as a PNG — is the second copy
 * of the geometry that `faviconSvg` exists to avoid, except worse, because a
 * bitmap cannot be re-derived when the palette moves. Chromium accepts SVG
 * manifest icons and installs on them; iOS Safari wants a PNG
 * `apple-touch-icon` and will fall back to a screenshot of the page without one.
 * That is the cost, and it is paid knowingly: the install prompt works where
 * most of this site's readers are, and the day a rasteriser is worth adding, the
 * PNG comes from `iconSvg()` rather than from a designer's export.
 *
 * `display: "minimal-ui"` RATHER THAN `"standalone"`, and this one is about what
 * the site IS. Optfall's thesis is that every view is a URL — 13,675 of them,
 * each meant to be pasted. `standalone` removes the address bar, which removes
 * the affordance the product is built around. `minimal-ui` keeps a way to see
 * and copy the URL while still installing to a home screen.
 *
 * `start_url` IS `/search` RATHER THAN `/`. The front door exists to send
 * somebody who arrived from elsewhere to a card; a reader who has installed the
 * app has already arrived, every time. `/search` is the room the door opens
 * onto and the surface with the full index on it.
 */
function manifest(): string {
  const dark = themes.dark.tokens;

  return `${JSON.stringify(
    {
      name: "Optfall — Flesh and Blood card search",
      short_name: "Optfall",
      description:
        "Search every Flesh and Blood card. Every card has a permanent, citable URL with its printed text, its printings and its per-format legality.",
      id: "/",
      start_url: "/search",
      scope: "/",
      display: "minimal-ui",
      /* The chrome the platform paints around the app, and the colour behind
         the page before the first paint. Both are the ground rather than the
         accent: this is furniture, and the accent is rationed. */
      theme_color: literal(dark, "color.ground"),
      background_color: literal(dark, "color.ground"),
      icons: [
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

export const GENERATED_ASSETS: readonly GeneratedAsset[] = [
  { path: "favicon.svg", contents: faviconSvg() },
  { path: "icon.svg", contents: iconSvg() },
  { path: "manifest.webmanifest", contents: manifest() },
];
