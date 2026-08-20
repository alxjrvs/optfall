/**
 * The sitemap, and the flag that had no reader.
 *
 * `routes.ts` declared `sitemap: boolean` on every registration from the day it
 * was written. It was set, defaulted and documented — and never read, so the
 * site shipped 12,776 pages with no sitemap and no `robots.txt` while carrying
 * a field that said which of them belonged in one.
 *
 * That is the failure this file exists to prevent a second time. The first test
 * below is the one that matters: it asserts the flag is CONSUMED, not merely
 * declared. Deleting the sitemap writer without deleting the flag puts the repo
 * back exactly where it was, and this is what notices.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  renderRobots,
  renderSitemap,
  ROBOTS_PATH,
  SITEMAP_PATH,
  SITEMAP_URL_LIMIT,
} from "./sitemap";

describe("the sitemap flag has a consumer", () => {
  test("build.ts reads registration.sitemap", () => {
    /*
     * A string match on the build rather than a behavioural assertion, because
     * the behaviour under test is "somebody looks at this field at all". A test
     * that rendered a page and checked the output would pass while the flag was
     * ignored, which is the state this is here to catch.
     */
    const build = readFileSync("apps/site/ssg/build.ts", "utf8");
    expect(build).toContain("registration.sitemap");
    expect(build).toContain("renderSitemap");
    expect(build).toContain("renderRobots");
  });

  test("routes.ts still declares it", () => {
    const source = readFileSync("apps/site/ssg/routes.ts", "utf8");
    expect(source).toContain("sitemap");
  });
});

describe("the sitemap document", () => {
  test("is valid XML with one loc per URL", () => {
    const xml = renderSitemap([
      "https://optfall.com/",
      "https://optfall.com/search/",
    ]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    );
    expect([...xml.matchAll(/<loc>/g)]).toHaveLength(2);
    expect(xml).toContain("<loc>https://optfall.com/search/</loc>");
  });

  test("escapes what XML will not take raw", () => {
    /* A card slug is unlikely to carry an ampersand and a URL is allowed one.
       An unescaped `&` is a parse error for the whole document, so the cost of
       being wrong here is the entire sitemap rather than one entry. */
    const xml = renderSitemap(["https://optfall.com/search/?q=a&b"]);
    expect(xml).toContain("?q=a&amp;b");
    expect(xml).not.toContain("?q=a&b");
  });

  test("refuses to emit more URLs than one file may carry", () => {
    /*
     * The header argues for a single file on the strength of headroom — a
     * quarter of the URL limit. This is what turns that argument into something
     * that fails loudly if the headroom is spent, rather than shipping a file
     * crawlers read to line 50,000 and stop.
     */
    const tooMany = Array.from(
      { length: SITEMAP_URL_LIMIT + 1 },
      (_, i) => `https://optfall.com/card/${i}/`,
    );
    expect(() => renderSitemap(tooMany)).toThrow(/sitemap index/);
  });

  test("an empty build is still a valid document", () => {
    // Not a real state, but a renderer that produces broken XML for the empty
    // case is one that produces broken XML the first time a filter is added.
    expect(renderSitemap([])).toContain("</urlset>");
  });
});

describe("robots.txt", () => {
  test("names the sitemap and allows everything", () => {
    const robots = renderRobots("https://optfall.com/sitemap.xml");
    expect(robots).toContain("Sitemap: https://optfall.com/sitemap.xml");
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    /* The image host disallows crawling; this one must not inherit that by
       somebody copying the file across. */
    expect(robots).not.toContain("Disallow: /\n");
  });

  test("the two paths are the ones a crawler looks for", () => {
    // Both are fixed by convention: a sitemap may live anywhere it is declared,
    // but `robots.txt` is only ever read from the root.
    expect(SITEMAP_PATH).toBe("sitemap.xml");
    expect(ROBOTS_PATH).toBe("robots.txt");
  });
});
