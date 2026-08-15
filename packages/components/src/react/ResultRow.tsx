/**
 * One row in a list of results. React port.
 *
 * WHAT THE ROW OWNS: the hairline that separates it from the row above, the
 * baseline alignment, the intrinsic wrap, and the two type voices — serif for
 * the name, sans for the metadata. What the CALLER owns: what a result IS. A
 * rules result leads with a citation and a card result leads with a pitch
 * jewel; neither belongs in a primitive that would then have to know about
 * both.
 *
 * SO THE LEADING SLOT AND THE METADATA ARE BOTH SLOTS. The row is a layout and
 * a set of voices, not a schema. It knows a result has a link, something before
 * it, and some facts under it.
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
  /** Rendered before the link — a pitch jewel, a citation. */
  readonly lead?: ReactNode;
  /** Rendered under the link, in the label voice. Facts, not prose. */
  readonly meta?: ReactNode;
}

export function ResultRow({ href, label, lead, meta }: ResultRowProps) {
  return (
    <li className="of-result">
      {lead}

      <div className="of-result__body">
        <p className="of-result__line">
          <a className="of-result__name" href={href}>
            {label}
          </a>
        </p>
        {meta ? <p className="of-result__meta">{meta}</p> : null}
      </div>
    </li>
  );
}
