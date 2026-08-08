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
 */
function installTheme(): void {
  const id = "optfall-theme-tokens";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = themeStylesheet();
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
