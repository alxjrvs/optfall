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
 * this generator with no adapter at all, which means the 13,675-page route
 * table — the part of the build most expensive to get wrong — moves across
 * untouched and provably identical.
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
 * reasoning in `card/[...slug].astro`. A page that could emit arbitrary
 * `<head>` markup could emit two canonicals, or none, and nothing would say
 * so. Returning fields means the document shell is the only thing that writes
 * them, once, the same way every time.
 */
export interface PageResult {
  readonly title: string;
  readonly description: string;
  /** Absolute URL. Omitted where the page is its own canonical. */
  readonly canonical?: string;
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
   * The header's search field. Off on the page whose hero IS a search field —
   * two fields on one screen is two places to type and one of them wrong.
   */
  readonly headerSearch?: boolean;
  /** `measure` (prose) or `wide` (a face beside a column). See the tokens. */
  readonly width?: "measure" | "wide";
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
