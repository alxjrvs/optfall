/**
 * The join between a card's keywords and the rules that govern them.
 *
 * THIS IS THE THING NOTHING ELSE IN THE GAME HAS. `docs/PLAN.md` Phase 4 calls
 * it "Card ↔ rules cross-reference, the join nothing currently makes", and
 * `docs/SCRYFALL-GAP.md` §6 moved it forward because it is what makes a card
 * page a reference rather than a stat block: `Dominate` on the card, `cr:8.3.4`
 * beside it, one click to the text.
 *
 * AND IT SURVIVES THE NO-LANGUAGE-MODEL RULE, which is the part worth being
 * careful about. Both sides of this join are published documents, and the join
 * itself is exact string matching over a closed vocabulary extracted with one
 * regex. There is no embedding, no similarity, no judgement — a keyword either
 * matches a rule the Comprehensive Rules itself names, or it is reported as
 * unmatched. `docs/PLAN.md`: "Parsers are deterministic code whose output diffs
 * cleanly and fails loudly."
 *
 * HOW THE VOCABULARY IS EXTRACTED. Chapter 8 of the Comprehensive Rules is
 * *Keywords*. Its rules carry no titles, but the parsed text of every
 * keyword-defining rule opens with the keyword name repeated — the document
 * writes a heading and a sentence, and the parser concatenates them:
 *
 *     cr:8.3.4  "Dominate Dominate is a static ability that means …"
 *     cr:8.3.2  "Battleworn Battleworn is triggered-static ability that means …"
 *
 * So the leading phrase that immediately repeats itself IS the keyword, and
 * {@link LEADING_REPEAT} is the whole extractor. Measured against the shipped
 * corpus: 101 keyword→rule pairs.
 *
 * HOW A CARD KEYWORD IS NORMALISED. Card keywords carry operands — `Ward 10`,
 * `Arcane Barrier 2`, `Amp 1`, `Opt X` — which are parameters rather than
 * different keywords, so the trailing number or `X` is stripped. That takes 167
 * distinct strings down to 145 base forms.
 *
 * THEN ONE MORE PASS, AND IT IS THE INTERESTING ONE. 74 of those 145 do not
 * match a rule directly, and almost none of them is a miss: they are
 * *parameterised families* the rules define once and cards instantiate many
 * times — 40-odd `<Hero> Specialization`, `<Element> Fusion`, `<Element> Bond`,
 * `Essence of <X>`, `Channel <X>`. The head term of each family is a real entry
 * in the vocabulary, so resolving to it is reading the rules correctly rather
 * than approximating them. That pass takes coverage from 71/145 to 137/145.
 *
 * WHAT IS LEFT OVER IS PUBLISHED, NOT SWALLOWED. {@link keywordCoverage}
 * returns the gap as `unmatched`, and `/about` renders it, so it is a number on
 * a page rather than a silence. `docs/PLAN.md`: "A stale Optfall must look
 * stale."
 */

import { RULE_NAMESPACE, type CorpusSection, type RulesCorpus } from "./search";

/**
 * The extractor: a leading phrase that immediately repeats itself.
 *
 * Non-greedy, so `"Blade Break Blade Break is a …"` yields `Blade Break` rather
 * than stopping at `Blade`. `\b` after the backreference stops `"Amp Amplify"`
 * matching as `Amp`.
 */
const LEADING_REPEAT = /^(.+?) \1\b/;

/** Chapter 8 is Keywords. Nothing outside it defines one. */
const KEYWORD_CHAPTER = "8";

/**
 * A section's chapter and identifier, derived from its published number.
 *
 * `CorpusSection` declares `number` and not `chapter` or `id`, even though the
 * corpus JSON carries both. Deriving them here rather than widening that shared
 * contract keeps this module a consumer of the rules corpus rather than a second
 * author of its shape — and the derivations are the corpus's own conventions:
 * the chapter is the leading segment of the number, and the identifier is the
 * namespace plus the number, which is exactly what `hrefForNumber` assumes.
 */
function chapterOf(section: CorpusSection): string {
  return section.number.split(".")[0] ?? "";
}

function idOf(section: CorpusSection): string {
  return `${RULE_NAMESPACE}:${section.number}`;
}

/**
 * Families the rules define once and cards instantiate many times.
 *
 * Each entry maps a card keyword's SHAPE to the head term the Comprehensive
 * Rules actually defines. `Briar Specialization` is not a keyword the rules
 * name — `Specialization` is, and it is parameterised by a hero — so resolving
 * the former to the latter is reading the document correctly.
 *
 * Ordered, and the order matters: `essence of earth and ice` must be tested
 * against the `essence of` prefix before anything shorter could claim it.
 */
const FAMILIES: readonly { readonly test: RegExp; readonly head: string }[] = [
  { test: /\bspecialization$/, head: "specialization" },
  { test: /\bfusion$/, head: "fusion" },
  { test: /\bbond$/, head: "bond" },
  { test: /\bflow$/, head: "flow" },
  { test: /^essence of\b/, head: "essence" },
  { test: /^channel\b/, head: "channel" },
];

/** A keyword resolved to the rule that governs it. */
export interface KeywordRule {
  /** The card's own keyword string, base form — `arcane barrier`. */
  readonly keyword: string;
  /** The rule identifier — `cr:8.3.8`. */
  readonly ruleId: string;
  /** The rule's number, for the permalink — `8.3.8`. */
  readonly number: string;
  /**
   * The defining rule's text, verbatim.
   *
   * THIS IS THE REMINDER TEXT, AND CARRYING IT IS THE WHOLE POINT OF THE JOIN.
   * A card printing nothing but `Arcane Barrier 1` — and 138 cards print nothing
   * but keywords — tells a reader who already knows what Arcane Barrier is
   * exactly what they already knew. The rules define it, this module already
   * resolves the card's keyword to the paragraph that does, and until now the
   * page spent that resolution on a citation and stopped there.
   *
   * Verbatim, never composed. It is the published sentence or it is absent;
   * nothing here paraphrases a rule, and the rendering shows it as a quotation
   * of a numbered rule rather than as Optfall's own words about the card.
   */
  readonly text: string;
  /**
   * How the match was made. `direct` is an exact hit on the vocabulary;
   * `family` resolved through a parameterised head term. Reported rather than
   * hidden, because "Briar Specialization is governed by the Specialization
   * rule" is a slightly weaker claim than "Dominate is governed by the Dominate
   * rule", and a reference work should say which it is making.
   */
  readonly via: "direct" | "family";
}

/**
 * The keyword vocabulary the Comprehensive Rules publishes, keyed by lowercased
 * keyword.
 *
 * Built once from the corpus. Deterministic: same document, same table.
 */
export function buildKeywordVocabulary(
  corpus: RulesCorpus,
): ReadonlyMap<string, CorpusSection> {
  const vocabulary = new Map<string, CorpusSection>();

  for (const section of corpus.sections) {
    if (chapterOf(section) !== KEYWORD_CHAPTER) continue;
    const text = section.text;
    if (typeof text !== "string" || text === "") continue;

    const match = LEADING_REPEAT.exec(text);
    if (!match) continue;

    const keyword = (match[1] ?? "").toLowerCase().trim();
    if (keyword === "") continue;

    // FIRST DEFINITION WINS. A keyword is defined once and then elaborated by
    // its lettered subrules (`8.3.4a`, `8.3.4b`), which repeat the name. The
    // citation should be the rule that DEFINES the keyword, not the last
    // footnote that mentions it — and corpus order is document order, so the
    // first sighting is the definition.
    if (!vocabulary.has(keyword)) vocabulary.set(keyword, section);
  }

  return vocabulary;
}

/**
 * Strip a keyword's operand. `Ward 10` → `ward`, `Opt X` → `opt`.
 *
 * The operand is a parameter, not a different keyword: a card with `Ward 3` and
 * a card with `Ward 10` are both governed by the Ward rule, and indexing them
 * separately would produce two citations to the same paragraph.
 */
export function baseKeyword(keyword: string): string {
  return keyword
    .replace(/\s+(\d+|X{1,2})$/i, "")
    .toLowerCase()
    .trim();
}

/**
 * A section's text, or the empty string.
 *
 * `buildKeywordVocabulary` only admits sections whose text is a non-empty
 * string, so this cannot actually return `""` for anything in the vocabulary.
 * It is written total anyway rather than asserted, because the alternative is a
 * cast that would be load-bearing for a rendering that quotes the published
 * document — and the one failure worth designing out is quoting a rule that is
 * not there.
 */
function textOf(section: CorpusSection): string {
  const text = typeof section.text === "string" ? section.text : "";
  return withoutLeadingHeading(text);
}

/**
 * Drop the repeated heading the corpus concatenates onto a keyword's rule.
 *
 * The published document writes a HEADING and then a SENTENCE, and the PDF
 * parser joins them, so `cr:8.3.8` arrives as:
 *
 *     "Arcane Barrier Arcane Barrier is a static ability. …"
 *
 * That doubling is exactly what {@link LEADING_REPEAT} detects to build the
 * vocabulary in the first place — the extractor and this stripper are reading
 * the same artefact for opposite reasons. Rendered as-is it looks like a bug on
 * the card page, and it is not: it is a heading, printed once, that the reader
 * can already see as the keyword beside it.
 *
 * IT IS STILL VERBATIM, and the distinction matters on a page that quotes rules.
 * Nothing is reworded, summarised or joined; one duplicated heading token is
 * removed from the front, and the sentence that follows is the published one,
 * character for character. Where the pattern does not match — any rule the
 * parser did not concatenate — the text is returned untouched rather than
 * trimmed on a guess.
 */
function withoutLeadingHeading(text: string): string {
  const match = LEADING_REPEAT.exec(text);
  if (!match) return text;

  const heading = match[1] ?? "";
  if (heading === "") return text;

  return text.slice(heading.length).trimStart();
}

/** Resolve one card keyword to a rule, or `null` where the rules define none. */
export function ruleForKeyword(
  vocabulary: ReadonlyMap<string, CorpusSection>,
  keyword: string,
): KeywordRule | null {
  const base = baseKeyword(keyword);
  if (base === "") return null;

  const direct = vocabulary.get(base);
  if (direct) {
    return {
      keyword: base,
      ruleId: idOf(direct),
      number: direct.number,
      text: textOf(direct),
      via: "direct",
    };
  }

  for (const family of FAMILIES) {
    if (!family.test.test(base)) continue;
    const head = vocabulary.get(family.head);
    if (head) {
      return {
        keyword: base,
        ruleId: idOf(head),
        number: head.number,
        text: textOf(head),
        via: "family",
      };
    }
  }

  return null;
}

/** Every keyword on a card, resolved, deduplicated, in the order printed. */
export function rulesForCard(
  vocabulary: ReadonlyMap<string, CorpusSection>,
  keywords: readonly string[],
): readonly KeywordRule[] {
  const out: KeywordRule[] = [];
  const seen = new Set<string>();

  for (const keyword of keywords) {
    const resolved = ruleForKeyword(vocabulary, keyword);
    if (resolved === null || seen.has(resolved.keyword)) continue;
    seen.add(resolved.keyword);
    out.push(resolved);
  }

  return out;
}

/**
 * The coverage report — published, not swallowed.
 *
 * A join that quietly drops the keywords it cannot resolve is a join that
 * asserts completeness it does not have. This returns the number AND the list,
 * so the gap can be rendered on a page and shipped in the bulk export.
 */
export interface KeywordCoverage {
  readonly vocabularySize: number;
  readonly baseForms: number;
  readonly direct: number;
  readonly viaFamily: number;
  readonly unmatched: readonly string[];
  /** Percentage, rounded — for prose that states it rather than implies it. */
  readonly percent: number;
}

export function keywordCoverage(
  vocabulary: ReadonlyMap<string, CorpusSection>,
  allCardKeywords: readonly string[],
): KeywordCoverage {
  const baseForms = [...new Set(allCardKeywords.map(baseKeyword))]
    .filter((base) => base !== "")
    .toSorted();

  let direct = 0;
  let viaFamily = 0;
  const unmatched: string[] = [];

  for (const base of baseForms) {
    const resolved = ruleForKeyword(vocabulary, base);
    if (resolved === null) unmatched.push(base);
    else if (resolved.via === "direct") direct += 1;
    else viaFamily += 1;
  }

  const matched = direct + viaFamily;
  return {
    vocabularySize: vocabulary.size,
    baseForms: baseForms.length,
    direct,
    viaFamily,
    unmatched,
    percent:
      baseForms.length === 0
        ? 0
        : Math.round((matched / baseForms.length) * 100),
  };
}

/* -------------------------------------------------------------------------- */
/* The reverse join                                                            */
/* -------------------------------------------------------------------------- */

/** One card, as a rule page needs to link to it. */
export interface RuleCardLink {
  readonly label: string;
  readonly href: string;
  /** The card's own keyword string, so the row says why it is listed. */
  readonly keyword: string;
}

/**
 * Which cards each rule governs — the direction that makes a rules corpus worth
 * visiting.
 *
 * `docs/PLAN.md` Phase 4: "a rule knows which interactions cite it, so a change
 * tells you exactly what it invalidates." This is the card half of that, and it
 * is the same join read backwards, so the two directions cannot disagree.
 *
 * Keyed by rule NUMBER rather than id, because that is what the `/cr/` route
 * receives and matching on the thing the caller already has avoids a second
 * parse of the identifier.
 */
export function cardsByRule(
  vocabulary: ReadonlyMap<string, CorpusSection>,
  cards: readonly {
    readonly label: string;
    readonly href: string;
    readonly keywords: readonly string[];
  }[],
): ReadonlyMap<string, readonly RuleCardLink[]> {
  const index = new Map<string, RuleCardLink[]>();

  for (const card of cards) {
    const seen = new Set<string>();
    for (const keyword of card.keywords) {
      const resolved = ruleForKeyword(vocabulary, keyword);
      if (resolved === null || seen.has(resolved.number)) continue;
      seen.add(resolved.number);

      const entry = {
        label: card.label,
        href: card.href,
        keyword: resolved.keyword,
      };
      const existing = index.get(resolved.number);
      if (existing) existing.push(entry);
      else index.set(resolved.number, [entry]);
    }
  }

  return index;
}
