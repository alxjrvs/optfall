/**
 * The front door's field, with name suggestions under it. React port.
 *
 * EVERY SUGGESTION IS A DESTINATION, NOT A RESULT, which is the distinction that
 * makes this defensible on a site whose search is deliberately submit-driven. It
 * completes a NAME and takes you to that card's page; it does not re-rank
 * results as you type. `docs/SCRYFALL-GAP.md` §5.2 rules out live SEARCH and
 * this is not it.
 *
 * THE LIST IS IN FLOW, NOT FLOATING. A popup over a page this sparse would be
 * solving a problem the page does not have — there is nothing below the field to
 * obscure — and it would need collision handling, a scroll listener and a resize
 * listener to stay honest.
 *
 * THE `/` SHORTCUT IS BOUND HERE RATHER THAN IN `SearchField`, because that
 * primitive owns a form and nothing else. A primitive that also bound a global
 * key would be deciding for every caller that its field is THE field on the
 * page.
 *
 * THE COMBOBOX ARIA LIVES ON THE INPUT, WHICH LIVES IN `SearchField`, so it is
 * passed through rather than set here — the one arrangement in which a typeahead
 * can be accessible at all. Omitted, none of those attributes render: an
 * `aria-expanded` on a field with nothing to expand is a promise to a screen
 * reader that is never kept.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { PitchJewel, SearchField } from "optfall-components/react";

import {
  decodeNameIndex,
  type EncodedNameIndex,
  suggest,
} from "../../src/lib/typeahead";

import "./CardTypeahead.css";

export interface CardTypeaheadProps {
  readonly index: EncodedNameIndex;
  readonly action: string;
}

export function CardTypeahead({ index, action }: CardTypeaheadProps) {
  const names = useMemo(() => decodeNameIndex(index), [index]);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(
    () => (dismissed ? [] : suggest(names, query)),
    [dismissed, names, query],
  );
  const open = suggestions.length > 0;

  const uid = useId();
  const listId = `${uid}-suggestions`;
  const optionId = (i: number) => `${uid}-option-${i}`;

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
      field.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      // Closes the list and keeps the text. Clearing the field on Escape would
      // throw away what somebody typed to dismiss a popup they did not ask for.
      if (open) {
        event.preventDefault();
        setDismissed(true);
        setActive(-1);
      }
      return;
    }

    if (!open) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // preventDefault stops the caret jumping to the ends of the input, which
      // is what makes arrow keys usable for a list rather than for the text.
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const count = suggestions.length;
      setActive((current) =>
        current === -1
          ? step === 1
            ? 0
            : count - 1
          : (current + step + count) % count,
      );
      return;
    }

    if (event.key === "Enter" && active !== -1) {
      const chosen = suggestions[active];
      if (chosen) {
        event.preventDefault();
        window.location.href = chosen.href;
      }
    }
  }

  return (
    <div className="of-typeahead">
      <SearchField
        label="Search the cards"
        region="Flesh and Blood cards"
        action={action}
        placeholder="command and conquer"
        value={query}
        onValueChange={(next) => {
          // Typing reopens a list that Escape closed, and invalidates the
          // selection — otherwise Enter would navigate to a card the query no
          // longer matches.
          setQuery(next);
          setDismissed(false);
          setActive(-1);
        }}
        inputRef={field}
        onKeyDown={onKeyDown}
        listboxId={listId}
        expanded={open}
        activeDescendant={active === -1 ? undefined : optionId(active)}
        hint={
          <>
            <code>pitch:3 class:guardian</code> · <code>banned:cc</code> —{" "}
            <a href="/syntax">all operators</a>
          </>
        }
      />

      {open ? (
        <ul
          className="of-typeahead__suggestions"
          id={listId}
          // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: a listbox is the ARIA pattern a combobox names, and no HTML element carries it. The field is the interactive control — it holds `aria-controls`, `aria-expanded` and `aria-activedescendant`.
          role="listbox"
          aria-label="Card names"
        >
          {suggestions.map((suggestion, position) => (
            // biome-ignore lint/a11y/useFocusableInteractive: an `option` in this pattern must NOT be focusable. Focus stays on the field and `aria-activedescendant` moves — giving each option a tabIndex would put every suggestion in the tab order and break the arrow-key contract the pattern exists to provide.
            <li
              key={suggestion.href}
              id={optionId(position)}
              // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: as above — an option in a listbox.
              role="option"
              aria-selected={position === active}
              className={
                position === active ? "of-typeahead__active" : undefined
              }
            >
              <a
                className="of-typeahead__suggestion"
                href={suggestion.href}
                tabIndex={-1}
              >
                <span className="of-typeahead__jewels">
                  {suggestion.pitches.map((pitch) => (
                    <PitchJewel key={pitch} value={pitch} size="sm" />
                  ))}
                </span>
                <span className="of-typeahead__name">{suggestion.name}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
