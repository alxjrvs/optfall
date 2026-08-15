/**
 * The React entry exports exactly the primitives the library says it owes.
 *
 * A PORT THAT FORGETS A COMPONENT IS A PORT THAT LOOKS FINISHED. Everything
 * else in this directory tests a component that exists; nothing else tests
 * whether the SET is complete, and "did we do all fourteen" is exactly the
 * question a migration answers wrongly — not by porting one badly, but by
 * stopping at twelve and moving on to the pages.
 *
 * IT CHECKS AGAINST `PRIMITIVES`, NOT AGAINST ANOTHER IMPLEMENTATION. This file
 * used to read `src/svelte/index.ts` and assert the two entries matched, and it
 * said of itself that it existed "only for the window in which two
 * implementations have to agree" and should be deleted with the Svelte sources.
 * Deleting it was wrong: what made it valuable was never the Svelte half but
 * the completeness question, and `src/index.ts` states the answer directly —
 * `PRIMITIVES` is described there as "closed on purpose", both the work queue
 * and the check on the exit criterion that a complete product screen can be
 * assembled from these with no new CSS.
 *
 * So the comparison got stronger by losing its other half. Two implementations
 * agreeing proves they agree; either could have been missing the same
 * component. This compares the shipped entry against the declared contract.
 */

import { describe, expect, test } from "bun:test";

import { PRIMITIVES } from "../index";
import * as react from "./index";

/**
 * `pitch-jewel` → `PitchJewel`.
 *
 * The two spellings are both correct and neither should move to meet the other:
 * `PRIMITIVES` is the design system's vocabulary, and those ids appear in
 * `docs/DESIGN.md`, in the generated design-system page and in the token names,
 * where kebab-case is the convention. The exports are React components, where
 * PascalCase is not a preference but a requirement — JSX treats a lowercase tag
 * as an HTML element. So the mapping is stated here, in the one place that has
 * to see both.
 */
function componentName(id: string): string {
  return id
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

describe("the React entry against the declared primitive set", () => {
  test("every primitive the library declares is exported", () => {
    /*
     * Values only. The React entry exports its prop types alongside each
     * component, and a type export is erased at runtime, so `Object.keys` here
     * is already the component list rather than a list needing filtering.
     */
    const exported = Object.keys(react).toSorted();

    expect(PRIMITIVES.length).toBeGreaterThan(0);
    expect(exported).toEqual(PRIMITIVES.map(componentName).toSorted());
  });

  test("every export is callable, so none of them is an empty module", () => {
    // A file that fails to export its component still satisfies the name check
    // above if the name is re-exported from somewhere — this catches that.
    for (const [name, value] of Object.entries(react)) {
      expect(typeof value, name).toBe("function");
    }
  });
});
