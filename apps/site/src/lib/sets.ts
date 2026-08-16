/**
 * Sets, and the tables that turn upstream's single letters into words.
 *
 * The card corpus stores a printing's rarity as `R`, its edition as `N` and its
 * foiling as `S`, and its set as `MST`. Those are storage codes, and a
 * reference work that prints them is showing its database rather than its
 * subject. This module is where they become "Rare", "No specified edition",
 * "Standard" and "Part the Mistveil".
 *
 * PINNED TO THE SAME UPSTREAM COMMIT AS THE CARDS. See
 * `scripts/build-sets-corpus.ts`: a set index from a later snapshot could omit
 * a set the cards reference, and a printing would resolve to nothing.
 *
 * AN UNKNOWN CODE KEEPS ITS CODE. Every decode below falls back to the raw
 * value rather than to a blank or a guess — if upstream adds a rarity Optfall
 * has not re-synced, the page shows `Z` rather than an empty cell, which is a
 * visible gap instead of a silent one. `docs/PLAN.md`: a stale Optfall must
 * look stale.
 */

import corpus from "../../../../data/sets/sets.json";

export interface SetRecord {
  /** The three-letter code printings carry — `MST`. */
  readonly id: string;
  /** The set's published name — "Part the Mistveil". */
  readonly name: string;
  /** `YYYY-MM-DD` of the earliest printing, or `null` where undated. */
  readonly released: string | null;
  /** True only when every printing of the set is out of print. */
  readonly outOfPrint: boolean;
  readonly editions: readonly string[];
}

export interface SetsCorpus {
  readonly schemaVersion: number;
  readonly source: {
    readonly repository: string;
    readonly commit: string;
    readonly files: readonly string[];
  };
  readonly rights: string;
  readonly counts: { readonly sets: number; readonly dated: number };
  readonly decode: {
    readonly rarity: Readonly<Record<string, string>>;
    readonly edition: Readonly<Record<string, string>>;
    readonly foiling: Readonly<Record<string, string>>;
  };
  readonly sets: readonly SetRecord[];
}

/** Same narrow cast as `./cards` and `./rules`: the generator upholds the shape. */
export const SETS = corpus as unknown as SetsCorpus;

const BY_ID: ReadonlyMap<string, SetRecord> = new Map(
  SETS.sets.map((set) => [set.id, set]),
);

export function setFor(id: string): SetRecord | undefined {
  return BY_ID.get(id);
}

/**
 * A set's display name, falling back to its own code.
 *
 * `MST` becomes "Part the Mistveil"; an unknown code stays `MST`, which reads
 * as a set nobody has named yet rather than as a missing value.
 */
export function setName(id: string): string {
  return BY_ID.get(id)?.name ?? id;
}

export function rarityName(code: string): string {
  return SETS.decode.rarity[code] ?? code;
}

/**
 * A rarity's slug — the key its colour and its visibility rule are written
 * against in CSS.
 *
 * DERIVED FROM THE NAME, NOT FROM THE CODE, which is worth stating because the
 * code is right there and shorter. Upstream's codes are not a closed set this
 * project controls: `rarityName` falls back to the raw code for a rarity it has
 * never seen, and the same fallback has to reach here or a new rarity would get
 * a slug from one function and a name from the other.
 *
 * THE FIRST WORD ONLY, which decides exactly one of the ten: "Super Rare"
 * becomes `super`, and every other published name is already a single word.
 * That is what the card page did inline before this had a name, and it is kept
 * rather than tidied because the ten slugs are written out in `CardEntry.css`
 * and changing the derivation would silently unstyle one of them.
 *
 * A rarity upstream adds tomorrow lands on a slug no rule names, which draws
 * the plain grey bubble the CSS defaults to rather than a broken `var()`.
 */
export function raritySlug(code: string): string {
  return rarityName(code).toLowerCase().split(" ")[0] ?? "";
}

export function editionName(code: string): string {
  return SETS.decode.edition[code] ?? code;
}

export function foilingName(code: string): string {
  return SETS.decode.foiling[code] ?? code;
}

/** The permalink for a set — `/sets/mst`. Lowercased, as every URL here is. */
export function hrefForSet(id: string): string {
  return `/sets/${id.toLowerCase()}`;
}

/**
 * Every set, newest first, with the undated ones last.
 *
 * NEWEST FIRST BECAUSE THAT IS WHAT A SET LIST IS FOR: somebody opening `/sets`
 * is far more often looking for what just came out than for what came out in
 * 2019. Undated sets sort to the end rather than to the top, which is where an
 * empty string would put them — and calling an undated set the oldest is a
 * claim the data does not support.
 *
 * The tiebreak is the set id, so the order is total and two builds cannot
 * disagree.
 */
export const SETS_BY_RELEASE: readonly SetRecord[] = SETS.sets.toSorted(
  (a, b) => {
    if (a.released === null && b.released === null) return a.id < b.id ? -1 : 1;
    if (a.released === null) return 1;
    if (b.released === null) return -1;
    if (a.released !== b.released) return a.released < b.released ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  },
);
