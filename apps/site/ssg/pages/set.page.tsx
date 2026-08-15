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

import { CARD_PAGES, type CardPage } from "../../src/lib/cards";
import { editionName, setFor } from "../../src/lib/sets";
import type { PageModule, PageResult, RouteContext } from "../types";
import "./set.css";

type Params = { readonly code: string };
type Props = { readonly id: string; readonly cards: readonly CardPage[] };

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

  return {
    title: `${set.name} — Optfall`,
    description: `The ${listed.length} Flesh and Blood cards Optfall carries from ${set.name} (${set.id}), each with its printed text, its printings and its per-format legality.`,
    section: "sets",
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

        <ul className="of-set-cards">
          {listed.map((card) => (
            <li key={card.slug}>
              <a href={card.href}>{card.label}</a>
            </li>
          ))}
        </ul>

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
