/**
 * The game's printed symbols — `{p}`, `{r}`, `{d}` — and what each one means.
 *
 * THIS TABLE IS NOT OURS. `CardEntry` carried a note for several phases saying
 * the printed text is "reproduced, not interpreted", because "Optfall has no
 * published table mapping those markers to words — so substituting any would be
 * inventing a vocabulary and calling it the card's text".
 *
 * That was true of the CARD corpus and false of the repository as a whole. The
 * Comprehensive Rules — already committed here, already parsed, already the
 * thing every keyword on a card page cites — defines all of them, by name, in
 * one consecutive block:
 *
 *   1.12.4a  The defense symbol is {d} and represents a defense value.
 *   1.12.4b  The intellect symbol is {i} and represents an intellect value.
 *   1.12.4c  The life symbol is {h} and represents a life value.
 *   1.12.4d  The power symbol is {p} and represents a power value.
 *   1.12.4e  The resource symbol is {r} and represents a resource value.
 *   1.12.4f  The chi symbol is {c} and represents a chi value.
 *   1.12.4g  The tap symbol is {t} and represents the tap effect.
 *   1.12.4h  The untap symbol is {u} and represents a untap effect.
 *
 * So the rendered view is not an interpretation. It is a JOIN — the same join
 * the card page already makes between a keyword and the rule that governs it,
 * applied to the notation instead of the vocabulary. Every symbol Optfall draws
 * carries the rule that says what it is, and `card-symbols.test.ts` reads those
 * rules out of the corpus and fails if this table stops matching them.
 *
 * WHICH IS WHY BOTH VIEWS EXIST rather than the rendered one replacing the raw.
 * A join is a claim, and a reference work should let you see the thing it was
 * derived from. "Raw text" is upstream's bytes, unaltered.
 */
import { CORPUS as RULES } from "./rules";
import MANIFEST from "../../../../data/symbols/symbols.json";

/**
 * Upstream's single-letter filename key, back to our own kind.
 *
 * The manifest is keyed by LSS's letter (`d`) and this table by our word
 * (`defence`), and the two differ in one place on purpose: the CR spells the
 * stat "defense" and every label on this site is British. Mapping the key
 * rather than renaming either side keeps that divergence in the one place it is
 * already documented.
 */
const KIND_BY_KEY: Readonly<Record<string, SymbolKind>> = {
  p: "power",
  r: "resource",
  d: "defence",
  h: "life",
  i: "intellect",
  c: "chi",
  t: "tap",
  u: "untap",
};

/**
 * A symbol the Comprehensive Rules names.
 *
 * `kind` doubles as the silhouette in `GameSymbol` and `StatGlyph`, which is
 * the point of it being one union: the plate a reader meets inline in `+1{p}`
 * is the same plate carrying `4` in the stat block, so the notation is legible
 * from the stat block without a legend.
 */
export type SymbolKind =
  | "power"
  | "resource"
  | "defence"
  | "life"
  | "intellect"
  | "chi"
  | "tap"
  | "untap"
  | "x";

export interface GameSymbol {
  /** The raw marker as upstream writes it, braces included. */
  readonly token: string;
  readonly kind: SymbolKind;
  /** The letter struck on the plate — upstream's own, never a nicer one. */
  readonly letter: string;
  /**
   * What the rules call it. Taken from the CR sentence, not chosen here.
   *
   * `defense` is the one deliberate divergence: the CR spells it American and
   * every label on this site is British, so the interface says "defence" while
   * the citation beside it still reads the rule verbatim. The word is ours; the
   * claim is not.
   */
  readonly name: string;
  /** The rule that defines it. Rendered as a link on every card page. */
  readonly rule: string;
  /**
   * Whether the symbol stands for a VALUE or an EFFECT.
   *
   * The CR draws this line itself — `{d}` "represents a defense value", `{t}`
   * "represents the tap effect" — and it is the difference between a symbol
   * that can appear in a stat block and one that can only appear in a verb. It
   * is why tap and untap are cut differently from the six value plates.
   */
  readonly sense: "value" | "effect";
}

/**
 * `{x}` IS THE ONE SYMBOL THE TABLE AT 1.12.4 DOES NOT LIST, and it is marked
 * rather than quietly filed with the others.
 *
 * It appears 3 times on 2 cards, always in a cost run — `{x}{x}{r}` on
 * Beckoning Haunt, `{x}, {t}` on Touch of Reality. CR 1.12.2 defines the letter
 * X ("a value that starts undefined and is defined later by a rule or effect"),
 * which is plainly what it means here, but 1.12.2 is about the LETTER and does
 * not name a symbol. So this entry cites the rule that covers the meaning and
 * is flagged `inferred`, and the card page says so where it appears.
 *
 * A reference work that silently rounds a nine-item list up from an eight-item
 * source is a reference work you cannot check.
 */
export const INFERRED: readonly SymbolKind[] = ["x"];

export const SYMBOLS: readonly GameSymbol[] = [
  { token: "{p}", kind: "power", letter: "P", name: "power", rule: "1.12.4d", sense: "value" },
  { token: "{r}", kind: "resource", letter: "R", name: "resource", rule: "1.12.4e", sense: "value" },
  { token: "{d}", kind: "defence", letter: "D", name: "defence", rule: "1.12.4a", sense: "value" },
  { token: "{h}", kind: "life", letter: "H", name: "life", rule: "1.12.4c", sense: "value" },
  { token: "{i}", kind: "intellect", letter: "I", name: "intellect", rule: "1.12.4b", sense: "value" },
  { token: "{c}", kind: "chi", letter: "C", name: "chi", rule: "1.12.4f", sense: "value" },
  { token: "{t}", kind: "tap", letter: "T", name: "tap", rule: "1.12.4g", sense: "effect" },
  { token: "{u}", kind: "untap", letter: "U", name: "untap", rule: "1.12.4h", sense: "effect" },
  { token: "{x}", kind: "x", letter: "X", name: "X", rule: "1.12.2", sense: "value" },
];

const BY_TOKEN = new Map(SYMBOLS.map((symbol) => [symbol.token, symbol]));
const BY_KIND = new Map(SYMBOLS.map((symbol) => [symbol.kind, symbol]));

export function symbolForToken(token: string): GameSymbol | null {
  return BY_TOKEN.get(token) ?? null;
}

export function symbolForKind(kind: SymbolKind): GameSymbol {
  const found = BY_KIND.get(kind);
  /* istanbul ignore next -- the map is built from the same closed union */
  if (found === undefined) throw new Error(`no symbol for ${kind}`);
  return found;
}

/**
 * THE PRINTED ARTWORK FOR A SYMBOL, WHERE LEGEND STORY STUDIOS PUBLISHES ONE.
 *
 * Optfall drew its own plates for these until now, and the plates were honest —
 * every shape ours, every colour a token, nothing borrowed. They were also a
 * private notation. A reader meets `{p}` mid-sentence in "this gets +4{p}",
 * with no label anywhere near it; a shape they have to learn is a shape that
 * sends them to a legend, and the symbol on the card in their hand is the one
 * they already know. Rendering the game's notation in a dialect of our own was
 * asking them to translate twice.
 *
 * So these are the real files, ingested from LSS's own rules site — the same
 * document this table takes its rule numbers from, where the symbols are
 * published as part of the RULES rather than as part of a brand kit. That
 * distinction is the whole compliance argument and it is not a technicality:
 * `docs/COMPLIANCE.md` §3 bars logos, set logos and close semblances of them,
 * and blesses drawing from a game mechanic. `{p}` is defined at 1.12.4d as the
 * notation for a power value. It identifies no brand.
 *
 * `scripts/ingest-game-symbols.ts` fetches them, records the URL, byte length,
 * pixel box and SHA-256 of each in `data/symbols/symbols.json`, and
 * `check:provenance` fails the build if a file under `public/` has no verified
 * origin. `check:symbols` re-fetches and diffs the hashes, so "has upstream
 * redrawn these" is answerable rather than assumed.
 *
 * Returns `null` for `{x}`, which is not in the 1.12.4 table and therefore has
 * no published artwork — see {@link INFERRED}. It renders as the letter it is.
 */
export interface SymbolAsset {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/**
 * The pixel box comes from the manifest rather than from a constant here, so
 * the `width`/`height` on the rendered `<img>` are the real ones and a
 * paragraph of eight symbols does not reflow as they load. Two of the eight are
 * 104px rather than 105px — upstream's own inconsistency, carried rather than
 * rounded, for the same reason every other value on this site is.
 */
const ASSETS = new Map<SymbolKind, SymbolAsset>(
  MANIFEST.symbols.map((entry) => [
    KIND_BY_KEY[entry.key] as SymbolKind,
    { src: `/symbols/${entry.file}`, width: entry.width, height: entry.height },
  ]),
);

export function assetForSymbol(symbol: GameSymbol): SymbolAsset | null {
  return ASSETS.get(symbol.kind) ?? null;
}

/**
 * The rule text behind a symbol, for the legend on a card page.
 *
 * Read out of the rules corpus at build time rather than copied into this file,
 * so the sentence a reader sees is the one the document says. Returns `null`
 * rather than throwing: a symbol whose rule went missing in a CR update should
 * cost its footnote, not the page.
 */
export function ruleTextFor(symbol: GameSymbol): string | null {
  return BY_NUMBER.get(symbol.rule)?.text ?? null;
}

const BY_NUMBER = new Map(RULES.sections.map((section) => [section.number, section]));
