// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

// Static output is a project-wide constraint, not a default we happen to be
// taking: no database, no server, no runtime bill. See docs/PLAN.md, "Stack".
//
// `site` IS SET NOW. It was deliberately unset while the domain was still open
// (docs/PLAN.md, "Settled, and still open"); optfall.com is live and serving,
// so the open question is closed and canonical URLs — which need an origin to
// be absolute — can be emitted.
export default defineConfig({
  site: "https://optfall.com",
  output: "static",
  integrations: [svelte()],

  build: {
    /**
     * THE STYLESHEET IS A LINK, NOT A COPY IN EVERY PAGE.
     *
     * Astro's default is `"auto"`: inline any stylesheet under 4 kB, link the
     * rest. On a site with one page that is the right call — it removes a
     * round-trip and the bytes are trivial. On this one it was measured at
     * **31 kB of the average card page's 61 kB**, because "under 4 kB" is
     * decided per CHUNK and a card page pulls in a dozen of them.
     *
     * That is the wrong trade for a REFERENCE TOOL specifically, and the
     * reason is about how it is read rather than how it is built. Nobody
     * looks up one card. A reader checks a card, checks the card it combos
     * with, checks the ruling that made them ask — and under `"auto"` every
     * one of those navigations re-downloads the same 31 kB of identical CSS,
     * because bytes inside an HTML document cannot be cached separately from
     * the document. Linked, it is fetched once and every subsequent page is
     * half the size on the wire and free of CSS entirely.
     *
     * The cost is one extra request on a cold first paint, and it is a real
     * cost that this note should not pretend away. It is paid once per
     * reader; the saving is paid back on their second page.
     *
     * IT IS ALSO WHAT MAKES PER-PRINTING URLS AFFORDABLE, which is the
     * immediate reason it changed. `/card/<slug>/<set>/<number>` adds 6,437
     * pages to the 7,238 already emitted, and at 61 kB each that is +392 MB
     * of near-identical HTML. Halving the page first turns a build that
     * nearly triples the output into one that stays roughly where it was.
     */
    inlineStylesheets: "never",
  },

  vite: {
    ssr: {
      /**
       * THE WORKSPACE PACKAGES SHIP TYPESCRIPT SOURCE, SO THEY HAVE TO BE
       * BUNDLED RATHER THAN HANDED TO THE RUNTIME LOADER.
       *
       * `optfall-theme`, `optfall-rules` and `optfall-components` all point
       * `exports["."]` at `./src/index.ts` — there is no build step and no
       * `dist/`, which is the arrangement that lets a token change show up in
       * a component without a rebuild. The cost is that those packages are
       * only loadable by something that understands TypeScript *and* resolves
       * the way a bundler does.
       *
       * Vite externalises anything that resolves through `node_modules`, and a
       * bun workspace package resolves through `node_modules` via a symlink,
       * so all three qualified. Externalised means Node's own ESM loader gets
       * them — and Node ESM requires a full file extension on every relative
       * specifier. `packages/theme/src/index.ts` imports `"./tokens"`, which
       * is legal TypeScript, legal to a bundler, and unresolvable to Node:
       *
       *     Cannot find module '.../packages/theme/src/tokens'
       *       imported from '.../packages/theme/src/index.ts'
       *
       * That threw while rendering, so EVERY dev route answered 500 — pages,
       * islands and `/favicon.svg` alike. `bun run dev` was unusable.
       *
       * IT DID NOT SHOW UP IN CI, and the reason is worth writing down because
       * it is what let this sit undetected. `astro build` resolves SSR modules
       * through Rollup, which applies bundler resolution and fills the missing
       * extension in silently, so the production build succeeded — 7,237 pages,
       * a correct `dist/favicon.svg` — while dev was broken end to end. A green
       * build is not evidence that the dev server runs; nothing in the pipeline
       * was looking at dev until `scripts/check-dev-server.ts`.
       *
       * A regex rather than a list, so a fifth workspace package is covered on
       * the day it is created rather than on the day someone remembers this
       * file. `optfall-legality` is matched too and does not need to be — it is
       * the one package that ships built `dist/` JavaScript — but bundling it
       * is correct anyway and an exception here would only be a second thing to
       * keep true.
       *
       * The alternative fix was spelling every relative import `"./tokens.ts"`.
       * It is rejected on blast radius: it is one edit per import in every
       * package forever, enforced by nothing, and it leaves the underlying
       * mistake — source-only packages being handed to a loader that cannot
       * read source — in place to be made again.
       */
      noExternal: [/^@?optfall[-/]/],
    },
  },
});
