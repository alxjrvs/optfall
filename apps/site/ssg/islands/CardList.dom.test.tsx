/**
 * The set page's list, driven: the slice, the address, and the view switch.
 *
 * WHY THE ENTRIES ARE GENERATED HERE AND NOT READ OUT OF THE CORPUS. This
 * component's own docblock is the argument: "the rows arrive already built,
 * from the build, as this island's props". It never looks inside an entry — it
 * cuts the array, hands one page to `CardIndex` and keeps three values in the
 * address bar. Feeding it four hundred real cards would cost the 18 MB corpus
 * to exercise `Array.prototype.slice`, and every assertion below would be
 * identical. Where the data IS the subject — the set filter's four orders over
 * real dates and sizes — `SetIndex.dom.test.tsx` uses the real corpus for
 * exactly that reason.
 *
 * WHAT IS ACTUALLY AT RISK HERE is the URL. Three parameters, each with a
 * default that must be spelled as ABSENCE, on a reference work whose claim is
 * that a view has one address. `/sets/mst`, `?display=grid` and `?page=1` being
 * three addresses for one view is not a cosmetic defect on a site built around
 * citable URLs, and none of it was covered: forty-seven lines of this file were
 * unreached, including every one of `linkTo`, `goTo` and the `popstate`
 * listener.
 */

import { holdDom, releaseDom } from "./domHarness";

holdDom("https://optfall.com/sets/mst");

/* React's own flag. Without it `act` does not flush and every assertion races
   the update it is asserting on — see `CardSearch.dom.test.tsx`. */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

import type { CardIndexEntry } from "../components/CardIndex";
import { CardList } from "./CardList";

const SUBJECT = "Mistveil";

/**
 * A list of `count` rows, shaped exactly as the set page builds them.
 *
 * The values are plausible rather than real; what matters is that each row is
 * DISTINGUISHABLE, so an off-by-one in the slice shows up as the wrong card
 * rather than as a list of the same length.
 */
function rows(count: number): readonly CardIndexEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    href: `/card/mst/${index + 1}/card-${index + 1}`,
    label: `Card ${index + 1}`,
    name: `Card ${index + 1}`,
    qualifier: "",
    typeLine: "Action — Attack",
    faceKey: null,
    faceLandscape: false,
    versions: [],
  }));
}

/** Two full pages and a bit: enough to page, clamp and turn. */
const ENTRIES = rows(140);

interface Mounted {
  readonly unmount: () => void;
}

async function mount(
  entries: readonly CardIndexEntry[] = ENTRIES,
): Promise<Mounted> {
  document.body.innerHTML = `<main><div id="root"></div></main>`;
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<CardList entries={entries} subject={SUBJECT} />);
  });
  /* One more flush: the mount effect reads the URL and flips `interactive`,
     and every test here asserts on the state after that. */
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
  });
  return { unmount: () => root.unmount() };
}

/**
 * The cards currently drawn, in page order, named by their own addresses.
 *
 * BY `href` RATHER THAN BY TEXT, because the grid has none: a cell is a link
 * round an `<img>`, and its only readable name is the alt text. The address is
 * what both views agree on and what a row is really identified by, so this
 * reads the same in either.
 */
function shown(): string[] {
  return [
    ...document.querySelectorAll(".of-index__cell, .of-index__rows > li"),
  ].map((node) => node.querySelector("a[href]")?.getAttribute("href") ?? "");
}

/** The address of the nth generated row, for readable expectations. */
const card = (nth: number): string => `/card/mst/${nth}/card-${nth}`;

/** The count sentence, which names the slice rather than the total. */
function summary(): string {
  return document.querySelector(".of-index__count")?.textContent?.trim() ?? "";
}

/** The address, as a reader would copy it. */
function address(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Go to an address without reloading, the way a test arranges its scenario. */
function at(url: string): void {
  window.history.replaceState(null, "", url);
}

async function click(node: Element | null | undefined): Promise<void> {
  if (!(node instanceof HTMLElement)) throw new Error("nothing to click");
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Choose in one of `Choice`'s native selects — see `SetIndex.dom.test.tsx`. */
async function choose(id: string, value: string): Promise<void> {
  const select = document.getElementById(id);
  if (!(select instanceof HTMLSelectElement)) throw new Error(`no #${id}`);
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

let live: Mounted | undefined;

beforeEach(() => {
  live?.unmount();
  live = undefined;
  at("/sets/mst");
});

afterAll(async () => {
  live?.unmount();
  await releaseDom();
});

describe("before the script arrives", () => {
  const html = renderToString(<CardList entries={ENTRIES} subject={SUBJECT} />);

  test("the first page is markup, not a placeholder", () => {
    expect(html).toContain(`href="${card(1)}"`);
    expect(html).toContain(`href="${card(60)}"`);
    expect(html).not.toContain(`href="${card(61)}"`);
  });

  test("the view switch is absent, and the pager is not", () => {
    /* The switch is a control that does nothing without JavaScript; the pager
       is made of real links. Gating the second would remove the only way
       through the set for a reader with no scripting — and `set.page.tsx`
       carries the `<noscript>` list that says what those links cannot do. */
    expect(html).not.toContain("of-index__controls");
    expect(html).toContain("of-pages");
  });
});

describe("the address decides what is on the page", () => {
  test("a bare address is page one of the grid", async () => {
    live = await mount();
    expect(shown()[0]).toBe(card(1));
    expect(shown()).toHaveLength(60);
    expect(summary()).toBe("Cards 1–60 of 140 from Mistveil.");
  });

  test("`?page=` is read on mount", async () => {
    at("/sets/mst?page=3");
    live = await mount();
    expect(shown()[0]).toBe(card(121));
    expect(summary()).toBe("Cards 121–140 of 140 from Mistveil.");
  });

  test("`?per=` is read with it", async () => {
    at("/sets/mst?per=30&page=2");
    live = await mount();
    expect(shown()[0]).toBe(card(31));
    expect(shown()).toHaveLength(30);
  });

  /*
   * CLAMPED AGAINST THE REAL TOTAL. A set can lose cards between one corpus
   * sync and the next, so a saved link to page 7 of a set that now has five is
   * not hypothetical — and an empty grid under a heading naming 140 cards reads
   * as a broken page rather than as an out-of-date link.
   */
  test("a page past the end lands on the last one rather than on nothing", async () => {
    at("/sets/mst?page=99");
    live = await mount();
    expect(shown().length).toBeGreaterThan(0);
    expect(shown()[0]).toBe(card(121));
  });

  test("every spelling of the list view resolves to it", async () => {
    /*
     * `card-search/` maps `rows`, `text`, `names` and `checklist` onto this one
     * view, and a reader who learned a word on `/search` should not find that
     * only one of the site's two card lists understands it. Resolving rather
     * than falling through matters: falling through would answer "the reader
     * said nothing", and hand the grid back to somebody who explicitly asked
     * not to see pictures.
     */
    for (const spelling of ["list", "rows", "text", "names", "checklist"]) {
      live?.unmount();
      at(`/sets/mst?display=${spelling}`);
      live = await mount();
      expect(
        `${spelling}: ${document.querySelectorAll(".of-index__rows").length}`,
      ).toBe(`${spelling}: 1`);
    }
  });

  test("an unknown display is not an opinion, and the grid stands", async () => {
    at("/sets/mst?display=hologram");
    live = await mount();
    expect(document.querySelectorAll(".of-index__grid")).toHaveLength(1);
  });
});

describe("the defaults are spelled as absence", () => {
  /*
   * THE CLAIM THIS PAGE MAKES IS THAT A VIEW HAS AN ADDRESS, SINGULAR. Writing
   * `?display=grid` or `?page=1` would make three addresses for one view on a
   * reference work built around citable URLs.
   */
  test("turning to page two writes it, and back to one removes it", async () => {
    live = await mount();
    await click(document.querySelector('.of-pages a[aria-label="Page 2"]'));
    expect(address()).toBe("/sets/mst?page=2");

    await click(document.querySelector('.of-pages a[aria-label="Page 1"]'));
    expect(address()).toBe("/sets/mst");
  });

  test("switching to the list writes it, and back to the grid removes it", async () => {
    live = await mount();
    await choose("set-display-display", "list");
    expect(address()).toBe("/sets/mst?display=list");

    await choose("set-display-display", "grid");
    expect(address()).toBe("/sets/mst");
  });

  test("the default page size is never written", async () => {
    live = await mount();
    const sixty = [...document.querySelectorAll(".of-pages__size")].find(
      (node) => node.textContent?.trim() === "60",
    );
    /* 60 is the default, so choosing it explicitly still leaves a bare URL. */
    if (sixty !== undefined) await click(sixty);
    expect(address()).toBe("/sets/mst");
  });
});

describe("turning a page", () => {
  test("moves the slice, the address and the focus together", async () => {
    live = await mount();
    await click(document.querySelector('.of-pages a[aria-label="Page 2"]'));

    expect(shown()[0]).toBe(card(61));
    expect(summary()).toBe("Cards 61–120 of 140 from Mistveil.");
    /*
      `pushState` MOVES NO FOCUS, so without the move in `goTo` the reader is
      looking at the top of page 2 with focus still on the pager at the foot of
      page 1 — one Tab and they are back where they came from.
    */
    expect(document.activeElement?.className).toContain("of-index__count");
  });

  test("the page is kept across a view change, and dropped by a size change", async () => {
    /* Every view has the same page size, so page 2 holds the same sixty cards
       whichever way they are drawn. Page 2 of 60-row pages and page 2 of
       240-row pages are different rows of one answer, and no reading of "2" is
       true of both. */
    live = await mount();
    await click(document.querySelector('.of-pages a[aria-label="Page 2"]'));
    await choose("set-display-display", "list");
    /* `page` first because it was already in the address when `display` was
       added: `linkTo` edits the parameters that are there and appends the ones
       that are not. */
    expect(address()).toBe("/sets/mst?page=2&display=list");

    const thirty = [...document.querySelectorAll(".of-pages__size")].find(
      (node) => node.textContent?.trim() === "30",
    );
    await click(thirty);
    expect(address()).toBe("/sets/mst?display=list&per=30");
    /* And `page` is gone, not reset to 1 — the defaults are absences. */
    expect(shown()[0]).toBe(card(1));
  });

  test("back and forward re-cut the list", async () => {
    live = await mount();
    at("/sets/mst?page=2");
    await act(async () => {
      window.dispatchEvent(new Event("popstate"));
    });
    expect(shown()[0]).toBe(card(61));

    at("/sets/mst");
    await act(async () => {
      window.dispatchEvent(new Event("popstate"));
    });
    expect(shown()[0]).toBe(card(1));
  });

  test("the live region says the same sentence the count prints", async () => {
    /*
     * IT IS NOT MADE REDUNDANT BY THE FOCUS MOVE. Focus moves when the READER
     * turns a page; this covers the turns nobody clicked — back and forward,
     * which land through `popstate` and quite rightly take no focus with them.
     * Before it existed, walking a set's history changed four hundred cards and
     * announced nothing at all.
     */
    live = await mount();
    at("/sets/mst?page=2");
    await act(async () => {
      window.dispatchEvent(new Event("popstate"));
    });
    expect(
      document.querySelector(".of-index__announcement")?.textContent?.trim(),
    ).toBe(summary());
  });
});

describe("the sentence over the list", () => {
  test("names the slice when there is more than one page", async () => {
    live = await mount();
    expect(summary()).toBe("Cards 1–60 of 140 from Mistveil.");
  });

  test("counts nothing when the list fits on one page, and draws no pager", async () => {
    /* Two counts saying one number is one of them being noise; the masthead
       above already gives the total, so the pager's sentence is what this can
       add — and with one page there is nothing to add.

       THIS TEST USED TO ASSERT "12 cards from Mistveil." — the count the
       comment above had just finished arguing was noise. The reasoning was
       right and the assertion was a snapshot of what the component happened to
       do, which is how a test ends up defending the thing its own comment
       objects to. On a set page that sentence is the THIRD statement of 12,
       after the masthead's `Cards` row and the twelve faces below it. */
    live = await mount(rows(12));
    expect(summary()).toBe("Cards from Mistveil.");
    expect(document.querySelector(".of-pages")).toBeNull();
  });

  test("one card gets the same sentence as twelve", async () => {
    /* There is no plural left to get wrong. The previous test here asserted
       "1 card from Mistveil." against "12 cards from Mistveil.", which was the
       only reason the singular branch existed; with the count gone the two
       cases are one sentence, and that is worth pinning so a future edit does
       not reintroduce a count on one side only. */
    live = await mount(rows(1));
    expect(summary()).toBe("Cards from Mistveil.");
  });

  test("an empty set says so rather than showing an empty grid", async () => {
    live = await mount(rows(0));
    expect(summary()).toBe("Optfall carries no cards from Mistveil.");
  });
});
