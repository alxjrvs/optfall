/**
 * `/` focuses a search field, the way every reference tool worth using does.
 *
 * BOTH ISLANDS SHIPPED THIS EFFECT, character for character — fifteen lines
 * each, right down to the `isContentEditable` check. Diffing the two extracts
 * produced no output at all, which is the state where a fix to one of them
 * silently does not reach the other.
 *
 * It lives beside the islands rather than in `src/lib` because it is the only
 * thing here that touches React, and `src/lib` is imported by the generator as
 * plain modules. That boundary is the same one `card-search/` observes when it
 * imports `../cards` type-only.
 */

import { useEffect } from "react";

/**
 * Focus whatever `field` returns when the reader presses `/`.
 *
 * A GETTER RATHER THAN A REF, and the two callers are why. `RulesSearch` owns
 * its input and holds a ref to it; `CardSearch` drives the field in the
 * header's own island and reaches it through the DOM, because the two are
 * separate hydration roots with no ref between them. A hook that took a ref
 * would serve one of them and force the other to keep its own copy of this
 * effect, which is the duplication the hook exists to end.
 *
 * THE GUARDS ARE THE INTERESTING PART, and each answers a real complaint. A
 * modifier means the reader wants their browser's own shortcut, not ours.
 * Typing `/` inside any field — including a `contenteditable`, which no tag
 * name identifies — has to insert a slash, or the key becomes unusable in the
 * one place a search box is most likely to already have focus.
 *
 * `preventDefault` fires only after those guards, so the slash still reaches
 * whatever was legitimately expecting it.
 */
export function useFocusShortcut(field: () => HTMLElement | null): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      field()?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [field]);
}
