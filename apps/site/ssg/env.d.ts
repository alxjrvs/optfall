/// <reference types="vite/client" />

/**
 * What the generator's TypeScript needs to know about non-TypeScript imports.
 *
 * `astro/tsconfigs/strict` carried both of these for free — Astro's own
 * `env.d.ts` referenced `vite/client`, and Astro declared the CSS modules. This
 * file is what that was, written down, now that `tsc --noEmit` checks this
 * directory directly.
 *
 * **The CSS declaration is a side-effect declaration on purpose.** It gives the
 * import no shape at all, so `import styles from "./x.css"` is still an error
 * rather than silently typed `any` — the sheets here are plain global CSS with
 * `of-` prefixed classes, and there is nothing to import a binding from. That
 * mistake is worth keeping loud: an earlier pass in this port DID reach for CSS
 * Modules, rendered zero `class` attributes under `bun test`, and passed every
 * compliance test while doing it.
 */
declare module "*.css";
