/**
 * Every page the generator builds. An explicit registry, not a directory scan.
 *
 * FILE DISCOVERY IS THE OBVIOUS DESIGN AND IT IS THE WRONG ONE HERE. Astro
 * builds whatever is in `src/pages/`, which means a half-finished page becomes
 * a live URL the moment its file is saved, and a page is deleted from the site
 * by a filename typo. On a reference work whose thesis is that every URL is a
 * permanent, citable address, "what exists" should be a decision somebody made
 * in a reviewable diff — not a consequence of the filesystem.
 *
 * It also makes the migration auditable. This list grows one line per ported
 * page, so the PR that ports `/syntax` is a page module plus one line here, and
 * the set of pages the new generator claims is readable at a glance against the
 * set Astro still owns.
 *
 * A REGISTRATION HANDS BACK CLOSURES, NOT MODULES, and that is what keeps this
 * file free of `any`. A registry is heterogeneous by definition — every module
 * has its own `Params` and `Props` — so a list of modules can only be typed by
 * erasing them, and erasing a `page(ctx)` function is exactly the unsound
 * direction. Resolving inside `register`, where the real types are still in
 * scope, means what escapes is `{ route, render }`: two things with no type
 * parameters at all, and no cast anywhere.
 */

import { Document } from "./document";
import { dataTermsPage } from "./pages/data-terms.page";
import { setPage } from "./pages/set.page";
import { setsPage } from "./pages/sets.page";
import { syntaxPage } from "./pages/syntax.page";
import { renderRoute, resolveRoutes } from "./render";
import type { PageModule } from "./types";

/** One URL, and the bytes to write at it. */
export interface ResolvedPage {
  readonly route: string;
  readonly render: (styles: readonly string[]) => string;
}

export interface RouteRegistration {
  readonly resolve: () => readonly ResolvedPage[];
  /** Whether these URLs belong in the sitemap. */
  readonly sitemap: boolean;
}

function register<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>,
  options: { sitemap?: boolean } = {},
): RouteRegistration {
  return {
    resolve: () =>
      resolveRoutes(module).map((resolved) => ({
        route: resolved.route,
        render: (styles: readonly string[]) =>
          renderRoute(resolved, (result) =>
            Document({ result, route: resolved.route, styles }),
          ),
      })),
    sitemap: options.sitemap ?? true,
  };
}

export const routes: readonly RouteRegistration[] = [
  register(dataTermsPage),
  register(syntaxPage),
  register(setsPage),
  register(setPage),
];
