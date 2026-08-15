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

import { CARD_IMAGE_COPYRIGHT } from "optfall-components";

import { CORPUS } from "../src/lib/cards";
import { LSS_DISCLAIMER } from "../src/lib/compliance";
import { THEME_COLOUR } from "./assets";
import { SiteHeader } from "./SiteHeader";
import type { PageResult } from "./types";

export const SITE_ORIGIN = "https://optfall.com";

/**
 * Registers the worker `ssg/serviceWorker.ts` generates, or does nothing.
 *
 * Written as a string rather than as a source file because it is the one script
 * inlined into every page — see the comment at its use.
 */
const SERVICE_WORKER_REGISTRATION = `
if ("serviceWorker" in navigator) {
  addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
`.trim();

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
  /** The island bundle's URL, from the same manifest. */
  readonly islandScript?: string | undefined;
}

export function Document({
  result,
  route,
  styles,
  islandScript,
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
        {/*
          Installability. The manifest names its own icon, so there is no second
          `<link rel="apple-touch-icon">` here — it would have to be a PNG, and
          the reason there is no PNG is written down in `ssg/assets.ts`.
        */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={THEME_COLOUR} />
        {styles.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <div className="shell">
          {/*
            THE HEADER IS THE SHELL'S, NOT A PAGE'S, and `section: "none"` is
            how a page opts out. Every surface on this site carries the same
            nav; making each page mount it would mean each page could forget
            it, and the one that forgot would be the one nobody could navigate
            away from.
          */}
          {result.section === "none" ? null : (
            <SiteHeader
              section={result.section}
              field={result.headerSearch ?? true}
            />
          )}
          <main data-width={result.width ?? "measure"}>{result.children}</main>
        </div>
        {/*
          THE DISCLAIMER IS EMITTED BY THE SHELL, NOT BY A PAGE, and it is not
          a component a page opts into. `docs/COMPLIANCE.md` requires it in the
          footer of every page and `scripts/check-disclaimer.ts` reads the built
          HTML to prove it is there — so the only design that cannot fail is one
          where a page has no way to omit it.
        */}
        {/*
          THE FOOTER IS A COLUMN, LIKE EVERY OTHER SURFACE. Its text used to run
          the full width of the window — a 1,400px measure on a desktop, three
          times what the rest of the site sets, and the legal text was the one
          thing on the page hardest to read as a result. `.site-footer__inner`
          gives it the same `layout.page.wide` cap and the same gutters `main`
          uses, so the footer aligns with the content above it instead of
          starting where the browser happens to end.
        */}
        <footer className="site-footer">
          <div className="site-footer__inner">
            {/*
              SITE LINKS, because a footer that is only a legal notice makes the
              legal notice the only thing a reader ever looks at down here.
              Repeating the nav costs nothing and gives the bottom of a long card
              page a way out that is not the back button.
            */}
            <nav className="site-footer__links" aria-label="Optfall">
              <a href="/search">Cards</a>
              <a href="/sets">Sets</a>
              <a href="/cr">Rules</a>
              <a href="/syntax">Syntax</a>
              <a href="/random">Random</a>
              <a href="/about">About</a>
              <a href="/data-terms">Data terms</a>
              <a href="https://github.com/alxjrvs/optfall">Source</a>
            </nav>

            {/*
            THE CORPUS'S OWN RIGHTS NOTICE, REPRODUCED RATHER THAN REWORDED.
            It names card names, card text and card images as LSS's property and
            states the policy under which they are displayed, so it is the
            sentence that does the most work of the three.
          */}
            <p className="legal">{CORPUS.rights}</p>
            {/*
            THE CARD-IMAGE LINE, WHICH USED TO BE RENDERED BY EVERY `CardFace`.
            `docs/COMPLIANCE.md` §5 requires the literal `© Legend Story
            Studios` wherever card images are used; carrying it here gives every
            page that literal, including the pages that show sixty faces and the
            pages that show none. It is deliberately NOT folded into the
            sentence above — that text is the corpus's, reproduced verbatim, and
            editing it to absorb this line would be rewording a notice we do not
            own.
          */}
            <p className="legal">{CARD_IMAGE_COPYRIGHT}</p>
            {/*
            Unchanged, and still last: `check-disclaimer.ts` reads this string
            verbatim off all 13,675 built pages.
          */}
            <p className="legal">{LSS_DISCLAIMER}</p>
          </div>
        </footer>
        {/*
          THE SCRIPT IS EMITTED ONLY FOR PAGES THAT DECLARE AN ISLAND, which is
          the whole economy of the architecture: 115 pages ported so far declare
          none and load no JavaScript at all.

          `type="module"` and `defer` — a module script defers by default, and
          saying so is documentation rather than belt-and-braces. It sits after
          the content so the parser reaches the markup first; the island
          hydrates what is already painted rather than racing it.
        */}
        {result.islands && islandScript !== undefined ? (
          <script type="module" src={islandScript} defer />
        ) : null}
        {/*
          THE SERVICE WORKER, REGISTERED INLINE AND ON EVERY PAGE.

          Inline because the alternative — a one-line module fetched from a
          hashed url — costs a round trip on every one of 13,675 pages to
          deliver about two hundred bytes, and this is the one script that has
          to run everywhere rather than only where an island lives.

          AFTER `load`, NOT DURING IT. Registration competes for bandwidth with
          the page it is on, and the worker is of no use to THIS navigation —
          it exists for the next one. Deferring it to `load` is the difference
          between a first visit that is slower for installing an offline cache
          and one that is not.

          The failure is swallowed on purpose. A service worker is a progressive
          enhancement here: registration is refused in private windows on some
          browsers and wherever the origin is not secure, and a console error on
          a reference site the reader is using perfectly well would be noise
          about a feature they did not ask for.
        */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the content is this file's own literal, not data — there is no input to escape. A `<script>` child would be JSX-escaped, which corrupts JavaScript.
          dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_REGISTRATION }}
        />
      </body>
    </html>
  );
}
