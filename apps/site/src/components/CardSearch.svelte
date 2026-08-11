<script lang="ts">
  /**
   * The card search field, and the results under it — the surface `docs/PLAN.md`
   * Phase 2 calls the product.
   *
   * `docs/DESIGN.md`: "The search field is the hero. No marketing hero, no
   * illustration above the fold. The first thing on the page is the thing you
   * came to do." This is `RulesSearch.svelte`'s sibling and follows it
   * deliberately and closely — same URL contract, same degradation story, same
   * live-region timing, same row idiom — because two search fields on one site
   * that behave differently are two things to learn.
   *
   * FOUR THINGS IT HAS TO GET RIGHT.
   *
   * 1. **Every view is a URL.** `/cards?q=banned:cc` is a real address that
   *    renders those results: the query is read from the URL on load, written
   *    back as you type (`replaceState`, so the back button is not filled with
   *    keystrokes) and pushed on submit.
   * 2. **The form degrades to a static browse; live results need JavaScript.**
   *    The form is a real `GET` to `/cards`, so a browser with no islands
   *    running still produces a shareable URL and still reaches every
   *    `/card/<slug>` page. What it cannot do is answer the query — the ranking
   *    runs here, and a static build has no server. The page says so in a
   *    `NoScriptNotice` above the field rather than letting a submitted query
   *    vanish in silence.
   * 3. **Nothing here composes prose.** Every string a reader sees is either a
   *    verbatim card value, an identifier, or interface wording written by a
   *    person and checked in. `docs/PLAN.md`: no language model in the shipped
   *    product.
   * 4. **NO LEGALITY VERDICT APPEARS ON A ROW.** A pill reading "Banned" needs a
   *    format attached to mean anything, and a row has six of them. The verdict
   *    is per-format, dated and evidenced, and it lives on the card page — which
   *    is the page the reader is choosing between anyway. `legal:cc` and
   *    `banned:cc` filter *by* it, so the question is answerable without the
   *    surface making an unqualified claim.
   *
   * COMPOSED, NOT RESTYLED. The jewel on every row, the well the field sits in
   * and the rule under it are `optfall-components` primitives. What is left in
   * this file's style block is the search field itself and the rhythm of a
   * result row — the two primitives `RulesSearch.svelte` records the library as
   * missing (`SearchField` and `ResultRow`), kept byte-identical here on purpose
   * so the eventual extraction is a cut and a paste rather than a redesign.
   *
   * A NOTE FOR THE NEXT PERSON EDITING THIS COMMENT: do not write the literal
   * opening style tag anywhere in this script, in prose or in backticks. Astro's
   * Svelte tooling locates the style block by scanning for that tag rather than
   * by parsing, so a mention of it inside a comment makes it treat the rest of
   * the file as CSS — and `astro check` then reports the component as
   * unparseable from the pages that import it, with no indication that a comment
   * is the cause.
   */
  import { BevelledPlate, OrnamentalRule, PitchJewel } from "optfall-components/svelte";

  import {
    CARD_RESULT_LIMIT,
    decodeCardIndex,
    searchCards,
    type CardMatchField,
    type EncodedCardIndex,
  } from "../lib/card-search";

  interface Props {
    /** Built at build time by `buildCardIndex`; see `card-search.ts`. */
    index: EncodedCardIndex;
    /** Spend the screen's one filigree on this component's section rule. */
    ornament?: boolean;
  }

  const { index, ornament = false }: Props = $props();

  /**
   * Decoded once — `$derived`, not `$state` and not a bare call. Same reasoning
   * as `RulesSearch.svelte`: the index is immutable data, so making it reactive
   * would put a hundred thousand strings through a proxy for nothing, and
   * reading a prop during initialisation captures its value at that instant.
   */
  const cards = $derived(decodeCardIndex(index));

  function queryFromUrl(): string {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  }

  let query = $state(queryFromUrl());
  let field = $state<HTMLInputElement | null>(null);

  const outcome = $derived(searchCards(cards, query));
  const asked = $derived(query.trim() !== "");
  const truncated = $derived(outcome.total > outcome.results.length);

  /** Wording for the live region and the count line. Written, never generated. */
  function summarise(): string {
    if (!asked) return "";
    if (outcome.total === 0) return `Nothing matches ${query.trim()}.`;
    const found = `${outcome.total} card${outcome.total === 1 ? "" : "s"}`;
    const shown = truncated ? `, showing the first ${CARD_RESULT_LIMIT}` : "";
    return `${found} match${outcome.total === 1 ? "es" : ""}${shown}.`;
  }

  const summary = $derived(summarise());

  /**
   * The live region settles before it speaks. Results update on every keystroke
   * because that is what makes the field feel like a tool; announcing on every
   * keystroke would make a screen reader unusable, since each interruption
   * cancels the last.
   */
  const SETTLE = 600;
  let announcement = $state(summarise());

  $effect(() => {
    const next = summary;
    const timer = setTimeout(() => {
      announcement = next;
    }, SETTLE);
    return () => clearTimeout(timer);
  });

  function syncUrl(mode: "replace" | "push"): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const trimmed = query.trim();
    if (trimmed === "") url.searchParams.delete("q");
    else url.searchParams.set("q", query);
    const target = `${url.pathname}${url.search}`;
    if (target === `${window.location.pathname}${window.location.search}`) return;
    if (mode === "push") window.history.pushState({}, "", target);
    else window.history.replaceState({}, "", target);
  }

  $effect(() => {
    const typed = query;
    const timer = setTimeout(() => {
      if (typed === query) syncUrl("replace");
    }, SETTLE);
    return () => clearTimeout(timer);
  });

  /** Back and forward have to work, which means listening for them. */
  $effect(() => {
    const onPop = () => {
      query = queryFromUrl();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  /**
   * `/` focuses the field, the way every reference tool worth using does.
   * Ignored while the caret is already in a control, so it can never eat a
   * character somebody meant to type.
   */
  $effect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;
      event.preventDefault();
      field?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    syncUrl("push");
    field?.blur();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && query !== "") {
      event.preventDefault();
      query = "";
    }
  }

  /** Why a row is on the page, in the words of the ranking that put it there. */
  const WHY: Record<CardMatchField, string> = {
    "name-exact": "exact name",
    "name-prefix": "name starts with",
    name: "name",
    type: "type line",
    keyword: "keyword",
    text: "card text",
    filter: "filter",
  };

  const uid = $props.id();
  const fieldId = `${uid}-query`;
  const hintId = `${uid}-hint`;
</script>

<form
  class="search"
  role="search"
  aria-label="Flesh and Blood cards"
  action="/cards"
  method="get"
  onsubmit={onSubmit}
>
  <label class="label" for={fieldId}>Search the cards</label>

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
        placeholder="command and conquer"
        aria-describedby={hintId}
        bind:value={query}
        bind:this={field}
        onkeydown={onKeydown}
      />
      <button class="submit" type="submit">Search</button>
    </div>
  </BevelledPlate>

  <!--
    THE PAGE'S ONE HINT LINE. `docs/DESIGN.md` Screen 1: it pairs an operator
    people already know from Card Vault with ours, so the extension is
    discovered where fluency already exists. The inherited half is stated first
    and the limits are attached rather than left to be found by typing — a hint
    advertising something the build cannot answer is the lie "degrade visibly"
    prohibits.

    Inline elements stay on the same source line as the text around them: the
    build compresses this HTML and drops the whitespace at a line break falling
    immediately before an inline tag, welding words together in the output.
  -->
  <p class="hint" id={hintId}>
    <code>pitch:3 class:guardian</code> is Card Vault's own syntax · <code>banned:cc</code> and <code>legal:blitz</code> are ours · <code>text:dominate</code> searches printed text · <kbd>/</kbd> returns here. Legality here is today's; <code>legal:cc@2026-03-14</code> is not answerable yet and says so rather than guessing.
  </p>
</form>

<!-- Always present, never emptied: a live region added to the page at the
     moment it has something to say is a live region that says nothing. -->
<p class="announcement" role="status" aria-live="polite">{announcement}</p>

{#if outcome.notices.length > 0}
  <ul class="notices">
    {#each outcome.notices as notice (notice.kind + notice.text)}
      <!-- The wording is the engine's, not this component's: a notice is a
           statement about what the query engine did, and a surface free to
           rephrase it is a surface free to describe behaviour it does not
           have. See `CardNotice` in `card-search.ts`. -->
      <li class="notice">{notice.text}</li>
    {/each}
  </ul>
{/if}

<OrnamentalRule {ornament} label={asked ? "Results" : "Browse"} />

{#if asked}
  {#if outcome.results.length > 0}
    <p class="count">{summary}</p>
    <ol class="results">
      {#each outcome.results as result (result.href)}
        <li class="result">
          <PitchJewel value={result.pitch} size="sm" />
          <div class="body">
            <p class="line">
              <!-- `result.label`, never the bare name: 900 names in this corpus
                   belong to two to four different cards, and a list of anchors
                   reading "Head Jab" three times against three destinations is
                   a WCAG 2.4.4 failure as well as being useless. The label
                   carries the variant suffix and is composed once, in
                   `cards.ts`. -->
              <a class="name" href={result.href}>{result.label}</a>
            </p>
            <p class="meta">
              <span class="type">{result.typeLine}</span>
              {#each result.stats as [label, value] (label)}
                <span class="stat">{label} {value}</span>
              {/each}
              <span class="why">{WHY[result.matchedIn]}</span>
            </p>
          </div>
        </li>
      {/each}
    </ol>
    {#if truncated}
      <p class="count">
        {outcome.total - outcome.results.length} more match. Narrow the query — every
        word you add has to appear on the card.
      </p>
    {/if}
  {:else}
    <p class="count">
      Nothing in the {cards.size.toLocaleString("en-GB")} cards matches every part of
      <strong>{query.trim()}</strong>. Words match whole words and the start of words,
      so <code>domin</code> finds <code>dominate</code> — but every word you type has
      to appear in the name, the type line, a keyword or the printed text.
    </p>
  {/if}
{:else}
  <p class="count">
    {cards.size.toLocaleString("en-GB")} cards, pinned to upstream commit
    <code>{cards.commit.slice(0, 7)}</code> and last confirmed {cards.confirmed}. Start
    with a type, or type above.
  </p>
  <!--
    The empty state is a browse, not a blank rectangle — and it is derived from
    the corpus rather than curated, so it cannot go stale and cannot express an
    opinion about which types matter. The count beside each is the real number
    of cards carrying that printed type line.
  -->
  <ul class="browse">
    {#each cards.browse as [line, count] (line)}
      <li>
        <a class="browse-link" href={`/cards?q=${encodeURIComponent(`type:"${line}"`)}`}>
          {line}
        </a>
        <span class="browse-count">{count}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  /*
    THE PRIMITIVES THIS PAGE FOUND MISSING, exactly as `RulesSearch.svelte`
    records: a text field and a dense list row. Both are real gaps rather than
    one-off decoration, so they belong in `optfall-components` as `SearchField`
    and `ResultRow`. Kept identical to the rules search on purpose — every value
    names a token, so moving them costs a cut and a paste.
  */

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

  .hint kbd {
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
  .announcement {
    position: absolute;
    inline-size: var(--of-space-hair);
    block-size: var(--of-space-hair);
    margin: calc(var(--of-space-hair) * -1);
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .notices {
    margin-block: var(--of-space-base) 0;
    padding-inline-start: 0;
    list-style: none;
  }

  .notice {
    padding-block: var(--of-space-tightest);
    border-inline-start: calc(var(--of-bevel-width) * 2) solid var(--of-color-accent);
    padding-inline-start: var(--of-space-tight);
    color: var(--of-color-ink-muted);
    font-size: var(--of-type-size-small);
  }

  .count {
    margin-block: 0 var(--of-space-base);
    color: var(--of-color-ink-muted);
    font-size: var(--of-type-size-small);
  }

  .results {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /*
    Density without clutter: rows are separated by one hairline and nothing else
    — no card, no shadow, no padding a reader has to look past. The row wraps
    intrinsically rather than at a breakpoint, since the theme publishes no
    breakpoint tokens and a raw one is not available to write.
  */
  .result {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--of-space-tight);
    padding-block: var(--of-space-base);
    border-block-start: var(--of-ornament-rule-width) solid var(--of-color-rule);
  }

  .body {
    flex: 1 1 60%;
    min-inline-size: 0;
  }

  .line {
    margin: 0;
  }

  /* Serif — the voice assigned to names. */
  .name {
    font-family: var(--of-type-family-serif);
    font-size: var(--of-type-size-large);
    letter-spacing: var(--of-type-tracking-tight);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--of-space-tight);
    margin-block: var(--of-space-tightest) 0;
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-mono);
    text-transform: uppercase;
    color: var(--of-color-ink-faint);
  }

  .type,
  .stat {
    color: var(--of-color-ink-muted);
  }

  .browse {
    display: grid;
    gap: var(--of-space-tight);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .browse li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--of-space-base);
    padding-block: var(--of-space-tight);
    border-block-start: var(--of-ornament-rule-width) solid var(--of-color-rule);
  }

  .browse-link {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-small);
    letter-spacing: var(--of-type-tracking-mono);
  }

  .browse-count {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-mono);
    color: var(--of-color-ink-faint);
  }
</style>
