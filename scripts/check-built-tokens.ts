#!/usr/bin/env bun
/**
 * Asserts the theme actually reaches the built pages.
 *
 * This exists because the failure it catches is SILENT and total: if the token
 * layer does not arrive, every `var(--of-*)` on the site resolves to nothing and
 * the pages render with browser defaults — no ground, no ink, no focus ring —
 * while every other check stays green. `check-tokens.ts` only proves the
 * references are spelled correctly, and `check-disclaimer.ts` only greps for one
 * sentence. Neither would notice a site with no styling.
 *
 * WHAT PHASE 6 CHANGED, AND WHY THE CHECK GOT STRONGER RATHER THAN WEAKER.
 * Astro inlined the whole generated stylesheet into every page with
 * `<style is:global set:html={tokens}>`, so "the tokens are defined" and "the
 * tokens reached this page" were one string to grep for. The generator writes
 * `assets/tokens.css` once and links it — 18 kB against 12,776 pages was 220 MB
 * of one repeated stylesheet, and it could not be cached separately from the
 * document it lived in.
 *
 * That splits one fact into three, and all three are now checked, because each
 * fails on its own:
 *
 *   1. Every page LINKS a stylesheet.
 *   2. Every href a page links RESOLVES to a file that exists. This is the new
 *      one, and it is the failure mode the move introduced: the sheets are
 *      content-hashed, so a page can link `assets/tokens-a1b2c3.css` that no
 *      longer exists and look completely correct in the HTML.
 *   3. The linked sheets, taken together, DEFINE every token — a definition
 *      (`--of-color-ground: #0b0b0b`) rather than a reference
 *      (`var(--of-color-ground)`), because only the first proves the values
 *      arrived.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DARK_TOKENS } from "../packages/theme/src/index";
import { builtPages } from "./lib/built-pages";

const args = process.argv.slice(2);
const { directory: outputDirectory, pages, verbose } = builtPages(args);

const expected = Object.keys(DARK_TOKENS).map(
  (id) => `--of-${id.replaceAll(".", "-")}`,
);

/**
 * Every stylesheet a page links, in order.
 *
 * Matched on `rel="stylesheet"` rather than on any `<link>`, so the favicon and
 * any future preload do not read as a stylesheet that failed to resolve.
 */
function stylesheetHrefs(html: string): string[] {
  const found: string[] = [];
  for (const tag of html.match(/<link\b[^>]*>/g) ?? []) {
    if (!/rel="stylesheet"/.test(tag)) continue;
    const href = tag.match(/href="([^"]+)"/)?.[1];
    if (href !== undefined) found.push(href);
  }
  return found;
}

/** Read once per file rather than once per page — there are 12,776 pages. */
const sheetCache = new Map<string, string | undefined>();

function sheetContents(href: string): string | undefined {
  const cached = sheetCache.get(href);
  if (cached !== undefined || sheetCache.has(href)) return cached;

  /* Site-absolute hrefs only, which is all the generator emits. A relative one
     would be a bug worth failing on rather than resolving cleverly. */
  const path = href.startsWith("/")
    ? join(outputDirectory, href.slice(1))
    : undefined;
  const contents =
    path !== undefined && existsSync(path)
      ? readFileSync(path, "utf8")
      : undefined;

  sheetCache.set(href, contents);
  return contents;
}

/**
 * How many failing pages get their own `::error` line.
 *
 * The failures below are systemic by construction — "the generated theme
 * stylesheet did not reach this page" is not a property one page has and its
 * neighbour does not — so the realistic failure is all 12,776 at once, where
 * the first annotation already carries the whole diagnosis. Twelve thousand
 * copies of it bury the summary underneath rather than reinforcing it.
 *
 * `--verbose` annotates every one.
 */
const MAX_REPORTED = 10;

let failures = 0;
const report = (message: string): void => {
  if (verbose || failures < MAX_REPORTED) console.log(message);
};

for (const page of pages) {
  const html = readFileSync(`${outputDirectory}/${page}`, "utf8");
  const hrefs = stylesheetHrefs(html);

  if (hrefs.length === 0) {
    report(
      `::error file=${outputDirectory}/${page}::${page} links no stylesheet at all, so every var(--of-*) on it resolves to nothing.`,
    );
    failures += 1;
    continue;
  }

  const dangling = hrefs.filter((href) => sheetContents(href) === undefined);
  if (dangling.length > 0) {
    report(
      `::error file=${outputDirectory}/${page}::${page} links ${dangling.length} stylesheet(s) that do not exist in the build: ${dangling.join(", ")}. The hrefs are content-hashed, so this page looks correct and renders unstyled.`,
    );
    failures += 1;
    continue;
  }

  const css = hrefs.map((href) => sheetContents(href) ?? "").join("\n");
  // A DEFINITION, not a reference: the custom property followed by a colon.
  const missing = expected.filter((name) => !css.includes(`${name}:`));

  if (missing.length > 0) {
    report(
      `::error file=${outputDirectory}/${page}::${page} links stylesheets that define only ${expected.length - missing.length} of ${expected.length} tokens (missing e.g. ${missing.slice(0, 3).join(", ")}). The generated theme stylesheet did not reach this page.`,
    );
    failures += 1;
  }
}

if (!verbose && failures > MAX_REPORTED) {
  console.log(
    `::error::…and ${failures - MAX_REPORTED} more page(s) with the same failure. Re-run with --verbose to annotate every one.`,
  );
}

if (failures > 0) {
  console.log("");
  console.log(
    "The generator writes assets/tokens.css from themeStylesheet() and links it from",
  );
  console.log(
    "every page — see ssg/build.ts and ssg/document.tsx. Keep this check either way.",
  );
  process.exit(1);
}

console.log(
  `Every one of ${pages.length} built pages links stylesheets that resolve and define all ${expected.length} tokens. ✔`,
);
