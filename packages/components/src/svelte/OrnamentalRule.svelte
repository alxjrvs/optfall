<script lang="ts">
/**
 * The section rule — a hairline divider, optionally carrying the centred
 * filigree ornament.
 *
 * This is the primitive `docs/DESIGN.md` means by "density without clutter,
 * held together by tight vertical rhythm and hairline rules rather than
 * cards, shadows and padding". It is the alternative to a card: where a
 * lesser system would box a section, this system draws one line and moves
 * on. Following `PitchJewel.svelte` in every convention:
 *
 * - **Styles name tokens and nothing else.** Not one literal colour or
 *   length; `scripts/check-tokens.ts` fails the build otherwise.
 * - **Square corners, bevelled surfaces.** The rule is *struck*, not drawn:
 *   a light hairline above and a dark one below, carried on `box-shadow` so
 *   the bevel costs no layout and the rule stays exactly one hairline tall.
 * - **The accessible name is a prop**, and its sensible default is *no name*
 *   — see `label` below, where that is argued rather than assumed.
 *
 * SEMANTICS ARE THE POINT OF THIS COMPONENT. A divider is either a thematic
 * break or it is furniture, and the two must not render as the same thing. A
 * real `<hr>` is a `separator` in the accessibility tree and is announced; a
 * decorative line is `aria-hidden` and is not. Getting this wrong in a
 * reference work is expensive in exactly one direction — a screen reader
 * announcing "separator" between every header and its body, on every card
 * page, is noise that trains people to ignore the one that meant something.
 * So `decorative` exists, defaults to `false`, and is the only way to get a
 * line that is not a thematic break.
 *
 * FILIGREE IS RATIONED, AND THIS IS ONE OF ITS THREE ROLES. `docs/DESIGN.md`
 * spends scrollwork on feature-panel corners, card-frame corners and the
 * section rule — never on a control, never on a list, never twice on one
 * screen. `ornament` therefore defaults to `false`: the plain hairline is the
 * common case and the ornamented rule is the exception a page spends once.
 *
 * The ornament arrives as a `filigree` snippet rather than as an import,
 * because a primitive that reaches for another primitive decides for the
 * caller how much ornament a screen has already spent. It composes:
 *
 * ```svelte
 * <OrnamentalRule ornament>
 *   {#snippet filigree()}
 *     <FiligreeCorner role="section-rule" />
 *   {/snippet}
 * </OrnamentalRule>
 * ```
 *
 * **THIS COMPONENT OWNS THE RULE; THE SNIPPET SUPPLIES A DRAWING.** The two
 * hairlines, the vertical rhythm and the `<hr>` semantics are all here, and
 * `FiligreeCorner` in its `section-rule` role emits a bare figure with no
 * lines, no `role="separator"` and no margins of its own. Both halves of that
 * sentence had to be written down: each component was built to the same
 * three-role ration and each concluded independently that the section rule
 * was its job, so following the instructions above used to yield four
 * hairlines at two different weights, doubled rhythm, and a `separator`
 * buried inside an `aria-hidden` mount where the accessibility tree threw it
 * away. One owner, and it is this file, because that is what its name says.
 *
 * The mount is `aria-hidden`: the ornament is decoration, and the thematic
 * break is carried by the `<hr>` element itself rather than by anything
 * visible. Colour never carries the meaning here — remove every colour from
 * this component and the break is still in the accessibility tree.
 */
import type { Snippet } from "svelte";

interface Props {
  /**
   * Open the centre of the rule and mount the filigree. Defaults to `false`
   * because ornament is rationed; a screen gets one of these at most.
   */
  ornament?: boolean;
  /**
   * Render a line that is *not* a thematic break — furniture inside a plate,
   * rather than a division between sections. Hidden from assistive
   * technology entirely, which is the honest rendering of a decoration.
   */
  decorative?: boolean;
  /**
   * Accessible name for the break, such as the section it introduces.
   *
   * Its default is deliberately *absent*, which is the one place this
   * component departs from the jewel. A `separator` needs no name to be
   * understood — it is already announced by role — so a default name would
   * be invented text read aloud on every rule in the interface. Supply one
   * only when the break genuinely names something, and never as a
   * description of the line itself.
   */
  label?: string;
  /**
   * The ornament itself. Intended occupant: `FiligreeCorner` in its
   * `section-rule` role. Ignored unless `ornament` is set.
   */
  filigree?: Snippet;
}

const {
  ornament = false,
  decorative = false,
  label,
  filigree,
}: Props = $props();

/**
 * `?.trim() ||` — the house idiom from `PitchJewel.svelte`, applied in the
 * one direction it runs here. The default is absence, so a blank must
 * collapse to *undefined* rather than to `aria-label=""`, which is an empty
 * name overriding the role's own announcement rather than no name at all.
 */
const name = $derived(label?.trim() || undefined);
</script>

<div class="rule" class:ornamented={ornament}>
  {#if decorative}
    <span class="line" aria-hidden="true"></span>
  {:else}
    <hr class="line" aria-label={name} />
  {/if}

  {#if ornament}
    <span class="mount" aria-hidden="true">
      {#if filigree}
        {@render filigree()}
      {:else}
        <!-- The degenerate ornament. A gap with nothing in it is a bug that
             looks like a design, so the component draws its own centre mark
             when no snippet is supplied rather than opening a hole and
             trusting the caller. -->
        <span class="mark"></span>
      {/if}
    </span>
    <span class="line" aria-hidden="true"></span>
  {/if}
</div>

<style>
  .rule {
    /* The rule owns its vertical rhythm. A divider with no room around it is
       not a divider, and this system has no cards or padding to supply that
       room elsewhere. */
    margin-block: var(--of-space-loose);
  }

  .ornamented {
    /* Line, ornament, line. The centre is a real gap rather than a masked
       overlay, so the ornament never depends on sitting against a surface of
       a particular colour to hide the line behind it. */
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    column-gap: var(--of-space-base);
    margin-block: var(--of-space-looser);
  }

  .line {
    display: block;
    inline-size: 100%;
    block-size: var(--of-ornament-rule-width);
    margin: 0;
    border: 0;
    background: var(--of-color-rule);

    /* Struck rather than drawn: a light edge above and a dark edge below, so
       the hairline reads as the seam between two plates. Carried on a shadow
       because a shadow takes no space — the rule still occupies exactly one
       hairline, which is what keeps the vertical rhythm honest. */
    box-shadow:
      0 calc(-1 * var(--of-bevel-width)) 0 0 var(--of-bevel-light),
      0 var(--of-bevel-width) 0 0 var(--of-bevel-dark);
  }

  .mount {
    display: flex;
    align-items: center;
    justify-content: center;
    /* The occupant inherits its ink from here, so a filigree drawn with
       `currentColor` lands in the ornament tone without being told. */
    color: var(--of-ornament-filigree-ink);
    line-height: var(--of-type-leading-tight);
  }

  .mark {
    display: block;
    inline-size: var(--of-ornament-filigree-size);
    /* Half height: a flattened lozenge reads as a terminal on the rule rather
       than as a shape sitting on top of it. */
    block-size: calc(var(--of-ornament-filigree-size) / 2);
    background: var(--of-ornament-filigree-ink);
    /* Cut, never rounded — the system has one radius token and it is none. */
    border-radius: var(--of-bevel-radius);
    clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  }

  /* Honour a reduced-motion preference by never introducing motion here at
     all; the rule is static by design. Declared so the intent is explicit
     rather than accidental. */
  @media (prefers-reduced-motion: reduce) {
    .rule {
      transition: none;
    }
  }
</style>
