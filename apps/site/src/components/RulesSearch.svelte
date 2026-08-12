<script lang="ts">
  /**
   * The search field, and the results under it — the first real user surface.
   *
   * `docs/DESIGN.md`: "The search field is the hero. No marketing hero, no
   * illustration above the fold. The first thing on the page is the thing you
   * came to do." So this component is the first thing on `/search`, it is
   * focused and usable before anything else renders, and it carries no chrome
   * that is not doing work.
   *
   * THREE THINGS IT HAS TO GET RIGHT.
   *
   * 1. **Every view is a URL.** `/search?q=dominate` is a real address that
   *    renders those results: the query is read from the URL on load, and it is
   *    written back as you type (`replaceState`, so the back button is not
   *    filled with keystrokes) and pushed on submit. A search box whose results
   *    cannot be linked breaks the thing this project is for — `docs/PLAN.md`
   *    Phase 4: "the permalink is the product".
   * 2. **The form degrades to a static browse; live results need JavaScript.**
   *    The form is a real `GET` to `/search`, so a browser with no islands
   *    running still produces a shareable URL and still reaches the chapter
   *    list and every `/cr/<number>` page under it. What it cannot do is answer
   *    the query: the ranking runs here, and a static build has no server to
   *    render `?q=` into results. That is a real limit, not a hedge, so the
   *    pages that mount this component say so in a `NoScriptNotice` above the
   *    field rather than letting a submitted query vanish in silence. Do not
   *    restore the older, larger claim ("it works without JavaScript") without
   *    first making it true.
   * 3. **Nothing here composes prose.** Every string a user reads is either
   *    verbatim corpus text, an identifier, or interface wording written by a
   *    person and checked in. `docs/PLAN.md`, "Rules that hold across every
   *    phase": no language model in the shipped product.
   *
   * COMPOSED, NOT RESTYLED. The citation on every row and the well the field
   * sits in are `optfall-components` primitives, used for exactly what they
   * were built for. What is left in this file's style block is the search field
   * itself and the rhythm of a result row — see the note above `.field`, which
   * records the primitive the library turns out to be missing.
   *
   * A NOTE FOR THE NEXT PERSON EDITING THIS COMMENT: do not write the literal
   * opening style tag anywhere in this script, in prose or in backticks. Astro's
   * Svelte language tooling locates the style block by scanning for that tag
   * rather than by parsing, so a mention of it inside a comment makes it treat
   * the entire rest of the file as CSS — and `astro check` then reports the
   * component as unparseable from the *pages that import it*, with no
   * indication that a comment is the cause. Cost an hour to find; costs one
   * sentence to prevent. The Svelte compiler itself is untroubled by it, so the
   * build stays green while the typecheck gate goes red.
   */
  import { BevelledPlate, Citation, OrnamentalRule,
    SearchField,
  } from "optfall-components/svelte";

  import {
    chapters,
    decodeIndex,
    search,
    RESULT_LIMIT,
    type EncodedIndex,
    type SearchResult,
  } from "../lib/search";

  interface Props {
    /** Built at build time by `buildIndex`; see `search.ts` for the format. */
    index: EncodedIndex;
    /**
     * Spend the screen's one filigree on this component's section rule.
     *
     * It is a prop rather than a page's own `<OrnamentalRule ornament />`
     * because of where the ornament has to land. `docs/DESIGN.md` Screen 1 is
     * "one search field, one hint line, one daily object", and the ornament is
     * what marks the end of that fold — so it belongs between the hint and the
     * chapter browse. Both of those are rendered *here*, which means a page
     * placing its own ornamented rule can only put it after the browse, ten
     * rows below the fold it was meant to terminate. That is exactly the bug
     * this prop fixes.
     *
     * Defaults to `false` because filigree is rationed: at most one per screen,
     * never on a control, never on a list. `/search` leaves it off — that page
     * opens with a heading, so its fold is already terminated by structure and
     * a second ornament in the product would be one too many.
     */
    ornament?: boolean;
  }

  const { index, ornament = false }: Props = $props();

  /**
   * Decoded once — `$derived`, not `$state` and not a bare call.
   *
   * Not `$state`, because the index is immutable data and making it reactive
   * would put 1,278 strings through a proxy for nothing. Not a bare call
   * either: reading a prop during initialisation captures its value at that
   * instant, which Svelte warns about precisely because it is usually a bug.
   * `$derived` is lazy and cached, so this still decodes exactly once for a
   * prop that never changes — the same cost, minus the trap.
   */
  const rules = $derived(decodeIndex(index));

  /**
   * The query, read from the URL at start-up.
   *
   * Read synchronously at initialisation rather than in an effect, so the
   * first frame the browser paints after hydration already has the results in
   * it. `window` is absent while Astro pre-renders the island, and the empty
   * string is the correct answer there: the static build has no request to
   * read a query string from.
   */
  function queryFromUrl(): string {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") ?? "";
  }

  let query = $state(queryFromUrl());
  let field = $state<HTMLInputElement | null>(null);

  const outcome = $derived(search(rules, query));
  const asked = $derived(query.trim() !== "");
  const truncated = $derived(outcome.total > outcome.results.length);

  /** Wording for the live region and the count line. Written, never generated. */
  function summarise(): string {
    if (!asked) return "";
    if (outcome.total === 0) return `Nothing matches ${query.trim()}.`;
    const sections = `${outcome.total} section${outcome.total === 1 ? "" : "s"}`;
    const shown = truncated ? `, showing the first ${RESULT_LIMIT}` : "";
    return `${sections} match${outcome.total === 1 ? "es" : ""}${shown}.`;
  }

  const summary = $derived(summarise());

  /**
   * What the live region says, deliberately behind the results.
   *
   * The results update on every keystroke because that is what makes the field
   * feel like a tool; announcing on every keystroke would make a screen reader
   * unusable, since each interruption cancels the last. So the region settles
   * for {@link SETTLE} after typing stops and announces once. Same information,
   * at the speed a listener can actually take it.
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

  /**
   * Keep the address bar in step with the field.
   *
   * `replaceState` while typing: a query is one navigation, not one per
   * letter, and a back button that walks backwards through "domin", "domi",
   * "dom" is a back button nobody can use. Submitting is the deliberate act,
   * so that one gets a `pushState` and a real history entry.
   */
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
    // Tracked so the effect re-runs on every keystroke; debounced so the
    // browser's own rate limit on history writes is never the thing that
    // decides whether the URL is right.
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
   *
   * Ignored while the caret is already in a control, so it can never eat a
   * character somebody meant to type — including in a field on some other part
   * of the page that this component knows nothing about.
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
    // Only once hydrated. Without JavaScript this handler does not exist and
    // the form navigates to the same URL by itself.
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
  function why(result: SearchResult): string {
    switch (result.matchedIn) {
      case "id":
        return "section id";
      case "children":
        return `under ${result.matchedTerms.join(" ")}`;
      case "title":
        return "heading";
      default:
        return result.matchedTerms.join(" · ");
    }
  }

  const browse = $derived(chapters(rules));

  /**
   * Ids generated rather than written down, because `for`/`id` and
   * `aria-describedby` are the two places a copy-paste of this island onto a
   * page that already has one would silently break: duplicate ids leave the
   * label pointing at whichever field the browser found first. `$props.id()`
   * is stable across the server render and hydration, so the association
   * survives the round trip.
   */
  const uid = $props.id();
</script>

<SearchField
  label="Search the Comprehensive Rules"
  region="Comprehensive Rules"
  action="/search"
  placeholder="dominate"
  bind:value={query}
  bind:element={field}
  onsubmit={onSubmit}
  onkeydown={onKeydown}
>
  <!--
    THE PAGE'S ONE HINT LINE, AND IT LIVES HERE.

    `docs/DESIGN.md` Screen 1: "One search field, one hint line, one daily
    object. The hint pairs an operator people already know from Card Vault with
    two of ours, so the extension is discovered where fluency already exists."
    That is one hint, containing both halves — so it is written once, in the
    component that owns the field it describes and is wired to it by
    `aria-describedby`. A page that adds a second hint of its own gets two hint
    lines on one screen and orphans the teaching from the field; that is what
    the home page used to do.

    The inherited half is stated with its limit attached rather than left to be
    discovered by typing it. "Degrade visibly" is a project-wide rule, and a
    hint advertising an operator the build cannot answer is exactly the lie it
    prohibits.

    Inline elements stay on the same source line as the text around them: the
    build compresses this HTML and drops the whitespace at a line break falling
    immediately before an inline tag, welding words together in the output.
  -->
  {#snippet hint()}
    <code>dominate</code> searches the text · <code>cr:dominate</code> names the corpus · <code>8.3.4b</code> goes straight to that section · <kbd>/</kbd> returns here. This field searches the rules; Card Vault's own card operators — <code>pitch:3</code>, <code>class:guardian</code> — are inherited verbatim and answered at <a href="/cards">the card search</a>.
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
           have. See `QueryNotice` in `search.ts`. -->
      <li class="notice">{notice.text}</li>
    {/each}
  </ul>
{/if}

<!-- The break between the field and what is under it: results once something
     has been asked, the chapter browse before that. `ornament` is off unless
     the mounting page spends its one filigree here — see the prop. -->
<OrnamentalRule {ornament} label={asked ? "Results" : "Chapters"} />

{#if asked}
  {#if outcome.results.length > 0}
    <p class="count">{summary}</p>
    <ol class="results">
      {#each outcome.results as result (result.id)}
        <li class="result">
          <Citation ruleId={result.id} href={result.href} version={index.version} />
          <div class="body">
            <p class="line">
              {#if result.title}<span class="title">{result.title}</span>{/if}
              {result.lede}
            </p>
            <p class="meta">
              <span class="level">{result.level}</span>
              <span class="why">{why(result)}</span>
            </p>
          </div>
        </li>
      {/each}
    </ol>
    {#if truncated}
      <p class="count">
        {outcome.total - outcome.results.length} more match. Narrow the query — every
        word you add has to appear in the section.
      </p>
    {/if}
  {:else}
    <p class="count">
      Nothing in the Comprehensive Rules {index.version} matches every word of
      <strong>{query.trim()}</strong>. Words match whole words and the start of
      words, so <code>banis</code> finds <code>banished</code> — but every word you
      type has to appear somewhere in the section.
    </p>
  {/if}
{:else}
  <p class="count">
    {rules.size.toLocaleString("en-GB")} addressable sections, from the Comprehensive
    Rules {index.version}. Start with a chapter, or type above.
  </p>
  <ol class="results">
    {#each browse as chapter (chapter.id)}
      <li class="result">
        <Citation ruleId={chapter.id} href={chapter.href} version={index.version} />
        <div class="body">
          <p class="line"><span class="title">{chapter.title}</span></p>
        </div>
      </li>
    {/each}
  </ol>
{/if}

<style>
  /*
    ONE OF THE TWO PRIMITIVES THIS PAGE FOUND MISSING HAS LANDED. The text field
    is now `SearchField` in `optfall-components`, shared with the card search —
    and the move cost exactly what this note predicted, a cut and a paste, because
    every value already named a token and the two copies were kept identical on
    purpose.

    `ResultRow` has landed too, and the card search adopts it. This file keeps
    its own row for now: a rules result leads with a Citation and carries a
    chapter breadcrumb rather than a stat line, so moving it is a second
    adoption rather than the same cut — worth doing, and worth doing as its own
    change rather than smuggled into the one that built the primitive.
  */



  /*
    The field is bare because the well around it is the primitive: a sunken
    bevelled plate is exactly the struck-metal recess a text input wants, so
    the input draws no box of its own and contributes only the caret and the
    text. Serif, because a query is a question.
  */


  /*
    Never `outline: none`. The ring is offset off the well's own inner edge so
    it reads as a ring rather than as a thicker border, and it is on `:focus`
    rather than `:focus-visible` alone — a text field focused with a mouse is
    still a text field you are about to type into, and hiding that from the one
    input on the page would be hiding the state that matters most.
  */







  /*
    The announcement is for assistive technology; the same words are printed
    visibly in `.count` beside the results, so this one is off-screen rather
    than duplicated on the page. Sized from `space.hair` rather than collapsed
    to zero: a zero-area element is skipped by some screen readers, and a
    region that is never read is worse than no region at all. The idiom is
    `Citation.svelte`'s, kept identical on purpose.
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
    Density without clutter: rows are separated by one hairline and nothing
    else — no card, no shadow, no padding a reader has to look past. The row
    wraps intrinsically rather than at a breakpoint, since the theme publishes
    no breakpoint tokens and a raw one is not available to write.
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
    line-height: var(--of-type-leading-base);
    font-size: var(--of-type-size-small);
    color: var(--of-color-ink-muted);
  }

  /* The heading is the one place a result row spends the serif voice, and it
     is why a titled section reads as an answer while an untitled subrule reads
     as evidence. */
  .title {
    font-family: var(--of-type-family-serif);
    font-size: var(--of-type-size-large);
    letter-spacing: var(--of-type-tracking-tight);
    color: var(--of-color-ink);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--of-space-tight);
    margin-block: var(--of-space-tightest) 0;
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-wide);
    text-transform: uppercase;
    color: var(--of-color-ink-faint);
  }

  .why {
    color: var(--of-color-ink-muted);
  }
</style>
