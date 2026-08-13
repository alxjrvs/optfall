/**
 * Printed card text, parsed into something renderable.
 *
 * THE GRAMMAR IS SMALL AND IT WAS MEASURED, NOT ASSUMED. A full scan of all
 * 4,941 cards finds exactly this and nothing else:
 *
 *   - `**bold**`            5,659 — never spans a newline, occasionally nests a symbol
 *   - `{x}` symbols         3,803 — nine distinct markers, see `card-symbols.ts`
 *   - `\n\n`                3,948 — paragraph separator
 *   - `- ` / `* ` bullets     154 — line-leading, inside a paragraph block
 *   - `\n`                    141 — line break, only ever inside a bullet block
 *   - `*(…)*` italic            2 — both limited-format parentheticals
 *
 * No links, no headings, no code spans, no tables, no HTML, no `[…]` brackets
 * (zero occurrences), no `***both***`, no underscores, and two non-ASCII
 * characters in the whole corpus, both on Potion of Déjà Vu. So this is a
 * hand-written parser over a closed grammar rather than a markdown library:
 * a general markdown parser would bring rules this text never uses, and each
 * one is a way to render something upstream did not write.
 *
 * TWO TRAPS, both real, both caught by tests:
 *
 * 1. `*` IS AMBIGUOUS. It is a bullet marker on three cards and an italic
 *    delimiter on two, and a naive `\*(.+?)\*` chews straight across a bullet
 *    list — it turns Tarantula Toxin's two choices into one italic run. Bullets
 *    are therefore resolved at BLOCK level, before any inline pass runs, so the
 *    inline pass never sees a line-leading `*`.
 *
 * 2. UPSTREAM HAS A TYPO AND IT MUST NOT PROPAGATE. Reality Refractor prints
 *    `{r]{r}` — a square bracket where a brace belongs. The symbol pattern
 *    requires a closing brace, so `{r]` simply does not match and survives as
 *    the literal text upstream published. That is the correct degradation for a
 *    reference work: show what is printed, do not repair it, do not drop it.
 */
import { SYMBOLS, symbolForToken, type GameSymbol } from "./card-symbols";

/* -------------------------------------------------------------------------- */
/* The shape                                                                   */
/* -------------------------------------------------------------------------- */

export type Inline =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "symbol"; readonly symbol: GameSymbol }
  /** Emphasis carries children because upstream nests symbols inside bold. */
  | { readonly kind: "strong"; readonly children: readonly Inline[] }
  | { readonly kind: "em"; readonly children: readonly Inline[] };

export type Block =
  | { readonly kind: "paragraph"; readonly children: readonly Inline[] }
  | { readonly kind: "list"; readonly items: readonly (readonly Inline[])[] };

/* -------------------------------------------------------------------------- */
/* Inline                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `\{[a-z]\}` — a single lower-case letter in braces, and nothing looser.
 *
 * Deliberately not `\{[^}]*\}`. A permissive pattern would match `{r]{r}`'s
 * tail as `{r}` and silently render half a typo as a symbol, and would match
 * any future multi-character marker as one of the nine we know — which is the
 * exact failure mode this whole module exists to avoid. An unrecognised marker
 * falls through to `symbolForToken` returning null and is printed verbatim.
 */
const SYMBOL = /\{[a-z]\}/g;

/** `**…**`, non-greedy, and never across a newline: 0 bold runs span one. */
const STRONG = /\*\*([^*\n]+)\*\*/;

/**
 * `*(…)*` — italic, and ONLY in its parenthetical form.
 *
 * Both genuine italics in the corpus are limited-format notes wrapped this way
 * (`*(A player may add a Helio's Mitre to their card pool…)*`). Requiring the
 * parenthesis is what makes this safe: a bare `\*…\*` is the pattern that eats
 * bullet lists, and there is no card that needs it.
 */
const EM = /\*(\([^*\n]+\))\*/;

/** Splits a run of plain text into text and symbol nodes. */
function withSymbols(source: string): readonly Inline[] {
  const out: Inline[] = [];
  let at = 0;
  SYMBOL.lastIndex = 0;

  for (let m = SYMBOL.exec(source); m !== null; m = SYMBOL.exec(source)) {
    const symbol = symbolForToken(m[0]);
    // An unknown `{q}` is text. Nothing is dropped and nothing is guessed at.
    if (symbol === null) continue;
    if (m.index > at) out.push({ kind: "text", value: source.slice(at, m.index) });
    out.push({ kind: "symbol", symbol });
    at = m.index + m[0].length;
  }

  if (at < source.length) out.push({ kind: "text", value: source.slice(at) });
  return out;
}

/**
 * One line of card text, as a tree.
 *
 * Emphasis is found first and recursed into, because `**Once per Turn Action** -
 * {r}: **Attack**` puts a symbol between two bold runs and Cosmo's text puts one
 * inside a bold run. Bold before italic, because `**` would otherwise be read as
 * two adjacent italic delimiters.
 */
export function parseInline(source: string): readonly Inline[] {
  if (source === "") return [];

  for (const [pattern, kind] of [
    [STRONG, "strong"],
    [EM, "em"],
  ] as const) {
    const m = pattern.exec(source);
    if (m === null) continue;
    const inner = m[1] ?? "";
    return [
      ...parseInline(source.slice(0, m.index)),
      { kind, children: parseInline(inner) },
      ...parseInline(source.slice(m.index + m[0].length)),
    ];
  }

  return withSymbols(source);
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                      */
/* -------------------------------------------------------------------------- */

/** Line-leading `- ` or `* `. Both spellings occur; neither is more correct. */
const BULLET = /^[-*] +/;

/**
 * Card text as blocks.
 *
 * A block is a `\n\n`-separated run, and within one, CONSECUTIVE LINES ARE
 * GROUPED BY WHETHER THEY ARE BULLETS. A run of bullets becomes a list; a run
 * of anything else becomes a paragraph keeping its line breaks.
 *
 * THE GROUPING IS THE WHOLE DESIGN, and the first two attempts were both wrong
 * in ways the round-trip test caught on real cards:
 *
 *   - Treating a block as a list when ANY line is a bullet drops the lead.
 *     Annihilator Engine opens "If you have 1 or more Evos equipped, this gets
 *     X," and then lists the conditions — the sentence saying what the bullets
 *     are conditions ON would have vanished.
 *
 *   - Treating it as a list only when EVERY line is a bullet fails the opposite
 *     way, and it fails on 32 cards. Pummel, Razor Reflex, Wax and Wane and Up
 *     the Ante all print "Choose 1;" and their options in ONE block separated by
 *     single newlines, so the whole thing stayed a paragraph and the reader got
 *     literal hyphens where a list belonged.
 *
 * Grouping serves both, and nothing is ever discarded to make a shape tidier.
 */
export function parseCardText(source: string): readonly Block[] {
  const trimmed = source.trim();
  if (trimmed === "") return [];

  return trimmed.split(/\n{2,}/).flatMap((block): Block[] => {
    const out: Block[] = [];
    let run: string[] = [];
    let inList = false;

    const flush = (): void => {
      if (run.length === 0) return;
      out.push(
        inList
          ? { kind: "list", items: run.map((line) => parseInline(line.replace(BULLET, ""))) }
          : { kind: "paragraph", children: parseInline(run.join("\n")) },
      );
      run = [];
    };

    for (const line of block.split("\n")) {
      const bullet = BULLET.test(line);
      if (bullet !== inList) {
        flush();
        inList = bullet;
      }
      run.push(line);
    }
    flush();

    return out;
  });
}

/**
 * Every symbol this card uses, in the order `SYMBOLS` lists them.
 *
 * Drives the per-card legend: a card page lists the symbols ON THAT CARD with
 * the rule that defines each, rather than printing a nine-row table on all
 * 4,941 pages. A legend for symbols a reader is not looking at is furniture.
 *
 * A STABLE ORDER RATHER THAN APPEARANCE ORDER, so the legend on one card is
 * comparable with the legend on the next — a reader who has learnt where the
 * resource row sits should find it in the same place. This filtered the table
 * from the start in the doc comment and did not in the code: it returned `Map`
 * insertion order, which is first-appearance order, so a card printing `{t}`
 * before `{p}` listed them in that order under a comment promising otherwise.
 */
export function symbolsUsed(source: string): readonly GameSymbol[] {
  const seen = new Set<string>();
  for (const match of source.matchAll(SYMBOL)) {
    const symbol = symbolForToken(match[0]);
    if (symbol !== null) seen.add(symbol.token);
  }
  return SYMBOLS.filter((symbol) => seen.has(symbol.token));
}
