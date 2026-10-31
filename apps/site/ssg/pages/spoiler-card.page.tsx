/**
 * `/spoilers/<set>/<number>/<slug>` — one spoiled card, standing on its own.
 *
 * THE SHAPE OF A CARD PAGE, AND DELIBERATELY NOT ONE. The address mirrors
 * `/card/<set>/<number>/<slug>` and the layout borrows the card page's two
 * columns — face beside facts — so a reader moving between a released card and
 * a revealed one finds things where they expect them. It is not `CardEntry`:
 * that component is built on `CardPage`, which carries legality, rulings,
 * artists and a printings table, and an unreleased card has none of them.
 * Faking empty ones would be a page asserting "legal nowhere" about a card
 * nobody can play yet.
 *
 * PROVISIONAL, AND IT SAYS SO. The text can change before release, and when the
 * set releases the card moves to its `/card/` page and this one stops being
 * built — so the notice at the top is the page's first sentence, not a footnote.
 * See `SpoilerPage` in `spoilers.ts` for why a card in two upcoming sets has a
 * page under each.
 */

import { CardFace, FactChip, PitchBox } from "optfall-components/react";

import { FACE_TIERS, faceUrl, placeholderUrl } from "../../src/lib/faces";
import { pitchColour } from "../../src/lib/pitchColour";
import {
  longDate,
  printingLabel,
  releaseLine,
  SPOILER_PAGES,
  type SpoilerCard,
  type SpoilerPage,
} from "../../src/lib/spoilers";
import { PrintedText } from "../components/PrintedText";
import type { PageModule, PageResult, RouteContext } from "../types";
import "../components/CardEntry.css";
import "./spoilers.css";

type Params = {
  readonly set: string;
  readonly number: string;
  readonly slug: string;
};
type Props = { readonly spoiler: SpoilerPage };

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

function getStaticPaths() {
  return SPOILER_PAGES.map((spoiler) => {
    const [, , set = "", number = "", slug = ""] = spoiler.href.split("/");
    return { params: { set, number, slug }, props: { spoiler } };
  });
}

function page({ props }: RouteContext<Params, Props>): PageResult {
  const { spoiler } = props;
  const { card, set } = spoiler;
  const stats = STATS.filter(([key]) => card[key] !== "");
  /* The other pitch versions of this name in this set — the doors a
     collapsed row on `/spoilers` fans out into. */
  const versions = SPOILER_PAGES.filter(
    (other) => other.set.id === set.id && other.card.name === card.name,
  ).toSorted((a, b) => a.pitch - b.pitch);
  const face =
    spoiler.faceKey === null
      ? placeholderUrl("portrait")
      : faceUrl(spoiler.faceKey, "normal");

  return {
    title: `${spoiler.label} (spoiler) — Optfall`,
    description: `${spoiler.label}, revealed for ${set.name} (${set.id}). ${card.type_text}. Text can change before release.`,
    image: face,
    themeColour: pitchColour(spoiler.pitch),
    section: "spoilers",
    width: "wide",
    children: (
      <>
        <nav className="of-lineage" aria-label="Breadcrumb">
          <ol className="of-card__crumbs">
            <li>
              <a href="/">Optfall</a>
            </li>
            <li>
              <a href="/spoilers">Spoilers</a>
            </li>
            <li>
              <span aria-current="page">{spoiler.label}</span>
            </li>
          </ol>
        </nav>

        <article className="of-card__page">
          <div className="of-card__face-column">
            <CardFace
              src={face}
              alt={spoiler.label}
              width={FACE_TIERS.normal.width}
              height={FACE_TIERS.normal.height}
              loading="eager"
            />
          </div>

          <div className="of-card__facts-column">
            <p className="of-spoiler__notice">
              Revealed for {set.name}, {releaseLine(set)}. Text can change
              before release; once the set is out, this card moves to its own
              page.
            </p>

            <h1 className="of-spoiler__name">
              {card.name}
              {card.pitch === "" ? null : (
                <>
                  {" "}
                  <PitchBox value={spoiler.pitch} />
                </>
              )}
            </h1>
            <p className="of-spoiler__type">{card.type_text}</p>

            {stats.length === 0 ? null : (
              <dl className="of-spoiler__stats">
                {stats.map(([key, label]) => (
                  <FactChip
                    key={key}
                    label={label}
                    value={card[key] as string}
                    semantics="description"
                  />
                ))}
              </dl>
            )}

            {card.functional_text === "" ? null : (
              <PrintedText text={card.functional_text} />
            )}

            {versions.length > 1 ? (
              <nav aria-label="Pitch versions">
                <ul className="of-spoiler__versions">
                  {versions.map((version) => (
                    <li key={version.href}>
                      {version.href === spoiler.href ? (
                        <span aria-current="page">
                          <PitchBox value={version.pitch} size="sm" />{" "}
                          {version.label}
                        </span>
                      ) : (
                        <a href={version.href}>
                          <PitchBox value={version.pitch} size="sm" />{" "}
                          {version.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <dl className="of-spoiler__stats">
              <FactChip
                label="Printings"
                semantics="description"
                value={spoiler.printings.map(printingLabel).join(", ")}
              />
              <FactChip label="Set" semantics="description" value={set.name} />
              <FactChip
                label="Added"
                semantics="description"
                value={
                  <time dateTime={card.added}>{longDate(card.added)}</time>
                }
              />
            </dl>
          </div>
        </article>
      </>
    ),
  };
}

export const spoilerCardPage: PageModule<Params, Props> = {
  pattern: "/spoilers/[set]/[number]/[slug]",
  getStaticPaths,
  page,
};
