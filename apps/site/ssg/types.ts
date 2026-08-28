/**
 * The page contract, and it is deliberately Astro's.
 *
 * `docs/PLAN.md` Phase 6 moves this site off Astro onto a static generator we
 * own. The single decision that makes that a port rather than a rewrite is
 * this file: **a page is `{ pattern, getStaticPaths, page }`**, which is
 * `getStaticPaths` with a different spelling.
 *
 * SU-SRD made the same move and kept the same contract, for the same reason.
 * It is not nostalgia for Astro's API — it is that `getStaticPaths` is the
 * right shape for a static site independent of who invented it. A page
 * declares the URLs it owns and how to render one; the generator does the
 * enumerating, the writing and the collision checking. Nothing about that
 * needs a framework.
 *
 * What it buys here specifically: `CARD_ROUTES` in `lib/cards.ts` already
 * returns `{ params, props }[]`, because that is what Astro wanted. It feeds
 * this generator with no adapter at all, which means the card route table — the
 * part of the build most expensive to get wrong, and by some distance the
 * largest — moves across untouched and provably identical.
 */

import type { ReactNode } from "react";

import type { HeaderSection } from "./SiteHeader";

/** One URL a page owns, with whatever the renderer needs to draw it. */
export interface StaticPath<Params, Props> {
  readonly params: Params;
  readonly props: Props;
}

/** What a page's render function is handed. */
export interface RouteContext<Params, Props> {
  readonly params: Params;
  readonly props: Props;
  /** The resolved URL, e.g. `/card/head-jab-1`. Pages need it for canonicals. */
  readonly route: string;
}

/**
 * What a page returns: the document's head fields, and its body.
 *
 * THE HEAD IS DATA, NOT MARKUP, and that is worth defending. Every one of
 * these fields is asserted somewhere — `check-disclaimer.ts` reads the built
 * HTML, `cards.ts` composes titles and descriptions beside the data so the two
 * cannot drift, and the canonical rules for 6,437 printing pages are a page of
 * reasoning in `pages/card.page.tsx`. A page that could emit arbitrary `<head>`
 * markup could emit two canonicals, or none, and nothing would say so.
 * Returning fields means the document shell is the only thing that writes them,
 * once, the same way every time.
 *
 * `?: T | undefined` RATHER THAN `?: T`, HERE AND THROUGHOUT, and the reason is
 * `exactOptionalPropertyTypes` — which this directory only started obeying when
 * layer 5 moved it off `astro/tsconfigs/strict` onto the repository's own base
 * config. Under that flag the two spellings mean genuinely different things:
 * `?: T` says the key may be ABSENT, and rejects passing it explicitly as
 * `undefined`. Every caller here computes these fields, so `canonical:
 * canonicalFor(route)` returning `string | undefined` is the normal shape and
 * the absent-key spelling would force a conditional spread at every call site
 * to express something no reader of this type cares about. Where absent and
 * `undefined` mean the same thing, say so.
 */
export interface PageResult {
  readonly title: string;
  readonly description: string;
  /** Absolute URL. Omitted where the page is its own canonical. */
  readonly canonical?: string | undefined;
  /**
   * An absolute image URL for the link preview, where the page has one.
   *
   * OPTIONAL, AND MOST PAGES CORRECTLY OMIT IT. A card page has an obvious
   * picture — the face itself, already served from R2 at a tier chosen for
   * exactly this size — and `/about` does not. A generic fallback image would
   * put the same mark on every card ever shared, which is worse than the plain
   * link this replaces: it looks like a preview and carries no information.
   *
   * The absence is what selects `summary` over `summary_large_image` in
   * `document.tsx`, so a page without a picture gets the card shape built for
   * not having one.
   */
  readonly image?: string | undefined;
  /**
   * Which nav item is current, or `"none"` for a page with no header at all.
   *
   * A UNION RATHER THAN A STRING, because a typo in a section name is silent:
   * the nav renders, nothing is marked current, and the page looks fine. The
   * five names are the whole site, so enumerating them costs nothing and turns
   * `section="card"` into a build failure instead of a missing underline.
   */
  readonly section?: HeaderSection | "none";
  /**
   * The header's search field, on by default, and nothing turns it off now.
   *
   * IT USED TO BE OFF ON `/search` AND `/cr`, on the rule that two fields is
   * two places to type and one of them wrong. `docs/SCRYFALL-GAP.md` §5.2 puts
   * the hero on the FRONT DOOR and the header's field on every other screen, so
   * `/search` adopts the header's field rather than rendering a second one, and
   * `/cr` keeps both — its hero searches the rules and the header searches
   * cards, which is two questions rather than two places to ask one.
   *
   * The flag stays because the door still needs it the moment it grows a
   * header: `section: "none"` currently removes the whole bar there, and a
   * page with a hero AND a header field is the case this exists to refuse.
   */
  readonly headerSearch?: boolean;
  /**
   * Whether the header's field is hydrated, so a submit is answered in place.
   *
   * ONE PAGE SETS IT, AND THE NARROWNESS IS THE POINT. `/search` is the only
   * surface that can answer a card query without navigating, so it is the only
   * one that should pay for the field to be React's. Every other page — `/cr`,
   * every set page, the 12,776 documents — keeps the static form it has always
   * had, which submits and navigates exactly as it does with scripting off.
   *
   * DECLARED RATHER THAN DERIVED FROM {@link PageResult.islands}, for the same
   * reason that flag is declared rather than detected: a page carrying an island
   * of its own is not thereby a page that can answer a card query, and deriving
   * one from the other would hydrate a field on every set page to write into a
   * store nothing there reads.
   */
  readonly headerSearchIsland?: boolean;
  /**
   * `measure` (prose), `wide` (a face beside a column), or `index` (a grid of
   * card faces and nothing else). See the tokens.
   */
  readonly width?: "measure" | "wide" | "index";
  /**
   * True when this page mounts an `Island`, so the shell emits the script.
   *
   * DECLARED RATHER THAN DETECTED, because detecting it means scanning the
   * rendered HTML for `data-island` — which works, and which would make every
   * page pay a string search to answer a question its author already knows. It
   * is also the wrong default in the safe direction: a page that forgets this
   * renders its island as static server markup, which is degraded but correct,
   * where a page that wrongly claimed one would ship a script for nothing.
   */
  readonly islands?: boolean;
  readonly children: ReactNode;
}

/**
 * A page module: the URLs it owns, and how to render one.
 *
 * `getStaticPaths` is omitted for a page with one fixed address, which is the
 * majority of them — `/syntax`, `/data-terms`. The pattern is then the route.
 */
export interface PageModule<
  Params extends Record<string, string> = Record<string, string>,
  Props = unknown,
> {
  /** Astro-style, e.g. `/card/[slug]` or `/data-terms`. */
  readonly pattern: string;
  readonly getStaticPaths?: () => readonly StaticPath<Params, Props>[];
  readonly page: (ctx: RouteContext<Params, Props>) => PageResult;
}

/** A page module resolved to one concrete URL. */
export interface ResolvedRoute<
  Params extends Record<string, string> = Record<string, string>,
  Props = unknown,
> {
  readonly module: PageModule<Params, Props>;
  readonly path: StaticPath<Params, Props>;
  readonly route: string;
}
