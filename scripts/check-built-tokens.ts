#!/usr/bin/env bun
/**
 * Asserts the theme actually reaches the built pages.
 *
 * This exists because the failure it catches is SILENT and total. The layout
 * injects the generated stylesheet with `<style is:global set:html={tokens}>`;
 * if Astro ever extracts or drops that tag, every `var(--of-*)` on the site
 * resolves to nothing and the pages render with browser defaults — no ground,
 * no ink, no focus ring — while every other check stays green. `check-tokens.ts`
 * only proves the references are spelled correctly, and `check-disclaimer.ts`
 * only greps for one sentence. Neither would notice a site with no styling.
 *
 * So this checks the one thing that distinguishes a working page from a broken
 * one: that the token DEFINITIONS are present, not merely referenced. Those are
 * different strings — `--of-color-ground: #0b0b0b` versus
 * `var(--of-color-ground)` — and only the first proves the stylesheet arrived.
 */

import { readFileSync } from "node:fs";

import { DARK_TOKENS } from "../packages/theme/src/index";

const outputDirectory = process.argv[2] ?? "apps/site/dist";

const pages = [
  ...new Bun.Glob("**/*.html").scanSync({ cwd: outputDirectory, dot: false }),
].toSorted();

if (pages.length === 0) {
  console.log(
    `::error::No HTML found in ${outputDirectory}. Run \`bun run build\` first — an empty build is a failure here, not a pass.`,
  );
  process.exit(1);
}

const expected = Object.keys(DARK_TOKENS).map(
  (id) => `--of-${id.replaceAll(".", "-")}`,
);

let failures = 0;

for (const page of pages) {
  const html = readFileSync(`${outputDirectory}/${page}`, "utf8");

  // A DEFINITION, not a reference: the custom property followed by a colon.
  const missing = expected.filter((name) => !html.includes(`${name}:`));

  if (missing.length > 0) {
    console.log(
      `::error file=${outputDirectory}/${page}::${page} is missing ${missing.length} of ${expected.length} token definitions (e.g. ${missing.slice(0, 3).join(", ")}). The generated theme stylesheet did not reach this page, so every var(--of-*) on it resolves to nothing.`,
    );
    failures += 1;
    continue;
  }

  console.log(`  ${page} — all ${expected.length} tokens defined`);
}

if (failures > 0) {
  console.log("");
  console.log(
    "The layout injects the theme with <style is:global set:html={…}>. If Astro's",
  );
  console.log(
    "handling of that tag changed, use is:inline, and keep this check either way.",
  );
  process.exit(1);
}

console.log(`Every built page carries the full token layer. ✔`);
