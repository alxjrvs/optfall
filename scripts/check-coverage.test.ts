/**
 * The lcov parser, tested against the format rather than against a run.
 *
 * `check-coverage.ts` cannot be tested end to end here — doing that would mean
 * running the whole suite from inside the suite. What it CAN be tested on is
 * the part that could silently be wrong: summing `LF:`/`LH:` records into a
 * percentage. That is pure, and it is where an off-by-one or a bad regex would
 * hide, because a number that is merely wrong still looks like a number.
 *
 * The fixtures below are shaped like real lcov output — `SF:` starts a file
 * record, `end_of_record` closes it — so a parser that accidentally depended on
 * record boundaries would fail here rather than in CI.
 */

import { describe, expect, test } from "bun:test";

import { percentage, totalsFromLcov, worstFiles } from "./check-coverage";

const RECORD = (file: string, found: number, hit: number): string =>
  [`SF:${file}`, `LF:${found}`, `LH:${hit}`, "end_of_record"].join("\n");

describe("totalsFromLcov sums every file record", () => {
  test("one record", () => {
    expect(totalsFromLcov(RECORD("a.ts", 10, 7))).toEqual({
      found: 10,
      hit: 7,
    });
  });

  test("several records add up", () => {
    const lcov = [
      RECORD("a.ts", 10, 7),
      RECORD("b.ts", 30, 30),
      RECORD("c.ts", 60, 3),
    ].join("\n");

    expect(totalsFromLcov(lcov)).toEqual({ found: 100, hit: 40 });
  });

  test("carriage returns do not break it", () => {
    const lcov = [RECORD("a.ts", 4, 2), RECORD("b.ts", 6, 3)]
      .join("\n")
      .replace(/\n/g, "\r\n");

    expect(totalsFromLcov(lcov)).toEqual({ found: 10, hit: 5 });
  });

  test("an empty report is zero rather than a crash", () => {
    expect(totalsFromLcov("")).toEqual({ found: 0, hit: 0 });
  });

  /*
   * `LF` and `LH` are line records. `FNF`/`FNH` are FUNCTION records and
   * `BRF`/`BRH` are BRANCH records, and all four appear in the same file
   * alongside them. A parser matching too loosely would fold function counts
   * into the line total and report a number that is wrong in a direction
   * nobody would question.
   */
  test("function and branch records are not counted as lines", () => {
    const lcov = [
      "SF:a.ts",
      "FNF:5",
      "FNH:5",
      "LF:10",
      "LH:9",
      "BRF:4",
      "BRH:2",
      "end_of_record",
    ].join("\n");

    expect(totalsFromLcov(lcov)).toEqual({ found: 10, hit: 9 });
  });
});

describe("percentage", () => {
  test("is hit over found", () => {
    expect(percentage(200, 150)).toBe(75);
  });

  /*
   * Nothing executable means nothing to be confident about. Reporting 100%
   * would let a broken reporter — one that wrote an empty report — pass a
   * floor of any height, which is the one failure this whole check exists to
   * prevent. Zero fails instead, loudly.
   */
  test("no executable lines is 0, not 100", () => {
    expect(percentage(0, 0)).toBe(0);
  });
});

describe("worstFiles ranks by missed lines, not by percentage", () => {
  /*
   * THE RANKING IS THE WHOLE VALUE OF THIS FUNCTION. A 40-line helper at 50%
   * is missing twenty lines and looks alarming; a 1,800-line renderer at 94%
   * is missing over a hundred and looks fine. Anyone trying to raise the total
   * needs the renderer first, because moving the number means covering LINES.
   * Sorting by percentage would invert exactly that, so it is asserted rather
   * than assumed.
   */
  const lcov = [
    RECORD("small-helper.ts", 40, 20),
    RECORD("big-renderer.ts", 1800, 1692),
    RECORD("fully-covered.ts", 500, 500),
  ].join("\n");

  test("the file missing the most lines comes first", () => {
    expect(worstFiles(lcov, 10).map((entry) => entry.file)).toEqual([
      "big-renderer.ts",
      "small-helper.ts",
    ]);
  });

  test("a fully covered file is omitted rather than listed at zero", () => {
    expect(
      worstFiles(lcov, 10).some((entry) => entry.file === "fully-covered.ts"),
    ).toBe(false);
  });

  test("missed is found minus hit", () => {
    const [worst] = worstFiles(lcov, 10);
    expect(`${worst?.file} ${worst?.missed}`).toBe("big-renderer.ts 108");
  });

  test("the limit is honoured", () => {
    expect(worstFiles(lcov, 1)).toHaveLength(1);
  });

  test("an empty report yields nothing rather than throwing", () => {
    expect(worstFiles("", 10)).toEqual([]);
  });
});
