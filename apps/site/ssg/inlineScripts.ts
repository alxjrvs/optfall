/**
 * Every inline `<script>` this site renders, and the CSP hashes that admit
 * them. One module, because the hash and the body must never be maintained
 * separately.
 *
 * THE POINT IS THAT THE HASH IS DERIVED, NOT WRITTEN DOWN. `hostConfig.ts`
 * builds `script-src` from {@link INLINE_SCRIPT_HASHES}, which is computed from
 * the same strings the pages render. Editing a script body changes its hash in
 * the same build, so the two cannot disagree. A hash pasted into a header table
 * by hand is a `Content-Security-Policy` that silently starts blocking the
 * page's own script the next time somebody fixes a typo in it — and the failure
 * shows up in a browser console, not in CI.
 *
 * WHY THESE ARE INLINE AT ALL, since a strict CSP would be trivial with none.
 * All three have to run before the reader reads anything, and an external file
 * is a second request that a `<script src>` in `<head>` would block on:
 *
 *   - the pitch redirect navigates away; running it after first paint would
 *     show the wrong card and then move
 *   - the search prefill fills a field the reader may already be typing into
 *   - the service worker registration is deliberately on `load`, but shipping a
 *     whole request to schedule a callback is worse than four lines
 *
 * So they stay inline and are hashed instead, which is what hashes are for.
 *
 * WHAT MADE THIS POSSIBLE. The pitch redirect used to interpolate a per-card
 * JSON literal directly into its body, so every one of the 12,777 card pages
 * had a DIFFERENT script and therefore a different hash. `_headers` is
 * pattern-based with a 100-rule cap, so a per-page hash could not have been
 * expressed at all — which is why the first pass at a CSP left `script-src`
 * permissive and said so. Moving that data to a `data-` attribute made the body
 * constant: the attribute is not part of what a hash covers, so one hash now
 * admits every card page.
 */

import { createHash } from "node:crypto";

import { HEADER_FIELD_ID } from "./islands/HeaderSearch";

/**
 * Registers the service worker, on `load` so it never competes with the first
 * paint. Failure is swallowed: a browser that refuses the registration is a
 * browser that gets the site without offline support, which is not an error
 * worth a console entry on every such visit.
 */
export const SERVICE_WORKER_REGISTRATION = `
if ("serviceWorker" in navigator) {
  addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
`.trim();

/**
 * Copies `?q=` into the header's field on `/search`, so the field shows what
 * the results are for. Reads `HEADER_FIELD_ID` rather than spelling the id,
 * which is what keeps this and the island agreeing.
 */
export const SEARCH_PREFILL = `{
  const asked = new URLSearchParams(window.location.search).get("q");
  const field = document.getElementById(${JSON.stringify(HEADER_FIELD_ID)});
  if (asked !== null && field !== null) field.value = asked;
}`;

/**
 * The `?pitch=` redirect on a card page.
 *
 * READS ITS DATA FROM `document.currentScript`, which is the whole reason this
 * is a constant. `currentScript` is the executing `<script>` element during an
 * inline script's synchronous run, so the per-card target map travels as
 * `data-pitch-targets` on the element itself and the body never varies. An
 * attribute is not covered by a CSP hash; the body is.
 *
 * The `try` is not defensive padding. `JSON.parse` on a missing or malformed
 * attribute throws, and an exception here would abort the script before the
 * page finished parsing — on a redirect whose entire job is to be invisible.
 * Doing nothing is the correct failure: the reader stays on the page they
 * asked for, which is where they already are.
 */
export const PITCH_REDIRECT = `{
  const el = document.currentScript;
  let targets = null;
  try {
    targets = JSON.parse(el.dataset.pitchTargets);
  } catch {}
  const wanted = new URLSearchParams(window.location.search).get("pitch");
  if (targets !== null && wanted !== null) {
    const target = targets[wanted];
    if (target && target !== window.location.pathname.replace(/\\/$/, "")) {
      const url = new URL(target, window.location.origin);
      for (const [key, value] of new URLSearchParams(window.location.search)) {
        if (key !== "pitch") url.searchParams.set(key, value);
      }
      window.location.replace(url.href);
    }
  }
}`;

/**
 * A CSP source expression for one inline script body.
 *
 * The digest is over the exact bytes between the tags. React renders
 * `dangerouslySetInnerHTML` verbatim, so hashing the same string the component
 * passes is hashing what the browser will see — which is the property this
 * whole module exists to hold.
 */
export function scriptHash(body: string): string {
  return `'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`;
}

/**
 * Every inline script's hash, in a stable order so `_headers` does not churn
 * between builds for no reason.
 *
 * A script added to a page and not added here fails in the browser rather than
 * in CI, which is the one gap this arrangement does not close.
 * `ssg.test.ts` covers it from the other direction: it asserts that every
 * inline script found in the built HTML has its hash present in the policy, so
 * the omission fails the build after all.
 */
export const INLINE_SCRIPT_HASHES: readonly string[] = [
  scriptHash(SERVICE_WORKER_REGISTRATION),
  scriptHash(SEARCH_PREFILL),
  scriptHash(PITCH_REDIRECT),
];
