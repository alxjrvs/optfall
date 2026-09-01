# Permission envelope and required disclaimer

**This file is parsed programmatically.** `scripts/canonical-disclaimer.ts`
extracts the blockquote under "Required disclaimer" below and treats it as the
specification; `scripts/canonical-disclaimer.test.ts` then asserts that exact
character sequence appears in `apps/site/src/lib/compliance.ts`, `README.md`,
`docs/COMPLIANCE.md` and *both* copies in `docs/DATA-TERMS.md`, and
`scripts/check-disclaimer.ts` asserts it appears on every built page.

Two things follow, and they are not the same rule:

- **Reflowing the blockquote is safe.** Both sides of every comparison are
  whitespace-normalised, so line wrapping carries no meaning. Changing a
  *character* — a `®`, a `™`, any punctuation — changes the specification and
  fails the build in five places.
- **Do not put a blank line inside the blockquote.** A blank line ends the
  extraction. `canonicalDisclaimer()` rejects a result that is too short to be
  the real disclaimer, so this fails loudly rather than silently narrowing what
  every downstream check looks for.

This content was extracted verbatim from `docs/PLAN.md` when that file was
retired. The wording is LSS's requirement, not ours, and is not ours to edit.

---

## Permission envelope

LSS publishes a *Terms of Use for Game and Studio Assets and IP* containing an
explicit third-party application policy that names these exact use cases. It is
a written grant with conditions, and both halves are load-bearing. All of Phase
0 exists to satisfy it before the first public commit.

### Granted

- **Card databases** and related services, named in the policy.
- **Rules enforcement applications** — a separately blessed category covering
  both legality checking and a rulings archive.
- **APIs** transferring game content, provided they are not directly monetised.
- **Card face images**, specifically for building card databases.
- **Indirect monetisation** — Patreon and ad-sense by name, if costs ever need
  covering.

### Required of us

- **Individual, never a commercial entity.** The policy bars third-party
  applications built by commercial entities. Repo, domain and any future Patreon
  stay on the personal account.
- **No direct monetisation.** No sales, no subscriptions.
- **No FAB or LSS logos in the app** — and product set logos count as FAB logos.
  Card faces are fine; set symbols as filter icons are not.
- **Verbatim disclaimer** in the footer.
- **Copyright line** on card images.
- **Terms on our own published data** echoing LSS's, since the grant binds
  recipients too.

### Required disclaimer

> Optfall is in no way affiliated with Legend Story Studios. Legend Story
> Studios®, Flesh and Blood™, and set names are trademarks of Legend Story
> Studios. Flesh and Blood characters, cards, logos, and art are property of
> Legend Story Studios.

Enforcement is described as friendly warnings before escalation, with immediate
legal action reserved for commercial entities and deliberate non-compliance. The
real risk is therefore **revocation, not litigation** — so keep rulings, rules
and legality data ours and portable. Losing the art licence should cost a
rendering layer and nothing else.
