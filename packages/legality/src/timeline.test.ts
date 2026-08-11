/**
 * Every boundary decision in `timeline.ts` is asserted here, including the ones
 * that look obvious. The module's whole job is off-by-one avoidance and the
 * cost of getting one wrong is a wrong legality verdict at somebody's event.
 *
 * ## The fixtures are deliberately fictional
 *
 * Every card id below starts `fixture:` and every citation names a document
 * that does not exist. That is a correctness requirement, not tidiness: this
 * repository publishes a legality dataset, and a test fixture that *looked*
 * like a real ban — a real card name with a plausible date — is one careless
 * copy-paste away from becoming a published claim nobody verified. No date,
 * card or document in this file asserts anything about Flesh and Blood.
 */

import { describe, expect, test } from "bun:test";

import type { CardStatus, LegalityTimeline, RuleCitation, TimelineEntry } from "./index";
import { CARD_STATUSES } from "./index";
import {
  compareIsoDates,
  coversDate,
  historyFor,
  isConflict,
  isNoRecord,
  isRecorded,
  nextChange,
  previousDay,
  statusAsOf,
  TimelineDataError,
  validateTimeline,
} from "./timeline";

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const CITATION: RuleCitation = {
  ruleId: "fixture:announcement#1",
  document: "FIXTURE — not an official document",
  version: "fixture",
  effectiveFrom: "2020-01-01",
};

function entry(
  cardId: string,
  status: CardStatus,
  effectiveFrom: string,
  effectiveUntil?: string,
): TimelineEntry {
  return effectiveUntil === undefined
    ? { cardId, format: "blitz", status, effectiveFrom, citation: CITATION }
    : { cardId, format: "blitz", status, effectiveFrom, effectiveUntil, citation: CITATION };
}

function timelineOf(entries: readonly TimelineEntry[], generatedAt = "2030-01-01"): LegalityTimeline {
  return {
    version: "fixture",
    generatedAt,
    source: "fixture",
    entries,
  };
}

const CARD = "fixture:card-a";
const OTHER = "fixture:card-b";

/* -------------------------------------------------------------------------- */
/* Date primitives                                                             */
/* -------------------------------------------------------------------------- */

describe("compareIsoDates", () => {
  test("orders fixed-width ISO dates chronologically", () => {
    expect(compareIsoDates("2026-03-13", "2026-03-14")).toBe(-1);
    expect(compareIsoDates("2026-03-14", "2026-03-14")).toBe(0);
    expect(compareIsoDates("2026-03-15", "2026-03-14")).toBe(1);
  });

  test("orders across month and year boundaries, where naive parsing goes wrong", () => {
    expect(compareIsoDates("2025-12-31", "2026-01-01")).toBe(-1);
    expect(compareIsoDates("2026-09-01", "2026-10-01")).toBe(-1);
  });
});

describe("previousDay", () => {
  test("steps back one calendar day", () => {
    expect(previousDay("2026-03-14")).toBe("2026-03-13");
  });

  test("steps back across a month boundary", () => {
    expect(previousDay("2026-03-01")).toBe("2026-02-28");
  });

  test("steps back across a leap day and a year boundary", () => {
    expect(previousDay("2024-03-01")).toBe("2024-02-29");
    expect(previousDay("2026-01-01")).toBe("2025-12-31");
  });

  test("rejects a malformed date rather than producing a plausible wrong one", () => {
    expect(() => previousDay("2026-02-31")).toThrow(TypeError);
    expect(() => previousDay("14/03/2026")).toThrow(TypeError);
  });
});

/* -------------------------------------------------------------------------- */
/* The interval predicate                                                      */
/* -------------------------------------------------------------------------- */

describe("coversDate — effectiveFrom is inclusive", () => {
  const banned = entry(CARD, "banned", "2026-03-14", "2026-06-01");

  test("the day before the ban takes effect is not covered", () => {
    expect(coversDate(banned, "2026-03-13")).toBe(false);
  });

  test("the day the ban takes effect IS covered", () => {
    expect(coversDate(banned, "2026-03-14")).toBe(true);
  });

  test("a day inside the interval is covered", () => {
    expect(coversDate(banned, "2026-04-01")).toBe(true);
  });
});

describe("coversDate — effectiveUntil is exclusive", () => {
  const banned = entry(CARD, "banned", "2026-03-14", "2026-06-01");

  test("the last day before the end boundary is covered", () => {
    expect(coversDate(banned, "2026-05-31")).toBe(true);
  });

  test("the end boundary itself is NOT covered", () => {
    expect(coversDate(banned, "2026-06-01")).toBe(false);
  });

  test("previousDay(effectiveUntil) is the inclusive last day, and it is covered", () => {
    expect(coversDate(banned, previousDay("2026-06-01"))).toBe(true);
  });

  test("an absent effectiveUntil is unbounded", () => {
    const current = entry(CARD, "banned", "2026-03-14");
    expect(coversDate(current, "2026-03-14")).toBe(true);
    expect(coversDate(current, "2999-12-31")).toBe(true);
    expect(coversDate(current, "2026-03-13")).toBe(false);
  });
});

describe("coversDate — abutting intervals", () => {
  // The reason exclusive-until was chosen: `until = successor.from` encodes a
  // status change with no subtraction anywhere, and the change day belongs to
  // exactly one interval.
  const before = entry(CARD, "legal", "2025-01-01", "2026-03-14");
  const after = entry(CARD, "banned", "2026-03-14");

  test("the change day belongs to the successor alone", () => {
    expect(coversDate(before, "2026-03-14")).toBe(false);
    expect(coversDate(after, "2026-03-14")).toBe(true);
  });

  test("the day before the change belongs to the predecessor alone", () => {
    expect(coversDate(before, "2026-03-13")).toBe(true);
    expect(coversDate(after, "2026-03-13")).toBe(false);
  });
});

describe("coversDate — impossible intervals cover nothing", () => {
  test("a zero-length interval covers no day at all", () => {
    const zero = entry(CARD, "banned", "2026-03-14", "2026-03-14");
    expect(coversDate(zero, "2026-03-13")).toBe(false);
    expect(coversDate(zero, "2026-03-14")).toBe(false);
    expect(coversDate(zero, "2026-03-15")).toBe(false);
  });

  test("an inverted interval covers nothing, failing toward unknown", () => {
    const inverted = entry(CARD, "banned", "2026-06-01", "2026-03-14");
    expect(coversDate(inverted, "2026-04-01")).toBe(false);
    expect(coversDate(inverted, "2026-06-02")).toBe(false);
  });
});

describe("coversDate — malformed input", () => {
  test("a malformed query date is the caller's error", () => {
    expect(() => coversDate(entry(CARD, "banned", "2026-03-14"), "2026-02-31")).toThrow(TypeError);
  });

  test("a malformed entry date is the dataset's error, and it is loud", () => {
    expect(() => coversDate(entry(CARD, "banned", "March 14"), "2026-03-14")).toThrow(
      TimelineDataError,
    );
    expect(() => coversDate(entry(CARD, "banned", "2026-03-14", "soon"), "2026-03-14")).toThrow(
      TimelineDataError,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* statusAsOf — the recorded branch                                            */
/* -------------------------------------------------------------------------- */

describe("statusAsOf — a recorded status", () => {
  const timeline = timelineOf([
    entry(CARD, "legal", "2025-01-01", "2026-03-14"),
    entry(CARD, "banned", "2026-03-14", "2026-09-01"),
    entry(CARD, "living-legend", "2026-09-01"),
  ]);

  test("answers with the interval that covers the date", () => {
    const result = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-04-01" });
    expect(result.kind).toBe("recorded");
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.status).toBe("banned");
    expect(result.legal).toBe(false);
    expect(result.since).toBe("2026-03-14");
    expect(result.until).toBe("2026-09-01");
    expect(result.entries).toHaveLength(1);
    expect(result.entry.citation.ruleId).toBe("fixture:announcement#1");
  });

  test("the day a ban takes effect answers banned, not legal", () => {
    const onTheDay = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-03-14" });
    const dayBefore = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-03-13" });
    if (!isRecorded(onTheDay) || !isRecorded(dayBefore)) throw new Error("expected records");
    expect(onTheDay.status).toBe("banned");
    expect(dayBefore.status).toBe("legal");
    expect(dayBefore.legal).toBe(true);
  });

  test("an explicitly recorded legal status is a record, not an absence", () => {
    const result = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2025-06-01" });
    expect(result.kind).toBe("recorded");
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.status).toBe("legal");
    expect(result.legal).toBe(true);
  });

  test("an open-ended interval reports no end boundary", () => {
    const result = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2027-01-01" });
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.status).toBe("living-legend");
    expect(result.until).toBeUndefined();
  });

  test("entries for another card or another format are never consulted", () => {
    const mixed = timelineOf([
      entry(OTHER, "banned", "2020-01-01"),
      {
        cardId: CARD,
        format: "classic-constructed",
        status: "banned",
        effectiveFrom: "2020-01-01",
        citation: CITATION,
      },
    ]);
    const result = statusAsOf(mixed, { cardId: CARD, format: "blitz", asOf: "2026-04-01" });
    expect(result.kind).toBe("no-record");
    if (!isNoRecord(result)) throw new Error("expected no record");
    expect(result.reason).toBe("no-entries-for-card");
  });
});

/* -------------------------------------------------------------------------- */
/* statusAsOf — the no-record branch, which is the important one               */
/* -------------------------------------------------------------------------- */

describe("statusAsOf — unknown is never legal", () => {
  const timeline = timelineOf([entry(CARD, "banned", "2026-03-14", "2026-09-01")]);

  test("a date before any entry is no-record, NOT legal", () => {
    const result = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2025-01-01" });
    expect(result.kind).toBe("no-record");
    if (!isNoRecord(result)) throw new Error("expected no record");
    expect(result.reason).toBe("before-first-record");
    expect(result.earliestRecord).toBe("2026-03-14");
  });

  test("the no-record result carries no status and no legal flag at all", () => {
    // The type system forbids reading them; this asserts the runtime shape
    // matches, so a structural check or a JSON round-trip cannot resurrect the
    // conflation the types were designed to prevent.
    const result = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2025-01-01" });
    expect("status" in result).toBe(false);
    expect("legal" in result).toBe(false);
    expect(Object.keys(result)).not.toContain("status");
  });

  test("a card with no entries at all is no-record, with no coverage floor", () => {
    const result = statusAsOf(timeline, { cardId: OTHER, format: "blitz", asOf: "2026-04-01" });
    if (!isNoRecord(result)) throw new Error("expected no record");
    expect(result.reason).toBe("no-entries-for-card");
    expect(result.earliestRecord).toBeUndefined();
  });

  test("an empty timeline answers no-record rather than legal", () => {
    const result = statusAsOf(timelineOf([]), { cardId: CARD, format: "blitz", asOf: "2026-04-01" });
    if (!isNoRecord(result)) throw new Error("expected no record");
    expect(result.reason).toBe("no-entries-for-card");
  });

  test("a hole between two recorded intervals is no-record", () => {
    const gapped = timelineOf([
      entry(CARD, "banned", "2024-01-01", "2024-06-01"),
      entry(CARD, "banned", "2026-01-01", "2026-06-01"),
    ]);
    const result = statusAsOf(gapped, { cardId: CARD, format: "blitz", asOf: "2025-01-01" });
    if (!isNoRecord(result)) throw new Error("expected no record");
    expect(result.reason).toBe("between-records");
    expect(result.earliestRecord).toBe("2024-01-01");
  });

  test("a date after every closed interval is no-record", () => {
    const result = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-09-01" });
    if (!isNoRecord(result)) throw new Error("expected no record");
    expect(result.reason).toBe("after-last-record");
  });

  test("an open-ended interval means the record never ends, only gaps", () => {
    const openEnded = timelineOf([entry(CARD, "banned", "2026-03-14")]);
    const before = statusAsOf(openEnded, { cardId: CARD, format: "blitz", asOf: "2026-03-13" });
    if (!isNoRecord(before)) throw new Error("expected no record");
    expect(before.reason).toBe("before-first-record");
  });

  test("a zero-length interval yields no record, never a status", () => {
    const zero = timelineOf([entry(CARD, "banned", "2026-03-14", "2026-03-14")]);
    const result = statusAsOf(zero, { cardId: CARD, format: "blitz", asOf: "2026-03-14" });
    expect(result.kind).toBe("no-record");
  });
});

/* -------------------------------------------------------------------------- */
/* statusAsOf — overlapping entries                                            */
/* -------------------------------------------------------------------------- */

describe("statusAsOf — overlapping entries", () => {
  test("entries that disagree produce a conflict, never a chosen winner", () => {
    const contradictory = timelineOf([
      entry(CARD, "banned", "2026-01-01", "2026-12-01"),
      entry(CARD, "legal", "2026-03-01", "2026-06-01"),
    ]);
    const result = statusAsOf(contradictory, {
      cardId: CARD,
      format: "blitz",
      asOf: "2026-04-01",
    });
    expect(result.kind).toBe("conflict");
    if (!isConflict(result)) throw new Error("expected a conflict");
    expect(result.entries).toHaveLength(2);
    expect(result.statuses).toEqual(["banned", "legal"]);
    expect("status" in result).toBe(false);
    expect("legal" in result).toBe(false);
  });

  test("a conflict is reported only on the days the entries actually overlap", () => {
    const contradictory = timelineOf([
      entry(CARD, "banned", "2026-01-01", "2026-12-01"),
      entry(CARD, "legal", "2026-03-01", "2026-06-01"),
    ]);
    const outside = statusAsOf(contradictory, {
      cardId: CARD,
      format: "blitz",
      asOf: "2026-02-01",
    });
    if (!isRecorded(outside)) throw new Error("expected a recorded status");
    expect(outside.status).toBe("banned");
  });

  test("entries that agree are not ambiguous: the answer stands, all citations kept", () => {
    const redundant = timelineOf([
      entry(CARD, "banned", "2026-01-01", "2026-12-01"),
      entry(CARD, "banned", "2026-03-01"),
    ]);
    const result = statusAsOf(redundant, { cardId: CARD, format: "blitz", asOf: "2026-04-01" });
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.status).toBe("banned");
    expect(result.entries).toHaveLength(2);
    // The widest-covering entry is the one cited, so a nested restatement can
    // never narrow the answer.
    expect(result.entry.effectiveFrom).toBe("2026-03-01");
    expect(result.entry.effectiveUntil).toBeUndefined();
    // ...but the STATUS has held since the earlier of the two, and saying
    // otherwise would answer a different question than `since` asks.
    expect(result.since).toBe("2026-01-01");
    expect(result.until).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* statusAsOf — provenance and provisionality                                  */
/* -------------------------------------------------------------------------- */

describe("statusAsOf — a verdict about the future is marked provisional", () => {
  const timeline = timelineOf([entry(CARD, "banned", "2026-03-14")], "2026-06-30");

  test("a date at or before generatedAt is settled", () => {
    const past = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-04-01" });
    const sameDay = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-06-30" });
    expect(past.provisional).toBe(false);
    expect(sameDay.provisional).toBe(false);
  });

  test("a date after generatedAt is provisional, because a later announcement can change it", () => {
    const future = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-07-01" });
    expect(future.provisional).toBe(true);
  });

  test("provisionality is reported on a no-record answer too", () => {
    const future = statusAsOf(timeline, { cardId: OTHER, format: "blitz", asOf: "2027-01-01" });
    expect(future.kind).toBe("no-record");
    expect(future.provisional).toBe(true);
  });
});

describe("statusAsOf — malformed input", () => {
  const timeline = timelineOf([entry(CARD, "banned", "2026-03-14")]);

  test("a malformed asOf is a TypeError", () => {
    expect(() => statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: "2026-02-31" })).toThrow(
      TypeError,
    );
  });

  test("a malformed generatedAt is a dataset error", () => {
    const broken = timelineOf([entry(CARD, "banned", "2026-03-14")], "sometime");
    expect(() => statusAsOf(broken, { cardId: CARD, format: "blitz", asOf: "2026-04-01" })).toThrow(
      TimelineDataError,
    );
  });

  test("a malformed entry date stops the query rather than losing the entry", () => {
    const broken = timelineOf([entry(CARD, "banned", "2026-3-14")]);
    expect(() => statusAsOf(broken, { cardId: CARD, format: "blitz", asOf: "2026-04-01" })).toThrow(
      TimelineDataError,
    );
  });

  test("a non-array entries field is a TypeError", () => {
    const broken = { ...timelineOf([]), entries: undefined } as unknown as LegalityTimeline;
    expect(() => statusAsOf(broken, { cardId: CARD, format: "blitz", asOf: "2026-04-01" })).toThrow(
      TypeError,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* historyFor and nextChange                                                   */
/* -------------------------------------------------------------------------- */

describe("historyFor", () => {
  test("returns the card's entries in chronological order regardless of dataset order", () => {
    const shuffled = timelineOf([
      entry(CARD, "living-legend", "2026-09-01"),
      entry(OTHER, "banned", "2020-01-01"),
      entry(CARD, "legal", "2025-01-01", "2026-03-14"),
      entry(CARD, "banned", "2026-03-14", "2026-09-01"),
    ]);
    const history = historyFor(shuffled, { cardId: CARD, format: "blitz" });
    expect(history.map((item) => item.effectiveFrom)).toEqual([
      "2025-01-01",
      "2026-03-14",
      "2026-09-01",
    ]);
  });

  test("returns an empty array for a card it has never heard of", () => {
    expect(historyFor(timelineOf([]), { cardId: CARD, format: "blitz" })).toHaveLength(0);
  });
});

describe("nextChange", () => {
  const timeline = timelineOf([
    entry(CARD, "legal", "2025-01-01", "2026-03-14"),
    entry(CARD, "banned", "2026-03-14", "2026-09-01"),
    entry(CARD, "living-legend", "2026-09-01"),
  ]);

  test("finds the next entry strictly after the query date", () => {
    const change = nextChange(timeline, { cardId: CARD, format: "blitz", asOf: "2026-01-01" });
    expect(change.kind).toBe("entry");
    expect(change.kind === "none" ? undefined : change.on).toBe("2026-03-14");
  });

  test("an entry taking effect ON the query date is already in force, not a future change", () => {
    const change = nextChange(timeline, { cardId: CARD, format: "blitz", asOf: "2026-03-14" });
    expect(change.kind === "none" ? undefined : change.on).toBe("2026-09-01");
  });

  test("open-ended coverage with nothing after it is 'none'", () => {
    expect(nextChange(timeline, { cardId: CARD, format: "blitz", asOf: "2027-01-01" }).kind).toBe(
      "none",
    );
  });

  test("previousDay of the next change is the inclusive last day of the current answer", () => {
    const change = nextChange(timeline, { cardId: CARD, format: "blitz", asOf: "2026-01-01" });
    if (change.kind !== "entry") throw new Error("expected an entry change");
    const lastDay = previousDay(change.on);
    expect(lastDay).toBe("2026-03-13");
    const stillLegal = statusAsOf(timeline, { cardId: CARD, format: "blitz", asOf: lastDay });
    if (!isRecorded(stillLegal)) throw new Error("expected a recorded status");
    expect(stillLegal.status).toBe("legal");
  });

  /*
   * The regression that motivated the three-armed return. Both datasets below
   * are reported CLEAN by validateTimeline, so nothing else in this module
   * would have caught either of them.
   */
  test("a hole after a closed interval is a change, not a jump to the next announcement", () => {
    const holed = timelineOf([
      entry(CARD, "legal", "2020-01-01", "2021-01-01"),
      entry(CARD, "banned", "2023-01-01"),
    ]);
    expect(validateTimeline(holed)).toEqual([]);

    const change = nextChange(holed, { cardId: CARD, format: "blitz", asOf: "2020-06-01" });
    expect(change.kind).toBe("record-ends");
    expect(change.kind === "none" ? undefined : change.on).toBe("2021-01-01");

    // The whole point: `previousDay(change.on)` must not claim legality across
    // the 730 days the dataset says nothing about.
    if (change.kind === "none") throw new Error("expected a change");
    const lastDay = previousDay(change.on);
    expect(lastDay).toBe("2020-12-31");
    const dayAfter = statusAsOf(holed, { cardId: CARD, format: "blitz", asOf: "2021-01-01" });
    expect(dayAfter.kind).toBe("no-record");
  });

  test("a suspension that demonstrably ends is a change, not 'nothing further recorded'", () => {
    const suspension = timelineOf([entry(CARD, "suspended", "2024-01-01", "2024-07-01")]);
    const change = nextChange(suspension, { cardId: CARD, format: "blitz", asOf: "2024-02-01" });
    expect(change.kind).toBe("record-ends");
    expect(change.kind === "none" ? undefined : change.on).toBe("2024-07-01");
  });

  test("abutting entries make the announcement the change, never a phantom gap", () => {
    const abutting = timelineOf([
      entry(CARD, "legal", "2020-01-01", "2021-01-01"),
      entry(CARD, "banned", "2021-01-01"),
    ]);
    const change = nextChange(abutting, { cardId: CARD, format: "blitz", asOf: "2020-06-01" });
    expect(change.kind).toBe("entry");
    expect(change.kind === "none" ? undefined : change.on).toBe("2021-01-01");
  });

  test("a date already past every closed interval reports no further change", () => {
    const ended = timelineOf([entry(CARD, "banned", "2024-01-01", "2024-07-01")]);
    expect(nextChange(ended, { cardId: CARD, format: "blitz", asOf: "2025-01-01" }).kind).toBe(
      "none",
    );
  });

  test("a card with no entries at all has no next change", () => {
    expect(nextChange(timeline, { cardId: OTHER, format: "blitz", asOf: "2026-01-01" }).kind).toBe(
      "none",
    );
  });

  test("from inside a hole, the next recorded entry is the change", () => {
    const holed = timelineOf([
      entry(CARD, "legal", "2020-01-01", "2021-01-01"),
      entry(CARD, "banned", "2023-01-01"),
    ]);
    const change = nextChange(holed, { cardId: CARD, format: "blitz", asOf: "2022-01-01" });
    expect(change.kind).toBe("entry");
    expect(change.kind === "none" ? undefined : change.on).toBe("2023-01-01");
  });
});

/* -------------------------------------------------------------------------- */
/* The status run — `since` and `until` describe the status, not one entry     */
/* -------------------------------------------------------------------------- */

describe("statusAsOf — since and until span the whole run of one status", () => {
  test("two abutting entries that agree do not manufacture an end date", () => {
    // Reported clean by validateTimeline, which is what made this dangerous:
    // reading the first entry's own boundary gave "legal until 2020-12-31" for
    // a card that is still legal.
    const restated = timelineOf([
      entry(CARD, "legal", "2020-01-01", "2021-01-01"),
      entry(CARD, "legal", "2021-01-01"),
    ]);
    expect(validateTimeline(restated)).toEqual([]);

    const result = statusAsOf(restated, { cardId: CARD, format: "blitz", asOf: "2020-06-01" });
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.since).toBe("2020-01-01");
    expect(result.until).toBeUndefined();
  });

  test("a nested restatement never narrows the answer, and the answer is monotone", () => {
    const nested = timelineOf([
      entry(CARD, "legal", "2020-01-01"),
      entry(CARD, "legal", "2021-01-01", "2021-02-01"),
    ]);
    for (const asOf of ["2020-06-01", "2021-01-15", "2021-06-01", "2030-01-01"]) {
      const result = statusAsOf(nested, { cardId: CARD, format: "blitz", asOf });
      if (!isRecorded(result)) throw new Error("expected a recorded status");
      expect(result.since).toBe("2020-01-01");
      expect(result.until).toBeUndefined();
    }
  });

  test("a run stops at the first entry recording a different status", () => {
    const changing = timelineOf([
      entry(CARD, "legal", "2020-01-01", "2021-01-01"),
      entry(CARD, "legal", "2021-01-01", "2022-01-01"),
      entry(CARD, "banned", "2022-01-01"),
    ]);
    const result = statusAsOf(changing, { cardId: CARD, format: "blitz", asOf: "2020-06-01" });
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.since).toBe("2020-01-01");
    expect(result.until).toBe("2022-01-01");
    expect(previousDay(result.until ?? "")).toBe("2021-12-31");
  });

  test("a hole ends the run — coverage is not continuity", () => {
    const holed = timelineOf([
      entry(CARD, "legal", "2020-01-01", "2021-01-01"),
      entry(CARD, "legal", "2023-01-01"),
    ]);
    const result = statusAsOf(holed, { cardId: CARD, format: "blitz", asOf: "2020-06-01" });
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.until).toBe("2021-01-01");
  });

  test("a contradictory entry elsewhere in the run shortens it, never lengthens it", () => {
    const contested = timelineOf([
      entry(CARD, "legal", "2020-01-01"),
      entry(CARD, "banned", "2021-01-01", "2021-02-01"),
    ]);
    const result = statusAsOf(contested, { cardId: CARD, format: "blitz", asOf: "2020-06-01" });
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.until).toBe("2021-01-01");
    // ...and the dataset defect is still reported rather than absorbed.
    expect(validateTimeline(contested).map((item) => item.kind)).toContain("contradictory-overlap");
  });

  test("the governing entry's own boundaries stay readable on `entry`", () => {
    const restated = timelineOf([
      entry(CARD, "banned", "2020-01-01", "2021-01-01"),
      entry(CARD, "banned", "2021-01-01"),
    ]);
    const result = statusAsOf(restated, { cardId: CARD, format: "blitz", asOf: "2022-01-01" });
    if (!isRecorded(result)) throw new Error("expected a recorded status");
    expect(result.entry.effectiveFrom).toBe("2021-01-01");
    expect(result.since).toBe("2020-01-01");
  });
});

/* -------------------------------------------------------------------------- */
/* validateTimeline                                                            */
/* -------------------------------------------------------------------------- */

describe("validateTimeline", () => {
  test("a well-formed timeline has no defects", () => {
    const clean = timelineOf([
      entry(CARD, "legal", "2025-01-01", "2026-03-14"),
      entry(CARD, "banned", "2026-03-14", "2026-09-01"),
      entry(CARD, "living-legend", "2026-09-01"),
      entry(OTHER, "banned", "2026-01-01"),
    ]);
    expect(validateTimeline(clean)).toEqual([]);
  });

  test("abutting intervals are not an overlap — that is the point of an exclusive end", () => {
    const abutting = timelineOf([
      entry(CARD, "legal", "2025-01-01", "2026-03-14"),
      entry(CARD, "banned", "2026-03-14"),
    ]);
    expect(validateTimeline(abutting)).toEqual([]);
  });

  test("flags a malformed generatedAt", () => {
    const defects = validateTimeline(timelineOf([], "2026-3-1"));
    expect(defects.map((defect) => defect.kind)).toEqual(["malformed-generated-at"]);
    expect(defects[0]?.severity).toBe("error");
  });

  test("flags malformed entry dates without throwing, so the whole file gets checked", () => {
    const defects = validateTimeline(
      timelineOf([entry(CARD, "banned", "March 14"), entry(OTHER, "banned", "2026-01-01", "later")]),
    );
    expect(defects.map((defect) => defect.kind)).toEqual([
      "malformed-effective-from",
      "malformed-effective-until",
    ]);
  });

  test("flags an unsanctioned format", () => {
    const defects = validateTimeline(
      timelineOf([
        {
          cardId: CARD,
          format: "sealed" as TimelineEntry["format"],
          status: "banned",
          effectiveFrom: "2026-01-01",
          citation: CITATION,
        },
      ]),
    );
    expect(defects.map((defect) => defect.kind)).toEqual(["unknown-format"]);
  });

  /*
   * `status` is the one field that decides `legal`, and it went unchecked. The
   * banned-list backfill is a prose scrape, so these are the shapes it will
   * emit — and every one of them used to validate clean AND answer
   * `kind: "recorded"`.
   */
  test("flags a status outside the recognised vocabulary", () => {
    for (const status of ["Banned", "unbanned", "legal ", ""]) {
      const defects = validateTimeline(
        timelineOf([entry(CARD, status as CardStatus, "2026-01-01")]),
      );
      expect(defects.map((defect) => defect.kind)).toEqual(["unknown-status"]);
      expect(defects[0]?.severity).toBe("error");
    }
  });

  test("flags a missing status, which JSON produces and the type system does not see", () => {
    const broken = {
      cardId: CARD,
      format: "blitz",
      effectiveFrom: "2026-01-01",
      citation: CITATION,
    } as unknown as TimelineEntry;
    expect(validateTimeline(timelineOf([broken])).map((defect) => defect.kind)).toEqual([
      "unknown-status",
    ]);
  });

  test("accepts every status the package publishes, so the check cannot drift from the type", () => {
    const everyStatus = timelineOf(
      CARD_STATUSES.map((status, index) =>
        entry(`fixture:card-${String(index)}`, status, "2026-01-01"),
      ),
    );
    expect(validateTimeline(everyStatus)).toEqual([]);
  });

  test("flags an inverted interval as an error", () => {
    const defects = validateTimeline(
      timelineOf([entry(CARD, "banned", "2026-06-01", "2026-03-14")]),
    );
    expect(defects.map((defect) => defect.kind)).toEqual(["inverted-interval"]);
    expect(defects[0]?.severity).toBe("error");
  });

  test("flags a zero-length interval — the fingerprint of an inclusive-until author", () => {
    const defects = validateTimeline(
      timelineOf([entry(CARD, "banned", "2026-03-14", "2026-03-14")]),
    );
    expect(defects.map((defect) => defect.kind)).toEqual(["zero-length-interval"]);
    expect(defects[0]?.severity).toBe("warning");
  });

  test("flags contradictory overlap as an error and names both entries", () => {
    const defects = validateTimeline(
      timelineOf([
        entry(CARD, "banned", "2026-01-01", "2026-12-01"),
        entry(CARD, "legal", "2026-03-01", "2026-06-01"),
      ]),
    );
    expect(defects).toHaveLength(1);
    expect(defects[0]?.kind).toBe("contradictory-overlap");
    expect(defects[0]?.severity).toBe("error");
    expect(defects[0]?.entries).toHaveLength(2);
    expect(defects[0]?.cardId).toBe(CARD);
  });

  test("flags redundant overlap as a warning, since it is untidy rather than untrue", () => {
    const defects = validateTimeline(
      timelineOf([
        entry(CARD, "banned", "2026-01-01", "2026-12-01"),
        entry(CARD, "banned", "2026-03-01"),
      ]),
    );
    expect(defects.map((defect) => defect.kind)).toEqual(["redundant-overlap"]);
    expect(defects[0]?.severity).toBe("warning");
  });

  test("flags an exact duplicate once, as a duplicate rather than an overlap", () => {
    const defects = validateTimeline(
      timelineOf([
        entry(CARD, "banned", "2026-01-01", "2026-06-01"),
        entry(CARD, "banned", "2026-01-01", "2026-06-01"),
      ]),
    );
    expect(defects.map((defect) => defect.kind)).toEqual(["duplicate-entry"]);
  });

  test("does not treat the same card in two formats as an overlap", () => {
    const twoFormats = timelineOf([
      entry(CARD, "banned", "2026-01-01"),
      {
        cardId: CARD,
        format: "classic-constructed",
        status: "legal",
        effectiveFrom: "2026-01-01",
        citation: CITATION,
      },
    ]);
    expect(validateTimeline(twoFormats)).toEqual([]);
  });

  test("reports every defect rather than stopping at the first", () => {
    const messy = timelineOf(
      [
        entry(CARD, "banned", "2026-06-01", "2026-03-14"),
        entry(OTHER, "banned", "2026-03-14", "2026-03-14"),
      ],
      "not-a-date",
    );
    expect(validateTimeline(messy).map((defect) => defect.kind)).toEqual([
      "malformed-generated-at",
      "inverted-interval",
      "zero-length-interval",
    ]);
  });
});
