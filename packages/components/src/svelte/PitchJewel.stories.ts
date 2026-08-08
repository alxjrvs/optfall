import type { Meta, StoryObj } from "@storybook/svelte-vite";

import PitchJewel from "./PitchJewel.svelte";

/**
 * The pitch jewel is the library's flagship, and its stories are written to
 * exercise the accessibility claim rather than to look tidy.
 *
 * `docs/DESIGN.md` stakes the whole design on shape, numeral and colour stating
 * the same fact three times, with the NUMERAL as the primary channel. The
 * stories below therefore include every value at every size — because the
 * failure this component exists to prevent is a numeral that stops being
 * legible at 1.25rem, which no amount of reviewing the default size finds.
 */
const meta = {
  title: "Primitives/PitchJewel",
  component: PitchJewel,
  tags: ["autodocs"],
  argTypes: {
    value: {
      control: { type: "inline-radio" },
      options: [0, 1, 2, 3],
      description: "0 is a card with no pitch value at all.",
    },
    size: { control: { type: "inline-radio" }, options: ["sm", "md", "lg"] },
    label: { control: "text" },
  },
  // `typeof PitchJewel`, not `PitchJewel`. Under Svelte 5 a component is a
  // function, so using the import bare as a TYPE resolves to svelte2tsx's
  // legacy class shim — `{ $on?, $set? }` — and `Meta` then infers THOSE as the
  // story args. The component becomes unassignable and every real prop in
  // `argTypes` is rejected as "does not exist". One token's difference, and it
  // fails in a way that points at the wrong line.
} satisfies Meta<typeof PitchJewel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const One: Story = { args: { value: 1 } };
export const Two: Story = { args: { value: 2 } };
export const Three: Story = { args: { value: 3 } };

/** A card with no pitch value — an absence, and it reads as one. */
export const NoPitchValue: Story = { args: { value: 0 } };

export const Small: Story = { args: { value: 3, size: "sm" } };
export const Large: Story = { args: { value: 3, size: "lg" } };

/**
 * Pitch one, next to {@link Two} in the sidebar deliberately.
 *
 * Red and yellow are the classic deuteranopia confusion pair, and pitch is the
 * most-read value on a card. Switching between these two stories is the manual
 * version of the assertion in `packages/theme/src/tokens.test.ts`: the numeral
 * and the luminance step should each separate them before hue is considered at
 * all. If you can only tell them apart by hue, the palette has regressed and
 * the test that should have caught it is wrong.
 */
export const TheConfusionPair: Story = { args: { value: 1 } };
