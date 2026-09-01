#!/usr/bin/env bun
/**
 * Assert that no package.json declares a language-model or AI SDK dependency.
 *
 *   bun scripts/check-no-llm-deps.ts
 *
 * This enforces the rule stated in `LLM_STATEMENT.md`: no language model in
 * the shipped product. That statement describes this check in as many words —
 * "continuous integration fails if a language model so much as appears in a
 * dependency manifest" — so it guards the product's central promise rather
 * than a preference.
 *
 * IT MATCHES DEPENDENCY NAMES, NEVER SOURCE OR PROSE. `LLM_STATEMENT.md`
 * discusses language models at length and by name, and a content grep would
 * fail the build on the very document that states the rule.
 *
 * WHY IT IS A FILE RATHER THAN A WORKFLOW STEP. This lived as ~240 lines of
 * TypeScript heredoc'd into `.github/workflows/ci.yml`, written to
 * `$RUNNER_TEMP` and executed there. That made it the one gate job with no
 * local equivalent: an agent could not run it before pushing without copying
 * it out of YAML, and it was the only code in the repository that Biome,
 * the formatter and `tsc` had never seen. The repository already made this
 * move once — the gate-wiring assertion went from inline `awk`+`jq` to
 * `scripts/check-ci-aggregator.ts` with its own test — and the argument is the
 * same one.
 */
import { readFileSync } from "node:fs";

// Exact package names.
const BANNED_EXACT = new Set([
  "ai", // Vercel AI SDK
  "openai",
  "openai-edge",
  "@azure/openai",
  "anthropic",
  "@anthropic-ai/sdk",
  "@google/generative-ai",
  "@google/genai",
  "@google-cloud/aiplatform",
  "langchain",
  "llamaindex",
  "cohere-ai",
  "groq-sdk",
  "@mistralai/mistralai",
  "ollama",
  "replicate",
  "@huggingface/inference",
  "@huggingface/transformers",
  "@xenova/transformers",
  "transformers.js",
  "node-llama-cpp",
  "llama-node",
  "@aws-sdk/client-bedrock-runtime",
  "@aws-sdk/client-bedrock-agent-runtime",
  "@google-cloud/vertexai",
  "together-ai",
  "gpt4all",
  "gpt-3-encoder",
  "js-tiktoken",
  "tiktoken",
  "@vercel/ai",
  "openai-node",
  "anthropic-ai",
  "fireworks-ai",
  "@deepseek/sdk",
  "@xai-org/sdk",
]);

// Whole scopes, matched as a `@scope/` prefix.
const BANNED_SCOPES = [
  "@ai-sdk/",
  "@anthropic-ai/",
  "@openai/",
  "@langchain/",
  "@llamaindex/",
  "@mistralai/",
  "@huggingface/",
  "@xenova/",
  "@google/generative-ai",
  "@llama-node/",
];

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "resolutions",
  "overrides",
  "trustedDependencies",
] as const;

export function isBannedName(name: string): boolean {
  if (BANNED_EXACT.has(name)) return true;
  return BANNED_SCOPES.some((scope) => name.startsWith(scope));
}

// Override and resolution keys are PATHS, not plain package names:
// npm and yarn both accept `"astro/openai"` and `"**/langchain"` to
// pin a dependency-of-a-dependency. Testing the raw key matches
// neither, so a path-style pin on an LLM SDK — which is a pin whose
// only purpose is to control one — passed the gate untouched.
//
// Split on "/", drop glob segments, and re-join `@scope` with the
// name that follows it so scoped packages survive the split intact.
export function candidateNames(key: string): string[] {
  const parts = key
    .split("/")
    .filter((part) => part && part !== "**" && part !== "*");
  const names: string[] = [key];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]!;
    if (part.startsWith("@") && i + 1 < parts.length) {
      names.push(`${part}/${parts[i + 1]}`);
      i += 1;
    } else {
      names.push(part);
    }
  }
  return names;
}

export function banned(name: string): boolean {
  return candidateNames(name).some(isBannedName);
}

// Tracked manifests first: that skips node_modules and untracked
// scratch for free.
function fromGit(): string[] {
  const listed = Bun.spawnSync([
    "git",
    "ls-files",
    "-z",
    "--",
    "package.json",
    "*/package.json",
  ]);
  if (listed.exitCode !== 0) return [];
  return listed.stdout
    .toString()
    .split("\0")
    .filter((path) => path.endsWith("package.json"));
}

// Fallback for a tree where nothing is committed yet, so that running
// this check by hand before the first commit is not a vacuous pass.
function fromDisk(): string[] {
  return [...new Bun.Glob("**/package.json").scanSync({ cwd: ".", dot: false })]
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => !path.split("/").includes("node_modules"))
    .sort();
}

/**
 * Only scan when run directly.
 *
 * `check-no-llm-deps.test.ts` imports the predicates above, and an unguarded
 * top-level scan would run — and `process.exit(1)` — during the import.
 */
if (import.meta.main) {
  const tracked = fromGit();
  const manifests = tracked.length > 0 ? tracked : fromDisk();

  type Violation = { file: string; field: string; name: string };
  const violations: Violation[] = [];

  // Walks a dependency block, descending into nested override maps.
  function walk(
    block: Record<string, unknown>,
    file: string,
    field: string,
    depth = 0,
  ): void {
    if (depth > 8) return; // pathological nesting; nothing real goes this deep
    for (const [name, value] of Object.entries(block)) {
      if (banned(name)) violations.push({ file, field, name });
      if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, file, field, depth + 1);
      }
    }
  }

  for (const file of manifests) {
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(readFileSync(file, "utf8"));
    } catch (error) {
      console.log(`::error file=${file}::${file} is not valid JSON: ${error}`);
      process.exit(1);
    }

    for (const field of DEPENDENCY_FIELDS) {
      const block = manifest[field];
      if (!block || typeof block !== "object") continue;

      // `trustedDependencies` is an ARRAY of names, not a map, so the
      // object walk below never reached it — it sat in the field list
      // reading as coverage while scanning nothing.
      if (Array.isArray(block)) {
        for (const entry of block) {
          if (typeof entry === "string" && banned(entry)) {
            violations.push({ file, field, name: entry });
          }
        }
        continue;
      }

      // Recursive, because `overrides` and `resolutions` nest: npm's
      // `{"some-lib": {"openai": "^6"}}` pins a TRANSITIVE dependency,
      // and a top-level-keys-only walk reads the outer name and calls
      // it clean. That is a pin whose entire purpose is to control an
      // LLM SDK version, passing a gate named for banning LLM SDKs.
      walk(block as Record<string, unknown>, file, field);
    }
  }

  // The lockfile, which is where the rule is actually decided.
  //
  // Manifests only describe what WE declared. `bun.lock` describes what
  // will be installed — so an LLM SDK arriving as somebody else's
  // transitive dependency ships in the built product while every
  // manifest stays clean. LLM_STATEMENT.md's rule is about what the product
  // contains, not about what we chose to type, so the lockfile is the
  // authority and a manifest-only scan is a gate with a hole in it.
  try {
    const lock = readFileSync("bun.lock", "utf8");
    // Entries look like:  "js-yaml": ["js-yaml@4.3.1", "", {...}, "sha512-…"],
    // The resolved specifier is the reliable name source, since keys may
    // be nested paths like "astro/js-yaml".
    const seen = new Set<string>();
    for (const match of lock.matchAll(/"((?:@[^"/]+\/)?[^"@\s/]+)@[^"]*"/g)) {
      const name = match[1];
      if (name && !seen.has(name)) {
        seen.add(name);
        if (banned(name)) {
          violations.push({ file: "bun.lock", field: "resolved tree", name });
        }
      }
    }
    console.log(
      `Scanned bun.lock — ${seen.size} distinct package(s) in the resolved tree.`,
    );
  } catch {
    // No lockfile is itself a finding: without one the resolved tree is
    // unknown, and a pass here would be a pass over nothing.
    console.log(
      "::error::bun.lock is missing, so the resolved dependency tree cannot be checked. A committed lockfile is required for this gate to mean anything.",
    );
    process.exit(1);
  }

  console.log(
    `Scanned ${manifests.length} package.json manifest(s) for language-model dependencies.`,
  );
  for (const file of manifests) console.log(`  ${file}`);

  if (violations.length === 0) {
    console.log("No language-model or AI SDK dependency declared. ✔");
    process.exit(0);
  }

  console.log("");
  for (const { file, field, name } of violations) {
    console.log(
      `::error file=${file}::Forbidden dependency "${name}" declared in ${field} of ${file}`,
    );
  }
  console.log("");
  console.log(
    "Optfall ships no language model: nothing a user touches may call one, and no published dataset may contain model-generated content.",
  );
  console.log(
    "See LLM_STATEMENT.md. The rule is structural, and there is no exception behind a toggle.",
  );
  process.exit(1);
}
