import { describe, expect, test } from "bun:test";

import * as legality from "./index";
import {
  CARD_STATUSES,
  FORMAT_NAMES,
  FORMAT_RULES,
  FORMATS,
  isCardStatus,
  isFormatId,
  isIsoDate,
  isLegal,
  NotImplementedError,
  statusAsOf,
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

describe("card statuses", () => {
  test("the vocabulary is enumerated once each, and the guard agrees with it", () => {
    expect(new Set(CARD_STATUSES).size).toBe(CARD_STATUSES.length);
    for (const status of CARD_STATUSES) expect(isCardStatus(status)).toBe(true);
  });

  test("isCardStatus rejects the shapes a prose scrape actually produces", () => {
    for (const wrong of ["Banned", "unbanned", "legal ", "", "BANNED"]) {
      expect(isCardStatus(wrong)).toBe(false);
    }
  });
});

describe("the package presents one entry point", () => {
  /*
   * `formats` and `timeline` are finished and usable on their own; `isLegal` is
   * not, because joining them needs a card dataset that ships no licence. A
   * consumer should not have to know which of the three files a symbol lives
   * in, and — more to the point — should not have to import a deep path that a
   * future reorganisation would break.
   */
  test("format rules are reachable from the package root", () => {
    expect(FORMAT_RULES.blitz.format).toBe("blitz");
    expect(legality.getFormatRules("silver-age").cardPoolMaximum.value).toBe(
      55,
    );
    expect(typeof legality.requireVerified).toBe("function");
  });

  test("timeline mechanics are reachable from the package root", () => {
    const lookup = statusAsOf(
      {
        version: "fixture",
        generatedAt: "2030-01-01",
        source: "fixture",
        entries: [],
      },
      { cardId: "fixture:card", format: "blitz", asOf: "2026-01-01" },
    );
    // Still the rule that outranks the others, and it survives re-export.
    expect(lookup.kind).toBe("no-record");
    expect("legal" in lookup).toBe(false);
  });

  test("re-export does not shadow anything index.ts defines itself", () => {
    // Both modules import from this one; a name collision would resolve
    // silently in whichever direction the bundler felt like.
    expect(legality.FORMATS).toBe(FORMATS);
    expect(legality.isFormatId("blitz")).toBe(true);
  });

  test("ingestion machinery stays off the root entry point", () => {
    // `sources/wayback` opens network connections and belongs to a scheduled
    // job, not to a browser consumer of `isLegal`. It ships under the
    // `optfall-legality/sources` subpath instead.
    for (const exported of Object.keys(legality)) {
      expect(exported).not.toMatch(/wayback|cdx|capture/i);
    }
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
    expect(() => isLegal(deck, "draft" as FormatId, "2026-03-14")).toThrow(
      TypeError,
    );
    expect(() => isLegal(deck, "blitz", "2026-02-31")).toThrow(TypeError);
    expect(() =>
      isLegal({ hero: "", cards: [] }, "blitz", "2026-03-14"),
    ).toThrow(TypeError);
    expect(() =>
      isLegal(
        {
          hero: "dorinthea-ironsong",
          cards: [{ cardId: "dawnblade", quantity: 0 }],
        },
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
