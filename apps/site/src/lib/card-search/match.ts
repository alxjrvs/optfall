import type { QueryLeaf, QueryNode } from "../query";
import type { CardIndex } from "./decode";
import type { CardFilter } from "./grammar";
import { tokeniseCard } from "./tokenise";

/* -------------------------------------------------------------------------- */
/* Matching                                                                    */
/* -------------------------------------------------------------------------- */

/** Whole word, or a word beginning with the term. Never inside a word. */
export function tokensMatch(tokens: readonly string[], term: string): boolean {
  return tokens.some((token) => token === term || token.startsWith(term));
}

export function valuesMatch(values: readonly string[], term: string): boolean {
  return values.some((value) => {
    const lower = value.toLowerCase();
    return lower === term || tokensMatch(tokeniseCard(value), term);
  });
}

/** `""` is the printed blank; it is matched by `none`, never by the empty string. */
function statMatches(printed: string, wanted: string): boolean {
  if (wanted === "none") return printed === "";
  return printed.toLowerCase() === wanted;
}

/**
 * Whether one card satisfies one filter.
 *
 * `text` is deliberately absent from this switch and is asserted against below:
 * it is the only filter answered by the inverted index rather than by a scan,
 * so resolving it per card would redo a postings walk 4,941 times per keystroke.
 * `searchCards` in `./rank` resolves each text filter to a set once and tests
 * membership. A `text` filter reaching here would be a routing bug, and it
 * throws rather than quietly answering `false` — a silent `false` on a filter
 * returns an empty result set, which reads exactly like "no cards match".
 */
export function passesFilter(
  index: CardIndex,
  ordinal: number,
  filter: CardFilter,
): boolean {
  const [cost = "", power = "", defence = ""] = index.stats[ordinal] ?? [];
  switch (filter.field) {
    case "text":
      throw new Error(
        "apps/site/src/lib/card-search/match.ts: a text filter reached passesFilter. Text filters are resolved through the postings index in searchCards; see the note above this function.",
      );
    case "name":
      return tokensMatch(index.labelTokens[ordinal] ?? [], filter.value);
    case "type":
      return tokensMatch(index.typeTokens[ordinal] ?? [], filter.value);
    case "trait":
      return valuesMatch(index.traits[ordinal] ?? [], filter.value);
    case "keyword":
      return valuesMatch(index.keywords[ordinal] ?? [], filter.value);
    case "artist":
      return valuesMatch(index.artists[ordinal] ?? [], filter.value);
    case "set":
      return (index.sets[ordinal] ?? []).some(
        (code) => code.toLowerCase() === filter.value,
      );
    case "rarity":
      return (index.rarities[ordinal] ?? []).some(
        (code) => code.toLowerCase() === filter.value,
      );
    case "pitch":
      return filter.value === "none"
        ? index.pitches[ordinal] === 0
        : String(index.pitches[ordinal] ?? 0) === filter.value;
    case "cost":
      return statMatches(cost, filter.value);
    case "power":
      return statMatches(power, filter.value);
    case "defence":
      return statMatches(defence, filter.value);
    case "state": {
      const masks = index.verdicts[ordinal] ?? [];
      const mask = masks[filter.formatIndex ?? 0] ?? 0;
      return (mask & (filter.bit ?? 0)) !== 0;
    }
    default:
      return false;
  }
}

/**
 * A printed stat compared against a number.
 *
 * ONLY NUMERIC VALUES TAKE PART, and that is the honest reading rather than a
 * limitation. 4,941 printed costs include `X`, `XX`, `X1` and the empty string;
 * those have no place in an order, so `cost>=3` does not match them. The old
 * engine refused comparisons outright for this reason — a stated partial order
 * is strictly better than no answer, and the notice says which one is being
 * given.
 */
export function comparePrinted(
  index: CardIndex,
  ordinal: number,
  leaf: QueryLeaf,
): boolean {
  const [cost = "", power = "", defence = ""] = index.stats[ordinal] ?? [];
  const at = (which: string) =>
    which === "cost" ? cost : which === "power" ? power : defence;

  const printed = at(leaf.field);
  if (!/^\d+$/.test(printed)) return false;

  /*
    A `@`-prefixed value names another printed field on the SAME card rather
    than a literal — `power>defence`. Both sides have to be numeric, for the
    reason the one-sided case already gives: a card printing X has no place in
    an order, and answering as though it were zero would be inventing a fact.
  */
  const other = leaf.value.startsWith("@") ? at(leaf.value.slice(1)) : null;
  if (other !== null && !/^\d+$/.test(other)) return false;

  const actual = Number(printed);
  const wanted = other === null ? Number(leaf.value) : Number(other);
  switch (leaf.compare) {
    case ">":
      return actual > wanted;
    case ">=":
      return actual >= wanted;
    case "<":
      return actual < wanted;
    case "<=":
      return actual <= wanted;
    case "!=":
      return actual !== wanted;
    default:
      return actual === wanted;
  }
}

/**
 * The free words that are being asked FOR, ignoring any under a negation.
 *
 * Ranking says which field put a card on the page, and a term the reader
 * excluded did not put it anywhere — ranking `guardian -attack` by "attack"
 * would report the reason a card was nearly rejected.
 */
export function positiveFreeTerms(
  node: QueryNode,
  negated = false,
): readonly string[] {
  switch (node.kind) {
    case "leaf":
      return !negated && node.field === "any" ? [node.value] : [];
    case "not":
      return positiveFreeTerms(node.child, !negated);
    default:
      return node.children.flatMap((child) =>
        positiveFreeTerms(child, negated),
      );
  }
}

/**
 * The one set the whole query is restricted to, or `null`.
 *
 * Walks the tree the way {@link positiveFreeTerms} does and for the same
 * reason: a set named under a `not` is one the reader excluded, and treating it
 * as the set they are looking at would be reading the query backwards.
 *
 * ANY AMBIGUITY ANSWERS `null`. Two distinct codes cannot both be "the set",
 * and this decides which picture every row carries — so the failure mode of
 * guessing is a grid where an unknown fraction of the art is from a set the
 * reader did not name, with nothing on the page to say which. Returning `null`
 * falls back to each card's own face, which is what the page showed before this
 * existed and is never a claim about a set.
 *
 * AN `or` IS NOT SPECIAL-CASED, AND THE REASON IS NARROWER THAN IT LOOKS.
 * `set:mst or set:wtr` yields two codes and is rejected by the count. `set:mst
 * or pitch:1` yields one code while not actually restricting to it, so the name
 * `setFocusOf` overstates what has been established — every row gets the
 * Mistveil art where the card has one, including rows that are on the page
 * because of their pitch and have nothing to do with Mistveil.
 *
 * That is accepted rather than overlooked, and the property that makes it safe
 * is NOT "those rows keep their own face" — they do not. It is that the art has
 * to be in `arts` to be chosen at all, and `arts` holds only faces of THAT
 * card. So the worst case is a card shown by a real printing of itself from a
 * set the reader named in half of a disjunction. Nothing false is rendered; the
 * picture is merely chosen by a clause that is not why the row matched.
 *
 * Tightening it would mean asking which BRANCH of the `or` each row satisfied,
 * which is a per-row question this function is not given the results to answer.
 * If that ever matters, the fix is to resolve the focus per row during
 * evaluation rather than to make this walk cleverer.
 */
export function setFocusOf(node: QueryNode): string | null {
  const codes = new Set<string>();

  const walk = (current: QueryNode, under: boolean): void => {
    switch (current.kind) {
      case "leaf":
        if (!under && current.field === "set") codes.add(current.value);
        return;
      case "not":
        walk(current.child, !under);
        return;
      default:
        for (const child of current.children) walk(child, under);
    }
  };

  /* The root is never under a negation; `walk` carries that state downwards.
     This took a `negated` parameter for symmetry with `positiveFreeTerms`, and
     no caller ever passed it — an argument nobody supplies is a claim about
     flexibility this function does not have. */
  walk(node, false);
  return codes.size === 1 ? ([...codes][0] ?? null) : null;
}

/** Cards whose flavour text contains the term, whole word or by prefix. */
export function flavourMatches(
  index: CardIndex,
  term: string,
): ReadonlySet<number> {
  const out = new Set<number>();
  for (const candidate of index.flavourTerms) {
    if (candidate !== term && !candidate.startsWith(term)) continue;
    for (const ordinal of index.flavourPostings.get(candidate) ?? [])
      out.add(ordinal);
  }
  return out;
}

/** Cards whose printed text contains the term, whole word or by prefix. */
export function textMatches(
  index: CardIndex,
  term: string,
): ReadonlySet<number> {
  const out = new Set<number>();
  for (const candidate of index.terms) {
    if (candidate !== term && !candidate.startsWith(term)) continue;
    for (const ordinal of index.postings.get(candidate) ?? []) out.add(ordinal);
  }
  return out;
}
