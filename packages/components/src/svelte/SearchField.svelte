<script lang="ts">
  /**
   * The search field — the hero control, and the one both search surfaces owe.
   *
   * WHY THIS EXISTS. `RulesSearch.svelte` and `CardSearch.svelte` each carried
   * their own copy of this form and its styles, and both files carried a comment
   * saying so: "the two primitives `RulesSearch.svelte` records the library as
   * missing (`SearchField` and `ResultRow`), kept byte-identical here on purpose
   * so the eventual extraction is a cut and a paste rather than a redesign."
   * Measured before the cut: 89 identical CSS lines across 14 shared selectors.
   * This is that extraction, and `docs/PLAN.md`'s rule is what compels it — "a
   * screen that needs new CSS is a signal the library is missing a primitive;
   * add it there, not in the page."
   *
   * IT IS A FORM, NOT A TEXT BOX, and that is the load-bearing part. The
   * `<form method="get">` is what makes the no-JS path work on both surfaces:
   * submitting reaches a real URL carrying `?q=`, so a reader with no islands
   * running still produces a shareable address. A primitive that rendered only
   * the input would have left each caller to remember the form, the method, the
   * search role and the accessible name — four things, twice, and the second
   * copy would drift.
   *
   * WHAT IT DOES NOT OWN. Ranking, notices, results and the URL contract stay
   * with the caller. This draws a control and reports what happened to it; a
   * primitive that knew what a query meant would be a search engine with a
   * stylesheet.
   *
   * THE HINT IS A SNIPPET RATHER THAN A STRING. Each surface teaches a different
   * grammar — Card Vault's operators here, `cr:` identifiers there — and both
   * hints carry markup (`<code>`, `<kbd>`). Passing prose through a prop would
   * have meant either escaping markup out of it or letting a caller inject HTML,
   * and the hint is wired to the field by `aria-describedby` so it has to be
   * rendered here rather than beside the component.
   */
  import type { Snippet } from "svelte";

  import BevelledPlate from "./BevelledPlate.svelte";

  interface Props {
    /** The visible label above the field. */
    label: string;
    /**
     * The accessible name of the search landmark — what is being searched,
     * "Flesh and Blood cards" rather than "Search". Required, because two
     * search regions on one site with the same name are indistinguishable in a
     * landmark list.
     */
    region: string;
    /** Where the form submits with scripting off. A real URL, never `#`. */
    action: string;
    /** The query. Bindable. */
    value: string;
    placeholder?: string;
    /** The field element, for callers that focus it — the `/` shortcut. */
    element?: HTMLInputElement | null;
    onsubmit?: (event: SubmitEvent) => void;
    onkeydown?: (event: KeyboardEvent) => void;
    /** One line, wired to the field by `aria-describedby`. */
    hint?: Snippet;
    /**
     * COMBOBOX WIRING, for a caller that renders a suggestion list beside this
     * field.
     *
     * The list itself is emphatically NOT this component's job — a primitive
     * that rendered a popup would be deciding for every caller that a search
     * field has one, and two of the three fields in this product do not. But
     * the ARIA that makes a list usable lives on the INPUT, and the input lives
     * here, so a caller physically cannot supply it from outside. Passing it
     * through is the only arrangement in which a typeahead can be accessible at
     * all.
     *
     * Omitted, none of these attributes render — an `aria-expanded` on a field
     * with nothing to expand is a promise to a screen reader that is never kept.
     */
    listboxId?: string;
    expanded?: boolean;
    /** The id of the active option, or `undefined` when none is active. */
    activeDescendant?: string;
  }

  let {
    label,
    region,
    action,
    value = $bindable(),
    placeholder,
    element = $bindable(null),
    onsubmit,
    onkeydown,
    hint,
    listboxId,
    expanded = false,
    activeDescendant,
  }: Props = $props();

  const uid = $props.id();
  const fieldId = `${uid}-query`;
  const hintId = `${uid}-hint`;
</script>

<form class="search" role="search" aria-label={region} {action} method="get" {onsubmit}>
  <label class="label" for={fieldId}>{label}</label>

  <BevelledPlate emphasis="sunken">
    <div class="well">
      <input
        class="field"
        id={fieldId}
        name="q"
        type="search"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        enterkeyhint="search"
        {placeholder}
        aria-describedby={hint ? hintId : undefined}
        role={listboxId ? "combobox" : undefined}
        aria-expanded={listboxId ? expanded : undefined}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        aria-autocomplete={listboxId ? "list" : undefined}
        bind:value
        bind:this={element}
        {onkeydown}
      />
      <button class="submit" type="submit">Search</button>
    </div>
  </BevelledPlate>

  {#if hint}
    <p class="hint" id={hintId}>{@render hint()}</p>
  {/if}
</form>

<style>
  /*
    LIFTED VERBATIM from `apps/site/src/components/CardSearch.svelte`, which
    is what makes this an extraction rather than a redesign. Both search
    surfaces carried byte-identical copies of these rules and both said in a
    comment that they were being kept identical against exactly this day. The
    reasoning attached to each rule came with it, including the one below
    about `:focus` versus `:focus-visible`, which is a decision rather than a
    typo and would have been silently reversed by rewriting these from
    memory.

    Every value names a token; `scripts/check-tokens.ts` fails the build on a
    raw hex or length in component source.
  */

  .search {
    display: block;
  }

  .label {
    display: block;
    margin-block-end: var(--of-space-tight);
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-mono);
    text-transform: uppercase;
    color: var(--of-color-ink-muted);
  }

  .well {
    display: flex;
    align-items: stretch;
    gap: var(--of-space-tight);
  }

  .field {
    flex: 1 1 auto;
    min-inline-size: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--of-color-ink);
    font-family: var(--of-type-family-serif);
    font-size: var(--of-type-size-title);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-tight);
  }

  .field::placeholder {
    color: var(--of-color-ink-faint);
  }

  /*
    Never `outline: none`, and `:focus` rather than `:focus-visible` alone — a
    text field focused with a mouse is still a text field you are about to type
    into, and hiding that from the one input on the page would be hiding the
    state that matters most.
  */
  .field:focus {
    outline: calc(var(--of-bevel-width) * 2) solid var(--of-color-focus);
    outline-offset: var(--of-space-tighter);
  }

  .submit {
    flex: 0 0 auto;
    padding-block: var(--of-space-tighter);
    padding-inline: var(--of-space-base);
    border-block-start: var(--of-bevel-width) solid var(--of-bevel-light);
    border-block-end: var(--of-bevel-width) solid var(--of-bevel-dark);
    border-inline: var(--of-bevel-width) solid var(--of-color-rule);
    border-radius: var(--of-bevel-radius);
    background: var(--of-color-surface-raised);
    color: var(--of-color-ink);
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    font-weight: var(--of-type-weight-medium);
    letter-spacing: var(--of-type-tracking-mono);
    text-transform: uppercase;
    cursor: pointer;
  }

  .submit:hover {
    border-inline-color: var(--of-color-rule-strong);
    color: var(--of-color-accent-hover);
  }

  .submit:focus-visible {
    outline: calc(var(--of-bevel-width) * 2) solid var(--of-color-focus);
    outline-offset: var(--of-bevel-width);
  }

  .submit:active {
    background: var(--of-color-sunken);
    border-block-start-color: var(--of-bevel-dark);
    border-block-end-color: var(--of-bevel-light);
  }

  .hint {
    margin-block: var(--of-space-tight) 0;
    color: var(--of-color-ink-muted);
    font-size: var(--of-type-size-small);
  }

  /*
    `:global()`, and it is not laziness. The hint is authored as a SNIPPET in
    the caller, so its markup carries the caller's scope hash rather than this
    component's — a plain `.hint kbd` compiled to nothing, svelte-check reported
    `css_unused_selector`, and both search hints silently lost their `<kbd>`
    styling when this file was extracted. Scoping to `.hint` keeps the reach
    narrow: it styles keys inside this component's own hint and nowhere else.
  */
  .hint :global(kbd) {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-small);
    letter-spacing: var(--of-type-tracking-mono);
    color: var(--of-color-ink-muted);
  }

  /*
    The announcement is for assistive technology; the same words are printed
    visibly in `.count` beside the results, so this one is off-screen rather
    than duplicated on the page. Sized from `space.hair` rather than collapsed
    to zero: a zero-area element is skipped by some screen readers.
  */
</style>
