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
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { buildCardIndex, decodeCardIndex } from "../../src/lib/card-search";
import { CARD_PAGES, CORPUS, LAST_CONFIRMED } from "../../src/lib/cards";
import { SETS } from "../../src/lib/sets";
import {
  type CardCorpusBrief,
  CardSearch,
  type NewestRelease,
} from "./CardSearch";
/* The id moved to the component that renders the field, along with the field. */
import { HEADER_FIELD_ID, HeaderSearch } from "./HeaderSearch";
import { headerSearchStore } from "./headerSearchStore";
import { searchIndexClient } from "./useSearchIndex";

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

/**
 * The index arrives over `fetch` now, so the harness has to serve it.
 *
 * A REAL `Response` CARRYING THE REAL INDEX, not a mocked hook. The component's
 * contract with `useSearchIndex` is one of the things that can break, and a test
 * that stubs the hook would assert the component against a fiction of it. This
 * stubs the ONE thing the browser provides and the test environment does not,
 * and everything above it — the query, the decode, the three states — is the
 * shipped code.
 *
 * THE ADDRESS IS ASSERTED RATHER THAN IGNORED. If the island ever fetches
 * something else, the throw says so by name instead of the suite quietly seeing
 * an index that never loads.
 */
const INDEX_URL = "/assets/card-index-under-test.json";

globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === "string" ? input : String(input);
  if (url !== INDEX_URL) throw new Error(`unexpected fetch: ${url}`);
  return new Response(JSON.stringify(index), {
    headers: { "content-type": "application/json" },
  });
}) as typeof fetch;

/** The count, the pin and the browse, exactly as `searchIndexes.ts` derives them. */
const brief: CardCorpusBrief = (() => {
  const decoded = decodeCardIndex(index);
  return {
    size: decoded.size,
    commit: decoded.commit,
    confirmed: decoded.confirmed,
    browse: decoded.browse,
  };
})();

/**
 * Wait for the index request to land.
 *
 * EVERY ASSERTION IN THIS FILE IS DOWNSTREAM OF A FETCH NOW, and a suite that
 * asserted before it settled would be testing the loading state while claiming
 * to test results. The DOM cannot answer the question either, because the
 * loading line is equally absent before anything has been asked.
 *
 * IT WAITS FOR THE CACHED DATA, NOT FOR `isFetching() === 0`, and the difference
 * is the whole correctness of this helper. React starts the request in an
 * effect, so for the first tick after a render nothing is in flight yet —
 * "nothing is fetching" is true BEFORE the fetch as well as after it, and a
 * helper resting on it returns immediately and settles nothing.
 *
 * IT THROWS RATHER THAN GIVING UP QUIETLY. A settle helper that returns after N
 * ticks whether or not anything happened is how a suite starts passing for the
 * wrong reason, which is the failure the `IS_REACT_ACT_ENVIRONMENT` note at the
 * top of this file already records once.
 */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 50; tick += 1) {
    if (searchIndexClient.getQueryData(["search-index", INDEX_URL])) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
  throw new Error("the card index never finished loading");
}

/**
 * The shell's markup, as `SiteHeader` renders it — the FORM only.
 *
 * THE FIELD IS NOT IN HERE ANY MORE, and that is the change this file tests.
 * `SiteHeader` renders the form and hands its inside to an island, so the form
 * element is static markup and everything within it is React's. The harness
 * reproduces that shape rather than approximating it: hand-writing the input
 * here would test `CardSearch` against a field nothing owns, which is exactly
 * the arrangement that has been removed.
 */
function shell(): HTMLFormElement {
  document.body.innerHTML = `
    <form id="header-form" action="/search" method="get"></form>
    <main><div id="root"></div></main>`;
  const form = document.getElementById("header-form");
  if (!(form instanceof HTMLFormElement)) throw new Error("no form");
  return form;
}

/** The field, once `HeaderSearch` has rendered it. */
function fieldIn(form: HTMLFormElement): HTMLInputElement {
  const field = form.querySelector(`#${HEADER_FIELD_ID}`);
  if (!(field instanceof HTMLInputElement)) throw new Error("no field");
  return field;
}

/**
 * Both islands, as the page mounts them: two roots, one store between them.
 *
 * TWO ROOTS RATHER THAN ONE TREE, because that is the constraint the whole
 * design exists under — the header is outside `<main>`, so no single island can
 * hold the field and the results. A harness that rendered them as one tree would
 * pass while the shipped arrangement was broken.
 */
interface Mounted {
  /** Tears down BOTH roots. Half a page torn down is not a torn-down page. */
  readonly unmount: () => void;
}

/**
 * The page as a reader first sees it: the field is MARKUP, and nothing is live.
 *
 * THIS IS THE WINDOW TWO OF THE TESTS BELOW EXIST FOR. `Island` renders its
 * child on the server, so the header's input is on screen and typeable from the
 * first paint — well before `islands.js` arrives. Reproducing that needs a real
 * server render and a real `hydrateRoot`, not a `createRoot` into an empty form:
 * `createRoot` throws the markup away and rebuilds it, which is precisely the
 * step that cannot lose anything, so a harness built on it cannot see the defect.
 */
function paint(form: HTMLFormElement): HTMLInputElement {
  form.innerHTML = renderToString(<HeaderSearch />);
  return fieldIn(form);
}

/** Hydrate a painted form, the way `islands.client.ts` does. */
async function hydrate(form: HTMLFormElement): Promise<Mounted> {
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  let headerRoot: Root | undefined;
  const results: Root = createRoot(host);
  await act(async () => {
    headerRoot = hydrateRoot(form, <HeaderSearch />);
    results.render(<CardSearch indexUrl={INDEX_URL} brief={brief} />);
  });
  await settle();
  return {
    unmount: () => {
      results.unmount();
      headerRoot?.unmount();
    },
  };
}

async function mount(form: HTMLFormElement): Promise<Mounted> {
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  const headerRoot: Root = createRoot(form);
  const root: Root = createRoot(host);
  await act(async () => {
    headerRoot.render(<HeaderSearch />);
    root.render(<CardSearch indexUrl={INDEX_URL} brief={brief} />);
  });
  /* Mounted is not ready any more. Every test below asks a question the index
     has to have arrived to answer, so waiting here keeps that out of each one. */
  await settle();
  return {
    unmount: () => {
      root.unmount();
      headerRoot.unmount();
    },
  };
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

/**
 * Type into the field the way a browser does.
 *
 * STILL A REAL DOM EVENT. React listens for `input` at the root and turns it
 * into `onChange`, so dispatching one is what a keystroke actually is — setting
 * `.value` alone would move the DOM without telling React, which is a state no
 * browser can produce.
 */
async function type(field: HTMLInputElement, text: string): Promise<void> {
  await act(async () => {
    nativeValue(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/**
 * Set an input's value the way a KEYSTROKE does, past React's value tracker.
 *
 * **`field.value = text` DOES NOT WORK ON A CONTROLLED INPUT, AND FAILS
 * SILENTLY**, which is worth the paragraph because it looks exactly like typing
 * and is not. React installs an OWN `value` property on every input it controls
 * — that is its change detection: the tracker remembers the last value it saw,
 * and `onChange` fires when the DOM's value differs from it. An ordinary
 * assignment goes through that setter, so the tracker is updated in the same
 * breath, React compares the two, finds them equal and fires nothing.
 *
 * Measured on this harness before the fix: `HeaderSearch` rendered exactly once
 * for a test that typed and then pressed Escape. Nothing errored. The field held
 * text React had never heard about.
 *
 * The prototype's setter is the one a browser uses, and it leaves the tracker
 * stale — which is precisely the state that makes React notice.
 *
 * (`keydown` needs no equivalent, and cannot have one: React's delegated keydown
 * listener does not fire under happy-dom at all. That is why Escape is a native
 * listener in `HeaderSearch` rather than an `onKeyDown` prop.)
 */
function nativeValue(field: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (setter === undefined) throw new Error("no prototype value setter");
  setter.call(field, text);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/search");
  /* THE STORE OUTLIVES A TEST, because it is a module constant — which is what
     makes it a channel between two roots in the first place. Resetting it here
     keeps each test's field empty and its submit count at zero, so a test cannot
     pass on a submission the previous one made. */
  headerSearchStore.setState(() => ({
    query: "",
    submissions: 0,
    submittedQuery: "",
    answeredInPlace: false,
  }));
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
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);

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
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);

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
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);

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
     * THE SECOND DEFECT IN THE SEAM, AND THE FIX FOR IT IS NOW REACT'S.
     *
     * The header's field is server-rendered markup — on screen and typeable
     * from first paint, before `islands.js` lands. Under the adopted-field
     * arrangement the value-sync effect wrote `query` into it whenever the two
     * differed, and `query` started empty, so mounting BLANKED whatever had
     * been typed. It took a seed and a first-run skip to close.
     *
     * Neither exists any more. React's DOM host skips the value assignment
     * while hydrating an input it renders itself, which is exactly the guarantee
     * the adopted node could not have. What this asserts is that the guarantee
     * is really being relied on — that the field is React's, hydrated rather
     * than recreated — plus the one thing React cannot know: that the STORE ends
     * up agreeing, so the text is a query and not just pixels.
     */
    const form = shell();
    const field = paint(form);
    field.value = "winter";

    const root = await hydrate(form);

    expect(field.value).toBe("winter");
    expect(headerSearchStore.state.query).toBe("winter");

    /* And it is the island's state, not just a value left alone: a submit with
       no further typing has to run what is in the box. */
    await act(async () => form.requestSubmit());
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
    const form = shell();
    const field = paint(form);
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

    const root = await hydrate(form);

    expect(writes).not.toContain("");
    expect(field.value).toBe("winter");

    await act(async () => root.unmount());
  });

  test("the field is filled from ?q= on arrival", async () => {
    /* What a reader who searched on the front door lands on. The inline script
       in `search.page.tsx` does this before any bundle loads; the island has to
       agree with it rather than clear it. */
    window.history.replaceState(null, "", "/search?q=banned%3Acc");
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);

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
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);
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
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);
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
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);

    const submit = new Event("submit", { bubbles: true, cancelable: true });
    field.value = "banned:cc";
    field.form?.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);

    await act(async () => root.unmount());
  });
});

/* -------------------------------------------------------------------------- */
/* The control bar                                                             */
/* -------------------------------------------------------------------------- */

/**
 * THE BAR AND THE BOX SAY THE SAME THING, WHICH IS THE WHOLE CONTRACT.
 *
 * `display:`, `order:` and `dir:` are query TERMS, so a control that changed
 * the list without rewriting the query would leave the reader looking at one
 * answer and copying a link to another. `show()` has been guarded against that
 * since it was the only control; there are three now, and they share one
 * rewriter precisely so they cannot drift apart.
 *
 * DRIVEN THROUGH THE `<select>`s RATHER THAN THROUGH THE HANDLERS, because the
 * wiring between them is what can regress silently: a control can be rendered
 * with the right options and the right current value and no `onChange` at all,
 * and every assertion about the query would still pass if the test called the
 * handler itself.
 */
describe("the control bar writes the query it is a picture of", () => {
  /** Choose an option the way a person does: set it, then fire `change`. */
  async function choose(id: string, value: string): Promise<void> {
    const select = document.getElementById(id);
    if (!(select instanceof HTMLSelectElement)) throw new Error(`no ${id}`);
    await act(async () => {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  /** The query as it stands, read off the field the reader would copy. */
  function box(): string {
    const field = document.getElementById(HEADER_FIELD_ID);
    return field instanceof HTMLInputElement ? field.value : "";
  }

  /** Ask a question, so there is an answer for the bar to be about. */
  async function ask(text: string): Promise<Mounted> {
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);
    await type(field, text);
    await act(async () => {
      field.form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    return root;
  }

  test("an ordering is written as an operator, in the box and the address", async () => {
    const root = await ask("wrath");

    await choose("display-order", "cost");
    expect(box()).toBe("wrath order:cost");
    expect(decodeURIComponent(window.location.search)).toContain("order:cost");

    /* The direction only exists once there is an ordering to reverse — see the
       guard in `CardIndex`. */
    await choose("display-direction", "desc");
    expect(box()).toBe("wrath order:cost dir:desc");

    await act(async () => root.unmount());
  });

  test("relevance takes the direction with it, leaving nothing behind", async () => {
    /*
     * THE BUG THIS IS FOR. Dropping `order:` on its own left `wrath dir:desc`
     * in the address bar with the direction control hidden — because there is
     * nothing to reverse without an ordering — so the reader could neither see
     * that state nor clear it, and choosing an ordering again would silently
     * come back descending. State that outlives the URL it came from is the
     * failure `paramDisplay` is documented against; this is the same one.
     *
     * ASSERTED ON THE WHOLE STRING rather than with `not.toContain("dir")`,
     * because the second passes on `"wrath  "` — two spaces where a term was
     * lifted out, which is what the reader copies.
     */
    const root = await ask("wrath");
    await choose("display-order", "cost");
    await choose("display-direction", "desc");
    expect(box()).toBe("wrath order:cost dir:desc");

    await choose("display-order", "relevance");
    expect(box()).toBe("wrath");
    expect(decodeURIComponent(window.location.search)).toBe("?q=wrath");

    await act(async () => root.unmount());
  });

  test("the collapse level is typed, not clicked", async () => {
    /*
     * THIS USED TO DRIVE A `<select>`. The bar opened with a collapse-level
     * control — "Names", "Pitch versions", "Unique art" — and the test chose
     * `cards` from it and asserted both the query and the row count.
     *
     * THE OPERATOR IS WHAT SURVIVED, so that is what is asserted: typing
     * `unique:cards` still expands a name into its pitch versions. The half of
     * the old assertion worth keeping is the ROW COUNT, because that is the
     * thing a control could have written a term without actually doing — and it
     * is no less worth checking now that the term arrives from the box.
     *
     * THE ABSENCE OF THE CONTROL IS ASSERTED TOO. A bar that grew it back
     * silently would pass every other test in this file.
     */
    const root = await ask("head jab");
    const collapsed = document.querySelectorAll(".of-index__cell").length;
    expect(collapsed).toBeGreaterThan(0);
    expect(document.getElementById("display-unique")).toBeNull();

    const field = document.getElementById(HEADER_FIELD_ID);
    if (!(field instanceof HTMLInputElement)) throw new Error("no field");
    await type(field, "head jab unique:cards");
    await act(async () => {
      field.form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });

    expect(document.querySelectorAll(".of-index__cell").length).toBeGreaterThan(
      collapsed,
    );

    await act(async () => root.unmount());
  });

  test("the view is a term, and the label is the operand it writes", async () => {
    /*
     * THE ROUND TRIP THAT DID NOT USED TO HOLD. The switch was labelled with
     * the operator's SYNONYMS — "Images", "Rows", "Names" — while `show()`
     * wrote the canonical spelling, so a reader who clicked "Names" got
     * `display:text` in the box and had to work out for themselves that the two
     * were the same thing. The labels are the operands now, so what is on the
     * control and what is in the query are one word, and this is the assertion
     * that keeps them that way.
     *
     * THE OPTION VALUES ARE ASSERTED AS A SET, not just driven, because the
     * bug this change fixes was a LABEL collision rather than a behaviour one:
     * a third option reappearing here is the regression, and a test that only
     * drove two of them would not see it.
     */
    const root = await ask("wrath");

    const select = document.getElementById("display-display");
    if (!(select instanceof HTMLSelectElement)) throw new Error("no switch");
    expect([...select.options].map((option) => option.value)).toEqual([
      "grid",
      "list",
    ]);
    expect([...select.options].map((option) => option.textContent)).toEqual([
      "Grid",
      "List",
    ]);

    await choose("display-display", "list");
    expect(box()).toBe("wrath display:list");
    expect(document.querySelectorAll(".of-index__rows").length).toBe(1);

    /* And back — the term is REPLACED rather than dropped, so the box says
       `display:grid` rather than falling silent. That is the right way round
       for a view: unlike `order:relevance`, which names the absence of an
       ordering and therefore cannot be written, `grid` is a real operand and a
       reader who switched back deliberately should get an address that says so
       rather than one that merely happens to default there. It also proves the
       replace: two `display:` terms would apply the last and ignore the first. */
    await choose("display-display", "grid");
    expect(box()).toBe("wrath display:grid");
    expect(document.querySelectorAll(".of-index__grid").length).toBe(1);

    await act(async () => root.unmount());
  });

  test("a retired view spelling still answers, and says where it went", async () => {
    /*
     * `display:text` NAMED A VIEW THAT NO LONGER EXISTS. It is documented at
     * `/syntax` and sitting in links, so it resolves to the nearest real thing
     * rather than erroring — and it says so, because resolving it in silence
     * would leave a reader who typed it wondering why the page ignored them.
     */
    const root = await ask("wrath display:text");

    expect(document.querySelectorAll(".of-index__rows").length).toBe(1);
    const notices = [...document.querySelectorAll(".of-cards__notice")].map(
      (node) => node.textContent ?? "",
    );
    expect(notices.some((text) => text.includes("display:list"))).toBe(true);
    /* A THIRD ASSERTION USED TO STAND HERE, counting the copy control on the
       argument that it had taken the retired view's job. The control is gone
       and the argument with it; what this test is for is that the spelling
       still resolves and still says so, which the two lines above hold. */

    await act(async () => root.unmount());
  });

  test("the notice for a retired view does not point at UI that may not be there", async () => {
    /*
     * IT USED TO SAY "at the end of the bar above" AND WAS WRONG TWICE.
     * Notices render ABOVE the index, so the bar is below rather than above —
     * and a query matching nothing renders no index at all, so on that page
     * the sentence named a control that was not on it.
     *
     * The engine cannot fix either by rewording, because both are facts about
     * a rendering it cannot see. So it describes the query and stops, and this
     * is the test that keeps it there.
     *
     * THE CONTROL IT POINTED AT HAS SINCE BEEN DELETED, which strengthens the
     * rule rather than retiring it: a notice naming a control is now wrong on
     * every page rather than on one, and the fix is still that the engine
     * describes the query it parsed and nothing about the page.
     */
    const root = await ask("zzzznotacard display:text");

    expect(shown()).toContain("Nothing matches");
    /* No index at all, which is the case the old wording promised a control
       in. It was asserted as a count of that control until the control went. */
    expect(document.querySelectorAll(".of-index__controls").length).toBe(0);

    const notices = [...document.querySelectorAll(".of-cards__notice")].map(
      (node) => node.textContent ?? "",
    );
    expect(notices.some((text) => text.includes("display:list"))).toBe(true);
    for (const text of notices) {
      expect(text).not.toMatch(/\babove\b|\bbelow\b|copy control/);
    }

    await act(async () => root.unmount());
  });
});

/*
 * PAGING, WHICH UNTIL NOW NOTHING RAN.
 *
 * `pagination.ts` is tested exhaustively as arithmetic and `Pagination` is
 * tested as static markup, but the seam between them — a real click on a real
 * anchor, and what the PAGE does about it — was covered by nothing. The defect
 * below was found by reading that gap rather than by a failing test, which is
 * the argument for closing it here.
 */
describe("turning a page moves the reader, not just the rows", () => {
  /** A query broad enough that there is a second page to go to. */
  async function askBroad(): Promise<Mounted> {
    const form = shell();
    const root = await mount(form);
    const field = fieldIn(form);
    await type(field, "type:action");
    await act(async () => {
      field.form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    return root;
  }

  /** The pager's own "Next", as a reader's unmodified left click. */
  async function clickNext(): Promise<void> {
    const next = document.querySelector('.of-pages__step[rel="next"]');
    if (!(next instanceof HTMLAnchorElement)) throw new Error("no next link");
    await act(async () => {
      next.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
  }

  test("focus lands on the count, not on the pager the reader left", async () => {
    /*
     * THE DEFECT THIS IS FOR. `pushState` moves no focus, so before this the
     * reader who clicked "Next" was scrolled to the top of page 2 with focus
     * still on an anchor now sitting under page 2's FOOT — and the next Tab
     * carried on from the end of a page they had not seen the start of.
     */
    const root = await askBroad();
    await clickNext();

    expect(window.location.search).toContain("page=2");
    const focused = document.activeElement;
    expect(focused?.className).toContain("of-index__count");
    /* And it says which slice arrived, which is what makes the move audible
       rather than merely correct. */
    expect(focused?.textContent ?? "").toMatch(/\d/);

    await act(async () => root.unmount());
  });

  test("the count is reachable by script and never by Tab", async () => {
    /* `tabIndex={-1}` is the whole contract: a reader who never turns a page
       must not acquire a stop in the tab order for the privilege. */
    const root = await askBroad();

    const count = document.querySelector(".of-index__count");
    expect(count?.getAttribute("tabindex")).toBe("-1");

    await act(async () => root.unmount());
  });
});

/**
 * The row of faces the browse state opens on.
 *
 * HAND-WRITTEN RATHER THAN `CARD_NEWEST`, and the reason is the same one that
 * keeps `brief` local: `ssg/searchIndexes.ts` is the build's, and what is under
 * test here is what the COMPONENT does with a row it is handed. Deriving the
 * fixture from the same module the page derives the real one from would make
 * both sides of the assertion one expression.
 */
const newest: NewestRelease = {
  name: "Part the Mistveil",
  code: "mst",
  released: "2024-11-15",
  cards: [
    {
      key: "MST001.webp",
      href: "/card/mst/001/nuu-alluring-desire",
      label: "Nuu, Alluring Desire",
      typeLine: "Assassin Hero",
      faceKey: "MST001.webp",
    },
    {
      key: "MST002.webp",
      href: "/card/mst/002/mask-of-the-pouncing-lynx",
      label: "Mask of the Pouncing Lynx",
      typeLine: "",
      faceKey: "MST002.webp",
    },
  ],
};

/** Mount the browse state — no query asked, with or without a newest release. */
async function browse(row: NewestRelease | null): Promise<Mounted> {
  const form = shell();
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  const headerRoot: Root = createRoot(form);
  const root: Root = createRoot(host);
  await act(async () => {
    headerRoot.render(<HeaderSearch />);
    root.render(<CardSearch indexUrl={INDEX_URL} brief={brief} newest={row} />);
  });
  return {
    unmount: () => {
      root.unmount();
      headerRoot.unmount();
    },
  };
}

/**
 * WHAT THE PAGE IS BEFORE ANYBODY HAS ASKED IT ANYTHING.
 *
 * This state is what a reader reaches from the header's "Cards" link — and,
 * until a card page's breadcrumb started naming the set it was printed in, from
 * every one of those too — so it is among the most-arrived-at screens on the
 * site after the front door, and it had no test of its own at all. The three
 * things asserted here are the three that were wrong or absent before: the pin
 * is printed WITHOUT the index (`docs/DATA-TERMS.md` requires it and a fetch
 * must not gate it), the release row draws the printings it is handed, and an
 * absent
 * release costs the type lines nothing.
 *
 * NOTHING HERE WAITS FOR THE INDEX, deliberately — `settle()` is absent from
 * every test below. That is the property under test: a browse that needed the
 * index would be a browse that is blank on a slow connection.
 */
describe("the browse state stands up without an index", () => {
  test("it prints the pin and every type line the brief carries", async () => {
    const root = await browse(null);

    const pin = document.querySelector(".of-cards__count")?.textContent ?? "";
    expect(pin).toContain(brief.commit.slice(0, 7));
    expect(pin).toContain(brief.confirmed);

    /* The state names itself, and names itself the same way whatever the
       corpus holds: this heading is a constant, where the line it replaced was
       the card count at display size. */
    expect(document.querySelector(".of-browse__lede")?.textContent).toBe(
      "All cards",
    );

    expect(document.querySelectorAll(".of-cards__browse li")).toHaveLength(
      brief.browse.length,
    );

    await act(async () => root.unmount());
  });

  test("no release to show costs the type lines nothing", async () => {
    const root = await browse(null);

    expect(document.querySelector(".of-browse__faces")).toBeNull();
    expect(
      document.querySelectorAll(".of-cards__browse li").length,
    ).toBeGreaterThan(0);

    await act(async () => root.unmount());
  });

  test("the release row draws the PRINTINGS it is handed", async () => {
    const root = await browse(newest);

    const faces = [...document.querySelectorAll(".of-browse__faces img")];
    expect(faces).toHaveLength(newest.cards.length);

    /*
     * THE FACE AND THE ADDRESS ARE CARRIED, NEVER RECONSTRUCTED, which is the
     * half of the guarantee this file can see. A component that built either
     * from the label or the key would draw a row that agrees with itself and
     * disagrees with the router.
     *
     * THE OTHER HALF IS NOT HERE, and it is worth being exact about that. The
     * bug this row was built wrong by the first time — showing each card's
     * DEFAULT art, so "Newest: Mastery Pack Warrior" appeared over faces keyed
     * `DDD001` and `HVY093` — is a defect of the DERIVATION, not of this
     * component: hand this component a wrong row and it will draw the wrong row
     * faithfully. `ssg.test.ts` holds `CARD_NEWEST` to belonging to its own set,
     * which is where that assertion can actually be made.
     */
    for (const [index, img] of faces.entries()) {
      const card = newest.cards[index];
      if (card === undefined) throw new Error("missing fixture card");
      expect(img.getAttribute("src")).toContain(card.faceKey);
    }

    const links = [
      ...document.querySelectorAll<HTMLAnchorElement>(".of-browse__face a"),
    ].map((anchor) => anchor.getAttribute("href"));
    expect(links).toEqual(newest.cards.map((card) => card.href));

    await act(async () => root.unmount());
  });

  test("a card with no type line is named by its label alone", async () => {
    const root = await browse(newest);

    const alts = [...document.querySelectorAll(".of-browse__faces img")].map(
      (img) => img.getAttribute("alt"),
    );

    /* `""` is upstream's "no type line", and it must not reach a reader as an
       em dash with nothing after it. */
    expect(alts).toEqual([
      "Nuu, Alluring Desire — Assassin Hero",
      "Mask of the Pouncing Lynx",
    ]);

    await act(async () => root.unmount());
  });
});
