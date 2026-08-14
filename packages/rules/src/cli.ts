/**
 * Fetch the current Comprehensive Rules, parse it, and report what came out.
 *
 * `bun packages/rules/src/cli.ts` — prints counts, every warning, and the
 * SHA-256 of the exact bytes it read, so a claim about coverage can be checked
 * rather than believed.
 *
 * `--out <path>` additionally writes the parsed corpus as JSON. Nothing is
 * written by default: the PDF and the extracted corpus stay out of the
 * repository, and publication is a deliberate act with a reviewed diff.
 *
 * `--pdf <path>` parses a PDF already on disk instead of downloading one.
 */

import { writeFileSync } from "node:fs";

import { extractLocal, fetchComprehensiveRulesText } from "./extract";
import { parseComprehensiveRules } from "./parse";
import type { RuleLevel } from "./types";

function argumentAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const outPath = argumentAfter("--out");
const pdfPath = argumentAfter("--pdf");

const source =
  pdfPath === undefined ? await fetchComprehensiveRulesText() : null;
const text = source === null ? extractLocal(pdfPath ?? "") : source.text;

const { document, warnings } = parseComprehensiveRules(text);

const counts: Record<RuleLevel, number> = {
  chapter: 0,
  section: 0,
  rule: 0,
  subrule: 0,
};
for (const entry of document.sections) counts[entry.level] += 1;

const lines: string[] = [
  `${document.game} — ${document.title}`,
  `version ${document.version}, published ${document.publishedDate} (${document.publishedDateIso})`,
  `source ${document.sourceUrl}`,
];
if (source !== null) {
  lines.push(
    `retrieved ${String(source.download.bytes)} bytes, sha256 ${source.download.sha256}`,
    `pdf ${source.download.path}`,
  );
} else {
  lines.push(`pdf ${pdfPath ?? ""} (local)`);
}
lines.push(
  "",
  `chapters  ${String(counts.chapter)}`,
  `sections  ${String(counts.section)}`,
  `rules     ${String(counts.rule)}`,
  `subrules  ${String(counts.subrule)}`,
  `total     ${String(document.sections.length)}`,
  "",
  `warnings  ${String(warnings.length)}`,
);
for (const warning of warnings) {
  lines.push(`  [${warning.kind}] ${warning.id ?? "-"} ${warning.detail}`);
}

if (outPath !== undefined) {
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
  lines.push("", `wrote ${outPath}`);
}

process.stdout.write(`${lines.join("\n")}\n`);
process.exitCode = warnings.length === 0 ? 0 : 1;
