# Optfall

Legality that remembers, and rulings you can cite — a reference tool for
[Flesh and Blood](https://fabtcg.com).

Flesh and Blood has no rulings-interaction lookup of any kind. Resolving a
question today means reading the Comprehensive Rules on your phone, or asking a
human in a Discord of several thousand people. Meanwhile the official tournament
platform ships no deck-legality validation at all, and the commercially-backed
alternative ships incorrect banned flags on legal cards.

Optfall optimises for the one thing no incumbent optimises for: **being right**.
Correct legality, correct rules text, correct rulings — each citable, each
version-stamped, each with a permanent URL.

No language model is involved in anything Optfall serves. Every answer is a
parsed official document or a named human author, never generated prose — so a
confidently wrong ruling is not a risk to manage but a thing the tool cannot do.

## Documents

| Document | Contents |
|---|---|
| [`docs/PLAN.md`](docs/PLAN.md) | Phased build plan — what gets built, in what order, and why |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design language, component system, and screen designs |
| [`docs/SCRYFALL-GAP.md`](docs/SCRYFALL-GAP.md) | Comparative analysis against Scryfall, and the remove/update/extend plan to close it |
| [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) | The permission envelope, as an operational checklist with enforcement points |
| [`docs/DATA-TERMS.md`](docs/DATA-TERMS.md) | Terms on the data Optfall publishes, and what is *not* ours to license |
| [`docs/PHASE-0-STATUS.md`](docs/PHASE-0-STATUS.md) | What Phase 0 delivered, and every finding left unfixed |
| [`docs/PHASE-1-STATUS.md`](docs/PHASE-1-STATUS.md) | The same, for Phase 1 |

The plan and design pass are also published as browsable pages:

- [Build plan](https://claude.ai/code/artifact/f801332b-9a7b-430a-bf9b-b6d603ce186a)
- [Design pass](https://claude.ai/code/artifact/7cb29b44-9250-48bb-a733-e9f4c8a5eb64)

## Status

**Phases 0 and 1 are on `main`.** Nothing is deployed yet, and no product
surface exists — what is built is the foundation the rest is assembled from.

- **Repository and CI** — a single aggregate gate, squash-only merges with
  linear history, and a weekly drift check that opens an issue when the live
  settings stop matching `scripts/repo-settings.sh`.
- **The token layer** — light and dark palettes with no component styles, and a
  lint rule in the gate that fails the build on a raw hex or length in a
  component. Contrast, colour-cast and pitch-numeral legibility are asserted
  numerically for both themes.
- **Eight primitives** — pitch jewel, bevelled plate, notched state pill, brass
  seal, citation, filigree corner, ornamental rule, and the mark. axe-core runs
  over every one of them in CI.
- **A workbench** — 62 Storybook stories, both themes. Run it with
  `bun run --cwd packages/components storybook`.

Phase 2, the legality library, is next.

## Working on it

```sh
bun install
bun run check                              # typecheck, lint, test
bun run --cwd packages/components storybook  # the component workbench
```

## Licence

Code is MIT. Published datasets are openly licensed over the structural work
this project owns — rule identifiers, the legality timeline, diffs and
annotations. Card names, card text and card art remain the property of Legend
Story Studios and are never relicensed here.

---

Optfall is in no way affiliated with Legend Story Studios. Legend Story
Studios®, Flesh and Blood™, and set names are trademarks of Legend Story
Studios. Flesh and Blood characters, cards, logos, and art are property of
Legend Story Studios.
