#!/usr/bin/env bun
/**
 * Fails the build on a binary asset with no recorded origin.
 *
 * `docs/COMPLIANCE.md` §3 requires it in one sentence — "Every binary asset
 * committed under a public directory needs a recorded origin. An asset with no
 * provenance entry is treated as non-compliant until it has one" — and then
 * lists the enforcement as **an open action**: "Today: review, and nothing
 * else." Review is what let a project ship set symbols as filter icons; §3
 * calls that "the single most likely violation, because it is the obvious UI
 * move and every card site does it."
 *
 * This is the check that closes it. Every file under a public directory is
 * either text this repository authored, or a binary with an entry in a
 * provenance manifest naming its URL and its SHA-256. There is no third case.
 *
 * WHAT IT CANNOT DO, said plainly so nobody reads more into a green tick: it
 * checks that an asset's origin is RECORDED, not that the origin was allowed.
 * Someone who ingests a set symbol and writes it a provenance entry passes this
 * and fails the policy. The value is that doing so is now a deliberate, visible,
 * reviewable diff — a new manifest entry naming a URL — rather than a PNG
 * appearing in a directory nobody diffs.
 */
import { readdir, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * The repository root, derived from this file's own location.
 *
 * A `first-party:` origin names a path relative to the REPOSITORY, not to
 * whatever directory the check was invoked from — otherwise the same manifest
 * verifies differently depending on where you stood when you asked, which is
 * not a property a provenance record should have.
 */
const REPO_ROOT = new URL("../", import.meta.url);

/**
 * Directories served verbatim to the public, and the manifest covering each.
 *
 * EVERY public directory, not just the one that happens to have assets in it
 * today. `apps/images/public` holds only a `robots.txt` and has no manifest —
 * which is exactly the right state: no manifest means no approved binaries, so
 * the first PNG dropped there fails this check instead of sailing through a
 * directory nobody thought to list. `docs/COMPLIANCE.md` §3 claims this job
 * covers "every binary under a public directory", and that claim should be
 * true rather than nearly true.
 *
 * `key` NAMES THE MANIFEST'S ARRAY, and it is here rather than hard-coded
 * because it was hard-coded and that was a trap. Reading `record.symbols` out
 * of every manifest meant a future `assets.json` that named its array anything
 * else would parse to zero entries — and then report every file beneath it as
 * having no recorded origin, pointing the reader at the assets rather than at
 * the one-word key mismatch that actually caused it. It fails closed, so it was
 * confusing rather than unsafe; naming the key makes the contract discoverable
 * from the table instead of from this script's internals.
 */
/*
 * ORDER MATTERS: most specific directory first. A file is audited against the
 * FIRST entry whose directory contains it, so `apps/site/public/fonts` is
 * governed by the font manifest, `apps/site/public/brand` by the brand one, and
 * everything else under `apps/site/public` by the symbol manifest.
 *
 * That nesting exists because the manifests cannot be merged. The symbol
 * manifest is GENERATED — `scripts/ingest-game-symbols.ts` writes it, and
 * `check:symbols` verifies the file on disk matches what the ingest would
 * produce — so a hand-written font or brand entry added to it would be deleted
 * by the next sync, silently, and those assets would be unaccounted-for again.
 * One generated manifest and two authored ones, with two nested exceptions
 * ahead of the general case, is the honest shape.
 */
const GOVERNED = [
  {
    dir: "apps/site/public/fonts",
    manifest: "data/fonts/fonts.json",
    key: "fonts",
  },
  /*
   * A THIRD MANIFEST, FOR THE SAME REASON THERE IS A SECOND. `brand/` holds
   * marks belonging to companies we link to, and it cannot fold into either
   * neighbour: the symbol manifest is generated, so a hand-written entry there
   * would be deleted by the next `check:symbols` sync, and a vendor logo is not
   * a font. Its own directory also makes the diff that adds one unmistakable,
   * which is the point — §3 names a third party's imagery reused as UI as the
   * likeliest way this project goes wrong.
   */
  {
    dir: "apps/site/public/brand",
    manifest: "data/brand/brand.json",
    key: "marks",
  },
  {
    dir: "apps/site/public",
    manifest: "data/symbols/symbols.json",
    key: "symbols",
  },
  {
    dir: "apps/images/public",
    manifest: "data/images/assets.json",
    key: "assets",
  },
] as const;

/**
 * Directories governed by a more specific entry than `dir`.
 *
 * Without this the symbol audit would walk into `fonts/`, find a woff2 with no
 * entry in the symbol manifest, and report it as unaccounted-for — while the
 * font audit passed on the same file. One asset, two verdicts, and the failing
 * one pointing at the wrong manifest.
 */
function nestedUnder(dir: string): readonly string[] {
  return GOVERNED.map((entry) => entry.dir).filter(
    (other) => other !== dir && other.startsWith(`${dir}/`),
  );
}

/**
 * Extensions that are BYTES rather than source. A `.svg` counts: it is an image
 * whatever its encoding, and "it is technically text" is exactly the argument
 * that would let a logo in.
 */
const BINARY =
  /\.(png|jpg|jpeg|webp|avif|gif|svg|ico|woff2?|ttf|otf|eot|mp4|webm)$/i;

interface ManifestEntry {
  readonly file: string;
  readonly url: string;
  readonly sha256: string;
}

async function walk(dir: string): Promise<string[]> {
  const items = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    items.map(async (item) => {
      const path = `${dir}/${item.name}`;
      return item.isDirectory() ? await walk(path) : [path];
    }),
  );
  return nested.flat();
}

/**
 * Every complaint about one asset, or an empty list when it is accounted for.
 *
 * KEYED ON THE PATH WITHIN THE DIRECTORY, NOT THE BASENAME. Matching on
 * basename alone meant a second copy of an approved file at any depth —
 * `public/icons/icon_p.png` — inherited the approval of the original, and a
 * file MOVED into a subdirectory was neither flagged as unaccounted-for nor
 * reported as a stale entry, because the same basename was still present
 * somewhere. That is a weaker control than "every binary has a recorded
 * origin", which is the sentence this script exists to make true.
 */
async function auditFile(
  path: string,
  dir: string,
  manifest: string,
  byFile: ReadonlyMap<string, ManifestEntry>,
): Promise<string[]> {
  const relative = path.slice(dir.length + 1);
  const entry = byFile.get(relative);

  if (entry === undefined) {
    return [`::error file=${path}::no provenance entry in ${manifest}`];
  }

  /*
    THE HASH IS CHECKED, NOT JUST THE NAME. A manifest that records where a file
    came from and never verifies the file still IS that download is a note, not
    a control — it would pass happily after somebody swapped the bytes and kept
    the filename.
  */
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  if (digest !== entry.sha256) {
    return [
      `::error file=${path}::bytes do not match the recorded SHA-256 in ${manifest}`,
    ];
  }

  /*
    TWO KINDS OF ORIGIN, AND THE SECOND ONE HAD TO EXIST BEFORE SOMEBODY FAKED IT.

    An https URL is the right record for a file fetched from somewhere. It is
    the WRONG record for a file this project drew — and `docs/SCRYFALL-GAP.md`
    §5 already plans exactly that: generated NO IMAGE placeholders, shipped
    statically in `apps/images/public/` so they resolve when the Blobs store
    does not. They have no upstream. Requiring a URL of them would have left
    whoever builds that with two options, both bad: disable the check for that
    directory, or invent a plausible-looking origin for a file nobody fetched.
    The second is precisely the weakening this script's header warns about, and
    it is likelier, because it keeps the build green.

    So `first-party:<script>` is a legal origin, naming the thing that generated
    the bytes. It is not a loophole: it is a positive claim that Optfall drew
    this, which is checkable by reading that script, and it cannot be written by
    accident.

    AND THE SCRIPT HAS TO EXIST, IN THIS REPOSITORY, AND BE A SCRIPT. Each of
    those three clauses was added after the previous cut failed to enforce the
    sentence above it:

      - The first cut accepted anything beginning with `first-party:`, the bare
        token included — so the escape hatch built to stop somebody inventing an
        origin was itself a one-word way to satisfy the check.
      - The second checked only that the path resolved, so
        `first-party:/etc/hosts`, `first-party:../../elsewhere` and
        `first-party:README.md` all passed. "Names a script in this repository"
        was three claims and the code tested none of them. Worse, resolution ran
        against the working directory, so the same manifest verified differently
        depending on where the check was invoked.

    A repo-relative path, no escaping it, and a `.ts` or `.js` suffix. Resolved
    against the repository root rather than the caller's cwd, so the answer does
    not depend on where you stood when you asked.
  */
  if (entry.url.startsWith("first-party:")) {
    const script = entry.url.slice("first-party:".length).trim();

    if (script === "") {
      return [
        `::error file=${path}::\`first-party:\` origin does not name a script`,
      ];
    }
    /*
      RESOLVE FIRST, THEN ASSERT ON THE RESULT.

      The previous guard tested the STRING — no leading slash, no `..` segment,
      `.ts`/`.js` suffix — and then resolved it. Four spellings walked straight
      through all three tests and landed outside the repository anyway:

        first-party:file:///tmp/x.js       an absolute file URL; no slash, no ..
        first-party:..\..\x.js             `file:` is a special scheme, so the URL
                                           parser treats `\` as a separator while
                                           `split("/")` never sees a `..` token
        first-party:%2e%2e/%2e%2e/x.js     `%2e%2e` IS a double dot to the
                                           normalizer, and is not one to `split`
        first-party:https://example.com/…  passes every string test, then hands a
                                           non-file URL to `Bun.file`, which
                                           throws — the audit crashes instead of
                                           reporting

      Every one of those is the same mistake: checking a spelling and then
      trusting a different function's interpretation of it. Resolving first and
      asserting on the resolved URL cannot be spelled around, because the thing
      asserted on is the thing that will be opened.

      The string checks stay, in front, purely because "must be a
      repository-relative path" is a better error than "resolves outside the
      repository" for the case people actually hit.
    */
    if (script.startsWith("/") || script.split(/[/\\]/).includes("..")) {
      return [
        `::error file=${path}::first-party origin must be a repository-relative path, got ${script}`,
      ];
    }

    /* `new URL` THROWS on input it cannot parse — `https://` on its own, or
       `http://[` — and an exception here propagates through `Promise.all` and
       aborts the whole audit with an unhandled rejection instead of the one
       annotation naming the offending file. It failed closed, so it was a
       reporting defect rather than a hole; it was also the exact case the
       comment above claims to have closed. */
    let resolved: URL;
    try {
      resolved = new URL(script, REPO_ROOT);
    } catch {
      return [
        `::error file=${path}::first-party origin is not a usable path: ${script}`,
      ];
    }

    if (
      resolved.protocol !== "file:" ||
      !resolved.href.startsWith(REPO_ROOT.href)
    ) {
      return [
        `::error file=${path}::first-party origin resolves outside the repository: ${script}`,
      ];
    }
    if (!/\.(ts|js|mjs)$/.test(resolved.pathname)) {
      return [
        `::error file=${path}::first-party origin must name a script, got ${script}`,
      ];
    }
    if (!(await Bun.file(resolved).exists())) {
      return [
        `::error file=${path}::first-party origin names ${script}, which does not exist`,
      ];
    }

    /*
      AND THE REAL PATH, because the guard above is textual and a symlink is
      not. A committed `scripts/gen.js` pointing at `/etc/passwd` satisfies both
      the prefix test and `exists()`, which makes "the thing asserted on is the
      thing that will be opened" false — the thing opened is the target. The
      practical risk is low (a symlink is a visible diff) and the claim should
      still be true rather than nearly true.
    */
    const real = await realpath(fileURLToPath(resolved)).catch(() => null);
    if (real === null || !real.startsWith(fileURLToPath(REPO_ROOT))) {
      return [
        `::error file=${path}::first-party origin resolves outside the repository once symlinks are followed: ${script}`,
      ];
    }
    return [];
  }

  if (!entry.url.startsWith("https://")) {
    return [
      `::error file=${path}::origin is neither an https URL nor \`first-party:<script>\``,
    ];
  }

  return [];
}

/**
 * Everything wrong under one governed directory, and a line to report.
 *
 * `key` NAMES THE MANIFEST ARRAY, and it is a parameter because the previous
 * change added it to `GOVERNED`, wrote a comment explaining why hard-coding it
 * was a trap, and then went on reading `record.symbols` anyway. The field was
 * declared, documented and unused — the fix existed only in prose, which is a
 * worse state than the bug, because the comment tells the next reader the
 * problem is solved. `check-asset-provenance.test.ts` exercises a manifest whose array
 * is not called `symbols`, so this cannot go back to being decorative. (That
 * sentence named a file that did not exist when it was first written, which is
 * the same prose-only failure it is describing. Twice in two changes.)
 */
export async function auditDir(dir: string, manifest: string, key: string) {
  const nested = nestedUnder(dir);
  const files = (await walk(dir))
    .filter((path) => BINARY.test(path))
    .filter((path) => !nested.some((other) => path.startsWith(`${other}/`)));

  const record = await Bun.file(manifest)
    .json()
    .catch(() => null);
  const entries: ManifestEntry[] = record?.[key] ?? [];
  const byFile = new Map(entries.map((entry) => [entry.file, entry]));

  const problems = (
    await Promise.all(
      files.map((path) => auditFile(path, dir, manifest, byFile)),
    )
  ).flat();

  /* A manifest entry whose file has been deleted is stale, and a stale record is
     how the next reader comes to believe an asset is accounted for. Compared on
     the same directory-relative path the lookup above uses, so a file that has
     MOVED is reported twice — once as unaccounted-for at its new path, once as
     a stale entry at its old one — rather than slipping past both. */
  const onDisk = new Set(files.map((path) => path.slice(dir.length + 1)));
  for (const entry of entries) {
    if (onDisk.has(entry.file)) continue;
    problems.push(
      `::error file=${manifest}::entry for ${entry.file}, which is not on disk`,
    );
  }

  return {
    problems,
    summary: `${dir}: ${files.length} binary asset(s), ${entries.length} provenance entr(ies).`,
  };
}

/*
  GUARDED, so `auditDir` can be imported and tested without the import running
  the whole check and calling `process.exit`. The key-wiring bug shipped
  precisely because no test could reach this function; making it reachable is
  half the fix.
*/
if (import.meta.main) {
  const audits = await Promise.all(
    GOVERNED.map(({ dir, manifest, key }) => auditDir(dir, manifest, key)),
  );

  let violations = 0;
  for (const { problems, summary } of audits) {
    for (const problem of problems) console.error(problem);
    violations += problems.length;
    console.log(summary);
  }

  if (violations > 0) {
    console.error(
      `\n${violations} asset(s) without a verified origin. Every binary under a public directory
needs an entry naming its URL and SHA-256 — see docs/COMPLIANCE.md §3.`,
    );
    process.exit(1);
  }

  console.log("Every committed binary asset has a verified origin. ✔");
}
