/**
 * The query grammar as an expression, rather than as a list of things that must
 * all be true.
 *
 * WHAT THIS REPLACES. `parseCardQuery` produced a flat array of filters and a
 * flat array of free terms, and `searchCards` required every one of them to
 * hold. That is a filter set, not a language: there was no way to say
 * "guardian but not an attack", no way to say "banned in CC or in Blitz", and
 * no way to group anything. `docs/SCRYFALL-GAP.md` §7 calls negation, `OR` and
 * parentheses "the three most-missed operators", and they need a tree.
 *
 * THE SHAPE. A query parses to a {@link QueryNode} — `and`, `or`, `not`, or a
 * leaf. Adjacency is `AND`, because that is what everyone means by typing two
 * words; `or` binds looser than adjacency, so `a b or c` is `(a AND b) OR c`,
 * which is how every search engine people already use behaves.
 *
 * IT IS STILL DETERMINISTIC AND STILL EXPLICABLE. No scoring, no fuzzy
 * matching, and every leaf still reports which field it looked at. What changes
 * is the *shape* of the question, never how a single field is matched — the
 * matchers are passed in by `card-search.ts` and this module never touches the
 * corpus.
 */

/** A single field restriction — the leaf the evaluator asks about. */
export interface QueryLeaf {
  readonly kind: "leaf";
  /** Which field to look at. Interpreted by the caller's matcher. */
  readonly field: string;
  /** The operand, lowercased and trimmed. */
  readonly value: string;
  /**
   * A comparison, where one was written. `cost>=3` parses to
   * `{ field: "cost", value: "3", compare: ">=" }`.
   */
  readonly compare?: ">" | ">=" | "<" | "<=" | "!=";
  /** How the leaf is described back to the reader. */
  readonly label: string;
}

export type QueryNode =
  | QueryLeaf
  | { readonly kind: "and"; readonly children: readonly QueryNode[] }
  | { readonly kind: "or"; readonly children: readonly QueryNode[] }
  | { readonly kind: "not"; readonly child: QueryNode };

/* -------------------------------------------------------------------------- */
/* Tokenising                                                                  */
/* -------------------------------------------------------------------------- */

export type Token =
  | { readonly kind: "term"; readonly value: string; readonly quoted: boolean }
  | {
      readonly kind: "field";
      readonly field: string;
      readonly value: string;
      readonly compare?: QueryLeaf["compare"];
    }
  | { readonly kind: "exact"; readonly value: string }
  | { readonly kind: "or" }
  | { readonly kind: "not" }
  | { readonly kind: "open" }
  | { readonly kind: "close" };

/**
 * Split the raw query into tokens.
 *
 * THE ORDER OF THE ALTERNATIVES IS THE WHOLE CORRECTNESS ARGUMENT, because a
 * regex alternation is first-match-wins:
 *
 * 1. `!"exact name"` and `!bare` — the exact-name operator, before anything
 *    else can claim the `!`.
 * 2. `field:"quoted operand"` — before the bare-quote case, or
 *    `type:"Illusionist Action"` splits into a junk term and a stray word. That
 *    was a real bug in the old tokeniser and its comment is worth keeping.
 * 3. `field>=value` — comparisons, before the plain `field:value` case, since
 *    `>` is not a `:`.
 * 4. `field:value`
 * 5. `"quoted phrase"`
 * 6. parentheses and bare words.
 */
const TOKEN = new RegExp(
  [
    /!(?:"([^"]*)"|([^\s()]+))/, // 1: !exact
    /([a-zA-Z][a-zA-Z-]*):"([^"]*)"/, // 2: field:"quoted"
    /([a-zA-Z][a-zA-Z-]*)\s*(>=|<=|!=|>|<)\s*([^\s()]+)/, // 3: field>=value
    /([a-zA-Z][a-zA-Z-]*):([^\s()]*)/, // 4: field:value
    /"([^"]*)"/, // 5: "phrase"
    /([()])/, // 6: parens
    /([^\s()]+)/, // 7: bare
  ]
    .map((part) => part.source)
    .join("|"),
  "g",
);

export function tokenise(raw: string): readonly Token[] {
  const out: Token[] = [];

  for (const match of raw.matchAll(TOKEN)) {
    const [
      ,
      exactQuoted,
      exactBare,
      quotedField,
      quotedValue,
      cmpField,
      cmpOp,
      cmpValue,
      plainField,
      plainValue,
      phrase,
      paren,
      bare,
    ] = match;

    if (exactQuoted !== undefined || exactBare !== undefined) {
      out.push({
        kind: "exact",
        value: (exactQuoted ?? exactBare ?? "").trim(),
      });
      continue;
    }
    if (quotedField !== undefined) {
      out.push({
        kind: "field",
        field: quotedField.toLowerCase(),
        value: (quotedValue ?? "").trim(),
      });
      continue;
    }
    if (cmpField !== undefined) {
      out.push({
        kind: "field",
        field: cmpField.toLowerCase(),
        value: (cmpValue ?? "").trim(),
        compare: cmpOp as QueryLeaf["compare"],
      });
      continue;
    }
    if (plainField !== undefined) {
      out.push({
        kind: "field",
        field: plainField.toLowerCase(),
        value: (plainValue ?? "").trim(),
      });
      continue;
    }
    if (phrase !== undefined) {
      if (phrase.trim() !== "")
        out.push({ kind: "term", value: phrase, quoted: true });
      continue;
    }
    if (paren !== undefined) {
      out.push({ kind: paren === "(" ? "open" : "close" });
      continue;
    }

    const word = bare ?? "";
    if (word === "") continue;

    // `-foo` is negation, but a bare `-` is not, and neither is a hyphen inside
    // a word — `silver-age` and `-RF` have to survive.
    //
    // THE REMAINDER IS RE-TOKENISED RATHER THAN TREATED AS A WORD, which is the
    // fix for a bug this caught: `-type:attack` reaches this branch (the
    // field alternative requires a leading letter), and emitting `type:attack`
    // as a TERM made the negation silently search for the literal text
    // "type:attack" — so `type:guardian -type:attack` returned exactly as many
    // cards as `type:guardian`. Negation has to compose with every operator,
    // not just with bare words.
    if (word.length > 1 && word.startsWith("-")) {
      const inner = tokenise(word.slice(1));
      if (inner.length > 0) {
        out.push({ kind: "not" });
        out.push(...inner);
      }
      continue;
    }
    if (/^(or|OR)$/.test(word)) {
      out.push({ kind: "or" });
      continue;
    }
    // `AND` is accepted and discarded: adjacency already means AND, and a
    // reader who types it should not get a card named "and".
    if (/^(and|AND)$/.test(word)) continue;

    out.push({ kind: "term", value: word, quoted: false });
  }

  return out;
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * How a token becomes a leaf. Supplied by the caller, because what a field
 * MEANS is the corpus's business and not the grammar's.
 *
 * Returning `null` rejects the token — an unknown operator, an operand that
 * tokenises to nothing — and the caller records why in a notice.
 */
export type LeafFactory = (token: Token) => QueryNode | null;

/**
 * Recursive-descent, three levels: OR over AND over primary.
 *
 * Deliberately not a general expression parser. The grammar has exactly two
 * binary operators, one prefix operator and one grouping construct, and a
 * hand-written descent for that is shorter than the table a generator would
 * need — and it fails in ways that can be explained to a reader, which matters
 * more here than generality.
 */
export function parse(
  tokens: readonly Token[],
  leaf: LeafFactory,
): QueryNode | null {
  let position = 0;

  const peek = (): Token | undefined => tokens[position];

  function parseOr(): QueryNode | null {
    const first = parseAnd();
    if (first === null) return null;
    const children: QueryNode[] = [first];

    while (peek()?.kind === "or") {
      position += 1;
      const next = parseAnd();
      // A trailing `or` with nothing after it is the reader mid-thought, not an
      // error worth refusing the whole query over.
      if (next === null) break;
      children.push(next);
    }

    return children.length === 1 ? children[0]! : { kind: "or", children };
  }

  function parseAnd(): QueryNode | null {
    const children: QueryNode[] = [];

    for (;;) {
      const token = peek();
      if (token === undefined || token.kind === "close" || token.kind === "or")
        break;
      const node = parsePrimary();
      if (node !== null) children.push(node);
      // parsePrimary always consumes, so this cannot spin.
    }

    if (children.length === 0) return null;
    return children.length === 1 ? children[0]! : { kind: "and", children };
  }

  function parsePrimary(): QueryNode | null {
    const token = peek();
    if (token === undefined) return null;

    if (token.kind === "not") {
      position += 1;
      const child = parsePrimary();
      return child === null ? null : { kind: "not", child };
    }

    if (token.kind === "open") {
      position += 1;
      const inner = parseOr();
      // An unclosed group is closed at the end of input rather than rejected:
      // `type:action (banned:cc` is a reader who has not finished typing, and
      // refusing it would empty the results under their cursor.
      if (peek()?.kind === "close") position += 1;
      return inner;
    }

    if (token.kind === "close") {
      // Unbalanced. Consume it so the loop above terminates.
      position += 1;
      return null;
    }

    position += 1;
    return leaf(token);
  }

  const tree = parseOr();
  return tree;
}

/* -------------------------------------------------------------------------- */
/* Evaluating                                                                  */
/* -------------------------------------------------------------------------- */

/** Whether one card satisfies one leaf. Supplied by the caller. */
export type LeafTest = (leaf: QueryLeaf, ordinal: number) => boolean;

export function evaluate(
  node: QueryNode,
  ordinal: number,
  test: LeafTest,
): boolean {
  switch (node.kind) {
    case "leaf":
      return test(node, ordinal);
    case "and":
      return node.children.every((child) => evaluate(child, ordinal, test));
    case "or":
      return node.children.some((child) => evaluate(child, ordinal, test));
    case "not":
      return !evaluate(node.child, ordinal, test);
  }
}

/** Every leaf in the tree, for describing a query back to the reader. */
export function leaves(node: QueryNode): readonly QueryLeaf[] {
  switch (node.kind) {
    case "leaf":
      return [node];
    case "not":
      return leaves(node.child);
    default:
      return node.children.flatMap(leaves);
  }
}

/**
 * Whether the tree contains anything that could restrict the corpus.
 *
 * An empty query and a query made entirely of rejected tokens are different
 * situations with the same tree, and only the first should show the browse.
 */
export function isEmpty(node: QueryNode | null): boolean {
  return node === null || leaves(node).length === 0;
}
