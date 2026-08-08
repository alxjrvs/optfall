import type { Meta, StoryObj } from "@storybook/svelte-vite";

import StatePill from "./StatePill.svelte";

/**
 * The state pill makes two claims that only a workbench can falsify, and these
 * stories exist to put both of them where a reviewer trips over them.
 *
 * **Claim one: the eight tones are mutually distinguishable.** `docs/DESIGN.md`
 * gives the notch to "anything carrying state" and `tokens.test.ts` asserts
 * numerically that no two state fills are the same colour — but "not identical"
 * is a much weaker property than "tellable apart at 0.6875rem under a bevel".
 * So all eight get a story and the autodocs page is the deliverable: it stacks
 * them in one scroll, which is the only view in which the question can actually
 * be answered. The export order below is chosen to put the dangerous
 * neighbours next to each other rather than to read alphabetically —
 * `Legal`/`Banned` (green against red, the pair a reviewer will assume is
 * safe), `Suspended`/`Unverified` (two browns a whole grade apart in
 * consequence), and `LivingLegend`/`Verified` (because brass is rationed to
 * verified alone, and a living-legend fill drifting toward it spends the one
 * signal the design reserves).
 *
 * **Claim two: the text is the primary channel and colour the redundant one.**
 * That claim is cheap to state and is falsified by exactly one thing — a label
 * that does not survive. {@link LongLabel} and {@link UnbreakableToken} are the
 * tests: no `max-inline-size`, no ellipsis, no icon-only variant, so a verdict
 * too long for its container has to wrap rather than get cut. Ugly is a pass
 * here; truncated is a failure. {@link EmptyLabel} and
 * {@link WhitespaceOnlyLabel} cover the case the *type* cannot — `label: string`
 * is required and `label=""` still type-checks — and
 * {@link AntiPatternLabelIsNotTheState} shows the one failure no amount of
 * styling can reach.
 */
const meta = {
  title: "Primitives/StatePill",
  component: StatePill,
  tags: ["autodocs"],
  argTypes: {
    tone: {
      control: { type: "select" },
      options: [
        "legal",
        "banned",
        "suspended",
        "restricted",
        "living-legend",
        "not-in-format",
        "verified",
        "unverified",
      ],
      description:
        "Which state this carries. Selects the fill and its matching ink; the closed `StateTone` union in `optfall-theme`, so a value outside these eight is a type error rather than an unstyled chip.",
      table: { type: { summary: "StateTone" } },
    },
    label: {
      control: "text",
      description:
        "The visible text, which IS the accessible name — one string, no `aria-label` shadowing it. Must name the state (`\"Banned\"`, not `\"Blitz\"`): the corpus owns the wording, but a label that names something other than the state hands the verdict back to colour alone. Required, and a blank or whitespace-only value falls back to the tone spoken in full rather than rendering an empty swatch.",
      table: { type: { summary: "string" } },
    },
  },
} satisfies Meta<typeof StatePill>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* The eight tones, ordered so the confusable neighbours are adjacent          */
/* -------------------------------------------------------------------------- */

/** The green half of the pair a reviewer is most likely to assume is safe. */
export const Legal: Story = { args: { tone: "legal", label: "Legal" } };

/**
 * Directly after `Legal` on purpose. Red against green is the single most
 * common colour-vision failure, and it is also the pair that carries the
 * largest difference in consequence — so if the two words were ever swapped for
 * an icon, this is where it would cost someone a deck check.
 */
export const Banned: Story = { args: { tone: "banned", label: "Banned" } };

/** A grade below `Banned`: playable, but not as a full set. */
export const Restricted: Story = {
  args: { tone: "restricted", label: "Restricted" },
};

/**
 * The first of the two browns. `Suspended` is a legality verdict about a card.
 */
export const Suspended: Story = {
  args: { tone: "suspended", label: "Suspended" },
};

/**
 * The second brown, and the reason the pair is worth seeing back to back:
 * `Unverified` says nothing at all about legality — it says nobody has signed
 * the ruling. Confusing it with `Suspended` turns "we do not know yet" into "you
 * cannot play this", which is a whole grade of consequence carried by two
 * fills the token layer only guarantees are *not equal*.
 */
export const Unverified: Story = {
  args: { tone: "unverified", label: "Unverified" },
};

/** Legal somewhere, just not in the format currently being asked about. */
export const NotInFormat: Story = {
  args: { tone: "not-in-format", label: "Not in format" },
};

/**
 * Placed immediately before `Verified` as a standing check on the rationing
 * rule: brass is reserved for judge-signed authority and nothing else, so a
 * living-legend fill that reads as brass here has quietly spent a signal the
 * design only gets to spend once.
 */
export const LivingLegend: Story = {
  args: { tone: "living-legend", label: "Living Legend" },
};

/** The one place brass is allowed to appear. */
export const Verified: Story = { args: { tone: "verified", label: "Verified" } };

/* -------------------------------------------------------------------------- */
/* The claims that only a rendered pill can falsify                            */
/* -------------------------------------------------------------------------- */

/**
 * The text channel under load. A real verdict is sometimes a sentence, and the
 * component deliberately ships no `max-inline-size`, no `overflow: hidden` and
 * no `text-overflow: ellipsis` — so this must wrap to as many lines as it needs
 * and stay readable end to end. An ellipsis appearing here would mean colour
 * had become the only complete channel, which is the exact failure the notch
 * and the fill are supposed to be redundant *to*.
 */
export const LongLabel: Story = {
  args: {
    tone: "not-in-format",
    label:
      "Not legal in Classic Constructed as of 14 March 2026 — banned by Living Legend, and still legal in Blitz",
  },
};

/**
 * The nastier half of the same claim. A wrapping label only survives if it has
 * somewhere to break, and a card name or slug pasted straight from a URL has
 * no spaces in it at all. `overflow-wrap: anywhere` is what keeps this inside
 * its container instead of pushing the pill out under an ancestor that *does*
 * clip — the layout bug that turns "never truncated" into "truncated by
 * something else, one component away".
 */
export const UnbreakableToken: Story = {
  args: {
    tone: "banned",
    label: "banned:command-and-conquer-x-sink-below-cc-2026-03-14",
  },
};

/**
 * `label: string` makes the prop mandatory, and `label=""` still type-checks —
 * so the contract is enforced at render time instead. This should show the tone
 * spoken in full (`Restricted`), never a coloured chip with no text node in it.
 * A blank pill here would be the whole design failing closed to colour.
 */
export const EmptyLabel: Story = { args: { tone: "restricted", label: "" } };

/**
 * The same floor, one step less obvious: whitespace is not a label. The value
 * is trimmed before it is tested, so stray padding from a template or a CMS
 * field cannot smuggle an empty accessible name past the fallback.
 */
export const WhitespaceOnlyLabel: Story = {
  args: { tone: "verified", label: "   " },
};

/**
 * NOT A PATTERN TO COPY — this is the failure the component cannot prevent,
 * rendered so it is arguable rather than theoretical.
 *
 * Everything here is type-correct: `tone` is a real `StateTone`, `label` is a
 * non-empty string, the notch and the fill are exactly right. And the pill is
 * still broken, because "Blitz" names a format rather than a state, so the only
 * thing saying *banned* is the colour. Compare it against {@link Banned} above:
 * same chip, same fill, and one of them is unreadable to the people this
 * component exists for. The fix is never in this file — it is in the caller.
 */
export const AntiPatternLabelIsNotTheState: Story = {
  args: { tone: "banned", label: "Blitz" },
};

/**
 * Light mode is "the printed-rulebook translation — ash and iron, not paper
 * white", and it is a designed mode rather than an inversion, which means a
 * fill tuned against near-black gets no free pass here. `verified` is the tone
 * to pin: brass is the one rationed material, it is the easiest to lose against
 * a pale ground, and its ink has to keep contrast in both themes. Pinned to the
 * light global so the docs page shows it without anyone remembering to reach
 * for the toolbar.
 */
export const BrassInLightMode: Story = {
  args: { tone: "verified", label: "Verified by judge" },
  globals: { theme: "light" },
};
