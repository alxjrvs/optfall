/**
 * `_redirects` — the 5,842 rules that keep every pre-change card URL working.
 *
 * WHY THERE IS A REDIRECT TABLE AT ALL. The card scheme moved from
 * `/card/<slug>` (+ `/card/<slug>/<set>/<number>` for alternate arts) to
 * `/card/<set>/<number>/<slug>` for every printing. That is 12,278 live URLs
 * whose spelling changed, on a site whose stated thesis is that a URL here is a
 * permanent, citable address. A permanent address that 404s is not a smaller
 * promise, it is a broken one — so every old form 301s to the page it named.
 *
 * WHY IT IS A FILE AND NOT `netlify.toml`. `netlify.toml` is hand-written and
 * reviewed; this is 5,842 machine-derived lines that change whenever the corpus
 * does. Netlify merges both and processes the toml first, which is the right way
 * round: the handful of deliberate rules win, and the generated bulk sits behind
 * them. Mixing the two would put a diff nobody can read in a file whose whole
 * value is that a human checks it.
 *
 * THE ARITHMETIC, BECAUSE THE COUNT IS THE DESIGN CONSTRAINT. Netlify's
 * guidance is to reach for wildcards "if you need to set up 10,000 redirects or
 * more", and warns that a large enough serialised output fails the deploy. The
 * naive table is 12,278 rules. What gets it to 5,842:
 *
 * - **4,941** card slugs → that card's default printing. Irreducible: mapping
 *   `head-jab-1` to `wtr/098` needs the corpus, not a pattern.
 * - **900** shared names → the lowest-pitch version's default printing. Same.
 * - **1** placeholder rule for all **6,437** old printing URLs, because
 *   `/card/<slug>/<set>/<number>` → `/card/<set>/<number>/<slug>` is a pure
 *   permutation of three segments and Netlify placeholders can express exactly
 *   that. This is the rule that keeps the table inside the guidance.
 *
 * NOTHING HERE IS FORCED, AND THAT IS WHAT MAKES THE PLACEHOLDER SAFE. A `!`
 * rule beats an existing file; a plain rule loses to one. Both the old printing
 * form and the new one are three segments under `/card/`, so
 * `/card/:a/:b/:c` matches a live page too — and because the rule is unforced,
 * Netlify serves the page and never consults it. The rule only fires where no
 * file exists, which is precisely the old spellings.
 *
 * ONE HONEST LOOSE END. A three-segment path matching nothing real — a typo, a
 * dead guess — now 301s to its own permutation before 404ing, so a miss can cost
 * one extra hop. The alternative is enumerating 6,437 rules to avoid a redirect
 * to a 404, which is the wrong trade against Netlify's own ceiling.
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
 * `/card/<slug>/<set>/<number>` → `/card/<set>/<number>/<slug>`, once.
 *
 * Exported rather than inlined so `ssg.test.ts` can assert the shape of the one
 * rule in this file that is not derived from the corpus, and so the count in
 * the doc-block above has something to be checked against.
 */
export const LEGACY_PRINTING_RULE: RedirectRule = {
  from: "/card/:slug/:set/:number",
  to: "/card/:set/:number/:slug",
  status: 301,
};

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

  return [
    ...cardRedirects.map((redirect) => ({ ...redirect, status: 301 })),
    LEGACY_PRINTING_RULE,
  ];
}

/**
 * The file Netlify reads: `<from> <to> <status>`, one rule per line.
 *
 * A COMMENT HEADER, BECAUSE SOMEBODY WILL OPEN THIS IN A DEPLOY. 5,842 lines of
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
    const pathParts = path.split("/");
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
