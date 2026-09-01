/**
 * A citation — the thing you paste into an argument to end it. React port.
 *
 * `docs/ROADMAP.md` Phase 4 — every rules paragraph at a permanent URL,
 * citable by number: **the permalink is the product.** A judge pasting
 * `cr:8.3.4b` into Discord instead of describing which paragraph they mean is
 * the whole share moment, so this primitive has exactly two jobs: make the
 * identifier *look* copyable, and make it genuinely clickable.
 *
 * Three decisions worth the words:
 *
 * - **It is an `<a>`, not a styled `<span>` with a click handler.** Middle
 *   click, "copy link address", ⌘-click and the browser's own focus order all
 *   arrive free with the right element and are unrecoverable without it. The
 *   focus ring is a real `outline` at twice the bevel width; `outline: none`
 *   appears nowhere in the stylesheet, because a citation nobody can tab to is
 *   a permalink nobody can share.
 *
 * - **The identifier is NOT uppercased, and that is a deliberate departure.**
 *   `docs/DESIGN.md` gives the label voice as wide-tracked uppercase, and the
 *   tracking is here — it is what makes the voice read as a label rather than
 *   as code. The casing is not, because a rule id is an *identifier* rather
 *   than a label: `8.3.4b` and `8.3.4B` are not interchangeable, and browsers
 *   disagree about whether `text-transform` follows text onto the clipboard. A
 *   citation that pastes back differently than it was printed is the one
 *   failure this component exists to prevent.
 *
 * - **The version never carries its meaning in colour alone.** `ink.muted`
 *   makes it read as subordinate, but a separator glyph and a visually hidden
 *   "version" make it subordinate *structurally* too — so it survives a screen
 *   reader, a monochrome print, and forced-colours mode.
 *
 * The accessible name is the citation itself: "cr:8.3.4b version 2.11.0", built
 * from required props rather than from an optional label. There is no name for
 * a caller to omit, which is the same guarantee the jewel gets from its default
 * — reached here by making the visible text the name instead.
 */

import "./Citation.css";

export interface CitationProps {
  /** Permanent rule identifier, such as `cr:8.3.4b`. */
  readonly ruleId: string;
  /** Permalink to the addressable section. */
  readonly href: string;
  /** Document version the citation was read from. */
  readonly version?: string;
}

export function Citation({ ruleId, href, version }: CitationProps) {
  /**
   * An empty string is an absent version, not a blank one. `version=""` comes
   * from a record that has not been versioned yet, and rendering it would print
   * a separator pointing at nothing.
   */
  const hasVersion = version !== undefined && version.trim() !== "";

  return (
    <a className="of-citation" href={href} data-rule-id={ruleId}>
      <span className="of-citation__rule-id">{ruleId}</span>
      {hasVersion ? (
        <>
          <span className="of-citation__separator" aria-hidden="true">
            ·
          </span>
          <span className="of-citation__version">
            <span className="of-citation__sr-only">version </span>
            {version}
          </span>
        </>
      ) : null}
    </a>
  );
}
