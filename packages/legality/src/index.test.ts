import { describe, expect, test } from "bun:test";

import {
  FORMAT_NAMES,
  FORMATS,
  isFormatId,
  isIsoDate,
  isLegal,
  NotImplementedError,
  type Deck,
  type FormatId,
} from "./index";

const deck: Deck = {
  hero: "dorinthea-ironsong",
  cards: [
    { cardId: "steelblade-shunt-red", quantity: 3 },
    { cardId: "dawnblade", quantity: 1, zone: "inventory" },
  ],
};

describe("formats", () => {
  test("the six sanctioned formats are enumerated once each", () => {
    expect(FORMATS).toHaveLength(6);
    expect(new Set(FORMATS).size).toBe(FORMATS.length);
  });

  test("every format has an official display name", () => {
    for (const format of FORMATS) {
      expect(FORMAT_NAMES[format].length).toBeGreaterThan(0);
    }
  });

  test("isFormatId accepts sanctioned formats and rejects everything else", () => {
    expect(isFormatId("classic-constructed")).toBe(true);
    expect(isFormatId("Classic Constructed")).toBe(false);
    expect(isFormatId("sealed")).toBe(false);
  });
});

describe("isIsoDate", () => {
  test("accepts a real calendar date", () => {
    expect(isIsoDate("2026-03-14")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });

  test("rejects dates that match the shape but do not exist", () => {
    expect(isIsoDate("2026-02-31")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2025-02-29")).toBe(false);
  });

  test("rejects anything that is not YYYY-MM-DD", () => {
    expect(isIsoDate("2026-3-14")).toBe(false);
    expect(isIsoDate("14/03/2026")).toBe(false);
    expect(isIsoDate("2026-03-14T00:00:00Z")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("isLegal", () => {
  test("validates its arguments before deferring", () => {
    expect(() => isLegal(deck, "draft" as FormatId, "2026-03-14")).toThrow(TypeError);
    expect(() => isLegal(deck, "blitz", "2026-02-31")).toThrow(TypeError);
    expect(() => isLegal({ hero: "", cards: [] }, "blitz", "2026-03-14")).toThrow(TypeError);
    expect(() =>
      isLegal(
        { hero: "dorinthea-ironsong", cards: [{ cardId: "dawnblade", quantity: 0 }] },
        "blitz",
        "2026-03-14",
      ),
    ).toThrow(TypeError);
  });

  test("rejects a malformed timeline", () => {
    expect(() =>
      isLegal(deck, "blitz", "2026-03-14", {
        timeline: {
          version: "0",
          generatedAt: "not-a-date",
          source: "https://optfall.com/data/legality.json",
          entries: [],
        },
      }),
    ).toThrow(TypeError);
  });

  test("defers evaluation to Phase 2 rather than guessing", () => {
    expect(() => isLegal(deck, "classic-constructed", "2026-03-14")).toThrow(
      NotImplementedError,
    );

    try {
      isLegal(deck, "classic-constructed", "2026-03-14");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(NotImplementedError);
      expect((error as NotImplementedError).phase).toBe(2);
    }
  });
});
