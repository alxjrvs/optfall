/**
 * `_redirects` — the 5,953 rules that keep every pre-change card URL working.
 *
 * WHY THERE IS A REDIRECT TABLE AT ALL. The card scheme moved from
 * `/card/<slug>` (+ `/card/<slug>/<set>/<number>` for alternate arts) to
 * `/card/<set>/<number>/<slug>` for every printing. That is 12,278 live URLs
 * whose spelling changed, on a site whose stated thesis is that a URL here is a
 * permanent, citable address. A permanent address that 404s is not a smaller
 * promise, it is a broken one — so every old form 301s to the page it named.
 *
 * WHY IT IS A FILE AND NOT `netlify.toml`. `netlify.toml` is hand-written and
 * reviewed; this is 5,953 machine-derived lines that change whenever the corpus
 * does. Netlify merges both and processes the toml first, which is the right way
 * round: the handful of deliberate rules win, and the generated bulk sits behind
 * them. Mixing the two would put a diff nobody can read in a file whose whole
 * value is that a human checks it.
 *
 * THE ARITHMETIC, BECAUSE THE COUNT IS THE DESIGN CONSTRAINT. Netlify's
 * guidance is to reach for wildcards "if you need to set up 10,000 redirects or
 * more", and warns that a large enough serialised output fails the deploy. The
 * naive table is 12,278 rules. What gets it to 5,953:
 *
 * - **4,941** card slugs → that card's default printing. Irreducible: mapping
 *   `head-jab-1` to `wtr/098` needs the corpus, not a pattern.
 * - **900** shared names → the lowest-pitch version's default printing. Same.
 * - **112** rules — one per set code — for all **6,437** old printing URLs,
 *   because `/card/<slug>/<set>/<number>` → `/card/<set>/<number>/<slug>` is a
 *   permutation of three segments. See {@link legacyPrintingRules} for why it
 *   is 112 rules and not the one that would obviously do.
 *
 * NOTHING HERE IS FORCED, AND THAT IS WHAT MAKES THE PATTERNS SAFE. A `!` rule
 * beats an existing file; a plain rule loses to one. Both the old printing form
 * and the new one are three segments under `/card/`, so a pattern over them can
 * match a LIVE page too — and because the rules are unforced, Netlify serves
 * the page and never consults them. They fire only where no file exists.
 *
 * WHAT IS DELIBERATELY NOT REDIRECTED: `/card/<set>/<number>` with no name tail.
 * It reads like the obvious convenience — set code and collector number are both
 * printed on the card — and it cannot be one here, because it is AMBIGUOUS in
 * this corpus. `ros/257-v2` is claimed by both Runechant and Embodiment of
 * Earth, which share one physical double-sided token and therefore one art. The
 * name tail is not decoration on those URLs, it is the disambiguator. See the
 * collision check in `cards.ts`.
 */

/** One rule, in Netlify's terms. `from`/`to` may carry `:placeholders`. */
export interface RedirectRule {
  readonly from: string;
  readonly to: string;
  readonly status: number;
}

/**
 * `/card/<slug>/<set>/<number>` → `/card/<set>/<number>/<slug>`, per set code.
 *
 * **THE OBVIOUS VERSION OF THIS IS ONE RULE AND IT IS AN INFINITE LOOP.**
 * `/card/:slug/:set/:number` → `/card/:set/:number/:slug` is a 3-CYCLE over
 * unconstrained placeholders: `(a,b,c) → (b,c,a) → (c,a,b) → (a,b,c)`. An
 * unforced rule is skipped only when a FILE exists at the request path —
 * Netlify never checks whether the TARGET resolves — so any three-segment
 * `/card/` path that names nothing real, a typo or a dead guess, would 301
 * around that cycle forever and the reader would get `ERR_TOO_MANY_REDIRECTS`
 * instead of the 404. `serve.ts` reproduces it exactly, because the browser
 * comes back with the permuted path and the same rule matches again.
 *
 * That version shipped in the first draft of this file with a doc-block calling
 * it "one extra hop". It was a loop, and the review caught it.
 *
 * **THE FIX IS TO PIN THE SET SEGMENT, and it costs 111 more rules.** The old
 * form has the set code SECOND; the new form has it FIRST, with a collector
 * number second. Spelling the code literally in position two means a rule
 * matches the old form and cannot match the new one:
 *
 *     /card/:slug/wtr/:number    /card/wtr/:number/:slug    301
 *
 * so `/card/wtr/098/head-jab-1` — segment two is `098` — matches nothing here
 * and a dead path 404s after exactly one hop.
 *
 * **THE INVARIANT THAT MAKES IT ACYCLIC IS ASSERTED, NOT ASSUMED.** The whole
 * argument rests on no collector-number segment being spelled like a set code;
 * if one ever were, that rule's own output would re-enter the table and the
 * loop would be back. Measured on this corpus: zero of 11,378. `cards.ts`
 * throws if that stops being true, and `ssg.test.ts` walks every rule's target
 * back through the table to prove none of them matches anything.
 *
 * Note this is NOT threatened by the reverse overlap, which does exist: three
 * card slugs — `fai`, `nuu`, `zen` — are spelled like set codes. Segment one is
 * an unconstrained `:slug` here, so those cards' old URLs match on their set
 * segment like every other card's and permute correctly.
 */
export function legacyPrintingRules(
  setCodes: readonly string[],
): readonly RedirectRule[] {
  return [...new Set(setCodes)].toSorted().map((code) => ({
    from: `/card/:slug/${code}/:number`,
    to: `/card/${code}/:number/:slug`,
    status: 301,
  }));
}

/**
 * The whole table: the corpus-derived rules, then the permutation.
 *
 * ORDER IS LOAD-BEARING — Netlify takes the first match. The exact rules are
 * two segments and the placeholder is three, so they cannot actually compete
 * today; putting the specific ones first anyway means that stays true if a
 * future rule is less tidy.
 *
 * IT TAKES THE CARD REDIRECTS AS AN ARGUMENT rather than importing them, and
 * that is the same rule `printings.ts` exists to keep: `cards.ts` loads a 16 MB
 * corpus at module scope, and `serve.ts` imports {@link matchRedirect} from
 * this file. A module the dev server reaches must not be able to drag the
 * corpus in behind it.
 */
export function redirectRules(
  cardRedirects: readonly { readonly from: string; readonly to: string }[],
  setCodes: readonly string[],
): readonly RedirectRule[] {
  const seen = new Map<string, string>();
  for (const redirect of cardRedirects) {
    const clash = seen.get(redirect.from);
    if (clash !== undefined) {
      throw new Error(
        `apps/site/ssg/redirects.ts: ${redirect.from} is redirected twice — to ` +
          `${clash} and to ${redirect.to}. Netlify takes the first match, so one ` +
          `of these would silently never apply.`,
      );
    }
    seen.set(redirect.from, redirect.to);
  }

  const rules = [
    ...cardRedirects.map((redirect) => ({ ...redirect, status: 301 })),
    ...legacyPrintingRules(setCodes),
  ];

  /*
   * NO RULE'S TARGET MAY MATCH ANOTHER RULE. This is the acyclicity check, and
   * it is here rather than only in the tests because the failure it catches —
   * the 3-cycle described on `legacyPrintingRules` — is invisible in the built
   * output and presents to a reader as `ERR_TOO_MANY_REDIRECTS` on a URL that
   * should simply have 404'd. A redirect table is one of the few artefacts
   * whose worst failure mode is a browser loop, so it is worth a build step.
   *
   * A concrete target is checked directly; a target carrying placeholders is
   * checked with each one filled by a token that cannot be a real segment, so
   * the SHAPE is tested rather than one instantiation of it.
   *
   * THE EXACT SOURCES ARE A SET, WHICH IS NOT A MICRO-OPTIMISATION. Walking
   * every rule against every rule is 5,953² string comparisons, and it made
   * this run for seconds on a build — enough that the first version of the
   * matching test in `ssg.test.ts` hit bun's 5s timeout and reported as a
   * FAILURE rather than as slowness, on a table with no cycle in it. A guard
   * expensive enough to look broken gets deleted. Only the 112 pattern rules
   * need real matching; the other 5,841 are exact strings and answer in O(1).
   */
  const exact = new Set(
    rules.filter((rule) => !rule.from.includes(":")).map((rule) => rule.from),
  );
  const patterns = rules.filter((rule) => rule.from.includes(":"));

  for (const rule of rules) {
    const probe = rule.to.replace(/:[a-z]+/gi, "x");
    const next = exact.has(probe) ? probe : matchRedirect(patterns, probe);
    if (next !== undefined) {
      throw new Error(
        `apps/site/ssg/redirects.ts: the redirect table has a cycle. ` +
          `"${rule.from}" sends a reader to "${rule.to}", which itself matches ` +
          `a rule and would be redirected again. Netlify does not check that a ` +
          `redirect target resolves, so this is an infinite loop in a browser ` +
          `rather than a 404. See legacyPrintingRules.`,
      );
    }
  }

  return rules;
}

/**
 * The file Netlify reads: `<from> <to> <status>`, one rule per line.
 *
 * A COMMENT HEADER, BECAUSE SOMEBODY WILL OPEN THIS IN A DEPLOY. 5,953 lines of
 * generated paths with no provenance is the kind of artefact that gets deleted
 * by someone who cannot tell what wrote it.
 */
export function renderRedirects(rules: readonly RedirectRule[]): string {
  const header = [
    "# Generated by apps/site/ssg/build.ts — do not edit.",
    "# Deliberate, hand-written rules live in netlify.toml, which is processed first.",
    "# See apps/site/ssg/redirects.ts for why these exist and why there are this many.",
    `# ${rules.length} rule(s).`,
  ];

  return `${[
    ...header,
    "",
    ...rules.map((rule) => `${rule.from}  ${rule.to}  ${rule.status}`),
  ].join("\n")}\n`;
}

/**
 * Read a `_redirects` file back into rules.
 *
 * FOR `serve.ts`, AND IT PARSES THE EMITTED FILE RATHER THAN REBUILDING THE
 * TABLE. The dev server exists to serve what the build produced; a redirect it
 * resolved from its own copy of the rules would be testing this module twice
 * and the artefact never. This way `bun run dev` is wrong in exactly the cases
 * production is wrong.
 */
export function parseRedirects(text: string): readonly RedirectRule[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .flatMap((line): RedirectRule[] => {
      const [from, to, status] = line.split(/\s+/);
      if (from === undefined || to === undefined) return [];
      return [{ from, to, status: Number(status ?? 301) || 301 }];
    });
}

/**
 * The target for a request path, or `undefined` if no rule matches.
 *
 * PLACEHOLDERS ONLY — no splats, because the table has none and a matcher that
 * quietly supports a syntax nothing emits is a second, untested implementation
 * of Netlify's behaviour. If a `/*` rule is ever added, this throws on it rather
 * than ignoring it, so the dev server cannot drift from the host without saying
 * so.
 */
export function matchRedirect(
  rules: readonly RedirectRule[],
  pathname: string,
): string | undefined {
  const path = pathname.replace(/\/+$/, "") || "/";
  /* SPLIT ONCE, NOT PER RULE. This sat inside the loop, so a request that
     matches nothing — every 404 the dev server serves — re-split the same
     string 5,953 times. */
  const pathParts = path.split("/");

  for (const rule of rules) {
    if (rule.from.includes("*")) {
      throw new Error(
        `apps/site/ssg/redirects.ts: matchRedirect does not implement splats, and ` +
          `"${rule.from}" has one. Either teach it, or keep the table to exact ` +
          `paths and :placeholders — a dev server that silently ignores a rule ` +
          `production applies is worse than one that refuses to start.`,
      );
    }

    const fromParts = rule.from.split("/");
    if (fromParts.length !== pathParts.length) continue;

    const bindings = new Map<string, string>();
    const matched = fromParts.every((part, index) => {
      const actual = pathParts[index] ?? "";
      if (!part.startsWith(":")) return part === actual;
      if (actual === "") return false;
      bindings.set(part.slice(1), actual);
      return true;
    });
    if (!matched) continue;

    return rule.to
      .split("/")
      .map((part) =>
        part.startsWith(":") ? bindings.get(part.slice(1)) : part,
      )
      .join("/");
  }

  return undefined;
}
