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
 *   job here. Both are only visible if the check is measuring ITS OWN server,
 *   which is `assertPortFree` and `READY_LINE` below and was for a while not
 *   true — a neighbouring worktree holding the port answered in its place.
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
import { serveReadyLine } from "../apps/site/ssg/serveBanner";

/**
 * A port far from the 4321 default, so a developer running the real dev server
 * while this executes does not collide with it.
 *
 * IF IT IS TAKEN, `serve.ts` THROWS RATHER THAN MOVING, and that is the better
 * behaviour for a check: Astro used to slide to a free port, which meant this
 * file had to parse the banner to discover where the server had actually
 * landed, and an earlier draft of it ran all six routes against a server
 * started from a different checkout entirely.
 *
 * THAT GUARANTEE WAS LOAD-BEARING AND, FOR A WHILE, NOT ACTUALLY REACHED — see
 * `assertPortFree` and `READY_LINE` below, which are what make the paragraph
 * above true rather than merely intended.
 */
const PORT = 4399;

/**
 * Generous, because `dev` BUILDS before it serves — 12,776 pages plus a Vite
 * bundle, on a cold CI runner. The old value was 120s and covered a dev server
 * that rendered nothing up front.
 */
const STARTUP_TIMEOUT_MS = 420_000;

/**
 * How long to wait for the port to come back after killing the server.
 *
 * Short, because this is a socket closing rather than work finishing: if it has
 * not happened in five seconds it is not going to, and the warning is more
 * useful than the wait.
 */
const SHUTDOWN_TIMEOUT_MS = 5_000;

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
  /* EVERY ICON THE MANIFEST NAMES. The manifest names five — full bleed and
     maskable, as a vector and again rasterised — and a check that covers one of
     them leaves the others free to stop being emitted. */
  { path: "/icon-maskable.svg", contentType: "image/svg+xml" },
  /*
   * THE RASTER SET IS CHECKED FOR THE SAME REASON THE FAVICON IS: it is derived
   * rather than committed, so it is code and can break like code — an edited
   * registry, a renamed path, an `iconPng` call that stops being awaited.
   *
   * IT IS NOT HERE TO CATCH A FAILED RASTERISER, which is the tempting thing to
   * claim and is not true: `assets.ts` calls sharp while the build is deriving
   * this list, so a native module that will not load throws before a single page
   * is written. That failure is loud, and a check that runs after a successful
   * build is not what would surface it.
   */
  { path: "/icon-192.png", contentType: "image/png" },
  { path: "/icon-512.png", contentType: "image/png" },
  { path: "/icon-maskable-512.png", contentType: "image/png" },
  /* Linked by `document.tsx` rather than named by the manifest, which is the
     one icon channel iOS actually reads. Same silence if it stops being emitted:
     an install whose icon is a screenshot of the page. */
  { path: "/apple-touch-icon.png", contentType: "image/png" },
  { path: "/sw.js", contentType: "text/javascript" },
  /* The worker `importScripts` this at startup, so a worker that registers and a
     worker that WORKS are different facts if this file stops being emitted. */
  { path: "/sw-purge.js", contentType: "text/javascript" },
  { path: defaultRoute.href, contentType: "text/html" },
  { path: alternateRoute.href, contentType: "text/html" },
  { path: legacyCardPath, status: 301, location: defaultRoute.href },
];

/**
 * Nothing is already listening on `PORT`, or a clear failure before anything
 * expensive runs.
 *
 * THIS IS THE HALF THE FIXED PORT WAS ASSUMED TO GIVE FOR FREE, AND DID NOT.
 * The note on `PORT` says a taken port makes `serve.ts` throw rather than move.
 * That is true, and it was never reached: `dev` BUILDS before it serves, so for
 * the minutes that build takes, this check's own child is alive and silent
 * while somebody else's server answers on this port. The readiness poll used to
 * accept that answer, and the entire run then measured a stranger — which is
 * precisely the "server started from a different checkout entirely" the note
 * warns about, arrived at by a different route.
 *
 * A PARALLEL GIT WORKTREE IS THE ORDINARY WAY THIS HAPPENS, and it is not
 * hypothetical: it reported four phantom 404s for files the build had in fact
 * emitted. THE DANGEROUS DIRECTION IS THE OTHER ONE — a neighbour serving a
 * healthy site makes every assertion below pass while this checkout is broken,
 * which is a green check that means nothing.
 *
 * Binding is the question, not `fetch`: a port can be held by something that
 * never answers, and this has to fail on that too.
 */
function assertPortFree(): void {
  try {
    Bun.serve({ port: PORT, fetch: () => new Response("") }).stop(true);
    return;
  } catch (error) {
    /*
     * ONLY "IN USE" IS REPORTED AS "IN USE". A bare catch here read every
     * failure to bind as a collision and printed instructions — go find the
     * other server and stop it — that cannot fix a sandbox with no listening
     * sockets, or whatever `Bun.serve` starts throwing next. An error that
     * names the wrong cause confidently is worse than one that admits it does
     * not know, so anything unrecognised is re-thrown with its own message.
     */
    if ((error as { code?: string }).code !== "EADDRINUSE") throw error;

    console.log(
      `::error::Port ${PORT} is already in use, so this check cannot tell its own dev server from somebody else's. ` +
        `Two usual causes: a parallel git worktree running \`bun run dev\` or \`check:dev-server\`, or a server ORPHANED ` +
        `by a previous run of this check that outlived it. Stop it and re-run. ` +
        `Do NOT work around this by moving the port — it is fixed on purpose, see the note on PORT.`,
    );
    process.exit(1);
  }
}

assertPortFree();

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
 * The one line `ssg/serve.ts` prints once it has bound.
 *
 * IT CARRIES THE PORT, so a dev server this check did not start — on another
 * port, in another worktree — cannot satisfy it.
 *
 * IMPORTED RATHER THAN RESTATED, because this check cannot tell a renamed
 * banner from a dead server: both look like seven minutes of silence followed
 * by an error blaming `bun run dev`. `ssg/serveBanner.ts` carries the argument.
 */
const READY_LINE = serveReadyLine(PORT);

/**
 * Stops the server and waits for the port to come back, or says why it has
 * not.
 *
 * `server.kill()` SIGNALS THE WRAPPER, NOT THE SERVER. The thing spawned is
 * `bun run … dev`, and `dev` is the compound `bun ssg/build.ts && bun
 * ssg/serve.ts` — so the process holding the socket is a GRANDCHILD, and a
 * signal delivered to its parent is not guaranteed to reach it.
 *
 * WITHOUT THIS THE CHECK POISONS ITS OWN NEXT RUN, and does so with a lie.
 * `assertPortFree` turned a surviving grandchild from a stray process nobody
 * noticed into a hard failure — one that reports a port collision and blames a
 * parallel worktree, when the process holding the port is this check's own
 * orphan from a minute ago. Waiting for the release is what keeps that message
 * honest.
 *
 * IT REPORTS RATHER THAN ESCALATES when the port does not come back. Killing a
 * process group would reach the grandchild and would also reach anything else
 * sharing that group, which on a developer's machine is their shell. A check is
 * not entitled to that, so the honest move is to say plainly that the port is
 * still held and let the next run's preflight name it too.
 *
 * AND THE WARNING ASSERTS NEITHER HALF OF WHAT IT DOES NOT KNOW, because this
 * also runs on the path where the server exited on its own without ever
 * binding. Two things are unknown there and both were once stated as fact: the
 * port may be held by whatever the check lost the race to rather than by an
 * orphan of its own, AND the server may have ended by its own failure rather
 * than by the `kill` above — where `server.kill()` reached a process that was
 * already gone. So the line says the server STOPPED, which is true however it
 * ended, and offers both readings of who holds the port. Either assertion would
 * be the same confident wrong diagnosis `assertPortFree` was fixed to stop
 * making.
 */
async function shutdown(): Promise<void> {
  server.kill();

  const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      Bun.serve({ port: PORT, fetch: () => new Response("") }).stop(true);
      return;
    } catch {
      await Bun.sleep(200);
    }
  }

  console.log(
    `::warning::Port ${PORT} is still held ${SHUTDOWN_TIMEOUT_MS / 1000}s after the dev server stopped — ` +
      `either something this check started outlived it, or whatever the check was competing with still has the port. ` +
      `Either way the next run will fail its port preflight, and this line is the reason.`,
  );
}

/**
 * Waits for OUR server to answer, or gives up with everything it said.
 *
 * IT REQUIRES THE CHILD'S OWN READY LINE, NOT MERELY THAT SOMETHING ANSWERS,
 * and that distinction is what makes every assertion below an assertion about
 * this checkout. `dev` builds before it serves, so "a request to this port
 * succeeded" is satisfied by any process that happens to hold the port while
 * our build is still running, and the routes would then be measured against it.
 * `assertPortFree` makes that unlikely at startup; this makes it impossible
 * afterwards, including for a neighbour that appears mid-build.
 *
 * THIS IS NOT THE BANNER-PARSING THE OLD VERSION RIGHTLY REMOVED. That parsed
 * colourised, human-facing text from a FRAMEWORK in order to DISCOVER the
 * origin — so an ANSI change or a reworded line moved the target. The port is
 * still an input here; the line belongs to a script in this repository; and it
 * is used as proof of IDENTITY, never as a source of configuration.
 *
 * THE REQUEST POLL STAYS, after the line rather than instead of it, because a
 * line claiming a bind and a socket that answers are two different facts and
 * this check wants both.
 */
async function waitForServer(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      console.log(
        `::error::\`bun run dev\` exited with code ${server.exitCode} before serving anything.`,
      );
      console.log(transcript.trim());
      /*
       * THROUGH `shutdown` LIKE EVERY OTHER EXIT, and this path needs it most.
       * The wrapper is ALREADY GONE here — that is what `exitCode` means — so it
       * is the one case where a surviving grandchild is not hypothetical, and it
       * was the one exit that neither waited for the port nor named the orphan.
       * When the port is already free the probe costs nothing.
       */
      await shutdown();
      process.exit(1);
    }

    if (transcript.includes(READY_LINE)) {
      try {
        await fetch(origin, { signal: AbortSignal.timeout(5_000) });
        return;
      } catch {
        /* Announced a bind and not answering yet. Retry rather than fail: the
           only way out of this branch is the deadline below. */
      }
    }

    await Bun.sleep(500);
  }

  console.log(
    `::error::\`bun run dev\` did not announce "${READY_LINE}" and answer on it within ${STARTUP_TIMEOUT_MS / 1000}s.`,
  );
  console.log(transcript.trim());
  await shutdown();
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

await shutdown();

if (failed) {
  console.log("\nThe dev server did not serve every route. Its output:\n");
  console.log(transcript.trim());
  process.exit(1);
}

console.log(
  `\n\`bun run dev\` serves all ${checks.length} routes, including every generated non-page file. ✔`,
);
