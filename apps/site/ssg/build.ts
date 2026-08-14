#!/usr/bin/env bun
/**
 * The static generator. `bun ssg/build.ts`.
 *
 * `docs/PLAN.md` Phase 6, layer 2. It renders alongside Astro rather than
 * replacing it — output goes to `dist-next/`, the shipped build still comes
 * from `astro build`, and the registry currently holds one page. That is the
 * point of this layer: a second renderer proven against the real compliance
 * checks before anything depends on it.
 *
 * THERE IS NO SSR BUNDLE STEP, and that is the largest structural difference
 * from Astro. Bun imports the page modules as TypeScript directly and calls
 * them; React renders to a string. So the "server build" that Astro spends most
 * of its time on does not exist, and the failure mode that produced
 * `check-dev-server.ts` — a Rollup resolver and a Node resolver disagreeing
 * about the same import — cannot occur, because there is only one resolver.
 *
 * THE DUPLICATE-OUTPUT GUARD IS NOT DEFENSIVE PROGRAMMING. Two routes resolving
 * to one file is silent by default: the second write wins and a page vanishes
 * from a site that reported success. This project has 13,675 URLs derived from
 * a corpus that resyncs on a schedule, and `cards.ts` already throws on exactly
 * this hazard at the route level. The generator asserts it again at the FILE
 * level, because that is where the collision actually lands and where a rule
 * about slugs cannot see it.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { outputPathFor } from "./outputPath";
import { routes } from "./routes";

const OUT_DIR = new URL("../dist-next/", import.meta.url).pathname;

/**
 * Stylesheets to link, read from Vite's manifest once that build exists.
 *
 * EMPTY TODAY, AND HONEST ABOUT IT. Layer 2 proves the render pipeline; the
 * client bundle arrives with the component port in layer 3, because there is
 * nothing yet to bundle. An empty list produces a page with no stylesheet
 * rather than a page with a broken link, which is the correct behaviour for a
 * harness whose output nobody serves.
 */
const styles: readonly string[] = [];

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });

  let count = 0;
  const written = new Map<string, string>();

  for (const registration of routes) {
    for (const resolved of registration.resolve()) {
      const outputPath = outputPathFor(resolved.route);

      const previous = written.get(outputPath);
      if (previous !== undefined) {
        throw new Error(
          `Two routes resolve to the same file: ${outputPath}\n` +
            `  ${previous}\n  ${resolved.route}\n` +
            `One of them would have overwritten the other and the build would have reported success.`,
        );
      }
      written.set(outputPath, resolved.route);

      const html = resolved.render(styles);

      const target = join(OUT_DIR, outputPath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, html, "utf-8");
      count += 1;
    }
  }

  console.log(`[ssg] ${count} page(s) → dist-next/`);
}

await main();
