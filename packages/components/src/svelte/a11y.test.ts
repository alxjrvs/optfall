/**
 * Accessibility, asserted on every primitive, in both themes.
 *
 * `docs/PLAN.md` Phase 1: "The accessibility addon runs on every story in CI,
 * which turns the pitch jewel's contract — shape, numeral and colour carrying
 * the same fact three times — from an intention into a test."
 *
 * WHY jsdom + axe RATHER THAN A HEADLESS BROWSER. The obvious route is
 * Storybook's test runner driving Playwright, and it was rejected on cost: it
 * downloads a browser on every CI run to assert facts about markup and
 * computed colour that do not need a compositor. This renders each component
 * with Svelte's server renderer, mounts the HTML in jsdom under the real
 * generated theme stylesheet, and runs the same axe-core rules the Storybook
 * addon runs. Seconds rather than minutes, no browser in the gate, and the
 * addon still gives the same feedback interactively while developing.
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
import { JSDOM } from "jsdom";
import axe from "axe-core";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";

import { THEME_ATTRIBUTE, THEMES, themeStylesheet } from "optfall-theme";

import BevelledPlate from "./BevelledPlate.svelte";
import CardFace from "./CardFace.svelte";
import ResultRow from "./ResultRow.svelte";
import SearchField from "./SearchField.svelte";
import BrassSeal from "./BrassSeal.svelte";
import Citation from "./Citation.svelte";
import FiligreeCorner from "./FiligreeCorner.svelte";
import Mark from "./Mark.svelte";
import OrnamentalRule from "./OrnamentalRule.svelte";
import PitchJewel from "./PitchJewel.svelte";
import StatePill from "./StatePill.svelte";

/**
 * One case per meaningfully different rendering, not one per component. A
 * primitive whose variants differ only in a token value cannot fail
 * differently; a primitive whose variants change markup or contrast can.
 */
/**
 * A primitive that is only valid INSIDE something else names its container.
 *
 * `ResultRow` renders an `<li>`, which axe correctly refuses on its own — "must
 * be contained in a <ul> or <ol>". That is the component being right and the
 * harness mounting it wrong: every caller puts it in a list, and making the row
 * carry its own `<ul>` to satisfy a test would mean a list of results could
 * never be one list.
 *
 * So the case supplies the context instead. Nothing else needs it, which is why
 * it is optional rather than a required field on every case.
 */
const CASES: readonly {
  name: string;
  component: unknown;
  props: Record<string, unknown>;
  wrap?: [string, string];
}[] = [
  { name: "PitchJewel none", component: PitchJewel, props: { value: 0 } },
  { name: "PitchJewel one", component: PitchJewel, props: { value: 1 } },
  { name: "PitchJewel two", component: PitchJewel, props: { value: 2 } },
  { name: "PitchJewel three", component: PitchJewel, props: { value: 3 } },
  { name: "PitchJewel small", component: PitchJewel, props: { value: 3, size: "sm" } },
  { name: "BevelledPlate flat", component: BevelledPlate, props: {} },
  { name: "BevelledPlate raised", component: BevelledPlate, props: { emphasis: "raised" } },
  { name: "BevelledPlate sunken", component: BevelledPlate, props: { emphasis: "sunken" } },
  { name: "StatePill legal", component: StatePill, props: { tone: "legal", label: "Legal" } },
  { name: "StatePill banned", component: StatePill, props: { tone: "banned", label: "Banned" } },
  { name: "StatePill suspended", component: StatePill, props: { tone: "suspended", label: "Suspended" } },
  { name: "StatePill restricted", component: StatePill, props: { tone: "restricted", label: "Restricted" } },
  { name: "StatePill living-legend", component: StatePill, props: { tone: "living-legend", label: "Living Legend" } },
  { name: "StatePill not-in-format", component: StatePill, props: { tone: "not-in-format", label: "Not in format" } },
  { name: "StatePill verified", component: StatePill, props: { tone: "verified", label: "Verified" } },
  { name: "StatePill unverified", component: StatePill, props: { tone: "unverified", label: "Unverified" } },
  {
    name: "BrassSeal",
    component: BrassSeal,
    props: { judge: "A. Judge", date: "2026-03-14", rulesVersion: "2.11.0" },
  },
  {
    name: "Citation",
    component: Citation,
    props: { ruleId: "cr:8.3.4b", href: "https://optfall.com/cr/8.3.4b", version: "2.11.0" },
  },
  {
    name: "Citation unversioned",
    component: Citation,
    props: { ruleId: "cr:8.3.4b", href: "https://optfall.com/cr/8.3.4b" },
  },
  { name: "FiligreeCorner panel", component: FiligreeCorner, props: { role: "panel-corner" } },
  { name: "FiligreeCorner card", component: FiligreeCorner, props: { role: "card-corner" } },
  { name: "FiligreeCorner section", component: FiligreeCorner, props: { role: "section-rule" } },
  { name: "OrnamentalRule", component: OrnamentalRule, props: {} },
  { name: "Mark", component: Mark, props: {} },
  { name: "Mark small", component: Mark, props: { size: "sm" } },
  // The face carries a real accessible name and a copyright line that no
  // caller can drop. Both orientations, because the landscape box is a
  // different rendering rather than the same one scaled.
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
];

/**
 * The components' own scoped CSS, compiled from source and injected alongside
 * the theme.
 *
 * Without this the harness renders every primitive with the theme stylesheet
 * and NO component styles, because the Bun loader keeps only `js` from
 * `compile()` and discards `css`. axe would then judge markup that never
 * exists in production — and, worse, silently miss anything a component style
 * does to visibility: `FiligreeCorner`'s
 * `@media (forced-colors: active) { display: none }` is invisible to a checker
 * that cannot see the rule.
 *
 * Compiled with `generate: "client"` purely because that is the mode that emits
 * CSS; the markup still comes from the server renderer.
 */
const componentStyles = readdirSync(import.meta.dir)
  .filter((file) => file.endsWith(".svelte"))
  .map((file) => {
    const path = join(import.meta.dir, file);
    const { css } = compile(readFileSync(path, "utf8"), {
      generate: "client",
      filename: path,
    });
    return css?.code ?? "";
  })
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
 * ONE RUN PER CASE, NOT ONE PER THEME — and the reason is worth stating,
 * because an earlier version of this file looped over both themes and sold
 * "50 assertions in both themes" as coverage it did not have.
 *
 * A theme here is a swap of CSS custom-property VALUES on `:root`. The markup
 * is identical — `render()` is not passed a theme and no primitive branches on
 * one — and no axe rule enabled below reads a colour. The single rule that
 * would, `color-contrast`, is disabled because jsdom cannot evaluate it at all.
 * So the second pass re-ran the same 25 checks against the same DOM and could
 * not, even in principle, fail differently.
 *
 * Contrast across both themes IS asserted — numerically, from the token values,
 * in `packages/theme/src/tokens.test.ts`. That is where theme coverage lives,
 * and duplicating a count here only made this file look like it did more.
 */
describe("every primitive passes axe", () => {
  {
    const theme = THEMES[0]!;
    for (const { name, component, props, wrap } of CASES) {
      test(`${name}`, async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { body } = render(component as any, { props });
        const [open = "", close = ""] = wrap ?? [];
        const violations = await violationsFor(`${open}${body}${close}`, theme);

        // Name each violation in the failure rather than asserting a bare
        // count: "expected 1 to be 0" sends someone hunting, and axe already
        // knows exactly what is wrong and where.
        const described = violations.map(
          (v) => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} node(s)]`,
        );
        expect(described).toEqual([]);
      });
    }
  }
});
