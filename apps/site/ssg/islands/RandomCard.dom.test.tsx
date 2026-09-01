/**
 * `/random`, both halves: the page that ships the index and the island that
 * spends it.
 *
 * WHY BOTH IN ONE FILE. They are one feature and neither is testable without
 * the other's shape — the page's whole job is to hand `buildNameIndex`'s output
 * to the island, and the island's whole job is to decode it and go. Between
 * them they were 48 uncovered lines at 10.7% and 32.4%, which is what a feature
 * looks like when it is only ever exercised by a browser.
 *
 * `Math.random` AND `location.replace` ARE BOTH REPLACED, and each for a
 * different reason. The random pick is stubbed because a test that asserts on
 * an unseeded choice can only assert that SOMETHING was chosen — which would
 * pass just as well if the index were rotated by one and every reader were sent
 * to the wrong card. Pinning it turns "it picked a card" into "it picked the
 * card at that position", which is the assertion with teeth. `replace` is
 * stubbed because happy-dom would try to navigate, and a test that navigates
 * has thrown away the page it was inspecting.
 */

import { holdDom, releaseDom } from "./domHarness";

holdDom("https://optfall.com/random");

/* React's own flag. Without it `act` does not flush and every assertion races
   the update it is asserting on — see `CardSearch.dom.test.tsx`. */
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
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { CARD_PAGES, HREF_BY_NAME_SLUG } from "../../src/lib/cards";
import {
  buildNameIndex,
  decodeNameIndex,
  type EncodedNameIndex,
} from "../../src/lib/typeahead";
import { randomPage } from "../pages/random.page";
import { RandomCard } from "./RandomCard";

/** The index exactly as `random.page.tsx` builds it. */
const encoded = buildNameIndex(CARD_PAGES, HREF_BY_NAME_SLUG);
const decoded = decodeNameIndex(encoded);

/** Where the island was told to go, in call order. */
let replaced: string[] = [];
const realRandom = Math.random;

beforeEach(() => {
  replaced = [];
  /* happy-dom's own `replace` would navigate, which would take the document
     this test is about to read. */
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href: "https://optfall.com/random",
      pathname: "/random",
      search: "",
      replace: (target: string) => replaced.push(target),
    },
  });
});

afterEach(() => {
  Math.random = realRandom;
});

afterAll(async () => {
  await releaseDom();
});

interface Mounted {
  readonly unmount: () => void;
}

async function mount(index: EncodedNameIndex): Promise<Mounted> {
  document.body.innerHTML = `<main><div id="root"></div></main>`;
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<RandomCard index={index} />);
  });
  return { unmount: () => root.unmount() };
}

/** The one line this island renders. */
function line(): string {
  return (
    document.querySelector(".of-random__fallback")?.textContent?.trim() ?? ""
  );
}

describe("the page that ships the index", () => {
  const result = randomPage.page({
    params: {},
    props: undefined,
    route: "/random",
  });
  const html = renderToString(<>{result.children}</>);

  test("it is at `/random`, where every reference site puts it", () => {
    expect(randomPage.pattern).toBe("/random");
  });

  test("it asks for islands, because the choosing happens in the browser", () => {
    /* A build-time choice would be random once per deploy, which is a fixed
       link wearing a random name. */
    expect(result.islands).toBe(true);
  });

  test("the index it hands over is the whole corpus of names", () => {
    /* The same index the front door uses. If this ever shipped a subset, the
       page would still work and would quietly stop being able to reach most of
       the cards. */
    expect(decoded.size).toBeGreaterThan(1000);
    expect(html).toContain("of-random__fallback");
  });

  test("with scripting off it says why, and offers two ways on", () => {
    /*
     * DEGRADE VISIBLY. This is the one page on the site that cannot work
     * without JavaScript at all — there is no server to choose on — so the
     * `<noscript>` is not a courtesy, it is the difference between a limit
     * stated and a page that silently does nothing.
     */
    expect(html).toContain("<noscript>");
    expect(html).toContain("no server to choose on");
    expect(html).toContain('href="/search"');
    expect(html).toContain('href="/sets"');
  });
});

describe("the island", () => {
  test("it picks the card the roll names, and goes there", async () => {
    /* 0 is the first row; the assertion is which card, not that there was
       one. */
    Math.random = () => 0;
    const mounted = await mount(encoded);
    expect(replaced).toEqual([decoded.hrefs[0] ?? ""]);
    mounted.unmount();
  });

  test("a roll at the top of the range stays inside the index", async () => {
    /*
     * `Math.random()` IS EXCLUSIVE OF 1 AND THIS IS THE ROW THAT PROVES THE
     * FLOOR IS RIGHT. A value a hair under 1 has to land on the LAST card
     * rather than one past it — an off-by-one here is a redirect to
     * `undefined`, which the guard turns into a page that says "Choosing a
     * card…" for ever.
     */
    Math.random = () => 0.999_999_999;
    const mounted = await mount(encoded);
    expect(replaced).toEqual([decoded.hrefs[decoded.size - 1] ?? ""]);
    mounted.unmount();
  });

  test("it offers the link as well as taking it", async () => {
    /* If the navigation is blocked or slow the reader still has something to
       press, and `replace` keeps the back button pointing at wherever they came
       from rather than trapping them in a loop of random cards. */
    Math.random = () => 0;
    const mounted = await mount(encoded);
    const link = document.querySelector(".of-random__fallback a");
    expect(link?.getAttribute("href")).toBe(decoded.hrefs[0] ?? "");
    expect(line()).toBe("Opening a card…");
    mounted.unmount();
  });

  test("it chooses once, not once per render", async () => {
    /*
     * THE EFFECT'S DEPENDENCY IS `names`, WHICH `useMemo` KEEPS STABLE, and the
     * component's own docblock says why that matters: `decodeNameIndex` returns
     * a fresh object each call, so a dependency on the raw prop would pick a
     * card, navigate, and then pick a different one. Re-rendering with the same
     * prop must not roll again.
     */
    let rolls = 0;
    Math.random = () => {
      rolls += 1;
      return 0;
    };
    document.body.innerHTML = `<main><div id="root"></div></main>`;
    const host = document.getElementById("root");
    if (host === null) throw new Error("no root");
    const root = createRoot(host);
    await act(async () => {
      root.render(<RandomCard index={encoded} />);
    });
    await act(async () => {
      root.render(<RandomCard index={encoded} />);
    });
    expect(rolls).toBe(1);
    expect(replaced).toHaveLength(1);
    root.unmount();
  });

  test("an empty index goes nowhere and says nothing untrue", async () => {
    /*
     * A corpus with no names is a state rather than a defect — it is what a
     * failed sync would leave — and the failure to guard it would be a
     * navigation to `undefined`. The line stays on its choosing wording, which
     * is the honest thing to say when there is nothing to choose from.
     */
    const mounted = await mount({ names: "", hrefs: "", pitches: "" });
    expect(replaced).toEqual([]);
    expect(line()).toBe("Choosing a card…");
    mounted.unmount();
  });

  test("a name with no address is not navigated to", async () => {
    /* The rows are parallel arrays; a short `hrefs` is what a truncated index
       looks like, and the guard is what stops it becoming `location.replace
       (undefined)`. */
    /* The roll is pinned BEFORE the mount — set after it, this test would
       assert about a choice that had already been made, which is a test of
       nothing. 0.9 of two rows is row 1, and row 1 has no address. */
    Math.random = () => 0.9;
    const mounted = await mount({
      names: ["Jab", "Head Jab"].join("\n"),
      hrefs: "/card/a",
      pitches: "1",
    });
    expect(replaced).toEqual([]);
    expect(line()).toBe("Choosing a card…");
    mounted.unmount();
  });
});
