#!/usr/bin/env bash
#
# Optfall repository configuration, as a re-runnable script.
#
#   scripts/repo-settings.sh            apply the configuration
#   scripts/repo-settings.sh --check    verify the live repo matches; exit non-zero on drift
#
# THIS IS THE ONLY MECHANISM. There is deliberately no Terraform:
# docs/ROADMAP.md ("Settled") records the decision — one repository and a short
# checklist does not justify a state file, a provider dependency and a language
# nobody on this project
# writes. If you are about to add a second mechanism, don't: two declarations of
# the same ruleset means whichever ran last wins and neither can tell you so.
#
# What Terraform would not have given us for free is the --check mode. Drift
# only surfaces from `terraform plan` when somebody remembers to run it, whereas
# --check runs on a schedule in .github/workflows/repo-settings-check.yml.
#
# THAT CHECK IS DELIBERATELY NOT A REQUIRED CI JOB. It was one, briefly, and it
# deadlocked: reading the settings below needs administrative read, a workflow's
# `permissions:` block has no `administration` scope, so GITHUB_TOKEN cannot be
# raised to it and only a hand-made PAT works. As a gated job it left every pull
# request red until a human installed a token — the exact auto-merge deadlock
# Phase 0 exists to prevent. If you are about to "fix" the schedule by moving
# this back into ci.yml's gate, that is the thing that breaks.
#
# Authentication is `gh`, deliberately. It needs no 1Password token, so this
# stays runnable from an agent session rather than requiring a human terminal.
#
#   READING THE SETTINGS NEEDS MORE THAN READ ACCESS. GitHub returns the
#   allow_*/delete_branch_on_merge fields only to a token with administrative
#   read on the repository, and omits them entirely otherwise. A --check run
#   that cannot see them reports UNDETERMINED and exits 2 — it never reports
#   "matches", because a check that passes when it cannot see anything is worse
#   than no check.
#
# Exit codes:
#   0  live configuration matches this file
#   1  drift — something differs from the specification below
#   2  undetermined — the token cannot read something; failing closed
#
# BOOTSTRAP ORDER, once:
#
#   1. `gh repo create alxjrvs/optfall --public` — an empty repository. No
#      auto-init: the working tree already has content, and a generated root
#      commit is just something the first push has to reconcile with.
#   2. Run this script (no --check) to apply the settings and the ruleset.
#   3. Push `main`. The ruleset does not block that: there is no `creation`
#      rule, and the status check sets do_not_enforce_on_create (see below).
#   4. Add the REPO_SETTINGS_TOKEN secret so CI can run --check.
#   5. Add the CLOUDFLARE_API_TOKEN secret so the deploy workflow can publish —
#      see .github/workflows/deploy-cloudflare.yml, which skips without it.
#
#   Every change to `main` after that is a pull request. Direct pushes are
#   blocked by the required status check, which is the intended end state.
#
# Every value below is a specification, not a preference — several are
# load-bearing in non-obvious ways, and each is annotated with why. The decision
# they implement is docs/ROADMAP.md's Phase 0: repository settings as a `gh api`
# script rather than Terraform.

set -euo pipefail

REPO="${OPTFALL_REPO:-alxjrvs/optfall}"

# Personal ownership is a COMPLIANCE requirement, not a preference: LSS's
# third-party application policy bars applications built by commercial
# entities, so this must stay a personal account. See docs/COMPLIANCE.md §1.
EXPECTED_OWNER="${REPO%%/*}"

# The sole required status check. This MUST match the DISPLAY name of the
# aggregate job in .github/workflows/ci.yml exactly — that job's `name:`, not
# its key. GitHub matches a required context against the check-run name, and a
# job that sets `name:` reports under that string; the key `gate` never appears
# as a status at all. Requiring individual CI jobs instead strands required
# checks in "pending" forever on path-filtered pull requests, which is the
# single most common way this configuration is got wrong.
#
# "CI Success" is a cross-repo standard (issue #132), shared with binfinite-app,
# SU-SRD and randsum so one ruleset checklist covers all four.
GATE_JOB="CI Success"

RULESET_NAME="default-branch"

usage() {
  cat <<'USAGE'
Usage: scripts/repo-settings.sh [--check]

  (no arguments)  Apply the configuration to the live repository.
  --check         Verify the live repository matches; change nothing.
  -h, --help      Show this message.

Exit codes: 0 matches / applied, 1 drift, 2 undetermined or usage error.
USAGE
}

# Parse strictly, and default to the NON-mutating answer on anything unknown.
#
# The obvious spelling — `[[ "$1" == "--check" ]] && CHECK_ONLY=true` — treats
# every unrecognised argument as "apply". So `--dry-run`, `--help`, `-check` or
# a plain typo would silently PATCH the live repository settings and create or
# update the ruleset. For a script whose entire purpose is that its two modes
# differ, guessing "mutate" from an argument we did not understand is the one
# unacceptable default.
CHECK_ONLY=false
case "${1:-}" in
  --check) CHECK_ONLY=true ;;
  -h|--help) usage; exit 0 ;;
  "") ;;
  *)
    echo "error: unknown argument '${1}'." >&2
    echo >&2
    usage >&2
    exit 2
    ;;
esac

if [[ $# -gt 1 ]]; then
  echo "error: unexpected extra arguments: ${*:2}" >&2
  echo >&2
  usage >&2
  exit 2
fi

drift=0
undetermined=0

# Colour only when stdout is a terminal, and never when NO_COLOR is set.
#
# This output is not only read by humans: the scheduled drift workflow captures
# it and pastes it into a GitHub issue. Emitting escapes unconditionally would
# put raw \033[31m sequences in the issue body — the one place the report most
# needs to be readable, and the one place nobody would notice until drift
# actually happened.
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
  C_OK=$'\033[32m'; C_BAD=$'\033[31m'; C_UNK=$'\033[33m'; C_OFF=$'\033[0m'
else
  C_OK=""; C_BAD=""; C_UNK=""; C_OFF=""
fi

note() { printf '  %s\n' "$*"; }
ok()   { printf '  %sok%s            %s\n' "$C_OK"  "$C_OFF" "$*"; }
bad()  { printf '  %sdrift%s         %s\n' "$C_BAD" "$C_OFF" "$*"; drift=1; }
unk()  { printf '  %sundetermined%s  %s\n' "$C_UNK" "$C_OFF" "$*"; undetermined=1; }

# Run a `gh api` GET and classify the outcome instead of swallowing it.
#
# This exists because `gh api ... >/dev/null 2>&1` cannot tell 403 from 404, and
# for a probe whose "absent" answer is the passing one, that difference is the
# entire result.
#
# IT RETURNS THE BODY IN A GLOBAL, NOT ON STDOUT, AND THAT IS DELIBERATE. The
# obvious spelling — `body="$(api_get …)"` — runs the function in a
# command-substitution subshell, so every variable it sets dies with that
# subshell. `api_status` would then still hold whatever the *previous*
# non-subshell call left behind, and the error message would confidently report
# a stale status: a 403 on one endpoint printed as the 404 from the last probe.
# Silently wrong beats blank, so:
#
#     if api_get "repos/${REPO}"; then use "$api_body"; else … "$api_status"; fi
#
api_status=0
api_body=""
api_get() {
  local path="$1" errfile rc=0
  errfile="$(mktemp "${TMPDIR:-/tmp}/repo-settings-err.XXXXXX")"

  set +e
  api_body="$(gh api "$path" 2>"$errfile")"
  rc=$?
  set -e

  local err
  err="$(cat "$errfile" 2>/dev/null || true)"
  rm -f "$errfile"

  if [[ $rc -eq 0 ]]; then
    api_status=0
    return 0
  fi

  api_body=""
  if [[ "$err" =~ HTTP\ ([0-9]{3}) ]]; then
    api_status="${BASH_REMATCH[1]}"
  else
    api_status="000"
  fi
  printf '%s' "$err" >&2
  return 1
}

# ---------------------------------------------------------------------------
# Preconditions
# ---------------------------------------------------------------------------

# This script uses associative arrays, which are bash 4+. macOS ships bash 3.2
# as /bin/bash and always will (it is GPLv2-pinned), so on a stock macOS PATH
# this would otherwise die mid-run with a syntax error rather than a diagnosis.
if (( BASH_VERSINFO[0] < 4 )); then
  echo "error: bash 4+ required; this is ${BASH_VERSION}." >&2
  echo "       macOS ships bash 3.2 as /bin/bash. Install a modern bash" >&2
  echo "       (\`brew install bash\`) and re-run — the shebang picks it up" >&2
  echo "       from PATH automatically." >&2
  exit 2
fi

for tool in gh jq; do
  command -v "$tool" >/dev/null 2>&1 || {
    echo "error: ${tool} is required and is not on PATH." >&2
    exit 2
  }
done

if ! api_get "repos/${REPO}"; then
  echo "error: cannot read repos/${REPO} (HTTP ${api_status}). Is \`gh\` authenticated, and does the repository exist?" >&2
  exit 2
fi
live_settings="$api_body"

# ---------------------------------------------------------------------------
# Ownership and visibility
# ---------------------------------------------------------------------------
#
# An organisation owner would forfeit the permission envelope the whole project
# depends on, so this is asserted rather than assumed. Public is not incidental
# either: the openly published datasets are the backup, the audit trail and the
# survival plan if this repository ever stops being maintained.

echo "Ownership — ${REPO}"

owner_login="$(jq -r '.owner.login' <<<"$live_settings")"
owner_type="$(jq -r '.owner.type' <<<"$live_settings")"

[[ "$owner_login" == "$EXPECTED_OWNER" ]] \
  && ok "owner = ${owner_login}" \
  || bad "owner = ${owner_login} (expected ${EXPECTED_OWNER})"

[[ "$owner_type" == "User" ]] \
  && ok "owner type = User (personal account, as LSS's policy requires)" \
  || bad "owner type = ${owner_type} — LSS's third-party application policy bars commercial entities; see docs/COMPLIANCE.md §1"

[[ "$(jq -r '.private' <<<"$live_settings")" == "false" ]] \
  && ok "visibility = public" \
  || bad "visibility = private (expected public)"

# ---------------------------------------------------------------------------
# Repository settings
# ---------------------------------------------------------------------------
#
# squash-only          — linear history requires it, and it keeps the log one
#                        commit per pull request.
# squash_merge_commit_* — the squashed commit takes the pull request's title and
#                        body, so the log reads as the change rather than as a
#                        list of "wip" commits.
# allow_update_branch  — surfaces the "Update branch" button. Which method it
#                        offers is gated by required_linear_history below, not
#                        by allow_rebase_merge.
# allow_auto_merge     — without this, `gh pr merge --auto` fails outright and
#                        the Phase 0 exit criteria cannot be met at all.
# delete_branch_on_merge — stops merged agent branches accumulating.
# has_*                — issues on (the upstream licence request and bug reports
#                        land there); projects, wiki, downloads and discussions
#                        off, because an unattended surface nobody reads is a
#                        place for a compliance problem to sit unnoticed.

declare -A SETTINGS=(
  [allow_squash_merge]=true
  [allow_merge_commit]=false
  [allow_rebase_merge]=false
  [allow_update_branch]=true
  [allow_auto_merge]=true
  [delete_branch_on_merge]=true
  [squash_merge_commit_title]=PR_TITLE
  [squash_merge_commit_message]=PR_BODY
  [has_issues]=true
  [has_projects]=false
  [has_wiki]=false
  [has_downloads]=false
  [has_discussions]=false
)

# GitHub topics. Lowercase and hyphenated; the API rejects anything else.
TOPICS=(
  flesh-and-blood
  fabtcg
  trading-card-game
  deck-legality
  rules-engine
  typescript
  astro
  svelte
)

echo
echo "Repository settings — ${REPO}"

if [[ "$CHECK_ONLY" == false ]]; then
  args=()
  for key in "${!SETTINGS[@]}"; do
    args+=(-F "${key}=${SETTINGS[$key]}")
  done
  gh api -X PATCH "repos/${REPO}" "${args[@]}" --silent

  topics_body="$(jq -n --args '{ names: $ARGS.positional }' "${TOPICS[@]}")"
  gh api -X PUT "repos/${REPO}/topics" --input - <<<"$topics_body" --silent

  # Dependabot alerts. A separate endpoint, and a PUT with no body.
  gh api -X PUT "repos/${REPO}/vulnerability-alerts" --silent

  note "applied"
  # Re-read so the assertions below judge what GitHub actually stored, not what
  # we asked it to store. If that re-read fails, keep the pre-apply snapshot:
  # every setting will then report drift, which is the honest outcome — better
  # than asserting against an empty body and claiming everything is missing.
  if api_get "repos/${REPO}"; then
    live_settings="$api_body"
  else
    unk "could not re-read repos/${REPO} after applying (HTTP ${api_status}); assertions below are against the pre-apply state"
  fi
fi

for key in "${!SETTINGS[@]}"; do
  # `has`, not `// "«absent»"`: jq's alternative operator treats `false` as
  # empty, and half the settings here are legitimately false — which would
  # report every one of them as unreadable.
  actual="$(jq -r --arg k "$key" 'if has($k) then .[$k] else "«absent»" end' <<<"$live_settings")"
  if [[ "$actual" == "«absent»" ]]; then
    unk "${key} — not returned by the API; this token lacks administrative read on ${REPO}"
  elif [[ "$actual" == "${SETTINGS[$key]}" ]]; then
    ok "${key} = ${actual}"
  else
    bad "${key} = ${actual} (expected ${SETTINGS[$key]})"
  fi
done

expected_topics="$(printf '%s\n' "${TOPICS[@]}" | LC_ALL=C sort | paste -sd, -)"
actual_topics="$(jq -r '[.topics // []] | flatten | sort | join(",")' <<<"$live_settings")"
[[ "$actual_topics" == "$expected_topics" ]] \
  && ok "topics = ${actual_topics}" \
  || bad "topics = ${actual_topics:-none} (expected ${expected_topics})"

# 204 = enabled, 404 = disabled, 403 = this token may not ask.
if api_get "repos/${REPO}/vulnerability-alerts" >/dev/null 2>&1; then
  ok "vulnerability_alerts = true"
elif [[ "$api_status" == "404" ]]; then
  bad "vulnerability_alerts = false (expected true)"
else
  unk "vulnerability_alerts — HTTP ${api_status}; this token cannot read Dependabot alert status"
fi

# ---------------------------------------------------------------------------
# Default-branch ruleset
# ---------------------------------------------------------------------------
#
# A ruleset, NOT classic branch protection, and never both: GitHub takes the
# union of the two, so having both means editing one while the other silently
# still applies.
#
# Three rules here look like omissions and are not:
#
#   no required human reviews — an agent cannot approve its own pull request, so
#     a required review blocks auto-merge forever. This is the whole reason the
#     agent completion path works. Do not "harden" it by adding one.
#
#   no `creation` rule       — the first push has to be able to create the
#     default branch. See do_not_enforce_on_create below, which is the other
#     half of not deadlocking the bootstrap.
#
#   bypass_actors: []        — nobody routes around this, repository owner
#     included. For a genuine emergency, disable and re-enable the ruleset
#     rather than adding a standing bypass.
#
# strict_required_status_checks_policy is TRUE, and it was false for a reason
# that a real incident outweighed.
#
# The old argument is still true as far as it goes: requiring a branch to be up
# to date with main rejects the merge whenever main moves while checks run, so
# unattended auto-merge becomes a retry loop. That is a real cost and it is
# being paid on purpose.
#
# What bought it: two pull requests each went green against a main that did not
# yet contain the other, and the combination was never run. #151 added the rule
# that every `setup-bun` step must read `.bun-version`; #153 added a step to the
# gate job pinning the version inline. Both merged, both correct alone, and main
# was broken the moment they met — discovered by a third pull request inheriting
# a failure it had not caused. Non-strict checks do not verify the merge result,
# only the branch, and "green twice" is not "green together".
#
# The retry loop is the price of that not happening again. It is bounded — the
# fix is `gh pr update-branch --rebase` and a re-run, and this repository merges
# a handful of PRs a day rather than a queue of them. A merge queue would give
# the same guarantee without the loop and is deliberately NOT used here: it
# cannot coexist with the Dependabot auto-merge workflow, since GITHUB_TOKEN
# cannot enqueue.
#
# do_not_enforce_on_create is TRUE, and this one is a bootstrap deadlock if you
# get it wrong. The rule defaults to enforcing on branch creation, so with an
# empty bypass list the very first `git push -u origin main` into an empty
# repository is rejected: it creates the default branch carrying a commit that
# has no `CI Success` status, and nobody — owner included — can override it. It
# relaxes creation only; every subsequent push and merge is fully checked.

echo
echo "Ruleset — ${RULESET_NAME}"

ruleset_body="$(jq -n --arg name "$RULESET_NAME" --arg gate "$GATE_JOB" '{
  name: $name,
  target: "branch",
  enforcement: "active",
  bypass_actors: [],
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    { type: "required_linear_history" },
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: true,
        do_not_enforce_on_create: true,
        required_status_checks: [ { context: $gate } ]
      }
    }
  ]
}')"

rulesets_readable=true
if api_get "repos/${REPO}/rulesets"; then
  rulesets="$api_body"
else
  unk "cannot list rulesets (HTTP ${api_status})"
  rulesets='[]'
  rulesets_readable=false
fi
existing_id="$(jq -r --arg n "$RULESET_NAME" '.[] | select(.name == $n) | .id' <<<"$rulesets")"

if [[ "$CHECK_ONLY" == false ]]; then
  if [[ "$rulesets_readable" == false ]]; then
    # Do NOT fall through to POST here. An unreadable listing is indistinguishable
    # from an empty one, so creating would add a SECOND ruleset named
    # "default-branch" whenever one already exists — and GitHub unions rulesets,
    # which is exactly the "two declarations, whichever ran last wins and neither
    # can tell you so" failure this file's header warns against. Refusing to
    # guess is the only safe move.
    unk "not applying the ruleset: the existing rulesets could not be listed, and creating one blind risks a duplicate"
  elif [[ -n "$existing_id" ]]; then
    gh api -X PUT "repos/${REPO}/rulesets/${existing_id}" --input - <<<"$ruleset_body" --silent
    note "updated (id ${existing_id})"
  else
    existing_id="$(gh api -X POST "repos/${REPO}/rulesets" --input - <<<"$ruleset_body" --jq '.id')"
    note "created (id ${existing_id})"
  fi
fi

if [[ -z "$existing_id" ]]; then
  if [[ "$rulesets_readable" == false ]]; then
    unk "ruleset '${RULESET_NAME}' — cannot tell; the listing was unreadable"
  else
    bad "ruleset '${RULESET_NAME}' does not exist"
  fi
elif ! api_get "repos/${REPO}/rulesets/${existing_id}"; then
  unk "cannot read ruleset ${existing_id} (HTTP ${api_status})"
else
  live="$api_body"
  [[ "$(jq -r '.enforcement' <<<"$live")" == "active" ]] \
    && ok "enforcement = active" \
    || bad "enforcement = $(jq -r '.enforcement' <<<"$live") (expected active)"

  bypass_count="$(jq '.bypass_actors // [] | length' <<<"$live")"
  [[ "$bypass_count" == "0" ]] \
    && ok "bypass_actors = none" \
    || bad "bypass_actors = ${bypass_count} (expected none — nobody bypasses, owner included)"

  for rule in deletion non_fast_forward required_linear_history required_status_checks; do
    if jq -e --arg r "$rule" '.rules[] | select(.type == $r)' <<<"$live" >/dev/null; then
      ok "rule ${rule}"
    else
      bad "rule ${rule} missing"
    fi
  done

  # A required review here would deadlock auto-merge permanently, so its
  # ABSENCE is the thing worth asserting.
  if jq -e '.rules[] | select(.type == "pull_request")' <<<"$live" >/dev/null; then
    reviews="$(jq -r '.rules[] | select(.type == "pull_request") | .parameters.required_approving_review_count' <<<"$live")"
    [[ "$reviews" == "0" ]] \
      && ok "required approving reviews = 0" \
      || bad "required approving reviews = ${reviews} (must be 0; an agent cannot approve its own PR)"
  else
    ok "required approving reviews = none"
  fi

  checks="$(jq -r '[.rules[] | select(.type == "required_status_checks")
                   | .parameters.required_status_checks[].context] | join(",")' <<<"$live")"
  [[ "$checks" == "$GATE_JOB" ]] \
    && ok "required checks = ${checks}" \
    || bad "required checks = ${checks:-none} (expected exactly '${GATE_JOB}')"

  # ASSERTED BECAUSE IT WAS NOT, which is how it could have drifted back to
  # false without anything saying so — and false is the setting that let a
  # broken main through once already. See the note above the ruleset body.
  strict="$(jq -r '[.rules[] | select(.type == "required_status_checks")
                    | .parameters.strict_required_status_checks_policy] | first // false' <<<"$live")"
  [[ "$strict" == "true" ]] \
    && ok "strict = true (a branch must be up to date with the default branch)" \
    || bad "strict = ${strict} (expected true; false merges branches whose checks never saw the merge result)"

  on_create="$(jq -r '[.rules[] | select(.type == "required_status_checks")
                      | .parameters.do_not_enforce_on_create] | first // false' <<<"$live")"
  [[ "$on_create" == "true" ]] \
    && ok "do_not_enforce_on_create = true (the first push can create the branch)" \
    || bad "do_not_enforce_on_create = ${on_create} (expected true; false deadlocks the initial push)"
fi

# ---------------------------------------------------------------------------
# Classic branch protection must NOT coexist with the ruleset
# ---------------------------------------------------------------------------
#
# This endpoint is admin-only, so a 403 and a 404 mean completely different
# things: 404 is "no classic protection", which is the passing answer, and 403
# is "this token may not ask", which is not an answer at all. Treating them the
# same would report a clean bill of health on the one rule whose entire point is
# that GitHub unions classic protection with the ruleset behind your back.

echo
echo "Classic branch protection"

default_branch="$(jq -r '.default_branch' <<<"$live_settings")"
if api_get "repos/${REPO}/branches/${default_branch}/protection" >/dev/null 2>&1; then
  bad "classic branch protection also exists on ${default_branch} — GitHub unions it with the ruleset; delete it with: gh api -X DELETE repos/${REPO}/branches/${default_branch}/protection"
elif [[ "$api_status" == "404" ]]; then
  ok "no classic branch protection (the ruleset is the single source of truth)"
else
  unk "cannot read branch protection on ${default_branch} — HTTP ${api_status}; this token lacks administrative read"
fi

echo
if [[ "$undetermined" -ne 0 ]]; then
  cat <<'MSG'
Undetermined: some settings could not be read, so this run is NOT a pass.

GitHub returns the merge settings and the branch-protection endpoints only to a
token with administrative read on the repository. In CI, supply a personal
access token as the REPO_SETTINGS_TOKEN secret (classic `repo` scope, or a
fine-grained token with Administration: read). Locally, `gh auth login` as the
repository owner is enough.
MSG
  exit 2
fi

if [[ "$drift" -ne 0 ]]; then
  echo "Configuration has drifted. Run scripts/repo-settings.sh to restore it."
  exit 1
fi
echo "Repository configuration matches scripts/repo-settings.sh."
