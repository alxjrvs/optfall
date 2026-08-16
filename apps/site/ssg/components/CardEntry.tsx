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
 * THERE IS NO ISLAND ON THIS PAGE AT ALL, which is the end of a direction the
 * previous note recorded halfway. It said the printing picker was the only
 * island here — one interactive control across 11,378 pages, with the
 * printed-text toggle done in CSS so it cost nothing. The picker is gone: the
 * printings table below is how a reader reaches another art, each row
 * addressing the art it is published with, so the heaviest route in the build
 * ships no JavaScript of its own and every caption on it is server-rendered.
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
  HREF_BY_NAME_SLUG,
  hrefForPrinting,
  LAST_CONFIRMED,
  STAT_ORDER,
  variantSuffix,
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
  editionLabel,
  foilingName,
  hrefForSet,
  rarityName,
  raritySlug,
  setName,
} from "../../src/lib/sets";
import { CardTextInline } from "./CardTextInline";
import "./CardEntry.css";
import { PrintedText } from "./PrintedText";

export interface CardEntryProps {
  readonly page: CardPage;
  /**
   * Which art this page shows — an index into `facesOf(card)`.
   *
   * IT IS THE WHOLE OF WHAT A PER-PRINTING URL MEANS now that the picker is
   * gone. Every URL is `/card/<set>/<number>/<slug>` and names exactly one
   * face, so the picture, the rarity beside it and the row marked in the
   * printings table are all decided here, at build time, by the address. Face 0
   * is not special any more — it is simply the one the card's own links point
   * at.
   */
  readonly selected?: number;
}

/** The keyword vocabulary, built once for all 11,378 card pages. */
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
 * where a row's NAME points, and how it is NAMED — see `groupTarget`. A related
 * list can be a subset: upstream's `referenced_cards` names card ids, not
 * names, so a card whose text names Head Jab may pull two of its three
 * versions. Sending that name to the shared page would offer a version the list
 * is not showing; sending a WHOLE group to one of its members would pick a
 * favourite.
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

/**
 * The hidden suffix for a row standing for SOME of a name's versions.
 *
 * ONE VERSION IS `variantSuffix`, UNCHANGED, so the ordinary row is named by
 * the same function every other surface names a card with, and a name belonging
 * to one card still gets `""`.
 *
 * SEVERAL ARE SPELLED OUT — " (pitch 2 and 3)" — rather than named after the
 * one the href opens. The row covers two cards; calling it "(pitch 2)" would be
 * true of the destination and false of the row, and it would announce the same
 * string as the first stone sitting beside it. `PitchRule` spells its own
 * values the same way for the same reason; it cannot be borrowed from because
 * that one is a primitive's `aria-label` and this is a suffix on a name.
 *
 * `variantSuffix` STILL DECIDES WHETHER THERE IS ONE AT ALL: a group of two is
 * two cards sharing a name, so both are disambiguated by construction.
 */
function versionsSuffix(links: readonly CardLink[]): string {
  const first = links[0];
  if (first === undefined) return "";
  if (links.length === 1)
    return variantSuffix(first.pitch, first.disambiguated);

  const spoken = links.map((link) =>
    link.pitch === 0 ? "no pitch" : String(link.pitch),
  );
  const last = spoken[spoken.length - 1];
  return ` (pitch ${spoken.slice(0, -1).join(", ")} and ${last})`;
}

/**
 * Where a row's NAME points, and what it is CALLED — one function, because they
 * are one decision and splitting them is what shipped a bug.
 *
 * WHERE IT POINTS is the rule `CardIndex` already publishes. `PitchStones`
 * there: "a stone is a link only where there is something to choose between" —
 * the name is the destination, and the marks become controls only when a row
 * stands for more than one card. An earlier version of this list dropped the
 * name's link entirely on a multi-version row and left the stones as the only
 * way in, which made the two surfaces disagree about what a name IS. It is the
 * address for "this card, whichever version you meant", on both.
 *
 * THE WHOLE-GROUP CASE GOES TO THE NAME; A PARTIAL ONE GOES TO A MEMBER. This
 * is `set.page.tsx`'s `collapsed && whole` test, arrived at for the same
 * reason: a set that printed two of three versions lands its name "on one it
 * did print", because the shared page would offer a third the surface is not
 * showing. The partial case is now the RARE one here: it was guaranteed while
 * "Other versions" was a list, because `variants` excludes the card being read
 * by definition, and that list is gone. What is left is partial only when
 * upstream's `referenced_cards` names some versions of a name and not others —
 * measured on the shipped build, 55 rows of 20,372. Rare, not gone, and the
 * branch is what keeps those 55 from offering a version the list is not
 * showing.
 *
 * WHAT IT IS CALLED HAD NO RULE AT ALL, AND THAT WAS THE BUG. A row prints the
 * BARE NAME — the whole point of collapsing versions into a stone. But a bare
 * name is not always a name: 900 in this corpus belong to more than one card,
 * and two anchors that differ only in where they point are a WCAG 2.4.4
 * failure. It was measured at 3,583 card pages carrying such a pair, back when
 * a page listed Other versions and References side by side and
 * `/card/count-your-blessings-1` read "Count Your Blessings" twice — once to
 * `/card/count-your-blessings-2`, once to `/card/count-your-blessings`.
 *
 * DO NOT READ THE RETIRED LIST AS HAVING RETIRED THE HAZARD. It is this rule,
 * not the shorter page, that holds the invariant: measured on the current
 * build, zero pages carry two related anchors with the same accessible name
 * and different destinations — with the qualifier still doing the work on 55
 * rows. Delete the qualifier and pages regress.
 *
 * SO THE ANCHOR IS NAMED FOR WHAT IT STANDS FOR, which is `CardIndexEntry`'s
 * rule — "the full text the anchor must be NAMED by, qualifier and all" — and
 * three cases fall out of it:
 *
 * - A row that IS the whole name goes to the shared page and is named by the
 *   shared name. Nothing to qualify. It reads alike to the breadcrumb and goes
 *   where the breadcrumb goes, which 2.4.4 permits and a reader expects.
 * - A row standing for ONE version is named for that version, "(pitch 2)".
 * - A row standing for SOME of them is named for all of those — "(pitch 2 and
 *   3)". Naming it after the version its href happens to open would be a
 *   third true-but-partial statement: it would announce the same string as the
 *   first stone beside it, for a row that covers two cards. See
 *   {@link versionsSuffix}.
 *
 * IT IS HIDDEN, NOT PRINTED. `CardIndex` does exactly this with
 * `of-index__variant`: the suffix stays inside the anchor and out of sight, so
 * the list still reads as bare names and the links are still told apart by
 * anything reading them aloud. The stones were already right — `PitchJewel`'s
 * `label` names each of them — and this is the same fix applied to the one
 * anchor on the row that was left carrying a bare name.
 */
function groupTarget(group: LinkGroup): {
  readonly href: string;
  readonly qualifier: string;
} {
  const first = group.links[0];
  if (first === undefined) return { href: "", qualifier: "" };

  const known = VERSIONS_BY_NAME.get(group.name);
  const whole =
    group.links.length > 1 &&
    known !== undefined &&
    known.count === group.links.length;

  /* THE NAME'S DEFAULT VERSION, RESOLVED HERE. `/card/<nameSlug>` is a 301
     now; the map holds the address it points at, so the anchor goes straight
     there. Falls back to the first link, which is the lowest-pitch version of
     this group and therefore the same card the map would have named. */
  return whole
    ? {
        href: HREF_BY_NAME_SLUG.get(known.nameSlug) ?? first.href,
        qualifier: "",
      }
    : { href: first.href, qualifier: versionsSuffix(group.links) };
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

  /* THE NAME'S DESTINATION, RESOLVED AT BUILD TIME. `/card/<nameSlug>` is a
     301 now, and a link the page draws itself has no business travelling
     through one — the lowest-pitch version's own address is known here. */
  const nameHref = HREF_BY_NAME_SLUG.get(page.nameSlug) ?? page.href;

  /*
    NO "OTHER VERSIONS" ROW. It restated, at the foot of the page, a set the
    reader has already been shown nearer the top — so it was the one related
    list with nothing to tell anybody.

    WHICH SURFACE ANSWERS IT DEPENDS ON WHICH PAGE, and both are above this one:
    a pitch page carries the version tabs ("Pitch versions of In the Swing")
    directly over the panel, and the shared name page's printings table lists
    every version's printings outright. Note the pitch page's OWN printings
    table does not — it lists that card's printings only — so the tabs, not the
    table, are what cover it there.

    `page.variants` is NOT dead: the tabs and the JSON-LD both still read it.
    This removes a third rendering of the field, not the field.

    What is left is the two lists nothing else on the page covers: the cards
    this one's text names, and the cards that name it.
  */
  const related: readonly (readonly [string, string, readonly CardLink[]])[] = [
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
   * URL from, so taking the addresses from it makes "every art has an address
   * and every address has an art" true by construction.
   */
  const faces = facesOf(card);
  const hrefByFace = new Map(
    faces.map((ref) => [
      ref.key,
      hrefForPrinting(ref.setCode, ref.number, page.slug),
    ]),
  );

  /**
   * THE PRINTING THIS PAGE IS SHOWING, AND THERE IS EXACTLY ONE OF THEM NOW.
   *
   * THE PICKER IS GONE, AND WITH IT AN ENTIRE MECHANISM. A rail of thumbnails
   * used to sit under the face and swap the picture in place, which meant this
   * component could not know at build time what the reader was looking at: the
   * credit line therefore published EVERY rarity the card has and hid all but
   * one, the other faces the same way, and an island stamped the root element
   * on every click so two CSS enumerations could re-choose between them. Three
   * copies of "which printing is on screen", kept in step by attribute
   * selectors.
   *
   * The printings table below was always the better control and was already on
   * the page. It is the complete record — every printing in its own row, with
   * its set, number, rarity, edition, foiling, artist and other face named in
   * columns — where a tile could caption three of those and, on 279 tiles,
   * could not tell a reader which of two identical captions they had clicked.
   * So the table's collector number is the link now, each row addressing the
   * art it is published with, and a page shows ONE printing.
   *
   * WHAT THAT BUYS IS THAT EVERY CAPTION IS TRUE OF THE PICTURE ABOVE IT,
   * server-rendered, with no scripting and no second copy: the rarity, the
   * other face and the art are all read off this one printing.
   *
   * WHAT IT COSTS IS NAMED IN THE TABLE'S OWN COMMENT: an address is per ART,
   * so two printings published with one image share a page.
   *
   * `selected` IS THE ROUTE'S OWN INDEX into `faces`, so this is decided by the
   * URL rather than by state. Out of range falls back to the first face, which
   * is the one the card's own address names; a card with no published image at
   * all has no face here and renders the placeholder.
   */
  const shown = faces[selected] ?? faces[0];

  /**
   * The other faces of this card's printings, keyed by the printing they belong
   * to. `page.printings` is `card.printings` mapped one-for-one, so the lookup
   * is by the printing's own id rather than by position.
   */
  const otherFaceById = new Map(
    page.printings.map(({ printing, otherFace }) => [
      printing.unique_id,
      otherFace,
    ]),
  );

  /**
   * The rarity of the printing on screen, in the parts the credit line sets.
   *
   * ONE RARITY, NOT A LIST, and that is the whole of what the picker's removal
   * changes here. The line used to carry every rarity the card has ever been
   * printed at with all but one hidden; it carries the one belonging to the
   * picture above it, because there is now no way for that picture to change
   * without the page changing with it.
   *
   * `null` WHERE UPSTREAM PUBLISHES NONE, so the line degrades to the artist
   * credit with no stray separator rather than printing a dash. The printings
   * table is still the complete record and lists every printing's rarity in its
   * own row, including the face-less ones a page can never show.
   */
  const shownRarity = (() => {
    const code = shown?.printing.rarity ?? "";
    if (code === "") return null;
    const name = rarityName(code);
    return {
      name,
      initial: name.slice(0, 1),
      rest: name.slice(1),
      slug: raritySlug(code),
    };
  })();

  /**
   * The citation for the printing on screen — `MST131`, with its set half
   * addressable.
   *
   * IT IS THE ONE FACT THE CREDIT LINE WAS MISSING. The line already says what
   * grade this printing is, who drew it and what is on its back; what it could
   * not say is WHICH printing it is talking about, which is the thing a reader
   * writes down. The printings table below carries it in a row like everything
   * else, and this is the same argument the other captions make: the table is
   * the record, the line under the picture is a caption ON the picture.
   *
   * ONE CODE, BECAUSE THE PAGE SHOWS ONE PRINTING. It reads off `shown` for the
   * same reason the rarity and the other face do — see `shown` — so it cannot
   * disagree with the picture above it.
   *
   * SPLIT AT THE SET PREFIX, NOT COMPOSED FROM TWO FIELDS. Upstream's collector
   * number already carries the set code (`MST` + `131` — true of all 16,502
   * printings in this corpus), so concatenating `set_id` with `id` would print
   * `MSTMST131`. Where a number does NOT start with its set code, the whole
   * number becomes the link rather than being sliced into a wrong word: the
   * citation stays intact and only the amount of it that is clickable changes.
   */
  const shownCode = (() => {
    const printing = shown?.printing;
    if (printing === undefined || printing.id === "" || printing.set_id === "")
      return null;
    /* CASE-FOLDED, LIKE `numberFor` FOLDS IT. That function strips the same
       prefix off a face key and normalizes both sides before comparing; a bare
       `startsWith` here would agree with it on today's corpus and disagree the
       day upstream publishes a lower-case set code, silently making the whole
       collector number the set link. */
    const prefixed = printing.id
      .toUpperCase()
      .startsWith(printing.set_id.toUpperCase());
    /* SLICED OUT OF THE NUMBER, NOT SUBSTITUTED FOR IT, so the two halves
       always concatenate back to exactly what upstream published rather than to
       the set code's spelling plus a remainder. */
    return {
      /* The linked half, and its name for anything reading the link aloud. */
      link: prefixed
        ? printing.id.slice(0, printing.set_id.length)
        : printing.id,
      setName: setName(printing.set_id),
      href: hrefForSet(printing.set_id),
      /* The rest of the number, which is not a link because there is nothing
         to look up under it. */
      rest: prefixed ? printing.id.slice(printing.set_id.length) : "",
    };
  })();

  /** The card printed on the back of THIS printing, or `null`. */
  const shownOtherFace =
    shown === undefined
      ? null
      : (otherFaceById.get(shown.printing.unique_id) ?? null);

  /**
   * What tells two rows apart when they share a collector number.
   *
   * THE TABLE'S NUMBER IS A LINK NOW, AND A LINK IS NAMED BY ITS TEXT. Upstream
   * publishes two printings under one collector number whenever a set was
   * released in more than one edition — `WTR098` is Alpha and Unlimited, two
   * different pieces of art — and again where one number carries an alternate
   * treatment: `DYN088` beside `DYN088-MV`. Each row's anchor then read the same
   * word and pointed somewhere different: WCAG 2.4.4, measured at 6,726 card
   * pages the moment the numbers became links.
   *
   * SO AN AMBIGUOUS NUMBER SAYS WHAT SEPARATES IT, hidden inside the anchor
   * exactly as `of-index__variant` and the related lists do it — the visible
   * table still reads as bare numbers, and the links are told apart by anything
   * reading them aloud.
   *
   * THE AXIS HAS TO BE A PROPERTY OF THE ADDRESS, NOT OF THE ROW, and getting
   * that wrong is why this is a pass rather than an expression. A first attempt
   * qualified each row with whatever differed among the ambiguous rows, which
   * named `DYN088`'s three rows "Standard", "Rainbow Foil" and "Cold Foil" —
   * three true statements, two of which point at the SAME art. Two links with
   * different names and one destination is harmless; the collision it left
   * unfixed is that "Standard" and "Rainbow Foil" still had to be told apart
   * from a third row they do not differ from in the way the reader is choosing.
   * Measured: 6,726 pages became 1,342, not zero.
   *
   * So an axis is usable only when it is CONSTANT within each address and
   * DISTINCT between them. Edition passes on the Alpha/Unlimited pairs — every
   * Alpha row is the Alpha art — and fails on `DYN088`, where Standard and
   * Rainbow Foil share one picture. Foiling fails there for the same reason.
   * The art's own key is the backstop and cannot fail: the address is BUILT
   * from it, so it is by construction one value per address.
   *
   * KEYED ON THE ADDRESS, NOT ON THE ROW. Four rows share `WTR098` and only two
   * arts: Alpha standard and Alpha rainbow foil are one picture and one URL, so
   * they are not ambiguous with each other and are named alike on purpose.
   */
  const numberQualifier = ((): ReadonlyMap<string, string> => {
    const byNumber = new Map<
      string,
      {
        id: string;
        href: string;
        edition: string;
        foiling: string;
        key: string;
      }[]
    >();
    for (const { printing } of page.printings) {
      const key = faceKeyFor(printing.image_url);
      const href = key === null ? undefined : hrefByFace.get(key);
      if (key === null || href === undefined) continue;
      const rows = byNumber.get(printing.id) ?? [];
      rows.push({
        id: printing.unique_id,
        href,
        edition: printing.edition,
        foiling: printing.foiling,
        key,
      });
      byNumber.set(printing.id, rows);
    }

    const qualifiers = new Map<string, string>();
    for (const [number, rows] of byNumber) {
      const addresses = [...new Set(rows.map((row) => row.href))];
      if (addresses.length < 2) continue;

      /** The value an axis takes for one address, or `null` if it takes two. */
      const soleValue = (
        href: string,
        field: "edition" | "foiling",
      ): string | null => {
        const values = new Set(
          rows.filter((row) => row.href === href).map((row) => row[field]),
        );
        const only = [...values][0];
        if (values.size !== 1 || only === undefined || only === "") return null;
        /* `N` decodes to a sentence about having no edition, so it can no more
           name a link than a blank can. Measured at zero today — no ambiguous
           number is separated by it — which makes this a guard rather than a
           fix, and the cheapest place to keep the two rules agreeing. */
        return field === "edition" && editionLabel(only) === null ? null : only;
      };

      const axis = (["edition", "foiling"] as const).find((field) => {
        const named = addresses.map((href) => soleValue(href, field));
        return (
          named.every((value) => value !== null) &&
          new Set(named).size === addresses.length
        );
      });

      for (const row of rows) {
        const said =
          axis === undefined
            ? row.key.replace(/\.webp$/, "")
            : axis === "edition"
              ? (editionLabel(row.edition) ?? row.edition)
              : foilingName(row.foiling);
        /*
          A KEY THAT IS ALREADY THE NUMBER ADDS A WORD AND NO INFORMATION.
          `DYN088`'s standard art keys to `DYN088`, so the backstop named it
          "DYN088 (DYN088)" — heard aloud, the number twice. Left bare it is
          still unique, because every OTHER address under this number is keyed
          differently by construction and says so.
        */
        if (said !== number) qualifiers.set(row.id, ` (${said})`);
      }
    }
    return qualifiers;
  })();

  /** The box the face is drawn in — this printing's own orientation. */ /** The box the face is drawn in — this printing's own orientation. */
  const shownBox = boxFor(
    "normal",
    shown === undefined
      ? page.face.orientation
      : orientationOf({
          playedHorizontally: card.played_horizontally,
          rotationDegrees: shown.printing.image_rotation_degrees,
        }),
  );

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
            {/*
              THE LAST CRUMB IS THE STONE, NOT THE NAME AGAIN. On a
              disambiguated card the trail used to end "Celestial Reprimand ›
              Celestial Reprimand (pitch 1)": the name printed twice, the second
              time with the one fact that distinguishes the two crumbs spelled
              out in parentheses at the end of it. The version is what this crumb
              is FOR, so it says the version — in the reserved silhouette the
              rest of the page already uses for exactly this, the same stone the
              tab strip below puts on each version and the panel puts in its
              corner.

              THE STONE IS STILL NAMED BY THE WHOLE LABEL. `PitchJewel` defaults
              to speaking its numeral, which is right beside two other jewels in
              a version strip and wrong as the terminal crumb of a trail: what a
              screen reader should announce for the current page is the page,
              "Celestial Reprimand (pitch 1)", not "Pitch 1". The `label` prop is
              the component's sanctioned way to say so, and it is `page.label`
              rather than a string built here for the reason `CardLink.label`
              exists — one spelling of "which card this is", used everywhere.

              AN UNDISAMBIGUATED CARD KEEPS ITS NAME. There is no name crumb
              above it to avoid repeating, `page.label` is the bare name, and its
              pitch — which may be none at all — is not what tells it apart from
              anything.
            */}
            <span className="of-card__crumb-current" aria-current="page">
              {page.disambiguated ? (
                <PitchJewel value={page.pitch} size="sm" label={page.label} />
              ) : (
                page.label
              )}
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
            {/*
              ONE PICTURE, SERVER-RENDERED, WITH NO CONTROL ON TOP OF IT. The
              rail of thumbnails that used to sit here is gone; the printings
              table below is the control, and each of its rows addresses the art
              it is published with. So this column is a picture again — the last
              island on the heaviest route in the build, retired.

              `CardFace` remains the only sanctioned way to put a card image on
              a page: COMPLIANCE.md §5 forbids a variant that drops the
              attribution, and the notice this component carries is now carried
              once for one image rather than hoisted over a strip of them.
            */}
            <CardFace
              src={
                shown === undefined
                  ? placeholderUrl(page.face.orientation)
                  : faceUrl(shown.key, "normal")
              }
              alt={faceAlt}
              width={shownBox.width}
              height={shownBox.height}
              loading="eager"
            />
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
                    ONE FACT, ONE ELEMENT, ONE `space-between`.

                    Rarity and the artist credit used to share a paragraph, so
                    the row the footer distributes had only TWO items in it: a
                    clump on the left and the printing count on the right. The
                    facts down here are independent of one another — what grade
                    this printing is, which printing it is, who drew it, what is
                    on its back, how many printings exist — and reading them as
                    two-and-one made the first two look like one compound fact.

                    They are siblings now, so `justify-content: space-between`
                    spaces every one of them. NO NUMBER IS WRITTEN DOWN HERE,
                    deliberately: the count varies by printing — the back is
                    there only on a double-faced one, the rarity only where
                    upstream publishes one — so a comment naming a total would
                    be false on most pages the moment a sixth fact arrived. The
                    rule is that each fact is its own paragraph. Nothing else
                    changed: the rarity is still a flex row of its own with one
                    member, because it is one item on this line.
                  */}
                  {/*
                    RARITY LEADS THE CREDIT LINE, initial in a bubble and the
                    rest of the word beside it — "(M)ajestic" as one word. The
                    letter is the form the card itself prints in its bottom
                    margin; the rest is there because a letter alone is a
                    lookup, and this is a reference work. The colour is a
                    grouping and not a claim.

                    ONE RARITY: THE ONE THIS PAGE'S PRINTING WAS PUBLISHED AT.
                    The line used to carry every rarity the card has ever been
                    printed at, all but one hidden, with an island stamping the
                    root element on every click so a CSS enumeration could
                    re-choose. That existed because the picture could change
                    without the page changing. It cannot any more — see `shown`
                    — so the caption is simply true, in the markup, with no
                    scripting and no second copy of the data.

                    NOTHING AT ALL where upstream publishes no rarity for this
                    printing, so the line degrades to the artist credit rather
                    than printing a dash under a picture.
                  */}
                  {shownRarity === null ? null : (
                    <p className="of-card__credit">
                      <span
                        className="of-card__rarity"
                        data-rarity={shownRarity.slug}
                      >
                        <span
                          className="of-card__rarity-mark"
                          aria-hidden="true"
                        >
                          {shownRarity.initial}
                        </span>
                        <span className="of-card__visually-hidden">
                          {shownRarity.name}
                        </span>
                        <span
                          className="of-card__rarity-rest"
                          aria-hidden="true"
                        >
                          {shownRarity.rest}
                        </span>
                      </span>
                    </p>
                  )}
                  {/*
                    WHICH PRINTING THIS IS, BETWEEN ITS GRADE AND ITS ARTIST —
                    `MST131`, the string a reader cites, quotes in a deck list
                    or searches for.

                    THE SET CODE IS THE LINK AND THE NUMBER IS NOT. `MST` names
                    something with a page of its own; `131` names a position
                    inside it and has nowhere to go, so making the whole code a
                    link would promise a destination for a half of it that has
                    none. The set's own page is where "what else is in this
                    set" is answered.

                    ONE SPAN AROUND BOTH HALVES, AND IT IS LOAD-BEARING. This
                    paragraph is a flex row with a gap, and flexbox wraps a bare
                    text node in an anonymous flex item — the note beside
                    `.of-card__credit` says so, and it is the reason nothing
                    else in this footer is wrapped. Here it works the other way:
                    the anchor and the number are ONE word interrupted, so
                    letting the row space them would print `MST 131` and break
                    the citation in half. The span makes them a single item, the
                    same trick `.of-card__rarity` uses on the bubble and its
                    word.

                    THE SET'S NAME IS INSIDE THE ANCHOR, CLIPPED. A link reading
                    "MST" and nothing else is a link named by a code, which is a
                    lookup rather than a name; the visible half stays a code
                    because that is what the card prints, and the accessible
                    name contains it, so `label in name` still holds.
                  */}
                  {shownCode === null ? null : (
                    <p className="of-card__credit">
                      <span className="of-card__printing-code">
                        <a href={shownCode.href}>
                          {shownCode.link}
                          <span className="of-card__visually-hidden">
                            {` (${shownCode.setName})`}
                          </span>
                        </a>
                        {shownCode.rest}
                      </span>
                    </p>
                  )}
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
                    the line that already says what grade that printing is.

                    ONE OF THEM, FOR THE SAME REASON THE RARITY IS ONE. Which
                    card is on the back is a fact about the PRINTING — 16 cards
                    in this corpus are backed with different cards in different
                    printings, and 94 have single-faced printings as well as
                    double-faced ones — and this page shows one printing, so it
                    states that printing's back and nothing else. The four hidden
                    slots and the root stamp that used to choose between them
                    went with the picker.

                    THE ANCHOR IS NAMED WITH THE QUALIFIED LABEL, never the bare
                    name: 900 names in this corpus belong to more than one card,
                    and `CardLink.label` is the string composed for exactly this.
                  */}
                  {shownOtherFace === null ? null : (
                    <p className="of-card__credit">
                      {/*
                        NO SPAN AROUND THE WORDS. `.of-card__credit` is a flex
                        row and flexbox wraps a contiguous run of text in an
                        ANONYMOUS flex item, so the gap already applies — the
                        stylesheet records an earlier attempt to add one here
                        and why it bought nothing.
                      */}
                      Backed with{" "}
                      <a href={shownOtherFace.href}>{shownOtherFace.label}</a>
                    </p>
                  )}
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
              {page.printings.map(({ printing, otherFace }) => {
                /*
                  THE COLLECTOR NUMBER IS THE CONTROL — this is where the
                  picker went.

                  A rail of thumbnails under the face used to do this job and
                  did it worse. A tile could caption three facts and this row
                  names seven; 279 tiles in the corpus read identically to a
                  sibling, so a reader could see two pictures differ, select
                  either, and not learn which they had chosen. Here the row IS
                  the answer, and clicking its number opens the page that shows
                  that art.

                  AN ADDRESS IS PER ART, NOT PER PRINTING, and that is the cost
                  of the trade rather than an oversight. `facesOf` dedupes by
                  image and `CARD_ROUTES` emits one URL per art, so a Standard
                  and a Rainbow Foil published from one picture share a page —
                  the rarity in the caption up there is then the one belonging
                  to the printing that claimed the art, which is the row marked
                  current. Both rows still tell the truth in their own cells,
                  which is what the table is for.

                  A PRINTING WITH NO PUBLISHED IMAGE IS NOT A LINK, because
                  there is no picture for it to open. Four printings in this
                  corpus are that shape; their rows keep every other column.
                */
                const key = faceKeyFor(printing.image_url);
                const href = key === null ? undefined : hrefByFace.get(key);
                const current =
                  shown !== undefined &&
                  shown.printing.unique_id === printing.unique_id;
                const qualifier = numberQualifier.get(printing.unique_id) ?? "";

                return (
                  <tr
                    key={printing.unique_id}
                    className={current ? "of-card__printing--shown" : undefined}
                  >
                    <th scope="row" className="of-card__collector">
                      {href === undefined ? (
                        printing.id
                      ) : (
                        /*
                          `aria-current="page"`, AND IT USED TO BE `"true"`
                          BECAUSE OF A PAGE THAT NO LONGER EXISTS. `"page"`
                          claims the link addresses the URL being rendered. That
                          was true of a card's own route and its per-art routes
                          and FALSE of `/card/head-jab` — the shared page for a
                          name, which rendered the first version's card and so
                          would have marked a row pointing somewhere else as the
                          page you are on. `"true"`, the weaker "current item
                          within a set", was the only claim true on every route.

                          Every route is a printing now and every printing's row
                          addresses itself, so the stronger claim is simply
                          accurate — and it is the one a screen reader can do
                          something with, since "page" is the value that gets
                          announced as *this page* rather than as an unspecified
                          currency.

                          It is still a link, which is what makes the row
                          copyable: the marked row is the permalink for the art
                          at the top of this page.
                        */
                        <a
                          href={href}
                          aria-current={current ? "page" : undefined}
                        >
                          {printing.id}
                          {qualifier === "" ? null : (
                            <span className="of-card__visually-hidden">
                              {qualifier}
                            </span>
                          )}
                        </a>
                      )}
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
                      {printing.rarity === ""
                        ? "—"
                        : rarityName(printing.rarity)}
                    </td>
                    {/*
                      AN EM DASH WHERE THERE IS NO EDITION, and `N` is no
                      edition. Upstream glosses that code as "No specified
                      edition (used for promos, non-set releases, etc.)" — its
                      own explanation of an absence, in the commonest edition in
                      the corpus — which this column printed in full on most
                      rows of most cards. See `editionLabel`.
                    */}
                    <td>{editionLabel(printing.edition) ?? "—"}</td>
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
                );
              })}
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
                  {groupByName(links).map((group) => {
                    const target = groupTarget(group);
                    return (
                      <li className="of-card__link" key={group.name}>
                        {/*
                        ONE ROW PER NAME, WITH A STONE PER VERSION — and which
                        of them is a link follows `CardIndex`'s rule rather than
                        a second one invented here.

                        This listed one row per CARD, so `Runechant` carried 119
                        rows across the lists it had where 69 names exist. The
                        pitch was the only thing that differed, which is exactly
                        what a stone is for. Grouping took 10,868 rows to 6,816
                        at the time; retiring the Other versions list has since
                        taken the two remaining lists to 20,372 rows across
                        4,388 pages, 3,883 of them carrying more than one
                        stone — so the collapse is doing MORE work here now, not
                        less, because the list that survived is the one where
                        one name really can mean several cards.

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
                        <a className="of-card__link-name" href={target.href}>
                          {group.name}
                          {/*
                          READ BUT NOT SEEN, exactly as `of-index__variant` is
                          in the card index. Empty on a row that points at the
                          shared page, because there is nothing left to qualify;
                          see `groupTarget`.
                        */}
                          {target.qualifier === "" ? null : (
                            <span className="of-card__visually-hidden">
                              {target.qualifier}
                            </span>
                          )}
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
                    );
                  })}
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
