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
   * attack plate; 525 print defence alone (equipment) and gain two.
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

  const rarities = (() => {
    const seen = new Set<string>();
    const found: {
      name: string;
      initial: string;
      rest: string;
      slug: string;
    }[] = [];
    for (const printing of card.printings) {
      if (printing.rarity === "" || seen.has(printing.rarity)) continue;
      seen.add(printing.rarity);
      const name = rarityName(printing.rarity);
      found.push({
        name,
        initial: name.slice(0, 1),
        rest: name.slice(1),
        /* A rarity upstream adds later falls through to a name with no colour
           rather than to a broken `var()`. */
        slug: name.toLowerCase().split(" ")[0] ?? "",
      });
    }
    return found;
  })();

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
    }[] = [];

    for (const printing of card.printings) {
      const key = faceKeyFor(printing.image_url);
      if (key === null || seen.has(key)) continue;
      seen.add(key);

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
                    <PrintedText text={card.functional_text} uid={page.slug} />
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
                  <p className="of-card__credit">
                    {/*
                      RARITY LEADS THE CREDIT LINE, initial in a bubble and the
                      rest of the word beside it — "(M)ajestic" as one word. The
                      letter is the form the card itself prints in its bottom
                      margin; the rest is there because a letter alone is a
                      lookup, and this is a reference work. The colour is a
                      grouping and not a claim.
                    */}
                    {rarities.map((rarity) => (
                      <span
                        className="of-card__rarity"
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
                    {/*
                      A BARE TEXT NODE, DELIBERATELY. It was briefly wrapped in a
                      span on the theory that `gap` only spaces elements — which
                      is wrong: flexbox wraps each contiguous run of text in an
                      ANONYMOUS flex item, and the gap applies to it like any
                      other. The span bought nothing, styled nothing, and left a
                      class name in the sheet that no rule matched.
                    */}
                    {artists.length === 0
                      ? "No artist is credited in the published dataset."
                      : `Illustrated by ${artists.join(", ")}`}
                  </p>
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
                  {links.map((link) => (
                    <li className="of-card__link" key={link.href}>
                      <PitchJewel value={link.pitch} size="sm" />
                      {/*
                        `link.label`, never `link.name`. Two cards on this list
                        can share a name; the label is what makes the two anchors
                        distinguishable to somebody reading the links alone.
                      */}
                      <a href={link.href}>{link.label}</a>
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
