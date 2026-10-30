/**
 * `/spoilers` — cards revealed for sets that are not out yet.
 *
 * THE DATA IS `data/spoilers/spoilers.json`, rebuilt daily by
 * `.github/workflows/spoilers.yml` from the card corpus's own upstream; see
 * `scripts/build-spoilers.ts` for where it comes from and what counts as a
 * spoiler. This page only lays it out.
 *
 * ONE PAGE, NO CARD PAGES. A spoiled card is listed here in full — name,
 * pitch, stats, type line and printed text — and has no `/card/…` URL of its
 * own. Every card URL is meant to be a permanent, citable address, and a card
 * whose text can still change before release is not one yet. When the set
 * releases and the corpus syncs, the card gets its page and leaves this one.
 *
 * NO FACES. Card images are served from our own host after an ingest that
 * applies the copyright line at the serving boundary (`docs/COMPLIANCE.md` §5),
 * and that ingest runs on the released corpus. Hotlinking LSS's bucket from here
 * would be the one image on the site outside that arrangement.
 *
 * GROUPED BY SET, soonest release first and undated sets after, which is the
 * file's own set order. A card reprinted across two upcoming products — an
 * Armory Deck hero that is also a Marvel in the booster — is listed under both.
 */

import { FactChip, PitchBox } from "optfall-components/react";

import { pitchValueOf } from "../../src/lib/cards";
import {
  printingLabel,
  SPOILER_GROUPS,
  SPOILERS,
  SPOILERS_AS_OF,
  type SpoilerCard,
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

              <ul className="of-spoilers__list">
                {cards.map(({ card, printings }) => (
                  <li className="of-spoilers__card" key={card.unique_id}>
                    <h3 className="of-spoilers__name">
                      {card.name}
                      {card.pitch === "" ? null : (
                        <>
                          {" "}
                          <PitchBox value={pitchValueOf(card)} size="sm" />
                        </>
                      )}
                    </h3>
                    <p className="of-spoilers__meta">
                      {card.type_text} ·{" "}
                      {printings.map(printingLabel).join(", ")}
                    </p>
                    <Stats card={card} />
                    {card.functional_text === "" ? null : (
                      <PrintedText text={card.functional_text} />
                    )}
                  </li>
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
