/**
 * The Comprehensive Rules corpus, shaped once for the ~1,278 pages that serve
 * it.
 *
 * `docs/PLAN.md` Phase 4: **the permalink is the product.** A judge pasting
 * `cr:8.3.4b` into Discord instead of describing which paragraph they mean is
 * the unprompted-share moment the whole phase is built for, so everything in
 * this module exists to make one URL per published section cheap enough that
 * generating all of them statically is unremarkable.
 *
 * FOUR DECISIONS WORTH THE WORDS.
 *
 * **The identifier is LSS's, never ours.** `packages/rules` preserves the
 * publisher's own numbering — `1.`, `1.0.`, `1.0.1`, `1.0.1a` — and this module
 * preserves it a second time by using it as the URL. `/cr/1.0.1a` is a citation
 * that is already legible to anyone holding the PDF, which is the property that
 * makes it worth pasting. Inventing a slug here would have thrown that away.
 *
 * **The corpus is read at build time and never at runtime.** It is imported as
 * committed JSON, so the whole document is resolved by the bundler, baked into
 * static HTML, and nothing ships to a browser. `docs/PLAN.md`, "Static by
 * default": no backend means no uptime story to fail.
 *
 * **The shaping is one pass, not one pass per page.** `optfall-rules` exports
 * `pathOf`, `childrenOf` and `sectionById`, and every one of them is a linear
 * scan — correct for a caller holding a single id, quadratic across a build
 * that renders every section. So the maps below are built once at module load
 * and `RULE_PAGES` is materialised from them. The helper functions are not
 * wrong; they are the wrong shape for this caller.
 *
 * **Nothing here composes prose.** `docs/PLAN.md`, "Rules that hold across
 * every phase": no language model, and every string served traces to a parsed
 * official document. The two functions at the bottom that build a `<title>` and
 * a `<meta name="description">` assemble *fixed labels* around *verbatim text*
 * and nothing else. The description may be truncated — a preview card has a
 * budget — and where it is, it says so with an ellipsis. The page body is never
 * truncated, never reflowed and never reworded.
 *
 * The types are imported from `packages/rules` by relative path rather than by
 * package name, because `optfall-rules` is a build-time tool that the site does
 * not depend on at runtime and should not acquire a dependency edge to. The
 * import is `import type`, so it is erased before the bundler ever sees it —
 * what it buys is that a field added to, removed from, or renamed in
 * {@link RuleSection} breaks *this* build rather than silently rendering a page
 * with a hole in it.
 */

import type {
  RuleLevel,
  RuleSection,
  RulesDocument,
} from "../../../../packages/rules/src/types";

import corpus from "../../../../data/rules/cr-2.14.0.json";

export type { RuleLevel, RuleSection };

/* -------------------------------------------------------------------------- */
/* The corpus                                                                  */
/* -------------------------------------------------------------------------- */

/** Provenance of the PDF the corpus was parsed out of. */
export interface CorpusSource {
  /** Canonical URL the document was retrieved from. */
  readonly url: string;
  /** Size of the retrieved PDF, in bytes. */
  readonly bytes: number;
  /**
   * SHA-256 of the retrieved PDF bytes — not of anything Optfall produced.
   *
   * It is on the page for one reason: a reader who does not trust us can
   * download the same URL, hash it, and compare. That is what makes the
   * citation auditable rather than merely assertive, which is the entire
   * positioning in `docs/PLAN.md`, "The thesis".
   */
  readonly sha256: string;
}

/** How many of each level the document contains. */
export type CorpusCounts = Readonly<Record<RuleLevel | "total", number>>;

/**
 * The committed corpus: a {@link RulesDocument} plus the provenance the build
 * script recorded alongside it.
 */
export interface RulesCorpus extends RulesDocument {
  readonly schemaVersion: number;
  readonly source: CorpusSource;
  readonly counts: CorpusCounts;
}

/**
 * The cast is unavoidable and it is narrow. TypeScript types an imported JSON
 * module structurally and widens every string literal, so `level` arrives as
 * `string` rather than as {@link RuleLevel}. The shape is asserted by the
 * generator (`scripts/build-rules-corpus.ts` annotates each record as a
 * `RuleSection` before writing it) and by `--check`, which regenerates and
 * byte-compares — so the guarantee lives where the file is written rather than
 * where it is read.
 */
export const CORPUS = corpus as unknown as RulesCorpus;

/* -------------------------------------------------------------------------- */
/* Addressing                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The permalink for a section — `/cr/1.0.1a`.
 *
 * Built from `number` rather than from `id`, so the namespace prefix stays out
 * of the URL: `cr:` is already carried by the `/cr/` path segment, and
 * `/cr/cr:1.0.1a` would be a worse thing to paste. The rendered citation still
 * shows the namespaced form, because that is the form a judge types.
 */
export function permalinkFor(section: RuleSection): string {
  return `/cr/${section.number}`;
}

/** Human label for a level, used where the page says what kind of thing it is. */
export const LEVEL_LABEL: Readonly<Record<RuleLevel, string>> = {
  chapter: "Chapter",
  section: "Section",
  rule: "Rule",
  subrule: "Subrule",
};

/* -------------------------------------------------------------------------- */
/* One pass over the document                                                  */
/* -------------------------------------------------------------------------- */

const BY_ID: ReadonlyMap<string, RuleSection> = new Map(
  CORPUS.sections.map((section) => [section.id, section]),
);

const CHILDREN: ReadonlyMap<string, readonly RuleSection[]> = (() => {
  const children = new Map<string, RuleSection[]>();
  for (const section of CORPUS.sections) {
    if (section.parentId === null) continue;
    const siblings = children.get(section.parentId);
    if (siblings === undefined) {
      children.set(section.parentId, [section]);
    } else {
      siblings.push(section);
    }
  }
  return children;
})();

/**
 * The chain from the chapter down to — but NOT including — the section itself.
 *
 * The walk is bounded by the number of sections rather than trusting the
 * hierarchy to terminate. A cycle in `parentId` would be a parser bug, and the
 * honest failure mode for a parser bug is a short breadcrumb, not a build that
 * hangs while emitting 1,278 pages.
 */
function ancestorsOf(section: RuleSection): readonly RuleSection[] {
  const chain: RuleSection[] = [];
  let cursor: RuleSection | undefined = section;
  for (let hops = 0; hops < CORPUS.sections.length; hops += 1) {
    const parentId: string | null = cursor?.parentId ?? null;
    if (parentId === null) break;
    const parent = BY_ID.get(parentId);
    if (parent === undefined) break;
    chain.unshift(parent);
    cursor = parent;
  }
  return chain;
}

/**
 * An inline cross-reference — the document's own bracketed superscripts, such
 * as `[1.3.2a]`, namespaced by the parser.
 *
 * `target` is `null` when the referenced id is not in this document. Every one
 * of the 371 references in 2.14.0 resolves today, and the page renders an
 * unresolvable one as plain text rather than as a link, because a citation that
 * leads to a 404 is worse than one that leads nowhere visibly.
 */
export interface RuleReference {
  readonly id: string;
  readonly target: RuleSection | null;
}

/**
 * Everything one permalink page needs, assembled once.
 *
 * `previous` and `next` are document order — the order LSS prints — so the
 * corpus can be *read* as well as searched. A reference work you can only enter
 * by search is a lookup table; one you can walk is a book.
 */
export interface RulePage {
  readonly section: RuleSection;
  /** Chapter first, immediate parent last. Empty for a chapter. */
  readonly ancestors: readonly RuleSection[];
  /** Immediate children, in document order. */
  readonly children: readonly RuleSection[];
  /** Inline cross-references, in the order the document makes them. */
  readonly references: readonly RuleReference[];
  readonly previous: RuleSection | null;
  readonly next: RuleSection | null;
  /** 1-based position in document order, for "N of 1,278". */
  readonly ordinal: number;
}

/** Every page the `/cr/` route emits, in document order. */
export const RULE_PAGES: readonly RulePage[] = CORPUS.sections.map(
  (section, index) => ({
    section,
    ancestors: ancestorsOf(section),
    children: CHILDREN.get(section.id) ?? [],
    references: section.references.map((id) => ({
      id,
      target: BY_ID.get(id) ?? null,
    })),
    previous: CORPUS.sections[index - 1] ?? null,
    next: CORPUS.sections[index + 1] ?? null,
    ordinal: index + 1,
  }),
);

/* -------------------------------------------------------------------------- */
/* What a pasted link says about itself                                        */
/* -------------------------------------------------------------------------- */

/**
 * Longest description a preview card will show before it truncates for us.
 *
 * Truncating here rather than letting Discord do it is the difference between
 * an ellipsis at a word boundary and a sentence cut mid-word.
 */
const DESCRIPTION_BUDGET = 200;

/**
 * Cut at the last word boundary inside the budget and mark the cut.
 *
 * The ellipsis is not decoration: it is the page telling the reader that what
 * they are looking at is not the whole rule. The full text is always on the
 * page itself, verbatim and uncut.
 */
function truncateAtWord(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const clipped = text.slice(0, budget);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * The `<title>`, which is the headline of the preview card in Discord.
 *
 * Identifier first, because the identifier is what the link is *about* and a
 * preview card truncates from the right.
 */
export function titleFor(page: RulePage): string {
  const { section } = page;
  const named =
    section.title === null ? section.id : `${section.id} ${section.title}`;
  return `${named} · Comprehensive Rules ${section.version} · Optfall`;
}

/**
 * The `<meta name="description">`, which is the body of that preview card.
 *
 * Chapters and sections carry no prose of their own in the published document,
 * so theirs is built from the level, the number and the title — three values
 * read off the page — rather than from a summary of what they contain. Rules
 * and subrules get their own text, verbatim, truncated only if it exceeds the
 * budget.
 */
export function descriptionFor(page: RulePage): string {
  const { section } = page;
  if (section.text.trim() !== "") {
    return truncateAtWord(section.text, DESCRIPTION_BUDGET);
  }
  const label = LEVEL_LABEL[section.level];
  const named = section.title === null ? "" : ` — ${section.title}`;
  return `${label} ${section.number}${named}. Flesh and Blood Comprehensive Rules ${section.version}.`;
}
