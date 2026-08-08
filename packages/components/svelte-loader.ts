/**
 * Teaches `bun test` to import `.svelte` files.
 *
 * Bun's runtime has no Svelte loader, so a bare `import Mark from
 * "./Mark.svelte"` resolves to the file PATH as a string — which then fails
 * deep inside Svelte's server renderer with "component is not a function",
 * pointing at Svelte's internals rather than at the missing loader. This plugin
 * compiles on import instead.
 *
 * Server output (`generate: "server"`) because the accessibility suite renders
 * to HTML and inspects markup; it never mounts a client component. The DOM
 * these produce is the DOM the product ships, which is what makes the axe
 * results meaningful.
 *
 * Loaded via `preload` in bunfig.toml so every `bun test` run gets it without
 * each test file having to remember.
 */
import { plugin } from "bun";
import { compile } from "svelte/compiler";

plugin({
  name: "svelte-ssr-loader",
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async (args) => {
      const source = await Bun.file(args.path).text();
      const { js } = compile(source, {
        generate: "server",
        filename: args.path,
      });
      return { contents: js.code, loader: "js" };
    });
  },
});
