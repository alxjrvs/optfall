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
 *
 * A FUNCTIONAL PSEUDO-CLASS CONTRIBUTES THE MAXIMUM OF ITS ARGUMENTS, NOT THE
 * SUM. `:is(.a, .b)` is worth one class, not two — CSS takes the most specific
 * branch, because only one of them can be the reason the selector matched. The
 * naive count read `.plate:is(.a, .b).hash` as 4 when it is 3, which is
 * over-counting exactly the selectors `splitTopLevel` was added to keep whole,
 * and would report a silhouette as more specific than it is. `:where()` is the
 * documented exception and contributes nothing at all.
 */
function classCount(selector: string): number {
  let total = 0;
  let rest = "";

  /*
    OUTERMOST-FIRST, recursing into each argument list.

    An innermost-first flattening looks equivalent and is not: it adds every
    nested pseudo-class it finds, including ones sitting in a branch that does
    not win. `.a:is(.b.c.d, .e:not(.f))` is 4 — `.a` plus the dearest branch,
    `.b.c.d` — but flattening scores the inner `:not` (1), then reads the
    remaining `:is(.b.c.d, .e)` as 3, and reports 5. Finding the matching close
    paren and recursing keeps each branch's cost inside its own branch.
  */
  for (let index = 0; index < selector.length; index += 1) {
    const functional = /^:(is|not|has|where|matches)\(/.exec(selector.slice(index));
    if (functional === null) {
      rest += selector[index];
      continue;
    }

    const open = index + functional[0].length;
    let depth = 1;
    let close = open;
    while (close < selector.length && depth > 0) {
      if (selector[close] === "(") depth += 1;
      if (selector[close] === ")") depth -= 1;
      if (depth > 0) close += 1;
    }

    const args = selector.slice(open, close);
    total +=
      functional[1] === "where"
        ? 0
        : Math.max(...splitTopLevel(args).map((argument) => classCount(argument)), 0);
    index = close;
  }

  return total + (rest.match(/\.[A-Za-z_-][A-Za-z0-9_-]*/g) ?? []).length;
}

/**
 * The part of a selector OUTSIDE any functional pseudo-class.
 *
 * Bucketing on `selector.includes(".art")` over the whole string put
 * `.symbol:not(.art, .plain)` — a rule that excludes `.art`, and therefore can
 * never style the artwork — into the RESET bucket, which is the opposite of
 * where it belongs. Fixing the count alone did not fix that: it moved the
 * threshold and left the misclassification exactly where it was.
 */
function outsideFunctional(selector: string): string {
  let rest = selector;
  let previous = "";
  while (rest !== previous) {
    previous = rest;
    rest = rest.replace(/:(is|not|has|where|matches)\([^()]*\)/g, "");
  }
  return rest;
}

/**
 * Whether a rule EXCLUDES the artwork, and so cannot apply to it at all.
 *
 * Three cases, and the middle one was being got wrong. A rule whose compound
 * carries `.art` is the reset. A rule that says nothing about `.art` is a plate
 * and has to lose to the reset. A rule that excludes `.art` —
 * `.symbol:not(.art)`, which the note further down calls a reasonable thing to
 * want — can never style the artwork, so it is neither: comparing its
 * specificity asks a question with no meaning, and it would have FAILED that
 * comparison, because Svelte emits `.symbol.hash:not(.art)` at 3 against the
 * reset's 3.
 *
 * Dropped from the comparison rather than made to lose it.
 */
function excludesArt(selector: string): boolean {
  for (const match of selector.matchAll(/:not\(([^()]*)\)/g)) {
    if (splitTopLevel(match[1]!).some((argument) => argument.includes(".art"))) return true;
  }
  return false;
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
    /* THREE, not four: `.plate`, `.h`, and the most specific branch of the
       `:is()` — CSS takes the maximum of the arguments, never the sum. */
    expect(classCount(parts[0]!)).toBe(3);
  });

  test("keeps `:not()` with several arguments intact", () => {
    /* And the false POSITIVE: a fragment landing in the reset bucket and
       dragging the threshold down onto a correct rule. */
    const parts = splitTopLevel(".symbol:not(.art, .plain).h");
    expect(parts).toHaveLength(1);
  });
});

describe("classCount", () => {
  test("counts plain compounds", () => {
    expect(classCount(".symbol.art.h")).toBe(3);
  });

  test("takes the MAXIMUM of a functional pseudo-class, not the sum", () => {
    /* Only one branch can be the reason the selector matched, so CSS charges
       for the dearest one. Summing them is how a silhouette gets reported as
       more specific than the reset it actually loses to. */
    expect(classCount(".symbol:not(.art, .plain).h")).toBe(3);
    expect(classCount(".a:is(.b.c, .d)")).toBe(3);
  });

  test("charges nothing for `:where()`", () => {
    expect(classCount(".a:where(.b.c.d)")).toBe(1);
  });

  test("handles nesting", () => {
    /* `.a` + the dearest `:is` branch, which is `.b:not(.c.d)` at 1 + 2. */
    expect(classCount(".a:is(.b:not(.c.d), .e)")).toBe(4);
  });

  test("does not charge for a nested pseudo-class in a losing branch", () => {
    /* `.b.c.d` (3) beats `.e:not(.f)` (2), so the `:not` costs nothing. An
       innermost-first flattening scores it anyway and reports 5. */
    expect(classCount(".a:is(.b.c.d, .e:not(.f))")).toBe(4);
  });
});

describe("excludesArt", () => {
  test("recognises a rule that negates the artwork", () => {
    expect(excludesArt(".symbol.h:not(.art)")).toBe(true);
    expect(excludesArt(".symbol.h:not(.art, .plain)")).toBe(true);
  });

  test("does not confuse the reset itself for an exclusion", () => {
    expect(excludesArt(".symbol.art.h")).toBe(false);
    expect(excludesArt(".defence.h")).toBe(false);
  });
});

describe("outsideFunctional", () => {
  test("keeps a real `.art` compound", () => {
    expect(outsideFunctional(".symbol.art.h")).toContain(".art");
  });

  test("drops an `.art` that appears only as a negated argument", () => {
    /* `.symbol:not(.art)` can never style the artwork — it excludes it — so it
       belongs in the PLATES bucket, not the reset one. */
    expect(outsideFunctional(".symbol:not(.art, .plain).h")).not.toContain(".art");
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
    const reset = clippers.filter((s) => outsideFunctional(s).includes(".art"));
    const silhouettes = clippers.filter(
      (s) => !outsideFunctional(s).includes(".art") && !excludesArt(s),
    );

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
    const reset = painters.filter((s) => outsideFunctional(s).includes(".art"));
    const plates = painters.filter(
      (s) => !outsideFunctional(s).includes(".art") && !excludesArt(s),
    );

    expect(reset.length).toBeGreaterThan(0);
    expect(plates.length).toBeGreaterThan(0);

    const weakest = Math.min(...reset.map(classCount));
    for (const plate of plates) {
      expect(classCount(plate), `${plate} would paint behind the artwork`).toBeLessThan(weakest);
    }
  });
});
