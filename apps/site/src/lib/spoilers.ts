/**
 * Cards revealed for sets that are not out yet.
 *
 * `scripts/build-spoilers.ts` writes the file and documents what counts as a
 * spoiler; this module reads it and shapes it for `/spoilers`. It is a separate
 * corpus from `cards.ts` on purpose: a spoiled card has no card page, no
 * legality and only a provisional face (see `spoilerFaceKeyFor` in
 * `faces.ts`), and folding it into `CORPUS` would hand every one of those code
 * paths a card it cannot render. A spoiler
 * graduates by appearing in the card corpus, at which point it leaves this
 * page — see {@link SPOILER_CARDS}.
 */

import type { PitchValue } from "optfall-theme";

import { CORPUS, labelFor, pitchValueOf, slugify } from "./cards";
import { spoilerFaceKeyFor } from "./faces";
import { numberFor } from "./printings";
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
  /**
   * Upstream's image URL, or `null`. Read only to derive a face key — the
   * page asks our host for the face, never this.
   */
  readonly image_url: string | null;
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
  /**
   * When the card reached the compilation, UTC — the "Most recent" order.
   * Batched upstream, so many cards share one; see `build-spoilers.ts`.
   */
  readonly added: string;
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

/**
 * The face to show for a card in one set's listing: the first of those
 * printings that publishes an image, or `null` where none does.
 *
 * The set's own printing rather than the card's first, because a card listed
 * under two sets is two different printings — the Armory Deck hero's Rainbow
 * Foil under one, its Marvel under the other.
 */
export function spoilerFaceKey(
  printings: readonly SpoilerPrinting[],
): string | null {
  for (const printing of printings) {
    const key = spoilerFaceKeyFor(printing.image_url);
    if (key !== null) return key;
  }
  return null;
}

/** `2026-11-14` → `14 November 2026`, in UTC so no build machine shifts it. */
export function longDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `release date not announced`, or `releases 14 November 2026`. */
export function releaseLine(set: SpoilerSet): string {
  return set.released === null
    ? "release date not announced"
    : `releases ${longDate(set.released)}`;
}

/** `OBK041 · Majestic`. */
export function printingLabel(printing: SpoilerPrinting): string {
  return `${printing.id} · ${rarityName(printing.rarity)}`;
}

/* -------------------------------------------------------------------------- */
/* Pages                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * One spoiled card as it is listed under one set: the page `/spoilers` links
 * that set's cell to.
 *
 * A PAGE PER (CARD, SET), BECAUSE THAT IS WHAT A CELL IS. The Armory Deck hero
 * reprinted as a Marvel in the booster is two cells on `/spoilers`, wearing two
 * different faces, so it is two pages, each showing the face its cell showed —
 * the rule `set.page.tsx`'s `printingForSet` states for released cards.
 *
 * UNDER `/spoilers/`, NEVER `/card/`. A `/card/` address is meant to be
 * permanent, and a card whose text can change before release is not one yet;
 * this address is explicitly provisional, and the card page it graduates to is
 * a different URL. The shape is the card route's — `/spoilers/obk/041/<slug>`
 * — so a reader who knows one knows the other.
 */
export interface SpoilerPage {
  readonly card: SpoilerCard;
  readonly set: SpoilerSet;
  /** This card's printings in this set, collector-number order. */
  readonly printings: readonly SpoilerPrinting[];
  readonly pitch: PitchValue;
  /** True where another spoiler shares this name, so the slug and label say pitch. */
  readonly disambiguated: boolean;
  /** `Swap Spit (pitch 2)` where the name is shared; the name otherwise. */
  readonly label: string;
  readonly slug: string;
  readonly href: string;
  /** See {@link spoilerFaceKey}. */
  readonly faceKey: string | null;
}

/** How many spoilers carry each name. A shared name is pitch versions of one card. */
const NAME_COUNTS: ReadonlyMap<string, number> = SPOILER_CARDS.reduce(
  (counts, card) => counts.set(card.name, (counts.get(card.name) ?? 0) + 1),
  new Map<string, number>(),
);

function pageFor(
  card: SpoilerCard,
  set: SpoilerSet,
  printings: readonly SpoilerPrinting[],
): SpoilerPage {
  const pitch = pitchValueOf(card);
  const disambiguated = (NAME_COUNTS.get(card.name) ?? 0) > 1;
  /* The same suffix `cards.ts` gives a released card: the pitch, `0` for none. */
  const slug = disambiguated
    ? `${slugify(card.name)}-${pitch}`
    : slugify(card.name);
  const first = printings[0];
  const number = first === undefined ? "" : numberFor(first.id, set.id);
  return {
    card,
    set,
    printings,
    pitch,
    disambiguated,
    label: labelFor(card.name, pitch, disambiguated),
    slug,
    href: `/spoilers/${set.id.toLowerCase()}/${number}/${slug}`,
    faceKey: spoilerFaceKey(printings),
  };
}

/** Every spoiler page, in `SPOILER_GROUPS` order: set, then collector number. */
export const SPOILER_PAGES: readonly SpoilerPage[] = SPOILER_GROUPS.flatMap(
  ({ set, cards }) =>
    cards.map(({ card, printings }) => pageFor(card, set, printings)),
);

/**
 * One set's pages, grouped by name: pitch versions of one card are one ROW,
 * pitch ascending — the collapse every card list on the site makes. See
 * `groupByName` in `set.page.tsx`.
 */
export function namesIn(
  pages: readonly SpoilerPage[],
): readonly (readonly SpoilerPage[])[] {
  const groups = new Map<string, SpoilerPage[]>();
  for (const page of pages) {
    const key = `${page.set.id} ${page.card.name}`;
    const existing = groups.get(key);
    if (existing) existing.push(page);
    else groups.set(key, [page]);
  }
  return [...groups.values()].map((group) =>
    group.toSorted((a, b) => a.pitch - b.pitch),
  );
}
