import type { PitchValue } from "optfall-theme";

import { hrefForPrinting, numberFor } from "../printings";
import { evaluate, leaves, type QueryLeaf } from "../query";
import type { ArtRef, CardIndex } from "./decode";
import { RARITY_RANK, parseCardQuery, toCardFilter } from "./grammar";
import type {
  CardDisplayMode,
  CardFilter,
  CardNotice,
  CardSort,
  CardSortKey,
  CardUniqueMode,
} from "./grammar";
import {
  comparePrinted,
  flavourMatches,
  passesFilter,
  positiveFreeTerms,
  setFocusOf,
  textMatches,
  tokensMatch,
  valuesMatch,
} from "./match";
import { fold } from "./tokenise";

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Which field put a result on the page. This is the ranking, in order.
 *
 * 1. `name-exact` — **the name you typed.** Somebody typing a card's whole name
 *    wants that card, not the eleven cards whose text mentions it. This is the
 *    card equivalent of `./search.ts`'s identifier tier, and for the same
 *    reason: it is a destination, not a search.
 * 2. `name-prefix` — the name *starts* with what you typed, which is what makes
 *    the field usable while you are still typing it.
 * 3. `name` — every word you typed is somewhere in the name.
 * 4. `type` — every word you typed is in the printed type line, which is how
 *    `guardian` finds the class rather than the eleven cards that say the word.
 * 5. `keyword` — every word is a printed keyword or trait.
 * 6. `text` — every word is somewhere in the printed card text.
 *
 * Matching is AND, never OR: adding a word must narrow the result set, because
 * that is what a person adding a word is trying to do.
 *
 * Within a tier, ties break on corpus order, which is upstream's name sort and
 * is total — so no comparison is ever left for the engine's own sort to settle,
 * and two browsers cannot order the same query differently.
 */
export type CardMatchField =
  | "name-exact"
  | "name-prefix"
  | "name"
  | "type"
  | "keyword"
  | "text"
  | "filter";

const FIELD_RANK: Readonly<Record<CardMatchField, number>> = {
  "name-exact": 0,
  "name-prefix": 1,
  name: 2,
  type: 3,
  keyword: 4,
  text: 5,
  filter: 6,
};

/**
 * One pitch version behind a result row: which pitch, and where it lives.
 *
 * THE LABEL IS QUALIFIED, ALWAYS. It is the accessible name of a control that
 * has no text in it — a coloured band, or a stone carrying a numeral — so
 * "Pitch 2" would name three links on one screen after a value with no card
 * attached to it. See {@link CardResult.matchedVersions}.
 */
export interface CardResultVersion {
  readonly pitch: PitchValue;
  /**
   * THE PAGE THE FACE BESIDE IT IS ON, not the card's default printing.
   *
   * `focusPrinting` resolves the two in one call, so a fanned card cannot show
   * one set's art and open another's. See {@link CardResultVersion.faceKey}.
   */
  readonly href: string;
  readonly label: string;
  /**
   * THIS VERSION'S OWN PICTURE, because the versions of a name do not share one.
   *
   * The three Head Jabs are three different paintings, which is the fact that
   * makes a fan of them worth drawing at all — a stack of one image repeated
   * three times in three colours would be a decoration, and this is a choice
   * between cards.
   *
   * FROM THE SAME PRINT RUN AS THE ROW'S OWN FACE, RESOLVED BY
   * `focusPrinting` — which resolves its ADDRESS in the same call, so the two
   * cannot come from different printings. A
   * fan is a comparison between siblings, so the one axis it must not vary on
   * is the one nobody asked about: under `set:MPW` all three Hit and Runs wear
   * MPW's frame, and the reader compares the pitch stones rather than wondering
   * why one card is bordered differently from the other two. This was read
   * straight out of `faceKeys` — the card's first-ever printing — which put
   * MPW112 in front of the 1HP red and blue.
   *
   * `null` where the version publishes no art. Four cards in the corpus are in
   * that state and the placeholder is the honest rendering of it.
   */
  readonly faceKey: string | null;
  /** True where this version's face is landscape and needs a transposed box. */
  readonly faceLandscape: boolean;
}

export interface CardResult {
  /**
   * The full text a link must carry, INCLUDING the pitch qualifier where the
   * name alone does not identify the card.
   *
   * This is the ACCESSIBLE name, not necessarily the visible one. 900 names in
   * this corpus belong to more than one card, and two anchors that differ only
   * in where they point are a WCAG 2.4.4 failure — so this stays qualified even
   * where a surface chooses to print {@link name} instead and carry the
   * difference in a mark. See `CardIndexEntry`.
   */
  readonly label: string;
  /**
   * The card's name with no qualifier — what a reader sees when the interface
   * says "which version" some other way.
   *
   * Carried rather than derived at the call site because stripping the suffix
   * back off a label is a second, weaker evaluation of `variantSuffix`: a card
   * genuinely named something ending in "(pitch 2)" would be mangled by it.
   */
  readonly name: string;
  /**
   * The part of {@link label} a surface may hide — " (pitch 2)", or `""`.
   *
   * CARRIED RATHER THAN DERIVED, and the first version of this derived it by
   * subtracting `name` from `label`, which was wrong in a way only `unique:art`
   * showed: an art row's label is `"Head Jab (pitch 2) · MST131"`, so the
   * subtraction hid the ART KEY as well as the pitch and left several rows of
   * one card reading identically in every text view. The key is the only thing
   * telling those rows apart once the picture is not on screen.
   *
   * So the two halves are stated separately. `name` is everything a reader must
   * SEE — bare name, plus the art key where the row stands for one picture —
   * and this is the pitch qualifier alone, which a mark can carry instead.
   */
  readonly qualifier: string;
  readonly href: string;
  /**
   * Which pitch versions of this card matched, and how many the corpus has.
   *
   * A ROW STANDS FOR A CARD, BUT LEGALITY BELONGS TO A VERSION, and those two
   * facts collide. Measured on this corpus: four names carry pitch versions
   * whose Classic Constructed ban differs — Electromagnetic Somersault red and
   * yellow are banned and blue is legal, and Bonds of Ancestry is the other way
   * round. A `banned:cc` search that collapsed those to one bare row would put
   * a card on a banned list without saying which version was banned, which is
   * the exact "collapses two true facts into one" failure `cards.ts` builds the
   * whole verdict model to avoid.
   *
   * So the collapse keeps the count: when `matched` is shorter than `total`,
   * the row names the versions it is talking about. When they are equal — the
   * ordinary case, including every plain name search — there is nothing to
   * qualify and the row says nothing.
   *
   * EACH MATCHED VERSION CARRIES ITS OWN ADDRESS, WHICH IS WHAT MAKES THE MARK
   * A CONTROL. The row's own `href` is one destination for a row that may stand
   * for three cards; the coloured band drawn for the blue version is where a
   * reader who means the blue version aims. `CardIndex` draws those bands as
   * links, so the engine has to say where each one goes — and it can, because
   * the collapse ran over ranked rows that each knew their own slug. It was
   * throwing that away and keeping the pitch value alone.
   *
   * A ROW THAT STANDS FOR ONE CARD CARRIES ONE ENTRY, pointing at itself. The
   * index draws that as the plain unlinked mark it always did; see
   * `CardIndexEntry.versions`.
   */
  readonly matchedVersions: readonly CardResultVersion[];
  readonly totalVersions: number;
  /** Face blob key, or `null` where the card publishes no art. */
  readonly faceKey: string | null;
  /** True where the face is landscape and needs a transposed box. */
  readonly faceLandscape: boolean;
  readonly pitch: PitchValue;
  readonly typeLine: string;
  /** Cost, power and defence as printed; `""` where the card has none. */
  readonly stats: readonly (readonly [string, string])[];
  readonly matchedIn: CardMatchField;
}

export interface CardOutcome {
  readonly query: string;
  readonly terms: readonly string[];
  readonly filters: readonly CardFilter[];
  readonly notices: readonly CardNotice[];
  /**
   * The ordering that produced these results.
   *
   * Reported rather than kept private because the interface has to be able to
   * say which order it is showing — a list sorted by cost and a list sorted by
   * relevance look identical until you read them, and a reader who typed
   * `order:` deserves to see it acknowledged.
   */
  readonly sort: CardSort;
  /**
   * The level these results collapse at.
   *
   * Reported for the same reason `sort` is: `unique:art` and the default return
   * different numbers of rows for the same query, and a reader who is told "62
   * results" needs to know whether that counts cards or pictures.
   */
  readonly unique: CardUniqueMode;
  /** The shape asked for, or `null`. Resolved by the caller, not here. */
  readonly display: CardDisplayMode | null;
  readonly results: readonly CardResult[];
  /** Matches found, which may exceed the number returned. */
  readonly total: number;
  /**
   * The single set every result is restricted to, lowercased — or `null`.
   *
   * WHAT IT IS FOR: choosing which printing's art each row carries. A reader
   * who typed `set:MST` is looking at Mistveil, so the grid should be Mistveil's
   * pictures rather than each card's first-ever printing. See the face
   * resolution in `toResult`.
   *
   * IT IS NULL UNLESS THE ANSWER IS UNAMBIGUOUS, which is stricter than "the
   * query mentions a set". `set:MST or set:WTR` restricts to two, and picking
   * either would silently answer half the rows with the wrong set's art; a
   * negated `-set:MST` restricts to everything else. Both give `null`, and the
   * rows keep their own faces — the honest rendering when no single set is
   * being asked about.
   *
   * Reported on the outcome rather than kept private for the same reason `sort`
   * and `unique` are: an interface has to be able to say which printings it is
   * showing, and a set page reading this is how it stays in step with a search
   * that asks the same question.
   */
  readonly setFocus: string | null;
}

/**
 * Rows rendered at once, absent a choice. The count reported is always the true
 * total, and every row it counts is now reachable — see `./pagination.ts`,
 * which owns the steps a reader can pick and the two URL parameters that carry
 * them. This constant is the default one of those steps, kept at the number it
 * has always been.
 *
 * It used to be a hard cap with "narrow the query" printed under it, which
 * `docs/SCRYFALL-GAP.md` §4 named for what it was: "a refusal where Scryfall
 * paginates. A grid makes it worse — 60 images is under one scroll."
 *
 * IT GOVERNS THE SET PAGES TOO, which is where the old wording was not merely
 * unhelpful but meaningless: a set page's query IS the set, so there is nothing
 * to narrow. Sixty is kept rather than raised for the reason it was chosen —
 * the grid is IMAGES, and a page asking for four hundred faces at once spends
 * its first several seconds fetching pictures nobody has scrolled to.
 */
export const CARD_RESULT_LIMIT = 60;

/**
 * The printed values a row shows, in the order `docs/DESIGN.md` reads a card.
 *
 * THE SAME FIVE `statsOf` PRODUCES, AND THE ORDER IS THE SAME ONE. A set page
 * builds its rows straight from `CardPage.stats`; this builds them from the
 * index. Two lists in two files is a drift waiting to happen, so they are
 * pinned against each other in `card-search.test.ts`, under "one card index,
 * one stat vocabulary".
 */
export const STAT_LABELS = [
  "Cost",
  "Power",
  "Defence",
  "Life",
  "Intellect",
] as const;

/** `"Head Jab (pitch 2)"` → `"Head Jab"`. The suffix `labelFor` added. */
function nameOf(label: string): string {
  return label.replace(/ \((?:no pitch|pitch \d)\)$/, "");
}

/**
 * A card's own address: the URL of its default printing.
 *
 * THE INDEX ALREADY CARRIES BOTH HALVES, WHICH IS WHY THERE IS NO NEW COLUMN.
 * `faceKeys[ordinal]` is the default face and `faceSets[ordinal]` is the set it
 * came from — both shipped for the picture — and the collector-number segment
 * is a pure function of the two. So the client can build `/card/<set>/<number>/
 * <slug>` for every row without a byte added to a payload already at 934 kB.
 *
 * THE FALLBACK GOES THROUGH THE REDIRECT, DELIBERATELY. A row with no face key
 * cannot have its printing URL derived here, and `/card/<slug>` is a 301 whose
 * target was computed from the corpus at build time — so the one path that
 * cannot be resolved locally is handed to the one table that always can. It
 * costs a hop and cannot be wrong. No card in this corpus reaches it.
 */
function defaultHrefOf(index: CardIndex, ordinal: number): string {
  const slug = index.slugs[ordinal] ?? "";
  const key = index.faceKeys[ordinal];
  const setCode = index.faceSets[ordinal] ?? "";
  if (key === null || key === undefined || key === "" || setCode === "") {
    return `/card/${slug}`;
  }
  return hrefForPrinting(setCode, numberFor(key, setCode), slug);
}

/**
 * Which version a COLLAPSED row opens — the lowest-pitch one, `byPitch`'s rule.
 *
 * `/card/<nameSlug>` USED TO ANSWER THIS AND IT IS A 301 NOW. The old URL meant
 * "this name, at the version the site shows first", and the router resolved it
 * with `byPitch` in `cards.ts`. Emitting it still would work — the redirect
 * table knows the answer — but it would send every collapsed result through a
 * hop for a destination the row is already holding.
 *
 * `pitchRank`, NOT THE RAW PITCH, AND THE DIFFERENCE IS ONE REAL CARD. The
 * caller sorts these by `pitch` ascending for DISPLAY, where a card with no
 * pitch is 0 and therefore first. `byPitch` sorts it LAST. Across 900 shared
 * names exactly one group mixes the two — Hyper Driver, printed at pitch 1, 2
 * and 3 plus an unpitched version — so taking `matchedVersions[0]` would open a
 * different card there than the tab strip calls first, on one page, silently.
 * That is the whole reason this is a function and not an index lookup.
 *
 * Name + pitch is unique across the corpus (measured: zero collisions), so this
 * needs no tiebreak; `byPitch`'s `unique_id` fallback cannot be reached within
 * one name group.
 */
function nameDefaultHref(
  versions: readonly CardResultVersion[],
  fallback: string,
): string {
  /* The sentinel is above every pitch value rather than one past the highest
     one: `4` used to be both "no pitch, sorts last" and "not a pitch anybody
     prints". A pitch 4 has since been previewed, so the second half is no longer
     safe to rely on even though the pinned corpus carries no such card yet. */
  const rank = (pitch: number): number => (pitch === 0 ? 10 : pitch);
  const first = versions.toSorted((a, b) => rank(a.pitch) - rank(b.pitch))[0];
  return first?.href ?? fallback;
}

/** A picture and the page it is a picture OF. Never resolved apart. */
interface ShownPrinting {
  readonly key: string | null;
  readonly landscape: boolean;
  readonly href: string;
}

/**
 * The card's own default printing — its first one that publishes art.
 *
 * Split out from {@link focusPrinting} so the two callers that must NOT take
 * the focus set's art can say so by calling this instead of passing a `null`
 * focus they do not have.
 */
function ownFace(index: CardIndex, ordinal: number): ShownPrinting {
  return {
    key: index.faceKeys[ordinal] ?? null,
    landscape: index.faceLandscape[ordinal] === true,
    href: defaultHrefOf(index, ordinal),
  };
}

/**
 * THE PRINTING THE QUERY ASKED FOR, WHICH IS NOT ALWAYS THE CARD'S OWN.
 *
 * `faceKeys` holds the card's default face — its first printing that publishes
 * art, in corpus order. That is the right picture for a bare name search and
 * the WRONG one for `set:MST`: a card first printed in Welcome to Rathe and
 * reprinted in Mistveil showed the Rathe art under a filter naming Mistveil,
 * which is a true picture of a false claim. The reader asked what this set
 * looks like.
 *
 * AND THE ADDRESS GOES WITH THE PICTURE, WHICH IS THE HALF THIS FUNCTION USED
 * TO WITHHOLD. It returned a face only, and every doc block around it said so
 * deliberately — "`setFocus` changes which PICTURE a row carries and never
 * where it points", because a row stood for the card rather than for the
 * printing. What that produced is a grid where the cell shows MST095 and the
 * click lands on `/card/eng/025/…`: another set, another collector number, and
 * another picture than the one the reader clicked. A card image is a link to
 * the card in the image. So the rule is now the same one the set pages hold
 * (`printingForSet` in `set.page.tsx`) and the same one the version strip has
 * held since `addressInSet`: the reader who named a set stays in it.
 *
 * IT IS A FUNCTION, AND IT USED TO BE AN EXPRESSION INSIDE `toResult`. That is
 * the whole of the fix for a fan that dealt three printings from three
 * different sets. A row standing for Hit and Run under `set:MPW` resolved its
 * OWN picture here and got MPW112, while the two pitch versions stacked behind
 * it were built in the collapse loop from `faceKeys` directly and got the 1HP
 * art — so hovering opened a hand holding one card from the set the reader
 * named and two from a set they did not. The versions are the same query's
 * answer as the row is; they get the same rule, from the same code.
 *
 * THE ORIENTATION AND THE ADDRESS COME BACK WITH THE FACE, and the three are
 * resolved in one expression so they cannot come from different printings.
 * Splitting them is exactly what went wrong on an earlier pass: the key was
 * swapped to the focus set's art while `faceLandscape` went on being read from
 * `index.faceLandscape[ordinal]`, which describes the DEFAULT face. A rotated
 * alternate would then have been drawn inside a portrait box — visible at a
 * glance, and only on the printings this feature exists to show. The href had
 * the same shape of fault and was harder to see, because a wrong link looks
 * right until it is followed.
 *
 * The order is deliberate:
 *
 * 1. The default face, WHEN IT COMES FROM THE FOCUS SET. This is the common
 *    case and it costs one string comparison.
 * 2. An alternate art from the focus set, if the card has one.
 * 3. The default printing, unchanged. A card can match `set:MST` on a printing
 *    whose art is shared with an earlier set — Regular, Rainbow Foil and Cold
 *    Foil in one set are three rows and one image, and a straight reprint
 *    carries no new art at all — so "no art from this set" is a real answer
 *    rather than a lookup failure, and showing the card's own face is better
 *    than showing a placeholder. It is also the one case where a fan can still
 *    hold two sets' pictures, and it is honest: each card is wearing the art
 *    its matching printing actually carries, and opening the page that art is
 *    on. The site has no address for "this set's copy of a picture printed
 *    elsewhere" — `facesOf` dedupes by image, so those rows are one page — and
 *    inventing one here would be minting a URL the router does not emit.
 */
function focusPrinting(
  index: CardIndex,
  ordinal: number,
  setFocus: string | null,
): ShownPrinting {
  const own = ownFace(index, ordinal);
  if (setFocus === null || index.faceSets[ordinal] === setFocus) return own;
  const fromSet = (index.arts[ordinal] ?? []).find(
    (ref) => ref.setCode === setFocus,
  );
  return fromSet === undefined
    ? own
    : {
        key: fromSet.key,
        landscape: fromSet.landscape,
        /* THE ROUTER'S OWN ADDRESS FOR THIS ART. Every entry in `arts` is a
           page `CARD_ROUTES` emits — `wire.ts` says so — and `hrefForPrinting`
           is the function that emitted it, so this is the same URL rather than
           a second spelling of it. */
        href: hrefForPrinting(
          fromSet.setCode,
          fromSet.number,
          index.slugs[ordinal] ?? "",
        ),
      };
}

function toResult(
  index: CardIndex,
  ordinal: number,
  matchedIn: CardMatchField,
  matchedVersions: readonly CardResultVersion[],
  totalVersions: number,
  mode: CardUniqueMode = "names",
  /** Set when this row stands for one ALTERNATE art rather than for the card. */
  art?: ArtRef,
  /**
   * The one set the query restricted to, lowercased, or `null`.
   *
   * See {@link CardOutcome.setFocus}. It changes which PRINTING the row is
   * shown by — its picture AND its link, resolved together by `focusPrinting`
   * — and never its label or its rank. The row still stands for the card; what
   * changed is that the copy of the card it stands for is the one the reader
   * named, so the door under the picture opens on the picture.
   */
  setFocus: string | null = null,
): CardResult {
  const printed = index.stats[ordinal] ?? ["", "", "", "", ""];
  const slug = index.slugs[ordinal] ?? "";
  const nameSlug = index.nameSlugs[ordinal] ?? slug;
  /*
   * ONLY `unique:names` COLLAPSES, WHICH IS WHAT THE OPERATOR MEANS.
   *
   * This flag decides both the label and the link, so it is the whole of the
   * difference between the modes at the row level: collapsed, the row is the
   * card and wears the bare name; not collapsed, it is one version and wears
   * the pitch qualifier that tells it from its siblings.
   */
  const collapsed = mode === "names" && nameSlug !== slug;

  /**
   * A PARTIAL MATCH MUST LAND ON A VERSION THAT MATCHED.
   *
   * `/card/<nameSlug>` renders the LOWEST-PITCH version. When every version
   * matched, that is fine — whichever one opens, the reader's query is true of
   * it. When only some matched, it is a wrong answer of the exact kind this
   * project exists not to give.
   *
   * Measured on the shipped build: `banned:cc` returned four such rows, and on
   * two of them — Bonds of Ancestry and Orb-Weaver Spinneret, banned at pitch 2
   * and 3 and legal at pitch 1 — the reader clicked a result from a BANNED list
   * and arrived at a page reading **Legal**, with nothing on either surface
   * saying the version had changed underneath them.
   *
   * So a partial match links to the best-ranked version that actually matched,
   * whose own slug is `slug`. The row already names the matched pitches, so the
   * tab it opens on is the one the row is talking about, and the other versions
   * are one click away in the strip.
   */
  const partial = matchedVersions.length < totalVersions;

  /*
   * The label's two halves, split once.
   *
   * `nameOf` strips exactly the suffix `labelFor` added, so whatever is left
   * over IS that suffix — which means there is no second pattern here to keep
   * in step with `variantSuffix`, only the one already in `nameOf`.
   */
  const fullLabel = index.labels[ordinal] ?? "";
  const bareName = nameOf(fullLabel);
  const pitchSuffix = fullLabel.slice(bareName.length);
  const artStem = art === undefined ? "" : art.key.replace(/\.webp$/, "");

  /**
   * The picture this row carries. `focusPrinting` states the rule; the two
   * guards ahead of it are the two rows that are already printings and must
   * keep the art they are standing for.
   *
   * 1. An ART ROW already IS a printing, so it keeps its own face. `unique:art`
   *    expands a card into its arts; overriding one of them with the focus
   *    set's art would collapse the expansion it just performed.
   * 2. IN `unique:art`, EVERY ROW IS A PRINTING — INCLUDING THE ONE BEING
   *    EXPANDED. `mode === "art"` yields a card's default face plus one row per
   *    alternate, so the row reached here is the DEFAULT ART rather than a
   *    stand-in for the card. Letting it take the focus set's art meant
   *    `set:lgs unique:art` rendered the card row wearing the LGS art and then
   *    the LGS art row immediately beneath it — the same picture twice,
   *    adjacent, which is the duplication the mode exists to avoid. The guard
   *    above it covers only the rows the expansion ADDED, not the one it was
   *    expanding.
   *
   * BOTH GUARDS NOW COVER THE ADDRESS AS WELL, since `ownPrinting` decides it.
   * Case 2 is where that mattered: the row kept its own face while its href
   * took the focus set's printing, so the default-art row pointed at the art
   * row beneath it.
   */
  /**
   * WHERE THE ROW GOES, RESOLVED BEFORE ITS PICTURE IS, because the picture is
   * a fact about the destination. See {@link shown}.
   *
   * THE FOCUS SET'S PRINTING, NOT THE CARD'S DEFAULT ONE. This read
   * `defaultHrefOf` on both of the branches below that are not art rows, and a
   * `set:MST` grid therefore drew Mistveil faces over links to whichever set
   * printed each card first. `focusPrinting` resolves the two together now, so
   * the row cannot show one printing and open another; the collapsed branch
   * gets it for free, because `matchedVersions` were resolved by the same
   * function in the collapse loop.
   */
  const ownPrinting =
    mode === "art"
      ? /* IN `unique:art` THE ROW BEING EXPANDED KEEPS ITS OWN ADDRESS, for
           exactly the reason it keeps its own face two guards below: it is the
           DEFAULT ART row, and letting it take the focus set's printing would
           point it at the art row rendered directly beneath it. Measured while
           writing this: `set:mon unique:art` had Writhing Beast Hulk's LEV016
           row opening `/card/mon/129`, which is the MON129 row under it. */
        ownFace(index, ordinal)
      : focusPrinting(index, ordinal, setFocus);
  const href =
    art !== undefined
      ? hrefForPrinting(art.setCode, art.number, slug)
      : collapsed && !partial
        ? nameDefaultHref(matchedVersions, ownPrinting.href)
        : ownPrinting.href;

  const shown = (() => {
    if (art !== undefined) return { key: art.key, landscape: art.landscape };
    if (mode === "art") return ownPrinting;

    /**
     * A ROW WEARS THE FACE OF THE CARD IT OPENS, WHICH IS NOT ALWAYS `ordinal`.
     *
     * A collapsed row is built from the BEST-RANKED version of its name and
     * opens the LOWEST-PITCH one — `nameDefaultHref`'s rule, and the right one,
     * since that is the version the card page used to answer with. Those are
     * usually the same card and they are not always: Deadly Display sits at
     * pitch 2, 1, 3 in corpus order, so under `set:MPW` the row was built from
     * pitch 2 and pointed at pitch 1.
     *
     * The picture came from the ordinal and the link from the rule, and nothing
     * made them agree — so the cell showed MPW081 and opened pitch 1, whose own
     * art is MPW080. In the grid that is worse than a mismatched link: the fan
     * drops the version the cell already points at, so the hand held MPW081
     * twice, once as the front card and once as the pitch-2 card behind it, and
     * pitch 1 was the one version of three that never appeared. A duplicate in
     * a fan of three reads as exactly the rendering fault it is.
     *
     * Taken from the version rather than re-resolved from its ordinal because
     * the versions have already been through `focusPrinting` — resolving it
     * twice is how the row and the fan came to disagree in the first place.
     *
     * MATCHED BY ADDRESS, WHICH STILL HOLDS NOW THE ADDRESSES ARE THIS SET'S:
     * the row's href and the versions' both come from `focusPrinting` under the
     * same `setFocus`, so the two spellings of one printing are one string.
     *
     * The fallback is not reachable from either caller — a collapsed row's
     * href is always one of its own versions' — and it is the honest answer if
     * one ever stops being: the row's own printing, by the same rule.
     */
    const opened = matchedVersions.find((version) => version.href === href);
    return opened === undefined
      ? ownPrinting
      : { key: opened.faceKey, landscape: opened.faceLandscape };
  })();

  return {
    // THE BARE NAME WHEN THE ROW STANDS FOR THE WHOLE CARD. Everywhere a row
    // points at ONE version it must render the disambiguated label, or two
    // anchors differ only in where they point. A row that stands for the card
    // carries the bare name, which is unambiguous — and where the row is
    // partial, the version qualifier beside it does the disambiguating.
    /*
     * AN ART ROW SAYS WHICH ART IN ITS LABEL, because two rows for one card
     * differing only in picture are two identical anchors — the exact failure
     * the note above describes for pitch versions, arrived at from the other
     * direction. `ResultRow` takes a plain string for accessibility, so the
     * qualifier has to be in it rather than beside it.
     */
    /*
      ALWAYS `name` + `qualifier`, in that order, so the string a surface
      assembles from the two halves IS this one. An art row used to read
      "Head Jab (pitch 2) · MST131" while the rendered anchor read
      "Head Jab · MST131 (pitch 2)" — same words, different order, so the
      identity the two doc blocks assert quietly failed on the one mode nothing
      tested. The art key sits with the name because both are visible; the pitch
      trails because it is the half a mark can carry instead.
    */
    label:
      art !== undefined
        ? `${bareName} · ${artStem}${pitchSuffix}`
        : collapsed
          ? bareName
          : fullLabel,
    /*
      WHAT A READER MUST SEE, which is not the same as what the anchor is named.
      The bare name, plus the art key where the row stands for one PICTURE
      rather than for the card — that key is the only thing telling one card's
      art rows apart in a view that has no pictures in it. The pitch is
      deliberately not here: it rides in `qualifier`, because a mark can carry
      it and four words on every row cannot.
    */
    name: art === undefined ? bareName : `${bareName} · ${artStem}`,
    /* Empty where the row already stands for the whole name and there is
       nothing left to qualify. */
    qualifier: collapsed ? "" : pitchSuffix,
    href,
    matchedVersions,
    totalVersions,
    faceKey: shown.key,
    faceLandscape: shown.landscape,
    pitch: index.pitches[ordinal] ?? 0,
    typeLine: index.typeLines[ordinal] ?? "",
    stats: STAT_LABELS.map(
      (label, position) => [label, printed[position] ?? ""] as const,
    ).filter(([, value]) => value !== ""),
    matchedIn,
  };
}

/**
 * Run a query. Pure: same index and same string, same array, every time.
 */
/**
 * The value a card sorts by, for one key.
 *
 * Returns a number where the key has an order and a string where it has an
 * alphabet, plus a flag for "this card has no value here at all". That third
 * state is the one that matters: a printed cost of `X`, or a card with no
 * defence, is not a zero and must not sort as one.
 */
function sortValue(
  index: CardIndex,
  ordinal: number,
  key: CardSortKey,
): {
  readonly text?: string;
  readonly rank?: number;
  readonly missing: boolean;
} {
  const stat = (position: 0 | 1 | 2) => {
    const raw = index.stats[ordinal]?.[position] ?? "";
    if (raw === "") return { missing: true };
    const numeric = Number(raw);
    return Number.isFinite(numeric)
      ? { rank: numeric, missing: false }
      : { missing: true };
  };

  switch (key) {
    case "name":
      return { text: index.labels[ordinal] ?? "", missing: false };
    case "pitch": {
      const pitch = index.pitches[ordinal] ?? 0;
      return pitch === 0 ? { missing: true } : { rank: pitch, missing: false };
    }
    case "cost":
      return stat(0);
    case "power":
      return stat(1);
    case "defence":
      return stat(2);
    case "rarity": {
      /* A printing-level field on a card-level row: a card sorts by the
         SCARCEST rarity it was ever printed at, because that is the one a
         reader means when they call a card rare. */
      const ranks = (index.rarities[ordinal] ?? [])
        .map((code) => RARITY_RANK[code.toUpperCase()])
        .filter((rank): rank is number => rank !== undefined);
      return ranks.length === 0
        ? { missing: true }
        : { rank: Math.max(...ranks), missing: false };
    }
    case "released": {
      /* THE EARLIEST DATE, which is when the card came out — a reprint is not a
         release. `released` is stored ascending, so the first entry is it.

         Compared as TEXT rather than parsed: `YYYY-MM-DD` sorts correctly as a
         string, and a Date would introduce a timezone to a value that has none.

         Missing where every set the card appears in is undated, which is 17 of
         118 sets — the judge, organised-play and promo lines. Those sort last
         in both directions, exactly as an unprinted cost does. */
      const first = index.released[ordinal]?.[0];
      return first === undefined
        ? { missing: true }
        : { text: first, missing: false };
    }
    case "set": {
      /* And by the FIRST set it appeared in, for the same reason in the other
         direction: a card belongs to where it came from, not to the most recent
         reprint that happens to sort last alphabetically. */
      const sets = (index.sets[ordinal] ?? []).toSorted();
      const first = sets[0];
      return first === undefined
        ? { missing: true }
        : { text: first, missing: false };
    }
  }
}

/**
 * Order results by a printed value.
 *
 * TWO RULES CARRY THE WHOLE THING, and both are about honesty rather than
 * ordering.
 *
 * A CARD WITH NO VALUE SORTS LAST, IN BOTH DIRECTIONS. Printed costs in this
 * corpus include `X`, `XX` and blanks; a card with no defence has no defence
 * rather than zero of it. Sorting those to the front under `dir:desc` would be
 * asserting they are the largest, and to the front under `asc` that they are
 * the smallest. They are neither, so they go to the end either way and the
 * direction applies only to the cards that have a value. It is the same
 * decision `cost>=3` already makes by not matching them.
 *
 * CORPUS ORDER IS THE FINAL TIEBREAK, never relevance. Once a reader has asked
 * for cost order, two cards costing 2 are equal and the result has to be
 * STABLE — the same query returning the same page in the same order every time
 * is worth more here than a second opinion about which of them is a better
 * match.
 */
function compareBySort(
  index: CardIndex,
  sort: CardSort,
  a: number,
  b: number,
): number {
  const key = sort.key;
  if (key === null) return 0;

  const left = sortValue(index, a, key);
  const right = sortValue(index, b, key);

  if (left.missing !== right.missing) return left.missing ? 1 : -1;
  if (left.missing) return a - b;

  const sign = sort.direction === "desc" ? -1 : 1;

  if (left.rank !== undefined && right.rank !== undefined) {
    const difference = left.rank - right.rank;
    if (difference !== 0) return sign * difference;
    return a - b;
  }

  const compared = (left.text ?? "").localeCompare(right.text ?? "", "en");
  if (compared !== 0) return sign * compared;
  return a - b;
}

/**
 * Run a card query.
 *
 * `limit` AND `offset` ARE APPLIED LAST, AFTER RANKING, COLLAPSING AND THE
 * `unique:` EXPANSION — which is what makes paging safe on this engine in
 * particular. `unique:names` collapses pitch versions to one row and
 * `unique:art` expands a row per picture, so the number of ROWS is decided long
 * after the number of MATCHES is; slicing any earlier would page over a list
 * that is not the list on screen, and the page boundaries would land in
 * different places depending on which mode was in force.
 *
 * `total` is the length of that final row list, so the count and the pages are
 * two statements about one number.
 *
 * `limit` accepts `Number.POSITIVE_INFINITY`, which is how "show me all of
 * them" reaches here. `slice` clamps it to the length, so no cap survives.
 */
export function searchCards(
  index: CardIndex,
  raw: string,
  limit: number = CARD_RESULT_LIMIT,
  /**
   * How many ranked rows to skip — `(page - 1) * limit`.
   *
   * A PAGE IS CUT HERE RATHER THAN IN THE COMPONENT, and the difference is what
   * gets built. Slicing after the fact would mean assembling a `CardResult` for
   * every match — labels, hrefs, resolved faces, stat pairs — to render sixty
   * of them, and `type:action` matches upwards of a thousand. Ranking is
   * unavoidable and cheap; result construction is avoidable, so it is avoided.
   */
  offset = 0,
): CardOutcome {
  const { terms, filters, notices, sort, unique, display, folded, tree } =
    parseCardQuery(raw);

  /*
    SAID HERE RATHER THAN AT PARSE TIME, because only the index knows how many
    cards it cannot date and the parser has never seen it. A notice is the
    engine's way of refusing to answer more confidently than its data allows,
    and `year:`/`date:` is the one operator whose silent misses are invisible:
    the reader gets a plausible list and no reason to suspect it is short.
  */
  const dateFiltered =
    tree !== null && leaves(tree).some((leaf) => leaf.field === "released");

  /*
    A SET CODE THAT NAMES NO SET, SAID OUT LOUD.

    `set:zzz` returned an empty page and explained nothing, which is the same
    page `set:wtr pitch:9` returns — and a reader cannot tell "there is no such
    set" from "no cards match" by looking at either. `docs/DESIGN.md` is
    explicit that a query which silently does something other than what it says
    is the one failure that breaks the grammar for good, and `legal:` has always
    named the six formats when it does not recognise one. This is that, for the
    operator most likely to be typed from memory.

    HERE RATHER THAN AT PARSE TIME, for the reason the date notice above gives:
    only the index knows which sets exist. The parser has never seen it.

    IT NAMES WHAT IT COULD NOT RESOLVE AND DOES NOT COUNT WHAT IT COULD. There
    are 112 set codes and listing them would bury the answer; `/sets` is the
    page that shows them, so the notice points there.
  */
  const unknownSets =
    tree === null
      ? []
      : [
          ...new Set(
            leaves(tree)
              .filter(
                (leaf) =>
                  leaf.field === "set" &&
                  !index.setCodes.has(leaf.value.toLowerCase()),
              )
              .map((leaf) => leaf.value),
          ),
        ];

  const withNotices =
    dateFiltered && index.undatedCards > 0
      ? [
          ...notices,
          {
            kind: "coverage-partial" as const,
            /* ENTRIES, NOT CARDS, and the distinction is this corpus's
               oldest units trap: an index row is a pitch version, so the three
               Head Jabs are three entries and one card. The count beside the
               results is in whatever `unique:` mode is active — names by
               default — so calling this one "cards" would put two different
               units side by side and invite the reader to subtract them. */
            text: `${index.undatedCards} card entries are printed only in sets upstream publishes no release date for, so no year: or date: filter can match them. They are excluded rather than guessed at.`,
          },
        ]
      : notices;

  /* Appended after the date notice rather than woven into it: the two are
     independent, and a query can trip both. */
  const allNotices =
    unknownSets.length === 0
      ? withNotices
      : [
          ...withNotices,
          {
            kind: "operand-unknown" as const,
            text: `${unknownSets.map((code) => `set:${code}`).join(", ")} ${unknownSets.length === 1 ? "names no set" : "name no set"} Optfall carries. Every set code is on /sets.`,
          },
        ];

  const ranked: { ordinal: number; field: CardMatchField }[] = [];

  if (tree === null) {
    return {
      query: raw,
      terms,
      filters,
      notices: allNotices,
      sort,
      unique,
      display,
      results: [],
      total: 0,
      setFocus: null,
    };
  }

  /* Resolved once, from the tree, and handed to every row. */
  const setFocus = setFocusOf(tree);

  /*
    TEXT POSTINGS ARE RESOLVED ONCE, BEFORE THE WALK. They are the only lookup
    that is not a linear scan, and the tree can mention the same term more than
    once — `text:strike or name:strike` — so resolving inside the per-card test
    would redo a postings walk 4,941 times per occurrence. Every distinct text
    value becomes a set here, and the leaf test is a membership check.
  */
  const textSets = new Map<string, ReadonlySet<number>>();
  const flavourSets = new Map<string, ReadonlySet<number>>();
  for (const leaf of leaves(tree)) {
    if (leaf.field === "text" || leaf.field === "any") {
      if (!textSets.has(leaf.value))
        textSets.set(leaf.value, textMatches(index, leaf.value));
    }
    if (leaf.field === "flavour" && !flavourSets.has(leaf.value)) {
      flavourSets.set(leaf.value, flavourMatches(index, leaf.value));
    }
  }

  /** Whether one card satisfies one leaf. The corpus half of the grammar. */
  const test = (leaf: QueryLeaf, ordinal: number): boolean => {
    if (leaf.field === "any") {
      // A free word matches the card anywhere it can: the name, the printed
      // type line, a keyword or trait, or the printed text. The TIER it matched
      // in decides ranking, and that is computed separately below.
      return (
        tokensMatch(index.labelTokens[ordinal] ?? [], leaf.value) ||
        tokensMatch(index.typeTokens[ordinal] ?? [], leaf.value) ||
        valuesMatch(index.keywords[ordinal] ?? [], leaf.value) ||
        valuesMatch(index.traits[ordinal] ?? [], leaf.value) ||
        textSets.get(leaf.value)?.has(ordinal) === true
      );
    }

    if (leaf.field === "text")
      return textSets.get(leaf.value)?.has(ordinal) === true;

    /* NOT FOLDED INTO THE FREE-WORD BRANCH ABOVE, deliberately. A bare word
       searches what a card DOES; flavour is what it says about itself, and a
       reader looking for cards that mention blood in their rules text is not
       asking for the one whose flavour quotes a poem about it. `ft:` is opt-in
       for that reason. */
    if (leaf.field === "flavour")
      return flavourSets.get(leaf.value)?.has(ordinal) === true;

    /*
      RELEASE DATES, COMPARED AS TEXT. `YYYY-MM-DD` and `YYYY` both sort
      correctly as strings, so a comparison needs no parsing and introduces no
      timezone to a value that has none. The year grain compares the first four
      characters of each date, which is the same operation the reader means.
    */
    if (leaf.field === "released") {
      const dates = index.released[ordinal] ?? [];
      if (dates.length === 0) return false;

      const grain = leaf.value.length === 4 ? 4 : 10;
      const wanted = leaf.value;
      const at = (date: string) => date.slice(0, grain);

      return dates.some((date) => {
        const value = at(date);
        switch (leaf.compare) {
          case ">":
            return value > wanted;
          case ">=":
            return value >= wanted;
          case "<":
            return value < wanted;
          case "<=":
            return value <= wanted;
          default:
            return value === wanted;
        }
      });
    }

    if (leaf.field === "name-exact") {
      // AGAINST THE BARE NAME, not the disambiguated label. `index.folded`
      // folds "Head Jab (pitch 1)", so `!"Head Jab"` matched nothing at all on
      // the 900 names that carry a variant suffix — which is most of the names
      // anybody would reach for the exact operator to pin down.
      return fold(nameOf(index.labels[ordinal] ?? "")) === leaf.value;
    }

    if (leaf.compare !== undefined) return comparePrinted(index, ordinal, leaf);

    return passesFilter(index, ordinal, toCardFilter(leaf));
  };

  /* The free words, for ranking. A word under a NOT is excluded: a card is not
     ranked by a term the reader asked it NOT to contain. */
  const positiveTerms = positiveFreeTerms(tree);

  for (let ordinal = 0; ordinal < index.size; ordinal += 1) {
    if (!evaluate(tree, ordinal, test)) continue;

    if (positiveTerms.length === 0) {
      ranked.push({ ordinal, field: "filter" });
      continue;
    }

    const nameTokens = index.labelTokens[ordinal] ?? [];
    const typeTokens = index.typeTokens[ordinal] ?? [];
    const vocabulary = (index.keywords[ordinal] ?? []).concat(
      index.traits[ordinal] ?? [],
    );

    const inName = positiveTerms.every((term) => tokensMatch(nameTokens, term));
    const inType = positiveTerms.every((term) => tokensMatch(typeTokens, term));
    const inVocabulary = positiveTerms.every((term) =>
      valuesMatch(vocabulary, term),
    );

    const label = index.folded[ordinal] ?? "";
    const field: CardMatchField = !inName
      ? inType
        ? "type"
        : inVocabulary
          ? "keyword"
          : "text"
      : label === folded
        ? "name-exact"
        : label.startsWith(folded)
          ? "name-prefix"
          : "name";

    ranked.push({ ordinal, field });
  }

  /*
    RELEVANCE UNLESS ASKED OTHERWISE. `order:` replaces the ranking rather than
    refining it: a reader who has asked for cost order wants cost order, and
    keeping "name match beats text match" as the primary key would give them a
    list that is only locally sorted and looks broken.
  */
  ranked.sort((a, b) =>
    sort.key === null
      ? FIELD_RANK[a.field] - FIELD_RANK[b.field] || a.ordinal - b.ordinal
      : compareBySort(index, sort, a.ordinal, b.ordinal),
  );

  /**
   * PITCH VERSIONS COLLAPSE TO ONE RESULT.
   *
   * A player calls the red, yellow and blue versions of a card ONE card, and
   * searching "head jab" should not answer with three rows that differ only by
   * a jewel. So results are grouped by bare-name slug and the best-ranked
   * version of each stands for the group, linking to the card page — where the
   * versions are tabs.
   *
   * NOTHING IS HIDDEN BY THIS, and that distinction matters. The grouping runs
   * AFTER matching, so a query that only one version satisfies still finds the
   * card: `text:` terms unique to the blue version put the card on the page,
   * and the tab strip is one click from the text that matched. What collapses
   * is the presentation, never the search.
   *
   * `total` counts CARDS after collapsing rather than corpus rows, because it
   * is the number a reader is told — "3 cards match" has to mean three things
   * they can click, not three rows two of which go to the same page.
   */
  const bestByName = new Map<
    string,
    { ordinal: number; field: CardMatchField }
  >();
  /*
    THE MATCHED VERSIONS, WITH THEIR ADDRESSES — not the pitch values alone.

    This map used to collect `PitchValue`s, which was everything the row needed
    while its mark was decoration: three bands, three colours, one destination.
    The bands are links now, so the collapse has to keep WHICH ROW each pitch
    came from — and the only place that is known is here, walking the ranked
    rows, each of which carries its own slug and its own label. Recovering it
    afterwards from the pitch alone would mean looking a version up by name and
    pitch, which is a second index of a fact this loop is already holding.
  */
  const matchedByName = new Map<string, CardResultVersion[]>();
  for (const row of ranked) {
    const name = index.nameSlugs[row.ordinal] ?? index.slugs[row.ordinal] ?? "";
    /*
      THE SAME PRINTING RULE THE ROW ITSELF GETS — `focusPrinting`, not
      `faceKeys`.

      This read `faceKeys` directly, and carried a comment defending it: a
      fanned version is a link to a CARD, so let it wear that card's default
      art the same way its own page does. That argument is about ONE card in
      isolation and the fan is not one card. `set:MPW` on Hit and Run dealt a
      hand of MPW112 in front — `toResult` had resolved the focus art for the
      row — with the 1HP red and blue behind it, so the reader who asked what
      one set printed got a fan of two sets and no way to tell which card came
      from where. The versions in a fan are siblings, and siblings from
      different print runs is the one thing a fan must not show.

      "A printing question asked of a row answering a name question" was the
      other half of that defence, and it had the direction backwards: the row
      is already answering the printing question — that is what `setFocus` IS —
      and the versions were the only part of the answer not hearing it.
    */
    const versionPrinting = focusPrinting(index, row.ordinal, setFocus);
    const version: CardResultVersion = {
      pitch: index.pitches[row.ordinal] ?? 0,
      /* THE PAGE THE FACE ON IT IS FROM. This read `defaultHrefOf` and said so
         at length — "a fanned card is a door to a CARD, whichever printing's
         art is on the door" — which made every card in a `set:MPW` fan a door
         painted with one set's art and opening onto another's. Under
         `setFocus` a fanned face IS a printing; the door goes where the paint
         says. */
      href: versionPrinting.href,
      label: index.labels[row.ordinal] ?? "",
      faceKey: versionPrinting.key,
      faceLandscape: versionPrinting.landscape,
    };
    const versions = matchedByName.get(name);
    if (versions) versions.push(version);
    else matchedByName.set(name, [version]);
    // `ranked` is already in rank order, so the first sighting is the best one.
    if (!bestByName.has(name)) bestByName.set(name, row);
  }

  /*
    THE OTHER TWO MODES EXPAND WHERE THE DEFAULT COLLAPSES, and they are built
    from `ranked` rather than from `collapsed` — which is the one thing that
    could have gone quietly wrong here. Collapsing first and expanding after
    would have kept only the best-ranked version of each name and then shown
    that one version's arts, so `unique:cards` would have returned exactly as
    many rows as the default and `unique:art` would have silently dropped every
    alternate art belonging to a sibling version.

    Rank order carries through untouched. `ranked` is already sorted, so the
    rows come out in the order the reader asked for, with a card's own picture
    ahead of its alternates because that is the order `arts` is stored in.
  */
  const rows: { ordinal: number; field: CardMatchField; art?: ArtRef }[] = [];
  if (unique === "names") rows.push(...bestByName.values());
  else if (unique === "cards") rows.push(...ranked);
  else {
    for (const row of ranked) {
      rows.push(row);
      for (const art of index.arts[row.ordinal] ?? []) {
        rows.push({ ordinal: row.ordinal, field: row.field, art });
      }
    }
  }

  /*
    A ROW STANDS FOR THE WHOLE NAME ONLY IN `unique:names`. In the other two
    modes it stands for one version, so the "2 of 3 versions matched" note is
    not merely unnecessary — it would be false, since the row no longer speaks
    for the versions it is sitting next to.
  */
  const nameOfRow = (ordinal: number) =>
    index.nameSlugs[ordinal] ?? index.slugs[ordinal] ?? "";

  return {
    query: raw,
    terms,
    filters,
    notices: allNotices,
    sort,
    unique,
    display,
    results: rows.slice(offset, offset + limit).map((row) => {
      const name = nameOfRow(row.ordinal);
      /* The printing the ONE version a non-collapsed row stands for is shown
         by; see where it is used, two lines down, for why the mode decides
         it. */
      const soloPrinting =
        unique === "art"
          ? ownFace(index, row.ordinal)
          : focusPrinting(index, row.ordinal, setFocus);
      const matched =
        unique === "names"
          ? (matchedByName.get(name) ?? []).toSorted(
              (a, b) => a.pitch - b.pitch,
            )
          : [
              {
                pitch: index.pitches[row.ordinal] ?? 0,
                /* THE PRINTING THE SOLE VERSION IS SHOWN BY, WHICH IS WHERE ITS
                   FACE AND ITS MARK BOTH POINT.

                   IN `unique:art` THAT IS THE CARD'S OWN PAGE, NEVER THE ART
                   ROW'S PRINTING URL: the row's `href` is one picture of the
                   card, while the mark beside it stands for the CARD's pitch,
                   so it points where the pitch is a fact — the card's own
                   default printing. `ownFace` answers exactly that.

                   IN `unique:cards` IT IS THE FOCUS SET'S, and that difference
                   is load-bearing rather than tidiness. The row and its sole
                   version are the same card at the same address, and `toResult`
                   takes a row's picture FROM the version it opens — so reading
                   the default printing here would have quietly undone the
                   set-focus swap on every `set:X unique:cards` row, in the
                   picture before, and in the address now that the two travel
                   together. */
                href: soloPrinting.href,
                label: index.labels[row.ordinal] ?? "",
                faceKey: soloPrinting.key,
                faceLandscape: soloPrinting.landscape,
              },
            ];
      const versions =
        unique === "names"
          ? (index.versionsByName.get(name) ?? 1)
          : matched.length;

      return toResult(
        index,
        row.ordinal,
        row.field,
        matched,
        versions,
        unique,
        row.art,
        setFocus,
      );
    }),
    total: rows.length,
    setFocus,
  };
}
