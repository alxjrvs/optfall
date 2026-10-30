import { describe, expect, test } from "bun:test";

import { themes } from "optfall-theme";

import { pitchColour } from "./pitchColour";

describe("pitchColour", () => {
  test("each value reads the dark theme's pitch token", () => {
    const tokens = themes.dark.tokens;
    expect(pitchColour(0)).toBe(tokens["color.pitch.none"] ?? "");
    expect(pitchColour(1)).toBe(tokens["color.pitch.one"] ?? "");
    expect(pitchColour(2)).toBe(tokens["color.pitch.two"] ?? "");
    expect(pitchColour(3)).toBe(tokens["color.pitch.three"] ?? "");
    expect(pitchColour(4)).toBe(tokens["color.pitch.four"] ?? "");
  });

  test("it is a literal colour, not a custom property", () => {
    /* `theme-color` is read by browser chrome and link unfurlers, which never
       see a stylesheet, so a `var(--…)` here would be a preview with no
       colour at all. */
    for (const pitch of [0, 1, 2, 3, 4] as const) {
      expect(pitchColour(pitch)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
