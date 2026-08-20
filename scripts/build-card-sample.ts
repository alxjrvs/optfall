#!/usr/bin/env bun
/**
 * Writes `data/cards/sample.json` — twenty cards, same schema as the corpus.
 *
 * WHY THIS EXISTS, AND IT IS NOT ABOUT TESTS. The site build does not read this
 * file, and no test asserts behaviour through it — the one test that opens it,
 * `build-card-sample.test.ts`, is checking this generator rather than using the
 * sample as a fixture. It exists because `data/cards/cards.json` is 18 MB,
 * and the obvious first move against an unfamiliar corpus — open it, or grep it
 * for a card name — costs an agent its entire context in one call, with no
 * warning and nothing smaller to reach for. `CLAUDE.md` names this file as the
 * thing to reach for instead.
 *
 * IT IS DERIVED, NOT CURATED, so that it cannot quietly stop resembling the
 * corpus. The selection below is deterministic: same corpus in, same twenty
 * cards out, byte for byte. `build-card-sample.test.ts` regenerates and
 * compares, so a corpus refresh that changes the sample is a diff somebody
 * reviews rather than a fixture that silently describes last quarter's data.
 *
 * THE SELECTION IS COVERAGE-FIRST, NOT RANDOM. A random twenty out of 4,941 is
 * ninety-five per cent ordinary cards: every pitch is 1, 2 or 3, nothing is
 * banned, nothing is double-faced, and an agent reasoning from it concludes the
 * shapes it never saw do not exist. So the buckets below claim one card each
 * for the axes that actually break code — the legality states, the stat
 * combinations, the multi-face printings — and a stable stride fills the rest
 * with ordinary cards for texture.
 *
 * Run: `bun run corpus:sample`
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import corpus from "../data/cards/cards.json";

const OUT_PATH = join(import.meta.dir, "..", "data", "cards", "sample.json");

/**
 * How many cards the sample carries.
 *
 * TWENTY IS A CONTEXT BUDGET, NOT A ROUND NUMBER. Cards run ~3.4 kB each, so
 * fifty came to 164 kB — a hundredfold better than the corpus and still ~41k
 * tokens, which is not a file anyone reads. Twenty is ~90 kB: enough to hold
 * every axis below plus a few ordinary cards, and cheap enough that reading the
 * whole thing is a decision rather than an accident.
 *
 * This file is for seeing the SHAPE. Looking up a particular card is a
 * different job and wants `bun -e` against `cards.ts`, because the card you
 * want is almost certainly not one of these twenty.
 */
const SAMPLE_SIZE = 20;

interface Card {
  readonly unique_id: string;
  readonly name: string;
  readonly pitch: unknown;
  readonly power: unknown;
  readonly defense: unknown;
  readonly health: unknown;
  readonly types: readonly string[];
  readonly legality: Record<string, unknown>;
  readonly printings: readonly unknown[];
  readonly [key: string]: unknown;
}

const cards = (corpus as unknown as { cards: readonly Card[] }).cards;

/**
 * One card per axis that has ever needed its own branch in this codebase.
 *
 * Each predicate takes the FIRST match in `unique_id` order rather than the
 * most interesting one, because "first in a stable sort" is reproducible and
 * "most interesting" is a judgement that would need re-making every refresh.
 */
const AXES: readonly (readonly [string, (card: Card) => boolean])[] = [
  ["cc_banned", (c) => c.legality["cc_banned"] === true],
  ["blitz_banned", (c) => c.legality["blitz_banned"] === true],
  ["commoner_banned", (c) => c.legality["commoner_banned"] === true],
  ["ll_restricted", (c) => c.legality["ll_restricted"] === true],
  ["cc_living_legend", (c) => c.legality["cc_living_legend"] === true],
  ["blitz_living_legend", (c) => c.legality["blitz_living_legend"] === true],
  ["silver_age_banned", (c) => c.legality["silver_age_banned"] === true],
  ["upf_banned", (c) => c.legality["upf_banned"] === true],
  // AN ABSENT STAT IS THE EMPTY STRING, NOT NULL, and every stat is a string
  // even when it reads as a number — `pitch` is "1", not 1. Upstream's
  // encoding, kept verbatim. The first draft of these predicates tested
  // `!== null`, which is true of "" and therefore matched every card in the
  // corpus; the coverage assertions in the test are what caught it.
  //
  // A hero has health and no pitch; an attack has power; an instant has
  // defence and no power. Code assuming a card carries all of them, or any of
  // them, breaks on one of these four.
  ["hero", (c) => c.health !== ""],
  ["no-pitch", (c) => c.pitch === ""],
  ["power-no-defense", (c) => c.power !== "" && c.defense === ""],
  ["defense-no-power", (c) => c.defense !== "" && c.power === ""],
  // Multi-printing and multi-face cards are where the printing picker, the
  // version marks and the face resolver all earn their complexity.
  ["multi-printing", (c) => c.printings.length > 1],
  ["single-printing", (c) => c.printings.length === 1],
  ["played-horizontally", (c) => c["played_horizontally"] === true],
];

const byId = [...cards].sort((a, b) => a.unique_id.localeCompare(b.unique_id));

const chosen = new Map<string, Card>();

for (const [, matches] of AXES) {
  const hit = byId.find((card) => matches(card) && !chosen.has(card.unique_id));
  if (hit) chosen.set(hit.unique_id, hit);
}

/**
 * Fill the remainder by walking the sorted corpus at a fixed stride.
 *
 * A stride rather than a slice: the first twenty cards in id order are an
 * alphabetical clump from one or two sets, which is its own kind of
 * unrepresentative.
 *
 * The `|| 1` is not decoration. On a corpus smaller than `SAMPLE_SIZE` the
 * floor is 0, and `i += 0` never advances — so a shrunken or partially-built
 * corpus would hang this script rather than fail it. At 4,941 cards that is
 * unreachable; it costs two characters to make it stay unreachable.
 */
const stride = Math.floor(byId.length / SAMPLE_SIZE) || 1;
for (let i = 0; chosen.size < SAMPLE_SIZE && i < byId.length; i += stride) {
  const card = byId[i];
  if (card && !chosen.has(card.unique_id)) chosen.set(card.unique_id, card);
}

const sampled = [...chosen.values()].sort((a, b) =>
  a.unique_id.localeCompare(b.unique_id),
);

const source = corpus as unknown as Record<string, unknown>;

/**
 * The header is the corpus's own, with `counts` recomputed and a `sample`
 * block added.
 *
 * `rights` and `source` are copied VERBATIM and must stay: this file carries
 * the same third-party card text as the corpus it came from, so it carries the
 * same obligations. A sample that dropped the rights notice would be the one
 * copy of this data with no licence attached to it.
 */
const sample = {
  schemaVersion: source["schemaVersion"],
  source: source["source"],
  rights: source["rights"],
  sample: {
    of: "data/cards/cards.json",
    generator: "scripts/build-card-sample.ts",
    note: "A derived, deterministic subset, for reading and for agent context. The site build does not read it; `scripts/build-card-sample.test.ts` does, to assert it still matches this generator. Do not hand-edit — run `bun run corpus:sample`.",
  },
  legalityFlags: source["legalityFlags"],
  counts: {
    cards: sampled.length,
    printings: sampled.reduce((n, c) => n + c.printings.length, 0),
    names: new Set(sampled.map((c) => c.name)).size,
  },
  cards: sampled,
};

/** The trailing newline matters — the drift check compares bytes. */
export const render = (): string => `${JSON.stringify(sample, null, 2)}\n`;

if (import.meta.main) {
  const text = render();
  await writeFile(OUT_PATH, text, "utf8");
  console.log(
    `data/cards/sample.json — ${sampled.length} cards, ` +
      `${sample.counts.printings} printings, ${(text.length / 1024).toFixed(0)} kB.`,
  );
}
