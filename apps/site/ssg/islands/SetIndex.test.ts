/**
 * `/sets`'s filter, held to the corpus it filters.
 *
 * ONE INVARIANT, AND IT EXISTS BECAUSE THE OBVIOUS IMPLEMENTATION PASSED EVERY
 * TEST A HAND-WRITTEN CASE WOULD HAVE GIVEN IT. `fold` began as `NFD` plus a
 * `\p{Diacritic}` strip, which is the correct answer for `é` and the wrong one
 * for `ð` — eth is a letter rather than a `d` with a mark on it, so the fold ran
 * on every keystroke and folded nothing. The docblock beside it named
 * "Vetreiði" as the case it handled. Typing "vetreidi" returned no sets.
 *
 * A CASE LIST WOULD NOT HAVE CAUGHT IT, because the cases somebody writes are
 * the ones they already believe work. What catches it is asking the CORPUS: run
 * the fold over every set name the page lists and require the output to be
 * typeable. That is one assertion, it needs no maintenance as upstream adds
 * sets, and it fails on the next character nobody has thought about — which is
 * the only kind of failure this function can have.
 */

import { describe, expect, test } from "bun:test";

import { SET_PROFILES } from "../../src/lib/set-profiles";
import { SETS_BY_RELEASE } from "../../src/lib/sets";

import { fold } from "./SetIndex";

/** Exactly the sets `sets.page.tsx` hands the island. */
const listed = SETS_BY_RELEASE.filter((set) => SET_PROFILES.has(set.id));

describe("folding a set name to what a reader will type", () => {
  test("leaves nothing in this corpus that a US keyboard cannot produce", () => {
    /*
     * PRINTABLE ASCII IS THE BAR because it is the one a keyboard answers for.
     * A folded name still holding `ð` is a set whose name can be read on the
     * page and not typed into the field above it — which is the whole failure,
     * and it is invisible to anything that only checks the filter returns
     * results for names somebody remembered to try.
     */
    const untypeable = listed
      .map((set) => set.name)
      .filter((name) => /[^ -~]/.test(fold(name)))
      .toSorted();

    expect(untypeable).toEqual([]);
  });

  test("the two characters this corpus actually contains fold as intended", () => {
    /*
     * NAMED AS WELL AS ASSERTED IN AGGREGATE, so the invariant above cannot go
     * green by the corpus losing the sets that exercise it. These two are the
     * entire non-ASCII surface of the listed names, measured rather than
     * assumed — an eth and an en dash.
     */
    expect(fold("Armory Deck Origins - Jarl Vetreiði")).toBe(
      "armory deck origins - jarl vetreidi",
    );
    expect(fold("Classic Battles: Rhinar vs Dorinthea – Rhinar")).toBe(
      "classic battles: rhinar vs dorinthea - rhinar",
    );
  });

  test("still strips a combining accent, which is what it was written for", () => {
    /*
     * NOT IN THIS CORPUS, AND ASSERTED ANYWAY. The `NFD` pass matches no set
     * name today, so a test drawn only from the corpus would let somebody
     * delete it as dead code — and it is the general case the substitution
     * table deliberately is not. Both spellings of the same string are checked:
     * upstream may publish either, and `NFD` is what makes them one query.
     */
    /* Written as escapes rather than as literals, because the two forms
       are indistinguishable in a source file and a case asserting the same
       string twice is exactly the vacuous test this file exists against. */
    expect(fold("F\u00e1el\u00e1n")).toBe("faelan");
    expect(fold("Fa\u0301ela\u0301n")).toBe("faelan");
  });

  test("folds the uppercase form through the lowercase one", () => {
    /* The table is applied after `toLowerCase`, so `Ð` needs no entry of its
       own — which is why there is one entry rather than two to keep in step. */
    expect(fold("ÐEEP")).toBe("deep");
  });
});
