import type { Meta, StoryObj } from "@storybook/svelte-vite";

import Citation from "./Citation.svelte";

/**
 * The citation is the thing you paste into an argument to end it, so these
 * stories are written to attack the *paste*, not to admire the plate.
 *
 * `docs/DESIGN.md` makes three claims this primitive is the definitive use of:
 * every view is a URL, mono means citable, and colour is never the only
 * channel. Each of those is falsifiable, and each has a story below that fails
 * visibly if it stops being true — an identifier that comes back from the
 * clipboard in the wrong case, a version separator pointing at nothing, a
 * focus ring that a keyboard user cannot find, a `<span>` wearing a link's
 * clothes.
 *
 * Two checks the args cannot perform for you, both one gesture long:
 *
 * - **Right-click → "Copy Link Address"** on any story. If nothing is offered,
 *   this stopped being an `<a>` and the permalink stopped being the product.
 * - **Paste the identifier back** after a single click on it (`user-select:
 *   all` selects the whole id). It must match the printed text character for
 *   character, casing included.
 */
const meta = {
  title: "Primitives/Citation",
  component: Citation,
  tags: ["autodocs"],
  argTypes: {
    ruleId: {
      control: "text",
      description:
        "Permanent rule identifier, e.g. `cr:8.3.4b`. Required — it is the visible text *and* the accessible name, so there is no way to render a nameless citation. Casing is preserved verbatim: `8.3.4b` and `8.3.4B` are different rules.",
    },
    href: {
      control: "text",
      description:
        "Permalink to the addressable section. Required, and it is a real `href` on a real `<a>` — middle click, ⌘-click, browser focus order and \"copy link address\" all come from that and are unrecoverable without it.",
    },
    version: {
      control: "text",
      description:
        "Optional document version the citation was read from. Rendered as a subordinate segment after a `·` separator, with a visually hidden \"version\" so it survives a screen reader. Omitted — or set to `\"\"` / whitespace — the separator and the segment are not rendered at all.",
    },
  },
} satisfies Meta<typeof Citation>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The canonical shape: a versioned rule citation, the exact string a judge
 * pastes into Discord. Note the two-channel treatment of the version — muted
 * ink *and* a separator glyph *and* a smaller size — so it still reads as
 * subordinate in monochrome print or forced-colours mode, where the colour
 * channel is simply gone.
 */
export const Default: Story = {
  args: {
    ruleId: "cr:8.3.4b",
    href: "https://optfall.com/cr/8.3.4b?v=2.11.0",
    version: "2.11.0",
  },
};

/**
 * No version — a citation to the rule as it stands, rather than as it stood.
 *
 * Compare against `Default`: the separator must vanish with the version rather
 * than trailing after the identifier. A `·` with nothing after it is the visual
 * tell that the version was rendered conditionally but the separator was not.
 */
export const Unversioned: Story = {
  args: {
    ruleId: "cr:8.3.4b",
    href: "https://optfall.com/cr/8.3.4b",
  },
};

/**
 * `version=""` — the shape a record that has not been versioned yet actually
 * arrives in, and the one a truthiness check gets subtly wrong.
 *
 * This must render identically to `Unversioned`. If a separator, a gap, or a
 * stray `·` appears here, an unversioned record is printing a pointer at
 * nothing. A whitespace-only version is the same case and is treated the same.
 */
export const BlankVersionIsAbsent: Story = {
  args: {
    ruleId: "cr:8.3.4b",
    href: "https://optfall.com/cr/8.3.4b",
    version: "   ",
  },
};

/**
 * The deliberate departure from the mono voice, isolated so it can be checked.
 *
 * `docs/DESIGN.md` specifies mono as "wide-tracked **uppercase**", and the
 * tracking is present — but the casing is not, because a rule id is an
 * identifier rather than a label. This story pairs the two suffixes that a
 * `text-transform: uppercase` would collapse into each other: rendered
 * correctly they are two visibly different citations; rendered through a
 * transform they are the same string twice, and the one that pastes wrong is
 * indistinguishable from the one that pastes right.
 *
 * Read the lowercase `b`. Then click it and paste it — `text-transform` follows
 * text onto the clipboard in some browsers and not others, which is exactly why
 * it is not used here.
 */
export const CasingIsPreserved: Story = {
  args: {
    ruleId: "cr:8.3.4b",
    href: "https://optfall.com/cr/8.3.4b?v=2.11.0",
    version: "2.11.0",
  },
};

/**
 * The same rule with the uppercase suffix. Shown beside `CasingIsPreserved` in
 * autodocs, the pair is the assertion: two stories, two different identifiers
 * on screen. If they ever render identically, the citation has started lying
 * about which rule it points at.
 */
export const CasingIsPreservedUppercase: Story = {
  args: {
    ruleId: "cr:8.3.4B",
    href: "https://optfall.com/cr/8.3.4B?v=2.11.0",
    version: "2.11.0",
  },
};

/**
 * **Focus cannot be set from args, so check it by hand — it takes one key.**
 *
 * Click once on the empty canvas background (not on the link), then press
 * `Tab`. The citation is the only focusable thing in the frame, so it takes
 * focus immediately. In the autodocs page, `Tab` from the story above walks
 * into it.
 *
 * What you must see, and all three are required:
 *
 * 1. A solid `--of-color-focus` ring at **twice** the bevel width, offset by
 *    one bevel width so it clears the plate's own light top edge — visible
 *    against both the surface and the page ground, in both themes.
 * 2. An **underline** on the text, the same one hover gets. A keyboard user
 *    gets the affordance a mouse user does, not a quieter version of it.
 * 3. `Enter` follows the link. Nothing here intercepts the key, because there
 *    is no key handling to get wrong.
 *
 * If the ring is missing, someone added `outline: none` — the word appears
 * nowhere in `Citation.svelte`, and a citation nobody can tab to is a permalink
 * nobody can share. Hold `Space` or the mouse button to see the pressed state:
 * the bevel inverts, so the plate reads as struck *in* rather than out.
 */
export const FocusRing: Story = {
  args: {
    ruleId: "cr:2.1.1",
    href: "https://optfall.com/cr/2.1.1?v=2.11.0",
    version: "2.11.0",
  },
};

/**
 * A long identifier from the tournament policy corpus, versioned with a
 * pre-release tag — the worst realistic string, not a synthetic one.
 *
 * A citation is atomic: half of an identifier on the next line is not a shorter
 * citation, it is a wrong one. Narrow the preview pane until this no longer
 * fits. The plate must overflow its container as one piece; the moment the
 * identifier breaks across two lines, someone can copy half a rule number and
 * cite it in good faith.
 */
export const LongIdentifierStaysAtomic: Story = {
  args: {
    ruleId: "policy:appendix-c.4.11.2-deck-registration",
    href: "https://optfall.com/cr/policy/appendix-c.4.11.2?v=2.11.0-rc.3",
    version: "2.11.0-rc.3",
  },
};

/**
 * A relative permalink — the form the app itself emits, where every view is a
 * URL and the citation is how that URL travels.
 *
 * The check here is the context menu, not the pixels: right-click and choose
 * "Copy Link Address". You should get this path resolved against the Storybook
 * origin. A styled `<span>` with a click handler offers no such menu item, and
 * no middle-click, and no ⌘-click — which is the whole reason this primitive is
 * an anchor.
 */
export const RelativePermalink: Story = {
  args: {
    ruleId: "cr:8.3.4b",
    href: "/cr/8.3.4b?v=2.11.0",
    version: "2.11.0",
  },
};
