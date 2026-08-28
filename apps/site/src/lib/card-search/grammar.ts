/**
 * The query language: the operator tables, and the parser that reads them.
 *
 * ADDING AN OPERATOR TOUCHES FOUR FILES AND ONE OF THEM HAS NO TEST. The tables
 * below, the hand-written `Supported:` string in the unknown-operator error,
 * `../query.ts` if tokenising changes, and `ssg/pages/syntax.page.tsx` — which
 * nothing checks against this file. See `.claude/skills/add-a-search-filter`.
 *
 * NOTHING HERE MAY IMPORT `../cards` BY VALUE. That module pulls the 18 MB
 * corpus at module scope, and this one is reached from a client island, so a
 * value import would put the corpus in the browser bundle. It did once: 9.28 MB
 * shipped to every reader. `import type` is erased before the bundler sees it.
 *
 * That rule is why {@link FORMAT_NAMES} is restated below rather than imported
 * from `../cards`, and why `build.ts` asserts the restatement against the real
 * list at build time so it cannot drift.
 */

import type { StateTone } from "optfall-theme";

import {
  leaves,
  parse,
  tokenise,
  type QueryLeaf,
  type QueryNode,
  type Token,
} from "../query";

import { STOPWORDS, fold, tokeniseCard } from "./tokenise";
import { TONE_BIT } from "./wire";

/* -------------------------------------------------------------------------- */
/* The query language                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Operators from `docs/DESIGN.md`'s grammar that this corpus cannot answer yet,
 * and what each is waiting on.
 *
 * Named rather than ignored, because silence is the worse failure: `is:verified`
 * typed into a field that quietly dropped it would return every card and look
 * like it worked. This is the same table `./search.ts` keeps, minus the entries
 * the card layer has now answered — and those entries are removed *there* on
 * the same day they land *here*, because a hint advertising an operator the
 * build cannot answer is the lie "degrade visibly" prohibits.
 *
 * THAT RULE WAS BROKEN ONCE, IN THE HARMLESS DIRECTION, AND IT IS STILL WORTH
 * NAMING. `artist`, `flavor` and `flavour` sat here describing themselves as
 * "not indexed here yet" for as long as they were indexed. Nothing failed —
 * a field that resolves returns before this table is consulted, so the entries
 * were unreachable — but "unreachable" is not "correct": this table is read as
 * the list of what the engine cannot do, and it was overstating that list.
 * An operator that WORKS is not pending, and saying so is the same obligation
 * as saying an operator that does not.
 */
const PENDING_OPERATORS: Readonly<Record<string, string>> = {
  is: "filters judge-verified rulings, which are not published yet",
  changed: "lists what a rules version touched, which is not published yet",
  cr: "searches the Comprehensive Rules — that lives at /search, not here",
};

/**
 * Operators this grammar used to accept because another game's did.
 *
 * THIS IS A FLESH AND BLOOD SEARCH AND IT WAS SPEAKING MAGIC. Three operators
 * arrived as inherited Scryfall grammar, on the reasoning — written beside two
 * of them — that "a reader who types the spelling they know should get the
 * value they meant". The trouble is which readers, and which spelling:
 *
 * - `o:` is Scryfall's ORACLE text. "Oracle" is Wizards of the Coast's word for
 *   a card's canonical wording and appears nowhere in the Comprehensive Rules;
 *   upstream calls this field `functional_text`. It carried no comment at all,
 *   which is its own signal: nobody argued for it, it simply came along.
 * - `tou:` and `toughness:` mapped to DEFENCE, and this is the one that does
 *   real harm. Toughness is not a Flesh and Blood stat — it is a Flesh and
 *   Blood TOKEN. CR 2.x: "A Toughness token is a token with the name
 *   'Toughness,' the subtype aura". So `toughness:3` silently answered a
 *   question about defence, and the one thing in the game actually called
 *   Toughness was unreachable through the operator named after it.
 *
 * `pow:` STAYS, and the difference is the point rather than an inconsistency.
 * Power is a Flesh and Blood stat; `pow` is a short spelling of a word this
 * game really uses. `tou` was a short spelling of a word it does not.
 *
 * THEY ANSWER RATHER THAN VANISH. Query state is in the URL, so `o:dominate`
 * links exist in Discord threads and bookmarks; a retired operator that fell
 * through to the unknown-operator message would tell those readers their link
 * was gibberish. This says what to type instead, which is what
 * {@link PENDING_OPERATORS} does for the other kind of absence.
 */
const RETIRED_OPERATORS: Readonly<Record<string, string>> = {
  o: "was another game's name for the rules text — use text:",
  tou: "was another game's name for defence — use defence: or def:",
  toughness:
    "is a token in this game, not a stat — for the stat, use defence: or def:",
};

/**
 * The six format names, in `FORMATS` order — restated rather than imported, for
 * the reason at the top of this file, and asserted against the real list by
 * {@link buildCardIndex} in `./build` so the restatement cannot drift.
 */
export const FORMAT_NAMES: readonly string[] = [
  "Classic Constructed",
  "Blitz",
  "Living Legend",
  "Commoner",
  "Silver Age",
  "Ultimate Pit Fight",
];

/** Format aliases people actually type, mapped to a {@link FORMAT_NAMES} index. */
export const FORMAT_ALIASES: Readonly<Record<string, number>> = {
  cc: 0,
  "classic-constructed": 0,
  classic: 0,
  constructed: 0,
  blitz: 1,
  ll: 2,
  "living-legend": 2,
  livinglegend: 2,
  commoner: 3,
  "silver-age": 4,
  silverage: 4,
  silver: 4,
  upf: 5,
  "ultimate-pit-fight": 5,
};

export interface CardNotice {
  readonly kind:
    | "operator-pending"
    | "operator-unknown"
    | "operand-unknown"
    /* THE WORD PARSED AND MEANS SOMETHING ELSE NOW. Distinct from
       `operand-unknown`, which means the engine did not recognise it, and from
       `term-ignored`, which means the engine dropped it: the term was honoured,
       at a value the reader did not type. `display:text` is the case this was
       added for — it named a view that no longer exists, and resolving it to
       the nearest one silently would leave a reader wondering why the page
       ignored them. */
    | "operand-retired"
    | "term-ignored"
    | "phrase-approximate"
    /* THE QUERY IS MALFORMED AND WAS ANSWERED ANYWAY. Distinct from every kind
       above, which describe a decision the engine made about a token it
       understood: this one says the tokeniser could not see the query the
       reader meant to write, because a quote never closed. */
    | "quote-unbalanced"
    /* The engine answered, and is telling you what it could not see. Distinct
       from `operator-pending`, which means it did not answer at all. */
    | "coverage-partial";
  readonly text: string;
}

/** One `field:value` restriction the engine will actually apply. */
export interface CardFilter {
  readonly field:
    | "name"
    /* Present because `outcome.filters` reports it, NOT because `passesFilter`
       handles it — the `released` branch of the leaf test returns before that
       function is reached. Declared anyway: the union is what `toCardFilter`
       casts into, and a cast into a union that does not contain the value is a
       lie that stays quiet until somebody reorders the branches. */
    | "released"
    | "text"
    | "artist"
    | "flavour"
    | "type"
    | "trait"
    | "keyword"
    | "set"
    | "rarity"
    | "pitch"
    | "cost"
    | "power"
    | "defence"
    | "state";
  /** The operand, lowercased and trimmed. */
  readonly value: string;
  /** For `state` filters: the format index and the tone bit required. */
  readonly formatIndex?: number;
  readonly bit?: number;
  /** How the filter is described back to the reader. */
  readonly label: string;
}

/** What a result set can be ordered by. */
export type CardSortKey =
  | "name"
  | "pitch"
  | "cost"
  | "power"
  | "defence"
  | "rarity"
  | "set"
  | "released";

/**
 * How the reader asked for the results to be ordered.
 *
 * `key` is `null` when they did not ask, which is not the same as asking for
 * name order: the default is RELEVANCE, and relevance is a property of the
 * query rather than of the cards. Collapsing the two would silently discard the
 * ranking on every unordered search.
 */
export interface CardSort {
  readonly key: CardSortKey | null;
  readonly direction: "asc" | "desc";
}

export interface ParsedCardQuery {
  /** Free terms, deduplicated, in the order typed. */
  readonly terms: readonly string[];
  readonly filters: readonly CardFilter[];
  readonly notices: readonly CardNotice[];
  /** The requested ordering, or the default. */
  readonly sort: CardSort;
  /** The level results collapse at. See {@link CardUniqueMode}. */
  readonly unique: CardUniqueMode;
  /** The shape asked for, or `null` where the query did not say. */
  readonly display: CardDisplayMode | null;
  /** The whole query, folded — used only for the exact-name tier. */
  readonly folded: string;
  /**
   * The query as an expression.
   *
   * `terms` and `filters` remain because they are what the interface describes
   * back to the reader, and because a flat list is the right shape for "what
   * did you ask for". They are derived FROM this tree rather than parsed
   * alongside it, so the two cannot disagree about what the query said.
   */
  readonly tree: QueryNode | null;
}

export const STATE_OPERATORS: Readonly<Record<string, StateTone>> = {
  legal: "legal",
  banned: "banned",
  suspended: "suspended",
  restricted: "restricted",
};

/**
 * What `order:` can sort by, and what a reader may call each one.
 *
 * SEVEN KEYS, NOT SCRYFALL'S FIFTEEN, and the gap is honest rather than
 * unfinished: most of theirs sort on data this corpus does not carry — no
 * prices, no release date per card, no EDHREC rank, no colour identity. These
 * are the printed values Optfall actually has, plus the two identifiers a
 * reader browses by.
 */
/**
 * HOW MUCH OF THE CORPUS ONE ROW STANDS FOR.
 *
 * `docs/SCRYFALL-GAP.md` §5.1c asked for `unique:cards|prints|art`. The three
 * levels are real here, but they do not land where Scryfall's names suggest,
 * and pretending otherwise would have shipped an operator that lies:
 *
 * - **`names`** — one row per NAME. Head Jab's red, yellow and blue versions
 *   are one result. This is what the search has always done and it stays the
 *   default; the reasoning is in `searchCards`, and it is good — a reader told
 *   "3 cards match" should get three things to click.
 * - **`cards`** — one row per CARD. Those three versions separate, because the
 *   rest of this site already treats them as three cards: different text,
 *   different legality, different pages, and a canonical tag that says so.
 * - **`art`** — one row per distinct PICTURE, including alternate arts, each
 *   linking to that art's own page.
 *
 * `prints` IS AN ALIAS FOR `art`, AND THAT IS A CLAIM ABOUT THE DATA. On
 * Scryfall the two differ because a printing there is individually addressable.
 * Here the corpus has 16,502 printing rows and 11,378 distinct pictures — a
 * card printed Regular, Rainbow Foil and Cold Foil in one set is three rows
 * sharing one image, one collector number and one page. `unique:prints` as a
 * separate mode would emit three identical rows pointing at the same URL, which
 * is not a finer view of anything. So it resolves to `art` rather than being
 * refused: the reader asked for "show me every printing", and every printing
 * this corpus can distinguish is exactly what they get.
 */
/**
 * WHICH SHAPE THE ANSWER TAKES.
 *
 * `docs/SCRYFALL-GAP.md` §5.2 asked for `display:grid` (default) / `list` /
 * `text`, "in the URL" — and specifically as a QUERY TERM rather than as UI
 * chrome, because §5.2's fifth point is that every piece of state is in the
 * URL and its fourth is that the query is an algebra rather than a filter set.
 *
 * - **`grid`** — the card face IS the row. The default, because recognising a
 *   card by its picture is faster than reading its name.
 * - **`list`** — the dense row: a small face, the pitch stones, the name, the
 *   type line and the printed stats.
 *
 * IT WAS THREE MODES AND THE THIRD WAS NOT A KIND. `text` printed names one
 * per line and nothing else — which is to say it was `list` with the metadata
 * removed. The difference between them was DENSITY, and offering a density
 * knob as a peer of "show me pictures" is what made the control read as
 * nonsense: `unique:` already collapses to a row per NAME, so the bar could be
 * driven to say "Names as Names", and the only reason that sentence could be
 * built is that there was no third KIND left to name the third position after.
 *
 * Scryfall has four modes and they are four different kinds of page — a grid
 * of faces, a sortable table, a grid of text-only card boxes, and a per-card
 * dossier. Ours were one picture mode and two grades of one text list. Two is
 * the honest count.
 *
 * WHAT `text` WAS ACTUALLY FOR IS WORTH NAMING BECAUSE IT WAS REAL, AND
 * BECAUSE NOTHING SERVES IT NOW. Its job was to be SELECTED AND COPIED: a
 * player building a deck list wants forty names, not forty pictures, and
 * `PitchBox` carries `user-select: none` specifically so the mark's words stay
 * out of the paste — as `PitchJewel` did for its numeral before the list views
 * drew boxes.
 *
 * THIS PARAGRAPH USED TO SAY THE JOB HAD MOVED TO A CONTROL, naming
 * `CardIndex`'s copy button — which reached the rows below the fold, needed no
 * drag, and could not pick up a stray glyph. That button has been deleted, so
 * the honest statement is that the view is retired and its job is not served:
 * taking the names off a page is a drag over the list view again, and the type
 * lines come with them. Written down rather than quietly dropped, because a
 * retirement argument that rests on a replacement should stop being an
 * argument when the replacement goes.
 *
 * ITS THREE SPELLINGS STILL PARSE, AND THEY RESOLVE TO `list` WITH A NOTICE.
 * `display:text`, `display:checklist` and `display:names` are in the wild and
 * documented at `/syntax`, so refusing them would break bookmarks over a
 * vocabulary change; resolving them SILENTLY would leave a reader wondering
 * why the page ignored what they typed. {@link RETIRED_DISPLAY_MODES} carries
 * the ones that say so.
 */
export type CardDisplayMode = "grid" | "list";

const DISPLAY_MODES: Readonly<Record<string, CardDisplayMode>> = {
  grid: "grid",
  images: "grid",
  list: "list",
  rows: "list",
  text: "list",
  checklist: "list",
  names: "list",
};

/**
 * The spellings that used to mean a third view, and now mean `list`.
 *
 * SEPARATE FROM {@link DISPLAY_MODES} RATHER THAN A FLAG ON IT, because the two
 * answer different questions: that table says what a word resolves to, this one
 * says whether resolving it is worth telling the reader about. `display:rows`
 * and `display:list` are the same view under two names and always were, so
 * neither earns a notice; `display:text` used to be a different view, so it
 * does.
 */
const RETIRED_DISPLAY_MODES: readonly string[] = ["text", "checklist", "names"];

/**
 * Read a `?display=` PARAMETER against the same table the operator uses.
 *
 * WHY THIS IS HERE RATHER THAN IN THE TWO SURFACES THAT READ IT. The parameter
 * predates the operator and both still exist, so `display` is one vocabulary
 * with two entry points — and until this existed the two entry points disagreed.
 * `CardSearch` accepted `list`, `text`, `checklist` and `grid`; `CardList`
 * accepted those plus `rows`, `names` and `images`; {@link DISPLAY_MODES}, which
 * the OPERATOR reads, accepts all seven.
 *
 * So on `/search`, typing `display:rows` gave a list and arriving at
 * `?display=rows` gave a grid — the same word, on the same page, answered two
 * ways depending on whether it was typed or followed. Reading both from one
 * table is the only arrangement in which that cannot come back.
 *
 * IT RETURNS `null` RATHER THAN A DEFAULT, and the callers decide. A parameter
 * that says nothing and a parameter nobody recognises are the same thing to
 * this function; what they are worth is a question about the surface, and
 * `/search` in particular has a query that may carry its own `display:` and
 * outrank the parameter entirely.
 *
 * NO NOTICE, UNLIKE THE OPERATOR. {@link RETIRED_DISPLAY_MODES} exists because
 * somebody who TYPES `display:text` chose that word just now and deserves to be
 * told it moved. A parameter arrives on a followed link, very likely one the
 * reader did not write, so a notice there would explain a vocabulary change to
 * somebody who never used the old vocabulary.
 */
export function parseDisplayParam(
  raw: string | null | undefined,
): CardDisplayMode | null {
  if (raw === null || raw === undefined) return null;
  return DISPLAY_MODES[raw.trim().toLowerCase()] ?? null;
}

export type CardUniqueMode = "names" | "cards" | "art";

const UNIQUE_MODES: Readonly<Record<string, CardUniqueMode>> = {
  names: "names",
  name: "names",
  cards: "cards",
  card: "cards",
  art: "art",
  arts: "art",
  prints: "art",
  printings: "art",
};

/**
 * The three printed values a comparison may name on either side, and what a
 * reader may call each one.
 *
 * `pow` and `tou` are here because Scryfall uses them and this grammar is
 * inherited on purpose. `tou` maps to defence: Magic's toughness and Flesh and
 * Blood's defence are the same position on the card, and a reader who types the
 * word they know should get the value they meant rather than an error telling
 * them this game uses a different noun.
 */
const STAT_FIELDS: Readonly<Record<string, "cost" | "power" | "defence">> = {
  cost: "cost",
  power: "power",
  pow: "power",
  defence: "defence",
  defense: "defence",
  def: "defence",
};

const SORT_KEYS: Readonly<Record<string, CardSortKey>> = {
  name: "name",
  released: "released",
  release: "released",
  pitch: "pitch",
  cost: "cost",
  power: "power",
  defence: "defence",
  defense: "defence",
  def: "defence",
  rarity: "rarity",
  set: "set",
};

/**
 * Rarity in scarcity order, which is the only order a reader means by it.
 *
 * The corpus stores upstream's single letters and `data/sets/sets.json` decodes
 * them to names; neither carries a RANK, because neither needs one until
 * something sorts by it. This is that rank, and it is stated here rather than
 * inferred from the decode table's key order — a JSON object's key order is not
 * a promise, and sorting a reference tool by an accident of serialisation is
 * the kind of thing nobody notices is wrong.
 *
 * Token and Basic sit below Common because they are not pulled from a pack.
 * Marvel sits at the top, above Fabled, which is where the game puts it.
 *
 * PROMO IS NOT A RARITY and is ranked last for that reason rather than as a
 * scarcity claim: it describes how a card was distributed, not how rare it is,
 * so it has no place on the ladder and sorting it into the middle would assert
 * one.
 */
export const RARITY_RANK: Readonly<Record<string, number>> = {
  T: 0,
  B: 1,
  C: 2,
  R: 3,
  S: 4,
  M: 5,
  L: 6,
  F: 7,
  V: 8,
  P: 9,
};

/**
 * Operators that scope a word to one field. `class:` is discussed below.
 *
 * EXPORTED, BECAUSE THE THINGS THAT DOCUMENT IT COULD NOT READ IT. This table
 * was private, so the unknown-operator error below and `ssg/pages/syntax.page.tsx`
 * both described it by hand — and had drifted. Seven of these keys were absent
 * from the error's `Supported:` list, so `pow:6` and `tou:3` returned results
 * while the message a reader got for a typo told them those operators did not
 * exist. `toughness` was in neither place: it worked, and was discoverable
 * nowhere.
 */
export const FIELD_OPERATORS: Readonly<Record<string, CardFilter["field"]>> = {
  name: "name",
  text: "text",
  /* PRINTING-LEVEL, UNLIKE EVERY OPERATOR ABOVE IT, and the page says so.
     A card matches when ANY of its printings does — the same rule `set:` and
     `rarity:` already follow, because all of them are facts about a printing
     hanging off a card-level row. */
  artist: "artist",
  a: "artist",
  flavour: "flavour",
  flavor: "flavour",
  ft: "flavour",
  // `class:` is an alias of `type:` because the upstream dataset publishes
  // classes and card types in ONE list — "Guardian", "Action" and "Attack" are
  // all entries in `types`. Separating them would need a class vocabulary
  // Optfall does not have and would have to invent, so the two operators are
  // documented as the same operator rather than one of them being wrong.
  type: "type",
  class: "type",
  trait: "trait",
  keyword: "keyword",
  kw: "keyword",
  set: "set",
  rarity: "rarity",
  pitch: "pitch",
  cost: "cost",
  power: "power",
  /* `pow` for the same reason STAT_FIELDS carries it: a reader who types the
     short spelling should get the value they meant, and both sides of a
     comparison have to accept it or `pow>2` resolves on one side only.

     ITS PARTNER IS GONE. This comment used to cover `tou` as well, on the
     grammar being inherited — but `power` is a word this game uses and
     `toughness` is not, so the two were never the same case. See
     RETIRED_OPERATORS. */
  pow: "power",
  defence: "defence",
  /* `defense` is not merely tolerated: it is the spelling the Comprehensive
     Rules use — CR 2.3 is titled "Defense" — and the one upstream keys the
     field by. This project prints "Defence"; both must resolve. */
  defense: "defence",
  def: "defence",
};

/**
 * The operators that configure the query rather than filter it.
 *
 * WRITTEN DOWN BECAUSE THEY WERE THE ONLY ONES THAT WERE NOT. `year` and `date`
 * are handled by a branch on the operator name, and `order`, `dir`, `unique`
 * and `display` are lifted out of the token stream before the tree is built —
 * so unlike every other operator, no table listed them, and the only place they
 * appeared as a set was the hand-typed sentence this file used to end with.
 * That is why they are here: {@link supportedOperators} needs a source, and a
 * literal inside that function would be the same hand-maintained list in a new
 * hiding place.
 */
export const QUERY_OPTIONS: readonly string[] = [
  "year",
  "date",
  "order",
  "dir",
  "unique",
  "display",
];

/**
 * Every operator this grammar accepts, as the sentence a reader is shown when
 * they type one it does not.
 *
 * DERIVED, WHICH IS THE ENTIRE POINT. The list used to be a string literal, and
 * it was wrong: it omitted `flavor`, `kw`, `pow`, `defense`, `def`, `tou` and
 * `toughness`, all of which parse and return results. A reader who mistyped an
 * operator was handed a list denying the existence of seven working ones.
 *
 * ALIASES ARE GROUPED UNDER THE NAME THEY ALIAS, because "name, text, o, type,
 * class, trait…" reads as twenty-four unrelated operators rather than as
 * fourteen fields with shorthands. The primary is the key whose value is its
 * own name — `text: "text"` against `o: "text"` — which is a property of the
 * table rather than a second list to maintain.
 */
export function supportedOperators(): string {
  const byField = new Map<string, { primary: string; aliases: string[] }>();

  for (const [name, field] of Object.entries(FIELD_OPERATORS)) {
    const group = byField.get(field);
    if (group === undefined) {
      byField.set(field, { primary: name, aliases: [] });
      continue;
    }
    /* A key equal to its own field is the canonical spelling however late in
       the table it appears, so a group that meets it later promotes. */
    if (name === field) {
      group.aliases.push(group.primary);
      group.primary = name;
      continue;
    }
    group.aliases.push(name);
  }

  const fields = [...byField.values()].map(({ primary, aliases }) =>
    aliases.length === 0 ? primary : `${primary} (${aliases.join(", ")})`,
  );
  const states = Object.keys(STATE_OPERATORS).join("/");

  return `${[...fields, ...QUERY_OPTIONS].join(", ")}, and ${states} with a format`;
}

/**
 * Fields whose operand is prose and is therefore tokenised into one requirement
 * per word. Everything else — a set code, a rarity letter, a printed cost — is
 * an opaque value and is matched whole.
 */
const WORD_VALUED: ReadonlySet<CardFilter["field"]> = new Set([
  "name",
  "text",
  "type",
  "trait",
  "keyword",
  /* Both are prose. `a:faizal fikri` has to ask for both words rather than for
     the literal string, or a reader who types a full name gets nothing. */
  "artist",
  "flavour",
]);

/**
 * Parse the query into free terms and filters.
 *
 * COMPARISONS ARE NAMED AS UNSUPPORTED RATHER THAN GUESSED AT. `cost>=3` reads
 * like it should work, and it cannot here: 4,941 printed costs include `X`,
 * `XX`, `X1` and the empty string, so "greater than" has no total order over
 * the values this corpus actually carries. A silent no-op would be the worst of
 * the three options, so it produces a notice.
 */
export function parseCardQuery(raw: string): ParsedCardQuery {
  const notices: CardNotice[] = [];
  const seenNotice = new Set<string>();

  const note = (kind: CardNotice["kind"], text: string) => {
    const key = `${kind}:${text}`;
    if (seenNotice.has(key)) return;
    seenNotice.add(key);
    notices.push({ kind, text });
  };

  /**
   * Turn one token into a leaf, or reject it and say why.
   *
   * ALL THE OPERATOR KNOWLEDGE LIVES HERE, and the grammar in `./query` has
   * none of it: that module knows about `and`, `or`, `not` and grouping, and
   * this function knows what `banned:cc` means. Keeping them apart is what
   * makes the tree testable without a corpus and the operators testable
   * without a parser.
   */
  const toLeaf = (token: Token): QueryNode | null => {
    /* ---------------------------------------------------------- free word */
    if (token.kind === "term") {
      if (token.quoted) {
        note(
          "phrase-approximate",
          `“${token.value.trim()}” is matched word by word. The index carries no word positions, so adjacency is not checked.`,
        );
      }
      const kept = tokeniseCard(token.value);
      const dropped = (
        token.value.toLowerCase().match(/[a-z0-9]+/g) ?? []
      ).filter((word) => !kept.includes(word));
      for (const word of new Set(dropped)) {
        note(
          "term-ignored",
          STOPWORDS.has(word)
            ? `“${word}” is in most cards, so it cannot narrow anything. Ignored.`
            : `“${word}” is a single letter — too short to search on. Ignored.`,
        );
      }
      if (kept.length === 0) return null;
      const children = kept.map(
        (value): QueryNode => ({
          kind: "leaf",
          field: "any",
          value,
          label: value,
        }),
      );
      return children.length === 1 ? children[0]! : { kind: "and", children };
    }

    /* ------------------------------------------------------- exact name */
    if (token.kind === "exact") {
      const folded = fold(token.value);
      if (folded === "") {
        note("operand-unknown", "! was typed with no name after it. Ignored.");
        return null;
      }
      return {
        kind: "leaf",
        field: "name-exact",
        value: folded,
        label: `!${token.value}`,
      };
    }

    if (token.kind !== "field") return null;

    const name = token.field;
    const operandRaw = token.value;
    const operand = operandRaw.toLowerCase();

    if (operand === "") {
      note(
        "operand-unknown",
        `${name}: was typed with nothing after it. Ignored.`,
      );
      return null;
    }

    /* ------------------------------------------------------------- state */
    const stateTone = STATE_OPERATORS[name];
    if (stateTone) {
      if (token.compare !== undefined) {
        note(
          "operator-unknown",
          `${name}${token.compare}: a legality filter names a format, so there is nothing to compare. Use ${name}:cc.`,
        );
        return null;
      }
      const [formatName = "", asOf] = operand.split("@");
      if (asOf !== undefined) {
        note(
          "operator-pending",
          `${name}:${formatName}@${asOf} asks what was legal on a date. Optfall publishes present-day legality only; legality that remembers is not built yet, and answering with today's flags would be a wrong answer rather than a missing one.`,
        );
        return null;
      }
      const formatIndex = FORMAT_ALIASES[formatName];
      if (formatIndex === undefined) {
        note(
          "operand-unknown",
          `${name}:${formatName} names no format Optfall serves. The six are ${FORMAT_NAMES.join(", ")}.`,
        );
        return null;
      }
      return {
        kind: "leaf",
        field: "state",
        value: `${formatIndex}:${TONE_BIT[stateTone]}`,
        label: `${stateTone} in ${FORMAT_NAMES[formatIndex] ?? formatName}`,
      };
    }

    /* ----------------------------------------------------------- released */
    /*
      `year:` AND `date:` ARE ONE OPERATOR WITH TWO GRAINS, which is why they
      normalise to a single `released` leaf here rather than staying two fields
      the matcher has to tell apart. `year:2024` is `date:2024-01-01 …
      2024-12-31` said briefly, and a reader who writes one and then the other
      should get answers that agree.

      A CARD MATCHES IF ANY OF ITS PRINTINGS DOES. The corpus collapses a card
      across its sets, so "released in 2024" can only mean "printed in 2024 at
      least once" — the alternative, testing only the first printing, would
      answer `year:2024` with cards that came out in 2019 and were reprinted,
      excluded, which is not what anybody means by the question.
    */
    if (name === "year" || name === "date") {
      const grain = name === "year" ? "year" : "date";
      const pattern = grain === "year" ? /^\d{4}$/ : /^\d{4}-\d{2}-\d{2}$/;

      /*
        `!=` IS REFUSED, AND THE REASON IS THE 53 UNDATED CARDS RATHER THAN
        laziness about implementing it.

        There is no meaning for `year!=2024` that is both consistent and honest.
        Applied per printing it is wrong outright: a card printed in 2019 and
        reprinted in 2024 has a printing outside 2024, so it would come back
        from `year:2024` AND `year!=2024` — a query and its own negation.
        Applied to the whole card it becomes `-year:2024`, except on the cards
        with no published date at all, where the two part company: `-` is a
        boolean NOT over a match that did not happen, so it INCLUDES them, while
        `!=` would be asserting "this card was not released in 2024" about a
        card whose release date upstream does not publish. That is a claim this
        corpus cannot support.

        So the operator that has a defensible meaning is offered and the one
        that does not is named. `docs/PLAN.md`, "degrade visibly": an engine
        that cannot answer honestly says so rather than picking whichever
        answer looks reasonable.
      */
      if (token.compare === "!=") {
        note(
          "operator-unknown",
          `${name}!=${operandRaw}: there is no honest answer to "not this ${grain}". Use -${name}:${operandRaw}, which excludes the cards that match and keeps the ${
            grain === "year" ? "undated" : "undated"
          } ones — ${name}!= would have to claim a release date for cards upstream publishes none for.`,
        );
        return null;
      }

      if (!pattern.test(operand)) {
        note(
          "operand-unknown",
          grain === "year"
            ? `year:${operandRaw} is not a four-digit year. Use year:2024, or date: for a day.`
            : `date:${operandRaw} is not a date. Use date:2024-06-21, or year: for a whole year.`,
        );
        return null;
      }

      return {
        kind: "leaf",
        field: "released",
        value: operand,
        ...(token.compare === undefined ? {} : { compare: token.compare }),
        label:
          token.compare === undefined
            ? `released in ${operand}`
            : `released ${token.compare} ${operand}`,
      };
    }

    /* ------------------------------------------------------------ fields */
    const field = FIELD_OPERATORS[name];
    if (field) {
      const label = `${name}${token.compare ?? ":"}${operandRaw}`;

      if (token.compare !== undefined) {
        // COMPARISONS, HONESTLY. Only the three printed stats have any order at
        // all, and even there `X`, `XX` and blanks do not — so a comparison is
        // answered as "this value is numeric AND satisfies the comparison", and
        // a card printing `X` simply does not match. That is a stated partial
        // order, which beats the flat refusal this replaced.
        if (field !== "cost" && field !== "power" && field !== "defence") {
          note(
            "operator-unknown",
            `${name}${token.compare}: ${name} has no order to compare. Comparisons work on cost, power and defence.`,
          );
          return null;
        }
        /*
          FIELD-TO-FIELD, WHICH IS THE OTHER HALF OF A COMPARISON. `power>defence`
          asks a question about one card against itself — "is this attack worth
          more than it blocks" — and there is no number that expresses it.
          Scryfall spells it `pow>tou`, and this file used to accept that
          spelling for the sake of a reader arriving from there. It no longer
          does: `tou` is another game's word for defence and was retired along
          with `toughness` and `o`. `pow>def` and `power>defence` are the
          spellings this game uses, and `pow>tou` now answers with the
          retirement message rather than pretending not to recognise it.

          Encoded with a `@` prefix rather than as a bare field name so the
          matcher can tell `power>2` from `power>defence` without inspecting the
          string's shape. A printed stat is digits or `X`, never a word, so the
          prefix is belt-and-braces — but the alternative is a matcher that
          decides what a value means by guessing, and this file has already been
          bitten once by a comparison whose meaning depended on where it was
          evaluated.
        */
        const against = STAT_FIELDS[operand];
        if (against !== undefined) {
          note(
            "phrase-approximate",
            `${label} compares two printed values on the same card. Cards where either side is X, XX or blank have no place in that order and do not match.`,
          );
          return {
            kind: "leaf",
            field,
            value: `@${against}`,
            compare: token.compare,
            label: `${field} ${token.compare} ${against}`,
          };
        }

        /*
          A RETIRED NAME ON THE RIGHT-HAND SIDE GETS THE SAME ANSWER IT GETS ON
          THE LEFT. `RETIRED_OPERATORS` was only ever consulted for a token
          shaped `field:value`, so `tou:3` explained itself and `pow>tou` — the
          spelling this very file used to advertise — fell through to the
          generic message below and said only that it was not a number. That is
          the worse of the two answers, and it was reaching the reader who had
          followed our own documentation.
        */
        const retired = RETIRED_OPERATORS[operand];
        if (retired !== undefined) {
          note("operand-retired", `${operand} ${retired}.`);
          return null;
        }

        if (!/^\d+$/.test(operand)) {
          note(
            "operand-unknown",
            `${label} compares against something that is neither a number nor another printed value. Comparisons take a number, or one of ${[...new Set(Object.values(STAT_FIELDS))].join(", ")}.`,
          );
          return null;
        }
        note(
          "phrase-approximate",
          `${label} matches printed ${field} values that are numeric. ${operandRaw === "" ? "" : ""}Cards printing X, XX or nothing at all have no place in that order and do not match.`,
        );
        return {
          kind: "leaf",
          field,
          value: operand,
          compare: token.compare,
          label,
        };
      }

      if (WORD_VALUED.has(field)) {
        const tokens = tokeniseCard(operand);
        if (tokens.length === 0) {
          note(
            "operand-unknown",
            `${label} has nothing searchable in it once single letters and common words are dropped. Ignored.`,
          );
          return null;
        }
        const children = tokens.map(
          (value): QueryNode => ({ kind: "leaf", field, value, label }),
        );
        return children.length === 1 ? children[0]! : { kind: "and", children };
      }

      return { kind: "leaf", field, value: operand, label };
    }

    const pending = PENDING_OPERATORS[name];
    if (pending) {
      note("operator-pending", `${name}: ${pending}.`);
      return null;
    }

    /*
      A RETIRED OPERATOR GETS ITS OWN ANSWER, ahead of the unknown-operator
      message, because those two say different things to the person reading
      them. "Not an operator here" is right for a typo and wrong for a link
      somebody was sent: the query is in the URL, so `o:dominate` is pasted in
      Discord threads that outlive this change, and the reader following one did
      nothing wrong. This tells them what to type instead.
    */
    const retired = RETIRED_OPERATORS[name];
    if (retired) {
      note("operand-retired", `${name}: ${retired}.`);
      return null;
    }

    note(
      "operator-unknown",
      `${name}: is not an operator here. Supported: ${supportedOperators()}.`,
    );
    return toLeaf({ kind: "term", value: operandRaw, quoted: false });
  };

  /*
    `order:` AND `dir:` ARE OPTIONS ON THE QUERY, NOT TERMS IN IT, so they are
    taken out of the token stream before the tree is built rather than handled
    as leaves. A leaf has to match or not match a card; "sort by cost" does
    neither, and leaving it in would make `order:cost` a text search for the
    literal string on every card that does not carry it.

    Taken out WHEREVER THEY APPEAR, including inside parentheses. `(dominate or
    order:cost)` is not a meaningful thing to have written — an ordering does
    not belong to one branch of an or — so it is applied to the whole query and
    the group is evaluated without it.
  */
  let sortKey: CardSortKey | null = null;
  let sortDirection: CardSort["direction"] = "asc";
  /* `unique:` is the third option, and it is one for the same reason the other
     two are: "one row per name" is not a property a card can have, so it can
     never be a leaf. */
  let unique: CardUniqueMode = "names";
  /* `null` rather than `"grid"`, and the distinction is load-bearing: the
     component has to tell "the reader asked for the default" from "the reader
     said nothing", because only the second may be overridden by the legacy
     `?display=` parameter that predates this operator. */
  let display: CardDisplayMode | null = null;

  /*
    AN ODD NUMBER OF QUOTES IS ANSWERED, NOT SWALLOWED. `type:"illusionist
    action` — a closing quote simply forgotten — cannot match the quoted-field
    alternative, so it falls to `field:value`, which takes `"illusionist` as
    the operand and leaves `action` behind as an ordinary REQUIRED term. The
    engine still answers, and the answer is not the question that was asked.
    Tokenising cannot repair this without guessing where the quote belonged, so
    the reader is told instead: this file's rule is that the engine degrades
    visibly, and the shape it degrades into here is not one anybody would
    predict from what they typed.
  */
  if ((raw.match(/"/g) ?? []).length % 2 === 1) {
    note(
      "quote-unbalanced",
      "There is an odd number of quotes here, so one phrase runs to the end of the query rather than where it was meant to close. Results may include terms you meant to keep together.",
    );
  }

  const remaining = tokenise(raw).filter((token) => {
    if (token.kind !== "field") return true;
    if (
      token.field !== "order" &&
      token.field !== "dir" &&
      token.field !== "unique" &&
      token.field !== "display"
    ) {
      return true;
    }

    if (token.compare !== undefined) {
      note(
        "operator-unknown",
        `${token.field}${token.compare}: names an ordering, so there is nothing to compare. Use ${token.field}:${token.field === "dir" ? "desc" : "cost"}.`,
      );
      return false;
    }

    const operand = token.value.toLowerCase();

    if (token.field === "display") {
      const mode = DISPLAY_MODES[operand];
      if (mode === undefined) {
        note(
          "operand-unknown",
          `display:${token.value} is not a way to show results. The two are grid and list.`,
        );
      } else {
        if (RETIRED_DISPLAY_MODES.includes(operand)) {
          /*
            IT SAYS WHAT HAPPENED AND DOES NOT GIVE DIRECTIONS, which is a
            correction rather than an omission. A draft of this sentence
            pointed at the copy control — "at the end of the bar above" — and
            was wrong twice over: notices render ABOVE the index, so the bar
            is below rather than above, and a query that matches nothing
            renders no index at all, so on that page the notice named a
            control that was not on it. Review caught both.

            The engine cannot fix either by rewording, because both are facts
            about a RENDERING it has no access to. A parser that describes the
            page it is being displayed on will keep drifting out of true every
            time the page moves. So it describes the QUERY, which is the thing
            it actually knows.

            THE CONTROL HAS SINCE BEEN DELETED OUTRIGHT, which is the third way
            that draft would have been wrong and the reason this rule is worth
            keeping rather than a story about one bad sentence: a notice naming
            a control ages the moment somebody removes it, and this one would
            have shipped a pointer to nothing on every page instead of on one.
          */
          note(
            "operand-retired",
            `display:${operand} named a names-only view. It is now display:list, which is the same rows with more on each of them.`,
          );
        }
        display = mode;
      }
      return false;
    }

    if (token.field === "unique") {
      const mode = UNIQUE_MODES[operand];
      if (mode === undefined) {
        note(
          "operand-unknown",
          `unique:${token.value} is not a level to collapse at. The three are names, cards and art.`,
        );
      } else {
        unique = mode;
      }
      return false;
    }

    if (token.field === "dir") {
      if (operand === "asc" || operand === "desc") sortDirection = operand;
      else {
        note(
          "operand-unknown",
          `dir:${token.value} is not a direction. The two are asc and desc.`,
        );
      }
      return false;
    }

    const key = SORT_KEYS[operand];
    if (key === undefined) {
      note(
        "operand-unknown",
        `order:${token.value} names nothing this can sort by. The seven are ${[...new Set(Object.values(SORT_KEYS))].join(", ")}.`,
      );
      return false;
    }

    sortKey = key;
    return false;
  });

  const tree = parse(remaining, toLeaf);

  /*
    AN ORDERING IS NOT A QUERY. `order:cost` on its own leaves nothing to
    match, so the tree is empty and the page shows no results — which looks
    identical to a search that found none, and is the silent failure this
    project's own rules forbid. Said out loud instead.
  */
  if (sortKey !== null && tree === null) {
    note(
      "operand-unknown",
      `order:${sortKey} says how to arrange results, not which ones to find. Add something to search for.`,
    );
  }

  /*
    `terms` and `filters` are DERIVED from the tree rather than collected
    alongside it, so the list the interface shows and the expression the engine
    evaluates cannot describe different queries.
  */
  const all = tree === null ? [] : leaves(tree);
  const terms = [
    ...new Set(
      all.filter((leaf) => leaf.field === "any").map((leaf) => leaf.value),
    ),
  ];
  const filters: CardFilter[] = all
    .filter((leaf) => leaf.field !== "any")
    .map((leaf) => toCardFilter(leaf));

  return {
    terms,
    filters,
    notices,
    sort: { key: sortKey, direction: sortDirection },
    unique,
    display,
    folded: fold(raw),
    tree,
  };
}

/** A leaf, in the shape the interface has always described a filter in. */
export function toCardFilter(leaf: QueryLeaf): CardFilter {
  if (leaf.field === "state") {
    const [formatIndex = "0", bit = "0"] = leaf.value.split(":");
    return {
      field: "state",
      value: leaf.value,
      formatIndex: Number(formatIndex),
      bit: Number(bit),
      label: leaf.label,
    };
  }
  return {
    field: leaf.field as CardFilter["field"],
    value: leaf.value,
    label: leaf.label,
  };
}
