/**
 * One card, as a page. The React port of the site's largest component.
 *
 * THE PANEL IS THE CARD, AND IT IS LAID OUT LIKE ONE. Not like Scryfall's
 * panel, which is where this started: Scryfall puts the mana cost on the name
 * line and power/toughness on the type line, because that is where Magic prints
 * them. Flesh and Blood prints its stats somewhere else, so copying the
 * arrangement rather than the idea would have produced a panel that mirrors the
 * wrong game. The idea is that the panel reads in the order the card reads:
 *
 *     <pitch>   NAME   <cost>
 *     <card text>
 *     <attack>  <type>  <defence>
 *     <artist>
 *
 * Everything below the panel — legality, the rules join, the attribute
 * vocabularies — is commentary ON the card and looks like it, which is what lets
 * the legality verdict stay above the fold without competing with the text.
 *
 * TWO COLUMNS: everything answering "what is this card" beside the face, the
 * apparatus below. It collapses to one column when the line cannot seat a face
 * beside a column at least as wide as a face — no breakpoint, because the token
 * layer publishes none.
 *
 * THE PICKER IS THE ONLY ISLAND ON THIS PAGE, and the rest is static. That is
 * the whole economy of the generator applied to its heaviest route: 12,278 card
 * pages, one interactive control between them, and the printed-text toggle done
 * in CSS so it costs nothing.
 *
 * ONE PORT DIFFERENCE WORTH NAMING. Astro's `<script is:inline define:vars>`
 * carried the `?pitch=` redirect. React has no equivalent, so it is a
 * `dangerouslySetInnerHTML` script whose body is built from a JSON literal here.
 * It stays inline rather than becoming an island for the reason the original
 * gives: an island would ship a runtime to do what four lines of navigation do,
 * and it has to run before the reader reads anything.
 */

import {
  BevelledPlate,
  CardFace,
  OrnamentalRule,
  PitchJewel,
  StatePill,
  StatGlyph,
} from "optfall-components/react";

import corpusJson from "../../../../data/rules/cr-2.14.0.json";
import { symbolForKind, type SymbolKind } from "../../src/lib/card-symbols";
import { parseInline } from "../../src/lib/card-text";
import {
  type CardLink,
  CARD_PAGES,
  type CardPage,
  CORPUS,
  facesOf,
  hrefForSlug,
  LAST_CONFIRMED,
  STAT_ORDER,
} from "../../src/lib/cards";
import {
  boxFor,
  faceKeyFor,
  faceUrl,
  orientationOf,
  placeholderUrl,
} from "../../src/lib/faces";
import { buildKeywordVocabulary, rulesForCard } from "../../src/lib/keywords";
import { hrefForNumber, type RulesCorpus } from "../../src/lib/search";
import {
  editionName,
  foilingName,
  hrefForSet,
  rarityName,
  raritySlug,
  setName,
} from "../../src/lib/sets";
import { Island } from "../Island";
import { PrintingPicker } from "../islands/PrintingPicker";
import { CardTextInline } from "./CardTextInline";
import "./CardEntry.css";
import { PrintedText } from "./PrintedText";

export interface CardEntryProps {
  readonly page: CardPage;
  /**
   * Which face the page arrives showing — an index into the picker's list.
   *
   * This is what makes the per-printing URL a page rather than a hint. The
   * picker has read `?printing=` since it shipped, but it read it in the
   * browser, so the server sent the default art every time.
   */
  readonly selected?: number;
}

/** The keyword vocabulary, built once for all 12,278 card pages. */
const KEYWORD_VOCABULARY = buildKeywordVocabulary(
  corpusJson as unknown as RulesCorpus,
);

const GLYPH_FOR: Record<
  string,
  "cost" | "power" | "defence" | "life" | "intellect" | "arcane" | undefined
> = {
  Cost: "cost",
  Power: "power",
  Defence: "defence",
  Life: "life",
  Intellect: "intellect",
  Arcane: "arcane",
};

const SYMBOL_FOR: Record<string, SymbolKind | undefined> = {
  Cost: "resource",
  Power: "power",
  Defence: "defence",
  Life: "life",
  Intellect: "intellect",
};

/**
 * The three positions the ordinary card frame has, whether or not a card fills
 * them. Cost sits top-left, attack bottom-left, defence bottom-right.
 *
 * The other three stats are not here because they have no fixed position: life
 * and intellect belong to a permanent, arcane to whatever prints it, and each
 * is placed by what the card IS rather than by a slot the frame reserves.
 */
const COMBAT_STATS = ["Cost", "Power", "Defence"] as const;

/**
 * The stats that mean a card is NOT on the ordinary frame.
 *
 * A hero, an ally, a demi-hero and a token creature all print life, and what
 * that says is that the card is a permanent with its own furniture rather than
 * something you play for a cost and swing for power. `Aegis, Archangel of
 * Protection` prints power and life and nothing else; its frame has no cost
 * bubble and no defence shield to leave standing empty.
 */
const PERMANENT_STATS = ["Life", "Intellect"] as const;

const CORNER_FOR: Record<string, "start" | "end" | undefined> = {
  Power: "start",
  Intellect: "start",
  Defence: "end",
  Life: "end",
  Arcane: "end",
};

function pitchRank(pitch: number): number {
  return pitch === 0 ? 4 : pitch;
}

/**
 * How many versions each name has, and the address of the name itself.
 *
 * BUILT ONCE FOR ALL 12,278 CARD PAGES, at module scope beside the keyword
 * vocabulary, because it is a fact about the corpus rather than about a page.
 *
 * IT EXISTS TO ANSWER "IS THIS GROUP THE WHOLE CARD", which is what decides
 * where a row's NAME points — see `groupHref`. A related list is often a
 * subset: `page.variants` excludes the card you are looking at by definition,
 * so a Head Jab page's row for Head Jab carries two of its three versions.
 * Sending that name to the shared page would offer a version the list is not
 * showing; sending a WHOLE group to one of its members would pick a favourite.
 *
 * `nameSlug` is safe to key by name: measured, zero names in the corpus have
 * cards that disagree about it, and all 3,158 name-level routes exist.
 */
const VERSIONS_BY_NAME = ((): ReadonlyMap<
  string,
  { readonly count: number; readonly nameSlug: string }
> => {
  const found = new Map<string, { count: number; nameSlug: string }>();
  for (const page of CARD_PAGES) {
    const seen = found.get(page.card.name);
    if (seen === undefined)
      found.set(page.card.name, { count: 1, nameSlug: page.nameSlug });
    else seen.count += 1;
  }
  return found;
})();

/** One related-card row: a name, and every version of it this list carries. */
interface LinkGroup {
  readonly name: string;
  readonly links: readonly CardLink[];
}

/**
 * A list of card links, collapsed to one entry per NAME.
 *
 * IN FIRST-APPEARANCE ORDER, NOT ALPHABETICAL. These lists arrive in corpus
 * order and the page has never re-sorted them; grouping is not the moment to
 * start, because a reader comparing this page to the one they came from would
 * find the same relatives in a different sequence for no stated reason. The
 * `Map` preserves insertion order, so a group sits where its first member sat.
 *
 * THE VERSIONS INSIDE A GROUP *ARE* SORTED, and by pitch rather than by
 * arrival, because they render as a row of stones. `1 2 3` is the order a
 * reader expects of three numbered things placed side by side, and corpus order
 * would produce a different arrangement per card for no reason a reader could
 * see. `pitchRank` puts a card with no pitch last, matching the version tabs.
 */
/**
 * Where a row's NAME points, which is the rule `CardIndex` already publishes.
 *
 * `PitchStones` there: "a stone is a link only where there is something to
 * choose between" — the name is the destination, and the marks become controls
 * only when a row stands for more than one card. An earlier version of this
 * list dropped the name's link entirely on a multi-version row and left the
 * stones as the only way in, which made the two surfaces disagree about what a
 * name IS. It is the address for "this card, whichever version you meant", on
 * both.
 *
 * THE WHOLE-GROUP CASE GOES TO THE NAME; A PARTIAL ONE GOES TO A MEMBER. This
 * is `set.page.tsx`'s `collapsed && whole` test, arrived at for the same
 * reason: a set that printed two of three versions lands its name "on one it
 * did print", because the shared page would offer a third the surface is not
 * showing. Related lists are partial more often than a set is — `variants`
 * always excludes the card being read — so this branch is the common one here
 * and the rare one there.
 */
function groupHref(group: LinkGroup): string {
  const first = group.links[0];
  if (first === undefined) return "";
  if (group.links.length === 1) return first.href;
  const known = VERSIONS_BY_NAME.get(group.name);
  return known !== undefined && known.count === group.links.length
    ? hrefForSlug(known.nameSlug)
    : first.href;
}

function groupByName(links: readonly CardLink[]): readonly LinkGroup[] {
  const byName = new Map<string, CardLink[]>();
  for (const link of links) {
    const found = byName.get(link.name) ?? [];
    found.push(link);
    byName.set(link.name, found);
  }
  return [...byName].map(([name, found]) => ({
    name,
    links: found.toSorted((a, b) => pitchRank(a.pitch) - pitchRank(b.pitch)),
  }));
}

export function CardEntry({ page, selected = 0 }: CardEntryProps) {
  const { card } = page;
  const typeLine = card.type_text.trim();
  const text = card.functional_text.trim();

  const vocabularies: readonly (readonly [string, readonly string[]])[] = [
    ["Types", card.types],
    ["Traits", card.traits],
    ["Keywords", card.card_keywords],
    ["Abilities and effects", card.abilities_and_effects],
    ["Ability keywords", card.ability_and_effect_keywords],
    ["Grants", card.granted_keywords],
    ["Removes", card.removed_keywords],
    ["Interacts with", card.interacts_with_keywords],
  ];
  const vocabulary = vocabularies.filter(([, values]) => values.length > 0);

  /**
   * The stat block, INCLUDING the combat positions this card leaves empty.
   *
   * A Flesh and Blood card frame has three fixed positions — cost top-left,
   * attack bottom-left, defence bottom-right — and a card that prints nothing
   * in one of them used to render nothing there at all. That left the reader
   * inferring an absence from a gap, which is indistinguishable from a layout
   * they had not finished looking at. Worse, it made the absence unreadable
   * against the common case: 1,648 cards print a cost of 0, 191 a defence of 0
   * and 13 a power of 0, so "no power" and "power 0" were a blank and a numeral
   * with nothing to connect them. `StatGlyph` draws the empty ones now, keeping
   * the silhouette and taking `null`.
   *
   * ONLY ON A CARD THAT IS ON THAT FRAME, which is what `usesCombatFrame` is
   * for, and the test has TWO halves because one was not enough.
   *
   * It has to print at least one of the three, so the 181 cards printing
   * nothing whatsoever keep the written sentence below rather than growing
   * three sockets out of nowhere. And it has to print NO permanent stat, which
   * is the half the first version was missing: 198 cards print life, and only
   * 154 of those are heroes. The other 44 are allies, angels, dragons, demons
   * and token creatures — `Aegis, Archangel of Protection` prints power and
   * life and nothing else — and under "prints any combat stat" they qualified
   * on their power and were handed an empty cost bubble and an empty defence
   * shield. The defence one landed immediately left of the life plate, because
   * `CORNER_FOR` puts both at `end`: an absence asserted in the exact corner the
   * card prints life in. That is the "inventing slots" failure the hero case
   * was carved out to prevent, arriving through a shape the carve-out did not
   * name.
   *
   * What is left is what the change is for: 1,363 cards print cost and defence
   * and no power — actions, instants, defence reactions — and gain the empty
   * attack plate.
   *
   * EVERY OTHER SHAPE IS IN, DELIBERATELY, and this is the line somebody will
   * want to move, so here is the whole of it rather than the two cases that
   * prompted it. 525 cards print defence alone (equipment), 81 print power
   * alone (weapons), and 409 print cost alone (items, instants, tokens) — the
   * last being the largest group and the one an earlier draft of this note
   * never named. All three draw the positions they leave empty.
   *
   * They do because "this card has no cost", "no attack", "no defence" are
   * facts worth stating, which is the whole argument for the change, and
   * because the alternative renders an absence of an absence. Cards printing
   * LIFE are the ones that go the other way, above, and the difference is not
   * how many stats they print: a hero or an ally has its OWN furniture in those
   * corners, so a socket there would overwrite something rather than report a
   * gap.
   *
   * Life, intellect and arcane are unchanged and appear only when printed. They
   * have no fixed position on the frame — they are where a card's type puts
   * them — so there is no empty slot for them to leave.
   */
  const printedValues = new Map(
    page.stats.map((stat) => [stat.label, stat.value]),
  );
  const usesCombatFrame =
    COMBAT_STATS.some((label) => printedValues.has(label)) &&
    !PERMANENT_STATS.some((label) => printedValues.has(label));

  const printedStats = STAT_ORDER.flatMap((label) => {
    const printed = printedValues.get(label);
    const shown =
      printed !== undefined ||
      (usesCombatFrame && (COMBAT_STATS as readonly string[]).includes(label));
    if (!shown) return [];

    const kind = SYMBOL_FOR[label];
    return [
      {
        label,
        /* `null` is the absence; `""` would be a different and wrong claim.
           See `StatGlyphProps.value`. */
        value: printed ?? null,
        kind: GLYPH_FOR[label] ?? null,
        symbol: kind === undefined ? null : symbolForKind(kind),
      },
    ];
  });

  const costStat = printedStats.find((stat) => stat.kind === "cost");
  const bodyStats = printedStats.filter((stat) => stat.kind !== "cost");
  const startStats = bodyStats.filter(
    (stat) => CORNER_FOR[stat.label] === "start",
  );
  const endStats = bodyStats.filter(
    (stat) => CORNER_FOR[stat.label] !== "start",
  );
  const hasStats = page.pitch !== 0 || printedStats.length > 0;

  const artists = [
    ...new Set(card.printings.flatMap((printing) => printing.artists)),
  ];

  const flavours = [
    ...new Set(
      page.printings
        .map(({ printing }) => printing.flavor_text.trim())
        .filter((flavour) => flavour !== ""),
    ),
  ];
  const soleFlavour = flavours.length === 1 ? flavours[0] : undefined;

  const nameHref = hrefForSlug(page.nameSlug);

  const related: readonly (readonly [string, string, readonly CardLink[]])[] = [
    ["Other versions", "Same name, different pitch.", page.variants],
    [
      "Names these cards",
      "Cards this card's text refers to by name.",
      page.references,
    ],
    [
      "Named by",
      "Cards whose text refers to this one by name.",
      page.referencedBy,
    ],
  ];
  const relatedShown = related.filter(([, , links]) => links.length > 0);

  const printingCount = card.printings.length;

  const keywordRules = rulesForCard(KEYWORD_VOCABULARY, [
    ...card.card_keywords,
    ...card.ability_and_effect_keywords,
  ]);

  const faceAlt = typeLine === "" ? page.label : `${page.label} — ${typeLine}`;

  /**
   * THE ROUTER'S LIST, NOT A SECOND ONE. `facesOf` is what `CARD_ROUTES` emits a
   * URL from, so taking the addresses from it makes "every tile has an address
   * and every address has a tile" true by construction.
   */
  const hrefByFace = new Map(
    facesOf(card).map((ref, index) => [
      ref.key,
      index === 0 ? page.href : `${page.href}/${ref.setCode}/${ref.number}`,
    ]),
  );

  /**
   * Every foiling that reaches each art, in words, keyed by face.
   *
   * BUILT OVER ALL PRINTINGS BEFORE THE TILES ARE, AND THAT ORDER IS THE POINT.
   * The tile list below is deduped by image and keeps the FIRST printing to
   * reach each one; asking that printing for its foiling would caption
   * `MST131` — one image published Standard and Rainbow Foil — as merely
   * "Standard". A full pass first means the tile names both, so the caption
   * describes the picture rather than the row that happened to claim it.
   *
   * DEDUPED AND ORDERED BY THE CORPUS, not sorted. Two rows at the same foiling
   * would otherwise say it twice, and imposing an alphabet would put "Cold Foil"
   * before "Standard" — an order that means nothing, where corpus order at least
   * means the order upstream lists the printings in.
   */
  const foilingsByFace = (() => {
    const codes = new Map<string, Set<string>>();
    for (const printing of card.printings) {
      const key = faceKeyFor(printing.image_url);
      if (key === null || printing.foiling === "") continue;
      const found = codes.get(key) ?? new Set<string>();
      found.add(printing.foiling);
      codes.set(key, found);
    }
    return new Map(
      [...codes].map(([key, found]) => [
        key,
        [...found].map((code) => foilingName(code)).join(" · "),
      ]),
    );
  })();

  /**
   * The cards this one is printed back-to-back with, in tile order.
   *
   * A CARD SHARES A PHYSICAL CARD WITH ANOTHER CARD, AND THAT IS A FACT ABOUT
   * THE PRINTING RATHER THAN ABOUT EITHER CARD. Measured on this corpus: 131
   * cards have at least one double-faced printing; 94 of them ALSO have
   * single-faced printings, because a token printed on the back of a hero in
   * one product is printed alone in another; and 16 are backed with more than
   * one different card across their printings — Agility is on the back of Gold
   * and on the back of Might. So "the other face of this card" is not a
   * question this page can answer once. It is answered per printing, beside the
   * rarity, which is per printing for the same kind of reason.
   *
   * FILLED BY THE TILE LOOP BELOW RATHER THAN BY A SECOND PASS. The list has to
   * be deduped by IMAGE exactly as the tiles are — a slot no tile can select is
   * markup that is `display: none` for the life of the page, which is the dead
   * markup the rarity list was rebuilt to stop emitting — and doing that here
   * would be a second copy of a rule that has one home ten lines down.
   *
   * NOTHING IS LOST TO THE DEDUPE, and it was checked rather than assumed: no
   * tile in this corpus carries two different other faces, and no card has an
   * other face reachable only through a printing with no image. So the set on
   * the page equals the set the card has.
   */
  const otherFaces: CardLink[] = [];

  const printings = (() => {
    const seen = new Set<string>();
    const entries: {
      key: string;
      id: string;
      edition: string;
      setName: string;
      setCode: string;
      thumb: string;
      normal: string;
      width: number;
      height: number;
      thumbWidth: number;
      thumbHeight: number;
      href: string;
      /** This printing's rarity slug, for the credit line. `""` where upstream
       *  publishes none. */
      rarity: string;
      /** Upstream's own rarity code, kept so the credit line can decode the
       *  display name from the same record the slug came from. */
      rarityCode: string;
      /**
       * Which of this card's other faces this printing is backed with, as an
       * index into {@link otherFaces} — or `""` where this printing is
       * single-faced.
       *
       * AN INDEX RATHER THAN A SLUG, WHICH IS THE ONE PLACE THIS DIFFERS FROM
       * `rarity` BESIDE IT, and the reason is CSS. The credit line publishes
       * every other face this card has and hides all but one, exactly as it
       * does for rarity, and the rule that chooses has to compare the stamp on
       * the root with an attribute on the element — which CSS cannot do, so
       * both are written out one rule per value. Rarity can be: `sets.json`
       * decodes exactly ten and the set is closed. A card slug is not a closed
       * set, and `:root[data-printing-other="inner-chi"]` would need a rule per
       * card in the corpus. An index closes it: no card in this corpus is
       * backed with more than three different cards, and `CardEntry.css`
       * enumerates four slots against a test that fails if a fourth is ever
       * needed.
       */
      otherFace: string;
      /** Every foiling this art is published at, in words. See
       *  {@link foilingsByFace}. */
      foiling: string;
    }[] = [];

    for (const [index, printing] of card.printings.entries()) {
      const key = faceKeyFor(printing.image_url);
      if (key === null || seen.has(key)) continue;
      seen.add(key);

      /*
        THE OTHER FACE OF THIS PRINTING, SLOTTED. `page.printings` is
        `card.printings` mapped one-for-one — see `cards.ts` — so the index is
        the same row, and `otherFace` there is already resolved through the
        PRINTING index rather than the card one, which is the lookup that field
        exists to have done once.
      */
      const other = page.printings[index]?.otherFace ?? null;
      let slot = "";
      if (other !== null) {
        const found = otherFaces.findIndex((face) => face.href === other.href);
        slot = String(found === -1 ? otherFaces.push(other) - 1 : found);
      }

      const orientation = orientationOf({
        playedHorizontally: card.played_horizontally,
        rotationDegrees: printing.image_rotation_degrees,
      });
      const normalBox = boxFor("normal", orientation);
      const thumbBox = boxFor("thumb", orientation);

      entries.push({
        key,
        id: printing.id,
        edition: printing.edition,
        setName: setName(printing.set_id),
        setCode: printing.set_id,
        thumb: faceUrl(key, "thumb"),
        normal: faceUrl(key, "normal"),
        width: normalBox.width,
        height: normalBox.height,
        thumbWidth: thumbBox.width,
        thumbHeight: thumbBox.height,
        href: hrefByFace.get(key) ?? page.href,
        /* THE RARITY OF THE PRINTING THAT CLAIMED THIS FACE, which is a real
           choice rather than a lookup, because this list is deduped by IMAGE
           and rarity is a property of the PRINTING. Two printings sharing one
           piece of art can carry different rarities — a card reprinted at the
           same art in a different product — and only the first is represented
           here, because only the first has a tile.

           That is the same granularity the picker itself works at: the reader
           is choosing a picture, and this reports the rarity of the printing
           that picture is addressed as. The printings table below is the
           complete record, and it lists every printing's rarity separately. */
        rarity: raritySlug(printing.rarity),
        rarityCode: printing.rarity,
        otherFace: slot,
        /* NOT `printing.foiling`, and the difference is 3,179 tiles. See
           `foilingsByFace` — a tile is an art, and an art can be published at
           more than one foiling. */
        foiling: foilingsByFace.get(key) ?? "",
      });
    }

    /*
      DISAMBIGUATED ONLY WHERE IT IS NEEDED, AND ONLY WHERE IT WORKS. Set and
      collector number identify a printing almost always — but not always: Head
      Jab's Welcome to Rathe entry is Alpha AND Unlimited, two different pieces
      of art under one number.

      The edition is appended only when the colliding printings actually differ
      by it. Arakni's HNT264 collides with itself because upstream publishes a
      front and a back face under one number, both edition `N` — appending the
      same edition to both would distinguish nothing.
    */
    const editionsPerNumber = new Map<string, Set<string>>();
    for (const entry of entries) {
      const key = `${entry.setCode}/${entry.id}`;
      const seenEditions = editionsPerNumber.get(key) ?? new Set<string>();
      seenEditions.add(entry.edition);
      editionsPerNumber.set(key, seenEditions);
    }

    for (const entry of entries) {
      if (
        (editionsPerNumber.get(`${entry.setCode}/${entry.id}`)?.size ?? 0) > 1
      ) {
        entry.id = `${entry.id} · ${editionName(entry.edition)}`;
      }
    }

    return entries;
  })();

  /**
   * THE RARITIES THE CREDIT LINE CAN SHOW — of which exactly one is visible at
   * a time, and it is the one belonging to the printing on screen.
   *
   * This used to render the whole list at once: "(C)ommon (R)are (M)ajestic"
   * strung along the credit line of a card that is, at that moment, showing one
   * specific printing. Read against the picture above it, that is three claims
   * where the page supports one, and the two most-reprinted cards in the game
   * carried five bubbles apiece. Worse, it was ambiguous in the direction a
   * reference work must never be ambiguous in: a reader looking at a Majestic
   * face had no way to tell which of the three letters described what they were
   * looking at, so the honest reading of the line was "this card exists at these
   * rarities somewhere", which is not what a credit line under a picture says.
   *
   * BUILT FROM THE TILE LIST, NOT FROM `card.printings`, and the difference is
   * one real card rather than a hypothetical. `printings` above is deduped by
   * IMAGE, so a printing upstream publishes with no `image_url` never gets a
   * tile and can never be the printing on screen. Deriving this from every
   * printing therefore emitted bubbles that no selector could ever reveal —
   * markup that is `display: none` for the life of the page.
   *
   * Measured: four cards have a face-less printing, and on exactly one of them
   * — `Toughness`, whose `SUP241` is Basic and has no image — that was the only
   * source of a rarity. Its Basic bubble would have been dead markup. Building
   * from the tiles makes the set on the page equal to the set that can be
   * displayed, which is the claim the line is making anyway.
   *
   * A CARD WITH NO FACE AT ALL WOULD CARRY NO RARITY HERE, and that is the
   * intended reading rather than an unconsidered edge. `printings` is empty on
   * such a card — the page renders the placeholder branch below instead of the
   * picker — so there is no printing on screen for a caption to describe, and
   * the line degrades to the artist credit with no stray separator. The
   * printings table still carries every rarity. Measured at zero today: every
   * card in the corpus has at least one printing with an image, so this is the
   * behaviour the code would have, not behaviour anybody has seen.
   *
   * WHAT THAT GIVES UP, stated rather than left for somebody to find: the credit
   * line is no longer a complete list of every rarity this card exists at, and
   * on `Toughness` "Basic" now appears only in the printings table below. That
   * is the right home for it. The table is the complete record, it lists every
   * printing's rarity in its own row including the face-less ones, and a credit
   * line under a picture is a caption rather than an index.
   *
   * ALL OF THEM ARE IN THE MARKUP, HIDDEN, and that is what makes the
   * client-side picker work without an island of its own. `PrintingPicker` swaps
   * the face in place — it does not navigate — so a server-rendered rarity would
   * be correct on load and wrong one click later. Publishing the set and letting
   * one CSS rule choose between them keeps the two in step with no second copy
   * of the data and no second island. See `CardEntry.css`.
   *
   * `display: none` RATHER THAN AN ATTRIBUTE, because it takes the hidden ones
   * out of the accessibility tree as well as off the page. A screen reader
   * announces the current rarity and nothing else; hiding them any other way
   * would read all five aloud.
   */
  const rarities = (() => {
    const seen = new Set<string>();
    const found: {
      name: string;
      initial: string;
      rest: string;
      slug: string;
    }[] = [];
    for (const printing of printings) {
      if (printing.rarity === "" || seen.has(printing.rarity)) continue;
      seen.add(printing.rarity);
      const name = rarityName(printing.rarityCode);
      found.push({
        name,
        initial: name.slice(0, 1),
        rest: name.slice(1),
        slug: printing.rarity,
      });
    }
    return found;
  })();

  /**
   * The rarity the page is rendered against, before any clicking happens.
   *
   * `selected` is the printing the ROUTE names — every printing has its own URL
   * and its own build of this page — so this is correct on load, correct in a
   * crawler, and correct with scripting off, which is the state the CSS below
   * treats as the default. From there `PrintingPicker` owns it.
   *
   * FALLING BACK TO THE FIRST PRINTING RATHER THAN TO NOTHING, matching what the
   * picker itself does one column over when an index it cannot resolve arrives:
   * the two have to agree about which face is showing, and disagreeing by
   * rendering a rarity for a picture the reader is not looking at is the exact
   * failure this whole block exists to end.
   */
  const currentRarity =
    printings[selected]?.rarity ?? printings[0]?.rarity ?? "";

  /** The other face the page is rendered against. Same rule, same fallback. */
  const currentOtherFace =
    printings[selected]?.otherFace ?? printings[0]?.otherFace ?? "";

  const facelessBox = boxFor("normal", page.face.orientation);

  const versions = [
    { pitch: page.pitch, href: page.href, current: true },
    ...page.variants.map((variant) => ({
      pitch: variant.pitch,
      href: variant.href,
      current: false,
    })),
  ].toSorted((a, b) => pitchRank(a.pitch) - pitchRank(b.pitch));
  const showVersions = versions.length > 1;

  const pitchTargets = JSON.stringify(
    Object.fromEntries(
      versions.map((version) => [String(version.pitch), version.href]),
    ),
  );

  return (
    <>
      <nav className="of-lineage" aria-label="Breadcrumb">
        <ol className="of-card__crumbs">
          <li>
            <a href="/">Optfall</a>
          </li>
          <li>
            <a href="/search">Cards</a>
          </li>
          {page.disambiguated ? (
            <li>
              <a href={nameHref}>{card.name}</a>
            </li>
          ) : null}
          <li>
            <span className="of-card__crumb-current" aria-current="page">
              {page.label}
            </span>
          </li>
        </ol>
      </nav>

      {/*
        Inline because it is a redirect rather than a component: an island would
        ship a runtime to do what four lines of navigation do, and it has to run
        before the reader reads anything.
      */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the only variable is a JSON literal built above.
        dangerouslySetInnerHTML={{
          __html: `{
  const targets = ${pitchTargets};
  const wanted = new URLSearchParams(window.location.search).get("pitch");
  if (wanted !== null) {
    const target = targets[wanted];
    if (target && target !== window.location.pathname.replace(/\\/$/, "")) {
      const url = new URL(target, window.location.origin);
      for (const [key, value] of new URLSearchParams(window.location.search)) {
        if (key !== "pitch") url.searchParams.set(key, value);
      }
      window.location.replace(url.href);
    }
  }
}`,
        }}
      />

      <article>
        <div className="of-card__page">
          <div className="of-card__face-column">
            {printings.length > 0 ? (
              <Island
                name="PrintingPicker"
                props={{
                  printings,
                  alt: faceAlt,
                  label: page.label,
                  selected,
                }}
              >
                <PrintingPicker
                  printings={printings}
                  alt={faceAlt}
                  label={page.label}
                  selected={selected}
                />
              </Island>
            ) : (
              <CardFace
                src={placeholderUrl(page.face.orientation)}
                alt={faceAlt}
                width={facelessBox.width}
                height={facelessBox.height}
                loading="eager"
              />
            )}
          </div>

          <div className="of-card__facts-column">
            {/*
              THE TAB STRIP IS ABOVE THE PANEL, NOT IN IT. The panel below is a
              mirror of a printed object; a control for choosing WHICH printed
              object it mirrors belongs outside the frame, the same way the
              printings picker sits outside the face rather than on top of it.
            */}
            {showVersions ? (
              <nav
                className="of-card__versions"
                aria-label={`Pitch versions of ${card.name}`}
              >
                <ul className="of-card__version-tabs">
                  {versions.map((version) => (
                    <li key={version.href}>
                      {version.current ? (
                        /*
                          The current tab is not a link. An anchor pointing at
                          the page you are already on is a control that does
                          nothing, and `aria-current` on a link still leaves it
                          in the tab order as a dead end.
                        */
                        <span
                          className="of-card__version-tab of-card__version-tab--current"
                          aria-current="page"
                        >
                          <PitchJewel value={version.pitch} size="sm" />
                          <span className="of-card__version-label">
                            {version.pitch === 0
                              ? "No pitch"
                              : `Pitch ${version.pitch}`}
                          </span>
                        </span>
                      ) : (
                        <a className="of-card__version-tab" href={version.href}>
                          <PitchJewel value={version.pitch} size="sm" />
                          <span className="of-card__version-label">
                            {version.pitch === 0
                              ? "No pitch"
                              : `Pitch ${version.pitch}`}
                          </span>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            {/*
              THE PANEL CARRIES ITS PITCH, so the stylesheet can tint the one
              thing on the page that is allowed to say which version this is
              without words: the rule under the name. A data attribute rather
              than an inline custom property, because the four values are a
              closed set the theme already names — `data-pitch` selects one of
              them, where a `style=` would let this file mix a colour.
            */}
            <BevelledPlate emphasis="flat">
              <div className="of-card__panel" data-pitch={page.pitch}>
                <header className="of-card__band of-card__band--title">
                  {/*
                    PITCH IS LABELLED, LIKE COST. It is the same kind of thing
                    in the same kind of corner — a printed value in a plate —
                    and the corner opposite it has said its own name in micro
                    caps since the panel was built. The stone carries the
                    numeral, the word carries what the numeral is OF, and the
                    two are a `<dl>` for the reason the stat corners are: this
                    is term-and-value data.
                  */}
                  {page.pitch === 0 ? (
                    <span
                      className="of-card__corner-empty"
                      aria-hidden="true"
                    />
                  ) : (
                    <dl className="of-card__badges of-card__badges--start">
                      <div className="of-card__badge">
                        <dt>Pitch</dt>
                        <dd>
                          <PitchJewel value={page.pitch} />
                        </dd>
                      </div>
                    </dl>
                  )}
                  {/*
                    `card.name`, not `page.label`. Everywhere else in the product
                    a link to this card renders the label — 900 names belong to
                    more than one card. Here the tab strip immediately above
                    carries that distinction, visibly, so repeating it in the
                    heading would make the three versions read as three cards.
                  */}
                  <h1 className="of-card__name">{card.name}</h1>
                  {costStat === undefined ? (
                    <span
                      className="of-card__corner-empty"
                      aria-hidden="true"
                    />
                  ) : (
                    <dl className="of-card__badges of-card__badges--end">
                      <div className="of-card__badge">
                        <dt>{costStat.label}</dt>
                        <dd>
                          <StatGlyph kind="cost" value={costStat.value} />
                        </dd>
                      </div>
                    </dl>
                  )}
                </header>

                {/*
                  The panel is the box, so the text simply IS the widest band in
                  it, set a step larger than everything around it. The heading
                  stays for a screen reader, which navigates by headings and
                  would otherwise arrive at unannounced prose.
                */}
                <div className="of-card__band of-card__band--oracle">
                  <h2 className="of-card__visually-hidden" id="printed-text">
                    Printed text
                  </h2>
                  {text === "" ? (
                    <p className="of-card__void">
                      This card has no rules text in the published dataset.
                    </p>
                  ) : (
                    <PrintedText text={card.functional_text} />
                  )}
                </div>

                {soleFlavour !== undefined ? (
                  <div className="of-card__band of-card__band--flavour">
                    <h2 className="of-card__visually-hidden" id="flavour-text">
                      Flavour text
                    </h2>
                    <p className="of-card__flavour-text">{soleFlavour}</p>
                  </div>
                ) : null}

                {/*
                  THE BOTTOM BAR: attack left, type centre, defence right. This
                  is the line along the foot of a Flesh and Blood card, and the
                  reason the stats are split across two `<dl>`s rather than
                  sitting in one cluster. Still definition lists: cost, power and
                  defence are term-and-value data. 13 cards genuinely have a
                  printed power of 0 and still get an entry saying 0.
                */}
                <div className="of-card__band of-card__band--bar">
                  {startStats.length === 0 ? (
                    <span
                      className="of-card__corner-empty"
                      aria-hidden="true"
                    />
                  ) : (
                    <dl className="of-card__badges of-card__badges--start">
                      {startStats.map((stat) => (
                        <div className="of-card__badge" key={stat.label}>
                          <dt>{stat.label}</dt>
                          <dd>
                            {stat.kind === null ? (
                              stat.value
                            ) : (
                              <StatGlyph kind={stat.kind} value={stat.value} />
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <p className="of-card__type-line">
                    {typeLine === "" ? "Flesh and Blood card" : typeLine}
                  </p>

                  {endStats.length === 0 ? (
                    <span
                      className="of-card__corner-empty"
                      aria-hidden="true"
                    />
                  ) : (
                    <dl className="of-card__badges of-card__badges--end">
                      {endStats.map((stat) => (
                        <div className="of-card__badge" key={stat.label}>
                          <dt>{stat.label}</dt>
                          <dd>
                            {stat.kind === null ? (
                              stat.value
                            ) : (
                              <StatGlyph kind={stat.kind} value={stat.value} />
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  {!hasStats ? (
                    <p className="of-card__void">
                      No printed cost, power, defence, life, intellect or arcane
                      value.
                    </p>
                  ) : null}
                </div>

                {/*
                  THE FOOT OF THE PANEL, IN THE FINE-PRINT REGISTER — who drew
                  it, and which printings exist. Both read straight off the
                  record. The printing count is a link rather than a number
                  because the table it names is on this same page, and a count
                  that cannot take you to what it counted is decoration.
                */}
                <footer className="of-card__band of-card__band--credits">
                  {/*
                    THREE PARTS, THREE ELEMENTS, ONE `space-between`.

                    Rarity and the artist credit used to share a paragraph, so
                    the row the footer distributes had only TWO items in it: a
                    clump on the left and the printing count on the right. The
                    three facts down here are independent of one another — what
                    grade this printing is, who drew it, how many printings
                    exist — and reading them as two-and-one made the first two
                    look like one compound fact.

                    They are siblings now, so `justify-content: space-between`
                    on the footer spaces all three rather than two. Nothing else
                    changed: the rarity list is still a flex row of its own with
                    one member visible, because it is one item on this line.
                  */}
                  <p className="of-card__credit">
                    {/*
                      RARITY LEADS THE CREDIT LINE, initial in a bubble and the
                      rest of the word beside it — "(M)ajestic" as one word. The
                      letter is the form the card itself prints in its bottom
                      margin; the rest is there because a letter alone is a
                      lookup, and this is a reference work. The colour is a
                      grouping and not a claim.

                      ONE OF THESE IS VISIBLE AT A TIME — the one belonging to
                      the printing shown above. The rest are published hidden so
                      the picker can switch between them without a round trip.
                    */}
                    {rarities.map((rarity) => (
                      <span
                        className={
                          rarity.slug === currentRarity
                            ? "of-card__rarity of-card__rarity--initial"
                            : "of-card__rarity"
                        }
                        data-rarity={rarity.slug}
                        key={rarity.name}
                      >
                        <span
                          className="of-card__rarity-mark"
                          aria-hidden="true"
                        >
                          {rarity.initial}
                        </span>
                        <span className="of-card__visually-hidden">
                          {rarity.name}
                        </span>
                        <span
                          className="of-card__rarity-rest"
                          aria-hidden="true"
                        >
                          {rarity.rest}
                        </span>
                      </span>
                    ))}
                  </p>
                  {/*
                    ITS OWN PARAGRAPH NOW, WHICH RETIRES A NOTE RATHER THAN
                    CONTRADICTING IT. The old note here defended leaving the
                    credit as a bare text node: a span around it bought nothing,
                    because flexbox already wraps a run of text in an ANONYMOUS
                    flex item and the gap applied to it regardless. That was
                    true and is still true — a span INSIDE the paragraph would
                    still be pointless. What changed is that the artist is no
                    longer a second thing inside the rarity's paragraph; it is
                    one of three items the FOOTER distributes, and an item the
                    footer spaces has to be an element, because the footer's
                    children are elements.
                  */}
                  <p className="of-card__credit">
                    {artists.length === 0
                      ? "No artist is credited in the published dataset."
                      : `Illustrated by ${artists.join(", ")}`}
                  </p>
                  {/*
                    WHAT IS ON THE BACK OF THE CARD IN THE PICTURE, when there
                    is anything. A double-faced printing is one physical card
                    carrying two of them.

                    THE PRINTINGS TABLE ALREADY HAS AN `Other face` COLUMN, and
                    this is not a second copy of it. That table is the complete
                    record — every printing in its own row, including the ones
                    with no image — and it is below the fold, past the legality
                    and the rules join, in a grid a reader goes to when they
                    have a question about printings. This is a caption on the
                    picture: it names the back of the ONE printing on screen, in
                    the line that already says what grade that printing is. The
                    same split the rarity makes, for the same reason.

                    IT BELONGS ON THIS LINE BECAUSE IT IS A FACT ABOUT THE
                    PRINTING, which is what the rarity beside it is. And it is
                    published the same way for the same reason: every other face
                    this card has is in the markup, all but one hidden, so the
                    picker can move between printings without a round trip and
                    without this column knowing the picker exists. `--initial`
                    marks the route's own printing, so a crawler and a reader
                    with no scripting see the face that belongs to the picture.

                    THE ANCHOR IS NAMED WITH THE QUALIFIED LABEL, never the bare
                    name: 900 names in this corpus belong to more than one card,
                    and `CardLink.label` is the string composed for exactly this.
                  */}
                  {otherFaces.map((face, slot) => (
                    <p
                      className={
                        String(slot) === currentOtherFace
                          ? "of-card__credit of-card__other of-card__other--initial"
                          : "of-card__credit of-card__other"
                      }
                      data-other-face={slot}
                      key={face.href}
                    >
                      {/*
                        NO SPAN AROUND THE WORDS. `.of-card__credit` is a flex
                        row and flexbox wraps a contiguous run of text in an
                        ANONYMOUS flex item, so the gap already applies — the
                        stylesheet records an earlier attempt to add one here
                        and why it bought nothing.
                      */}
                      Backed with <a href={face.href}>{face.label}</a>
                    </p>
                  ))}
                  <p className="of-card__credit">
                    <a href="#printings">
                      {printingCount} printing{printingCount === 1 ? "" : "s"}
                    </a>
                  </p>
                </footer>
              </div>
            </BevelledPlate>

            {/*
              LEGALITY IS THE FIRST THING UNDER THE PANEL. `docs/SCRYFALL-GAP.md`
              §3: "our legality table is already better than Scryfall's … put it
              on the card page above the fold — it is the differentiator that is
              already finished."
            */}
            <section className="of-card__apparatus" aria-labelledby="legality">
              <h2 className="of-apparatus__heading" id="legality">
                Legality
              </h2>
              <ul className="of-card__formats">
                {page.verdicts.map((verdict) => (
                  <li className="of-card__format" key={verdict.format.id}>
                    <h3
                      className="of-card__format-name"
                      id={`format-${verdict.format.id}`}
                    >
                      {verdict.format.name}
                    </h3>
                    {verdict.unknown ? (
                      /*
                        THE SAME REFUSAL, SAID ONCE INSTEAD OF SIX TIMES. It is
                        deliberately not a `StatePill`: a pill would have to name
                        a state, and the entire point is that there is no state
                        to name — "Not in format" is a claim upstream did not
                        make and this project will not make for it.
                      */
                      <p className="of-card__unknown">No flag published</p>
                    ) : (
                      <ul className="of-card__states">
                        {verdict.states.map((state) => (
                          <li className="of-card__state" key={state.label}>
                            <StatePill tone={state.tone} label={state.label} />
                            {state.since !== null ? (
                              <span className="of-card__since">
                                since{" "}
                                <time dateTime={state.since}>
                                  {state.since}
                                </time>
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                    {verdict.affectsFullCycle &&
                    verdict.format.id === "living-legend" ? (
                      <p className="of-card__scope">
                        Upstream records this restriction as affecting the full
                        cycle of cards sharing this name.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>

            {keywordRules.length > 0 ? (
              <section
                className="of-card__apparatus"
                aria-labelledby="governed-by"
              >
                <h2 className="of-apparatus__heading" id="governed-by">
                  Governed by
                </h2>
                <ul className="of-card__rules">
                  {keywordRules.map((rule) => (
                    <li className="of-card__rules-item" key={rule.ruleId}>
                      <a
                        className="of-card__rules-citation"
                        href={hrefForNumber(rule.number)}
                      >
                        {rule.ruleId}
                      </a>
                      <span className="of-card__rules-keyword">
                        {rule.keyword}
                      </span>
                      {rule.via === "family" ? (
                        /*
                          SAID OUT LOUD, because it is a slightly weaker claim.
                          The rules define `Specialization` once and cards
                          instantiate it per hero, so the match is a resolution
                          rather than a direct hit — and a reference work should
                          say which kind of claim it is making.
                        */
                        <span className="of-card__rules-via">
                          via the general rule
                        </span>
                      ) : null}
                      {/*
                        THE REMINDER TEXT, WHICH IS THE POINT OF THE JOIN. 138
                        cards in this corpus print nothing but keyword names, so
                        the printed text tells a reader who already knows the
                        keyword exactly what they already knew.

                        IT IS QUOTED, NOT INLINED INTO THE CARD'S TEXT. Writing
                        it into `Printed text` would be printing something the
                        card does not say — the one thing a reference work may
                        never do.
                      */}
                      {rule.text !== "" ? (
                        <p className="of-card__rules-text">
                          <CardTextInline nodes={parseInline(rule.text)} />
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="of-card__verify">
                  Matched exactly against the vocabulary the rules publish, and
                  each definition is quoted verbatim from the rule cited beside
                  it. A keyword the document does not define is absent rather
                  than guessed at.
                </p>
              </section>
            ) : null}

            {/*
              ATTRIBUTES COME UP INTO THE COLUMN, out of the full-width run
              below. This is the metadata that describes the card rather than
              the printing, and it belongs beside the face with the rest of what
              the card IS.
            */}
            {vocabulary.length > 0 ? (
              <section
                className="of-card__apparatus"
                aria-labelledby="attributes"
              >
                <h2 className="of-apparatus__heading" id="attributes">
                  Attributes
                </h2>
                <dl className="of-card__attributes">
                  {vocabulary.map(([label, values]) => (
                    <div className="of-card__attribute" key={label}>
                      <dt>{label}</dt>
                      <dd>
                        <ul className="of-card__tags">
                          {values.map((value) => (
                            <li className="of-card__tag" key={value}>
                              {value}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  ))}
                  {card.played_horizontally ? (
                    <div className="of-card__attribute">
                      <dt>Orientation</dt>
                      <dd>Played horizontally</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            ) : null}
          </div>
        </div>
      </article>

      <OrnamentalRule label="Printings" />
      <section className="of-card__apparatus" aria-labelledby="printings">
        <h2 className="of-apparatus__heading" id="printings">
          Printings
        </h2>
        <div className="of-card__scroller">
          <table className="of-card__printings">
            <caption className="of-card__visually-hidden">
              Every published printing of {page.label}
            </caption>
            <thead>
              <tr>
                <th scope="col">Number</th>
                <th scope="col">Set</th>
                <th scope="col">Rarity</th>
                <th scope="col">Edition</th>
                <th scope="col">Foiling</th>
                <th scope="col">Artist</th>
                <th scope="col">Other face</th>
              </tr>
            </thead>
            <tbody>
              {page.printings.map(({ printing, otherFace }) => (
                <tr key={printing.unique_id}>
                  <th scope="row" className="of-card__collector">
                    {printing.id}
                  </th>
                  {/*
                    IN WORDS, WITH THE CODE KEPT BESIDE IT. The name is what a
                    reader wants; the code is what a printing is CITED by, so
                    both are here. An unknown code falls back to itself rather
                    than to a blank.
                  */}
                  <td>
                    <a href={hrefForSet(printing.set_id)}>
                      {setName(printing.set_id)}
                    </a>
                    <span className="of-card__code-hint">
                      {printing.set_id}
                    </span>
                  </td>
                  <td>
                    {printing.rarity === "" ? "—" : rarityName(printing.rarity)}
                  </td>
                  <td>
                    {printing.edition === ""
                      ? "—"
                      : editionName(printing.edition)}
                  </td>
                  <td>
                    {printing.foiling === ""
                      ? "—"
                      : foilingName(printing.foiling)}
                  </td>
                  <td>
                    {printing.artists.length === 0
                      ? "—"
                      : printing.artists.join(", ")}
                  </td>
                  <td>
                    {otherFace === null ? (
                      "—"
                    ) : (
                      <a href={otherFace.href}>{otherFace.label}</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/*
          ONLY WHERE THE PRINTINGS DISAGREE. A card whose every printing carries
          the same flavour has that flavour shown once, in the panel. Repeating
          it here under a collector number would be the same words twice, the
          second time implying a distinction between printings that does not
          exist.
        */}
        {flavours.length > 1 ? (
          <div className="of-card__flavour">
            <h3 className="of-apparatus__heading" id="flavour">
              Flavour text, by printing
            </h3>
            <dl className="of-card__attributes">
              {page.printings
                .filter(({ printing }) => printing.flavor_text.trim() !== "")
                .map(({ printing }) => (
                  <div className="of-card__attribute" key={printing.unique_id}>
                    <dt className="of-card__collector">{printing.id}</dt>
                    <dd className="of-card__flavour-text">
                      {printing.flavor_text}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ) : null}
      </section>

      {relatedShown.length > 0 ? (
        <>
          <OrnamentalRule label="Related cards" />
          <section className="of-card__apparatus" aria-labelledby="related">
            <h2 className="of-apparatus__heading" id="related">
              Related cards
            </h2>
            {relatedShown.map(([label, blurb, links]) => (
              <div className="of-card__related" key={label}>
                <h3 className="of-card__related-name">{label}</h3>
                <p className="of-card__scope">{blurb}</p>
                <ul className="of-card__links">
                  {groupByName(links).map((group) => (
                    <li className="of-card__link" key={group.name}>
                      {/*
                        ONE ROW PER NAME, WITH A STONE PER VERSION — and which
                        of them is a link follows `CardIndex`'s rule rather than
                        a second one invented here.

                        This listed one row per CARD, so "Other versions" on Head
                        Jab was two rows both reading "Head Jab", and `Runechant`
                        carried 119 rows across its three lists where 69 names
                        exist. The pitch was the only thing that differed, which
                        is exactly what a stone is for. Measured: 10,868 rows
                        become 6,816.

                        THE NAME IS ALWAYS THE LINK. `PitchStones` in
                        `CardIndex`: "a stone is a link only where there is
                        something to choose between." A first pass at this list
                        dropped the name's anchor on multi-version rows and left
                        the stones as the only way in — so a reader who had
                        learned on a set page that the name is the card found,
                        on a card page, that it was inert text. The information
                        the two surfaces carry is identical and now so is what
                        can be clicked; what still differs is only how the mark
                        is DRAWN, which `CardIndexEntry.versions` already argues
                        is a per-surface choice rather than an inconsistency.

                        GROUPED BY NAME, WHICH IS SOUND HERE AND WOULD NOT BE
                        EVERYWHERE. Two cards sharing a name in these lists are
                        always the pitch versions of one card — 900 names belong
                        to more than one card and that is what those are — so a
                        name plus a pitch identifies a link. Measured: zero
                        groups in the whole corpus contain two links at the same
                        pitch, which is the collision that would make a stone
                        ambiguous, and the test pins that at zero.
                      */}
                      <a className="of-card__link-name" href={groupHref(group)}>
                        {group.name}
                      </a>
                      <span className="of-card__link-pitches">
                        {group.links.map((link) =>
                          group.links.length === 1 ? (
                            /*
                              A SOLE VERSION DRAWS A PLAIN STONE, unlinked, for
                              the reason `PitchStones` gives: it would point
                              where the name beside it already points — a second
                              control, in a smaller target, for one destination.
                              Half the rows take this branch (51.1% of groups
                              have one version), so it is the common shape rather
                              than an edge.
                            */
                            <PitchJewel
                              key={link.href}
                              value={link.pitch}
                              size="sm"
                            />
                          ) : (
                            /*
                              THE STONE CARRIES THE LINK'S NAME, via
                              `PitchJewel`'s own `label` prop rather than a
                              hidden span beside it. A `role="img"` with an
                              `aria-label` contributes that string to the
                              anchor's accessible name, so the link is called
                              "Head Jab (pitch 2)" with NO text in the DOM at
                              all — which is what keeps two stones on one row
                              from being two links called the same thing, and
                              leaves nothing for a drag-select to pick up.

                              `link.label`, not `link.name`: the label is the one
                              composed to tell two same-named cards apart, and
                              here it is the whole of what names the link.
                            */
                            <a
                              className="of-card__pitch-link"
                              href={link.href}
                              key={link.href}
                            >
                              <PitchJewel
                                value={link.pitch}
                                size="sm"
                                label={link.label}
                              />
                            </a>
                          ),
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </>
      ) : null}

      {/*
        THE PROVENANCE FOLDS. Seven rows of hashes, URLs and a pinned commit —
        the auditability promise, and the thing almost nobody opens. It stayed
        expanded on the argument that a claim whose evidence needs a click is a
        claim being asserted; that argument belongs to the LEGALITY verdict,
        which is a claim about a card, and it does not extend to the corpus
        envelope, which is identical on all 4,941 pages.

        THE RIGHTS LINE USED TO SIT HERE, outside the fold, on the argument that
        it has to accompany the page rather than be available from it. That
        argument is still right and the line is still on every page — it moved to
        the universal footer with the card-image notice, so repeating it here was
        printing the same paragraph twice on one page.
      */}
      <OrnamentalRule label="Source" />
      <section className="of-card__apparatus" aria-labelledby="source">
        <details className="of-card__source-fold">
          <summary className="of-card__source-summary">
            <h2 className="of-apparatus__heading" id="source">
              Source
            </h2>
          </summary>
          <BevelledPlate emphasis="sunken">
            <dl className="of-card__provenance">
              <dt>Upstream</dt>
              <dd>
                <a
                  className="of-card__source-url"
                  href={`https://github.com/${CORPUS.source.repository}`}
                >
                  {CORPUS.source.repository}
                </a>
              </dd>
              <dt>File</dt>
              <dd>
                <code>{CORPUS.source.path}</code>
              </dd>
              <dt>Pinned commit</dt>
              <dd>
                <code className="of-card__hash">{CORPUS.source.commit}</code>
              </dd>
              <dt>Last confirmed</dt>
              <dd>
                <time dateTime={LAST_CONFIRMED}>{LAST_CONFIRMED}</time>
              </dd>
              <dt>Retrieved from</dt>
              <dd>
                <a className="of-card__source-url" href={CORPUS.source.url}>
                  {CORPUS.source.url}
                </a>
              </dd>
              <dt>File SHA-256</dt>
              <dd>
                <code className="of-card__hash">{CORPUS.source.sha256}</code>
              </dd>
              <dt>This card</dt>
              <dd>
                <code>{card.unique_id}</code>
              </dd>
            </dl>
          </BevelledPlate>
          <p className="of-card__verify">
            Card {page.ordinal} of {CORPUS.counts.cards}. Fetch that URL, hash
            it, compare. Every value here is read from those bytes by
            deterministic code — no language model touches this corpus.
          </p>
        </details>
      </section>
    </>
  );
}
