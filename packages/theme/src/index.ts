/**
 * `optfall-theme` — the token layer, and nothing else.
 *
 * Colour, type, spacing, bevel and ornament live here; component styles do
 * not. Components consume tokens and never literals, and themes swap at the
 * token layer alone — which is what keeps light and dark equally considered
 * rather than one being a hasty inversion of the other.
 *
 * This module ships the *machinery* — the token identifier grammar, the CSS
 * custom-property mapping, and the compliance guard. The palette itself is
 * filled in during Phase 1 of the build plan, deliberately after the mechanism
 * exists, so no surface can invent its own styles under deadline first.
 *
 * @packageDocumentation
 */

/* -------------------------------------------------------------------------- */
/* Themes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Black is the native key; light is the printed-rulebook translation — ash and
 * iron, not paper white. Neither is derived from the other.
 */
export type ThemeName = "dark" | "light";

export const THEMES: readonly ThemeName[] = ["dark", "light"];

export const DEFAULT_THEME: ThemeName = "dark";

/** The attribute a root element carries to select a theme. */
export const THEME_ATTRIBUTE = "data-optfall-theme";

/* -------------------------------------------------------------------------- */
/* Token identifiers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Prefix on every generated CSS custom property, so tokens cannot collide with
 * a host page's variables when a component is adopted as a custom element.
 */
export const TOKEN_PREFIX = "of";

/**
 * The only axes the system has. A value that does not belong to one of these
 * is not a token, and a component that needs it is missing a primitive.
 */
export type TokenNamespace =
  | "color"
  | "type"
  | "space"
  | "bevel"
  | "ornament"
  | "motion";

/** A dotted token identifier, such as `color.ground` or `space.gutter`. */
export type TokenId = `${TokenNamespace}.${string}`;

/** A theme's complete token table. */
export type TokenTable = Readonly<Partial<Record<TokenId, string>>>;

/** A theme is a name and a table of resolved values. Nothing more. */
export interface Theme {
  readonly name: ThemeName;
  readonly tokens: TokenTable;
}

/**
 * The CSS custom-property name for a token — `color.ground` becomes
 * `--of-color-ground`.
 */
export function cssProperty(id: TokenId): string {
  return `--${TOKEN_PREFIX}-${id.replaceAll(".", "-")}`;
}

/**
 * A `var()` reference to a token, for use in component stylesheets. The only
 * sanctioned way for a component to name a value.
 */
export function cssValue(id: TokenId, fallback?: string): string {
  return fallback === undefined
    ? `var(${cssProperty(id)})`
    : `var(${cssProperty(id)}, ${fallback})`;
}

/** The declaration block for a theme, ready to drop into a `:root` rule. */
export function toCssDeclarations(theme: Theme): string {
  const lines: string[] = [];
  for (const [id, value] of Object.entries(theme.tokens)) {
    if (value === undefined) continue;
    lines.push(`${cssProperty(id as TokenId)}: ${value};`);
  }
  return lines.join("\n");
}

/* -------------------------------------------------------------------------- */
/* Rationed vocabulary                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Three voices, strictly assigned: a serif for names and questions, a sans for
 * interface text, a wide-tracked mono for labels and anything citable.
 */
export type Voice = "serif" | "sans" | "mono";

/**
 * Filigree earns exactly three roles. Never on a control, never on a list,
 * never twice on one screen — so the set is closed by the type rather than by
 * a code-review habit.
 */
export type OrnamentRole = "panel-corner" | "card-corner" | "section-rule";

export const ORNAMENT_ROLES: readonly OrnamentRole[] = [
  "panel-corner",
  "card-corner",
  "section-rule",
];

/** Every plate is bevelled: light top edge, dark bottom edge. Never rounded. */
export type BevelEdge = "top" | "bottom";

/**
 * Pitch value. The numeral is the primary channel and colour is the redundant
 * one — red and yellow are the classic deuteranopia confusion pair, and pitch
 * is the most-read value on a card.
 */
export type PitchValue = 0 | 1 | 2 | 3;

/** Anything carrying state wears a notched corner. This is the closed set. */
export type StateTone =
  | "legal"
  | "banned"
  | "suspended"
  | "restricted"
  | "living-legend"
  | "not-in-format"
  | "verified"
  | "unverified";

/**
 * Brass is reserved for authority — the verified judge seal and nothing else.
 * A material used once is a signal; used twice it is a theme.
 */
export const BRASS_RESERVED_FOR: StateTone = "verified";

/* -------------------------------------------------------------------------- */
/* Compliance, enforced in the token layer                                     */
/* -------------------------------------------------------------------------- */

/**
 * Legend Story Studios' asset policy forbids third-party applications from
 * using their logos — and product set logos count as logos, which rules out
 * set symbols as filter icons. Card faces are fine; marks are not.
 *
 * The constraint lives here rather than in a memo because the token layer is
 * the only place an asset could enter the design system. Any token id
 * containing one of these segments is rejected by {@link assertTokenTable}.
 */
export const FORBIDDEN_TOKEN_SEGMENTS: readonly string[] = [
  "logo",
  "logotype",
  "wordmark",
  "brandmark",
  "set-symbol",
  "set-logo",
];

/**
 * Splits a token id into lowercase words, treating `.`, `-`, `_` and camelCase
 * humps as equivalent boundaries. `ornament.setSymbol-icon` becomes
 * `["ornament", "set", "symbol", "icon"]`, so the rules below do not depend on
 * a house naming style that has not been decided yet.
 */
function tokenWords(id: string): string[] {
  return id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Whether a token id names something the asset policy forbids shipping.
 *
 * Matches on WORD boundaries, which is the only spelling that gets both halves
 * right. Testing whole dot-separated segments misses everything real — nobody
 * writes `asset.logo`, they write `asset.fab-logo`, `brand.lssLogo` or
 * `icon.setSymbol`. But stripping separators entirely and matching substrings
 * over-fires just as badly: `color.dialog.overlay` collapses to
 * `colordialogoverlay`, which contains "logo", so a legitimate Phase 1 token
 * would fail the build with an accusation about LSS's asset policy.
 *
 * Splitting into words first catches `fab-logo`, `lssLogo` and `setSymbol`
 * while leaving `dialog.overlay` alone, because "logo" is a word here rather
 * than an accident of adjacency.
 *
 * The deliberate gap: an unseparated coinage like `fablogo` is not caught. That
 * is the price of not failing builds on `dialog`, and it is the right side to
 * err on — this check exists to stop an honest mistake reaching production, not
 * to defeat somebody determined to smuggle a logo past it.
 */
export function isForbiddenTokenId(id: string): boolean {
  const haystack = `-${tokenWords(id).join("-")}-`;
  return FORBIDDEN_TOKEN_SEGMENTS.some((segment) =>
    haystack.includes(`-${tokenWords(segment).join("-")}-`),
  );
}

/**
 * Throws if a token table names a forbidden asset. Intended to run as a test
 * over every published theme, so the no-logo rule fails a build rather than
 * relying on someone remembering it.
 *
 * @throws {Error} When a forbidden token id is present.
 */
export function assertTokenTable(tokens: TokenTable): void {
  const offenders = Object.keys(tokens).filter(isForbiddenTokenId);
  if (offenders.length > 0) {
    throw new Error(
      `Token ids name assets the LSS policy forbids shipping: ${offenders.join(", ")}. Set identity in Optfall is typographic, never a symbol.`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* The themes themselves                                                       */
/* -------------------------------------------------------------------------- */

import { DARK_TOKENS, LIGHT_TOKENS } from "./tokens";

export { DARK_TOKENS, LIGHT_TOKENS };

/** Black is the native key. */
export const darkTheme: Theme = { name: "dark", tokens: DARK_TOKENS };

/** Ash and iron — a translation, never an inversion. */
export const lightTheme: Theme = { name: "light", tokens: LIGHT_TOKENS };

export const themes: Readonly<Record<ThemeName, Theme>> = {
  dark: darkTheme,
  light: lightTheme,
};

/**
 * The complete stylesheet: dark on `:root` because it is the native key, light
 * behind the theme attribute *and* behind `prefers-color-scheme` for readers
 * who have expressed no preference to us.
 *
 * Emitting both from one function is what keeps the two modes in step. There is
 * no build step that could apply to one and not the other, and no hand-written
 * CSS file to fall out of date with the tokens — which is the mechanism behind
 * `docs/PLAN.md`'s claim that a theme is swapped "at the token layer alone".
 */
function indentBlock(block: string, pad: string): string {
  return block
    .split("\n")
    .map((line) => (line ? pad + line : line))
    .join("\n");
}

export function themeStylesheet(): string {
  const indent = indentBlock;

  const dark = toCssDeclarations(darkTheme);
  const light = toCssDeclarations(lightTheme);

  return [
    "/* Generated by optfall-theme. Do not edit — change the tokens. */",
    ":root {",
    indent(dark, "  "),
    "}",
    "",
    `:root[${THEME_ATTRIBUTE}="light"] {`,
    indent(light, "  "),
    "}",
    "",
    "@media (prefers-color-scheme: light) {",
    `  :root:not([${THEME_ATTRIBUTE}="dark"]) {`,
    indent(light, "    "),
    "  }",
    "}",
    "",
  ].join("\n");
}
