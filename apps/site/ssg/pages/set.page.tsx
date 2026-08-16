/**
 * `/sets/<code>` — one set, and the cards Optfall carries from it. Ported.
 *
 * A SET PAGE IS A LIST, NOT A SEARCH RESULT, and the distinction is why this
 * exists rather than redirecting to `/search?q=set:MST`. The query answers "what
 * matches"; this answers "what is in this set", which is a fact about the set
 * rather than about a question somebody asked. It also gives the set a permanent
 * URL, which a query string is not — `docs/DESIGN.md`: "Every view is a URL …
 * the link you paste into a conversation to settle it."
 *
 * Emitted only for sets that carry a card. A page listing nothing is a 404 that
 * renders, and upstream publishes several sets with no cards in this corpus.
 *
 * THE FIRST PORTED PAGE WITH `getStaticPaths`, WHICH IS THE CONTRACT'S WHOLE
 * CLAIM. Phase 6's premise is that keeping Astro's page shape makes this a port
 * rather than a rewrite; this function is copied across with its body unchanged
 * and its type annotations simplified, and the generator fans it out exactly as
 * Astro did. 112 pages, from one pass over the corpus.
 */

import {
  CARD_PAGES,
  type CardPage,
  facesOf,
  variantSuffix,
} from "../../src/lib/cards";
import { orientationOf } from "../../src/lib/faces";
import { editionName, setFor } from "../../src/lib/sets";
import type { CardIndexEntry } from "../components/CardIndex";
import { Island } from "../Island";
import { CardList } from "../islands/CardList";
import type { PageModule, PageResult, RouteContext } from "../types";
import "./set.css";

type Params = { readonly code: string };
type Props = { readonly id: string; readonly cards: readonly CardPage[] };

/**
 * The face this card wears ON THIS SET'S PAGE, which is not always its own.
 *
 * A CARD IS LISTED UNDER EVERY SET IT WAS PRINTED IN — the line at the foot of
 * this page has always said so — and `page.face` is the card's FIRST printing
 * that publishes art, in corpus order. So a card first printed in Welcome to
 * Rathe and reprinted in Mistveil carried the Rathe art on Mistveil's page:
 * the right card, the wrong picture, on the one surface whose entire subject is
 * a print run. Measured on this corpus: 2,239 of the 4,941 cards are printed in
 * more than one set, and every one of those 2,239 has at least one set whose art
 * differs from the default — so this is not a long-tail correction, it is most
 * of the reprints in the game. Monarch's page went from 307 rows carrying a mix
 * of other sets' art to 307 carrying Monarch's.
 *
 * `facesOf` IS THE ROUTER'S LIST, so every key this can return is one the face
 * host has been asked to store and one `/card/<slug>/<set>/<number>` addresses.
 * Deriving the set's art any other way would be a second evaluation of a rule
 * that already has one home — the failure `cards.ts` and `printings.ts` both
 * spend paragraphs on.
 *
 * FALLING BACK TO THE CARD'S OWN FACE IS CORRECT, NOT A MISS. A straight reprint
 * carries no new art, and Regular / Rainbow Foil / Cold Foil in one set are
 * three printing rows sharing one image. "This set published no distinct art for
 * this card" is a real answer, and the honest rendering of it is the card's
 * face rather than a placeholder.
 */
function faceForSet(page: CardPage, setId: string) {
  const faces = facesOf(page.card);
  const own =
    faces.find((ref) => ref.printing.set_id === setId) ?? faces[0] ?? null;

  if (own === null) {
    return { key: null, landscape: page.face.orientation === "landscape" };
  }

  return {
    key: own.key,
    landscape:
      orientationOf({
        playedHorizontally: page.card.played_horizontally,
        rotationDegrees: own.printing.image_rotation_degrees,
      }) === "landscape",
  };
}

/**
 * One row of the set's index.
 *
 * THE PITCHES ARE THIS CARD'S, SINGULAR, WHICH LOOKS WRONG NEXT TO SEARCH AND IS
 * NOT. A search result collapses the pitch versions of a name into one row, so
 * its mark carries all the versions that matched. A set page lists CARDS: Head
 * Jab red, yellow and blue are three separate entries upstream, each with its
 * own collector number in the set, and collapsing them here would be inventing
 * a row the print run does not have.
 */
function entryFor(page: CardPage, setId: string): CardIndexEntry {
  const face = faceForSet(page, setId);
  return {
    href: page.href,
    label: page.label,
    /* The bare name; the pitch qualifier `label` carries is hidden in the
       markup and kept for the accessible name. See `CardIndexEntry`. */
    name: page.card.name,
    /* The pitch suffix `label` carries, taken from the function that composes
       it rather than sliced back off the label — one evaluation of the rule. */
    qualifier: variantSuffix(page.pitch, page.disambiguated),
    typeLine: page.card.type_text ?? "",
    faceKey: face.key,
    faceLandscape: face.landscape,
    pitches: [page.pitch],
    stats: page.stats.map(
      (stat) => [stat.label, stat.value] as readonly [string, string],
    ),
  };
}

function getStaticPaths() {
  /*
    Built once for the whole route rather than per page: 112 set pages each
    re-scanning 4,941 cards is that work 112 times for an answer that does not
    change. One pass, grouped.
  */
  const bySet = new Map<string, CardPage[]>();
  for (const page of CARD_PAGES) {
    for (const id of new Set(
      page.card.printings.map((printing) => printing.set_id),
    )) {
      const existing = bySet.get(id);
      if (existing) existing.push(page);
      else bySet.set(id, [page]);
    }
  }

  return [...bySet.entries()]
    .filter(([id]) => setFor(id) !== undefined)
    .map(([id, cards]) => ({
      params: { code: id.toLowerCase() },
      props: { id, cards },
    }));
}

function page({ props }: RouteContext<Params, Props>): PageResult {
  const set = setFor(props.id);
  /* Corpus order is upstream's name sort, which is the order a set list wants. */
  const listed = props.cards;

  if (set === undefined) {
    /*
     * UNREACHABLE, AND WRITTEN OUT RATHER THAN ASSERTED. `getStaticPaths`
     * filters on this exact condition, so a set with no entry never becomes a
     * route — but a `!` here would be a claim about that function holding
     * forever, and the same reasoning is already written into
     * `card/[...slug].astro`. The empty page is what a broken filter would
     * produce, which is visible.
     */
    return { title: "", description: "", children: null };
  }

  /*
    AFTER THE GUARD, NOT BEFORE IT. This sat above the early return, so the
    branch that exists to render nothing still walked `facesOf` and
    `orientationOf` once per card in the set first — inverting the ordering the
    guard is for. Unreachable today and free either way; the point is that a
    guard which does not actually guard the work below it is a guard that will
    stop reading as one.
  */
  const entries = listed.map((card) => entryFor(card, props.id));

  return {
    title: `${set.name} — Optfall`,
    description: `The ${listed.length} Flesh and Blood cards Optfall carries from ${set.name} (${set.id}), each with its printed text, its printings and its per-format legality.`,
    section: "sets",
    /*
      THE FIRST PAGE OF THIS SET IS STILL IN THE HTML, because `Island` renders
      its child on the server. What the script adds is the view switch and the
      pager; what it does not add is the cards.
    */
    islands: true,
    children: (
      <>
        <nav className="of-lineage" aria-label="Breadcrumb">
          <ol className="of-crumbs">
            <li>
              <a href="/">Optfall</a>
            </li>
            <li>
              <a href="/sets">Sets</a>
            </li>
            <li>
              <span aria-current="page">{set.name}</span>
            </li>
          </ol>
        </nav>

        <header className="of-masthead">
          <p className="of-masthead__eyebrow">Set {set.id}</p>
          <h1>{set.name}</h1>
          <p className="of-masthead__meta">
            {set.released === null ? (
              "No published release date."
            ) : (
              <>
                Released <time dateTime={set.released}>{set.released}</time>.
              </>
            )}{" "}
            {listed.length.toLocaleString("en-GB")} cards in this corpus.
            {set.outOfPrint ? " Out of print." : null}
            {set.editions.length > 0
              ? ` Editions: ${set.editions.map(editionName).join(", ")}.`
              : null}
          </p>
        </header>

        {/*
          THE SAME LIST OF CARDS THE SEARCH PAGE RENDERS, because it is the same
          thing. This page used to show a bare column of names — no art, no way
          to ask for any — which meant the one surface whose subject is a PRINT
          RUN was the one surface with no pictures on it. `CardIndex` is that
          rendering now, and the pictures are this set's own printings; see
          `faceForSet`.

          WHAT THE PROPS COST, STATED, because the whole set crosses here as
          JSON in an attribute and React escapes every quote in it. Measured:
          the largest set page in this corpus is 220 kB of HTML — props, the
          sixty server-rendered cells, and the noscript list together — against
          a 40 kB median, and about 20 kB over the wire, since a list of cards
          compresses extremely well.

          It is not left to a comment to stay true. `assertPageBudget` in
          `ssg/build.ts` fails the build over a per-page ceiling, for the reason
          the island budget beside it exists: a page nobody measures is a page
          that can be any size at all, and `assertIslandBudget` weighs only the
          JavaScript. Sending the whole set is deliberate — the pager is client
          side, so page 6 has to be reachable without a request — but "the whole
          set" must stay the set's ROWS and never grow a field per row that only
          one view reads.
        */}
        <Island name="CardList" props={{ entries, subject: set.name }}>
          <CardList entries={entries} subject={set.name} />
        </Island>

        {/*
          WHAT A READER WITH NO SCRIPTING GETS, WRITTEN OUT RATHER THAN LOST.
          The island's server-rendered markup is the first sixty cards; the
          pager that reaches the other 350 is a button, and a button does
          nothing here without JavaScript. So the complete list ships too, as
          the column of names this page was before — the whole set, addressable,
          in the markup.

          It is a `<noscript>` rather than a second visible list because with
          scripting on it would be four hundred duplicate anchors under the
          index, which is worse than useless to a screen reader. Costed on the
          largest set in this corpus: about 25 kB of markup, uncompressed, on a
          page that already carries the index above it.
        */}
        <noscript>
          <h2 className="of-set-noscript__heading">Every card in {set.name}</h2>
          <p className="of-set-noscript__note">
            The index above pages and switches views with JavaScript. This is
            the whole set, in one list.
          </p>
          <ul className="of-set-noscript__list">
            {listed.map((card) => (
              <li key={card.slug}>
                <a href={card.href}>{card.label}</a>
              </li>
            ))}
          </ul>
        </noscript>

        {/*
          THE PROVENANCE LINE IS GONE, and it is deleted rather than folded away.

          It repeated, on 112 pages, an envelope the site states elsewhere: the
          upstream repository and the pinned commit are the same two values on
          every set page, and every card page already carries them in its Source
          fold beside the file hash, the retrieval URL and the confirmation date
          — which is the version of the claim that can actually be checked. A
          repository name and a commit with none of that around them are a
          gesture at auditability rather than the thing itself.

          The second sentence went with it for a different reason: "a card is
          listed under every set it was printed in" describes the list directly
          above it, which the list already demonstrates.
        */}
      </>
    ),
  };
}

export const setPage: PageModule<Params, Props> = {
  pattern: "/sets/[code]",
  getStaticPaths,
  page,
};
