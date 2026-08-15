/**
 * The notched state pill — legality, verification, and anything else a card or
 * ruling *is* right now. React port.
 *
 * Conventions follow `PitchJewel`, the reference primitive: tokens-only styles,
 * square corners, a light top edge and a dark bottom one. Three things are
 * specific to this component and each is deliberate.
 *
 * **The notch is the system's only ornament, and it is load-bearing.**
 * `docs/DESIGN.md`: "Notched corners mark anything carrying state. The clipped
 * corner is the only ornament in the system and it always means something." So
 * exactly one corner is clipped — the inline-end top one, cut across the
 * *light* bevel edge, because that is the edge the eye catches first and the
 * ornament exists to be noticed. A second notch would make it decoration; a
 * rounded corner would make it a button. Neither is available here, and
 * `--of-bevel-radius` is zero precisely so a component that asks for a radius
 * is answered with none.
 *
 * **THE LABEL IS THE STATE, NOT A CAPTION FOR IT.** This is the same argument
 * the pitch jewel makes about its numeral, applied to a set of eight fills that
 * includes green-versus-red (`legal`/`banned`) and two browns a whole grade
 * apart in consequence (`suspended`/`unverified`). Text always renders, at full
 * length, never truncated, never ellipsed, never swapped for an icon-only
 * variant — because that variant would be the one that fails the people this
 * design exists to serve. Colour and the notch are the redundant channels. It
 * follows that **`label` must name the state** (`"Banned"`, not `"Blitz"`); a
 * caller who labels a pill with something other than the state it carries has
 * made colour the sole carrier again, and no styling here can undo that.
 *
 * **The accessible name cannot be forgotten because it cannot be absent.**
 * `label` is required and renders as real text, so the accessible name *is* the
 * visible name — one string, selectable and copyable, with no `aria-label`
 * shadowing it and no chance of the two drifting apart. Nothing here is
 * interactive, announces itself, or updates in place, so the element is a plain
 * `<span>`: no `role="img"` (which would hide the text it is meant to describe),
 * no `role="status"` (which would make a static verdict shout every time a list
 * re-renders).
 *
 * REQUIRED IS NOT THE SAME AS NON-EMPTY, WHICH IS WHY {@link FALLBACK} EXISTS.
 * `label: string` makes the prop mandatory, and `<StatePill tone="banned"
 * label="" />` still type-checks — rendering a coloured chip with no text node
 * at all, which is precisely the "colour and the notch are the sole carriers"
 * failure the paragraph above stakes the component on preventing. A required
 * prop a caller can satisfy incorrectly is a convention, not a contract, so the
 * empty case is made unrepresentable *at render time*: the trimmed label wins
 * whenever there is one, and the tone's own name is spoken when there is not.
 * Every real call keeps the caller's wording; the only calls this changes are
 * the ones that were broken.
 */

import type { StateTone } from "optfall-theme";

import "./StatePill.css";

export interface StatePillProps {
  /** Which state this carries. Selects the fill and its matching ink. */
  readonly tone: StateTone;
  /**
   * Label text, supplied by the caller and never composed here — the corpus
   * owns the wording of a verdict. Must name the state; see above.
   */
  readonly label: string;
}

/**
 * The state spoken in full, one entry per `StateTone`. Not a wording the corpus
 * is expected to use — it is the floor under a caller who passed nothing, so
 * that "no label" degrades to a correct-if-plain verdict rather than to an
 * empty swatch. `Record<StateTone, string>` means a tone added to the union
 * fails the build here rather than shipping a blank chip.
 */
const FALLBACK: Record<StateTone, string> = {
  legal: "Legal",
  banned: "Banned",
  suspended: "Suspended",
  restricted: "Restricted",
  "living-legend": "Living Legend",
  "not-in-format": "Not in format",
  verified: "Verified",
  unverified: "Unverified",
};

export function StatePill({ tone, label }: StatePillProps) {
  /**
   * Trimmed so stray whitespace cannot pad the accessible name, and `?.` so a
   * JavaScript caller passing nothing gets the fallback rather than a
   * `TypeError`. The `?.trim() ||` idiom is `PitchJewel`'s; it is the house
   * spelling for "a default that cannot be displaced by a blank".
   */
  const spoken = label?.trim() || FALLBACK[tone] || tone;

  return (
    <span className={`of-pill of-pill--tone-${tone}`} data-tone={tone}>
      {spoken}
    </span>
  );
}
