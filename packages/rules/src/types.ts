/**
 * The shape of a parsed Comprehensive Rules document.
 *
 * Two properties are load-bearing:
 *
 * 1. **The numbering is LSS's, not ours.** Legend Story Studios already
 *    publishes a stable hierarchy — `1.0.`, `1.0.1.`, `1.0.1a` — and the
 *    document's own preface says so: *"The rules are presented in the form
 *    'Chapter'.'Section'.'Rule' and are referenced as such when referring to a
 *    particular rule in the current version."* Our job is to preserve it, never
 *    to invent an id of our own. {@link RuleSection.id} is that published
 *    number with a `cr:` namespace in front of it and nothing else.
 * 2. **Every section records the version it was read from.** A citation that
 *    does not say which document version produced it is not a citation. The
 *    same preface instructs readers to include the version whenever they refer
 *    to a previous version of the document, so a version stamp is the
 *    publisher's own requirement, not our embellishment.
 *
 * Nothing in this module is summarised, paraphrased or generated. Every string
 * is either an identifier derived mechanically from the document's own
 * numbering, or text copied out of the document verbatim.
 *
 * @packageDocumentation
 */

/** Namespace prefix for every Comprehensive Rules identifier. */
export const RULE_ID_NAMESPACE = "cr";

/**
 * Where a section sits in the published hierarchy.
 *
 * - `chapter` — `1`, titled "Game Concepts". Numbered `1.` on its own page.
 * - `section` — `1.0`, titled "General".
 * - `rule` — `1.0.1`, the numbered rule itself.
 * - `subrule` — `1.0.1a`, a lettered clause of a rule.
 *
 * The document contains no fifth level; a parse that produces one is a bug and
 * is reported as a {@link ParseWarning} rather than silently accepted.
 */
export type RuleLevel = "chapter" | "section" | "rule" | "subrule";

/**
 * One addressable piece of the Comprehensive Rules.
 *
 * `text`, `bullets`, `examples` and `notes` are all verbatim. Soft-wrapped
 * lines from the PDF are rejoined, and nothing else is done to them.
 */
export interface RuleSection {
  /**
   * Permanent identifier, `cr:` plus the number LSS published — `cr:1.0.1a`.
   * This is the permalink, and it is stable for as long as LSS keeps its own
   * numbering stable.
   */
  readonly id: string;
  /** The published number alone, without the namespace — `1.0.1a`. */
  readonly number: string;
  readonly level: RuleLevel;
  /**
   * The id of the section one level up, or `null` for a chapter. Derived from
   * the number, because the numbering *is* the hierarchy.
   */
  readonly parentId: string | null;
  /** Chapter this section belongs to, as an integer. */
  readonly chapter: number;
  /** Heading text. Chapters and sections have one; rules and subrules do not. */
  readonly title: string | null;
  /** The section's own prose, verbatim, soft-wraps rejoined. */
  readonly text: string;
  /** Bulleted list items belonging to this section, verbatim and in order. */
  readonly bullets: readonly string[];
  /** `Example:` paragraphs belonging to this section, verbatim, label included. */
  readonly examples: readonly string[];
  /** `Note:` paragraphs belonging to this section, verbatim, label included. */
  readonly notes: readonly string[];
  /**
   * Sections this one cites inline. The document marks cross-references as a
   * bracketed superscript — `[1.3.2a]` — and these are those, namespaced,
   * deduplicated, in the order they appear.
   */
  readonly references: readonly string[];
  /** The document version this text was read from — `2.14.0`. */
  readonly version: string;
}

/** A parsed Comprehensive Rules document. */
export interface RulesDocument {
  /** Game name, from the title page. */
  readonly game: string;
  /** Document title, from the title page. */
  readonly title: string;
  /** Version, from the title page — `2.14.0`. */
  readonly version: string;
  /** The date exactly as the title page prints it — `2026-6-10`, unpadded. */
  readonly publishedDate: string;
  /**
   * The same date zero-padded to ISO 8601 — `2026-06-10`. Padding is a
   * reformatting of a value read off the page, not a claim about anything the
   * document does not say.
   *
   * It is deliberately **not** called an effective date. The title page prints
   * a date beside the version and says nothing about when the version takes
   * effect in tournament play, so nothing here asserts that it does.
   */
  readonly publishedDateIso: string;
  /** Where the PDF was retrieved from. */
  readonly sourceUrl: string;
  /** Every chapter, section, rule and subrule, in document order. */
  readonly sections: readonly RuleSection[];
}

/** Something the parser could not account for. */
export interface ParseWarning {
  readonly kind:
    | "unclassified-paragraph"
    | "missing-parent"
    | "duplicate-id"
    | "empty-rule"
    | "unexpected-page-footer";
  /** The section the problem attaches to, when it attaches to one. */
  readonly id: string | null;
  readonly detail: string;
}

/**
 * The result of a parse.
 *
 * Warnings are returned rather than thrown so a caller can see the whole
 * picture at once, and are never empty-by-default: the tests assert that a
 * clean document produces none, so a future rules release that changes the
 * document's shape shows up as a non-empty array instead of as quietly
 * missing rules.
 */
export interface ParseResult {
  readonly document: RulesDocument;
  readonly warnings: readonly ParseWarning[];
}
