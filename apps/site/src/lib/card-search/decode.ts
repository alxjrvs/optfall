import type { PitchValue } from "optfall-theme";

import { numberFor } from "../printings";
import { encodePostings } from "./build";
import { fold, tokeniseCard } from "./tokenise";
import type { EncodedCardIndex } from "./wire";

/* -------------------------------------------------------------------------- */
/* The decoded index                                                           */
/* -------------------------------------------------------------------------- */

export interface CardIndex {
  readonly commit: string;
  readonly confirmed: string;
  readonly labels: readonly string[];
  /** Lowercased, punctuation-folded labels — built once, used every keystroke. */
  readonly folded: readonly string[];
  /** Tokenised labels, so a name match is whole-word-or-prefix like the rest. */
  readonly labelTokens: readonly (readonly string[])[];
  readonly slugs: readonly string[];
  /** Bare-name slug per card, shared by every pitch version. */
  readonly nameSlugs: readonly string[];
  /**
   * How many pitch versions the CORPUS carries per bare-name slug.
   *
   * Counted once here rather than per query, and counted over the corpus rather
   * than over the results — "2 of 3 versions matched" needs the 3, and the
   * result set only knows the 2.
   */
  readonly versionsByName: ReadonlyMap<string, number>;
  /** Face blob key per card; `null` where the card publishes no art. */
  readonly faceKeys: readonly (string | null)[];
  /**
   * The card's other arts, decoded — everything a `unique:art` row needs to be
   * a link and a picture, and nothing else.
   *
   * The set CODE rather than the id, because by this point the dictionary has
   * been read and a row wants to say "Omen", not "37". The collector number is
   * derived here rather than shipped; see `numberOf`.
   */
  readonly arts: readonly (readonly ArtRef[])[];
  /**
   * The lowercased set code {@link CardIndex.faceKeys} came from, `""` where
   * the card has no face. Lowercased for the reason `arts` is: this is compared
   * against a `set:` filter's operand, which the parser has already lowercased.
   */
  readonly faceSets: readonly string[];
  readonly faceLandscape: readonly boolean[];
  readonly pitches: readonly PitchValue[];
  readonly typeLines: readonly string[];
  readonly typeTokens: readonly (readonly string[])[];
  readonly stats: readonly (readonly [
    string,
    string,
    string,
    string,
    string,
    string,
  ])[];
  readonly keywords: readonly (readonly string[])[];
  readonly traits: readonly (readonly string[])[];
  readonly sets: readonly (readonly string[])[];
  /**
   * Every release date the card has, ascending, one entry per DATED set it was
   * printed in. Empty where every set it appears in is undated.
   *
   * Per card rather than per set because that is the shape both consumers want:
   * `order:released` takes the first, and `year:`/`date:` ask whether ANY of
   * them satisfies the test. Resolving the set codes once at decode beats doing
   * it 4,941 times per query.
   */
  readonly released: readonly (readonly string[])[];
  /**
   * How many cards have no release date at all — 53 of 4,941.
   *
   * Carried so a `year:`/`date:` query can SAY it excluded them. Seventeen of
   * the 118 sets are undated upstream (the judge, organised-play and promo
   * lines), and a card printed only there matches no date filter that will ever
   * be written. Silently returning 4,888 cards for a question asked about 4,941
   * is the kind of quiet wrongness this engine exists not to do.
   */
  readonly undatedCards: number;
  readonly rarities: readonly (readonly string[])[];
  /** Every artist credited on any printing of the card. */
  readonly artists: readonly (readonly string[])[];
  /** Six bitmasks per card, in {@link FORMATS} order. */
  readonly verdicts: readonly (readonly number[])[];
  readonly postings: ReadonlyMap<string, readonly number[]>;
  readonly terms: readonly string[];
  /** The flavour-text index, kept apart from the rules-text one on purpose. */
  readonly flavourPostings: ReadonlyMap<string, readonly number[]>;
  readonly flavourTerms: readonly string[];
  readonly browse: readonly (readonly [string, number])[];
  readonly size: number;
}

function splitIds(field: string, dict: readonly string[]): readonly string[] {
  if (field === "") return [];
  return field
    .split(".")
    .map((id) => dict[Number.parseInt(id, 36)])
    .filter((value): value is string => value !== undefined);
}

/**
 * The inverse of {@link encodePostings}. Shared for the same reason.
 */
function decodePostings(encoded: string): Map<string, number[]> {
  const postings = new Map<string, number[]>();
  if (encoded === "") return postings;

  for (const line of encoded.split("\n")) {
    const gap = line.indexOf(" ");
    const term = line.slice(0, gap);
    let running = 0;
    const docs = line
      .slice(gap + 1)
      .split(".")
      .map((delta) => {
        running += Number.parseInt(delta, 36);
        return running;
      });
    postings.set(term, docs);
  }

  return postings;
}

/**
 * One alternate art of a card, as a result row needs it.
 *
 * Deliberately smaller than `PrintingRef` in `cards.ts`: that one carries the
 * whole printing row, which is a build-time object sitting in a 16 MB corpus
 * the browser never sees. This is the three fields that survive the wire.
 */
export interface ArtRef {
  readonly key: string;
  readonly setCode: string;
  readonly number: string;
  /**
   * Whether THIS art is landscape, which is not always what the card is.
   *
   * CARRIED PER ART BECAUSE THE INPUT IS PER PRINTING. `orientationOf` reads
   * two things: `played_horizontally`, which belongs to the card and is
   * therefore the same for every one of its faces, and
   * `image_rotation_degrees`, which belongs to the PRINTING — ten of them in
   * this corpus carry a non-zero one. So two arts of one card can differ, and
   * an index that knew only the default face's orientation would put a
   * rotated alternate inside a portrait box.
   *
   * Measured today: zero cards actually diverge, so this is latent rather than
   * live. It is carried anyway, for the reason `faces.ts` gives about the
   * `decodeURIComponent` throw it once shipped — latent is exactly how a bug
   * like this arrives, on a corpus sync nobody is watching.
   *
   * TWO characters per art, not one: the flag needs its own space delimiter, so
   * 6,437 arts cost about 12.9 KB rather than the 6.4 KB the digit alone would
   * suggest. Stated at the true number for the same reason the 9.6 KB beside
   * `faceSets` is — a cost written down at half its size is a cost nobody
   * weighed.
   */
  readonly landscape: boolean;
}

export function decodeCardIndex(encoded: EncodedCardIndex): CardIndex {
  const labels = encoded.labels === "" ? [] : encoded.labels.split("\n");
  const slugs = encoded.slugs === "" ? [] : encoded.slugs.split("\n");
  const faceKeyLines =
    encoded.faceKeys === "" ? [] : encoded.faceKeys.split("\n");
  const artLines = encoded.arts === "" ? [] : encoded.arts.split("\n");
  const nameSlugLines =
    encoded.nameSlugs === "" ? [] : encoded.nameSlugs.split("\n");
  const nameSlugPerCard = labels.map(
    (_, ordinal) => nameSlugLines[ordinal] ?? "",
  );
  const typeDict = encoded.typeDict === "" ? [] : encoded.typeDict.split("\n");
  const keywordDict =
    encoded.keywordDict === "" ? [] : encoded.keywordDict.split("\n");
  const traitDict =
    encoded.traitDict === "" ? [] : encoded.traitDict.split("\n");
  const setDict = encoded.setDict === "" ? [] : encoded.setDict.split("\n");
  const setReleasedLines =
    encoded.setReleased === "" ? [] : encoded.setReleased.split("\n");
  /* Code → date, dated sets only. An undated set is absent rather than mapped
     to the empty string, so a lookup miss and "released on nothing" cannot be
     confused at the call site. */
  const releasedBySet = new Map<string, string>();
  setDict.forEach((code, position) => {
    const date = setReleasedLines[position] ?? "";
    if (date !== "") releasedBySet.set(code, date);
  });
  const rarityDict =
    encoded.rarityDict === "" ? [] : encoded.rarityDict.split("\n");
  const artistDict =
    encoded.artistDict === "" ? [] : encoded.artistDict.split("\n");
  const verdictDict =
    encoded.verdictDict === "" ? [] : encoded.verdictDict.split("\n");
  const statLines = encoded.stats === "" ? [] : encoded.stats.split("\n");
  const membershipLines =
    encoded.memberships === "" ? [] : encoded.memberships.split("\n");

  const typeLines: string[] = [];
  const pitches: PitchValue[] = [];
  const verdicts: number[][] = [];
  const keywords: string[][] = [];
  const traits: string[][] = [];
  const sets: string[][] = [];
  const released: string[][] = [];
  const rarities: string[][] = [];
  const artists: string[][] = [];
  const stats: (readonly [string, string, string, string, string, string])[] =
    [];

  labels.forEach((_, ordinal) => {
    const typeId = Number.parseInt(
      encoded.typeAt.slice(ordinal * 2, ordinal * 2 + 2),
      36,
    );
    typeLines.push(typeDict[typeId] ?? "");

    const digit = Number(encoded.pitches[ordinal] ?? "0");
    pitches.push(
      (digit === 1
        ? 1
        : digit === 2
          ? 2
          : digit === 3
            ? 3
            : digit === 4
              ? 4
              : 0) as PitchValue,
    );

    const vectorId = Number.parseInt(
      encoded.verdictAt.slice(ordinal * 2, ordinal * 2 + 2),
      36,
    );
    verdicts.push(
      (verdictDict[vectorId] ?? "")
        .split(",")
        .map((mask) => Number.parseInt(mask, 36) || 0),
    );

    const [
      cost = "",
      power = "",
      defence = "",
      life = "",
      intellect = "",
      arcane = "",
    ] = (statLines[ordinal] ?? "").split("\t");
    stats.push([cost, power, defence, life, intellect, arcane] as const);

    const [k = "", t = "", s = "", r = "", a = ""] = (
      membershipLines[ordinal] ?? ""
    ).split("\t");
    keywords.push([...splitIds(k, keywordDict)]);
    traits.push([...splitIds(t, traitDict)]);
    const cardSets = [...splitIds(s, setDict)];
    sets.push(cardSets);
    released.push(
      cardSets
        .flatMap((code) => {
          const date = releasedBySet.get(code);
          return date === undefined ? [] : [date];
        })
        .toSorted(),
    );
    rarities.push([...splitIds(r, rarityDict)]);
    artists.push([...splitIds(a, artistDict)]);
  });

  const postings = decodePostings(encoded.postings);
  const flavourPostings = decodePostings(encoded.flavour);

  const browse: (readonly [string, number])[] =
    encoded.browse === ""
      ? []
      : encoded.browse.split("\n").map((line) => {
          const [value = "", count = "0"] = line.split("\t");
          return [value, Number(count)] as const;
        });

  return {
    commit: encoded.commit,
    confirmed: encoded.confirmed,
    labels,
    nameSlugs: nameSlugPerCard,
    versionsByName: (() => {
      const counts = new Map<string, number>();
      for (const name of nameSlugPerCard) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
      return counts;
    })(),
    faceKeys: labels.map((_, ordinal) => {
      const key = faceKeyLines[ordinal] ?? "";
      return key === "" ? null : key;
    }),
    arts: labels.map((_, ordinal) => {
      const line = artLines[ordinal] ?? "";
      if (line === "") return [];
      return line.split("\t").flatMap((entry): ArtRef[] => {
        /*
           THREE FIELDS, AND THE KEY IS LAST SO IT CAN BE TAKEN WHOLE. Face
           keys are constrained to `[A-Za-z0-9][A-Za-z0-9._-]*` by
           `faceKeyFor`, so they cannot contain a space — which is what makes
           splitting on the first two safe without escaping anything.
        */
        const first = entry.indexOf(" ");
        if (first === -1) return [];
        const second = entry.indexOf(" ", first + 1);
        if (second === -1) return [];
        /* LOWERCASED, BECAUSE THE ROUTE IS. `setDict` holds upstream's
           spelling — `WTR` — and `facesOf` lowercases when it builds the path,
           so taking the dictionary's spelling verbatim produced
           `/card/WTR/098/head-jab-1` for a page emitted at `/card/wtr/098/…`.
           Every `unique:art` row would have been a 404, and every one of them
           would have looked right. */
        const setCode =
          setDict[Number.parseInt(entry.slice(0, first), 10)]?.toLowerCase();
        const landscape = entry.slice(first + 1, second) === "1";
        const key = entry.slice(second + 1);
        if (setCode === undefined || key === "") return [];
        return [{ key, setCode, number: numberFor(key, setCode), landscape }];
      });
    }),
    faceSets: labels.map((_, ordinal) => {
      /* Fixed-width two, so the slice is arithmetic rather than a split — the
         same shape `typeAt` and `verdictAt` already decode with. */
      const id = Number.parseInt(
        encoded.faceSets.slice(ordinal * 2, ordinal * 2 + 2),
        36,
      );
      if (!Number.isFinite(id) || id <= 0) return "";
      return setDict[id - 1]?.toLowerCase() ?? "";
    }),
    faceLandscape: labels.map(
      (_, ordinal) => encoded.faceLandscape[ordinal] === "1",
    ),
    folded: labels.map(fold),
    labelTokens: labels.map((label) => tokeniseCard(label)),
    slugs,
    pitches,
    typeLines,
    typeTokens: typeLines.map((line) => tokeniseCard(line)),
    stats,
    keywords,
    traits,
    sets,
    released,
    undatedCards: released.filter((dates) => dates.length === 0).length,
    rarities,
    artists,
    verdicts,
    postings,
    terms: [...postings.keys()],
    flavourPostings,
    flavourTerms: [...flavourPostings.keys()],
    browse,
    size: labels.length,
  };
}
