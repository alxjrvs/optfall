/**
 * `/404` — what a miss looks like.
 *
 * THE HOST HAS BEEN ASKING FOR THIS FILE FOR A WHILE. Three places already
 * assumed it existed: `wrangler.jsonc` sets `not_found_handling: "404-page"`
 * with a comment saying "on a reference tool, a miss is a page people READ,
 * since it is what a mistyped card name gets them"; `outputPath.ts` maps the
 * route `/404` to `404.html` because that is the filename Cloudflare looks
 * for; and `serve.ts` reads that file so the dev server misses the way
 * production does. None of them emits it. `build.ts` writes what `routes.ts`
 * resolves and nothing registered a 404, so the mapping in `outputPath.ts` was
 * dead code and a miss on the live site returned a zero-byte body — no markup,
 * no navigation, no disclaimer, just the browser's own error.
 *
 * WHY A BLANK PAGE IS WORSE HERE THAN ELSEWHERE. `hostConfig.ts` records that
 * the card URL scheme changed and 12,278 exact-path redirects were retired
 * rather than served, because Cloudflare caps `_redirects` at 2,000 static
 * rules and carrying the table would have meant a Worker — which is the thing
 * that would have cost this site its "no uptime story to fail". That was the
 * right call and it has a consequence: every one of those addresses is still
 * in a search index and in pasted links, and every one of them arrives here.
 *
 * SO THIS PAGE IS A ROUTE, NOT AN APOLOGY. What a reader needs at a dead
 * address is the shape of a live one, which is why the card scheme is spelled
 * out with a real link they can compare against what they typed. The header's
 * search field is on this page for the same reason it is on every other one.
 *
 * NOT IN THE SITEMAP. It is registered with `{ sitemap: false }` — it is a
 * response, not an address anybody should be sent to, and listing it would
 * invite a crawler to index a page whose whole content is "this is not a page".
 *
 * NO `section`, DELIBERATELY. Every value of `HeaderSection` is a claim that
 * some nav item is current, and none of them is: a miss belongs to no section.
 * Omitting it renders the full header — search field, every link — with nothing
 * marked, which is exactly the state this page is in.
 */

import type { PageModule, PageResult } from "../types";

/**
 * A real address, and the one link in the build that is spelled by hand.
 *
 * NOTHING GUARDS IT, WHICH IS WORTH KNOWING RATHER THAN ASSUMING. Every other
 * card link comes from `CARD_ROUTES` and cannot rot; this is a literal, on the
 * page that exists to explain dead links, so it is the one that could become
 * one. It resolves today — `/card/mst/131/10-000-year-reunion/` is in
 * `CARD_ROUTES` — and a re-sync that retired that printing would not fail any
 * check. A `--jsx`-less script cannot import this module to fetch it;
 * `ssg.test.ts` is where an assertion belongs if it ever earns one.
 */
const EXAMPLE_CARD = "/card/mst/131/10-000-year-reunion/";

function page(): PageResult {
  return {
    title: "Not found — Optfall",
    /* See `PageResult.noindex`: this page has no address of its own to claim,
       and `/404/` — what `canonicalFor` would build — is itself a miss. */
    noindex: true,
    description:
      "No page is published at this address. Card addresses are built from the set code and collector number printed on the card, then its name.",
    children: (
      <>
        <h1>Not found</h1>

        <p>
          Nothing is published at this address. If you typed it or followed an
          old link, the shape below is what a working one looks like.
        </p>

        <h2>Cards</h2>

        <p>
          A card's address is the set code and collector number printed on the
          card, then its name — all three, in that order:
        </p>

        <p>
          <a href={EXAMPLE_CARD}>
            <code>{EXAMPLE_CARD}</code>
          </a>
        </p>

        <p>
          The set code and number are on the card itself, at the bottom. A name
          on its own is not an address here, and neither is a number without its
          set. If you have the card in front of you, you can build the link from
          it; if you do not, <a href="/search/">search</a> for the name.
        </p>

        <h2>Rules</h2>

        <p>
          A Comprehensive Rules section is addressed by its own citation, so{" "}
          <code>cr:8.3.4b</code> is at{" "}
          <a href="/cr/8.3.4b/">
            <code>/cr/8.3.4b/</code>
          </a>
          . Every level resolves: a chapter, a section and a sub-rule are each a
          page.
        </p>

        <h2>Everything else</h2>

        <p>
          <a href="/search/">Cards</a> · <a href="/sets/">Sets</a> ·{" "}
          <a href="/cr/">Rules</a> · <a href="/syntax/">Syntax</a> ·{" "}
          <a href="/random/">Random card</a> · <a href="/about/">About</a>
        </p>
      </>
    ),
  };
}

export const notFoundPage: PageModule = {
  pattern: "/404",
  page,
};
