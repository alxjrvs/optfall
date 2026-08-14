/**
 * The ported primitives render, and they render the things that carry meaning.
 *
 * WHAT THIS IS FOR, given the components each came with their own reasoning
 * already. A port is a rewrite that claims not to be one, so the only useful
 * assertions are the ones that would catch it having quietly become one: the
 * accessible names, the semantics (`<hr>` versus a decorative span), and the
 * class names — the last because this library learned the hard way that a
 * component can render with NO classes at all and pass every test that was
 * looking at something else. See `CardFaceGroup.test.tsx`.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BevelledPlate } from "./BevelledPlate";
import { OrnamentalRule } from "./OrnamentalRule";
import { PitchJewel } from "./PitchJewel";
import { ResultRow } from "./ResultRow";

describe("PitchJewel", () => {
  test("the numeral is always rendered, at every size", () => {
    /*
     * `docs/DESIGN.md` calls the numeral the PRIMARY channel, not a fallback:
     * red and yellow are the classic deuteranopia confusion pair and pitch is
     * the most-read value on a card. There is no compact variant that drops it,
     * because that variant would be the one that breaks for the people the
     * design exists to serve.
     */
    for (const size of ["sm", "md", "lg"] as const) {
      const html = renderToStaticMarkup(<PitchJewel value={3} size={size} />);
      expect(html).toContain(">3<");
    }
  });

  test("zero is an absence and reads as one", () => {
    const html = renderToStaticMarkup(<PitchJewel value={0} />);
    expect(html).toContain('aria-label="No pitch value"');
    expect(html).toContain(">–<");
  });

  test("an empty label cannot erase the accessible name", () => {
    /*
     * THE HOUSE IDIOM, ASSERTED. `label?.trim() ||` rather than `label ??`:
     * `??` falls through on null/undefined only, so `label=""` would
     * type-check and leave `aria-label=""` on a `role="img"` whose only text
     * node is `aria-hidden` — an unnamed image whose meaning is carried by fill
     * colour alone.
     */
    expect(renderToStaticMarkup(<PitchJewel value={1} label="" />)).toContain(
      'aria-label="Pitch 1"',
    );
    expect(
      renderToStaticMarkup(<PitchJewel value={1} label="   " />),
    ).toContain('aria-label="Pitch 1"');
    expect(
      renderToStaticMarkup(<PitchJewel value={1} label="Red" />),
    ).toContain('aria-label="Red"');
  });

  test("the stone is a separate element, because the bevel is a filter", () => {
    // `filter` is applied before `clip-path` on the same element, so the
    // drop-shadow pair has to sit on a PARENT of the clipped stone or it is
    // drawn and then clipped away. The extra span is what buys that.
    const html = renderToStaticMarkup(<PitchJewel value={2} />);
    expect(html).toContain('class="of-jewel of-jewel--md of-jewel--tone-two"');
    expect(html).toContain('class="of-jewel__stone"');
  });
});

describe("OrnamentalRule", () => {
  test("a break is an <hr>, and furniture is not", () => {
    /*
     * THE POINT OF THE COMPONENT. A screen reader announcing "separator"
     * between every header and its body, on every card page, is noise that
     * trains people to ignore the one that meant something.
     */
    expect(renderToStaticMarkup(<OrnamentalRule />)).toContain("<hr");
    const decorative = renderToStaticMarkup(<OrnamentalRule decorative />);
    expect(decorative).not.toContain("<hr");
    expect(decorative).toContain('aria-hidden="true"');
  });

  test("a blank label collapses to no name, not to an empty one", () => {
    // The default here is ABSENCE — the opposite direction from the jewel — so
    // `aria-label=""` would be an empty name overriding the role's own
    // announcement rather than no name at all.
    expect(renderToStaticMarkup(<OrnamentalRule label="  " />)).not.toContain(
      "aria-label",
    );
  });

  test("an ornamented rule with nothing supplied draws its own mark", () => {
    // A gap with nothing in it is a bug that looks like a design.
    const html = renderToStaticMarkup(<OrnamentalRule ornament />);
    expect(html).toContain("of-rule--ornamented");
    expect(html).toContain('class="of-rule__mark"');
    // Line, ornament, line.
    expect(html.split("of-rule__line").length - 1).toBe(2);
  });

  test("the ornament mount is hidden, because ornament is never content", () => {
    const html = renderToStaticMarkup(
      <OrnamentalRule ornament filigree={<svg />} />,
    );
    expect(html).toContain('class="of-rule__mount" aria-hidden="true"');
  });
});

describe("BevelledPlate", () => {
  test("it is a plain div with no invented role", () => {
    /*
     * A plate is chrome: it carries no information, and `emphasis` is a
     * material property rather than a state. The correct accessible rendering
     * of a generic container is to be invisible and let the semantics come from
     * the content inside it.
     */
    const html = renderToStaticMarkup(<BevelledPlate>x</BevelledPlate>);
    expect(html).not.toContain("role=");
    expect(html).not.toContain("aria-label");
    expect(html).toContain("of-plate--flat");
  });

  test("edges are opt-in and default to both", () => {
    const both = renderToStaticMarkup(<BevelledPlate>x</BevelledPlate>);
    expect(both).toContain("of-plate--bevel-block-start");
    expect(both).toContain("of-plate--bevel-block-end");

    const top = renderToStaticMarkup(
      <BevelledPlate edges={["top"]}>x</BevelledPlate>,
    );
    expect(top).toContain("of-plate--bevel-block-start");
    expect(top).not.toContain("of-plate--bevel-block-end");
  });

  test("the ornament hook opens four corners and draws none of them", () => {
    // The plate owns placement and size; the ornament owns the drawing.
    const html = renderToStaticMarkup(
      <BevelledPlate ornament="panel-corner" corner={(id) => <i>{id}</i>}>
        x
      </BevelledPlate>,
    );
    for (const id of ["start-start", "start-end", "end-start", "end-end"]) {
      expect(html).toContain(`data-corner="${id}"`);
      expect(html).toContain(`<i>${id}</i>`);
    }
    expect(html.split('aria-hidden="true"').length - 1).toBe(4);
  });

  test("no corners are opened without the ornament", () => {
    const html = renderToStaticMarkup(
      <BevelledPlate corner={(id) => <i>{id}</i>}>x</BevelledPlate>,
    );
    expect(html).not.toContain("of-panel-corner");
  });

  test("the class list has no empty gaps", () => {
    // Built by filtering a list rather than by `&&` in a template literal,
    // which leaves `false` or a double space in the attribute.
    const html = renderToStaticMarkup(
      <BevelledPlate edges={[]}>x</BevelledPlate>,
    );
    expect(html).not.toContain("  ");
    expect(html).not.toContain("false");
  });
});

describe("ResultRow", () => {
  test("the label is the anchor's text, and it is a string", () => {
    /*
     * Two anchors that differ only in where they point are a WCAG 2.4.4
     * failure, and this product has 900 card names shared by two to four
     * different cards.
     */
    const html = renderToStaticMarkup(
      <ResultRow href="/card/head-jab-1" label="Head Jab (pitch 1)" />,
    );
    expect(html).toContain('href="/card/head-jab-1"');
    expect(html).toContain("Head Jab (pitch 1)</a>");
  });

  test("the metadata paragraph is omitted entirely when there is none", () => {
    const html = renderToStaticMarkup(<ResultRow href="/x" label="X" />);
    expect(html).not.toContain("of-result__meta");
  });

  test("lead and meta are rendered where the layout expects them", () => {
    const html = renderToStaticMarkup(
      <ResultRow href="/x" label="X" lead={<b>L</b>} meta={<span>M</span>} />,
    );
    expect(html.indexOf("<b>L</b>")).toBeLessThan(
      html.indexOf("of-result__body"),
    );
    expect(html).toContain("of-result__meta");
  });
});
