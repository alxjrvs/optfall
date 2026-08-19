/**
 * A call to action that carries someone else's mark — an icon, a label, a link.
 *
 * WHY THIS IS A PRIMITIVE AND NOT A BUY BUTTON. The card page needed the same
 * control in two places at once: under the face, for the printing being read,
 * and once per row in the purchase section. Two placements of one control is
 * the library's own signal that a primitive is missing rather than a licence to
 * write the CSS twice in a page — see the note on `Pagination`, which arrived
 * by exactly this route.
 *
 * THE ICON IS A SLOT, WHICH IS THE WHOLE OF WHY THIS IS GENERIC. Nothing here
 * knows what TCGplayer is. A caller hands in a node; this owns the box, the
 * bevel, the focus ring and the relationship between the two. A second vendor —
 * `docs/COMPLIANCE.md` §2 names singles commerce as permitted generally, not
 * for one marketplace — needs a different node and no new component.
 *
 * IT IS AN `<a>`, NEVER A `<button>`. The same argument `Citation` makes: this
 * navigates, so middle click, "copy link address", ⌘-click and the browser's
 * own focus order all arrive free with the right element and are unrecoverable
 * without it. A `<button>` here would be a link that only works one way.
 *
 * `rel` IS REQUIRED RATHER THAN DEFAULTED, and that is a compliance decision
 * rather than a fussy one. An affiliate link that omits `sponsored` is the
 * failure `apps/site/src/lib/tcgplayer.ts` exists to prevent, and a default
 * here would let a caller ship a paid link that discloses nothing simply by not
 * thinking about it. Making it required means the caller has to have an answer.
 *
 * THE LABEL IS THE ACCESSIBLE NAME, and the icon is `aria-hidden`. A mark and
 * the word beside it are one thing to a reader and would otherwise be two to a
 * screen reader — "image, Buy on TCGplayer" — which is the same doubling
 * `PrintingsSection` already suppresses in its own visually hidden text.
 */

import type { ReactNode } from "react";

import "./IconButton.css";

export interface IconButtonProps {
  /** Where the button goes. */
  readonly href: string;
  /** The visible text, and the accessible name. */
  readonly label: string;
  /**
   * The mark rendered before the label. Hidden from assistive technology by
   * this component, so it never needs its own alternative text.
   */
  readonly icon: ReactNode;
  /**
   * The link relationship. Required: see the note above on why this has no
   * default. `"sponsored nofollow noreferrer"` for a paid link.
   */
  readonly rel: string;
  /**
   * Extra text announced after the label, for a button whose surrounding
   * context is visual. Rendered off-screen.
   *
   * The printings section renders one of these per row, where four buttons all
   * reading "Buy on TCGplayer" are four identical names in a screen reader's
   * element list; the qualifier is what tells them apart.
   */
  readonly detail?: string | undefined;
}

export function IconButton({
  href,
  label,
  icon,
  rel,
  detail,
}: IconButtonProps) {
  return (
    <a className="of-icon-button" href={href} rel={rel}>
      <span aria-hidden="true" className="of-icon-button__icon">
        {icon}
      </span>
      <span className="of-icon-button__label">{label}</span>
      {detail === undefined || detail.trim() === "" ? null : (
        <span className="of-icon-button__detail">{` — ${detail}`}</span>
      )}
    </a>
  );
}
