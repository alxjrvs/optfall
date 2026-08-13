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

/**
 * Every selector that sets the given property, in source order.
 *
 * SELECTOR LISTS ARE SPLIT, at their top-level commas only — see
 * `splitTopLevel`. Svelte does emit lists (`.a.hash, .b.hash`), and captured
 * whole, `classCount` would sum the classes on both sides and report a
 * specificity nothing has. Nothing in this component is grouped today, so the
 * bug would not have shown up until the first `.resource, .power { … }` anybody
 * wrote, at which point this test would have failed on a rule that was fine. A
 * previous version of this comment asserted commas never survive compilation,
 * which was simply wrong.
 */
function rulesSetting(property: string): string[] {
  const found: string[] = [];
  for (const match of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = match;
    if (!new RegExp(`(^|;)\\s*${property}\\s*:`).test(body!)) continue;
    for (const one of splitTopLevel(selector!)) {
      const trimmed = one.trim();
      if (trimmed !== "") found.push(trimmed);
    }
  }
  return found;
}

/**
 * Split a selector list on its TOP-LEVEL commas only.
 *
 * A bare `.split(",")` breaks every functional pseudo-class — and the note
 * further down this file actively suggests one, `.symbol:not(.art)`, so this is
 * a trap laid for the next person to read it. `.plate:is(.a, .b).hash` really
 * has three classes; split naively it becomes `.plate:is(.a` and `.b).hash`,
 * two apiece, and sails through a `< 3` assertion it should fail. And
 * `.symbol:not(.art, .plain)` puts the fragment `.symbol:not(.art` into the
 * RESET bucket, dropping the threshold to 2 and failing a rule that is correct.
 * A false negative and a false positive from the same missing paren counter, in
 * the one test whose job is to catch a specificity mistake.
 */
function splitTopLevel(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of selector) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  parts.push(current);
  return parts;
}

/**
 * Class count is specificity here — every selector in this component is
 * classes, and Svelte adds exactly one scoping class to each, so the hash
 * contributes equally to both sides of every comparison below.
 */
function classCount(selector: string): number {
  return (selector.match(/\.[A-Za-z_-][A-Za-z0-9_-]*/g) ?? []).length;
}

describe("splitTopLevel", () => {
  test("splits a plain selector list", () => {
    expect(splitTopLevel(".a.h, .b.h").map((s) => s.trim())).toEqual([".a.h", ".b.h"]);
  });

  test("keeps a functional pseudo-class intact", () => {
    /* The case that made the naive split a false NEGATIVE: three classes read
       as two, passing an assertion it should fail. */
    const parts = splitTopLevel(".plate:is(.a, .b).h");
    expect(parts).toHaveLength(1);
    expect(classCount(parts[0]!)).toBe(4);
  });

  test("keeps `:not()` with several arguments intact", () => {
    /* And the false POSITIVE: a fragment landing in the reset bucket and
       dragging the threshold down onto a correct rule. */
    const parts = splitTopLevel(".symbol:not(.art, .plain).h");
    expect(parts).toHaveLength(1);
  });
});

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

  test("the artwork reset outranks every background the plate would paint", () => {
    /*
      Same argument for colour: a plate showing through behind a round icon is a
      coloured ring around it, which reads as a rendering fault.

      NO EXEMPTIONS, and the first version of this test had two that were both
      dead. It skipped selectors containing `.symbol,`, which never matched —
      `rulesSetting` now splits selector lists, so a grouped rule arrives here as
      its parts and no part carries a trailing comma. The base `.symbol` rule
      (which does set `background`) therefore fell through into the compared set
      anyway, and passed on the accident that `.symbol` plus one scoping class
      counts 2 against the reset's 3. Scope the base rule as `.symbol:not(.art)`
      — a reasonable thing to want — and the test would have failed on the one
      rule the exemption was written to excuse. It also skipped selectors with
      zero classes, which cannot occur because the scoping class is always there.

      Comparing everything is both simpler and stricter: the base plate genuinely
      IS a background the artwork must beat, so asserting it is correct rather
      than incidental.
    */
    const painters = rulesSetting("background");
    const reset = painters.filter((selector) => selector.includes(".art"));
    const plates = painters.filter((selector) => !selector.includes(".art"));

    expect(reset.length).toBeGreaterThan(0);
    expect(plates.length).toBeGreaterThan(0);

    const weakest = Math.min(...reset.map(classCount));
    for (const plate of plates) {
      expect(classCount(plate), `${plate} would paint behind the artwork`).toBeLessThan(weakest);
    }
  });
});
