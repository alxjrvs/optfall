import type { StateTone } from "optfall-theme";

/* -------------------------------------------------------------------------- */
/* The wire format                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The index as it crosses from the build into the page.
 *
 * NEWLINE-JOINED STRINGS AND BASE-36 IDS, NOT AN ARRAY OF OBJECTS.
 *
 * ~~The reason `../search.ts` measures: an island's props are JSON-serialised
 * into an HTML attribute, so every `"` in the payload becomes six bytes of
 * `&quot;`.~~ **That was the original reason and it has expired.** The index is
 * a `.json` FILE now (`ssg/searchIndexes.ts`), fetched by the island rather
 * than carried in a `data-props` attribute, so nothing escapes anything and
 * the hundred thousand quotes an object-per-card format would carry would cost
 * two bytes each rather than six.
 *
 * **THE FORMAT STAYS, AND THE ARGUMENT FOR IT IS A PLAINER ONE NOW.** Six bytes
 * a quote was the dramatic number; the boring number is that an object per card
 * repeats every field NAME 4,941 times, and this does not repeat them at all.
 * Measured on this corpus: 888 KB as it stands. That is still what is fetched
 * and still what is parsed on the client, so it is still worth being small —
 * the escaping was an amplifier on a cost that exists without it.
 *
 * THE SLUGS ARE SHIPPED RATHER THAN RE-DERIVED, and that is a deliberate trade
 * of about 100 KB. `slugify` is pure, so a browser could recompute a URL from a
 * name — but then the address a link points at would be produced by a second
 * evaluation of the rule rather than read off the one the build already
 * committed to, and a reference work should not have two places a permalink can
 * come from. The build's answer is the answer.
 */
export interface EncodedCardIndex {
  /** The upstream commit the corpus was pinned at. Displayed, never parsed. */
  readonly commit: string;
  /** `YYYY-MM-DD` the corpus was last confirmed against upstream. */
  readonly confirmed: string;
  /** Disambiguated card labels, one per line, in corpus order. */
  readonly labels: string;
  /** Card slugs, one per line. */
  readonly slugs: string;
  /**
   * The BARE NAME slug per card, one per line — `head-jab` for all three of
   * `head-jab-1`, `-2` and `-3`.
   *
   * This is what lets a search collapse the pitch versions of a card into one
   * result. It is shipped rather than derived by stripping a `-N` suffix,
   * because that would be a second, weaker evaluation of the slug rule: a card
   * genuinely named something ending in a digit would be mangled by it, and a
   * reference work should not have two places a permalink can come from.
   */
  readonly nameSlugs: string;
  /**
   * Face blob keys, one per line, empty where the card publishes no art.
   *
   * SHIPPED RATHER THAN DERIVED, for the same reason the slugs are: the key is
   * a pure function of an image URL, but the URL lives in the 18 MB corpus that
   * deliberately never reaches a browser. The build already resolved it, so the
   * index carries the answer rather than the input.
   *
   * About 130 KB across 4,941 cards, and it is what turns a text result list
   * into a grid of card faces.
   */
  readonly faceKeys: string;
  /**
   * The card's OTHER arts — one line per card, `\t` between entries, each
   * entry `<setId> <faceKey>`.
   *
   * This is what `unique:art` needs and nothing else does, so it is worth
   * saying what it deliberately is not. It is NOT every printing: the corpus
   * has 16,502 printing rows and 11,378 distinct images, because Regular /
   * Rainbow Foil / Cold Foil in one set are three rows sharing one picture.
   * And it is NOT every art either — the card's own face is already in
   * `faceKeys`, so listing it again would be 4,941 duplicated strings to say
   * something the index already says.
   *
   * SO IT IS THE 6,437 NON-DEFAULT FACES. This used to be exactly the set
   * `cards.ts` emits a URL for, and it is not any more — every one of the
   * 11,378 has an address now, the default included. What survives the change
   * is the omission itself: the default face's URL is DERIVABLE from
   * `faceKeys` and `faceSets`, which ship for the picture anyway, so carrying
   * it here would still be repetition. Every entry written here is still a page
   * that exists; they are simply no longer the only ones.
   *
   * The set id rather than the set code, because `setDict` is already shipped
   * and 112 codes across 6,437 entries is 26 KB of repetition otherwise. The
   * collector number is not carried at all — it is a pure function of the key
   * and the code, and deriving it costs nothing next to shipping it.
   *
   * Measured: 69 KB on what is now an 888 KB payload. Storing every art
   * instead of the non-default ones would have been 122 KB for the same
   * feature.
   */
  readonly arts: string;
  /**
   * Which set {@link EncodedCardIndex.faceKeys} came from — two base-36
   * characters per card, `setDict` index PLUS ONE, and `00` where the card
   * publishes no art at all.
   *
   * WITHOUT THIS THE INDEX CANNOT ANSWER "SHOW ME THIS SET'S PRINTING", which
   * is what a `set:MST` search is asking for. `arts` carries a set code beside
   * every NON-default face, deliberately — the default one "is already in
   * `faceKeys`". True, and the omission made the default face the one printing
   * whose set was unknown, so a set-scoped search could resolve every art
   * except the one it was most likely to want. Measured on this corpus: 2,239
   * of the 4,941 cards are printed in more than one set, and ALL 2,239 have at
   * least one set whose art differs from their default face — so every one of
   * them could show the wrong set's picture under a filter naming a set,
   * silently, and looking entirely correct.
   *
   * PLUS ONE SO THAT ZERO CAN MEAN ABSENCE. `setDict` is zero-indexed and its
   * first entry is a real set, so `00` would otherwise be indistinguishable
   * from "printed in whichever set happens to sort first". Four cards in this
   * corpus have no face; they get `00` and keep the placeholder.
   *
   * Two characters, 4,941 cards: 9.6 KB, and it is the difference between a
   * set page showing the set's art and showing art from somewhere else.
   */
  readonly faceSets: string;
  /**
   * One digit per card: `1` where the face is landscape, `0` where portrait.
   *
   * Needed because the box has to be right BEFORE the image loads, and a
   * portrait box around a landscape face is visible at a glance. 15 cards are
   * played horizontally.
   */
  readonly faceLandscape: string;
  /** One digit per card: `0`–`3`. */
  readonly pitches: string;
  /** Printed type lines, deduplicated, one per line. */
  readonly typeDict: string;
  /** Two base-36 characters per card, indexing {@link EncodedCardIndex.typeDict}. */
  readonly typeAt: string;
  /**
   * `cost\tpower\tdefence\tlife\tintellect` per card, one line each, empty
   * where a card does not print that value.
   *
   * IT CARRIED THREE, AND THAT MADE ONE RENDERING SPEAK TWO VOCABULARIES. The
   * rows view of `CardIndex` is the same component on `/search` and on a set
   * page, but the set page builds its rows from `CardPage.stats` — which
   * `cards.ts` assembles as the whole list — while a search row could only ever
   * offer the three this line held. So a hero read `Life 20 · Intellect 4` on
   * `/sets/mon` and carried no stats at all on `/search?q=set:mon`, in the one
   * rendering the component exists to make identical.
   *
   * IT THEN CARRIED SIX, and the sixth was `arcane`, which is not a printed
   * stat at all — see `STAT_ORDER` in `cards.ts` for why it is gone from every
   * surface that showed it. Nothing decoded position five once nothing rendered
   * it, so the column went with the display rather than lingering as payload
   * with no reader.
   *
   * The last two are display-only: no filter reads them, and `cost`, `power`
   * and `defence` stay first so the comparison operators keep indexing
   * positionally. About 10 KB across 4,941 cards — measured, and 5 KB less than
   * the three that were here before arcane left — most of it the empty strings
   * of cards that print neither, which is the honest price of the two surfaces
   * agreeing.
   */
  readonly stats: string;
  /** Keyword vocabulary, one per line. */
  readonly keywordDict: string;
  /** Trait vocabulary, one per line. */
  readonly traitDict: string;
  /** Set-code vocabulary, one per line. */
  readonly setDict: string;
  /**
   * `YYYY-MM-DD` per entry of {@link EncodedCardIndex.setDict}, one per line,
   * EMPTY where upstream publishes no date for that set.
   *
   * Seventeen of the 118 sets are undated — the judge, organised-play and
   * promo lines — so the empty line is a real state carrying a real meaning
   * rather than a gap to be filled in later. A card known only from those sets
   * has no release date, and `order:released`, `year:` and `date:` all have to
   * say so rather than guess one.
   *
   * A parallel array rather than a `code=date` map, because the codes are
   * already shipped in `setDict` and repeating 101 of them would be most of the
   * payload. About 1.2 KB.
   */
  readonly setReleased: string;
  /** Rarity-code vocabulary, one per line. */
  readonly rarityDict: string;
  readonly artistDict: string;
  /**
   * Per-card membership lists, one line each, base-36 ids dot-separated and
   * the four groups tab-separated: keywords, traits, sets, rarities.
   */
  readonly memberships: string;
  /**
   * A SECOND POSTINGS INDEX, over flavour text rather than rules text.
   *
   * Separate rather than folded into `postings` because the two answer
   * different questions and must not bleed: `text:blood` is a claim about what
   * a card DOES, and a card whose flavour mentions blood does not do anything
   * of the sort. Merging them would make every `text:` search quietly wrong on
   * 864 cards.
   *
   * Postings rather than the strings themselves, which is a payload decision
   * with a measurement behind it: the corpus carries 206 KB of flavour prose,
   * and storing it verbatim would have grown a 665 KB index by 31% for one
   * operator. Tokenised and delta-encoded it is a fraction of that, and the
   * search page already pays for exactly this shape.
   */
  readonly flavour: string;
  /**
   * Distinct legality vectors, one per line: six comma-separated bitmasks in
   * {@link FORMATS} order, each a base-36 sum of {@link TONE_BIT}.
   */
  readonly verdictDict: string;
  /** Two base-36 characters per card, indexing {@link EncodedCardIndex.verdictDict}. */
  readonly verdictAt: string;
  /**
   * The inverted index over printed card text: one line per term, the term,
   * a space, then the ordinals of the cards containing it — ascending,
   * delta-encoded, base 36, dot-separated.
   */
  readonly postings: string;
  /** `type\tcount` for the commonest printed type lines. The empty state. */
  readonly browse: string;
}

/**
 * One bit per state a verdict can carry, so a card that is two things at once
 * stays two things. `unknown` gets its own bit rather than being spelled as
 * zero: "the dataset publishes nothing here" is a claim, and an all-zero mask
 * would be indistinguishable from a bug that forgot to set any.
 */
export const TONE_BIT: Readonly<Record<StateTone | "unknown", number>> = {
  legal: 1,
  banned: 2,
  suspended: 4,
  restricted: 8,
  "living-legend": 16,
  "not-in-format": 32,
  unknown: 64,
  verified: 0,
  unverified: 0,
};
