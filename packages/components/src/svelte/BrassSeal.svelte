<script lang="ts">
  /**
   * The brass seal — judge attribution on a verified ruling.
   *
   * This is the single place brass is allowed to appear. `docs/DESIGN.md`:
   * "Brass is reserved for authority — the verified seal and nothing else. A
   * material used once is a signal; used twice it is a theme." So a second
   * component reaching for `color.brass` is not a styling choice, it is the
   * signal being spent. Nothing else may consume `--of-color-brass`,
   * `--of-color-brass-ink` or `--of-color-brass-edge`.
   *
   * Conventions inherited from `PitchJewel.svelte`, the reference component:
   * tokens and nothing else in the style block, square corners, a light top
   * edge and a dark bottom edge, logical properties throughout.
   *
   * **There is no `label` prop, and its absence is the same argument the
   * reference makes for having one.** `PitchJewel` takes a label because a
   * jewel is a glyph whose meaning lives outside its markup. Here the three
   * facts that *are* the accessible name are already required props, so the
   * name is composed rather than supplied — there is no spelling of
   * `<BrassSeal />` that renders an unnamed seal, which is strictly better than
   * a default a caller can override to nothing. `BrassSealProps` in
   * `../index.ts` is the contract; this adds no prop to it.
   *
   * **The rules version is a first-class field, not a parenthetical.**
   * `docs/PLAN.md` Phase 5: "every entry records the rules version it was
   * answered under; a bump flags it for review rather than silently serving
   * stale law". A version that a reader has to hunt for cannot do that job, so
   * it gets its own struck band across the foot of the plate rather than a
   * trailing note in small text.
   *
   * **Colour never carries the claim.** The word "Verified" is rendered as
   * text, so the brass says the same thing the plate already says. A reader who
   * cannot see the material loses nothing.
   */

  interface Props {
    /** The judge's name, exactly as they gave it. */
    judge: string;
    /** Date the ruling was given, `YYYY-MM-DD`. */
    date: string;
    /** The rules version the ruling was answered under. */
    rulesVersion: string;
  }

  const { judge, date, rulesVersion }: Props = $props();

  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ] as const;

  /**
   * `YYYY-MM-DD` expanded to "14 March 2026", by hand.
   *
   * Deliberately NOT `new Date(date).toLocaleDateString()`. A bare `YYYY-MM-DD`
   * is parsed as UTC midnight, so anywhere west of Greenwich that round-trip
   * renders the *previous day* — a ruling dated the 14th displayed as the 13th
   * to a reader in Los Angeles. On a surface whose entire value is being
   * citable, a date that changes with the reader's timezone is not a cosmetic
   * bug. The `datetime` attribute below still carries the exact machine form,
   * so nothing is lost by formatting the visible text ourselves.
   *
   * An unparseable value renders as given rather than as "Invalid Date": if
   * upstream data is malformed, showing it is how anyone finds out.
   */
  const readable = $derived.by(() => {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!parts) return date;
    const [, year, month, day] = parts;
    const name = MONTHS[Number(month) - 1];
    return name ? `${Number(day)} ${name} ${year}` : date;
  });
</script>

<!--
  One statement, not three fragments.

  The visible plate is laid out as an eyebrow, a name, a date and a version
  band — read in isolation those are four orphan strings in a list of rulings.
  The `.joiner` spans are the connective tissue: real text, in the accessibility
  tree in reading order, hidden only from sight. The seal therefore announces

      "Verified by Elena Ruiz on 14 March 2026, under rules version 2.11.0"

  as one sentence, while every visible element stays genuine text — selectable,
  translatable, and never duplicated into an `aria-label` that would drift from
  what is on screen. Only `.version-label` is hidden from assistive technology,
  because the joiner ahead of it already says "rules version" and the visible
  label would otherwise be read twice.
-->
<p class="seal">
  <span class="face">
    <span class="claim">Verified</span>
    <span class="joiner"> by </span>
    <span class="judge">{judge}</span>
    <span class="joiner"> on </span>
    <time class="date" datetime={date}>{readable}</time>
  </span>
  <span class="joiner">, under rules version </span>
  <span class="band">
    <span class="version-label" aria-hidden="true">Rules version</span>
    <span class="version">{rulesVersion}</span>
  </span>
</p>

<style>
  .seal {
    /* A struck plate: sized to its content, square, bevelled. Grid rather than
       block so the version band spans the full width of the face above it
       without either of them naming a size. */
    position: relative;
    display: inline-grid;
    max-inline-size: 100%;
    margin: 0;
    border: var(--of-bevel-width) solid var(--of-color-brass-edge);
    border-block-start-color: var(--of-bevel-light);
    border-block-end-color: var(--of-bevel-dark);
    border-radius: var(--of-bevel-radius);
    background: var(--of-color-brass);
    color: var(--of-color-brass-ink);
  }

  .face {
    display: grid;
    row-gap: var(--of-space-tightest);
    padding-block: var(--of-space-tight);
    padding-inline: var(--of-space-base);
  }

  /* Hierarchy is carried by size and weight, never by fading text down.
     The only lower-contrast brass available is the edge tone, and it drops
     under 4.5:1 on this plate in light mode — so nothing here is dimmed. */
  .claim {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    font-weight: var(--of-type-weight-bold);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-mono);
    text-transform: uppercase;
  }

  /* The one sans line on the plate. A person's name is interface text, not a
     label, and setting it apart from the tracked-caps register is what makes
     the seal read as attribution rather than as a badge. */
  .judge {
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-base);
    font-weight: var(--of-type-weight-bold);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-tight);
  }

  .date {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    font-weight: var(--of-type-weight-regular);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-mono);
    font-variant-numeric: tabular-nums;
    text-transform: uppercase;
  }

  /* The version band. Inverted material — plate ink as the ground, plate metal
     as the text — so the field a version bump has to invalidate is the one
     thing on the seal you cannot miss. A hairline separates it from the face;
     the bevel stays on the outer plate, because in this system a bevel always
     means light above and dark below and an inverted one would say something
     the system does not say. */
  .band {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    column-gap: var(--of-space-loose);
    row-gap: var(--of-space-tightest);
    padding-block: var(--of-space-tighter);
    padding-inline: var(--of-space-base);
    border-block-start: var(--of-ornament-rule-width) solid var(--of-color-brass-edge);
    background: var(--of-color-brass-ink);
    color: var(--of-color-brass);
  }

  .version-label {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-micro);
    font-weight: var(--of-type-weight-regular);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-mono);
    text-transform: uppercase;
  }

  .version {
    font-family: var(--of-type-family-mono);
    font-size: var(--of-type-size-small);
    font-weight: var(--of-type-weight-bold);
    line-height: var(--of-type-leading-tight);
    letter-spacing: var(--of-type-tracking-mono);
    font-variant-numeric: tabular-nums;
  }

  /* Visible to assistive technology, invisible on screen. Sized from the
     hairline token rather than a bare pixel, and clipped rather than
     `display: none`, which would remove it from the accessibility tree and
     take the sentence apart again. */
  .joiner {
    position: absolute;
    inline-size: var(--of-space-hair);
    block-size: var(--of-space-hair);
    margin: 0;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
    border: 0;
  }

  /* The seal is static by design and introduces no motion at any breakpoint.
     Declared so the intent is on the record rather than merely true today. */
  @media (prefers-reduced-motion: reduce) {
    .seal {
      transition: none;
    }
  }
</style>
