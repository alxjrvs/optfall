/**
 * The two files the host reads and never serves: `_headers` and `_redirects`.
 *
 * WHY THEY ARE BUILD OUTPUT. Cloudflare reads its host configuration out of
 * the published directory rather than from a file at the repository root, so
 * these two are emitted by the build — and this is the module that decides what
 * goes in them.
 *
 * WHY THEY ARE NOT IN {@link generatedAssets}. That registry is the list of
 * files the site SERVES, and `check-dev-server.ts` asserts every member of it
 * is fetchable. These two are consumed by the host and deliberately not served
 * — Cloudflare strips them from the asset manifest — so a membership that made
 * the dev-server check assert `/\_headers` returns 200 would be asserting the
 * opposite of what production does.
 *
 * The OLD reason `_redirects` sat outside that registry was different and no
 * longer applies: it was derived from 4,941 cards, and giving `assets.ts` a
 * member that dragged an 18 MB corpus behind it would have made every importer
 * pay for it. Nothing in this file touches the corpus. It is a constant.
 */

/** One `_redirects` rule. `from` and `to` are exact paths. */
export interface RedirectRule {
  readonly from: string;
  readonly to: string;
  readonly status: number;
}

/**
 * Every redirect the site still owns — all one of them.
 *
 * THIS IS THE SURVIVOR OF A TABLE THAT HAD 12,278 ENTRIES. The rest were the
 * pre-change card URLs, retired in the commit before this one; the reasoning
 * and the cost are recorded there. What is left is the rule a human wrote for a
 * reason a human can still state.
 *
 * `/cards` was the results page until it moved to `/search`, which is where
 * every other card site puts it and therefore where people look. Permanent, so
 * links already pasted survive — and a redirect rather than a deleted route,
 * because query strings survive a 301 and `/cards?q=banned:cc` has to keep
 * answering.
 *
 * A STATIC ASSET ALWAYS WINS over a rule here — there is no way to force a
 * redirect ahead of a real file. That costs nothing today, because the build
 * emits no `cards/` directory and `/cards` names nothing, so the rule fires.
 * It WOULD start mattering the day a `/cards` page came back, which is why it
 * is written down rather than left to be rediscovered.
 */
export const REDIRECTS: readonly RedirectRule[] = [
  { from: "/cards", to: "/search", status: 301 },
];

/** One `_headers` block: a path pattern and the headers it contributes. */
export interface HeaderRule {
  readonly pattern: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * The response headers the host adds.
 *
 * `X-Content-Type-Options: nosniff` and `Referrer-Policy` are general hardening.
 * Worth being explicit about one thing: `docs/COMPLIANCE.md` §"Nothing here is
 * coupled to the host" establishes that the affiliate links do NOT depend on
 * `Referrer-Policy` — attribution travels in the URL path and `buyRel` puts
 * `noreferrer` on those anchors in both states. So this header is hardening, not
 * a compliance dependency, and its presence is a choice rather than an
 * obligation.
 *
 * THE WEBMANIFEST TYPE IS REDUNDANT, AND THAT IS MEASURED RATHER THAN ASSUMED.
 * With this rule REMOVED from a fixture and served by real workerd,
 * `/manifest.webmanifest` still came back
 * `Content-Type: application/manifest+json`. Wrangler infers the type from the
 * extension and attaches it at upload time, so the same inference that answered
 * locally is the one that answers in production.
 *
 * It is kept anyway, and the reason is `nosniff` directly above. That header's
 * whole purpose is to make a declared type BINDING — a browser will not second-
 * guess it — so the type this site is served with should be one this repository
 * states, not one a platform's extension table happens to agree with today.
 * One rule out of a hundred to stop a security header we deliberately set from
 * resting on an inferred default.
 *
 * DO NOT "SIMPLIFY" THIS BY DELETING IT ON THE GROUNDS THAT IT CHANGES NOTHING.
 * That is true, it is why this paragraph exists, and it is not the argument.
 */
/**
 * A year, and `immutable` — the strongest thing a cache header can say.
 *
 * ONLY EVER APPLIED TO A NAME THAT CARRIES ITS OWN DIGEST, which is what makes
 * the claim true rather than optimistic. `immutable` tells a browser not to
 * revalidate even when the reader presses reload; on a file whose contents can
 * change under a fixed name that is a year of serving something stale.
 *
 * WHICH FILES THOSE ARE IS THE CALLER'S TO KNOW, NOT THIS MODULE'S TO GUESS.
 * A first attempt inferred it from the filename — eight-plus characters after
 * the last hyphen — and it was wrong in both directions: `icon-maskable.svg`
 * and `apple-touch-icon.png` matched, and tightening the rule to require a
 * digit then excluded `SearchField-BOLseuIY.css`, whose Vite hash happens to
 * contain none. A test that depends on whether a digest rolled a digit is
 * worse than no test. `build.ts` reads the names out of Vite's own manifest
 * and hands them over; see {@link headersFor}.
 */
const IMMUTABLE = "public, max-age=31536000, immutable";

export const HEADERS: readonly HeaderRule[] = [
  {
    pattern: "/*",
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  {
    pattern: "/manifest.webmanifest",
    headers: { "Content-Type": "application/manifest+json" },
  },
];

/**
 * `_redirects`: `<from> <to> <status>`, one rule per line.
 */
export function renderRedirects(
  rules: readonly RedirectRule[] = REDIRECTS,
): string {
  const lines = rules.map((rule) => `${rule.from} ${rule.to} ${rule.status}`);
  return `${lines.join("\n")}\n`;
}

/**
 * The header rules for one build: the standing set, plus `noindex` everywhere
 * when this build is a preview rather than production.
 *
 * PREVIEWS ARE LOAD-BEARING ON THIS PROJECT SPECIFICALLY — a legality bug is
 * visible in a preview and invisible in a diff — and a preview is therefore
 * another public host serving the same 12,776 pages. Two indexed copies of a
 * reference site is precisely the duplication the canonical tags exist to
 * prevent, so a preview must say `noindex` and production must not.
 *
 * THE DIRECTIVE IS MERGED INTO THE EXISTING `/*` RULE, NOT APPENDED AS A SECOND
 * ONE, AND THAT DISTINCTION IS THE WHOLE REASON THIS FUNCTION EXISTS. Appending
 * a second `/*` block is the obvious way to do this in a shell one-liner, and it
 * is WRONG: measured against real workerd, a later block with the same pattern
 * REPLACES the earlier one rather than adding to it. A preview built that way
 * served `X-Robots-Tag: noindex` and silently lost both `X-Content-Type-Options`
 * and `Referrer-Policy` — a security posture dropped on every preview, visible
 * nowhere, caught only because the response was actually read.
 *
 * So the merge happens here, in typed code with a test on it, rather than in a
 * workflow step nobody re-reads.
 */
export function headersFor(options: {
  readonly preview: boolean;
  /**
   * Served paths whose names carry a content digest, so they can be cached for
   * a year. Omitted means "no cache rules" — which is what the tests that only
   * exercise the preview merge want, and what a caller that cannot prove a file
   * is hashed should pass.
   */
  readonly immutable?: readonly string[];
}): readonly HeaderRule[] {
  /*
    ONE RULE PER FILE, RATHER THAN ONE PATTERN OVER `assets/`.

    The pattern is the tempting shape and it is wrong here for a reason this
    file already knows: `assets/tokens.css` sits in that directory and is NOT
    hashed — it is generated from `packages/theme` under a fixed name — so
    `/assets/*` would promise a year of immutability for a stylesheet that
    changes whenever a token does, in every returning reader's browser.

    Naming each file means the header is derived from what was actually
    emitted. Cloudflare caps this file at 100 rules; the build emits a handful
    of hashed assets, and {@link renderHeaders} asserts the ceiling rather than
    trusting the arithmetic.
  */
  const cache: readonly HeaderRule[] = (options.immutable ?? []).map(
    (file) => ({
      pattern: file.startsWith("/") ? file : `/${file}`,
      headers: { "Cache-Control": IMMUTABLE },
    }),
  );

  const base = [...HEADERS, ...cache];
  if (!options.preview) return base;

  return base.map((rule) =>
    rule.pattern === "/*"
      ? { ...rule, headers: { ...rule.headers, "X-Robots-Tag": "noindex" } }
      : rule,
  );
}

/**
 * `_headers`: a pattern on its own line, then one indented `Name: value` per
 * header, blocks separated by a blank line.
 *
 * Cloudflare caps this file at 100 rules and 2,000 characters per line. Two
 * rules is not near either, and this comment exists so that a future addition
 * is made knowing there is a ceiling at all.
 *
 * NO TWO RULES MAY SHARE A PATTERN. See {@link headersFor}: the later one wins
 * outright and the earlier one's headers are lost, so a duplicate pattern is a
 * silent deletion rather than a merge. Asserted in the tests.
 */
export function renderHeaders(rules: readonly HeaderRule[] = HEADERS): string {
  /* The ceiling the comment above names, asserted rather than assumed — the
     cache rules are derived per file, so this is the one number that grows
     when the build gains an asset. */
  if (rules.length > 100) {
    throw new Error(
      `hostConfig: ${rules.length} header rules, over Cloudflare's cap of 100. The cache rules are one per content-hashed asset; if the build has grown that many, they need collapsing into a pattern that still cannot match assets/tokens.css.`,
    );
  }

  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.pattern)) {
      throw new Error(
        `hostConfig: two rules share the pattern ${rule.pattern}. A later block REPLACES an earlier one with the same pattern rather than merging, so this would silently drop headers — see the note on headersFor.`,
      );
    }
    seen.add(rule.pattern);
  }

  const blocks = rules.map((rule) => {
    const lines = Object.entries(rule.headers).map(
      ([name, value]) => `  ${name}: ${value}`,
    );
    return `${rule.pattern}\n${lines.join("\n")}`;
  });
  return `${blocks.join("\n\n")}\n`;
}
