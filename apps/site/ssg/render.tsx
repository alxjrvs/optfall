/**
 * A page module, resolved to concrete URLs and rendered to HTML strings.
 *
 * TWO FUNCTIONS AND NO FRAMEWORK. `fillPattern` turns `/card/[slug]` plus
 * `{ slug: "head-jab" }` into `/card/head-jab`; `resolveRoutes` asks a module
 * for its paths and fills the pattern for each. That is the whole routing
 * layer, and it is small because the pages already know their own URLs — the
 * generator's job is enumeration, not discovery.
 *
 * `renderToStaticMarkup` RATHER THAN `renderToString`, and the difference
 * matters here more than on most sites. `renderToString` emits hydration
 * markers — comment nodes and `data-reactroot` attributes — for a client that
 * is going to take over the tree. Nothing takes over these trees: the pages are
 * documents, and the interactive parts are islands mounted into their own
 * containers. Emitting hydration scaffolding for a root that never hydrates
 * would put bytes on 13,675 pages to describe a handover that does not happen.
 */

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  PageModule,
  PageResult,
  ResolvedRoute,
  StaticPath,
} from "./types";

/**
 * `/card/[slug]` + `{ slug: "head-jab" }` → `/card/head-jab`.
 *
 * A MISSING PARAMETER THROWS rather than rendering `/card/undefined`. This is
 * the failure that is invisible in a build log and obvious in production: 4,941
 * pages emitted, one of them at a URL nobody meant, linked from nothing and
 * found by a crawler.
 */
export function fillPattern(
  pattern: string,
  params: Record<string, string>,
): string {
  return pattern.replace(/\[([^\]]+)\]/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(
        `Missing parameter "${key}" for pattern "${pattern}". ` +
          `getStaticPaths must supply every bracketed segment.`,
      );
    }
    return value;
  });
}

/**
 * Every URL one page module owns.
 *
 * A module with no `getStaticPaths` owns exactly its pattern — which is then
 * required to contain no brackets, because a pattern with a parameter and no
 * way to enumerate it is a page that can never render. Caught here rather than
 * by `fillPattern` throwing on `undefined`, so the error names the actual
 * mistake.
 */
export function resolveRoutes<Params extends Record<string, string>, Props>(
  module: PageModule<Params, Props>,
): ResolvedRoute<Params, Props>[] {
  if (module.getStaticPaths === undefined && module.pattern.includes("[")) {
    throw new Error(
      `"${module.pattern}" has a parameter but no getStaticPaths, so it owns no URLs.`,
    );
  }

  const paths: readonly StaticPath<Params, Props>[] = module.getStaticPaths
    ? module.getStaticPaths()
    : [{ params: {} as Params, props: undefined as Props }];

  return paths.map((path) => ({
    module,
    path,
    route: fillPattern(module.pattern, path.params),
  }));
}

/** One resolved route, as the bytes that get written. */
export function renderRoute<Params extends Record<string, string>, Props>(
  resolved: ResolvedRoute<Params, Props>,
  document: (result: PageResult) => ReactElement,
): string {
  const result = resolved.module.page({
    params: resolved.path.params,
    props: resolved.path.props,
    route: resolved.route,
  });

  // The doctype is prepended rather than rendered: it is not an element, and
  // React has no way to emit one.
  return `<!doctype html>\n${renderToStaticMarkup(document(result))}`;
}
