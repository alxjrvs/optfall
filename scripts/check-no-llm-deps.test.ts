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

import { banned, candidateNames, isBannedName } from "./check-no-llm-deps";

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
