/**
 * The card corpus, shaped once for the 11,378 pages that serve it.
 *
 * `docs/PLAN.md` Phase 2: **cards are what people arrive for**, and "every view
 * is a URL" — `/card/arc/159/command-and-conquer` is the product, not
 * decoration on it. Everything in this module exists to make one permanent URL
 * per PRINTING cheap enough that emitting all of them statically is
 * unremarkable.
 *
 * THE PRINTING IS THE ADDRESSABLE UNIT, WHICH IT WAS NOT UNTIL RECENTLY. There
 * is no card-level URL: `/card/<slug>` and `/card/<name>` were pages for the
 * life of the site and are no longer served at all, and every
 * distinct art has an address of the form `/card/<set>/<number>/<slug>`. The
 * argument for the order is in `printings.ts` beside the function that builds
 * it; the short version is that set and number are printed on the card and the
 * slug is not.
 *
 * It follows `./rules.ts` deliberately and closely: the corpus is imported as
 * committed JSON and resolved by the bundler at build time, the shaping is one
 * pass rather than one pass per page, and the two functions at the bottom build
 * a `<title>` and a `<meta name="description">` out of *fixed labels* wrapped
 * around *verbatim values* and nothing else. Nothing here composes prose.
 *
 * FIVE DECISIONS WORTH THE WORDS.
 *
 * **The slug is derived from the name, and a collision is a build failure.**
 * See {@link slugify} and {@link CARD_ROUTES}. Two cards sharing a URL would
 * make one of them silently unreachable, which is the one failure a reference
 * work cannot absorb, so the assertion runs at module load and throws. There
 * are now TWO such assertions and they catch different things: the slug rule
 * guards the tail, and `CARD_ROUTES` guards the whole path — set and number
 * lead, so the corpus shares one namespace across every card rather than each
 * card owning its own.
 *
 * **Legality is derived per format, and the derivation is the whole product.**
 * See {@link FORMATS} and {@link verdictFor}. `cc_legal` does NOT mean "you may
 * play it" — every one of the 51 `cc_banned` cards is also flagged `cc_legal`
 * upstream, because the flag means "in the Classic Constructed card pool". A
 * surface that renders `cc_legal` as a Legal pill marks all 51 banned cards
 * legal, which is precisely the incumbent bug `docs/PLAN.md` Phase 3 cites as
 * the reason this project exists.
 *
 * **The states are not collapsed, and more than one can be true at once.**
 * One card in this corpus carries `cc_banned` and `cc_living_legend`
 * simultaneously (see the counts in {@link CORPUS}); a scheme that picked "the"
 * state would have had to discard one of two true facts. So a format verdict is
 * a *list* of states, and each renders as its own pill with its own tone.
 *
 * **Every verdict ships its evidence.** {@link FormatVerdict.evidence} carries
 * the raw upstream keys and values the verdict was computed from, so the page
 * can print them beside the pill. `docs/PLAN.md`: the tool is auditable rather
 * than merely assertive, which is what matters when the commercially-backed
 * incumbent ships incorrect flags.
 *
 * **An upstream flag this module does not know about fails the build.** See
 * {@link assertEveryFlagIsClaimed}. The alternative is a new format, or a new
 * kind of restriction, arriving in a scheduled sync and simply not appearing on
 * any page — stale by silence, which `docs/PLAN.md` calls the thing that killed
 * three Flesh and Blood tools.
 */

import type { PitchValue, StateTone } from "optfall-theme";

import { faceKeyFor, orientationOfFace } from "./faces";
/* Imported as well as re-exported: a re-export creates no local binding, and
   `CARD_ROUTES` below both calls `facesOf` and names `PrintingRef`. */
import {
  faceForPrintingId,
  facesOf,
  hrefForPrinting,
  type PrintingRef,
} from "./printings";

import corpus from "../../../../data/cards/cards.json";

/*
 * MOVED, NOT DELETED — see `printings.ts` for why. Re-exported here because
 * every caller in the app and the tests reaches them through `cards.ts`, and
 * the point of the move was to give ONE importer (`card-search/`, which the
 * island bundle pulls in) a path that does not drag the corpus with it. Making
 * everyone else change their import would have been churn for nothing.
 */
export {
  faceForPrintingId,
  facesOf,
  hrefForPrinting,
  numberFor,
  type PrintingRef,
} from "./printings";

/* -------------------------------------------------------------------------- */
/* The corpus                                                                  */
/* -------------------------------------------------------------------------- */

/** Provenance of the upstream file the corpus was built from. */
export interface CardsSource {
  readonly repository: string;
  readonly path: string;
  /** The immutable commit the file was fetched at — never `main`. */
  readonly commit: string;
  /** ISO timestamp of that commit. The corpus's "last confirmed" stamp. */
  readonly committedAt: string;
  readonly url: string;
  readonly bytes: number;
  /**
   * SHA-256 of the retrieved upstream bytes — not of anything Optfall
   * produced. On the page for the same reason the rules corpus's hash is: a
   * reader who does not trust us can fetch the same URL, hash it and compare.
   */
  readonly sha256: string;
}

/**
 * Per-format legality exactly as upstream publishes it.
 *
 * Booleans for the flags, ISO timestamp strings for the `*_start` dates. The
 * start dates are present only on the cards they apply to, which is why this is
 * a partial record rather than a fixed shape — and why {@link FormatVerdict}
 * reports an absent key as absent rather than as `false`.
 */
export type CardLegality = Readonly<
  Record<string, boolean | string | undefined>
>;

/** One printing, with upstream's field names kept verbatim. */
export interface CardPrinting {
  readonly unique_id: string;
  /** Collector number — `MST131`. The citable identity of a printing. */
  readonly id: string;
  readonly set_id: string;
  /** Upstream's single-letter edition code. Not expanded; see the page. */
  readonly edition: string;
  /** Upstream's single-letter foiling code. */
  readonly foiling: string;
  /** Upstream's single-letter rarity code. */
  readonly rarity: string;
  readonly expansion_slot: boolean;
  readonly artists: readonly string[];
  readonly art_variations: readonly string[];
  readonly flavor_text: string;
  /**
   * `null` on the four SUP token printings upstream carries with no published
   * face. Kept as `null` rather than coerced to `""`: "there is no image" and
   * "the image is the empty string" are different claims.
   */
  readonly image_url: string | null;
  readonly image_rotation_degrees: number;
  readonly double_sided_card_info?: readonly {
    /** A *printing* unique_id, not a card one. Verified: all 862 resolve. */
    readonly other_face_unique_id: string;
    readonly is_front: boolean;
    readonly is_DFC: boolean;
  }[];
  /**
   * TCGplayer's product identifier and storefront URL, carried verbatim from
   * upstream. Absent on 1,336 of 16,502 printings — promos and organised play,
   * where no product was ever listed — so both are optional and a consumer must
   * treat their absence as "upstream published none", never as an error.
   *
   * The URL already encodes the foiling, which is the whole reason it is useful
   * here: a card route addresses an *art*, so a Standard and a Rainbow Foil
   * struck from one picture share a page, and only the printings table can say
   * which of the two a reader means.
   */
  readonly tcgplayer_product_id?: string;
  readonly tcgplayer_url?: string;
}

/** One card, with upstream's field names kept verbatim. */
export interface Card {
  readonly unique_id: string;
  readonly name: string;
  readonly color: string;
  /** `""`, `"1"`, `"2"` or `"3"`. A string upstream, and left one here. */
  readonly pitch: string;
  /** May be `"X"`, `"XX"`, `"X1"` and so on, so never a number. */
  readonly cost: string;
  readonly power: string;
  /** Upstream's spelling. The interface labels it "Defence". */
  readonly defense: string;
  readonly health: string;
  readonly intelligence: string;
  readonly arcane: string;
  readonly types: readonly string[];
  readonly traits: readonly string[];
  readonly card_keywords: readonly string[];
  readonly abilities_and_effects: readonly string[];
  readonly ability_and_effect_keywords: readonly string[];
  readonly granted_keywords: readonly string[];
  readonly removed_keywords: readonly string[];
  readonly interacts_with_keywords: readonly string[];
  /** The printed rules text, carrying upstream's own `**` and `{…}` notation. */
  readonly functional_text: string;
  /** The printed type line — "Illusionist Action - Aura". */
  readonly type_text: string;
  readonly played_horizontally: boolean;
  /** Card `unique_id`s this card names. Verified: all 2,782 resolve. */
  readonly referenced_cards: readonly string[];
  readonly legality: CardLegality;
  readonly printings: readonly CardPrinting[];
}

export interface CardsCorpus {
  readonly schemaVersion: number;
  readonly source: CardsSource;
  /** The rights notice the corpus carries. Reproduced, never reworded. */
  readonly rights: string;
  readonly legalityFlags: readonly string[];
  readonly counts: {
    readonly cards: number;
    readonly printings: number;
    readonly names: number;
    readonly sets: number;
    readonly legality: Readonly<Record<string, number>>;
  };
  readonly cards: readonly Card[];
}

/**
 * The cast is unavoidable and it is narrow, exactly as in `./rules.ts`:
 * TypeScript widens every string literal in an imported JSON module, so the
 * declared shape above is the contract and the generator is what upholds it.
 * `scripts/build-card-corpus.ts` asserts the field list on every run and fails
 * on an upstream field it was not told about.
 */
export const CORPUS = corpus as unknown as CardsCorpus;

/** Date the corpus was last confirmed against upstream — `YYYY-MM-DD`. */
export const LAST_CONFIRMED = dateOf(CORPUS.source.committedAt);

/* -------------------------------------------------------------------------- */
/* Addressing                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Characters Unicode decomposition cannot fold to ASCII on its own.
 *
 * NFKD turns `é` into `e` + a combining acute, and `ā`, `ō`, `ṣ` likewise — so
 * stripping combining marks handles four of the five non-ASCII names in the
 * corpus. `ð` has no decomposition at all: it is a letter in its own right, and
 * without an entry here "Jarl Vetreiði" would slug to `jarl-vetrei-i`, because
 * the fallback rule turns any unmapped character into a separator.
 *
 * The table is deliberately larger than today's corpus needs. Every entry is a
 * standard romanisation rather than a judgement call, and pre-declaring them
 * means an upstream card named `Ærlig` produces `aerlig` on the day it lands
 * instead of `rlig` — a slug we would then be stuck with or would have to break
 * a permalink to fix.
 */
const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  æ: "ae",
  Æ: "ae",
  œ: "oe",
  Œ: "oe",
  ø: "o",
  Ø: "o",
  ð: "d",
  Ð: "d",
  đ: "d",
  Đ: "d",
  þ: "th",
  Þ: "th",
  ß: "ss",
  ł: "l",
  Ł: "l",
  ı: "i",
  "’": "",
  "'": "",
};

/**
 * The slug rule, stated once and applied everywhere.
 *
 * 1. Decompose with NFKD, so accented letters split into a base letter and a
 *    combining mark.
 * 2. Replace anything in {@link TRANSLITERATIONS} — the letters step 1 cannot
 *    fold, plus the two apostrophe forms, which vanish rather than becoming a
 *    separator so `Bloodrush Bellow` and `Nature's Path` read the same way.
 * 3. Lowercase, and drop the combining marks step 1 produced.
 * 4. Collapse every run of anything that is not `a-z0-9` into a single `-`.
 * 5. Trim leading and trailing `-`.
 *
 * Measured against this corpus: 3,158 distinct names produce 3,158 distinct
 * slugs, and none is empty. The rule is pure and deterministic, so the URL for
 * a card is a function of its name and of nothing else — no counter, no hash,
 * no build order.
 */
export function slugify(name: string): string {
  const folded = [...name.normalize("NFKD")]
    .map((character) => TRANSLITERATIONS[character] ?? character)
    .join("");
  return folded
    .toLowerCase()
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * How a card whose name is shared is told apart in the URL.
 *
 * **Why pitch, and not colour.** Both would work today, and pitch is the one
 * that is *guaranteed* to work: name + pitch is unique across all 4,941 cards
 * in this corpus (measured: zero collisions), whereas colour is a separate
 * upstream field that already disagrees with pitch on one card — Goldfin
 * Harpoon carries `color: "Yellow"` with an empty `pitch`. Disambiguating on a
 * field that can disagree with the discriminator is how a URL scheme acquires
 * a collision it cannot see coming.
 *
 * **Why `0` for a card with no pitch.** It is the same spelling
 * `PitchJewel` uses for the same absence: `value: 0` renders `–` and is spoken
 * as "No pitch value". Exactly one card takes this suffix today — the Hyper
 * Driver token, which shares its name with three pitch variants of the
 * Mechanologist action.
 */
function pitchSegment(card: Card): string {
  return card.pitch === "" ? "0" : card.pitch;
}

/** `0`, `1`, `2`, `3` or `4` — the jewel's own vocabulary. */
export function pitchValueOf(card: Card): PitchValue {
  return card.pitch === "1"
    ? 1
    : card.pitch === "2"
      ? 2
      : card.pitch === "3"
        ? 3
        : card.pitch === "4"
          ? 4
          : 0;
}

/**
 * How a variant is named in prose — `" (pitch 2)"`, or `""` for a sole card.
 *
 * Exported, and that export is a bug fix rather than tidiness. This used to be
 * module-private and used only by {@link titleFor}, which meant a page had no
 * way to tell two same-named cards apart in link text: 900 disambiguation pages
 * each list two to four cards whose `name` strings are byte-identical —
 * "Head Jab", "Head Jab", "Head Jab" — pointing at different URLs. The natural
 * implementation, `<a href={link.href}>{link.name}</a>`, therefore produced a
 * page of links with identical accessible names and different destinations:
 * WCAG 2.4.4 Link Purpose, and axe's `identical-links-same-purpose`. Colour and
 * position cannot fix that, and a `PitchBox` set *beside* the link does not
 * either — it is outside the link's accessible name unless it is placed inside
 * the anchor.
 */
export function variantSuffix(
  pitch: PitchValue,
  disambiguated: boolean,
): string {
  if (!disambiguated) return "";
  return pitch === 0 ? " (no pitch)" : ` (pitch ${pitch})`;
}

/**
 * The text a link to this card must carry, so that two links can never be told
 * apart only by where they point.
 *
 * Composed once, here, and carried on {@link CardLink.label} and
 * {@link CardPage.label} — so the page cannot forget it, which is the whole
 * reason it is data rather than advice. It is a fixed suffix wrapped around a
 * verbatim card name; nothing here composes prose.
 */
export function labelFor(
  name: string,
  pitch: PitchValue,
  disambiguated: boolean,
): string {
  return `${name}${variantSuffix(pitch, disambiguated)}`;
}

/* -------------------------------------------------------------------------- */
/* Formats                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Which upstream key carries which state, per format.
 *
 * `null` means **the dataset does not publish that state for this format**,
 * which is a different claim from "the flag is false" and is rendered
 * differently. Ultimate Pit Fight is the case that forces the distinction: it
 * has `upf_banned` and no `upf_legal` whatsoever, so Optfall can say a card is
 * banned there and cannot say any card is legal there.
 */
export interface FormatFlags {
  readonly legal: string | null;
  readonly banned: string | null;
  readonly suspended: string | null;
  readonly restricted: string | null;
  readonly livingLegend: string | null;
}

export interface Format {
  /** Stable id, used for anchors and nothing else. */
  readonly id: string;
  /** The format's published name. */
  readonly name: string;
  readonly flags: FormatFlags;
  /**
   * Every legality key belonging to this format, in the order the page prints
   * them. This is also the completeness check: {@link assertEveryFlagIsClaimed}
   * requires the union of these lists to cover every key in the corpus.
   */
  readonly keys: readonly string[];
}

/**
 * The six formats `docs/PLAN.md` Phase 3 names, in the order a Flesh and Blood
 * player would look for them: the two constructed formats people actually
 * queue for first.
 *
 * The key lists are not guesses — they are the keys this corpus actually
 * carries, censused before this file was written. Note what is absent as much
 * as what is present: Commoner has no living-legend flag, Silver Age has
 * neither suspension nor restriction, and Ultimate Pit Fight has only a ban.
 */
export const FORMATS: readonly Format[] = [
  {
    id: "classic-constructed",
    name: "Classic Constructed",
    flags: {
      legal: "cc_legal",
      banned: "cc_banned",
      suspended: "cc_suspended",
      restricted: null,
      livingLegend: "cc_living_legend",
    },
    keys: [
      "cc_legal",
      "cc_banned",
      "cc_banned_start",
      "cc_suspended",
      "cc_living_legend",
      "cc_living_legend_start",
    ],
  },
  {
    id: "blitz",
    name: "Blitz",
    flags: {
      legal: "blitz_legal",
      banned: "blitz_banned",
      suspended: "blitz_suspended",
      restricted: null,
      livingLegend: "blitz_living_legend",
    },
    keys: [
      "blitz_legal",
      "blitz_banned",
      "blitz_banned_start",
      "blitz_suspended",
      "blitz_living_legend",
      "blitz_living_legend_start",
    ],
  },
  {
    id: "living-legend",
    name: "Living Legend",
    flags: {
      legal: "ll_legal",
      banned: "ll_banned",
      suspended: null,
      restricted: "ll_restricted",
      livingLegend: null,
    },
    keys: [
      "ll_legal",
      "ll_banned",
      "ll_banned_start",
      "ll_restricted",
      "ll_restricted_start",
      "ll_restricted_affects_full_cycle",
    ],
  },
  {
    id: "commoner",
    name: "Commoner",
    flags: {
      legal: "commoner_legal",
      banned: "commoner_banned",
      suspended: "commoner_suspended",
      restricted: null,
      livingLegend: null,
    },
    keys: [
      "commoner_legal",
      "commoner_banned",
      "commoner_banned_start",
      "commoner_suspended",
    ],
  },
  {
    id: "silver-age",
    name: "Silver Age",
    flags: {
      legal: "silver_age_legal",
      banned: "silver_age_banned",
      suspended: null,
      restricted: null,
      livingLegend: null,
    },
    keys: ["silver_age_legal", "silver_age_banned", "silver_age_banned_start"],
  },
  {
    id: "ultimate-pit-fight",
    name: "Ultimate Pit Fight",
    flags: {
      legal: null,
      banned: "upf_banned",
      suspended: null,
      restricted: null,
      livingLegend: null,
    },
    keys: ["upf_banned", "upf_banned_start"],
  },
];

/**
 * The `*_start` key paired with each state key, where upstream publishes one.
 *
 * Kept as an explicit table rather than derived by string concatenation:
 * `cc_suspended` has no `cc_suspended_start`, so a `${key}_start` convention
 * would silently look for a key that never exists and report "no date" for a
 * state where the absence of a date is a property of the dataset rather than of
 * the card. Naming the pairs makes that visible.
 */
const START_KEY: Readonly<Record<string, string>> = {
  cc_banned: "cc_banned_start",
  cc_living_legend: "cc_living_legend_start",
  blitz_banned: "blitz_banned_start",
  blitz_living_legend: "blitz_living_legend_start",
  commoner_banned: "commoner_banned_start",
  ll_banned: "ll_banned_start",
  ll_restricted: "ll_restricted_start",
  silver_age_banned: "silver_age_banned_start",
  upf_banned: "upf_banned_start",
};

/**
 * State labels, which deliberately match `StatePill`'s own `FALLBACK` table
 * word for word.
 *
 * The pill's contract says the label must *name the state* — `"Banned"`, not
 * `"Classic Constructed"` — because the text is the primary channel and colour
 * is the redundant one. It also ships a fallback for a caller who passes
 * nothing, and it would be tempting to lean on that. We do not: relying on a
 * component's error path to supply correct output is exactly the "convention,
 * not a contract" the pill's documentation argues against. These are passed
 * explicitly, and matching the fallback wording means the two cannot disagree
 * on what a state is called.
 */
const STATE_LABEL: Readonly<Record<StateTone, string>> = {
  legal: "Legal",
  banned: "Banned",
  suspended: "Suspended",
  restricted: "Restricted",
  "living-legend": "Living Legend",
  "not-in-format": "Not in format",
  verified: "Verified",
  unverified: "Unverified",
};

/** One state a card is in, in one format. */
export interface FormatState {
  readonly tone: StateTone;
  readonly label: string;
  /** `YYYY-MM-DD` the state started applying, where upstream publishes one. */
  readonly since: string | null;
}

/** One published legality key and the value this card carries for it. */
export interface LegalityFact {
  readonly key: string;
  /** `"true"`, `"false"`, a date, or `"—"` where the key is absent. */
  readonly value: string;
  /** False when upstream omits the key on this card entirely. */
  readonly present: boolean;
}

export interface FormatVerdict {
  readonly format: Format;
  /**
   * Every state that applies, in severity order. Empty **only** when the
   * dataset cannot support a verdict at all — see {@link unknown}.
   */
  readonly states: readonly FormatState[];
  /**
   * True when the format publishes no legality flag and no exclusion flag is
   * set, so Optfall knows nothing about this card in this format. Today this is
   * Ultimate Pit Fight on 4,939 of 4,941 cards.
   */
  readonly unknown: boolean;
  /** Set when `ll_restricted_affects_full_cycle` is true on this card. */
  readonly affectsFullCycle: boolean;
  /** The raw keys and values the states above were computed from. */
  readonly evidence: readonly LegalityFact[];
}

/** `2024-07-08T00:00:00.000Z` becomes `2024-07-08`. Anything else is verbatim. */
function dateOf(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  return match?.[1] ?? value;
}

function startFor(card: Card, stateKey: string): string | null {
  const key = START_KEY[stateKey];
  if (key === undefined) return null;
  const raw = card.legality[key];
  return typeof raw === "string" && raw !== "" ? dateOf(raw) : null;
}

/**
 * The derivation, and the single most important twenty lines in this file.
 *
 * **Exclusions are read first and they suppress `Legal`.** Upstream's `*_legal`
 * flag means "in this format's card pool", not "you may play it": all 51
 * `cc_banned` cards are also `cc_legal`, all 45 `blitz_banned` cards are also
 * `blitz_legal`, and all 42 `cc_living_legend` cards are too. Reading the legal
 * flag first — or reading it *as well* — is how the commercially-backed
 * incumbent came to ship Legal on banned cards.
 *
 * **Every true exclusion is emitted, not the first one.** One card here is both
 * `cc_banned` and `cc_living_legend`; picking one would have discarded a true
 * fact, and the brief for this surface is that these are different states with
 * different tones that must not be collapsed.
 *
 * **`Restricted` is an exclusion for this purpose even though a restricted card
 * is still in the pool.** It is emitted instead of `Legal` rather than beside
 * it, because a pill reading "Legal" next to one reading "Restricted" invites
 * the reader to believe the restriction is a footnote. The evidence row prints
 * `ll_legal: true` immediately underneath, so nothing is hidden — only ranked.
 *
 * **Absence of a flag is never read as `false`.** `upf_legal` does not exist,
 * so Ultimate Pit Fight yields no `Legal` and no `Not in format` — it yields
 * {@link FormatVerdict.unknown}, which the page renders as a sentence rather
 * than as a pill. Optfall does not have an opinion it cannot source.
 */
export function verdictFor(card: Card, format: Format): FormatVerdict {
  const { flags } = format;
  const isSet = (key: string | null): key is string =>
    key !== null && card.legality[key] === true;

  const states: FormatState[] = [];
  const add = (key: string, tone: StateTone) => {
    states.push({ tone, label: STATE_LABEL[tone], since: startFor(card, key) });
  };

  if (isSet(flags.banned)) add(flags.banned, "banned");
  if (isSet(flags.suspended)) add(flags.suspended, "suspended");
  if (isSet(flags.restricted)) add(flags.restricted, "restricted");
  if (isSet(flags.livingLegend)) add(flags.livingLegend, "living-legend");

  let unknown = false;
  if (states.length === 0) {
    if (flags.legal === null) {
      unknown = true;
    } else if (card.legality[flags.legal] === true) {
      states.push({ tone: "legal", label: STATE_LABEL.legal, since: null });
    } else {
      states.push({
        tone: "not-in-format",
        label: STATE_LABEL["not-in-format"],
        since: null,
      });
    }
  }

  const evidence: LegalityFact[] = format.keys.map((key) => {
    const raw = card.legality[key];
    if (raw === undefined) return { key, value: "—", present: false };
    return {
      key,
      value: typeof raw === "string" ? dateOf(raw) : String(raw),
      present: true,
    };
  });

  return {
    format,
    states,
    unknown,
    affectsFullCycle:
      card.legality["ll_restricted_affects_full_cycle"] === true,
    evidence,
  };
}

/**
 * Fail the build if the corpus carries a legality key no format claims.
 *
 * The failure this prevents is silent rather than loud. A scheduled sync adds
 * `upf_legal`, or a seventh format, or a new kind of restriction; every page
 * still renders, every check still passes, and the new fact simply never
 * appears anywhere. `docs/PLAN.md` calls staleness by neglect the thing that
 * killed three Flesh and Blood tools — so the honest behaviour is to stop the
 * build and make somebody look, exactly as `scripts/build-card-corpus.ts` does
 * for an unknown upstream field.
 */
function assertEveryFlagIsClaimed(): void {
  const claimed = new Set(FORMATS.flatMap((format) => format.keys));
  const unclaimed = new Set<string>();
  for (const card of CORPUS.cards) {
    for (const key of Object.keys(card.legality)) {
      if (!claimed.has(key)) unclaimed.add(key);
    }
  }
  if (unclaimed.size > 0) {
    throw new Error(
      `apps/site/src/lib/cards.ts: the card corpus carries legality key(s) no format in FORMATS claims: ${[
        ...unclaimed,
      ]
        .toSorted()
        .join(", ")}. Add them to the owning format's \`keys\` (and to its ` +
        `\`flags\` if they carry a state), or every card page will render a ` +
        `legality section that silently omits them.`,
    );
  }
}

assertEveryFlagIsClaimed();

/* -------------------------------------------------------------------------- */
/* One pass over the corpus                                                    */
/* -------------------------------------------------------------------------- */

/** A stat the card actually carries, with the label the interface gives it. */
export interface Stat {
  readonly label: string;
  /** Upstream's value, verbatim — `"X"`, `"XX"` and `"*"` all occur. */
  readonly value: string;
}

/** A link to another card page. */
export interface CardLink {
  readonly name: string;
  /**
   * The name plus its variant suffix — `"Head Jab (pitch 2)"`. THIS IS WHAT A
   * PAGE RENDERS INSIDE THE ANCHOR, always, in every list. See
   * {@link variantSuffix} for the failure it exists to prevent; it is ready-made
   * rather than left to the call site because the four places that build these
   * lists (variants, references, referenced-by, and the disambiguation page)
   * would otherwise each have to remember, and three of them would.
   */
  readonly label: string;
  readonly href: string;
  readonly pitch: PitchValue;
  /** True when the name alone does not identify the card. */
  readonly disambiguated: boolean;
}

/**
 * A card's face: which printing supplies it, and which way round it is.
 *
 * WHICH PRINTING IS THE CARD'S FACE HAS TO BE A STATED RULE. A card averages
 * 3.3 printings and both the card page and a search result need exactly one of
 * them; "whichever came first in the JSON" is a rule that changes silently the
 * day upstream reorders its file, which would move a card's picture for no
 * reason anybody could trace.
 *
 * The rule is **the first printing that actually has an image**, in upstream
 * order. It is deliberately not the best rule available — `docs/SCRYFALL-GAP.md`
 * §5.1c names that one as earliest `initial_release_date` with collector number
 * as the tiebreak — but release dates live in `set.json`, which is a corpus this
 * repository does not carry yet. So this is a stopgap, and it is written down as
 * one rather than left implicit, because an undocumented default is how a
 * placeholder rule becomes permanent.
 *
 * Skipping imageless printings matters more than it sounds: several cards list a
 * cold-foil variant first that upstream does not actually publish art for, and
 * taking `printings[0]` blindly would show NO IMAGE on a card whose ordinary
 * printing has a perfectly good face.
 */
export interface CardFaceRef {
  /** Blob key at the face host, or `null` where no printing publishes art. */
  readonly key: string | null;
  readonly orientation: "portrait" | "landscape";
  /** The printing the face came from, for the caption and the rail's initial state. */
  readonly printingId: string | null;
}

/**
 * A link to the card on the back of ONE printing, and which face that is.
 *
 * THE FACE KEY IS CARRIED BECAUSE THE LABEL CANNOT TELL TWO BACKS APART. The
 * printings table draws one of these per row, and once each row addresses its
 * OWN back rather than the other card's default printing, two rows can point at
 * two different arts under one name — Dash's ARC002 First and ARC002 Unlimited
 * back onto `ARC039` and `U-ARC039` Azalea, and both anchors read "Azalea".
 * That is WCAG 2.4.4, and it is the same failure the collector column solved by
 * naming what separates it; the key is what separates these, and it is unique
 * per face by construction.
 *
 * `null` where the back publishes no image, which is also when the link falls
 * back to the card's own address and so cannot collide.
 */
export interface OtherFaceLink extends CardLink {
  readonly faceKey: string | null;
}

/** A printing, plus the one thing that needs the whole corpus to resolve. */
export interface PrintingView {
  readonly printing: CardPrinting;
  /**
   * The card on the other face, where this printing is double-faced.
   *
   * `other_face_unique_id` addresses a *printing*, not a card — verified
   * against the corpus, where all 862 of them resolve to a printing and none to
   * a card. So the link is resolved through the printing index rather than the
   * card one, which is the kind of thing that is silently wrong forever if you
   * assume from the field name.
   *
   * AND THE ADDRESS HONOURS THAT, which it did not until recently: the join was
   * per-printing and then handed back the other card's DEFAULT printing. See
   * where this is built, and `faceForPrintingId`.
   */
  readonly otherFace: OtherFaceLink | null;
}

/** Everything one card page needs, assembled once. */
export interface CardPage {
  readonly card: Card;
  readonly slug: string;
  /**
   * The card's name plus its variant suffix. The same string
   * {@link CardLink.label} carries, so a link to this page and the page's own
   * heading name the card identically.
   */
  readonly label: string;
  readonly href: string;
  /** The bare name slug, shared with this card's variants. */
  readonly nameSlug: string;
  /** True when this card's URL carries a pitch suffix. */
  readonly disambiguated: boolean;
  /** Sibling cards sharing this name, excluding this one, pitch ascending. */
  readonly variants: readonly CardLink[];
  readonly pitch: PitchValue;
  /** Pitch, cost, power, defence, health, intelligence — those present. */
  readonly stats: readonly Stat[];
  readonly verdicts: readonly FormatVerdict[];
  readonly printings: readonly PrintingView[];
  /** The face this card is shown by. See {@link CardFaceRef} for the rule. */
  readonly face: CardFaceRef;
  /** Cards this card names, resolved. */
  readonly references: readonly CardLink[];
  /** Cards that name this one — derived, since upstream's inverse was dropped. */
  readonly referencedBy: readonly CardLink[];
  /** 1-based position in corpus order, for "N of 4,941". */
  readonly ordinal: number;
}

/**
 * One name, several cards. A GROUP, and it used to be a PAGE.
 *
 * `/card/head-jab` was a real document listing three pitch versions; it is not
 * served any more, so nothing here is rendered at a URL of its own. The name is
 * retained because the grouping is still what builds the tab strip on a card
 * page and what resolves a bare name to its lowest-pitch printing.
 */
export interface NameGroup {
  readonly name: string;
  readonly slug: string;
  /** Where the bare name resolves: the lowest-pitch card's default printing. */
  readonly href: string;
  /** Every version, `byPitch` order. `cards[0]` is what the name means. */
  readonly cards: readonly CardPage[];
}

/**
 * Every stat a card can print, in the order `docs/DESIGN.md` reads a card face.
 *
 * EXPORTED BECAUSE A SECOND SURFACE NEEDS THE ORDER AND NOT THE VALUES. The
 * card page lays out the three combat positions whether or not a card prints
 * them — see `COMBAT_STATS` in `CardEntry`; a position the card leaves empty
 * paints nothing and keeps its width — so it has to know the full list and
 * where each member sits. Deriving that from a card would mean deriving it
 * from a card that happens to print all five.
 *
 * ARCANE IS NOT A PRINTED STAT AND IS NO LONGER ONE OF THESE. It was, and it
 * was the only member of this list a card face does not carry anywhere: the
 * CR's notation table at 1.12.4 names eight symbols and arcane is not among
 * them, because arcane damage is written in a card's RULES TEXT — "Deal 2
 * arcane damage to any target" — and not struck into a corner of the frame.
 * Upstream publishes an `arcane` field anyway, derived from that sentence, and
 * rendering it beside cost and defence stated a printed value the card does not
 * print and then said it twice, since the text is on the same page. All 287
 * cards carrying the field say the number in their own text.
 *
 * `StatGlyph` still knows an `arcane` kind — see `packages/components` — and
 * that is deliberate: the plate, its shape and its rationale are the design
 * system's, and nothing on this site asks for it.
 *
 * `card-search/rank.ts` keeps its own copy as `STAT_LABELS` and cannot import
 * this one: a VALUE import from this module drags the 18 MB corpus into the
 * island bundle, which is the failure `printings.ts` was split out to prevent.
 * The two are pinned against each other in `card-search.test.ts` instead.
 */
export const STAT_ORDER = [
  "Cost",
  "Power",
  "Defence",
  "Life",
  "Intellect",
] as const;

/**
 * A card's stats, in {@link STAT_ORDER}, and only the ones it has.
 *
 * Upstream writes an absent stat as `""` rather than omitting it, so "the card
 * has no power" and "the card has power 0" are the same field with different
 * values — 13 cards genuinely have `power: "0"`. Testing for the empty string
 * rather than for falsiness is what keeps those thirteen from losing a stat.
 *
 * IT STILL DROPS THE ABSENT ONES, and the positions the card page holds open
 * are not a change to that. A row in a search result or a set index shows what a card
 * HAS; only the card page has a frame with fixed positions to leave standing
 * empty. Adding nulls here would push them into every list on the site.
 */
function statsOf(card: Card): readonly Stat[] {
  const printed: Readonly<Record<(typeof STAT_ORDER)[number], string>> = {
    Cost: card.cost,
    Power: card.power,
    Defence: card.defense,
    Life: card.health,
    Intellect: card.intelligence,
  };
  return STAT_ORDER.filter((label) => printed[label] !== "").map((label) => ({
    label,
    value: printed[label],
  }));
}

/** Slug groups, built once. */
const BY_NAME_SLUG: ReadonlyMap<string, readonly Card[]> = (() => {
  const groups = new Map<string, Card[]>();
  for (const card of CORPUS.cards) {
    const slug = slugify(card.name);
    const existing = groups.get(slug);
    if (existing === undefined) groups.set(slug, [card]);
    else existing.push(card);
  }
  return groups;
})();

/**
 * Card `unique_id` to slug, and the collision assertion.
 *
 * THE ASSERTION IS THE POINT OF THIS BLOCK. A slug scheme that quietly maps two
 * cards to one URL does not fail — it renders, deploys, and serves one card
 * under both names while the other becomes unreachable with nothing anywhere
 * saying so. The rest of this file exists to make card pages linkable; a
 * silently missing card is the one bug that would make the whole surface
 * untrustworthy, so it throws.
 */
const SLUG_BY_ID: ReadonlyMap<string, string> = (() => {
  const slugs = new Map<string, string>();
  const owners = new Map<string, string[]>();
  for (const [nameSlug, group] of BY_NAME_SLUG) {
    for (const card of group) {
      const slug =
        group.length === 1 ? nameSlug : `${nameSlug}-${pitchSegment(card)}`;
      slugs.set(card.unique_id, slug);
      const existing = owners.get(slug);
      if (existing === undefined) owners.set(slug, [card.name]);
      else existing.push(card.name);
    }
  }
  // A disambiguation page occupies the bare name slug, so a *card* slug equal
  // to one would shadow it. Measured: no card name slugs to `<name>-0`…`-3`
  // today, and this is what keeps that true.
  for (const [nameSlug, group] of BY_NAME_SLUG) {
    if (group.length > 1 && owners.has(nameSlug)) {
      owners.get(nameSlug)?.push(`(disambiguation page for ${group[0]?.name})`);
    }
  }
  const collisions = [...owners.entries()].filter(
    ([, names]) => names.length > 1,
  );
  if (collisions.length > 0) {
    throw new Error(
      `apps/site/src/lib/cards.ts: ${collisions.length} card slug collision(s) — ` +
        `one card would be unreachable. ` +
        collisions
          .map(
            ([slug, names]) =>
              `/card/${slug} claimed by ${names.join(" and ")}`,
          )
          .join("; "),
    );
  }
  return slugs;
})();

const CARD_BY_ID: ReadonlyMap<string, Card> = new Map(
  CORPUS.cards.map((card) => [card.unique_id, card]),
);

/** Printing `unique_id` to the card that carries it — for the DFC join. */
const CARD_BY_PRINTING_ID: ReadonlyMap<string, Card> = (() => {
  const index = new Map<string, Card>();
  for (const card of CORPUS.cards) {
    for (const printing of card.printings) index.set(printing.unique_id, card);
  }
  return index;
})();

/**
 * A card's address: the URL of its DEFAULT PRINTING.
 *
 * THERE IS NO SUCH THING AS A CARD URL ANY MORE, WHICH IS THE WHOLE CHANGE.
 * `/card/head-jab-1` was a page for the life of the site; it is a redirect now,
 * and every link the site draws points at a printing instead. So "where does
 * this card live" is answered here, once, and it is answered by picking one of
 * the card's printings rather than by spelling a slug into a path.
 *
 * THE DEFAULT IS `facesOf(card)[0]` AND THAT IS UNCHANGED. It is the same face
 * `faceOf` already picks for the picture on every surface — first printing in
 * upstream order that actually publishes art — so the printing a card page
 * OPENS on is the printing whose URL it lives at, and the two cannot disagree.
 * `docs/SCRYFALL-GAP.md` §5.1c calls that ordering a stopgap pending set release
 * dates, and it still is; what changed is the stakes, because the default face
 * now decides a URL and not only a picture. Moving it is a separate decision
 * from moving the scheme, so it is deliberately not made here.
 *
 * A CARD WITH NO ADDRESSABLE FACE THROWS rather than returning a fallback path.
 * Measured: all 4,941 cards publish at least one image, so this cannot fire
 * today — and if a resync lands a card that publishes none, the honest outcome
 * is a stopped build rather than a card that is silently absent from a
 * reference index. That is the same trade {@link SLUG_BY_ID} already makes.
 */
function defaultAddressOf(card: Card, slug: string): string {
  const face = facesOf(card)[0];
  if (face === undefined) {
    throw new Error(
      `apps/site/src/lib/cards.ts: ${card.name} (${card.unique_id}) publishes no ` +
        `image on any of its ${card.printings.length} printing(s), so it has no ` +
        `printing URL and would be absent from the site. Every card URL is now ` +
        `/card/<set>/<number>/<slug> — see hrefForPrinting in printings.ts — so a ` +
        `card with no addressable face has no address at all.`,
    );
  }
  return hrefForPrinting(face.setCode, face.number, slug);
}

function linkTo(card: Card): CardLink {
  const nameSlug = slugify(card.name);
  const slug = SLUG_BY_ID.get(card.unique_id) ?? nameSlug;
  const pitch = pitchValueOf(card);
  const disambiguated = slug !== nameSlug;
  return {
    name: card.name,
    label: labelFor(card.name, pitch, disambiguated),
    href: defaultAddressOf(card, slug),
    pitch,
    disambiguated,
  };
}

/**
 * The inverse of `referenced_cards`, derived in one pass.
 *
 * Upstream publishes `cards_referenced_by` and the corpus build drops it, after
 * verifying it is the exact inverse across all 4,941 cards. This is where that
 * decision is paid for — the same shape as `./rules.ts` deriving CHILDREN from
 * `parentId` rather than shipping a second copy of the hierarchy.
 */
const REFERENCED_BY: ReadonlyMap<string, readonly Card[]> = (() => {
  const inverse = new Map<string, Card[]>();
  for (const card of CORPUS.cards) {
    for (const id of new Set(card.referenced_cards)) {
      const existing = inverse.get(id);
      if (existing === undefined) inverse.set(id, [card]);
      else existing.push(card);
    }
  }
  return inverse;
})();

/**
 * Sort rank for a pitch value: no-pitch sorts last, otherwise ascending.
 *
 * At module scope rather than inside {@link byPitch} because it captures
 * nothing from that function — `unicorn(consistent-function-scoping)` is an
 * error in this repo, and a comparator that rebuilds a closure on every one of
 * its O(n log n) calls is the reason the rule exists.
 */
function pitchRank(card: Card): number {
  /* Above the scale rather than one past it. The sentinel was `4` while `4` was
     also "a pitch value nobody prints" — no longer safe to rely on, since a
     pitch 4 has been previewed, though no card in `data/cards` carries one yet.
     A rank shared by "no pitch" and "pitch 4" is an order that depends on input
     order, and the day such a card lands is the wrong day to find that out. */
  return card.pitch === "" ? 10 : Number(card.pitch);
}

/** No-pitch sorts last; otherwise ascending. Total, so the order is stable. */
function byPitch(a: Card, b: Card): number {
  return pitchRank(a) - pitchRank(b) || (a.unique_id < b.unique_id ? -1 : 1);
}

/**
 * The face a card is shown by. See {@link CardFaceRef} for the rule and why it
 * is a stopgap.
 */
function faceOf(card: Card): CardFaceRef {
  const playedHorizontally = card.played_horizontally;

  for (const printing of card.printings) {
    const key = faceKeyFor(printing.image_url);
    if (key === null) continue;
    return {
      key,
      // FROM THE KEY, NOT FROM THE CARD. A card played sideways is not reliably
      // published sideways — `Vaporize // Shock` ships one portrait face and one
      // landscape one — so the box is read off the measured face rather than off
      // `played_horizontally`. See `LANDSCAPE_FACE_KEYS`.
      orientation: orientationOfFace({
        key,
        playedHorizontally,
        rotationDegrees: printing.image_rotation_degrees,
      }),
      printingId: printing.id,
    };
  }

  // No printing publishes art. The page still needs a box of the right shape,
  // so the orientation is answered from the card itself and the key is null —
  // which `CardFace` renders as the placeholder rather than as nothing. This is
  // the one case with no bytes to measure, and the one `orientationOf` is still
  // the right question for.
  return {
    key: null,
    orientation: orientationOfFace({
      key: null,
      playedHorizontally,
      rotationDegrees: 0,
    }),
    printingId: card.printings[0]?.id ?? null,
  };
}

/** Every card page, in corpus order — which is upstream's, name-sorted. */
export const CARD_PAGES: readonly CardPage[] = CORPUS.cards.map(
  (card, index) => {
    const nameSlug = slugify(card.name);
    const slug = SLUG_BY_ID.get(card.unique_id) ?? nameSlug;
    const group = BY_NAME_SLUG.get(nameSlug) ?? [card];
    const disambiguated = slug !== nameSlug;

    return {
      card,
      slug,
      label: labelFor(card.name, pitchValueOf(card), disambiguated),
      href: defaultAddressOf(card, slug),
      nameSlug,
      disambiguated,
      variants: group
        .filter((sibling) => sibling.unique_id !== card.unique_id)
        .toSorted(byPitch)
        .map(linkTo),
      pitch: pitchValueOf(card),
      stats: statsOf(card),
      face: faceOf(card),
      verdicts: FORMATS.map((format) => verdictFor(card, format)),
      printings: card.printings.map((printing) => {
        const otherId =
          printing.double_sided_card_info?.[0]?.other_face_unique_id;
        const other =
          otherId === undefined ? undefined : CARD_BY_PRINTING_ID.get(otherId);
        return {
          printing,
          /*
           * THE BACK OF *THIS* PRINTING, ADDRESSED AS THIS PRINTING'S BACK.
           *
           * `other_face_unique_id` names a printing ROW, and this used to
           * resolve that row to its card and then hand back `linkTo(other)` —
           * the card's DEFAULT printing. So the join was per-printing and the
           * address was not, and the specificity upstream supplied was
           * discarded one line after it was used: the back of Uprising's Aether
           * Ashwing linked to Dromai's Ash. Measured on the shipped build, 200
           * of the 271 printing pages with a back-face link left the set, and
           * ALL 200 of those sets had printed the back face — which is what a
           * double-sided card is, two faces struck together.
           *
           * `faceForPrintingId` answers where that exact row lives; the link's
           * name, label and pitch still come from `linkTo`, because those are
           * facts about the CARD and do not vary by printing.
           */
          otherFace: (() => {
            if (other === undefined || other.unique_id === card.unique_id) {
              return null;
            }
            const link = linkTo(other);
            /* `otherId` is defined whenever `other` is — the lookup is keyed
               by it — but narrowing says so rather than asserting it. */
            const ref =
              otherId === undefined
                ? undefined
                : faceForPrintingId(other, otherId);
            return ref === undefined
              ? { ...link, faceKey: null }
              : {
                  ...link,
                  faceKey: ref.key,
                  href: hrefForPrinting(
                    ref.setCode,
                    ref.number,
                    SLUG_BY_ID.get(other.unique_id) ?? slugify(other.name),
                  ),
                };
          })(),
        };
      }),
      /**
       * DEDUPLICATED, AND THE DUPLICATES ARE REAL. Upstream lists an id more than
       * once when a card names the same card twice in its text — Maxx Nitro names
       * each of the four Hyper Drivers twice, Aurora names Embodiment of Lightning
       * twice, and 23 lists in this corpus were affected. Rendering that verbatim
       * gives a page two anchors with the same text pointing at the same URL,
       * which reads as a bug in the tool rather than as a property of the card.
       *
       * `new Set` preserves first-insertion order, so this drops repeats without
       * reordering anything. It is applied to the inverse map above for the same
       * reason: a card that names this one twice appeared in `referencedBy` twice.
       */
      references: [...new Set(card.referenced_cards)]
        .map((id) => CARD_BY_ID.get(id))
        .filter((referenced): referenced is Card => referenced !== undefined)
        .map(linkTo),
      referencedBy: (REFERENCED_BY.get(card.unique_id) ?? []).map(linkTo),
      ordinal: index + 1,
    };
  },
);

const PAGE_BY_ID: ReadonlyMap<string, CardPage> = new Map(
  CARD_PAGES.map((page) => [page.card.unique_id, page]),
);

/**
 * The shared-name groups. See {@link NameGroup} for why they are not pages.
 *
 * WHAT THESE WERE. `/card/head-jab` was the URL a person guesses, types and
 * pastes, and it was served as the card itself at its lowest-pitch version.
 * It is not served any more, because there is exactly one kind of card page
 * left and it is a printing.
 *
 * WHAT THE GROUPING IS STILL FOR. Two things, both real: the tab strip on a
 * card page is built from it, and the typeahead resolves a bare name through
 * it. `cards[0]` is the lowest-pitch version under {@link byPitch}, which is
 * the version `/card/head-jab` used to render — so searching the bare name
 * still lands where the old URL did.
 */
export const NAME_GROUPS: readonly NameGroup[] = [...BY_NAME_SLUG.entries()]
  .filter(([, group]) => group.length > 1)
  .map(([slug, group]) => {
    const cards = group
      .toSorted(byPitch)
      .map((card) => PAGE_BY_ID.get(card.unique_id))
      .filter((page): page is CardPage => page !== undefined);
    return {
      name: group[0]?.name ?? "",
      slug,
      /* The lowest-pitch version's own address, which is what this name used
         to render. Never `/card/<slug>` — nothing is served there any more. */
      href: cards[0]?.href ?? "",
      cards,
    };
  });

/**
 * Where a bare NAME goes — every name, not only the shared ones.
 *
 * THE TYPEAHEAD AND `/random` BOTH PICK A NAME, NOT A CARD, and both used to
 * turn one into `/card/<nameSlug>` and let the router work out the rest. That
 * URL is a redirect now, so a surface that emitted it would be pointing every
 * suggestion and every random card through a 301 — working, and wrong, because
 * the destination is knowable at build time and a link the site draws itself
 * should never need a hop.
 *
 * `byPitch` RATHER THAN `CardPage.pitch`, which is the trap this map exists to
 * avoid. They disagree: `pitchRank` sorts a card with NO pitch LAST, while
 * `pitchValueOf` reports it as 0 and would sort it first. Deriving the answer
 * here from the same comparator {@link NAME_GROUPS} uses means the typeahead, the
 * tab strip and the redirect table cannot pick three different versions of one
 * name.
 */
export const HREF_BY_NAME_SLUG: ReadonlyMap<string, string> = new Map(
  [...BY_NAME_SLUG.entries()].flatMap(([slug, group]) => {
    const first = group.toSorted(byPitch)[0];
    if (first === undefined) return [];
    const href = PAGE_BY_ID.get(first.unique_id)?.href;
    return href === undefined ? [] : [[slug, href] as const];
  }),
);

/**
 * Every URL the `/card/` route emits. One kind, and it names a printing.
 *
 * IT USED TO BE A THREE-WAY UNION — card, shared name, printing — and the
 * union's exhaustiveness was doing real work: a fourth kind added here failed
 * the typecheck in `card.page.tsx` rather than silently rendering as a card.
 * There is nothing left to discriminate. `/card/<slug>` and `/card/<name>` are
 * redirects, so a route is a printing or it is not a route, and the shape says
 * so instead of a comment claiming it.
 */
export interface CardRoute {
  /** The full path — `/card/wtr/098/head-jab-1`. */
  readonly href: string;
  /** Set code, lowercased. First segment after `/card/`. */
  readonly setCode: string;
  /** The face-derived collector number. Second segment. */
  readonly number: string;
  /** The card's slug. Third segment — the human-readable tail. */
  readonly slug: string;
  readonly page: CardPage;
  readonly ref: PrintingRef;
  /** Index into `facesOf(page.card)` — which art this URL shows. */
  readonly index: number;
  /** True for `facesOf(card)[0]`, the face the card's own address points at. */
  readonly isDefault: boolean;
}

/**
 * Every printing, as an address, and the assertion that they are distinct.
 *
 * EVERY FACE GETS ONE, INCLUDING THE FIRST, and that is what "the printing is
 * the addressable unit" means. The previous scheme deliberately skipped face 0 —
 * `/card/<slug>` already showed it, so a second URL for it would have been
 * 4,941 duplicates — and that argument dies with the page it was defending.
 * 11,378 routes rather than 6,437, and the card's own address is now simply the
 * first of them.
 *
 * IT IS A FACE, NOT A PRINTING ROW. `facesOf` collapses the 16,502 rows onto
 * 11,378 distinct arts, because Regular / Rainbow Foil / Cold Foil in one set
 * are three rows sharing one picture and three URLs rendering one page is the
 * definition of a duplicate. See `printings.ts`.
 *
 * THE COLLISION CHECK IS A THROW, NOT A FILTER, and it is now GLOBAL where it
 * used to be per-card. Under `/card/<slug>/<set>/<number>` the slug led, so two
 * cards could not collide by construction and only a card's own faces had to be
 * told apart. Set and number lead now, so the whole corpus shares one namespace
 * — and it is not hypothetical: **`ros/257-v2` and `ros/257-v2-back` are each
 * claimed by two different cards**, because Runechant and the Embodiments are
 * printed on one physical double-sided token and share its art. The name tail is
 * what keeps those four URLs distinct, which is the strongest argument for
 * keeping it that this scheme has: `/card/ros/257-v2` alone could not name
 * either card, so the bare form is not merely undecorated, it is ambiguous.
 *
 * A build that stops is the only honest response to a genuine clash. The two
 * quiet outcomes are both bad — one page emitted and the other silently
 * dropped, or whichever won — and the generator's own duplicate-output guard
 * would catch it later, at the file level, where the message could name a path
 * but not a reason.
 */
export const CARD_ROUTES: readonly CardRoute[] = (() => {
  const routes: CardRoute[] = [];
  const taken = new Map<string, string>();

  for (const page of CARD_PAGES) {
    facesOf(page.card).forEach((ref, index) => {
      const route = hrefForPrinting(ref.setCode, ref.number, page.slug);
      const clash = taken.get(route);
      if (clash !== undefined) {
        throw new Error(
          `apps/site/src/lib/cards.ts: two printings both address ${route} — ` +
            `${clash} and ${page.label} (${ref.key}). Set code and collector ` +
            `number share one namespace across the whole corpus now, and the ` +
            `slug tail is the only thing disambiguating them. numberFor() in ` +
            `printings.ts derives the number segment from the face key; this ` +
            `corpus has a shape it does not tell apart.`,
        );
      }
      taken.set(route, page.label);

      routes.push({
        href: route,
        setCode: ref.setCode,
        number: ref.number,
        slug: page.slug,
        page,
        ref,
        index,
        isDefault: index === 0,
      });
    });
  }

  /*
   * EVERY CARD MUST HAVE AT LEAST ONE ADDRESS. `defaultAddressOf` already
   * throws for a card with no face, so this cannot fire independently of it
   * today — it is here because the two failures are different sizes and only
   * one of them is loud. A card missing from this list is missing from the
   * SITE, and a reference index that has quietly stopped carrying a card is
   * precisely the "stale by silence" failure `docs/PLAN.md` is written against.
   */
  const addressed = new Set(routes.map((route) => route.page.card.unique_id));
  if (addressed.size !== CARD_PAGES.length) {
    const missing = CARD_PAGES.filter(
      (page) => !addressed.has(page.card.unique_id),
    ).map((page) => page.label);
    throw new Error(
      `apps/site/src/lib/cards.ts: ${missing.length} card(s) have no printing ` +
        `URL and would not be served anywhere: ${missing.slice(0, 5).join(", ")}` +
        `${missing.length > 5 ? ", …" : ""}.`,
    );
  }

  return routes;
})();

/* -------------------------------------------------------------------------- */
/* What a pasted link says about itself                                        */
/* -------------------------------------------------------------------------- */

/** Longest description a preview card shows before it truncates for us. */
const DESCRIPTION_BUDGET = 200;

/**
 * Cut at the last word boundary inside the budget and mark the cut.
 *
 * Same helper and same reasoning as `./rules.ts`: the ellipsis is the page
 * telling the reader that what they are looking at is not the whole text. The
 * page body is never truncated.
 */
function truncateAtWord(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const clipped = text.slice(0, budget);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

/**
 * The `<title>`, which is the headline of the preview card.
 *
 * Name first, because the name is what the link is *about* and a preview card
 * truncates from the right. The pitch is part of the name for a card whose name
 * alone does not identify it — the same information the URL carries, so a
 * pasted link and its preview agree.
 */
export function titleFor(page: CardPage, label: string = page.label): string {
  const type = page.card.type_text.trim();
  return type === ""
    ? `${label} · Flesh and Blood card · Optfall`
    : `${label} · ${type} · Optfall`;
}

/**
 * The `<meta name="description">`, which is the body of that preview card.
 *
 * **Legality is deliberately absent from it**, and that is the one interesting
 * choice here. "Banned in Classic Constructed" is the most shareable sentence
 * this project can write, and it is exactly the sentence that must not be
 * cached by a chat client for six months. Unfurl previews are snapshotted at
 * paste time and never revisited; a ban lifts, the page corrects itself, and
 * the preview goes on asserting the old verdict in the same conversation where
 * someone is deciding what to sleeve. `docs/PLAN.md`: "a tool that lies about
 * freshness is worse than one obviously behind." So the description carries the
 * facts that do not move — the type line, the stat block and the card text —
 * and legality lives on the page, where it is dated and evidenced.
 *
 * The card text is flattened to one line because an HTML attribute cannot carry
 * a newline. That is the only change made to it, it is made here and nowhere
 * else, and the page body renders every line break intact.
 */
export function descriptionFor(page: CardPage): string {
  const stats = page.stats.map((stat) => `${stat.label} ${stat.value}`);
  if (page.pitch !== 0) stats.unshift(`Pitch ${page.pitch}`);

  const head = [page.card.type_text.trim(), stats.join(" · ")]
    .filter((part) => part !== "")
    .join(". ");
  const body = page.card.functional_text.replace(/\s+/g, " ").trim();

  if (body === "") {
    return truncateAtWord(
      head === "" ? `${page.card.name}. Flesh and Blood card.` : `${head}.`,
      DESCRIPTION_BUDGET,
    );
  }
  return truncateAtWord(
    head === "" ? body : `${head}. ${body}`,
    DESCRIPTION_BUDGET,
  );
}
