/**
 * One happy-dom registration, shared by every runtime test in the repository.
 *
 * WHY COUNT INSTEAD OF REGISTERING PER FILE — AND WHAT THAT CLAIM IS AND IS
 * NOT. An earlier version of this docblock said per-file
 * `register()`/`unregister()` was simply broken. **That was too strong, and
 * the tree disproves it:** `CardSearch.dom.test.tsx` and
 * `RulesSearch.dom.test.tsx` both register for themselves, the three files
 * that use this module do not, and all five pass together — 95 assertions,
 * exit 0. Per-file registration works.
 *
 * What is real is the failure that produced this module, reproduced at the
 * time on two files and worth naming because it is easy to hit again:
 *
 * - **A second `register()` can swap `document` under a live React root.**
 *   `bun test` runs every file in one process, and fresh globals land over the
 *   old ones. React's event system holds the nodes it was given; handed a new
 *   `document` it dereferences an instance that is now null and throws `null is
 *   not an object (evaluating 'inst.tag')` — attributed to the FIRST file,
 *   which had already passed.
 * - **An `unregister()` can pull the DOM out from under queued work.** React's
 *   `performWorkUntilDeadline` reads `window.event`, so a callback scheduled
 *   during a file's last test and run after its `afterAll` throws `window is
 *   not defined`. `bun test` reports that as an unhandled error between tests,
 *   counts ZERO failures — and exits 1.
 *
 * Both need a file to leave work pending at teardown. The case that did was a
 * test holding a fetch that never settles, to exercise an island's in-flight
 * state; a file whose roots are all unmounted and whose promises have all
 * resolved tears down cleanly on its own.
 *
 * SO THIS IS INSURANCE RATHER THAN A FIX FOR A LIVE BUG. Counting makes the
 * DOM's lifetime independent of how many files want one and what order Bun
 * loads them in — the first to ask gets it, the last to let go takes it down —
 * which is a property worth having precisely because nothing in a test file
 * makes it obvious that it has left a timer running.
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
