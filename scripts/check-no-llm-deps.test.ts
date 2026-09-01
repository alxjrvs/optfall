/**
 * Tests for the no-language-model dependency scanner.
 *
 * THIS FILE IS THE HALF THAT WAS MISSING FOR AS LONG AS THE SCANNER LIVED IN
 * YAML. The check guards the claim the README opens with — that no language
 * model is involved in anything Optfall serves — and it is the only rule in
 * the project that is structural rather than a preference. It spent its life
 * as ~240 lines heredoc'd into a workflow, where nothing could import it,
 * `tsc` never saw it, and the only way to find out whether it still caught
 * anything was to push a commit that added `openai` and see.
 *
 * The cases below are the ones that would silently stop working: a scoped
 * package, a globbed override path, and a name that merely contains "ai".
 */

import { describe, expect, test } from "bun:test";

import {
  banned,
  candidateNames,
  isBannedName,
  manifestPaths,
  scanLockfile,
  scanManifest,
} from "./check-no-llm-deps";

describe("no-llm scanner: exact names", () => {
  for (const name of [
    "openai",
    "langchain",
    "llamaindex",
    "ollama",
    "replicate",
    "cohere-ai",
    "groq-sdk",
  ]) {
    test(`bans ${name}`, () => {
      expect(banned(name)).toBe(true);
    });
  }

  test('bans "ai", the Vercel SDK', () => {
    // The riskiest entry in the list: two letters, and the reason the matcher
    // cannot be a substring search.
    expect(banned("ai")).toBe(true);
  });
});

describe("no-llm scanner: scoped names", () => {
  for (const name of [
    "@anthropic-ai/sdk",
    "@google/generative-ai",
    "@mistralai/mistralai",
    "@huggingface/inference",
    "@aws-sdk/client-bedrock-runtime",
  ]) {
    test(`bans ${name}`, () => {
      expect(banned(name)).toBe(true);
    });
  }
});

describe("no-llm scanner: override paths", () => {
  // npm and yarn both accept nested paths in `overrides`/`resolutions`, so a
  // banned package can be declared as a key that is not its own name. This is
  // the case a naive `Set.has(key)` misses.
  test("bans a nested override path", () => {
    expect(banned("astro/openai")).toBe(true);
  });

  test("bans a globbed override path", () => {
    expect(banned("**/langchain")).toBe(true);
  });

  test("bans a scoped package nested under a path", () => {
    expect(banned("vite/@anthropic-ai/sdk")).toBe(true);
  });

  test("candidateNames keeps a scope attached to its package", () => {
    // "@anthropic-ai" alone is not a package and must not be tested as one;
    // the scope has to travel with the name after it.
    expect(candidateNames("foo/@anthropic-ai/sdk")).toContain(
      "@anthropic-ai/sdk",
    );
  });
});

describe("no-llm scanner: does not over-match", () => {
  // Every one of these is a real dependency of this repository, or a plausible
  // one. A false positive here fails the build on a legitimate install, which
  // is worse than the miss it is trying to prevent.
  for (const name of [
    "react",
    "react-dom",
    "vite",
    "typescript",
    "sharp",
    "@biomejs/biome",
    "wrangler",
    "jsdom",
    "axe-core",
    // Contains "ai" as a substring, and must not match the Vercel SDK.
    "chai",
    "tailwindcss",
    "email-validator",
    "@types/jsdom",
  ]) {
    test(`allows ${name}`, () => {
      expect(banned(name)).toBe(false);
    });
  }
});

describe("no-llm scanner: the matcher itself", () => {
  test("isBannedName is exact, not a substring test", () => {
    expect(isBannedName("openai")).toBe(true);
    expect(isBannedName("openai-tokenizer-but-not-really")).toBe(false);
  });
});

/*
 * THE HALF THAT WAS NEVER TESTED. Everything above exercises the name matcher.
 * What decides whether this gate means anything is the other half — which files
 * get collected, and what gets walked inside them — and none of it was reachable
 * from a test until the scan was exported. A matcher that is perfect over a list
 * of zero files is a gate that passes on everything.
 */

describe("scanManifest walks the fields a dependency can hide in", () => {
  test("a plain dependency block", () => {
    expect(
      scanManifest("package.json", { dependencies: { openai: "^6" } }).map(
        (v) => v.name,
      ),
    ).toEqual(["openai"]);
  });

  test("a nested override pins a TRANSITIVE dependency and is still caught", () => {
    /* npm's `{"some-lib": {"openai": "^6"}}` is a pin whose entire purpose is
       to control an LLM SDK version. A top-level-keys-only walk reads
       "some-lib" and calls it clean. */
    const found = scanManifest("package.json", {
      overrides: { "some-lib": { openai: "^6" } },
    });
    expect(found.map((v) => v.name)).toEqual(["openai"]);
    expect(found[0]?.field).toBe("overrides");
  });

  test("trustedDependencies is an ARRAY, and arrays are not objects", () => {
    /* It sat in the field list reading as coverage while scanning nothing,
       because the object walk never reached an array. */
    expect(
      scanManifest("package.json", {
        trustedDependencies: ["sharp", "@anthropic-ai/sdk"],
      }).map((v) => v.name),
    ).toEqual(["@anthropic-ai/sdk"]);
  });

  test("a clean manifest yields nothing", () => {
    expect(
      scanManifest("package.json", {
        dependencies: { react: "19", sharp: "0.35.3" },
        devDependencies: { typescript: "7.0.2" },
      }),
    ).toEqual([]);
  });

  test("a field that is not an object is skipped rather than throwing", () => {
    expect(
      scanManifest("package.json", { dependencies: "not-an-object" }),
    ).toEqual([]);
  });

  test("pathological nesting stops at the depth cap instead of hanging", () => {
    /* Eight deep is already far past anything real; the guard exists so a
       cyclic or generated manifest cannot spin here. */
    let deep: Record<string, unknown> = { openai: "^6" };
    for (let i = 0; i < 20; i += 1) deep = { [`layer${i}`]: deep };
    expect(() =>
      scanManifest("package.json", { overrides: deep }),
    ).not.toThrow();
  });
});

describe("scanLockfile reads the resolved tree, not the declarations", () => {
  const lock = `{
  "lockfileVersion": 1,
  "packages": {
    "react": ["react@19.2.8", "", {}, "sha512-aaa"],
    "some-lib/openai": ["openai@6.1.0", "", {}, "sha512-bbb"],
    "sharp": ["sharp@0.35.3", "", {}, "sha512-ccc"]
  }
}`;

  test("a transitive SDK is caught even though no manifest declares it", () => {
    /* This is the whole reason the lockfile is scanned: an LLM SDK arriving as
       somebody else's dependency ships in the product while every manifest
       stays clean. */
    const { violations } = scanLockfile(lock);
    expect(violations.map((v) => v.name)).toEqual(["openai"]);
    expect(violations[0]?.file).toBe("bun.lock");
  });

  test("it counts distinct packages, so a silent empty scan is visible", () => {
    expect(scanLockfile(lock).packages).toBe(3);
  });

  test("an empty lockfile reports zero packages rather than passing quietly", () => {
    expect(scanLockfile("").packages).toBe(0);
  });
});

describe("manifestPaths finds this repository's own manifests", () => {
  /*
   * THE GUARD THIS PAIRS WITH. `check-no-llm-deps.ts` now refuses an empty
   * list, because `fromGit` returns `[]` whenever git exits non-zero and the
   * disk fallback can also come back empty — and a scan over zero files
   * collected no violations and reported success. That is the same failure the
   * script's own lockfile branch already refused: "a pass here would be a pass
   * over nothing".
   */
  const paths = manifestPaths();

  test("it finds more than one, and the root is among them", () => {
    expect(paths.length).toBeGreaterThan(1);
    expect(paths).toContain("package.json");
  });

  test("nothing under node_modules is scanned", () => {
    expect(
      paths.filter((path) => path.split("/").includes("node_modules")),
    ).toEqual([]);
  });

  test("every path it returns is a package.json", () => {
    expect(paths.filter((path) => !path.endsWith("package.json"))).toEqual([]);
  });
});
