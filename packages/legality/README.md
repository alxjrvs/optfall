# `optfall-legality`

Is this deck legal in this format — and *was* it legal on the day of that
tournament?

> **`isLegal` throws today.** It validates its arguments and then raises
> `NotImplementedError` rather than evaluating, because evaluation needs a
> historical legality dataset that does not exist yet. **Do not install this
> package expecting verdicts.** The type surface below is real, stable and
> intended; the evaluator behind it is not written. See *Status*.

## Why it exists

Every Flesh and Blood tool that answers a legality question answers it for
*today*, by reading whatever flag upstream currently publishes. That is the
wrong shape for the question people actually have — a tournament organiser
holding a decklist needs to know whether a card was legal **on the day of the
event**, and a player reading a result from last season needs the same.

Answering that means a timeline rather than a flag, and a timeline is a dataset
nobody has published. This package is the evaluator for it.

## Three properties, none negotiable later

1. **Zero runtime dependencies.** It is meant to be adopted by other tools at
   zero risk: it adds nothing to their dependency tree and runs entirely in a
   browser.
2. **Every verdict cites a rule.** A verdict without a citation is an
   assertion. The point of this project is being auditable rather than merely
   confident.
3. **No composed prose, anywhere.** Nothing here writes a sentence about a
   card. Verdicts are structured data plus verbatim quotations from parsed
   official documents; rendering them into English is the caller's job. This is
   why `CardVerdict` and `DeckViolation` have no `message` field and never
   will.

That third one is not a style preference. It is why `optfall-legality` cannot
tell a player something confidently wrong mid-round — there is no code path
that composes a claim.

## Status

| | |
|---|---|
| Type surface | stable, and the intended shape |
| `isLegal` | throws `NotImplementedError` |
| Blocked on | `data/legality`, a machine-readable record of past banned and restricted revisions |
| Tests | 185, covering the parts that are written |

The blocker is a dataset, not code. That dataset is a scraping job rather than
an excavation — the Wayback Machine carries 202 archived announcement URLs
spanning 2021-03-18 to 2025-11-14, and `src/sources/wayback.ts` is the built
half of retrieving them. Extraction is closed-vocabulary matching against known
card names with human review, never a language model.

See [`docs/ROADMAP.md`](../../docs/ROADMAP.md) → "Phase 3 — Legality that
remembers".

## Using it

```ts
import { isLegal } from "optfall-legality";
```

Read `src/index.ts` for the type surface. Its `@packageDocumentation` block is
the authoritative description of intent, and this README is a summary of it.

Two modules are described in that file as finished and usable independently of
`isLegal` — the format rules and the timeline types. If you want one of those
specifically, say so in an issue; they are not currently exported as a separate
entry point because nothing has asked for one.

## Licence

MIT. The *code* is MIT; the game data it reasons about is not ours to license —
see [`docs/DATA-TERMS.md`](../../docs/DATA-TERMS.md).
