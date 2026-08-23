#!/usr/bin/env bun
/**
 * Fails the build when `color.ink.faint` is used as the colour of small text.
 *
 * WHY THIS IS A SCRIPT AND NOT A COMMENT. The rule already existed, in prose,
 * in `packages/theme/src/tokens.test.ts`:
 *
 *   `color.ink.faint` IS ONLY SAFE FOR LARGE TEXT, and this test asserting 3:1
 *   rather than 4.5:1 is the whole statement of that. […] the site footer used
 *   `ink.faint` at `type.size.micro` and put the LSS disclaimer — the one piece
 *   of text the licence requires to be legible — below AA on every page, while
 *   a comment cited *this* test as justification. The test was right; the
 *   reading of it was not.
 *
 *   The rule: anything at `type.size.base` or smaller uses `color.ink` or
 *   `color.ink.muted`.
 *
 * It came back anyway. `document.css` had `.site-footer .legal` on `ink.faint`
 * at `type.size.legal` — 11px, smaller still than the micro the incident
 * describes — on every built page, and twenty other rules had drifted the same
 * way. CI stayed green throughout, because the only mechanical statement of the
 * rule is a token-level assertion at 3:1, which is the threshold that docblock
 * exists to say is NOT the applicable one for body text.
 *
 * A rule that has now been broken twice, on the same token, in the same way, is
 * not a rule anybody is going to remember on a third pass. So this is the gate.
 *
 * WHAT IT CHECKS. A violation is a CSS rule that sets
 * `color: var(--of-color-ink-faint)` and, IN THE SAME RULE, a `font-size` from
 * {@link SMALL}. That is a deliberately narrow, syntactic test with no false
 * positives.
 *
 * THREE THINGS IT CANNOT, AND THIS LIST STARTED AT ONE. The first draft of this
 * docblock said "the ONE thing it cannot", which was the same overconfidence
 * the rule itself exists to catch — a checker whose limits are understated is
 * one somebody later mistakes for total.
 *
 * 1. IT CANNOT RESOLVE INHERITED SIZE. `.of-alias` sets the colour and no size,
 *    so whether it is a violation depends on the element it lands inside, which
 *    needs a cascade this script does not have. Those were audited by hand when
 *    this was written; a future one that drifts is not caught here.
 * 2. IT ONLY SEES `packages/components/src` AND `apps/site/ssg`. Notably absent
 *    is `scripts/build-design-system.ts`, which carries inline CSS of exactly
 *    this shape — including a `.copyright` rule at `type.size.legal` on faint,
 *    which renders the LSS attribution line. That is a committed workbench
 *    rather than the live site, so it is out of scope by choice rather than by
 *    oversight, and it is named here so the choice is visible.
 * 3. IT CANNOT SEE `&`-NESTED RULES OR THE `font:` SHORTHAND. Neither appears
 *    under either root today, so both gaps are unreachable — but they are gaps,
 *    and the day somebody writes one the gate goes quiet rather than red.
 *
 * NON-TEXTUAL USES ARE UNTOUCHED, which is the token's other legitimate job.
 * `.of-card__rarity-mark` and `.of-rarity-bar__slice` take it as a `background`
 * — a mark, not a word — and this only looks at the `color` property.
 */
import { readFileSync } from "node:fs";
import { Glob } from "bun";

/**
 * Every size that needs 4.5:1 — which is every size except the two that reach
 * WCAG's large-text threshold.
 *
 * IT STOPPED AT `base`, AND THAT WAS UNDER-INCLUSIVE. The rule in
 * `tokens.test.ts` says `ink.faint` is "for text at `type.size.large` and up",
 * so the first version of this list took that literally and let `field` (16px)
 * and `large` (18px) through. Both are NORMAL-weight body sizes and both need
 * 4.5:1: WCAG large text is 24px normal or 18.66px bold, and 18px reaches
 * neither. faint at `large` is 3.16-3.94 in dark, so the gate would have passed
 * a rule failing AA by more than a point.
 *
 * `title` (24px) and `display` are absent because they genuinely are large
 * text, and `.of-search__field::placeholder` legitimately uses faint at
 * `title` — the one place in the codebase where this token is doing the job it
 * was named for.
 */
const SMALL = ["base", "small", "micro", "legal", "field", "large"];

const ROOTS = ["packages/components/src", "apps/site/ssg"];

const FAINT = /(?<![-\w])color:\s*var\(\s*--of-color-ink-faint\s*\)/;
const SIZE = new RegExp(
  `font-size:\\s*var\\(\\s*--of-type-size-(${SMALL.join("|")})\\s*\\)`,
);
/* Selector plus body. Nested at-rules are not matched, which is correct here:
   a `@media` block's own prelude carries no declarations. */
const BLOCK = /([^{}]*)\{([^{}]*)\}/g;

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly selector: string;
  readonly size: string;
}

const violations: Violation[] = [];
let scanned = 0;

for (const root of ROOTS) {
  for (const relative of new Glob("**/*.css").scanSync(root)) {
    const file = `${root}/${relative}`;
    const source = readFileSync(file, "utf8");
    scanned += 1;

    for (const match of source.matchAll(BLOCK)) {
      const body = match[2] ?? "";
      if (!FAINT.test(body)) continue;

      const size = SIZE.exec(body);
      if (size === null) continue;

      violations.push({
        file,
        line: source.slice(0, match.index).split("\n").length,
        selector: (match[1] ?? "").split("*/").pop()?.trim() ?? "",
        size: size[1] ?? "",
      });
    }
  }
}

for (const violation of violations) {
  console.log(
    `::error file=${violation.file},line=${violation.line}::` +
      `${violation.selector} sets color.ink.faint at type.size.${violation.size}. ` +
      `Use color.ink.muted.`,
  );
}

if (violations.length > 0) {
  console.log("");
  console.log(
    "`color.ink.faint` is the LARGE-text ink, held to 3:1 rather than 4.5:1 on purpose.",
  );
  console.log(
    "Anything at `type.size.base` or smaller uses `color.ink` or `color.ink.muted`.",
  );
  console.log(
    "See the docblock in packages/theme/src/tokens.test.ts, which states the rule and",
  );
  console.log("records the two times it was broken on the LSS disclaimer.");
  process.exit(1);
}

console.log(
  `No small text on color.ink.faint — ${scanned} stylesheet(s) scanned. ✔`,
);
