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
 * This is that rule. It began as a purpose-built scanner because the linter
 * could not parse `.svelte` or `.astro`; those files are gone, and it stays
 * purpose-built for the better reason — what it enforces is a project rule
 * rather than a general-purpose one, and no linter ships it.
 *
 * WHAT IS A VIOLATION: a hex colour, an `rgb()`/`hsl()` function, a named CSS
 * colour, or a length carrying an absolute or typographic unit, appearing in a
 * style context in component source. The sanctioned way to name a value is
 * `var(--of-*)`, via `cssValue()` from `optfall-theme`.
 *
 * WHAT IS NOT: anything inside `packages/theme`, which is where literals are
 * defined and therefore the one place they belong; zero, which has no unit and
 * no theme; `100%`/`1fr`/`auto`-style layout values, which are structural
 * rather than tonal and have nothing to consume from the token layer; and the
 * PRELUDE of an `@media` or `@container` rule, where `var()` is invalid CSS —
 * see the note beside that test for why an exemption there is a fact about the
 * language rather than a hole in the rule. The prelude is CUT from the line
 * before scanning rather than the line being skipped, so a declaration sharing
 * a line with an at-rule is still checked.
 */

import { readFileSync } from "node:fs";

import { DARK_TOKENS, LIGHT_TOKENS } from "../packages/theme/src/index";

/**
 * Directories whose component source must consume tokens.
 *
 * `apps/site/ssg` IS HERE BECAUSE IT WAS NOT, AND THAT WAS A HOLE. Phase 6's
 * generator keeps its document stylesheet beside its renderer rather than under
 * `src/`, so the first version of `ssg/document.css` — the layout, the type
 * scale, the page frame, every rule `BaseLayout.astro` used to own — sat
 * outside this check entirely while `bun run check:tokens` reported success.
 *
 * The whole point of this file is that the design system is enforcement rather
 * than intent, and a directory the enforcement does not scan is a directory
 * where it is intent again. Adding a THIRD renderer would need a third line
 * here; that is the cost of the list being explicit, and it is cheaper than a
 * glob that silently starts covering `node_modules`.
 *
 * `apps/site/src` WAS THE THIRD ENTRY and is gone with the Astro pages. What is
 * left under it is `lib/` — the corpus, the query engine, the route derivation —
 * which contains no stylesheet and never did. Leaving it listed would print
 * "0 file(s) scanned" beside two real counts, which reads like the check is
 * broken rather than like the directory is empty of styles.
 */
const SCANNED = ["packages/components/src", "apps/site/ssg"] as const;

/**
 * Paths not yet migrated, with the reason and the thing that removes them.
 *
 * A deferral here does not merely suppress failures — the check FAILS IF A
 * DEFERRED PATH IS CLEAN. An exemption that outlives its reason is how a rule
 * quietly stops applying to half the codebase, so this one has to be deleted on
 * the day it stops being needed rather than whenever somebody notices.
 */
const DEFERRED: Readonly<Record<string, string>> = {
  // Empty, and it should stay that way.
  //
  // `apps/site/src` was deferred while the Phase 0 placeholder styling stood.
  // That entry is gone because the site now consumes tokens — and the check
  // below FAILS on a deferral whose path has become clean, so removing it was
  // not optional once the styling landed. That is the mechanism working: an
  // exemption that outlives its reason is how a rule quietly stops applying to
  // half a codebase, so this one had to be deleted the day it stopped being
  // needed rather than whenever somebody noticed.
};

const NAMED_COLOURS = [
  "aqua",
  "beige",
  "black",
  "blue",
  "brown",
  "coral",
  "crimson",
  "cyan",
  "gold",
  "gray",
  "grey",
  "green",
  "indigo",
  "ivory",
  "khaki",
  "lime",
  "magenta",
  "maroon",
  "navy",
  "olive",
  "orange",
  "orchid",
  "pink",
  "plum",
  "purple",
  "red",
  "salmon",
  "sienna",
  "silver",
  "tan",
  "teal",
  "tomato",
  "violet",
  "wheat",
  "white",
  "yellow",
];

interface Violation {
  readonly file: string;
  readonly line: number;
  readonly text: string;
  readonly rule: string;
}

/**
 * The regions of a file where a literal would be a design decision — now the
 * whole file, every time.
 *
 * IT USED TO BE A `<style>`-BLOCK SCANNER, because a `.svelte` or `.astro` file
 * is markup and script as well as CSS, and a version string in markup can look
 * exactly like a length. Both renderers put their styles in separate `.css`
 * files, so there is no longer a non-style region to skip and the block-tracking
 * state machine — which had its own subtle bug about a `<style>` that opened and
 * closed on one line — is gone with the file types that needed it.
 */
function styleRegions(
  _file: string,
  source: string,
): { line: number; text: string }[] {
  /*
    BLOCK COMMENTS ARE BLANKED, NOT SKIPPED, and this is the whole of the
    function's cleverness.

    A comment is prose, and prose in this repository talks about pixels
    constantly — "a 392px row inside a 343px viewport", "the face is 450px" —
    because the arguments for the token values are made in the units the tokens
    replace. Scanning it reported those sentences as raw lengths, which is the
    check calling its own documentation a violation.

    Line-by-line stripping of `/* … *\/` only ever caught single-line comments;
    every multi-line block in the file went through unfiltered. So the pass
    below walks the source once, replacing comment CONTENT with spaces and
    leaving newlines alone — the text stops being scannable while every line
    keeps its number, which is what the error messages are addressed by.
  */
  const blanked: string[] = [];
  let inComment = false;

  for (let i = 0; i < source.length; i += 1) {
    const here = source.slice(i, i + 2);
    if (!inComment && here === "/*") {
      inComment = true;
      blanked.push("  ");
      i += 1;
      continue;
    }
    if (inComment && here === "*/") {
      inComment = false;
      blanked.push("  ");
      i += 1;
      continue;
    }
    const char = source[i] ?? "";
    blanked.push(inComment && char !== "\n" ? " " : char);
  }

  return blanked
    .join("")
    .split("\n")
    .map((text, index) => ({ line: index + 1, text }));
}

function violationsIn(file: string, source: string): Violation[] {
  const found: Violation[] = [];

  /*
   * TRUE WHILE AN AT-RULE'S CONDITION IS STILL OPEN, so a prelude that wraps is
   * exempt on every line it occupies rather than only on the one carrying the
   * `@`. The per-line regex this replaced could not see a continuation — it
   * blanked `@container bar` and then failed the build on the `44rem` sitting
   * alone on the next line, with no spelling of the query that would have
   * satisfied it.
   */
  let inPrelude = false;

  for (const { line, text } of styleRegions(file, source)) {
    const code = text.replace(/\/\*.*?\*\//g, "");
    if (
      !code.trim() ||
      code.trim().startsWith("/*") ||
      code.trim().startsWith("*")
    )
      continue;

    if (/#[0-9a-fA-F]{3,8}\b/.test(code)) {
      found.push({ file, line, text: text.trim(), rule: "raw hex colour" });
    }
    if (/\b(?:rgba?|hsla?)\s*\(/.test(code)) {
      found.push({
        file,
        line,
        text: text.trim(),
        rule: "raw colour function",
      });
    }
    /*
     * A QUERY CONDITION CANNOT CONSUME A TOKEN, AND THAT IS CSS, NOT A
     * PREFERENCE.
     *
     * `var()` is invalid in the prelude of `@media` and `@container`: the
     * condition is evaluated before custom properties are resolved, so
     * `@container bar (inline-size >= var(--of-…))` does not merely fail to
     * read the token, it fails to parse. There is no spelling of a breakpoint
     * that this rule could demand instead, which makes flagging one a demand
     * for something that cannot exist.
     *
     * SCOPED TO THE PRELUDE, AND THE PRELUDE IS CUT RATHER THAN THE LINE
     * SKIPPED. The first version tested the condition and then suppressed the
     * rule for the WHOLE line, which is a different thing on any line carrying
     * both — `@container bar (inline-size >= 44rem) { .x { padding: 12px } }`
     * walked straight through a check whose own comment promised that
     * declarations inside the block were still scanned. Removing the prelude
     * and scanning what is left keeps the promise on one line and many.
     *
     * NOT ANCHORED TO THE START OF THE LINE, and that matters for a prelude
     * that wraps. `^\s*@…[^{]*` blanks a first line that opens an at-rule and
     * then scans the CONTINUATION line unmodified — so
     * `@container bar` / `(min-inline-size: 44rem) {` fails the build on a
     * `44rem` with no spelling of the query that would satisfy it, while the
     * first line gets exactly the skip-the-whole-line treatment this comment
     * argues against. Matching the at-rule wherever it sits on the line closes
     * both halves.
     *
     * Only lengths, too: a colour has no business in a query condition, so if
     * one ever turns up there it should still fail.
     *
     * The first exemption arrived with the header's hamburger. `CardEntry.tsx`,
     * `pages/about.css` and `pages/rule.css` all record that this codebase has
     * no width breakpoints on purpose; the exemption does not change that, it
     * only stops the check from being the reason a genuinely necessary one
     * cannot be written down.
     */
    /*
     * The prelude is CUT and the rest of the line is kept, which is what makes
     * the exemption narrow: a declaration sharing a line with an at-rule —
     * `@container bar (min-inline-size: 44rem) { .x { padding: 12px } }` — is
     * still scanned, and so is every line inside the block.
     */
    let styled = code;
    if (inPrelude) {
      const opens = styled.indexOf("{");
      styled = opens === -1 ? "" : styled.slice(opens);
      inPrelude = opens === -1;
    }
    const at = styled.search(/@(?:container|media)\b/);
    if (at !== -1) {
      const opens = styled.indexOf("{", at);
      styled =
        opens === -1
          ? styled.slice(0, at)
          : styled.slice(0, at) + styled.slice(opens);
      inPrelude = opens === -1;
    }

    // Lengths that a token could have supplied. `%`, `fr`, `vh`, `vw` and
    // `auto` are deliberately absent: they express layout relationships rather
    // than design values, and the token layer has nothing to offer them.
    if (/(?:^|[\s:(,])-?\d*\.?\d+(?:px|rem|em|pt|ch)\b/.test(styled)) {
      found.push({ file, line, text: text.trim(), rule: "raw length" });
    }
    const named = new RegExp(
      `(?::|\\s)(${NAMED_COLOURS.join("|")})\\s*(?:;|\\)|$)`,
      "i",
    );
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
  return [
    ...new Bun.Glob("**/*.css").scanSync({
      cwd: dir,
      dot: false,
    }),
  ]
    .map((path) => `${dir}/${path.replaceAll("\\", "/")}`)
    .filter((path) => !/(?:^|\/)(?:node_modules|dist)\//.test(path))
    .toSorted();
}

/**
 * Every `--of-*` custom property the theme actually defines.
 *
 * THIS IS THE HALF THE LITERAL RULE CANNOT SEE, and it is the more dangerous
 * one. `var(--of-color-grond)` contains no literal, so the scan above passes it
 * happily — and CSS resolves an undefined custom property to nothing, so the
 * declaration is simply dropped. The component renders with no background, no
 * one gets an error, and the failure surfaces as "that looks a bit odd" weeks
 * later. A typo'd token is strictly worse than a hardcoded hex, which at least
 * renders what its author intended.
 */
const DEFINED = new Set(
  [...Object.keys(DARK_TOKENS), ...Object.keys(LIGHT_TOKENS)].map(
    (id) => `--of-${id.replaceAll(".", "-")}`,
  ),
);

function undefinedReferences(file: string, source: string): Violation[] {
  const found: Violation[] = [];
  source.split("\n").forEach((text, index) => {
    for (const match of text.matchAll(/var\(\s*(--of-[a-z0-9-]+)/g)) {
      const name = match[1];
      /* The pattern has one non-optional group, so this cannot be
         undefined — but the house rule asks for a guard rather than a
         justification, and a guard is cheaper to trust than a proof
         living several lines away in a regex literal. */
      if (name === undefined) continue;
      if (!DEFINED.has(name)) {
        found.push({
          file,
          line: index + 1,
          text: text.trim(),
          rule: `undefined token ${name}`,
        });
      }
    }
  });
  return found;
}

/**
 * The same dangling-reference rule, applied to token VALUES.
 *
 * A token value may itself name other tokens — `layout.page.wide` is
 * `calc(var(--of-card-face-normal) + …)`, deliberately, so the sum stays a sum
 * of things the system already committed to rather than a copy of their
 * numbers. That is the right shape and it opened a hole: `SCANNED` covers
 * `packages/components/src` and `apps/site/src` and exempts `packages/theme`,
 * so moving a `calc()` out of a stylesheet and into the token layer moved its
 * references from checked to unchecked.
 *
 * The failure that buys is the worst kind. Rename `card.face.normal` and
 * `layout.page.wide` becomes an invalid `calc()` at computed-value time, which
 * CSS discards silently — the card page loses its `max-inline-size` and renders
 * full-bleed, with no error anywhere. Exactly the argument the component-side
 * check already makes, one layer down.
 */
function danglingTokenValues(): Violation[] {
  const found: Violation[] = [];

  for (const [label, table] of [
    ["DARK_TOKENS", DARK_TOKENS],
    ["LIGHT_TOKENS", LIGHT_TOKENS],
  ] as const) {
    for (const [id, value] of Object.entries(table)) {
      if (typeof value !== "string") continue;
      for (const match of value.matchAll(/var\(\s*(--of-[a-z0-9-]+)/g)) {
        const name = match[1];
        if (name === undefined) continue;
        if (!DEFINED.has(name)) {
          found.push({
            file: "packages/theme/src/tokens.ts",
            line: 0,
            text: `${label}["${id}"] = ${value}`,
            rule: `undefined token ${name}`,
          });
        }
      }
    }
  }

  return found;
}

let failures = 0;
let staleDeferrals = 0;

for (const v of danglingTokenValues()) {
  console.log(
    `::error file=${v.file}::${v.rule} — a token value naming a token that does not exist makes the whole declaration invalid at computed-value time, and CSS drops it silently: ${v.text}`,
  );
  failures += 1;
}

for (const dir of SCANNED) {
  const files = filesUnder(dir);
  const violations = files.flatMap((file) =>
    violationsIn(file, readFileSync(file, "utf8")),
  );

  // Undefined references are NEVER deferred. A deferred path is one whose
  // literals have not been migrated yet — a legible, working state. A typo'd
  // token is a silently broken declaration in any state, so it fails wherever
  // it appears.
  const dangling = files.flatMap((file) =>
    undefinedReferences(file, readFileSync(file, "utf8")),
  );
  for (const v of dangling) {
    console.log(
      `::error file=${v.file},line=${v.line}::${v.rule} — resolves to nothing at runtime: ${v.text}`,
    );
    failures += 1;
  }

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
  console.log(
    `${dir}: ${files.length} file(s) scanned, ${violations.length} violation(s).`,
  );
}

if (failures > 0 || staleDeferrals > 0) {
  console.log("");
  console.log(
    "Components consume tokens, never literals. Use cssValue('color.ink') from optfall-theme,",
  );
  console.log(
    "or add the value to packages/theme/src/tokens.ts if the system genuinely lacks it.",
  );
  console.log(
    "See docs/PLAN.md, Phase 1 — 'Tokens are the only source of truth'.",
  );
  process.exit(1);
}

console.log("No raw colours or lengths in component source. ✔");
