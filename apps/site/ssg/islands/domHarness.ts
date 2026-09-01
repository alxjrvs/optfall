/**
 * One happy-dom registration, shared by every runtime test in the repository.
 *
 * WHY THIS IS NOT JUST `GlobalRegistrator.register()` IN EACH FILE. That is
 * what the first runtime test did, and it was correct while there was one of
 * them. The second one broke it in two ways at once, and both are teardown
 * races rather than anything either test does wrong:
 *
 * - **Two registrations swap `document` under a live React root.** `bun test`
 *   runs every file in one process, and a second `register()` installs fresh
 *   globals over the first. React's event system holds the nodes it was given;
 *   handed a new `document`, it dereferences an instance that is now null and
 *   throws `null is not an object (evaluating 'inst.tag')` — attributed to the
 *   FIRST file, which had already passed.
 * - **The first `unregister()` pulls the DOM out from under work the scheduler
 *   has queued.** React's `performWorkUntilDeadline` reads `window.event`, so a
 *   callback scheduled during the last test of a file and run after its
 *   `afterAll` throws `window is not defined`. `bun test` reports it as an
 *   unhandled error between tests, counts zero failures — and exits 1.
 *
 * SO REGISTRATION IS COUNTED RATHER THAN REPEATED. The first file to ask gets
 * the DOM; the last one to let go takes it down. That is correct whether Bun
 * imports the test files one at a time or all of them up front, which is the
 * property that matters, because it is not a thing this repository should have
 * to know.
 *
 * IT IS STILL HANDED BACK, AND THAT IS THE WHOLE POINT OF COUNTING RATHER THAN
 * LEAKING. A `window` left standing reaches the 61 assertions in
 * `packages/components/src/react/a11y.test.tsx`, which build their own JSDOM
 * and run axe inside it; axe reaches for the globals, finds happy-dom's
 * document instead of the one under test, and 61 tests fail at once. That is
 * measured, not feared — it is why the DOM is not in `bunfig.toml`'s preload.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";

/** How many test files currently hold the DOM. */
let holders = 0;

/**
 * Register happy-dom if nobody has yet, and count this file as a holder.
 *
 * Call it at MODULE SCOPE, before importing anything that touches `document` —
 * React's client entry among them. `url` is used only by the first caller;
 * every test in this repository sets its own address with `history.replaceState`
 * in a `beforeEach`, and the origin is the same for all of them.
 */
export function holdDom(url: string): void {
  if (holders === 0) GlobalRegistrator.register({ url });
  holders += 1;
}

/**
 * Let go, and unregister once the last holder has.
 *
 * The flush before it is not politeness. React may have queued a callback
 * during the file's final test; running it after the globals are gone is the
 * `window is not defined` above. One macrotask is enough to drain the
 * scheduler, and it costs a millisecond.
 */
export async function releaseDom(): Promise<void> {
  holders -= 1;
  if (holders > 0) return;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await GlobalRegistrator.unregister();
}
