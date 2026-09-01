#!/bin/bash
#
# Refuse writes under `data/`.
#
# `CLAUDE.md`: "Never regenerate `data/` unless that is the task. The corpus
# builders hit the network, CI never runs them, and dozens of assertions are
# written against the committed figures."
#
# The `permissions.deny` list already refuses `bun run corpus:*` and
# `bun run symbols`, which is how the corpus is normally regenerated. This
# covers the other way in: editing a committed data file directly. That is
# worse than running the builder, because a hand edit produces a plausible file
# with no provenance and `check:provenance` verifies a recorded origin rather
# than a correct one.
#
# EXIT 2 IS THE BLOCKING CODE. stderr goes back to the model, so the message is
# written for the agent that just tried it — it says what to do instead rather
# than only saying no.
#
# This is a guard, not a lock. If regenerating `data/` genuinely IS the task,
# the human can say so and lift it; the point is that it stops being something
# that happens on the way to something else.

set -euo pipefail

input=$(cat)

path=$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')

# No path in the payload means nothing to judge — never block on a parse miss.
[ -z "$path" ] && exit 0

case "$path" in
  */data/*|data/*)
    cat >&2 <<'MESSAGE'
Refused: this writes under `data/`.

`data/` is committed, generated, and load-bearing. Dozens of assertions are
written against its figures, the builders that produce it hit the network, and
CI never runs them — so a hand edit yields a plausible file with no provenance,
which `check:provenance` cannot detect because it verifies that an origin is
RECORDED, not that it is true.

What you probably want instead:

  - the corpus SHAPE          data/cards/sample.json (20 cards, ~90 kB)
  - one particular card       query through cards.ts with `bun -e`
  - regenerating for real     a human decision with a diff attached; the
                              corpus:* scripts are denied for the same reason

If regenerating `data/` genuinely is the task, say so and this guard can be
lifted for the session.
MESSAGE
    exit 2
    ;;
esac

exit 0
