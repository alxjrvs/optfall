/**
 * What the corpus knows about a SET, as opposed to about a card.
 *
 * `sets.ts` reads `data/sets/sets.json`, which carries five fields per set — a
 * code, a name, a date, a print status and a list of editions. Everything else
 * a reader might want to know about a release is a fact about the CARDS in it,
 * and until this module existed the only surface that computed any of it was
 * `/sets`, which counted names inline and used the number in one sentence.
 *
 * ONE PASS, AT BUILD TIME, FOR EVERY SET AT ONCE. The corpus is 4,941 cards and
 * 16,502 printings; walking it per set would be 112 walks for an answer that
 * does not change between them. The same argument `set.page.tsx` makes for
 * building its route table once, applied to the numbers rather than to the
 * routes.
 *
 * NOTHING HERE IMPORTS REACT AND NOTHING HERE RENDERS. The generator's pages
 * and the `/sets` island both need these figures, and the island receives them
 * as JSON in an attribute — so a module that reached for a component would
 * either be unusable on one side or would drag the 18 MB corpus into the
 * browser bundle. See `Island`: what may cross that boundary is data.
 *
 * COUNTED IN NAMES, VERSIONS AND PRINTINGS, ALL THREE, BECAUSE THEY ARE THREE
 * DIFFERENT NUMBERS AND EVERY SURFACE HERE HAS PRINTED AT LEAST TWO OF THEM.
 * Monarch is 155 names, 307 pitch versions and 1,182 printing rows. A page that
 * says "155 cards" beside a bar drawn from 1,182 slices is not wrong about
 * either, but it has to say which is which — which is why the profile carries
 * all three under their own names rather than one under the word "cards".
 */

import { CORPUS, slugify } from "./cards";
import { RARITY_RANK } from "./card-search/grammar";
import { rarityName, raritySlug } from "./sets";

/**
 * One rarity's share of a set, ready for `RarityBar`.
 *
 * The shape is the component's `RaritySlice`, deliberately — this is where the
 * corpus's codes become the slug the stylesheet is written against and the name
 * a screen reader hears, and doing it here means the component never sees a
 * `"M"`. It is not IMPORTED from the component because these objects cross into
 * the island as JSON and a type import would be the only thing travelling.
 */
export interface SetRaritySlice {
  /** The slug its colour is written against — `majestic`. */
  readonly rarity: string;
  /** The published name — "Majestic". */
  readonly name: string;
  /** Printings in this set carrying it. Always positive. */
  readonly count: number;
}

/** Everything the corpus can say about one set's contents. */
export interface SetProfile {
  /** The set's own code — `MST`. */
  readonly id: string;
  /** Distinct card NAMES, the number `/sets` and the set page both lead with. */
  readonly names: number;
  /** Distinct cards — Head Jab red, yellow and blue are three. */
  readonly versions: number;
  /** Printing rows, which is what the rarity slices are counted in. */
  readonly printings: number;
  /**
   * Names this set printed that no other set in the corpus did.
   *
   * A PROPERTY OF THE NAME, NOT OF THE PITCH VERSION, so that it answers the
   * same question the `names` count asks. A name is exclusive when the union of
   * sets over every card sharing its slug is this set alone — which is what
   * makes the Silver Age chapter decks read as zero and Smash Palace as 30 of
   * 34, and those two numbers are the whole reason the field is here: it is the
   * one figure that separates a release with new cards in it from a repackaging
   * of old ones, and no field upstream states it.
   *
   * IT IS NOT "DEBUTED HERE", AND THE DIFFERENCE MATTERS. A card first printed
   * in Welcome to Rathe and reprinted in Monarch is exclusive to neither, so
   * neither set counts it. Answering "which set printed this first" would need
   * the release dates to be total and correct, and 22 sets in this corpus carry
   * no published date at all.
   */
  readonly exclusive: number;
  /** Distinct artists credited on a printing in this set. */
  readonly artists: number;
  /**
   * The rarity mix, in `RARITY_RANK` order.
   *
   * THE LADDER IS THE SEARCH GRAMMAR'S, imported rather than restated. That
   * table already argues, at length, why Token and Basic sit below Common and
   * why Promo is last — "it describes how a card was distributed, not how rare
   * it is" — and a second ordering written here would be a second answer to a
   * settled question, drifting the first time either moved.
   */
  readonly rarities: readonly SetRaritySlice[];
}

/**
 * Which sets each card NAME was printed in, keyed by slug.
 *
 * Built first and separately because exclusivity is the one figure that cannot
 * be tallied set by set: knowing whether Monarch is the only set to print a
 * name means knowing about every other set, so the whole corpus has to be seen
 * before any set's number is final.
 */
function setsByNameSlug(): ReadonlyMap<string, ReadonlySet<string>> {
  const sets = new Map<string, Set<string>>();

  for (const card of CORPUS.cards) {
    const key = slugify(card.name);
    let seen = sets.get(key);
    if (seen === undefined) {
      seen = new Set<string>();
      sets.set(key, seen);
    }
    for (const printing of card.printings) seen.add(printing.set_id);
  }

  return sets;
}

/** The mutable tallies one set accumulates, before they become a profile. */
interface Tally {
  readonly names: Set<string>;
  readonly versions: Set<string>;
  readonly artists: Set<string>;
  readonly rarities: Map<string, number>;
  printings: number;
  exclusive: number;
}

function emptyTally(): Tally {
  return {
    names: new Set<string>(),
    versions: new Set<string>(),
    artists: new Set<string>(),
    rarities: new Map<string, number>(),
    printings: 0,
    exclusive: 0,
  };
}

/**
 * Every set that carries a card, profiled. Computed once, at module load.
 *
 * A SET WITH NO CARD HAS NO ENTRY, rather than an entry of zeroes. `/sets` has
 * always omitted those sets — "a page listing nothing is a 404 that renders" —
 * and a zero-filled profile would be a row waiting for somebody to render it by
 * accident. `undefined` from the map is the honest answer to "what is in this
 * set" when the answer is nothing this corpus knows about.
 */
export const SET_PROFILES: ReadonlyMap<string, SetProfile> = (() => {
  const setsOfName = setsByNameSlug();
  const tallies = new Map<string, Tally>();

  for (const card of CORPUS.cards) {
    const nameSlug = slugify(card.name);
    /* `?.size === 1` RATHER THAN `!.size === 1`, and the difference is the
       whole of it: the map is built from this same loop over the same corpus,
       so a miss is impossible today — and a non-null assertion would be a claim
       about that staying true, which `CLAUDE.md` asks to be guarded on the line
       above rather than asserted. Optional chaining yields `undefined`, which
       compares unequal to 1, so a name that somehow escaped the first pass is
       counted as NOT exclusive: the conservative answer, and the one that
       under-reports rather than inventing a claim about a set. */
    const only = setsOfName.get(nameSlug)?.size === 1;

    for (const printing of card.printings) {
      let tally = tallies.get(printing.set_id);
      if (tally === undefined) {
        tally = emptyTally();
        tallies.set(printing.set_id, tally);
      }

      /* COUNTED BEFORE THE NAME IS ADDED, so a name printed twice in one set —
         two foilings, two rarities — is counted once. The `has` is the guard
         that makes the increment idempotent per (set, name). */
      if (only && !tally.names.has(nameSlug)) tally.exclusive += 1;

      tally.names.add(nameSlug);
      tally.versions.add(card.unique_id);
      tally.printings += 1;
      tally.rarities.set(
        printing.rarity,
        (tally.rarities.get(printing.rarity) ?? 0) + 1,
      );
      for (const artist of printing.artists) tally.artists.add(artist);
    }
  }

  const profiles = new Map<string, SetProfile>();
  for (const [id, tally] of tallies) {
    profiles.set(id, {
      id,
      names: tally.names.size,
      versions: tally.versions.size,
      printings: tally.printings,
      exclusive: tally.exclusive,
      artists: tally.artists.size,
      rarities: [...tally.rarities.entries()]
        .toSorted((a, b) => {
          const rank = (code: string): number =>
            /* A CODE THE LADDER HAS NEVER SEEN SORTS LAST RATHER THAN FIRST.
               `?? -1` would put an unknown rarity below Token, which is a
               scarcity claim about a rarity nobody here has decoded; the length
               of the table is the one position that asserts nothing except
               "after everything we know about". */
            RARITY_RANK[code] ?? Object.keys(RARITY_RANK).length;
          if (rank(a[0]) !== rank(b[0])) return rank(a[0]) - rank(b[0]);
          /* Total order, so two builds cannot disagree — the same tiebreak
             `SETS_BY_RELEASE` uses for two sets sharing a date. */
          return a[0] < b[0] ? -1 : 1;
        })
        .map(([code, count]) => ({
          rarity: raritySlug(code),
          name: rarityName(code),
          count,
        })),
    });
  }

  return profiles;
})();
