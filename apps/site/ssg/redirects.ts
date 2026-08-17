/**
 * `_redirects` — the 12,278 rules that keep every pre-change card URL working.
 *
 * WHY THERE IS A REDIRECT TABLE AT ALL. The card scheme moved from
 * `/card/<slug>` (+ `/card/<slug>/<set>/<number>` for alternate arts) to
 * `/card/<set>/<number>/<slug>` for every printing. That is 12,278 live URLs
 * whose spelling changed, on a site whose stated thesis is that a URL here is a
 * permanent, citable address. A permanent address that 404s is not a smaller
 * promise, it is a broken one — so every old form 301s to the page it named.
 *
 * WHY IT IS A FILE AND NOT `netlify.toml`. `netlify.toml` is hand-written and
 * reviewed; this is 12,278 machine-derived lines that change whenever the
 * corpus does. Netlify merges both and processes the toml first, which is the
 * right way round: the handful of deliberate rules win, and the generated bulk
 * sits behind them. Mixing the two would put a diff nobody can read in a file
 * whose whole value is that a human checks it.
 *
 * **EVERY RULE IS AN EXACT PATH. THERE ARE NO PATTERNS, AND THAT IS THE WHOLE
 * DESIGN — arrived at after two attempts at the clever version each shipped an
 * infinite redirect.**
 *
 * The 6,437 old printing URLs are a pure permutation of three segments, so they
 * look like one placeholder rule. They are not:
 *
 * - `/card/:slug/:set/:number` → `/card/:set/:number/:slug` is a **3-cycle**.
 *   An unforced Netlify rule is skipped only when a FILE exists at the REQUEST
 *   path; the target is never checked. So any three-segment `/card/` path
 *   naming nothing real — a typo, a crawler's guess — 301s round that ring
 *   forever and the reader gets `ERR_TOO_MANY_REDIRECTS` instead of a 404.
 * - Pinning the set code to segment two, one rule per code, fixed exactly that
 *   case and left a narrower one. `/card/wtr/lgs/mst` → `/card/lgs/mst/wtr` →
 *   `/card/mst/wtr/lgs` → back, because every segment is a set code and the
 *   permuted output satisfies the same rule; `/card/wtr/wtr/wtr` rewrites to
 *   itself in one hop.
 *
 * **BOTH WERE FOUND IN REVIEW, NOT BY THE GUARD WRITTEN TO CATCH THEM**, and
 * that is the argument against patterns rather than an argument for a third
 * one. A guard over placeholders has to INVENT bindings to probe with; the
 * cycle lives in the bindings it did not think of, and the second version
 * probed with the literal `x`, which is not a set code. Enumerating removes the
 * question: with no placeholders, "does any rule's target match a rule?" is set
 * membership over two finite lists, and {@link redirectRules} checks all 12,278
 * of them exhaustively.
 *
 * THE COST, STATED PLAINLY. A 790 kB `_redirects`, and a rule count above the
 * "if you need to set up 10,000 redirects or more, we recommend using wildcards
 * or placeholders" line in Netlify's own docs. That is guidance about
 * processing cost, not a limit — the documented hard failure is a serialised
 * output "too large" to deploy, with no number attached. Two infinite-redirect
 * bugs is a steep price for staying under an advisory.
 *
 * WHAT IT BUYS BESIDES CORRECTNESS: a dead URL 404s immediately rather than
 * taking a hop first, and `matchRedirect` is a `Map` lookup.
 *
 * WHAT IS DELIBERATELY NOT REDIRECTED: `/card/<set>/<number>` with no name tail.
 * It reads like the obvious convenience — set code and collector number are both
 * printed on the card — and it cannot be one here, because it is AMBIGUOUS in
 * this corpus. `ros/257-v2` is claimed by both Runechant and Embodiment of
 * Earth, which share one physical double-sided token and therefore one art. The
 * name tail is not decoration on those URLs, it is the disambiguator. See the
 * collision check in `cards.ts`.
 */

/** One rule, in Netlify's terms. `from` and `to` are both exact paths. */
export interface RedirectRule {
  readonly from: string;
  readonly to: string;
  readonly status: number;
}

/**
 * The whole table, with the two things that make it safe asserted here.
 *
 * IT TAKES THE CARD REDIRECTS AS AN ARGUMENT rather than importing them, and
 * that is the same rule `printings.ts` exists to keep: `cards.ts` loads a 16 MB
 * corpus at module scope, and `serve.ts` imports {@link matchRedirect} from
 * this file. A module the dev server reaches must not be able to drag the
 * corpus in behind it.
 */
export function redirectRules(
  cardRedirects: readonly { readonly from: string; readonly to: string }[],
): readonly RedirectRule[] {
  const targets = new Map<string, string>();
  for (const redirect of cardRedirects) {
    const clash = targets.get(redirect.from);
    if (clash !== undefined) {
      throw new Error(
        `apps/site/ssg/redirects.ts: ${redirect.from} is redirected twice — to ` +
          `${clash} and to ${redirect.to}. Netlify takes the first match, so one ` +
          `of these would silently never apply.`,
      );
    }
    if (redirect.from.includes(":") || redirect.from.includes("*")) {
      throw new Error(
        `apps/site/ssg/redirects.ts: "${redirect.from}" is a pattern, and this ` +
          `table is exact-path only. See the note at the top of this file: two ` +
          `versions of it used placeholders and both were infinite redirects.`,
      );
    }
    targets.set(redirect.from, redirect.to);
  }

  /*
   * NO RULE MAY POINT AT ANOTHER RULE'S SOURCE. This is the acyclicity check,
   * and because every rule is an exact path it is EXHAUSTIVE rather than a
   * sample: a chain of length two is impossible, so a cycle of any length is.
   *
   * It is a build step and not only a test because the failure it catches is
   * invisible in the output and presents to a reader as `ERR_TOO_MANY_REDIRECTS`
   * on a URL that should simply have 404'd. Two versions of this table had that
   * bug; neither was caught by the checks that existed at the time, because
   * both of those checks probed patterns with bindings they chose themselves.
   */
  for (const [from, to] of targets) {
    if (targets.has(to)) {
      throw new Error(
        `apps/site/ssg/redirects.ts: the redirect table has a chain. ` +
          `"${from}" sends a reader to "${to}", which is itself redirected (to ` +
          `"${targets.get(to)}"). Netlify does not check that a redirect target ` +
          `resolves, so a chain that closes is an infinite loop in a browser ` +
          `rather than a 404. Every rule must land on a page.`,
      );
    }
  }

  return [...targets].map(([from, to]) => ({ from, to, status: 301 }));
}

/**
 * The file Netlify reads: `<from> <to> <status>`, one rule per line.
 *
 * A COMMENT HEADER, BECAUSE SOMEBODY WILL OPEN THIS IN A DEPLOY. 12,278 lines
 * of generated paths with no provenance is the kind of artefact that gets
 * deleted by someone who cannot tell what wrote it.
 */
export function renderRedirects(rules: readonly RedirectRule[]): string {
  const header = [
    "# Generated by apps/site/ssg/build.ts — do not edit.",
    "# Deliberate, hand-written rules live in netlify.toml, which is processed first.",
    "# See apps/site/ssg/redirects.ts for why these exist and why they are not wildcards.",
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
 * The lookup {@link matchRedirect} reads. Built once, by a caller that serves.
 *
 * A TRAILING SLASH IS THE SAME URL. Netlify does not care about one and neither
 * may this, or a link pasted with a slash on the end would 404 locally and work
 * in production.
 *
 * EXACT KEYS ONLY, AND A PATTERN THROWS RATHER THAN BEING IGNORED. The table
 * has no placeholders by design; a matcher that quietly supported a syntax
 * nothing emits would be a second, untested implementation of Netlify's
 * behaviour — which is precisely how two infinite redirects got past a green
 * suite. If one is ever added this refuses to run rather than silently
 * disagreeing with the host.
 */
export function redirectIndex(
  rules: readonly RedirectRule[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  for (const rule of rules) {
    if (rule.from.includes(":") || rule.from.includes("*")) {
      throw new Error(
        `apps/site/ssg/redirects.ts: the redirect table is exact-path only, and ` +
          `"${rule.from}" is a pattern. Netlify would apply it; this would not, ` +
          `and a dev server that silently ignores a rule production applies is ` +
          `worse than one that refuses to start.`,
      );
    }
    index.set(rule.from.replace(/\/+$/, "") || "/", rule.to);
  }
  return index;
}

/** The target for a request path, or `undefined` if no rule matches. */
export function matchRedirect(
  index: ReadonlyMap<string, string>,
  pathname: string,
): string | undefined {
  return index.get(pathname.replace(/\/+$/, "") || "/");
}
