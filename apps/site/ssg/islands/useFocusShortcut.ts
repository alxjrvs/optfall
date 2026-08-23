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
 * Where a reader's decision to turn the shortcut off is remembered.
 *
 * WCAG 2.1.4 IS THE REASON THIS EXISTS, AND IT IS NOT SATISFIED YET. Say that
 * plainly, because the mechanism below reads like compliance and is only half
 * of it: the SC requires a way to turn the shortcut off that is AVAILABLE TO
 * THE USER, and `setSlashShortcutDisabled` has no caller. Today the only way to
 * set this key is devtools, which is not a mechanism a reader has. What exists
 * is the half that has to exist first — a preference the hook honours — so that
 * a control has something to call. Until one does, the shortcut is still an
 * unremappable single-character binding and this file should not pretend
 * otherwise.
 *
 * The SC is narrow about what counts.
 * A single-character shortcut bound to the document has to offer one of exactly
 * three things: a way to turn it off, a way to remap it, or activation only
 * while the component it belongs to has focus. The guards below are careful and
 * are none of those — skipping `input`, `textarea`, `select` and
 * `contenteditable` stops the shortcut eating a slash somebody meant to type,
 * which is a different complaint from the one 2.1.4 raises. That one is about a
 * reader whose speech input emits stray characters, for whom every keystroke
 * this page claims is a command they did not give.
 *
 * OFF IS REMEMBERED, ON IS THE ABSENCE OF A VALUE, so a reader who has never
 * expressed a preference gets the shortcut and a reader who has turned it off
 * keeps it off across pages and visits. `localStorage` throws in some privacy
 * modes, and a shortcut is not worth a broken page, so both accesses are
 * guarded and a failure reads as "no preference".
 */
const OPT_OUT_KEY = "optfall:no-slash-shortcut";

/** True when this reader has turned the shortcut off. Never throws. */
export function slashShortcutDisabled(): boolean {
  try {
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Turn the shortcut off, or back on. Never throws. */
export function setSlashShortcutDisabled(disabled: boolean): void {
  try {
    if (disabled) localStorage.setItem(OPT_OUT_KEY, "1");
    else localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* A preference that cannot be stored is a preference that does not
       survive the page, which is worse than the shortcut and better than a
       thrown error in an event handler. */
  }
}

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
    if (slashShortcutDisabled()) return;

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
