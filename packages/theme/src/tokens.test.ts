/**
 * The design rules in `docs/DESIGN.md`, asserted rather than remembered.
 *
 * Three of that document's claims are the kind that decay silently — a neutral
 * picks up a cast, a mode drifts out of step with the other, a numeral stops
 * being legible on its own stone. Each is mechanical, so each is a test. The
 * plan's Phase 1 exit criterion is that the design language is infrastructure
 * rather than decoration, and this file is a large part of the difference.
 */
import { describe, expect, test } from "bun:test";

import {
  assertTokenTable,
  DARK_TOKENS,
  darkTheme,
  LIGHT_TOKENS,
  lightTheme,
  THEME_ATTRIBUTE,
  themes,
  themeStylesheet,
  type TokenId,
  type TokenTable,
} from "./index";

/* -------------------------------------------------------------------------- */
/* WCAG contrast                                                               */
/* -------------------------------------------------------------------------- */

function channels(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  expect(value).toMatch(/^[0-9a-f]{6}$/i);
  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function relativeLuminance(hex: string): number {
  const linear = channels(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

function token(tokens: TokenTable, id: TokenId): string {
  const found = tokens[id];
  if (found === undefined) throw new Error(`missing token: ${id}`);
  return found;
}

const MODES: readonly (readonly [string, TokenTable])[] = [
  ["dark", DARK_TOKENS],
  ["light", LIGHT_TOKENS],
];

/* -------------------------------------------------------------------------- */

describe("the two tables stay in step", () => {
  // A token added to one mode and forgotten in the other renders as an unset
  // custom property — invisible in review, and visible only to whoever is using
  // the mode nobody developed in.
  test("define exactly the same token ids", () => {
    const dark = Object.keys(DARK_TOKENS).toSorted();
    const light = Object.keys(LIGHT_TOKENS).toSorted();
    expect(light).toEqual(dark);
  });

  test("neither names an asset the LSS policy forbids", () => {
    expect(() => assertTokenTable(DARK_TOKENS)).not.toThrow();
    expect(() => assertTokenTable(LIGHT_TOKENS)).not.toThrow();
  });

  test("light is not an inversion of dark", () => {
    // "Dark mode is not an inversion. It is designed." The cheap way to fake a
    // second mode is to flip ink and ground; this asserts the two palettes were
    // actually chosen, by requiring the light ground to be a mid grey — ash and
    // iron — rather than the dark theme's ink.
    const lightGround = token(LIGHT_TOKENS, "color.ground");
    const darkInk = token(DARK_TOKENS, "color.ink");
    expect(lightGround).not.toBe(darkInk);

    const luminance = relativeLuminance(lightGround);
    expect(luminance).toBeLessThan(0.75); // not paper white
    expect(luminance).toBeGreaterThan(0.4); // but still a light mode
  });
});

describe("neutrals carry no colour cast", () => {
  // "Neutrals with no colour cast at all — the grey of unpolished steel." A
  // faintly blue neutral reads as a website; a faintly warm one reads as
  // parchment. Both are somewhere other than Rathe, and both are the kind of
  // drift that arrives one convenient hex at a time.
  const NEUTRALS: readonly TokenId[] = [
    "color.ground",
    "color.sunken",
    "color.surface",
    "color.surface.raised",
    "color.ink",
    "color.ink.muted",
    "color.ink.faint",
    "color.rule",
    "color.rule.strong",
  ];

  for (const [mode, tokens] of MODES) {
    for (const id of NEUTRALS) {
      test(`${mode}: ${id} is a true grey`, () => {
        const [r, g, b] = channels(token(tokens, id));
        expect(r).toBe(g!);
        expect(g).toBe(b!);
      });
    }
  }
});

describe("contrast, in both modes equally", () => {
  // The point of asserting this per mode is that it is the only way "light and
  // dark equally considered" can mean anything. A palette that passes in the
  // mode its author uses and fails in the other is the normal outcome.
  const BODY_TEXT: readonly (readonly [TokenId, TokenId])[] = [
    ["color.ink", "color.ground"],
    ["color.ink", "color.surface"],
    ["color.ink", "color.surface.raised"],
    ["color.ink.muted", "color.ground"],
    ["color.ink.muted", "color.surface"],
  ];

  for (const [mode, tokens] of MODES) {
    for (const [ink, ground] of BODY_TEXT) {
      test(`${mode}: ${ink} on ${ground} meets AA`, () => {
        const ratio = contrastRatio(token(tokens, ink), token(tokens, ground));
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }

    test(`${mode}: faint ink still meets the large-text threshold`, () => {
      const ratio = contrastRatio(
        token(tokens, "color.ink.faint"),
        token(tokens, "color.ground"),
      );
      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    test(`${mode}: the accent is legible under its own ink`, () => {
      const ratio = contrastRatio(
        token(tokens, "color.accent.ink"),
        token(tokens, "color.accent"),
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    test(`${mode}: brass carries its ink`, () => {
      const ratio = contrastRatio(
        token(tokens, "color.brass.ink"),
        token(tokens, "color.brass"),
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("the pitch numeral is the primary channel", () => {
  // This is the accessibility claim the whole component library is pitched on:
  // shape, numeral and colour state the same fact three times, and the numeral
  // — not the colour — is the one that carries it. A numeral that fails
  // contrast on its own stone would make the redundant channel the only one.
  const STONES: readonly (readonly [TokenId, TokenId])[] = [
    ["color.pitch.none.ink", "color.pitch.none"],
    ["color.pitch.one.ink", "color.pitch.one"],
    ["color.pitch.two.ink", "color.pitch.two"],
    ["color.pitch.three.ink", "color.pitch.three"],
  ];

  for (const [mode, tokens] of MODES) {
    for (const [ink, stone] of STONES) {
      test(`${mode}: ${ink} on ${stone} meets AA`, () => {
        const ratio = contrastRatio(token(tokens, ink), token(tokens, stone));
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  test("red and yellow are separable by luminance, not only by hue", () => {
    // Red and yellow are the classic deuteranopia confusion pair, and pitch is
    // the most-read value on a card. Someone who cannot separate the hues can
    // still separate the stones if their lightness differs — so the numeral is
    // not the only thing standing between them.
    for (const [mode, tokens] of MODES) {
      const one = relativeLuminance(token(tokens, "color.pitch.one"));
      const two = relativeLuminance(token(tokens, "color.pitch.two"));
      const separation = Math.abs(one - two);
      expect(`${mode}:${separation > 0.08}`).toBe(`${mode}:true`);
    }
  });
});

describe("state colours are distinguishable", () => {
  const STATE_TOKENS: readonly TokenId[] = [
    "color.state.legal",
    "color.state.banned",
    "color.state.suspended",
    "color.state.restricted",
    "color.state.living-legend",
    "color.state.not-in-format",
    "color.state.verified",
    "color.state.unverified",
  ];

  for (const [mode, tokens] of MODES) {
    test(`${mode}: every state carries its own ink at AA`, () => {
      for (const id of STATE_TOKENS) {
        const ink = token(tokens, `${id}.ink` as TokenId);
        const ratio = contrastRatio(ink, token(tokens, id));
        expect(`${id}:${ratio >= 4.5}`).toBe(`${id}:true`);
      }
    });

    test(`${mode}: no two states share a colour`, () => {
      const values = STATE_TOKENS.map((id) => token(tokens, id));
      expect(new Set(values).size).toBe(values.length);
    });
  }
});

describe("the emitted stylesheet", () => {
  const css = themeStylesheet();

  test("puts dark on :root, because it is the native key", () => {
    const rootIndex = css.indexOf(":root {");
    const lightIndex = css.indexOf(`:root[${THEME_ATTRIBUTE}="light"]`);
    expect(rootIndex).toBeGreaterThanOrEqual(0);
    expect(lightIndex).toBeGreaterThan(rootIndex);
  });

  test("honours prefers-color-scheme unless overridden", () => {
    expect(css).toContain("@media (prefers-color-scheme: light)");
    expect(css).toContain(`:root:not([${THEME_ATTRIBUTE}="dark"])`);
  });

  test("emits every token of both themes", () => {
    const declarations = css.match(/--of-[a-z0-9-]+:/g) ?? [];
    const distinct = new Set(declarations);
    expect(distinct.size).toBe(Object.keys(DARK_TOKENS).length);
  });

  test("contains no bare hex outside a declaration value", () => {
    // A sanity check on the generator rather than on the palette: every colour
    // must arrive as the value of an `--of-*` declaration.
    for (const line of css.split("\n")) {
      if (line.includes("#") && !line.trim().startsWith("--of-")) {
        expect(line).toContain("/*");
      }
    }
  });
});

describe("the theme registry", () => {
  test("exposes exactly the two modes", () => {
    expect(Object.keys(themes).toSorted()).toEqual(["dark", "light"]);
    expect(themes.dark).toBe(darkTheme);
    expect(themes.light).toBe(lightTheme);
  });
});
