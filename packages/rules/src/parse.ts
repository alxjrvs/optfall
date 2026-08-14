/**
 * The Comprehensive Rules parser.
 *
 * Input is the output of `pdftotext -layout` over
 * `https://rules.fabtcg.com/pdf/en-fab-cr.pdf`. `-layout` is not incidental:
 * it is what preserves the indentation that separates a section heading from a
 * rule from a wrapped continuation line, and it is what stops pdftotext from
 * silently welding `attack-` + `target` into `attacktarget` the way plain mode
 * does. A parser fed plain-mode text would produce subtly corrupted rules text
 * and no error.
 *
 * The whole file is deterministic string work. There is no model here, and
 * there is nowhere one could be added without it being obvious — which is the
 * point: `docs/PLAN.md` rules out LLM-assisted parsing in the document pipeline
 * exactly as much as it rules out a chat box.
 *
 * @packageDocumentation
 */

import type {
  ParseResult,
  ParseWarning,
  RuleLevel,
  RuleSection,
  RulesDocument,
} from "./types";
import { RULE_ID_NAMESPACE } from "./types";

/** Where the document was retrieved from. Verified reachable: HTTP 200. */
export const COMPREHENSIVE_RULES_URL =
  "https://rules.fabtcg.com/pdf/en-fab-cr.pdf";

/* -------------------------------------------------------------------------- */
/* Line grammar                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A chapter heading, and it only ever appears as the first line of a page:
 * `1.     Game Concepts`. Two or more spaces after the number is what
 * distinguishes it from body text; the first-line-of-page requirement is what
 * distinguishes it from the identically-shaped table of contents entry.
 */
const CHAPTER_HEADING = /^(\d+)\.[ \t]{2,}(\S.*?)[ \t]*$/;

/** A section heading, at column zero: `1.0. General`. */
const SECTION_HEADING = /^(\d+\.\d+)\.[ \t]+(\S.*?)[ \t]*$/;

/** A numbered rule, indented: `1.0.1. The rules in this document…`. */
const RULE_START = /^[ \t]*(\d+\.\d+\.\d+)\.[ \t]+(\S.*?)[ \t]*$/;

/** A lettered subrule, indented, and with no period after the letter. */
const SUBRULE_START = /^[ \t]*(\d+\.\d+\.\d+[a-z])[ \t]+(\S.*?)[ \t]*$/;

/** The running header repeated at the top of every continuation page. */
const RUNNING_HEADER =
  /^(?:CHAPTER \d+\..*|TABLE OF CONTENTS|GLOSSARY|ACKNOWLEDGMENTS|INDEX|PREFACE)[ \t]*$/;

/**
 * A centred page number at the foot of a page. The indentation requirement
 * matters: a paragraph can legitimately end on a short line, and without the
 * indent test a line of body text reading `2` would be eaten as furniture.
 * Measured across the real document, every one of the 124 numbered pages puts
 * its number at column 52 or beyond.
 */
const PAGE_FOOTER = /^[ \t]{20,}(?:\d{1,4}|[ivxlcdm]{1,8})[ \t]*$/;

/** First line of the pages that end the numbered body. */
const BACK_MATTER_HEADING = /^(?:Glossary|Acknowledgments|Index)[ \t]*$/;

/** A labelled annotation paragraph inside a rule. */
const EXAMPLE_PARAGRAPH = /^Example:/;
const NOTE_PARAGRAPH = /^Note:/;

/** A bulleted list item. */
const BULLET_PARAGRAPH = /^[•‣▪·]\s*/;

/** An inline cross-reference, printed as a bracketed superscript: `[1.3.2a]`. */
const INLINE_REFERENCE = /\[(\d+(?:\.\d+){0,2}[a-z]?)\]/g;

const TITLE_PAGE_DATE = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const TITLE_PAGE_VERSION = /^\d+\.\d+\.\d+$/;

/* -------------------------------------------------------------------------- */
/* Text assembly                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Rejoin a soft-wrapped line onto the buffer it continues.
 *
 * The one subtlety is the hyphen. This document wraps compound words across
 * lines — `attack-` / `target`, `start-of-` / `game` — and the hyphen is part
 * of the word rather than a typesetter's hyphenation mark, so those two pieces
 * join with no space between them. A line ending in a *free-standing* dash
 * (` -`) is punctuation and keeps its space. Every one of the 22 hyphen-final
 * lines in version 2.14.0 was inspected; all are one of those two cases.
 */
function joinWrapped(buffer: string, line: string): string {
  const piece = line.trim();
  if (piece === "") return buffer;
  if (buffer === "") return piece;
  if (/[^\s-]-$/.test(buffer)) return buffer + piece;
  return `${buffer} ${piece}`;
}

function extractReferences(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(INLINE_REFERENCE)) {
    const number = match[1];
    if (number === undefined) continue;
    const id = `${RULE_ID_NAMESPACE}:${number}`;
    if (seen.has(id)) continue;
    seen.add(id);
    found.push(id);
  }
  return found;
}

/**
 * The parent of a section is written on its face: `1.0.1a` belongs to `1.0.1`,
 * which belongs to `1.0`, which belongs to `1`. Deriving it rather than
 * tracking it while walking the document means a misparse cannot invent a
 * hierarchy the numbering does not support.
 */
function parentNumberOf(number: string): string | null {
  const lettered = /^(\d+\.\d+\.\d+)[a-z]$/.exec(number);
  if (lettered?.[1] !== undefined) return lettered[1];
  const lastDot = number.lastIndexOf(".");
  if (lastDot === -1) return null;
  return number.slice(0, lastDot);
}

/* -------------------------------------------------------------------------- */
/* Page handling                                                               */
/* -------------------------------------------------------------------------- */

interface Page {
  /** The page's first line, before any furniture is stripped. */
  readonly heading: string;
  /** The page's lines with the running header and the page number removed. */
  readonly lines: readonly string[];
}

function splitPages(text: string): Page[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\f")
    .map((raw) => {
      const lines = raw.split("\n");
      const heading = lines[0] ?? "";
      let last = lines.length - 1;
      while (last >= 0 && (lines[last] ?? "").trim() === "") last -= 1;
      const footer = last >= 0 && PAGE_FOOTER.test(lines[last] ?? "");
      const body = lines.slice(1, footer ? last : undefined);
      return { heading, lines: body };
    });
}

/* -------------------------------------------------------------------------- */
/* Front matter                                                                */
/* -------------------------------------------------------------------------- */

interface TitlePage {
  readonly game: string;
  readonly title: string;
  readonly publishedDate: string;
  readonly publishedDateIso: string;
  readonly version: string;
}

/**
 * Read the game, title, date and version off the document's own title page.
 *
 * Positional and strict on purpose. Hard-coding `2.14.0` would make a version
 * bump invisible; scanning loosely for *any* version-shaped string would make a
 * restructured title page produce a confident wrong stamp. Failing loudly is
 * the only option that cannot mislabel a corpus.
 */
function readTitlePage(page: Page): TitlePage {
  const lines = [page.heading, ...page.lines]
    .map((line) => line.trim())
    .filter((l) => l !== "");
  const [game, title, date, version] = lines;

  if (
    game === undefined ||
    title === undefined ||
    date === undefined ||
    version === undefined
  ) {
    throw new Error(
      `Comprehensive Rules title page has fewer than four lines of text; found ${String(lines.length)}. Refusing to guess the document version.`,
    );
  }

  const parsedDate = TITLE_PAGE_DATE.exec(date);
  if (parsedDate === null) {
    throw new Error(
      `Comprehensive Rules title page line 3 should be the publication date (YYYY-M-D); found ${JSON.stringify(date)}.`,
    );
  }
  if (!TITLE_PAGE_VERSION.test(version)) {
    throw new Error(
      `Comprehensive Rules title page line 4 should be the document version (MAJOR.MINOR.PATCH); found ${JSON.stringify(version)}.`,
    );
  }

  const [, year, month, day] = parsedDate;
  const publishedDateIso = `${year ?? ""}-${(month ?? "").padStart(2, "0")}-${(day ?? "").padStart(2, "0")}`;

  return { game, title, publishedDate: date, publishedDateIso, version };
}

/* -------------------------------------------------------------------------- */
/* The parser                                                                  */
/* -------------------------------------------------------------------------- */

interface Draft {
  number: string;
  level: RuleLevel;
  chapter: number;
  title: string | null;
  text: string;
  bullets: string[];
  examples: string[];
  notes: string[];
}

/** Which buffer the next wrapped line continues. */
type Sink = "text" | "bullet" | "example" | "note" | "none";

export interface ParseOptions {
  /** Overrides the recorded source URL. Defaults to the official PDF. */
  readonly sourceUrl?: string;
}

/**
 * Parse `pdftotext -layout` output into addressable sections.
 *
 * @param text - The extracted text of `en-fab-cr.pdf`, form feeds intact.
 * @param options - See {@link ParseOptions}.
 * @throws {Error} When the title page cannot be read, because a corpus with a
 * guessed version stamp is worse than no corpus.
 */
export function parseComprehensiveRules(
  text: string,
  options?: ParseOptions,
): ParseResult {
  const pages = splitPages(text);
  const first = pages[0];
  if (first === undefined) {
    throw new Error("Comprehensive Rules text is empty.");
  }
  const titlePage = readTitlePage(first);

  const warnings: ParseWarning[] = [];
  const drafts: Draft[] = [];

  let current: Draft | null = null;
  let sink: Sink = "none";
  let atParagraphStart = true;
  let chapter = 0;
  let inBody = false;

  for (const page of pages) {
    const heading = page.heading;
    const chapterHeading = CHAPTER_HEADING.exec(heading);

    if (chapterHeading?.[1] !== undefined && chapterHeading[2] !== undefined) {
      inBody = true;
      chapter = Number.parseInt(chapterHeading[1], 10);
      drafts.push({
        number: chapterHeading[1],
        level: "chapter",
        chapter,
        title: chapterHeading[2],
        text: "",
        bullets: [],
        examples: [],
        notes: [],
      });
      current = null;
      sink = "none";
    } else if (inBody && BACK_MATTER_HEADING.test(heading.trim())) {
      // The Glossary and Acknowledgments carry no numbering, so there is
      // nothing here to address. They end the parse rather than being guessed at.
      break;
    } else if (!inBody) {
      continue;
    } else if (!RUNNING_HEADER.test(heading.trim()) && heading.trim() !== "") {
      warnings.push({
        kind: "unclassified-paragraph",
        id: null,
        detail: `Unexpected page heading: ${JSON.stringify(heading.trim())}`,
      });
    }

    // A page break is treated as a paragraph break. In version 2.14.0 that is
    // exactly right — every body page begins on a paragraph boundary, verified
    // across all 124 numbered pages, which is why the parse emits no warnings.
    // If a future version splits a rule's sentence across a page, this reports
    // an `unclassified-paragraph` and keeps both halves rather than silently
    // welding them. The opposite default would join across the break correctly
    // and, in exchange, silently swallow a genuinely new paragraph that begins
    // at the top of a page. Loud and slightly wrong beats quiet and wrong.
    atParagraphStart = true;

    for (const line of page.lines) {
      if (line.trim() === "") {
        atParagraphStart = true;
        continue;
      }

      const section = SECTION_HEADING.exec(line);
      if (section?.[1] !== undefined && section[2] !== undefined) {
        drafts.push({
          number: section[1],
          level: "section",
          chapter,
          title: section[2],
          text: "",
          bullets: [],
          examples: [],
          notes: [],
        });
        current = null;
        sink = "none";
        atParagraphStart = true;
        continue;
      }

      const rule = RULE_START.exec(line);
      if (rule?.[1] !== undefined && rule[2] !== undefined) {
        const draft: Draft = {
          number: rule[1],
          level: "rule",
          chapter,
          title: null,
          text: rule[2],
          bullets: [],
          examples: [],
          notes: [],
        };
        drafts.push(draft);
        current = draft;
        sink = "text";
        atParagraphStart = false;
        continue;
      }

      const subrule = SUBRULE_START.exec(line);
      if (subrule?.[1] !== undefined && subrule[2] !== undefined) {
        const draft: Draft = {
          number: subrule[1],
          level: "subrule",
          chapter,
          title: null,
          text: subrule[2],
          bullets: [],
          examples: [],
          notes: [],
        };
        drafts.push(draft);
        current = draft;
        sink = "text";
        atParagraphStart = false;
        continue;
      }

      const trimmed = line.trim();

      if (current === null) {
        warnings.push({
          kind: "unclassified-paragraph",
          id: null,
          detail: `Text before any numbered section: ${JSON.stringify(trimmed.slice(0, 80))}`,
        });
        atParagraphStart = false;
        continue;
      }

      // Bullets, examples and notes are recognised wherever they begin a line,
      // not only after a blank one. In version 2.14.0 the list under rule 2.1.2
      // runs `• red` / `• yellow` / `• blue` with no blank line between the last
      // two, so a paragraph-start test alone would weld two list items into one.
      // The corresponding risk — a wrapped line that merely happens to start
      // with "Example:" — does not exist in this document: every occurrence of
      // "Example:" and of "Note:" is the first word of its paragraph.
      if (BULLET_PARAGRAPH.test(trimmed)) {
        current.bullets.push(trimmed.replace(BULLET_PARAGRAPH, ""));
        sink = "bullet";
        atParagraphStart = false;
        continue;
      }
      if (EXAMPLE_PARAGRAPH.test(trimmed)) {
        current.examples.push(trimmed);
        sink = "example";
        atParagraphStart = false;
        continue;
      }
      if (NOTE_PARAGRAPH.test(trimmed)) {
        current.notes.push(trimmed);
        sink = "note";
        atParagraphStart = false;
        continue;
      }

      if (atParagraphStart) {
        // A continuation paragraph with no label. Kept — dropping text is never
        // the safe default — but reported, because version 2.14.0 contains none,
        // so a new one means the document grew a shape this grammar does not
        // describe and somebody needs to look at it.
        warnings.push({
          kind: "unclassified-paragraph",
          id: `${RULE_ID_NAMESPACE}:${current.number}`,
          detail: `Unlabelled continuation paragraph: ${JSON.stringify(trimmed.slice(0, 80))}`,
        });
        current.text =
          current.text === "" ? trimmed : `${current.text}\n\n${trimmed}`;
        sink = "text";
        atParagraphStart = false;
        continue;
      }

      switch (sink) {
        case "text":
          current.text = joinWrapped(current.text, line);
          break;
        case "bullet":
          current.bullets[current.bullets.length - 1] = joinWrapped(
            current.bullets[current.bullets.length - 1] ?? "",
            line,
          );
          break;
        case "example":
          current.examples[current.examples.length - 1] = joinWrapped(
            current.examples[current.examples.length - 1] ?? "",
            line,
          );
          break;
        case "note":
          current.notes[current.notes.length - 1] = joinWrapped(
            current.notes[current.notes.length - 1] ?? "",
            line,
          );
          break;
        case "none":
          warnings.push({
            kind: "unclassified-paragraph",
            id: null,
            detail: `Orphan line: ${JSON.stringify(trimmed.slice(0, 80))}`,
          });
          break;
      }
    }
  }

  const sections: RuleSection[] = drafts.map((draft) => {
    const parentNumber = parentNumberOf(draft.number);
    const referenceSource = [
      draft.text,
      ...draft.bullets,
      ...draft.examples,
      ...draft.notes,
    ].join(" ");
    return {
      id: `${RULE_ID_NAMESPACE}:${draft.number}`,
      number: draft.number,
      level: draft.level,
      parentId:
        parentNumber === null ? null : `${RULE_ID_NAMESPACE}:${parentNumber}`,
      chapter: draft.chapter,
      title: draft.title,
      text: draft.text,
      bullets: draft.bullets,
      examples: draft.examples,
      notes: draft.notes,
      references: extractReferences(referenceSource),
      version: titlePage.version,
    };
  });

  const byId = new Map<string, RuleSection>();
  for (const section of sections) {
    if (byId.has(section.id)) {
      warnings.push({
        kind: "duplicate-id",
        id: section.id,
        detail: `${section.id} appears more than once. A permanent identifier that is not unique is not an identifier.`,
      });
      continue;
    }
    byId.set(section.id, section);
  }

  for (const section of sections) {
    if (section.parentId !== null && !byId.has(section.parentId)) {
      warnings.push({
        kind: "missing-parent",
        id: section.id,
        detail: `${section.id} names parent ${section.parentId}, which the document does not contain.`,
      });
    }
    if (
      (section.level === "rule" || section.level === "subrule") &&
      section.text.trim() === "" &&
      section.bullets.length === 0
    ) {
      warnings.push({
        kind: "empty-rule",
        id: section.id,
        detail: `${section.id} was captured with no text.`,
      });
    }
  }

  const document: RulesDocument = {
    game: titlePage.game,
    title: titlePage.title,
    version: titlePage.version,
    publishedDate: titlePage.publishedDate,
    publishedDateIso: titlePage.publishedDateIso,
    sourceUrl: options?.sourceUrl ?? COMPREHENSIVE_RULES_URL,
    sections,
  };

  return { document, warnings };
}

/* -------------------------------------------------------------------------- */
/* Navigating a parsed document                                                */
/* -------------------------------------------------------------------------- */

/** Index a document by id, for lookup by permalink. */
export function indexById(
  document: RulesDocument,
): ReadonlyMap<string, RuleSection> {
  return new Map(document.sections.map((section) => [section.id, section]));
}

/**
 * The section with this id, or `undefined`.
 *
 * Accepts either the namespaced form (`cr:1.0.1a`) or the bare published
 * number (`1.0.1a`), because a judge pasting a citation will type whichever
 * one is in front of them.
 */
export function sectionById(
  document: RulesDocument,
  id: string,
): RuleSection | undefined {
  const wanted = id.startsWith(`${RULE_ID_NAMESPACE}:`)
    ? id
    : `${RULE_ID_NAMESPACE}:${id}`;
  return document.sections.find((section) => section.id === wanted);
}

/** The immediate children of a section, in document order. */
export function childrenOf(
  document: RulesDocument,
  id: string,
): readonly RuleSection[] {
  const wanted = id.startsWith(`${RULE_ID_NAMESPACE}:`)
    ? id
    : `${RULE_ID_NAMESPACE}:${id}`;
  return document.sections.filter((section) => section.parentId === wanted);
}

/**
 * The ancestor chain from chapter down to the section itself, so a citation can
 * be rendered with its context — `1 › 1.0 › 1.0.1 › 1.0.1a`. Returns an empty
 * array when the id is not in the document.
 */
export function pathOf(
  document: RulesDocument,
  id: string,
): readonly RuleSection[] {
  const index = indexById(document);
  const start = sectionById(document, id);
  if (start === undefined) return [];
  const chain: RuleSection[] = [start];
  let cursor = start;
  while (cursor.parentId !== null) {
    const parent = index.get(cursor.parentId);
    if (parent === undefined) break;
    chain.unshift(parent);
    cursor = parent;
  }
  return chain;
}
