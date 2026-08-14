<script lang="ts">
/**
 * The front door's field: type a name, go somewhere.
 *
 * THIS IS A DOOR, NOT A ROOM. `docs/SCRYFALL-GAP.md` §5.2 settled that search
 * here is submit-driven and that nothing re-ranks a corpus while somebody
 * types. A typeahead is the one affordance that survives that rule, and it
 * survives it for a specific reason: every suggestion is a *destination*
 * rather than a result. Picking one navigates to that card; submitting goes
 * to the results page. Nothing is rendered in place, so there is no view to
 * keep in sync, no debounce, and no state that evaporates when the tab
 * closes.
 *
 * IT SHIPS NAMES, NOT AN INDEX. The home page used to mount the full card
 * search — an inverted index over every card's printed text, plus keyword
 * memberships and per-format verdict vectors, about 470 KB — in order to
 * render twenty-four browse links. This mounts `lib/typeahead.ts`'s index,
 * which is names, slugs and pitches.
 *
 * A COMBOBOX, BUILT TO THE PATTERN RATHER THAN APPROXIMATED. The input owns
 * `role="combobox"`, `aria-expanded`, `aria-controls` and
 * `aria-activedescendant`; the list is a `listbox` of `option`s. Arrow keys
 * move the active option without moving the caret, Enter takes it, Escape
 * closes the list and leaves what you typed. A div that merely looks like this
 * is unusable with a screen reader, and this is the first control on the site.
 *
 * THE SUGGESTIONS ARE LINKS, so the whole thing works with scripting off in
 * the only way that matters — the form submits to the results page, and every
 * card remains reachable from there.
 */
import { PitchJewel, SearchField } from "optfall-components/svelte";

import {
  decodeNameIndex,
  suggest,
  type EncodedNameIndex,
} from "../lib/typeahead";

interface Props {
  index: EncodedNameIndex;
  /** Where submitting goes. The results page. */
  action: string;
}

const { index, action }: Props = $props();

const names = $derived(decodeNameIndex(index));

let query = $state("");
let field = $state<HTMLInputElement | null>(null);
/** -1 means "nothing active"; Enter then submits rather than navigating. */
let active = $state(-1);
let dismissed = $state(false);

const suggestions = $derived(dismissed ? [] : suggest(names, query));
const open = $derived(suggestions.length > 0);

const uid = $props.id();
const listId = `${uid}-suggestions`;
const optionId = (i: number) => `${uid}-option-${i}`;

function go(href: string): void {
  window.location.href = href;
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    // Closes the list and keeps the text. Clearing the field on Escape would
    // throw away what somebody typed to dismiss a popup they did not ask for.
    if (open) {
      event.preventDefault();
      dismissed = true;
      active = -1;
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
    active =
      active === -1
        ? step === 1
          ? 0
          : count - 1
        : (active + step + count) % count;
    return;
  }

  if (event.key === "Enter" && active !== -1) {
    const chosen = suggestions[active];
    if (chosen) {
      event.preventDefault();
      go(chosen.href);
    }
  }
}

function onInput(): void {
  // Typing reopens a list that Escape closed, and invalidates the selection —
  // otherwise Enter would navigate to a card the query no longer matches.
  dismissed = false;
  active = -1;
}
</script>

<!--
  Top level, because `<svelte:window>` cannot live inside an element — and it is
  here rather than inside `SearchField` because that primitive owns a form and
  nothing else. A primitive that also bound a global key would be deciding for
  every caller that its field is THE field on the page.
-->
<svelte:window
  onkeydown={(event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if (target?.isContentEditable) return;
    event.preventDefault();
    field?.focus();
  }}
/>

<div class="typeahead">
  <SearchField
    label="Search the cards"
    region="Flesh and Blood cards"
    {action}
    placeholder="command and conquer"
    bind:value={query}
    bind:element={field}
    onkeydown={onKeydown}
    listboxId={listId}
    expanded={open}
    activeDescendant={active === -1 ? undefined : optionId(active)}
  >
    {#snippet hint()}
      <code>pitch:3 class:guardian</code> · <code>banned:cc</code> — <a href="/syntax">all operators</a>
    {/snippet}
  </SearchField>


  {#if open}
    <ul class="suggestions" id={listId} role="listbox" aria-label="Card names">
      {#each suggestions as suggestion, position (suggestion.href)}
        <li
          id={optionId(position)}
          role="option"
          aria-selected={position === active}
          class:active={position === active}
        >
          <a class="suggestion" href={suggestion.href} tabindex="-1">
            <span class="jewels">
              {#each suggestion.pitches as pitch (pitch)}
                <PitchJewel value={pitch} size="sm" />
              {/each}
            </span>
            <span class="name">{suggestion.name}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .typeahead {
    position: relative;
  }

  /*
    In flow rather than absolutely positioned. A floating popup over a page this
    sparse would be solving a problem the page does not have — there is nothing
    below the field to obscure — and it would need collision handling, a scroll
    listener and a resize listener to stay honest.
  */
  .suggestions {
    margin-block-start: var(--of-space-tight);
    padding: 0;
    list-style: none;
    border-block-start: var(--of-ornament-rule-width) solid var(--of-color-rule);
  }

  .suggestion {
    display: flex;
    align-items: center;
    gap: var(--of-space-base);
    padding-block: var(--of-space-tight);
    text-decoration: none;
    color: var(--of-color-ink);
  }

  .jewels {
    display: inline-flex;
    gap: var(--of-space-tightest);
    flex: 0 0 auto;
  }

  .name {
    font-family: var(--of-type-family-serif);
    font-size: var(--of-type-size-large);
    line-height: var(--of-type-leading-tight);
  }

  /*
    The active option is marked by ink and an accent edge rather than a fill:
    the row already carries pitch jewels, and a coloured background behind them
    would put two colour systems in one strip.
  */
  li.active .suggestion,
  .suggestion:hover {
    color: var(--of-color-accent);
  }

  li.active {
    box-shadow: inset var(--of-bevel-width) 0 0 0 var(--of-color-accent);
  }

  li.active .suggestion {
    padding-inline-start: var(--of-space-tight);
  }
</style>
