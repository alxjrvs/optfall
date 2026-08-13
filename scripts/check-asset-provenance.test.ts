/**
 * The provenance check, exercised against fixtures rather than against the
 * repository's own two directories.
 *
 * THIS FILE EXISTS BECAUSE A FIX SHIPPED IN PROSE ONLY. `GOVERNED` grew a `key`
 * field naming each manifest's array, with a comment explaining at length why
 * hard-coding `record.symbols` was a trap — and the code went on reading
 * `record.symbols`. Every gate stayed green, because the repository has exactly
 * one manifest and it happens to use that key, so the broken path was
 * unreachable from any real input. A declared-and-unused fix is worse than the
 * bug it claims to fix: the comment tells the next reader the problem is solved.
 *
 * So the cases below feed `auditDir` manifests the repository does not have —
 * a differently-named array, a first-party origin, a moved file — which is the
 * only way to test a table-driven check that currently has one row of real data.
 */
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, test } from "bun:test";

import { auditDir } from "./check-asset-provenance";

const roots: string[] = [];

/** A throwaway public directory with one PNG and a manifest describing it. */
async function fixture(options: {
  key: string;
  url: string;
  /** Where the file sits inside the directory. Defaults to the recorded path. */
  at?: string;
  recorded?: string;
}) {
  const root = await mkdtemp(join(tmpdir(), "optfall-provenance-"));
  roots.push(root);

  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

  const recorded = options.recorded ?? "symbols/icon_p.png";
  const at = options.at ?? recorded;
  await mkdir(join(root, "public", at, ".."), { recursive: true });
  await writeFile(join(root, "public", at), bytes);

  const manifest = join(root, "manifest.json");
  await writeFile(
    manifest,
    JSON.stringify({ [options.key]: [{ file: recorded, url: options.url, sha256 }] }),
  );

  return { dir: join(root, "public"), manifest };
}

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("auditDir", () => {
  test("reads the array named by `key`, not a hard-coded one", async () => {
    /* THE REGRESSION. With `record.symbols` hard-coded this returns zero
       entries and reports the PNG as unaccounted-for. */
    const { dir, manifest } = await fixture({
      key: "assets",
      url: "https://example.test/icon_p.png",
    });

    const { problems } = await auditDir(dir, manifest, "assets");
    expect(problems).toEqual([]);
  });

  test("reports everything when the key does not match the manifest", async () => {
    const { dir, manifest } = await fixture({
      key: "assets",
      url: "https://example.test/icon_p.png",
    });

    const { problems } = await auditDir(dir, manifest, "symbols");
    expect(problems.length).toBeGreaterThan(0);
  });

  test("accepts a first-party origin that names a script in the repository", async () => {
    const { dir, manifest } = await fixture({
      key: "assets",
      url: "first-party:scripts/check-asset-provenance.ts",
    });

    const { problems } = await auditDir(dir, manifest, "assets");
    expect(problems).toEqual([]);
  });

  test("rejects a bare `first-party:` with no script named", async () => {
    /* The escape hatch built to stop somebody inventing an origin must not
       itself be a one-token way to satisfy the check. */
    const { dir, manifest } = await fixture({ key: "assets", url: "first-party:" });

    const { problems } = await auditDir(dir, manifest, "assets");
    expect(problems.join("\n")).toContain("does not name a script");
  });

  test("rejects a first-party origin naming a script that does not exist", async () => {
    const { dir, manifest } = await fixture({
      key: "assets",
      url: "first-party:scripts/no-such-generator.ts",
    });

    const { problems } = await auditDir(dir, manifest, "assets");
    expect(problems.join("\n")).toContain("does not exist");
  });

  test("rejects an origin that is neither https nor first-party", async () => {
    const { dir, manifest } = await fixture({
      key: "assets",
      url: "http://example.test/icon_p.png",
    });

    const { problems } = await auditDir(dir, manifest, "assets");
    expect(problems.join("\n")).toContain("neither an https URL");
  });

  test("reports a moved file twice — unaccounted-for, and stale", async () => {
    /* The basename-matching hole: same filename, different depth. Both halves
       have to fire, or a move slips past the whole control. */
    const { dir, manifest } = await fixture({
      key: "assets",
      url: "https://example.test/icon_p.png",
      recorded: "symbols/icon_p.png",
      at: "icons/icon_p.png",
    });

    const { problems } = await auditDir(dir, manifest, "assets");
    expect(problems.join("\n")).toContain("no provenance entry");
    expect(problems.join("\n")).toContain("which is not on disk");
  });
});
