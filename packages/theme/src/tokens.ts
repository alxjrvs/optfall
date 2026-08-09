/**
 * The two token tables — the only place a literal colour, size or duration is
 * allowed to appear in this project.
 *
 * `docs/DESIGN.md` is the specification. Three constraints from it shape almost
 * every value here, and none of them is a matter of taste:
 *
 * 1. **Neutrals carry no colour cast at all** — "the grey of unpolished steel".
 *    Every neutral below has equal red, green and blue components. A neutral
 *    that is faintly blue reads as a website; a neutral that is faintly warm
 *    reads as parchment. Both are somewhere other than Rathe.
 *
 * 2. **Dark is the native key, light is a translation, and neither is derived
 *    from the other.** Light mode is "ash and iron, not paper white", so its
 *    ground is a mid grey rather than `#fff` with the tokens flipped. An
 *    inverted palette is how one mode ends up quietly unusable.
 *
 * 3. **Colour is data, never decoration.** Boldness is spent in exactly two
 *    places — the pitch jewel and the blood accent. Brass appears once, on
 *    verified attribution, and nowhere else.
 *
 * Both tables must define exactly the same token ids; a test asserts it, so a
 * token added to one mode and forgotten in the other fails the build rather
 * than rendering as an unset custom property.
 */

import type { TokenTable } from "./index";

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Values identical in both modes. Type, space and motion are structural rather
 * than tonal — a heading is the same size in the dark, and reading distance
 * does not change with the lights.
 *
 * The display face is an open question in `docs/DESIGN.md`: the candidates
 * (Grenze, Cinzel, Eczar) all need a licence check for webfont embedding, so
 * this ships a system stack that renders identically everywhere and gets
 * replaced in one token when that decision lands.
 */
const STRUCTURE: TokenTable = {
  /* Three voices, strictly assigned. Serif for names and questions, sans for
     interface text, mono — wide-tracked, uppercase — for anything citable. */
  "type.family.serif": "Palatino, 'Palatino Linotype', 'Book Antiqua', Georgia, serif",
  "type.family.sans":
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  "type.family.mono": "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",

  /* A restrained scale. Density without clutter means fewer sizes used more
     deliberately, not more sizes used approximately. */
  "type.size.micro": "0.6875rem",
  "type.size.small": "0.8125rem",
  "type.size.base": "0.9375rem",
  "type.size.large": "1.125rem",
  "type.size.title": "1.5rem",
  "type.size.display": "2.25rem",

  "type.weight.regular": "400",
  "type.weight.medium": "500",
  "type.weight.bold": "700",

  "type.leading.tight": "1.15",
  "type.leading.base": "1.5",
  "type.leading.loose": "1.7",

  /* Wide tracking is what makes the mono voice read as a label rather than as
     code. It is the voice's defining property, so it is a token. */
  "type.tracking.mono": "0.09em",
  "type.tracking.tight": "-0.01em",
  "type.tracking.normal": "0",

  /* The measure — maximum line length for running prose. A typographic
     constraint rather than a layout one, which is why it lives on the type
     axis: it is chosen from how far an eye can track a line and return to the
     right next one, not from any container. */
  "type.measure": "46rem",

  /* A 4px base step. Tight vertical rhythm is what holds density together
     without boxes and shadows. */
  "space.hair": "1px",
  "space.tightest": "0.125rem",
  "space.tighter": "0.25rem",
  "space.tight": "0.5rem",
  "space.base": "0.75rem",
  "space.loose": "1rem",
  "space.looser": "1.5rem",
  "space.loosest": "2.5rem",

  /* Everything is bevelled, nothing is rounded. Square corners are a system
     rule, so the radius token exists only to be zero — a component asking for
     a radius gets one, and it is none. */
  "bevel.width": "1px",
  "bevel.radius": "0",

  /* The notch on anything carrying state. The clipped corner is the only
     ornament in the system and it always means something. */
  "ornament.notch.size": "0.5rem",
  "ornament.rule.width": "1px",
  "ornament.filigree.size": "1.25rem",

  /* The jewel is sized here rather than in the component, because it is the
     one silhouette reserved to a single meaning — it appears at these three
     sizes and no others, and a component free to pick its own would erode
     that. */
  "ornament.jewel.small": "1.25rem",
  "ornament.jewel.base": "1.75rem",
  "ornament.jewel.large": "2.5rem",

  /* Quick enough not to be noticed, slow enough not to flicker. */
  "motion.fast": "120ms",
  "motion.base": "180ms",
  "motion.slow": "280ms",
  "motion.ease": "cubic-bezier(0.2, 0, 0.2, 1)",
};

/* -------------------------------------------------------------------------- */
/* Dark — the native key                                                       */
/* -------------------------------------------------------------------------- */

export const DARK_TOKENS: TokenTable = {
  ...STRUCTURE,

  /* Near-black ground, and true neutrals throughout. */
  "color.ground": "#0b0b0b",
  "color.sunken": "#060606",
  "color.surface": "#151515",
  "color.surface.raised": "#1e1e1e",

  "color.ink": "#ededed",
  "color.ink.muted": "#a6a6a6",
  "color.ink.faint": "#6e6e6e",
  "color.ink.inverse": "#0b0b0b",

  /* Hairline rules rather than cards and shadows. */
  "color.rule": "#2b2b2b",
  "color.rule.strong": "#3f3f3f",

  /* Blood. The game's own accent, and chrome rather than data — it can share a
     hue with pitch because it never shares a shape. */
  "color.accent": "#c01722",
  "color.accent.hover": "#d92531",
  "color.accent.ink": "#ffffff",

  /* Brass, reserved for authority: the verified judge seal and nothing else.
     A material used once is a signal; used twice it is a theme. */
  "color.brass": "#b08d3f",
  "color.brass.ink": "#141007",
  "color.brass.edge": "#d8b45f",

  /* Pitch. The numeral is the primary channel and colour is redundant — red and
     yellow are the classic deuteranopia confusion pair, and pitch is the
     most-read value on a card. Each value carries its own ink so the numeral
     stays legible on its own stone rather than on an average of the three. */
  "color.pitch.none": "#4a4a4a",
  "color.pitch.none.ink": "#ededed",
  "color.pitch.one": "#c62b30",
  "color.pitch.one.ink": "#ffffff",
  "color.pitch.two": "#d9a520",
  "color.pitch.two.ink": "#171307",
  "color.pitch.three": "#3277bd",
  "color.pitch.three.ink": "#ffffff",
  "color.pitch.facet": "#ffffff",

  /* State. The notch says "this carries state"; the colour says which. */
  /* Every coloured chip carries its own ink, exactly as every pitch stone does.
     A single shared ink token forces every state to sit in the same luminance
     band to stay legible — which is how `verified` would have ended up as a
     muddy brown rather than brass. */
  "color.state.legal": "#2f7d4f",
  "color.state.legal.ink": "#ffffff",
  "color.state.banned": "#a3131b",
  "color.state.banned.ink": "#ffffff",
  "color.state.suspended": "#8f5415",
  "color.state.suspended.ink": "#ffffff",
  "color.state.restricted": "#6f5aa6",
  "color.state.restricted.ink": "#ffffff",
  "color.state.living-legend": "#46606f",
  "color.state.living-legend.ink": "#ffffff",
  "color.state.not-in-format": "#4a4a4a",
  "color.state.not-in-format.ink": "#ffffff",
  "color.state.verified": "#b08d3f",
  "color.state.verified.ink": "#141007",
  "color.state.unverified": "#8a6a12",
  "color.state.unverified.ink": "#ffffff",

  /* Bevel: light top edge, dark bottom edge, so plates read as struck metal. */
  "bevel.light": "rgba(255, 255, 255, 0.09)",
  "bevel.dark": "rgba(0, 0, 0, 0.6)",

  "ornament.filigree.ink": "#3f3f3f",

  "color.focus": "#8fb8e8",
};

/* -------------------------------------------------------------------------- */
/* Light — the printed-rulebook translation                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ash and iron. The ground is deliberately a mid grey rather than white: this
 * is a rulebook printed on stock, not a web page. Accent and brass are darkened
 * rather than reused, because the same hue that reads as blood on near-black
 * reads as pink on ash and fails contrast besides.
 */
export const LIGHT_TOKENS: TokenTable = {
  ...STRUCTURE,

  "color.ground": "#d5d5d5",
  "color.sunken": "#c4c4c4",
  "color.surface": "#e0e0e0",
  "color.surface.raised": "#ececec",

  "color.ink": "#161616",
  "color.ink.muted": "#474747",
  "color.ink.faint": "#6b6b6b",
  "color.ink.inverse": "#f2f2f2",

  "color.rule": "#b4b4b4",
  "color.rule.strong": "#8f8f8f",

  "color.accent": "#94101a",
  "color.accent.hover": "#7a0d15",
  "color.accent.ink": "#ffffff",

  "color.brass": "#6d541b",
  "color.brass.ink": "#f5efdd",
  "color.brass.edge": "#8d7029",

  /* Pitch two keeps a light stone with dark ink here rather than being forced
     dark to match its neighbours. Driving yellow dark enough for white text
     turns it olive, which loses the hue AND collapses its luminance onto red's
     — leaving the deuteranopia confusion pair separated by nothing but the
     numeral. Letting it stay yellow keeps two channels working. */
  "color.pitch.none": "#6b6b6b",
  "color.pitch.none.ink": "#ffffff",
  "color.pitch.one": "#a81f25",
  "color.pitch.one.ink": "#ffffff",
  "color.pitch.two": "#c9971f",
  "color.pitch.two.ink": "#1a1405",
  "color.pitch.three": "#245d99",
  "color.pitch.three.ink": "#ffffff",
  "color.pitch.facet": "#ffffff",

  "color.state.legal": "#1f6039",
  "color.state.legal.ink": "#ffffff",
  "color.state.banned": "#8c1016",
  "color.state.banned.ink": "#ffffff",
  "color.state.suspended": "#8a4f11",
  "color.state.suspended.ink": "#ffffff",
  "color.state.restricted": "#57458a",
  "color.state.restricted.ink": "#ffffff",
  "color.state.living-legend": "#3f5764",
  "color.state.living-legend.ink": "#ffffff",
  "color.state.not-in-format": "#5c5c5c",
  "color.state.not-in-format.ink": "#ffffff",
  "color.state.verified": "#6d541b",
  "color.state.verified.ink": "#ffffff",
  "color.state.unverified": "#6f5410",
  "color.state.unverified.ink": "#ffffff",

  "bevel.light": "rgba(255, 255, 255, 0.85)",
  "bevel.dark": "rgba(0, 0, 0, 0.22)",

  "ornament.filigree.ink": "#9a9a9a",

  "color.focus": "#1d4f86",
};
