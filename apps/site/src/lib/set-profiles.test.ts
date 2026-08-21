/**
 * The set profiles, held to the arithmetic they claim.
 *
 * WHAT THIS FILE IS ACTUALLY GUARDING is a rendering, not a number. The rarity
 * bar draws one slice per rarity, sized by count, and a bar whose slices do not
 * add up to the run it stands for is wrong in a way nobody can see — it renders
 * cleanly, in plausible proportions, about a print run that does not exist. So
 * the sums are asserted here rather than trusted to a component that has no way
 * to check them.
 *
 * ASSERTED AS INVARIANTS OVER THE WHOLE CORPUS WHERE POSSIBLE, AND AS PINNED
 * FIGURES ONLY WHERE THE INVARIANT WOULD BE VACUOUS. `names <= versions <=
 * printings` is true of every set for a structural reason and catches a whole
 * class of confusion between the three; "Smash Palace has 30 exclusive names of
 * 34" is a fact about this corpus at this commit, and it is here because
 * exclusivity is the one figure with no invariant strong enough to catch it
 * being computed at the wrong grain. A version-level count would be larger than
 * the name count on any set with a pitch cycle in it, and nothing weaker than a
 * real number would notice.
 */

import { describe, expect, test } from "bun:test";

import { CORPUS, slugify } from "./cards";
import { RARITY_RANK } from "./card-search/grammar";
import { SET_PROFILES } from "./set-profiles";
import { SETS } from "./sets";

describe("every set the corpus carries a card from", () => {
  test("is profiled, and no profile names a set upstream does not publish", () => {
    const upstream = new Set(SETS.sets.map((set) => set.id));
    const unknown = [...SET_PROFILES.keys()]
      .filter((id) => !upstream.has(id))
      .toSorted();

    expect(unknown).toEqual([]);
    /*
     * NOT `toBe(SETS.counts.sets)`, and the gap is the point of the module.
     * Upstream publishes sets this corpus has no card from — `/sets` has always
     * omitted them — so the profile count is the smaller number, and pinning it
     * to the larger one would be asserting the filter does not exist.
     */
    expect(SET_PROFILES.size).toBeLessThan(SETS.counts.sets);
    expect(SET_PROFILES.size).toBeGreaterThan(0);
  });
});

describe("the three counts are three different numbers", () => {
  test("names never exceed versions, and versions never exceed printings", () => {
    /*
     * THE STRUCTURAL FACT, WHICH IS WHY IT HOLDS EVERYWHERE: a name is one or
     * more pitch versions, and a version is one or more printings. A profile
     * that had counted printings under `names` — the confusion this module's
     * header exists to head off — breaks this on every set with a reprint in
     * it, which is most of them.
     */
    const inverted = [...SET_PROFILES.values()]
      .filter(
        (profile) =>
          profile.names > profile.versions ||
          profile.versions > profile.printings,
      )
      .map((profile) => profile.id)
      .toSorted();

    expect(inverted).toEqual([]);
  });

  test("Monarch is 155 names, 307 versions and 1,182 printings", () => {
    /*
     * THE SET THE OTHER SURFACES ARGUE OVER, pinned so the three numbers cannot
     * quietly become one. `set.page.tsx` prints the first two side by side
     * precisely because they disagree, and this is the largest disagreement in
     * the corpus.
     */
    const monarch = SET_PROFILES.get("MON");
    expect(monarch?.names).toBe(155);
    expect(monarch?.versions).toBe(307);
    expect(monarch?.printings).toBe(1182);
  });
});

describe("the rarity mix", () => {
  test("adds up to the set's printings, on every set", () => {
    const wrong = [...SET_PROFILES.values()]
      .filter(
        (profile) =>
          profile.rarities.reduce((sum, slice) => sum + slice.count, 0) !==
          profile.printings,
      )
      .map((profile) => profile.id)
      .toSorted();

    expect(wrong).toEqual([]);
  });

  test("draws no empty slice, because a floored zero would be a lie", () => {
    /*
     * `RarityBar` floors every slice at two pixels so a rarity present in tiny
     * numbers is not invisible. The cost of that floor is that a ZERO would be
     * drawn too — a rarity the set does not contain, in its own colour, two
     * pixels wide. The component filters them; this makes sure none is ever
     * offered.
     */
    const empty = [...SET_PROFILES.values()]
      .filter((profile) => profile.rarities.some((slice) => slice.count <= 0))
      .map((profile) => profile.id)
      .toSorted();

    expect(empty).toEqual([]);
  });

  test("reads in the search grammar's ladder, not in tally order", () => {
    /*
     * THE ORDER IS THE ONE NON-COLOUR CHANNEL THE BAR HAS, so it has to be the
     * same on every set or it carries nothing. A `Map` iterates in insertion
     * order, which here is the order upstream happens to list a set's
     * printings — the exact "accident of serialisation" `RARITY_RANK`'s own
     * docblock says a reference tool must not sort by.
     */
    const misordered = [...SET_PROFILES.values()]
      .filter((profile) => {
        const ranks = profile.rarities.map(
          (slice) =>
            /* Slugs come back from `raritySlug`; the ladder is keyed by CODE,
               so the comparison is made on the position within this profile's
               own list rather than by looking the slug back up. A sorted list
               is one whose ranks are non-decreasing, and the ranks are
               recoverable from the decode table. */
            Object.entries(SETS.decode.rarity).find(
              ([, name]) => name === slice.name,
            )?.[0] ?? "",
        );
        const numbers = ranks.map(
          (code) => RARITY_RANK[code] ?? Object.keys(RARITY_RANK).length,
        );
        return numbers.some(
          (rank, index) => index > 0 && rank < (numbers[index - 1] ?? 0),
        );
      })
      .map((profile) => profile.id)
      .toSorted();

    expect(misordered).toEqual([]);
  });

  test("names its rarities rather than passing the corpus's codes through", () => {
    /*
     * `M` reaching the bar would render as `data-rarity="M"`, which matches no
     * rule in `RarityBar.css` and draws the faint grey default — a Majestic
     * slice in the colour of an unknown rarity, which is exactly the silent
     * failure that default exists to make visible rather than to absorb.
     */
    const names = new Set(
      [...SET_PROFILES.values()].flatMap((profile) =>
        profile.rarities.map((slice) => slice.name),
      ),
    );

    expect([...names].toSorted()).toEqual(
      [
        "Basic",
        "Common",
        "Fabled",
        "Legendary",
        "Majestic",
        "Marvel",
        "Promo",
        "Rare",
        "Super Rare",
        "Token",
      ].toSorted(),
    );
  });
});

describe("names printed nowhere else", () => {
  test("never exceed the set's own name count", () => {
    const impossible = [...SET_PROFILES.values()]
      .filter((profile) => profile.exclusive > profile.names)
      .map((profile) => profile.id)
      .toSorted();

    expect(impossible).toEqual([]);
  });

  test("are zero for a set that reprints and nothing else", () => {
    /*
     * SILVER AGE CHAPTER 1 — VISERAI IS ENTIRELY REPRINTS, and every one of the
     * fifteen Silver Age chapter decks in this corpus is. That is the answer a
     * reader most wants from this figure and the one no upstream field states:
     * a release whose card list is thirty-four cards you already own.
     */
    expect(SET_PROFILES.get("SVI")?.exclusive).toBe(0);
    expect(SET_PROFILES.get("SVI")?.names).toBe(28);
  });

  test("are most of Smash Palace, which is the other end of the same scale", () => {
    expect(SET_PROFILES.get("SMP")?.exclusive).toBe(30);
    expect(SET_PROFILES.get("SMP")?.names).toBe(34);
  });

  test("count a name once, however many printings or versions of it a set carries", () => {
    /*
     * RECOMPUTED IN A DIFFERENT SHAPE RATHER THAN PINNED, because the bug this
     * is against is a counter incremented in the wrong loop and a pinned number
     * only catches it on the sets somebody thought to pin.
     *
     * `set-profiles.ts` counts by incrementing as it walks printings, guarded
     * by whether the name has been seen. This collects the exclusive names into
     * a `Set` per set and takes its size — no counter, no guard, and therefore
     * no way to share the same mistake. A per-printing increment would exceed
     * this on 171 of Compendium of Rathe's names, which are printed more than
     * once each; a per-VERSION increment would exceed it on every pitch cycle,
     * and that one is invisible to the `exclusive <= names` inequality above.
     */
    const setsOfName = new Map<string, Set<string>>();
    for (const card of CORPUS.cards) {
      const key = slugify(card.name);
      let seen = setsOfName.get(key);
      if (seen === undefined) {
        seen = new Set<string>();
        setsOfName.set(key, seen);
      }
      for (const printing of card.printings) seen.add(printing.set_id);
    }

    const exclusiveNames = new Map<string, Set<string>>();
    for (const [name, sets] of setsOfName) {
      if (sets.size !== 1) continue;
      const [only] = [...sets];
      if (only === undefined) continue;
      let names = exclusiveNames.get(only);
      if (names === undefined) {
        names = new Set<string>();
        exclusiveNames.set(only, names);
      }
      names.add(name);
    }

    const disagreed = [...SET_PROFILES.values()]
      .filter(
        (profile) =>
          profile.exclusive !== (exclusiveNames.get(profile.id)?.size ?? 0),
      )
      .map((profile) => profile.id)
      .toSorted();

    expect(disagreed).toEqual([]);
    /* And the set the paragraph above names, so the case is not vacuous if both
       derivations were ever to become the same one. */
    expect(SET_PROFILES.get("PEN")?.exclusive).toBe(171);
  });
});

describe("artists", () => {
  test("are counted once each, however many cards they drew", () => {
    /*
     * A DISTINCT COUNT, so it can never exceed the printings it was gathered
     * from — a printing credits at least one artist and most credit exactly
     * one, so an artist tally larger than the printing count is a `Set` that
     * has become an array somewhere.
     */
    const inflated = [...SET_PROFILES.values()]
      .filter((profile) => profile.artists > profile.printings)
      .map((profile) => profile.id)
      .toSorted();

    expect(inflated).toEqual([]);
  });
});
