/**
 * The figures this repository writes down in prose, against the corpus.
 *
 * WHY THIS EXISTS. An audit of the tree found six places where a number in
 * prose disagreed with the code it described — a comment claiming fourteen
 * primitives when there were nineteen, two files quoting the card route table
 * as 13,675 and 12,278 when it was 11,378, a user-facing string reading "the
 * seven are" in front of eight interpolated values. CLAUDE.md opens by warning
 * against exactly this and the warning had not held, because a number spelled
 * in prose has no owner: nothing fails when the thing it counts moves.
 *
 * WHAT IT CHECKS, AND WHAT IT DELIBERATELY DOES NOT. It does not parse prose.
 * Trying to would be both fragile and wrong — `12,278` still appears correctly
 * in two files, describing a redirect table that was retired, and a scanner
 * strict enough to catch a stale claim would fail an accurate history. Prose
 * about the past is not drift.
 *
 * Instead each widely-quoted figure is written ONCE, here, and asserted against
 * the live value. If the corpus moves, this fails and names the figure, and the
 * mention count tells whoever is re-syncing how much prose has just gone stale.
 * That is the part the audit found hardest: the 12,776 aggregate stayed correct
 * across 79 commits while two of its components drifted independently, so
 * nobody had a reason to look.
 *
 * ADDING A FIGURE IS THE POINT. If you write a count into a comment or a
 * document, put it here too, or it is unowned again.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { CARD_PAGES, CARD_ROUTES, CORPUS } from "../apps/site/src/lib/cards";
import { RULE_PAGES } from "../apps/site/src/lib/rules";
import { SETS } from "../apps/site/src/lib/sets";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", ".git", "dist", "data", "design-system"]);
const READ = new Set([".ts", ".tsx", ".md", ".css"]);

/** Every source and prose file, so "how much says this" is answerable. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (READ.has(extname(entry))) out.push(path);
  }
  return out;
}

const FILES = sources(ROOT);

const mentions = (literal: string): readonly string[] =>
  FILES.filter((path) => readFileSync(path, "utf8").includes(literal)).map(
    (path) => path.slice(ROOT.length),
  );

/**
 * A set page exists for every set that has a card in the corpus AND a record in
 * `SETS` — grouped the way `set.page.tsx` groups them, and filtered the way it
 * filters. Recomputed here rather than imported: counting the generator's own
 * routes would make this agree with the generator by construction and check
 * nothing.
 *
 * The `SETS` filter is not incidental. The corpus carries printings whose set
 * has no record, and `set.page.tsx` drops them rather than emitting a page it
 * cannot title — so a count that skipped the filter would be a plausible-looking
 * number that no page corresponds to.
 */
const known = new Set(SETS.sets.map((set) => set.id));
const setPages = new Set(
  CARD_PAGES.flatMap((page) =>
    page.card.printings.map((printing) => printing.set_id),
  ),
).intersection(known).size;

/**
 * The pages with a single fixed URL: home, search, sets, cr, random, about,
 * syntax and data-terms. Spelled here because there is no list to import — an
 * unregistered page is not a URL, by design, so `routes.ts` is the only record
 * and it mixes these with the generated ones.
 */
const FIXED_PAGES = 8;

const TOTAL_PAGES =
  CARD_ROUTES.length + RULE_PAGES.length + setPages + FIXED_PAGES;

const format = (n: number) => n.toLocaleString("en-US");

/** Each figure, the live value behind it, and why it is quoted so widely. */
const FIGURES: readonly {
  readonly literal: string;
  readonly live: number;
  readonly what: string;
}[] = [
  { literal: "4,941", live: CORPUS.counts.cards, what: "cards in the corpus" },
  {
    literal: "16,502",
    live: CORPUS.counts.printings,
    what: "printings across every set",
  },
  { literal: "1,278", live: RULE_PAGES.length, what: "rule permalinks" },
  {
    literal: "11,378",
    live: CARD_ROUTES.length,
    what: "card routes — the figure two files got wrong, two different ways",
  },
  {
    literal: "12,776",
    live: TOTAL_PAGES,
    what: "pages in the build, the most-quoted number in the repository",
  },
];

describe("the figures written into prose are still true", () => {
  test("there are files to read", () => {
    // A walker that silently returned nothing would make every mention count
    // zero and every assertion below meaningless.
    expect(FILES.length).toBeGreaterThan(200);
  });

  for (const figure of FIGURES) {
    test(`${figure.literal} — ${figure.what}`, () => {
      expect(format(figure.live)).toBe(figure.literal);
    });
  }
});

describe("and they are quoted often enough to be worth owning", () => {
  for (const figure of FIGURES) {
    test(`${figure.literal} is written down somewhere`, () => {
      const where = mentions(figure.literal);
      /*
       * A figure nobody quotes does not need this test, and one that has
       * quietly stopped being quoted means the assertion above went vacuous
       * without anybody noticing. Either way the entry should be reconsidered
       * rather than left sitting here looking like coverage.
       *
       * `11,378` is the exception and is allowed to be unquoted: the two
       * comments that named it were removed for being wrong, and the point of
       * keeping it here is that the next person to write it down gets it
       * checked.
       */
      if (figure.literal === "11,378") return;
      expect(where.length).toBeGreaterThan(0);
    });
  }
});
