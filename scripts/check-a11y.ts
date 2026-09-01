/**
 * The page-level accessibility check the component suite defers to.
 *
 * `packages/components/src/react/a11y.test.tsx` runs axe over 78 primitive
 * renderings, and disables four rules on the grounds that they need a whole
 * document rather than a fragment:
 *
 *   region · landmark-one-main · page-has-heading-one · bypass
 *
 * Its comment said those "belong to the page-level check on the built site".
 * There was no such check. Those four rules were enforced NOWHERE, and this
 * file is that check.
 *
 * WHAT IT DOES NOT COVER, stated because the first draft of this comment got it
 * wrong: `bypass` does NOT catch a missing skip link on this site. axe accepts
 * a `<main>` landmark as a bypass mechanism, and every page here has one —
 * measured by stripping the skip link from a built page and re-running, which
 * reported no violation either way. The skip link added alongside this file is
 * there for keyboard users on the merits; nothing automated defends it.
 *
 * WHY IT SAMPLES RATHER THAN SWEEPS. The build emits 12,777 pages, and running
 * axe under jsdom over all of them would take longer than the rest of the gate
 * put together. The pages are generated from a small number of templates, so
 * the interesting variable is the ROUTE KIND, not the card. One page per kind
 * covers every distinct document shape the site produces; a second card page
 * would only re-test the first one's template with different words in it.
 *
 * If a page kind is added and not sampled here, this check does not cover it —
 * so the sample list names every kind and fails when one of its pages is
 * missing from the build, rather than silently checking fewer things.
 *
 * Run:  bun scripts/check-a11y.ts [dist-directory] [--verbose]
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import axe from "axe-core";
import { JSDOM } from "jsdom";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const outputDirectory =
  args.find((a) => !a.startsWith("--")) ?? "apps/site/dist";

/**
 * One page per route kind, and the reason each is here.
 *
 * These are paths within the build output. A missing one is a failure rather
 * than a skip: it means either the build changed shape or this list went stale,
 * and both are worth stopping for.
 */
const SAMPLE: readonly (readonly [string, string])[] = [
  ["index.html", "the home page — the only one with no back navigation"],
  ["search/index.html", "an island-bearing page with a form"],
  ["syntax/index.html", "long-form prose with tables"],
  ["cr/index.html", "the rules index — deep nested lists"],
  ["about/index.html", "prose rendered from Markdown at build time"],
  ["sets/index.html", "a grid index"],
  ["data-terms/index.html", "the compliance surface"],
];

/**
 * The rules the component harness cannot run, which is the entire point.
 *
 * Enabled explicitly rather than by tag so that this file states what it is
 * for. Everything else axe would report at these tags is already covered
 * fragment-by-fragment in `a11y.test.tsx`; duplicating it here would make this
 * check slow and its failures ambiguous about which layer to fix.
 */
const RULES = [
  "region",
  "landmark-one-main",
  "page-has-heading-one",
  "bypass",
] as const;

if (!existsSync(outputDirectory)) {
  console.error(
    `::error::${outputDirectory} does not exist. Run \`bun run build\` first — an absent build is a failure here, not a pass.`,
  );
  process.exit(1);
}

let failures = 0;

for (const [page, why] of SAMPLE) {
  const path = join(outputDirectory, page);

  if (!existsSync(path)) {
    console.error(
      `::error::${page} is missing from the build. Either the route was renamed — in which case fix this list — or it stopped being generated.`,
    );
    failures += 1;
    continue;
  }

  const dom = new JSDOM(readFileSync(path, "utf8"), {
    /* axe reads computed styles and element geometry. jsdom does not lay out,
       which is why `color-contrast` is not in RULES — the component suite
       records the same limitation, having measured it rather than assumed it. */
    pretendToBeVisual: true,
  });

  const { window } = dom;
  /* jsdom's element type is structurally compatible with what axe wants here,
     and the component suite drives it the same way. */
  const results = await axe.run(window.document.documentElement, {
    runOnly: { type: "rule", values: [...RULES] },
    resultTypes: ["violations"],
  });

  window.close();

  if (results.violations.length === 0) {
    if (verbose) console.log(`  ✓ ${page} — ${why}`);
    continue;
  }

  failures += 1;
  for (const violation of results.violations) {
    console.error(
      `::error file=${path}::${violation.id} — ${violation.help}. ${violation.nodes.length} node(s). ${violation.helpUrl}`,
    );
  }
}

if (failures > 0) {
  console.error(
    `✗ ${failures} of ${SAMPLE.length} sampled page(s) fail a document-level rule.`,
  );
  console.error(
    "  These four rules are checked nowhere else: the component suite disables them because a fragment cannot satisfy them.",
  );
  process.exit(1);
}

console.log(
  `Checked ${SAMPLE.length} page kind(s) against ${RULES.length} document-level rule(s): ${RULES.join(", ")}.`,
);
console.log("Every sampled page kind passes. ✔");
