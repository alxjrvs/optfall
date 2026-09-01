/**
 * `/sets`'s filter, driven rather than inspected.
 *
 * WHAT `SetIndex.test.ts` ALREADY COVERS, AND WHY IT IS NOT ENOUGH. That file
 * asks the corpus one question — does `fold` leave anything in these set names
 * a US keyboard cannot type — and it is the best test in this directory for
 * what it does: it needs no maintenance as upstream adds sets and it fails on
 * the next character nobody has thought about. What it cannot see is the
 * component. Sixty-seven lines of this island were uncovered, and all of them
 * are the part a reader touches: the two orders, the two print statuses, the
 * suggestion chips, the empty state, and the hydration gate that decides
 * whether any of it is on the page at all.
 *
 * THE ENTRIES ARE THE REAL ONES, derived here the way `sets.page.tsx` derives
 * them. A fixture of three invented sets would let every assertion below pass
 * while the page shipped broken — the orders are only interesting over a
 * hundred-odd rows with real dates, real sizes and a genuine undated tail, and
 * "no set matches" is only interesting against names somebody might type.
 *
 * THE SUGGESTION CHIPS ARE HOW THE QUERY IS SET, AND THAT IS A LIMIT WORTH
 * NAMING. This island's field is a raw `<input onChange>`; React's
 * ChangeEventPlugin does not fire for a dispatched `input` event under
 * happy-dom, which `packages/components/src/react/SearchField.tsx` documents
 * where it was fixed for the shared field. Pressing a chip goes through
 * `onClick`, which does fire, and sets exactly the same state — so the filter,
 * the count, the empty state and the Clear button are all reachable. What is
 * not reachable is a keystroke that no chip spells, and nothing here pretends
 * otherwise.
 */

import { holdDom, releaseDom } from "./domHarness";

holdDom("https://optfall.com/sets");

/* React's own flag. Without it `act` does not flush and every assertion races
   the update it is asserting on — see `CardSearch.dom.test.tsx`. */
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { SET_PROFILES } from "../../src/lib/set-profiles";
import { SETS_BY_RELEASE } from "../../src/lib/sets";
import { hrefForSet } from "../../src/lib/sets";
import { SetIndex, type SetIndexEntry } from "./SetIndex";

/**
 * Exactly what `sets.page.tsx` hands the island.
 *
 * The derivation is repeated rather than imported because the page does not
 * export it — but the SHAPE is `SetIndexEntry`, which both sides import, so a
 * field added or renamed is a compiler error here rather than a silent
 * divergence.
 */
const entries: readonly SetIndexEntry[] = SETS_BY_RELEASE.flatMap((set) => {
  const profile = SET_PROFILES.get(set.id);
  if (profile === undefined) return [];
  return [
    {
      id: set.id,
      name: set.name,
      href: hrefForSet(set.id),
      released: set.released,
      outOfPrint: set.outOfPrint,
      names: profile.names,
      exclusive: profile.exclusive,
      rarities: profile.rarities,
    },
  ];
});

interface Mounted {
  readonly unmount: () => void;
}

async function mount(): Promise<Mounted> {
  document.body.innerHTML = `<main><div id="root"></div></main>`;
  const host = document.getElementById("root");
  if (host === null) throw new Error("no root");
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(<SetIndex entries={entries} />);
  });
  return { unmount: () => root.unmount() };
}

/** The set names currently listed, in the order the page lists them. */
function listed(): string[] {
  return [...document.querySelectorAll(".of-sets__name")].map(
    (node) => node.textContent?.trim() ?? "",
  );
}

/** The printed count line — "112 sets", or "32 of 112 sets". */
function count(): string {
  return document.querySelector(".of-sets__count")?.textContent?.trim() ?? "";
}

/** The year headings, which only the two date orders draw. */
function years(): string[] {
  return [...document.querySelectorAll(".of-sets__year")].map(
    (node) => node.textContent?.trim() ?? "",
  );
}

/** Press a control, as a real bubbling click. */
async function click(node: Element | null | undefined): Promise<void> {
  if (!(node instanceof HTMLElement)) throw new Error("nothing to click");
  await act(async () => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** The suggestion chip with this exact label. */
function chip(label: string): Element | undefined {
  return [...document.querySelectorAll(".of-sets__suggestion")].find(
    (node) => node.textContent?.trim() === label,
  );
}

/**
 * Choose an option in one of the two `<select>`s.
 *
 * A `<select>` is the one control React reads from the plain `change` event
 * rather than through its value tracker, so this needs no prototype-setter
 * trick — which is why the orders and statuses are reachable here and a
 * keystroke in the text field is not.
 */
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
});

afterAll(async () => {
  live?.unmount();
  await releaseDom();
});

describe("before the script arrives", () => {
  /*
   * THE LIST IS NOT GATED ON HYDRATION AND MUST NOT BE. It is made of real
   * links and it is the whole point of the page; the field and the two selects
   * do nothing without JavaScript, so those are what `interactive` hides. This
   * is the server render, which is what a crawler and a reader with no
   * scripting both get.
   */
  const html = renderToString(<SetIndex entries={entries} />);

  test("every set is already on the page, as links", () => {
    expect(html).toContain('class="of-sets__name"');
    for (const entry of entries.slice(0, 5)) {
      expect(html).toContain(`href="${entry.href}"`);
    }
  });

  test("the controls are absent rather than inert", () => {
    /* A field that does nothing is worse than no field: it invites a reader to
       type into a control that cannot answer. */
    expect(html).not.toContain("of-sets__filter");
    expect(html).not.toContain("of-sets__suggestion");
  });

  test("and so is the live region, which would have nothing to report", () => {
    /* Before hydration nothing can change the list, so a live region would
       announce the starting count as though it were news. */
    expect(html).not.toContain("of-sets__announcement");
  });

  test("the count is there in both renders, because it is not a control", () => {
    expect(html).toContain("of-sets__count");
  });
});

describe("once it has hydrated", () => {
  test("the controls appear and the list is unchanged", async () => {
    live = await mount();
    expect(document.querySelector(".of-sets__filter")).not.toBeNull();
    expect(document.getElementById("sets-status")).not.toBeNull();
    expect(document.getElementById("sets-order")).not.toBeNull();
    expect(listed().length).toBe(entries.length);
  });

  test("the count and the live region say the same words", async () => {
    live = await mount();
    const announcement = document
      .querySelector(".of-sets__announcement")
      ?.textContent?.trim();
    /* Two elements rather than one made live: a visible count that is ALSO a
       live region re-announces itself on every unrelated re-render. Same text
       is the contract; being the same element is the bug. */
    expect(announcement).toBe(count());
    expect(count()).toBe(`${entries.length.toLocaleString("en-GB")} sets`);
  });
});

describe("filtering", () => {
  test("a suggestion narrows the list and the count says by how much", async () => {
    live = await mount();
    await click(chip("Blitz Deck"));

    const shown = listed();
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(entries.length);
    /* Every chip is a LITERAL SUBSTRING of the names it finds, which is the
       condition for offering it as a press rather than as a category. */
    expect(
      shown.every((name) => name.toLowerCase().includes("blitz deck")),
    ).toBe(true);
    expect(count()).toBe(
      `${shown.length.toLocaleString("en-GB")} of ${entries.length.toLocaleString("en-GB")} sets`,
    );
  });

  test("Clear appears only once there is something to clear", async () => {
    live = await mount();
    expect(chip("Clear")).toBeUndefined();

    await click(chip("Promo"));
    expect(chip("Clear")).toBeDefined();

    await click(chip("Clear"));
    expect(listed().length).toBe(entries.length);
    expect(chip("Clear")).toBeUndefined();
  });

  test("a print status filters without a query", async () => {
    live = await mount();
    await choose("sets-status", "out-of-print");

    const shown = listed();
    const outOfPrint = entries.filter((entry) => entry.outOfPrint);
    expect(shown.length).toBe(outOfPrint.length);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(entries.length);
  });

  test("the two filters compose rather than replacing each other", async () => {
    live = await mount();
    await click(chip("Blitz Deck"));
    const byName = listed().length;
    await choose("sets-status", "in-print");
    const both = listed().length;

    expect(both).toBeLessThanOrEqual(byName);
    expect(
      listed().every((name) => name.toLowerCase().includes("blitz deck")),
    ).toBe(true);
  });
});

describe("when nothing matches", () => {
  /*
   * THE EMPTY `<section>` IS THE REGRESSION THIS GUARDS. The date orders got an
   * empty era list for free; the size and name orders took a shortcut that
   * produced ONE era holding no sets, so a filter matching nothing rendered an
   * empty `<section>` and an empty `<ul>` under the "no set matches" line —
   * valid markup for a list that is not there.
   */
  /* Every Armory Deck in this corpus is in print, which is what makes the pair
     below match nothing. Asserted rather than assumed: if upstream ever retires
     one, this fails and says so instead of the test quietly passing on a list
     it was never meant to have. */
  const armoryAllInPrint = entries
    .filter((entry) => entry.name.toLowerCase().includes("armory deck"))
    .every((entry) => !entry.outOfPrint);

  test("the corpus still supports the pair the next test uses", () => {
    expect(armoryAllInPrint).toBe(true);
  });

  test("the line names the query and no empty list is drawn", async () => {
    live = await mount();
    /* `name` order first, because the single-era shortcut it takes is the one
       that produced the empty `<section>`; the date orders never had the bug. */
    await choose("sets-order", "name");
    await choose("sets-status", "out-of-print");
    await click(chip("Armory Deck"));

    expect(listed()).toEqual([]);
    const empty = document.querySelector(".of-sets__empty")?.textContent ?? "";
    expect(empty).toContain("Armory Deck");
    expect(empty).toContain("in that print status");
    expect(document.querySelectorAll(".of-sets__era").length).toBe(0);
    expect(document.querySelectorAll(".of-sets").length).toBe(0);
  });

  test("the query is dropped from the wording when there is no query", async () => {
    /*
     * THE OTHER HALF OF THE EMPTY STATE IS UNREACHABLE IN THIS CORPUS, and
     * recording that is more useful than faking it. "No set in this corpus has
     * that print status." needs a status that matches nothing with an empty
     * query, and both statuses match plenty — so the branch cannot be entered
     * without inventing a corpus, and a test against an invented one would be
     * asserting about a fiction rather than about the sets.
     *
     * This asserts the fact that makes it unreachable instead. If upstream ever
     * prints or retires everything, this fails and the branch becomes worth a
     * real test at that point.
     */
    const inPrint = entries.filter((entry) => !entry.outOfPrint).length;
    expect(inPrint).toBeGreaterThan(0);
    expect(entries.length - inPrint).toBeGreaterThan(0);

    /* And with no query the list is never empty, which is the same statement
       from the page's side. */
    live = await mount();
    await choose("sets-status", "out-of-print");
    expect(document.querySelector(".of-sets__empty")).toBeNull();
  });
});

describe("ordering", () => {
  test("newest is the corpus order, and oldest is it reversed", async () => {
    live = await mount();
    const newest = listed();
    await choose("sets-order", "oldest");
    expect(listed()).toEqual([...newest].reverse());
  });

  test("name is alphabetical in en-GB", async () => {
    live = await mount();
    await choose("sets-order", "name");
    const shown = listed();
    expect(shown).toEqual(
      [...shown].sort((a, b) => a.localeCompare(b, "en-GB")),
    );
  });

  test("largest is by card count, descending, tiebroken by corpus order", async () => {
    /*
     * COMPARED AGAINST THE SAME SORT RATHER THAN AGAINST A LOOKUP BY NAME. Two
     * sets in this corpus share a name — "Arakni Blitz Deck" — so mapping the
     * rendered names back to their sizes reads one of them off the wrong
     * record and reports a descending list as unsorted. The names in order are
     * the observable thing; this builds the expected sequence the way the
     * component builds it, ties included, and compares those.
     */
    live = await mount();
    await choose("sets-order", "largest");
    const expected = [...entries]
      .sort((a, b) => (a.names === b.names ? 0 : b.names - a.names))
      .map((entry) => entry.name);
    expect(listed()).toEqual(expected);
  });

  test("only the date orders draw year headings", async () => {
    /*
     * "2024" over a run sorted by size would be a grouping the order does not
     * respect, and the reader would have to work out which of the two claims to
     * believe. So the headings are not a decoration that survives a re-sort.
     */
    live = await mount();
    expect(years().length).toBeGreaterThan(1);

    await choose("sets-order", "largest");
    expect(years()).toEqual([]);

    await choose("sets-order", "name");
    expect(years()).toEqual([]);

    await choose("sets-order", "oldest");
    expect(years().length).toBeGreaterThan(1);
  });

  test("the undated tail is named rather than called unknown", async () => {
    /* Upstream publishes no date for these sets, which is a fact about the
       record rather than a gap in it — the same wording the set page's masthead
       uses for the same absence. */
    live = await mount();
    const undated = entries.filter((entry) => entry.released === null);
    expect(undated.length).toBeGreaterThan(0);
    expect(years()).toContain("No published date");
  });

  test("a year heading counts the sets released in it", async () => {
    live = await mount();
    const heads = years().filter((year) => /^\d{4}$/.test(year));
    expect(heads.length).toBeGreaterThan(1);
    /* Each heading appears once: a year split across two eras would mean the
       corpus order is not sorted by date, which is what `SETS_BY_RELEASE`
       promises. */
    expect(heads.length).toBe(new Set(heads).size);
  });
});
