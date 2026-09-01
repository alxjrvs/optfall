/**
 * Assert that every built HTML page carries the Legend Story Studios
 * disclaimer, verbatim.
 *
 *   bun scripts/check-disclaimer.ts [output-directory] [--verbose]
 *
 * This is the check `docs/COMPLIANCE.md` §4 names as an enforcement point. It
 * is the one that catches what review does not: a well-meaning reflow, an
 * editor autocorrecting `®` or `™`, a page rendered outside the shared layout,
 * or a component that splits the sentence across elements.
 *
 * The expected text comes from `docs/DISCLAIMER.md`, never from the site
 * source — checking the build against a constant the build itself imports
 * would only prove the build is self-consistent.
 *
 * Empty output is a FAILURE, not a vacuous pass. "No pages, therefore no page
 * is missing the disclaimer" is exactly how this check would rot into
 * decoration.
 */
import { existsSync, readFileSync } from "node:fs";
import {
  readCanonicalDisclaimer,
  normalizeHtmlWhitespace,
} from "./canonical-disclaimer";

const args = process.argv.slice(2);

/**
 * `--verbose` restores the full page listing.
 *
 * WITHOUT IT THIS CHECK PRINTED 12,779 LINES ON SUCCESS, because the listing
 * sat above the pass/fail branch and ran unconditionally. A passing check that
 * costs more to read than most failures is one an agent learns to scroll past,
 * and scrolling past a compliance check is the habit this file exists to
 * prevent. The count still prints; the enumeration is now something you ask
 * for.
 */
const verbose = args.includes("--verbose");
const outputDirectory =
  args.find((arg) => !arg.startsWith("--")) ?? "apps/site/dist";

/**
 * How many failing pages get their own `::error` line.
 *
 * The failures this check catches are systemic by construction — a layout that
 * lost the disclaimer, a formatter that reflowed it — so the realistic failure
 * is every page at once, and the first line already carries the whole
 * diagnosis. Twelve thousand identical annotations bury it rather than
 * reinforce it.
 */
const MAX_REPORTED = 10;

const expected = readCanonicalDisclaimer();

if (!existsSync(outputDirectory)) {
  console.log(
    `::error::Output directory ${outputDirectory} does not exist. Run \`bun run build\` first — a missing build is a failure here, not a pass.`,
  );
  process.exit(1);
}

const pages = [...new Bun.Glob("**/*.html").scanSync({ cwd: outputDirectory })]
  .map((path) => path.replaceAll("\\", "/"))
  .toSorted();

if (pages.length === 0) {
  console.log(
    `::error::No HTML pages found under ${outputDirectory}. Run the site build first; an empty output directory is a failure here, not a pass.`,
  );
  process.exit(1);
}

const missing: string[] = [];

for (const page of pages) {
  const file = `${outputDirectory}/${page}`;
  const html = readFileSync(file, "utf8");

  // Byte-exact first. Whitespace-normalised second: a page that carries the
  // right characters but has had the sentence re-wrapped by a formatter is
  // still a compliance failure, but it is a different one and deserves a
  // different message.
  if (html.includes(expected)) continue;
  if (verbose || missing.length < MAX_REPORTED) {
    if (normalizeHtmlWhitespace(html).includes(expected)) {
      console.log(
        `::error file=${file}::${file} contains the disclaimer only after whitespace normalisation — it has been reflowed or split across elements. Render it as one text node.`,
      );
    } else {
      console.log(
        `::error file=${file}::${file} does not contain the required disclaimer.`,
      );
    }
  }
  missing.push(page);
}

if (!verbose && missing.length > MAX_REPORTED) {
  console.log(
    `::error::…and ${missing.length - MAX_REPORTED} more page(s) with the same failure. Re-run with --verbose to annotate every one.`,
  );
}

console.log(`Checked ${pages.length} built page(s) under ${outputDirectory}.`);
if (verbose) for (const page of pages) console.log(`  ${page}`);

if (missing.length === 0) {
  console.log(
    "Every page carries the Legend Story Studios disclaimer, verbatim. ✔",
  );
  process.exit(0);
}

console.log("");
console.log(
  'The expected text, from docs/DISCLAIMER.md ("Required disclaimer"):',
);
console.log(`  ${expected}`);
console.log("");
console.log(
  "See docs/COMPLIANCE.md §4. The disclaimer is a condition of the permission the whole project stands on, and the only permitted variation from LSS's template is the application name — already substituted.",
);
process.exit(1);
