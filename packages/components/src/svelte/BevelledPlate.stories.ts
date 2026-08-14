import type { Meta, StoryObj } from "@storybook/svelte-vite";
import type { ComponentProps, Snippet } from "svelte";
import { createRawSnippet, mount, unmount } from "svelte";

import type { PlateCorner } from "../index";
import BevelledPlate from "./BevelledPlate.svelte";
import FiligreeCorner from "./FiligreeCorner.svelte";

/**
 * The plate is the one primitive whose entire subject is invisible in isolation.
 *
 * A pitch jewel is wrong on its own — a wrong numeral, a wrong colour, and you
 * can see it in one story. A plate is only ever wrong *relative to another
 * plate*: `raised` and `sunken` are claimed to invert each other's bevel, an
 * edge dropped from `edges` is claimed to fall back to a hairline rather than
 * vanish, and nesting is claimed to be cheap enough that a page of plates does
 * not become a stack of boxes. Every one of those is a comparison, and a
 * reviewer looking at one plate has to take all three on trust.
 *
 * So most of the stories below render several plates at once. That is not
 * decoration: it is the only arrangement in which the claims can fail visibly.
 * If `sunken` were merely `raised` with a darker face, `Depth` would show it. If
 * an omitted edge lost its border entirely, `Edges` would show a plate with two
 * sides and open ends. If the ornament hook drew anything itself, `SlotsOnly`
 * would show scrollwork with no `corner` snippet supplied.
 *
 * HOW THE COMPOSITION WORKS. `.storybook/main.ts` fixes the stories format as
 * plain CSF in TypeScript, so `children` and `corner` — which are Svelte
 * snippets — are built with `createRawSnippet` and, where a snippet has to
 * contain a component rather than markup, `mount`. That is more machinery than
 * a `.stories.svelte` file would need, and it buys the thing the plan asked for
 * instead: these files are checked by the same `svelte-check` pass as the
 * components, so a story passing a prop the contract no longer has fails the
 * build rather than the browser.
 */

/* -------------------------------------------------------------------------- */
/* Composition helpers                                                         */
/* -------------------------------------------------------------------------- */

type PlateProps = ComponentProps<typeof BevelledPlate>;

interface Specimen {
  /** Named under the plate, so a side-by-side is readable without the source. */
  readonly caption?: string;
  /** Writing direction to impose on this cell. Only `RightToLeft` uses it. */
  readonly dir?: "rtl";
  /**
   * BCP 47 tag for the cell's contents, set whenever that content is not in the
   * page's language. A workbench that models a language change without
   * declaring one is teaching the wrong lesson to everything that copies it.
   */
  readonly lang?: string;
  readonly props: PlateProps;
}

/*
 * Every length and colour below is a token, exactly as it would have to be in a
 * component. `scripts/check-tokens.ts` globs `.svelte`/`.astro`/`.css` and so
 * never reads this file — which makes it the easy place to start writing
 * literals and then copying them into a component. Not starting is cheaper.
 */
const STACK = "display:grid;gap:var(--of-space-loose)";
const CELL = "display:grid;gap:var(--of-space-tight);align-content:start";
const PROSE =
  "margin:0;font-family:var(--of-type-family-sans);" +
  "font-size:var(--of-type-size-base);line-height:var(--of-type-leading-base)";
const CAPTION =
  "margin:0;font-family:var(--of-type-family-sans);" +
  "font-size:var(--of-type-size-micro);letter-spacing:var(--of-type-tracking-wide);" +
  "text-transform:uppercase;color:var(--of-color-ink-muted)";

/** `space.loose` between specimens, laid out along one axis, equal tracks. */
const track = (flow: "row" | "column"): string =>
  "display:grid;gap:var(--of-space-loose);" +
  (flow === "row"
    ? "grid-auto-flow:column;grid-auto-columns:1fr"
    : "grid-auto-flow:row");

/**
 * Plate contents: a line of prose, then zero or more nested plates.
 *
 * The nested plates are mounted in `setup` rather than written into the HTML
 * string, because `createRawSnippet` renders markup and a `BevelledPlate` is a
 * component. Mounting is what lets a story compose the real primitive — which
 * is the whole point of a side-by-side — instead of a hand-written imitation of
 * it that could agree with the component's documentation and disagree with the
 * component.
 */
function contents(
  prose: string,
  flow: "row" | "column" = "column",
  specimens: readonly Specimen[] = [],
): Snippet {
  return createRawSnippet<[]>(() => ({
    render: () =>
      (
        `<div style="${STACK}">` +
        (prose ? `<p style="${PROSE}">${prose}</p>` : "") +
        (specimens.length > 0
          ? `<div style="${track(flow)}">` +
            specimens
              .map(
                (specimen) =>
                  `<div${specimen.dir ? ` dir="${specimen.dir}"` : ""}` +
                  `${specimen.lang ? ` lang="${specimen.lang}"` : ""}` +
                  ` style="${CELL}">` +
                  `<div data-specimen></div>` +
                  (specimen.caption
                    ? `<p style="${CAPTION}">${specimen.caption}</p>`
                    : "") +
                  `</div>`,
              )
              .join("") +
            `</div>`
          : "") +
        `</div>`
      ).trim(),
    setup: (element) => {
      const slots = [...element.querySelectorAll("[data-specimen]")];
      const mounted = specimens.flatMap((specimen, index) => {
        const target = slots[index];
        return target
          ? [mount(BevelledPlate, { target, props: specimen.props })]
          : [];
      });
      return () => {
        for (const instance of mounted) void unmount(instance);
      };
    },
  }));
}

/**
 * The `corner` snippet, composed the way `BevelledPlate` and `FiligreeProps`
 * both prescribe: the plate places and sizes four slots, this fills each one
 * with a drawing and passes on the id it was handed.
 *
 * Passing `corner={id}` rather than letting it default is the load-bearing
 * detail. Every slot would otherwise get `start-start`, and three of the four
 * corners would curl out of the frame instead of into it — which is precisely
 * the failure the shared `PlateCorner` type exists to make impossible, and it
 * is only visible if a story actually renders all four.
 */
const filigree: Snippet<[PlateCorner]> = createRawSnippet<[PlateCorner]>(
  (id) => ({
    render: () =>
      `<span style="display:block;inline-size:100%;block-size:100%"></span>`,
    setup: (element) => {
      const instance = mount(FiligreeCorner, {
        target: element,
        props: { role: "panel-corner", corner: id() },
      });
      return () => void unmount(instance);
    },
  }),
);

/* -------------------------------------------------------------------------- */
/* Meta                                                                        */
/* -------------------------------------------------------------------------- */

const meta = {
  title: "Primitives/BevelledPlate",
  component: BevelledPlate,
  tags: ["autodocs"],
  argTypes: {
    emphasis: {
      control: { type: "inline-radio" },
      options: ["flat", "raised", "sunken"],
      description:
        "Depth of the strike. `raised` and `sunken` invert each other's bevel; `flat` is the substrate and costs one hairline. Material, never meaning — see `Depth`.",
    },
    edges: {
      control: { type: "check" },
      options: ["top", "bottom"],
      description:
        "Which block edges carry the bevel highlight. Omitting one drops it to the hairline rule rather than removing it: a plate always has a boundary. Defaults to both.",
    },
    ornament: {
      control: { type: "inline-radio" },
      options: [undefined, "panel-corner"],
      description:
        "Opens four ornament-sized corner slots and widens the padding to clear them. It draws nothing — supply `corner` — and belongs only on a feature panel.",
    },
    children: {
      control: false,
      description:
        "Plate contents. The semantics of the region live in here: the plate renders a bare `div` with no role and no accessible name, because chrome is not information.",
    },
    corner: {
      control: false,
      description:
        'Rendered once per slot when `ornament="panel-corner"`, receiving the `PlateCorner` id. Intended for `FiligreeCorner role="panel-corner" corner={id}`.',
    },
  },
  // `typeof BevelledPlate`, not `BevelledPlate`. Under Svelte 5 a component is a
  // function, and using it bare as a TYPE resolves to svelte2tsx's legacy class
  // shim — `{ $on?, $set? }` — so `Meta` infers those as the args and rejects
  // every real prop below. `PitchJewel.stories.ts` writes it the bare way and
  // fails `svelte-check` for exactly this reason; it is a one-token fix in that
  // file, not a reason to copy the spelling here.
} satisfies Meta<typeof BevelledPlate>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* Stories                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The default, and the controls playground. Flat, both edges bevelled — the
 * substrate almost every region of the product sits on.
 */
export const Flat: Story = {
  args: {
    emphasis: "flat",
    children: contents(
      "The plate is what replaces the card: a hairline and a bevel where a lesser system would spend a shadow, a radius and twenty-four pixels of padding.",
    ),
  },
};

/**
 * The story the component exists for.
 *
 * `emphasis` is the one prop nobody can review in a single state — a lone
 * `sunken` plate looks like a plate. Three abreast, two claims become checkable
 * at a glance: the faces step `sunken` → `flat` → `raised` in tone, and the
 * bevels of the outer two are mirror images, light falling on the far edge of
 * the sunken plate and the near edge of the raised one. If `sunken` were only a
 * darker face — the obvious wrong implementation — the tone step would still be
 * here and the inversion would not.
 *
 * The ground they sit on is itself a flat plate, which is the cheap-nesting
 * claim being made in passing: four plates on screen, and the boundary between
 * each is a single rule.
 */
export const Depth: Story = {
  args: {
    emphasis: "flat",
    children: contents(
      "Depth is a comparison, so it is shown as one. Light comes from above in all three.",
      "row",
      [
        {
          caption: "sunken",
          props: {
            emphasis: "sunken",
            children: contents("Below the ground. Shadow on the near edge."),
          },
        },
        {
          caption: "flat",
          props: {
            emphasis: "flat",
            children: contents(
              "The substrate. One hairline deep, no inner ring.",
            ),
          },
        },
        {
          caption: "raised",
          props: {
            emphasis: "raised",
            children: contents("Proud of the ground. Light on the near edge."),
          },
        },
      ],
    ),
  },
};

/**
 * `edges` promotes an edge to the bevel; it does not create or destroy the
 * border. Four plates, from both edges bevelled to neither, and the thing to
 * check is what the last one is NOT: a borderless div. A plate with no boundary
 * would be a div, and this system separates regions with rules rather than with
 * whitespace — so the fourth specimen must still be a complete rectangle, drawn
 * in `color.rule` on every side.
 *
 * These are `flat` deliberately. On `raised` the inset ring is drawn by
 * `emphasis` rather than by `edges`, so it survives every setting here and would
 * mask exactly the difference the story is asking about.
 */
export const Edges: Story = {
  args: {
    emphasis: "flat",
    children: contents(
      "An edge left out of `edges` falls back to the hairline rule. None of these four is missing a border.",
      "row",
      [
        {
          caption: "top + bottom",
          props: {
            edges: ["top", "bottom"],
            children: contents("The default."),
          },
        },
        {
          caption: "top",
          props: {
            edges: ["top"],
            children: contents("Lit above, ruled below."),
          },
        },
        {
          caption: "bottom",
          props: {
            edges: ["bottom"],
            children: contents("Ruled above, dark below."),
          },
        },
        {
          caption: "none",
          props: {
            edges: [],
            children: contents("Four hairlines. Still a plate."),
          },
        },
      ],
    ),
  },
};

/**
 * Three deep: raised, holding sunken, holding flat.
 *
 * The plate's own documentation stakes a claim it cannot demonstrate alone — it
 * "has to be cheap enough to nest without the page turning into a stack of
 * boxes". This is the story that would expose the opposite. Count the rules
 * between the outermost face and the innermost text: if nesting cost a shadow
 * and a radius, or if `flat` carried an inner ring, this would read as three
 * boxes with a gutter between each rather than as one panel with regions inside
 * it.
 *
 * It also shows the intended use of `sunken`: a quoted or inset region, where
 * the depth says "this came from somewhere else" without any colour being asked
 * to mean it.
 */
export const Nested: Story = {
  args: {
    emphasis: "raised",
    children: contents(
      "A ruling, with the rule it rests on quoted inside it.",
      "column",
      [
        {
          props: {
            emphasis: "sunken",
            children: contents(
              "A sunken region reads as quoted material.",
              "column",
              [
                {
                  props: {
                    emphasis: "flat",
                    children: contents(
                      "And flat inside that costs exactly one more rule.",
                    ),
                  },
                },
              ],
            ),
          },
        },
      ],
    ),
  },
};

/**
 * The composition the ornament hook exists for, written out in full.
 *
 * `BevelledPlate` opens four slots and passes each one its `PlateCorner` id;
 * `FiligreeCorner` draws the motif and mirrors it to face inward. Neither knows
 * what the other does, which is the contract, and the check is the drawing: all
 * four volutes must curl into the panel and all four must be lit from above. An
 * earlier version of the ornament nested its relief pass inside the mirror, and
 * the two bottom corners came out lit from below — a bug that is invisible on
 * `start-start` and obvious the moment a story renders the set.
 *
 * Note the padding: `ornament="panel-corner"` widens it to `space.loosest`, so
 * the first line of the panel clears its own scrollwork. That is the plate
 * paying for the ornament it hosts.
 */
export const FeaturePanel: Story = {
  args: {
    emphasis: "raised",
    ornament: "panel-corner",
    corner: filigree,
    children: contents(
      "Filigree earns exactly three roles, and this is one of them: the corners of a feature panel. Never on a control, never on a list, never twice on one screen.",
    ),
  },
};

/**
 * The same panel with the `corner` snippet withheld.
 *
 * This is the story that proves the split rather than asserting it. If any
 * scrollwork appears here, the plate is drawing ornament it claims only to
 * host — and rationing filigree at the call site, which is the entire reason
 * the hook is a snippet instead of a boolean, would be a fiction. What should
 * be visible is only the consequence the plate does own: the padding has still
 * widened to `space.loosest`, because the slots are open whether or not anyone
 * filled them.
 */
export const SlotsOnly: Story = {
  args: {
    emphasis: "raised",
    ornament: "panel-corner",
    children: contents(
      "Four slots, opened and sized, with nothing rendered into them. The plate hosts the ornament; it never draws it.",
    ),
  },
};

/**
 * Right-to-left, beside the same panel left-to-right.
 *
 * The plate is written in logical properties throughout and the corner ids are
 * named on the block/inline axes rather than as `top-left`, both on the stated
 * grounds that a plate flips with writing direction and its ornament flips with
 * it. Nothing about that claim is checkable in one direction. Here it is:
 * the bevel must stay light-above-dark-below in both — depth follows the light
 * source, which does not care about writing direction — while the ornament must
 * mirror, so that `start-start` sits top-right under RTL and its volute still
 * curls inward.
 *
 * Two ornamented panels on one screen is exactly what `docs/DESIGN.md` forbids,
 * and the exception is deliberate: a workbench that cannot put the two cases
 * side by side cannot check them. Never ship this arrangement.
 */
export const RightToLeft: Story = {
  args: {
    emphasis: "flat",
    children: contents("The bevel does not flip. The ornament does.", "row", [
      {
        caption: "dir=ltr",
        props: {
          emphasis: "raised",
          ornament: "panel-corner",
          corner: filigree,
          children: contents(
            "Scrollwork curls in from the inline-start corners.",
          ),
        },
      },
      {
        caption: "dir=rtl",
        dir: "rtl",
        lang: "ar",
        props: {
          emphasis: "raised",
          ornament: "panel-corner",
          corner: filigree,
          children: contents("الزخرفة تنعكس مع اتجاه الكتابة."),
        },
      },
    ]),
  },
};
