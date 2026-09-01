import { INLINE_SCRIPT_HASHES } from "./inlineScripts";

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

/*
  `SCRIPT-SRC` IS NOW STRICT, AND NO `UNSAFE-INLINE` ANYWHERE IN IT.

  This block previously explained why it could not be. Three inline scripts
  exist; two were fixed constants, but `CardEntry.tsx`'s embedded a per-card
  JSON literal, giving each of the 12,776 card pages a different body and so a
  different hash. `_headers` is pattern-based and capped at 100 rules, so a
  per-page hash allowlist was not expressible, and the honest options were
  `unsafe-inline` — a decorative directive — or extracting the scripts first.

  Extracting them is what happened. The per-card data now travels as
  `data-pitch-targets` on the script element and the body reads it through
  `document.currentScript`. A CSP hash covers the body and not the attributes,
  so ONE hash admits every card page, and all three scripts are constants in
  `ssg/inlineScripts.ts`.

  THE HASHES ARE DERIVED FROM THE SAME STRINGS THE PAGES RENDER, which is the
  property worth protecting. `INLINE_SCRIPT_HASHES` is computed by hashing the
  exported constants, so editing a script body moves its hash in the same build.
  A hash written into this table by hand would instead start blocking the page's
  own script the next time somebody fixed a typo in it — and that failure
  appears in a browser console, not in CI.

  `style-src` KEEPS `'unsafe-inline'` AND THAT IS NOT AN OVERSIGHT. The build
  emits inline `style` attributes for per-card layout values, and CSP hashes do
  not apply to style attributes at all — only `'unsafe-hashes'` or a nonce would
  reach them, and a nonce is impossible on a static site with no server to
  generate one per response. Narrowing this is a real piece of work and is not
  smuggled in here.

  The rest is unchanged: clickjacking, base-tag injection, plugin embedding,
  form exfiltration, and an image policy naming the one external host.

  `frame-ancestors` is the reason this is a header rather than a `<meta>` tag —
  it is ignored in `<meta>`, and it is the directive doing the most work here.
*/
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src 'self' ${INLINE_SCRIPT_HASHES.join(" ")}`,
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' https://images.optfall.com data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self'",
].join("; ");

/*
  HSTS. A year, subdomains included, no `preload`.

  `includeSubDomains` covers `images.optfall.com`, which is HTTPS-only anyway,
  so it costs nothing and closes the one sibling host.

  `preload` is deliberately ABSENT and should stay absent unless somebody
  decides otherwise with the consequence in front of them: submitting to the
  preload list is baked into browser binaries and is slow and awkward to undo.
  That is a commitment about every future subdomain, not a header.
*/
const STRICT_TRANSPORT_SECURITY = "max-age=31536000; includeSubDomains";

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
 * The one file the build writes into `/assets/` under a name it reuses.
 *
 * IT LIVES HERE BECAUSE IT IS A CONSTRAINT ON THE RULES BELOW, not because
 * this module writes it — `build.ts` does, from `packages/theme`'s generator,
 * and imports the path back from here. A `/assets/*` cache rule once claimed
 * that every file in that directory carried its own digest; this one does not,
 * and naming it beside the rules is what lets `ssg.test.ts` assert that no
 * rule covers it without importing `build.ts`, which runs the build on import.
 */
export const TOKENS_PATH = "assets/tokens.css";

export const HEADERS: readonly HeaderRule[] = [
  {
    pattern: "/*",
    headers: {
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": CONTENT_SECURITY_POLICY,
      "Strict-Transport-Security": STRICT_TRANSPORT_SECURITY,
      "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    },
  },
  /*
    ~~EVERY FILE UNDER `/assets/` CARRIES ITS OWN DIGEST, WHICH IS WHAT MAKES A
    YEAR HONEST.~~ **IT DOES NOT, AND THE RULE THAT SAID SO IS WITHDRAWN.**

    THE CLAIM WAS FALSE WHEN IT WAS WRITTEN, AND CHECKING IT TOOK ONE `ls`.
    Vite's default `assets/[name]-[hash][extname]` does cover the stylesheets
    and the island bundles, and `searchIndexes.ts` does write
    `assets/${name}-${digest}.json`. But `build.ts` writes one more file into
    that directory itself, under a FIXED name — `TOKENS_PATH =
    "assets/tokens.css"`, generated from `packages/theme` — so a rule over
    `/assets/*` promised a year of immutability for the one stylesheet in the
    build that changes whenever a design token does.

    `immutable` IS WHY THIS WAS WORTH REVERTING RATHER THAN SHORTENING. It
    tells a browser not to revalidate even when the reader presses reload, so
    the damage is not proportional to how long the header is live: one page
    load while it was served pins that reader's token stylesheet for a year,
    and every later token change silently fails to reach them. Measured on the
    built output — `dist/assets/` holds eight files and `tokens.css` is the
    one with no digest in its name.

    NO PATTERN OVER THIS DIRECTORY CAN BE RIGHT, which is the reason this is a
    deletion rather than a narrower glob. Inferring hashedness from the shape
    of a filename is the fix that looks obvious and is not — it has to be
    right about every file the build emits now and every one it emits later,
    and it is wrong the first time somebody adds a second fixed-name asset.
    The cache rule has to be derived from what Vite actually hashed, which
    means `build.ts` reading its own manifest and handing the list over.

    That work already exists, written independently and with tests, in the
    branch behind #326 — which was authored against a tree that had no rule
    here at all. Removing this restores exactly the state it expects, so the
    correct version lands there rather than being hand-rolled twice.

    `/*` IS DELIBERATELY LEFT ALONE, and that half of the original argument
    still stands. Pages must revalidate: the corpus syncs, and a stale card
    page is a wrong answer rather than a slow one — which is the whole
    product. Do not "finish the job" by adding a long TTL to the wildcard; the
    asymmetry is the point.
  */
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
}): readonly HeaderRule[] {
  if (!options.preview) return HEADERS;

  return HEADERS.map((rule) =>
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
  const blocks = rules.map((rule) => {
    const lines = Object.entries(rule.headers).map(
      ([name, value]) => `  ${name}: ${value}`,
    );
    return `${rule.pattern}\n${lines.join("\n")}`;
  });
  return `${blocks.join("\n\n")}\n`;
}
