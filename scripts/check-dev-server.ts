#!/usr/bin/env bun
/**
 * Asserts `bun run dev` actually serves the site.
 *
 * THIS EXISTS BECAUSE A GREEN BUILD IS NOT EVIDENCE THAT DEV RUNS, and for a
 * while it was not even weak evidence. `astro build` resolved SSR modules
 * through Rollup; `astro dev` handed anything it considered external to the
 * runtime's own ESM loader. Those are different resolvers with different rules,
 * so the two could — and did — disagree completely: the build emitted 7,237
 * correct pages while every single dev route answered 500, including
 * `/favicon.svg`. Nothing in CI was looking, because nothing in CI had ever
 * started the dev server.
 *
 * WHAT PHASE 6 CHANGED, STATED PLAINLY RATHER THAN LEFT AS AN IMPLICATION. The
 * two-resolver asymmetry is gone: `bun run dev` builds with the generator and
 * then serves the files it wrote, so there is exactly one renderer and exactly
 * one resolver. The specific bug this file was written for cannot recur, and
 * pretending otherwise would make the check look stronger than it is.
 *
 * IT IS STILL WORTH RUNNING, for three failures that are all live:
 *
 * - **The server does not start.** A `dev` script wired to the wrong command,
 *   or a `serve.ts` that throws on a taken port, is invisible to every other
 *   job here.
 * - **The route-to-file mapping disagrees with the generator's.** The server
 *   resolves `/search` to `search/index.html` through the same `outputPathFor`
 *   the build writes with, and this is what proves the two agree — including
 *   for the multi-segment printing routes, which are the shape most likely to
 *   be got wrong.
 * - **A generated non-page file goes missing.** This is not hypothetical
 *   either: `document.tsx` linked `/favicon.svg` on all 12,776 pages for four
 *   layers of the port while nothing emitted it, because a favicon is not a
 *   page and page-count parity could not see it.
 *
 * IT SPAWNS THE SCRIPT RATHER THAN IMPORTING THE SERVER, and that is the whole
 * correctness of the check rather than a style preference — the thing under
 * test is the command a person actually types, including the package script
 * that wires it. An in-process check would exercise a path no developer and no
 * CI job ever uses.
 *
 * KEEP THIS CHECK CHEAP. It is a smoke test, not a page audit — it asserts that
 * routes are served at all, which is exactly the class of failure that survives
 * a green build. Assertions about what is *in* the HTML belong in
 * `check-built-tokens.ts` and its neighbours, which read the real build output.
 */

/*
 * EVERY LOOP IN THIS FILE IS SEQUENTIAL ON PURPOSE, so the rule's advice —
 * collect the promises and `Promise.all` them — is wrong here in both places it
 * fires. The polling loop is waiting for a server to come up: its whole job is
 * to check, sleep, and check again, and there is no set of promises to collect
 * because each iteration only exists if the previous one failed. The route loop
 * is deliberately serial too: it reports one line per route in a fixed order.
 */

/*
 * THE SAME LIST THE ROUTES THEMSELVES USE. Taking the slugs from `CARD_ROUTES`
 * rather than naming a card here means an errata that renames or removes a card
 * can never turn this check red on its own — the corpus and the check cannot
 * disagree when there is only one of them.
 */
import { CARD_ROUTES } from "../apps/site/src/lib/cards";

/**
 * A port far from the 4321 default, so a developer running the real dev server
 * while this executes does not collide with it.
 *
 * IF IT IS TAKEN, `serve.ts` THROWS RATHER THAN MOVING, and that is the better
 * behaviour for a check: Astro used to slide to a free port, which meant this
 * file had to parse the banner to discover where the server had actually
 * landed, and an earlier draft of it ran all six routes against a server
 * started from a different checkout entirely.
 */
const PORT = 4399;

/**
 * Generous, because `dev` BUILDS before it serves — 12,776 pages plus a Vite
 * bundle, on a cold CI runner. The old value was 120s and covered a dev server
 * that rendered nothing up front.
 */
const STARTUP_TIMEOUT_MS = 420_000;

interface Check {
  path: string;
  /** Asserted with `startsWith`, so `; charset=utf-8` does not fail a match. */
  contentType?: string;
  /** Expected status. Defaults to 200. */
  status?: number;
  /** Expected `Location` header, for a redirect. */
  location?: string;
}

/*
 * ONE DEFAULT PRINTING AND ONE ALTERNATE, BECAUSE THEY ARE DIFFERENT FACTS.
 *
 * Every card URL is `/card/<set>/<number>/<slug>` — three segments, always —
 * so the old "one segment versus three" asymmetry is gone. What replaced it is
 * that the default printing is where every link and every redirect LANDS, while
 * an alternate is a route nothing points at but a reader's address bar. A check
 * that only covered one of them would leave the other free to stop resolving.
 */
const defaultRoute = CARD_ROUTES.find((route) => route.isDefault);
const alternateRoute = CARD_ROUTES.find((route) => !route.isDefault);

if (!defaultRoute || !alternateRoute) {
  console.log(
    "::error::CARD_ROUTES has no default and/or no alternate printing route, so the card paths are unchecked. That is a broken corpus, not a reason to skip.",
  );
  process.exit(1);
}

/*
 * A REDIRECT IS A ROUTE THE SITE OWNS, AND NOTHING WAS CHECKING ONE.
 *
 * The emitted table is 12,278 exact rules, and they reach the reader
 * through a mechanism no other check here touches: a `_redirects` file written
 * by the build and read back by the server. Emitting it, parsing it and acting
 * on it are three separate things that can each silently stop happening, and
 * the failure is invisible — the site still serves every page it knows about,
 * and only the links people already pasted are dead.
 *
 * The old CARD address is the one asserted, because it is the one 4,941 of
 * those rules are for and because its target is knowable here.
 */
const legacyCardPath = `/card/${defaultRoute.slug}`;

const checks: Check[] = [
  { path: "/", contentType: "text/html" },
  { path: "/search", contentType: "text/html" },
  { path: "/sets", contentType: "text/html" },
  { path: "/cr", contentType: "text/html" },
  /*
   * The reason this entry survives the rewrite. The favicon is DERIVED — from
   * the mark geometry and the theme's token tables — rather than checked into
   * `public/`, which is the right call and also means it is code: it can break
   * exactly like a page can, it did, and it went unnoticed for four layers
   * because nothing counts a file that is not a page.
   */
  { path: "/favicon.svg", contentType: "image/svg+xml" },
  /* A file from `public/`, which reaches the output by a third mechanism again
     — Vite copies it — and would be missing in silence if that ever stopped. */
  { path: "/symbols/icon_p.png", contentType: "image/png" },
  /*
   * THE PWA SURFACE, which is a fourth mechanism: the manifest and the install
   * icon are derived like the favicon, and `sw.js` is written by Workbox after
   * everything else exists. Every page links the manifest and registers the
   * worker, so a missing one of these is 12,776 pages pointing at nothing.
   */
  { path: "/manifest.webmanifest", contentType: "application/manifest+json" },
  { path: "/icon.svg", contentType: "image/svg+xml" },
  /* BOTH ICONS. The manifest names two — full bleed and maskable — and a check
     that covers one of them leaves the other free to stop being emitted. */
  { path: "/icon-maskable.svg", contentType: "image/svg+xml" },
  { path: "/sw.js", contentType: "text/javascript" },
  /* The worker `importScripts` this at startup, so a worker that registers and a
     worker that WORKS are different facts if this file stops being emitted. */
  { path: "/sw-purge.js", contentType: "text/javascript" },
  { path: defaultRoute.href, contentType: "text/html" },
  { path: alternateRoute.href, contentType: "text/html" },
  { path: legacyCardPath, status: 301, location: defaultRoute.href },
];

/*
 * `bun run … dev` rather than the server script directly, so the thing under
 * test includes the package script itself — a `dev` script wired to the wrong
 * command is exactly the kind of breakage this is here to catch.
 */
const server = Bun.spawn(
  ["bun", "run", "--cwd", "apps/site", "dev", "--port", String(PORT)],
  { stdout: "pipe", stderr: "pipe" },
);

/** Everything the server has said, kept so a startup failure can be reported. */
let transcript = "";

/**
 * Reads both streams into `transcript` forever. Not awaited: it finishes when
 * the server's pipes close, which is at teardown.
 */
async function drain(stream: ReadableStream<Uint8Array>): Promise<void> {
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    transcript += decoder.decode(chunk, { stream: true });
  }
}

void drain(server.stdout);
void drain(server.stderr);

const origin = `http://localhost:${PORT}`;

/**
 * Waits for the server to answer, or gives up with everything it said.
 *
 * POLLED BY REQUEST RATHER THAN BY BANNER. The old version parsed Astro's
 * colourised startup banner to learn the origin, which meant stripping ANSI
 * escapes and matching on human-facing text that a version bump could reword.
 * The port is an input here, so the only question is whether anything is
 * listening on it — and asking is both simpler and a stronger answer than a
 * line of output claiming it is.
 */
async function waitForServer(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      console.log(
        `::error::\`bun run dev\` exited with code ${server.exitCode} before serving anything.`,
      );
      console.log(transcript.trim());
      process.exit(1);
    }

    try {
      await fetch(origin, { signal: AbortSignal.timeout(5_000) });
      return;
    } catch {
      await Bun.sleep(500);
    }
  }

  console.log(
    `::error::\`bun run dev\` did not serve anything on ${origin} within ${STARTUP_TIMEOUT_MS / 1000}s.`,
  );
  console.log(transcript.trim());
  server.kill();
  process.exit(1);
}

await waitForServer();

let failed = false;

for (const check of checks) {
  const { path, contentType } = check;
  const expectedStatus = check.status ?? 200;
  let status = 0;
  let type = "";
  let location: string | null = null;

  try {
    const response = await fetch(`${origin}${path}`, {
      signal: AbortSignal.timeout(30_000),
      /* MANUAL, OR A 301 CHECK CHECKS NOTHING. `fetch` follows redirects by
         default and reports the FINAL response, so a rule pointing anywhere
         that happens to serve HTML would pass while sending readers to the
         wrong card. */
      redirect: "manual",
    });
    status = response.status;
    type = response.headers.get("content-type") ?? "";
    location = response.headers.get("location");
    // Drained so the connection is not left open across the next iteration.
    await response.arrayBuffer();
  } catch (error) {
    console.log(`::error::${path} — request failed: ${String(error)}`);
    failed = true;
    continue;
  }

  if (status !== expectedStatus) {
    console.log(`::error::${path} — expected ${expectedStatus}, got ${status}`);
    failed = true;
    continue;
  }

  if (check.location !== undefined && location !== check.location) {
    console.log(
      `::error::${path} — expected a redirect to ${check.location}, got ${location ?? "no Location header"}`,
    );
    failed = true;
    continue;
  }

  if (contentType !== undefined && !type.startsWith(contentType)) {
    console.log(
      `::error::${path} — expected ${contentType}, got ${type || "no content-type"}`,
    );
    failed = true;
    continue;
  }

  console.log(`  ${path} → ${status} ${location ?? type}`);
}

server.kill();

if (failed) {
  console.log("\nThe dev server did not serve every route. Its output:\n");
  console.log(transcript.trim());
  process.exit(1);
}

console.log(
  `\n\`bun run dev\` serves all ${checks.length} routes, including every generated non-page file. ✔`,
);
