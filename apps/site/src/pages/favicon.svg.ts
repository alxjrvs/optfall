/**
 * `/favicon.svg` — the mark, in the tab.
 *
 * WHAT THIS FIXES. `docs/DESIGN.md` says of the mark that "the logo and the
 * core interface primitive are the same object: the thing you see a thousand
 * times a session is the thing on the tab", and `Mark.svelte` opens with "IT IS
 * DRAWN AS AN SVG BECAUSE IT HAS TO SURVIVE A FAVICON" — a claim it justifies
 * down to the device pixel. The site then shipped without a favicon of any
 * kind, so the constraint that dictated the mark's whole form was paid for and
 * never spent, and every Optfall tab carried a browser default.
 *
 * IT IS AN ENDPOINT RATHER THAN A FILE IN `public/`, and that is the point. A
 * checked-in `favicon.svg` is a second drawing of the mark: it cannot import
 * anything, so it carries its own copy of the geometry and its own copy of the
 * palette, and both drift silently — nothing fails when a hand-copied hex stops
 * matching `color.accent`, because a favicon has no test that looks at it. This
 * file is generated during `astro build` from `MARK_GEOMETRY` and the theme's
 * own token tables, which is the same argument `themeStylesheet()` makes about
 * the stylesheet: no second declaration means nothing to drift.
 *
 * WHAT IT DELIBERATELY DROPS FROM THE ON-PAGE MARK:
 *
 * - **The bevel.** `Mark.svelte` carries a light top edge and a dark bottom one
 *   as two 1px drop-shadows, and needs `overflow: visible` so an SVG root does
 *   not shear them off at the viewBox. A favicon is rasterised at 16px inside
 *   exactly that clip, where a 1px edge is both uncuttable and mud. The bevel
 *   is the "struck metal" reading, and it is the right thing to lose first.
 * - **`currentColor`.** There is no inherited colour in a document nobody
 *   styles, so the pavilion gets a literal ink — see the theme note below.
 *
 * WHAT IT KEEPS is the order of importance the mark was designed around: the
 * gap between crown and pavilion first, the two solids second, the hairline
 * along the cut face last.
 */
import type { APIRoute } from "astro";

import { MARK_GEOMETRY } from "optfall-components";
import { type TokenId, type TokenTable, themes } from "optfall-theme";

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
 * THE FAVICON IS THEMED, AND IT HAS TO BE, because it is composited against
 * furniture we do not own. A tab strip is the browser's chrome, not our ground,
 * so the mark sits on near-black in a dark browser and on light grey in a light
 * one — and the pavilion is the ink token precisely so it stays the *opposite*
 * of whatever it is sitting on.
 *
 * The crown and the cleave stay blood in both, as on the page: `docs/DESIGN.md`
 * rations boldness to two places and a logo is one of them. The light palette
 * darkens its accent rather than reusing the dark one, which is a decision the
 * theme already made and this file only has to not undo.
 *
 * `prefers-color-scheme` inside the SVG's own `<style>` is what carries this.
 * A referenced SVG gets no page CSS but does get its own media queries, so this
 * is the one mechanism available — and where it is unsupported the media block
 * is simply skipped and the dark palette below stands, which is the correct
 * default for a project whose native key is black.
 */
const dark = themes.dark.tokens;
const light = themes.light.tokens;

export const GET: APIRoute = () => {
  const { viewBox, crown, pavilion, cleave } = MARK_GEOMETRY;

  /*
   * Presentation attributes rather than a fill on each element, so the media
   * query below has something to override — an inline `fill` would win against
   * a stylesheet rule and pin the mark to one palette.
   */
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
<style>
.crown, .cleave { color: ${literal(dark, "color.accent")} }
.pavilion { color: ${literal(dark, "color.ink")} }
@media (prefers-color-scheme: light) {
.crown, .cleave { color: ${literal(light, "color.accent")} }
.pavilion { color: ${literal(light, "color.ink")} }
}
</style>
<polygon class="crown" points="${crown}" fill="currentColor"/>
<polygon class="pavilion" points="${pavilion}" fill="currentColor"/>
<line class="cleave" x1="${cleave.x1}" y1="${cleave.y1}" x2="${cleave.x2}" y2="${cleave.y2}" stroke="currentColor" stroke-width="${cleave.width}"/>
</svg>
`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      /*
       * Not `immutable`. The address is fixed and the bytes are not — a palette
       * change reissues this file at the same URL, and a year-long immutable
       * cache would leave the old mark in the tab of everyone who had ever
       * visited, with no way to reach them.
       */
      "Cache-Control": "public, max-age=86400",
    },
  });
};
