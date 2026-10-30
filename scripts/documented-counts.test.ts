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
import { faceKeyFor } from "../apps/site/src/lib/faces";
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
 * syntax and data-terms — and `/404`, which is the ninth. Spelled here because
 * there is no list to import — an unregistered page is not a URL, by design, so
 * `routes.ts` is the only record and it mixes these with the generated ones.
 *
 * `/404` IS COUNTED EVEN THOUGH IT IS NOT AN ADDRESS. `routes.ts` registers it
 * `sitemap: false` and calls it "the only registration that is not an address",
 * which is right about what it IS — a response to a path that names nothing.
 * But this constant feeds a total that is quoted as what the BUILD EMITS, and
 * the build emits `404.html` like any other page: check:disclaimer walks it,
 * check:built-tokens walks it, check:card-notice walks it. A total that skipped
 * it would be a number no check in the gate could reproduce.
 */
const FIXED_PAGES = 9;

const TOTAL_PAGES =
  CARD_ROUTES.length + RULE_PAGES.length + setPages + FIXED_PAGES;

const format = (n: number) => n.toLocaleString("en-US");

/** Each figure, the live value behind it, and why it is quoted so widely. */
const FIGURES: readonly {
  readonly literal: string;
  readonly live: number;
  readonly what: string;
}[] = [
  { literal: "5,205", live: CORPUS.counts.cards, what: "cards in the corpus" },
  {
    literal: "17,291",
    live: CORPUS.counts.printings,
    what: "printings across every set",
  },
  { literal: "1,278", live: RULE_PAGES.length, what: "rule permalinks" },
  {
    literal: "17,073",
    live: CARD_ROUTES.length,
    what: "card routes — the figure two files got wrong, two different ways",
  },
  {
    literal: "18,478",
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

  test("faces.ts counts URLs where a reader counts keys", () => {
    /*
     * `faces.ts` says 17,071 face keys, and `printings.ts` beside it; the
     * corpus has 17,072 distinct image URLs. The single cause is named there:
     * Ponder's `DYN244` is published as an S3 WebP and a fabmaster PNG of the
     * same art, and the key drops the extension, so two URLs are one face.
     * Count the URLs and the prose looks off by one; read the next sentence
     * and it is exact.
     *
     * ~~11,377 URLs and 11,376 basenames, the one being `LGS387.webp` on two
     * hosts.~~ That was upstream 7a4822f. At 01fc934 the two `DYN244` URLs
     * differ in extension, so the RAW basenames no longer collide — only the
     * key does — and the test counts keys.
     */
    const urls = new Set<string>();
    const urlsByKey = new Map<string, Set<string>>();
    for (const card of CORPUS.cards) {
      for (const printing of card.printings ?? []) {
        const url = printing.image_url;
        const key = faceKeyFor(url);
        if (!url || key === null) continue;
        urls.add(url);
        const seen = urlsByKey.get(key) ?? new Set<string>();
        seen.add(url);
        urlsByKey.set(key, seen);
      }
    }

    expect(urls.size).toBe(17_072);
    expect(urlsByKey.size).toBe(17_071);

    /* Named in the docblock, so the "one collision" stays exactly one and stays
       the one the prose says it is. */
    expect(
      [...urlsByKey.entries()]
        .filter(([, seen]) => seen.size > 1)
        .map(([key]) => key),
    ).toEqual(["DYN244.webp"]);
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
       * The card-route count is the exception and is allowed to be unquoted:
       * the two comments that named it (as `11,378`) were removed for being
       * wrong, and the point of keeping it here is that the next person to
       * write it down gets it checked. It is quoted today; the exemption
       * stays so that removing those quotes is not a test failure.
       */
      if (figure.what.startsWith("card routes")) return;
      expect(where.length).toBeGreaterThan(0);
    });
  }
});
