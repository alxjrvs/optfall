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
import { OrnamentalRule } from "optfall-components/react";

import { CORPUS } from "../src/lib/cards";
import { LSS_DISCLAIMER } from "../src/lib/compliance";
import { THEME_COLOUR } from "./assets";
import { SiteHeader } from "./SiteHeader";
import type { PageResult } from "./types";

const SITE_ORIGIN = "https://optfall.com";

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
        {result.noindex === true ? (
          /* NO CANONICAL AND NO `og:url` EITHER — see `PageResult.noindex`. A
             canonical is a claim about where this content really lives, and the
             404 has no such address: it is what the host returns instead of one. */
          <meta name="robots" content="noindex" />
        ) : (
          <link rel="canonical" href={canonicalFor(route, result.canonical)} />
        )}
        {/*
          THE LINK PREVIEW, AND IT IS NOT DECORATION ON THIS SITE. Flesh and
          Blood rules questions are settled in Discord and on Reddit, which is
          to say they are settled by somebody pasting a link. Until this block
          existed every one of those pastes rendered as a bare URL: no name, no
          text, no face — the reader had to open it to learn whether it was even
          the right card.

          IT REUSES THE FIELDS THE PAGE ALREADY DECLARES rather than adding a
          parallel set. `og:title` and `og:description` are the `<title>` and
          the meta description a few lines up, which is what keeps a page from
          being able to say one thing to a crawler and another to a person —
          the failure this project would notice least and like least.

          `og:url` IS THE CANONICAL, NOT THE REQUEST. A card reached by its
          printing URL canonicals to the default printing, and a preview that
          advertised the request instead would seed a second address for one
          answer — the duplication the canonical exists to prevent, propagated
          by every share.

          AND IT IS ABSENT WHERE THE CANONICAL IS. A `noindex` page has no
          address to advertise, so a share card claiming one would be the same
          defect arriving through the other channel.
        */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Optfall" />
        <meta property="og:title" content={result.title} />
        <meta property="og:description" content={result.description} />
        {result.noindex === true ? null : (
          <meta
            property="og:url"
            content={canonicalFor(route, result.canonical)}
          />
        )}
        {/*
          THE CARD SHAPE FOLLOWS THE PICTURE. `summary_large_image` on a page
          with no image is a card with a blank panel where the image should be,
          so the absence of `result.image` picks the small card built for that
          case rather than the big one degraded into it.
        */}
        <meta
          name="twitter:card"
          content={
            result.image === undefined ? "summary" : "summary_large_image"
          }
        />
        {result.image !== undefined && (
          <>
            <meta property="og:image" content={result.image} />
            {/*
              THE ALT TEXT IS THE CARD'S NAME, because that is what the picture
              is of and the title already says it. It is here rather than
              omitted for the reader whose client renders the preview without
              loading the image.
            */}
            <meta property="og:image:alt" content={result.title} />
          </>
        )}
        {/*
          The mark, in the tab. Still one declaration rather than the usual pile
          of six: an SVG icon is served to every engine that supports one, and
          nothing here enumerates raster favicon sizes.
        */}
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        {/*
          Installability, in the two channels that exist.

          THE `apple-touch-icon` IS NOT REDUNDANT WITH THE MANIFEST, which is
          what the absence of this line used to assume. iOS ignores the
          manifest's `icons` for the home-screen icon on older versions and lets
          this element override them on newer, and it has never accepted an SVG
          in either — so with only the manifest, an iOS install took its icon
          from a SCREENSHOT OF THE PAGE. It is one size, not the historical
          ladder: iOS downsamples a single 180 px icon perfectly well, and the
          ladder existed for devices this site does not need to court.

          It is derived from the same geometry as everything else — see
          `ssg/assets.ts` — so it is not the second copy of the mark that the
          old comment here was right to refuse.
        */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={THEME_COLOUR} />
        {/*
          PROOF OF OWNERSHIP, FOR IMPACT, AND IT SITS IN THE SHELL FOR THE SAME
          REASON THE DISCLAIMER SITS IN THE FOOTER. A verifier fetches whichever
          URL it was handed — the front door today, a card page when it
          re-checks — so a tag added to one page is a tag that holds until
          somebody points the crawler elsewhere. Here, no page can omit it.

          `value`, NOT `content`, WHICH IS NOT A TYPO AND MUST NOT BE
          "CORRECTED". The attribute HTML defines for `<meta>` is `content`, and
          every other tag in this head uses it — but Impact's verifier reads
          `value`, so tidying this one into line silently un-verifies the
          domain. React passes the unknown attribute through untouched, and
          `ssg.test.ts` asserts the rendered output rather than this source,
          because the pass-through is the part a React upgrade could take away.
        */}
        <meta
          name="impact-site-verification"
          value="1134ebd0-ee7d-4058-a57f-b6f3da79a0d9"
        />
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
          {/*
            THE FIRST THING IN THE TAB ORDER, ON EVERY PAGE, BECAUSE THE HEADER
            IS TOO. The bar carries a wordmark, a search field and a nav, so a
            keyboard reader who wants the page itself passes about ten stops to
            reach it — and on a reference work "the page itself" is the card
            they looked up, so that toll is paid on every lookup rather than
            once a session.

            IT IS EMITTED HERE RATHER THAN BY THE HEADER, and that is not a
            detail: `section: "none"` removes the whole bar on the front door,
            and a skip link that disappeared with it would be missing from the
            one page whose whole content is a form. The target below is
            unconditional for the same reason.

            VISIBLE ON FOCUS, NOT HIDDEN OUTRIGHT. `display: none` would take it
            out of the tab order and leave the affordance to nobody; it is
            clipped until focused, which is the one state a sighted keyboard
            user needs it in.
          */}
          <a className="skip-link" href="#main">
            Skip to content
          </a>
          {result.section === "none" ? null : (
            <SiteHeader
              section={result.section}
              route={route}
              field={result.headerSearch ?? true}
              fieldIsland={result.headerSearchIsland ?? false}
            />
          )}
          {/*
            `tabIndex={-1}` IS WHAT MAKES THE SKIP LINK ACTUALLY SKIP. Following
            `#main` sets the sequential-navigation START POINT, so the next Tab
            continues from here — but focus itself does not move to a target
            that cannot hold it, and a screen reader is never told it arrived.
            The link would look like it worked, silently, to the readers it
            exists for. `-1` makes `<main>` programmatically focusable without
            adding a tab stop of its own, which is the same trick
            `.of-index__count` uses as a post-pagination focus target.
          */}
          <main id="main" tabIndex={-1} data-width={result.width ?? "measure"}>
            {result.children}
          </main>
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
          {/*
            THE FOOTER'S OPENING LINE, AND IT IS AN ELEMENT RATHER THAN A
            BORDER. `border-block-start` on `.site-footer` drew the same
            hairline the section rule draws, in a second spelling, which left
            the divider at the bottom of every page as the one on the site with
            no centre mark. It is `decorative` because a border announces
            nothing and the `contentinfo` landmark below already says what this
            line separates, and `flush` because the space under it is still the
            footer's own padding.

            OUTSIDE `.site-footer__inner`, so it keeps the border's full-window
            width rather than being capped to the content column.
          */}
          <OrnamentalRule decorative flush />
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
            verbatim off all 12,776 built pages.
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
          hashed url — costs a round trip on every one of 12,776 pages to
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
          // Safe because the content is this file's own literal, not data —
          // there is no input to escape. A `<script>` child would be
          // JSX-escaped, which corrupts JavaScript.
          dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_REGISTRATION }}
        />
      </body>
    </html>
  );
}
