/**
 * Design-system catalog guard — the executable half of the taxonomy documented
 * in `docs/DESIGN.md`.
 *
 * The standard, in one line: **ONE public primitive = ONE card = ONE nav leaf,
 * titled `Group/Primitive` with the leaf pinned to the primitive's own id.**
 *
 * ## Why this exists, and why presence alone was not enough
 *
 * This repository is the third to arrive at this rule, and the first two wrote
 * down what happens without it.
 *
 * `SU-SRD` enforces it in `component-lib/src/story-coverage.test.ts` and
 * records multi-component "gallery" story files that left their members
 * invisible in the nav. `binfinite-app` enforces it in
 * `component-lib/scripts/check-stories.ts` and records the sharper number: 74
 * titles resolving to 17 top-level groups that encoded four incompatible things
 * at once — release phase, ticket id, audience and platform — because a title
 * is the only thing that puts a component somewhere findable and nothing was
 * checking it, so every author invented a group and none of them agreed.
 *
 * Optfall had both failures at once, at a smaller scale, which is the cheapest
 * moment to fix them:
 *
 * - **Seven of thirteen primitives had no card.** `BevelledPlate`, `Mark`,
 *   `ResultRow` and `FiligreeCorner` were undemonstrated outright.
 * - **`rule-and-citation.html` was a gallery** — one card standing in for
 *   `OrnamentalRule`, `Citation` and `BrassSeal` — and two of the three had
 *   already drifted inside it unnoticed: the citation was captioned
 *   "monospaced" after that face was retired from the system, and the brass
 *   seal was a flat badge with no version band, the one field
 *   `docs/DATA-TERMS.md` Layer 3 requires be impossible to miss.
 *
 * A gallery is the failure worth naming, because it looks like coverage.
 *
 * ## It gates the SOURCE, and proves the OUTPUT matches
 *
 * `cards` is imported from the generator rather than scraped out of the
 * committed HTML, so the checks read the declaration a contributor actually
 * edits. The bundle is then asserted to be exactly what that declaration
 * renders — the generator's own header records the bundle going stale because
 * it was built from a scratch directory and nothing prompted a re-run, so
 * "committed output equals generator output" is the assertion that keeps every
 * other one honest.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

import {
  PRIMITIVES,
  type PrimitiveName,
} from "../packages/components/src/index";
import {
  DS_GROUPS,
  GROUP_DIR,
  cards,
  page,
  primitiveCardTitle,
} from "./build-design-system";

const BUNDLE = join(import.meta.dir, "..", "design-system");

/**
 * Primitives that are deliberately demonstrated somewhere other than their own
 * card.
 *
 * **EMPTY, and that is the healthy state.** It starts empty because the
 * adoption pass wrote the seven missing cards rather than exempting them, which
 * is the only version of this rule worth having — an allowlist that absorbs the
 * backlog is a rule that never applies to anything.
 *
 * Add a name here only when a primitive genuinely cannot stand alone, with a
 * one-line rationale. The stale-entry test below keeps the list honest: an
 * entry that no longer names a real primitive, or that names one which has
 * since gained a card, fails.
 */
const ALLOWLIST = new Set<PrimitiveName>([]);

const primitiveCards = cards.filter((card) => card.group === "Primitives");

/** `primitives/pitch-jewel.html` → `pitch-jewel`. */
function leafOf(path: string): string {
  return basename(path, extname(path));
}

/** Every `.html` file actually committed under `design-system/`. */
function committed(): string[] {
  return Object.values(GROUP_DIR).flatMap((dir) => {
    const full = join(BUNDLE, dir);
    return existsSync(full)
      ? readdirSync(full)
          .filter((name) => name.endsWith(".html"))
          .map((name) => `${dir}/${name}`)
      : [];
  });
}

describe("design-system catalog: coverage", () => {
  test("every primitive the library declares has a card of its own", () => {
    const demonstrated = new Set(
      primitiveCards.map((card) => leafOf(card.path)),
    );

    const uncovered = PRIMITIVES.filter((id) => !ALLOWLIST.has(id))
      .filter((id) => !demonstrated.has(id))
      .map(
        (id) =>
          `${id} — no design-system card. Add one at ` +
          `\`primitives/${id}.html\` titled "${primitiveCardTitle(id)}", or ` +
          `justify an ALLOWLIST entry.`,
      )
      .toSorted();

    expect(uncovered).toEqual([]);
  });

  test("the allowlist has no stale entries", () => {
    const demonstrated = new Set(
      primitiveCards.map((card) => leafOf(card.path)),
    );
    const declared = new Set<string>(PRIMITIVES);

    const stale = [...ALLOWLIST]
      .map((id) => {
        if (!declared.has(id))
          return `${id} is no longer in PRIMITIVES — prune it from ALLOWLIST`;
        if (demonstrated.has(id))
          return `${id} now has its own card — prune it from ALLOWLIST`;
        return null;
      })
      .filter((problem) => problem !== null)
      .toSorted();

    expect(stale).toEqual([]);
  });

  test("no card documents a primitive that does not exist", () => {
    // The converse of coverage: this walks card → primitive, so a card left
    // behind by a renamed or deleted primitive is caught rather than ignored.
    const declared = new Set<string>(PRIMITIVES);

    const orphans = primitiveCards
      .filter((card) => !declared.has(leafOf(card.path)))
      .map(
        (card) =>
          `${card.path} — '${leafOf(card.path)}' is not in PRIMITIVES. A card ` +
          `under primitives/ documents exactly one declared primitive.`,
      )
      .toSorted();

    expect(orphans).toEqual([]);
  });
});

describe("design-system catalog: taxonomy", () => {
  test("every card is in a sanctioned group", () => {
    const groups: readonly string[] = DS_GROUPS;

    const offenders = cards
      .filter((card) => !groups.includes(card.group))
      .map(
        (card) =>
          `${card.path}: '${card.group}' is not a sanctioned group ` +
          `(${DS_GROUPS.join(", ")})`,
      )
      .toSorted();

    expect(offenders).toEqual([]);
  });

  test("a card's path sits in the directory its group names", () => {
    // The group and the path prefix are two spellings of one fact. Nineteen
    // cards state both, which is nineteen chances for them to disagree.
    const offenders = cards
      .filter((card) => !card.path.startsWith(`${GROUP_DIR[card.group]}/`))
      .map(
        (card) =>
          `${card.path}: group '${card.group}' expects ` +
          `'${GROUP_DIR[card.group]}/…'`,
      )
      .toSorted();

    expect(offenders).toEqual([]);
  });

  test("nesting never exceeds Group/Leaf", () => {
    const offenders = cards
      .filter((card) => card.path.split("/").length !== 2)
      .map((card) => `${card.path} nests deeper than <group>/<leaf>.html`)
      .toSorted();

    expect(offenders).toEqual([]);
  });

  test("a primitive card's title is its own id, so the two cannot drift", () => {
    /*
      THE LEAF IS PINNED TO THE FILENAME, AND THE FILENAME TO `PRIMITIVES`.

      This is the check the other two repositories both landed on last and both
      say they should have had first. A title is the only thing that puts a
      primitive somewhere findable, so a hand-written one drifts into naming
      something the code does not have — 'Containers/Modal' pointing at
      ModalShell, or here, a card headed "Rules, citations and brass" standing
      in for three primitives and tracking none of them.

      Deriving the title from the id removes the choice rather than policing it.
    */
    const offenders = primitiveCards
      .filter((card) => {
        const leaf = leafOf(card.path);
        if (!(PRIMITIVES as readonly string[]).includes(leaf)) return false;
        return card.title !== primitiveCardTitle(leaf as PrimitiveName);
      })
      .map(
        (card) =>
          `${card.path}: title is '${card.title}', expected ` +
          `'${primitiveCardTitle(leafOf(card.path) as PrimitiveName)}'`,
      )
      .toSorted();

    expect(offenders).toEqual([]);
  });

  test("no two cards claim the same path or the same title", () => {
    const collisionsIn = (
      label: string,
      key: (card: (typeof cards)[number]) => string,
    ): string[] => {
      const seen = new Map<string, string[]>();
      for (const card of cards) {
        seen.set(key(card), [...(seen.get(key(card)) ?? []), card.path]);
      }
      return [...seen.entries()]
        .filter(([, paths]) => paths.length > 1)
        .map(([value, paths]) => `${label} '${value}': ${paths.join(" + ")}`);
    };

    expect(
      [
        ...collisionsIn("path", (card) => card.path),
        ...collisionsIn("title", (card) => card.title),
      ].toSorted(),
    ).toEqual([]);
  });

  test("Foundations and Screens carry free-form titles, and no primitive id", () => {
    // These two groups document the system and the assembled product rather
    // than one component each, so their titles are prose. What they may NOT do
    // is quietly claim a primitive's leaf, which would put two cards in the
    // reader's path to the same thing.
    const reserved = new Set<string>(PRIMITIVES);

    const offenders = cards
      .filter((card) => card.group !== "Primitives")
      .filter((card) => reserved.has(leafOf(card.path)))
      .map(
        (card) =>
          `${card.path}: '${leafOf(card.path)}' is a primitive id — a card ` +
          `documenting a primitive belongs under primitives/`,
      )
      .toSorted();

    expect(offenders).toEqual([]);
  });
});

describe("design-system catalog: the committed bundle", () => {
  test("every declared card is committed, and nothing else is", () => {
    const declared = cards.map((card) => card.path).toSorted();
    expect(committed().toSorted()).toEqual(declared);
  });

  test("every committed card is exactly what the generator renders", () => {
    /*
      The generator's own header records why: the bundle "was written in a
      scratch directory, which is precisely why nothing prompted a re-run when
      the components moved underneath it". Without this, every check above
      gates a declaration that the published HTML need not resemble.

      Re-run `bun run design-system` and commit the result.
    */
    const stale = cards
      // A card with no file at all is the test above's finding, reported there
      // with a message that says so. Reading it here would throw ENOENT and
      // bury that under a stack trace.
      .filter((card) => existsSync(join(BUNDLE, card.path)))
      .filter(
        (card) => readFileSync(join(BUNDLE, card.path), "utf8") !== page(card),
      )
      .map((card) => card.path)
      .toSorted();

    expect(stale).toEqual([]);
  });
});
