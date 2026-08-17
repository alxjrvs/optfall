/**
 * Picks a card and goes there. React port.
 *
 * `Math.random()` is the whole implementation, and that is the point: there is
 * nothing to rank, nothing to weight and nothing to remember. A "random" that
 * avoided repeats would need state, and state on a static site is a cookie
 * nobody asked for.
 *
 * It navigates on mount rather than offering a button, because the reader
 * already pressed the button — it was the link that brought them here.
 *
 * THE EFFECT RUNS ONCE, WHICH IS A CHANGE FROM SVELTE AND A NECESSARY ONE.
 * Svelte's `$effect` re-ran when `names` changed, which for a prop that never
 * changes meant "once". React's dependency array has to say so explicitly, and
 * saying `[names]` here would be worse than wrong: `decodeNameIndex` returns a
 * fresh object each call, so under React's Strict Mode double-invoke the
 * component would pick a card, navigate, and pick a different card.
 */

import { useEffect, useMemo, useState } from "react";

import {
  decodeNameIndex,
  type EncodedNameIndex,
} from "../../src/lib/typeahead";

import "./RandomCard.css";

export interface RandomCardProps {
  readonly index: EncodedNameIndex;
}

export function RandomCard({ index }: RandomCardProps) {
  const names = useMemo(() => decodeNameIndex(index), [index]);
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (names.size === 0) return;
    const pick = Math.floor(Math.random() * names.size);
    /* The index carries the destination outright — a card's URL is
       `/card/<set>/<number>/<slug>` and its set and number are not derivable
       from a name, so there is no template to fill in here. */
    const target = names.hrefs[pick];
    if (target === undefined) return;
    setHref(target);
    window.location.replace(target);
  }, [names]);

  return (
    /*
      A link, not just a redirect. If the navigation is blocked or slow the
      reader still has something to press, and `replace` keeps the back button
      pointing at wherever they came from rather than trapping them in a loop of
      random cards.
    */
    <p className="of-random__fallback">
      {href ? <a href={href}>Opening a card…</a> : "Choosing a card…"}
    </p>
  );
}
