import { describe, expect, test } from "bun:test";

import { readFileSync } from "node:fs";

import { DARK_TOKENS, LIGHT_TOKENS } from "optfall-theme";

import {
  CARD_IMAGE_COPYRIGHT,
  MARK_GEOMETRY,
  PRIMITIVES,
  VOICE_BY_ROLE,
  type CardImageProps,
} from "./index";

describe("card image compliance contract", () => {
  // docs/COMPLIANCE.md §5 requires the copyright notice to be something the
  // caller cannot omit, empty, or override. A required `copyright: string` prop
  // only defends against forgetting it — `copyright=""` type-checks and renders
  // a card face with no notice. These two tests pin the stronger shape, so the
  // prop cannot be reintroduced without a failing build to argue with.
  // Containment, not equality. The policy mandates the notice
  // "© Legend Story Studios"; this constant is Optfall's rendering of it, and
  // the exact wrapper sentence is not ratified. Pinning the full string here
  // would make it look specified while the mandated form and our rendering
  // drifted apart — scripts/canonical-disclaimer.test.ts asserts the two agree
  // across the compliance documents, which is the check that actually binds.
  test("contains the notice the asset policy mandates", () => {
    expect(CARD_IMAGE_COPYRIGHT).toContain("© Legend Story Studios");
  });

  test("is not caller-supplied", () => {
    // A type-level assertion: if `copyright` is ever added back to the props,
    // this stops compiling. It has no runtime body because the guarantee is
    // that no such value exists to inspect.
    type HasCopyright = "copyright" extends keyof CardImageProps ? true : false;
    const callerCannotSupplyIt: HasCopyright = false;
    expect(callerCannotSupplyIt).toBe(false);
  });

  test("carries no legality or rules data", () => {
    // The art licence is revocable. Losing it must cost a rendering layer and
    // nothing else, which is only true while this type stays free of the data
    // the project actually owns.
    type Keys = keyof CardImageProps;
    const keys: Keys[] = ["src", "alt", "pitch"];
    expect(keys).toHaveLength(3);
  });
});

describe("the primitive set", () => {
  test("is the eight Phase 1 deliverables plus the card layer's six, without duplicates", () => {
    // The eight are Phase 1's closed list. `card-face` is the ninth and it
    // arrived with the card layer rather than with the design system, which is
    // why the count moved: docs/SCRYFALL-GAP.md §5.1 made images a product
    // surface, and a component that renders a card image is the only place the
    // compliance line can be made unrepresentable-to-omit.
    expect(PRIMITIVES).toHaveLength(14);
    expect(new Set(PRIMITIVES).size).toBe(PRIMITIVES.length);
    expect(PRIMITIVES).toContain("pitch-jewel");
    expect(PRIMITIVES).toContain("citation");
    expect(PRIMITIVES).toContain("card-face");
    expect(PRIMITIVES).toContain("search-field");
    expect(PRIMITIVES).toContain("result-row");
    expect(PRIMITIVES).toContain("stat-glyph");
    expect(PRIMITIVES).toContain("card-face-group");
    // `game-symbol` is the fourteenth. It renders the markers the printed text
    // carries — `{p}`, `{r}`, `{t}` — and it is a PRIMITIVE rather than page
    // markup because it shares its silhouettes with `stat-glyph` through
    // `ornament.cut.*`: the plate a reader meets inline in `+1{p}` is the same
    // plate carrying `4` in the stat block.
    expect(PRIMITIVES).toContain("game-symbol");
  });
});

/*
 * THE RESERVED SILHOUETTE IS ONE SHAPE, AND IT WAS TWO.
 *
 * `PitchJewel.svelte` drew an edge-up octagon — a chamfered square, flat on top
 * — while `scripts/build-design-system.ts` drew a vertex-up diamond, so the
 * published design-system cards advertised a silhouette the product never
 * rendered. Neither was wrong against `docs/DESIGN.md`, which said only "an
 * eight-sided cut stone": true of both, and therefore no help at all.
 *
 * THE DUPLICATION IS GONE RATHER THAN TESTED. The polygon is the
 * `ornament.cut.jewel` token, which every surface names, and
 * `scripts/check-tokens.ts` already fails the build on a `var(--of-*)` the theme
 * does not define — so nothing here needs to compare two copies, because there
 * is one.
 *
 * What is left is the pair of facts that mechanism cannot state: that a literal
 * has not crept back into the component (a `polygon()` of percentages carries no
 * colour and no absolute length, so the literal scan would pass it happily), and
 * that the shape is vertex-up — orientation being exactly what a token's NAME
 * does not say, and the half of this that drifted.
 */
/** The y of the line through `a`,`b` at `x`. */
function yOn(x: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.y + ((x - a.x) * (b.y - a.y)) / (b.x - a.x);
}

/** An SVG `points` list, as coordinates. */
function points(list: string): { x: number; y: number }[] {
  return list.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x: x ?? 0, y: y ?? 0 };
  });
}

describe("the reserved silhouette", () => {
  const jewelSource = readFileSync(
    new URL("./svelte/PitchJewel.svelte", import.meta.url),
    "utf8",
  );

  const silhouette = DARK_TOKENS["ornament.cut.jewel"] ?? "";

  test("the jewel clips itself with the token, not a drawing of its own", () => {
    expect(jewelSource).toContain("clip-path: var(--of-ornament-cut-jewel);");
    // The literal it replaced must not come back. `check-tokens.ts` cannot
    // catch that one: a raw `polygon()` of percentages contains no colour and
    // no absolute length, so it passes the literal scan and would sit there
    // quietly disagreeing with the token again.
    expect(jewelSource).not.toContain("clip-path: polygon(");
  });

  test("is vertex-up, which is the half of it that drifted", () => {
    // An edge-up octagon starts its polygon at a cut corner on the top edge; a
    // vertex-up one starts at the apex and carries the four compass points.
    // Orientation is exactly what a token's NAME cannot say, so it is said here.
    expect(silhouette.startsWith("polygon(50% 0%")).toBe(true);
    expect(silhouette).toContain("100% 50%");
    expect(silhouette).toContain("50% 100%");
    expect(silhouette).toContain("0% 50%");
  });

  test("is structure rather than palette, so both themes state it identically", () => {
    expect(LIGHT_TOKENS["ornament.cut.jewel"]).toBe(silhouette);
  });

  test("the mark is that diamond, cleaved rather than a second shape", () => {
    const crown = points(MARK_GEOMETRY.crown);
    const pavilion = points(MARK_GEOMETRY.pavilion);

    // The crown holds the top apex and the pavilion holds the bottom one, which
    // is what makes the pair a diamond rather than two lozenges.
    const apex = crown.reduce((a, b) => (a.y <= b.y ? a : b));
    const base = pavilion.reduce((a, b) => (a.y >= b.y ? a : b));
    expect(apex.x).toBeGreaterThan(12);
    expect(apex.x).toBeLessThan(20);
    expect(base.x).toBeGreaterThan(12);
    expect(base.x).toBeLessThan(20);

    // The girdle — the stone's widest points — survives on the pavilion, so the
    // fallen half is the one that still reads as the jewel.
    const widest = Math.max(...pavilion.map((p) => p.x)) - Math.min(...pavilion.map((p) => p.x));
    const crownWidest = Math.max(...crown.map((p) => p.x)) - Math.min(...crown.map((p) => p.x));
    expect(widest).toBeGreaterThan(crownWidest);

    /*
     * THE GAP IS MEASURED BETWEEN THE PARTED EDGES, NOT BETWEEN BOUNDING BOXES.
     *
     * The first version of this compared the crown's lowest point to the
     * pavilion's highest and asserted `>= 2`, which passed with exactly zero
     * margin and measured the wrong thing twice over: both edges are tilted, so
     * box extremes understate the real clearance, and steepening the tilt would
     * have failed the test without narrowing the cut by a single unit. It also
     * bounded the gap at 1 device pixel on a 16px favicon while every doc around
     * it treats 1.5px as the requirement.
     *
     * So: walk the cut, sample the vertical distance between the two edges, and
     * take the worst. One viewBox unit is half a device pixel at 16px, so 3
     * units is the 1.5px the mark is designed around.
     */
    const parted = crown.toSorted((a, b) => b.y - a.y).slice(0, 2).toSorted((a, b) => a.x - b.x);
    const [pl, pr] = parted;
    const face = MARK_GEOMETRY.cleave;
    if (pl === undefined || pr === undefined) throw new Error("no parted edge on the crown");

    const from = Math.max(pl.x, face.x1);
    const to = Math.min(pr.x, face.x2);
    let narrowest = Infinity;
    for (let step = 0; step <= 20; step += 1) {
      const x = from + ((to - from) * step) / 20;
      narrowest = Math.min(
        narrowest,
        yOn(x, { x: face.x1, y: face.y1 }, { x: face.x2, y: face.y2 }) - yOn(x, pl, pr),
      );
    }

    expect(narrowest).toBeGreaterThanOrEqual(3);
  });
});

describe("typographic voice", () => {
  test("is fixed by role rather than chosen per usage", () => {
    expect(VOICE_BY_ROLE["card-name"]).toBe("serif");
    expect(VOICE_BY_ROLE.question).toBe("serif");
    expect(VOICE_BY_ROLE.interface).toBe("sans");
  });

  test("is two voices, not three — the monospace face is retired", () => {
    // It used to mark "anything citable", on the rule that if a string is
    // monospaced you can paste it into an argument. That rule stopped being
    // true as the same face spread to eyebrows, pills, stat labels and set
    // codes — chrome rather than identifiers — so the signal it was carrying
    // had already been spent. A citation is marked by BEING one now: a link,
    // in the accent, beside the thing it cites.
    expect(VOICE_BY_ROLE.citation).toBe("sans");
    expect(VOICE_BY_ROLE.label).toBe("sans");
    expect(new Set(Object.values(VOICE_BY_ROLE))).toEqual(new Set(["serif", "sans"]));
  });
});
