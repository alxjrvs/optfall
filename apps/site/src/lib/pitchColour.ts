/**
 * The colour of a pitch value, as a literal — for the one consumer that cannot
 * read a custom property.
 *
 * `<meta name="theme-color">` is read by the browser's chrome and by link
 * unfurlers (Discord, above all), neither of which ever sees a stylesheet. So
 * this reads the token TABLE rather than writing `var(--…)`, and it reads the
 * same `color.pitch.*` ids `PitchJewel` and `PitchRule` paint with, so the
 * preview's edge and the stone on the page cannot drift apart.
 *
 * THE DARK THEME, because there is no viewer to ask. An unfurler renders one
 * preview for everybody, and dark is the site's default.
 */

import { type PitchValue, themes } from "optfall-theme";

/** Same order as `TONES` in the pitch primitives: index is the value. */
const TONES = ["none", "one", "two", "three", "four"] as const;

export function pitchColour(pitch: PitchValue): string {
  const id = `color.pitch.${TONES[pitch]}` as const;
  const value = themes.dark.tokens[id];
  if (value === undefined) {
    throw new Error(
      `pitchColour: optfall-theme defines no ${id}. Fix the token id rather than inlining a colour here.`,
    );
  }
  return value;
}
