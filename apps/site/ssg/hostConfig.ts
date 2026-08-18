/**
 * The two files the host reads and never serves: `_headers` and `_redirects`.
 *
 * WHY THEY ARE HERE AND NOT IN `netlify.toml`. They used to be in it. Moving
 * hosting to Cloudflare means the host's configuration stops being a TOML file
 * the platform reads out of the repository root and becomes two plain-text
 * files inside the published directory — so they are build output now, and this
 * is the module that decides what goes in them.
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
 * member that dragged a 16 MB corpus behind it would have made every importer
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
 * ON `force`. Netlify's version of this rule set `force = true`, which makes a
 * redirect win even when a file exists at the request path. Cloudflare has no
 * such flag: a static asset always wins. That is not a behaviour change here,
 * because the build emits no `cards/` directory — `/cards` names nothing, so
 * the rule fires either way. It WOULD become one the day a `/cards` page came
 * back, which is why this is written down rather than left to be rediscovered.
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
 * The response headers the host adds, carried over from `netlify.toml` intact.
 *
 * `X-Content-Type-Options: nosniff` and `Referrer-Policy` are general hardening
 * and were already the site's posture. Worth being explicit about one thing
 * while a hosting migration is in flight: `docs/COMPLIANCE.md` §"Nothing here is
 * coupled to the host" establishes that the affiliate links do NOT depend on
 * `Referrer-Policy` — attribution travels in the URL path and `buyRel` puts
 * `noreferrer` on those anchors in both states. So this header is hardening, not
 * a compliance dependency, and carrying it is a choice rather than an
 * obligation. It is carried because dropping a security header during a
 * platform move is how a posture quietly regresses.
 *
 * THE WEBMANIFEST TYPE IS REDUNDANT ON CLOUDFLARE, AND THAT IS MEASURED RATHER
 * THAN ASSUMED. It was load-bearing on Netlify, which had no built-in type for
 * `.webmanifest` and served it as `application/octet-stream`. Cloudflare does
 * not need telling: with this rule REMOVED from a fixture and served by real
 * workerd, `/manifest.webmanifest` still came back
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
 * `_redirects`, in the one format both Netlify and Cloudflare read:
 * `<from> <to> <status>`, one rule per line.
 */
export function renderRedirects(
  rules: readonly RedirectRule[] = REDIRECTS,
): string {
  const lines = rules.map((rule) => `${rule.from} ${rule.to} ${rule.status}`);
  return `${lines.join("\n")}\n`;
}

/**
 * `_headers`: a pattern on its own line, then one indented `Name: value` per
 * header, blocks separated by a blank line.
 *
 * Cloudflare caps this file at 100 rules and 2,000 characters per line. Two
 * rules is not near either, and this comment exists so that a future addition
 * is made knowing there is a ceiling at all.
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
