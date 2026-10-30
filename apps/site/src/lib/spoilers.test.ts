/**
 * The spoilers file, against the card and sets corpora it sits beside.
 *
 * Written against properties rather than figures, because the file is rebuilt
 * daily and a count asserted here would fail on the first new reveal. What must
 * hold on every rebuild is the JOIN: a spoiler is by definition a card the
 * corpus does not have yet, and every printing it lists must resolve to a set
 * the file names.
 */
import { describe, expect, test } from "bun:test";

import { CORPUS } from "./cards";
import { SETS } from "./sets";
import {
  printingLabel,
  SPOILER_CARDS,
  SPOILER_GROUPS,
  SPOILERS,
  SPOILERS_AS_OF,
  spoilerFaceKey,
} from "./spoilers";

describe("the spoilers file", () => {
  test("no spoiler shown is a card the corpus already carries", () => {
    /* The predicate that graduates a card. The builder applies it, and
       `SPOILER_CARDS` applies it again in case a corpus sync lands first. */
    const released = new Set(CORPUS.cards.map((card) => card.unique_id));
    const both = SPOILER_CARDS.filter((card) =>
      released.has(card.unique_id),
    ).map((card) => card.name);
    expect(both).toEqual([]);
  });

  test("every spoiler has a printing, and each names a listed set", () => {
    const sets = new Set(SPOILERS.sets.map((set) => set.id));
    for (const card of SPOILERS.cards) {
      expect(`${card.name}: ${card.printings.length > 0}`).toBe(
        `${card.name}: true`,
      );
      for (const printing of card.printings) {
        expect(
          `${printing.id} in ${printing.set_id}: ${sets.has(printing.set_id)}`,
        ).toBe(`${printing.id} in ${printing.set_id}: true`);
      }
    }
  });

  test("no listed set is out according to our own sets corpus", () => {
    /* The builder judges release against the upstream branch's set.json; this
       is the same claim checked against the released corpus's. A set that
       corpus dates on or before the newest upstream commit is not upcoming. */
    for (const set of SPOILERS.sets) {
      const ours = SETS.sets.find((record) => record.id === set.id);
      if (ours?.released == null || SPOILERS_AS_OF === null) continue;
      expect(`${set.id} upcoming: ${ours.released > SPOILERS_AS_OF}`).toBe(
        `${set.id} upcoming: true`,
      );
    }
  });

  test("the counts match the arrays", () => {
    expect(SPOILERS.counts).toEqual({
      cards: SPOILERS.cards.length,
      sets: SPOILERS.sets.length,
    });
  });

  test("the file carries the rights line", () => {
    expect(SPOILERS.rights).toContain("Legend Story Studios");
  });
});

describe("SPOILER_GROUPS", () => {
  test("every spoiler appears under every set it is printed in", () => {
    for (const card of SPOILER_CARDS) {
      const expected = [...new Set(card.printings.map((p) => p.set_id))];
      const listed = SPOILER_GROUPS.filter((group) =>
        group.cards.some((entry) => entry.card.unique_id === card.unique_id),
      ).map((group) => group.set.id);
      expect(listed.toSorted()).toEqual(expected.toSorted());
    }
  });

  test("no group is empty", () => {
    for (const group of SPOILER_GROUPS) {
      expect(group.cards.length).toBeGreaterThan(0);
    }
  });
});

describe("printingLabel", () => {
  test("decodes the rarity rather than printing upstream's letter", () => {
    expect(
      printingLabel({
        id: "OBK041",
        set_id: "OBK",
        rarity: "M",
        image_url: null,
      }),
    ).toBe("OBK041 · Majestic");
  });
});

describe("spoilerFaceKey", () => {
  const at = (id: string, image_url: string | null) => ({
    id,
    set_id: id.slice(0, 3),
    rarity: "M",
    image_url,
  });
  const s3 =
    "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/";

  test("takes the first printing that publishes an image", () => {
    expect(
      spoilerFaceKey([at("OBK006", null), at("OBK006", `${s3}OBK006-MV.webp`)]),
    ).toBe("spoiler-OBK006-MV.webp");
  });

  test("is null where no printing publishes one", () => {
    expect(spoilerFaceKey([at("OBK006", null)])).toBeNull();
  });
});
