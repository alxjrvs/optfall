/**
 * The files the build emits that are not pages.
 *
 * WHY THIS EXISTS AT ALL. Astro had a shape for this — a `.ts` file under
 * `src/pages/` exporting `GET`, an "endpoint route", built once and written out
 * beside the HTML. The generator had no equivalent, and the gap was invisible
 * to every check: `document.tsx` has linked `/favicon.svg` since layer 2, page
 * parity was measured at 13,675 = 13,675, and the one file that made the link
 * resolve was not a page, so nothing counted it and nothing missed it. Every
 * generated page carried a broken icon link and the build reported success.
 *
 * So the registry is explicit rather than a directory convention. A convention
 * would have been the thing that silently produced nothing when it was not
 * followed, which is the failure this file was written to answer.
 *
 * Static files that need no build step do NOT belong here — they go in
 * `public/`, which Vite copies wholesale. This is only for bytes that are
 * DERIVED, and derived is what earns the extra machinery: the favicon is drawn
 * from the same geometry and the same token tables the on-page mark uses, so
 * there is no second declaration to drift.
 */

import { MARK_GEOMETRY } from "optfall-components";
import { type TokenId, type TokenTable, themes } from "optfall-theme";

/**
 * The colour the platform paints around the app, and the one the browser paints
 * behind the page before the first byte of CSS lands.
 *
 * EXPORTED SO THE `<meta name="theme-color">` AND THE MANIFEST CANNOT DISAGREE.
 * They are two declarations of one fact read by different consumers — the meta
 * tag by the browser's own chrome on a live page, the manifest field by the
 * installer — and a site whose address bar is one colour installed and another
 * in a tab is exactly the drift that is invisible until somebody installs it.
 */
export const THEME_COLOUR: string = literal(themes.dark.tokens, "color.ground");

export interface GeneratedAsset {
  /** Path relative to the output root. No leading slash. */
  readonly path: string;
  /**
   * Text for everything derived from the token tables, BYTES for the rasterised
   * install icons. The union is what let the PNGs join this registry rather than
   * arrive by a second mechanism — and a second mechanism is precisely what the
   * header of this file exists to argue against.
   */
  readonly contents: string | Uint8Array;
}

/**
 * A token's literal value, or a build failure.
 *
 * `TokenTable` is a `Partial` record, so every lookup is `string | undefined`
 * and the tempting spelling is `?? "#000"`. That fallback is the bug: a token
 * renamed in `packages/theme` would leave the tab showing a black lozenge and
 * nothing anywhere would say so. This runs at build time, so throwing means a
 * failed build rather than a wrong favicon — the loud failure is free here.
 */
function literal(tokens: TokenTable, id: TokenId): string {
  const value = tokens[id];
  if (value === undefined) {
    throw new Error(
      `favicon.svg: optfall-theme defines no ${id}. The favicon reads token values directly because it cannot see the page stylesheet; fix the token id rather than inlining a colour here.`,
    );
  }
  return value;
}

/**
 * `/favicon.svg` — the mark, in the tab.
 *
 * IT IS THE CHAIN, NOT ONE LINK, and it used to be one link. The argument for
 * the single link was that a favicon is rasterised at 16px, three interlocked
 * rings become mud at that size, and "a ring with an open window" is the last
 * thing to survive as the icon shrinks. That reasoning is sound and it produced
 * a tab icon that is not the logo — an unfamiliar lozenge next to every other
 * tab, where the whole point of the mark is that the thing you see a thousand
 * times a session is the thing on the tab.
 *
 * So it is the chain, and the 16px case is accepted rather than designed for:
 * browsers ask for 32px and larger far more often than 16 these days, and an
 * icon that is slightly dense at the smallest size beats one that is legible
 * and wrong at every size.
 *
 * THE INTERLOCK IS PAINT ORDER, NOT MASKING, and this reproduces `Mark.tsx`
 * exactly rather than approximating it. Every link is drawn left to right,
 * which settles the LOWER crossing of each pair — the right-hand link is drawn
 * later, so it lies over its neighbour. Then each left-hand link is drawn again
 * inside a clip rectangle containing only that pair's UPPER crossing, which puts
 * it back on top there. Same path, same transform, same fill; the only thing
 * added is where it is allowed to appear.
 *
 * WHAT IT DROPS FROM THE ON-PAGE MARK is the bevel. `Mark` carries a light top
 * edge and a dark bottom one as two 1px drop-shadows and needs `overflow:
 * visible` so an SVG root does not shear them off. A favicon is rasterised
 * inside exactly that clip, where a 1px edge is both uncuttable and mud.
 *
 * THE THREE PITCH COLOURS ARE LITERAL HERE. `Mark` fills each link from a token
 * through a stylesheet; a referenced SVG gets no page CSS, so the values are
 * read from the theme's own tables at build time and written in. That is the
 * same trade `themeStylesheet()` makes — no second declaration to drift,
 * because there is no declaration at all, only a derivation.
 *
 * IT IS NOT THEMED, unlike the version that preceded it. The single link took
 * the accent and flipped it under `prefers-color-scheme` because one shape had
 * to hold against both a dark and a light tab strip. The chain carries the pitch
 * palette, which is the same in both themes — those three colours are the
 * game's, not the interface's — so there is nothing to swap.
 */
function faviconSvg(): string {
  const { viewBox, link, placements, scopes } = MARK_GEOMETRY;
  const dark = themes.dark.tokens;

  const fills = [
    literal(dark, "color.pitch.one"),
    literal(dark, "color.pitch.two"),
    literal(dark, "color.pitch.three"),
  ];

  const clips = scopes
    .map(
      (scope, index) =>
        `<clipPath id="s${index}"><rect x="${scope.x}" y="${scope.y}" width="${scope.width}" height="${scope.height}"/></clipPath>`,
    )
    .join("");

  /* Left to right: settles the lower crossing of every pair. */
  const chain = placements
    .map(
      (placement, index) =>
        `<g transform="${placement}"><path d="${link}" fill-rule="evenodd" fill="${fills[index] ?? fills[0]}"/></g>`,
    )
    .join("");

  /* And the upper crossing, by redrawing the left-hand link inside its scope. */
  const overs = scopes
    .map(
      (scope, index) =>
        `<g clip-path="url(#s${index})"><g transform="${placements[scope.link] ?? ""}"><path d="${link}" fill-rule="evenodd" fill="${fills[scope.link] ?? fills[0]}"/></g></g>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
<defs>${clips}</defs>
${chain}
${overs}
</svg>
`;
}

/**
 * `/icon.svg` — the mark again, at install size.
 *
 * SEPARATE FROM `favicon.svg` BECAUSE AN INSTALLED ICON IS A SQUARE. The mark is
 * a wide, thin ring; dropped into an icon slot at its own proportions it is
 * either letterboxed or, where the platform crops to a circle or a squircle, it
 * loses both ends. So this is the same path on a square canvas, and it paints
 * the ground rather than leaving it transparent — a transparent icon gets a
 * platform-chosen fill behind it, and this project's whole visual key is that
 * the mark sits on near-black.
 *
 * EMITTED TWICE, AT TWO INSETS, and the manifest gives each its own `purpose`.
 * A maskable icon is guaranteed only the centre 80% of each axis, so the
 * maskable copy is inset to that safe zone; the `any` copy is full bleed,
 * because the surfaces that use it do not crop and padded artwork there just
 * renders small in empty ground.
 *
 * IT IS NOT THEMED, unlike the favicon, and that is deliberate rather than an
 * omission. A favicon composites against browser chrome we do not own, so it has
 * to hold on both. An installed icon sits on the user's home screen as OUR
 * surface — one identity, the dark one, which `docs/DESIGN.md` calls the native
 * key.
 */
function iconSvg(safeZone: number): string {
  const { single, link } = MARK_GEOMETRY;
  const dark = themes.dark.tokens;

  /*
   * The viewBox is `x y w h`; the mark is wider than it is tall, so the square
   * canvas is built from the LONGER side and the shorter one is centred in it.
   * Read from the geometry rather than restated — the numbers below are
   * arithmetic on the source of truth, not a second copy of it.
   */
  const [vx = 0, vy = 0, vw = 1, vh = 1] = single.viewBox
    .split(/\s+/)
    .map(Number);

  /* `safeZone` is the fraction of the canvas the artwork is guaranteed. At 1
     the mark fills the square edge to edge; at 0.8 it is inset to the centre
     80%, which is what a maskable crop may keep. */
  const side = Math.max(vw, vh) / safeZone;
  const x = vx + vw / 2 - side / 2;
  const y = vy + vh / 2 - side / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${side} ${side}">
<rect x="${x}" y="${y}" width="${side}" height="${side}" fill="${literal(dark, "color.ground")}"/>
<g transform="${single.placement}"><path d="${link}" fill-rule="evenodd" fill="${literal(dark, "color.accent")}"/></g>
</svg>
`;
}

/**
 * The same mark, rasterised — the half of installability a vector cannot serve.
 *
 * THIS IS THE RASTERISER THE COMMENT BELOW SAID WOULD ARRIVE ONE DAY, AND IT
 * ARRIVES ON THAT COMMENT'S OWN TERMS: the PNG is rendered FROM `iconSvg()`,
 * not hand-drawn beside it, so there is still exactly one declaration of the
 * geometry and one of the palette. Move a token and every size re-renders.
 *
 * IT IS NEEDED BECAUSE SVG MANIFEST ICONS ARE A CHROMIUM FEATURE, NOT A WEB
 * ONE. WebKit does not rasterise an SVG named in `icons`, and an
 * `apple-touch-icon` has never been allowed to be one — so on iOS the install
 * this project already had was an install whose icon was a SCREENSHOT OF THE
 * PAGE. The manifest kept both spellings for that reason: Chromium picks
 * whichever it prefers and loses nothing, while WebKit finally has something it
 * can read.
 *
 * `.resize()` ON VECTOR INPUT RE-RENDERS RATHER THAN UPSCALING, which is the
 * one thing worth knowing here and is not obvious. These SVGs carry a viewBox
 * and no `width`/`height`, so their intrinsic size is 22 units — the naive fear
 * is that sharp rasterises 22×22 and then blows it up to 512. It does not:
 * librsvg is handed the target dimensions, and a 512 px render and a
 * `.resize(512)` of the same source are byte-identical. Verified rather than
 * assumed, because the failure would have been a soft blur nobody notices in a
 * diff.
 */
async function iconPng(safeZone: number, size: number): Promise<Uint8Array> {
  /*
   * IMPORTED HERE RATHER THAN AT THE TOP OF THE FILE, and for the same reason
   * `generatedAssets()` is a function: `THEME_COLOUR` lives in this module and
   * `document.tsx` reads it, so a static import would make every consumer of one
   * string — the test suite included — load sharp's NATIVE BINARY. Deferring it
   * to the one call that needs it means the only thing that can fail on a
   * machine without that binary is the build, which is the only thing that ever
   * wanted it.
   */
  const { default: sharp } = await import("sharp");

  const rendered = await sharp(Buffer.from(iconSvg(safeZone)))
    .resize(size, size)
    .png()
    .toBuffer();

  return new Uint8Array(rendered);
}

/**
 * `/manifest.webmanifest` — what makes the site installable.
 *
 * THE ICONS ARE EMITTED IN BOTH SPELLINGS, and the PNGs are derived from the
 * SVG rather than drawn beside it — see `iconPng` above for why that is what
 * makes a second format affordable at all. Chromium installs happily on the
 * vector; WebKit cannot read one, so without the raster the iOS install had an
 * icon that was a screenshot of the page. Both are listed, largest last, and
 * every consumer takes the one it understands.
 *
 * `minimal-ui` IS THE INTENT AND `"standalone"` IS THE FALLBACK — read both
 * lines below before concluding the code contradicts this, because the field
 * literally spelled `display` is the one that says `standalone`.
 *
 * The intent is about what the site IS. Optfall's thesis is that every view is
 * a URL — 12,776 of them, each meant to be pasted. `standalone` removes the
 * address bar, which removes the affordance the product is built around.
 * `minimal-ui` keeps a way to see and copy the URL while still installing to a
 * home screen.
 *
 * **AND IT IS DECLARED THROUGH `display_override`, BECAUSE ON WebKit
 * `minimal-ui` DOES NOT DEGRADE — IT FALLS OUT OF THE APP ENTIRELY.** The
 * manifest spec's fallback chain runs `minimal-ui` → `browser`, and WebKit
 * supports only `standalone` and `browser`, so a bare `display: "minimal-ui"`
 * means an iOS home-screen icon that opens **in Safari**: a bookmark wearing an
 * app's clothes, which is the exact opposite of the thing being asked for.
 *
 * `display_override: ["minimal-ui"]` with `display: "standalone"` is how both
 * halves survive. A browser that honours the override gets `minimal-ui` and the
 * URL bar the product is built around; one that does not skips an unsupported
 * value and reads `display`, so iOS gets a real standalone launch instead of a
 * browser tab. The address bar is lost on iOS, and that is a genuine cost rather
 * than a free win — it is accepted because the alternative on that platform is
 * not "an install with a URL bar", it is not being installed at all.
 *
 * `start_url` IS `/`, AND IT WAS `/search` UNTIL THE COST WAS MEASURED. The
 * argument for `/search` was about routing — the front door exists to send
 * somebody who arrived from elsewhere to a card, and a reader who installed the
 * app has already arrived. That argument is real and it loses to a number:
 * `/search` embeds the full operator index and is **245 kB gzipped**, against
 * **47 kB** for the door, and the start_url is the one document precached for
 * every visitor whether they ever install or not.
 *
 * The door is also the better cold start on its own terms. It carries the
 * typeahead, which is what somebody who has just tapped an app icon wants — a
 * name in, a card page out — while `/search` is the surface for a query with
 * operators in it. Five times the bytes to skip one hop is the wrong trade.
 */
function manifest(): string {
  const dark = themes.dark.tokens;

  return `${JSON.stringify(
    {
      name: "Optfall — Flesh and Blood card search",
      short_name: "Optfall",
      description:
        "Search every Flesh and Blood card. Every card has a permanent, citable URL with its printed text, its printings and its per-format legality.",
      id: "/",
      start_url: "/",
      scope: "/",
      /* Read by whoever honours it; skipped as unsupported by whoever does not,
         who then reads `display` below. See the note above this function. */
      display_override: ["minimal-ui"],
      display: "standalone",
      /* The chrome the platform paints around the app, and the colour behind
         the page before the first paint. Both are the ground rather than the
         accent: this is furniture, and the accent is rationed. */
      theme_color: literal(dark, "color.ground"),
      background_color: literal(dark, "color.ground"),
      /*
       * TWO ENTRIES, NOT ONE WITH TWO PURPOSES. A single
       * `purpose: "any maskable"` icon is the padded artwork, and it is then
       * ALSO what every non-maskable surface renders — Chrome's install dialog,
       * the task switcher, a bookmark tile — where nothing crops it and the mark
       * sits at roughly 64% linear size inside empty ground, looking like a
       * mistake.
       *
       * The padding exists FOR the maskable case, so it is scoped to it. `any`
       * gets the mark at full bleed; `maskable` gets it inset to the safe zone.
       */
      icons: [
        {
          src: "/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any",
        },
        {
          src: "/icon-maskable.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "maskable",
        },
        /*
         * THE RASTER HALF, FOR EVERY CONSUMER THAT CANNOT READ A VECTOR. 192 and
         * 512 are not arbitrary and not a pair of round numbers: they are the
         * two sizes the install checks of every major engine are written against,
         * and a manifest that names one without the other still trips diagnostics
         * that look for both.
         */
        {
          src: "/icon-192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "/icon-maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

/**
 * `/sw-purge.js` — imported by the service worker, and the thing that makes the
 * page cache safe to have at all.
 *
 * **THE PROBLEM IT CLOSES.** Every asset this site serves is content-hashed and
 * Asset deploys are atomic, so a stored HTML document stops being renderable
 * the moment a new deploy lands: it links `/assets/*-<oldhash>.css`, which is
 * gone from the origin AND absent from the refreshed precache. A page served
 * from `pages` after a deploy paints unstyled with no islands.
 *
 * `NetworkFirst` was chosen to avoid exactly that, and it does — right up until
 * it falls back to the cache, which is precisely what it is designed to do when
 * the network is slow or absent. So the handler cannot fix this on its own: the
 * stale entry has to stop existing.
 *
 * **A NEW WORKER ACTIVATING IS THE DEPLOY SIGNAL.** The precache manifest is
 * part of `sw.js`, so any deploy that changes any hashed asset produces a
 * different worker, which installs and activates. Dropping the page cache there
 * removes every document that predates the running deploy.
 *
 * **IT NARROWS THE WINDOW RATHER THAN CLOSING IT, and the difference is worth
 * being accurate about.** The purge fires on *activate*, and until then the OLD
 * worker is still in control — the update check and a full precache install have
 * to finish first, which on a slow network is exactly the case that is slow, and
 * on lie-fi may not finish at all. So a reader on a bad connection immediately
 * after a deploy can still be served pre-deploy HTML. What the purge guarantees
 * is that this cannot persist: once the new worker takes over, the stale entries
 * are gone.
 *
 * The cost is honest and small: after a deploy, a reader who is offline has lost
 * the pages they had stored. Those pages could not have rendered anyway, so what
 * is lost is a blank screen.
 *
 * **THE EXPIRATION METADATA IS A KNOWN, ACCEPTED LOOSE END.** `ExpirationPlugin`
 * keeps its timestamps in IndexedDB rather than in the `Cache`, and
 * `caches.delete()` does not touch them — Workbox's own note on
 * `deleteCacheAndMetadata` says a bare `caches.delete()` suffices only when
 * expiration is not in use, and here it is. So after a purge the
 * `maxEntries: 200` budget still holds records for pages that no longer exist,
 * and each newly cached page evicts a phantom instead of adding to the count:
 * the cache carries fewer than 200 real pages until they drain, one per
 * navigation.
 *
 * **It self-heals and corrupts nothing** — the phantoms are the oldest records,
 * so they are always the ones evicted first and a real entry is never lost
 * early.
 *
 * A previous version of this file deleted the whole `workbox-expiration`
 * database here, and it is worth recording why that came out rather than
 * leaving the impression it was never tried. Three reasons, in order:
 *
 * - **It is scoped to the ORIGIN, not to this cache.** Workbox keeps every
 *   expiring cache's records in one database and one `cache-entries` store. It
 *   is inert while `pages` is the only expiring route, and the day a second one
 *   is added it would silently wipe that cache's timestamps on every activate —
 *   and an entry with no record is invisible to `expireEntries`, so it becomes
 *   an orphan that neither `maxEntries` nor `maxAgeSeconds` can ever evict. A
 *   fix whose failure mode is worse than the problem is not a fix.
 * - **Its failure modes are asynchronous and were unhandled.** `deleteDatabase`
 *   returns a request; a `try`/`catch` catches only a synchronous throw. The
 *   blocked case is the EXPECTED one here, because the redundant worker holds
 *   its connection open until it terminates — so the delete could simply never
 *   complete while the comment claimed the loose end was closed.
 * - **This file is uniquely dangerous.** `importScripts` runs inside install,
 *   and anything that throws here means no worker installs at all. It should
 *   carry the minimum that is certainly correct, and nothing else.
 *
 * The accounting quirk is the cheaper of the two problems, so it is the one that
 * stays.
 *
 * IT IS A SEPARATE FILE BECAUSE `generateSW` HAS NO ACTIVATE HOOK. Workbox
 * generates the worker; `importScripts` is the supported way to add behaviour to
 * one, short of switching to `injectManifest` and hand-writing the whole worker
 * for the sake of one listener.
 */
function serviceWorkerPurge(): string {
  return `self.addEventListener("activate", function (event) {
  event.waitUntil(caches.delete("pages"));
});
`;
}

/**
 * THE REGISTRY IS A FUNCTION, NOT A CONST, AND THE REASON IS WHO IMPORTS THIS
 * FILE. Rasterising is IO and there is no synchronous sharp, so the array
 * cannot be built at module scope without a top-level `await` — and a top-level
 * `await` here is paid by every importer, not just the build.
 *
 * The importer that makes this concrete is `THEME_COLOUR`, exported at the top
 * of this file and read by `document.tsx` for one `<meta>` tag. `ssg.test.ts`
 * imports `document.tsx`, so an eager version means `bun test` loads a native
 * module and renders four PNGs in order to ask WHAT COLOUR THE TAB IS — and the
 * suite acquires a dependency on sharp's platform binary, which is a real thing
 * to break on a machine the build itself would work on.
 *
 * `build.ts` already states this exact principle for `_redirects`, in almost
 * these words. Deferring the work behind a call is what keeps the statement
 * true of this file too. Everything else about the argument here — an explicit
 * list rather than a directory convention, because a convention is what
 * silently produces nothing when it is not followed — is unchanged.
 */
export async function generatedAssets(): Promise<readonly GeneratedAsset[]> {
  return [
    { path: "favicon.svg", contents: faviconSvg() },
    /* Full bleed: nothing crops this one. */
    { path: "icon.svg", contents: iconSvg(1) },
    /* Inset to the centre 80%, which is all a maskable crop is guaranteed. */
    { path: "icon-maskable.svg", contents: iconSvg(0.8) },
    /* The same two insets, rasterised, for the engines that cannot read a vector. */
    { path: "icon-192.png", contents: await iconPng(1, 192) },
    { path: "icon-512.png", contents: await iconPng(1, 512) },
    { path: "icon-maskable-512.png", contents: await iconPng(0.8, 512) },
    /*
     * `/apple-touch-icon.png` — 180 px, FULL BLEED, AND NOT NAMED BY THE MANIFEST.
     *
     * It is a `<link>` in `document.tsx`, because that is the only channel iOS
     * reads for this: the manifest's `icons` are ignored for the home-screen
     * icon on older iOS and overridden by this element on newer.
     *
     * FULL BLEED RATHER THAN THE MASKABLE INSET, which looks like the wrong
     * choice next to the maskable entry above and is not. iOS does not mask to a
     * circle — it rounds the corners of a square — so the safe-zone padding that
     * a maskable crop needs would only render the mark small inside empty ground.
     * The corner radius takes corners, and the mark is a wide ring across the
     * middle, so nothing of it is inside the rounded-off region.
     */
    { path: "apple-touch-icon.png", contents: await iconPng(1, 180) },
    { path: "manifest.webmanifest", contents: manifest() },
    { path: "sw-purge.js", contents: serviceWorkerPurge() },
  ];
}
