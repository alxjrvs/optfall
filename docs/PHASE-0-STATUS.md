# Phase 0 — status report

**Written 2026-08-08, from a verification pass over the working tree at
`.claude/worktrees/no-llm-constraint`.** Every claim below was re-checked by
running the thing, not by reading an agent's summary. Where a check could not
be run, it says so.

One correction up front, because it changes the shape of the handoff.
**`alxjrvs/optfall` already exists.** A read-only API call confirms it:

```
$ gh api repos/alxjrvs/optfall --jq '{full_name,private,created_at,default_branch,owner_type:.owner.type,size}'
{"created_at":"2026-08-08T14:48:35Z","default_branch":"main","full_name":"alxjrvs/optfall",
 "owner_type":"User","private":false,"size":0}
```

Public, personal account, default branch `main`, carrying the two documentation
commits (`6bff4d08` and `79f5c16e`) and nothing else. No rulesets, no Actions
secrets, and its merge settings are all still GitHub's defaults. The
repository-creation step in the handoff is therefore already done; the
configuration step is not.

Second correction. **There is no Terraform in this repository, and there must
not be.** `infra/` was deleted during the repair pass, because `docs/PLAN.md`
settles the question in the opposite direction from the brief that produced it:
*"A shell script, not Terraform"* (line 105), *"repository settings as a `gh
api` script rather than Terraform"* (line 555). `scripts/repo-settings.sh` is
the only mechanism. Any instruction below that would have read "run `terraform
apply`" reads "run `scripts/repo-settings.sh`" instead, and the exit criterion
phrased as *reproducible from Terraform alone* is judged against the script,
which is what the binding plan actually requires.

---

## 1. What now exists, by Phase 0 deliverable

Deliverables are quoted from `docs/PLAN.md` lines 176–187.

### `alxjrvs/optfall` — public, personal account, TypeScript workspace on Bun — **partial**

The repository exists and is public on the personal account (verified above).
The workspace exists locally and builds: root `package.json` with
`workspaces: ["packages/*", "apps/*"]`, `packages/{legality,theme,components}`,
`apps/site`, a committed `bun.lock`, `bunfig.toml` pinning `install.exact`,
`tsconfig.base.json` in strict mode.

What makes it partial: **none of it is on GitHub yet.** The remote is still the
two docs commits. Everything in this report other than the repository shell is
unpushed working tree.

`packages/legality` is real rather than a stub — it exports the full intended
type surface (`Deck`, `RuleCitation`, `CardVerdict`, `DeckViolation`,
`LegalityTimeline`, `TimelineProvenance`, `LegalityResult`), validates format,
date and deck shape today, and throws `NotImplementedError` for the evaluation
itself. It declares an explicit empty `"dependencies": {}`. Notably, no type in
it carries a `message` or prose field — the no-LLM rule expressed where the
compiler can hold it.

### `scripts/repo-settings.sh` with a `--check` mode wired into CI — **partial**

The script exists, is executable, is `bash -n` clean, and **works against live
GitHub** — I ran it read-only:

```
$ ./scripts/repo-settings.sh --check
Ownership — alxjrvs/optfall
  ok      owner = alxjrvs
  ok      owner type = User (personal account, as LSS's policy requires)
  ok      visibility = public

Repository settings — alxjrvs/optfall
  drift   delete_branch_on_merge = false (expected true)
  drift   allow_auto_merge = false (expected true)
  drift   allow_merge_commit = true (expected false)
  drift   allow_rebase_merge = true (expected false)
  drift   allow_update_branch = false (expected true)
  drift   squash_merge_commit_title = COMMIT_OR_PR_TITLE (expected PR_TITLE)
  drift   squash_merge_commit_message = COMMIT_MESSAGES (expected PR_BODY)
  drift   has_wiki = true (expected false)
  drift   has_projects = true (expected false)
  drift   topics = none (expected astro,deck-legality,fabtcg,…)
  drift   vulnerability_alerts = false (expected true)

Ruleset — default-branch
  drift   ruleset 'default-branch' does not exist

Classic branch protection
  ok      no classic branch protection (the ruleset is the single source of truth)

Configuration has drifted. Run scripts/repo-settings.sh to restore it.
   (exit 1)
```

That is the drift check doing exactly its job: it read a real repository, found
eleven divergences and a missing ruleset, and exited non-zero. It also proves
the ownership assertions are live rather than aspirational.

**The drift check runs on a schedule, not as a required check.** It was
originally a `repo-settings` job inside `ci.yml` wired into `gate`'s `needs:`,
and that was a deadlock: GitHub returns the `allow_*` / `delete_branch_on_merge`
fields only to a token with administrative read, and a workflow's `permissions:`
block has no `administration` scope at all, so `GITHUB_TOKEN` provably cannot be
raised to it. `gh api repos/alxjrvs/optfall/actions/secrets` returns an empty
list. The job would therefore have exited 2 ("undetermined — failing closed") on
every pull request and taken the aggregate gate red with it — leaving every
merge blocked until a human hand-made a PAT, which is the exact auto-merge
deadlock Phase 0 exists to prevent, reintroduced by the mechanism meant to
protect it.

It now lives in `.github/workflows/repo-settings-check.yml`: weekly, plus
`workflow_dispatch`, plus pushes that touch the script itself. On drift or an
unreadable configuration it opens (or comments on) a single labelled issue
rather than failing a build. Before `REPO_SETTINGS_TOKEN` exists it emits a
warning annotation and stops, because a check that cries wolf every Monday
before it is even configured is one people learn to ignore.

This is also simply the right trigger. Repository settings drift when somebody
changes a setting, not when somebody changes code. The general rule it implies
is worth keeping: **a required check must be something the repository can
satisfy on its own** — anything needing a human-issued credential belongs on a
schedule, reporting to an issue.

The script has been extended beyond the merge settings to assert owner, owner
*type* and visibility — which is what makes COMPLIANCE §1's personal-ownership
rule machine-checked rather than a paragraph.

### Netlify configuration in `netlify.toml` — **done** (the file); the site itself, **not done**

`netlify.toml` exists at the root: `command = "bun run build"` from the
repository root (identical to what CI runs), `publish = "apps/site/dist"`,
`NODE_VERSION = "22"`, `BUN_VERSION = "1.3.14"`, `X-Content-Type-Options` and a
referrer policy on production, `X-Robots-Tag: noindex` on previews and branch
deploys. No functions, no edge handlers, no secrets. The three settings that
live only in the Netlify UI (production branch, previews on, branch deploys off)
are written down in the file's header rather than left as folklore.

No Netlify site exists. Creating one and linking it to the repository is an
OAuth grant between two accounts and is not expressible as configuration.

### Agent-friendly settings — squash-only, linear history, branch deletion, no required review, empty bypass — **not done**

Fully *declared* in `scripts/repo-settings.sh`, and provably *not applied*: see
the drift output above. `allow_auto_merge` is `false` and the `default-branch`
ruleset does not exist on the live repository.

The declaration is right. The ruleset body sets `deletion`, `non_fast_forward`,
`required_linear_history`, one `required_check` with context `gate`, no
`pull_request` rule (so no required human review), no `bypass_actors`, and
`do_not_enforce_on_create: true` so the first push cannot deadlock against its
own status check. `GATE_JOB="gate"` matches `ci.yml`'s job name byte for byte.

### CI with a single aggregate gate — **done**

`.github/workflows/ci.yml`, `permissions: contents: read` at workflow level, on
`pull_request` and `push` to `main`. Six jobs plus the gate, parsed from the
file:

| job | purpose |
|---|---|
| `typecheck` | `bun run typecheck` |
| `lint` | `bun run lint` |
| `test` | `bun run test` |
| `build` | `bun run build` |
| `no-llm-dependencies` | manifest scan for LLM/AI-SDK dependencies |
| `disclaimer` | asserts the LSS text byte-exact in every built page |
| `gate` | `if: always()`, `needs:` all six |

Every one of those six can be satisfied by the repository alone — no secret, no
human-issued credential, nothing to install by hand. That is what makes the gate
reachable, and it is the property to preserve when Phase 1 adds a11y and
visual-regression jobs to it.

The aggregation is an allowlist — only `success` and `skipped` pass, so
`cancelled`, `failure`, an unrecognised value and an empty `needs` all fail.
There is no workflow-level `paths:` filter, which is correct: filtering the
workflow would skip `gate` itself and strand the required check in pending
forever. The gate additionally re-reads its own workflow file and fails if any
job in `jobs:` is missing from `needs:`, which closes the one silent-downgrade
hole an aggregate gate normally has.

### Netlify — production deploy from `main`, deploy previews on every PR — **not done**

No site, so no deploys and no previews. This is the deliverable that blocks the
first clause of the exit criteria outright.

### Compliance boilerplate — disclaimer, data terms, copyright line, no-logo rule in the tokens — **partial**

Done, and verified:

- **The disclaimer is verbatim and enforced.** It lives in one exported constant
  (`apps/site/src/lib/compliance.ts`), is rendered by `ComplianceFooter.astro`
  from `BaseLayout.astro` so it is on every page, and `bun run check:disclaimer`
  extracts the canonical text out of `docs/PLAN.md` and asserts it byte-exact in
  every built page. I ran it: `Every page carries the Legend Story Studios
  disclaimer, verbatim. ✔`. There is also a unit test tying the constant to
  PLAN.md, inside the 25 that `bun test` runs.
- **No binary assets exist anywhere** — no images, no favicon, no set symbols,
  no fonts. Nothing to be non-compliant with yet.
- `LICENSE` is unmodified MIT, © 2026 alxjrvs, deliberately silent on data so
  licence detection stays clean.
- `docs/COMPLIANCE.md` turns the permission envelope into six enforcement
  sections with breakage modes and detection for each; `docs/DATA-TERMS.md`
  picks CC0-1.0 over the structural layer only and passes LSS's conditions
  through to recipients verbatim.

What makes it partial:

- ~~**The no-logo token guard is much weaker than COMPLIANCE §3 claims.**~~
  **Fixed.** It matched only whole dot-separated segments, so `asset.fab-logo`,
  `brand.lss-logo`, `icon.setSymbol`, `ornament.set-symbol-icon` and
  `image.fabLogo` all passed straight through — four of the five plausible ways
  a set symbol actually gets added. `isForbiddenTokenId` now splits on
  separators *and* camelCase humps and matches on word boundaries. Re-probed:
  all of the above return `true`, while `color.dialog.overlay` and
  `space.dialog.offset` correctly return `false` — an intermediate fix that
  stripped separators entirely matched "logo" inside "dialog…overlay" and would
  have failed builds on legitimate Phase 1 tokens.
- ~~**The card-image copyright line has three spellings and no test.**~~
  **Fixed, and the diagnosis was half right.** Two of the three "spellings" are
  not drift: the policy mandates the notice `© Legend Story Studios`, and
  `CARD_IMAGE_COPYRIGHT` is Optfall's *rendering* of it, which wraps that notice
  in a sentence. So the check asserts containment, not equality —
  `scripts/canonical-disclaimer.test.ts` now verifies the mandated form appears
  in both compliance documents and inside the constant. Pinning the full
  rendering to an exact string was tried and reverted: it would have made the
  wording *look* ratified while the mandated form and our rendering drifted
  apart independently, which is the failure the disclaimer check exists to
  prevent, reintroduced one requirement over.
- **The LSS terms page has never been read.** `fabtcg.com` returns 403 to
  automated fetches. The clause summaries were assembled from search excerpts
  plus the envelope already in PLAN.md. COMPLIANCE.md carries this as a named
  open action, correctly. The disclaimer text itself is *not* subject to that
  caveat — it came from PLAN.md.
- `docs/DATA-TERMS.md` has every published payload carry
  `"terms": "https://optfall.com/data-terms"`, and no such route exists
  (`apps/site/src/pages/` contains only `index.astro`). Nothing is published
  yet, so nothing is breached — but the route must exist before the first
  dataset does.

### Licence issue opened upstream — **not done, deliberately**

`docs/upstream-licence-issue.md` is a prepared draft with a NOT-POSTED banner
and a pre-posting checklist. Its factual claims were independently verified
against the read-only GitHub API: `the-fab-cube/flesh-and-blood-cards` has
`license: null`, default branch `develop`, and issue #119 ("Add missing license
to repository") is open since 2022-09-13 with an empty body and zero comments.
The draft is written as a comment reviving #119 rather than a duplicate issue,
which is the right call.

Posting it is a human action and stays one — see the handoff.

---

## 2. Current build status

Every command below was run from the worktree root on Bun 1.3.14. All passed.

| command | result |
|---|---|
| `bun install` | `Checked 303 installs across 433 packages (no changes)` |
| `bun install --frozen-lockfile` | same — the lockfile is in sync, so CI's form works |
| `bun run typecheck` | 4 workspaces + root, all clean; `astro check`: **0 errors, 0 warnings, 0 hints** across 6 files |
| `bun run lint` | `oxlint --deny-warnings` → **0 warnings, 0 errors**, 13 files, 133 rules |
| `bun run test` | **25 pass, 0 fail**, 50 `expect()` calls, 3 files |
| `bun run build` | `optfall-legality` bundled (index.js 2.67 KB) + `@optfall/site` → 1 page, `apps/site/dist` |
| `bun run check:disclaimer` | `Checked 1 built page(s)… Every page carries the LSS disclaimer, verbatim. ✔` |
| `./scripts/repo-settings.sh --check` | exit 1, correctly reporting 11 drifts and a missing ruleset (output in §1) |
| `bash -n scripts/repo-settings.sh` | clean |

Built output is `apps/site/dist/index.html` (2.5 KB) plus one
`_astro/client.svelte.*.js` chunk — the Svelte renderer, currently unreferenced
because no island exists yet. No images, no logos, no script tags in the page.

Two things the build does **not** do, despite comments implying otherwise:
`packages/theme` and `packages/components` declare no `build` script and are
silently skipped by the workspace filter (harmless today — the site consumes
them as TypeScript source through `exports`), and `oxlint` parses neither
`.astro` nor `.svelte`, so the three `.astro` files including
`ComplianceFooter.astro` are not linted by anything.

Zero-LLM, independently re-verified: no LLM or AI-SDK name appears in any of the
five manifests or in `bun.lock`; `grep` across `apps/site/src` and
`packages/*/src` finds no `fetch(`, no `XMLHttpRequest`, no `WebSocket` and no
remote URL. Nothing calls a model at runtime or at build time.

Not installed on this machine, so not run: `terraform` (nothing to run it
against — `infra/` is gone) and `actionlint`.

---

## 3. Findings that were not fixed

The repair pass fixed nine findings at root cause: the decorative lint gate
(`.oxlintrc.json` + `--deny-warnings`, both now proven), the Terraform/script
split brain (`infra/` deleted, every Terraform-only setting ported into the
script, stale comments repointed), the unwired drift check, the missing
disclaimer check, the bootstrap deadlock, the 403-vs-404-blind protection probe,
the gate-completeness hole, and COMPLIANCE.md's overstated lockfile claim.

These remain. Each was re-verified today rather than taken from a report.

### Medium

~~**The zero-LLM scanner has demonstrated allowlist holes.**~~ **Fixed.** The
scanner previously returned `✔` exit 0 on a manifest declaring `@openai/agents`,
`@google-cloud/vertexai`, `together-ai` and `gpt4all`, a nested override
`{"some-lib": {"openai": "^6"}}`, and path-style resolutions `"astro/openai"`
and `"**/langchain"` — every one of them a real way to introduce an LLM SDK.
Three defects, all closed:

- the allowlist gained the `@openai/` scope and the missing exact names;
- `walk()` now recurses into nested override maps, instead of reading only the
  outer key and calling `{"some-lib": {"openai": "^6"}}` clean;
- `candidateNames()` decomposes path-style keys, so `"astro/openai"` and
  `"**/langchain"` are matched on their package segment rather than on the raw
  string, with `@scope/name` pairs rejoined so scoped packages survive the
  split.

Re-verified by extracting the scanner and running it against all seven cases:
each now emits a `::error` and exits 1, and the real tree still passes.

~~**The scanner reads manifests only, never `bun.lock`.**~~ **Fixed.** This was
the one that mattered most, because the rule is about what the product
*contains*, not what we chose to type: an LLM SDK arriving as somebody else's
transitive dependency shipped into the bundle with every manifest clean and the
gate green. The scanner now reads the resolved tree out of `bun.lock` (416
packages today) and treats a **missing** lockfile as a failure, since a pass
over an unknown tree is a pass over nothing. Verified against a fixture whose
manifests are clean and whose lockfile contains `@anthropic-ai/sdk`: exit 1.

**The scanner is a 130-line heredoc written into `RUNNER_TEMP` at job time.** It
is the only substantial code in the repo that is never typechecked, never
linted, never tested and impossible to run locally — I had to extract it with a
YAML parser to exercise it at all, which is exactly the friction the next
maintainer hits. It should be `scripts/no-llm-check.ts` with a colocated test,
the way `check-disclaimer.ts` already is. *Why it remains:* moving it is
entangled with fixing the two findings above; doing all three at once is one
coherent change rather than three.

~~**The no-logo token guard matches only exact whole segments.**~~ **Fixed** —
see §1. Worth noting that the fix suggested here (strip non-alphanumerics, then
`includes`) was implemented, found to be wrong, and replaced: it matches "logo"
inside `color.dialog.overlay`, so it would have failed builds on legitimate
Phase 1 tokens while accusing them of breaching LSS's asset policy. Word-boundary
matching is what actually works.

~~**`CARD_IMAGE_COPYRIGHT` has three spellings across three files with no
test.**~~ **Fixed** — see §1. The deferral reasoning below was sound and is why
the fix asserts *containment* rather than equality: the mandated notice is
`© Legend Story Studios`, the rendering wraps it, and the wrapper is still
unratified pending a human reading the live LSS terms page. Containment binds
what is actually specified without canonicalising what is not.

**`apps/site/package.json` uses five caret ranges** — `@astrojs/svelte ^9.0.1`,
`astro ^7.2.0`, `svelte ^5.56.8`, `@astrojs/check ^0.9.10`, `typescript ^6.0.3`
— directly against `bunfig.toml`'s `install.exact = true` and its stated
rationale, and against PLAN.md Phase 1's "pin versions deliberately". Every
other manifest in the workspace is pinned exactly. The lockfile pins the
resolution today; the exposure is the next fresh resolution. *Why it remains:*
not in the repair pass's file set.

### Low

- **`scripts/check-disclaimer.ts` applies a Markdown normaliser to built HTML.**
  `normalizeProse()` strips a leading `>` from every line, which is right for a
  Markdown blockquote and wrong for HTML, where a line can legitimately begin
  with a tag-closing `>`. The blast radius is confined to the *diagnostic*: a
  genuinely-absent disclaimer can be reported as "reflowed or split across
  elements" rather than "does not contain". Pass/fail is decided by the
  byte-exact `html.includes(expected)` above it, so this cannot produce a false
  pass — it can only send someone looking in the wrong place.
- **`assertDeck` validates less than its documentation claims.** It checks
  `hero` is non-empty and `quantity` is a positive integer, but not that
  `cardId` is non-empty or that `cards` is an array — while the JSDoc and the
  test name ("validates its arguments before deferring") read as full argument
  validation. Harmless today because evaluation throws `NotImplementedError`
  regardless; the point is that Phase 2's real implementation will inherit the
  gap along with the reassuring docstring.
- **`oxlint` cannot parse `.astro` or `.svelte`** (confirmed: it offers a Vue
  plugin and nothing else). Three `.astro` files are unlinted today, and Phase
  1's exit criterion — "CI fails if anyone writes a raw hex" — needs a linter
  that can see component source. Decide the mechanism (eslint-plugin-astro +
  eslint-plugin-svelte, or a stylelint pass) before Phase 1 components land.
- **`netlify.toml` claims the root build "fans out across every workspace in
  dependency order".** Observed: it builds two of four; `theme` and `components`
  declare no build script and are skipped. Harmless now, misleading later.
- **Two TypeScript majors are installed and both are used** — root `7.0.2` for
  `packages/*`, `apps/site`'s own `6.0.3` for `astro check`. This is *correct*,
  not broken: `@astrojs/check`'s peer range is `^5 || ^6`, so aligning the site
  to 7 would break it. It is undocumented, which makes the obvious tidy-up a
  regression waiting to happen.
- **Actions are pinned to mutable major tags**, not commit SHAs —
  `actions/checkout@v4` and `oven-sh/setup-bun@v2` throughout `ci.yml`, and
  `dependabot/fetch-metadata@v2` in the one job holding `contents: write`.
- **`dependabot-auto-merge.yml` declares `permissions:` at workflow level**, so
  every job the file ever gains inherits write. Should be on the job.
- **Bun version drift:** CI pins the floating `1.3.x`, `netlify.toml` pins
  `1.3.14`. A green gate can attest to a build on a Bun that never produced the
  deploy preview.
- **The CI install step's `else` branch is dead** — `bun.lock` is committed, so
  the only remaining effect of `if [ -f bun.lock ] … else bun install` is that a
  PR deleting the lockfile silently downgrades four jobs to an unpinned install
  and still goes green.
- **`package-ecosystem: bun` in `dependabot.yml` is unverified.** If GitHub
  rejects the value it rejects the *whole* config, silently taking the
  `github-actions` updates with it, and the failure surfaces only under Insights
  → Dependency graph. Check it after the first push; the fallback is `npm`,
  which reads `bun.lock`.
- ~~**`scripts/repo-settings.sh` uses `declare -A` with no bash-4 guard.**~~
  Fixed. It now checks `BASH_VERSINFO` and exits 2 with an explanation.
  Confirmed by running it under `/bin/bash` (3.2.57), which reports the version
  and how to fix it instead of dying on a syntax error.
- **`README.md` is stale.** It says "Pre-Phase-0. Nothing is built yet," and its
  Documents table lists only PLAN and DESIGN — so `COMPLIANCE.md` and
  `DATA-TERMS.md`, the terms document that DATA-TERMS itself directs consumers
  to, are unreachable from the repository's front door.
- **No `/data-terms` route exists** for the URL every published payload will
  carry.

### Not a defect, but not verified either

`do_not_enforce_on_create: true` is reasoned from the documented REST default,
never observed against GitHub. The script's `--check` and apply modes were
exercised against a `gh` stub with hand-written fixtures; today's live run
(§1) is the first real read, and it behaved correctly. **Apply mode has still
never run against GitHub.**

Also open and undecided rather than unfixed: whether an affiliate "buy this
card" link counts as indirect monetisation (permitted, like ad-sense) or direct
(barred). The interim rule recorded in COMPLIANCE.md is *do not add one without
asking LSS first*, which is the right default.

---

## 4. The handoff

Ordered. Each step says why an agent session cannot do it.

### 0. Review and push the working tree

The orchestrator commits. Pushing is yours.

```bash
cd /Users/jarvis/Code/OptFall
git log --oneline -5
git push -u origin main
```

*Why not an agent:* this run was write-files-only; no agent staged, committed or
pushed anything, by instruction. Note the remote is currently **one commit ahead
of the local `main`** (`79f5c16e`, the PLAN.md amendment that rejects Terraform)
— fetch and rebase before pushing.

### 1. Repository creation — already done, nothing to do

`alxjrvs/optfall` exists, public, on the personal account, `main` as default.
Skip the `gh repo create` step in the script's bootstrap comment; it is written
for a repository that does not exist yet.

Confirm with `gh repo view alxjrvs/optfall --json visibility,owner`.

### 2. Apply the repository settings and the ruleset

```bash
cd /Users/jarvis/Code/OptFall
./scripts/repo-settings.sh          # apply
./scripts/repo-settings.sh --check  # must now exit 0
```

*Why not an agent:* nothing about the token — the script authenticates with
`gh`, which an agent session already has, and PLAN.md deliberately keeps it in
that category. It was not run here because **this run forbade every
network-mutating command.** A later agent session can legitimately run it. Run
it *after* the push if you want the first push to be uneventful; the ruleset
sets `do_not_enforce_on_create: true`, so either order should work, but that
flag has never been observed in practice.

Expect the second command to exit 0. If it exits 2 rather than 0 or 1, your
local `gh` token lacks administrative read — that is the same failure the CI
job has, and step 3 fixes both.

### 3. Create `REPO_SETTINGS_TOKEN` and add it as a repository secret

**Optional, and deliberately not on the critical path.** This used to be the
single hard blocker on the aggregate gate; rewiring the drift check onto a
schedule removed it from the merge path entirely. Auto-merge works without this
token. What you lose by skipping it is only the weekly drift check, which warns
and stops until the secret exists — so the cost of deferring is that the
repository's configuration goes unverified, not that anything is blocked.

1. github.com → Settings → Developer settings → Personal access tokens. Either
   a **classic** token with `repo` scope, or a **fine-grained** token scoped to
   `alxjrvs/optfall` with **Administration: read**. Prefer fine-grained: this
   token only ever reads settings.
2. Then, from your own terminal:

```bash
gh secret set REPO_SETTINGS_TOKEN --repo alxjrvs/optfall
# paste the token at the prompt
gh api repos/alxjrvs/optfall/actions/secrets --jq '.secrets[].name'   # confirm
```

*Why not an agent:* creating a PAT is web-UI only — there is no API to mint one.
And this machine's permission rules deny the agent's entire path to secret
resolution (`Bash(op:*)`, `Bash(op-agent:*)`, `Bash(git credential:*)`), so an
agent cannot read, store or hand over a credential even if one existed.

### 4. Create the Netlify site and link it to the repository

```bash
netlify login          # opens a browser; the CLI is already installed
cd /Users/jarvis/Code/OptFall
netlify sites:create --name optfall --account-slug <your-team-slug>
netlify link
```

Then in the Netlify UI, confirm the three settings `netlify.toml` documents in
its header, because they live only there:

- production branch → `main`
- deploy previews → **on**
- branch deploys → **off**
- and enable "prevent non-git production deploys" if the plan offers it

Build command and publish directory come from `netlify.toml` at build time and
override whatever the UI stores, so you do not need to get those right in the
form.

*Why not an agent:* two independent reasons. The repo↔Netlify link is an **OAuth
grant between two accounts** — it is not expressible as configuration and there
is no API that performs it on your behalf; this is exactly why there is no
Terraform Netlify site resource to begin with. And it needs a Netlify token,
which lands squarely in the denied secret-resolution path above. PLAN.md's own
operational note says this: *"anything needing a Netlify token runs from a human
terminal rather than from inside an agent session."*

### 5. `terraform apply` — do not

There is nothing to apply. `infra/` was deleted, and `docs/PLAN.md` lines 105,
555 and 568 settle the repository configuration as a `gh api` script and record
the state-backend question as *retired by that decision rather than answered*.
Reintroducing Terraform would recreate the split-brain configuration this run
removed: two declarations of the same ruleset, whichever ran last winning, and
neither able to tell you so. If you want Terraform back, that is a PLAN.md
amendment first and a deletion of `scripts/repo-settings.sh` second — never
both mechanisms.

### 6. Post the upstream licence request

Read `docs/upstream-licence-issue.md` end to end, edit it into your own voice,
then post it as a **comment on the existing issue #119**, not as a new issue:

<https://github.com/the-fab-cube/flesh-and-blood-cards/issues/119>

*Why not an agent:* the text asks a favour of a volunteer maintainer on behalf
of a named person and cites a third party's legal terms. Both are things a
person sends under their own name having read them. The draft's factual claims
were verified against the read-only API; its tone is yours to own.

### 7. Read the LSS terms page and ratify `docs/COMPLIANCE.md`

<https://fabtcg.com/en/terms-of-use-game-and-studio-assets-and-ip/> — read it end
to end and correct COMPLIANCE.md, especially the **exact disclaimer wording**,
the **card-image copyright line** and the **logo clause**.

*Why not an agent:* `fabtcg.com` returns HTTP 403 to automated fetches — PLAN.md
already records this, and I confirmed the Wayback Archive was unavailable too.
No agent can read it. This is COMPLIANCE.md's open action #1, and it gates the
first public deploy.

The copyright-line finding in §3 unblocks the moment this is done: settle the
required wording, then canonicalise `CARD_IMAGE_COPYRIGHT` and add its test.

### 8. Verify the exit criteria with a trivial pull request

Once 0–4 are done:

```bash
cd /Users/jarvis/Code/OptFall
git switch -c chore/exit-criteria-probe
# make a one-line, obviously harmless change
gh pr create --fill
gh pr checks --watch
```

Watch for four things, in order: a Netlify deploy-preview check appears; `gate`
reports (and is the *only* required check); the PR shows no "review required";
`gh pr merge --auto --squash` lands it with no human approval.

*Why not an agent:* it opens a pull request and merges to `main`, both forbidden
this run — and it is the acceptance test, which is worth watching yourself.

---

## 5. Open questions Phase 0 could not settle

**The Terraform state backend — closed, not open.** `docs/PLAN.md` line 567
retired it: *"the state-backend question that sat here is gone rather than
answered — dropping Terraform removed the thing that needed a backend."* The
`infra/README.md` that reopened it at length has been deleted along with the
rest of `infra/`. Recording this explicitly because the brief for this run
listed Terraform as a constraint, which the plan contradicts; the plan wins.
Nothing here needs a state file.

**The domain — moved, and needs your confirmation.** PLAN.md says `optfall.com`
did not resolve when checked. **It resolves now:**

```
$ dig +short optfall.com A
216.40.34.41
$ dig +short optfall.com NS
ns1.hover.com.  ns2.hover.com.
```

Hover nameservers and a Hover parking address — which most likely means you
registered it, but could mean someone else did. Confirm it is yours, then decide
whether the site is served from `optfall.com` or a Netlify subdomain. This
matters beyond cosmetics: `docs/DATA-TERMS.md` already commits every published
payload to carrying `"terms": "https://optfall.com/data-terms"`, and that route
does not exist yet. Settle the domain, then add the route, before any dataset
ships in Phase 2.

**The display typeface** — untouched by Phase 0, wanted before Phase 1 ends.

**Whether past banned-and-restricted revisions are publicly archived** — PLAN.md
makes this the first task of Phase 2, before the estimate hardens. Untouched.

**Affiliate links** — recorded, undecided, interim answer is no. See §3.

**The lint mechanism for `.astro` and `.svelte`** — a new question this phase
surfaced. `oxlint` structurally cannot see the source that Phase 1's exit
criterion ("CI fails if anyone writes a raw hex") is about. Decide before Phase
1 components land, not after.

**Whether the `repo-settings` CI job is worth its token.** It requires a
standing PAT with administrative read as a repository secret — a real, if small,
standing credential — in exchange for continuous drift detection. The
alternative is running `--check` by hand and accepting that drift surfaces when
someone remembers. PLAN.md is unambiguous that the CI wiring is the point
("Asserted, not merely declared"), so this is implemented, not relitigated — but
it is a cost the plan did not price, and you should know you are paying it.

---

## 6. Can the Phase 0 exit criteria be met?

The criterion, from `docs/PLAN.md` line 191:

> A trivial pull request opens a deploy preview, passes the aggregate gate, and
> auto-merges with no human approval — and the repo configuration can be wiped
> and restored by running `scripts/repo-settings.sh` alone.

**Judged strictly today: no. Three things stand in the way, and all three are in
the handoff.**

| clause | status | what stands in the way |
|---|---|---|
| opens a deploy preview | **no** | No Netlify site exists. Handoff step 4. |
| passes the aggregate gate | **plausibly yes, unobserved** | All six gated jobs are satisfiable by the repository alone — no secret, no credential. The gate has never run on GitHub, so this is reasoned, not seen. |
| auto-merges with no human approval | **no** | `allow_auto_merge = false` and the ruleset does not exist on the live repo — verified. Handoff step 2. |
| configuration restorable from the script alone | **nearly** | The script is the sole mechanism and its `--check` mode demonstrably reads live GitHub. Apply mode has never run against GitHub. |

Nothing on that list is a design problem. Every remaining item is a credential
or an account link that an agent session structurally cannot perform, which is
the correct place for Phase 0 to stop.

The gate row moved after this report was first written. It read **no**, blocked
on `REPO_SETTINGS_TOKEN`, until the drift check was moved off the merge path
onto a schedule. That is worth recording as a finding in its own right: the
blocker was not a missing credential but a self-inflicted design error — a
required check that could not be satisfied without a human, inside the one phase
whose entire purpose is a merge path with no human in it.

Two honest qualifications on the last row.

**"Restored by the script alone" is true of the configuration, not of the
repository.** The script asserts and applies ownership, visibility, merge
settings, repository features, topics, vulnerability alerts and the ruleset —
which is a superset of what the deleted Terraform declared, since the
Terraform-only settings were ported into it during repair. It does not create
the repository, and it does not touch Netlify. PLAN.md's wording is
"configuration", so this reading is the plan's own; but if the repository were
deleted, the script alone would not bring it back.

**Apply mode is unproven.** `--check` ran live today and behaved exactly right —
correct drift on eleven settings, correct detection of the missing ruleset,
correct exit 1. Apply mode has only ever run against a stub. The first real run
is handoff step 2, and `--check` returning 0 immediately afterwards is what
converts this row from *nearly* to *yes*.

**Once steps 2, 3 and 4 are done, step 8 is the acceptance test.** If it goes
green end to end, Phase 0 is closed and Phase 1 is unblocked. If it does not,
the most likely culprits in order are: `do_not_enforce_on_create` behaving
differently than documented, the `bun` Dependabot ecosystem having been rejected
wholesale, and the Netlify preview check not appearing because branch deploys
were left on.

The one thing that was not allowed to wait for Phase 1 — **the zero-LLM
scanner's evasion holes** — is now closed. It is the enforcement mechanism for
the project's single most binding rule, and six real language-model packages
demonstrably passed it. It now recurses into nested overrides, decomposes
path-style keys, reads `bun.lock` for the resolved tree, scans the array-shaped
`trustedDependencies` field, and fails on a missing lockfile. Every one of those
cases was re-run against a fixture and exits 1; the real tree (416 packages)
still passes.

What remains open on that gate is not correctness but *placement*: it is still a
130-line heredoc inside `ci.yml`, never typechecked, never linted, and runnable
only by extracting it with a YAML parser. It should become
`scripts/no-llm-check.ts` with a colocated test, the way `check-disclaimer.ts`
already is. That is a Phase 1 tidy-up, and the reason to record it is that a
gate nobody can run locally is a gate nobody will extend correctly.
