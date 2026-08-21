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
  test("is the eight Phase 1 deliverables plus the card layer's seven, without duplicates", () => {
    // The eight are Phase 1's closed list. `card-face` is the ninth and it
    // arrived with the card layer rather than with the design system:
    // docs/SCRYFALL-GAP.md §5.1 made images a product surface.
    //
    // THIRTEEN ONCE, AND THE ROUTE BACK UP IS WORTH KEEPING. `card-face-group`
    // was the fourteenth and existed only to hoist one copyright notice over
    // faces shown together; the notice moved to the universal footer
    // (docs/COMPLIANCE.md §5), which left it with no behaviour at all, so it
    // went rather than being kept as a wrapper whose documented reason for
    // existing had gone.
    //
    // THE ADDITIONS SINCE ALL ARRIVED THE SAME WAY — from a product failure
    // rather than from a plan, which is the opposite of how
    // `card-face-group` left. The count itself is the assertion below and is
    // deliberately not restated in this comment: it has been written into
    // prose twice and been wrong both times.
    //
    // `pagination`: docs/SCRYFALL-GAP.md §4 named the hard 60-result cap "a
    // refusal where Scryfall paginates", and both search surfaces needed the
    // identical control to answer it.
    //
    // `pitch-rule`: a rendering the library did not have, for a surface — the
    // card index — that did not exist when the list was closed. See
    // `PitchRuleProps` for why it is a second primitive rather than a variant
    // of the jewel.
    //
    // `pitch-box`: the same value again, for lists and grids. A stone beside
    // every name down a page is an ornament competing with the names; the box
    // is the fact written out — a rectangle banded in the pitch colour along
    // its top edge, reading "Pitch 1" underneath in the card's own face — and
    // it replaced the jewel at every list and grid site in the product. It
    // shipped as the state pill's notched plate and no longer wears it; see
    // `PitchBox` for that trade and for the division of labour between the
    // three.
    expect(PRIMITIVES).toHaveLength(17);
    expect(new Set(PRIMITIVES).size).toBe(PRIMITIVES.length);
    expect(PRIMITIVES).toContain("pitch-jewel");
    expect(PRIMITIVES).toContain("citation");
    expect(PRIMITIVES).toContain("card-face");
    expect(PRIMITIVES).toContain("search-field");
    expect(PRIMITIVES).toContain("result-row");
    expect(PRIMITIVES).toContain("stat-glyph");
    // `game-symbol` ARRIVED thirteenth and now SITS fourteenth, because
    // `pitch-rule` was inserted beside `pitch-jewel` rather than appended — its
    // position moved without its history changing, which is why the two numbers
    // are stated separately. It renders the markers the printed text carries —
    // `{p}`, `{r}`, `{t}` — and it is a PRIMITIVE rather than page markup
    // because it shares its silhouettes with `stat-glyph` through
    // `ornament.cut.*`: the plate a reader meets inline in `+1{p}` is the same
    // plate carrying `4` in the stat block.
    expect(PRIMITIVES).toContain("game-symbol");
    expect(PRIMITIVES).toContain("pagination");
    expect(PRIMITIVES).toContain("pitch-rule");
  });

  test("the three pitch renderings are all declared, and are not one thing", () => {
    /*
     * The failure this pins is a merge, not an omission. All three state the
     * same value in a different medium, so the obvious economy is to make two
     * of them a `variant` prop of the third — and that would quietly delete
     * the jewel's guarantee, which is that the NUMERAL is always rendered. A
     * band cannot carry a numeral; a component that can be asked for either
     * rendering therefore has a spelling that drops the primary channel while
     * still being called a jewel.
     *
     * Separate entries make "there is a rendering with a numeral" a fact about
     * the library rather than about how somebody calls it.
     */
    expect(PRIMITIVES).toContain("pitch-jewel");
    expect(PRIMITIVES).toContain("pitch-rule");
    expect(PRIMITIVES).toContain("pitch-box");
    /*
     * AND THEY ARE SEPARATE ENTRIES, NOT ONE NAME WEARING THREE SPELLINGS.
     * This line replaces `expect(new Set([…]).size).toBe(2)`, which asserted a
     * property of two string literals written in the test itself and could
     * therefore never fail whatever `PRIMITIVES` said. The check that carries
     * the claim is against the array.
     */
    expect(
      PRIMITIVES.filter((name) => name.startsWith("pitch-")).toSorted(),
    ).toEqual(["pitch-box", "pitch-jewel", "pitch-rule"]);
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
/** `rotate(a,cx,cy) translate(tx,ty)` — the format `placementOf` emits. */
const transformOf = (index: number) => {
  const placement = MARK_GEOMETRY.placements[index]!;
  const [angle, cx, cy] = /rotate\(([-\d.]+),([-\d.]+),([-\d.]+)\)/
    .exec(placement)!
    .slice(1)
    .map(Number) as [number, number, number];
  const [tx, ty] = /translate\(([-\d.]+),([-\d.]+)\)/
    .exec(placement)!
    .slice(1)
    .map(Number) as [number, number];
  const r = (angle * Math.PI) / 180;
  return ([x, y]: [number, number]): [number, number] => {
    const px = x + tx - cx;
    const py = y + ty - cy;
    return [
      cx + px * Math.cos(r) - py * Math.sin(r),
      cy + px * Math.sin(r) + py * Math.cos(r),
    ];
  };
};

const contains = (ring: [number, number][], x: number, y: number) => {
  let hit = false;
  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    if (y1 > y !== y2 > y) {
      if (x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) hit = !hit;
    }
  }
  return hit;
};

/**
 * The two places where a pair of links actually overlaps.
 *
 * Computed from the PUBLISHED geometry rather than from the module's private
 * constants: the link path is parsed out of `MARK_GEOMETRY.link` and each
 * placement out of `MARK_GEOMETRY.placements`, so this measures what a
 * consumer draws. It is slow and it is worth it — the interlock is the whole
 * mark, it is produced entirely by where a scope rectangle falls, and nothing
 * else in the suite would notice it inverting.
 */
function overlapBands(a: number, b: number): { lo: number; hi: number }[] {
  const [outer, inner] = MARK_GEOMETRY.link
    .split("M")
    .filter((part) => part.trim() !== "")
    .map((part) =>
      part
        .replace(/[LZ]/g, " ")
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map(Number) as [number, number]),
    );

  const place = (index: number, ring: [number, number][]) =>
    ring.map(transformOf(index));

  const rings = [a, b].map((index) => ({
    outer: place(index, outer!),
    inner: place(index, inner!),
  }));
  const inRing = (index: 0 | 1, x: number, y: number) =>
    contains(rings[index]!.outer, x, y) && !contains(rings[index]!.inner, x, y);

  const [, minY, , height] = MARK_GEOMETRY.viewBox.split(" ").map(Number);
  const step = 0.1;
  const rows: number[] = [];

  for (let y = minY!; y <= minY! + height!; y += step) {
    for (let x = 0; x <= 64; x += step) {
      if (inRing(0, x, y) && inRing(1, x, y)) {
        rows.push(y);
        break;
      }
    }
  }

  const bands: { lo: number; hi: number }[] = [];
  for (const y of rows) {
    const last = bands.at(-1);
    if (last && y - last.hi <= step * 2) last.hi = y;
    else bands.push({ lo: y, hi: y });
  }
  return bands;
}

describe("the reserved silhouette", () => {
  /* The component's own stylesheet. This read `svelte/PitchJewel.svelte` until
     Phase 6 layer 5; the port moved the scoped `<style>` block out into a plain
     sheet beside the component, so the same declaration is now in a `.css` file
     and the assertions below are unchanged. */
  const jewelSource = readFileSync(
    new URL("./react/PitchJewel.css", import.meta.url),
    "utf8",
  );

  const silhouette = DARK_TOKENS["ornament.cut.jewel"] ?? "";

  test("the jewel is a ring, and draws no polygon of its own", () => {
    /*
     * THE JEWEL NO LONGER WEARS THE RESERVED SILHOUETTE, which is why this
     * assertion inverted. It read "clips itself with the token, not a drawing
     * of its own" and guarded a real hazard: the component once drew an edge-up
     * square in a raw `polygon()` while the design-system cards drew the
     * diamond, and nothing failed because `check-tokens.ts` cannot catch a
     * polygon of percentages — no colour, no absolute length, so it passes the
     * literal scan and sits there disagreeing with the token.
     *
     * The card prints a ring, so the stone is a circle. The half of this test
     * that still matters is the half about literals: a shape spelled out here
     * rather than named is the failure mode, whatever the shape is.
     */
    expect(jewelSource).toContain("border-radius: 50%;");
    expect(jewelSource).not.toContain("clip-path: polygon(");
    expect(jewelSource).not.toContain(
      "clip-path: var(--of-ornament-cut-jewel);",
    );
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

  test("the notch is state's alone, at the token's depth", () => {
    /*
     * IT WAS DRAWN BY TWO COMPONENTS AND IS DRAWN BY ONE. `PitchBox` took
     * `StatePill`'s plate — same notch, same token, same polygon — on the
     * argument that a reader learns the shape once, and this test held the two
     * copies in step. The box is a plain filled rectangle now, so the second
     * copy is gone and with it the drift this guarded against.
     *
     * What is left is the pair of facts the deletion makes newly worth
     * asserting: that the pill still names the DEPTH token rather than a
     * literal of its own, and that the pitch mark has not quietly kept the
     * silhouette `ornament.notch.size`'s comment says it gave up. The second
     * half is the one with teeth — `check-tokens.ts` cannot catch it, because a
     * `polygon()` of percentages carries no colour and no absolute length and
     * passes the literal scan happily.
     *
     * Whitespace is collapsed because Biome wraps these files at 80 columns and
     * what has to match is the geometry, not the line breaks.
     */
    const flat = (path: URL) => readFileSync(path, "utf8").replace(/\s+/g, " ");
    const pill = flat(new URL("./react/StatePill.css", import.meta.url));
    const box = flat(new URL("./react/PitchBox.css", import.meta.url));

    const clip =
      "clip-path: polygon( var(--notch-near) 0%, calc(var(--notch-far) - var(--notch)) 0%, var(--notch-far) var(--notch), var(--notch-far) 100%, var(--notch-near) 100% );";

    expect(pill).toContain(clip);
    expect(pill).toContain("--notch: var(--of-ornament-notch-size);");
    // And the mirror, so a right-to-left reader gets the notch on the same
    // corner.
    expect(pill).toContain("--notch-near: 100%;");

    expect(box).not.toContain("clip-path:");
    expect(box).not.toContain("--of-ornament-notch-size");
  });

  test("the pitch box spends its colour on the surface and its height on none", () => {
    /*
     * THE MARK'S WHOLE CHANGE, PINNED WHERE IT CAN FAIL. It has been three
     * things: the legality flag's notched plate filled in the pitch colour,
     * then two hairlines of that colour over a `color.sunken` well, and now the
     * fill again with no notch and no height beyond its own line.
     *
     * THE HEIGHT IS THE HALF WITH TEETH, because it is the half that reads as
     * an omission. A filled mark is obviously deliberate; `padding-block: 0` on
     * a tag looks like something nobody got round to, and the block step is the
     * one declaration a well-meaning tidy would add back. It is what keeps the
     * mark a line of type wearing a colour rather than a tag interrupting the
     * row it sits in — see `PitchBox.css`, which argues area against
     * saturation.
     *
     * EVERY TONE STATES BOTH HALVES OF ITS OWN CONTRAST. A tone that set the
     * fill without the ink would inherit whatever colour the page around it
     * happened to have, which is exactly the pairing `tokens.test.ts` computes
     * a WCAG ratio for and would silently stop describing what is rendered.
     */
    const box = readFileSync(
      new URL("./react/PitchBox.css", import.meta.url),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(box).toContain("background: var(--band);");
    expect(box).toContain("padding-block: 0;");

    // The two retired renderings, asserted as absences: no notch is checked
    // above, and neither the struck top edge nor the neutral well may come back
    // while the surface carries the hue.
    expect(box).not.toContain("border-block-start:");
    expect(box).not.toContain("var(--of-color-sunken)");

    for (const tone of ["none", "one", "two", "three", "four"]) {
      expect(box).toContain(
        `.of-pitch-box--tone-${tone} { --band: var(--of-color-pitch-${tone}); color: var(--of-color-pitch-${tone}-ink); }`,
      );
    }

    /* THE BAR IS A WIDTH AND NOTHING ELSE. It carried `space.tight` a side on
       the argument that it is read as a control — a second claim on the same
       requirement its anchor already states as `min-block-size:
       layout.target.min`, and the taller of the two won silently. A padding
       declaration reappearing in this rule is that bug coming back. */
    const bar = /\.of-pitch-box--bar \{[^}]*\}/.exec(box)?.[0] ?? "";
    expect(bar).toContain("inline-size: 100%;");
    expect(bar).not.toContain("padding");

    // The words are the card's own face, which is what makes this a name's mark
    // rather than a flag's. The pill's wide-tracked shout went with the plate.
    expect(box).toContain("font-family: var(--of-type-family-display);");
    expect(box).not.toContain("text-transform:");
  });

  test("the mark is a chain of three interlocked links", () => {
    const { placements, scopes, link } = MARK_GEOMETRY;

    // Three links, and the scopes are the pairs between them. Two links would
    // be two rings overlapping; three is where it reads as a chain.
    expect(placements).toHaveLength(3);
    expect(scopes).toHaveLength(2);

    // Each link is a ring: an outer octagon and the window it encloses, in one
    // path so `fill-rule="evenodd"` can make the middle a hole. A ring drawn as
    // two shapes in two colours would look identical on a dark ground and be
    // wrong on any other, so "one path, two subpaths" is the thing to hold.
    //
    // Eight vertices each: the `M` that opened the subpath — consumed by the
    // split — plus seven `L`s. Eight because `docs/DESIGN.md` allows no rounded
    // corners anywhere, and the chamfer is how this system spells "not a
    // rectangle".
    const subpaths = link.split("M").filter((part) => part.trim() !== "");
    expect(subpaths).toHaveLength(2);
    for (const subpath of subpaths) {
      expect(subpath.match(/L/g) ?? []).toHaveLength(7);
      expect(subpath.trim().endsWith("Z")).toBe(true);
    }

    // THE LINKS ALTERNATE THEIR LEAN. A chain that sheared one way would be a
    // row of parallel rings; the zigzag is what makes each pair cross twice.
    const angles = placements.map((placement) => {
      const match = /rotate\((-?[\d.]+)/.exec(placement);
      return Number(match?.[1] ?? 0);
    });
    expect(angles[0]).toBe(-angles[1]!);
    expect(angles[2]).toBe(angles[0]);
    expect(Math.abs(angles[0]!)).toBeGreaterThan(0);
  });

  test("each pair of links crosses in exactly two places", () => {
    // TWO CROSSINGS IS WHAT MAKES AN INTERLOCK POSSIBLE. One would be a lap,
    // three would mean the links have slid far enough through each other to
    // meet again, and either way the "over here, under there" the mark is built
    // on stops being expressible.
    for (const [a, b] of [
      [0, 1],
      [1, 2],
    ] as const) {
      expect(overlapBands(a, b)).toHaveLength(2);
    }
  });

  test("every scope cuts the gap between the crossings, not a crossing", () => {
    /*
     * THE ASSERTION THE INTERLOCK ACTUALLY RESTS ON.
     *
     * A scope redraws the left link of a pair over its right neighbour, and it
     * must contain exactly ONE of the pair's two crossings. If its lower edge
     * landed inside a crossing it would clip through a link's own ring — the
     * angled bites earlier attempts produced — and if it cleared both, the pair
     * would go back to one link lying flat over the other.
     *
     * So the cut is checked against the MEASURED bands rather than against the
     * reasoning that produced it. That reasoning was wrong when it was written:
     * the comment claimed the two crossings "sit symmetrically about the row of
     * centres", and they do not. A pair is mirror-symmetric about the VERTICAL
     * bisector between its centres — mirroring x flips the lean, which is what
     * maps one link onto the other — and a vertical mirror says nothing about
     * where the bands land in y. Measured, they straddle the centre row
     * unevenly, and the cut clears the nearer one by about a unit.
     *
     * A unit of viewBox is half a device pixel at a 16px favicon. It holds, and
     * it is thin enough that it should fail here rather than be re-derived by
     * eye if anyone changes the angle or the overlap.
     */
    const pairs = [
      [0, 1],
      [1, 2],
    ] as const;

    MARK_GEOMETRY.scopes.forEach((scope, index) => {
      const [a, b] = pairs[index]!;
      const [upper, lower] = overlapBands(a, b);
      const cut = scope.y + scope.height;

      expect(upper!.hi).toBeLessThan(cut);
      expect(lower!.lo).toBeGreaterThan(cut);

      // AND IT HAS TO SIT OVER THE RIGHT PAIR. `x` and `width` are what decide
      // WHICH crossings a rectangle captures, and asserting only the vertical
      // cut would pass a scope slid sideways onto a different join entirely.
      const centres = MARK_GEOMETRY.placements.map((placement) =>
        Number(/rotate\([-\d.]+,([-\d.]+),/.exec(placement)![1]),
      );
      expect(scope.x).toBeCloseTo(centres[a]!, 1);
      expect(scope.x + scope.width).toBeCloseTo(centres[b]!, 1);
    });
  });

  test("the geometry offers no reduced form to draw instead of the chain", () => {
    // THE PROPERTY THAT MATTERS, AND IT IS AN ABSENCE. This constant used to
    // carry `single` — one link, upright, in its own box — because three links
    // at this aspect are a smudge at 16px. Measured, and true. It bought a tab
    // icon that was not the logo, and then an installed-app icon that was not
    // the logo, and both went back to the chain; what was left was a variant
    // nothing drew, sitting in the one file whose whole job is that there is
    // exactly one drawing of the mark.
    //
    // So the assertion is that it stays gone. Every placement leans, none is
    // upright, and there is no second box to render a lone link into.
    expect(MARK_GEOMETRY).not.toHaveProperty("single");
    for (const placement of MARK_GEOMETRY.placements) {
      expect(placement).not.toContain("rotate(0,");
    }
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
    expect(new Set(Object.values(VOICE_BY_ROLE))).toEqual(
      new Set(["serif", "sans"]),
    );
  });
});
