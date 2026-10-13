# Credentials for `scripts/ingest-card-images.ts`, as 1Password references.
#
# THERE IS NO SECRET IN THIS FILE AND THERE MUST NEVER BE ONE. An `op://` URI is
# an ADDRESS, not a value — it names a vault, an item and a field, and resolves
# to nothing without a 1Password session. That is why this file is committed and
# why `.gitignore` carries an explicit exception for it: the addresses are worth
# reviewing in a diff, and the values are never here to leak.
#
# Usage:
#
#   op run --env-file=scripts/.env.r2 -- bun scripts/ingest-card-images.ts
#
# `op run` resolves each reference in-process and hands the values to the child
# as environment variables. They never touch disk, never enter a shell history
# and never appear in a process listing; if the child prints one, `op run` masks
# it unless `--no-masking` is passed.
#
# THE ITEM MUST BE NAMED AND FIELDED EXACTLY AS BELOW. References resolve by
# literal name, so a field labelled `Access Key ID` rather than `access-key-id`
# fails with an error that reads like a missing item rather than a missing
# field. Space-free kebab-case is the rule for this vault for that reason.
#
# THE ITEM HOLDS PLACEHOLDERS — fill in the three fields before the first run.
# `op run` resolves a placeholder as happily as a key, so the first sign of an
# unfilled item is an R2 authentication error, not a 1Password one. Shape:
#
#   vault  Optfall
#   item   optfall-r2-ingest        (category: API Credential)
#   fields account-id, access-key-id, secret-access-key
#
# WHY `Optfall` (changed 2026-10-13). Every personal project now has its own
# vault, and the shared `Projects` vault is being emptied. ~~The item belongs in
# `Projects`~~: it never existed there, which is why these references failed.
# The reasoning below still holds; `Optfall` is the vault it points at.
#
# WHY NOT `claude-agent` (changed 2026-08-19). These references
# used to point at `claude-agent`, which was wrong twice over. That vault is the
# one — and only — vault a 1Password service account can read on this machine,
# and its contents are now a declared contract: `agent-vault.txt` in the dotfiles
# repo lists exactly what may live there, and `op-agent audit` fails `boom
# verify` on anything undeclared. Adding an R2 key pair there would break that
# check for a credential the agent has no use for.
#
# It is also unnecessary. This script is run by a person, through `op run`,
# against their own desktop 1Password session — not by the service account. It
# can therefore read any vault the human can, and belongs in the one that holds
# personal-project machine credentials: the project's own.
#
# Neither the account id nor the bucket name is a secret — the account id is the
# first path segment of every Cloudflare dashboard URL. They are referenced here
# anyway so that one file is the whole configuration rather than two halves a
# reader has to join.

CLOUDFLARE_ACCOUNT_ID=op://Optfall/optfall-r2-ingest/account-id
R2_ACCESS_KEY_ID=op://Optfall/optfall-r2-ingest/access-key-id
R2_SECRET_ACCESS_KEY=op://Optfall/optfall-r2-ingest/secret-access-key
