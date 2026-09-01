/**
 * The canonical Legend Story Studios disclaimer, read from `docs/DISCLAIMER.md`.
 *
 * `docs/DISCLAIMER.md` ("Required disclaimer") is the specification, so this
 * module reads the string out of it rather than restating it. Nothing here retypes the
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
import { repoFile } from "./lib/root";

/**
 * Where the specification lives, relative to the repository root.
 *
 * This was `docs/PLAN.md` until that file was retired. A legally load-bearing
 * specification living inside a roadmap is what made an ordinary prose edit
 * able to change it, so it now has a file whose only job is to be this.
 */
const DISCLAIMER_PATH = repoFile("docs/DISCLAIMER.md");

const HEADING = "### Required disclaimer";

/**
 * The shortest string that could be the whole disclaimer.
 *
 * The real one is 241 characters. This is deliberately well below that rather
 * than exact — the requirement is LSS's and could legitimately be reworded, and
 * a threshold that has to move on every wording change is one somebody edits
 * without reading. It only has to be far enough above a truncation to catch it:
 * the first sentence alone is 58 characters.
 */
const MINIMUM_LENGTH = 120;

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
 * Extract the disclaimer from the text of `docs/DISCLAIMER.md`.
 *
 * Throws rather than returning a fallback: a missing section means the
 * specification moved, and a checker that quietly compares against `""` would
 * pass on every page in the site.
 *
 * THE PARTIAL CASE IS THE DANGEROUS ONE, and it is why {@link MINIMUM_LENGTH}
 * exists. A blank line inside the blockquote ends the loop below early, and the
 * result is a PREFIX of the real disclaimer — which is still present, in full,
 * on every built page. So `check-disclaimer.ts` would find it and pass, having
 * silently narrowed what it checks for. An empty result fails loudly; a
 * truncated one did not, until this threshold was added.
 */
export function canonicalDisclaimer(disclaimerMarkdown: string): string {
  const lines = disclaimerMarkdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === HEADING);
  if (start === -1) {
    throw new Error(
      `${DISCLAIMER_PATH} has no "${HEADING}" section — the disclaimer specification moved, and every check that reads it is now blind.`,
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
      `${DISCLAIMER_PATH}'s "${HEADING}" section contains no blockquote — the disclaimer must stay a blockquote, since that is what identifies it.`,
    );
  }

  const disclaimer = normalizeProse(quoted.join("\n"));

  if (disclaimer.length < MINIMUM_LENGTH) {
    throw new Error(
      `${DISCLAIMER_PATH}'s "${HEADING}" blockquote extracted to ${disclaimer.length} characters, below the ${MINIMUM_LENGTH} a complete disclaimer runs to. A blank line inside the blockquote ends extraction early, and the truncation would still be found on every built page — so this fails here rather than passing everywhere. Received: ${JSON.stringify(disclaimer)}`,
    );
  }

  return disclaimer;
}

/** Read and extract in one step, for callers running from the repository root. */
export function readCanonicalDisclaimer(
  disclaimerPath: string = DISCLAIMER_PATH,
): string {
  return canonicalDisclaimer(readFileSync(disclaimerPath, "utf8"));
}

if (import.meta.main) {
  process.stdout.write(readCanonicalDisclaimer());
  process.stdout.write("\n");
}
