import { describe, expect, test } from "bun:test";

import { readFileSync } from "node:fs";

import {
  CARD_IMAGE_COPYRIGHT,
  JEWEL_SILHOUETTE,
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
 * These tests exist because the fix is a *duplicated string* and duplication is
 * only safe when it is checked. A Svelte `<style>` block cannot interpolate a
 * module constant, and moving the polygon onto an inline `style` attribute
 * would ship it on every jewel on every card page rather than once in a cached
 * stylesheet — so the component keeps its own copy, and this asserts the copies
 * agree. Change one and the suite fails naming the other.
 */
/** An SVG `points` list, as coordinates. */
function points(list: string): { x: number; y: number }[] {
  return list.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return { x: x ?? 0, y: y ?? 0 };
  });
}

describe("the reserved silhouette", () => {
  /*
   * COMMENTS ARE STRIPPED FIRST, and that is not fastidiousness — the first
   * draft of this test failed against a correct component because the prose
   * above the declaration quotes the OLD value (`--cut: 30%`) while explaining
   * why it changed. A scanner that reads a file's commentary as if it were its
   * code will keep finding whichever value the prose happens to mention.
   */
  const jewelSource = readFileSync(
    new URL("./svelte/PitchJewel.svelte", import.meta.url),
    "utf8",
  ).replaceAll(/\/\*[\s\S]*?\*\//g, "");

  /** The component's `clip-path`, flattened to one line and `--cut` resolved. */
  const componentClip = (): string => {
    const match = /clip-path:\s*(polygon\([^;]*\));/.exec(jewelSource);
    if (match?.[1] === undefined) throw new Error("no clip-path in PitchJewel.svelte");
    const cut = /--cut:\s*([\d.]+%)/.exec(jewelSource)?.[1];
    if (cut === undefined) throw new Error("no --cut in PitchJewel.svelte");
    return match[1]
      .replaceAll("var(--cut)", cut)
      // `calc(100% - 15%)` is the component's spelling of the constant's `85%`.
      .replaceAll(/calc\(\s*100%\s*-\s*([\d.]+)%\s*\)/g, (_, n: string) => `${100 - Number(n)}%`)
      .replaceAll(/\s+/g, " ")
      .replaceAll("( ", "(")
      .replaceAll(" )", ")");
  };

  test("the jewel renders the diamond the constant declares", () => {
    expect(componentClip()).toBe(JEWEL_SILHOUETTE);
  });

  test("is vertex-up, which is the half of it that drifted", () => {
    // An edge-up octagon starts its polygon at a cut corner on the top edge; a
    // vertex-up one starts at the apex. This is the assertion that would have
    // caught the drift, so it is worth making separately from the equality
    // above — that one pins a string, this one pins the shape's orientation.
    expect(JEWEL_SILHOUETTE.startsWith("polygon(50% 0%")).toBe(true);
    expect(JEWEL_SILHOUETTE).toContain("100% 50%");
    expect(JEWEL_SILHOUETTE).toContain("50% 100%");
    expect(JEWEL_SILHOUETTE).toContain("0% 50%");
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

    // The gap is the whole idea and the last thing to disappear: it must stay
    // wide enough to survive a 16px favicon, where one viewBox unit is half a
    // device pixel.
    const crownLowest = Math.max(...crown.map((p) => p.y));
    const pavilionHighest = Math.min(...pavilion.map((p) => p.y));
    expect(pavilionHighest - crownLowest).toBeGreaterThanOrEqual(2);
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
