# Security policy

## Reporting a vulnerability

**Use GitHub's private vulnerability reporting:**
[open a report](https://github.com/alxjrvs/optfall/security/advisories/new).
It is private between you and the maintainer until a fix ships.

**Please do not open a public issue for a security problem.** Issues are on and
are the right place for bugs, wrong rulings and wrong legality — but a public
issue publishes the vulnerability as the first step of reporting it.

If private reporting is unavailable to you for any reason, say so in an issue
*without the details* and a private channel will be arranged.

## What is in scope

Optfall is a static site plus one Cloudflare Worker. There is no account
system, no database, no user data, and nothing to log in to — which rules out
most of what a security policy usually covers, and is worth stating plainly so
you do not go looking for it.

What is genuinely in scope:

- **`apps/images`** — the only runtime. It answers every path on a public
  domain and reads from an R2 bucket. Path traversal, header injection, or any
  input that reaches the store as something other than a validated key.
- **The build and deploy pipeline** — anything that lets a pull request reach
  repository secrets or the Cloudflare API token. Fork PRs are not supposed to
  be able to; if you find a way, that is the highest-value report on this list.
- **Supply chain** — a dependency, or a path by which an unreviewed dependency
  could reach a deploy.
- **Published data** — anything in `data/` that leaks something it should not,
  or misstates provenance under `docs/COMPLIANCE.md` §3.

Out of scope, because they are properties of the design rather than defects:
the absence of authentication, the corpus being public (it is meant to be), and
missing rate limits on the static site (Cloudflare serves it directly and no
Worker is invoked).

## What is not a vulnerability, but is still worth reporting

A **wrong ruling, wrong legality verdict, or wrong card fact** is the failure
this project cares most about — the whole positioning is *being right*. That is
an ordinary [issue](https://github.com/alxjrvs/optfall/issues), not a security
report, and it is very welcome.

## Response

This is a personal project maintained by one person. You will get an
acknowledgement rather than an SLA. Reports that show a real path to harm will
be prioritised over everything else, including whatever phase the roadmap is
on.

## Automated protections

Enabled and asserted by `scripts/repo-settings.sh --check`, which runs on a
schedule so that turning one off is drift rather than a silent change:

- Dependabot alerts, and weekly updates for both the `bun` and `github-actions`
  ecosystems
- Private vulnerability reporting
- Secret scanning, with push protection
- A required `CI Success` check on `main`, with a strict up-to-date policy and
  no bypass actors

`scripts/.env.r2` is committed on purpose and contains no secret: every value
in it is a 1Password `op://` **reference**, which resolves to nothing without a
session. Its header says so, and push protection is there for the day somebody
copies its shape without reading it.
