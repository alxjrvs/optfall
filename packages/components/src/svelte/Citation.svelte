<script lang="ts">
/**
 * A citation — the thing you paste into an argument to end it.
 *
 * `docs/PLAN.md` Phase 4: **the permalink is the product.** A judge pasting
 * `cr:8.3.4b` into Discord instead of describing which paragraph they mean is
 * the whole share moment, so this primitive has exactly two jobs: make the
 * identifier *look* copyable, and make it genuinely clickable.
 *
 * Conventions inherited from `PitchJewel.svelte`, the reference component:
 * styles name tokens and nothing else, corners are square, the plate is
 * bevelled light-on-top and dark-on-bottom, and the accessible name cannot be
 * forgotten.
 *
 * Three decisions worth the words:
 *
 * - **It is an `<a>`, not a styled `<span>` with a click handler.** Middle
 *   click, "copy link address", ⌘-click and the browser's own focus order all
 *   arrive free with the right element and are unrecoverable without it. The
 *   focus ring is a real `outline` at twice the bevel width; `outline: none`
 *   appears nowhere in this file, because a citation nobody can tab to is a
 *   permalink nobody can share.
 *
 * - **The identifier is NOT uppercased, and that is a deliberate departure.**
 *   `docs/DESIGN.md` gives the mono voice as "wide-tracked uppercase", and the
 *   tracking is here — it is what makes mono read as a label rather than as
 *   code. The casing is not, because a rule id is an *identifier* rather than
 *   a label: `8.3.4b` and `8.3.4B` are not interchangeable, and browsers
 *   disagree about whether `text-transform` follows text onto the clipboard.
 *   A citation that pastes back differently than it was printed is the one
 *   failure this component exists to prevent.
 *
 * - **The version never carries its meaning in colour alone.** `ink.muted`
 *   makes it read as subordinate, but a separator glyph and a visually hidden
 *   "version" make it subordinate *structurally* too — so it survives a
 *   screen reader, a monochrome print, and forced-colours mode.
 *
 * The accessible name is the citation itself: "cr:8.3.4b version 2.11.0",
 * built from required props rather than from an optional label. There is no
 * name for a caller to omit, which is the same guarantee the jewel gets from
 * its default — reached here by making the visible text the name instead.
 */
interface Props {
  /** Permanent rule identifier, such as `cr:8.3.4b`. */
  ruleId: string;
  /** Permalink to the addressable section. */
  href: string;
  /** Document version the citation was read from. */
  version?: string;
}

const { ruleId, href, version }: Props = $props();

/**
 * An empty string is an absent version, not a blank one. `version=""` comes
 * from a record that has not been versioned yet, and rendering it would print
 * a separator pointing at nothing.
 */
const hasVersion = $derived(version !== undefined && version.trim() !== "");
</script>

<a class="citation" {href} data-rule-id={ruleId}>
  <span class="rule-id">{ruleId}</span>
  {#if hasVersion}
    <span class="separator" aria-hidden="true">·</span>
    <span class="version"><span class="sr-only">version </span>{version}</span>
  {/if}
</a>

<style>
  .citation {
    display: inline-flex;
    align-items: baseline;
    gap: var(--of-space-tighter);
    box-sizing: border-box;
    padding-block: var(--of-space-tightest);
    padding-inline: var(--of-space-tight);

    /* A struck plate: light top edge, dark bottom edge, hairline sides. */
    border-block-start: var(--of-bevel-width) solid var(--of-bevel-light);
    border-block-end: var(--of-bevel-width) solid var(--of-bevel-dark);
    border-inline: var(--of-bevel-width) solid var(--of-color-rule);
    /* Nothing in this system is rounded. The token exists only to be zero, and
       naming it is how that stays true rather than merely being true today. */
    border-radius: var(--of-bevel-radius);

    background: var(--of-color-surface);
    color: var(--of-color-ink);

    /* The mono voice, in its definitive use. Wide tracking is the property that
       separates a label from a line of code. */
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-small);
    font-weight: var(--of-type-weight-medium);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-wide);

    /* The plate — surface, bevel, hairline, mono voice — is what marks this as
       a link, so the underline is spent on hover and focus instead of being
       always-on. Colour is never the distinguishing channel on its own. */
    text-decoration: none;

    /* A citation is atomic. Half of `cr:8.3.4b` on the next line is not a
       shorter citation, it is a wrong one. */
    white-space: nowrap;

    transition:
      background-color var(--of-motion-fast) var(--of-motion-ease),
      border-color var(--of-motion-fast) var(--of-motion-ease);
  }

  /* One click selects the whole identifier. The component's entire job is to be
     pasted somewhere, so selection is a first-class affordance rather than an
     accident of it being text. */
  .rule-id {
    user-select: all;
  }

  .separator,
  .version {
    color: var(--of-color-ink-muted);
  }

  .version {
    font-size: var(--of-type-size-micro);
  }

  .citation:hover {
    background: var(--of-color-surface-raised);
    border-inline-color: var(--of-color-rule-strong);
  }

  /* Underline on both, so a keyboard user gets the same affordance a mouse user
     does rather than a quieter version of it. */
  .citation:hover,
  .citation:focus-visible {
    text-decoration: underline;
    text-underline-offset: var(--of-space-tightest);
  }

  /* Never `outline: none`. Two bevel widths so the ring survives a high-density
     display and the offset keeps it off the plate's own light edge. */
  .citation:focus-visible {
    outline: calc(var(--of-bevel-width) * 2) solid var(--of-color-focus);
    outline-offset: var(--of-bevel-width);
  }

  /* Pressed: the bevel inverts and the plate sinks, because a struck surface
     pushed in catches light on its lower edge. */
  .citation:active {
    background: var(--of-color-sunken);
    border-block-start-color: var(--of-bevel-dark);
    border-block-end-color: var(--of-bevel-light);
  }

  /* The clarifier a screen reader needs and a sighted reader already has from
     position and weight. Sized from `space.hair` rather than collapsed to zero:
     a zero-area element is skipped by some assistive technology, and a hidden
     word that goes unread is worse than no word at all. */
  .sr-only {
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

  @media (prefers-reduced-motion: reduce) {
    .citation {
      transition: none;
    }
  }
</style>
