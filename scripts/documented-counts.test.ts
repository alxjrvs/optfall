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

import { ROOT } from "./lib/root";

import { CARD_PAGES, CARD_ROUTES, CORPUS } from "../apps/site/src/lib/cards";
import { RULE_PAGES } from "../apps/site/src/lib/rules";
import { SETS } from "../apps/site/src/lib/sets";

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

/**
 * Two figures that look like drift and are not.
 *
 * BOTH WERE RAISED AS SUSPECTED DEFECTS BY AN AUDIT, and both turned out to be
 * correct prose describing a DIFFERENT metric from the obvious one. Neither was
 * changed — "fixing" a number that was right is the same defect as leaving one
 * that is wrong, committed fresh — but a claim that reads as an error every time
 * someone counts will keep being re-raised until the relationship behind it is
 * written down somewhere that fails.
 *
 * So the arithmetic is asserted rather than argued. If either relationship
 * changes, this says so, and until then it is a standing answer to the question.
 */
describe("the two figures that look wrong and are not", () => {
  test("1,269 and 1,278 count different things, and both are right", () => {
    /*
     * 1,269 is "87 sections + 548 rules + 634 subrules" — the subtotal two
     * now-retired documents quoted, being the figure they used when reconciling
     * the parsed corpus against a grep of the extracted rules text. Both were
     * deleted on 2026-09-01 and are in the git history. Everywhere else says
     * 1,278. The nine between them are the CHAPTERS, which are pages like any
     * other node but are not one of the three things that subtotal names.
     */
    const byLevel = new Map<string, number>();
    for (const page of RULE_PAGES) {
      const level = page.section.level;
      byLevel.set(level, (byLevel.get(level) ?? 0) + 1);
    }

    expect(byLevel.get("chapter")).toBe(9);
    expect(byLevel.get("section")).toBe(87);
    expect(byLevel.get("rule")).toBe(548);
    expect(byLevel.get("subrule")).toBe(634);

    /* The published subtotal, and the total it is nine short of. */
    /* This line was `expect(87 + 548 + 634).toBe(1269)` — constants on both
       sides, so it could not fail. The three assertions above are the live
       ones; this now checks the same sum against the figure actually derived
       from the corpus, which is what it was presumably always meant to do. */
    const subtotal =
      (byLevel.get("section") ?? 0) +
      (byLevel.get("rule") ?? 0) +
      (byLevel.get("subrule") ?? 0);
    expect(subtotal).toBe(1269);
    expect(1269 + 9).toBe(RULE_PAGES.length);
  });

  test("faces.ts counts URLs where a reader counts basenames", () => {
    /*
     * `faces.ts` says 11,377 distinct images and 11,376 distinct basenames in
     * the same docblock, and names the single cause: `LGS387.webp` is served
     * from two hosts, byte-identical, so collapsing it to one key is correct
     * rather than lossy. Count the keys and the prose looks off by one; read the
     * next sentence and it is exact.
     */
    const urls = new Set<string>();
    const basenames = new Set<string>();
    for (const card of CORPUS.cards) {
      for (const printing of card.printings ?? []) {
        const url = printing.image_url;
        if (!url) continue;
        urls.add(url);
        basenames.add(url.split("/").pop() ?? "");
      }
    }

    expect(urls.size).toBe(11_377);
    expect(basenames.size).toBe(11_376);

    /* Named in the docblock, so the "one collision" stays exactly one and stays
       the one the prose says it is. */
    const perBasename = new Map<string, number>();
    for (const url of urls) {
      const base = url.split("/").pop() ?? "";
      perBasename.set(base, (perBasename.get(base) ?? 0) + 1);
    }
    expect(
      [...perBasename.entries()]
        .filter(([, count]) => count > 1)
        .map(([base]) => base),
    ).toEqual(["LGS387.webp"]);
  });
});

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
