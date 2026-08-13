import type { Preview } from "@storybook/svelte-vite";

import { THEME_ATTRIBUTE, THEMES, themeStylesheet } from "optfall-theme";

/**
 * The theme stylesheet is GENERATED AT RUNTIME from the token tables, never
 * copied into a CSS file here.
 *
 * A checked-in stylesheet would be a second declaration of the palette, and the
 * two would drift the first time somebody edited tokens without rebuilding —
 * leaving Storybook showing colours the product does not use, which is the one
 * failure a workbench must not have. Importing the same function the product
 * imports means the workbench cannot be wrong about the theme.
 *
 * THE TOKENS ARE DECLARED, AND THE DOCUMENT ALSO HAS TO SPEND THEM.
 * `themeStylesheet()` emits custom properties on `:root` and nothing else — it
 * defines the palette, it does not apply it — so until this rule existed the
 * canvas stayed the browser's white with the browser's black text, under a
 * comment below asserting the workbench "opens in" black. Every story was
 * rendered on a ground the product does not have, and the theme toolbar moved
 * the token values while the page around them did not move at all.
 *
 * That was a general lie about the theme and a specific bug for anything built
 * on `currentColor`: `Mark.svelte` inherits its `color` precisely so a mark
 * takes the ink of the wordmark it is set beside, which on this canvas meant it
 * inherited *Storybook's* text colour and stopped following the toolbar.
 *
 * Two declarations, matching the product's own in `BaseLayout.astro`.
 *
 * `color-scheme` is deliberately NOT among them, and its absence here is the
 * fix rather than an omission. It briefly was: a dark ground without it leaves
 * the browser's own chrome light — a pale scrollbar down the side of a
 * near-black workbench. But spelled by hand it can only be `dark light`, which
 * defers to the OPERATING SYSTEM, while this canvas is switched by the theme
 * toolbar; on a light machine at the default dark theme it changed nothing. It
 * now ships inside `themeStylesheet()`, keyed to the same selectors as the
 * palette, so the workbench, the site and the a11y harness get a scheme that
 * matches their ground without any of them restating it.
 *
 * Deliberately still not the layout's typography or padding: those belong to a
 * page, and a story that wants them should ask, whereas ground and ink are what
 * "rendered in both themes" means.
 */
function installTheme(): void {
  const id = "optfall-theme-tokens";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = [
    themeStylesheet(),
    "",
    "body {",
    "  background: var(--of-color-ground);",
    "  color: var(--of-color-ink);",
    "}",
  ].join("\n");
  document.head.append(style);
}

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },

    // docs/DESIGN.md: black is the native key, and for many users it is the
    // only mode they will ever see. The workbench opens in it for the same
    // reason the product does.
    backgrounds: { disable: true },

    a11y: {
      // Report violations rather than merely collecting them. The plan turns
      // the pitch jewel's contract — shape, numeral and colour carrying the
      // same fact three times — "from an intention into a test", and a checker
      // whose findings nobody reads is still an intention.
      test: "error",
    },
  },

  globalTypes: {
    theme: {
      description: "Optfall theme",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "contrast",
        items: THEMES.map((name) => ({ value: name, title: name })),
        dynamicTitle: true,
      },
    },
  },

  decorators: [
    (story, context) => {
      installTheme();
      // Set the attribute on the document root rather than on a wrapper: the
      // tokens are declared on `:root`, and a wrapper would leave anything
      // portalled outside it — a tooltip, a dialog — in the other theme.
      document.documentElement.setAttribute(
        THEME_ATTRIBUTE,
        String(context.globals.theme ?? "dark"),
      );
      return story();
    },
  ],
};

export default preview;
