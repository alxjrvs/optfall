/**
 * The search island's written strings.
 *
 * THE FIRST TEST AGAINST AN ISLAND IN THIS REPOSITORY, and it is deliberately
 * not a rendering test. An island's behaviour lives in the browser and proving
 * it here would mean standing up a DOM to assert what a reader already checks by
 * using the page. What CAN go silently wrong is the prose: a string that says
 * something the interface no longer means, on a surface nobody reads carefully
 * because it is three words under a picture.
 *
 * The module imports React and a stylesheet; both resolve under `bun test`, so
 * this needs no harness and no mock.
 */

import { describe, expect, test } from "bun:test";

import { versionsMatched } from "./CardSearch";

describe("the partial-match note", () => {
  test("counts the versions and never names a pitch", () => {
    /*
     * THE POINT OF THE CHANGE THIS PINS. The note used to spell the matched
     * versions — "pitch 1" — which was the only thing it could do while the
     * mark under a name was decoration. The mark is now one band per matched
     * version, each a link to the version it is drawn for, so the colours say
     * WHICH and this says HOW MANY OF HOW MANY. A row showing one red band
     * under the words "PITCH 1" stated one fact twice.
     */
    expect(versionsMatched(1, 3)).toBe("1 of 3 versions");
    expect(versionsMatched(2, 3)).toBe("2 of 3 versions");

    /*
     * ASSERTED AS AN ABSENCE TOO, because the redundancy is what came back the
     * last three times somebody edited this line. A note naming a pitch is the
     * regression, whatever else it also says.
     */
    for (const matched of [1, 2, 3])
      expect(versionsMatched(matched, 4)).not.toMatch(/pitch/i);
  });

  test("it is a count, so it cannot claim to be complete", () => {
    /*
     * THE FACT THE BANDS CANNOT CARRY, and the reason this note is not simply
     * deleted now that the bands are links. One band looks identical whether a
     * card has one version or three; only a count says the set on screen is a
     * subset.
     *
     * Four names in this corpus carry versions whose Classic Constructed ban
     * differs, so a `banned:cc` row covering one of three has to admit the
     * other two exist — otherwise it puts a card on a banned list without
     * saying the rest of it is legal. The caller renders this only when the
     * match IS partial; what this asserts is that the string it gets back
     * always carries both numbers, so the partiality is legible without them.
     */
    expect(versionsMatched(1, 3)).toContain("3");
    expect(versionsMatched(1, 3)).toContain("1");
  });
});
