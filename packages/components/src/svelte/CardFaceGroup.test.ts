/**
 * The copyright notice is emitted exactly once, whatever the arrangement.
 *
 * WHY THIS EXISTS. `docs/COMPLIANCE.md` §5 makes the notice the condition the
 * whole art licence rests on, and `/data-terms` publishes the mechanism as a
 * guarantee: `CardFace` emits the line itself with no prop to omit, and
 * `CardFaceGroup` hoists it for faces shown together. Until this file, nothing
 * tested it. The type-level assertion in `../index.test.ts` proves only that
 * `copyright` is not a prop — it says nothing about what gets rendered, so the
 * context hand-off could have broken in a Svelte upgrade, or under a change to
 * how a face is mounted, with every check still green.
 *
 * A compliance guarantee whose only enforcement is a comment is a convention.
 *
 * THE TWO FAILURES ARE NOT SYMMETRICAL, and both are asserted. Zero notices is
 * a licence breach. Two notices is a cosmetic bug. So the counts are checked
 * exactly rather than with `toBeGreaterThan`, because "at least one" would pass
 * the arrangement the hoisting exists to prevent.
 *
 * There is deliberately no empty-group case. `children` is a required snippet,
 * so a group with nothing in it does not render at all — it throws — and a test
 * asserting a notice for it would be asserting something the type system has
 * already made unreachable.
 */
import { describe, expect, test } from "bun:test";
import { render } from "svelte/server";

import CardFace from "./CardFace.svelte";
import GroupedFaces from "./__fixtures__/GroupedFaces.svelte";
import { CARD_IMAGE_COPYRIGHT } from "../index";

/** How many times the notice appears in a rendered fragment. */
function notices(markup: string): number {
  return markup.split(CARD_IMAGE_COPYRIGHT).length - 1;
}

describe("the card-image copyright notice", () => {
  test("a lone face carries its own", () => {
    const { body } = render(CardFace, {
      props: { src: "/a.webp", alt: "A", width: 180, height: 251 },
    });

    expect(notices(body)).toBe(1);
  });

  test("faces inside a group share exactly one", () => {
    const { body } = render(GroupedFaces, { props: {} });

    // Two images, one notice: the faces suppressed their own and the group
    // carried it. This is the whole hoisting contract in one assertion.
    expect(body.split("<img").length - 1).toBe(2);
    expect(notices(body)).toBe(1);
  });

  /*
   * NO ASSERTION ON THE WORDING HERE. `../index.test.ts` already checks the
   * constant with `toContain("© Legend Story Studios")` and argues in a comment
   * that exact equality is the wrong shape — the mandated notice and Optfall's
   * rendering of it are allowed to differ, and pinning the literal would make
   * the rendering look specified. A second test asserting the opposite would
   * mean a wording change fails in two places that disagree about whether it
   * should. This file is about how many notices render, not what they say.
   */
});
