/**
 * `/spoilers` — cards revealed for sets that are not out yet.
 *
 * THE DATA IS `data/spoilers/spoilers.json`, rebuilt daily by
 * `.github/workflows/spoilers.yml` from the card corpus's own upstream; see
 * `scripts/build-spoilers.ts` for where it comes from and what counts as a
 * spoiler. This page only lays it out.
 *
 * IT IS A SET PAGE, BECAUSE A SPOILER SEASON IS A PRINT RUN ARRIVING. The same
 * `CardList` island `/sets/<code>` uses, drawing the same `CardIndex`: the grid
 * and list views, pitch versions of one card collapsed into one row that fans
 * on hover, and a page of its own behind every face —
 * `spoiler-card.page.tsx`. What it adds is the one thing a set page has no
 * need for: more than one set. So the default order groups the rows under
 * each upcoming set, soonest release first, and "Most recent" lays them out
 * as one paged run, newest addition first.
 *
 * "MOST RECENT" MEANS ADDED TO THE COMPILATION, which is batched — see
 * `added` in `build-spoilers.ts`. Within a batch the rows keep set and
 * collector-number order.
 *
 * FACES COME FROM OUR HOST, NEVER LSS'S BUCKET. The daily job's merge runs the
 * face ingest, which stores each spoiled face under a key of its own —
 * `spoilerFaceKeyFor` in `faces.ts` says why. Until it has run, the host
 * answers with its NO IMAGE placeholder. Every spoiled face is drawn portrait:
 * none is in `LANDSCAPE_FACE_KEYS`, because that list is measured from the
 * store and these keys were never in it.
 *
 * A CARD REPRINTED ACROSS TWO UPCOMING PRODUCTS — an Armory Deck hero that is
 * also a Marvel in the booster — is a row under both sets, wearing each set's
 * face, and once in "Most recent".
 */

import {
  longDate,
  namesIn,
  SPOILER_GROUPS,
  SPOILER_PAGES,
  SPOILERS,
  SPOILERS_AS_OF,
  releaseLine,
  type SpoilerPage,
} from "../../src/lib/spoilers";
import type { CardIndexEntry, CardIndexGroup } from "../components/CardIndex";
import { Island } from "../Island";
import { CardList } from "../islands/CardList";
import type { PageModule, PageResult } from "../types";
import "./spoilers.css";

/**
 * One row: a name in one set, and its pitch versions there.
 *
 * `entryFor` in `set.page.tsx`, for a card with no `/card/` page: the row
 * opens the lowest pitch present and wears its face, and each version is a
 * door to its own page. A sole card is a row of one.
 */
function entryFor(group: readonly SpoilerPage[]): CardIndexEntry {
  const first = group[0];
  if (first === undefined) throw new Error("entryFor: an empty name group");
  const collapsed = group.length > 1;
  return {
    href: first.href,
    label: collapsed ? first.card.name : first.label,
    name: first.card.name,
    qualifier: collapsed ? "" : first.label.slice(first.card.name.length),
    typeLine: first.card.type_text,
    faceKey: first.faceKey,
    faceLandscape: false,
    versions: group.map((version) => ({
      pitch: version.pitch,
      href: version.href,
      label: version.label,
      faceKey: version.faceKey,
      faceLandscape: false,
    })),
  };
}

const ROWS = namesIn(SPOILER_PAGES);

/** The default order: one group per upcoming set, as `SPOILER_GROUPS` has them. */
const GROUPS: readonly CardIndexGroup[] = SPOILER_GROUPS.map(({ set }) => {
  const rows = ROWS.filter((group) => group[0]?.set.id === set.id);
  const cards = rows.reduce((sum, group) => sum + group.length, 0);
  return {
    id: set.id.toLowerCase(),
    heading: set.name,
    meta: `${set.id} · ${releaseLine(set)} · ${cards} ${cards === 1 ? "card" : "cards"}`,
    entries: rows.map(entryFor),
  };
});

/**
 * "Most recent": every row once, newest addition first.
 *
 * ONCE, where the grouped view may show a card twice: a reprint across two
 * upcoming sets keeps its first set's row, since one addition is one event.
 * The sort is stable, so a batch keeps set and collector-number order.
 */
const RECENT: readonly CardIndexEntry[] = (() => {
  const seen = new Set<string>();
  return ROWS.filter((group) => {
    const ids = group.map((page) => page.card.unique_id).join(" ");
    if (seen.has(ids)) return false;
    seen.add(ids);
    return true;
  })
    .toSorted((a, b) => newest(b).localeCompare(newest(a)))
    .map(entryFor);
})();

function newest(group: readonly SpoilerPage[]): string {
  return (
    group
      .map((page) => page.card.added)
      .toSorted()
      .at(-1) ?? ""
  );
}

function page(): PageResult {
  return {
    title: "Spoilers — Optfall",
    description:
      "Flesh and Blood cards revealed for sets that have not been released yet, updated daily.",
    section: "spoilers",
    width: "index",
    islands: true,
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
          <>
            <Island
              name="CardList"
              props={{
                entries: RECENT,
                subject: "upcoming sets",
                groups: GROUPS,
              }}
            >
              <CardList
                entries={RECENT}
                subject="upcoming sets"
                groups={GROUPS}
              />
            </Island>

            {/* THE WHOLE LIST FOR A READER WITH NO SCRIPTING, as the set page
                ships one. The grouped view is fully server-rendered, so this
                only adds what a collapsed row hides: each pitch version's own
                link. */}
            <noscript>
              <h2 className="of-spoilers__noscript-heading">
                Every spoiled card
              </h2>
              <ul className="of-spoilers__noscript-list">
                {SPOILER_PAGES.map((spoiler) => (
                  <li key={spoiler.href}>
                    <a href={spoiler.href}>{spoiler.label}</a> ·{" "}
                    {spoiler.set.name}
                  </li>
                ))}
              </ul>
            </noscript>
          </>
        )}
      </>
    ),
  };
}

export const spoilersPage: PageModule = {
  pattern: "/spoilers",
  page,
};
