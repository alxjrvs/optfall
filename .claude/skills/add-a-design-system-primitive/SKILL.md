---
name: add-a-design-system-primitive
description: Add, rename or remove a design-system primitive in packages/components (pitch jewel, bevelled plate, card face, pagination …). Use when asked to add a new component to the library, add a primitive, or when a component addition fails the coverage, parity or a11y gates. Covers the seven places that must move together.
---

# Adding a primitive

Seven places change together, and **all seven are test-enforced**, so this is a
procedure rather than a judgement call. The tests will tell you what you missed
— this skill just saves you the round trips.

The cost of getting it wrong is on record: #154 had to write seven cards at once
after "seven of thirteen primitives had no card at all", an 8,789-line commit.

## 0. First, is it a primitive?

`PRIMITIVES` in `packages/components/src/index.ts` is described as **closed on
purpose**. The two rules that govern what goes in:

- **Compose, never restyle.** A screen needing new CSS is the signal that a
  primitive is missing — that is when you add one.
- **Tokens or nothing.** No raw hex or length. `check:tokens` fails the build,
  and it scans `packages/components/src` and `apps/site/ssg`.

If the thing you need is one screen's layout rather than a reusable shape, it
does not belong here.

## The seven places

### 1–2. `packages/components/src/index.ts`

The `PrimitiveName` union **and** the `PRIMITIVES` array. They are verbatim
duplicates of each other; add to both.

Do **not** write the new count into prose anywhere. Cite `PRIMITIVES.length`.
The README's count has been wrong across two consecutive additions.

### 3. The component — `packages/components/src/react/<Name>.tsx` + `.css`

Its props interface lives **in the component file**, not in `index.ts`. The
`index.ts` copies were duplicates and were deleted; do not recreate one.

Name the CSS classes with the component's own prefix and keep every value a
`var(--of-*)` reference.

### 4. `packages/components/src/react/index.ts`

Export the component and its props type:

```ts
export { Pagination, type PaginationProps } from "./Pagination";
```

`parity.test.ts` asserts this export list matches `PRIMITIVES` exactly, mapped
through the id-to-component-name convention. A missing export fails there.

### 5. The count in `packages/components/src/index.test.ts`

A hardcoded `toHaveLength(N)`. Bump it.

### 6. The design-system card

```sh
bun run design-system   # regenerates the whole bundle
```

Then **commit `design-system/`**. `scripts/design-system-coverage.test.ts`
compares every committed HTML file against the generator's output, so an
uncommitted regeneration and a hand-edited card fail identically.

Three things that test enforces beyond existence:

- **One card per primitive.** A shared "gallery" card does not count as
  coverage for the primitives inside it.
- **The card is titled off the taxonomy** — its title must be the primitive's
  own id.
- **`ALLOWLIST` must stay empty.** It exists for a primitive that genuinely
  cannot stand alone, and a stale-entry test fails an entry that names a
  primitive which has since gained a card. Adding your primitive to the
  allowlist instead of writing its card is the one move that defeats the rule —
  the #154 pass deliberately wrote seven cards rather than exempting them.

### 7. A case in `packages/components/src/react/a11y.test.tsx`

axe-core runs over every primitive. The `CASES` table is heterogeneous by
design; add a row with your component, its props, and a `wrap` if the component
needs a landmark or list context to be valid on its own.

## Verify

```sh
bun test packages/components   # ~9s — parity, a11y, the count
bun run check                  # the loop command
```

If you changed anything a page renders, the tokens must still reach the built
pages, which needs a build:

```sh
bun run check:full             # ~3 min
```

## Removing or renaming one

The same seven places, in reverse, plus: `design-system/` will still hold the
old card, and the coverage test fails on a committed card that names no
primitive. Re-run `bun run design-system` and commit the deletion.
