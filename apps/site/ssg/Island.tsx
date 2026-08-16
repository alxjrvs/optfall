/**
 * An island — a component rendered on the server AND taken over in the browser.
 * The generator's answer to `client:load`.
 *
 * THE PAGES ARE DOCUMENTS AND THE ISLANDS ARE THE EXCEPTIONS, which is the whole
 * architecture and the reason this is a component rather than a mode. Most of
 * the site has no interactivity at all; those pages ship no JavaScript, and the
 * shell emits no script tag for them. An island is the narrow case where a
 * subtree genuinely has state — a search field, a printing picker — and it pays
 * for its own hydration and nothing else's.
 *
 * IT IS RENDERED AS ITS OWN ROOT, WITH `renderToString`, AND THAT IS THE WHOLE
 * OF THIS FILE'S DIFFICULTY.
 *
 * The obvious implementation is to return `children` and let the page's own
 * render walk into it. That was the first version, and it produced React error
 * #418 — "the server rendered text didn't match the client" — on the first page
 * an island was mounted on. Two distinct causes, both fixed by the same change:
 *
 * **`renderToStaticMarkup` cannot be hydrated.** It is not a faster
 * `renderToString`; it deliberately omits the `<!-- -->` separators React puts
 * between adjacent text nodes, because static markup has nothing to hydrate. So
 * the hint line's `<code>x</code>{" "}names the corpus` arrived as ONE text node
 * where the client expected two, and hydration failed on the difference. The
 * pages are still rendered with `renderToStaticMarkup` — that is right for them,
 * and it is why the other pages carry no hydration scaffolding at all — but an
 * island subtree is rendered here, separately, with the API that supports it.
 *
 * **`useId` is relative to its root.** Rendered inside the page, the server's
 * ids reflect the island's position in the whole document (`_R_d6_`); the client
 * hydrates the island container alone, so its counter starts fresh (`_R_1_`).
 * Every `htmlFor`, `id` and `aria-describedby` in the subtree disagreed —
 * meaning a label pointing at nothing, which is a real accessibility failure and
 * not merely a warning. Rendering the island as its own root here makes the
 * server's counter start where the client's does.
 *
 * THE PROPS TRAVEL AS JSON IN AN ATTRIBUTE. That is what Astro does and it is
 * the only thing that works without a server: the client has to reconstruct the
 * same props the server rendered with, and the page is the only channel. React
 * escapes the attribute value, so the serialisation cannot break out of it.
 *
 * WHAT MAY BE AN ISLAND'S PROPS IS THEREFORE CONSTRAINED, and the constraint is
 * worth stating because it is invisible until it bites: props must survive
 * `JSON.stringify` and `JSON.parse`. No functions, no `Map`, no `Date`, no
 * `undefined` inside an array. The search indexes are bags of strings for
 * exactly this reason — their whole wire format exists to cross this boundary.
 */

import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";

/** Every island the client bundle knows how to hydrate. */
export type IslandName =
  | "RulesSearch"
  | "RandomCard"
  | "CardSearch"
  | "CardList";

export interface IslandProps<P> {
  /** Which component to hydrate. Must be a key of the client registry. */
  readonly name: IslandName;
  /** Serialisable props, handed to the same component on both sides. */
  readonly props: P;
  /** The subtree to render and then hydrate. */
  readonly children: ReactElement;
}

export function Island<P>({ name, props, children }: IslandProps<P>) {
  return (
    <div
      data-island={name}
      /*
       * `data-props` rather than a `<script type="application/json">` child.
       * A script child would sit INSIDE the hydration root, so React would see a
       * node the component did not render and fail on it. An attribute on the
       * container is outside the tree React owns.
       */
      data-props={JSON.stringify(props)}
      /*
       * The subtree is already HTML by the time it gets here, so it is injected
       * rather than rendered. `dangerouslySetInnerHTML` is the only way to put a
       * pre-rendered string inside an element React is emitting — and the string
       * comes from React's own renderer two lines up, not from anywhere a caller
       * could reach.
       */
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the HTML is React's own output; see above.
      dangerouslySetInnerHTML={{ __html: renderToString(children) }}
    />
  );
}
