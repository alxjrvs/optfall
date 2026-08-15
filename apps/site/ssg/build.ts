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
}> {
  const manifestPath = join(OUT_DIR, ".vite/manifest.json");
  const file = Bun.file(manifestPath);
  if (!(await file.exists())) return { styles: [], islandScript: undefined };

  const manifest = (await file.json()) as Record<string, ManifestEntry>;
  const entries = Object.values(manifest);

  return {
    styles: entries.flatMap((entry) => entry.css ?? []),
    /*
     * Found by the entry NAME rather than by the source path, because the key
     * is the path relative to Vite's root and that changes if this file moves.
     * The name is the one in `rollupOptions.input`, which is the thing the
     * build actually declared.
     */
    islandScript: entries.find((entry) => entry.name === "islands")?.file,
  };
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

  console.log(
    `[ssg] ${count} page(s), ${GENERATED_ASSETS.length} generated asset(s), ` +
      `${styles.length} stylesheet(s)` +
      `${islandScript === undefined ? ", no islands" : ", islands bundled"}` +
      ` → dist/`,
  );
}

await main();
