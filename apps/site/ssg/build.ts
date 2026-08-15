#!/usr/bin/env bun
/**
 * The static generator. `bun ssg/build.ts`.
 *
 * `docs/PLAN.md` Phase 6. **This is the build now.** It rendered alongside Astro
 * into `dist-next/` for four layers, matched it at 13,675 pages, and layer 5
 * deleted the other one — so the output is `dist/`, which is what Netlify
 * publishes and what every compliance check reads.
 *
 * THE PIPELINE, IN ORDER, AND THE ORDER MATTERS:
 *
 *   1. Clear `dist/`. The generator owns this directory's lifecycle, which is
 *      why the Vite config sets `emptyOutDir: false` — two things clearing one
 *      directory is one of them deleting the other's output.
 *   2. `vite build`: the client bundle, whose only real product is a
 *      content-hashed stylesheet collecting all fourteen component sheets.
 *   3. Write the token stylesheet, generated from `packages/theme`.
 *   4. Read `dist/.vite/manifest.json` for the emitted CSS urls.
 *   5. Render every route.
 *   6. Delete the manifest, which is a build artefact and not a page.
 *
 * THERE IS NO SSR BUNDLE STEP, and that is the largest structural difference
 * from Astro. Bun imports the page modules as TypeScript directly and calls
 * them; React renders to a string. So the failure that produced
 * `check-dev-server.ts` — a Rollup resolver and a Node resolver disagreeing
 * about the same import — cannot occur, because only one resolver is involved
 * in rendering.
 *
 * THE DUPLICATE-OUTPUT GUARD IS NOT DEFENSIVE PROGRAMMING. Two routes resolving
 * to one file is silent by default: the second write wins and a page vanishes
 * from a site that reported success. This project has 13,675 URLs derived from a
 * corpus that resyncs on a schedule, and `cards.ts` already throws on exactly
 * this hazard at the route level. The generator asserts it again at the FILE
 * level, because that is where the collision actually lands and where a rule
 * about slugs cannot see it.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { themeStylesheet } from "optfall-theme";

import { GENERATED_ASSETS } from "./assets";
import { outputPathFor } from "./outputPath";
import { routes } from "./routes";
import { writeServiceWorker } from "./serviceWorker";

const OUT_DIR = new URL("../dist/", import.meta.url).pathname;
const CONFIG = new URL("./vite.config.ts", import.meta.url).pathname;
const VITE_BIN = new URL("../node_modules/.bin/vite", import.meta.url).pathname;

/**
 * THE TOKEN STYLESHEET IS A FILE, WHERE ASTRO INLINED IT INTO EVERY PAGE.
 *
 * `BaseLayout.astro` rendered `themeStylesheet()` into a `<style is:global>` on
 * every page it built. That is 18 kB, and there are 13,675 pages: **235 MB of
 * the shipped output was the same stylesheet, repeated.** It also could not be
 * cached separately from the document it lived in, so every navigation
 * re-downloaded it — the identical argument that had already moved Astro's own
 * component CSS out of the page, applied to the one sheet that change could not
 * reach.
 *
 * Written from the generator rather than authored as CSS because the tokens are
 * a typed table in `packages/theme` and the stylesheet is derived from it. There
 * is no `.css` to import; there is a function that returns one, and this is
 * where its output becomes a file.
 */
const TOKENS_PATH = "assets/tokens.css";

interface ManifestEntry {
  readonly file: string;
  readonly css?: readonly string[];
  readonly isEntry?: boolean;
  readonly name?: string;
  /** Manifest KEYS of the chunks this one imports, not file paths. */
  readonly imports?: readonly string[];
}

/**
 * What Vite emitted, read from its manifest rather than guessed.
 *
 * A HASHED FILENAME MUST BE READ, NEVER CONSTRUCTED. Hard-coding a url would
 * produce pages linking a file that does not exist — an unstyled site, or an
 * island that never hydrates, from a build that reported success. That is
 * precisely the failure this generator has already hit twice from two other
 * directions.
 */
async function assetsFromManifest(): Promise<{
  readonly styles: readonly string[];
  readonly islandScript: string | undefined;
  /** Every JS file the island entry pulls in, transitively, including itself. */
  readonly islandChunks: readonly string[];
}> {
  const manifestPath = join(OUT_DIR, ".vite/manifest.json");
  const file = Bun.file(manifestPath);
  if (!(await file.exists())) {
    return { styles: [], islandScript: undefined, islandChunks: [] };
  }

  const manifest = (await file.json()) as Record<string, ManifestEntry>;
  const entries = Object.entries(manifest);

  /*
   * Found by the entry NAME rather than by the source path, because the key is
   * the path relative to Vite's root and that changes if this file moves. The
   * name is the one in `rollupOptions.input`, which is what the build declared.
   */
  const islandKey = entries.find(([, entry]) => entry.name === "islands")?.[0];

  /*
   * THE WHOLE GRAPH, NOT THE ENTRY CHUNK. `vite.config.ts` declares two Rollup
   * inputs, so a module both of them reach is hoisted into a SHARED chunk that
   * the entry merely imports. Measuring only the entry would let a future
   * corpus arrive through such a chunk while the entry stayed small and the
   * build reported success — which is precisely the failure the budget exists
   * to catch, wearing a different hat.
   */
  const seen = new Set<string>();
  const walk = (key: string | undefined): void => {
    if (key === undefined || seen.has(key)) return;
    seen.add(key);
    for (const next of manifest[key]?.imports ?? []) walk(next);
  };
  walk(islandKey);

  return {
    styles: entries.flatMap(([, entry]) => entry.css ?? []),
    islandScript:
      islandKey === undefined ? undefined : manifest[islandKey]?.file,
    islandChunks: [...seen].flatMap((key) => {
      const emitted = manifest[key]?.file;
      return emitted === undefined ? [] : [emitted];
    }),
  };
}

/**
 * The island bundle's ceiling, and the reason there is one at all.
 *
 * **THE BUNDLE WAS 9.28 MB AND NOTHING NOTICED.** `card-search.ts` imported two
 * pure helpers from `cards.ts`, `cards.ts` imports the 16 MB card corpus at
 * module scope, and the island entry reaches `card-search.ts` through
 * `CardSearch.tsx` — so Rollup did exactly what it was asked and put the entire
 * corpus in the client. Every reader who opened the front page, `/search`, `/cr`
 * or any card page downloaded it.
 *
 * Every check was green while that shipped. The build succeeded, 13,675 pages
 * rendered, the islands hydrated, the disclaimer was on every page and the
 * tokens reached all of them. **A bundle nobody measures is a bundle that can be
 * any size at all**, and it was found only because Workbox refused to precache
 * a 9.74 MB file and said so.
 *
 * So the measurement is now part of the build rather than a thing to remember.
 * The ceiling is roughly 70% above the current 233 kB — loose enough that
 * ordinary work never touches it, and two orders of magnitude below a corpus, so
 * the failure it exists for cannot squeeze under it.
 *
 * IT SUMS THE WHOLE IMPORT GRAPH, not the entry chunk. `vite.config.ts` declares
 * two inputs, so a module both reach is hoisted into a shared chunk the entry
 * merely imports — and a budget that weighed only the entry would wave through a
 * corpus arriving that way while reporting success.
 */
const ISLAND_BUDGET_BYTES = 400 * 1024;

async function assertIslandBudget(chunks: readonly string[]): Promise<void> {
  if (chunks.length === 0) return;

  const sizes = chunks.map((chunk) => ({
    chunk,
    bytes: Bun.file(join(OUT_DIR, chunk)).size,
  }));
  const total = sizes.reduce((sum, one) => sum + one.bytes, 0);
  if (total <= ISLAND_BUDGET_BYTES) return;

  const breakdown = sizes
    .toSorted((a, b) => b.bytes - a.bytes)
    .map((one) => `    ${one.chunk} — ${Math.round(one.bytes / 1024)} kB`)
    .join("\n");

  throw new Error(
    `The island bundle is ${Math.round(total / 1024)} kB across ${chunks.length} chunk(s), over the ${Math.round(ISLAND_BUDGET_BYTES / 1024)} kB budget.\n` +
      `${breakdown}\n` +
      `This almost always means a module the client imports now reaches the card corpus: ` +
      `\`cards.ts\` loads 16 MB at module scope, and a VALUE import of anything from it ` +
      `pulls the whole thing into the bundle. See \`src/lib/printings.ts\`, which exists ` +
      `for exactly this reason. Use \`import type\` where you only need a shape.`,
  );
}

async function main(): Promise<void> {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  // Vite writes the component CSS. Spawned rather than imported so the build
  // runs exactly as a developer would run it, and so a failure there stops
  // this one.
  /*
   * THE LOCAL BINARY, BY PATH, NOT `bunx vite`.
   *
   * `bunx` resolved `vite@latest` out of a temp cache rather than the version
   * this app declares — a different major, built against a different rolldown,
   * failing on a config the installed Vite accepts. A build that silently uses
   * a package the lockfile does not pin is a build nobody can reproduce.
   */
  const vite = Bun.spawnSync(
    [VITE_BIN, "build", "--config", CONFIG, "--logLevel", "warn"],
    { stdout: "inherit", stderr: "inherit" },
  );
  if (vite.exitCode !== 0) {
    throw new Error(`vite build failed with exit code ${vite.exitCode}`);
  }

  await writeFile(join(OUT_DIR, TOKENS_PATH), themeStylesheet(), "utf-8");

  /*
   * The non-page files, written before the pages so a failure to derive one
   * stops the build before it emits 13,675 documents linking it.
   */
  for (const asset of GENERATED_ASSETS) {
    const target = join(OUT_DIR, asset.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, asset.contents, "utf-8");
  }

  /*
   * TOKENS FIRST, COMPONENTS SECOND. The component sheets consume `--of-*`
   * custom properties and define none of them, so the order is not cosmetic —
   * a custom property is resolved at use, so a later definition still applies,
   * but the cascade for anything a component overrides depends on this. It is
   * also the order a reader would expect, which is worth something in a
   * `<head>` nobody rereads.
   */
  const assets = await assetsFromManifest();
  const styles: readonly string[] = [
    `/${TOKENS_PATH}`,
    ...assets.styles.map((href) => `/${href}`),
  ];
  const islandScript =
    assets.islandScript === undefined ? undefined : `/${assets.islandScript}`;

  await assertIslandBudget(assets.islandChunks);

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

      const html = resolved.render(styles, islandScript);

      const target = join(OUT_DIR, outputPath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, html, "utf-8");
      count += 1;
    }
  }

  // The manifest is how the build talks to itself, not something to publish.
  await rm(join(OUT_DIR, ".vite"), { recursive: true, force: true });

  /*
   * LAST, AND THAT ORDERING IS LOAD-BEARING. Workbox globs the output directory
   * to build its precache list, so it has to run after everything it might
   * precache exists — and after `.vite` is gone, or the build's own manifest
   * would be shipped inside the service worker's.
   */
  const sw = await writeServiceWorker(OUT_DIR);

  console.log(
    `[ssg] ${count} page(s), ${GENERATED_ASSETS.length} generated asset(s), ` +
      `${styles.length} stylesheet(s)` +
      `${islandScript === undefined ? ", no islands" : ", islands bundled"}` +
      `, ${sw.precached} file(s) precached (${Math.round(sw.bytes / 1024)} kB)` +
      ` → dist/`,
  );
}

await main();
