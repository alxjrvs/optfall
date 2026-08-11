#!/usr/bin/env bun
/**
 * Regenerates the committed Comprehensive Rules corpus at `data/rules/`.
 *
 * `docs/PLAN.md`, Stack: **"Data as committed JSON. Every dataset lives
 * versioned in the repo and is served as a static file — simultaneously the
 * storage layer, the public API, the backup and the audit trail."** This script
 * is the only thing that writes that file, and the file is the only thing the
 * site reads. A build that needs the network is a build that breaks when LSS is
 * down, so ingestion happens here, deliberately, with a reviewed diff — never at
 * build time.
 *
 * WHY THE FILE IS PRETTY-PRINTED. Minified it would be a third of the size and
 * completely useless: this file's *diff* is the audit trail. When LSS publishes
 * 2.15.0, the reviewable question is "which paragraphs changed", and that is a
 * question a line-oriented diff answers and a single 900 KB line does not.
 *
 * WHY THERE IS NO TIMESTAMP IN THE OUTPUT. Two runs against the same upstream
 * must produce byte-identical bytes, so that a non-empty diff means *the rules
 * changed* rather than *the tool ran again*. A `generatedAt` field would make
 * every regeneration look like a rules change and the audit trail would be
 * worthless within a month. Everything written below is a function of the
 * retrieved PDF and nothing else — no clock, no hostname, no tool version.
 *
 * WHAT PINS THE CORPUS TO THE SOURCE. The SHA-256 of the exact retrieved PDF
 * bytes, alongside the version, published date and source URL. A reader who
 * distrusts us can download the same URL, hash it, and compare — which is the
 * whole difference between a citation and an assertion. The PDF itself is *not*
 * committed: it is LSS's copyrighted document, and the hash is what makes
 * committing it unnecessary.
 *
 * USAGE
 *
 *   bun run corpus:rules                  # fetch upstream, write data/rules/cr-<version>.json
 *   bun run corpus:rules -- --check       # regenerate and fail on any drift; writes nothing
 *   bun run corpus:rules -- --pdf a.pdf   # parse a PDF already on disk instead of fetching
 *   bun run corpus:rules -- --out p.json  # write somewhere other than the version-derived path
 *   bun run corpus:rules -- --allow-warnings
 *
 * A parse that produces warnings does **not** write by default. `optfall-rules`
 * returns warnings rather than throwing precisely so the whole picture is
 * visible at once, and a warning means the document's shape moved under the
 * parser — publishing a corpus we already know is incomplete is the one failure
 * mode this project cannot afford. `--allow-warnings` exists for the case where
 * a human has read them and decided.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  downloadComprehensiveRules,
  extractLocal,
  pdfToText,
} from "../packages/rules/src/extract";
import { COMPREHENSIVE_RULES_URL, parseComprehensiveRules } from "../packages/rules/src/parse";
import type { RuleLevel, RuleSection, RulesDocument } from "../packages/rules/src/types";

/**
 * Format of the envelope around the parsed document.
 *
 * Bumped only when the *shape* changes, so a consumer can refuse a file it does
 * not understand instead of silently reading a field that moved.
 */
const SCHEMA_VERSION = 1;

/** Where committed corpora live, relative to the repository root. */
const CORPUS_DIRECTORY = "data/rules";

/**
 * The repository root, derived from this file rather than from the cwd, so the
 * corpus lands in the same place no matter where the script is invoked from.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** How many sections of each level the document produced. */
interface LevelCounts extends Record<RuleLevel, number> {
  readonly total: number;
}

/** Provenance of the exact bytes this corpus was read from. */
interface CorpusSource {
  /** Where the PDF was retrieved from. */
  readonly url: string;
  /** Size of the retrieved PDF in bytes. */
  readonly bytes: number;
  /**
   * SHA-256 of the retrieved PDF, lowercase hex. Re-download `url`, hash it,
   * and compare: that is how a reader verifies this corpus against the source
   * without trusting us.
   */
  readonly sha256: string;
}

/**
 * The committed file's shape.
 *
 * A **superset** of {@link RulesDocument}, deliberately: a consumer that only
 * wants the document can type the parsed JSON as `RulesDocument` and ignore the
 * rest, and structural typing makes that free.
 */
interface RulesCorpus extends RulesDocument {
  readonly schemaVersion: number;
  readonly source: CorpusSource;
  readonly counts: LevelCounts;
}

function argumentAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

/**
 * Copy one section into the committed shape, field by field.
 *
 * Explicit rather than a pass-through, and the annotation is the point: the
 * committed file's key order is a decision made here, not an accident of the
 * parser's object literal, so a refactor over there cannot silently reorder
 * 1,278 records and produce a diff that looks like a rules change. Because the
 * result is annotated `RuleSection`, a new required field in the parser is a
 * type error here rather than a field quietly missing from the corpus.
 */
function toCorpusSection(section: RuleSection): RuleSection {
  const copy: RuleSection = {
    id: section.id,
    number: section.number,
    level: section.level,
    parentId: section.parentId,
    chapter: section.chapter,
    title: section.title,
    text: section.text,
    bullets: section.bullets,
    examples: section.examples,
    notes: section.notes,
    references: section.references,
    version: section.version,
  };
  return copy;
}

function countLevels(sections: readonly RuleSection[]): LevelCounts {
  let chapter = 0;
  let section = 0;
  let rule = 0;
  let subrule = 0;
  for (const entry of sections) {
    if (entry.level === "chapter") chapter += 1;
    else if (entry.level === "section") section += 1;
    else if (entry.level === "rule") rule += 1;
    else subrule += 1;
  }
  return { chapter, section, rule, subrule, total: sections.length };
}

/**
 * Serialise the corpus.
 *
 * Two-space indent and a trailing newline — POSIX-text, `git diff`-shaped, and
 * identical to what every other JSON file in the tree looks like.
 */
function serialise(corpus: RulesCorpus): string {
  return `${JSON.stringify(corpus, null, 2)}\n`;
}

/** First line at which two texts differ, 1-indexed, or `null` if they match. */
function firstDifferingLine(a: string, b: string): number | null {
  const left = a.split("\n");
  const right = b.split("\n");
  const limit = Math.max(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index + 1;
  }
  return null;
}

const checkOnly = hasFlag("--check");
const allowWarnings = hasFlag("--allow-warnings");
const pdfPath = argumentAfter("--pdf");
const outOverride = argumentAfter("--out");

const log: string[] = [];

// ---------------------------------------------------------------------------
// Retrieve. The hash is of the PDF bytes either way — a local file is hashed
// exactly as a downloaded one is, so `--pdf` produces a corpus indistinguishable
// from a fetched one when the bytes are the same.
// ---------------------------------------------------------------------------

let source: CorpusSource;
let text: string;

if (pdfPath === undefined) {
  const download = await downloadComprehensiveRules();
  source = { url: download.url, bytes: download.bytes, sha256: download.sha256 };
  text = pdfToText(download.path);
  log.push(`retrieved ${source.url}`);
} else {
  const bytes = readFileSync(pdfPath);
  source = {
    // A local file still records the canonical URL: the corpus describes which
    // document this is, not which filesystem it happened to be sitting on.
    url: COMPREHENSIVE_RULES_URL,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  text = extractLocal(pdfPath);
  log.push(`read ${pdfPath} (local)`);
}

// ---------------------------------------------------------------------------
// Parse.
// ---------------------------------------------------------------------------

const { document, warnings } = parseComprehensiveRules(text);
const counts = countLevels(document.sections);

log.push(
  `${document.game} — ${document.title}`,
  `version ${document.version}, published ${document.publishedDate} (${document.publishedDateIso})`,
  `sha256 ${source.sha256} (${String(source.bytes)} bytes)`,
  "",
  `chapters  ${String(counts.chapter)}`,
  `sections  ${String(counts.section)}`,
  `rules     ${String(counts.rule)}`,
  `subrules  ${String(counts.subrule)}`,
  `total     ${String(counts.total)}`,
  "",
  `warnings  ${String(warnings.length)}`,
);
for (const warning of warnings) {
  log.push(`  [${warning.kind}] ${warning.id ?? "-"} ${warning.detail}`);
}

if (warnings.length > 0 && !allowWarnings) {
  log.push(
    "",
    "Refusing to write a corpus the parser could not fully account for.",
    "Fix packages/rules, or pass --allow-warnings once a human has read the list.",
  );
  process.stdout.write(`${log.join("\n")}\n`);
  process.exitCode = 1;
} else {
  // -------------------------------------------------------------------------
  // Assemble. Metadata first so the head of the file answers "which document is
  // this?" without scrolling, then the sections, which are the bulk.
  // -------------------------------------------------------------------------

  const corpus: RulesCorpus = {
    schemaVersion: SCHEMA_VERSION,
    game: document.game,
    title: document.title,
    version: document.version,
    publishedDate: document.publishedDate,
    publishedDateIso: document.publishedDateIso,
    sourceUrl: document.sourceUrl,
    source,
    counts,
    sections: document.sections.map(toCorpusSection),
  };

  const serialised = serialise(corpus);
  const outPath =
    outOverride ?? join(ROOT, CORPUS_DIRECTORY, `cr-${document.version}.json`);
  const shown = relative(ROOT, outPath) || outPath;

  if (checkOnly) {
    let committed: string | null = null;
    try {
      committed = readFileSync(outPath, "utf8");
    } catch {
      committed = null;
    }

    if (committed === null) {
      log.push("", `MISSING ${shown} — run \`bun run corpus:rules\` and commit the result.`);
      process.exitCode = 1;
    } else if (committed === serialised) {
      log.push("", `up to date  ${shown} (${String(serialised.length)} bytes)`);
    } else {
      const line = firstDifferingLine(committed, serialised);
      log.push(
        "",
        `DRIFT ${shown} — the committed corpus does not match this source.`,
        line === null ? "  (differs in trailing content)" : `  first difference at line ${String(line)}`,
        "  Run `bun run corpus:rules` and review the diff: it is the rules changelog.",
      );
      process.exitCode = 1;
    }
  } else {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, serialised, "utf8");
    log.push("", `wrote ${shown} (${String(serialised.length)} bytes)`);
  }

  process.stdout.write(`${log.join("\n")}\n`);
}
