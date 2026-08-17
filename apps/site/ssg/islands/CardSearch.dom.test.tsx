/**
 * `CardSearch` against a real DOM — the first runtime test in this repo.
 *
 * WHY IT EXISTS. The header-search change moved this island's field into the
 * document shell, so the island drives a node React does not render: it finds
 * `#site-search`, seeds its state from it, listens for `input` and `submit`,
 * and writes back. Every defect that work produced lived in that seam —
 * a submit that re-ran the PREVIOUS query, a mount that blanked text typed
 * before hydration, an Escape that stopped calling `preventDefault` — and not
 * one of them was visible to a test that renders markup and reads strings.
 * `ssg.test.ts` asserted the ids and classes were present and stayed green
 * through all three.
 *
 * So this file asserts BEHAVIOUR, and it is scoped to the seam rather than to
 * the component. What a query returns is already covered exhaustively by
 * `src/lib/card-search.test.ts` against the real corpus; repeating any of it
 * here would be slower and no truer. What is here is the handful of things that
 * are only true once a browser is involved.
 *
 * HAPPY-DOM IS REGISTERED IN THIS FILE, NOT IN A PRELOAD, and that is
 * deliberate. `bunfig.toml`'s `preload` would give every test in the repo a
 * `window`, and most of this codebase's modules branch on not having one —
 * `queryFromUrl` reads `window.location`, the generator renders to a string on
 * purpose. Giving 790 server-side assertions a DOM to change their minds about
 * is a large, silent change to buy one file an environment. The cost of the
 * narrow version is that this file must be the only one that registers it; the
 * suite is run after this landed to prove nothing else moved.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://optfall.com/search" });

/*
 * REACT'S OWN FLAG, AND WITHOUT IT `act` DOES NOT FLUSH. React logs "the
 * current testing environment is not configured to support act(...)" and
 * carries on, so the tests below still PASSED while updates were landing
 * whenever they felt like it — a suite that is green for the wrong reason,
 * which is the exact failure this file was added to stop repeating.
 */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { buildCardIndex } from "../../src/lib/card-search";
import { CARD_PAGES, CORPUS, LAST_CONFIRMED } from "../../src/lib/cards";
import { SETS } from "../../src/lib/sets";
import { CardSearch, HEADER_FIELD_ID } from "./CardSearch";

/*
 * THE REAL INDEX, BECAUSE THE SEAM CARRIES REAL QUERIES ACROSS IT. A stub index
 * would let a submit "work" while returning nothing, which is the shape of the
 * bug this file is here to catch — the stale-closure submit re-ran the previous
 * query and looked, from the outside, exactly like a submit that did nothing.
 */
const index = buildCardIndex(CARD_PAGES, {
  commit: CORPUS.source.commit,
  confirmed: LAST_CONFIRMED,
  releasedBySet: new Map(SETS.sets.map((set) => [set.id, set.released])),
});

/** The shell's markup, as `SiteHeader` renders it. */
function shell(): HTMLInputElement {
  document.body.innerHTML = `
    <form action="/search" method="get">
      <input id="${HEADER_FIELD_ID}" name="q" type="search" />
      <button type="submit">Search</button>
    </form>
    <main><div id="root"></div></main>`;
  const field = document.getElementById(HEADER_FIELD_ID);
  if (!(field instanceof HTMLInputElement)) throw new Error("no field");
  return field;
}

async function mount(): Promise<Root> {
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  const root = createRoot(host);
  await act(async () => {
    root.render(<CardSearch index={index} />);
  });
  return root;
}

/**
 * What the page is SHOWING, which is the assertion that matters.
 *
 * MUTATION TESTING IS WHY THIS EXISTS. The first version of this file asserted
 * the URL and the field's value and nothing else, and four of five deliberately
 * reintroduced bugs walked straight past it — including the stale-closure
 * submit it was written for, because that bug moves the RESULTS while
 * `syncUrl` still writes the right address. A search test that never looks at
 * what was found is a test of a URL builder.
 */
function shown(): string {
  return (
    document.querySelector(".of-cards__announcement")?.textContent?.trim() ?? ""
  );
}

/** Type into the adopted field the way a browser does. */
async function type(field: HTMLInputElement, text: string): Promise<void> {
  await act(async () => {
    field.value = text;
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/search");
});

/*
 * HANDED BACK, BECAUSE THIS PROCESS IS SHARED.
 *
 * `bun test` runs every file in one process, so registering happy-dom here puts
 * a `window` and a `document` in front of all 790 assertions that follow.
 * Measured: it broke 61 of them at once — `packages/components/src/react/
 * a11y.test.tsx` builds its own JSDOM and runs axe inside it, and axe reaches
 * for the globals, so it found happy-dom's document instead of the one under
 * test.
 *
 * Unregistering is what keeps the environment scoped to this file rather than
 * to whatever happens to run after it. It is the price of not putting a DOM in
 * `bunfig.toml`'s preload, and it is much cheaper than the alternative.
 */
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

describe("the island drives the field the shell renders", () => {
  test("it adopts the header's input rather than rendering one", async () => {
    const field = shell();
    const root = await mount();

    /* The whole page has exactly one text field, and it is the shell's — the
       island renders none of its own. */
    expect(document.querySelectorAll("input[type=search]")).toHaveLength(1);
    expect(field.isConnected).toBe(true);

    await act(async () => root.unmount());
  });

  test("a submit in the SAME TASK as the keystroke runs the NEW query", async () => {
    /*
     * THE REGRESSION THIS FILE WAS WRITTEN FOR.
     *
     * The DOM listener is bound once on mount and reaches its handler through a
     * ref. While that handler read `query` from React state, an `input` and a
     * `submit` arriving in ONE task — a paste then Enter, or any programmatic
     * submit — left the ref holding the PREVIOUS render's closure: `setQuery`
     * schedules a render, it does not perform one. So the submit re-ran the old
     * query, the URL did not move, and the field looked like it had stopped
     * working.
     *
     * No `await` between the two dispatches, deliberately. That is the whole
     * test: separating them is what made the bug invisible by hand.
     */
    const field = shell();
    const root = await mount();

    await act(async () => {
      field.value = "banned:cc";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.form?.requestSubmit();
    });

    expect(window.location.search).toBe("?q=banned%3Acc");
    expect(field.value).toBe("banned:cc");
    /* AND THE RESULTS ARE THE NEW QUERY'S. `banned:cc` is 35 cards; the empty
       query this bug fell back to is the whole browse. Without this line the
       regression is invisible here — measured, by reintroducing it. */
    expect(shown()).toBe("35 cards match.");

    await act(async () => root.unmount());
  });

  test("a submit pushes history, so the back button has somewhere to go", async () => {
    const field = shell();
    const root = await mount();

    await type(field, "banned:cc");
    await act(async () => field.form?.requestSubmit());
    expect(window.location.search).toBe("?q=banned%3Acc");

    await type(field, "pitch:3 class:guardian");
    await act(async () => field.form?.requestSubmit());
    expect(window.location.search).toBe("?q=pitch%3A3+class%3Aguardian");

    /* PUSHED, NOT REPLACED. A results page you cannot back out of is a page
       that has eaten the query before it. */
    await act(async () => {
      window.history.back();
    });
    expect(window.location.search).toBe("?q=banned%3Acc");
    /* The rows came back with the address, rather than the address moving on
       its own — `popstate` has to re-rank, not just rewrite the bar. */
    expect(shown()).toBe("35 cards match.");
    expect(field.value).toBe("banned:cc");

    await act(async () => root.unmount());
  });

  test("text typed before hydration survives the mount", async () => {
    /*
     * THE SECOND DEFECT IN THE SEAM. The header's field is static markup —
     * on screen and typeable from first paint, before `islands.js` lands. The
     * value-sync effect writes `query` into it whenever the two differ, and
     * `query` starts empty, so mounting BLANKED whatever had been typed.
     *
     * React guards this for inputs it renders itself; an adopted node gets none
     * of it. Two things close it and this asserts the pair: the adoption effect
     * seeds state from the field, and the sync effect skips its first run so it
     * cannot write the pre-seed empty string back in the same commit.
     */
    const field = shell();
    field.value = "winter";

    const root = await mount();

    expect(field.value).toBe("winter");

    /* And the seed is the island's state, not just a value left alone: a submit
       with no further typing has to run what is in the box. */
    await act(async () => field.form?.requestSubmit());
    expect(window.location.search).toBe("?q=winter");
    expect(shown()).toContain("cards match");

    await act(async () => root.unmount());
  });

  test("mounting never BLANKS the field, even for a moment", async () => {
    /*
     * THE FLICKER, WHICH A FINAL-STATE ASSERTION CANNOT SEE — and mutation
     * testing is how that was found. Removing the sync effect's first-run skip
     * leaves the text intact by the time anything settles: the effect writes
     * the pre-seed `""` into the field and the next render writes the seeded
     * value back. The test above stays green through it. What a reader gets is
     * a box that empties and refills, with the caret thrown to the end
     * mid-word.
     *
     * So this watches the WRITES rather than the outcome, by wrapping the
     * instance's `value` setter. It is the only assertion in this file that
     * reaches for an intermediate state, and it is here because the defect only
     * exists in one.
     */
    const field = shell();
    field.value = "winter";

    const writes: string[] = [];
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    if (descriptor?.get === undefined || descriptor.set === undefined) {
      throw new Error("no value descriptor to wrap");
    }
    const { get, set } = descriptor;
    Object.defineProperty(field, "value", {
      configurable: true,
      get(this: HTMLInputElement) {
        return get.call(this);
      },
      set(this: HTMLInputElement, next: string) {
        writes.push(next);
        set.call(this, next);
      },
    });

    const root = await mount();

    expect(writes).not.toContain("");
    expect(field.value).toBe("winter");

    await act(async () => root.unmount());
  });

  test("the field is filled from ?q= on arrival", async () => {
    /* What a reader who searched on the front door lands on. The inline script
       in `search.page.tsx` does this before any bundle loads; the island has to
       agree with it rather than clear it. */
    window.history.replaceState(null, "", "/search?q=banned%3Acc");
    const field = shell();
    const root = await mount();

    expect(field.value).toBe("banned:cc");

    await act(async () => root.unmount());
  });

  test("Escape clears the field and prevents the browser's own handling", async () => {
    /*
     * `type="search"` has native Escape behaviour — WebKit and Blink clear the
     * field, Firefox treats it as "stop" — so without `preventDefault` the
     * browser's action runs alongside ours. It reaches the same place today,
     * which is exactly why the guard was easy to drop unnoticed.
     */
    const field = shell();
    const root = await mount();
    await type(field, "banned:cc");

    const escapeKey = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      field.dispatchEvent(escapeKey);
    });

    expect(escapeKey.defaultPrevented).toBe(true);
    expect(field.value).toBe("");

    await act(async () => root.unmount());
  });

  test("unmounting releases the shell's field", async () => {
    /* The island listens on a node it does not own, so it has to stop. A
       listener surviving unmount would answer submits for a component that is
       no longer on the page. */
    const field = shell();
    const root = await mount();
    await act(async () => root.unmount());

    /*
     * INTERCEPTION IS THE OBSERVABLE, NOT THE ADDRESS.
     *
     * The first version of this test asserted the URL had not moved, and that
     * cannot work: a form the island has stopped intercepting is submitted by
     * the BROWSER, `action="/search" method="get"`, which lands on exactly the
     * same `?q=…` the island would have pushed. Same address, opposite meaning.
     *
     * `defaultPrevented` separates them. A live listener calls
     * `preventDefault` and answers in place; a released one leaves the event
     * alone so the browser can navigate — which on a page with no island is the
     * whole no-JS path this design rests on.
     */
    const afterUnmount = new Event("submit", {
      bubbles: true,
      cancelable: true,
    });
    field.value = "banned:cc";
    field.form?.dispatchEvent(afterUnmount);
    expect(afterUnmount.defaultPrevented).toBe(false);
  });

  test("a mounted island DOES intercept, or the test above proves nothing", async () => {
    /* The other half of the pair: `defaultPrevented` has to differ between a
       mounted island and an unmounted one, or asserting `false` above is
       asserting a constant. */
    const field = shell();
    const root = await mount();

    const submit = new Event("submit", { bubbles: true, cancelable: true });
    field.value = "banned:cc";
    field.form?.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);

    await act(async () => root.unmount());
  });
});
