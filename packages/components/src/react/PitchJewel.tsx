/**
 * The pitch jewel — an eight-sided cut stone carrying three slots, filled to
 * the card's pitch value. React port.
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
 * THE COUNT IS THE PRIMARY CHANNEL, AND IT USED TO BE A NUMERAL. That is a
 * deliberate reversal of this docblock's own rule, so here is the whole of it.
 *
 * The rule was right about the constraint and wrong about the only way to meet
 * it: red and yellow are the classic deuteranopia confusion pair, pitch is the
 * most-read value on a card, and it is the same pair the leading commercial
 * scanner app misreads — so pitch may never be carried by hue alone. A numeral
 * satisfies that. So does counting.
 *
 * THE CARD ITSELF COUNTS. A printed pitch value is three slots in a triangle in
 * the top-left corner — one above, two below — filled with the resource pip
 * from the top down: one filled for pitch one, two for pitch two, three for
 * pitch three. It prints no numeral anywhere. A reader holding a card learns
 * that arrangement before they learn anything else about the frame, and the
 * panel was asking them to read a second notation for the value they already
 * knew how to see.
 *
 * WHAT THAT COSTS AND WHAT IT KEEPS. It costs the numeral's exactness at a
 * glance, which for a three-valued closed set is a smaller loss than it sounds:
 * nobody miscounts three dots. It keeps the whole of the colour-blindness
 * argument, because the count is not a hue — a reader who cannot separate the
 * red stone from the yellow one still counts one pip against two. And the
 * accessible name still says "Pitch 3" in words at every size, which is where
 * that claim belonged all along.
 *
 * THREE SLOTS, NOT `value` SLOTS, and the empty ones are the point. A single
 * filled pip and a single pip out of three are different statements; only the
 * second says "this card pitches for one of a possible three". The slots are
 * always rendered and `data-filled` decides which are struck.
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

  const tone = TONES[value] ?? "none";

  /**
   * THE THREE SLOTS THE CARD PRINTS, in the order it fills them: apex first,
   * then the two below it.
   *
   * A card with no pitch value at all fills none of them, which is the same
   * statement the grey `tone-none` stone makes and is why zero needs no branch
   * of its own. Pitch four — one previewed card, none in the corpus this
   * repository pins — would fill every slot and be told from pitch three by its
   * stone alone; `tokens.ts` records how much of that is verifiable here.
   */
  const slots = [0, 1, 2];

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
        <span className="of-jewel__slots" aria-hidden="true">
          {slots.map((slot) => (
            <span
              key={slot}
              className="of-jewel__slot"
              data-filled={slot < value ? "true" : "false"}
            />
          ))}
        </span>
      </span>
    </span>
  );
}
