/**
 * One word of a control sentence: a native `<select>`, dressed down, and the
 * name it carries for a screen reader.
 *
 * IT LIVED INSIDE `CardIndex` UNTIL A SECOND SURFACE WANTED IT, which is the
 * same route `readableDate` took out of `BrassSeal` and for the same reason:
 * the choice was a copy of this file in `/sets`'s island, or one component both
 * surfaces call. There is nothing about a dressed-down select that is specific
 * to a list of cards.
 *
 * A SENTENCE RATHER THAN A TOOLBAR, and that is what the component is FOR
 * rather than how it happens to look. `CardIndex.tsx` sets out the arithmetic:
 * one control with three options is a legible row of radios and four such
 * controls is sixteen radios in a line, which is a wall. Dropdowns reading as a
 * sentence — "Grid sorted by Released", "Sets in print, largest first" — are
 * how the reference solves it, and reading the values back in a row is how you
 * check you asked for what you meant.
 *
 * THE LABEL IS OFF-SCREEN AND THE CONNECTIVE WORDS ARE NOT. What a sighted
 * reader sees is the sentence; what a screen reader announces is "Order by,
 * combo box", because "sorted by" as an accessible name would be read out of
 * the sentence that gives it meaning. Both need naming, and they are not the
 * same name — which is why `label` is required and separate from whatever the
 * caller puts in a {@link Joiner} beside it.
 *
 * A NATIVE `<select>`, DRESSED DOWN RATHER THAN REPLACED. `Choice.css` carries
 * that argument: `appearance: none` and a transparent ground so it reads as a
 * word with a rule under it, but a real `<select>` underneath, which is what
 * buys the keyboard behaviour, the platform's own picker on a phone, and a
 * control that works before any of our CSS loads.
 *
 * IT IS NOT A DESIGN-SYSTEM PRIMITIVE, and the line is worth stating because
 * `packages/components` is where a shared control would normally go. That
 * package is closed on purpose and its entries are marks — a jewel, a plate, a
 * bar. This is one app's control bar convention, sharing one implementation
 * between the two surfaces that have one; it names no colour and no length that
 * did not come from a token, which is the rule that actually binds it.
 */

import type { ReactNode } from "react";

import "./Choice.css";

export interface ChoiceProps<T extends string> {
  /** The `<select>`'s id, so the caller can keep it unique on the page. */
  readonly id: string;
  /**
   * The accessible name — "Order by", not "sorted by". Required, because a
   * select with no name is a control a screen reader can only call "combo box".
   */
  readonly label: string;
  readonly value: T;
  /** `[value, visible text]`, in the order they should be offered. */
  readonly options: readonly (readonly [T, string])[];
  readonly onChange: (value: T) => void;
}

export function Choice<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: ChoiceProps<T>) {
  return (
    <span className="of-choice">
      <label className="of-choice__label" htmlFor={id}>
        {label}
      </label>
      <select
        className="of-choice__select"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map(([option, text]) => (
          <option key={option} value={option}>
            {text}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * The words between two choices — "sorted by", "in".
 *
 * A COMPONENT RATHER THAN A CLASS NAME THE CALLER REMEMBERS, because the joiner
 * is what makes the bar a sentence and a bar that forgets it is a row of
 * controls with nothing holding them together. It renders a plain `<span>`: it
 * is decoration for the sighted reading order, and the accessible names on the
 * selects either side already say what each control is.
 */
export function Joiner({ children }: { readonly children: ReactNode }) {
  return <span className="of-choice__joiner">{children}</span>;
}
