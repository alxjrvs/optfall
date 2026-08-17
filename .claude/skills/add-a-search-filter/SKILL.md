---
name: add-a-search-filter
description: Add, change or remove a card-search operator (name:, legal:, pitch:, order:, display: …). Use when asked to add a search filter, support a new query syntax, change what an operator accepts, or fix how a search term parses. Covers the four files that must move together and the one with no test behind it.
---

# Adding a card-search operator

Four files change together. Three are enforced by tests; **the fourth is not**,
and it is the one that gets forgotten. `apps/site/ssg/pages/syntax.page.tsx`
says so itself:

> When one of those changes this page is wrong, and there is no test that will
> say so — the honest mitigation is that they sit three files apart and this
> comment names all three.

This procedure is the mitigation, written down. It has been performed at least
seven times (#84, #85, #88, #89, #116, #117, #125), so treat it as mechanical
rather than as a design problem.

## Before you start

Read `apps/site/src/lib/card-search.ts`'s header. It is a 3,100-line file with
labelled sections; the ones you need are **The query language** and
**Matching**. You do not need to read the wire format or the ranking sections
to add an operator.

## 1. `apps/site/src/lib/card-search.ts` — the tables

Nine tables define the grammar. Add your operator to whichever ones apply:

| Table | What it holds |
|---|---|
| `FIELD_OPERATORS` | `name:`, `text:`, `type:`, `trait:`, `artist:`, `set:` … and their aliases |
| `STATE_OPERATORS` | `legal:`, `banned:`, `suspended:`, `restricted:` |
| `FORMAT_ALIASES` | the format names those states take (`cc`, `blitz`, `commoner` …) |
| `STAT_FIELDS` | numeric comparisons — `cost`, `power`, `defence` |
| `SORT_KEYS` | what `order:` accepts |
| `DISPLAY_MODES` | what `display:` accepts |
| `UNIQUE_MODES` | what `unique:` accepts |
| `WORD_VALUED` | fields whose value is a bare word rather than a phrase |
| `PENDING_OPERATORS` | operators that are recognised and deliberately refused |

Aliases live in the same table as their long form — `text` and `o`, `artist`
and `a`, `flavour` and `ft`.

## 2. The `Supported:` string — same file

Search for `is not an operator here. Supported:`. It is **hand-written prose**
listing every operator, and nothing regenerates it. An operator added to the
tables but not to this string produces an error message that denies the
operator you just added exists.

## 3. `apps/site/src/lib/query.ts` — only if tokenising changes

The tokeniser is shared with the rules search. Touch it only if your operator
needs a value shape the tokeniser cannot already produce — a new quoting rule,
a new comparison symbol. Adding a key to a table does **not** require a change
here.

## 4. `apps/site/ssg/pages/syntax.page.tsx` — the one with no test

The public syntax reference. Four arrays — `FIELDS`, `BOOLEANS`, `ORDERING`,
`LEGALITY` — each a table of rows rendered to `/syntax`. Add a row in the array
that matches your operator's kind.

Nothing checks this page against the parser. If you skip it, every test passes
and the documentation is silently wrong.

## Decide the negated form in the same change

`-op:value` and `op!=value` are separate questions, and shipping one without
deciding the other has already cost a follow-up PR (#117, "Refuse `year!=` and
`date!=`").

For each operator ask: does negating it mean anything consistent? For dates it
does not — `card-search.ts` argues the case at the `year!=` branch: a card can
be returned by both `year:2024` and `year!=2024`, which is a query and its own
negation matching the same card. Where the answer is "no meaning that is both
consistent and honest", add it to `PENDING_OPERATORS` so it is **refused with a
reason** rather than silently accepted and quietly wrong.

## The import rule that has already cost 9 MB

`card-search.ts` must import `./cards` **type-only**:

```ts
import type { CardPage } from "./cards";
```

A value import pulls the 16 MB corpus into the browser bundle. It happened
once and shipped 9.28 MB to every reader. `ssg/build.ts` has an island-budget
assertion that catches a recurrence, but it catches it late — write the
`import type` first.

## Verify

```sh
bun test apps/site/src/lib/card-search.test.ts   # the parser
bun run check                                    # the loop command
```

Then look at `/syntax` in `bun run --cwd apps/site dev` and confirm your
operator is on the page. That is the step no test performs for you.

Add a case to `card-search.test.ts` covering the operator **and** its negation
— including the refusal, if you refused it.
