/**
 * The two entry points export the same components.
 *
 * A PORT THAT FORGETS A COMPONENT IS A PORT THAT LOOKS FINISHED. Everything
 * else in this directory tests a component that exists; nothing tested whether
 * the set was complete, and "did we do all fourteen" is exactly the question a
 * migration answers wrongly — not by porting one badly, but by stopping at
 * twelve and moving on to the pages.
 *
 * It reads the Svelte entry's source rather than importing it, deliberately.
 * Importing `optfall-components/svelte` from a plain `bun test` pulls in the
 * Svelte compiler for fourteen components to answer a question about names, and
 * this file has no interest in what any of them render. The export list is the
 * contract; the source is where the contract is written down.
 *
 * WHEN THIS FAILS AFTER A DELETION, DELETE FROM BOTH. The end state of Phase 6
 * is that `src/svelte` is gone entirely and this file goes with it — it exists
 * only for the window in which two implementations have to agree.
 */

import { describe, expect, test } from "bun:test";

import * as react from "./index";

/** Component names exported by an entry point, ignoring type-only exports. */
function exportedComponents(source: string): string[] {
  return [...source.matchAll(/export \{ default as (\w+) \}/g)]
    .map((match) => match[1] ?? "")
    .filter((name) => name !== "")
    .toSorted();
}

const svelteEntry = await Bun.file(
  new URL("../svelte/index.ts", import.meta.url).pathname,
).text();

describe("React and Svelte entry parity", () => {
  test("every Svelte primitive has a React counterpart", () => {
    const svelte = exportedComponents(svelteEntry);
    /*
     * Values only. The React entry exports its prop types alongside each
     * component, and a type export is erased at runtime, so `Object.keys` here
     * is already the component list rather than a list needing filtering.
     */
    const ported = Object.keys(react).toSorted();

    expect(svelte.length).toBeGreaterThan(0);
    expect(ported).toEqual(svelte);
  });

  test("every export is callable, so none of them is an empty module", () => {
    // A file that fails to export its component still satisfies the name check
    // above if the name is re-exported from somewhere — this catches that.
    for (const [name, value] of Object.entries(react)) {
      expect(typeof value, name).toBe("function");
    }
  });
});
