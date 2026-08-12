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
   * 1. **Every view is a URL.** `/search?q=banned:cc` is a real address that
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
   * COMPOSED, NOT RESTYLED. The field, the jewel on every row, the plate and the
   * rule under it are all `optfall-components` primitives. This file used to
   * carry its own copy of the search form and its styles, alongside a note that
   * they were being kept byte-identical against the day somebody extracted them;
   * `SearchField` is that extraction, and the styles were lifted verbatim rather
   * than rewritten so the reasoning attached to each rule came with it. What is
   * left here is the rhythm of a result row and the grid — `ResultRow` and
   * `ResultGrid` are the primitives this file now records as missing.
   *
   * A NOTE FOR THE NEXT PERSON EDITING THIS COMMENT: do not write the literal
   * opening style tag anywhere in this script, in prose or in backticks. Astro's
   * Svelte tooling locates the style block by scanning for that tag rather than
   * by parsing, so a mention of it inside a comment makes it treat the rest of
   * the file as CSS — and `astro check` then reports the component as
   * unparseable from the pages that import it, with no indication that a comment
   * is the cause.
   */
  import {
    BevelledPlate,
    CardFace,
    OrnamentalRule,
    PitchJewel,
    SearchField,
  } from "optfall-components/svelte";

  import { boxFor, faceUrl, placeholderUrl } from "../lib/faces";

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

  /**
   * TWO PIECES OF STATE, AND THE SPLIT IS THE WHOLE INTERACTION MODEL.
   *
   * `query` is what is in the box. `submitted` is what has been asked. Results
   * derive from `submitted`, so nothing re-ranks while somebody is still
   * typing — `docs/SCRYFALL-GAP.md` §5.2, which settled that search here is
   * submit-driven rather than live, for reasons beyond imitating Scryfall:
   *
   * - A grid of card faces reflowing under the cursor on every keystroke is
   *   noise, and it makes the image layer fight the search layer for bandwidth.
   * - The URL is the product, and a submit is the moment a query becomes a link
   *   worth pasting. Live filtering blurs the point at which that happens.
   * - It deletes the debounce, the race handling and the partial-query ranking
   *   path outright, rather than tuning them.
   * - The no-JS path stops being a special case: the form is a real GET to this
   *   same address, so the difference between scripting on and off narrows to
   *   who renders the list rather than whether the page works.
   */
  let query = $state(queryFromUrl());
  let submitted = $state(queryFromUrl());
  let field = $state<HTMLInputElement | null>(null);

  const outcome = $derived(searchCards(cards, submitted));
  const asked = $derived(submitted.trim() !== "");
  const truncated = $derived(outcome.total > outcome.results.length);

  /**
   * How results are shown. In the URL like everything else, so a pasted link
   * carries the view its sender was looking at.
   *
   * The grid is the default because the face is the fastest way to recognise a
   * card. The list is the dense row this component already had — it is not
   * thrown away, it is a mode, and it stays better than Scryfall's checklist
   * because it carries the stat line and the reason the row matched.
   */
  function displayFromUrl(): "grid" | "list" {
    if (typeof window === "undefined") return "grid";
    return new URLSearchParams(window.location.search).get("display") === "list"
      ? "list"
      : "grid";
  }

  let display = $state(displayFromUrl());

  /** Wording for the live region and the count line. Written, never generated. */
  function summarise(): string {
    if (!asked) return "";
    if (outcome.total === 0) return `Nothing matches ${submitted.trim()}.`;
    const found = `${outcome.total} card${outcome.total === 1 ? "" : "s"}`;
    const shown = truncated ? `, showing the first ${CARD_RESULT_LIMIT}` : "";
    return `${found} match${outcome.total === 1 ? "es" : ""}${shown}.`;
  }

  const summary = $derived(summarise());

  /**
   * The live region can speak immediately now, and that is a direct dividend of
   * the submit-driven model above.
   *
   * This used to debounce by 600ms, because results changed on every keystroke
   * and announcing each one would make a screen reader unusable — every
   * interruption cancels the last. Results now change only when somebody asks,
   * so there is exactly one announcement per query and nothing to settle. The
   * timer is gone rather than tuned.
   */
  const announcement = $derived(summary);

  /**
   * `written` is what the URL should say, and it is NOT always the box.
   *
   * A submit writes what was just asked; switching Grid/List writes what is
   * *currently answered*. Both were writing `query`, so typing a new query
   * without submitting and then toggling the view pushed a URL carrying the
   * un-submitted text while the screen showed results for the old one —
   * reloading or sharing that link then showed something different from what
   * was on screen.
   */
  function syncUrl(mode: "replace" | "push", written: string = submitted): void {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const trimmed = written.trim();
    if (trimmed === "") url.searchParams.delete("q");
    else url.searchParams.set("q", written);
    // Only when it is not the default: a URL should carry what somebody chose,
    // not restate what they did not.
    if (display === "grid") url.searchParams.delete("display");
    else url.searchParams.set("display", display);
    const target = `${url.pathname}${url.search}`;
    if (target === `${window.location.pathname}${window.location.search}`) return;
    if (mode === "push") window.history.pushState({}, "", target);
    else window.history.replaceState({}, "", target);
  }

  /** Back and forward have to work, which means listening for them. */
  $effect(() => {
    const onPop = () => {
      query = queryFromUrl();
      submitted = query;
      display = displayFromUrl();
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
    submitted = query;
    syncUrl("push", query);
    field?.blur();

    /*
      ONE RESULT IS NOT A RESULT SET, IT IS THE ANSWER — the same behaviour
      Scryfall has, and for the same reason: a page whose entire content is a
      single row asking to be clicked has made the reader press twice for one
      destination.

      Deliberately only on SUBMIT. Arriving at a pasted `/search?q=…` link does
      NOT redirect, because the sender chose to share a search and silently
      turning it into a card page would rewrite what they sent. And the URL is
      pushed first, so the back button returns to the results rather than to
      whatever came before them.
    */
    const only = outcome.total === 1 ? outcome.results[0] : undefined;
    if (only) window.location.assign(only.href);
  }

  /** Switching view is a navigation too, so it lands in the URL. */
  function show(next: "grid" | "list"): void {
    display = next;
    syncUrl("push");
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
</script>

<SearchField
  label="Search the cards"
  region="Flesh and Blood cards"
  action="/search"
  placeholder="command and conquer"
  bind:value={query}
  bind:element={field}
  onsubmit={onSubmit}
  onkeydown={onKeydown}
>
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
  {#snippet hint()}
    <code>pitch:3 class:guardian</code> is Card Vault's own syntax · <code>banned:cc</code> and <code>legal:blitz</code> are ours · <code>text:dominate</code> searches printed text · <kbd>/</kbd> returns here. Legality here is today's; <code>legal:cc@2026-03-14</code> is not answerable yet and says so rather than guessing.
  {/snippet}
</SearchField>

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
    <div class="result-head">
      <p class="count">{summary}</p>

      <!--
        Two views of the same answer. A radio group rather than a pair of
        buttons, because that is what "pick exactly one" is, and it gets arrow
        keys and a group name for free.
      -->
      <fieldset class="views">
        <legend class="views-legend">Show results as</legend>
        {#each [["grid", "Grid"], ["list", "List"]] as const as [mode, label] (mode)}
          <label class="view">
            <input
              type="radio"
              name="display"
              value={mode}
              checked={display === mode}
              onchange={() => show(mode)}
            />
            <span>{label}</span>
          </label>
        {/each}
      </fieldset>
    </div>

    {#if display === "grid"}
      <!--
        The face is the row. `docs/SCRYFALL-GAP.md`: results are images by
        default, because recognising a card by its face is faster than reading
        its name — which is the single largest difference between this and every
        text-list card tool in the game.

        `CardFace` carries the copyright line on every one of these, and that is
        not negotiable: COMPLIANCE.md §5 forbids a variant that drops it.
      -->
      <ul class="grid">
        {#each outcome.results as result (result.href)}
          {@const box = boxFor("thumb", result.faceLandscape ? "landscape" : "portrait")}
          <li class="cell">
            <a class="cell-link" href={result.href}>
              <CardFace
                src={result.faceKey === null
                  ? placeholderUrl(result.faceLandscape ? "landscape" : "portrait")
                  : faceUrl(result.faceKey, "thumb")}
                alt={`${result.label} — ${result.typeLine}`}
                width={box.width}
                height={box.height}
              />
              <span class="cell-name">{result.label}</span>
              {#if result.matchedPitches.length < result.totalVersions}
                <!--
                  ONLY SOME PITCH VERSIONS MATCHED, AND SAYING SO IS NOT
                  OPTIONAL. Four names in this corpus carry versions whose
                  Classic Constructed ban differs — Electromagnetic Somersault
                  red and yellow are banned, blue is legal. A `banned:cc` row
                  that named the card and stopped would be putting a card on a
                  banned list without saying which version was banned, which is
                  the "collapses two true facts into one" failure the verdict
                  model exists to prevent.
                -->
                <span class="cell-versions">
                  {result.matchedPitches
                    .map((pitch) => (pitch === 0 ? "no pitch" : `pitch ${pitch}`))
                    .join(", ")}
                </span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {:else}
    <ol class="results">
      {#each outcome.results as result (result.href)}
        <ResultRow href={result.href} label={result.label}>
          {#snippet lead()}
            <PitchJewel value={result.pitch} size="sm" />
          {/snippet}
          {#snippet meta()}
            <!--
              `result.label` above, never the bare name: 900 names in this
              corpus belong to two to four different cards, and a list of
              anchors reading "Head Jab" three times against three destinations
              is a WCAG 2.4.4 failure as well as being useless. `ResultRow`
              takes the label as a STRING rather than a snippet for exactly
              that reason — the accessible name has to be composed on purpose.
            -->
            <span>{result.typeLine}</span>
            {#each result.stats as [label, value] (label)}
              <span>{label} {value}</span>
            {/each}
            {#if result.matchedPitches.length < result.totalVersions}
              <span>
                {result.matchedPitches
                  .map((pitch) => (pitch === 0 ? "no pitch" : `pitch ${pitch}`))
                  .join(", ")}
              </span>
            {/if}
            <span class="why">{WHY[result.matchedIn]}</span>
          {/snippet}
        </ResultRow>
      {/each}
    </ol>
    {/if}
    {#if truncated}
      <p class="count">
        {outcome.total - outcome.results.length} more match. Narrow the query — every
        word you add has to appear on the card.
      </p>
    {/if}
  {:else}
    <p class="count">
      Nothing in the {cards.size.toLocaleString("en-GB")} cards matches every part of
      <strong>{submitted.trim()}</strong>. Words match whole words and the start of words,
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
        <a class="browse-link" href={`/search?q=${encodeURIComponent(`type:"${line}"`)}`}>
          {line}
        </a>
        <span class="browse-count">{count}</span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* -- Result head: the count, and the view switch ------------------------- */

  .result-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--of-space-base);
  }

  .views {
    display: flex;
    align-items: center;
    gap: var(--of-space-base);
    margin: 0;
    padding: 0;
    border: 0;
  }

  /* The group needs a name for assistive technology and no name on screen —
     the two labels beside it already say what it does. */
  .views-legend {
    position: absolute;
    inline-size: var(--of-space-hair);
    block-size: var(--of-space-hair);
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .view {
    display: inline-flex;
    align-items: center;
    gap: var(--of-space-tight);
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-wide);
    text-transform: uppercase;
    color: var(--of-color-ink-muted);
    cursor: pointer;
  }

  .view:has(input:checked) {
    color: var(--of-color-ink);
  }

  /* -- The grid ------------------------------------------------------------ */

  /*
    Sized from the thumb tier so a cell is the width of the face it holds, and
    the track count follows the viewport rather than being chosen. `auto-fill`
    rather than `auto-fit` so a single result stays card-sized instead of
    stretching across the row.
  */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--of-card-face-thumb), 1fr));
    gap: var(--of-space-loose);
    margin-block-start: var(--of-space-loose);
    padding: 0;
    list-style: none;
  }

  .cell-link {
    display: flex;
    flex-direction: column;
    gap: var(--of-space-tight);
    text-decoration: none;
    color: inherit;
  }

  /*
    The name is the accessible name of the link along with the face's alt text,
    and it is visible because recognising art is not the same as being sure —
    900 names in this corpus belong to more than one card, and the variant
    suffix is what tells two identical-looking faces apart.
  */
  .cell-name {
    font-family: var(--of-type-family-serif);
    font-size: var(--of-type-size-small);
    line-height: var(--of-type-leading-tight);
    color: var(--of-color-ink);
  }

  .cell-versions {
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-wide);
    text-transform: uppercase;
    color: var(--of-color-ink-muted);
  }

  .cell-link:hover .cell-name,
  .cell-link:focus-visible .cell-name {
    color: var(--of-color-accent);
  }

  /*
    THE PRIMITIVES THIS PAGE FOUND MISSING, exactly as `RulesSearch.svelte`
    records: a text field and a dense list row. Both are real gaps rather than
    one-off decoration, so they belong in `optfall-components` as `SearchField`
    and `ResultRow`. Kept identical to the rules search on purpose — every value
    names a token, so moving them costs a cut and a paste.
  */





  /*
    Never `outline: none`, and `:focus` rather than `:focus-visible` alone — a
    text field focused with a mouse is still a text field you are about to type
    into, and hiding that from the one input on the page would be hiding the
    state that matters most.
  */







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



  /* Serif — the voice assigned to names. */



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
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-small);
    letter-spacing: var(--of-type-tracking-wide);
  }

  .browse-count {
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-wide);
    color: var(--of-color-ink-faint);
  }
</style>
