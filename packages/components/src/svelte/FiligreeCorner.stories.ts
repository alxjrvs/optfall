import type { Meta, StoryObj } from "@storybook/svelte-vite";
import { createRawSnippet, mount, type Component } from "svelte";
import { ORNAMENT_ROLES, cssValue, type OrnamentRole } from "optfall-theme";

import BevelledPlate from "./BevelledPlate.svelte";
import FiligreeCorner from "./FiligreeCorner.svelte";
import OrnamentalRule from "./OrnamentalRule.svelte";
import { PLATE_CORNERS, type FiligreeProps, type PlateCorner } from "../index";

/**
 * Filigree is rationed, and these stories are the ration made executable.
 *
 * `docs/DESIGN.md`: scrollwork "earns a place in exactly three roles: the
 * corners of a feature panel, the corners of a card frame, and a section rule.
 * Never on a control, never on a list, never twice on one screen." Everywhere
 * else that sentence is prose — a rule kept by a code-review habit. Here it is
 * a countable thing: **there are exactly three role stories below, and there
 * will never be a fourth**, because a fourth would mean the ornament had been
 * spent on something the design language does not sanction. The `role` control
 * is populated from `ORNAMENT_ROLES` itself rather than from a literal list, so
 * the workbench cannot offer a role the type has not sanctioned either.
 *
 * The three roles are also *hosted differently*, which is the second reason
 * each gets its own story rather than one story with a control flipped.
 * `FiligreeCorner` draws scrollwork and owns no layout: in the corner roles it
 * fills a slot the host placed and sized, and in `section-rule` it emits a bare
 * figure with no lines and no rhythm of its own. **An unhosted filigree is
 * therefore a picture of something the product will never render**, which is
 * exactly the review that let two earlier versions ship the layout collisions
 * recorded in the component's own header. So every story below mounts the
 * ornament inside a real host — `BevelledPlate` for the panel, `OrnamentalRule`
 * for the rule, and a hand-built frame for the card, because the card-frame
 * primitive does not exist yet.
 *
 * That last one is deliberate rather than a stopgap. The claim under test is
 * "the host owns placement and size"; a story that only ever used `BevelledPlate`
 * could not tell that claim apart from `FiligreeCorner` having been fitted to
 * `BevelledPlate` specifically. The card frame is a second, unrelated host at a
 * different size, so if the drawing secretly owned any layout, this is the
 * story where it would come apart.
 *
 * Every `role` control is live in every story, including the ones where the
 * answer is wrong on purpose. Dropping a `panel-corner` into a card-sized slot,
 * or a corner role into the rule's centre gap, is how a reviewer sees *why* the
 * roles are three separate values instead of one drawing scaled three ways.
 *
 * **Why the snippet machinery.** `.storybook/main.ts` runs plain CSF in
 * TypeScript rather than `.stories.svelte`, so there is no template syntax here
 * to write `{#snippet}` in — and both hosts take their ornament as a snippet,
 * precisely so the call site rations it. `createRawSnippet` is the supported
 * way to build one from a `.ts` file: it supplies the slot element, and the
 * real component is mounted into it, so these stories exercise the same
 * composition the docs prescribe rather than a story-only shortcut.
 *
 * There are no accessibility stories, and that absence is the point. The svg is
 * `aria-hidden` and `focusable="false"` unconditionally in all three roles,
 * there is no label prop to get wrong, and no story can put this component in
 * the accessibility tree. The a11y addon runs over all of these anyway — what
 * it should find is that removing every ornament here costs no information.
 */
const meta = {
  title: "Primitives/FiligreeCorner",
  component: FiligreeCorner,
  tags: ["autodocs"],
  argTypes: {
    role: {
      control: { type: "inline-radio" },
      options: ORNAMENT_ROLES,
      description:
        "Which of the three sanctioned roles this is. Required, with no default: 'wherever you happen to have dropped it' is not one of the three. Panel and card draw the same motif with fewer members and a thinner stroke on the card; section-rule is a different figure entirely.",
      table: { type: { summary: '"panel-corner" | "card-corner" | "section-rule"' } },
    },
    corner: {
      control: { type: "inline-radio" },
      options: PLATE_CORNERS,
      description:
        "Which corner of the frame this instance draws, in CSS logical order — block axis first, then inline. It selects the mirroring of the motif and nothing else; the host slot supplies the position. Ignored in the section-rule role.",
      table: { defaultValue: { summary: "start-start" } },
    },
  },
} satisfies Meta<typeof FiligreeCorner>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* Hosting                                                                     */
/* -------------------------------------------------------------------------- */

/** What a `render` has to hand back: a component, and props for it. */
interface Framed {
  Component: Component<FiligreeProps>;
  props: FiligreeProps;
}

/**
 * Renders `component` with `props` as this story's output.
 *
 * THE ONE CAST IN THIS FILE, AND IT IS THE STORYBOOK TYPES RATHER THAN THE
 * COMPOSITION. `SvelteStoryResult` is parameterised by the story's own args, so
 * the renderer's types assume every story renders the meta's component with the
 * meta's props. That assumption does not survive a primitive whose entire
 * contract is that a *different* component hosts it — which is every story
 * below. Runtime is unaffected: the renderer mounts whatever `Component` it is
 * given and passes `props` straight through.
 *
 * The cast is confined here so the interesting half stays checked: `P` is
 * inferred from the host, so `props` is verified against `BevelledPlate`'s and
 * `OrnamentalRule`'s real prop types, and a story that passed `ornament="card"`
 * to a plate, or a snippet with the wrong arity, still fails the build.
 */
function frame<P extends Record<string, any>>(
  component: Component<P, any, any>,
  props: NoInfer<P>,
): Framed {
  return { Component: component, props } as unknown as Framed;
}

/**
 * Fills the slot the host handed us, so the drawing inherits the host's size
 * rather than asserting one. `100%` twice and nothing else — the moment this
 * string carries a length, the story has started making the layout decisions
 * the component is being tested for not making.
 */
const SLOT_FILL = '<span style="display:block;inline-size:100%;block-size:100%"></span>';

/**
 * One ornament per corner slot, mirrored by the id the host passes in.
 *
 * `only` fills a single slot and leaves the other three empty, which is what
 * makes the `corner` control mean something: one drawing that moves, rather
 * than four that all change at once.
 */
function cornersOf(role: OrnamentRole, only?: PlateCorner) {
  return createRawSnippet<[PlateCorner]>((corner) => ({
    render: () => SLOT_FILL,
    setup: (slot) => {
      const id = corner();
      if (only !== undefined && id !== only) return;
      mount(FiligreeCorner, { target: slot, props: { role, corner: id } });
    },
  }));
}

/**
 * The occupant of `OrnamentalRule`'s centre gap. `display: contents` so the svg
 * itself becomes the flex item the rule centres — a wrapper with a box of its
 * own would be this story quietly supplying the layout again.
 */
function ruleFigure(role: OrnamentRole) {
  return createRawSnippet<[]>(() => ({
    render: () => '<span style="display:contents"></span>',
    setup: (gap) => {
      mount(FiligreeCorner, { target: gap, props: { role } });
    },
  }));
}

/** Static markup for a host's `children` — text, so the panel has a body. */
function markup(html: string) {
  return createRawSnippet<[]>(() => ({ render: () => html }));
}

const PANEL_BODY =
  `<p style="margin:0;font-family:${cssValue("type.family.serif")};` +
  `font-size:${cssValue("type.size.title")};line-height:${cssValue("type.leading.tight")};` +
  `color:${cssValue("color.ink")}">Command and Conquer, meeting Sink Below</p>`;

/**
 * The card frame the library does not have yet: four slots, placed and sized at
 * ONE ornament step where `BevelledPlate` gives a feature panel two. Written
 * out longhand because the size difference is half of what separates
 * `card-corner` from `panel-corner` — the other half is the drawing, and a
 * story that used the panel's slots would show only one of the two.
 */
function cardFrame(role: OrnamentRole) {
  const size = cssValue("ornament.filigree.size");
  const slots = PLATE_CORNERS.map((id) => {
    const [block, inline] = id === "start-start"
      ? ["start", "start"]
      : id === "start-end"
        ? ["start", "end"]
        : id === "end-start"
          ? ["end", "start"]
          : ["end", "end"];
    return (
      `<span data-slot style="position:absolute;inset-block-${block}:0;` +
      `inset-inline-${inline}:0;inline-size:${size};block-size:${size}"></span>`
    );
  }).join("");

  const label =
    `font-family:${cssValue("type.family.sans")};` +
    `font-size:${cssValue("type.size.micro")};` +
    `letter-spacing:${cssValue("type.tracking.wide")};` +
    `text-transform:uppercase;color:${cssValue("color.ink.muted")}`;

  return createRawSnippet<[]>(() => ({
    render: () =>
      `<div style="position:relative;display:grid;gap:${cssValue("space.tighter")};` +
      `padding:${cssValue("space.looser")};` +
      `border:${cssValue("bevel.width")} solid ${cssValue("color.rule")};` +
      `background:${cssValue("color.surface.raised")};` +
      `color:${cssValue("color.ink")};inline-size:100%">` +
      `<span style="font-family:${cssValue("type.family.serif")};` +
      `font-size:${cssValue("type.size.large")}">Command and Conquer</span>` +
      `<span style="${label}">Attack Action — Warrior</span>` +
      slots +
      `</div>`,
    setup: (card) => {
      const mounted = card.querySelectorAll("[data-slot]");
      PLATE_CORNERS.forEach((id, index) => {
        const slot = mounted[index];
        if (slot) mount(FiligreeCorner, { target: slot, props: { role, corner: id } });
      });
    },
  }));
}

/* -------------------------------------------------------------------------- */
/* The three sanctioned roles                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Role one: the corners of a feature panel, composed exactly as
 * `BevelledPlate`'s own documentation prescribes — the plate opens four slots
 * and passes each its id, and one `FiligreeCorner` draws one ornament.
 *
 * All four are shown together because the bug this replaced was only visible in
 * the assembly: the relief pass sits *outside* the mirror transform, so light
 * comes from above in every corner. Nested the other way round, the two
 * `end-*` corners would carry their bevel upside down and light the plate from
 * below on half the panel — invisible in any single-corner story, and obvious
 * here. Compare the top pair against the bottom pair; the light edge should be
 * above the ink in all four.
 *
 * Switch `role` to `card-corner` to see the lighter hand at panel size: fewer
 * members, and a stroke that is relatively *thicker* once the smaller viewBox
 * is scaled up to a panel's slot. That is why the card role is a separate
 * drawing rather than the same one scaled down.
 */
export const PanelCorner: Story = {
  args: { role: "panel-corner" },
  render: ({ role }: FiligreeProps) =>
    frame(BevelledPlate, {
      emphasis: "raised",
      ornament: "panel-corner",
      corner: cornersOf(role),
      children: markup(PANEL_BODY),
    }),
};

/**
 * Role two: the corners of a card frame — the lighter hand, at one ornament
 * step rather than two.
 *
 * The host here is hand-built rather than a library primitive, and that is the
 * story's whole value. `FiligreeCorner` claims to own no layout and to fill
 * whatever slot it is given; a frame that is not `BevelledPlate`, at half the
 * slot size, is the test of that claim. If any position, inset or length had
 * crept back into the component, the ornaments would land somewhere other than
 * these four corners.
 *
 * A card is one of many on a results page, which is why this role exists at
 * all: filigree at panel weight around every card would be the "never on a
 * list" failure arriving by another route. Switch `role` to `panel-corner` to
 * watch that happen — the heavier motif crammed into a card-sized slot is
 * precisely the thing the ration forbids.
 */
export const CardCorner: Story = {
  args: { role: "card-corner" },
  render: ({ role }: FiligreeProps) =>
    frame(BevelledPlate, { emphasis: "flat", children: cardFrame(role) }),
};

/**
 * Role three: the section rule, hosted by `OrnamentalRule`.
 *
 * The division of labour is the thing to check, because both components were
 * built to the same three-role ration and each concluded it owned this one.
 * `OrnamentalRule` owns the `<hr>`, both hairlines and the vertical rhythm;
 * this component contributes a bare figure. **Count the hairlines: there
 * should be exactly two, at one weight, on one baseline.** Four lines at two
 * weights is the regression, and it is what following both components'
 * composition instructions used to produce.
 *
 * Switch `role` to either corner value to see why `section-rule` is not just a
 * third mirroring: the corner roles size themselves to a slot they have not
 * been given here, and the rule's centre gap is not a slot.
 */
export const SectionRule: Story = {
  args: { role: "section-rule" },
  render: ({ role }: FiligreeProps) =>
    frame(OrnamentalRule, { ornament: true, filigree: ruleFigure(role) }),
};

/* -------------------------------------------------------------------------- */
/* The claims the three role stories cannot show                               */
/* -------------------------------------------------------------------------- */

/**
 * One slot filled and three left empty, so the `corner` control moves a single
 * ornament instead of changing four at once.
 *
 * This is the story that makes the mirroring legible. `corner` selects the
 * mirroring of the motif and nothing else — the slot the drawing lands in is
 * the plate's, and it does not move. Step through the four values: the volute
 * should always curl *into* the panel, and the ornament should never leave the
 * corner it was handed.
 */
export const SingleCorner: Story = {
  args: { role: "panel-corner", corner: "start-end" },
  render: ({ role, corner }: FiligreeProps) =>
    frame(BevelledPlate, {
      emphasis: "raised",
      ornament: "panel-corner",
      corner: cornersOf(role, corner ?? "start-start"),
      children: markup(PANEL_BODY),
    }),
};

/**
 * The panel under `dir="rtl"`, which is the one condition that can take the
 * assembly apart without any prop changing.
 *
 * `BevelledPlate` places its slots with logical insets, so under RTL the four
 * of them swap across the inline axis on their own. The drawing does not follow
 * — a mirrored motif in a swapped slot curls *out* of its own frame, which
 * looks like a rendering bug and is really a missing rule. `FiligreeCorner`
 * answers with `.corner:dir(rtl) { transform: scaleX(-1) }`, and this story is
 * how you find out whether that rule is still there.
 *
 * Compare against `PanelCorner`: the two should be mirror images of each other,
 * with every scroll still curling inward and the light edge still above the ink
 * in all four corners.
 */
export const RightToLeft: Story = {
  args: { role: "panel-corner" },
  beforeEach: () => {
    document.documentElement.setAttribute("dir", "rtl");
    return () => document.documentElement.removeAttribute("dir");
  },
  render: ({ role }: FiligreeProps) =>
    frame(BevelledPlate, {
      emphasis: "raised",
      ornament: "panel-corner",
      corner: cornersOf(role),
      children: markup(PANEL_BODY),
    }),
};
