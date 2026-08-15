/**
 * Accessibility, asserted on every primitive. The React port of
 * `src/svelte/a11y.test.ts`, case for case.
 *
 * `docs/PLAN.md` Phase 1: "The accessibility addon runs on every story in CI,
 * which turns the pitch jewel's contract — shape, numeral and colour carrying
 * the same fact three times — from an intention into a test."
 *
 * WHY THIS FILE EXISTS SEPARATELY rather than the Svelte one being edited in
 * place: Phase 6 deletes the Svelte sources, and this is the coverage that
 * would have gone with them. Porting it first is what makes that deletion a
 * move rather than a loss — `primitives.test.tsx` asserts the markup a port
 * could have quietly changed, and this asserts the part axe can see that a
 * human reading a diff cannot.
 *
 * WHY jsdom + axe RATHER THAN A HEADLESS BROWSER. The obvious route is a test
 * runner driving Playwright, and it was rejected on cost: it downloads a
 * browser on every CI run to assert facts about markup and computed colour that
 * do not need a compositor. This renders each component with React's static
 * renderer, mounts the HTML in jsdom under the real generated theme stylesheet
 * and the components' own CSS, and runs the same axe-core rules. Seconds rather
 * than minutes, and no browser in the gate.
 *
 * THE STYLESHEETS ARE READ, NOT COMPILED, and that is the one real improvement
 * the port brings. The Svelte harness had to run `compile()` over every
 * `.svelte` file purely to recover the scoped CSS the loader threw away — a
 * step that existed to undo something. React components import plain `.css`
 * files, so the harness reads the same bytes the browser gets.
 *
 * WHAT THIS DELIBERATELY CANNOT SEE, so nobody mistakes a pass for total
 * coverage: focus order and focus-visible styling (no layout, no real focus
 * ring), anything depending on element geometry, `prefers-reduced-motion`
 * behaviour, and any media query jsdom does not evaluate — `forced-colors`
 * among them, which `FiligreeCorner` uses to hide itself. Those belong to the
 * visual-regression pass.
 *
 * AND IT DOES NOT CHECK COLOUR CONTRAST — verified, not assumed. axe's
 * `color-contrast` rule needs a canvas to sample rendered pixels, which jsdom
 * does not provide; probed against `#777777` text on `#888888`, it returns
 * **incomplete**, not a violation. An incomplete result is silent, so leaving
 * the rule enabled would let this suite look like it covered contrast while
 * covering nothing. It is disabled explicitly below for that reason.
 *
 * Contrast is instead asserted numerically in `packages/theme/src/tokens.test.ts`,
 * which computes WCAG ratios from the token values themselves — for both themes,
 * for body text, for the accent, for brass, for every state chip against its own
 * ink, and for every pitch numeral against its own stone. That is the stronger
 * check anyway: it tests the palette rather than one rendering of it, and it
 * cannot return "incomplete".
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";
import axe from "axe-core";
import { JSDOM } from "jsdom";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { THEME_ATTRIBUTE, THEMES, themeStylesheet } from "optfall-theme";

import { type PageSize, PRIMITIVES } from "../index";

import { BevelledPlate } from "./BevelledPlate";
import { BrassSeal } from "./BrassSeal";
import { CardFace } from "./CardFace";
import { Citation } from "./Citation";
import { FiligreeCorner } from "./FiligreeCorner";
import { GameSymbol } from "./GameSymbol";
import { Mark } from "./Mark";
import { OrnamentalRule } from "./OrnamentalRule";
import { Pagination } from "./Pagination";
import { PitchJewel } from "./PitchJewel";
import { PitchRule } from "./PitchRule";
import { ResultRow } from "./ResultRow";
import { SearchField } from "./SearchField";
import { StatePill } from "./StatePill";
import { StatGlyph } from "./StatGlyph";

/**
 * One case per meaningfully different rendering, not one per component. A
 * primitive whose variants differ only in a token value cannot fail
 * differently; a primitive whose variants change markup or contrast can.
 *
 * A primitive that is only valid INSIDE something else names its container.
 * `ResultRow` renders an `<li>`, which axe correctly refuses on its own — "must
 * be contained in a <ul> or <ol>". That is the component being right and the
 * harness mounting it wrong: every caller puts it in a list, and making the row
 * carry its own `<ul>` to satisfy a test would mean a list of results could
 * never be one list. So the case supplies the context instead.
 */
interface Case {
  readonly name: string;
  // biome-ignore lint/suspicious/noExplicitAny: the table is heterogeneous by design — fourteen components with fourteen prop types. Each row's props are checked against its own component where it is written; the table's element type only has to hold them.
  readonly component: ComponentType<any>;
  readonly props: Record<string, unknown>;
  readonly wrap?: readonly [string, string];
}

const CASES: readonly Case[] = [
  { name: "PitchJewel none", component: PitchJewel, props: { value: 0 } },
  { name: "PitchJewel one", component: PitchJewel, props: { value: 1 } },
  { name: "PitchJewel two", component: PitchJewel, props: { value: 2 } },
  { name: "PitchJewel three", component: PitchJewel, props: { value: 3 } },
  {
    name: "PitchJewel small",
    component: PitchJewel,
    props: { value: 3, size: "sm" },
  },

  /*
   * The rule's whole accessible surface is its name, because a band has no
   * text node to fall back on. So the cases here are the ones where the name
   * is the only thing an assistive reader gets: a single pitch, the collapsed
   * three-version card the card index renders constantly, and the no-pitch
   * card whose band is grey rather than absent.
   */
  { name: "PitchRule one", component: PitchRule, props: { values: [1] } },
  {
    name: "PitchRule three versions",
    component: PitchRule,
    props: { values: [1, 2, 3] },
  },
  { name: "PitchRule none", component: PitchRule, props: { values: [0] } },
  {
    name: "PitchRule small",
    component: PitchRule,
    props: { values: [2, 3], size: "sm" },
  },

  { name: "BevelledPlate flat", component: BevelledPlate, props: {} },
  {
    name: "BevelledPlate raised",
    component: BevelledPlate,
    props: { emphasis: "raised" },
  },
  {
    name: "BevelledPlate sunken",
    component: BevelledPlate,
    props: { emphasis: "sunken" },
  },

  {
    name: "StatePill legal",
    component: StatePill,
    props: { tone: "legal", label: "Legal" },
  },
  {
    name: "StatePill banned",
    component: StatePill,
    props: { tone: "banned", label: "Banned" },
  },
  {
    name: "StatePill suspended",
    component: StatePill,
    props: { tone: "suspended", label: "Suspended" },
  },
  {
    name: "StatePill restricted",
    component: StatePill,
    props: { tone: "restricted", label: "Restricted" },
  },
  {
    name: "StatePill living-legend",
    component: StatePill,
    props: { tone: "living-legend", label: "Living Legend" },
  },
  {
    name: "StatePill not-in-format",
    component: StatePill,
    props: { tone: "not-in-format", label: "Not in format" },
  },
  {
    name: "StatePill verified",
    component: StatePill,
    props: { tone: "verified", label: "Verified" },
  },
  {
    name: "StatePill unverified",
    component: StatePill,
    props: { tone: "unverified", label: "Unverified" },
  },

  {
    name: "BrassSeal",
    component: BrassSeal,
    props: { judge: "A. Judge", date: "2026-03-14", rulesVersion: "2.11.0" },
  },
  {
    name: "Citation",
    component: Citation,
    props: {
      ruleId: "cr:8.3.4b",
      href: "https://optfall.com/cr/8.3.4b",
      version: "2.11.0",
    },
  },
  {
    name: "Citation unversioned",
    component: Citation,
    props: { ruleId: "cr:8.3.4b", href: "https://optfall.com/cr/8.3.4b" },
  },

  {
    name: "FiligreeCorner panel",
    component: FiligreeCorner,
    props: { role: "panel-corner" },
  },
  {
    name: "FiligreeCorner card",
    component: FiligreeCorner,
    props: { role: "card-corner" },
  },
  {
    name: "FiligreeCorner section",
    component: FiligreeCorner,
    props: { role: "section-rule" },
  },

  { name: "OrnamentalRule", component: OrnamentalRule, props: {} },
  { name: "Mark", component: Mark, props: {} },
  { name: "Mark small", component: Mark, props: { size: "sm" } },

  /*
    THE PLATE FAMILY, every silhouette, both components.

    Both carry their meaning as `role="img"` plus an `aria-label`, with the
    visible glyph `aria-hidden`, so a rendering that lost the label would leave
    a screen reader with nothing at all. That is exactly the failure axe catches
    and exactly the one worth catching.

    Enumerated rather than sampled: the whole contract is that each `kind` picks
    a different silhouette, so "one kind passes" says nothing about the other
    eight.
  */
  {
    name: "StatGlyph cost",
    component: StatGlyph,
    props: { kind: "cost", value: "3" },
  },
  {
    name: "StatGlyph power",
    component: StatGlyph,
    props: { kind: "power", value: "4" },
  },
  {
    name: "StatGlyph defence",
    component: StatGlyph,
    props: { kind: "defence", value: "2" },
  },
  {
    name: "StatGlyph life",
    component: StatGlyph,
    props: { kind: "life", value: "20" },
  },
  {
    name: "StatGlyph intellect",
    component: StatGlyph,
    props: { kind: "intellect", value: "4" },
  },
  {
    name: "StatGlyph arcane",
    component: StatGlyph,
    props: { kind: "arcane", value: "1" },
  },
  /*
   * The empty socket, at the contrast axe can check. Its plate is the one
   * colour pair in this component that exists to RECEDE, which is exactly the
   * direction that drifts under 4.5:1 without anybody noticing — the dash is
   * small, and a reader who cannot make it out has been told nothing at all.
   */
  {
    name: "StatGlyph cost absent",
    component: StatGlyph,
    props: { kind: "cost", value: null },
  },
  {
    name: "StatGlyph power absent",
    component: StatGlyph,
    props: { kind: "power", value: null },
  },
  {
    name: "StatGlyph defence absent",
    component: StatGlyph,
    props: { kind: "defence", value: null },
  },
  // `X` and `*` are printed values upstream, which is why `value` is a string.
  {
    name: "StatGlyph variable",
    component: StatGlyph,
    props: { kind: "cost", value: "XX" },
  },
  {
    name: "StatGlyph meta-static",
    component: StatGlyph,
    props: { kind: "power", value: "*" },
  },

  {
    name: "GameSymbol power",
    component: GameSymbol,
    props: { kind: "power", letter: "P", name: "power" },
  },
  {
    name: "GameSymbol resource",
    component: GameSymbol,
    props: { kind: "resource", letter: "R", name: "resource" },
  },
  {
    name: "GameSymbol defence",
    component: GameSymbol,
    props: { kind: "defence", letter: "D", name: "defence" },
  },
  {
    name: "GameSymbol life",
    component: GameSymbol,
    props: { kind: "life", letter: "H", name: "life" },
  },
  {
    name: "GameSymbol intellect",
    component: GameSymbol,
    props: { kind: "intellect", letter: "I", name: "intellect" },
  },
  {
    name: "GameSymbol chi",
    component: GameSymbol,
    props: { kind: "chi", letter: "C", name: "chi" },
  },
  {
    name: "GameSymbol tap",
    component: GameSymbol,
    props: { kind: "tap", letter: "T", name: "tap" },
  },
  {
    name: "GameSymbol untap",
    component: GameSymbol,
    props: { kind: "untap", letter: "U", name: "untap" },
  },
  {
    name: "GameSymbol x",
    component: GameSymbol,
    props: { kind: "x", letter: "X", name: "X" },
  },
  {
    name: "GameSymbol inline in a sentence",
    component: GameSymbol,
    props: { kind: "power", letter: "P", name: "power" },
    wrap: ["<p>Target attack gets +1", "</p>"],
  },
  /*
    WITH THE INGESTED ARTWORK, which is the branch the card pages actually take.
    The question this asks is the double-naming one: the wrapper is `role="img"`
    with the rules' word, and the `<img>` inside it must therefore be `alt=""` —
    an image with its own accessible name nested inside a named `img` role
    announces the symbol twice, which is worse in a sentence than in a stat
    block because it happens mid-clause.
  */
  {
    name: "GameSymbol power, with artwork",
    component: GameSymbol,
    props: {
      kind: "power",
      letter: "P",
      name: "power",
      src: "/symbols/icon_p.png",
      width: 105,
      height: 105,
    },
  },
  {
    name: "GameSymbol defence, with artwork",
    component: GameSymbol,
    props: {
      kind: "defence",
      letter: "D",
      name: "defence",
      src: "/symbols/icon_d.png",
      width: 105,
      height: 105,
    },
  },
  {
    name: "GameSymbol with artwork, inline in a sentence",
    component: GameSymbol,
    props: {
      kind: "resource",
      letter: "R",
      name: "resource",
      src: "/symbols/icon_r.png",
      width: 105,
      height: 105,
    },
    wrap: ["<p>Gain 1", "</p>"],
  },

  /*
    The face carries a real accessible name and a copyright line that no caller
    can drop. Both orientations, because the landscape box is a different
    rendering rather than the same one scaled.
  */
  {
    name: "CardFace portrait",
    component: CardFace,
    props: {
      src: "https://optfall-images.netlify.app/normal/MST131.webp",
      alt: "Command and Conquer (pitch 1) — Guardian Action - Attack",
      width: 450,
      height: 628,
    },
  },
  {
    name: "CardFace landscape",
    component: CardFace,
    props: {
      src: "https://optfall-images.netlify.app/normal/HVY140.webp",
      alt: "Crown of Providence — Head",
      width: 628,
      height: 450,
    },
  },

  // The one real control in the library: a labelled form carrying a named
  // search landmark, which is exactly the shape axe has opinions about.
  {
    name: "SearchField",
    component: SearchField,
    props: {
      label: "Search the cards",
      region: "Flesh and Blood cards",
      action: "/",
      value: "",
      placeholder: "command and conquer",
    },
  },

  // A list row is a link with facts under it — the shape axe checks for an
  // accessible name and for list semantics.
  {
    name: "ResultRow",
    component: ResultRow,
    props: { href: "/card/head-jab-1", label: "Head Jab (pitch 1)" },
    wrap: ['<ul class="results">', "</ul>"],
  },

  /*
    THE PAGER, AT ITS THREE DIFFERENT MARKUPS rather than once.

    Its ends are the cases that differ structurally: on page one "Previous" is
    an inert `<span>` where every sibling is an `<a>`, and on the last page
    "Next" is. In the middle both are links and BOTH ellipses render — the only
    rendering that has two `aria-hidden` list items inside an `<ol>`, which is
    the shape axe's `list` rule is entitled to object to.

    The one-page case is not degenerate padding either: it is the rendering with
    no numbered run at all, where the whole control is a sentence and the
    rows-per-page links, and it is what most queries actually get.
  */
  {
    name: "Pagination first page",
    component: Pagination,
    props: {
      page: 1,
      pages: 12,
      size: 60,
      sizes: [30, 60, 120, 240, "all"],
      total: 703,
      from: 1,
      to: 60,
      unit: "cards",
      href: (page: number) => `/search?q=attack&page=${page}`,
      sizeHref: (size: PageSize) => `/search?q=attack&per=${size}`,
    },
  },
  {
    name: "Pagination mid-run, both gaps drawn",
    component: Pagination,
    props: {
      page: 6,
      pages: 12,
      size: 60,
      sizes: [30, 60, 120, 240, "all"],
      total: 703,
      from: 301,
      to: 360,
      unit: "cards",
      href: (page: number) => `/search?q=attack&page=${page}`,
      sizeHref: (size: PageSize) => `/search?q=attack&per=${size}`,
    },
  },
  {
    name: "Pagination last page",
    component: Pagination,
    props: {
      page: 12,
      pages: 12,
      size: 60,
      sizes: [30, 60, 120, 240, "all"],
      total: 703,
      from: 661,
      to: 703,
      unit: "cards",
      href: (page: number) => `/search?q=attack&page=${page}`,
      sizeHref: (size: PageSize) => `/search?q=attack&per=${size}`,
    },
  },
  {
    name: "Pagination single page",
    component: Pagination,
    props: {
      page: 1,
      pages: 1,
      size: "all",
      sizes: [30, 60, 120, 240, "all"],
      total: 9,
      from: 1,
      to: 9,
      unit: "sections",
      href: (page: number) => `/cr?q=dominate&page=${page}`,
      sizeHref: (size: PageSize) => `/cr?q=dominate&per=${size}`,
    },
  },
];

/**
 * The components' own CSS, read from the files the components import.
 *
 * Without this the harness would render every primitive with the theme
 * stylesheet and NO component styles, and axe would judge markup that never
 * exists in production — worse, it would silently miss anything a component
 * style does to visibility: `FiligreeCorner`'s
 * `@media (forced-colors: active) { display: none }` is invisible to a checker
 * that cannot see the rule.
 */
const componentStyles = readdirSync(import.meta.dir)
  .filter((file) => file.endsWith(".css"))
  .sort()
  .map((file) => readFileSync(join(import.meta.dir, file), "utf8"))
  .join("\n");

const stylesheet = themeStylesheet();

async function violationsFor(
  markup: string,
  theme: string,
): Promise<axe.Result[]> {
  const dom = new JSDOM(
    `<!doctype html><html ${THEME_ATTRIBUTE}="${theme}"><head>` +
      `<style>${stylesheet}</style><style>${componentStyles}</style></head>` +
      `<body style="background: var(--of-color-ground); color: var(--of-color-ink)">${markup}</body></html>`,
    { pretendToBeVisual: true },
  );

  try {
    return await runAxe(dom);
  } finally {
    // In a `finally` because a rejected `axe.run` would otherwise leave this
    // `pretendToBeVisual` window open with its animation-frame timer live,
    // hanging `bun test` after a failure instead of reporting one.
    dom.window.close();
  }
}

async function runAxe(dom: JSDOM): Promise<axe.Result[]> {
  const { window } = dom;
  const results = await axe.run(window.document.body, {
    // Rules that need a whole document rather than a fragment would fail every
    // component for reasons that are a property of this harness, not of the
    // component. Landmarks, page titles and region structure belong to the
    // page-level check on the built site, not here.
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
    },
    rules: {
      region: { enabled: false },
      "page-has-heading-one": { enabled: false },
      "landmark-one-main": { enabled: false },
      bypass: { enabled: false },
      // Off deliberately, and NOT because contrast does not matter — it is the
      // rule that matters most here. jsdom has no canvas, so axe cannot sample
      // pixels and reports `incomplete` rather than a violation, which is a
      // silent result that would make this suite appear to cover contrast while
      // covering nothing. tokens.test.ts computes the ratios directly instead.
      "color-contrast": { enabled: false },
    },
  });

  return results.violations;
}

/**
 * ONE RUN PER CASE, NOT ONE PER THEME.
 *
 * A theme here is a swap of CSS custom-property VALUES on `:root`. The markup
 * is identical — no primitive branches on a theme — and no axe rule enabled
 * below reads a colour. The single rule that would, `color-contrast`, is
 * disabled because jsdom cannot evaluate it at all. So a second pass would
 * re-run the same checks against the same DOM and could not, even in principle,
 * fail differently.
 *
 * Contrast across both themes IS asserted — numerically, from the token values,
 * in `packages/theme/src/tokens.test.ts`. That is where theme coverage lives,
 * and duplicating a count here would only make this file look like it did more.
 */
describe("every primitive passes axe", () => {
  const theme = THEMES[0]!;

  for (const { name, component, props, wrap } of CASES) {
    test(`${name}`, async () => {
      const body = renderToStaticMarkup(createElement(component, props));
      const [open = "", close = ""] = wrap ?? [];
      const violations = await violationsFor(`${open}${body}${close}`, theme);

      // Name each violation in the failure rather than asserting a bare count:
      // "expected 1 to be 0" sends someone hunting, and axe already knows
      // exactly what is wrong and where.
      const described = violations.map(
        (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} node(s)]`,
      );
      expect(described).toEqual([]);
    });
  }

  /**
   * THE TABLE ABOVE IS HAND-MAINTAINED, SO SOMETHING HAS TO CHECK IT IS
   * COMPLETE.
   *
   * Fifty passing cases say nothing about the primitive that has no case at
   * all: a component added without a row here is reported green by a suite that
   * never rendered it. That is the same "looks like coverage" failure the
   * design-system gate catches one layer up, where a single gallery card stood
   * in for three primitives and tracked none of them — so the axe table gets the
   * same treatment as the catalog.
   *
   * It checks against `PRIMITIVES`, the closed set `src/index.ts` declares, for
   * the reason `parity.test.ts` gives: that is the contract, and two
   * hand-maintained lists agreeing proves only that they agree.
   */
  test("every primitive the library declares has at least one case", () => {
    /*
      `pitch-jewel` → `PitchJewel`. Both spellings are correct and neither
      should move to meet the other; `parity.test.ts` states the same mapping
      for the same reason.
    */
    const componentName = (id: string): string =>
      id
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");

    const covered = new Set(CASES.map((entry) => entry.component.name));

    const missing = PRIMITIVES.filter((id) => !covered.has(componentName(id)))
      .map((id) => `${componentName(id)} (${id}) has no axe case`)
      .toSorted();

    expect(missing).toEqual([]);
  });
});
