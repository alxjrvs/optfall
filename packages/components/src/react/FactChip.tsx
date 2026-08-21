/**
 * The fact chip — one datum, on its own plate, in a row of its siblings.
 *
 * IT EXISTS BECAUSE FACTS WERE BEING SET AS SENTENCES. `/sets` printed a row's
 * facts as `7 August 2026 · 24 cards · 7 only here · out of print`, and the set
 * page's masthead ran its six labels and values together into one wrapping
 * strip. Both read as prose: the middot is a conjunction, and a reader looking
 * up ONE of those facts had to parse the line to find where it started. A fact
 * is an object, and this is the object.
 *
 * NO NOTCH, AND THAT IS THE FIRST THING TO SAY ABOUT IT. `docs/DESIGN.md`:
 * "Notched corners mark anything carrying state. The clipped corner is the only
 * ornament in the system and it always means something." A release date and a
 * card count are not state, so this is a plain rectangle — and `StatePill` is
 * still the only thing in the system wearing the chamfer. A chip that borrowed
 * it would spend the one ornament this design has on the commonest object on
 * the page.
 *
 * NO COLOUR EITHER, FOR THE SAME KIND OF REASON. Every filled mark here carries
 * a DATA colour — the pitch palette, the rarity ramp, the state tones — and a
 * fact has no value to be coloured by. So the plate is the neutral surface with
 * the system's bevel pair on it: light top edge, dark bottom edge, struck out of
 * the same metal as everything else and saying nothing beyond "this is one
 * thing". Where a fact DOES have a colour, the caller passes the mark that
 * carries it through {@link FactChipProps.mark} — which is how the set page's
 * rarity legend is a row of these with a one-slice `RarityBar` in each.
 *
 * THE LABEL IS OPTIONAL, AND WHICH SURFACES USE IT IS A RULE RATHER THAN A
 * TASTE. A set's own page draws one chip per fact and the label is the question
 * the reader arrived with, so it is printed. An INDEX draws the same four facts
 * on a hundred rows, where the labels are a column of identical words and the
 * values already carry their units — "24 cards", "7 only here" — so the label
 * is dropped and the value says what it is. The chip is one object either way;
 * what changes is whether the row has already said the label a hundred times.
 */

import type { ReactNode } from "react";

import "./FactChip.css";

export interface FactChipProps {
  /**
   * What the fact is — "Released", "Card names". Omitted where the surface
   * would repeat it down a column; see the note above.
   */
  readonly label?: string;
  /**
   * The fact itself. A node rather than a string so a caller can pass a
   * `<time>` carrying the machine-readable date beside the readable one, which
   * is the one place a value here is more than text.
   */
  readonly value: ReactNode;
  /**
   * A mark drawn before the words — a rarity swatch, a pitch band.
   *
   * IT IS `aria-hidden` HERE, WITHOUT ASKING THE CALLER. A mark in this slot is
   * a second rendering of the value beside it: the set page's legend puts a
   * one-slice `RarityBar` next to "231 Common", and that bar's own accessible
   * name is "231 Common". Left exposed, every legend entry would be announced
   * twice. A caller with a mark that is NOT a restatement of the value has a
   * chip with two facts in it, which is a different component.
   */
  readonly mark?: ReactNode;
  /**
   * Which elements carry the two halves.
   *
   * `"inline"` is a pair of `<span>`s — the right thing for a chip in a row of
   * chips, where the grouping is visual and the markup should not invent a
   * structure the page does not have.
   *
   * `"description"` is a `<div>` holding a `<dt>` and a `<dd>`, which is what a
   * chip inside a `<dl>` has to be. A masthead IS a description list: those are
   * term-and-value pairs and that is the element for them, so every label is
   * announced with its own value, in order, with no `aria-*` doing work the
   * markup already does. The `<div>` is the grouping HTML allows inside a `<dl>`
   * for exactly this, and it is what keeps a label attached to its own value
   * when the strip wraps.
   *
   * A `"description"` chip with no `label` would be a `<dt>` with nothing in
   * it, so the label is rendered as an empty term rather than dropped — a
   * caller who wants a bare value wants `"inline"`.
   */
  readonly semantics?: "inline" | "description";
}

export function FactChip({
  label,
  value,
  mark,
  semantics = "inline",
}: FactChipProps) {
  /*
   * THE PLATE IS ONE ELEMENT AND THE HALVES ARE ITS CHILDREN, whichever
   * spelling is asked for. Rendering two different trees would be two things to
   * keep in step; rendering the same tree out of different tag names is one.
   */
  const Root = semantics === "description" ? "div" : "span";
  const Label = semantics === "description" ? "dt" : "span";
  const Value = semantics === "description" ? "dd" : "span";

  return (
    <Root className="of-fact" data-semantics={semantics}>
      {mark === undefined ? null : (
        <span aria-hidden="true" className="of-fact__mark">
          {mark}
        </span>
      )}
      {label === undefined && semantics === "inline" ? null : (
        <Label className="of-fact__label">{label}</Label>
      )}
      <Value className="of-fact__value">{value}</Value>
    </Root>
  );
}
