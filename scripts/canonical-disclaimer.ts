/**
 * The canonical Legend Story Studios disclaimer, read from `docs/PLAN.md`.
 *
 * `docs/PLAN.md` ("Required disclaimer") is the specification, so this module
 * reads the string out of it rather than restating it. Nothing here retypes the
 * text — a copy that can be edited independently is exactly the failure mode
 * `docs/COMPLIANCE.md` §4 is written to prevent.
 *
 * Two consumers:
 *
 *   scripts/canonical-disclaimer.test.ts   the exported site constant, README
 *                                          and COMPLIANCE.md all still agree
 *   scripts/check-disclaimer.ts            every built HTML page carries it
 *
 * Run directly to print it:  `bun scripts/canonical-disclaimer.ts`
 */
import { readFileSync } from "node:fs";

/** Where the specification lives, relative to the repository root. */
const PLAN_PATH = "docs/PLAN.md";

const HEADING = "### Required disclaimer";

/**
 * Markdown prose with its blockquote markers removed and every run of
 * whitespace collapsed to a single space.
 *
 * Line wrapping is not significant to the requirement — the character sequence
 * is — so both sides of every comparison in this project are normalised the
 * same way. That is what lets `README.md`'s hard-wrapped paragraph and the
 * site's single-line constant be compared at all.
 */
export function normalizeProse(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*>\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The same whitespace collapsing, WITHOUT the blockquote stripping.
 *
 * {@link normalizeProse} removes a leading `>` from every line, which is right
 * for a Markdown blockquote and wrong for HTML — where a line may legitimately
 * begin with the `>` that closes a tag spread over several lines. Applying the
 * Markdown normaliser to built pages silently deletes that character before
 * comparing, so a genuinely absent disclaimer could be reported as "reflowed or
 * split across elements": the wrong diagnosis, sending someone to look at
 * layout when the text is simply missing.
 *
 * It cannot cause a false PASS — `check-disclaimer.ts` decides pass and fail on
 * a byte-exact comparison and uses this only to choose the error message — but
 * a checker that misdiagnoses is a checker people stop trusting.
 */
export function normalizeHtmlWhitespace(html: string): string {
  return html.replace(/\s+/g, " ").trim();
}

/**
 * Extract the disclaimer from the text of `docs/PLAN.md`.
 *
 * Throws rather than returning a fallback: a missing section means the
 * specification moved, and a checker that quietly compares against `""` would
 * pass on every page in the site.
 */
export function canonicalDisclaimer(planMarkdown: string): string {
  const lines = planMarkdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === HEADING);
  if (start === -1) {
    throw new Error(
      `${PLAN_PATH} has no "${HEADING}" section — the disclaimer specification moved, and every check that reads it is now blind.`,
    );
  }

  const quoted: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "") {
      // Blank lines before the blockquote are fine; a blank line after it ends
      // the section.
      if (quoted.length > 0) break;
      continue;
    }
    if (!line.startsWith(">")) break;
    quoted.push(line);
  }

  if (quoted.length === 0) {
    throw new Error(
      `${PLAN_PATH}'s "${HEADING}" section contains no blockquote — the disclaimer must stay a blockquote, since that is what identifies it.`,
    );
  }

  return normalizeProse(quoted.join("\n"));
}

/** Read and extract in one step, for callers running from the repository root. */
export function readCanonicalDisclaimer(planPath: string = PLAN_PATH): string {
  return canonicalDisclaimer(readFileSync(planPath, "utf8"));
}

if (import.meta.main) {
  process.stdout.write(readCanonicalDisclaimer());
  process.stdout.write("\n");
}
