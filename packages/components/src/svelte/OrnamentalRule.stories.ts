import { createRawSnippet, mount, unmount, type Snippet } from "svelte";
import type { Meta, StoryObj } from "@storybook/svelte-vite";

import BevelledPlate from "./BevelledPlate.svelte";
import FiligreeCorner from "./FiligreeCorner.svelte";
import OrnamentalRule from "./OrnamentalRule.svelte";

/**
 * The rule is the primitive that replaces the card, and a hairline rendered on
 * its own proves nothing about that.
 *
 * `docs/DESIGN.md` promises "density without clutter, held together by tight
 * vertical rhythm and hairline rules rather than cards, shadows and padding" —
 * a claim about the SPACE AROUND the line, not about the line. One rule alone
 * in an empty canvas is a story about a 1px div; the rhythm it exists to create
 * cannot be seen without text on both sides of it. So the first group below
 * covers the states that genuinely belong to the line, and the last three
 * render the rule at work inside a plate — where a wrong margin, a doubled
 * hairline, or a rule that fails to separate anything is visible rather than
 * imagined.
 *
 * Three claims are put where they would fail loudly if they were false:
 *
 * - **`decorative` changes the accessibility tree and nothing else.** Two rules
 *   that must be pixel-identical are rendered one above the other; if the flag
 *   ever leaks into the styling, the story stops matching itself.
 * - **The ornamented rule is one rule, not two.** `FiligreeCorner` in its
 *   `section-rule` role and `OrnamentalRule` each concluded independently that
 *   the section rule was their job, which shipped four hairlines at two
 *   weights. `WithFiligree` composes them exactly as the component's own doc
 *   comment instructs, so that regression is a glance away rather than a code
 *   read away.
 * - **Ornament is rationed to once per screen.** `OrnamentSpentOnce` spends it
 *   correctly on a page of three breaks — and incidentally exposes the rhythm
 *   difference no isolated story can show, since an ornamented rule takes
 *   `space.looser` where a plain one takes `space.loose`.
 *
 * A STORIES FILE HAS NO TEMPLATE, which is what `section()` at the bottom is
 * for. `.storybook/main.ts` takes plain CSF in TypeScript rather than
 * `.stories.svelte`, so there is nowhere to write two paragraphs; the supported
 * programmatic route is `createRawSnippet` for the prose and `mount` for the
 * real components inside it. Machinery in service of the point — the
 * alternative is a story that claims a context in a comment and renders a bare
 * line.
 */
const meta = {
  title: "Primitives/OrnamentalRule",
  component: OrnamentalRule,
  tags: ["autodocs"],
  argTypes: {
    ornament: {
      control: "boolean",
      description:
        "Open the centre of the rule and mount the filigree. Defaults to `false`: a screen spends one of these at most, and the plain hairline is overwhelmingly the common case.",
    },
    decorative: {
      control: "boolean",
      description:
        "Render a line that is not a thematic break — an `aria-hidden` span instead of an `<hr>`. Defaults to `false`, because the expensive mistake runs one way: a separator announced between every header and its body is noise that trains people to ignore the one that meant something.",
    },
    label: {
      control: "text",
      description:
        'Accessible name for the break, such as the section it introduces. Deliberately absent by default — a separator is already announced by its role, so a default would be invented text read aloud on every rule in the interface. A blank collapses to no name rather than to `aria-label=""`.',
    },
    filigree: {
      // Not a control: a snippet cannot be typed into a text field, and an
      // absent one is a documented state rather than an omission — the
      // component draws its own centre mark instead of opening a hole.
      control: false,
      description:
        "The ornament itself, supplied as a snippet rather than imported by the rule, so the call site that can see the whole screen decides how much scrollwork it has already spent. Intended occupant: `FiligreeCorner` in its `section-rule` role. Ignored unless `ornament` is set.",
    },
  },
} satisfies Meta<typeof OrnamentalRule>;

export default meta;
type Story = StoryObj<typeof meta>;

/* -------------------------------------------------------------------------- */
/* The line itself                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The common case: one hairline, struck rather than drawn — a light edge above
 * and a dark one below, carried on a shadow so the rule stays exactly one
 * hairline tall.
 */
export const Default: Story = { args: {} };

/**
 * A break that names the section it introduces. Read the accessibility panel
 * rather than the canvas: nothing about a name is visible, which is the point.
 */
export const Named: Story = { args: { label: "Rulings" } };

/**
 * A blank label, which must collapse to NO NAME rather than to `aria-label=""`.
 *
 * The difference is invisible in the canvas and total in the accessibility
 * tree: an empty name overrides the role's own announcement, so this is the one
 * spelling that produces a separator announcing nothing at all. The component's
 * `label?.trim() || undefined` is what prevents it, and this story is where
 * that survives a refactor.
 */
export const BlankLabelIsNoName: Story = { args: { label: "   " } };

/**
 * `ornament` with no `filigree` snippet — the degenerate ornament.
 *
 * The component draws its own centre mark rather than opening a gap and
 * trusting the caller, because a hole with nothing in it is a bug that looks
 * like a design. Compare with `WithFiligree`: the lozenge here is the fallback,
 * not the motif.
 */
export const Ornamented: Story = { args: { ornament: true } };

/**
 * The composition the component's doc comment prescribes: the rule owns the
 * `<hr>`, both hairlines and the rhythm; the snippet supplies a drawing.
 *
 * COUNT THE HAIRLINES — there must be exactly two segments and one figure. An
 * earlier `FiligreeCorner` drew a complete rule in this role, so following
 * these instructions produced four hairlines at two different weights, doubled
 * rhythm, and a `separator` buried inside an `aria-hidden` mount where the
 * accessibility tree threw it away. That failure is visible here and nowhere
 * else in the library.
 */
export const WithFiligree: Story = {
  args: { ornament: true, filigree: sectionFiligree() },
};

/* -------------------------------------------------------------------------- */
/* The rule at work — where the claim about rhythm can be judged at all        */
/* -------------------------------------------------------------------------- */

/**
 * What the rule is FOR: two blocks of text that are one section apart.
 *
 * No card, no shadow, no padding between the blocks — the line and the space it
 * owns are the entire separation, which is the design language's central bet
 * stated as a rendering rather than as a paragraph. If the rhythm is too tight
 * to read as a division, or so loose that the blocks stop being one page, it is
 * wrong right here and nowhere else.
 */
export const InSection: Composed = {
  render: () =>
    section(
      `<section aria-label="Card text">
        ${heading("Command and Conquer")}
        ${paragraph("Attacks with go again. If this hits a hero, destroy a random equipment they control that is not defended by a defence reaction.")}
        ${rule()}
        ${heading("Sink Below")}
        ${paragraph("Defence reaction. The next attack action card you play this turn gains go again, whether or not this card defends the attack it was played against.")}
      </section>`,
      [{}],
    ),
};

/**
 * The pair that must be pixel-identical: a thematic break, and a decoration.
 *
 * `decorative` is the only prop here that changes the ELEMENT, and it must
 * change nothing else. Look at the canvas and see one thing twice; open the
 * accessibility panel and see a `separator` and then nothing. If a stylesheet
 * ever hangs a rendering off the flag, these two stop matching — the story
 * fails by looking wrong rather than by failing a test nobody wrote.
 */
export const SemanticAndDecorativeAreIdentical: Composed = {
  render: () =>
    section(
      `<section aria-label="Semantic and decorative rules">
        ${caption("A thematic break — announced as a separator")}
        ${rule()}
        ${caption("Furniture inside a plate — absent from the tree")}
        ${rule()}
      </section>`,
      [{}, { decorative: true }],
    ),
};

/**
 * The ration as a page: three breaks, one ornament.
 *
 * `docs/DESIGN.md` gives filigree three roles and forbids it twice on one
 * screen, and this is what spending it correctly looks like — the ornamented
 * rule introduces the section that matters, the others stay quiet, and the
 * closing one is decoration rather than a division. It also exposes the rhythm
 * difference the isolated stories cannot: the ornamented rule takes
 * `space.looser` where the plain ones take `space.loose`, so the ornament buys
 * vertical room as well as attention. If those two ever collapse to one value,
 * this column goes flat.
 */
export const OrnamentSpentOnce: Composed = {
  render: () =>
    section(
      `<section aria-label="Rules 8.3.4b">
        ${heading("8.3.4b — Defence reactions")}
        ${paragraph("A defence reaction may only be played during the defend step, and only by the defending hero.")}
        ${rule()}
        ${paragraph("Its defence value is added to the total defence of the attack it is played against.")}
        ${rule()}
        ${heading("Verified rulings")}
        ${paragraph("Judge-signed and citable. The ornamented rule above is the one place this page spends scrollwork.")}
        ${rule()}
        ${caption("Rules text is illustrative — see docs/DESIGN.md")}
      </section>`,
      [
        {},
        {
          ornament: true,
          filigree: sectionFiligree(),
          label: "Verified rulings",
        },
        { decorative: true },
      ],
    ),
};

/* -------------------------------------------------------------------------- */
/* Machinery                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Composed stories are typed against the plate that hosts them, not the rule.
 *
 * The rule takes no children, so a story showing it separate two things has to
 * render a host — and Storybook types a story's `render` return against that
 * story's own args, which are the component's props. Typing these as `Story`
 * would be a claim the compiler correctly rejects; typing them as the host is
 * the truth about what is being mounted. Their subject is still the rule:
 * every one of them mounts real `OrnamentalRule` instances into the prose.
 */
type Composed = StoryObj<typeof BevelledPlate>;

/** The rule's props exactly as the component declares them, snippet included. */
type RuleProps = NonNullable<Parameters<typeof OrnamentalRule>[1]>;

/**
 * A page section: prose on a plate, with real rules mounted into it.
 *
 * The plate is not decoration for the story. A hairline judged against
 * Storybook's bare canvas is judged against the wrong ground — the plate
 * supplies the surface tone the rule colour was chosen against and the padding
 * the rhythm is read against, and it is the one primitive in the library that
 * takes children.
 *
 * Every `rule()` placeholder in the markup is replaced, in order, by an
 * `OrnamentalRule` mounted with the matching props: real instances with real
 * scoped styles, never a static re-implementation of the primitive, which would
 * defeat the purpose of looking at it.
 */
function section(
  html: string,
  rules: readonly RuleProps[],
): { Component: typeof BevelledPlate; props: { children: Snippet } } {
  const children = createRawSnippet(() => ({
    render: () => html,
    setup: (root: Element) => {
      const slots = root.querySelectorAll("[data-rule]");
      const mounted = rules.map((props, index) => {
        const target = slots[index];
        return target ? mount(OrnamentalRule, { target, props }) : undefined;
      });
      return () => {
        for (const instance of mounted) {
          if (instance) void unmount(instance);
        }
      };
    },
  }));

  return { Component: BevelledPlate, props: { children } };
}

/** Where the next rule of a section is mounted. */
function rule(): string {
  return `<div data-rule></div>`;
}

/** Serif — card names, questions and headings. */
function heading(text: string): string {
  return `<h2 style="margin: 0; font-family: var(--of-type-family-serif); font-size: var(--of-type-size-large); font-weight: var(--of-type-weight-regular); line-height: var(--of-type-leading-tight); color: var(--of-color-ink);">${text}</h2>`;
}

/** Sans — interface text. */
function paragraph(text: string): string {
  return `<p style="margin: var(--of-space-tight) 0 0; font-family: var(--of-type-family-sans); font-size: var(--of-type-size-base); line-height: var(--of-type-leading-loose); color: var(--of-color-ink-muted);">${text}</p>`;
}

/**
 * Mono, wide-tracked uppercase — labels, and anything citable.
 *
 * `color.ink.faint` is the obvious tone for a caption and is deliberately not
 * used: at `type.size.micro` it falls under 4.5:1 against the plate in both
 * themes, and `preview.ts` sets the accessibility checks to fail rather than to
 * collect. A workbench that has to switch a check off to go green is not one.
 */
function caption(text: string): string {
  return `<p style="margin: 0; font-family: var(--of-type-family-sans); font-size: var(--of-type-size-micro); letter-spacing: var(--of-type-tracking-wide); text-transform: uppercase; color: var(--of-color-ink-muted);">${text}</p>`;
}

/**
 * `FiligreeCorner role="section-rule"` as a snippet — the intended occupant of
 * the mount, arriving the way the component insists it arrives: composed by the
 * caller, never imported by the primitive.
 *
 * In this role the filigree emits a bare figure — no lines, no
 * `role="separator"`, no margins of its own — so everything structural in the
 * stories above belongs to the rule.
 */
function sectionFiligree(): Snippet {
  return createRawSnippet(() => ({
    render: () => `<span></span>`,
    setup: (host: Element) => {
      const instance = mount(FiligreeCorner, {
        target: host,
        props: { role: "section-rule" },
      });
      return () => void unmount(instance);
    },
  }));
}
