#!/usr/bin/env bun
/**
 * Serves the built site. `bun ssg/serve.ts [--port 4321]`.
 *
 * THIS IS WHAT REPLACED `astro dev`, and it is deliberately less than what it
 * replaced: no HMR, no on-demand rendering, no watcher. It serves `dist/`.
 *
 * That is not a downgrade dressed up as a decision — it is the whole point of
 * the generator. `astro dev` existed because Astro rendered pages on request
 * through a *different module resolver* than `astro build` used, so there was a
 * dev-time renderer to run and a dev-time renderer to get wrong. It did get it
 * wrong: the build emitted 7,237 correct pages while every dev route answered
 * 500, and `scripts/check-dev-server.ts` exists because nothing noticed. There
 * is no second resolver here. `bun ssg/build.ts` imports the page modules as
 * TypeScript and renders them, and this serves the bytes that produced. The
 * class of bug that check was written for cannot occur, and the check now
 * asserts the weaker, true thing: that `bun run dev` serves the site.
 *
 * THE HOST MATTERS MORE THAN IT LOOKS. Netlify resolves `/search` to
 * `search/index.html`, serves `404.html` for a miss, and does not care about a
 * trailing slash. A plain file server does none of that, so a local check would
 * pass on paths production redirects and fail on paths production serves. The
 * resolution order below is written to match the host, and it is the same
 * mapping `outputPathFor` writes with — read from the same module rather than
 * restated, because two spellings of one rule is how they drift.
 */

import { join, normalize } from "node:path";

import { outputPathFor } from "./outputPath";
import { matchRedirect, parseRedirects, type RedirectRule } from "./redirects";

const ROOT = new URL("../dist/", import.meta.url).pathname;

const portArg = process.argv.indexOf("--port");
const PORT =
  portArg === -1 ? 4321 : Number.parseInt(process.argv[portArg + 1] ?? "", 10);

if (Number.isNaN(PORT)) {
  throw new Error("--port needs a number");
}

/**
 * The file a request path maps to, or `undefined` if it escapes the root.
 *
 * THE TRAVERSAL GUARD IS NOT THEATRE even though this only ever binds
 * localhost: `decodeURIComponent` turns `%2e%2e%2f` back into `../`, and a dev
 * server that will hand out `~/.ssh/id_rsa` to a page in a browser tab is a
 * real thing to avoid on a machine that has one.
 */
function fileFor(pathname: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }

  /*
   * A request with an extension is asking for that exact file — `/favicon.svg`,
   * `/assets/tokens.css`, `/symbols/icon_p.png`. Anything else is a route, and
   * routes map through `outputPathFor` so this server and the generator cannot
   * disagree about where a page lives.
   */
  const relative = /\.[a-z0-9]+$/i.test(decoded)
    ? decoded.replace(/^\/+/, "")
    : outputPathFor(decoded);

  const resolved = normalize(join(ROOT, relative));
  return resolved.startsWith(ROOT) ? resolved : undefined;
}

/**
 * The generated redirect table, read from the artefact the build wrote.
 *
 * READ ONCE, AT STARTUP, rather than per request: it is 5,842 rules and the
 * server is long-lived. A rebuild while the server is up therefore serves the
 * previous table — acceptable, and the same restart this server already needs
 * to pick up new pages.
 *
 * ABSENT IS NOT AN ERROR. `dist/` may not have been built yet, and a dev server
 * that refuses to start because a file it only needs for 301s is missing is a
 * worse failure than one that 404s a redirect.
 */
const REDIRECTS: readonly RedirectRule[] = await (async () => {
  const file = Bun.file(join(ROOT, "_redirects"));
  return (await file.exists()) ? parseRedirects(await file.text()) : [];
})();

Bun.serve({
  port: PORT,
  async fetch(request) {
    const { pathname } = new URL(request.url);

    const path = fileFor(pathname);
    if (path !== undefined) {
      const file = Bun.file(path);
      if (await file.exists()) return new Response(file);
    }

    /*
     * THE FILE WINS, AND ONLY THEN THE TABLE — which is Netlify's own order for
     * an unforced rule, and it is not a detail. Both the old printing form and
     * the new one are three segments under `/card/`, so the permutation rule
     * matches a LIVE page as readily as a moved one. A server that consulted
     * the table first would 301 every alternate-art URL to a path that does not
     * exist, locally, while production served it.
     */
    const target = matchRedirect(REDIRECTS, pathname);
    if (target !== undefined) {
      return new Response(null, {
        status: 301,
        headers: { Location: target },
      });
    }

    /*
     * The host's own miss behaviour, so a 404 looks here like it looks in
     * production rather than like a bare string. If the build has not emitted
     * one yet, say that plainly instead of serving an empty 404 that reads like
     * a routing bug.
     */
    const notFound = Bun.file(join(ROOT, "404.html"));
    if (await notFound.exists()) {
      return new Response(notFound, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return new Response(`Not found: ${pathname}\n`, { status: 404 });
  },
});

console.log(`[ssg] serving dist/ on http://localhost:${PORT}`);
