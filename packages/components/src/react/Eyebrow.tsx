/**
 * The small-caps label above a thing — a section's kicker, a definition term, a
 * field's name. The one typographic recipe this system repeats most.
 *
 * WHY THIS EXISTS, MEASURED RATHER THAN FELT. Twenty-eight CSS blocks in this
 * repository combined `text-transform: uppercase` with
 * `var(--of-type-tracking-wide)`, and ten of them were in `apps/site`, outside
 * the component library entirely. `CLAUDE.md` states the rule that makes that a
 * defect rather than a coincidence: "A screen that needs new CSS is a signal
 * that `packages/components` is missing a primitive. Add it there, not in the
 * page." Ten pages had independently re-derived the same five declarations.
 *
 * The strongest evidence was that one of them was already called
 * `.of-rule__eyebrow`. The concept had a name in this codebase before it had a
 * component; this only gives it one place to live.
 *
 * WHAT THIS DELIBERATELY DOES NOT ABSORB, because a shared type treatment is
 * not the same as a shared component:
 *
 *   - **`thead th`** in the printings and syntax tables. Those are table
 *     headers; their semantics come from the element, and wrapping them would
 *     add a span inside a `<th>` for no gain.
 *   - **`.of-bar__wordmark`**, which is `size-base` at full ink. It is the
 *     wordmark, not a label above something.
 *   - **The labels inside other primitives** — `BrassSeal`, `FactChip`,
 *     `Pagination`, `ResultRow`, `SearchField`, `StatePill`. Each owns its
 *     internal type, and reaching into a sibling primitive to restyle its
 *     innards is the coupling this library exists to avoid. They keep their own
 *     declarations, and that duplication is deliberate.
 *
 * SO THE MIGRATION IS TWO CALL SITES, NOT TEN, AND THAT NUMBER IS MEASURED.
 * The twenty-eight-block figure counts blocks sharing the five-declaration type
 * recipe. Counting whole blocks instead — what would actually have to move —
 * only **three** consist of the recipe and nothing else, and one of those is
 * this component's own stylesheet. The other twenty-six each add something:
 * `font-weight` (twelve of them, and split three ways between medium, bold and
 * regular, which is why weight is deliberately absent here), `margin`, or a
 * whole layout — `.of-crumbs` is a flex list, `.of-choice__select` is a styled
 * control, `.of-card__printings thead th` is a table header.
 *
 * Those are components in their own right that happen to share five type
 * declarations. Absorbing them would mean growing props for weight, spacing and
 * display until this was a styling API rather than a primitive — which is
 * `restyle`, the thing "compose, never restyle" is aimed at. They keep their own
 * declarations, and that stays correct.
 *
 * The two real swaps are `.of-sets__suggestions-label` and
 * `.of-about__source dt`, both done in the change that added this. The value
 * from here is in what gets written next, not in a migration that would have to
 * bloat the component to happen at all.
 *
 * TONE IS THREE NAMED STEPS, NOT A COLOUR. The surveyed blocks used exactly
 * three inks — `ink-faint`, `ink-muted` and full `ink` — and the difference
 * between them is how loudly the label competes with what it labels, not a
 * palette choice. Naming them `faint`/`muted`/`ink` keeps that decision in the
 * caller's vocabulary; a `color` prop would put a raw value back in a page and
 * `check:tokens` would fail the build, which is the correct outcome and a slow
 * way to learn it.
 *
 * `AS` EXISTS BECAUSE THE SEMANTICS VARY AND THE STYLE DOES NOT. The same
 * recipe appears on a `<dt>` in a definition list, on a heading above an
 * apparatus block, and on a plain `<span>` beside a year. Forcing one element
 * would make the primitive unusable in two of those three places, and an
 * eyebrow rendered as a `<span>` where a `<dt>` belongs breaks the list's
 * structure for a screen reader. The union is closed rather than
 * `keyof JSX.IntrinsicElements`: these are the six that have a real use, and a
 * seventh should be a decision someone makes on purpose.
 */

import type { ReactNode } from "react";

import "./Eyebrow.css";

/**
 * How loudly the label competes with the thing it labels.
 *
 * THERE WAS A `"faint"` HERE, AND IT WAS THE DEFAULT. It is gone rather than
 * demoted: an eyebrow is `type.size.micro`, `color.ink.faint` is the LARGE-text
 * ink held to 3:1 rather than 4.5:1, and the two cannot be combined legibly at
 * any call site. A tone no caller may correctly pass is not an option, it is a
 * trap — and one `check:faint-ink` could not have caught, because the gate
 * matches a colour and a font-size in the SAME rule and a `data-tone` rule
 * carries no size of its own.
 */
export type EyebrowTone = "muted" | "ink";

/**
 * The elements an eyebrow is allowed to be. Closed on purpose — see the
 * docblock above.
 */
export type EyebrowAs = "span" | "div" | "p" | "dt" | "h2" | "h3";

export interface EyebrowProps {
  /**
   * The label itself. `ReactNode` rather than `string` because these genuinely
   * wrap markup — a year beside an abbreviation, a count inside a filter label
   * — and `BevelledPlate` already establishes children as the house spelling
   * for a slot.
   */
  readonly children: ReactNode;
  /**
   * Defaults to `muted`, the quietest tone that clears AA at this size.
   *
   * It defaulted to `faint` because that is what most of the surveyed blocks
   * used — which described the defect being consolidated rather than the
   * behaviour wanted, since most of those blocks were themselves below AA.
   */
  readonly tone?: EyebrowTone;
  /** Defaults to `span`, the only one valid in every context. */
  readonly as?: EyebrowAs;
}

export function Eyebrow({
  children,
  tone = "muted",
  as = "span",
}: EyebrowProps) {
  const Tag = as;

  /**
   * `data-tone` rather than a modifier class, matching `StatePill`. The CSS
   * selects on the attribute, so there is one class name to remember and the
   * tone is legible in the built HTML without decoding a class suffix.
   */
  return (
    <Tag className="of-eyebrow" data-tone={tone}>
      {children}
    </Tag>
  );
}
