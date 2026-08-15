/**
 * The card's printed text, in two views: **Text** and **Raw text**. React port.
 *
 * WHY BOTH, rather than the rendered one replacing the raw. Rendering `{p}` as a
 * power plate is a JOIN — the same kind of claim this site already makes when it
 * says a keyword is governed by a rule — and a reference work should let you see
 * the thing a claim was derived from. `CardEntry` refused to interpret the
 * markers at all for several phases, on the stated grounds that no published
 * table mapped them to words. One does: the Comprehensive Rules, already in this
 * repository, at 1.12.4a–h. So the interpretation is defensible, and the raw
 * bytes stay one click away so it is also checkable.
 *
 * NO JAVASCRIPT, AND THAT SURVIVES THE PORT INTACT. The toggle is two radio
 * inputs and one `:has()` selector, so both views are in the HTML and switching
 * between them is a CSS state change. This is worth defending precisely because
 * the port makes the alternative easy: a `useState` here would be four lines,
 * and it would turn the card page — 12,278 of them — into an island. A reader
 * with scripting off would get a dead control, and every card page would ship
 * JavaScript to toggle a class. The radio pair does it for nothing.
 *
 * `defaultChecked`, NOT `checked`. In React `checked` makes an input controlled,
 * which needs an `onChange` and therefore state and therefore an island. The
 * uncontrolled form is what keeps the DOM in charge, which is the whole point.
 *
 * THE RADIO NAME IS PER-CARD. A card page renders several versions, and two radio
 * groups sharing a `name` on one document are ONE group — picking "Raw" on the
 * pitch-2 tab would silently flip the pitch-1 tab with it.
 */

import { BevelledPlate } from "optfall-components/react";

import { parseCardText } from "../../src/lib/card-text";
import { CardTextInline } from "./CardTextInline";
import "./PrintedText.css";

export interface PrintedTextProps {
  /** The printed text, exactly as upstream published it. */
  readonly text: string;
  /** Distinguishes this card's radio group from every other on the page. */
  readonly uid: string;
}

export function PrintedText({ text, uid }: PrintedTextProps) {
  const blocks = parseCardText(text);
  const name = `view-${uid}`;

  return (
    <div className="of-printed">
      {/*
        A radio group, not a button pair: this is a choice between two mutually
        exclusive views, which is what radios mean. `role="radiogroup"` comes
        free from the fieldset, arrow keys work with no code, and the state is
        real form state rather than a class somebody has to remember to keep in
        sync.
      */}
      <fieldset className="of-printed__views">
        <legend className="of-printed__sr-only">
          How to show the printed text
        </legend>
        <input
          type="radio"
          id={`${name}-rendered`}
          name={name}
          value="rendered"
          defaultChecked
        />
        <label htmlFor={`${name}-rendered`}>Text</label>
        <input type="radio" id={`${name}-raw`} name={name} value="raw" />
        <label htmlFor={`${name}-raw`}>Raw text</label>
      </fieldset>

      <BevelledPlate emphasis="raised">
        <div className="of-printed__rendered">
          {blocks.map((block, index) =>
            block.kind === "paragraph" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: parsed once from an immutable string; two paragraphs can be identical.
              <p className="of-printed__text" key={index}>
                <CardTextInline nodes={block.children} />
              </p>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: as above.
              <ul className="of-printed__list" key={index}>
                {block.items.map((item, itemIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: as above.
                  <li key={itemIndex}>
                    <CardTextInline nodes={item} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>

        {/*
          Upstream's bytes. `white-space: pre-wrap` rather than reflowed, because
          the line breaks are part of what was published — this is the view whose
          entire purpose is to be unaltered.
        */}
        <p className="of-printed__raw">{text}</p>
      </BevelledPlate>
    </div>
  );
}
