/**
 * `/spoilers` — cards revealed for sets that are not out yet.
 *
 * THE DATA IS `data/spoilers/spoilers.json`, rebuilt daily by
 * `.github/workflows/spoilers.yml` from the card corpus's own upstream; see
 * `scripts/build-spoilers.ts` for where it comes from and what counts as a
 * spoiler. This page only lays it out.
 *
 * A VISUAL SPOILER: A GRID OF FACES, ONE CELL PER CARD. A set's reveals are
 * read the way a reader meets them everywhere else — as pictures of cards —
 * so each set is a grid at the density `CardIndex` draws, with the collector
 * number and rarity under each face and the card's text one click away.
 *
 * THE TEXT STAYS ON THE PAGE, folded under each face. The face is a picture
 * of the text, and a picture is no help to a screen reader, to search, or to a
 * reader whose face has not reached our host yet; the folded text is all three
 * of those. Closed `<details>` keep the grid a grid.
 *
 * ONE PAGE, NO CARD PAGES. A spoiled card has no `/card/…` URL of its own.
 * Every card URL is meant to be a permanent, citable address, and a card whose
 * text can still change before release is not one yet. When the set releases
 * and the corpus syncs, the card gets its page and leaves this one — so no
 * cell is a link.
 *
 * FACES COME FROM OUR HOST, NEVER LSS'S BUCKET. The daily job that rebuilds the
 * data merges into `main`, and that push runs the face ingest
 * (`scripts/ingest-card-images.ts`), which copies each spoiled face under a key
 * of its own — `spoilerFaceKeyFor` in `faces.ts` says why it is not the
 * released card's key. Until the ingest has run, the host answers with its NO
 * IMAGE placeholder, which is the right shape and says what is true. Every
 * spoiled face is drawn portrait: none is in `LANDSCAPE_FACE_KEYS`, because
 * that list is measured from the store and these keys were never in it.
 *
 * GROUPED BY SET, soonest release first and undated sets after, which is the
 * file's own set order. A card reprinted across two upcoming products — an
 * Armory Deck hero that is also a Marvel in the booster — is listed under both.
 */

import { CardFace, FactChip, PitchBox } from "optfall-components/react";

import { pitchValueOf } from "../../src/lib/cards";
import { FACE_TIERS, faceUrl, placeholderUrl } from "../../src/lib/faces";
import {
  printingLabel,
  spoilerFaceKey,
  SPOILER_GROUPS,
  SPOILERS,
  SPOILERS_AS_OF,
  type SpoilerCard,
  type SpoilerPrinting,
} from "../../src/lib/spoilers";
import { PrintedText } from "../components/PrintedText";
import type { PageModule, PageResult } from "../types";
import "./spoilers.css";

/**
 * The stats a card may print, labelled and ordered as `STAT_ORDER` in
 * `cards.ts`. Arcane is not among them for the reason given there: it is
 * written in the rules text, not struck into the frame.
 */
const STATS: readonly (readonly [keyof SpoilerCard, string])[] = [
  ["cost", "Cost"],
  ["power", "Power"],
  ["defense", "Defence"],
  ["health", "Life"],
  ["intelligence", "Intellect"],
];

/** `2026-11-14` → `14 November 2026`, in UTC so no build machine shifts it. */
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Stats({ card }: { readonly card: SpoilerCard }) {
  const present = STATS.filter(([key]) => card[key] !== "");
  if (present.length === 0) return null;
  return (
    <dl className="of-spoilers__stats">
      {present.map(([key, label]) => (
        <FactChip
          key={key}
          label={label}
          value={card[key] as string}
          semantics="description"
        />
      ))}
    </dl>
  );
}

/**
 * The box every face declares — the `normal` tier, as `CardIndex`'s grid asks
 * for, because a cell is drawn wider than `thumb` and a third of an upscale is
 * a blurred card.
 */
const FACE_BOX = FACE_TIERS.normal;

/** The name, with ` (pitch 1)` after it where the card has a pitch. */
function altFor(card: SpoilerCard): string {
  return card.pitch === "" ? card.name : `${card.name} (pitch ${card.pitch})`;
}

function Cell({
  card,
  printings,
}: {
  readonly card: SpoilerCard;
  readonly printings: readonly SpoilerPrinting[];
}) {
  const key = spoilerFaceKey(printings);
  return (
    <li className="of-spoilers__cell">
      <CardFace
        src={key === null ? placeholderUrl("portrait") : faceUrl(key, "normal")}
        alt={altFor(card)}
        width={FACE_BOX.width}
        height={FACE_BOX.height}
        loading="lazy"
      />
      <p className="of-spoilers__meta">
        {printings.map(printingLabel).join(", ")}
      </p>
      <details className="of-spoilers__text">
        <summary>
          {card.name}
          {card.pitch === "" ? null : (
            <>
              {" "}
              <PitchBox value={pitchValueOf(card)} size="sm" />
            </>
          )}
        </summary>
        <p className="of-spoilers__meta">{card.type_text}</p>
        <Stats card={card} />
        {card.functional_text === "" ? null : (
          <PrintedText text={card.functional_text} />
        )}
      </details>
    </li>
  );
}

function page(): PageResult {
  return {
    title: "Spoilers — Optfall",
    description:
      "Flesh and Blood cards revealed for sets that have not been released yet, updated daily.",
    section: "spoilers",
    children: (
      <>
        <h1 className="of-spoilers__heading">Spoilers</h1>

        <p className="of-spoilers__lede">
          Cards Legend Story Studios has revealed for products that are not out
          yet. Text can change before release; once a set is out, its cards move
          to their own pages.{" "}
          {SPOILERS_AS_OF === null ? null : (
            <>
              Checked against{" "}
              <a href={`https://github.com/${SPOILERS.repository}`}>
                the community card compilation
              </a>{" "}
              daily; last change upstream{" "}
              <time dateTime={SPOILERS_AS_OF}>{longDate(SPOILERS_AS_OF)}</time>.
            </>
          )}
        </p>

        {SPOILER_GROUPS.length === 0 ? (
          <p>Nothing has been revealed for an unreleased set right now.</p>
        ) : (
          SPOILER_GROUPS.map(({ set, cards }) => (
            <section
              className="of-spoilers__set"
              key={set.id}
              aria-labelledby={`spoilers-${set.id}`}
            >
              <h2 id={`spoilers-${set.id}`}>{set.name}</h2>
              <p className="of-spoilers__set-meta">
                {set.id} ·{" "}
                {set.released === null ? (
                  "release date not announced"
                ) : (
                  <>
                    releases{" "}
                    <time dateTime={set.released}>
                      {longDate(set.released)}
                    </time>
                  </>
                )}{" "}
                · {cards.length} {cards.length === 1 ? "card" : "cards"}
              </p>

              <ul className="of-spoilers__grid">
                {cards.map(({ card, printings }) => (
                  <Cell
                    key={card.unique_id}
                    card={card}
                    printings={printings}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </>
    ),
  };
}

export const spoilersPage: PageModule = {
  pattern: "/spoilers",
  page,
};
