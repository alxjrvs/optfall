/**
 * `/spoilers` and the spoiled-card pages under it, rendered.
 *
 * Asserted against the data rather than against figures, because the file
 * under it is rebuilt daily: whatever `SPOILER_PAGES` holds, the index must
 * list every set and link every card's page, merge the pitch versions of one
 * card into one row, draw faces from our own host, and never link a `/card/`
 * page a spoiled card does not have.
 */

import { describe, expect, test } from "bun:test";

import { FACE_HOST } from "../../src/lib/faces";
import { namesIn, SPOILER_GROUPS, SPOILER_PAGES } from "../../src/lib/spoilers";
import { routes } from "../routes";

const resolved = routes.flatMap((registration) => [...registration.resolve()]);

const render = (route: string): string =>
  resolved.find((entry) => entry.route === route)?.render([], undefined) ?? "";

const html = render("/spoilers");

/** React escapes these in text, so a name has to be compared escaped. */
const escaped = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

/** The server-rendered markup only: the island's props repeat every href. */
const markup = html.replace(/data-props="[^"]*"/g, "");

describe("/spoilers", () => {
  test("is registered and renders", () => {
    expect(html).toContain(">Spoilers</h1>");
  });

  test("heads a group for every set with spoilers, by default", () => {
    for (const { set } of SPOILER_GROUPS) {
      expect(
        `${set.id}: ${markup.includes(`>${escaped(set.name)}</h2>`)}`,
      ).toBe(`${set.id}: true`);
    }
  });

  test("links every spoiled card's own page", () => {
    for (const spoiler of SPOILER_PAGES) {
      expect(
        `${spoiler.href}: ${markup.includes(`href="${spoiler.href}"`)}`,
      ).toBe(`${spoiler.href}: true`);
    }
  });

  test("merges the pitch versions of one card into one cell", () => {
    const cells = markup.match(/class="of-index__cell"/g)?.length ?? 0;
    expect(cells).toBe(namesIn(SPOILER_PAGES).length);
    /* And the merge is real in this data, not vacuous. */
    expect(cells).toBeLessThan(SPOILER_PAGES.length);
  });

  test("draws every face from our host, under a spoiler key", () => {
    const sources = [
      ...markup.matchAll(/of-card-face__frame"><img src="([^"]+)"/g),
    ].map((match) => match[1] ?? "");
    expect(sources.length).toBeGreaterThan(0);
    expect(
      sources.filter((src) => !src.startsWith(`${FACE_HOST}/normal/spoiler-`)),
    ).toEqual([]);
  });

  test("gives no spoiled card a card-page link", () => {
    /* The header and footer link nowhere under `/card/`, so any such href
       here came from this page's body. */
    expect(html).not.toMatch(/href="\/card\//);
  });
});

describe("a spoiled card's page", () => {
  test("exists for every spoiler", () => {
    for (const spoiler of SPOILER_PAGES) {
      const page = render(spoiler.href);
      expect(`${spoiler.href}: ${page.includes("<h1")}`).toBe(
        `${spoiler.href}: true`,
      );
      expect(page).toContain(escaped(spoiler.card.name));
      expect(page).toContain("Text can change before release");
    }
  });

  test("shows the face its cell on /spoilers showed", () => {
    for (const spoiler of SPOILER_PAGES) {
      if (spoiler.faceKey === null) continue;
      expect(render(spoiler.href)).toContain(
        `${FACE_HOST}/normal/${spoiler.faceKey}`,
      );
    }
  });

  test("links its other pitch versions", () => {
    for (const group of namesIn(SPOILER_PAGES)) {
      if (group.length < 2) continue;
      const page = render(group[0]?.href ?? "");
      for (const version of group.slice(1)) {
        expect(page).toContain(`href="${version.href}"`);
      }
    }
  });

  test("addresses are unique", () => {
    const hrefs = SPOILER_PAGES.map((spoiler) => spoiler.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
