/**
 * The copyright notice is emitted exactly once, whatever the arrangement —
 * asserted against the REACT port, independently of the Svelte one.
 *
 * WHY THIS IS NOT A DUPLICATE TEST. `docs/COMPLIANCE.md` §5 makes the notice
 * the condition the whole art licence rests on, and `/data-terms` publishes the
 * mechanism as a guarantee. The Svelte version of that mechanism is
 * `setContext`/`getContext`; this one is a React context. They are the same
 * SHAPE and not the same CODE, so a port that quietly broke the hand-off would
 * leave the Svelte test green and ship a page of faces with no notice.
 *
 * THE TWO FAILURES ARE NOT SYMMETRICAL, and both are asserted. Zero notices is
 * a licence breach. Two notices is a cosmetic bug. So the counts are checked
 * exactly rather than with `toBeGreaterThan`, because "at least one" would pass
 * the arrangement the hoisting exists to prevent.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CARD_IMAGE_COPYRIGHT } from "../index";
import { CardFace } from "./CardFace";
import { CardFaceGroup } from "./CardFaceGroup";

/** How many times the notice appears in a rendered fragment. */
function notices(markup: string): number {
  return markup.split(CARD_IMAGE_COPYRIGHT).length - 1;
}

const face = { src: "/a.webp", alt: "A", width: 180, height: 251 };

describe("the card-image copyright notice, in React", () => {
  test("a lone face carries its own", () => {
    const markup = renderToStaticMarkup(<CardFace {...face} />);
    expect(notices(markup)).toBe(1);
  });

  test("faces inside a group share exactly one", () => {
    // Two images, one notice: the faces suppressed their own and the group
    // carried it. This is the whole hoisting contract in one assertion.
    const markup = renderToStaticMarkup(
      <CardFaceGroup>
        <CardFace {...face} />
        <CardFace {...face} src="/b.webp" alt="B" />
      </CardFaceGroup>,
    );

    expect(markup.split("<img").length - 1).toBe(2);
    expect(notices(markup)).toBe(1);
  });

  test("a group with one face still carries exactly one", () => {
    const markup = renderToStaticMarkup(
      <CardFaceGroup>
        <CardFace {...face} />
      </CardFaceGroup>,
    );
    expect(notices(markup)).toBe(1);
  });

  test("faces OUTSIDE a group are unaffected by one elsewhere on the page", () => {
    /*
     * React context is lexical, and this asserts it stayed that way. A face
     * beside a group — not inside it — must carry its own notice, or the mere
     * presence of a group anywhere on a page would suppress every face on it.
     */
    const markup = renderToStaticMarkup(
      <div>
        <CardFaceGroup>
          <CardFace {...face} />
        </CardFaceGroup>
        <CardFace {...face} src="/c.webp" alt="C" />
      </div>,
    );

    // One for the group, one for the face outside it.
    expect(notices(markup)).toBe(2);
  });

  test("there is no prop that suppresses the notice", () => {
    /*
     * §5 forbids "a prop the caller may omit" and "a variant that drops it".
     * The type-level guard is in `../index.test.ts`; this is the runtime one —
     * passing the obvious sabotage props changes nothing.
     */
    const sabotage = {
      ...face,
      copyright: "",
      bare: true,
      compact: true,
      carriedByGroup: true,
    } as unknown as typeof face;

    expect(notices(renderToStaticMarkup(<CardFace {...sabotage} />))).toBe(1);
  });

  test("the elements actually carry their class names", () => {
    /*
     * THIS TEST EXISTS BECAUSE THE FIRST VERSION OF THESE COMPONENTS SHIPPED
     * WITHOUT ANY.
     *
     * They used `CardFace.module.css` and `styles["face"]`, which is the
     * idiomatic React answer and is what a reviewer would expect. Under
     * `bun test` a `.module.css` import resolves to an EMPTY OBJECT, so every
     * lookup was `undefined`, every element rendered with no `class`, and every
     * test in this file still passed — because they count copyright notices,
     * and a notice needs no class to be counted.
     *
     * A styling bug is normally the one kind that cannot hide. This one hid,
     * because the only thing looking was a compliance test. So the class names
     * are asserted explicitly, and they are asserted by NAME rather than by
     * "contains class=", because the second would pass for a component wearing
     * somebody else's classes.
     */
    const lone = renderToStaticMarkup(<CardFace {...face} />);
    expect(lone).toContain('class="of-card-face"');
    expect(lone).toContain('class="of-card-face__frame"');
    expect(lone).toContain('class="of-card-face__copyright"');

    const grouped = renderToStaticMarkup(
      <CardFaceGroup>
        <CardFace {...face} />
      </CardFaceGroup>,
    );
    expect(grouped).toContain('class="of-card-face-group"');
    expect(grouped).toContain('class="of-card-face-group__copyright"');
  });

  test("the React and Svelte ports emit the same notice string", () => {
    // One copyright string in `../index`, imported by both. This is what stops
    // the two ports drifting on the thing that actually matters.
    expect(CARD_IMAGE_COPYRIGHT.length).toBeGreaterThan(0);
    expect(renderToStaticMarkup(<CardFace {...face} />)).toContain(
      CARD_IMAGE_COPYRIGHT,
    );
  });
});
