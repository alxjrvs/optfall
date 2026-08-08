// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

// Static output is a project-wide constraint, not a default we happen to be
// taking: no database, no server, no runtime bill. See docs/PLAN.md, "Stack".
//
// `site` is deliberately unset — the domain is still open (docs/PLAN.md,
// "Settled, and still open"). Set it once a domain is decided; canonical URLs
// and sitemaps want it.
export default defineConfig({
  output: "static",
  integrations: [svelte()],
});
