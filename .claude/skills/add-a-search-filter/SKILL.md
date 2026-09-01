---
name: add-a-search-filter
description: Add, change or remove a card-search operator (name:, legal:, pitch:, order:, display: …). Use when asked to add a search filter, support a new query syntax, change what an operator accepts, or fix how a search term parses. Covers the three files that must move together and what the syntax-page test does and does not catch.
---

# Adding a card-search operator

Three files change together, and all three are enforced by tests.

**This skill said "four files, and the fourth has no test" until 2026-09-01.
Both halves were wrong, and if you have read an older copy, unlearn them:**

- `apps/site/ssg/pages/syntax.test.ts` has existed since #334 — 209 lines,
  running in both directions, executing every example on the page. The syntax
  page is enforced.
- The `Supported: …` string used to be the fourth file. `supportedOperators()`
  now derives it from the tables, so editing it by hand is editing generated
  output.

What the syntax-page test still cannot catch is stale **prose** around an
operator name that is itself correct — it is a text search, and it says so in
its own docblock. That is the residual gap. It is much narrower than "no test
will say so".

This procedure has been performed at least seven times (#84, #85, #88, #89,
#116, #117, #125), so treat it as mechanical rather than as a design
problem.

## Before you start

Read `apps/site/src/lib/card-search/index.ts` — the barrel, which carries the
argument the whole module rests on. Then open `card-search/grammar.ts`, which
is where the operator tables live. You do not need `wire.ts`, `build.ts` or
`rank.ts` to add an operator.

## 1. `apps/site/src/lib/card-search/grammar.ts` — the tables

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

## The `Supported:` string — DERIVED, do not hand-edit

`supportedOperators()` in `grammar.ts` builds the unknown-operator error's list
from `FIELD_OPERATORS`, `QUERY_OPTIONS` and `STATE_OPERATORS`. Its own comment
is emphatic — "DERIVED, WHICH IS THE ENTIRE POINT" — because the string literal
it replaced was wrong: it omitted `flavor`, `kw`, `pow`, `defense`, `def`, `tou`
and `toughness`, all of which parse and return results.

So an operator in those three tables needs nothing here. Two cases still do:
an operator added to `STAT_FIELDS`, `SORT_KEYS`, `DISPLAY_MODES` or
`UNIQUE_MODES` will not appear in that list, and a new query *option* must be
added to `QUERY_OPTIONS` by hand.

## 2. `apps/site/src/lib/query.ts` — only if tokenising changes

The tokeniser is shared with the rules search. Touch it only if your operator
needs a value shape the tokeniser cannot already produce — a new quoting rule,
a new comparison symbol. Adding a key to a table does **not** require a change
here.

## 3. `apps/site/ssg/pages/syntax.page.tsx` — enforced, but only by name

The public syntax reference. Four arrays — `FIELDS`, `BOOLEANS`, `ORDERING`,
`LEGALITY` — each a table of rows rendered to `/syntax`. Add a row in the array
that matches your operator's kind.

`syntax.test.ts` checks this page against the parser in both directions, and
runs every example through `parseCardQuery`. Skip this step and the suite goes
red — it does not pass silently.

What it cannot check is the sentence AROUND the name. It searches the file's
text for the operator, so prose that has gone stale about an operator still
mentioned here is invisible to it. Read what you are adding a row next to.

## Decide the negated form in the same change

`-op:value` and `op!=value` are separate questions, and shipping one without
deciding the other has already cost a follow-up PR (#117, "Refuse `year!=` and
`date!=`").

For each operator ask: does negating it mean anything consistent? For dates it
does not — `grammar.ts` argues the case at the `year!=` branch: a card can
be returned by both `year:2024` and `year!=2024`, which is a query and its own
negation matching the same card. Where the answer is "no meaning that is both
consistent and honest", add it to `PENDING_OPERATORS` so it is **refused with a
reason** rather than silently accepted and quietly wrong.

## The import rule that has already cost 9 MB

Any module under `card-search/` that imports the corpus must do so
**type-only**, and the path is `../cards` — `cards.ts` is a SIBLING of the
`card-search/` directory, not a member of it. Today `build.ts` is the only
importer; `decode.ts` does not import it at all:

```ts
import type { CardPage } from "../cards";
```

A value import pulls the 18 MB corpus into the browser bundle. It happened
once and shipped 9.28 MB to every reader. `ssg/build.ts` has an island-budget
assertion that catches a recurrence, but it catches it late — write the
`import type` first.

## Verify

```sh
bun test apps/site/src/lib/card-search.test.ts   # the parser
bun run check                                    # the loop command
```

Then look at `/syntax` in `bun run --cwd apps/site dev` and confirm your
operator is on the page. `syntax.test.ts` covers the operator's NAME being
there; reading the surrounding sentence is the part no test performs for you.

Add a case to `card-search.test.ts` covering the operator **and** its negation
— including the refusal, if you refused it.
