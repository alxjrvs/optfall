import type { Meta, StoryObj } from "@storybook/svelte-vite";

import BrassSeal from "./BrassSeal.svelte";

/**
 * The brass seal is the one place brass is spent, so these stories are written
 * to test whether the plate still holds up when the data is unkind — not to
 * photograph it once with a short name and a current version.
 *
 * Three claims in `BrassSeal.svelte` and `docs/DESIGN.md` are only claims until
 * something tries to break them, and each has a story below aimed at it:
 *
 * - **"Brass is reserved for authority — the verified seal and nothing else."**
 *   Every story here is a seal, and this file is the only stories file in the
 *   library that renders brass. If a second one appears, the signal has been
 *   spent, and the workbench is where that becomes visible.
 * - **"The rules version is a first-class field, not a parenthetical."** A bump
 *   is what flags an entry for review, so `Superseded` sets an old version and
 *   asks the obvious question: from across the room, can you tell it apart from
 *   `Verified`? If the version band has to be hunted for, it is not doing the
 *   job Phase 5 assigns it.
 * - **"A date that changes with the reader's timezone is not a cosmetic bug."**
 *   `NewYearsDay` is the case a `new Date(date).toLocaleDateString()`
 *   implementation gets wrong — anywhere west of Greenwich it renders the
 *   previous day, and the previous *year*. It must read 1 January 2026.
 *
 * The `date` control is pinned to `text` deliberately. `.storybook/preview.ts`
 * matches `/Date$/i` onto a date picker, which hands the component a `Date`
 * object where the contract in `../index.ts` says `YYYY-MM-DD` — a control that
 * feeds a prop something its type forbids is a broken control.
 */
const meta = {
  title: "Primitives/BrassSeal",
  component: BrassSeal,
  tags: ["autodocs"],
  argTypes: {
    judge: {
      control: "text",
      description:
        "The judge's name, exactly as they gave it. Rendered as the plate's one sans line, and wrapped rather than truncated — a name is attribution, and a clipped one attributes the ruling to nobody.",
    },
    date: {
      control: "text",
      description:
        "Date the ruling was given, as `YYYY-MM-DD`. Expanded by hand for display; the machine form is preserved in the `datetime` attribute. Anything that does not match the pattern is rendered verbatim rather than as `Invalid Date`.",
    },
    rulesVersion: {
      control: "text",
      description:
        "The rules version the ruling was answered under. Gets its own inverted band across the foot of the plate: a bump flags the entry for review, and a field a reader has to hunt for cannot do that.",
    },
  },
} satisfies Meta<typeof BrassSeal>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The ordinary case, and the one every other story is measured against: a
 * verified ruling on the current rules version.
 */
export const Verified: Story = {
  args: {
    judge: "Elena Ruiz",
    date: "2026-03-14",
    rulesVersion: "2.11.0",
  },
};

/**
 * Same seal, a version behind. Nothing else changed — the whole difference
 * between a citable ruling and one queued for re-review is the band at the
 * foot, so if this is not immediately distinguishable from `Verified` the
 * component has failed at its stated job rather than at a styling one.
 */
export const Superseded: Story = {
  args: {
    judge: "Elena Ruiz",
    date: "2024-08-02",
    rulesVersion: "2.9.0",
  },
};

/**
 * A long name with diacritics and a suffix, which is what real judge rosters
 * contain. The plate is `inline-grid` with `max-inline-size: 100%`, so the name
 * should wrap and the version band should keep spanning the full width of the
 * face above it — the band must not detach from the widest line or start
 * overflowing the bevel.
 */
export const LongJudgeName: Story = {
  args: {
    judge: "Bartholomew Featherstonehaugh-Achterberg III",
    date: "2026-03-14",
    rulesVersion: "2.11.0",
  },
};

/**
 * 1 January, the date that catches a timezone-naive implementation. Parsed as
 * UTC midnight and localised, this renders as 31 December 2025 for every reader
 * in the Americas. It must say 1 January 2026 in every timezone, and the
 * `datetime` attribute must still read `2026-01-01`.
 */
export const NewYearsDay: Story = {
  args: {
    judge: "Priya Nandakumar",
    date: "2026-01-01",
    rulesVersion: "2.11.0",
  },
};

/**
 * Malformed upstream data, shown rather than swallowed. A ruling imported with
 * a partial date renders exactly what it was given — visibly wrong is how
 * anyone finds out, and `Invalid Date` would hide which record to fix.
 *
 * The version band is also carrying a pre-release tag here, because a version
 * string is an arbitrary label rather than three numbers.
 */
export const MalformedDate: Story = {
  args: {
    judge: "Tomás Okafor",
    date: "2026-03",
    rulesVersion: "2.12.0-rc.1",
  },
};
