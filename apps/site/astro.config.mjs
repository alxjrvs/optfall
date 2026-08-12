// @ts-check
import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";

// Static output is a project-wide constraint, not a default we happen to be
// taking: no database, no server, no runtime bill. See docs/PLAN.md, "Stack".
//
// `site` IS SET NOW. It was deliberately unset while the domain was still open
// (docs/PLAN.md, "Settled, and still open"); optfall.com is live and serving,
// so the open question is closed and canonical URLs — which need an origin to
// be absolute — can be emitted.
export default defineConfig({
  site: "https://optfall.com",
  output: "static",
  integrations: [svelte()],
});
