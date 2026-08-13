import { describe, expect, test } from "bun:test";

import { CORPUS as CARDS } from "./cards";
import { CORPUS as RULES } from "./rules";
import { INFERRED, SYMBOLS, ruleTextFor, symbolForToken } from "./card-symbols";
import { parseCardText, symbolsUsed, type Block, type Inline } from "./card-text";

const BY_NUMBER = new Map(RULES.sections.map((section) => [section.number, section]));

describe("the symbol table is the rules', not ours", () => {
  test("every symbol's rule says that symbol is that thing", () => {
    // THE ANTI-DRIFT TEST, and the reason a rendered view is defensible at all.
    //
    // `CardEntry` refused to interpret `{p}` for several phases on the grounds
    // that no published table mapped the markers to words. One does, in this
    // repository, and this test reads it: for each entry, find the cited rule
    // and require its sentence to name BOTH the word and the marker.
    //
    // So the table cannot quietly acquire a symbol the rules do not define, and
    // a CR update that renumbers or rewords 1.12.4 fails the build here rather
    // than shipping a caption that no longer matches its citation.
    for (const symbol of SYMBOLS) {
      if (INFERRED.includes(symbol.kind)) continue;

      const rule = BY_NUMBER.get(symbol.rule);
      expect(rule, `${symbol.token} cites ${symbol.rule}`).toBeDefined();

      const text = rule?.text ?? "";
      expect(text, `${symbol.rule} names ${symbol.token}`).toContain(symbol.token);
      // The CR spells defence American; the interface spells it British. The
      // citation is checked against the rules' spelling, which is the one that
      // has to be true.
      const spelled = symbol.name === "defence" ? "defense" : symbol.name;
      expect(text.toLowerCase(), `${symbol.rule} names "${spelled}"`).toContain(spelled.toLowerCase());
    }
  });

  test("the inferred symbol is the only one not in the CR's own table", () => {
    // `{x}` is flagged rather than filed with the rest: CR 1.12.2 defines the
    // LETTER X and 1.12.4 — the symbol table — does not list it. If a future CR
    // adds it, this fails and the flag comes off.
    const listed = SYMBOLS.filter((symbol) => symbol.rule.startsWith("1.12.4"));
    const flagged = SYMBOLS.filter((symbol) => INFERRED.includes(symbol.kind));

    expect(listed).toHaveLength(8);
    expect(flagged.map((symbol) => symbol.token)).toEqual(["{x}"]);
    expect(BY_NUMBER.get("1.12.2")?.text).toContain("letter X");
  });

  test("the rule text behind each symbol is really there to quote", () => {
    for (const symbol of SYMBOLS) {
      expect(ruleTextFor(symbol), symbol.token).not.toBeNull();
    }
  });
});

describe("the table covers what the corpus actually prints", () => {
  /** Every `{…}`-shaped marker upstream writes, however malformed. */
  const printed = new Map<string, number>();
  for (const card of CARDS.cards) {
    for (const match of card.functional_text.matchAll(/\{[^}\n]{0,4}\}/g)) {
      printed.set(match[0], (printed.get(match[0]) ?? 0) + 1);
    }
  }

  test("no card prints a marker the table cannot name", () => {
    // A NEW SYMBOL IN A CORPUS RE-SYNC IS A BUILD FAILURE, not a silently
    // un-rendered brace. The rendered view claims to be complete, so the thing
    // that keeps it honest has to be a test rather than a promise.
    //
    // The one exception is upstream's own typo — Reality Refractor prints
    // `{r]{r}`, a square bracket where a brace belongs — and it is allowed BY
    // NAME rather than by loosening the check to "mostly". A second entry
    // appearing here is still a failure, which is the point: that would be a
    // real symbol going unrendered, and the difference between the two cases is
    // exactly what this test is for.
    const KNOWN_TYPO = "{r]{r}";
    const unknown = [...printed.keys()].filter((token) => symbolForToken(token) === null);
    expect(unknown).toEqual([KNOWN_TYPO]);
  });

  test("the nine symbols are all used, so none is a table entry for nothing", () => {
    for (const symbol of SYMBOLS) {
      expect(printed.get(symbol.token) ?? 0, symbol.token).toBeGreaterThan(0);
    }
  });
});

/* -------------------------------------------------------------------------- */

/**
 * Re-emits the source, markers included, so the round-trip compares like with
 * like. Emphasis is re-wrapped rather than dropped: a flatten that silently
 * discarded `**` would let a parser that lost every bold run pass.
 */
function flatten(nodes: readonly Inline[]): string {
  return nodes
    .map((node) => {
      if (node.kind === "text") return node.value;
      if (node.kind === "symbol") return node.symbol.token;
      if (node.kind === "strong") return `**${flatten(node.children)}**`;
      return `*${flatten(node.children)}*`;
    })
    .join("");
}

/** The same, with emphasis markers dropped — for assertions about content. */
function plain(nodes: readonly Inline[]): string {
  return flatten(nodes).replace(/\*/g, "");
}

/**
 * Reconstructs the source from the parse.
 *
 * List items get their `- ` marker back, because a bullet marker IS the
 * structure the parser extracted — comparing without it would let a parser that
 * silently dropped every bullet line pass. Blocks are joined with `\n` and the
 * comparison normalises paragraph breaks, since one printed block can legally
 * split into a paragraph and a list.
 */
function textOf(blocks: readonly Block[]): string {
  return blocks
    .map((block) =>
      block.kind === "paragraph"
        ? flatten(block.children)
        : block.items.map((item) => `- ${flatten(item)}`).join("\n"),
    )
    .join("\n");
}

/**
 * The two normalisations the round-trip allows, stated rather than buried in a
 * regex soup at the comparison site.
 *
 * Every paragraph break collapses to a single `\n`, because one printed block
 * can legitimately split into a paragraph plus a list. And `* ` bullets are
 * compared as `- `, because the marker is structure the parser extracted and
 * upstream spells it both ways.
 *
 * Every other character has to survive exactly.
 */
function normalise(value: string): string {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/^\* +/, "- "))
    .join("\n");
}

describe("parsing card text loses nothing", () => {
  test("every card's parse round-trips to its own printed text", () => {
    // THE ONE TEST THAT MATTERS. A renderer for a reference work is only
    // trustworthy if it provably cannot drop, reorder or invent a character —
    // so the parse is flattened back to source and compared against all 4,941
    // cards, with only the list markers and the trim allowed to differ.
    const damaged: string[] = [];

    for (const card of CARDS.cards) {
      const source = card.functional_text.trim();
      if (source === "") continue;

      if (normalise(textOf(parseCardText(source))) !== normalise(source)) {
        damaged.push(card.name);
      }
    }

    expect(damaged).toEqual([]);
  });

  test("upstream's `{r]{r}` typo survives as printed", () => {
    // Reality Refractor. A permissive `\{[^}]*\}` would match `{r]{r}` whole
    // and render a typo as a symbol; requiring a single letter and a closing
    // brace leaves `{r]` as text and takes only the well-formed `{r}`.
    const parsed = parseCardText("**Action** - {r]{r}: **Attack**");
    expect(textOf(parsed)).toBe("**Action** - {r]{r}: **Attack**");
    expect(plain(parsed[0]?.kind === "paragraph" ? parsed[0].children : [])).toContain("{r]");
  });

  test("a bullet list is a list, and its `*` is not read as italic", () => {
    // Tarantula Toxin. The trap: `\*(.+?)\*` spans from the first bullet to the
    // second and turns two choices into one italic run.
    const parsed = parseCardText("Choose 1 or both;\n\n* Target attack gets +3{p}.\n* Target card gets -3{d}.");
    expect(parsed).toHaveLength(2);
    expect(parsed[1]?.kind).toBe("list");
    expect(parsed[1]?.kind === "list" && parsed[1].items).toHaveLength(2);
  });

  test("a block that mixes a lead line with bullets keeps the lead", () => {
    // Annihilator Engine. Treating a mixed block as a list drops the sentence
    // that says what the bullets are conditions ON.
    const parsed = parseCardText("If you have 1 or more Evos equipped, this gets X,\n- 2 or more, this gets Y");
    expect(parsed[0]?.kind).toBe("paragraph");
    expect(textOf(parsed)).toContain("If you have 1 or more Evos equipped");
  });

  test("a symbol inside bold is still a symbol", () => {
    // Cosmo bolds a whole ability, symbol included.
    const parsed = parseCardText("**Once per Turn Action - {r}: Attack**");
    const strong = parsed[0]?.kind === "paragraph" ? parsed[0].children[0] : null;
    expect(strong?.kind).toBe("strong");
    const inner = strong?.kind === "strong" ? strong.children : [];
    expect(inner.some((node) => node.kind === "symbol" && node.symbol.token === "{r}")).toBe(true);
  });

  test("the italic parentheticals are the only italics", () => {
    const parsed = parseCardText("*(A player may add a Helio's Mitre to their card pool.)*");
    expect(parsed[0]?.kind === "paragraph" && parsed[0].children[0]?.kind).toBe("em");
  });

  test("symbolsUsed reports each symbol once, in table order not appearance order", () => {
    // THE INPUT IS DELIBERATELY BACKWARDS. The first version of this test used
    // `{p}` then `{r}` then `{t}` — already table order — so it passed against
    // an implementation that returned APPEARANCE order and could not have
    // caught the bug it was written to catch.
    //
    // A test whose input satisfies the property by accident asserts nothing.
    const used = symbolsUsed("{t} then {r}{r} then +1{p} then +1{p}");
    expect(used.map((symbol) => symbol.token)).toEqual(["{p}", "{r}", "{t}"]);
  });
});
