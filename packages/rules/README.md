# optfall-rules

The Flesh and Blood **Comprehensive Rules**, parsed into permanently
addressable sections.

`docs/PLAN.md`, Phase 4: *"The permalink is the product."* Legend Story Studios
already publishes a stable hierarchy — `1.0.`, `1.0.1.`, `1.0.1a` — and the
document's own preface says so:

> The rules are presented in the form 'Chapter'.'Section'.'Rule' and are
> referenced as such when referring to a particular rule in the current
> version. If referencing a previous version of this document, ensure that you
> include the version as well as the rule reference.

So this package **preserves** that numbering and never invents one of its own.
`cr:1.0.1a` is the id. The preface's second sentence is why every section
carries the version it was read from.

## Running it

```
bun packages/rules/src/cli.ts                       # fetch, parse, report counts
bun packages/rules/src/cli.ts --out corpus.json     # …and write the corpus
bun packages/rules/src/cli.ts --pdf ./en-fab-cr.pdf # parse a local copy instead
```

The PDF and the extracted corpus are **not committed**. The fetch downloads to
a temp directory; publication is a deliberate act with a reviewed diff, per
`docs/PLAN.md`'s "scheduled jobs, not services".

Committed instead: `src/fixtures/cr-2.14.0-excerpt.txt`, 16 KB of real
`pdftotext -layout` output covering the title page and the first five pages of
chapter 1 — 61 entries, enough to exercise every construct in the document, so
the tests need no network.

## Against the real document

Comprehensive Rules **2.14.0**, dated 2026-6-10, 413,462 bytes,
sha256 `fef01bb7c99da3d5e923521229c84b09ed544e8587dd0aaafaa666648fd44b85`:

| | |
|---|---|
| chapters | 9 |
| sections | 87 |
| rules | 548 |
| subrules | 634 |
| **total addressable entries** | **1,278** |
| parse warnings | 0 |

The 1,182 rules and subrules are an **exact set match** against an independent
`grep` of the extracted text — no id in one and not the other.

## Two things that would fail silently, and do not

- **`pdftotext -layout`, not plain mode.** Plain mode discards the indentation
  that separates a heading from a rule from a wrapped line, *and* welds
  `attack-` + `target` into `attacktarget`. Neither produces an error.
- **The version stamp is read, never assumed.** A title page this parser does
  not recognise throws. A corpus labelled with a guessed version is worse than
  no corpus.

## Zero runtime dependencies

`optfall-rules/extract` uses `node:child_process`, `node:crypto`, `node:fs`,
`node:os` and `node:path` — platform builtins, not packages. It is kept out of
the package entry point so nothing that touches the network or spawns a process
can reach a browser bundle.

## No language model

Every line here is deterministic string work. `docs/PLAN.md` rules out
LLM-assisted parsing in the document pipeline exactly as much as it rules out a
chat box, and every string this package emits is either an identifier derived
mechanically from LSS's own numbering or text copied verbatim out of the
document.

---

Optfall is in no way affiliated with Legend Story Studios. Legend Story
Studios®, Flesh and Blood™, and set names are trademarks of Legend Story
Studios. Flesh and Blood characters, cards, logos, and art are property of
Legend Story Studios.
