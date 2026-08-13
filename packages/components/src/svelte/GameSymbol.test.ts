/**
 * The artwork branch of `GameSymbol`, and the cascade bug that shipped in it.
 *
 * A symbol with `src` must render LSS's own icon UNCLIPPED and UNPLATED. The
 * first version got that wrong in a way no screenshot caught: the reset was
 * written as `.art`, the silhouettes as `.power`/`.defence`/…, Svelte scoping
 * gives both exactly one class, and equal specificity resolves on source order
 * — so every icon was drawn clipped by the plate it was meant to replace.
 *
 * It hid because the two symbols anybody checks first, `{p}` and `{r}`, clip to
 * `cut.disc`, and a circular clip on a circular icon is invisible. `{d}` lost
 * its bottom corners to the shield cut, `{t}` and `{u}` lost a side, `{c}` lost
 * its top.
 *
 * So the assertion is on the SELECTOR rather than on a rendered pixel: jsdom
 * does not resolve `clip-path`, and the defect was never about a value being
 * wrong — it was about which of two correct values won. Reading the compiled
 * CSS is the level the bug actually lived at.
 */
import { describe, expect, test } from "bun:test";
import { compile } from "svelte/compiler";
import { render } from "svelte/server";

import GameSymbol from "./GameSymbol.svelte";

const SOURCE = await Bun.file(new URL("./GameSymbol.svelte", import.meta.url)).text();

/* Comments stripped FIRST. They are prose about clip paths, full of things that
   look like class selectors — `.min`, `1.12.4e` — and counting those as
   specificity is how the first version of this test failed on its own rhetoric
   rather than on the CSS. */
const CSS = (compile(SOURCE, { generate: "client" }).css?.code ?? "").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Every selector that sets the given property, in source order. */
function rulesSetting(property: string): string[] {
  const found: string[] = [];
  for (const match of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    if (new RegExp(`(^|;)\\s*${property}\\s*:`).test(body!)) found.push(selector!.trim());
  }
  return found;
}

/**
 * Class count is specificity here — every selector in this component is
 * classes, and Svelte adds exactly one scoping class to each, so the hash
 * contributes equally to both sides of every comparison below.
 */
function classCount(selector: string): number {
  return (selector.match(/\.[A-Za-z_-][A-Za-z0-9_-]*/g) ?? []).length;
}

describe("GameSymbol with ingested artwork", () => {
  test("renders the image, with an empty alt so the wrapper names it once", () => {
    const { body } = render(GameSymbol, {
      props: {
        kind: "defence",
        letter: "D",
        name: "defence",
        src: "/symbols/icon_d.png",
        width: 105,
        height: 105,
      },
    });

    expect(body).toContain('src="/symbols/icon_d.png"');
    expect(body).toContain('alt=""');
    expect(body).toContain('aria-label="defence"');
    /* The letter is the FALLBACK. Rendering both would put a "D" behind the
       artwork and hand a copy-paste of the page a stray capital. */
    expect(body).not.toContain(">D<");
  });

  test("falls back to the lettered plate when there is no artwork", () => {
    const { body } = render(GameSymbol, {
      props: { kind: "x", letter: "X", name: "X" },
    });

    expect(body).toContain(">X<");
    expect(body).not.toContain("<img");
  });

  test("the artwork reset outranks every silhouette that would clip it", () => {
    const clippers = rulesSetting("clip-path");
    const reset = clippers.filter((selector) => selector.includes(".art"));
    const silhouettes = clippers.filter((selector) => !selector.includes(".art"));

    expect(reset.length).toBeGreaterThan(0);
    expect(silhouettes.length).toBeGreaterThan(0);

    /*
      A reset that merely comes last would pass today and break the next time
      somebody moves a rule, which is exactly how this broke the first time. It
      has to WIN, not merely be later.
    */
    const weakest = Math.min(...reset.map(classCount));
    for (const silhouette of silhouettes) {
      expect(
        classCount(silhouette),
        `${silhouette} is at least as specific as the .art reset and would clip the artwork`,
      ).toBeLessThan(weakest);
    }
  });

  test("the artwork reset outranks every silhouette's background", () => {
    /* Same argument for colour: a plate showing through behind a round icon is
       a coloured ring around it, which reads as a rendering fault. */
    const painters = rulesSetting("background");
    const reset = painters.filter((selector) => selector.includes(".art"));
    const plates = painters.filter(
      (selector) => !selector.includes(".art") && !selector.includes(".symbol,"),
    );

    expect(reset.length).toBeGreaterThan(0);
    const weakest = Math.min(...reset.map(classCount));
    for (const plate of plates) {
      if (classCount(plate) === 0) continue;
      expect(classCount(plate), `${plate} would paint behind the artwork`).toBeLessThan(weakest);
    }
  });
});
