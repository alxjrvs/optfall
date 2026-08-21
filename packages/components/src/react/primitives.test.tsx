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
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { BevelledPlate } from "./BevelledPlate";
import { OrnamentalRule } from "./OrnamentalRule";
import { PAGE_GAP, Pagination, pageWindow } from "./Pagination";
import { PitchBox } from "./PitchBox";
import { PitchJewel } from "./PitchJewel";
import { PitchRule } from "./PitchRule";
import { StatGlyph } from "./StatGlyph";
import { ResultRow } from "./ResultRow";

describe("PitchJewel", () => {
  test("the count is always rendered, at every size", () => {
    /*
     * THE CHANNEL CHANGED AND THE REQUIREMENT DID NOT, which is why this test
     * kept its place in the file rather than being replaced by a new one.
     *
     * `docs/DESIGN.md` calls the value the PRIMARY channel, never the colour:
     * red and yellow are the classic deuteranopia confusion pair and pitch is
     * the most-read value on a card. It used to be a numeral; it is now three
     * slots filled from the top, which is what the printed card does. Counting
     * is not a hue, so the requirement is met the same way it always was — and
     * there is still no compact variant that drops it, because that variant
     * would be the one that breaks for the people the design exists to serve.
     */
    for (const size of ["sm", "md", "lg"] as const) {
      const html = renderToStaticMarkup(<PitchJewel value={2} size={size} />);
      expect(html.match(/data-filled="true"/g)?.length).toBe(2);
      expect(html.match(/data-filled="false"/g)?.length).toBe(1);
    }
  });

  test("the slots that are not filled are still drawn", () => {
    /*
     * A SINGLE PIP AND ONE PIP OUT OF THREE ARE DIFFERENT STATEMENTS, and only
     * the second says "this card pitches for one of a possible three". Rendering
     * `value` slots would have been the obvious implementation and would have
     * lost the denominator the card prints.
     */
    const html = renderToStaticMarkup(<PitchJewel value={1} />);
    /* The closing quote matters: `of-jewel__slots` is the container, and a bare
       substring match counts it as a fourth slot. */
    expect(html.match(/of-jewel__slot"/g)?.length).toBe(3);
    expect(html.match(/data-filled="true"/g)?.length).toBe(1);
    expect(html.match(/data-filled="false"/g)?.length).toBe(2);
  });

  test("zero is an absence and reads as one", () => {
    /*
     * NO SLOT IS STRUCK, which is the same statement the grey `tone-none` stone
     * makes and is why zero needs no branch of its own. It used to draw an en
     * dash; a mark that counts has a zero already.
     */
    const html = renderToStaticMarkup(<PitchJewel value={0} />);
    expect(html).toContain('aria-label="No pitch value"');
    expect(html).not.toContain('data-filled="true"');
    expect(html.match(/data-filled="false"/g)?.length).toBe(3);
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

  test("the fourth pitch value gets its own stone, not the grey fallback", () => {
    /*
     * NOTHING IN THE PINNED CORPUS RENDERS IT YET, which is exactly why it is
     * pinned here. The tone comes out of a lookup with a `?? "none"` fallback,
     * so a `TONES` array left one entry short does not throw and does not fail
     * a typecheck:
     * it silently renders a purple-strip card as a card with NO pitch value.
     * The rare value is the one nobody would notice going wrong.
     *
     * AND IT IS THE ONE VALUE THE SLOTS CANNOT TELL FROM ITS NEIGHBOUR. There
     * are three slots because the card prints three, so pitch four fills every
     * one of them and is distinguishable from pitch three by its stone alone —
     * the one place the count stops carrying the fact on its own. The
     * accessible name still says it in words, and the corpus this repository
     * pins contains no such card; if one ever lands, this is the note that says
     * what to look at.
     */
    const html = renderToStaticMarkup(<PitchJewel value={4} />);
    expect(html).toContain("of-jewel--tone-four");
    expect(html).toContain('aria-label="Pitch 4"');
    expect(html.match(/data-filled="true"/g)?.length).toBe(3);
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

describe("PitchBox", () => {
  test("the value is written out, at every size", () => {
    /*
     * THE WORDS ARE THE WHOLE POINT. The jewel's numeral is a glyph a reader
     * has to know the grammar of; this is the same fact spelled. There is no
     * size that drops it, for the reason there is no jewel that drops the
     * numeral.
     */
    for (const size of ["sm", "md"] as const) {
      const html = renderToStaticMarkup(<PitchBox value={3} size={size} />);
      expect(html).toContain(">Pitch 3<");
    }
  });

  test("the words are sentence case; the shouting is a rendering", () => {
    // `text-transform` in the stylesheet, not uppercase in the DOM, so a
    // reader that falls back to the text node gets a word rather than a shout.
    expect(renderToStaticMarkup(<PitchBox value={1} />)).not.toContain("PITCH");
  });

  test("zero says so in words, where the stone can only draw a dash", () => {
    const html = renderToStaticMarkup(<PitchBox value={0} />);
    expect(html).toContain('aria-label="No pitch value"');
    expect(html).toContain(">No pitch<");
  });

  test("an empty label cannot erase the accessible name", () => {
    // The house idiom, asserted here too: `label?.trim() ||`, never `??`.
    expect(renderToStaticMarkup(<PitchBox value={1} label="" />)).toContain(
      'aria-label="Pitch 1"',
    );
    expect(renderToStaticMarkup(<PitchBox value={1} label="   " />)).toContain(
      'aria-label="Pitch 1"',
    );
    expect(
      renderToStaticMarkup(<PitchBox value={1} label="Head Jab (pitch 1)" />),
    ).toContain('aria-label="Head Jab (pitch 1)"');
  });

  test("the fourth pitch value gets its own tone, not the grey fallback", () => {
    // Same `?? "none"` lookup the jewel has, and the same failure it hides: a
    // `TONES` array one entry short renders a pitch-4 card as a card with no
    // pitch at all, beside words that say otherwise.
    const html = renderToStaticMarkup(<PitchBox value={4} />);
    expect(html).toContain("of-pitch-box--tone-four");
    expect(html).toContain('aria-label="Pitch 4"');
    expect(html).toContain(">Pitch 4<");
  });

  test("the words are a separate, hidden element under the role", () => {
    // The box is a `role="img"` named by `aria-label`, so its visible words
    // have to be `aria-hidden` or a caller's label and the mark's own text
    // both reach the anchor around it — which is the WCAG 2.4.4 shape the
    // `label` prop exists to fix in the first place.
    const html = renderToStaticMarkup(<PitchBox value={2} />);
    expect(html).toContain(
      'class="of-pitch-box of-pitch-box--md of-pitch-box--tone-two"',
    );
    expect(html).toContain(
      '<span class="of-pitch-box__text" aria-hidden="true">',
    );
  });
});

describe("PitchRule", () => {
  test("one band per pitch value, in the tone that value owns", () => {
    /*
     * The whole feature. A cell in a card index stands for a name, and a name
     * is commonly three cards — so "which pitches is this cell talking about"
     * is a question with three answers and the mark has to be able to give
     * all of them.
     */
    const html = renderToStaticMarkup(<PitchRule values={[1, 2, 3]} />);
    expect(html).toContain("of-pitch-rule__band--tone-one");
    expect(html).toContain("of-pitch-rule__band--tone-two");
    expect(html).toContain("of-pitch-rule__band--tone-three");
    expect(html.split("of-pitch-rule__band ").length - 1).toBe(3);
  });

  test("the fourth value bands and speaks like the other four", () => {
    /*
     * The same fallback trap the jewel's fourth-stone test pins, and worse
     * here: a band has no numeral, so a `tone-four` that fell through to
     * `none` would be a purple-strip card drawn as an unpitched one with
     * nothing on screen contradicting it. The accessible name is composed by
     * `spokenFor` rather than looked up, so it is asserted in the same breath.
     */
    const html = renderToStaticMarkup(<PitchRule values={[3, 4]} />);
    const order = [...html.matchAll(/--tone-(\w+)/g)].map((match) => match[1]);
    expect(order).toEqual(["three", "four"]);
    expect(html).toContain('aria-label="Pitch 3 and 4"');
  });

  test("the values are sorted and deduplicated by the component", () => {
    /*
     * NOT BY THE CALLER. A search collapses the pitch versions of a matched
     * name; a set page walks a set's printings. Two sources, and a cell
     * rendering blue-before-red would be stating one fact in two orders on one
     * screen. Deduplicating matters for the set page in particular: a card
     * printed twice in a set arrives with its pitch twice.
     */
    const html = renderToStaticMarkup(<PitchRule values={[3, 1, 3, 2]} />);
    const order = [...html.matchAll(/--tone-(\w+)/g)].map((match) => match[1]);
    expect(order).toEqual(["one", "two", "three"]);
  });

  test("no pitch is a grey band; no VALUES is no mark at all", () => {
    /*
     * Two different absences, exactly as `CardFaceRef` keeps `null` apart from
     * `""`. A card with no pitch value HAS an answer — equipment pitches for
     * nothing — and gets the `none` tone the jewel would render as a dash. An
     * empty array is the claim that the pitch is unknown, and a mark asserting
     * "no pitch" there would be inventing the answer.
     */
    const none = renderToStaticMarkup(<PitchRule values={[0]} />);
    expect(none).toContain("of-pitch-rule__band--tone-none");
    expect(none).toContain('aria-label="No pitch value"');
    expect(renderToStaticMarkup(<PitchRule values={[]} />)).toBe("");
  });

  test("the accessible name spells the values out, and cannot be erased", () => {
    /*
     * THE ONLY NON-COLOUR CHANNEL THIS MARK HAS. The jewel can afford
     * `aria-label` to be a convenience because its numeral is a real text
     * node; a band has none, so an empty name here would leave meaning
     * carried by fill colour alone — the exact failure the house
     * `label?.trim() ||` idiom exists to prevent.
     */
    expect(renderToStaticMarkup(<PitchRule values={[2]} />)).toContain(
      'aria-label="Pitch 2"',
    );
    expect(renderToStaticMarkup(<PitchRule values={[1, 3]} />)).toContain(
      'aria-label="Pitch 1 and 3"',
    );
    expect(renderToStaticMarkup(<PitchRule values={[1, 2, 3]} />)).toContain(
      'aria-label="Pitch 1, 2 and 3"',
    );
    expect(renderToStaticMarkup(<PitchRule values={[1]} label="" />)).toContain(
      'aria-label="Pitch 1"',
    );
    expect(
      renderToStaticMarkup(<PitchRule values={[1]} label="   " />),
    ).toContain('aria-label="Pitch 1"');
  });

  test("the name accounts for every band, including the no-pitch one", () => {
    /*
     * THE MISMATCH THIS PINS DREW MORE THAN IT SAID. `spokenFor` filtered `0`
     * out before composing while the render still drew a `tone-none` band for
     * it, so a mixed row drew four bands and announced three — and this label
     * is the only non-colour channel the images view has, so the band nobody
     * was told about was a pitch value nobody was told about.
     *
     * `[0, 1, 2, 3]` is not hypothetical: `cards.ts` documents Hyper Driver, a
     * pitch-0 token sharing its name with three pitched actions, and
     * `unique:names` collapses that group to exactly this.
     */
    const html = renderToStaticMarkup(<PitchRule values={[0, 1, 2, 3]} />);
    expect(html.split("of-pitch-rule__band ").length - 1).toBe(4);
    expect(html).toContain('aria-label="No pitch value, and pitch 1, 2 and 3"');

    /* And the two unmixed cases keep the wording they had. */
    expect(renderToStaticMarkup(<PitchRule values={[0]} />)).toContain(
      'aria-label="No pitch value"',
    );
    expect(renderToStaticMarkup(<PitchRule values={[0, 2]} />)).toContain(
      'aria-label="No pitch value, and pitch 2"',
    );
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

  test("every rule draws the centre mark, with nothing to ask for", () => {
    /*
     * THE ORNAMENT IS NOT OPTIONAL, and it used to be — this asserted on an
     * `ornament` prop and a `--ornamented` modifier. A flag exactly one caller
     * ever set was not rationing the mark between rules, it was making one rule
     * look like a different component from its siblings. A gap with nothing in
     * it is still a bug that looks like a design, so the default mark stays.
     */
    const html = renderToStaticMarkup(<OrnamentalRule />);
    expect(html).toContain('class="of-rule__mark"');
    // Line, ornament, line.
    expect(html.split("of-rule__line").length - 1).toBe(2);
  });

  test("the ornament mount is hidden, because ornament is never content", () => {
    const html = renderToStaticMarkup(<OrnamentalRule filigree={<svg />} />);
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

  test("the trail lands on the name's line, after the anchor", () => {
    /*
     * THE THREE SLOTS ARE THREE PLACES, and the trail is the one that has to be
     * INSIDE the name's line and OUTSIDE the anchor. Inside, because it is a
     * qualifier on the name and travels with it; outside, because what goes
     * there is commonly a link of its own and an anchor inside an anchor is
     * invalid markup the parser unnests. Both halves are asserted by position:
     * after `</a>`, before the line closes.
     */
    const html = renderToStaticMarkup(
      <ResultRow href="/x" label="X" lead={<b>L</b>} trail={<i>T</i>} />,
    );
    const line = html.slice(html.indexOf("of-result__line"));
    expect(line.indexOf("<i>T</i>")).toBeGreaterThan(line.indexOf("</a>"));
    expect(line.indexOf("<i>T</i>")).toBeLessThan(line.indexOf("</p>"));
    /* And the leading slot is still ahead of the body, not beside the trail. */
    expect(html.indexOf("<b>L</b>")).toBeLessThan(
      html.indexOf("of-result__body"),
    );
  });

  test("a trail that resolves to nothing emits nothing", () => {
    /*
     * NO WRAPPER ELEMENT, which is the whole reason the slot is rendered bare.
     * The caller's mark is commonly a component that returns `null` — a card
     * with no pitch draws no stone — and a component is a truthy element even
     * when it renders nothing, so a wrapper here would put an empty span,
     * carrying whatever margin it owned, on every such row in a 12,776-page
     * build.
     */
    const Nothing = () => null;
    const html = renderToStaticMarkup(
      <ResultRow href="/x" label="X" trail={<Nothing />} />,
    );
    expect(html).toBe(renderToStaticMarkup(<ResultRow href="/x" label="X" />));
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

  test("First and Last are drawn, and spent at the end they point at", () => {
    /*
     * THE REFERENCE'S CONTROL SET. Scryfall's pager is First / Previous /
     * Next / Last with no numbers in it at all; this one keeps its numbers and
     * gains the two words, so "take me to the end" is answerable without
     * reading a number to find out which end it is.
     *
     * SPENT AT THEIR OWN END, WHICH IS THE HALF WORTH ASSERTING. A "First" that
     * is still a link on page one is a control that reloads the page to do
     * nothing, and the reference disables both of its backward steps there.
     */
    const first = renderToStaticMarkup(<Pagination {...props} page={1} />);
    expect(first).toContain("First");
    expect(first).toContain("Last");
    /* Both backward steps are spent together on page one. */
    expect(first.match(/of-pages__step--spent/g)).toHaveLength(2);
    /* And Last still goes somewhere, which is the point of having it. */
    expect(first).toContain('href="/search?q=attack&amp;page=12"');

    const last = renderToStaticMarkup(<Pagination {...props} page={12} />);
    expect(last.match(/of-pages__step--spent/g)).toHaveLength(2);
    expect(last).toContain('href="/search?q=attack&amp;page=1"');
  });

  test("a spent step is still announced, unlike the reference's", () => {
    /*
     * THE DIVERGENCE THIS LOCKS IN. Scryfall's spent controls carry
     * `aria-hidden="true"` and `tabindex="-1"` — greyed on screen, absent from
     * the accessibility tree, so a sighted reader sees four steps and a
     * screen-reader user is told there are two. This pager keeps the word
     * announced: "Previous, dimmed" is the answer to "can I go back", and a
     * listener told nothing has to infer it from silence.
     *
     * ASSERTED RATHER THAN LEFT TO THE DOCBLOCK because it is one attribute
     * away from being reversed by somebody matching the reference more
     * literally, and nothing else in the suite would notice.
     */
    const first = renderToStaticMarkup(<Pagination {...props} page={1} />);

    /*
     * THE OPENING TAG ITSELF, NOT THE WHOLE DOCUMENT. A first attempt asserted
     * `not.toContain('aria-hidden="true">Previous')` and was worthless: React
     * writes attributes in source order, so the class lands between the two and
     * that string never appears whether the attribute is there or not. The
     * negative control caught it — adding `aria-hidden` to the spent span left
     * all 131 tests green.
     */
    const spent = [
      ...first.matchAll(/<span[^>]*of-pages__step--spent[^>]*>/g),
    ].map((match) => match[0]);
    expect(spent).toHaveLength(2);
    for (const tag of spent) {
      expect(tag).not.toContain("aria-hidden");
      expect(tag).not.toContain("aria-disabled");
    }

    /* The one thing that IS hidden stays hidden: the ellipsis names no page. */
    expect(first).toContain('aria-hidden="true"');
  });

  test("the forward step says how far it goes, and the backward one does not", () => {
    /*
     * "Next 60" is the reference's wording. It is more useful here than there,
     * because there the number is always 60 and here the reader can change it —
     * so the control that spends the size also states it.
     *
     * ASSERTED AT TWO SIZES, because a label that happened to match the default
     * would pass while being a constant.
     */
    const sixty = renderToStaticMarkup(<Pagination {...props} size={60} />);
    expect(sixty).toContain("Next 60");

    const small = renderToStaticMarkup(<Pagination {...props} size={30} />);
    expect(small).toContain("Next 30");

    /* The asymmetry is the reference's too: counting rows already read is not
       a thing anybody wants to know. */
    expect(small).toContain(">Previous<");
    expect(small).not.toContain("Previous 30");
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

describe("StatGlyph", () => {
  test("an absent value greys the mark and prints no character", () => {
    /*
     * THE SILHOUETTE SURVIVES, which is the whole design: the shape is what
     * says WHICH stat is missing. So the kind class stays and only the fill
     * changes — asserted through the class, because a mark that lost
     * `of-stat--power` would look like an absence of nothing in particular.
     *
     * AND NOTHING IS DRAWN IN THE VALUE POSITION. It used to be an en dash.
     * Inside a plate that read as a struck placeholder; beside a mark, which is
     * where every printed value sits now, it reads as a value the card prints
     * — the one thing this state exists to deny. The absence is spoken instead,
     * which is where a claim about what is NOT on a card belongs.
     */
    const html = renderToStaticMarkup(<StatGlyph kind="power" value={null} />);
    expect(html).toContain("of-stat--power");
    expect(html).toContain("of-stat--absent");
    expect(html).toContain('aria-label="No printed power"');
    expect(html).not.toContain("–");
  });

  test("artwork replaces the drawn plate, and the value moves beside it", () => {
    /*
     * THE PRODUCT PATH. Every stat the card panel prints resolves to one of
     * LSS's own files — see `STAT_ORDER` — so the drawn plates above are the
     * fallback and this is what a reader actually meets.
     *
     * `--art` IS THE WHOLE CONTRACT with the stylesheet: it is what drops the
     * background, the bevel and the clip, and it must be keyed on `src` being
     * supplied rather than on the kind, because a story renders these kinds
     * with no `public/` mounted and has to get the plate.
     */
    const html = renderToStaticMarkup(
      <StatGlyph
        kind="power"
        value="4"
        src="/symbols/icon_p.png"
        width={105}
        height={105}
      />,
    );
    expect(html).toContain("of-stat--art");
    expect(html).toContain('src="/symbols/icon_p.png"');
    /* The box is stated, because an image without one reflows the row it sits
       in as it loads. */
    expect(html).toContain('width="105"');
    /* `alt=""`: the wrapping `role="img"` already owns the name, and announcing
       both would read the stat twice. */
    expect(html).toContain('alt=""');
    expect(html).toContain('aria-label="Power 4"');
    expect(html).toContain(">4<");
  });

  test("no artwork means no `--art`, and the plate is what draws", () => {
    const html = renderToStaticMarkup(<StatGlyph kind="arcane" value="3" />);
    expect(html).not.toContain("of-stat--art");
    expect(html).not.toContain("<img");
    expect(html).toContain("of-stat--arcane");
  });

  test('`null` and `"0"` are different renderings, because they are different facts', () => {
    /*
     * THE POINT OF THE WHOLE CHANGE. Upstream writes an absent stat as the
     * empty string, so "no power" and "power 0" arrive as one field carrying
     * two facts — and 0 is not rare: 1,648 cards print a cost of 0, 191 a
     * defence of 0, 13 a power of 0. If these two rendered alike the card page
     * would be answering a question it had been given the answer to.
     */
    const zero = renderToStaticMarkup(<StatGlyph kind="cost" value="0" />);
    const absent = renderToStaticMarkup(<StatGlyph kind="cost" value={null} />);

    expect(zero).not.toBe(absent);
    expect(zero).toContain(">0<");
    expect(zero).not.toContain("of-stat--absent");
    expect(absent).toContain("of-stat--absent");
  });

  test("an absent stat is spoken as an absence, never as a dash", () => {
    /* "Cost –" is what the markup says and it is not what the card means; a
       screen reader announcing a punctuation mark has handed the problem to
       the listener. Same decision `PitchJewel` makes for pitch 0. */
    expect(
      renderToStaticMarkup(<StatGlyph kind="cost" value={null} />),
    ).toContain('aria-label="No printed cost"');
    expect(
      renderToStaticMarkup(<StatGlyph kind="defence" value={null} />),
    ).toContain('aria-label="No printed defence"');
    expect(renderToStaticMarkup(<StatGlyph kind="cost" value="0" />)).toContain(
      'aria-label="Cost 0"',
    );
  });

  test("an empty string is not treated as an absence", () => {
    /*
     * A caller passing `""` has a bug — upstream's spelling for absent, not
     * this component's — and the honest response is to render what it was
     * given rather than to guess. Disguising it as an absence would make the
     * one distinction this component exists to draw depend on which of two
     * spellings the caller happened to use.
     */
    const empty = renderToStaticMarkup(<StatGlyph kind="power" value="" />);
    expect(empty).not.toContain("of-stat--absent");
    expect(empty).toContain('aria-label="Power "');
  });
});

describe("an absent stat paints nothing and keeps its place", () => {
  test("`--absent` hides rather than recolours, and holds its box", () => {
    /*
     * THREE ANSWERS, AND THIS TEST HAS OUTLIVED TWO OF THEM. It began as
     * "`--absent` overrides the fill and nothing else": the plate took
     * `color.stat.absent` and kept the inset bevel, so the SILHOUETTE still
     * said which stat was missing even though the fill was only about 1.4:1
     * against the panel. Then the marks became artwork, which takes no token,
     * and the absent state was a greyscale filter at 30%. Both were attempts to
     * SHOW an absence.
     *
     * It is not shown now. What has to hold instead is the property every
     * version depended on and none of them asserted: the position keeps its
     * width. `visibility` does that and `display: none` does not, and the
     * difference is a corner track collapsing and sliding the card's name off
     * its axis on half the corpus.
     *
     * ASSERTED AGAINST THE STYLESHEET because that is where the distinction
     * lives; a render tells you the element is there either way.
     */
    const css = readFileSync(
      new URL("./StatGlyph.css", import.meta.url),
      "utf-8",
    );

    const absent = /\.of-stat\.of-stat--absent \{([^}]*)\}/.exec(css)?.[1];
    expect(absent).toBeDefined();
    expect(absent).toContain("visibility: hidden");
    /* The one that would take the width with it. */
    expect(absent).not.toContain("display: none");
  });

  test("the mark still names the absence, for the one caller that unhides it", () => {
    /*
     * The card panel wraps an empty position in `aria-hidden`, so this string
     * is inert there — deliberately, since a listener should not be told about
     * a mark a viewer cannot see. It stays on the component because the
     * component does not know who is rendering it, and a caller that chooses to
     * show an absent mark must get a named one.
     */
    const html = renderToStaticMarkup(<StatGlyph kind="power" value={null} />);
    expect(html).toContain('aria-label="No printed power"');
  });
});
