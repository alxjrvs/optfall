/**
 * The client build. One entry, and its only real output is a stylesheet.
 *
 * IT LIVES IN `ssg/` RATHER THAN AT THE APP ROOT, and is passed to Vite
 * explicitly, because it is the GENERATOR's config rather than the app's. That
 * mattered acutely during Phase 6, when the app was still an Astro site with
 * its own `astro.config.mjs` and two configs discovered from one directory was
 * how a build picked the wrong one. The Astro config is gone; the placement
 * stays, because an explicit path is still the thing that makes which config
 * Vite reads a fact rather than a discovery order.
 *
 * `manifest: true` is the point of the whole file. The emitted stylesheet is
 * content-hashed, so nothing may hard-code its URL; `build.ts` reads the
 * manifest and links whatever was actually written. A hash guessed rather than
 * read is a page that links a stylesheet that does not exist, which renders as
 * an unstyled site and reports success.
 */

import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: appRoot,
  base: "/",
  /*
   * THE ISLAND ENTRY IS TSX, SO THE BUILD NEEDS A JSX PARSER. Without this the
   * bundle fails with "JSX syntax is disabled" — which is the correct error and
   * an easy one to misread as a tsconfig problem, since `tsc` compiles the same
   * files happily. `tsc` reads `jsx` from the tsconfig; the bundler does not.
   */
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist", import.meta.url)),
    // NEVER TRUE. `build.ts` renders the pages into this directory before this
    // build would run, and Vite emptying it would delete them — or, run the
    // other way round, would delete the assets the pages link. The generator
    // owns the lifecycle of `dist/` and clears it once, itself.
    emptyOutDir: false,
    manifest: true,
    rollupOptions: {
      input: {
        styles: fileURLToPath(new URL("./styles.entry.ts", import.meta.url)),
        /*
         * The islands, as ONE bundle rather than one per island. A page
         * carrying the printing picker downloads the rules search too, which is
         * a real cost and the right trade at this size: the alternative is a
         * chunk graph and a manifest lookup per island, to save a few kB on a
         * site whose largest page ~~ships a 731 kB search index inline~~ is a
         * 297 kB list of set rows. The index moved out into a file the islands
         * fetch (`ssg/searchIndexes.ts`), so the comparison that made this an
         * easy call is gone and the call is unchanged: one bundle is still four
         * islands in one cache entry, and the heaviest thing in it is React.
         *
         * Revisit when an island appears that is genuinely heavy and genuinely
         * rare. Until then, one file, one cache entry, one request.
         */
        islands: fileURLToPath(new URL("./islands.client.ts", import.meta.url)),
      },
    },
  },
});
