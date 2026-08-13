import type { Meta, StoryObj } from "@storybook/svelte-vite";

import Mark from "./Mark.svelte";

/**
 * The mark is the logo and the pitch jewel's silhouette at once, and its stories
 * are written to attack the one sentence in `docs/DESIGN.md` that the whole form
 * rests on:
 *
 * > Two solids and a hairline, so it survives a favicon. The gap between crown
 * > and pavilion is the whole idea and it is the last thing to disappear at
 * > small sizes.
 *
 * Rendered once at the default size that reads as a confident claim, because
 * nothing has been asked to fail yet. Three things below ask:
 *
 * - **`AtFaviconSize`** renders it at 16px, which is smaller than the smallest
 *   token step and is the size the claim is actually about.
 * - **`BelowTheFavicon`** goes past the point of failure on purpose, because the
 *   *order* of failure is the claim — hairline first, gap last — and you cannot
 *   see an order at a size where nothing has broken.
 * - **`MonochromeCollapse`** removes colour entirely, which is what a
 *   forced-colours mode does. If the mark stops reading as *cleaved* there, then
 *   colour was carrying the meaning and the accent was never merely marking the
 *   break.
 *
 * TWO OF THESE STORIES NAME A PIXEL, which nothing else in this library is
 * allowed to do. They set `--of-ornament-jewel-small` on the story's own
 * container and remove it again when the story unmounts, so nothing leaks into
 * the next story. The justification is narrow: 16px is not a design decision to
 * be held in a token, it is the size a browser draws a favicon, and a claim
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
        "Rendered size, in token steps rather than pixels — `ornament.jewel.small` (1.25rem), `.base` (1.75rem) and `.large` (2.5rem). Only the box changes; the geometry is a `viewBox`, so every proportion below is scale-invariant and the bevel, which is a fixed 1px, is not.",
    },
    title: {
      control: "text",
      description:
        "Accessible name, exposed via `aria-labelledby` rather than a bare `<title>`. It cannot be emptied: a blank or whitespace-only value falls back to `Optfall` rather than through to an unnamed `role=\"img\"`. This is not a visible label and never renders as text.",
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
 * Sets custom properties on the story's own container for the duration of that
 * story, and removes them when it unmounts.
 *
 * Storybook mounts every story into the same canvas element, so a property left
 * behind here would silently resize the *next* component a reviewer looks at —
 * a workbench that lies about the theme is the one failure it must not have.
 * The returned cleanup is Storybook's own `beforeEach` teardown, so the removal
 * is not left to remembering.
 *
 * Typed structurally rather than as `StoryContext` so it stays assignable
 * wherever `beforeEach` is accepted; the container is the only thing it needs.
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

/** The mark as it sits in a header: 1.75rem, named, bevelled. */
export const Default: Story = { args: { size: "md" } };

/**
 * The smallest token step, 1.25rem — 20px, and the smallest size the library
 * itself will ever render. The gap is ~3 of 32 viewBox units, so it is under two
 * device pixels here, while the bevel above and below it is a fixed 1px that did
 * not scale down with the mark. Everything `AtFaviconSize` tests is already
 * beginning here; this is the last size at which it is comfortable.
 */
export const Small: Story = { args: { size: "sm" } };

/**
 * 2.5rem, where the hairline along the pavilion's cut face is unambiguous. Worth
 * looking at immediately before the small sizes: it is the reference for what is
 * *supposed* to be visible, and the only story where all three elements — two
 * solids and the hairline — are comfortably legible at once.
 */
export const Large: Story = { args: { size: "lg" } };

/**
 * THE STORY THIS COMPONENT EXISTS TO PASS. Sixteen device pixels, the size a
 * browser draws a tab icon, and the arithmetic is tight enough to check by eye:
 *
 * - The gap between the crown's parted edge (`1.5,10 → 27.5,11.5`) and the
 *   pavilion's cut face (`2.5,13.5 → 30,15`) is about 3.4 of 32 units —
 *   **1.7px of ground**, and never below 3 units anywhere along the cut.
 * - `--of-bevel-width` is a flat `1px` and does not scale, so the crown's dark
 *   drop-shadow is cast 1px *down* into that gap and the pavilion's light one
 *   1px *up* into it. Two fixed pixels of bevel arriving in 1.5px of ground is
 *   the failure mode, and it is invisible at every larger size.
 * - **Check both themes from the toolbar.** In light, `bevel.light` is
 *   `rgba(255, 255, 255, 0.85)` — nearly opaque, cast upward from the pavilion,
 *   directly across the cut. If the gap survives dark but fills in light, the
 *   claim holds in exactly one of the two modes the product ships.
 *
 * What "survives" means, precisely: ground still visible across the full width
 * of the cut, and the two halves still about 1.5 units out of register at their
 * left and right edges. If it reads as a slotted diamond rather than a cleaved
 * one, `docs/DESIGN.md` is wrong and the geometry has to move — not the story.
 *
 * The shape to judge it against is a DIAMOND: the crown is a narrow cap with
 * the top apex on it, the pavilion keeps the girdle — the widest points, at
 * `y 17.5` — and tapers to the bottom apex. If the fallen half no longer reads
 * as the lower half of a gem, the cleave is in the wrong place.
 */
export const AtFaviconSize: Story = {
  args: { size: "sm" },
  beforeEach: overriding({ "--of-ornament-jewel-small": "16px" }),
};

/**
 * 10px — below anything that ships, and deliberately so. The claim is an
 * *ordering*: the hairline goes first, the gap goes last. An ordering is only
 * observable past the point where the first thing has failed, so this story
 * renders the mark somewhere it is never asked to work in order to read the
 * order off it.
 *
 * Expected: the cleavage hairline is gone or indistinguishable from the
 * pavilion's top edge, and the gap is still there. Any other outcome — the gap
 * closing while the hairline is still visible — inverts the priority the
 * component's own comments assert, and means the bevel, not the geometry, is
 * deciding what the mark looks like when it is small.
 */
export const BelowTheFavicon: Story = {
  args: { size: "sm" },
  beforeEach: overriding({ "--of-ornament-jewel-small": "10px" }),
};

/**
 * The forced-colours case, simulated: the accent is redefined to the ink, so
 * crown, pavilion and cleave are one colour and the mark has exactly the
 * information a Windows High Contrast user gets. (The component's real
 * `@media (forced-colors: active)` block does the same thing with `CanvasText`
 * and additionally drops the bevel; this reproduces it in a mode you can
 * actually toggle on a Mac.)
 *
 * The claim under test is `Mark.svelte`'s: *"the gap survives with no colour at
 * all, and colour never carried the meaning here."* If the mark reads as one
 * solid octagon with a slot in it, the accent was doing structural work rather
 * than marking the break.
 */
export const MonochromeCollapse: Story = {
  args: { size: "md" },
  beforeEach: overriding({ "--of-color-accent": "var(--of-color-ink)" }),
};

/**
 * The mark beside a visible "Optfall" wordmark, where announcing the name a
 * second time is noise. `aria-hidden`, no `role`, no `<title>` child at all.
 *
 * This is the story the a11y addon should have *nothing* to say about: a
 * hidden image is not an unnamed one, and `svg-img-alt` must not fire here. It
 * is also the only supported way to silence the mark — `title=""` is not, and
 * the story below is why.
 */
export const Decorative: Story = { args: { size: "md", decorative: true } };

/**
 * A whitespace-only name, which is what a caller reaching for "no name" tends to
 * write, and what a template interpolating a missing string produces on its own.
 *
 * It must render as **Optfall**. The failure it guards against type-checked
 * perfectly well: a default parameter fires on `undefined` alone, so a blank
 * string reached `<title></title>` and an `aria-labelledby` resolving to nothing
 * — an unnamed `role="img"`, on the one element in the system that is never
 * allowed to be unnamed. Inspect the accessible name; the rendering is identical
 * either way, which is exactly what made it survivable.
 */
export const NameCannotBeCrushed: Story = {
  args: { size: "md", title: "   " },
};
