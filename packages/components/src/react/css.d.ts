/**
 * A stylesheet import, as far as TypeScript is concerned.
 *
 * `import "./CardFace.css"` is a side effect — the bundler emits the sheet and
 * the module exports nothing. `tsc` does not know `.css` is a module at all, so
 * without this it fails with TS2882.
 *
 * IT DECLARES NOTHING, AND THAT IS THE IMPROVEMENT OVER WHAT WAS HERE BEFORE.
 * The first attempt at this port used CSS Modules, which needed
 * `declare module "*.module.css" { const classes: Record<string, string> }` —
 * a type that promises every key exists and delivers `undefined` for the ones
 * that do not. That promise was immediately broken: under `bun test` the import
 * resolved to an empty object and every component rendered with no `class`
 * attribute, silently, with the tests still green.
 *
 * An empty declaration cannot lie in that direction, because it claims nothing.
 * The class names live in the TSX as literal strings, where a typo is a wrong
 * class in the output rather than a missing one — visible, and greppable.
 */
declare module "*.css";
