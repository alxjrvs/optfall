<script lang="ts">
  /**
   * The alternate printings of one card, as a picker that swaps the face.
   *
   * WHAT THIS REPLACES. A rail of thumbnails labelled by collector number and
   * nothing else — not clickable, so the only way to see another printing's art
   * was to not see it. A card averages 3.3 printings and several are visually
   * different (rainbow foil, cold foil, alternate art); showing them as
   * inert tiles was showing that they exist rather than showing them.
   *
   * NAMED BY SET AND NUMBER, because `BEN010` alone answers "which printing" for
   * somebody who already knows the set codes and nobody else. "Bright Lights ·
   * BEN010" answers it for everybody, and the number is kept because it is the
   * citable identity of a printing.
   *
   * WHY THIS IS AN ISLAND WHEN ALMOST NOTHING HERE IS. `docs/SCRYFALL-GAP.md`
   * §5.2 rules out live updating for SEARCH — results must not re-rank under a
   * cursor, because the URL is the product and a submit is what makes a query
   * worth pasting. A printing picker is the opposite case: it changes which
   * image is displayed and nothing else. There is no query, no ranking, no
   * result set, and nothing a reader would want to paste that the card's own
   * URL does not already carry.
   *
   * THE FACE IS SWAPPED, NOT NAVIGATED, and that is the one thing worth arguing
   * with. Per-printing URLs are still the better long-term answer — they are in
   * the plan, and they would make an individual printing linkable. Until they
   * exist, a swap is strictly better than a dead tile: the reader sees the art,
   * and the card's own permalink still resolves to the card.
   *
   * ONE SELECTION, AND IT IS A RADIO GROUP, because that is what "pick exactly
   * one of these" is. Arrow keys and a group name come free, the current choice
   * is announced rather than merely outlined, and a reader who cannot see the
   * accent border still knows which printing they are looking at.
   */
  import { CardFace, CardFaceGroup } from "optfall-components/svelte";

  interface Printing {
    /** Blob key, already resolved by the build. */
    readonly key: string;
    /** Collector number — the citable identity. Carries the edition too
     *  where set and number alone do not tell two printings apart. */
    readonly id: string;
    readonly edition: string;
    /** The set's published name, or its code where upstream names none. */
    readonly setName: string;
    readonly setCode: string;
    readonly thumb: string;
    readonly normal: string;
    readonly width: number;
    readonly height: number;
    readonly thumbWidth: number;
    readonly thumbHeight: number;
    /** This printing's own page — `/card/<slug>/<set>/<number>`. */
    readonly href: string;
  }

  interface Props {
    printings: readonly Printing[];
    /** The accessible name for the card's picture, composed by the caller. */
    alt: string;
    /** The card's label, for the group's accessible name. */
    label: string;
    /** Which face the server already rendered. See `CardEntry`'s `selected`. */
    selected?: number;
  }

  const { printings, alt, label, selected: initial = 0 }: Props = $props();

  /**
   * WHICH PRINTING, IN THE URL — so "the rainbow foil one" is a thing you can
   * paste.
   *
   * `docs/DESIGN.md`: "Every view is a URL. Scryfall's real product is the link
   * you paste into a conversation to settle it." A picker whose selection lived
   * only in component state was a view with no address: you could find the cold
   * foil printing and then had no way to show it to anybody.
   *
   * THE PARAM IS THE FACE KEY, minus its extension — `?printing=U-WTR098`. It
   * is upstream's own art filename stem, it is unique per distinct image
   * (asserted over the corpus in `faces.test.ts`), and it survives a set
   * printing the same collector number twice: `WTR098` and `U-WTR098` are the
   * Alpha and Unlimited arts, which `WTR098` alone could not tell apart.
   *
   * AN UNKNOWN OR ABSENT PARAM FALLS BACK TO THE DEFAULT rather than erroring.
   * A stale link from before a re-sync should show the card, not a broken page
   * — the reader asked for a card and one of its printings is a better answer
   * than none.
   */
  const PARAM = "printing";

  function keyOf(printing: Printing): string {
    return printing.key.replace(/\.webp$/, "");
  }

  /**
   * WHERE THE SELECTION COMES FROM, IN PRIORITY ORDER.
   *
   * 1. The PATH, resolved by the server — `initial`. A per-printing URL is a
   *    page now, so by the time this component runs the correct face is already
   *    in the DOM and the only right thing to do is agree with it.
   * 2. `?printing=`, for links pasted before those pages existed. The param is
   *    no longer written, but it was, and a reference tool that breaks its own
   *    old links has failed at the one thing it is for.
   *
   * The query form loses to the path form deliberately: if somebody arrives at
   * `/card/x/omn/243-cf?printing=OMN243`, the URL contradicts itself, and the
   * half that was *served* is the half that wins.
   */
  function selectedFromUrl(): number {
    if (typeof window === "undefined") return initial;

    // The path first, and it is read from the DOCUMENT rather than from
    // `initial`, because `remember` rewrites the path as the reader clicks.
    // Reading the prop instead would make Back restore the face the page was
    // *served* with rather than the one the address currently names.
    const here = window.location.pathname.replace(/\/$/, "");
    const byPath = printings.findIndex(
      (printing) => printing.href.replace(/\/$/, "") === here,
    );
    if (byPath !== -1) return byPath;

    const wanted = new URLSearchParams(window.location.search).get(PARAM);
    if (wanted === null) return initial;
    const index = printings.findIndex((printing) => keyOf(printing) === wanted);
    return index === -1 ? initial : index;
  }

  let selected = $state(selectedFromUrl());
  const current = $derived(printings[selected] ?? printings[0]);

  /**
   * `replaceState`, not `pushState`.
   *
   * Clicking through six printings should not put six entries in the back
   * button — the reader is looking at one card, not visiting six pages. The
   * address stays correct so it can be copied at any moment, and Back still
   * returns to wherever they came from.
   */
  function remember(index: number): void {
    selected = index;
    if (typeof window === "undefined") return;
    const printing = printings[index];
    if (printing === undefined) return;

    /*
     * THE ADDRESS BAR IS SET TO THE PRINTING'S OWN PAGE, NOT TO A QUERY ON
     * THIS ONE — and the swap still does not navigate.
     *
     * This is the combination worth having. Clicking a tile changes an image,
     * so making it a link would be a page load to move one picture. But the URL
     * it writes has to be one that WORKS on its own: the old `?printing=` form
     * only resolved in a browser running this component, so pasting it into a
     * preview-generating chat window produced the default art, and pasting it
     * to somebody with scripting off produced the default art silently.
     *
     * `printing.href` is a real page that renders this face server-side. So the
     * address is now always something the reader can copy at any moment and
     * hand to anything at all — while the interaction that produced it stayed
     * instant.
     */
    window.history.replaceState({}, "", printing.href);
  }

  /** Back and forward have to work, which means listening for them. */
  $effect(() => {
    const onPop = () => {
      selected = selectedFromUrl();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  const uid = $props.id();
</script>

{#if current}
  <!--
    EVERY FACE HERE GOES THROUGH THE COMPONENT, thumbnails included. An earlier
    version of this file rendered the tiles as bare `<img>` tags, which is the
    exact path docs/COMPLIANCE.md §5 names as a way to break the copyright
    condition — and it left 22 card images on a page under one notice.

    The group carries the notice for all of them, once, because these are eight
    pictures of ONE card and the legal fact is the same for each.
  -->
  <CardFaceGroup>
    <div class="picker">
    <CardFace
      src={current.normal}
      {alt}
      width={current.width}
      height={current.height}
      loading="eager"
    />

    {#if printings.length > 1}
      <fieldset class="rail">
        <legend class="rail-legend">Printings of {label}</legend>
        <ul class="rail-list">
          {#each printings as printing, index (printing.key)}
            <li>
              <label class="tile" class:current={index === selected}>
                <input
                  type="radio"
                  name={`${uid}-printing`}
                  checked={index === selected}
                  onchange={() => remember(index)}
                />
                <span class="tile-face">
                  <CardFace
                    src={printing.thumb}
                    alt=""
                    width={printing.thumbWidth}
                    height={printing.thumbHeight}
                  />
                </span>
                <span class="tile-set">{printing.setName}</span>
                <span class="tile-id">{printing.id}</span>
              </label>
            </li>
          {/each}
        </ul>
      </fieldset>
    {/if}
    </div>
  </CardFaceGroup>
{/if}

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--of-space-loose);

    /* `max-inline-size: min(fit-content, 100%)` WAS INVALID AND SILENTLY
       DROPPED. `min()` takes numeric terms; `fit-content` is a sizing keyword,
       not a length, so every browser discarded the declaration at parse time —
       leaving `none`, which lost the shrink-wrap this column had BEFORE the
       change as well as the cap it was meant to gain. Nothing in CI notices:
       `check-tokens.ts` looks for raw colours, raw lengths and dangling
       `var()`s, and a well-formed property with an unparseable value is none of
       those.

       `100%` is what was actually wanted. The strip inside is `inline-size:
       100%` and scrolls its own overflow, so this column no longer needs to
       shrink-wrap anything to stay inside its parent — it needs to not exceed
       it. */
    max-inline-size: 100%;
  }

  .rail {
    margin: 0;
    padding: 0;
    border: 0;

    /* A `fieldset` defaults to `min-inline-size: min-content`, which is a UA
       rule with no equivalent on any other element and the reason the scroller
       inside it did not scroll: the fieldset refused to be narrower than seven
       tiles, so the strip escaped its column and took the page sideways at 390
       even with the `<ul>` correctly set to `inline-size: 100%`. The fieldset
       is here for the radio group's semantics, not for its layout, so it gives
       that default up. */
    min-inline-size: 0;
  }

  /* Named for assistive technology, unnamed on screen: the tiles say what they
     are, and a visible "Printings of Head Jab" above them would repeat the
     heading two rows up. */
  .rail-legend {
    position: absolute;
    inline-size: var(--of-space-hair);
    block-size: var(--of-space-hair);
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /*
    A PICKER, NOT A GALLERY — and the tile size is the whole difference.

    The thumbs rendered at the full published `card.face.thumb` width, which is
    two per row under a face and therefore five rows for the nine printings of
    Head Jab: a control four times the height of the image it controls, and a
    left column running most of a thousand pixels past the bottom of the card's
    own text. The rail was outgrowing the page it sits on.

    Half the published width is still large enough to tell one piece of art from
    another — which is the only question this control asks. Asking the host for
    the `thumb` tier and drawing it smaller costs nothing and hands a high-DPI
    screen a sharper picture; the tier is what the host publishes, and the size
    is what this surface needs.

    THE ROW-COUNT ARGUMENT THAT USED TO END THIS PARAGRAPH IS GONE, because the
    rule it described is gone. It said the tiles "pack four to a row, so the
    average card's 3.3 printings are one row and the worst case is three" —
    true of the wrapping grid, false of the strip that replaced it, and sitting
    directly above the comment that explains the replacement. Two adjacent
    blocks contradicting each other about the same rule is exactly what the
    next comment warns against.
  */
  /*
    ONE ROW THAT SCROLLS, NOT A WRAPPING GRID — and this is the second time this
    control has been shortened, for the same reason in a different direction.

    The auto-fill grid packs four to a row against a desktop column and two to a
    row against a phone's, where the tiles also grow to fill it: measured on a
    phone, four printings became two rows of oversized thumbs, half a screen of
    rail, and the card's own NAME landed below the fold. A6 capped the hero face
    for exactly that reason and the rail beneath it undid the fix.

    A single row is width-independent in the way the grid was not. The tiles
    keep one size, the strip is one tile tall on every screen, and a card with
    more printings than fit scrolls sideways inside its own box rather than
    growing downwards through the page. No breakpoint: the same declaration
    seats four on a desktop and scrolls nine on a phone.

    IT ALSO SETTLES A COMPLIANCE QUESTION, which is why it is worth the second
    pass. `CardFaceGroup` hoists one copyright notice for faces "seen together",
    and explicitly excludes the scrolling case — a reader cannot be said to see
    a notice with a face six rows above it. As a wrapping grid this rail was
    that case: 22 tiles, roughly six rows, notice last. As a strip the notice
    sits directly under a band one tile tall, on screen with it at any scroll
    position, which is the condition the rule actually states. The exact figures
    are in the commit; this comment keeps the reasoning and not the pixels,
    because a comment that carries measurements goes stale the first time
    anybody changes a token.
  */
  .rail-list {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: min(calc(var(--of-card-face-thumb) / 2), 100%);
    gap: var(--of-space-tight);
    margin: 0;
    list-style: none;
    overflow-x: auto;

    /* FILL THE COLUMN, DO NOT SIZE TO THE TILES. A scrolling grid's automatic
       size is its whole content, so a seven-printing strip made this box wider
       than the column holding it and took the page sideways. Being told
       to be exactly the width it was given is what makes the overflow scroll
       instead of escape; `min-inline-size: 0` is the other half, because a grid
       item's automatic minimum is its content and would otherwise refuse. */
    inline-size: 100%;
    min-inline-size: 0;

    /* ROOM FOR THE FOCUS RING, which is an `outline` with an offset and is
       therefore drawn OUTSIDE the tile's border box. Setting `overflow-x`
       computes `overflow-y` to `auto` as well, so this box clips on both axes
       now — and the first tile is flush with the block-start and inline-start
       edges, so its ring was cut on two sides. The padding is the offset plus
       the ring's own width. */
    padding: calc(var(--of-space-tightest) + var(--of-bevel-width) * 2);
    /* The scroll stops on a tile rather than between two of them. */
    scroll-snap-type: inline proximity;
  }

  .rail-list > * {
    scroll-snap-align: start;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--of-space-tightest);
    cursor: pointer;
    color: var(--of-color-ink-muted);
    text-align: center;
  }

  /* The input is the control and the label is the target, so the radio itself
     is removed from view rather than from the accessibility tree — it still
     takes focus, still answers arrow keys, still announces its state.

     `position: relative` ON THE TILE IS LOAD-BEARING, and its absence is what
     made the strip leak. An absolutely positioned box takes its containing
     block from the nearest POSITIONED ancestor, and `overflow` does not create
     one — so with every ancestor unpositioned these radios resolved against the
     initial containing block. They were neither clipped nor scrolled by the new
     scroller: each sat at its unscrolled static position, far to the right of
     the column on a long strip, and contributed that box to the DOCUMENT's
     scrollable overflow. That is the page-level sideways scroll this change
     exists to remove, reintroduced through the one box the old wrapping grid
     never pushed out of bounds.

     It also fixes arrow keys. The browser scrolls the FOCUSED element into
     view, and a radio parked at its ICB position is already "in view", so
     arrowing along the strip scrolled the document sideways instead of
     revealing the next tile. Positioned, the radio scrolls and clips with the
     strip it belongs to. */
  .tile {
    position: relative;
  }

  .tile input {
    position: absolute;
    opacity: 0;
    inline-size: var(--of-space-hair);
    block-size: var(--of-space-hair);
  }

  /* The selected outline goes on the wrapper: `CardFace` owns how a face is
     drawn, and reaching past it to restyle the image would be the page
     restyling a primitive. The width goes here too, for the same reason — the
     image inside is already `max-inline-size: 100%`, so constraining the
     wrapper scales the face without touching the component that drew it. */
  .tile-face {
    display: block;
    inline-size: 100%;
    outline: var(--of-bevel-width) solid var(--of-color-rule);
  }

  .tile:hover {
    color: var(--of-color-ink);
  }

  /*
    The selected tile is marked by ink AND an accent edge — two channels,
    because "which printing am I looking at" is the only question this control
    exists to answer.
  */
  .tile.current {
    color: var(--of-color-ink);
  }

  .tile.current .tile-face {
    outline-color: var(--of-color-accent);
  }

  /* Focus lands on the hidden radio, so the ring is drawn on the tile it
     controls — never removed, only relocated. */
  .tile:has(input:focus-visible) .tile-face {
    outline: calc(var(--of-bevel-width) * 2) solid var(--of-color-focus);
    outline-offset: var(--of-space-tightest);
  }

  .tile-set {
    font-size: var(--of-type-size-micro);
    line-height: var(--of-type-leading-tight);
    max-inline-size: 100%;
  }

  .tile-id {
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-wide);
    text-transform: uppercase;
    color: var(--of-color-ink-faint);
  }
</style>
