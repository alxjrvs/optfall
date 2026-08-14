import type { Meta, StoryObj } from "@storybook/svelte-vite";

import Mark from "./Mark.svelte";

/**
 * The mark — three interlocked links.
 *
 * WHAT THESE STORIES ARE FOR. `docs/DESIGN.md` makes three claims about this
 * object that only a workbench can falsify, and each has a story:
 *
 * 1. **It interlocks.** Every link is over its neighbour at one crossing and
 *    under at the other. That is the difference between a chain and a row of
 *    overlapping rings, it is produced entirely by paint order, and it is the
 *    thing most likely to break silently — a scope rectangle drifting a unit
 *    off, a link redrawn in the wrong order, and the mark quietly becomes two
 *    rings lying flat on a third. You cannot see it in a diff.
 *
 * 2. **It survives a favicon — and at three links it does NOT.** That finding
 *    is the reason the tab icon draws one link, and the two size stories below
 *    are the evidence rather than an assertion. Judge them at the pixel size
 *    named, not zoomed.
 *
 * 3. **Colour is not carrying the meaning.** The interlock has to read with the
 *    palette replaced wholesale, which is what forced-colours mode does. If it
 *    stops reading as a chain there, the shape is doing too little work.
 *
 * THE SIZE STORIES OVERRIDE A TOKEN, which is normally the one thing a story is
 * not allowed to do. The justification is narrow: 16px is not a design decision
 * to be held in a token, it is the size a browser draws a favicon, and a claim
 * about surviving one cannot be tested at 20px.
 */
const meta = {
  title: "Primitives/Mark",
  component: Mark,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: { type: "inline-radio" },
      options: ["sm", "md", "lg"],
      description:
        "Rendered size, in token steps rather than pixels — `ornament.mark.small` (0.875rem), `.base` (1.25rem) and `.large` (1.75rem). It is a HEIGHT: the chain is about twice as wide as it is tall, so the width follows from the `viewBox` rather than being a second number to keep in step with the geometry.",
    },
    variant: {
      control: { type: "inline-radio" },
      options: ["pitch", "ink"],
      description:
        "`pitch` is canonical — the three links carry the three pitch values. It is the one place this system spends the pitch palette on something that is not a pitch value, argued in `docs/DESIGN.md`. `ink` is the alternate for surfaces that cannot take three colours, and it is the more legible of the two when small.",
    },
    title: {
      control: "text",
      description:
        'Accessible name, exposed via `aria-labelledby` rather than a bare `<title>`. It cannot be emptied: a blank or whitespace-only value falls back to `Optfall` rather than through to an unnamed `role="img"`. This is not a visible label and never renders as text.',
    },
    decorative: {
      control: "boolean",
      description:
        "Render the mark as pure decoration — `aria-hidden`, no `role`, no name, no `<title>` child. The supported way to say *presentational* out loud, for the one case where the name is already on the page beside it. Naming and hiding are separate questions; this is the second one.",
    },
  },
} satisfies Meta<typeof Mark>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Set custom properties on the story's own container, and take them off again.
 *
 * The returned cleanup is Storybook's own `beforeEach` teardown, so the removal
 * is guaranteed rather than remembered — a token left overridden would leak into
 * the next story.
 */
function overriding(properties: Record<string, string>) {
  return (context: { canvasElement: HTMLElement }) => {
    const root = context.canvasElement;
    for (const [name, value] of Object.entries(properties)) {
      root.style.setProperty(name, value);
    }
    return () => {
      for (const name of Object.keys(properties)) {
        root.style.removeProperty(name);
      }
    };
  };
}

export const Default: Story = { args: { size: "md" } };

/**
 * THE CLAIM THIS PAGE EXISTS FOR: follow one link across its neighbour.
 *
 * Red passes OVER yellow at their upper crossing and UNDER it at the lower one;
 * yellow does the same across blue. If either pair is over at both, the chain
 * has become a stack and the scopes in `MARK_GEOMETRY` have drifted.
 */
export const Large: Story = { args: { size: "lg" } };

export const Small: Story = { args: { size: "sm" } };

/**
 * The alternate: ink outside, blood in the middle.
 *
 * Worth comparing against `Large` at the same size. `ink` reads better small —
 * two near-white links against a dark ground separate further than red against
 * yellow — which is a real argument for using it on a cramped surface, and not
 * an argument for making it canonical: the pitch mark says what this project is
 * about, and the ink one says only that it has a logo.
 */
export const Ink: Story = { args: { size: "lg", variant: "ink" } };

/**
 * SIXTEEN PIXELS TALL — the size a browser draws a favicon, and the story that
 * settled what the favicon actually is.
 *
 * At this height the three links are a smudge. That is not a defect to fix by
 * thickening the rings; it is a property of a mark twice as wide as it is tall
 * being asked to fit a square. So `favicon.svg.ts` draws ONE link, upright,
 * from `MARK_GEOMETRY.single` — the same path under a different transform, so
 * there is no second drawing to drift.
 *
 * Judge it at 16px. Zooming this story is judging a different question.
 */
export const AtFaviconSize: Story = {
  args: { size: "sm" },
  beforeEach: overriding({ "--of-ornament-mark-small": "16px" }),
};

/**
 * Below the favicon, where it is allowed to fail.
 *
 * The order of failure is the claim: the windows close before the interlock
 * becomes unreadable, and the interlock goes before the silhouette does. If the
 * mark turned into a solid bar here it would mean the ring walls are too thick
 * relative to the windows they enclose.
 */
export const BelowTheFavicon: Story = {
  args: { size: "sm" },
  beforeEach: overriding({ "--of-ornament-mark-small": "10px" }),
};

/**
 * The palette replaced wholesale, which is what forced-colours mode does.
 *
 * Every link collapses to one system ink and the mark still has to read as a
 * chain — the interlock is geometry, so it survives, and this story is how we
 * find out if that stops being true. Colour never carried the meaning here.
 */
export const MonochromeCollapse: Story = {
  args: { size: "lg" },
  beforeEach: overriding({
    "--of-color-pitch-one": "var(--of-color-ink)",
    "--of-color-pitch-two": "var(--of-color-ink)",
    "--of-color-pitch-three": "var(--of-color-ink)",
  }),
};

/**
 * Decoration, for the one case where the name is already on the page.
 *
 * `aria-hidden`, no role, no name. Beside a visible "Optfall" wordmark — the
 * header bar and the front door both do this — announcing the mark's name would
 * make the one link home say itself twice.
 */
export const Decorative: Story = { args: { size: "md", decorative: true } };

/**
 * A name that cannot be crushed.
 *
 * `title="   "` type-checks and would have produced `<title></title>` and an
 * `aria-labelledby` resolving to the empty string — an unnamed `role="img"`,
 * which is the violation the default exists to prevent. A default parameter
 * fires on `undefined` alone, so whitespace falls THROUGH it; the component
 * trims and falls back instead. To hide the mark, use `decorative`.
 */
export const NameCannotBeCrushed: Story = {
  args: { size: "md", title: "   " },
};
