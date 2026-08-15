/**
 * The client build. One entry, and its only real output is a stylesheet.
 *
 * IT LIVES IN `ssg/` RATHER THAN AT THE APP ROOT, and is passed to Vite
 * explicitly, because it is the GENERATOR's config rather than the app's — the
 * app is still an Astro site with its own `astro.config.mjs`, and two configs
 * discovered from one directory is how a build picks the wrong one.
 *
 * `manifest: true` is the point of the whole file. The emitted stylesheet is
 * content-hashed, so nothing may hard-code its URL; `build.ts` reads the
 * manifest and links whatever was actually written. A hash guessed rather than
 * read is a page that links a stylesheet that does not exist, which renders as
 * an unstyled site and reports success.
 */

import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const appRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  root: appRoot,
  base: "/",
  build: {
    outDir: fileURLToPath(new URL("../dist-next", import.meta.url)),
    // NEVER TRUE. `build.ts` renders the pages into this directory before this
    // build would run, and Vite emptying it would delete them — or, run the
    // other way round, would delete the assets the pages link. The generator
    // owns the lifecycle of `dist-next/` and clears it once, itself.
    emptyOutDir: false,
    manifest: true,
    rollupOptions: {
      input: {
        styles: fileURLToPath(new URL("./styles.entry.ts", import.meta.url)),
      },
    },
  },
});
