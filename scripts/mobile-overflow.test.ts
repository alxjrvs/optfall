/**
 * The one token that cannot fit on a phone, and the rule that keeps it from
 * trying.
 *
 * CLAUDE.md states the invariant precisely — "320, 360, 390, 430, 964, 1226, and
 * `documentElement.scrollWidth === clientWidth` at every one" — and then hands
 * the reader a manual procedure. Neither identifier appears anywhere in the
 * repository. This is not that check: a real one needs layout, jsdom and
 * happy-dom do not lay out, and a headless browser is a large new dependency
 * for a project that keeps them few.
 *
 * WHAT THIS IS INSTEAD is the static half, and it is narrower and more useful
 * than it sounds, because the surface is almost entirely closed already:
 *
 * - `check:tokens` fails the build on a raw length in a component, so a
 *   hand-typed `450px` cannot appear at all. Every width in the system is a
 *   token.
 * - Of those tokens, exactly one is wider than the narrowest phone.
 *   `card.face.normal` is 28.125rem — 450px — against a 320px viewport, which
 *   is 20rem. `card.face.thumb` is 11.25rem and fits everywhere.
 *
 * So the horizontal-scrollbar risk in this codebase has one name. A use of
 * `--of-card-face-normal` that a narrow viewport cannot shrink is the whole
 * failure mode, and that is what this asserts.
 *
 * BOUNDED MEANS `min(…, 100%)` OR A DOCUMENTED PAIR. The three current uses are
 * all correct and each is correct differently, which is why the allowlist below
 * exists rather than a single pattern: one is a shrinkable flex basis whose cap
 * lives in a `max-inline-size` on the same selector, and a regex cannot see that
 * two declarations belong to one rule. Naming it costs a line and keeps the
 * check honest about what it can and cannot see.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** The token wider than a 320px viewport. The only one. */
const WIDE_TOKEN = "--of-card-face-normal";

/**
 * Uses of {@link WIDE_TOKEN} that are bounded by something this file cannot
 * see in a single line.
 *
 * ONE ENTRY. `CardEntry.css` sets `flex: 0 1 var(--of-card-face-normal)` on the
 * face column — a basis the item is allowed to shrink below, capped by
 * `max-inline-size: min(var(--of-card-face-normal), 72%)` a few declarations
 * later on the same selector. That pairing is what makes the card page survive
 * a phone, and it is deliberate: the comment beside it records that a
 * full-bleed face pushed the card's own name below the fold.
 */
const BOUNDED_ELSEWHERE: readonly string[] = [
  "flex: 0 1 var(--of-card-face-normal);",
];

const ROOTS = ["apps/site/ssg", "packages/components/src"] as const;
const SKIP = new Set(["node_modules", "dist"]);

function stylesheets(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...stylesheets(path));
      continue;
    }
    if (extname(path) === ".css") found.push(path);
  }
  return found;
}

/** Every line naming the wide token, with where it is. */
function wideUses(): { file: string; line: number; text: string }[] {
  const uses: { file: string; line: number; text: string }[] = [];
  for (const root of ROOTS) {
    for (const file of stylesheets(root)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((text, index) => {
          if (text.includes(WIDE_TOKEN)) {
            uses.push({ file, line: index + 1, text: text.trim() });
          }
        });
    }
  }
  return uses;
}

describe("the widest token cannot force a horizontal scrollbar", () => {
  const uses = wideUses();

  test("there are uses to check", () => {
    /* If this token stops being used, or is renamed, every assertion below goes
       vacuous while still passing. */
    expect(uses.length).toBeGreaterThan(0);
  });

  for (const use of uses) {
    test(`${use.file}:${use.line} bounds it`, () => {
      const bounded =
        use.text.includes("min(") ||
        BOUNDED_ELSEWHERE.some((allowed) => use.text.includes(allowed));

      /* The message is the point: whoever trips this is adding a width, and
         needs the rule rather than a boolean. */
      expect(
        bounded ||
          `${use.file}:${use.line} uses ${WIDE_TOKEN} unbounded — ` +
            `wrap it in min(…, 100%), or cap it with max-inline-size and add ` +
            `the declaration to BOUNDED_ELSEWHERE`,
      ).toBe(true);
    });
  }

  test("the allowlist still describes something real", () => {
    /* An entry no stylesheet contains is an exception for a rule that no longer
       exists — the list describing a ghost. */
    for (const allowed of BOUNDED_ELSEWHERE) {
      expect(uses.some((use) => use.text.includes(allowed))).toBe(true);
    }
  });
});
