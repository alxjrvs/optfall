/**
 * Four rules this repository states in prose and, until now, nothing checked.
 *
 * Each is of the same shape: a fact spelled in two or more places that must
 * agree, where the copies cannot import one another because they are in
 * different languages or different formats. That shape is exactly what
 * `documented-counts.test.ts` and `corpus-size.test.ts` already exist for; this
 * file is the same idea applied to configuration rather than to figures.
 *
 * All four pass on the tree as it stands. They are written to fail on the NEXT
 * edit, not to report a current defect.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib/root";

import { DARK_TOKENS } from "../packages/theme/src/tokens";
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

/* ------------------------------------------------------------------------ */

/**
 * `scripts/.env.r2` holds 1Password ADDRESSES, never values.
 *
 * The file's own header says so in capitals, and `.gitignore` grants it an
 * explicit exception from `.env.*` on that basis. Nothing checked it. It is
 * also the only `.env`-shaped file this repository will ever commit, so the
 * risk is not really this file — it is the second one, written by somebody who
 * copied its shape without reading its header.
 *
 * An `op://` reference resolves to nothing without a 1Password session, which
 * is what makes committing it safe. Anything else in a value position is a
 * secret until proven otherwise.
 */
describe("scripts/.env.r2 references secrets rather than holding them", () => {
  const lines = read("scripts/.env.r2").split(/\r?\n/);
  const assignments = lines
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null);

  test("it still contains assignments to check", () => {
    /* If the file is emptied or its format changes, every assertion below
       would pass by matching nothing. */
    expect(assignments.length).toBeGreaterThan(0);
  });

  for (const [, name, value] of assignments) {
    test(`${name} is an op:// reference`, () => {
      /* The name is in the expectation so a failure says WHICH variable, and
         the value never is — a test that prints a leaked secret to make its
         point has published it to CI logs. */
      expect(`${name}: ${value?.startsWith("op://")}`).toBe(`${name}: true`);
    });
  }
});

/* ------------------------------------------------------------------------ */

/**
 * `.editorconfig` and `biome.jsonc` describe the same formatting.
 *
 * CLAUDE.md: "80 columns. Biome formats at 80 and `format:check` is a gate.
 * `.editorconfig` agrees; if you ever change one, change both." The editor
 * reads one, CI enforces the other, and neither can import the other.
 *
 * THIS HAS ALREADY DRIFTED ONCE — `.editorconfig` records the incident itself.
 * A formatter nobody's editor agrees with is a formatter people fight.
 */
describe(".editorconfig and biome.jsonc agree", () => {
  const editorconfig = read(".editorconfig");
  const biome = read("biome.jsonc");

  const editorValue = (key: string): string | undefined =>
    new RegExp(`^${key}\\s*=\\s*(\\S+)`, "m").exec(editorconfig)?.[1];
  const biomeValue = (key: string): string | undefined =>
    new RegExp(`"${key}"\\s*:\\s*(?:"([^"]+)"|(\\d+))`)
      .exec(biome)
      ?.slice(1)
      .find((group) => group !== undefined);

  const PAIRS: readonly (readonly [string, string])[] = [
    ["max_line_length", "lineWidth"],
    ["indent_size", "indentWidth"],
    ["end_of_line", "lineEnding"],
  ];

  for (const [editorKey, biomeKey] of PAIRS) {
    test(`${editorKey} matches ${biomeKey}`, () => {
      const left = editorValue(editorKey);
      const right = biomeValue(biomeKey);

      /* Both read as strings on purpose: `80` and `"80"` are the same
         decision, and a type difference here would be noise. */
      expect(`${editorKey}=${left} / ${biomeKey}=${right}`).toBe(
        `${editorKey}=${left} / ${biomeKey}=${left}`,
      );
    });
  }
});

/* ------------------------------------------------------------------------ */

/**
 * Every badge colour in the documents is a dark-theme token value.
 *
 * `docs/COMPLIANCE.md` states it: the chip palette is Optfall's own state
 * colours, spelled as literal hexes in several Markdown files because Markdown
 * has no shared link table. If a token moves, every copy has to move with it —
 * and a status chip in the wrong colour is a status chip saying the wrong
 * thing.
 */
describe("documentation chips use the theme's own colours", () => {
  const FILES = ["README.md", "docs/COMPLIANCE.md", "docs/ROADMAP.md"] as const;
  const BADGE = /img\.shields\.io\/badge\/[^)\s]*?-([0-9a-fA-F]{6})\?/g;

  const values = new Set(
    Object.values(DARK_TOKENS).map((value) => String(value).toLowerCase()),
  );

  for (const file of FILES) {
    test(`${file} chips are all DARK_TOKENS values`, () => {
      const hexes = [...read(file).matchAll(BADGE)].map((match) =>
        `#${match[1]}`.toLowerCase(),
      );
      expect(hexes.length).toBeGreaterThan(0);

      const strangers = [...new Set(hexes)].filter((hex) => !values.has(hex));
      expect(strangers).toEqual([]);
    });
  }
});

/* ------------------------------------------------------------------------ */

/**
 * No dependency floats.
 *
 * `bunfig.toml` sets `exact = true` and states the doctrine: "Versions are
 * pinned deliberately rather than floating. Dependabot moves these; nothing
 * else does." But that setting governs `bun add` — it does not govern a hand
 * edit, a merge, or a manifest written before it existed.
 *
 * The gap was live: the root catalog carried `"react": "19"`, a RANGE matching
 * all of 19.x, in a repository that pins its runtime by file and its actions by
 * SHA. Beyond drift, a range means Dependabot never opens a PR for that
 * dependency at all — the declared range already permits the new version, so
 * the update arrives with no review of its own.
 */
describe("every declared dependency is an exact version", () => {
  const MANIFESTS = [
    "package.json",
    ...readdirSync(join(ROOT, "packages")).map(
      (name) => `packages/${name}/package.json`,
    ),
    ...readdirSync(join(ROOT, "apps")).map(
      (name) => `apps/${name}/package.json`,
    ),
  ];

  const FIELDS = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
    "catalog",
  ] as const;

  /** `workspace:*` and `catalog:` are indirections, not versions. */
  const isIndirection = (spec: string): boolean =>
    spec.startsWith("workspace:") || spec.startsWith("catalog:");

  const isExact = (spec: string): boolean =>
    /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(spec);

  for (const manifest of MANIFESTS) {
    test(`${manifest} pins exactly`, () => {
      const json = JSON.parse(read(manifest)) as Record<
        string,
        Record<string, string> | undefined
      >;

      const floating = FIELDS.flatMap((field) =>
        Object.entries(json[field] ?? {})
          .filter(([, spec]) => !isIndirection(spec) && !isExact(spec))
          .map(([name, spec]) => `${field}.${name} = ${spec}`),
      );

      expect(floating).toEqual([]);
    });
  }
});
