/**
 * The ported primitives render, and they render the things that carry meaning.
 *
 * WHAT THIS IS FOR, given the components each came with their own reasoning
 * already. A port is a rewrite that claims not to be one, so the only useful
 * assertions are the ones that would catch it having quietly become one: the
 * accessible names, the semantics (`<hr>` versus a decorative span), and the
 * class names — the last because this library learned the hard way that a
 * component can render with NO classes at all and pass every test that was
 * looking at something else.
 */

import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import { BevelledPlate } from "./BevelledPlate";
import { OrnamentalRule } from "./OrnamentalRule";
import { PAGE_GAP, Pagination, pageWindow } from "./Pagination";
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

describe("pageWindow", () => {
  /*
   * The interesting cases are all boundaries, which is why this is tested as a
   * function rather than through rendered markup: asserting it through the
   * component would be asserting it through a second thing that can also be
   * wrong, and the failure that matters — a page nothing links to — is
   * invisible in a screenshot.
   */
  test("a single page is itself, and no pages is nothing", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 0)).toEqual([]);
  });

  test("a short run is drawn whole, with no gaps to draw", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  test("the first and last page are always reachable in one click", () => {
    /*
     * "Jump to the end" is a real question about a sorted list — the cheapest
     * card, the last set alphabetically — and a control that offers only the
     * neighbours answers it with an unknown number of clicks.
     */
    for (const page of [1, 2, 10, 40, 99, 100]) {
      const window = pageWindow(page, 100);
      expect(window).toContain(1);
      expect(window).toContain(100);
    }
  });

  test("the window around the current page is fixed width, so the row cannot grow", () => {
    expect(pageWindow(50, 100)).toEqual([
      1,
      PAGE_GAP,
      48,
      49,
      50,
      51,
      52,
      PAGE_GAP,
      100,
    ]);
  });

  test("a gap of exactly one page collapses to that page", () => {
    // `1 … 3 4 5` spends an ellipsis to hide page 2, which is both longer than
    // showing it and a worse answer.
    expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, 6, PAGE_GAP, 20]);
  });

  test("every page it lists is listed once, in order", () => {
    for (const pages of [1, 2, 7, 13, 64, 200]) {
      for (const page of [1, 2, Math.ceil(pages / 2), pages]) {
        const numbers = pageWindow(page, pages).filter(
          (entry): entry is number => entry !== PAGE_GAP,
        );
        expect(new Set(numbers).size).toBe(numbers.length);
        expect(numbers).toEqual(numbers.toSorted((a, b) => a - b));
      }
    }
  });
});

describe("Pagination", () => {
  const props = {
    page: 6,
    pages: 12,
    size: 60,
    sizes: [30, 60, 120, "all"] as const,
    total: 703,
    from: 301,
    to: 360,
    unit: "cards",
    href: (page: number) => `/search?q=attack&page=${page}`,
    sizeHref: (size: number | "all") => `/search?q=attack&per=${size}`,
  };

  test("every control is a real link, because a page of results is an address", () => {
    /*
     * The whole reason this component takes `href` callbacks rather than
     * rendering buttons: `docs/PLAN.md` Phase 4, "the permalink is the
     * product". Buttons would make page 4 of a search unshareable and
     * unopenable in a new tab, which is how a reader compares two pages of one
     * answer.
     */
    const html = renderToStaticMarkup(<Pagination {...props} />);
    expect(html).toContain('href="/search?q=attack&amp;page=7"');
    expect(html).toContain('href="/search?q=attack&amp;page=5"');
    expect(html).toContain('href="/search?q=attack&amp;page=12"');
    expect(html).toContain('href="/search?q=attack&amp;per=all"');
  });

  test("the true total is stated, not the number of rows on screen", () => {
    // The count was always honest; what was missing was any way to see the rows
    // it counted. Losing the honesty while adding the paging would be a trade
    // in the wrong direction.
    const html = renderToStaticMarkup(<Pagination {...props} />);
    expect(html).toContain("Showing 301–360 of 703 cards.");
  });

  test("the current page is marked in more than one channel", () => {
    const html = renderToStaticMarkup(<Pagination {...props} />);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("of-pages__page--here");
  });

  test("a spent step is present and inert rather than absent", () => {
    // Omitting it would move every other control sideways at the two moments a
    // reader is most likely to be aiming at one.
    const first = renderToStaticMarkup(<Pagination {...props} page={1} />);
    expect(first).toContain("of-pages__step--spent");
    expect(first).toContain("Previous");
    expect(first).not.toContain('rel="prev"');

    const last = renderToStaticMarkup(<Pagination {...props} page={12} />);
    expect(last).toContain("Next");
    expect(last).not.toContain('rel="next"');
  });

  test("the numbered run is dropped when there is one page, and the sizes are not", () => {
    /*
     * The rows-per-page choice is what makes a one-page answer honest: it is
     * one page BECAUSE of what the reader asked for, and the control that says
     * so has to survive the numbers going away.
     */
    const html = renderToStaticMarkup(
      <Pagination {...props} pages={1} page={1} total={9} from={1} to={9} />,
    );
    expect(html).not.toContain("of-pages__list");
    expect(html).toContain("of-pages__sizes");
  });

  test("an ellipsis names no page and is hidden from assistive technology", () => {
    const html = renderToStaticMarkup(<Pagination {...props} pages={100} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("of-pages__gap");
  });

  test("a size link's accessible name says what its number means", () => {
    // "60" alone is a link whose purpose is carried entirely by the sentence
    // around it. WCAG 2.5.3 is satisfied because the visible text is contained
    // in the name.
    const html = renderToStaticMarkup(<Pagination {...props} />);
    expect(html).toContain('aria-label="Show 60 per page"');
    expect(html).toContain('aria-label="Show All per page"');
    expect(html).toContain('aria-label="Page 7"');
  });
});
