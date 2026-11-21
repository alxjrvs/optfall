/**
 * A page's breadcrumb trail, restated for search engines as schema.org
 * `BreadcrumbList` JSON-LD.
 *
 * WHAT IT IS FOR. A result that carries a `BreadcrumbList` can be shown with
 * its trail — `optfall.com › Welcome to Rathe › Head Jab` — in place of the
 * bare URL, which on this site is `/card/wtr/098/head-jab-1` and tells a
 * searcher nothing. The trail is already on the page for readers; this says the
 * same thing in the form a crawler is documented to read:
 * https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
 *
 * IT SITS BESIDE THE VISIBLE `<nav>`, FED FROM THE SAME VALUES, AND THAT IS THE
 * WHOLE OF ITS DRIFT DEFENCE. Structured data that disagrees with the page is a
 * documented reason for a search engine to ignore it, so every caller builds
 * `trail` from the variables its own crumbs print, in the same JSX block.
 * `ssg.test.ts` asserts the two agree for one page of each kind.
 *
 * NOT A DESIGN-SYSTEM PRIMITIVE. It renders nothing a reader sees, so it has
 * no CSS, no tokens and nothing for `a11y.test.tsx` to look at; it lives with
 * the site's other page components.
 *
 * A DATA BLOCK, NOT A SCRIPT, WHICH IS WHY THE CSP DOES NOT NAME IT. A
 * `<script>` whose type is not a JavaScript MIME type is never executed: the
 * HTML standard's "prepare the script element" steps stop at the type check,
 * before the inline-script CSP check is reached. So this needs no hash in
 * `INLINE_SCRIPT_HASHES`, and the CSP test skips it on that basis.
 */

import type { ReactElement } from "react";

import { canonicalFor } from "../document";

/** One crumb: what it says, and where it goes — or nothing, for this page. */
export interface Crumb {
  readonly name: string;
  /** Site path. Omitted for the last crumb, which is the page itself. */
  readonly path?: string | undefined;
}

/**
 * The JSON-LD itself, separated from the element so a test can read it
 * without parsing HTML.
 *
 * THE LAST CRUMB CARRIES NO `item`, as Google's documentation permits for the
 * final element: it is the page the result already links, and repeating its
 * URL would be one more place for the canonical to disagree with itself on a
 * printing page that canonicals elsewhere.
 */
export function breadcrumbList(trail: readonly Crumb[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.path === undefined ? {} : { item: canonicalFor(crumb.path) }),
    })),
  };
}

export function BreadcrumbData({
  trail,
}: {
  readonly trail: readonly Crumb[];
}): ReactElement {
  /* `<` ESCAPED, BECAUSE A CARD NAME IS UPSTREAM'S TEXT. `JSON.stringify`
     leaves `</script>` intact, and inside a raw-text element that sequence ends
     the element wherever it appears. `<` is the same character to a JSON
     parser and nothing at all to the HTML tokenizer. */
  const json = JSON.stringify(breadcrumbList(trail)).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      // Safe for the reason above: the only input is escaped.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
