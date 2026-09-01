#!/usr/bin/env bun
/**
 * The static generator. `bun ssg/build.ts`.
 *
 * `docs/ROADMAP.md` Phase 6. **This is the build now.** It rendered alongside
 * Astro into `dist-next/` for four layers, matched it at 12,776 pages, and layer 5
 * deleted the other one — so the output is `dist/`, which is what gets
 * published and what every compliance check reads.
 *
 * THE PIPELINE, IN ORDER, AND THE ORDER MATTERS:
 *
 *   1. Clear `dist/`. The generator owns this directory's lifecycle, which is
 *      why the Vite config sets `emptyOutDir: false` — two things clearing one
 *      directory is one of them deleting the other's output.
 *   2. `vite build`: the client bundle, whose only real product is a
 *      content-hashed stylesheet collecting all fifteen component sheets.
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
 * from a site that reported success. This project has 12,776 URLs derived from a
 * corpus that resyncs on a schedule, and `cards.ts` already throws on exactly
 * this hazard at the route level. The generator asserts it again at the FILE
 * level, because that is where the collision actually lands and where a rule
 * about slugs cannot see it.
 */

import { Buffer } from "node:buffer";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { themeStylesheet } from "optfall-theme";

import { generatedAssets } from "./assets";
import { canonicalFor } from "./document";
import { headersFor, renderHeaders, renderRedirects } from "./hostConfig";
import { outputPathFor } from "./outputPath";
import { routes } from "./routes";
import { writeServiceWorker } from "./serviceWorker";
import {
  ROBOTS_PATH,
  renderRobots,
  renderSitemap,
  SITEMAP_PATH,
} from "./sitemap";

const OUT_DIR = new URL("../dist/", import.meta.url).pathname;

/**
 * Files allowed in one Workers Static Assets version.
 *
 * Cloudflare's number, not ours. Verify against their docs before changing it;
 * the build fails rather than letting a deploy discover it.
 */
const STATIC_ASSET_FILE_LIMIT = 20_000;

/** Every file under a directory, recursively. */
async function countFiles(directory: string): Promise<number> {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");

  let total = 0;
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) total += await countFiles(path);
    else total += 1;
  }
  return total;
}
const CONFIG = new URL("./vite.config.ts", import.meta.url).pathname;
const VITE_BIN = new URL("../node_modules/.bin/vite", import.meta.url).pathname;

/**
 * THE TOKEN STYLESHEET IS A FILE, WHERE ASTRO INLINED IT INTO EVERY PAGE.
 *
 * `BaseLayout.astro` rendered `themeStylesheet()` into a `<style is:global>` on
 * every page it built. That is 18 kB, and there are 12,776 pages: **235 MB of
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
  /** Same, for `import()` — a separate field, and a separate way to smuggle. */
  readonly dynamicImports?: readonly string[];
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
    const entry = manifest[key];
    /* BOTH FIELDS. Vite lists `import()` targets separately, so following only
       `imports` would let a lazily-loaded chunk carry the corpus past the
       budget in exactly the way the shared chunk did. */
    for (const next of entry?.imports ?? []) walk(next);
    for (const next of entry?.dynamicImports ?? []) walk(next);
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
 * **THE BUNDLE WAS 9.28 MB AND NOTHING NOTICED.** `card-search/` imported two
 * pure helpers from `cards.ts`, `cards.ts` imports the 18 MB card corpus at
 * module scope, and the island entry reaches `card-search/` through
 * `CardSearch.tsx` — so Rollup did exactly what it was asked and put the entire
 * corpus in the client. Every reader who opened the front page, `/search`, `/cr`
 * or any card page downloaded it.
 *
 * Every check was green while that shipped. The build succeeded, 12,776 pages
 * rendered, the islands hydrated, the disclaimer was on every page and the
 * tokens reached all of them. **A bundle nobody measures is a bundle that can be
 * any size at all**, and it was found only because Workbox refused to precache
 * a 9.74 MB file and said so.
 *
 * So the measurement is now part of the build rather than a thing to remember.
 * The ceiling is roughly 40% above the current 286 kB — loose enough that
 * ordinary work never touches it, and two orders of magnitude below a corpus, so
 * the failure it exists for cannot squeeze under it.
 *
 * **THE HEADROOM WAS 70% AT 233 kB AND IS 40% AT 286 kB**, and the 53 kB between
 * them is TanStack, in two bites. Query (46 kB) arrived when the search indexes
 * moved out of the pages into files the islands fetch (`ssg/searchIndexes.ts`);
 * Store (6 kB) when the header's field became an island of its own rather than a
 * node `CardSearch` reached out and adopted (`islands/headerSearchStore.ts`).
 *
 * Both are real costs on every island page, paid once from a hashed asset,
 * against 1.1 MB removed from two documents that could not cache theirs at all
 * and about 150 lines of cross-root DOM synchronisation removed from one island.
 * Worth stating plainly rather than letting the ceiling absorb it quietly: these
 * are the only deliberate bites anybody has taken out of this budget, and the
 * next 114 kB is all that is left before somebody has to argue for raising it.
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
      `\`cards.ts\` loads 18 MB at module scope, and a VALUE import of anything from it ` +
      `pulls the whole thing into the bundle. See \`src/lib/printings.ts\`, which exists ` +
      `for exactly this reason. Use \`import type\` where you only need a shape.`,
  );
}

/**
 * The ceiling on ONE PAGE'S HTML, which is a different failure from the bundle's.
 *
 * `assertIslandBudget` weighs the JavaScript, and for a long time that was the
 * only thing here that could get quietly enormous. It stopped being: an island
 * carries its props as JSON in a `data-props` attribute, React escapes every
 * `"` in it to `&quot;`, and a set page hands `CardList` a row per card. So a
 * 750-card set's markup is a real number that no check was watching, and the
 * comment beside the noscript list costed only the part that was easy to see.
 *
 * MEASURED RATHER THAN GUESSED, exactly as the island budget was — and measured
 * over EVERY route, which the first version of this note was not. It said "the
 * largest page in this corpus is `/sets/1hp` at 220 kB", which was true of set
 * pages and false of the site: `/search` was 884 kB. A budget whose stated
 * baseline covers only the pages its author was working on is a budget that has
 * not looked at the others, which is the whole failure it exists to prevent.
 *
 * Measured across all 12,776 when this was written: `/search` 934 kB, `/sets/lgs`
 * 273 kB, `/sets/fab` 243 kB, `/sets/1hp` 238 kB, `/sets/pen` 231 kB, `/cr` 215
 * kB, and a 40 kB median set page.
 *
 * **THE TOP TWO OF THOSE ARE GONE.** `/search` and `/cr` were the two pages
 * carrying an encoded index as island props; they fetch it now, and measure 11 kB
 * and 15 kB. So the largest page on the site is a set page again, and this ceiling
 * is back to being what its name says — a bound on rows, with no page relying on
 * an exception to clear it. See `PAGE_BUDGET_EXCEPTIONS`.
 *
 * Re-measured across all 12,776 on the same build: `/sets/lgs` 297 kB, `/sets/1hp`
 * 261 kB, `/sets/fab` 260 kB, `/sets/pen` 247 kB, `/sets/mon` 206 kB. Note that
 * `/sets/lgs` has grown from the 273 kB above WITHOUT a commit moving it — a set
 * page is linear in its card count, so a data sync grows it. That is the property
 * this ceiling's margin exists to absorb, and at 1.7× the largest set page it
 * still has room for a set half again as large as LGS.
 *
 * THE MARGIN IS WIDE BECAUSE A SET PAGE'S HTML IS LINEAR IN THE SET'S CARD
 * COUNT, and the first version of this number was not. A ceiling 48% above
 * today's largest set is a ceiling that a big new set trips — failing the build
 * with an error blaming per-row props, on a commit that only synced data. That
 * is the exact misdiagnosis the exceptions table below argues against, and it
 * applied here first.
 *
 * ~~At roughly 2.4× the largest set page~~ — **1.7× now, and nothing moved this
 * ceiling; LGS grew into it.** That is the same linearity stated as a
 * measurement rather than as a risk, and it is the number to watch: at 297 kB
 * against 512, a set around half again the size of LGS is where this next wants
 * thinking about. What it still catches meanwhile is the failure it was written
 * for: a field added to `CardIndexEntry` is paid once per card and then escaped,
 * so anything of consequence moves this by tens of kilobytes per page at once.
 *
 * IT IS UNCOMPRESSED BYTES, AND THAT IS THE PESSIMISTIC READING. The same page
 * is about 20 kB over the wire, because a list of cards is extremely
 * compressible. Measuring the compressed size would be measuring what the
 * reader pays; measuring this measures what the page CONTAINS, which is the
 * thing that goes wrong.
 */
const PAGE_BUDGET_BYTES = 512 * 1024;

/**
 * Routes that carry something other than rows, with the reason and a ceiling.
 *
 * AN EXPLICIT LIST, NOT A RAISED CEILING, AND THE DIFFERENCE IS THE WHOLE VALUE
 * OF THE CHECK. Adding this budget found `/search` at 883 kB on its first run —
 * not a regression, and not a surprise once looked at: that page ships the
 * ENTIRE encoded card index as island props, 732 kB of it, which is the
 * deliberate trade `search.page.tsx` argues at length (the 18 MB corpus stays on
 * the build machine and the reader gets the index instead). Raising the general
 * ceiling to cover it would have bought nothing — 1 MB is above every page that
 * could ever go wrong, so the check would pass forever while measuring nothing.
 *
 * So the one page that is legitimately enormous says so here, at its own
 * number, and every other page is held to the row-shaped budget. A new entry in
 * this table should be an argument, not a convenience.
 */
const PAGE_BUDGET_EXCEPTIONS: Readonly<Record<string, number>> = {
  /*
     ~~`/search`: 1280 kB, for the whole-corpus search index, encoded.~~
     **EMPTY, AND THE ENTRY THAT WAS HERE IS THE REASON THIS TABLE EXISTS.**

     `/search` carried the encoded card index as island props — 909,626 bytes of
     it, in a `data-props` attribute, making the document 921 kB. This entry said
     so at 1280 kB, and the argument it made was sound at the time and is worth
     keeping visible: the general ceiling could not be raised to cover it without
     the check passing forever while measuring nothing, so the one page that was
     legitimately enormous said so at its own number.

     What that argument could not fix is the property it named. The page's size
     was LINEAR IN THE CORPUS, so it moved without a commit moving it, and the
     ceiling had to be wide enough to absorb a data sync — which left it "coarse:
     an order-of-magnitude mistake, not a tight field". A budget that can only
     catch an order of magnitude on the largest page on the site is the weakest
     it is anywhere.

     `ssg/searchIndexes.ts` removed the cause rather than the symptom: the index
     is a content-hashed file now, fetched by the island, and the page carries an
     805-byte brief. `/search` is an ordinary document held to the ordinary
     ceiling, and this table is empty — which is the state to keep it in. A new
     entry should be an argument, not a convenience.

     `/cr` was never here, deliberately, and it is the page that was most likely
     to be added by mistake: it also shipped a whole encoded corpus as island
     props, so it looked like `/search`'s twin. It measured 212 kB against the
     general ceiling, and 15 kB now.
  */
};

function assertPageBudget(route: string, html: string): void {
  const bytes = Buffer.byteLength(html, "utf-8");
  const budget = PAGE_BUDGET_EXCEPTIONS[route] ?? PAGE_BUDGET_BYTES;
  if (bytes <= budget) return;

  throw new Error(
    `${route} is ${Math.round(bytes / 1024)} kB of HTML, over its ${Math.round(budget / 1024)} kB budget.\n` +
      `On a page carrying an island this is usually the props: they cross as JSON in a ` +
      `\`data-props\` attribute and React escapes every quote, so a field added to a ` +
      `per-row shape is paid once per row and then some. Send what the view needs.\n` +
      `If nothing was added to a row, check whether the CORPUS grew instead — a set page ` +
      `is linear in its card count, and a genuinely larger set wants this ceiling raised ` +
      `rather than the page slimmed. If the page carries something other than rows ` +
      `altogether, give it an entry in PAGE_BUDGET_EXCEPTIONS with the argument for it.`,
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
   * stops the build before it emits 12,776 documents linking it.
   */
  const generated = await generatedAssets();
  for (const asset of generated) {
    const target = join(OUT_DIR, asset.path);
    await mkdir(dirname(target), { recursive: true });
    /* The encoding is passed for text and WITHHELD for bytes. Node ignores it
       on a TypedArray either way, but spelling `utf-8` over a PNG reads as a
       claim about the file that is not true of it. */
    if (typeof asset.contents === "string") {
      await writeFile(target, asset.contents, "utf-8");
    } else {
      await writeFile(target, asset.contents);
    }
  }

  /*
   * THE HOST'S OWN TWO FILES, WRITTEN LAST AMONG THE FLAT ONES. They are not in
   * `generatedAssets()` on purpose — that registry is what the site SERVES, and
   * these are read by the host and then hidden. `hostConfig.ts` says why.
   */
  /*
   * `OPTFALL_PREVIEW` is set by the deploy workflow on a pull request and by
   * nothing else. It adds `X-Robots-Tag: noindex` to the wildcard rule so a
   * preview host cannot be indexed alongside production — see `headersFor`,
   * which also records why this is a merge rather than an extra rule.
   */
  const preview = process.env["OPTFALL_PREVIEW"] === "1";
  await writeFile(
    join(OUT_DIR, "_headers"),
    renderHeaders(headersFor({ preview })),
    "utf-8",
  );
  await writeFile(join(OUT_DIR, "_redirects"), renderRedirects(), "utf-8");
  if (preview) console.log("[ssg] preview build — _headers carries noindex");

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
  /*
   * THE SITEMAP IS COLLECTED HERE RATHER THAN BUILT IN A SECOND PASS, because
   * this loop is the only place that has both the route and the HTML it
   * produced. Re-resolving the routes afterwards to ask each page for its
   * canonical would render all 12,776 of them twice.
   */
  const sitemapUrls: string[] = [];

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
      assertPageBudget(resolved.route, html);

      /*
       * A PAGE IS IN THE SITEMAP WHEN IT IS ITS OWN CANONICAL, and the test is
       * the tag the page actually emitted rather than anything this file
       * recomputes. 6,437 of these routes are alternate printings that
       * canonical to their card's default printing; listing them would
       * contradict, in the sitemap, the thing the `<head>` just said.
       */
      if (registration.sitemap) {
        const canonical = /<link rel="canonical" href="([^"]+)"/.exec(
          html,
        )?.[1];
        if (canonical === canonicalFor(resolved.route)) {
          sitemapUrls.push(canonical);
        }
      }

      const target = join(OUT_DIR, outputPath);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, html, "utf-8");
      count += 1;
    }
  }

  /*
   * The sitemap is sorted so the file is stable between builds: the route order
   * is the registration order, which is a decision about the code rather than
   * about the URLs, and a diff that reshuffles 12,776 lines because a page moved
   * in `routes.ts` hides the one line that actually changed.
   */
  sitemapUrls.sort();
  await writeFile(
    join(OUT_DIR, SITEMAP_PATH),
    renderSitemap(sitemapUrls),
    "utf-8",
  );
  await writeFile(
    join(OUT_DIR, ROBOTS_PATH),
    renderRobots(canonicalFor(`/${SITEMAP_PATH}`).replace(/\/$/, "")),
    "utf-8",
  );

  // The manifest is how the build talks to itself, not something to publish.
  await rm(join(OUT_DIR, ".vite"), { recursive: true, force: true });

  /*
   * LAST, AND THAT ORDERING IS LOAD-BEARING. Workbox globs the output directory
   * to build its precache list, so it has to run after everything it might
   * precache exists — and after `.vite` is gone, or the build's own manifest
   * would be shipped inside the service worker's.
   */
  const sw = await writeServiceWorker(OUT_DIR);

  /*
    THE PER-VERSION FILE CEILING, FAILED LOUDLY RATHER THAN DISCOVERED AT
    DEPLOY.

    Workers Static Assets caps the number of files in one version. Cross it and
    `wrangler deploy` refuses — after a full build, in CI, on a change that had
    nothing to do with it. `assets.ts` records parity measured at 13,675 files,
    so this is not a distant ceiling: the count grows with every set release,
    and each card page is a file.

    This is the same treatment `sitemap.ts` already gives the 50,000-URL
    protocol limit, and for the same reason it gives it — a ceiling nobody
    measures is a ceiling somebody hits.

    The limit is Cloudflare's rather than ours, so it is stated here as a
    figure to re-verify rather than derived from anything. If it moves, this
    number moves with it.
  */
  const files = await countFiles(OUT_DIR);
  if (files > STATIC_ASSET_FILE_LIMIT) {
    throw new Error(
      `${files} files in dist/, over the ${STATIC_ASSET_FILE_LIMIT} a single ` +
        `Workers Static Assets version accepts. The deploy will refuse this ` +
        `build. Splitting the output or pruning generated files is the fix; ` +
        `raising this number is only correct if Cloudflare has raised theirs.`,
    );
  }

  console.log(
    `[ssg] ${count} page(s), ` +
      `${generated.length} generated asset(s), ` +
      `${styles.length} stylesheet(s)` +
      `${islandScript === undefined ? ", no islands" : ", islands bundled"}` +
      `, ${sw.precached} file(s) precached (${Math.round(sw.bytes / 1024)} kB)` +
      ` → dist/`,
  );
}

await main();
