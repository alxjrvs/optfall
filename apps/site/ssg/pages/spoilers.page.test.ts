/**
 * `/spoilers`, rendered.
 *
 * Asserted against the data rather than against figures, because the file
 * under it is rebuilt daily: whatever `SPOILER_GROUPS` holds, the page must
 * show every set and every card in it, draw each card's face from our own
 * host, and must not pretend a spoiled card has a page of its own.
 */

import { describe, expect, test } from "bun:test";

import { FACE_HOST } from "../../src/lib/faces";
import { SPOILER_GROUPS, spoilerFaceKey } from "../../src/lib/spoilers";
import { routes } from "../routes";

const html =
  routes
    .flatMap((registration) => [...registration.resolve()])
    .find((resolved) => resolved.route === "/spoilers")
    ?.render([], undefined) ?? "";

/** React escapes these in text, so a name has to be compared escaped. */
const escaped = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");

describe("/spoilers", () => {
  test("is registered and renders", () => {
    expect(html).toContain("<h1");
    expect(html).toContain(">Spoilers</h1>");
  });

  test("names every set with spoilers, as a heading", () => {
    for (const { set } of SPOILER_GROUPS) {
      expect(`${set.id}: ${html.includes(`id="spoilers-${set.id}"`)}`).toBe(
        `${set.id}: true`,
      );
    }
  });

  test("lists every card under each set it is printed in", () => {
    for (const { set, cards } of SPOILER_GROUPS) {
      for (const { card, printings } of cards) {
        const label = `${set.id} ${card.name}`;
        expect(`${label}: ${html.includes(escaped(card.name))}`).toBe(
          `${label}: true`,
        );
        for (const printing of printings) {
          expect(`${printing.id}: ${html.includes(printing.id)}`).toBe(
            `${printing.id}: true`,
          );
        }
      }
    }
  });

  test("draws a face for every card, from our host and under its own key", () => {
    /* Faces only: printed text draws game symbols as images too. */
    const sources = [
      ...html.matchAll(/of-card-face__frame"><img src="([^"]+)"/g),
    ].map((match) => match[1] ?? "");
    const listed = SPOILER_GROUPS.reduce(
      (sum, group) => sum + group.cards.length,
      0,
    );
    expect(sources.length).toBe(listed);
    /* Never LSS's bucket: the page asks our host, which the ingest fills. */
    expect(sources.filter((src) => !src.startsWith(`${FACE_HOST}/`))).toEqual(
      [],
    );
    for (const { cards } of SPOILER_GROUPS) {
      for (const { printings } of cards) {
        const key = spoilerFaceKey(printings);
        if (key === null) continue;
        expect(`${key}: ${html.includes(`${FACE_HOST}/normal/${key}`)}`).toBe(
          `${key}: true`,
        );
      }
    }
  });

  test("gives no spoiled card a card-page link", () => {
    /* A spoiled card has no `/card/…` URL until the corpus carries it. The
       header and footer link nowhere under `/card/`, so any such href here
       came from this page's body. */
    expect(html).not.toMatch(/href="\/card\//);
  });

  test("dates an undated set as unannounced rather than as a date", () => {
    const undated = SPOILER_GROUPS.some(({ set }) => set.released === null);
    expect(html.includes("release date not announced")).toBe(undated);
  });
});
