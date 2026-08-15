/**
 * The stylesheet entry — the one module Vite is asked to build.
 *
 * A GLOB, AND THE FIRST ATTEMPT WAS `import "optfall-components/react"`.
 * That is the obvious spelling: each primitive carries `import "./Thing.css"`
 * as a side effect, so importing the library ought to pull all fourteen
 * stylesheets into the graph. It built cleanly and emitted **no CSS at all** —
 * an empty JavaScript chunk and nothing else. The entry uses none of the
 * library's exports, so Rollup tree-shook the whole module graph and took the
 * side-effect imports with it.
 *
 * Nothing failed. The build reported success, and a page linking the result
 * would have rendered completely unstyled — which is the same shape of silent
 * failure the CSS-Modules attempt produced in `CardFace`, arriving from the
 * opposite direction.
 *
 * `import.meta.glob` with `eager` cannot be shaken away, because the stylesheets
 * are the imports rather than a side effect of one. It is also the answer with
 * no list to maintain: a fifteenth component's CSS is collected on the day the
 * file is created, rather than on the day somebody remembers this entry exists.
 *
 * THE GENERATOR DOES NOT GO THROUGH VITE — Bun imports the page modules as
 * TypeScript and calls them, which is why there is no SSR build. So this is the
 * only Vite build in the pipeline and it exists to answer one question: what CSS
 * do the pages need, and at what URL.
 *
 * The token stylesheet is NOT here. It is generated from `packages/theme` as a
 * string rather than authored as CSS, so it has no module to import; `build.ts`
 * writes it out itself.
 */

/* The document's own rules — layout, type, the shell. Imported by name because
   there is exactly one of them and a glob would be pretending otherwise. */
import "./document.css";
import "./SiteHeader.css";

/* Every component's stylesheet, collected without a list to maintain. */
import.meta.glob("../../../packages/components/src/react/*.css", {
  eager: true,
});
