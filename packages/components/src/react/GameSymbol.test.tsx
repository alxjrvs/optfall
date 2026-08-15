/**
 * The artwork branch of `GameSymbol`, and the cascade bug that shipped in it.
 *
 * A symbol with `src` must render LSS's own icon UNCLIPPED and UNPLATED. The
 * first Svelte version got that wrong in a way no screenshot caught: the reset
 * was written as `.art`, the silhouettes as `.power`/`.defence`/…, Svelte
 * scoping gives both exactly one class, and equal specificity resolves on
 * source order — so every icon was drawn clipped by the plate it was meant to
 * replace.
 *
 * It hid because the two symbols anybody checks first, `{p}` and `{r}`, clip to
 * `cut.disc`, and a circular clip on a circular icon is invisible. `{d}` lost
 * its bottom corners to the shield cut, `{t}` and `{u}` lost a side, `{c}` lost
 * its top.
 *
 * So the assertion is on the SELECTOR rather than on a rendered pixel: jsdom
 * does not resolve `clip-path`, and the defect was never about a value being
 * wrong — it was about which of two correct values won. Reading the CSS is the
 * level the bug actually lived at.
 *
 * WHAT THE PORT CHANGED, and why this file is a third the length of the Svelte
 * original. That version had to compile the component to recover Svelte's
 * scoped CSS, and then carried a small specificity engine — `splitTopLevel`,
 * `classCount`, `outsideFunctional` — with its own unit tests, because a
 * scoping hash makes every selector one class heavier and selector lists had to
 * be split before they could be counted. React imports a plain stylesheet, so
 * the rules are read as authored and the reset is written `.of-symbol.of-symbol--art`:
 * it outranks the silhouettes by construction rather than by source order.
 *
 * The specificity counter below is therefore deliberately simple, and the first
 * test is what keeps that honest — it fails the moment this stylesheet grows a
 * functional pseudo-class, rather than letting a naive count quietly
 * mis-compare one.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { GameSymbol } from "./GameSymbol";

const CSS = (
  await Bun.file(new URL("./GameSymbol.css", import.meta.url)).text()
)
  /* Comments stripped FIRST. They are prose about clip paths, full of things
     that look like class selectors — `.min`, `1.12.4e` — and counting those as
     specificity is how the first version of this test failed on its own
     rhetoric rather than on the CSS. */
  .replace(/\/\*[\s\S]*?\*\//g, "");

/** Every selector that sets the given property, in source order. */
function rulesSetting(property: string): string[] {
  const found: string[] = [];
  for (const match of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    if (!new RegExp(`(^|;)\\s*${property}\\s*:`).test(body ?? "")) continue;
    for (const one of (selector ?? "").split(",")) {
      const trimmed = one.trim();
      if (trimmed !== "" && !trimmed.startsWith("@")) found.push(trimmed);
    }
  }
  return found;
}

/** Classes, attributes and pseudo-classes in a selector — the `b` column. */
function classCount(selector: string): number {
  return (selector.match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+(?!\()/g) ?? []).length;
}

const ART = ".of-symbol.of-symbol--art";

describe("the stylesheet stays within what this test can read", () => {
  /*
   * A functional pseudo-class — `:is()`, `:not()`, `:where()` — takes the
   * MAXIMUM of its arguments rather than their sum, and `:where()` is free. The
   * counter above knows none of that, so rather than teach it rules nothing
   * here uses, this asserts the stylesheet has none. If one is ever added, this
   * fails and points at the counter instead of the counter silently returning a
   * number that means nothing.
   */
  test("no functional pseudo-class, which the counter cannot weigh", () => {
    const functional = CSS.match(/:[\w-]+\(/g) ?? [];
    expect(functional).toEqual([]);
  });
});

describe("GameSymbol with ingested artwork", () => {
  test("renders the image, with an empty alt so the wrapper names it once", () => {
    const html = renderToStaticMarkup(
      <GameSymbol
        kind="power"
        letter="P"
        name="power"
        src="/symbols/icon_p.png"
        width={105}
        height={105}
      />,
    );

    expect(html).toContain('src="/symbols/icon_p.png"');
    expect(html).toContain('alt=""');
    /*
     * The wrapper keeps the rules' word, and it keeps it ONCE. An `<img>` with
     * its own accessible name nested inside a named `img` role announces the
     * symbol twice — worse in a sentence than in a stat block, because it
     * happens mid-clause.
     */
    expect(html).toContain('aria-label="power"');
    // The lettered plate is the OTHER branch, and must not also render.
    expect(html).not.toContain("of-symbol__letter");
  });

  test("falls back to the lettered plate when there is no artwork", () => {
    const html = renderToStaticMarkup(
      <GameSymbol kind="power" letter="P" name="power" />,
    );

    expect(html).toContain("of-symbol__letter");
    expect(html).toContain('aria-label="power"');
    expect(html).not.toContain("<img");
  });

  /*
   * THE TWO THAT PIN THE BUG. Enumerated against every rule that sets the
   * property rather than against the handful of silhouettes that had the
   * visible symptom: a tenth `kind` added later gets the same guarantee without
   * anybody remembering to add it here.
   */
  /**
   * Every rule that competes with the reset FOR THE SAME ELEMENT and does not
   * lose to it, named. Reported as a list rather than asserted one at a time
   * because "expected 2 to be less than 2" sends someone hunting, and the
   * selector is the entire answer.
   *
   * Descendant selectors are excluded on purpose: `.of-symbol.of-symbol--art img`
   * styles the image inside the wrapper, so it is not a competitor for the
   * wrapper's own `background` or `clip-path` no matter what it weighs.
   */
  function outranking(property: string): string[] {
    const setters = rulesSetting(property);
    expect(setters).toContain(ART);
    const reset = classCount(ART);
    return setters.filter(
      (selector) =>
        selector !== ART &&
        !/\s/.test(selector) &&
        classCount(selector) >= reset,
    );
  }

  test("the artwork reset outranks every silhouette that would clip it", () => {
    expect(outranking("clip-path")).toEqual([]);
  });

  test("the artwork reset outranks every background the plate would paint", () => {
    expect(outranking("background")).toEqual([]);
  });
});
