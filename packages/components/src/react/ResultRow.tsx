/**
 * One row in a list of results. React port.
 *
 * WHAT THE ROW OWNS: the hairline that separates it from the row above, the
 * baseline alignment, the intrinsic wrap, and the two type voices — serif for
 * the name, sans for the metadata. What the CALLER owns: what a result IS. A
 * rules result leads with a citation and a card result trails its name with a
 * pitch jewel; neither belongs in a primitive that would then have to know
 * about both.
 *
 * SO LEAD, TRAIL AND METADATA ARE ALL SLOTS. The row is a layout and a set of
 * voices, not a schema. It knows a result has a link, something before it,
 * something after its name, and some facts under it.
 *
 * LEAD AND TRAIL ARE NOT ONE PLACE ONE STEP APART. The lead is a child of the
 * ROW, so it sits outside the body and every row's lead lines up in a column;
 * the trail is a child of the NAME'S LINE, so it travels with the name and
 * begins wherever that name ends. A mark that qualifies the name — a pitch
 * jewel — wants the second. A mark the eye scans down a column — a face —
 * wants the first.
 *
 * THE ROW WRAPS INTRINSICALLY rather than at a breakpoint, because this
 * repository publishes no breakpoint tokens and `check:tokens` rejects a raw
 * length — the same constraint that shaped the card page's two columns.
 *
 * ONE THING THE PORT DELETES, AND IT IS AN IMPROVEMENT. The Svelte version
 * needed `:global(span)` on the metadata's children, because the snippet's
 * markup was authored in the CALLER and carried the caller's scope hash, so a
 * plain `.meta span` compiled to nothing. React has no scope hashes and no such
 * hazard: the selector is an ordinary descendant selector and works because
 * that is what descendant selectors do.
 */

import type { ReactNode } from "react";

import "./ResultRow.css";

export interface ResultRowProps {
  /** Where the row goes. A real URL; every result here is a destination. */
  readonly href: string;
  /**
   * The text inside the anchor.
   *
   * REQUIRED AND NOT A SLOT, deliberately. Two anchors that differ only in
   * where they point are a WCAG 2.4.4 failure, and this product has 900 card
   * names shared by two to four different cards — so the accessible name has
   * to be a string the caller composed on purpose, not markup it assembled
   * incidentally.
   */
  readonly label: string;
  /**
   * A qualifier joined to {@link label} inside the anchor and hidden from
   * sight — " (pitch 3)".
   *
   * IT DOES NOT WEAKEN THE RULE ABOVE, it is how a caller keeps it. A card
   * index prints bare names because the pitch is already carried by a jewel
   * beside them, and a bare name is shared by up to four cards — so without
   * this the row would be exactly the WCAG 2.4.4 failure `label` exists to
   * prevent. It is a STRING for the same reason `label` is: what a screen
   * reader announces has to be something the caller composed on purpose.
   *
   * Empty or absent where the name already identifies the card, which is the
   * common case.
   */
  readonly qualifier?: string | undefined;
  /** Rendered before the link, in the row's own leading column — a face. */
  readonly lead?: ReactNode;
  /**
   * Rendered after the link, on the name's own line — a pitch jewel.
   *
   * OUTSIDE THE ANCHOR, WHICH IS THE POINT OF IT BEING A SLOT HERE rather than
   * markup the caller joins onto {@link label}. What goes here is commonly a
   * link of its own — a stone addressing one pitch version of the name beside
   * it — and an anchor inside an anchor is invalid HTML the parser silently
   * unnests. It is also why {@link qualifier} stays: the trail is not text, so
   * it names nothing.
   *
   * RENDERED BARE, WITH NO WRAPPER OF ITS OWN, exactly as {@link lead} is. A
   * wrapper would carry the spacing here rather than in the caller — and it
   * would emit an empty element on every row whose trail resolved to nothing,
   * since a component that returns `null` is still a truthy element. So the
   * caller owns both the mark and the space before it.
   */
  readonly trail?: ReactNode;
  /** Rendered under the link, in the label voice. Facts, not prose. */
  readonly meta?: ReactNode;
}

export function ResultRow({
  href,
  label,
  qualifier,
  lead,
  trail,
  meta,
}: ResultRowProps) {
  return (
    <li className="of-result">
      {lead}

      <div className="of-result__body">
        <p className="of-result__line">
          <a className="of-result__name" href={href}>
            {label}
            {qualifier === undefined || qualifier === "" ? null : (
              <span className="of-result__qualifier">{qualifier}</span>
            )}
          </a>
          {trail}
        </p>
        {meta ? <p className="of-result__meta">{meta}</p> : null}
      </div>
    </li>
  );
}
