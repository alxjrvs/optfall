/**
 * The one piece of state two islands share: what is in the header's field.
 *
 * WHY THIS EXISTS AT ALL, IN THE WORDS `CardSearch` USED TO CARRY. The header is
 * rendered by `document.tsx`, outside `<main>`; the results are an island inside
 * it. So no single island can contain both the field and the results, and that
 * component's docblock named the three ways out: "two islands sharing a store,
 * or a full page load per search" — or the third, which is what shipped, having
 * the results island reach out of its own tree and adopt the header's input by
 * `getElementById`.
 *
 * ADOPTION WORKED AND COST ABOUT A HUNDRED AND FIFTY LINES, three of which were
 * bugs found the hard way and are recorded in that file's history: text typed
 * during hydration was erased by a value-sync effect; a paste-then-Enter in one
 * task re-ran the previous query because the submit handler's closure was a
 * render behind; and a caret jumped to the end mid-word when the same string was
 * written back into the field. None of the three is a mistake anybody made
 * carelessly. They are what happens when React state and a DOM node React does
 * not own are kept in step by hand.
 *
 * SO THE FIELD BECOMES REACT'S, AND THIS IS THE CHANNEL BETWEEN THE TWO ROOTS.
 * `HeaderSearch` renders the input and owns nothing else; `CardSearch` reads
 * this and answers. Neither reaches into the other's tree.
 *
 * **IT IS NOT A GENERAL STATE LAYER, AND SHOULD NOT BECOME ONE.** Everything
 * else on `/search` — the page, the size, the display mode, the submitted query
 * — lives in the URL, deliberately, because `docs/PLAN.md` makes the address the
 * product. This holds the ONE value that has no business in the URL: the
 * unsubmitted text in a box. Anything that belongs in a link belongs in the
 * link.
 *
 * WHY A STORE RATHER THAN A MODULE-LEVEL LET AND A SET OF CALLBACKS: because
 * `useStore` is `useSyncExternalStore` with the tearing and the
 * subscribe/unsubscribe bookkeeping already correct, and because a hand-rolled
 * version of it is precisely the category of code this change exists to delete.
 */

import { Store } from "@tanstack/store";

export interface HeaderSearchState {
  /**
   * What is in the box. Not what the results answer.
   *
   * THE DISTINCTION IS `CardSearch`'s OLDEST ONE and it survives the move: that
   * component keeps `submitted` separately, because results do not re-rank on
   * every keystroke — see its docblock, which argues the point at length. This
   * is the keystroke side. {@link HeaderSearchState.submittedQuery} is the other.
   */
  readonly query: string;
  /**
   * A counter, incremented on every submit. Not a boolean.
   *
   * SUBMITTING THE SAME TEXT TWICE IS TWO SUBMITS, and a flag cannot say so — it
   * would be true, then true again, and nothing downstream would fire. That is
   * not hypothetical here: pressing Enter on an unchanged query is how a reader
   * asks for the results page they are already looking at, and the redirect on a
   * single match depends on it happening.
   */
  readonly submissions: number;
  /**
   * The text of the most recent submit.
   *
   * CARRIED RATHER THAN READ FROM {@link HeaderSearchState.query}, for the exact
   * reason the adopted-field version passed the value into its handler: `input`
   * and `submit` can arrive in ONE task — a paste followed by Enter, or any
   * programmatic submit — and a reader of `query` in the same tick may see the
   * value from before it. Writing both in one `setState` makes them one fact.
   */
  readonly submittedQuery: string;
  /**
   * Whether anything is actually listening for a submit.
   *
   * FALSE UNTIL `CardSearch` MOUNTS, AND THAT IS A DEGRADATION GUARANTEE RATHER
   * THAN BOOKKEEPING. Islands hydrate independently and `islands.client.ts`
   * contains a failure to the island it happened in — so the header's field can
   * be live on a page where the results island is absent or threw. If the field
   * called `preventDefault()` regardless, that page would have a search box that
   * looks like it works and answers nothing.
   *
   * With this, the form falls back to what it is with no JavaScript at all: a
   * real GET to `/search`. Slower, and correct.
   */
  readonly answeredInPlace: boolean;
}

export const headerSearchStore = new Store<HeaderSearchState>({
  query: "",
  submissions: 0,
  submittedQuery: "",
  answeredInPlace: false,
});

/**
 * Claim the submits. Called by the island that can answer one, on mount.
 *
 * IT RETURNS ITS OWN UNDO, so the claim is scoped to the lifetime of the thing
 * making it rather than to the page's. An unmounted results island that left
 * this true would leave the field swallowing submits nothing answers.
 */
export function answerInPlace(): () => void {
  headerSearchStore.setState((state) => ({ ...state, answeredInPlace: true }));
  return () => {
    headerSearchStore.setState((state) => ({
      ...state,
      answeredInPlace: false,
    }));
  };
}

/** Typing. The box changed; nothing has been asked. */
export function typeInHeader(query: string): void {
  headerSearchStore.setState((state) => ({ ...state, query }));
}

/**
 * Submitting. The box's value becomes a question.
 *
 * IT TAKES THE VALUE RATHER THAN READING THE STORE, so that a submit arriving in
 * the same task as the keystroke that filled the field carries the text the
 * reader actually typed. Same argument as {@link HeaderSearchState.submittedQuery}.
 */
export function submitFromHeader(query: string): void {
  headerSearchStore.setState((state) => ({
    ...state,
    query,
    submissions: state.submissions + 1,
    submittedQuery: query,
  }));
}

/**
 * Putting text INTO the field from outside it — `?q=` on load, `popstate`, a
 * `display:` rewrite, Escape.
 *
 * The same write as {@link typeInHeader} and named differently on purpose: this
 * is the direction that used to need an effect, a ref and a caret guard, and
 * naming it keeps the callers legible about which way the value is travelling.
 */
export const setHeaderQuery = typeInHeader;
