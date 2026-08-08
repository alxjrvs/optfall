import { describe, expect, test } from "bun:test";

import {
  assertTokenTable,
  cssProperty,
  cssValue,
  isForbiddenTokenId,
  ORNAMENT_ROLES,
  THEMES,
  toCssDeclarations,
  type TokenTable,
} from "./index";

describe("token identifiers", () => {
  test("map to prefixed CSS custom properties", () => {
    expect(cssProperty("color.ground")).toBe("--of-color-ground");
    expect(cssProperty("space.gutter.tight")).toBe("--of-space-gutter-tight");
  });

  test("are referenced through var(), with an optional fallback", () => {
    expect(cssValue("color.ground")).toBe("var(--of-color-ground)");
    expect(cssValue("color.ground", "#000")).toBe("var(--of-color-ground, #000)");
  });

  test("render as a declaration block", () => {
    const tokens: TokenTable = { "color.ground": "#0b0b0c", "space.gutter": "1rem" };
    expect(toCssDeclarations({ name: "dark", tokens })).toBe(
      "--of-color-ground: #0b0b0c;\n--of-space-gutter: 1rem;",
    );
  });
});

describe("rationed vocabulary", () => {
  test("both themes are first-class, neither derived from the other", () => {
    expect(THEMES).toEqual(["dark", "light"]);
  });

  test("filigree has exactly three sanctioned roles", () => {
    expect(ORNAMENT_ROLES).toHaveLength(3);
  });
});

describe("asset policy", () => {
  test("token ids naming a logo or set symbol are forbidden", () => {
    expect(isForbiddenTokenId("ornament.set-symbol")).toBe(true);
    expect(isForbiddenTokenId("color.brand.LOGO")).toBe(true);
    expect(isForbiddenTokenId("ornament.filigree")).toBe(false);
  });

  test("a table naming one fails loudly rather than shipping", () => {
    expect(() => {
      assertTokenTable({ "ornament.set-logo": "url(...)" } as TokenTable);
    }).toThrow(/forbids shipping/);
  });

  test("a compliant table passes", () => {
    expect(() => {
      assertTokenTable({ "color.ground": "#0b0b0c" });
    }).not.toThrow();
  });
});
