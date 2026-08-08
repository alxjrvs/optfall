import type { StorybookConfig } from "@storybook/svelte-vite";

/**
 * Storybook is the workbench, not the documentation afterthought.
 *
 * `docs/PLAN.md` Phase 1: every primitive gets built here first, rendered in
 * both themes, before it appears in a product surface. And it deploys publicly
 * as its own build — which is the only mechanism by which the accessible pitch
 * jewel reaches other Flesh and Blood tools rather than stopping at our edges.
 *
 * VERSIONS ARE PINNED EXACTLY, and that is the plan's own instruction rather
 * than caution for its own sake: "Storybook's Svelte support is the least
 * mature of the mainstream framework integrations, and Svelte 5's runes are
 * recent enough that the integration has rough edges. Pin versions deliberately
 * rather than taking latest-of-everything." `bunfig.toml` sets
 * `install.exact = true` repo-wide, so every version here is a decision.
 */
const config: StorybookConfig = {
  // Plain CSF in TypeScript rather than `.stories.svelte`. The Svelte CSF
  // format needs a further addon on top of an integration the plan already
  // flags as the least mature of the mainstream ones, and stories written as
  // typed objects get checked by the same `svelte-check` pass as the
  // components — so a story that passes a prop no longer in the contract fails
  // the build instead of failing in a browser.
  stories: ["../src/**/*.stories.ts"],
  addons: ["@storybook/addon-a11y"],
  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },

  /**
   * Removes Storybook's Svelte docgen plugin, and this is the concrete shape of
   * the risk `docs/PLAN.md` Phase 1 records.
   *
   * That plugin runs `parseAst` over `.svelte` sources as though they were
   * JavaScript. Under Vite 8 — which builds with rolldown rather than rollup —
   * it fails on the first line of every component: `RolldownError: Parse
   * failed` pointing at `<script lang="ts">`. Vite 7 is not an escape either;
   * there `@sveltejs/vite-plugin-svelte@6` is not applied at all and
   * Storybook's own `PreviewRender.svelte` fails import analysis instead.
   *
   * What is lost is autodocs' automatically-extracted prop tables. What is kept
   * is every story, the theme toolbar, and the accessibility checks — the parts
   * the plan actually asks the workbench for. `argTypes` in each stories file
   * documents the props explicitly, which is more typing and less magic, and it
   * is checked by `svelte-check` rather than inferred at build time.
   *
   * Revisit when the integration matures; the plan's instruction is to pin
   * deliberately rather than to take latest-of-everything, so this stays until
   * something demonstrably better exists.
   */
  async viteFinal(viteConfig) {
    const { svelte } = await import("@sveltejs/vite-plugin-svelte");

    const DOCGEN = "storybook:svelte-docgen-plugin";
    const kept = (viteConfig.plugins ?? []).filter((plugin) => {
      const named = plugin as { name?: string } | null;
      return !named || named.name !== DOCGEN;
    });

    // The Svelte plugin is added HERE rather than left to the preset, because
    // the preset does not apply it under this combination and every `.svelte`
    // file — ours and Storybook's own `PreviewRender.svelte` — then reaches the
    // bundler untransformed and fails on `<script lang="ts">`. Adding it
    // ourselves is one line and removes the guesswork.
    viteConfig.plugins = [svelte(), ...kept];
    return viteConfig;
  },
};

export default config;
