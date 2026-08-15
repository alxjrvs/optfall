/**
 * The search field — the hero control, and the one both search surfaces owe.
 * React port.
 *
 * IT IS A FORM, NOT A TEXT BOX, and that is the load-bearing part. The
 * `<form method="get">` is what makes the no-JS path work on both surfaces:
 * submitting reaches a real URL carrying `?q=`, so a reader with no islands
 * running still produces a shareable address. A primitive that rendered only the
 * input would have left each caller to remember the form, the method, the search
 * role and the accessible name — four things, twice, and the second copy would
 * drift.
 *
 * WHAT IT DOES NOT OWN. Ranking, notices, results and the URL contract stay with
 * the caller. This draws a control and reports what happened to it; a primitive
 * that knew what a query meant would be a search engine with a stylesheet.
 *
 * THE HINT IS A SLOT RATHER THAN A STRING. Each surface teaches a different
 * grammar — the card operators here, `cr:` identifiers there — and both hints
 * carry markup (`<code>`, `<kbd>`). Passing prose through a prop would have
 * meant either escaping markup out of it or letting a caller inject HTML, and
 * the hint is wired to the field by `aria-describedby` so it has to be rendered
 * here rather than beside the component.
 *
 * TWO PORT DIFFERENCES, BOTH FORCED BY REACT AND BOTH WORTH NAMING.
 *
 * Svelte's `bind:value` and `bind:this` are two-way. React has no such thing, so
 * the value is a controlled prop with an `onChange`, and the element is reached
 * through a forwarded `ref` — which is what the `/` shortcut needs. The
 * component is deliberately CONTROLLED rather than defaulting to uncontrolled:
 * every caller here already holds the query in state because the URL is derived
 * from it, and an uncontrolled field would let the DOM and that state disagree.
 *
 * `id` is taken from `useId`, which is React's equivalent of Svelte's
 * `$props.id()` — stable across server and client render, which matters because
 * these ids are referenced by `htmlFor` and `aria-describedby` and a mismatch
 * between the two renders silently breaks the association.
 */

import { type ReactNode, type Ref, useId } from "react";

import { BevelledPlate } from "./BevelledPlate";
import { Mark } from "./Mark";
import "./SearchField.css";

export interface SearchFieldProps {
  /** The visible label above the field. */
  readonly label: string;
  /**
   * The accessible name of the search landmark — what is being searched,
   * "Flesh and Blood cards" rather than "Search". Required, because two search
   * regions on one site with the same name are indistinguishable in a landmark
   * list.
   */
  readonly region: string;
  /** Where the form submits with scripting off. A real URL, never `#`. */
  readonly action: string;
  /** The query. Controlled; see the note above. */
  readonly value: string;
  readonly onValueChange?: (value: string) => void;
  readonly placeholder?: string;
  /** The field element, for callers that focus it — the `/` shortcut. */
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  /** One line, wired to the field by `aria-describedby`. */
  readonly hint?: ReactNode;
  /**
   * COMBOBOX WIRING, for a caller that renders a suggestion list beside this
   * field.
   *
   * The list itself is emphatically NOT this component's job — a primitive that
   * rendered a popup would be deciding for every caller that a search field has
   * one, and two of the three fields in this product do not. But the ARIA that
   * makes a list usable lives on the INPUT, and the input lives here, so a
   * caller physically cannot supply it from outside. Passing it through is the
   * only arrangement in which a typeahead can be accessible at all.
   *
   * Omitted, none of these attributes render — an `aria-expanded` on a field
   * with nothing to expand is a promise to a screen reader that is never kept.
   */
  readonly listboxId?: string | undefined;
  readonly expanded?: boolean | undefined;
  /** The id of the active option, or `undefined` when none is active. */
  readonly activeDescendant?: string | undefined;
}

export function SearchField({
  label,
  region,
  action,
  value,
  onValueChange,
  placeholder,
  inputRef,
  onSubmit,
  onKeyDown,
  hint,
  listboxId,
  expanded = false,
  activeDescendant,
}: SearchFieldProps) {
  const uid = useId();
  const fieldId = `${uid}-query`;
  const hintId = `${uid}-hint`;

  return (
    /*
      `<form role="search">` RATHER THAN `<search>`, AND IT IS A DECISION.
      The `<search>` element is the modern spelling and Biome is right to
      prefer it — but adopting it here means wrapping the form, which moves
      where the landmark's accessible name lives and changes the markup this
      port is supposed to reproduce faithfully. The Svelte original shipped
      `<form role="search">`, both search surfaces are built around it, and
      swapping the landmark structure during a framework port is how a port
      becomes a redesign nobody reviewed. Worth doing; worth doing separately.
    */
    // biome-ignore lint/a11y/useSemanticElements: <search> is a separate change; see above.
    <form
      className="of-search"
      role="search"
      aria-label={region}
      action={action}
      method="get"
      onSubmit={onSubmit}
    >
      <label className="of-search__label" htmlFor={fieldId}>
        {label}
      </label>

      <BevelledPlate emphasis="sunken">
        <div className="of-search__well">
          {/*
            THE MARK, INSIDE THE FIELD. Scryfall puts a mana symbol here and it
            does real work: it tells you what you are about to search before you
            have typed, on a page that is otherwise a bare box. Decorative,
            because the field's own `<label>` already names it — a mark with an
            accessible name would make the control announce itself twice.

            `md`, not `sm`. The field sets its text at `type.size.title`, and a
            mark two steps below that read as a smudge rather than as the chain —
            visible in the markup and not on the page, which is the same as not
            being there.
          */}
          <span className="of-search__mark" aria-hidden="true">
            <Mark size="md" decorative />
          </span>
          {/*
            EVERY COMBOBOX ATTRIBUTE IS CONDITIONAL ON `listboxId`, WHICH IS
            THE POINT OF THEM. With no list to expand they all evaluate to
            `undefined` and none of them renders — an `aria-expanded` on a
            field with nothing to expand is a promise to a screen reader that
            is never kept. The rule reads the attributes without the
            conditions, so it sees combobox ARIA on a searchbox; the rendered
            output never contains that combination.
          */}
          {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role and the ARIA are set together or not at all. */}
          <input
            className="of-search__field"
            id={fieldId}
            name="q"
            type="search"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={placeholder}
            aria-describedby={hint ? hintId : undefined}
            role={listboxId ? "combobox" : undefined}
            aria-expanded={listboxId ? expanded : undefined}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            aria-autocomplete={listboxId ? "list" : undefined}
            value={value}
            onChange={(event) => onValueChange?.(event.currentTarget.value)}
            ref={inputRef}
            onKeyDown={onKeyDown}
          />
          {/*
            NO VISIBLE SUBMIT, AND STILL A REAL ONE. Scryfall has no button and
            neither do we: a single-input form submits on Enter, and the button
            was the widest thing in the well for an action nobody clicked.

            It is hidden rather than deleted. Implicit submission is a browser
            behaviour, not a guarantee — and a form whose only way in is a key
            press is a form some assistive technology cannot submit at all. The
            button is still in the accessibility tree and still focusable; it
            just takes no space.
          */}
          <button className="of-search__submit" type="submit">
            Search
          </button>
        </div>
      </BevelledPlate>

      {hint ? (
        <p className="of-search__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </form>
  );
}
