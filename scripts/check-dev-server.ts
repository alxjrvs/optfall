#!/usr/bin/env bun
/**
 * Asserts `bun run dev` actually serves the site.
 *
 * THIS EXISTS BECAUSE A GREEN BUILD IS NOT EVIDENCE THAT DEV RUNS, and for a
 * while it was not even weak evidence. `astro build` resolves SSR modules
 * through Rollup; `astro dev` hands anything it considers external to the
 * runtime's own ESM loader. Those are different resolvers with different rules,
 * so the two can — and did — disagree completely: the build emitted 7,237
 * correct pages while every single dev route answered 500, including
 * `/favicon.svg`. Nothing in CI was looking, because nothing in CI had ever
 * started the dev server.
 *
 * The specific fault is written up in `apps/site/astro.config.mjs` beside the
 * `ssr.noExternal` that fixes it. What matters here is the shape of it, because
 * that is what this check is aimed at rather than the one instance: the
 * workspace packages ship TypeScript source with no build step, so anything
 * that loads them without bundler resolution fails, and it fails at *render*
 * time. A 500 on every route is as loud a failure as exists — and it was still
 * invisible, because the only thing that would have noticed was a human running
 * the dev server by hand.
 *
 * IT SPAWNS THE CLI RATHER THAN CALLING ASTRO'S `dev()` IN PROCESS, and that is
 * the whole correctness of the check rather than a style preference. The first
 * draft did import `dev()` directly, and it passed against the broken config —
 * because this script runs under Bun, and Bun's resolver fills in a missing file
 * extension that Node's does not. `bun run dev` does not run Astro under Bun: it
 * executes `node_modules/.bin/astro`, whose shebang is `node`. So an in-process
 * check exercises a resolver no developer and no CI job ever uses, and reports
 * green on a dev server that cannot start. The subprocess is the point — the
 * thing under test is the command a person actually types.
 *
 * IT IS WHY THE ROOT `package.json` CARRIES NO NEW DEPENDENCY. Spawning the CLI
 * means Astro is resolved by `apps/site`, where it is already declared, and this
 * file needs nothing but `fetch`.
 *
 * IT STARTS ITS OWN SERVER, AND FORCING THAT TAKES TWO UNOBVIOUS FLAGS.
 *
 * Astro 7 keeps a lock file so `astro dev stop|status|logs` can find a running
 * server, and a second `astro dev` attaches to that one instead of starting a
 * new one. An earlier draft of this check did exactly that: it printed "Dev
 * server already running at http://localhost:4346", then ran all six routes
 * against a server started from a *different* checkout of the config — and
 * would have killed a developer's dev server on teardown. A check that tests
 * whatever server happens to be lying around tests nothing. `--ignore-lock` is
 * what makes it start, use, and stop its own.
 *
 * `ASTRO_DEV_BACKGROUND=1` is the second flag, and it does the opposite of what
 * it reads like — it forces the FOREGROUND. Astro backgrounds itself when it
 * detects an agent environment, and it refuses `--ignore-lock` when it does,
 * because the daemon needs the lock to be findable. The detection is skipped
 * entirely when that variable is set (`!process.env.ASTRO_DEV_BACKGROUND &&
 * isRunByAgent()`), and background mode is then requested only by `--background`,
 * which this does not pass. So the variable's real effect here is "decide by the
 * flags, not by sniffing the terminal", which is what a check wants: identical
 * behaviour whether it runs in CI, in a plain shell, or under an agent.
 *
 * The port is still read from the server's own output rather than assumed,
 * because Astro moves to a free one when the requested port is taken.
 *
 * KEEP THIS CHECK CHEAP. It is a smoke test, not a page audit — it asserts that
 * routes render at all, which is exactly the class of failure that survives a
 * green build. Assertions about what is *in* the HTML belong in
 * `check-built-tokens.ts` and its neighbours, which read the real build output.
 */

/*
 * EVERY LOOP IN THIS FILE IS SEQUENTIAL ON PURPOSE, so the rule's advice —
 * collect the promises and `Promise.all` them — is wrong here in both places it
 * fires. The two polling loops are waiting for a server to come up: their whole
 * job is to check, sleep, and check again, and there is no set of promises to
 * collect because each iteration only exists if the previous one failed. The
 * route loop is deliberately serial too: it reports one line per route in a
 * fixed order, and firing six requests at a cold Vite dev server concurrently
 * trades that legibility for contention on the thing being measured.
 */
/* eslint-disable no-await-in-loop */

/*
 * THE SAME LIST THE ROUTE ITSELF USES. A dynamic route runs `getStaticPaths` on
 * demand in dev, which is a different code path from the static pages and the
 * one most likely to reach a workspace package, so the check would be
 * incomplete without one. Taking the slug from `CARD_ROUTES` rather than naming
 * a card here means an errata that renames or removes a card can never turn
 * this check red on its own — the corpus and the check cannot disagree when
 * there is only one of them.
 */
import { CARD_ROUTES } from "../apps/site/src/lib/cards";

/**
 * A port far from Astro's 4321 default, so a developer running the real dev
 * server while this executes does not collide with it. If it is taken anyway,
 * Astro moves and `readOrigin` reads where it landed.
 */
const PORT = 4399;

/** Generous, because a cold Vite optimise on a first run is not fast. */
const STARTUP_TIMEOUT_MS = 120_000;

interface Check {
  path: string;
  /** Asserted with `startsWith`, so `; charset=utf-8` does not fail a match. */
  contentType: string;
}

const slug = CARD_ROUTES[0]?.slug;

if (!slug) {
  console.log(
    "::error::CARD_ROUTES is empty, so there is no dynamic route to check. That is a broken corpus, not a reason to skip.",
  );
  process.exit(1);
}

const checks: Check[] = [
  { path: "/", contentType: "text/html" },
  { path: "/search", contentType: "text/html" },
  { path: "/sets", contentType: "text/html" },
  { path: "/cr", contentType: "text/html" },
  /*
   * The reason this file was written. The favicon is generated by an endpoint
   * rather than checked into `public/`, which is the right call and also means
   * it is code — it can break exactly like a page can, and it did.
   */
  { path: "/favicon.svg", contentType: "image/svg+xml" },
  { path: `/card/${slug}`, contentType: "text/html" },
];

/*
 * `bun run … dev` rather than the `astro` binary directly, so the thing under
 * test includes the package script itself — a `dev` script wired to the wrong
 * command is exactly the kind of breakage this is here to catch.
 */
const server = Bun.spawn(
  [
    "bun",
    "run",
    "--cwd",
    "apps/site",
    "dev",
    "--port",
    String(PORT),
    "--ignore-lock",
  ],
  {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ASTRO_DEV_BACKGROUND: "1" },
  },
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

/**
 * Astro's banner is colourised, and the escape codes sit between the label and
 * the URL. Stripping them is what lets the patterns below be written as the
 * text a human sees, and it makes the failure dump at the bottom readable too.
 */
function plain(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replaceAll(/\[[0-9;]*m/g, "");
}

/**
 * ASTRO SAYS "ALREADY RUNNING" IN TWO OPPOSITE SITUATIONS, and telling them
 * apart is the whole of this function's care.
 *
 * When `--ignore-lock` does exactly what it is asked to, Astro announces
 * `Starting a new dev server alongside the one already running at <url> (pid
 * N)` — a SUCCESS notice, and one that quotes the OTHER server's URL. So the
 * naive reading of that output is wrong twice over: a substring test for
 * "already running" aborts a run that worked, and the first
 * `http://localhost:<port>` in the transcript is somebody else's port, which
 * would send every route check at a server this script did not start and cannot
 * control. Dropping that line is what removes both mistakes at once.
 *
 * The genuine refusal is `Another astro dev server is already running.`, on the
 * path where the lock is honoured. `--ignore-lock` cannot reach it today, so
 * this is insurance rather than a live case — kept because the failure it
 * catches is silent, and the cost is one string comparison.
 */
const ATTACHED = "Another astro dev server is already running.";
const ALONGSIDE = "alongside the one already running";

/**
 * The origin the server actually bound, read from its own output — Astro moves
 * to a free port when the requested one is in use, and a check that assumed
 * `PORT` would then poll nothing and time out with a misleading message.
 */
async function readOrigin(): Promise<string> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const output = plain(transcript);

    if (output.includes(ATTACHED)) {
      throw new Error(
        "Astro attached to a dev server this check did not start, so it would be testing another process. Stop it with `bun run --cwd apps/site dev stop` and re-run",
      );
    }

    const ours = output
      .split("\n")
      .filter((line) => !line.includes(ALONGSIDE))
      .join("\n");

    const found = /http:\/\/localhost:(\d+)/.exec(ours);
    if (found) return `http://localhost:${found[1]}`;
    await Bun.sleep(200);
  }

  throw new Error(
    `the dev server printed no address within ${STARTUP_TIMEOUT_MS / 1000}s`,
  );
}

/** Polls until the server answers anything at all — even a 500 counts as up. */
async function waitUntilListening(origin: string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await fetch(origin);
      return;
    } catch {
      await Bun.sleep(200);
    }
  }

  throw new Error(
    `${origin} never accepted a connection within ${STARTUP_TIMEOUT_MS / 1000}s`,
  );
}

function stop(): void {
  /*
   * `bun run` is a PARENT of the Astro process rather than Astro itself, so
   * this is a tree to take down, not a process — and the two spellings below
   * are both attempted unconditionally rather than one falling back to the
   * other.
   *
   * The earlier version tried the process group first and only reached
   * `server.kill()` if that threw, on the reasoning that `Bun.spawn` puts a
   * child in its own group. Bun does not document that and exposes no
   * `detached` option, so it is unspecified behaviour: if the child in fact
   * shares this process's group, the group signal succeeds — it just does not
   * mean what the code assumed — nothing throws, the fallback never runs, and
   * `astro dev` is orphaned still holding the port. Trying both costs one
   * redundant signal to an already-dead process, which is free.
   */
  for (const kill of [
    () => process.kill(-server.pid, "SIGTERM"),
    () => server.kill(),
  ]) {
    try {
      kill();
    } catch {
      /* already gone, or never a group — the other spelling covers it */
    }
  }
}

let failures = 0;

try {
  const origin = await readOrigin();
  await waitUntilListening(origin);

  for (const { path, contentType } of checks) {
    let response: Response;

    try {
      response = await fetch(`${origin}${path}`);
    } catch (error) {
      console.log(
        `::error::${path} — the dev server did not answer at all (${String(error)}).`,
      );
      failures += 1;
      continue;
    }

    const actualType = response.headers.get("content-type") ?? "(none)";
    const body = await response.text();

    if (!response.ok) {
      console.log(`::error::${path} — HTTP ${response.status}.`);
      failures += 1;
      continue;
    }

    if (!actualType.startsWith(contentType)) {
      console.log(
        `::error::${path} — expected Content-Type ${contentType}, got ${actualType}.`,
      );
      failures += 1;
      continue;
    }

    if (body.trim().length === 0) {
      console.log(`::error::${path} — answered 200 with an empty body.`);
      failures += 1;
      continue;
    }

    console.log(`  ${path} — ${response.status} ${actualType}`);
  }
} catch (error) {
  console.log(`::error::The dev server never came up — ${String(error)}.`);
  failures += 1;
} finally {
  stop();
}

if (failures > 0) {
  console.log("");
  console.log("--- dev server output ---");
  /*
   * Astro's dev error page is a stub that loads the real message over a
   * websocket, so an HTTP body is worth nothing here and the server's own
   * output is the only place the cause appears.
   */
  console.log(plain(transcript).trim() || "(the server printed nothing)");
  console.log("--- end ---");
  console.log("");
  console.log(
    `${failures} of ${checks.length} dev routes failed. A passing \`bun run build\` does not`,
  );
  console.log(
    "cover this: build and dev resolve SSR modules through different resolvers. See",
  );
  console.log("the ssr.noExternal note in apps/site/astro.config.mjs.");
  process.exit(1);
}

console.log(`The dev server serves all ${checks.length} routes. ✔`);

/*
 * EXPLICIT, BECAUSE FALLING OFF THE END IS NOT ENOUGH HERE. The two `drain()`
 * promises are deliberately never awaited and stay pending until the server's
 * pipes close. If `stop()` fails to reach the Astro process — an orphan holding
 * the inherited stdout and stderr — those pipes never close, and the runtime
 * keeps the process alive on them. The script would print this success line and
 * then hang until the CI job's timeout killed it: a red job for a passing
 * check, with the verdict already on screen. Exiting says the work is finished
 * rather than leaving it to be inferred from an empty event loop.
 */
process.exit(0);
