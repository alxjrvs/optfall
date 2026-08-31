/**
 * Getting the Comprehensive Rules PDF and turning it into text.
 *
 * Deliberately separate from {@link ../parse.ts | the parser} and deliberately
 * **not** re-exported from the package entry point. The parser is pure and runs
 * anywhere; this module touches the network and shells out to `pdftotext`, and
 * a browser consumer must not pull it in by accident.
 *
 * Neither the PDF nor the extracted corpus is committed. `docs/PLAN.md` wants
 * ingestion to run as a scheduled job that opens a pull request, not as a blob
 * in the tree, so this fetches on demand into a temporary directory.
 *
 * Zero runtime dependencies still holds: `node:crypto`, `node:child_process`,
 * `node:fs` and `node:os` are platform builtins, not packages.
 *
 * @packageDocumentation
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { COMPREHENSIVE_RULES_URL } from "./parse";

export { COMPREHENSIVE_RULES_URL };

/** What a download produced, so a caller can pin or audit it. */
export interface DownloadedDocument {
  readonly url: string;
  readonly path: string;
  readonly bytes: number;
  /** SHA-256 of the retrieved bytes — the only honest way to say "this exact document". */
  readonly sha256: string;
}

/**
 * Download the Comprehensive Rules PDF.
 *
 * `rules.fabtcg.com` serves it without complaint. `fabtcg.com` — a different
 * host — returns 403 to automated requests; that blocker is real and does not
 * apply here, and conflating the two is what previously had this work recorded
 * as blocked (see `docs/PHASE-2-REPORT.md`).
 *
 * @param directory - Where to write the file. A fresh temp directory by default.
 * @throws {Error} On any non-200 response, rather than parsing an error page.
 */
export async function downloadComprehensiveRules(
  directory?: string,
  url: string = COMPREHENSIVE_RULES_URL,
): Promise<DownloadedDocument> {
  const target = directory ?? mkdtempSync(join(tmpdir(), "optfall-rules-"));
  const path = join(target, "en-fab-cr.pdf");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Fetching ${url} returned HTTP ${String(response.status)} ${response.statusText}. Not writing a file; an error page is not the rules.`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  writeFileSync(path, bytes);

  return {
    url,
    path,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/**
 * Run `pdftotext -layout` and return the extracted text.
 *
 * `-layout` is mandatory, not a preference. Plain mode discards the indentation
 * that tells a section heading from a rule from a wrapped line, and it drops
 * the hyphen out of compound words broken across lines — `attack-target`
 * arrives as `attacktarget`. Both failures are silent, which is the worst kind
 * for a corpus whose entire claim is being correct.
 *
 * @throws {Error} When `pdftotext` is missing or exits non-zero.
 */
export function pdfToText(pdfPath: string): string {
  const result = spawnSync("pdftotext", ["-layout", pdfPath, "-"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.error !== undefined) {
    throw new Error(
      `Could not run pdftotext (${result.error.message}). It ships with poppler; install it and retry.`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `pdftotext exited ${String(result.status)} on ${pdfPath}: ${result.stderr.trim()}`,
    );
  }
  return result.stdout;
}

/** Extract text from a PDF already on disk. */
export function extractLocal(pdfPath: string): string {
  readFileSync(pdfPath); // fail early and clearly if the path is wrong
  return pdfToText(pdfPath);
}

/** Download the current Comprehensive Rules and return its extracted text. */
export async function fetchComprehensiveRulesText(): Promise<{
  readonly download: DownloadedDocument;
  readonly text: string;
}> {
  const download = await downloadComprehensiveRules();
  return { download, text: pdfToText(download.path) };
}
