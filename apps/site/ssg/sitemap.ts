/**
 * `sitemap.xml` and `robots.txt` — the two files that tell a crawler what this
 * site is.
 *
 * WHY THEY WERE MISSING IS THE INTERESTING PART. `routes.ts` has given every
 * registration a `sitemap: boolean` since it was written, defaulted to true and
 * documented as "whether these URLs belong in the sitemap". Nothing ever read
 * it. There was no sitemap to belong to, and no `robots.txt` either, on a
 * reference site of 12,777 pages whose entire proposition is being findable.
 *
 * The intent was never in doubt: `apps/images/public/robots.txt` disallows the
 * image host and says why in a comment — "the pages that give those images
 * meaning … live on optfall.com, and that is the surface worth crawling". That
 * surface then offered a crawler neither file.
 *
 * ONE SITEMAP, NOT A SHARDED SET, and that is a measurement rather than an
 * oversight. The protocol caps a file at 50,000 URLs and 50 MB uncompressed.
 * This build emits about 12,777 URLs at roughly ninety bytes each: a quarter of
 * the URL limit and around two per cent of the size limit. A sitemap index
 * would add a second file format and a second thing to get wrong, to solve a
 * problem four times further away than it looks. {@link SITEMAP_URL_LIMIT}
 * exists so the build fails loudly if that ever stops being true, rather than
 * emitting a file crawlers silently truncate.
 *
 * THE URLS COME FROM THE BUILT HTML, NOT FROM A SECOND PASS OVER THE ROUTES.
 * `build.ts` already renders every page, and every page already emits its own
 * `<link rel="canonical">` — so the sitemap is assembled from what was actually
 * written, the same way `check-disclaimer.ts` reads output rather than trusting
 * a parallel code path. A page whose canonical points elsewhere is left out by
 * construction, which matters here more than usual: 6,437 of those pages are
 * alternate printings that canonical to their card's default. Listing them
 * would contradict the canonical in the same breath as publishing it.
 */

/**
 * The protocol's ceiling on one sitemap file.
 *
 * Crossing it is the moment to write a sitemap index, and the build says so
 * rather than shipping a file that gets read to line 50,000 and stopped.
 */
export const SITEMAP_URL_LIMIT = 50_000;

/** Where the two files land, relative to the output directory. */
export const SITEMAP_PATH = "sitemap.xml";
export const ROBOTS_PATH = "robots.txt";

/** The five characters XML will not take raw inside a text node. */
function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * The sitemap for a set of absolute, canonical URLs.
 *
 * NO `lastmod`, `changefreq` OR `priority`, and each omission is deliberate.
 * This is a static build with no per-page modification date that means
 * anything — every file is written at the same instant by the same run, so a
 * `lastmod` would say "the last deploy" 12,777 times, which is worse than
 * silence because it looks like information. Google has said publicly it
 * ignores `priority` and `changefreq`; emitting them is noise that also has to
 * be maintained.
 */
export function renderSitemap(urls: readonly string[]): string {
  if (urls.length > SITEMAP_URL_LIMIT) {
    throw new Error(
      `The sitemap has ${urls.length.toLocaleString("en-GB")} URLs and one ` +
        `file may carry ${SITEMAP_URL_LIMIT.toLocaleString("en-GB")}. ` +
        `This is the point at which it has to become a sitemap index — see ` +
        `the header of ssg/sitemap.ts, which argued for one file on the ` +
        `strength of that headroom.`,
    );
  }

  const entries = urls
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

/**
 * `robots.txt`, which exists mainly to name the sitemap.
 *
 * EVERYTHING IS ALLOWED, EXPLICITLY. A crawler finding no `robots.txt` at all
 * behaves the same way, so the file is not here to restrict anything — it is
 * here because `Sitemap:` is the one discovery mechanism that does not require
 * a search engine's dashboard, and a bare `User-agent: *` with nothing under it
 * reads as an oversight rather than a decision.
 */
export function renderRobots(sitemapUrl: string): string {
  return `# Everything here is meant to be found. See ${sitemapUrl}
#
# The card faces are served from images.optfall.com, which disallows crawling
# in its own robots.txt: the images are Legend Story Studios' property and the
# pages that give them meaning are here.

User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
}
