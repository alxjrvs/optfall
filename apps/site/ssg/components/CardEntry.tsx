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
 * Everything below the panel — legality, the rules join — is commentary ON the
 * card and looks like it, which is what lets the legality verdict stay above
 * the fold without competing with the text. An attribute-vocabulary list used
 * to sit there too, printing the card's types, traits and keywords as tags; it
 * was removed, and the type line and printed text on the face are where a
 * reader gets that now.
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

import type { StatKind } from "optfall-components";
import {
  BevelledPlate,
  CardFace,
  IconButton,
  PitchBox,
  PitchJewel,
  StatGlyph,
} from "optfall-components/react";

import {
  assetForSymbol,
  type GameSymbol,
  symbolForKind,
  type SymbolKind,
} from "../../src/lib/card-symbols";
import { parseInline } from "../../src/lib/card-text";
import {
  type CardLink,
  type CardPage,
  facesOf,
  hrefForPrinting,
  STAT_ORDER,
} from "../../src/lib/cards";
import {
  boxFor,
  faceKeyFor,
  faceUrl,
  orientationOfFace,
  placeholderUrl,
} from "../../src/lib/faces";
import { buildKeywordVocabulary, rulesForCard } from "../../src/lib/keywords";
import { CORPUS as RULES_CORPUS } from "../../src/lib/rules";
import { hrefForNumber } from "../../src/lib/search";
import { buyDisclosure, buyHref, buyRel } from "../../src/lib/tcgplayer";
import {
  editionLabel,
  foilingName,
  hrefForSet,
  rarityName,
  raritySlug,
  setName,
} from "../../src/lib/sets";
import { LegalitySection } from "./card/LegalitySection";
import { PrintingsSection } from "./card/PrintingsSection";
import { RelatedCards } from "./card/RelatedCards";
import { TcgplayerMark } from "./card/TcgplayerMark";
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
const KEYWORD_VOCABULARY = buildKeywordVocabulary(RULES_CORPUS);

/*
 * NO `Arcane` ENTRY, AND THAT IS THE POINT RATHER THAN AN OMISSION. Arcane left
 * `STAT_ORDER` because a card does not print it — the number lives in the card's
 * own rules text, which this page renders a few lines further down — so there is
 * no label here for a glyph to answer. `StatGlyph` keeps its `arcane` kind; this
 * page simply never asks for it. See `STAT_ORDER` in `cards.ts`.
 */
const GLYPH_FOR: Record<
  string,
  "cost" | "power" | "defence" | "life" | "intellect" | undefined
> = {
  Cost: "cost",
  Power: "power",
  Defence: "defence",
  Life: "life",
  Intellect: "intellect",
};

const SYMBOL_FOR: Record<string, SymbolKind | undefined> = {
  Cost: "resource",
  Power: "power",
  Defence: "defence",
  Life: "life",
  Intellect: "intellect",
};

/**
 * A stat mark's artwork props, or none.
 *
 * EVERY STAT IN `STAT_ORDER` RESOLVES TO A FILE, so on this page the `null`
 * branch is unreachable rather than rare: the five labels above are exactly the
 * five the Comprehensive Rules name at 1.12.4, and `assetForSymbol` is backed
 * by the ingest script's provenance record for all of them. It is still written
 * as a fallback because `StatGlyph` has one — a symbol LSS stops publishing
 * should cost this page its artwork and keep its stat, not throw.
 *
 * SPREAD RATHER THAN PASSED AS THREE PROPS, because `exactOptionalPropertyTypes`
 * is on: `src={undefined}` is a different type from an absent `src`, and the
 * component's `src !== undefined` test is what chooses between the artwork and
 * the drawn plate.
 */
function artworkFor(
  symbol: GameSymbol | null,
): { src: string; width: number; height: number } | Record<string, never> {
  const asset = symbol === null ? null : assetForSymbol(symbol);
  if (asset === null) return {};
  return { src: asset.src, width: asset.width, height: asset.height };
}

/**
 * The three positions the ordinary card frame has, whether or not a card fills
 * them. Cost sits top-left, attack bottom-left, defence bottom-right.
 *
 * A position this card does not fill is RESERVED, NOT DRAWN — it holds its
 * width and paints nothing. See `printedStats` for why it is neither drawn nor
 * dropped.
 *
 * The other two stats are not here because they have no fixed position: life
 * and intellect belong to a permanent, and each is placed by what the card IS
 * rather than by a slot the frame reserves.
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

/**
 * One corner badge — the card's own mark and the value beside it.
 *
 * NO LABEL, AND THAT IS THE CHANGE THIS FUNCTION EXISTS TO CARRY. Every badge
 * was `<dt>Power</dt><dd>{plate}</dd>`, and the word earned its place while the
 * plate was a silhouette this project cut for itself: a private notation has to
 * be taught, and the micro-caps label was the teaching.
 *
 * The marks are LSS's own files now — the same artwork the reader has already
 * met on the card in their hand and, a few lines up this same page, inline in
 * its printed text. The card labels none of them, and neither does this: a word
 * beside a symbol a reader already knows is a translation of a language they
 * already speak, set 11,378 times in the tightest line on the page.
 *
 * WHAT CARRIES THE WORD NOW. `StatGlyph` is `role="img"` with the stat spelled
 * out — "Power 4", "No printed power" — so nothing was lost for a reader
 * hearing the page. The redundancy that went is the one that only ever served a
 * reader who could see the symbol, which is the reader who needed it least.
 *
 * AND THE `<dl>` WENT WITH IT. A definition list with no terms is not one; the
 * corners are rows of marks, so they are `<div>`s. The class names stayed —
 * they name the corner, not the element that fills it.
 *
 * AN EMPTY POSITION HOLDS ITS WIDTH AND PAINTS NOTHING, which is where this
 * ended after two attempts at showing it.
 *
 * The position is rendered and hidden — `visibility: hidden`, from
 * `StatGlyph`'s own `--absent` rule — because the width is the whole reason it
 * exists. Both bands are `fit-content(28%) minmax(0, 1fr) fit-content(28%)`
 * with the name and the type line centred inside the middle column, so a corner
 * sized to nothing slides the centred thing off the card's axis: measured at
 * 37px on a 320px viewport and 52px at 1226px, on half the corpus.
 *
 * WHAT WAS TRIED IN BETWEEN. A greyed mark — the artwork desaturated and
 * dropped to 30% — on the argument that a reader should SEE the slot this card
 * does not fill rather than infer it from a gap. On the page it read as a
 * rendering fault: about 1.3:1 against the panel, faint enough to look broken
 * and present enough to spend attention on. A mark whose only message is
 * "nothing here" is better off not competing with the marks carrying values.
 *
 * SO IT IS `aria-hidden` AGAIN, and that follows from the rest rather than
 * being a separate decision: a reader hearing the page should not be told about
 * a mark a reader seeing it cannot see. `StatGlyph` still spells the absence
 * out in an `aria-label`; that string is inert under this wrapper and is what
 * would be read if the badge were ever un-hidden.
 */
function StatBadge({
  value,
  kind,
  symbol,
}: {
  readonly value: string | null;
  readonly kind: StatKind | null;
  readonly symbol: GameSymbol | null;
}) {
  return (
    <div
      className="of-card__badge"
      aria-hidden={value === null ? true : undefined}
    >
      {kind === null ? (
        value
      ) : (
        <StatGlyph kind={kind} value={value} {...artworkFor(symbol)} />
      )}
    </div>
  );
}

/**
 * One end of a corner band: what the card puts there, or the width of whatever
 * is at the other end.
 *
 * A BAND IS `corner | centred thing | corner`, AND THE CENTRED THING IS CENTRED
 * INSIDE ITS OWN COLUMN — see the grid note in `CardEntry.css`. So a corner
 * with nothing in it does not leave a tidy gap; it hands its width to the
 * middle column and slides the name, or the type line, off the card's axis.
 * Measured on the built pages: 37px left of centre at a 320px viewport, 52px at
 * 1226px.
 *
 * SO AN EMPTY CORNER MIRRORS THE FULL ONE, which is `mirror` — the opposite
 * corner's own badges, rendered again and hidden. Reflecting the real thing is
 * what makes the two widths equal by construction; a stand-in sized by hand
 * would be a second opinion about how wide a badge is, free to drift from the
 * first. 571 cards need it in the title band — every pitch-0 card that prints a
 * cost, and every pitched card that does not — and one card needs it in the
 * bottom bar: `Polly Cranka`, which prints life and no intellect.
 *
 * BOTH CORNERS EMPTY IS THE CASE THAT NEEDS NOTHING. A hero prints neither
 * pitch nor cost, and two empty corners are already symmetrical, so that band
 * gets the bare spacer it has always had.
 */
function Corner({
  side,
  content,
  mirror,
}: {
  readonly side: "start" | "end";
  readonly content: React.ReactNode | null;
  readonly mirror: React.ReactNode | null;
}) {
  if (content !== null) {
    return (
      <div className={`of-card__badges of-card__badges--${side}`}>
        {content}
      </div>
    );
  }
  if (mirror !== null) {
    return (
      /*
        KEEP THE CORNERS NON-INTERACTIVE. A corner is a `<div>` holding a mark
        or a stone, and nothing in it is focusable — which is the only reason
        `aria-hidden` is safe here. Putting something focusable inside WOULD be
        the bug `noAriaHiddenOnFocusable` is about, and worse than usual,
        because the mirror renders it a second time.

        THIS CARRIED A `biome-ignore` FOR THAT RULE AND THE IGNORE DID NOTHING.
        It justified itself with "the rule fires on the literal `true`" — Biome
        reports the suppression as unused, so the rule does not fire here at
        all, on the literal or otherwise. The claim was wrong, or stopped being
        true and nothing said so. The reasoning above is worth keeping; the
        directive was not.
      */
      <div
        className={`of-card__badges of-card__badges--${side} of-card__corner-mirror`}
        aria-hidden="true"
      >
        {mirror}
      </div>
    );
  }
  return <span className="of-card__corner-empty" aria-hidden="true" />;
}

const CORNER_FOR: Record<string, "start" | "end" | undefined> = {
  Power: "start",
  Intellect: "start",
  Defence: "end",
  Life: "end",
};

import { addressInSet, pitchRank } from "../../src/lib/card-versions";
import { PITCH_REDIRECT } from "../inlineScripts";

export function CardEntry({ page, selected = 0 }: CardEntryProps) {
  const { card } = page;
  const typeLine = card.type_text.trim();
  const text = card.functional_text.trim();

  /**
   * The stat block, including the combat positions this card leaves empty —
   * which are RESERVED rather than drawn. See the end of this note.
   *
   * A Flesh and Blood card frame has three fixed positions — cost top-left,
   * attack bottom-left, defence bottom-right — and a card that prints nothing
   * in one of them used to render nothing there at all. That left the reader
   * inferring an absence from a gap, which is indistinguishable from a layout
   * they had not finished looking at. Worse, it made the absence unreadable
   * against the common case: 1,648 cards print a cost of 0, 191 a defence of 0
   * and 13 a power of 0, so "no power" and "power 0" were a blank and a numeral
   * with nothing to connect them. `StatGlyph` draws the empty ones, keeping the
   * silhouette and taking `null`.
   *
   * ONLY ON A CARD THAT IS ON THAT FRAME, which is what `usesCombatFrame` is
   * for, and the test has TWO halves because one was not enough.
   *
   * It has to print at least one of the three, so the 188 cards printing
   * nothing whatsoever keep the written sentence below rather than growing
   * sockets out of nowhere. And it has to print NO permanent stat, which is the
   * half the first version was missing: 198 cards print life, and only 154 of
   * those are heroes. The other 44 are allies, angels, dragons, demons and
   * token creatures — `Aegis, Archangel of Protection` prints power and life
   * and nothing else — and under "prints any combat stat" they qualified on
   * their power and were handed an empty cost bubble and an empty defence
   * shield. The defence one landed immediately left of the life plate, because
   * `CORNER_FOR` puts both at `end`: an absence asserted in the exact corner the
   * card prints life in. That is the "inventing slots" failure the hero case
   * was carved out to prevent, arriving through a shape the carve-out did not
   * name.
   *
   * AN UNFILLED POSITION IS NOW BLANK, AND THAT IS THE CHANGE. The plates
   * above were drawn: a silhouette, an en dash and a label, on every position
   * a card left empty. It was the commonest thing on the page — 1,543 cards
   * print cost and defence and no power (actions, instants, defence
   * reactions), 411 print cost alone (items, instants, tokens), 529 print
   * defence alone (equipment) — so half the corpus carried a plate whose whole
   * content was the word "no". An absence is only worth drawing where a reader
   * might have gone looking for a value, and on a defence reaction nobody goes
   * looking for an attack. What they get instead is nothing at all: no cell,
   * no dash, no label.
   *
   * IT IS RESERVED, NOT DROPPED, AND THE DIFFERENCE IS THE WHOLE MECHANISM.
   * The two bands are three-column grids — corner, centred thing, corner — and
   * the name and the type line are centred INSIDE the middle column, so a
   * corner that collapses to nothing drags them off the card's axis. Measured
   * on the built pages before this was fixed: the type line sat 37px left of
   * centre at a 320px viewport and 52px left at 1226px, against 0-6px on a
   * card that filled all three. Half the corpus, visibly off-axis. So the
   * badge still renders and still occupies its exact width — `visibility:
   * hidden` rather than `display: none` — and is `aria-hidden`, because a
   * reader hearing the page should not be told about a plate a reader seeing
   * it cannot see. What was a socket is now a spacer.
   *
   * EVERY COUNT IN THIS NOTE IS re-measured against the corpus rather than
   * adjusted by hand; they last moved when arcane left `STAT_ORDER`. 287 cards
   * carry upstream's `arcane` field, so "prints cost and defence and nothing
   * else" used to exclude the 180 that also carried it; the shapes did not
   * change, the vocabulary they are counted in did. Seven cards had arcane as
   * their ONLY value and now print nothing at all, which is where 181 became
   * 188.
   *
   * Cards printing LIFE are the ones that go the other way, above, and the
   * difference is not how many stats they print: a hero or an ally has its OWN
   * furniture in those corners, so a socket there would overwrite something
   * rather than report a gap.
   *
   * Life and intellect are unchanged and appear only when printed. They have no
   * fixed position on the frame — they are where a card's type puts them — so
   * there is no empty slot for them to leave.
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

  /*
     THE FOUR CORNERS, BUILT BEFORE THEY ARE PLACED, because each one is also
     the other's mirror — see `Corner` — and a corner cannot be handed its
     opposite until both exist.
  */
  /*
     THE STONE'S PIPS ARE THE RESOURCE SYMBOL. A pitch value is a resource value
     — CR 1.12.4e — and the card strikes `{r}` into each socket it has paid for,
     so the panel passes the same file `{r}` renders with inline in the text a
     few lines below.

     THIS IS THE ONLY STONE THE PRODUCT DRAWS, which is why the artwork is
     passed unconditionally rather than behind a size test. Lists and grids wore
     `sm` stones until `PitchBox` took that job; `PitchJewel`'s drawn-pip
     fallback is now exercised by the design-system gallery and by stories
     rather than by anything a reader meets here.
  */
  const pitchBadge =
    page.pitch === 0 ? null : (
      <div className="of-card__badge">
        <PitchJewel
          value={page.pitch}
          {...artworkFor(symbolForKind("resource"))}
        />
      </div>
    );
  const costBadge =
    costStat === undefined ? null : (
      <StatBadge value={costStat.value} kind="cost" symbol={costStat.symbol} />
    );
  const badgesFor = (stats: typeof printedStats) =>
    stats.length === 0
      ? null
      : stats.map((stat) => (
          <StatBadge
            key={stat.label}
            value={stat.value}
            kind={stat.kind}
            symbol={stat.symbol}
          />
        ));
  const startBadges = badgesFor(startStats);
  const endBadges = badgesFor(endStats);
  const artists = [
    ...new Set(card.printings.flatMap((printing) => printing.artists)),
  ];

  /*
    NO "OTHER VERSIONS" ROW. It restated, at the foot of the page, a set the
    reader has already been shown nearer the top — so it was the one related
    list with nothing to tell anybody.

    WHICH SURFACE ANSWERS IT DEPENDS ON WHICH PAGE, and both are above this one:
    a pitch page carries the "Alternate pitch values" strip directly under the
    panel, and the shared name page's printings table lists every version's
    printings outright. Note the pitch page's OWN printings table does not — it
    lists that card's printings only — so the strip, not the table, is what
    covers it there.

    `page.variants` is NOT dead: the strip and the JSON-LD both still read it.
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
   * The flavour text of the printing this page shows, or `""` where it has
   * none. It is set in the panel, in the band under the printed text.
   *
   * IT USED TO BE CONDITIONAL ON THE PRINTINGS AGREEING. A card whose every
   * printing carried the same words printed them here; a card whose printings
   * disagreed printed none of them here and a "Flavour text, by printing" list
   * under the printings table instead — one row per printing, keyed by
   * collector number alone. On Steelblade Shunt (pitch 2) that list ran to six
   * rows of which four read WTR127 and the identical sentence, because a row
   * is a printing and those four printings are one wording across two editions
   * and two foilings — neither of which the list named. It read as a
   * distinction between printings that was not there.
   *
   * A PAGE IS ONE PRINTING, SO IT PRINTS ONE PRINTING'S FLAVOUR, on exactly
   * the terms the rarity and the buy link above are already on: `facesOf`
   * dedupes by image, so where two foilings share a picture this is the first
   * one's. That is the same defensible default those two make — see `shown` —
   * and not a new compromise introduced here.
   *
   * WHAT IT COULD COST IS NOTHING ON THIS CORPUS, AND THAT IS MEASURED RATHER
   * THAN ASSUMED. The shape that would cost something is a printing whose
   * flavour differs from the one that claimed its art — its words would then be
   * on no page at all. Walked over every route against the pinned corpus:
   * 468 distinct wordings, 468 of them printed on some page, and each of the
   * 864 cards carrying flavour still shows it somewhere. What does move is
   * WHICH pages carry a band: 731 routes stop (the printing shown genuinely
   * has no flavour of its own, and used to borrow a sibling's) and 103 start
   * (their printings disagreed, so the old condition printed none of them).
   * No page changed its wording. Re-measure rather than trust these figures.
   */
  const flavour = shown?.printing.flavor_text.trim() ?? "";

  /**
   * The storefront link for the printing that CLAIMED the art at the top of the
   * page, or `undefined` when upstream published no product for it.
   *
   * IT IS NOT NECESSARILY THE FOILING THE READER IS LOOKING AT, and an earlier
   * version of this comment claimed the opposite — that hanging the link off
   * `shown` is what stops "a reader looking at a Rainbow Foil" being sent to the
   * Standard. That is exactly backwards, and it is worth spelling out because
   * the mistake is easy to repeat.
   *
   * `facesOf` dedupes printings BY IMAGE and keeps the first one carrying each,
   * so `shown.printing` means "the first printing published with this picture",
   * not "the printing you want". Measured on the pinned corpus: 5,055 arts carry
   * more than one printing and 5,052 of those span more than one foiling —
   * overwhelmingly a Standard and a Rainbow Foil struck from one image. On every
   * one of those pages this link is the Standard's product.
   *
   * THAT IS A DEFENSIBLE DEFAULT RATHER THAN A BUG, because the page cannot know
   * the answer: a card route addresses an ART, so `/card/mst/131/…` names a
   * picture that two foilings share and the URL simply does not carry a foiling
   * to honour. Something has to be linked, and the printing that claimed the art
   * is the only non-arbitrary choice available. What was wrong was the claim,
   * not the code.
   *
   * SO THE BUTTON SAYS WHICH ONE IT BUYS. `faceBuyLabel` names the printing —
   * "MST131, Standard" — and the button carries it as `detail`. That label used
   * to be an aid to choosing: a reader who wanted the foil could hear that this
   * was not it and click the labelled row in the "Buy" section that was. The
   * section is gone, so the label no longer routes anybody anywhere — it is now
   * the only statement the page makes about which of an art's products this
   * link addresses, which makes it more load-bearing rather than less. It is
   * read at the render site rather than folded in here, because it is built
   * further down and this value is needed before it exists.
   *
   * ONE CASE THIS DOES NOT HIT, checked rather than assumed: a first printing
   * with no product whose sibling has one, which would render no button on a
   * purchasable art. Zero occurrences in the pinned corpus.
   *
   * THIS IS ALSO THE DISCLOSURE'S GATE NOW, which it was not when written. The
   * page-wide question — does this card have ANY purchase link, and does the
   * disclosure therefore belong on the page — used to be a `hasBuyLinks` flag
   * handed down to gate a notice under the printings table, then a list derived
   * inside the "Buy" section. With one link on the page, this single value
   * answers it: the button and the sentence render from the same branch, so
   * neither can outlive the other.
   */
  const faceBuyHref =
    shown === undefined ? undefined : buyHref(shown.printing, "card-printings");

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
   * The citation for the printing on screen — `History Pack 1 #101`, with its
   * set half addressable.
   *
   * IT IS THE ONE FACT THE CREDIT LINE WAS MISSING. The line already says what
   * grade this printing is, who drew it and what is on its back; what it could
   * not say is WHICH printing it is talking about, which is the thing a reader
   * writes down. The printings table below carries it in a row like everything
   * else, and this is the same argument the other captions make: the table is
   * the record, the line under the picture is a caption ON the picture.
   *
   * THE SET'S NAME, NOT ITS CODE. This line read `1HP101` — the string the card
   * itself prints — and a code is a lookup rather than a name: a reader who
   * does not already know it learns nothing from it, and this is a reference
   * work. `History Pack 1 #101` states the same fact and answers "which set is
   * this" without a second page. The code has gone nowhere: it is what the
   * set's own URL is spelled with, and the printings table below still sets
   * every collector number in full.
   *
   * ONE PRINTING, BECAUSE THE PAGE SHOWS ONE. It reads off `shown` for the same
   * reason the rarity and the other face do — see `shown` — so it cannot
   * disagree with the picture above it.
   *
   * SPLIT AT THE SET PREFIX, NOT COMPOSED FROM TWO FIELDS. Upstream's collector
   * number already carries the set code (`1HP` + `101` — true of all 16,502
   * printings in this corpus), so setting `id` whole after the set's name would
   * read `History Pack 1 #1HP101`. Where a number does NOT start with its set
   * code the whole of it is printed, because slicing off a prefix that is not
   * there is how a citation turns into a wrong word.
   */
  const shownCode = (() => {
    const printing = shown?.printing;
    if (printing === undefined || printing.id === "" || printing.set_id === "")
      return null;
    /* CASE-FOLDED, LIKE `numberFor` FOLDS IT. That function strips the same
       prefix off a face key and normalizes both sides before comparing; a bare
       `startsWith` here would agree with it on today's corpus and disagree the
       day upstream publishes a lower-case set code, silently setting the set's
       code after its name. */
    const prefixed = printing.id
      .toUpperCase()
      .startsWith(printing.set_id.toUpperCase());
    return {
      /* The set, which is the half of this citation with a page behind it.
         `setName` falls back to the raw code for a set the published data does
         not name, so an unnamed set degrades to `1HP #101` rather than to a
         blank link. */
      setName: setName(printing.set_id),
      href: hrefForSet(printing.set_id),
      /* The position inside that set, which is not a link because there is
         nothing to look up under it. */
      number: prefixed
        ? printing.id.slice(printing.set_id.length)
        : printing.id,
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

  /**
   * What the face's buy link is called — the printing being shown, named by
   * every axis that separates one product from another.
   *
   * IT USED TO BE A MAP OVER EVERY PRINTING, and shrinking it is a consequence
   * of deleting the "Buy" section rather than a tidy-up. That map existed for
   * the same reason as `numberQualifier` one axis over: `numberQualifier` keeps
   * two links to two ADDRESSES from being spoken alike, and this kept two links
   * to two PRODUCTS from being. Standard and Rainbow Foil of one art share a
   * page — so `numberQualifier` correctly adds nothing — while pointing at two
   * different things to buy. That was a real problem for a section that
   * rendered a row per printing. There is one buy link on a card page now, so
   * there is no second name for it to collide with.
   *
   * WHAT WENT WITH THE MAP is a disambiguating suffix, and it is worth naming
   * what is no longer being handled rather than letting it disappear. No set of
   * meaningful fields is unique: Aether Wildfire's EVR123 has two Rainbow Foil
   * products separated only by `art_variations: ["EA"]`, and even number +
   * edition + foiling + variations still collides on four printings in the
   * corpus — Lightning Flow OMN203, Runechant ROS162, Seismic Surge MPG112 and
   * Spectral Shield MST158 — where upstream lists several products under
   * identical metadata. The old map appended `product <id>` on exactly those.
   * A lone label cannot be ambiguous against anything on its own page, so the
   * suffix would now be noise on four printings and never information.
   *
   * THE VARIATION CODES ARE UPSTREAM'S, UNEXPANDED. `EA`, `FA`, `AA`, `AB`,
   * `AT`, `HS` — six codes with no published gloss in the corpus and no
   * expansion table in this repository. Inventing one would be a curation step
   * needing re-verification on every sync, which is the thing the corpus builder
   * refuses to do one layer down.
   */
  const faceBuyLabel = ((): string | undefined => {
    if (shown === undefined) return undefined;
    const printing = shown.printing;

    /*
     * `editionLabel` RETURNS `null`, NOT `undefined`, and the two are not
     * interchangeable here. `N` — "no specified edition", and the commonest
     * edition in the corpus at 11,551 of 16,502 printings — comes back as
     * `null`, so a filter that only drops `undefined` leaves it in and `join`
     * renders it as an empty segment: "buy MST131, , Standard". The printings
     * table handles the same absence one column over, as `?? "—"`.
     */
    return [
      printing.id,
      editionLabel(printing.edition) ?? undefined,
      printing.foiling === "" ? undefined : foilingName(printing.foiling),
      printing.art_variations.length === 0
        ? undefined
        : `art ${printing.art_variations.join(" ")}`,
    ]
      .filter((part) => part !== undefined)
      .join(", ");
  })();

  /**
   * The box the face is drawn in — this printing's own orientation, read off
   * this printing's own key.
   *
   * PER PRINTING RATHER THAN PER CARD, AND NOW ACTUALLY SO. This already said
   * "this printing's own orientation" while answering from `played_horizontally`,
   * which is a property of the CARD — so every printing of a card got the same
   * answer and the distinction the line claims was not being drawn at all.
   * `Vaporize // Shock` is where that shows: `LGS346-CF` is a portrait file and
   * `ROS011` is a landscape one, and the landscape box the card-level field
   * asserted for both letterboxed the first to 322 px wide on a page whose other
   * cards draw at 450.
   */
  const shownBox = boxFor(
    "normal",
    shown === undefined
      ? page.face.orientation
      : orientationOfFace({
          key: shown.key,
          playedHorizontally: card.played_horizontally,
          rotationDegrees: shown.printing.image_rotation_degrees,
        }),
  );

  /**
   * THE STRIP STAYS IN THE SET THE READER IS IN, WHERE THE SET PRINTED THE
   * VERSION THEY ASKED FOR.
   *
   * Every tab used to point at its version's DEFAULT printing, so the one
   * control for moving between three versions of a card also moved you to a
   * different set, a different art and a different collector number — three
   * changes for a click that asked for one. Measured: 2,601 of the 5,799 pages
   * carrying this strip now send at least one tab somewhere else than they did.
   * `shown` is the printing this page is a page OF, so its set code is what the
   * reader has already chosen, and {@link addressInSet} answers whether the
   * version they are asking for was printed in that box.
   *
   * IT FALLS BACK TO THE DEFAULT ADDRESS, AND HAS TO. A set does not have to
   * print every version of a name — a later set adds a pitch 3, a promo carries
   * one art of one version — so "the same set" is a preference and not a rule.
   * The tab goes somewhere either way.
   *
   * THE CURRENT VERSION'S OWN ENTRY IS THIS PAGE, NOT THE CARD'S DEFAULT. It is
   * not rendered as a link (see the strip below), but it IS what `?pitch=` is
   * resolved against, and naming the default there made `?pitch=1` on an
   * alternate art of the pitch 1 card a redirect OFF the printing the reader is
   * looking at. Same rule as the tabs, applied to the tab that is already here.
   */
  const currentHref =
    shown === undefined
      ? page.href
      : hrefForPrinting(shown.setCode, shown.number, page.slug);

  const versions = [
    { pitch: page.pitch, href: currentHref, label: page.label, current: true },
    ...page.variants.map((variant) => ({
      pitch: variant.pitch,
      href:
        (shown === undefined
          ? undefined
          : addressInSet(variant.href, shown.setCode)) ?? variant.href,
      /*
       * `variant.label`, not `variant.name`. It is what names the ANCHOR the
       * mark sits inside — "Head Jab (pitch 2)" — and `CardLink` carries it
       * ready-made for exactly the four lists that would otherwise each have to
       * remember to compose it. See `variantSuffix`.
       */
      label: variant.label,
      current: false,
    })),
  ].toSorted((a, b) => pitchRank(a.pitch) - pitchRank(b.pitch));

  /**
   * The versions this page is NOT — what the "Alternate pitch values" strip
   * draws.
   *
   * DERIVED HERE RATHER THAN FILTERED AT THE CALL SITE, so "is there anything
   * to draw" and "what is drawn" are the same list. The strip used to be a tab
   * row that included the current version and was guarded by
   * `versions.length > 1`; with the current one dropped, that guard and the
   * rendered list would have been two expressions of one fact, and the pair
   * disagrees the first time a card turns up whose only sibling shares its
   * pitch.
   *
   * `pitchTargets` below still reads the FULL list, deliberately: the `?pitch=`
   * redirect has to be able to resolve the pitch you are already on, or a link
   * carrying `?pitch=1` into the pitch 1 page would fall through to no target
   * at all.
   */
  const alternatePitches = versions.filter((version) => !version.current);

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
          {/*
            THE SET, NOT "CARDS". The second crumb used to link `/search` — the
            same destination on all 11,378 card pages, naming a container
            ("Cards") that every page under `/card/` is trivially inside. A
            trail earns its line when the step above the page is somewhere in
            particular, and for a printing that is the set it was printed in:
            this page IS `/card/<set>/<number>/<slug>`, so the set is the
            address's own parent rather than a category invented for the trail.

            IT READS OFF `shownCode`, WHICH IS THE PRINTING ON SCREEN — the same
            value the citation beside the face prints, so the crumb cannot name
            one set while the picture under it is from another. That hazard is
            not hypothetical: it is what the version strip and the old name
            crumb each had to be taught separately.

            "CARDS" SURVIVES AS THE FALLBACK, because a set crumb needs a set.
            `shownCode` is `null` where the printing publishes no set code, and
            a trail that steps straight from the site to the page has lost the
            step it exists for. `/search` is where such a card is found.

            NO PAGE IN THE PINNED CORPUS TAKES THAT BRANCH — counted on the
            build, 0 of 11,378 card pages. It is defence against a field
            upstream can leave empty, not a case the site is known to have, and
            saying so here is cheaper than the next reader measuring it again.
          */}
          <li>
            {shownCode === null ? (
              <a href="/search">Cards</a>
            ) : (
              <a href={shownCode.href}>{shownCode.setName}</a>
            )}
          </li>
          <li>
            {/*
              THE LAST CRUMB IS THE NAME AND THE PITCH TOGETHER, which is one
              crumb where there were two. A disambiguated card spent a whole
              crumb on its name and the next one on its version — "Head Jab ›
              [Pitch 1]" — so the trail took two steps to say one thing, and the
              second of them was a mark with no word beside it. They were never
              two places: `/card/wtr/098/head-jab-1` is one page, and what
              identifies it is the name and the version at once.

              THE NAME CRUMB WAS A LINK TO A CARD PAGE, WHICH IS THE OTHER
              REASON IT IS GONE. It pointed at the lowest-pitch version's
              printing in this set — a page of the same rank as this one, not a
              step up the trail — and the "Alternate pitch values" strip already
              offers that, with every version on it rather than one. Which
              column that strip is in has changed twice and is not the point;
              that it is on this page, above the fold, is.

              IT IS A `PitchBox` RATHER THAN THE STONE, and the trail is why.
              A breadcrumb is a LIST, which is where the boxes belong: the
              crumb is read as a word in a sentence of crumbs, and a cut gem
              dropped into that sentence is an ornament where a word should be.
              The panel's corner still carries the jewel — that is a page about
              one card, which is the stone's whole remaining job.

              THE MARK NOW SPEAKS ITS OWN NUMERAL, which reverses what this note
              said when the mark was the whole crumb. It was labelled with
              `page.label` — "Head Jab (pitch 1)", the whole of it — because a
              crumb announcing "Pitch 1" does not name the page it is the last
              crumb of. The name is printed beside it now, so that same label
              would say the name twice: "Head Jab, Head Jab (pitch 1)".
              `PitchBox`'s default is exactly the half the text is missing,
              which is all the mark is here to add.

              AN UNDISAMBIGUATED CARD DRAWS NO MARK. Its pitch — which may be
              none at all — is not what tells it apart from anything. The gate
              is unchanged; what moved is where the mark sits, not which pages
              carry one.
            */}
            <span className="of-card__crumb-current" aria-current="page">
              {card.name}
              {page.disambiguated ? (
                <PitchBox value={page.pitch} size="sm" />
              ) : null}
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
        /*
          THE TARGET MAP TRAVELS AS AN ATTRIBUTE, AND THAT IS WHAT MAKES THE CSP
          POSSIBLE. It used to be interpolated into the body, which gave every
          one of the 12,776 card pages a different script and therefore a
          different hash — unexpressible in `_headers`, which is pattern-based
          with a 100-rule cap, and the reason `script-src` stayed permissive.
          A CSP hash covers the body only, so moving the data here makes one
          hash admit every card page. React escapes the attribute; the body is
          now a constant in `inlineScripts.ts`, hashed from the same string.
        */
        data-pitch-targets={pitchTargets}
        dangerouslySetInnerHTML={{ __html: PITCH_REDIRECT }}
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
              THE PANEL CARRIES ITS PITCH, so the stylesheet can tint the one
              thing on the page that is allowed to say which version this is
              without words: the rule over the name. A data attribute rather
              than an inline custom property, because the pitch values are a
              closed set the theme already names — `data-pitch` selects one of
              them, where a `style=` would let this file mix a colour. The set
              is five wide now rather than four, which is exactly why it is not
              spelled out here: the count belongs to `PitchValue`, and a comment
              that repeats it is a second copy to leave stale.
            */}
            <BevelledPlate emphasis="flat">
              <div className="of-card__panel" data-pitch={page.pitch}>
                <header className="of-card__band of-card__band--title">
                  {/*
                    PITCH IS UNLABELLED, LIKE COST, and for once the two corners
                    agree with the card rather than with each other. The stone
                    said "Pitch" in micro caps beside a numeral; the card prints
                    three slots in its top-left corner, fills them from the top,
                    and names nothing. `PitchJewel` counts the same way now, and
                    what the word was carrying is in its accessible name.
                  */}
                  <Corner
                    side="start"
                    content={pitchBadge}
                    mirror={costBadge}
                  />
                  {/*
                    `card.name`, not `page.label`. Everywhere else in the product
                    a link to this card renders the label — 900 names belong to
                    more than one card. Here the tab strip immediately above
                    carries that distinction, visibly, so repeating it in the
                    heading would make the three versions read as three cards.
                  */}
                  <h1 className="of-card__name">{card.name}</h1>
                  <Corner side="end" content={costBadge} mirror={pitchBadge} />
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

                {flavour !== "" ? (
                  <div className="of-card__band of-card__band--flavour">
                    <h2 className="of-card__visually-hidden" id="flavour-text">
                      Flavour text
                    </h2>
                    <p className="of-card__flavour-text">{flavour}</p>
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
                  <Corner
                    side="start"
                    content={startBadges}
                    mirror={endBadges}
                  />

                  <p className="of-card__type-line">
                    {typeLine === "" ? "Flesh and Blood card" : typeLine}
                  </p>

                  <Corner side="end" content={endBadges} mirror={startBadges} />

                  {!hasStats ? (
                    <p className="of-card__void">
                      No printed cost, power, defence, life or intellect value.
                    </p>
                  ) : null}
                </div>

                {/*
                  THE FOOT OF THE PANEL, IN THE FINE-PRINT REGISTER — what grade
                  this printing is, which printing it is, who drew it and what is
                  on its back. Every one of them reads straight off the record.

                  NO PRINTING COUNT. A `N printings` link to the table below used
                  to close the line. It was a number nobody asked this page for:
                  the table it pointed at is on this same page under a heading of
                  its own, so the link duplicated the document's own structure,
                  and the count itself answered a question a reader arrives at
                  the table already asking.
                */}
                <footer className="of-card__band of-card__band--credits">
                  {/*
                    ONE FACT, ONE ELEMENT, ONE `space-between`.

                    Rarity and the artist credit used to share a paragraph, so
                    the row the footer distributes had only TWO items in it: a
                    clump on the left and the printing count on the right. The
                    facts down here are independent of one another — what grade
                    this printing is, which printing it is, who drew it, what is
                    on its back — and reading them as two-and-one made the first
                    two look like one compound fact.

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
                    `History Pack 1 #101`, the set a reader names and the
                    position inside it they quote.

                    THE SET IS THE LINK AND THE NUMBER IS NOT. `History Pack 1`
                    names something with a page of its own; `#101` names a
                    position inside it and has nowhere to go, so linking the
                    whole citation would promise a destination for a half of it
                    that has none. The set's own page is where "what else is in
                    this set" is answered.

                    THE ANCHOR READS AS A NAME NOW, WHICH RETIRES A WORKAROUND.
                    It used to read `MST` with the set's name clipped inside it,
                    because a link named by a code is a lookup and `label in
                    name` needed something to hold on to. The visible text IS
                    the name, so the hidden copy is gone rather than duplicated
                    — and with it the `user-select: none` rule that kept it out
                    of a paste.

                    ONE SPAN AROUND BOTH HALVES, AND IT IS LOAD-BEARING. This
                    paragraph is a flex row with a gap, and flexbox wraps a bare
                    text node in an anonymous flex item — the note beside
                    `.of-card__credit` says so, and it is the reason nothing
                    else in this footer is wrapped. Here it works the other way:
                    the name and the number are ONE citation, so letting the row
                    space them would set them at the footer's gap rather than at
                    the word space and hair of margin the stylesheet gives them.
                    The span makes them a single item, the same trick
                    `.of-card__rarity` uses on the bubble and its word.
                  */}
                  {shownCode === null ? null : (
                    <p className="of-card__credit">
                      <span className="of-card__printing-code">
                        <a href={shownCode.href}>{shownCode.setName}</a>{" "}
                        <span className="of-card__printing-number">
                          {`#${shownCode.number}`}
                        </span>
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
                </footer>
              </div>
            </BevelledPlate>

            {/*
              DIRECTLY UNDER THE CARD, ABOVE THE VERDICT. ~~Under the picture,
              because the other versions are a fact about the object rather
              than about the panel of facts. This column is where the card as
              an object lives — this art, this printing — and "the same card in
              another colour" belongs to the object, not to the table of facts
              beside it.~~ Struck: the strip is back in the facts column, in
              the gap between the panel and the legality grid. What it states
              is a fact about the READING rather than about the artefact — a
              reader who has just finished this card's text is the reader who
              asks whether the same name pitches for anything else, and the
              answer belongs where that text ends rather than at the foot of a
              picture a column away from it.

              THE ALTERNATES STILL COME AFTER THE CARD AND NEVER BEFORE IT.
              That much has not moved through any of this, and it is why the
              strip is not above the panel: a reader arrives for a card, and a
              page that opens with "here are three other cards" has answered a
              question nobody asked.

              AND IT STILL DOES NOT DRAW THE VERSION YOU ARE READING. The strip
              was once a tab row carrying the current pitch as a non-link with
              an accent edge — three marks to say one of them is where you
              already are. The panel's own corner says the pitch and the
              breadcrumb says it again. So the heading names the rest: these
              are the ALTERNATES, and every one is a link that goes somewhere.

              `alternatePitches`, NOT A FILTER HERE. The list is derived beside
              `versions` so that "is this worth drawing at all" is one predicate
              rather than a `.length` test written twice — see its definition.
            */}
            {alternatePitches.length > 0 ? (
              <section
                className="of-card__apparatus"
                aria-labelledby="alternate-pitches"
              >
                <h2 className="of-apparatus__heading" id="alternate-pitches">
                  Alternate pitch values
                </h2>
                {/*
                  THE LINK IS THE BOX, AND THE LABEL BESIDE IT IS GONE WITH THE
                  STONE. Each tab used to be a jewel plus a wide-tracked
                  uppercase "PITCH 1" — the numeral in the stone and the words
                  next to it saying the same thing twice, which was the price of
                  a mark that could not spell itself. `PitchBox` is those words,
                  so the second copy went rather than being kept beside a mark
                  that had made it redundant.

                  AND THE BOX IS A BAR: `variant="bar"`, with the row dividing
                  the column's width evenly between however many alternates
                  there are. ~~AT THE FULL STEP, NOT `sm`. These sit a few
                  centimetres above the legality flags and are the same object
                  as them.~~ ~~The flags are in the other column now, so the
                  comparison that chose this step is no longer on the screen to
                  make.~~ Struck twice: the flags ARE directly under this row
                  again, and the mark is no longer a tag whose width its own
                  words decide, so neither sentence is choosing anything any
                  more. ~~`PitchBox` carries why a full-width bar takes the fill
                  that a tag beside a line of type does not.~~ Every pitch mark
                  takes the fill now, so the variant chooses a WIDTH and nothing
                  else — the stylesheet on `.of-card__version-tabs` carries how
                  the row divides, and `.of-card__version-tab` carries why the
                  bar itself sets no height.
                */}
                <ul className="of-card__version-tabs">
                  {alternatePitches.map((version) => (
                    <li key={version.href}>
                      <a className="of-card__version-tab" href={version.href}>
                        <PitchBox
                          value={version.pitch}
                          label={version.label}
                          variant="bar"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/*
              LEGALITY LEADS THE APPARATUS, AND THE ALTERNATE-PITCH ROW IS THE
              ONE THING IN FRONT OF IT. ~~Nothing is in front of it again.~~
              ~~Struck: that strip moved to the face column, so this is once
              more "directly under the panel, with nothing at all between
              them".~~ Struck in turn — the strip is seated here again, and it
              is still the only thing that is: a heading and a row of two or
              three links, which is a few lines and pushes nothing below the
              fold. What may never stand in this gap is a control that is not
              about the card, which is what the note on the buy row below
              records.
              `docs/SCRYFALL-GAP.md` §3 is unchanged and is the reason this is
              FIRST of the apparatus proper: "our legality table is already
              better than Scryfall's … put it on the card page above the fold —
              it is the differentiator that is already finished."

              THE BUY ROW USED TO STAND IN THIS GAP and now follows this
              section instead. A button and one line of disclosure are not a
              section, so seating them here pushed nothing below the fold —
              but it did put a commercial control between the card and the
              verdict, and the verdict is what this project is for. A reader
              who has just read the card is asking whether they may play it.
              That answer comes first now, and the button comes after it.
            */}
            <LegalitySection verdicts={page.verdicts} />

            {/*
              THE ONLY BUY LINK ON THE PAGE, and it used to be one of several.
              A "Buy" section below the printings table listed a row per
              purchasable printing; it is gone, and this is what commerce on a
              card page now amounts to. It buys the printing this page is a page
              OF — the one in the picture across the gutter, and the one the
              panel above it mirrors.

              IN THE FACTS COLUMN, NOT UNDER THE PICTURE, and the picture is
              why it moved. The face column is one `card.face.normal` image and nothing
              else, which on most cards is taller than the panel, the legality
              grid and the rules join stacked together — so a button at the end
              of that column rendered level with the BOTTOM of the image, a
              screenful below the facts it belongs beside, with empty ground to
              the right of it, and on a phone below the fold. It is in the
              facts column instead, with the rest of the card's apparatus.

              UNDER LEGALITY, NOT ABOVE IT, which is the other half of where
              it goes. It was the first thing after the panel for a while,
              which put a link to a marketplace between the card and the
              legality verdict — see the note on that section for why the
              verdict answers first. Where to buy a card does not go
              ahead of what the card is and whether it may be played.

              THE LABEL DOES THE WORK THE PICTURE USED TO. Adjacency to the face
              was the argument for a bare button once; the `detail` below is
              what names the printing now, and it named it then too.

              AND IT STILL NAMES WHICH PRINTING IT BUYS, because it cannot be
              sure that is the one you wanted. A card route addresses an ART,
              and 5,052 arts in this corpus are shared by more than one foiling,
              so `shown.printing` is the printing that CLAIMED the picture
              rather than the foiling a reader has in mind — see the note on
              `faceBuyHref` for the measurement and for why that is still the
              right default. The `detail` is what keeps the claim honest: this
              says outright that it buys MST131 Standard.

              THAT CLAIM MATTERS MORE NOW, NOT LESS, and the reason is worth
              stating because the naming machinery got smaller in the same
              change. While the section existed, a reader who wanted the foil
              could read the `detail`, see this was not it, and click the
              labelled row that was. There is no such row any more. The label is
              no longer an aid to choosing between links — it is the whole of
              what the page discloses about which product this one is.

              NOTHING WHERE THERE IS NOTHING TO BUY. 1,336 printings have no
              upstream product; `buyHref` returns undefined for those and this
              renders no button rather than a disabled one — and the disclosure
              below is inside the same branch, so a page with no link makes no
              claim about links.
            */}
            {faceBuyHref === undefined || shown === undefined ? null : (
              /*
                THE BUTTON AND ITS DISCLOSURE ARE ONE ROW, not two stacked
                items, and the wrapper is what makes them one. The sentence ran
                the full width of the facts column directly under the button,
                which is a paragraph several times the height of the control it
                describes, in the slot the row held then — directly under the
                card panel, above Legality rather than below it — while
                the ground to the right of a 189px button sat empty at exactly
                the widths where the paragraph was longest. It goes there now.

                AT EVERY WIDTH, INCLUDING A PHONE, and that is the part that
                changed most recently. It used to drop back underneath when the
                row got narrow, which meant the arrangement inverted on the
                screens where the empty ground beside the button is widest
                relative to the page. On a phone the sentence is now a narrow
                column beside the button rather than a full-measure paragraph
                below it: more lines, less page. The rule on
                `.of-card__buy-verify` names the width and line count it was
                measured at, at each of ten viewports.

                IT IS STILL ADJACENT, WHICH IS THE PROPERTY THAT MATTERS.
                `docs/COMPLIANCE.md` §2 asks for disclosure next to the link it
                describes; beside is as next-to as under, and it is the reading
                order a reader takes anyway — the button names the vendor, the
                sentence to its right says what the link is.
              */
              <div className="of-card__buy">
                <IconButton
                  detail={faceBuyLabel ?? shown.printing.id}
                  href={faceBuyHref}
                  icon={<TcgplayerMark />}
                  label="Buy on TCGplayer"
                  rel={buyRel()}
                />

                {/*
                  THE DISCLOSURE FOLLOWS THE LINK, which is why it moved with
                  it rather than staying under the face. It used to sit under
                  the "Buy" section, directly beneath the rows it described, and
                  `docs/COMPLIANCE.md` §2 named that adjacency as the fix if
                  that section ever went: TCGplayer's Partner Guidelines want
                  disclosure that is "clear, conspicuous, prominent and
                  unambiguous to the average member of your audience", and being
                  next to the link is most of that. The column changed, and then
                  the side did — it is beside the button rather than under it
                  now, see the wrapper above — and then the side stopped
                  depending on the viewport, which is the one of the three moves
                  that STRENGTHENS the requirement rather than merely preserving
                  it: "conspicuous to the average member of your audience" is a
                  claim about the reader on the small screen too, and that
                  reader is now shown the sentence beside the link rather than
                  after it.

                  ONCE, BECAUSE THERE IS ONE LINK. The "exactly once" assertion
                  in `ssg.test.ts` predates this and still holds — it just holds
                  for the opposite reason. It used to guard against repeating
                  the sentence beside this button as well as under the section;
                  now this button IS the section's replacement and the sentence
                  has nowhere else to be.

                  SHORTER THAN IT WAS, AND THAT SERVES THE SAME REQUIREMENT
                  ADJACENCY DOES. It was four sentences and is two: the material
                  connection, and nothing else. The two that went — where the
                  product name comes from, and that no price or endorsement is
                  implied — were provenance and self-description, and they made
                  the one paragraph on this page a reader most needs to read
                  twice as long as it had to be. `buyDisclosure` carries the
                  argument and the citation. It is also what makes the row work:
                  two lines fit the button's height, four never could.

                  THE TEXT SWITCHES ITSELF. `buyDisclosure` reads the same
                  constant the link does, so the sentence cannot claim we earn
                  nothing on a page whose link is earning — see
                  `apps/site/src/lib/tcgplayer.ts`.
                */}
                <p className="of-card__verify of-card__buy-verify">
                  {buyDisclosure()}
                </p>
              </div>
            )}

            {keywordRules.length > 0 ? (
              <section className="of-card__apparatus" aria-labelledby="rules">
                <h2 className="of-apparatus__heading" id="rules">
                  Rules
                </h2>
                <ul className="of-card__rules">
                  {/*
                    ONE LINE PER RULE, READ AS A DEFINITION: the keyword in
                    bold, a colon, and what the rules say it means. THE
                    REMINDER TEXT IS THE POINT OF THE JOIN — 138 cards in this
                    corpus print nothing but keyword names, so the printed text
                    tells a reader who already knows the keyword exactly what
                    they already knew.

                    ~~IT IS ALSO FOLDED AWAY.~~ Struck. The definition used to
                    sit inside a closed `<details>` whose `<summary>` was the
                    citation and the keyword, on the argument that the
                    most-governed cards draw four rules each and four stacked
                    block quotations buried the thing a reader scans this
                    section FOR. That traded the answer for the index: a reader
                    who has to click to learn what `Go again` does has been
                    shown a citation instead of an answer. Four short lines
                    cost less than four folds.

                    THE CITATION GOES LAST, because it is the provenance of the
                    sentence in front of it rather than a heading over it. Same
                    link, same target; it now closes the line it sources.

                    IT IS STILL NOT THE CARD'S OWN TEXT. Writing it into
                    `Printed text` would be printing something the card does
                    not say — the one thing a reference work may never do — and
                    the quieter type here is what keeps the two apart now that
                    no quotation rule does it.

                    NOTHING TO SAY, NOTHING TO PUNCTUATE. `text` is typed as
                    possibly empty and no row in the corpus is (0 of 3,933 rule
                    rows across every card, measured against `cr-2.14.0`), but
                    a colon introducing nothing is a promise the line cannot
                    keep, so a textless row is the keyword and its citation.
                  */}
                  {keywordRules.map((rule) => (
                    <li className="of-card__rules-line" key={rule.ruleId}>
                      <strong className="of-card__rules-keyword">
                        {rule.keyword}
                      </strong>
                      {rule.text === "" ? null : (
                        <>
                          {": "}
                          <CardTextInline nodes={parseInline(rule.text)} />
                        </>
                      )}{" "}
                      <a
                        className="of-card__rules-citation"
                        href={hrefForNumber(rule.number)}
                      >
                        {rule.ruleId}
                      </a>
                      {rule.via === "family" ? (
                        /*
                          SAID OUT LOUD, because it is a slightly weaker claim.
                          The rules define `Specialization` once and cards
                          instantiate it per hero, so the match is a resolution
                          rather than a direct hit — and a reference work should
                          say which kind of claim it is making. It sits beside
                          the citation because it qualifies the citation.
                        */
                        <span className="of-card__rules-via">
                          via the general rule
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </article>

      <PrintingsSection
        page={page}
        hrefByFace={hrefByFace}
        numberQualifier={numberQualifier}
        shown={shown}
      />

      {/*
        THERE WAS A "BUY" SECTION HERE, AND ITS REMOVAL IS THE POINT. It listed
        one row per purchasable printing — collector number, edition, foiling,
        and a branded button each — between the printings table and the related
        cards. Before that it was the table's eighth column. Both placements
        were arguing about WHERE a block of commerce belongs in a reference
        work; the answer taken here is that it does not need a block. The one
        purchase link that survives is the button under the face, which buys the
        printing the reader is already looking at.

        WHAT WENT WITH IT: the disclosure moved UP to sit with that button —
        beside it, in the facts column, see `.of-card__buy` — because it has to
        accompany the link it describes, and the cross-printing naming machinery
        collapsed to a single label (see `faceBuyLabel`) because a page with one
        buy link has nothing to disambiguate it against.
      */}
      <RelatedCards
        relatedShown={relatedShown}
        /* The set of the printing on screen. `""` where the page has no face
           at all, which `addressInSet` answers `undefined` for — so those
           rows keep each card's own address, as they always did. */
        setCode={shown?.setCode ?? ""}
      />

      {/*
        THE SOURCE FOLD IS GONE, and it is deleted rather than collapsed.

        Seven rows of hashes, URLs and a pinned commit, identical on all 4,941
        card pages — the corpus envelope, not a claim about this card. `/about`
        already states it once, with the file path and the commit, which is the
        version a reader can act on; repeating it under every card was the same
        argument set pages settled when their provenance line went.

        Two things that lived near it did NOT go with it. The rights line had
        already moved to the universal footer with the card-image notice, and
        `check-disclaimer` and `check-card-notice` enforce both there, on every
        page. Nothing this file renders was ever the enforcement point.
      */}
    </>
  );
}
