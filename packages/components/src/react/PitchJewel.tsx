/**
 * The pitch jewel — an eight-sided cut stone carrying its numeral. React port.
 *
 * This is the reference component for the library. Every convention here is
 * deliberate and every other primitive follows it:
 *
 * - **Styles name tokens and nothing else.** Not one literal colour or length.
 *   `scripts/check-tokens.ts` fails the build otherwise, and the `tokens` CI
 *   job is in the aggregate gate.
 * - **Square corners, bevelled surfaces.** Light top edge, dark bottom edge, so
 *   a plate reads as struck metal rather than as a rectangle.
 * - **The accessible name is a prop with a sensible default**, never absent —
 *   and "absent" includes `""`. See `spoken` below: the guard is
 *   `label?.trim() ||`, never `label ??`, because `??` falls through on
 *   `null`/`undefined` only, so `label=""` type-checks and silently strips the
 *   name off a `role="img"` whose only text node is `aria-hidden`. Every other
 *   primitive uses this same idiom; copy it verbatim.
 *
 * HOW A SURFACE GETS ITS BEVEL. "A light top edge and a dark bottom edge on
 * every plate" is a system rule, and the mechanism is chosen by geometry, not
 * by taste. There are exactly four sanctioned spellings and this is the list:
 *
 * 1. **Clipped surface with a FLAT top and bottom** (`StatePill`) — an *inset*
 *    `box-shadow` pair. A border cannot follow a `clip-path`; an inset shadow
 *    is clipped by the same polygon, so the bevel takes the chamfer with it.
 *    The flatness is the precondition, not a description: the band runs along
 *    the top of the *box*, so it only lands on an edge where the shape has one
 *    there.
 * 2. **Bordered plate** (`BevelledPlate`, `BrassSeal`, `Citation`) —
 *    `border-block-start-color` / `border-block-end-color`. The plate already
 *    pays for a border; the bevel is then free, and `BevelledPlate` adds an
 *    inset ring on top only to model *depth*, which is a separate axis.
 * 3. **Alpha silhouette** (`Mark`, and THIS JEWEL) — a paired `drop-shadow()`
 *    filter, the only spelling that traces an arbitrary outline. The mark has
 *    no box to put a border on; the jewel is a vertex-up diamond, which has no
 *    flat top for spelling (1) to sit on. Note the filter must be declared on a
 *    PARENT of the clipped element — see the stylesheet — because `filter` is
 *    applied before `clip-path` on the same element.
 * 4. **Hairline** (`OrnamentalRule`) — an *outset* zero-blur `box-shadow` pair.
 *    The special case, and the reason it is one: a rule must stay exactly one
 *    hairline of layout, and borders would make it three.
 *
 * `docs/DESIGN.md`: shape, number and colour state the same fact three times,
 * and the silhouette is reserved — nothing else in the interface is ever this
 * shape, which is what lets pitch and the blood accent share a hue without ever
 * being confused.
 *
 * THE NUMERAL IS THE PRIMARY CHANNEL, not an accessibility fallback. Red and
 * yellow are the classic deuteranopia confusion pair, pitch is the most-read
 * value on a card, and it is the same pair the leading commercial scanner app
 * misreads. So the numeral is always rendered, at every size — there is no
 * compact variant that drops it, because that variant would be the one that
 * breaks for the people this design exists to serve.
 */

import type { PitchValue } from "optfall-theme";

import "./PitchJewel.css";

export interface PitchJewelProps {
  /** 1, 2, 3 or 4 — or 0 for a card with no pitch value at all. */
  readonly value: PitchValue;
  readonly size?: "sm" | "md" | "lg";
  /** Accessible name. Defaults to the pitch value spoken in full. */
  readonly label?: string;
}

const TONES = ["none", "one", "two", "three", "four"] as const;

export function PitchJewel({ value, size = "md", label }: PitchJewelProps) {
  /**
   * `?.trim() ||`, not `??`. A default that only fires on `undefined` is a
   * default a caller can displace with `""` or `"   "` — and here that would
   * leave `aria-label=""` on a `role="img"` whose only text node is
   * `aria-hidden`, i.e. an unnamed image whose meaning is carried by fill
   * colour alone. `||` falls through on the empty string and `.trim()` catches
   * whitespace, so the computed name cannot be erased, only replaced.
   */
  const spoken =
    label?.trim() || (value === 0 ? "No pitch value" : `Pitch ${value}`);

  /** Rendered glyph. Zero is an absence, and reads as one. */
  const glyph = value === 0 ? "–" : String(value);

  const tone = TONES[value] ?? "none";

  return (
    <span
      className={`of-jewel of-jewel--${size} of-jewel--tone-${tone}`}
      role="img"
      aria-label={spoken}
      data-pitch={value}
    >
      {/*
        The stone is its own element so the bevel can be a filter on the parent.
        `filter` is applied before `clip-path` on the same element, so a
        drop-shadow declared beside the clip is clipped away by it; on the parent
        it traces the child's already-clipped alpha instead.
      */}
      <span className="of-jewel__stone">
        <span className="of-jewel__glyph" aria-hidden="true">
          {glyph}
        </span>
      </span>
    </span>
  );
}
