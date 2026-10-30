/**
 * Cards revealed for sets that are not out yet.
 *
 * `scripts/build-spoilers.ts` writes the file and documents what counts as a
 * spoiler; this module reads it and shapes it for `/spoilers`. It is a separate
 * corpus from `cards.ts` on purpose: a spoiled card has no card page, no
 * legality and no face on our image host, and folding it into `CORPUS` would
 * hand every one of those code paths a card it cannot render. A spoiler
 * graduates by appearing in the card corpus, at which point it leaves this
 * page — see {@link SPOILER_CARDS}.
 */

import { CORPUS } from "./cards";
import { rarityName } from "./sets";

import spoilers from "../../../../data/spoilers/spoilers.json";

export interface SpoilerSource {
  /** The upstream branch, which is named for the set it is building. */
  readonly branch: string;
  readonly commit: string;
  /** ISO timestamp of that commit — the freshness of what it carries. */
  readonly committedAt: string;
}

export interface SpoilerPrinting {
  /** Collector number — `OBK041`. */
  readonly id: string;
  readonly set_id: string;
  readonly rarity: string;
}

/** Upstream's field names, verbatim, as in `cards.ts`. Stats are strings. */
export interface SpoilerCard {
  readonly unique_id: string;
  readonly name: string;
  readonly pitch: string;
  readonly cost: string;
  readonly power: string;
  readonly defense: string;
  readonly health: string;
  readonly intelligence: string;
  readonly arcane: string;
  readonly type_text: string;
  readonly functional_text: string;
  readonly types: readonly string[];
  readonly printings: readonly SpoilerPrinting[];
}

export interface SpoilerSet {
  readonly id: string;
  readonly name: string;
  /** `YYYY-MM-DD`, or `null` where no date has been announced upstream. */
  readonly released: string | null;
}

export interface SpoilersCorpus {
  readonly schemaVersion: number;
  readonly repository: string;
  readonly sources: readonly SpoilerSource[];
  readonly rights: string;
  readonly counts: { readonly cards: number; readonly sets: number };
  readonly sets: readonly SpoilerSet[];
  readonly cards: readonly SpoilerCard[];
}

/** Same narrow cast as `./cards` and `./sets`: the generator upholds the shape. */
export const SPOILERS = spoilers as unknown as SpoilersCorpus;

/** One set's spoilers, in collector-number order. */
export interface SpoilerGroup {
  readonly set: SpoilerSet;
  readonly cards: readonly {
    readonly card: SpoilerCard;
    /** This card's printings in THIS set — a card can be in two. */
    readonly printings: readonly SpoilerPrinting[];
  }[];
}

/**
 * The spoiled cards the card corpus does not carry yet.
 *
 * THE BUILDER ALREADY EXCLUDES THEM, AND THIS EXCLUDES THEM AGAIN, because the
 * two files are rebuilt by different jobs. A corpus sync that lands before the
 * next spoiler run would otherwise list a released card here and on its own
 * page at once — and fail no test until the daily job caught up. Filtering at
 * build time makes the order of the two merges not matter.
 */
const RELEASED: ReadonlySet<string> = new Set(
  CORPUS.cards.map((card) => card.unique_id),
);

export const SPOILER_CARDS: readonly SpoilerCard[] = SPOILERS.cards.filter(
  (card) => !RELEASED.has(card.unique_id),
);

/**
 * Spoilers grouped by set, in the file's set order (dated soonest first,
 * undated last).
 *
 * A CARD IN TWO UPCOMING SETS IS LISTED UNDER BOTH, because a reader opening
 * "Outbreak" wants every card revealed for Outbreak, and an Armory Deck hero
 * reprinted as a Marvel in the booster is one of them. Each listing names only
 * that set's collector numbers.
 */
export const SPOILER_GROUPS: readonly SpoilerGroup[] = SPOILERS.sets
  .map((set) => ({
    set,
    cards: SPOILER_CARDS.flatMap((card) => {
      const printings = card.printings.filter((p) => p.set_id === set.id);
      return printings.length === 0 ? [] : [{ card, printings }];
    }),
  }))
  .filter((group) => group.cards.length > 0);

/** The newest upstream commit read, or `null` outside spoiler season. */
export const SPOILERS_AS_OF: string | null =
  SPOILERS.sources
    .map((source) => source.committedAt)
    .toSorted()
    .at(-1)
    ?.slice(0, 10) ?? null;

/** `OBK041 · Majestic`. */
export function printingLabel(printing: SpoilerPrinting): string {
  return `${printing.id} · ${rarityName(printing.rarity)}`;
}
