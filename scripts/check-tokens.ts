#!/usr/bin/env bun
/**
 * Fails the build on a raw colour or length inside component source.
 *
 * `docs/PLAN.md` Phase 1: "A lint rule fails the build on a raw hex or a raw
 * pixel value inside a component. A design system maintained by good intentions
 * is a design system that erodes the first time someone is shipping at
 * midnight; the rule is the whole difference between a language and a folder of
 * screenshots."
 *
 * This is that rule. `oxlint` cannot parse `.svelte` or `.astro`, so the check
 * is a purpose-built scanner rather than a lint plugin — which is fine, because
 * what it enforces is a project rule rather than a general-purpose one.
 *
 * WHAT IS A VIOLATION: a hex colour, an `rgb()`/`hsl()` function, a named CSS
 * colour, or a length carrying an absolute or typographic unit, appearing in a
 * style context in component source. The sanctioned way to name a value is
 * `var(--of-*)`, via `cssValue()` from `optfall-theme`.
 *
 * WHAT IS NOT: anything inside `packages/theme`, which is where literals are
 * defined and therefore the one place they belong; zero, which has no unit and
 * no theme; and `100%`/`1fr`/`auto`-style layout values, which are structural
 * rather than tonal and have nothing to consume from the token layer.
 */

import { readFileSync } from "node:fs";

/** Directories whose component source must consume tokens. */
const SCANNED = ["packages/components/src", "apps/site/src"] as const;

/**
 * Paths not yet migrated, with the reason and the thing that removes them.
 *
 * A deferral here does not merely suppress failures — the check FAILS IF A
 * DEFERRED PATH IS CLEAN. An exemption that outlives its reason is how a rule
 * quietly stops applying to half the codebase, so this one has to be deleted on
 * the day it stops being needed rather than whenever somebody notices.
 */
const DEFERRED: Readonly<Record<string, string>> = {
  "apps/site/src":
    "Phase 0 placeholder styling, marked in BaseLayout.astro for wholesale deletion. Remove this entry in the layer that rebuilds the site on the primitives.",
};

const NAMED_COLOURS = [
  "aqua", "beige", "black", "blue", "brown", "coral", "crimson", "cyan", "gold",
  "gray", "grey", "green", "indigo", "ivory", "khaki", "lime", "magenta",
  "maroon", "navy", "olive", "orange", "orchid", "pink", "plum", "purple",
  "red", "salmon", "sienna", "silver", "tan", "teal", "tomato", "violet",
  "wheat", "white", "yellow",
];

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly rule: string;
}

/**
 * The regions of a file where a literal would be a design decision.
 *
 * For `.css` that is the whole file. For `.svelte`/`.astro` it is the `<style>`
 * blocks — markup and script may legitimately contain, say, a version string
 * that looks like a length.
 */
function styleRegions(file: string, source: string): { line: number; text: string }[] {
  const lines = source.split("\n");
  if (file.endsWith(".css")) {
    return lines.map((text, index) => ({ line: index + 1, text }));
  }

  const regions: { line: number; text: string }[] = [];
  let inStyle = false;
  lines.forEach((text, index) => {
    if (/<style[\s>]/.test(text)) inStyle = true;
    else if (/<\/style>/.test(text)) inStyle = false;
    else if (inStyle) regions.push({ line: index + 1, text });
  });
  return regions;
}

function violationsIn(file: string, source: string): Violation[] {
  const found: Violation[] = [];

  for (const { line, text } of styleRegions(file, source)) {
    const code = text.replace(/\/\*.*?\*\//g, "");
    if (!code.trim() || code.trim().startsWith("/*") || code.trim().startsWith("*")) continue;

    if (/#[0-9a-fA-F]{3,8}\b/.test(code)) {
      found.push({ file, line, text: text.trim(), rule: "raw hex colour" });
    }
    if (/\b(?:rgba?|hsla?)\s*\(/.test(code)) {
      found.push({ file, line, text: text.trim(), rule: "raw colour function" });
    }
    // Lengths that a token could have supplied. `%`, `fr`, `vh`, `vw` and
    // `auto` are deliberately absent: they express layout relationships rather
    // than design values, and the token layer has nothing to offer them.
    if (/(?:^|[\s:(,])-?\d*\.?\d+(?:px|rem|em|pt|ch)\b/.test(code)) {
      found.push({ file, line, text: text.trim(), rule: "raw length" });
    }
    const named = new RegExp(`(?::|\\s)(${NAMED_COLOURS.join("|")})\\s*(?:;|\\)|$)`, "i");
    if (named.test(code)) {
      found.push({ file, line, text: text.trim(), rule: "named CSS colour" });
    }
  }

  return found;
}

/**
 * Scans the working tree rather than the index, deliberately.
 *
 * `git ls-files` would skip a component that has been written but not yet
 * committed — which is exactly the moment someone runs this to find out whether
 * their new component is clean. Being right about uncommitted work matters more
 * here than skipping build output, which the ignore list handles anyway.
 */
function filesUnder(dir: string): string[] {
  return [...new Bun.Glob("**/*.{svelte,astro,css}").scanSync({ cwd: dir, dot: false })]
    .map((path) => `${dir}/${path.replaceAll("\\", "/")}`)
    .filter((path) => !/(?:^|\/)(?:node_modules|dist|\.astro)\//.test(path))
    .toSorted();
}

let failures = 0;
let staleDeferrals = 0;

for (const dir of SCANNED) {
  const files = filesUnder(dir);
  const violations = files.flatMap((file) =>
    violationsIn(file, readFileSync(file, "utf8")),
  );
  const deferral = DEFERRED[dir];

  if (deferral) {
    if (violations.length === 0) {
      console.log(
        `::error::${dir} is now clean, so its entry in DEFERRED is stale. Delete it from scripts/check-tokens.ts — an exemption that outlives its reason is how this rule stops applying.`,
      );
      staleDeferrals += 1;
    } else {
      console.log(
        `${dir}: ${violations.length} literal(s), deferred. ${deferral}`,
      );
    }
    continue;
  }

  for (const v of violations) {
    console.log(`::error file=${v.file},line=${v.line}::${v.rule}: ${v.text}`);
    failures += 1;
  }
  console.log(`${dir}: ${files.length} file(s) scanned, ${violations.length} violation(s).`);
}

if (failures > 0 || staleDeferrals > 0) {
  console.log("");
  console.log(
    "Components consume tokens, never literals. Use cssValue('color.ink') from optfall-theme,",
  );
  console.log(
    "or add the value to packages/theme/src/tokens.ts if the system genuinely lacks it.",
  );
  console.log("See docs/PLAN.md, Phase 1 — 'Tokens are the only source of truth'.");
  process.exit(1);
}

console.log("No raw colours or lengths in component source. ✔");
