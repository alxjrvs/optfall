/**
 * The header's search field, when the page it is on can answer it in place.
 *
 * THE ISLAND IS THE FORM ITSELF, NOT A WRAPPER ROUND IT. `.of-bar` is a flex
 * container and `.of-bar__find` is a flex ITEM with a growth basis, so an
 * ordinary `<div data-island>` between them would take the item's place and the
 * form would stop growing — a header that quietly re-lays-out on the one page
 * that hydrates its field. `Island`'s `as` prop exists for this; see the note
 * there.
 *
 * WHAT IT OWNS IS THE FIELD, AND NOTHING ELSE. The `<form>` element, its
 * `action="/search"` and its `method="get"` are the SHELL's, server-rendered and
 * outside React's tree — which is what keeps the no-JavaScript behaviour exactly
 * as it was: the form is a real GET to a real page, and it submits and navigates
 * whether or not this ever hydrates. All hydration adds is answering in place.
 *
 * IT REPLACED A HUNDRED AND FIFTY LINES IN `CardSearch`, and the shape of what
 * it replaced is worth keeping visible because the shape is the argument.
 * `CardSearch` used to reach OUT of its own tree — `getElementById`, three
 * `addEventListener`s on a node it did not own, a ref holding the latest submit
 * closure so the listener could be bound once, and an effect writing React state
 * back into the DOM value while guarding the caret. Three separate bugs came out
 * of that arrangement, all recorded in that file's history: text typed during
 * hydration erased, a paste-then-Enter running the previous query, a caret
 * jumping to the end mid-word.
 *
 * None of the three was carelessness. They are what keeping React state and a
 * DOM node React does not own in step by hand looks like. So the node is React's
 * now, and the two islands talk through `./headerSearchStore.ts`.
 */

import { useEffect, useRef } from "react";

import { useStore } from "@tanstack/react-store";

import {
  headerSearchStore,
  setHeaderQuery,
  submitFromHeader,
  typeInHeader,
} from "./headerSearchStore";

/**
 * The field's id, which is also the label's `htmlFor`.
 *
 * IT USED TO BE A CONTRACT BETWEEN TWO FILES AND NOTHING ENFORCED IT.
 * `CardSearch` exported the same string and looked the node up by it, so a
 * rename in one place and not the other meant the field silently stopped being
 * adopted — the form still submitted and navigated, so the page kept working and
 * got slower, which is the failure mode to prefer and also the kind that goes
 * unnoticed. `ssg.test.ts` asserted the two agreed.
 *
 * There is one declaration now, in the component that renders the element. The
 * id survives because a label needs one, not because anything looks it up.
 */
export const HEADER_FIELD_ID = "site-search";

export function HeaderSearch() {
  const query = useStore(headerSearchStore, (state) => state.query);
  const field = useRef<HTMLInputElement>(null);

  /**
   * TEXT TYPED BEFORE THE SCRIPT LANDED IS ADOPTED, NOT DISCARDED.
   *
   * The header is static markup on every page, so the field is on screen and
   * typeable from the first paint — well before `islands.js` arrives. React
   * protects the text itself: its DOM host skips the value assignment while
   * hydrating, so a controlled input does not blank what is already in it. What
   * React cannot know is that the STORE should agree, and without this the first
   * keystroke after hydration would re-render with the store's `""` and wipe the
   * rest.
   *
   * This is the one place the DOM is still the source of truth, and it is the
   * one moment where that is simply true: the reader typed into an input before
   * anything was listening.
   */
  useEffect(() => {
    const typed = field.current?.value ?? "";
    if (typed !== "") setHeaderQuery(typed);
  }, []);

  /**
   * The submit, listened for on the FORM — which this island is, rather than
   * renders.
   *
   * `Island`'s container is the hydration root and stays outside React's tree
   * (that is what makes the shell's `action="/search"` survive untouched), so
   * there is no element in this component's own JSX to hang an `onSubmit` on.
   * The form is reached through the field's `.form`, which is the DOM's own
   * answer to "which form is this input in" rather than a second lookup by id.
   *
   * **IT ONLY PREVENTS THE NAVIGATION WHEN SOMETHING IS LISTENING**, and that
   * guard is the whole reason this is not just `preventDefault()`. Islands
   * hydrate independently and `islands.client.ts` contains a failure to one of
   * them on purpose — so `CardSearch` can be absent, or broken, while this is
   * fine. Swallowing the submit then would leave a field that looks like it
   * works and answers nothing, which is the one shape "degrade visibly" forbids.
   * With the guard, the form does what it does with no JavaScript at all: a real
   * GET to `/search`.
   */
  useEffect(() => {
    const input = field.current;
    const form = input?.form;
    if (input === null || input === undefined) return;
    if (form === undefined || form === null) return;

    /**
     * ESCAPE, LISTENED FOR NATIVELY RATHER THAN THROUGH `onKeyDown`.
     *
     * WHAT IS BEING OVERRIDDEN IS A NATIVE BEHAVIOUR, which is the reason of
     * substance: `type="search"` has Escape handling of its own — WebKit and
     * Blink clear the field, Firefox treats it as "stop" — so this is a
     * `preventDefault` on the browser's own action, and listening for the real
     * event is the direct way to say that rather than one layer removed through
     * React's delegation.
     *
     * AND IT IS THE ONLY WAY IT CAN BE TESTED HERE, which is worth recording
     * because the next person will reach for the tidier `onKeyDown` prop.
     * Measured with a two-element harness: under happy-dom, React 19's delegated
     * keydown listener never fires for an event dispatched on a child of the
     * root, whatever the container is — an `input` event does, a `keydown` does
     * not. `CardSearch.dom.test.tsx` asserts `defaultPrevented`, and through the
     * prop that assertion cannot pass no matter what the code does.
     */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setHeaderQuery("");
    };

    const onSubmit = (event: Event) => {
      if (!headerSearchStore.state.answeredInPlace) return;
      event.preventDefault();
      /*
        THE FIELD'S OWN VALUE, NOT THE STORE'S. `input` and `submit` can arrive
        in one task — a paste followed by Enter, or any programmatic submit — so
        at the moment of submit the input is the truth and everything else is a
        copy of it. This is the same correction the adopted-field version had to
        make, kept because the hazard is the browser's, not React's.
      */
      submitFromHeader(field.current?.value ?? "");
    };

    input.addEventListener("keydown", onKeyDown);
    form.addEventListener("submit", onSubmit);
    return () => {
      input.removeEventListener("keydown", onKeyDown);
      form.removeEventListener("submit", onSubmit);
    };
  }, []);

  return (
    <>
      <label className="of-bar__sr" htmlFor={HEADER_FIELD_ID}>
        Search the cards
      </label>
      {/*
        NO CHAIN IN THIS FIELD, DELIBERATELY. `SearchField` puts the mark inside
        the well because there it is the only thing on the page telling you what
        you are about to search. Here the wordmark's chain is already a few
        pixels to the left, so a second one says nothing the first has not — two
        identical marks on one row read as a rendering mistake rather than as
        branding.
      */}
      <input
        id={HEADER_FIELD_ID}
        className="of-bar__field"
        name="q"
        type="search"
        autoComplete="off"
        /*
          OFF, BECAUSE THE QUERY IS THE ARTEFACT. Without it a phone capitalises
          the first character of every search, and this site's whole design
          treats `?q=…` as the thing you paste. The parser lowercases field names
          and operands, so `Banned:cc` still works — it just puts a stray capital
          in the URL somebody shares.
        */
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="search"
        placeholder="Search cards"
        ref={field}
        value={query}
        /*
          `onInput`, NOT `onChange`, AND BOTH HALVES OF THAT ARE DELIBERATE.

          They are the same event for a text field in a browser — React's
          `onChange` IS the native `input` event, renamed — so nothing about the
          behaviour differs. What differs is that `onInput` is a direct
          passthrough while `onChange` goes through React's ChangeEventPlugin and
          its value tracker, and measured on this repo's harness that plugin
          never fires: under happy-dom a controlled input's `onChange` is silent
          for a dispatched `input` event, while `onInput` fires normally.

          The empty `onChange` is what stops React warning that a `value` prop
          has no handler. It is not dead code pretending to be a handler — the
          real one is directly above it, and React's check is for the prop's
          presence rather than for what it does.
        */
        onInput={(event) => typeInHeader(event.currentTarget.value)}
        onChange={() => {}}
      />
      {/*
        NO VISIBLE SUBMIT, AND STILL A REAL ONE. A single-input form submits on
        Enter, and a button would be the widest thing in the bar for an action
        nobody clicks. But implicit submission is a browser BEHAVIOUR, not a
        guarantee, and a form whose only way in is a key press is a form some
        assistive technology cannot submit at all.

        Hidden rather than deleted, and it reappears on `:focus-visible` so a
        keyboard reader who tabs to it can see what they have landed on.
      */}
      <button className="of-bar__submit" type="submit">
        Search
      </button>
    </>
  );
}
