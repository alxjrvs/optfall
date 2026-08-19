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
# Neither the account id nor the bucket name is a secret — the account id is the
# first path segment of every Cloudflare dashboard URL. They are referenced here
# anyway so that one file is the whole configuration rather than two halves a
# reader has to join.

CLOUDFLARE_ACCOUNT_ID=op://claude-agent/optfall-r2-ingest/account-id
R2_ACCESS_KEY_ID=op://claude-agent/optfall-r2-ingest/access-key-id
R2_SECRET_ACCESS_KEY=op://claude-agent/optfall-r2-ingest/secret-access-key
