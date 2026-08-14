/**
 * The `<html>` shell every page is wrapped in — the generator's `BaseLayout`.
 *
 * ONE PLACE WRITES THE HEAD, and that is the point of `PageResult` carrying
 * fields rather than markup. The canonical rule alone is a page of reasoning
 * spread across `card/[...slug].astro` and `cards.ts`; the disclaimer is
 * asserted against built HTML by `check-disclaimer.ts`. Both are guarantees,
 * and a guarantee that each page re-implements is a guarantee that holds until
 * somebody writes a new page.
 *
 * THE CANONICAL IS ABSOLUTE AND ALWAYS TRAILING-SLASHED, mirroring the Astro
 * layout exactly. A relative canonical is ignored by some crawlers, and the
 * site serves every URL as a directory (`/syntax/`), so a canonical without the
 * slash points at a URL that redirects — a canonical whose whole job is to be
 * the final address should not be a hop.
 */

import type { ReactElement } from "react";

import { LSS_DISCLAIMER } from "../src/lib/compliance";
import type { PageResult } from "./types";

export const SITE_ORIGIN = "https://optfall.com";

/** The absolute, trailing-slashed canonical for a route. */
export function canonicalFor(route: string, override?: string): string {
  const path = override ?? route;
  const withSlash = path.endsWith("/") ? path : `${path}/`;
  return new URL(withSlash, SITE_ORIGIN).href;
}

interface DocumentProps {
  readonly result: PageResult;
  readonly route: string;
  /** Emitted stylesheet URLs, from the Vite manifest. */
  readonly styles: readonly string[];
}

export function Document({
  result,
  route,
  styles,
}: DocumentProps): ReactElement {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{result.title}</title>
        <meta name="description" content={result.description} />
        <link rel="canonical" href={canonicalFor(route, result.canonical)} />
        {/*
          The mark, in the tab. One declaration rather than the usual pile of
          six: an SVG icon is served to every engine that supports one, and the
          PNG variants an `apple-touch-icon` needs cannot be produced without a
          rasteriser in the build — so they are absent rather than hand-drawn,
          a hand-drawn one being the second copy of the mark this arrangement
          exists to avoid.
        */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {styles.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <div className="shell">
          <main data-width={result.width ?? "measure"}>{result.children}</main>
        </div>
        {/*
          THE DISCLAIMER IS EMITTED BY THE SHELL, NOT BY A PAGE, and it is not
          a component a page opts into. `docs/COMPLIANCE.md` requires it in the
          footer of every page and `scripts/check-disclaimer.ts` reads the built
          HTML to prove it is there — so the only design that cannot fail is one
          where a page has no way to omit it.
        */}
        <footer className="site-footer">
          <p className="legal">{LSS_DISCLAIMER}</p>
        </footer>
      </body>
    </html>
  );
}
