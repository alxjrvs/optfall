/**
 * The section rule — a hairline divider, optionally carrying the centred
 * filigree ornament. React port.
 *
 * This is the primitive `docs/DESIGN.md` means by "density without clutter,
 * held together by tight vertical rhythm and hairline rules rather than cards,
 * shadows and padding". It is the alternative to a card: where a lesser system
 * would box a section, this system draws one line and moves on.
 *
 * SEMANTICS ARE THE POINT OF THIS COMPONENT. A divider is either a thematic
 * break or it is furniture, and the two must not render as the same thing. A
 * real `<hr>` is a `separator` in the accessibility tree and is announced; a
 * decorative line is `aria-hidden` and is not. Getting this wrong in a
 * reference work is expensive in exactly one direction — a screen reader
 * announcing "separator" between every header and its body, on every card page,
 * is noise that trains people to ignore the one that meant something. So
 * `decorative` exists, defaults to `false`, and is the only way to get a line
 * that is not a thematic break.
 *
 * FILIGREE IS RATIONED, AND THIS IS ONE OF ITS THREE ROLES. `docs/DESIGN.md`
 * spends scrollwork on feature-panel corners, card-frame corners and the
 * section rule — never on a control, never on a list, never twice on one
 * screen. `ornament` therefore defaults to `false`: the plain hairline is the
 * common case and the ornamented rule is the exception a page spends once.
 *
 * The ornament arrives as a slot rather than as an import, because a primitive
 * that reaches for another primitive decides for the caller how much ornament a
 * screen has already spent:
 *
 * ```tsx
 * <OrnamentalRule ornament filigree={<FiligreeCorner role="section-rule" />} />
 * ```
 *
 * **THIS COMPONENT OWNS THE RULE; THE SLOT SUPPLIES A DRAWING.** The two
 * hairlines, the vertical rhythm and the `<hr>` semantics are all here, and
 * `FiligreeCorner` in its `section-rule` role emits a bare figure with no lines,
 * no `role="separator"` and no margins of its own. Both halves of that sentence
 * had to be written down: each component was built to the same three-role ration
 * and each concluded independently that the section rule was its job, so
 * following the instructions used to yield four hairlines at two different
 * weights, doubled rhythm, and a `separator` buried inside an `aria-hidden`
 * mount where the accessibility tree threw it away. One owner, and it is this
 * file, because that is what its name says.
 *
 * The mount is `aria-hidden`: the ornament is decoration, and the thematic
 * break is carried by the `<hr>` element itself rather than by anything
 * visible. Colour never carries the meaning here — remove every colour from
 * this component and the break is still in the accessibility tree.
 */

import type { ReactNode } from "react";

import "./OrnamentalRule.css";

export interface OrnamentalRuleProps {
  /**
   * Open the centre of the rule and mount the filigree. Defaults to `false`
   * because ornament is rationed; a screen gets one of these at most.
   */
  readonly ornament?: boolean;
  /**
   * Render a line that is *not* a thematic break — furniture inside a plate,
   * rather than a division between sections. Hidden from assistive technology
   * entirely, which is the honest rendering of a decoration.
   */
  readonly decorative?: boolean;
  /**
   * Accessible name for the break, such as the section it introduces.
   *
   * Its default is deliberately *absent*, which is the one place this component
   * departs from the jewel. A `separator` needs no name to be understood — it
   * is already announced by role — so a default name would be invented text
   * read aloud on every rule in the interface. Supply one only when the break
   * genuinely names something, and never as a description of the line itself.
   */
  readonly label?: string;
  /**
   * The ornament itself. Intended occupant: `FiligreeCorner` in its
   * `section-rule` role. Ignored unless `ornament` is set.
   */
  readonly filigree?: ReactNode;
}

export function OrnamentalRule({
  ornament = false,
  decorative = false,
  label,
  filigree,
}: OrnamentalRuleProps) {
  /**
   * `?.trim() ||` — the house idiom from `PitchJewel`, applied in the one
   * direction it runs here. The default is absence, so a blank must collapse to
   * *undefined* rather than to `aria-label=""`, which is an empty name
   * overriding the role's own announcement rather than no name at all.
   */
  const name = label?.trim() || undefined;

  return (
    <div className={ornament ? "of-rule of-rule--ornamented" : "of-rule"}>
      {decorative ? (
        <span className="of-rule__line" aria-hidden="true" />
      ) : (
        <hr className="of-rule__line" aria-label={name} />
      )}

      {ornament ? (
        <>
          <span className="of-rule__mount" aria-hidden="true">
            {filigree ?? (
              /*
                The degenerate ornament. A gap with nothing in it is a bug that
                looks like a design, so the component draws its own centre mark
                when nothing is supplied rather than opening a hole and trusting
                the caller.
              */
              <span className="of-rule__mark" />
            )}
          </span>
          <span className="of-rule__line" aria-hidden="true" />
        </>
      ) : null}
    </div>
  );
}
