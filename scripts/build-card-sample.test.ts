/**
 * Asserts `data/cards/sample.json` is what the generator emits, and that it
 * still covers the axes it exists to cover.
 *
 * TWO DIFFERENT FAILURES, AND THE SECOND IS THE ONE THAT EARNS THIS FILE.
 *
 * The drift half is routine: the sample is generated and committed, so it can
 * be edited by hand or left behind by a corpus refresh, and a committed
 * artefact with no drift check is a file that describes whatever was true when
 * someone last remembered it. `design-system-coverage.test.ts` makes the same
 * argument for the workbench.
 *
 * The coverage half is not routine, and it caught a real bug while this was
 * being written. The selection predicates first tested `card.health !== null`
 * — reasonable, and wrong: an absent stat in this corpus is the EMPTY STRING,
 * so that predicate is true of every card and the "hero" bucket silently
 * claimed all twenty. A byte-comparison would have passed happily, because the
 * generator was deterministic and the committed file was exactly what it
 * emitted. Only asserting that the sample contains a card with no pitch, and a
 * card with defence and no power, says that the fifty lines of selection logic
 * did anything at all.
 *
 * So: the drift half proves the file matches the generator, and the coverage
 * half proves the generator is worth matching.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "./build-card-sample";

const SAMPLE_PATH = join(import.meta.dir, "..", "data", "cards", "sample.json");

const committed = readFileSync(SAMPLE_PATH, "utf8");

interface SampleCard {
  readonly unique_id: string;
  readonly name: string;
  readonly pitch: string;
  readonly power: string;
  readonly defense: string;
  readonly health: string;
  readonly legality: Record<string, unknown>;
  readonly printings: readonly unknown[];
  readonly played_horizontally?: boolean;
}

const sample = JSON.parse(committed) as {
  readonly rights: unknown;
  readonly source: unknown;
  readonly counts: { readonly cards: number; readonly printings: number };
  readonly cards: readonly SampleCard[];
};

describe("card sample: drift", () => {
  test("the committed file is byte-identical to the generator's output", () => {
    // Not a deep-equal on the parsed object: key order and indentation are
    // part of what a reader sees, and a reordered file is a diff nobody asked
    // for. `bun run corpus:sample` is the fix.
    expect(committed).toBe(render());
  });
});

describe("card sample: obligations", () => {
  // This file carries the same third-party card text as the corpus, so it
  // carries the same obligations. A sample that dropped the rights notice
  // would be the one copy of this data with no licence attached.
  test("it carries the corpus's rights notice and source", () => {
    expect(sample.rights).toBeTruthy();
    expect(sample.source).toBeTruthy();
  });

  test("its counts describe itself, not the corpus it came from", () => {
    expect(sample.counts.cards).toBe(sample.cards.length);
    expect(sample.counts.printings).toBe(
      sample.cards.reduce((n, c) => n + c.printings.length, 0),
    );
  });
});

describe("card sample: coverage", () => {
  const has = (label: string, matches: (card: SampleCard) => boolean): void => {
    test(`contains a card that is ${label}`, () => {
      const found = sample.cards.filter(matches).map((c) => c.name);
      expect(found.length, `no ${label} card in the sample`).toBeGreaterThan(0);
    });
  };

  // An absent stat is "", never null. These four assertions are the reason
  // this block exists — see the header.
  has("a hero (has health)", (c) => c.health !== "");
  has("pitchless", (c) => c.pitch === "");
  has("power with no defence", (c) => c.power !== "" && c.defense === "");
  has("defence with no power", (c) => c.defense !== "" && c.power === "");

  has("banned in CC", (c) => c.legality["cc_banned"] === true);
  has("banned in Blitz", (c) => c.legality["blitz_banned"] === true);
  has("banned in Commoner", (c) => c.legality["commoner_banned"] === true);
  has(
    "restricted in Living Legend",
    (c) => c.legality["ll_restricted"] === true,
  );
  has("a CC living legend", (c) => c.legality["cc_living_legend"] === true);
  has("banned in UPF", (c) => c.legality["upf_banned"] === true);

  has("printed more than once", (c) => c.printings.length > 1);
  has("printed exactly once", (c) => c.printings.length === 1);
  has("played horizontally", (c) => c.played_horizontally === true);

  test("it is small enough to be worth reading", () => {
    // The whole point is a file an agent can open instead of an 18 MB one.
    // If a corpus change pushes this past ~120 kB, lower SAMPLE_SIZE rather
    // than letting the alternative quietly stop being an alternative.
    expect(committed.length).toBeLessThan(120 * 1024);
  });

  test("every card is distinct", () => {
    const ids = sample.cards.map((c) => c.unique_id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
