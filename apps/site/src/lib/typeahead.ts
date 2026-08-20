/**
 * Name typeahead — what the front door needs, and nothing else.
 *
 * THE HOME PAGE IS A DOOR, NOT A ROOM. Its job is to take a card name and send
 * you somewhere: to that card, or to the results page. It does not rank card
 * text, filter by legality or render a grid, so it has no business shipping the
 * machinery that does.
 *
 * Measured before this existed: the home page shipped the full search index —
 * an inverted index over 4,941 cards' printed text, keyword and trait
 * memberships, per-format verdict vectors — about 470 KB, to render a list of
 * twenty-four browse links. This index carries labels, slugs and pitches, which
 * is what a name suggestion is made of.
 *
 * IT SUGGESTS, IT DOES NOT SEARCH. Every suggestion is a destination — one
 * printing of one card — and the field's own submit goes to the results page. Nothing here
 * re-ranks a corpus while somebody types, and nothing renders results in place;
 * `docs/SCRYFALL-GAP.md` §5.2 settled that, and a typeahead that navigates is
 * the one affordance that survives it, because it shortens the path to a
 * destination rather than pretending to be one.
 *
 * DETERMINISTIC, like everything else here. Prefix before substring, then
 * corpus order, which is upstream's name sort and is total — so no tie is left
 * for an engine to break and two browsers cannot order the same prefix
 * differently. No language model, no learned ranking, no score.
 */

import type { PitchValue } from "optfall-theme";

import type { CardPage } from "./cards";

/**
 * The wire format: three newline-joined columns and one digit string.
 *
 * Same encoding argument as the full index — an island's props are
 * JSON-serialised into an HTML attribute, so every `"` costs six bytes. Columns
 * of lines carry about twenty quotes for the whole payload.
 */
export interface EncodedNameIndex {
  /** One per CARD, deduplicated by bare name. Display form, no pitch suffix. */
  readonly names: string;
  /**
   * The URL for each name, in full — not a slug to be pasted into a template.
   *
   * IT WAS THE SLUG, AND A TEMPLATE, AND THAT STOPPED WORKING. Every consumer
   * built `/card/<slug>`, which was the card's page for the life of the site
   * and is a 301 now: card URLs are `/card/<set>/<number>/<slug>`, and the set
   * and number of a name's default printing are not derivable from the name.
   *
   * So the index carries the ANSWER rather than the input — the same move the
   * full search index's `faceKeys` note argues for, and here it is not an
   * optimisation but the only correct option. About 30 characters per name
   * against 12; on a payload whose whole point is being small enough for a
   * front door, that is 55 kB of a page that exists to be 47 kB, and it is the
   * price of the destination being knowable at all.
   */
  readonly hrefs: string;
  /**
   * Pitches present for each name, concatenated: `"123"` where a card has red,
   * yellow and blue versions, `"0"` where it has none.
   *
   * Shown as jewels beside a suggestion, which is what tells two same-named
   * cards apart before you have clicked either.
   */
  readonly pitches: string;
}

export interface NameIndex {
  readonly names: readonly string[];
  /** Lowercased, punctuation-folded, for matching. Built once. */
  readonly folded: readonly string[];
  readonly hrefs: readonly string[];
  readonly pitches: readonly (readonly PitchValue[])[];
  readonly size: number;
}

/** Case- and punctuation-insensitive. Matches `card-search.ts`'s `fold`. */
function fold(text: string): string {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).join(" ");
}

/**
 * Build the index from the shaped card pages, at build time.
 *
 * Keyed on `nameSlug` rather than `slug`, so the three pitch versions of Head
 * Jab are ONE suggestion pointing at the card — the same collapse the results
 * page makes, for the same reason: a player calls them one card.
 *
 * THE DESTINATION IS PASSED IN, NOT DERIVED, and that is deliberate rather than
 * awkward. A name's URL is now its lowest-pitch version's default printing, and
 * "lowest-pitch" is `byPitch` in `cards.ts` — which ranks an UNPITCHED card
 * last where `CardPage.pitch` reports it as 0 and would rank it first. One card
 * group in the corpus mixes the two. Recomputing the rule here would be a
 * second spelling of it, and this module cannot import `cards.ts` anyway: it is
 * reachable from the island bundle, and `cards.ts` loads an 18 MB corpus at
 * module scope. `HREF_BY_NAME_SLUG` is that map.
 *
 * A NAME WITH NO ENTRY IS DROPPED RATHER THAN LINKED NOWHERE. It cannot happen
 * — the map is built from the same corpus these pages come from — and a
 * suggestion whose `href` is `""` navigates to the current page, which is the
 * kind of silent nothing this file is otherwise written to avoid.
 */
export function buildNameIndex(
  pages: readonly CardPage[],
  hrefByNameSlug: ReadonlyMap<string, string>,
): EncodedNameIndex {
  const byName = new Map<string, { name: string; pitches: Set<PitchValue> }>();

  for (const page of pages) {
    const existing = byName.get(page.nameSlug);
    if (existing) {
      existing.pitches.add(page.pitch);
      continue;
    }
    byName.set(page.nameSlug, {
      name: page.card.name,
      pitches: new Set([page.pitch]),
    });
  }

  const entries = [...byName.entries()].flatMap(([slug, value]) => {
    const href = hrefByNameSlug.get(slug);
    return href === undefined ? [] : [{ href, ...value }];
  });

  return {
    names: entries.map((entry) => entry.name).join("\n"),
    hrefs: entries.map((entry) => entry.href).join("\n"),
    pitches: entries
      .map((entry) => [...entry.pitches].toSorted((a, b) => a - b).join(""))
      .join("\n"),
  };
}

export function decodeNameIndex(encoded: EncodedNameIndex): NameIndex {
  const names = encoded.names === "" ? [] : encoded.names.split("\n");
  const hrefs = encoded.hrefs === "" ? [] : encoded.hrefs.split("\n");
  const pitchLines = encoded.pitches === "" ? [] : encoded.pitches.split("\n");

  return {
    names,
    folded: names.map(fold),
    hrefs,
    pitches: names.map((_, index) =>
      [...(pitchLines[index] ?? "")].map(
        (digit) => (Number(digit) || 0) as PitchValue,
      ),
    ),
    size: names.length,
  };
}

export interface Suggestion {
  readonly name: string;
  readonly href: string;
  readonly pitches: readonly PitchValue[];
}

/** How many suggestions a reader can scan without it becoming a results page. */
export const SUGGESTION_LIMIT = 8;

/**
 * Suggest card names for what has been typed so far.
 *
 * TWO TIERS AND NO SCORE. A name that STARTS with the query comes before one
 * that merely contains it, and within a tier the corpus order stands. That is
 * the whole ranking — enough to put "Head Jab" above "Sever Head Jab" while you
 * are still typing "head", and simple enough that a reader can predict it.
 */
export function suggest(
  index: NameIndex,
  raw: string,
  limit: number = SUGGESTION_LIMIT,
): readonly Suggestion[] {
  const query = fold(raw);
  if (query === "") return [];

  const prefix: number[] = [];
  const contains: number[] = [];

  for (let i = 0; i < index.size; i += 1) {
    const name = index.folded[i] ?? "";
    if (name.startsWith(query)) prefix.push(i);
    else if (name.includes(query)) contains.push(i);
    // Stop scanning once BOTH tiers could not change: the prefix tier is full
    // and the contains tier is full, so nothing later can displace anything.
    if (prefix.length >= limit) break;
  }

  return [...prefix, ...contains].slice(0, limit).map((i) => ({
    name: index.names[i] ?? "",
    href: index.hrefs[i] ?? "",
    pitches: index.pitches[i] ?? [],
  }));
}
