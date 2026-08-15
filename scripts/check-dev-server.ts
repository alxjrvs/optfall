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
 *   either: `document.tsx` linked `/favicon.svg` on all 13,675 pages for four
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
 * Generous, because `dev` BUILDS before it serves — 13,675 pages plus a Vite
 * bundle, on a cold CI runner. The old value was 120s and covered a dev server
 * that rendered nothing up front.
 */
const STARTUP_TIMEOUT_MS = 420_000;

interface Check {
  path: string;
  /** Asserted with `startsWith`, so `; charset=utf-8` does not fail a match. */
  contentType: string;
}

const slug = CARD_ROUTES[0]?.slug;

if (!slug) {
  console.log(
    "::error::CARD_ROUTES is empty, so there is no card route to check. That is a broken corpus, not a reason to skip.",
  );
  process.exit(1);
}

/*
 * A PRINTING ROUTE TOO, BECAUSE IT IS A DIFFERENT SHAPE OF ROUTE.
 *
 * `/card/<slug>` is one path segment; a printing is three. "A multi-segment
 * path resolves to the right file" is exactly the kind of assumption that holds
 * in the generator's own output map and fails in whatever serves it, which is
 * the asymmetry this file now exists to catch.
 */
const printingSlug = CARD_ROUTES.find(
  (route) => route.kind === "printing",
)?.slug;

if (!printingSlug) {
  console.log(
    "::error::No printing route exists, so the multi-segment card path is unchecked. See PRINTING_ROUTES in cards.ts.",
  );
  process.exit(1);
}

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
   * worker, so a missing one of these is 13,675 pages pointing at nothing.
   */
  { path: "/manifest.webmanifest", contentType: "application/manifest+json" },
  { path: "/icon.svg", contentType: "image/svg+xml" },
  { path: "/sw.js", contentType: "text/javascript" },
  { path: `/card/${slug}`, contentType: "text/html" },
  { path: `/card/${printingSlug}`, contentType: "text/html" },
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

for (const { path, contentType } of checks) {
  let status = 0;
  let type = "";

  try {
    const response = await fetch(`${origin}${path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    status = response.status;
    type = response.headers.get("content-type") ?? "";
    // Drained so the connection is not left open across the next iteration.
    await response.arrayBuffer();
  } catch (error) {
    console.log(`::error::${path} — request failed: ${String(error)}`);
    failed = true;
    continue;
  }

  if (status !== 200) {
    console.log(`::error::${path} — expected 200, got ${status}`);
    failed = true;
    continue;
  }

  if (!type.startsWith(contentType)) {
    console.log(
      `::error::${path} — expected ${contentType}, got ${type || "no content-type"}`,
    );
    failed = true;
    continue;
  }

  console.log(`  ${path} → ${status} ${type}`);
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
