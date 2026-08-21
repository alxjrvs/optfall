/**
 * The client entry. It finds every island on the page and hydrates it.
 *
 * THIS IS THE ONLY JAVASCRIPT THE SITE SHIPS, and it runs on the pages that
 * have an island and nowhere else — `Document` emits the script tag only when a
 * page declares one. 115 of the pages ported so far declare none, and they load
 * no script at all.
 *
 * A REGISTRY, NOT A DYNAMIC IMPORT BY NAME. `import(name)` cannot be bundled:
 * the bundler has no way to know what `name` will be, so it either fails or
 * includes everything anyway while pretending not to. An explicit map is
 * honest about the same outcome and, unlike the dynamic form, fails at BUILD
 * time when an island's name and its component disagree.
 *
 * `hydrateRoot`, NEVER `createRoot`. The markup is already in the page —
 * `Island` renders its child on the server — so creating a root would throw it
 * away and rebuild it, which is a flash of the same content and a wasted paint.
 * Hydration also asserts the two renders agree: a mismatch is a real bug about
 * the server and the client disagreeing, and it is worth hearing about.
 *
 * EVERY FAILURE IS CONTAINED TO ITS OWN ISLAND. A page may carry more than one,
 * and an exception thrown while hydrating the first would otherwise leave the
 * rest inert with nothing in the console to say why. The loop reports and
 * continues; the failed island keeps its server-rendered markup, which is
 * static but correct — the degradation "degrade visibly" asks for.
 */

import { createElement } from "react";
import { hydrateRoot } from "react-dom/client";

import { CardList } from "./islands/CardList";
import { CardSearch } from "./islands/CardSearch";
import { HeaderSearch } from "./islands/HeaderSearch";
import { RandomCard } from "./islands/RandomCard";
import { RulesSearch } from "./islands/RulesSearch";
import { SetIndex } from "./islands/SetIndex";

/**
 * The islands, by the name `Island` writes into `data-island`.
 *
 * A registry is heterogeneous by definition — each island has its own props
 * type, and the only union that would type this map is one that has to be
 * edited to add an island. The types are checked at each CALL SITE, where the
 * real props are in scope.
 */
// biome-ignore lint/suspicious/noExplicitAny: see the note above.
const ISLANDS: Record<string, (props: any) => React.ReactNode> = {
  CardList,
  CardSearch,
  HeaderSearch,
  RandomCard,
  RulesSearch,
  SetIndex,
};

for (const mount of document.querySelectorAll<HTMLElement>("[data-island]")) {
  const name = mount.dataset["island"];
  if (name === undefined) continue;

  const component = ISLANDS[name];
  if (component === undefined) {
    console.error(`[islands] no component registered for "${name}"`);
    continue;
  }

  try {
    const props = JSON.parse(mount.dataset["props"] ?? "{}");
    hydrateRoot(mount, createElement(component, props));
  } catch (error) {
    // The server-rendered markup stays on the page. Static, but correct.
    console.error(`[islands] "${name}" failed to hydrate`, error);
  }
}
