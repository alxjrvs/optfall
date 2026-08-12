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
  }

  interface Props {
    printings: readonly Printing[];
    /** The accessible name for the card's picture, composed by the caller. */
    alt: string;
    /** The card's label, for the group's accessible name. */
    label: string;
  }

  const { printings, alt, label }: Props = $props();

  let selected = $state(0);
  const current = $derived(printings[selected] ?? printings[0]);

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
                  onchange={() => (selected = index)}
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
    max-inline-size: fit-content;
  }

  .rail {
    margin: 0;
    padding: 0;
    border: 0;
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

  .rail-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--of-space-base);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--of-space-tightest);
    cursor: pointer;
    color: var(--of-color-ink-muted);
  }

  /* The input is the control and the label is the target, so the radio itself
     is removed from view rather than from the accessibility tree — it still
     takes focus, still answers arrow keys, still announces its state. */
  .tile input {
    position: absolute;
    opacity: 0;
    inline-size: var(--of-space-hair);
    block-size: var(--of-space-hair);
  }

  /* The selected outline goes on the wrapper: `CardFace` owns how a face is
     drawn, and reaching past it to restyle the image would be the page
     restyling a primitive. */
  .tile-face {
    display: block;
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
    max-inline-size: var(--of-card-face-thumb);
    text-align: center;
  }

  .tile-id {
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-wide);
    text-transform: uppercase;
    color: var(--of-color-ink-faint);
  }
</style>
