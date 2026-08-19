#!/usr/bin/env bun
/**
 * The static generator. `bun ssg/build.ts`.
 *
 * `docs/PLAN.md` Phase 6. **This is the build now.** It rendered alongside Astro
 * into `dist-next/` for four layers, matched it at 12,776 pages, and layer 5
 * deleted the other one — so the output is `dist/`, which is what Netlify
 * publishes and what every compliance check reads.
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
import { renderHeaders, renderRedirects } from "./hostConfig";
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
 * **THE BUNDLE WAS 9.28 MB AND NOTHING NOTICED.** `card-search.ts` imported two
 * pure helpers from `cards.ts`, `cards.ts` imports the 16 MB card corpus at
 * module scope, and the island entry reaches `card-search.ts` through
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
 * pages and false of the site: `/search` is 884 kB. A budget whose stated
 * baseline covers only the pages its author was working on is a budget that has
 * not looked at the others, which is the whole failure it exists to prevent.
 *
 * Measured across all 12,776: `/search` 934 kB (see the exceptions below),
 * `/sets/lgs` 273 kB, `/sets/fab` 243 kB, `/sets/1hp` 238 kB, `/sets/pen` 231
 * kB, `/cr` 215 kB, and a 40 kB median set page.
 *
 * THE MARGIN IS WIDE FOR THE SAME REASON `/search`'s IS, and the first version
 * of this number was not. A set page's HTML is LINEAR IN THE SET'S CARD COUNT,
 * so a ceiling 48% above today's largest set is a ceiling that a big new set
 * trips — failing the build with an error blaming per-row props, on a commit
 * that only synced data. That is the exact misdiagnosis the exceptions table
 * below argues against, and it applied here first.
 *
 * At roughly 2.4× the largest set page it takes a set half again as large as
 * 1HP before anyone has to think about it, and what it still catches is the
 * failure it was written for: a field added to `CardIndexEntry` is paid once
 * per card and then escaped, so anything of consequence moves this by tens of
 * kilobytes per page at once.
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
 * deliberate trade `search.page.tsx` argues at length (the 16 MB corpus stays on
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
     The whole-corpus search index, encoded. Measured at 934 kB.

     THAT NUMBER MOVED WITHOUT A COMMIT MOVING IT, which is the property this
     page has and the set pages do not: it is linear in the CORPUS, so a data
     sync grows it and the note beside it ages silently. Re-measured here at 934
     kB, and checked against `main` at the same figure — this branch adds
     nothing to this page, it only found the drift.

     THE HEADROOM IS WIDE ON PURPOSE, AND IT WAS 8.6% — which is the wrong
     number for a page whose size is LINEAR IN THE CORPUS. This branch alone
     spent about 55 kB of it: `faceSets` 9.6 kB, the per-art landscape bit
     12.9 kB, and three more printed stats per card 32 kB. The last of those
     landed AFTER the ceiling was widened and would have tripped the old one —
     failing the build with an error blaming per-row props, which is the wrong
     diagnosis on a page that has no rows.

     So the margin has to absorb corpus growth, and what it still catches on
     this one page is therefore coarse: an order-of-magnitude mistake, not a
     tight field. That is the honest limit of a byte ceiling here. The check
     that a new per-card field is worth its weight is the doc-block beside it in
     `card-search.ts`, where every existing field states its measured cost.
  */
  "/search": 1280 * 1024,
  /*
     `/cr` IS DELIBERATELY NOT HERE, and it is the page most likely to be added
     by mistake — it also ships a whole encoded corpus as island props, so it
     looks like `/search`'s twin. Measured: 212 kB, comfortably inside the
     general ceiling, because the rules index carries a ≤120-character lede per
     section rather than the 651 kB of verbatim rules text. An exception it does
     not need would stop measuring it.
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
  await writeFile(join(OUT_DIR, "_headers"), renderHeaders(), "utf-8");
  await writeFile(join(OUT_DIR, "_redirects"), renderRedirects(), "utf-8");

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
      assertPageBudget(resolved.route, html);

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
    `[ssg] ${count} page(s), ` +
      `${generated.length} generated asset(s), ` +
      `${styles.length} stylesheet(s)` +
      `${islandScript === undefined ? ", no islands" : ", islands bundled"}` +
      `, ${sw.precached} file(s) precached (${Math.round(sw.bytes / 1024)} kB)` +
      ` → dist/`,
  );
}

await main();
