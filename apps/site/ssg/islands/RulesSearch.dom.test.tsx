/**
 * `RulesSearch` against a real DOM — the second runtime test in this repo.
 *
 * WHY IT EXISTS. This is the island the whole of Phase 4 rests on: `docs/
 * ROADMAP.md` puts every rules paragraph at a permanent URL, and this component
 * is what turns a typed word into one of those URLs. It was the second-worst
 * file in the tree by uncovered lines — **134 of them** — because everything it
 * does is a browser doing it. `ssg.test.ts` renders its markup and reads
 * strings, which sees the server render and nothing after it: the URL sync, the
 * three index states, Escape, submit, popstate and the page turn are all
 * invisible to a test that never hydrates.
 *
 * WHAT IS HERE, AND WHAT DELIBERATELY IS NOT. The ranking itself is covered
 * exhaustively by `src/lib/search.test.ts` against the real corpus, and the
 * pager's arithmetic by `src/lib/pagination.test.ts`. Repeating either would be
 * slower and no truer. What is here is the seam: the things that are only true
 * once there is a `window`, a `history` and a `fetch`.
 *
 * THE DOM IS TAKEN AND HANDED BACK THROUGH `./domHarness.ts`, for the reasons
 * `CardSearch.dom.test.tsx` sets out at length — `bun test` runs every file in
 * one process, and a DOM left standing reaches the 61 assertions in
 * `packages/components/src/react/a11y.test.tsx`, which build their own. What
 * this file added is the second holder, and with it the two teardown races a
 * single `register()`/`unregister()` pair per file cannot survive. Both are
 * written up in that module.
 */

import { holdDom, releaseDom } from "./domHarness";

holdDom("https://optfall.com/cr");

/* React's own flag. Without it `act` does not flush and every assertion below
   races the update it is asserting on — see `CardSearch.dom.test.tsx`. */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { CORPUS } from "../../src/lib/rules";
import { buildIndex, chapters, decodeIndex } from "../../src/lib/search";
import { RulesSearch } from "./RulesSearch";
import { searchIndexClient } from "./useSearchIndex";

/**
 * The real index, for the same reason `CardSearch.dom.test.tsx` uses a real
 * one: a stub would let a query "work" while returning nothing, which is the
 * shape of bug this file is here to catch.
 */
const encoded = buildIndex(CORPUS);
const browse = chapters(decodeIndex(encoded));

/** Where the index is served from, asserted rather than ignored. */
const INDEX_URL = "/assets/rules-index-under-test.json";
/** An address whose fetch never settles, for the in-flight state. */
const PENDING_URL = "/assets/rules-index-never-arrives.json";
/** An address that answers 503, for the failed state. */
const FAILING_URL = "/assets/rules-index-broken.json";

globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === "string" ? input : String(input);
  if (url === INDEX_URL) {
    return new Response(JSON.stringify(encoded), {
      headers: { "content-type": "application/json" },
    });
  }
  if (url === FAILING_URL) return new Response("no", { status: 503 });
  /* Never settles. The component has to say what it is waiting for while this
     is outstanding, which is the whole of the `pending` branch. */
  if (url === PENDING_URL) return new Promise<Response>(() => {});
  throw new Error(`unexpected fetch: ${url}`);
}) as typeof fetch;

/** The rules version, as `cr.page.tsx` passes it. */
const VERSION = CORPUS.version;

/**
 * Wait for the index request to land.
 *
 * IT WAITS FOR THE CACHED DATA, NOT FOR `isFetching() === 0` — "nothing is
 * fetching" is also true in the tick BEFORE React's effect starts the request,
 * so a helper resting on it returns immediately and settles nothing. It throws
 * rather than giving up quietly, because a settle helper that returns after N
 * ticks whether or not anything happened is how a suite passes for the wrong
 * reason.
 */
async function settle(url = INDEX_URL): Promise<void> {
  for (let tick = 0; tick < 50; tick += 1) {
    if (searchIndexClient.getQueryData(["search-index", url])) return;
    await tick_();
  }
  throw new Error("the rules index never finished loading");
}

/** One flushed macrotask. */
async function tick_(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
  });
}

/** Let both debounced effects fire. See `SETTLE` in the component. */
async function debounce(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });
}

interface Mounted {
  readonly unmount: () => void;
}

/** Mount the island into `#root`, at whatever address the test has set. */
async function mount(indexUrl = INDEX_URL): Promise<Mounted> {
  document.body.innerHTML = `<main><div id="root"></div></main>`;
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(
      <RulesSearch indexUrl={indexUrl} browse={browse} version={VERSION} />,
    );
  });
  if (indexUrl === INDEX_URL) await settle();
  /* One more flush so the mount effect's `setQuery` from `?q=` has rendered.
     Without it every test that arrives with a query asserts the browse. */
  await tick_();
  return { unmount: () => root.unmount() };
}

/** The field the island renders and owns. */
function fieldNode(): HTMLInputElement {
  const field = document.querySelector(".of-search__field");
  if (!(field instanceof HTMLInputElement)) throw new Error("no field");
  return field;
}

/** The count line, which is what the page is claiming to have found. */
function count(): string {
  return document.querySelector(".of-rules__count")?.textContent?.trim() ?? "";
}

/** Every citation on the page, in order — the answer itself. */
function cited(): string[] {
  return [...document.querySelectorAll(".of-rules__result")].map(
    (row) => row.querySelector(".of-citation")?.textContent?.trim() ?? "",
  );
}

/** What the live region is currently announcing. */
function announced(): string {
  return (
    document.querySelector(".of-rules__announcement")?.textContent?.trim() ?? ""
  );
}

/** The address, as a reader would copy it. */
function address(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Set an input's value the way a KEYSTROKE does, past React's value tracker.
 *
 * `field.value = text` does not work on a controlled input and fails silently:
 * React installs its own `value` setter as its change detection, so an ordinary
 * assignment updates the tracker in the same breath and `onChange` never fires.
 * `CardSearch.dom.test.tsx` carries the full account.
 */
function nativeValue(field: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (setter === undefined) throw new Error("no prototype value setter");
  setter.call(field, text);
}

/** Type, as a real `input` event rather than as a state poke. */
async function type(text: string): Promise<void> {
  const field = fieldNode();
  await act(async () => {
    nativeValue(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Go to an address without reloading, the way a test arranges its scenario. */
function at(url: string): void {
  window.history.replaceState(null, "", url);
}

beforeEach(() => {
  at("/cr");
  /* THE QUERY CACHE OUTLIVES A TEST, because the client is a module constant —
     which is what makes it a cache in the first place. Without this, the test
     that asserts the in-flight state would find the previous test's index
     already sitting under its own key. */
  searchIndexClient.clear();
});

afterAll(async () => {
  await releaseDom();
});

describe("before anything is asked", () => {
  test("the chapter browse is the page, and it needs no index", async () => {
    const root = await mount();
    expect(count()).toBe("Start with a chapter, or type above.");
    /* The nine chapters, by citation, so this cannot pass on some other list.
       They come from the `browse` prop — the reason `/cr` renders without a
       fetch at all for a reader who has not typed. */
    expect(cited()).toEqual(browse.map((chapter) => chapter.id));
    root.unmount();
  });

  test("the rule above the fold is named Chapters, not Results", async () => {
    const root = await mount();
    /* `OrnamentalRule` puts its label on the `<hr>` as an accessible name
       rather than as visible text, so this is the only place it can be read —
       and it is the one thing on the page that says which of the two things
       under the field is being shown. */
    expect(
      document.querySelector(".of-rule__line")?.getAttribute("aria-label"),
    ).toBe("Chapters");
    root.unmount();
  });

  test("and it says Results once something has been asked", async () => {
    at("/cr?q=dominate");
    const root = await mount();
    expect(
      document.querySelector(".of-rule__line")?.getAttribute("aria-label"),
    ).toBe("Results");
    root.unmount();
  });
});

describe("the query in the URL is the answer on the page", () => {
  test("`?q=` is read on mount and answered", async () => {
    at("/cr?q=dominate");
    const root = await mount();
    expect(fieldNode().value).toBe("dominate");
    expect(count()).toBe("9 sections match.");
    expect(cited().length).toBe(9);
    root.unmount();
  });

  test("`?page=` and `?per=` are read with it", async () => {
    at("/cr?q=attack&page=2&per=30");
    const root = await mount();
    /* 188 matches at 30 a page is seven pages, and this is the second. */
    expect(count()).toBe("188 sections match. Page 2 of 7.");
    expect(cited().length).toBe(30);
    root.unmount();
  });

  /*
   * THE CLAMP, which is the only path that ranks twice. A pasted link can name
   * a page a smaller answer no longer has; the component re-runs the search
   * against the clamped window rather than rendering an empty list under a
   * count that says there are results.
   */
  test("a page past the end renders the last page rather than nothing", async () => {
    at("/cr?q=dominate&page=9");
    const root = await mount();
    expect(cited().length).toBeGreaterThan(0);
    expect(count()).toContain("9 sections match.");
    root.unmount();
  });
});

describe("each ranking tier explains why the row is there", () => {
  /*
   * `why()` turns `matchedIn` into the words under a result. Every branch of it
   * is reachable from the committed CR corpus, and each query below was chosen
   * by asking the index which tier it produces rather than by reading the rules.
   */
  const meta = (): string[] =>
    [...document.querySelectorAll(".of-rules__why")].map(
      (node) => node.textContent?.trim() ?? "",
    );

  test("a section id matched as an id", async () => {
    at("/cr?q=1.0.1a");
    const root = await mount();
    expect(meta()).toContain("section id");
    root.unmount();
  });

  test("a parent matched through its children", async () => {
    at("/cr?q=1.0");
    const root = await mount();
    expect(meta().some((why) => why.startsWith("under "))).toBe(true);
    root.unmount();
  });

  test("a heading matched as a heading, and body text as its terms", async () => {
    at("/cr?q=attack");
    const root = await mount();
    expect(meta()).toContain("heading");
    /* The text tier prints the matched words themselves, joined by a middot. */
    expect(meta()).toContain("attack");
    root.unmount();
  });
});

describe("what the engine says, the page says", () => {
  test("a notice is rendered in the engine's own words", async () => {
    at("/cr?q=the");
    const root = await mount();
    const notices = [...document.querySelectorAll(".of-rules__notice")].map(
      (node) => node.textContent?.trim() ?? "",
    );
    /* `the` is indexed out as too common; the engine's notice says so and this
       surface reprints it rather than paraphrasing. */
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.join(" ")).toContain("the");
    root.unmount();
  });

  test("nothing matching says so, and names the version it looked in", async () => {
    at("/cr?q=zzzznotaword");
    const root = await mount();
    expect(count()).toContain("zzzznotaword");
    expect(count()).toContain(VERSION);
    expect(cited()).toEqual([]);
    root.unmount();
  });
});

describe("a question nothing can answer yet is not a question nothing matches", () => {
  /*
   * THIS IS THE DISTINCTION `LLM_STATEMENT.md` MAKES NON-OPTIONAL. Rendering
   * the empty-result copy while the index is in flight tells a reader the
   * Comprehensive Rules do not contain a word they can see in them — a
   * confident wrong answer, which is the one shape that rule forbids outright.
   */
  test("in flight, the page says what it is waiting for", async () => {
    at("/cr?q=dominate");
    const root = await mount(PENDING_URL);
    expect(count()).toContain("Loading the rules index");
    expect(count()).toContain("dominate");
    expect(count()).not.toContain("Nothing");
    root.unmount();
  });

  test("failed, it says so and offers the chapters that still work", async () => {
    /*
     * RETRY IS OFF FOR THIS ONE TEST, and it is the harness rather than the
     * subject. The shipped policy is two retries with exponential backoff,
     * which is right for a reader and would spend three seconds of wall clock
     * here to reach a state the first attempt already determines. What is under
     * test is what the component renders once `failed` is true, not how many
     * attempts it took to get there.
     */
    const defaults = searchIndexClient.getDefaultOptions();
    searchIndexClient.setDefaultOptions({
      ...defaults,
      queries: { ...defaults.queries, retry: false },
    });
    try {
      at("/cr?q=dominate");
      const root = await mount(FAILING_URL);
      for (let tick = 0; tick < 50 && count().includes("Loading"); tick += 1) {
        await tick_();
      }
      expect(count()).toContain("did not load");
      /* DEGRADE VISIBLY: every section is still addressable, so the failure is
         stated alongside the routes that still work rather than as an apology.
         The chapter browse is that route, and it is the same list the empty
         query renders — spelled once in the component for exactly this reason. */
      expect(cited()).toEqual(browse.map((chapter) => chapter.id));
      root.unmount();
    } finally {
      searchIndexClient.setDefaultOptions(defaults);
    }
  });
});

describe("the field", () => {
  test("typing answers in place and puts the query in the address", async () => {
    const root = await mount();
    await type("dominate");
    expect(count()).toBe("9 sections match.");
    /* Debounced: the address follows the field, one navigation per query
       rather than one per letter. */
    expect(address()).toBe("/cr");
    await debounce();
    expect(address()).toBe("/cr?q=dominate");
    root.unmount();
  });

  /*
   * TYPING RESETS THE PAGE AND READING THE URL MUST NOT. The component makes
   * that a handler on the field rather than an effect on `query`, because an
   * effect cannot tell a keystroke from the mount lifting `?q=` out of the URL
   * — and resetting on the latter opens a pasted `?page=3` link on page one.
   */
  test("a keystroke is page one; arriving on page three is not", async () => {
    at("/cr?q=attack&page=3");
    const root = await mount();
    expect(count()).toContain("Page 3 of");
    await type("dominate");
    expect(count()).toBe("9 sections match.");
    await debounce();
    expect(address()).toBe("/cr?q=dominate");
    root.unmount();
  });

  /*
   * ESCAPE IS NOT TESTED HERE, AND IT IS NOT AN OVERSIGHT. This component
   * clears the field from `SearchField`'s `onKeyDown`, which is one of React's
   * DELEGATED listeners — and React's delegated keydown does not fire under
   * happy-dom at all. `HeaderSearch` hit the same wall and answered it by
   * attaching a native `keydown` listener to the node it owns; that was worth
   * doing there because the field belongs to another root and the listener had
   * to be native anyway.
   *
   * Restructuring this island's handler purely so a test could reach it would
   * be changing shipped code to satisfy a harness, which is the failure the
   * audit that prompted this work warned about by name. So the gap is recorded
   * instead: Escape clears the field in a browser and nothing here proves it.
   */

  test("submitting pushes a history entry and gives the field back", async () => {
    const root = await mount();
    await type("dominate");
    const before = window.history.length;
    const form = document.querySelector("form.of-search");
    if (!(form instanceof HTMLFormElement)) throw new Error("no form");
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
    /* A submit is the deliberate act, so it is the one that gets a real entry
       — typing only ever replaces. */
    expect(address()).toBe("/cr?q=dominate");
    expect(window.history.length).toBeGreaterThan(before - 1);
    expect(document.activeElement).not.toBe(fieldNode());
    root.unmount();
  });
});

describe("the live region", () => {
  /*
   * The results move on every keystroke because that is what makes the field
   * feel like a tool; announcing on every keystroke would make a screen reader
   * unusable, since each interruption cancels the last. So the region settles
   * and speaks once — which means it is SILENT immediately after typing, and
   * that silence is the assertion.
   */
  test("it settles before it speaks, then speaks once", async () => {
    const root = await mount();
    await type("dominate");
    expect(announced()).toBe("");
    await debounce();
    expect(announced()).toBe("9 sections match.");
    root.unmount();
  });

  test("it is on the page before it has anything to say", async () => {
    const root = await mount();
    const region = document.querySelector(".of-rules__announcement");
    /* Added at the moment it has something to say, it would say nothing: a
       live region has to be in the document before the text changes. */
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("role")).toBe("status");
    root.unmount();
  });
});

describe("history", () => {
  test("back and forward re-answer rather than leaving the last result up", async () => {
    at("/cr?q=dominate");
    const root = await mount();
    expect(count()).toBe("9 sections match.");

    /* What a back button does: change the address, then fire `popstate`. */
    at("/cr?q=attack&per=30");
    await act(async () => {
      window.dispatchEvent(new Event("popstate"));
    });
    expect(fieldNode().value).toBe("attack");
    expect(count()).toBe("188 sections match. Page 1 of 7.");
    root.unmount();
  });
});

describe("turning a page", () => {
  test("moves the answer, the address and the focus together", async () => {
    at("/cr?q=attack&per=30");
    const root = await mount();
    const first = cited();

    const next = document.querySelector('.of-pages a[aria-label="Page 2"]');
    if (!(next instanceof HTMLElement)) throw new Error("no link to page 2");
    await act(async () => {
      next.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    });

    expect(count()).toContain("Page 2 of 7");
    expect(cited()).not.toEqual(first);
    /* The order is the URL's own: `writeQueryUrl` edits the parameters that
       are already there and appends the ones that are not, so `per` — which
       arrived in the address — keeps its place ahead of the `page` this click
       added. */
    expect(address()).toBe("/cr?q=attack&per=30&page=2");
    /*
      FOCUS GOES WHERE THE SCROLL WENT. `pushState` moves no focus, so without
      this the reader ends up reading page 2 with focus still on page 1's pager
      — and the live region cannot cover it, because it settles for 600ms before
      it speaks and a click has already happened.
    */
    expect(document.activeElement?.className).toContain("of-rules__count");
    root.unmount();
  });
});
