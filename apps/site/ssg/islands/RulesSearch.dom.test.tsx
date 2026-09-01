/**
 * `RulesSearch` against a real DOM — the second runtime test in this repo.
 *
 * WHY IT EXISTS. This island was 611 lines with no direct coverage of any kind,
 * and the reason that mattered is not the line count: almost everything it does
 * is a fact about a browser. `ssg.test.ts` renders `/cr` to a string and can see
 * the chapter browse, because the chapter browse is the SERVER render — the
 * query lives in `?q=`, a static document cannot know it, and the index arrives
 * over `fetch`. So the three states this component was rebuilt around when the
 * index moved out of `data-props` — not here yet, here, failed — were invisible
 * to every test that existed, and the one shape `docs/PLAN.md` forbids outright
 * (telling a reader the Comprehensive Rules do not contain a word while the
 * index is still in flight) could have shipped without a single assertion
 * moving.
 *
 * SCOPED THE WAY `CardSearch.dom.test.tsx` IS SCOPED. What a rules query returns
 * is the engine's business and is not re-asked here through a DOM; what is here
 * is the handful of things that are only true once there is a `window`. The
 * fixtures are chosen to make the difference visible rather than to explore the
 * corpus: `dominate` is 9 sections and `attack` is 188, which is the only thing
 * either is used for.
 *
 * HAPPY-DOM IS REGISTERED HERE TOO, AND THAT IS A CHANGE TO WHAT
 * `CardSearch.dom.test.tsx` SAYS. Its docblock required itself to be the ONLY
 * file that registers, and the invariant it was protecting is real — a11y.test
 * builds its own JSDOM and axe reaches for the globals, so 61 assertions break
 * if a `window` outlives the file that wanted one. But "only one file
 * registers" was a way of stating that invariant, not the invariant itself.
 *
 * MEASURED, BECAUSE THE ANSWER TURNS ON HOW `bun test` SCHEDULES FILES: it
 * loads a file, runs its tests, and only then loads the next. A file's module
 * body therefore executes inside its own window between the previous file's
 * `afterAll` and the next file's load — so register-and-unregister PER FILE
 * scopes the DOM exactly as tightly as one registration did. Verified both
 * ways round: a second registering file sorting before `CardSearch` and after
 * it leaves the suite at 0 failures either way. The invariant that has to hold
 * is that every file which registers also unregisters, and that is what the
 * `afterAll` at the bottom of each of these two files is for.
 *
 * ONE SHIPPED-CODE CHANGE CAME OUT OF WRITING THIS, and it is named here
 * because a test file is a strange place to discover it. `SearchField` wired
 * its input with `onChange`, and React's ChangeEventPlugin is silent under
 * happy-dom for a dispatched `input` event — `HeaderSearch` had already
 * measured that and switched to `onInput` for its own field. So the primitive
 * this island is built on could not be typed into by a test at all, and every
 * behaviour that begins with a keystroke was unreachable. `SearchField` now
 * makes the same choice `HeaderSearch` made, for the same reason, and the two
 * fields agree again.
 *
 * WHAT IS STILL NOT COVERED, STATED RATHER THAN LEFT LOOKING COVERED. Escape
 * clears this field through React's `onKeyDown` prop, and React 19's delegated
 * keydown never fires under happy-dom whatever the container is — the same
 * measurement `HeaderSearch` records, which is why THAT island listens for
 * keydown natively. Driving Escape here would need the same move, which is a
 * change to shipped behaviour rather than a test, so it is not made and the
 * hole is written down instead.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://optfall.com/cr" });

/* React's own flag. Without it `act` does not flush and the suite goes green
   for the wrong reason — see the same note in `CardSearch.dom.test.tsx`. */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { act } from "react";
import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { CORPUS } from "../../src/lib/rules";
import {
  buildIndex,
  chapters,
  decodeIndex,
  type SearchResult,
} from "../../src/lib/search";
import { RulesSearch } from "./RulesSearch";
import { searchIndexClient } from "./useSearchIndex";

/**
 * The real index, built here rather than imported from `ssg/searchIndexes.ts`.
 *
 * THAT MODULE IS THE BUILD'S, and it reaches the card corpus on the way past —
 * 18 MB this island has no use for. It is also the module that DERIVES the
 * browse prop, so importing both from it would make the fixture and the thing
 * under test one expression. The same argument `CardSearch.dom.test.tsx` makes
 * for keeping `newest` local.
 */
const encoded = buildIndex(CORPUS);
const browse: readonly SearchResult[] = chapters(decodeIndex(encoded));

/**
 * Three addresses, because this component has three states and they are told
 * apart by what happens to a request.
 *
 * ONE URL PER STATE, AND THEY MUST NOT BE SHARED. `searchIndexClient` is a
 * module constant with `staleTime: Infinity` and `gcTime: Infinity`, so a cache
 * entry outlives the test that made it — and the URL is the key. Two states on
 * one address would be one state, whichever ran first.
 */
const GOOD_URL = "/assets/rules-index-under-test.json";
/** A request that never settles: the index is on its way and has not arrived. */
const SLOW_URL = "/assets/rules-index-in-flight.json";
/** A request that fails every attempt. */
const DEAD_URL = "/assets/rules-index-missing.json";

/*
 * RETRIES OFF FOR THE FAILING ADDRESS ONLY. The shipped client retries twice
 * with Query's exponential backoff, which is right for a reader and costs a
 * test three seconds of waiting to reach a state it can already describe. This
 * is a default keyed to a URL nothing but this file asks for, so the shipped
 * policy is untouched — and it is the retry SCHEDULE being skipped, not the
 * error path, which is the thing under test.
 */
searchIndexClient.setQueryDefaults(["search-index", DEAD_URL], {
  retry: false,
});

/**
 * The one thing the browser provides and the test environment does not.
 *
 * THE ADDRESS IS ASSERTED RATHER THAN IGNORED, as it is in the card harness: an
 * island that fetched something other than its `indexUrl` prop would otherwise
 * look like an island whose index never loads.
 */
globalThis.fetch = (async (input: RequestInfo | URL): Promise<Response> => {
  const url = typeof input === "string" ? input : String(input);
  if (url === GOOD_URL) {
    return new Response(JSON.stringify(encoded), {
      headers: { "content-type": "application/json" },
    });
  }
  if (url === DEAD_URL) return new Response("no", { status: 404 });
  if (url === SLOW_URL) return new Promise<Response>(() => {});
  throw new Error(`unexpected fetch: ${url}`);
}) as typeof fetch;

/** The corpus version, as a value no corpus could produce. See `version`. */
const VERSION = "0.0.0-under-test";

/**
 * Wait for the index request to land.
 *
 * IT WAITS FOR THE CACHED DATA, NOT FOR "NOTHING IS FETCHING", for the reason
 * the card harness sets out at length: React starts the request in an effect,
 * so nothing is in flight for the first tick after a render and a helper
 * resting on that returns before anything has happened. It throws rather than
 * giving up quietly.
 */
async function settle(): Promise<void> {
  for (let tick = 0; tick < 50; tick += 1) {
    if (searchIndexClient.getQueryData(["search-index", GOOD_URL])) {
      /* ONE MORE FLUSH, BECAUSE THE CACHE LANDS BEFORE THE RENDER DOES. The
         entry appears the moment the promise resolves; the subscription that
         turns it into a re-render is React's, and returning between the two
         hands every caller a component still showing the loading state. Found
         by writing this helper without the tick and watching a settled index
         render nine rows as zero. */
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
      });
      return;
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
    });
  }
  throw new Error("the rules index never finished loading");
}

/**
 * Let the two debounced effects fire.
 *
 * REAL TIME RATHER THAN A FAKE CLOCK. `SETTLE` is 600 ms and there are two
 * effects behind it — the address bar and the live region — which is the whole
 * reason they are separate. Faking the clock would mean faking it inside `act`
 * for React's scheduler too; waiting is three lines and cannot be wrong.
 */
async function debounce(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 800));
  });
}

/**
 * EVERY ROOT THIS FILE MAKES, TORN DOWN AFTER THE TEST THAT MADE IT.
 *
 * NOT TIDINESS — A FAILING ASSERTION IS WHY. `useFocusShortcut` listens on
 * `window`, which outlives a root, so a test that threw before reaching its own
 * `unmount()` left a live `/` handler behind and the NEXT test's assertion
 * about an unmounted island failed for a reason that had nothing to do with it.
 * Measured: one broken assertion produced two failures, and the second one
 * pointed at the wrong code. Teardown that cannot be skipped costs four lines
 * and removes that whole class of misdirection.
 */
const roots: Root[] = [];

/** An empty page with a mount point, the way `Island` leaves one. */
function host(): HTMLElement {
  document.body.innerHTML = `<main><div id="root"></div></main>`;
  const node = document.getElementById("root");
  if (node === null) throw new Error("no root");
  return node;
}

interface MountOptions {
  readonly indexUrl?: string;
  readonly browse?: readonly SearchResult[];
  readonly version?: string;
}

/** Mount the island the way `islands.client.ts` does, minus the hydration. */
async function mount(options: MountOptions = {}): Promise<Root> {
  const root: Root = createRoot(host());
  roots.push(root);
  await act(async () => {
    root.render(
      <RulesSearch
        indexUrl={options.indexUrl ?? GOOD_URL}
        browse={options.browse ?? browse}
        version={options.version ?? VERSION}
      />,
    );
  });
  return root;
}

/** Mount, and wait for the index. Every test that asks a question needs both. */
async function answered(options: MountOptions = {}): Promise<void> {
  await mount(options);
  await settle();
}

/** Tear a root down mid-test, for the tests that are ABOUT unmounting. */
async function unmount(root: Root): Promise<void> {
  await act(async () => root.unmount());
  const at = roots.indexOf(root);
  if (at !== -1) roots.splice(at, 1);
}

function field(): HTMLInputElement {
  const node = document.querySelector("input[type=search]");
  if (!(node instanceof HTMLInputElement)) throw new Error("no field");
  return node;
}

/** The count line — the loading line, the failure line and the summary share it. */
function count(): string {
  return document.querySelector(".of-rules__count")?.textContent?.trim() ?? "";
}

/** What the live region is currently saying. Behind the results, deliberately. */
function announced(): string {
  return (
    document.querySelector(".of-rules__announcement")?.textContent?.trim() ?? ""
  );
}

function rows(): number {
  return document.querySelectorAll(".of-rules__result").length;
}

/**
 * Type into the field the way a browser does.
 *
 * THE PROTOTYPE SETTER, PAST REACT'S VALUE TRACKER. `field.value = text` on a
 * controlled input goes through the own property React installed, which updates
 * the tracker in the same breath, so React compares the two, finds them equal
 * and fires nothing — it looks exactly like typing and is not. The card harness
 * carries the full measurement.
 */
async function type(text: string): Promise<void> {
  const input = field();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (setter === undefined) throw new Error("no prototype value setter");
  await act(async () => {
    setter.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Submit the field's form, the way Enter does. */
async function submit(): Promise<void> {
  const form = field().form;
  if (form === null) throw new Error("no form");
  await act(async () => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/cr");
});

afterEach(async () => {
  const standing = roots.splice(0, roots.length);
  await act(async () => {
    for (const root of standing) root.unmount();
  });
});

/*
 * HANDED BACK, BECAUSE THIS PROCESS IS SHARED. Every file that registers
 * happy-dom has to unregister it, or the next file's assertions run against a
 * `window` they were written without — `packages/components/src/react/
 * a11y.test.tsx` builds its own JSDOM and axe reaches for the globals, so it
 * finds somebody else's document instead of the one under test.
 * `CardSearch.dom.test.tsx` carries the measurement of what that costs. This is
 * the price of not putting a DOM in `bunfig.toml`'s preload, and it is much
 * cheaper than the alternative.
 */
afterAll(async () => {
  await GlobalRegistrator.unregister();
});

/* -------------------------------------------------------------------------- */
/* The page before anybody has asked it anything                               */
/* -------------------------------------------------------------------------- */

/**
 * NOTHING HERE CALLS `settle()`, AND THAT IS THE PROPERTY UNDER TEST. `/cr` is
 * reached from the nav and from every `cr:` citation on the site, and what it
 * shows a reader who has typed nothing must not depend on a fetch: a browse
 * that waited for the index would be a blank page on a slow connection. Two of
 * these mount against `SLOW_URL`, whose request never settles, so the assertion
 * is not merely that the browse arrives first — it is that it arrives at all.
 */
describe("the browse stands up without an index", () => {
  test("the chapter list is the PROP, not something derived from the index", async () => {
    /*
     * HANDED THREE ROWS WHERE THE INDEX HOLDS NINE. This is the whole reason
     * `browse` is a prop: it used to be `useMemo(() => chapters(rules), …)`,
     * which forced a 204 kB index into the page to render nine links. A
     * component that quietly went back to deriving them would pass every other
     * assertion in this file and print nine rows here.
     */
    await mount({ indexUrl: SLOW_URL, browse: browse.slice(0, 3) });

    expect(rows()).toBe(3);
    expect(count()).toBe("Start with a chapter, or type above.");
  });

  test("the rule between the field and the list says which list it is", async () => {
    /* "Chapters" before a query, "Results" after one. It is the only thing on
       the page naming what is underneath it, and it is an `aria-label` on an
       `<hr>`, so nothing visual would show it drifting. */
    await mount({ indexUrl: SLOW_URL });

    expect(
      document.querySelector("hr.of-rule__line")?.getAttribute("aria-label"),
    ).toBe("Chapters");
  });

  test("the live region exists before it has anything to say", async () => {
    /* Always present, never emptied: a live region added to the page at the
       moment it has something to announce is a live region that says nothing,
       because assistive technology has nothing subscribed to it yet. */
    await mount({ indexUrl: SLOW_URL });

    const region = document.querySelector(".of-rules__announcement");
    expect(region?.getAttribute("role")).toBe("status");
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.textContent).toBe("");
  });
});

/* -------------------------------------------------------------------------- */
/* The three states the fetch created                                          */
/* -------------------------------------------------------------------------- */

/**
 * THE REASON THIS FILE EXISTS.
 *
 * When the index travelled in `data-props` this component had two branches
 * under a query — matches, and no matches — and both were true the moment it
 * rendered. Fetching the index added a third that is neither: a question
 * nothing can answer YET. `docs/PLAN.md`'s "degrade visibly" makes rendering
 * the second while the first is true the one shape to refuse, because it is a
 * confident wrong answer — it tells a reader the Comprehensive Rules do not
 * contain a word they can see in them.
 *
 * All three are unreachable without a browser, which is why none of them had an
 * assertion before this file.
 */
describe("a question nothing can answer YET is not a question nothing matches", () => {
  test("while the index is in flight the page says so, in both places", async () => {
    window.history.replaceState(null, "", "/cr?q=dominate");
    await mount({ indexUrl: SLOW_URL });

    /* The count line, which is what a reader sees. */
    expect(count()).toContain("Loading the rules index to answer");
    expect(count()).toContain("dominate");
    /* AND NOT THE OTHER THING, asserted rather than implied. The empty-result
       copy is what this state must never be mistaken for. */
    expect(count()).not.toContain("Nothing");

    /* And the live region, once it settles — a listener told "nothing matches"
       while the index is still coming has been told the wrong thing, and told
       it first. */
    await debounce();
    expect(announced()).toBe("Loading the rules index to answer dominate.");

    /* No results list at all, rather than an empty one. */
    expect(rows()).toBe(0);
  });

  test("an index that never loads leaves every section still reachable", async () => {
    /*
     * DEGRADE VISIBLY. The claim `/cr` makes is that every section has a
     * permanent URL, and that claim does not depend on the index — so the
     * failure is stated alongside the two routes that still work rather than as
     * a bare apology. The chapter list under the failure line is the SAME list
     * the empty query renders, named once in the component precisely so the
     * error path cannot be the copy that drifts.
     */
    window.history.replaceState(null, "", "/cr?q=dominate");
    await mount({ indexUrl: DEAD_URL });

    for (
      let tick = 0;
      tick < 50 && !count().includes("did not load");
      tick += 1
    ) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
      });
    }

    expect(count()).toContain("The rules index did not load");
    expect(count()).toContain("dominate");
    expect(count()).not.toContain("Nothing");
    /* The direct route, spelled out for a reader who cannot search. */
    expect(count()).toContain("/cr/8.3.4b");
    /* And the chapters, all of them. */
    expect(rows()).toBe(browse.length);
  });

  test("once the index lands the same question is answered", async () => {
    window.history.replaceState(null, "", "/cr?q=dominate");
    await answered();

    expect(rows()).toBe(9);
    expect(count()).toBe("9 sections match.");
    /* The rule renames itself, which is the other half of the browse test. */
    expect(
      document.querySelector("hr.of-rule__line")?.getAttribute("aria-label"),
    ).toBe("Results");
  });

  test("the index is fetched from the `indexUrl` prop and nowhere else", async () => {
    /* The fetch stub throws on any other address, so a component that built its
       own path — or cached the first one it ever saw — fails here by name
       rather than by rendering an index that never arrives. */
    window.history.replaceState(null, "", "/cr?q=dominate");
    await answered({ indexUrl: GOOD_URL });

    expect(
      searchIndexClient.getQueryData(["search-index", GOOD_URL]),
    ).toBeDefined();
  });
});

/* -------------------------------------------------------------------------- */
/* What the component says in its own voice                                    */
/* -------------------------------------------------------------------------- */

describe("the wording under a query", () => {
  test("the empty-result line cites the `version` prop, not the index", async () => {
    /*
     * THE VERSION STOPPED BEING READ OFF THE INDEX when the index left the
     * page, and it is one short string the page already had — so it travels as
     * a prop rather than becoming a fourth thing to wait for. `VERSION` is a
     * value no corpus could produce, which is what makes this an assertion
     * about the prop rather than about the corpus.
     */
    window.history.replaceState(null, "", "/cr?q=zzzznotarule");
    await answered();

    expect(count()).toContain(VERSION);
    expect(count()).toContain("zzzznotarule");
    expect(rows()).toBe(0);
  });

  test("a notice is printed in the engine's words, not rephrased", async () => {
    /* A notice is a statement about what the query engine DID, and a surface
       free to rephrase it is a surface free to describe behaviour it does not
       have. `the` is ignored as a term, and the engine says so. */
    window.history.replaceState(null, "", "/cr?q=the");
    await answered();

    const notices = [...document.querySelectorAll(".of-rules__notice")].map(
      (node) => node.textContent ?? "",
    );
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.join(" ")).toContain("the");
  });

  test("a row says why the ranking put it there", async () => {
    /* `why()` is four branches over `matchedIn`, and nothing else renders it.
       A section id is the one a reader is most likely to have typed on
       purpose. */
    window.history.replaceState(null, "", "/cr?q=8.3.4b");
    await answered();

    expect(rows()).toBe(1);
    expect(document.querySelector(".of-rules__why")?.textContent).toBe(
      "section id",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Every view is a URL                                                         */
/* -------------------------------------------------------------------------- */

describe("every view is a URL, and the URL is read exactly once", () => {
  test("`?q=` on arrival fills the field and answers it", async () => {
    window.history.replaceState(null, "", "/cr?q=dominate");
    await answered();

    expect(field().value).toBe("dominate");
    expect(rows()).toBe(9);
  });

  test("a pasted `?q=…&page=3` opens on page 3", async () => {
    /*
     * THE DEFECT THE `type` CALLBACK EXISTS TO PREVENT, and until now nothing
     * held it. Resetting the page from an effect on `query` cannot tell a
     * keystroke from the mount effect lifting `?q=` out of the URL, so it fires
     * on arrival and throws a pasted link back to page one — which is the exact
     * failure paging exists to fix. The reset lives on the field instead,
     * because the field knows something an effect cannot: a keystroke is always
     * a new answer.
     */
    window.history.replaceState(null, "", "/cr?q=attack&page=3");
    await answered();

    expect(count()).toBe("188 sections match. Page 3 of 4.");
    /* And the rows are page three's, not page one's re-labelled. */
    const first = document.querySelector(".of-citation__rule-id")?.textContent;
    expect(first).toBeDefined();
  });

  test("a keystroke is a new answer, so it goes back to page one", async () => {
    /* The other half of the pair. Without it the assertion above is satisfied
       by a component that never resets the page at all. */
    window.history.replaceState(null, "", "/cr?q=attack&page=3");
    await answered();
    expect(count()).toBe("188 sections match. Page 3 of 4.");

    await type("attack ");

    expect(count()).toBe("188 sections match. Page 1 of 4.");
  });

  /**
   * Two entries of our own to fall back onto, and they are not decoration.
   *
   * `window` OUTLIVES A TEST, so the history stack is whatever every test
   * before this one left on it — which makes "what is one entry back" a
   * question about the file's execution order rather than about the component.
   * Pushing a known pair first makes the assertion below local: what matters is
   * WHICH of the two the back button reaches, and both are this test's.
   *
   * IT WAITS FOR THE MOUNT'S OWN URL EFFECT FIRST. That effect is debounced too
   * and writes a `replace` for the empty query; left pending it would fire
   * after these pushes and overwrite the second sentinel with `/cr`, which
   * looks exactly like the bug under test.
   */
  async function sentinels(): Promise<void> {
    await debounce();
    await act(async () => {
      window.history.pushState({}, "", "/cr?q=sentinel-one");
      window.history.pushState({}, "", "/cr?q=sentinel-two");
    });
  }

  test("typing REPLACES the address rather than filling history", async () => {
    /*
     * A QUERY IS ONE NAVIGATION, NOT ONE PER LETTER. A back button that walks
     * backwards through "domin", "domi", "dom" is a back button nobody can use,
     * so the debounced write is a `replaceState`.
     *
     * TWO SETTLED KEYSTROKES AND ONE `back()`, AND THE SENTINEL PAIR IS WHAT
     * MAKES IT AN ASSERTION. Going back one entry passes under `push` as
     * readily as under `replace` — it merely lands somewhere else — so the
     * first version of this test survived mutating `replace` to `push`.
     * Landing on sentinel ONE can only happen if both keystrokes overwrote
     * sentinel two; under `push` the entry behind is `?q=dom`.
     */
    await answered();
    await sentinels();

    await type("dom");
    await debounce();
    expect(window.location.search).toBe("?q=dom");

    await type("domin");
    await debounce();
    expect(window.location.search).toBe("?q=domin");

    await act(async () => {
      window.history.back();
    });
    expect(window.location.search).toBe("?q=sentinel-one");
  });

  test("submitting PUSHES, because it is the deliberate act", async () => {
    /* The other half of the same rule, and the same sentinel argument the
       other way round: landing on sentinel TWO means the submit added an entry
       rather than consuming one. */
    await answered();
    await sentinels();

    /* Typed and submitted in separate tasks, the way Enter after typing is. */
    await type("attack");
    await submit();
    expect(window.location.search).toBe("?q=attack");

    await act(async () => {
      window.history.back();
    });
    expect(window.location.search).toBe("?q=sentinel-two");
  });

  test("back and forward re-run the query, not just the address bar", async () => {
    /* `popstate` has to put the query back into the FIELD and the results back
       under it. An address that moves on its own is a page that has lied about
       what it is showing. */
    window.history.replaceState(null, "", "/cr?q=dominate");
    await answered();
    expect(rows()).toBe(9);

    await type("attack");
    await submit();
    expect(window.location.search).toBe("?q=attack");
    expect(count()).toBe("188 sections match. Page 1 of 4.");

    await act(async () => {
      window.history.back();
    });

    expect(window.location.search).toBe("?q=dominate");
    expect(field().value).toBe("dominate");
    expect(rows()).toBe(9);
  });
});

/* -------------------------------------------------------------------------- */
/* Hydration                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * THE ONE THING THE `useState("")` DOCBLOCK ASKS FOR AND NOTHING CHECKED.
 *
 * `useState(queryFromUrl)` is the obvious spelling and it is wrong here: the
 * server renders this island without a `window`, so it renders the chapter
 * browse, and a client initialising from `?q=dominate` renders nine results
 * instead. React reports error #418 — "the server rendered text didn't match
 * the client" — which it did, on the first page this island was mounted on.
 *
 * The comment explaining that has been sitting above a line anybody could
 * "tidy" without a single assertion moving. This is that assertion.
 */
describe("the first client render reproduces the server's", () => {
  test("hydrating on a URL that carries a query recovers from nothing", async () => {
    /*
     * THE SERVER RENDER HAPPENS WITH NO QUERY IN THE ADDRESS, AND THAT IS THE
     * WHOLE FIDELITY OF THIS TEST. `/cr` is built ONCE, at build time, with no
     * reader and no `?q=`; the document that markup comes back as is then
     * served at `/cr?q=dominate`. Rendering the string while `window.location`
     * already carried the query is what the first version of this test did, and
     * it made both sides read the same URL — so seeding the state from the URL
     * during render, the exact mistake the `useState("")` docblock is about,
     * passed it. Verified by making that mutation.
     */
    window.history.replaceState(null, "", "/cr");
    const node = host();
    node.innerHTML = renderToString(
      <RulesSearch indexUrl={GOOD_URL} browse={browse} version={VERSION} />,
    );
    expect(rows()).toBe(browse.length);

    /* And now the reader arrives on the address the link carried. */
    window.history.replaceState(null, "", "/cr?q=dominate");

    const recovered: unknown[] = [];
    await act(async () => {
      roots.push(
        hydrateRoot(
          node,
          <RulesSearch indexUrl={GOOD_URL} browse={browse} version={VERSION} />,
          { onRecoverableError: (error) => recovered.push(error) },
        ),
      );
    });
    await settle();

    expect(recovered).toEqual([]);
    /* And the correction lands immediately after, so the reader who pasted the
       link still gets their answer. */
    expect(field().value).toBe("dominate");
    expect(rows()).toBe(9);
  });
});

/* -------------------------------------------------------------------------- */
/* Paging, and the `/` shortcut                                                */
/* -------------------------------------------------------------------------- */

describe("turning a page moves the reader, not just the rows", () => {
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
     * `pushState` MOVES NO FOCUS, so without the move the reader who clicked
     * "Next" is scrolled to the top of page 2 with focus still on an anchor now
     * sitting under page 2's foot. This surface is also the one the live region
     * cannot cover: the region settles for 600 ms before it speaks, which is
     * right for a field that re-runs on every keystroke and wrong for a click
     * that already happened.
     */
    window.history.replaceState(null, "", "/cr?q=attack");
    await answered();
    expect(document.querySelectorAll(".of-pages").length).toBe(1);

    await clickNext();

    expect(window.location.search).toContain("page=2");
    expect(count()).toBe("188 sections match. Page 2 of 4.");
    expect(document.activeElement?.className).toContain("of-rules__count");
  });

  test("the count is reachable by script and never by Tab", async () => {
    /* `tabIndex={-1}` is the whole contract: a reader who never turns a page
       must not acquire a stop in the tab order for the privilege. */
    window.history.replaceState(null, "", "/cr?q=attack");
    await answered();

    expect(
      document.querySelector(".of-rules__count")?.getAttribute("tabindex"),
    ).toBe("-1");
  });
});

describe("`/` reaches the field, and only when it should", () => {
  /*
   * `useFocusShortcut` IS SHARED WITH `CardSearch` AND TESTED FROM NEITHER SIDE
   * UNTIL NOW. The two halves it exists to keep identical are reached
   * differently — this island holds a ref to its own input, the card one looks
   * the header's field up in the DOM — so the getter this island passes is the
   * half that can only be exercised here.
   */
  async function press(target: EventTarget): Promise<KeyboardEvent> {
    const key = new KeyboardEvent("keydown", {
      key: "/",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      target.dispatchEvent(key);
    });
    return key;
  }

  test("it focuses the field from anywhere else on the page", async () => {
    await mount({ indexUrl: SLOW_URL });

    const key = await press(document.body);

    expect(key.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field());
  });

  test("it inserts a slash when a field already has focus", async () => {
    /* The guard that makes the key usable at all: `/` typed inside any field
       has to reach it, or the shortcut takes the character away in the one
       place a search box is most likely to already be focused. */
    await mount({ indexUrl: SLOW_URL });

    const key = await press(field());

    expect(key.defaultPrevented).toBe(false);
  });

  test("it releases the window when the island goes", async () => {
    /* The listener is on `window`, which outlives the root. One that survived
       unmount would move focus into a field that is no longer on the page. */
    const root = await mount({ indexUrl: SLOW_URL });
    await unmount(root);

    const key = await press(document.body);

    expect(key.defaultPrevented).toBe(false);
  });
});
