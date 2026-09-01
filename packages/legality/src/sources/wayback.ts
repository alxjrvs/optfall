/**
 * Retrieval layer for archived `fabtcg.com` banned-and-restricted
 * announcements, via the Internet Archive.
 *
 * ## Why this exists
 *
 * Whether a public archive of past banned-and-restricted revisions exists was
 * the question that decided a headline feature. `docs/ROADMAP.md` answers it
 * under "Phase 3 — Legality that remembers", in "What blocks it": **yes, and
 * the Wayback Machine is the route.** LSS's own host returns HTTP 403 to automated fetches; the archive
 * serves the same documents without complaint and needs no API key.
 *
 * ## What this module does, and deliberately does not do
 *
 * It **retrieves**. It enumerates captures, de-duplicates them, fetches the
 * original archived bytes, normalises capture timestamps, and reduces HTML to
 * readable text.
 *
 * It does **not** extract card names, formats, actions or effective dates from
 * the prose, and that omission is a decision rather than an unfinished edge.
 * The announcements are editorial prose, not tables — the 21 Sep 2021 article
 * says "removing Seeds of Agony from the Classic Constructed format", not a
 * field called `banned`. `docs/ROADMAP.md` fixes the only admissible method
 * ("Phase 3 — Legality that remembers", under "What blocks it"):
 * closed-vocabulary matching against the card dataset (which is currently
 * unlicensed, so it does not exist here yet), with **human review of every
 * extracted entry before publication**. A wrong ban date is precisely
 * the failure this project exists to eliminate, so the retrieval layer stops
 * where the guessing would start.
 *
 * ## Three different dates live in one announcement — do not conflate them
 *
 * This is the single most likely way to produce a wrong ban date, so it is
 * stated here rather than left to be discovered. Taking the 21 Sep 2021
 * announcement as the worked example, all three of these are real and all
 * three differ:
 *
 * 1. **The capture timestamp** — `20210921012416`. When the *Internet Archive
 *    crawled the page*. {@link captureTimestampToIsoDate} normalises this and
 *    nothing else. It is provenance for the retrieval, and it is never the
 *    legality date.
 * 2. **The publication date printed in the article** — "21st Sep 2021". Sits
 *    in the page body, next to the author's byline.
 * 3. **The effective date of the change** — "Seeds of Agony is banned
 *    (Effective September 24, 2021)". *This* is the date a timeline entry's
 *    `effectiveFrom` needs, and it is three days after the other two.
 *
 * Only (1) is derivable structurally. (2) and (3) live in prose and belong to
 * the reviewed extraction step, not to this file.
 *
 * ## The network is a parameter
 *
 * Every function that touches the network takes a {@link FetchLike} defaulting
 * to global `fetch`. Tests pass a stub over committed fixtures of real captured
 * bytes and never reach the network; a scheduled ingestion job can pass a
 * caching wrapper for the same reason.
 *
 * ## Everything asserted here was verified by running the request
 *
 * Retrieved 2026-08-10. No value in this file is inferred from documentation.
 *
 * - `GET /cdx/search/cdx?url=fabtcg.com&matchType=domain&output=json&filter=statuscode:200`
 *   → HTTP 200, JSON array-of-arrays whose **first row is a header row**.
 * - A query matching nothing returns the two bytes `[]`, not an empty body.
 * - `filter` may be repeated; `filter=urlkey:.*banned.*` returns 40 distinct
 *   announcement URL keys under `collapse=urlkey`.
 * - `filter=mimetype:text/html` removes the `/api/oembed/` rows (which are
 *   `text/xml` and `application/json`) from a topical search.
 * - `https://web.archive.org/web/20210921012416id_/https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/`
 *   → HTTP 200, 33,561 bytes, **zero** occurrences of `archive.org` in the
 *   body: the `id_` modifier really does suppress the Wayback toolbar.
 * - Requesting a timestamp with no exact capture **302-redirects to the
 *   nearest one**, preserving `id_`. This is why {@link fetchCapture} reports
 *   the timestamp it actually received rather than the one it asked for.
 * - A URL the archive has never seen returns HTTP 404.
 *
 * @packageDocumentation
 */

import { isIsoDate, type IsoDate } from "../index";

/* -------------------------------------------------------------------------- */
/* Endpoints                                                                   */
/* -------------------------------------------------------------------------- */

/** The public CDX index. No API key, no account, no rate-limit header seen. */
export const WAYBACK_CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx";

/** Prefix for a capture replay URL, before the timestamp. */
export const WAYBACK_WEB_PREFIX = "https://web.archive.org/web/";

/** The publisher's host. Serves 403 to automated fetches; archived anyway. */
export const FABTCG_DOMAIN = "fabtcg.com";

/**
 * CDX filter matching the banned-and-restricted announcement URL keys.
 *
 * Verified 2026-08-10: with `collapse=urlkey` this returns 40 distinct keys,
 * spanning every slug family the announcements have used —
 * `banned-and-restricted-announcement`, `…-sept21`, `…-dec-14`, `…-oct02`,
 * `…-sep02`, `…-06-10-25`, `…-28-10-25`, `…-errata-bulletin`,
 * `scheduled-banned-and-restricted-announcement-*`, and the pre-rename
 * `banned-suspended-*` / `banned-and-suspended-announcement` slugs.
 *
 * Two observed properties of the result set that a caller must handle rather
 * than assume away:
 *
 * - It includes Japanese translations under `/articles-jp/` (e.g.
 *   `scheduled-banned-and-restricted-announcement-8-7-24-jp`).
 * - It includes tracking-parameter variants of the same article
 *   (`?fbclid=…`, `?s=09`, `?format&type=127&…`). See
 *   {@link dedupeCaptures} and its `"url-without-query"` key.
 */
export const ANNOUNCEMENT_URLKEY_FILTER = "urlkey:.*banned.*";

/**
 * CDX filter narrowing to HTML documents.
 *
 * Verified 2026-08-10 to remove `/api/oembed/1.0/embed?url=…` rows, which are
 * `text/xml` and `application/json`, from a topical search. It does **not**
 * remove topical noise: a `living.legend` urlkey search still returns
 * tournament coverage pages and editorial such as
 * `living-legend-5-decks-to-play`, all of which are genuinely `text/html`.
 * Narrowing to the announcements is the URL-key filter's job, not this one's.
 */
export const HTML_MIMETYPE_FILTER = "mimetype:text/html";

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/** A retrieval that failed. Carries the URL, because a bare message is not a fact. */
export class WaybackError extends Error {
  /** The URL that was requested when this failed. */
  readonly url: string;
  /** The HTTP status, when a response was received at all. */
  readonly status: number | undefined;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = "WaybackError";
    this.url = url;
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* The injectable network                                                      */
/* -------------------------------------------------------------------------- */

/**
 * The subset of `Response` this module reads.
 *
 * `url` is optional because a stub is not obliged to model redirects, and a
 * runtime that omits it should degrade to "we do not know whether we were
 * redirected" rather than to a silent wrong answer.
 */
export interface CaptureResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly url?: string | undefined;
  text(): Promise<string>;
}

/**
 * A `fetch`-shaped function. Global `fetch` satisfies it; so does a stub over
 * fixtures, and so does a disk cache in a scheduled job.
 */
export type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<CaptureResponse>;

const defaultFetch: FetchLike = (url, init) => globalThis.fetch(url, init);

/* -------------------------------------------------------------------------- */
/* CDX search                                                                  */
/* -------------------------------------------------------------------------- */

/** CDX `matchType`, as documented by the archive and exercised here as `"domain"`. */
export type CdxMatchType = "exact" | "prefix" | "host" | "domain";

/**
 * One row of the CDX index.
 *
 * `timestamp` and `original` are required because every downstream operation
 * needs them; the rest are optional because a caller may narrow the returned
 * columns with {@link CdxQuery.fields}. `fields` preserves the whole row by
 * column name, so narrowing never silently loses data.
 */
export interface CdxRecord {
  /** Wayback capture timestamp, 14 digits, `YYYYMMDDhhmmss`, UTC. */
  readonly timestamp: string;
  /** The URL as originally crawled, including any query string. */
  readonly original: string;
  readonly urlkey?: string | undefined;
  readonly mimetype?: string | undefined;
  readonly statuscode?: string | undefined;
  readonly digest?: string | undefined;
  readonly length?: string | undefined;
  /** Every column of the row, keyed by the header name CDX returned. */
  readonly fields: Readonly<Record<string, string>>;
}

/** Query parameters for {@link buildCdxUrl}. */
export interface CdxQuery {
  /** Defaults to {@link FABTCG_DOMAIN}. */
  readonly url?: string;
  /** Defaults to `"domain"`, which is what covers every `fabtcg.com` path. */
  readonly matchType?: CdxMatchType;
  /**
   * Extra `filter=` values, passed through verbatim. Repeated filters are
   * combined by the archive; verified with two and with three.
   */
  readonly filters?: readonly string[];
  /**
   * HTTP status to require. Defaults to `"200"` — the brief for this layer is
   * captures that actually succeeded. Pass `null` to omit the filter entirely
   * and see failed captures too.
   */
  readonly statusCode?: string | null;
  /** CDX `collapse=` value, e.g. `"urlkey"` or `"digest"`. */
  readonly collapse?: string;
  /** CDX `limit=`. Negative values ask the archive for the *last* N rows. */
  readonly limit?: number;
  /** CDX `from=` / `to=`, as `YYYY` through `YYYYMMDDhhmmss` prefixes. */
  readonly from?: string;
  readonly to?: string;
  /** CDX `fl=` — the columns to return. Omit for the archive's default seven. */
  readonly fields?: readonly string[];
}

/**
 * Build a CDX query URL. Pure: no network, so it is directly testable, and a
 * caller can log or cache-key the exact URL that will be requested.
 */
export function buildCdxUrl(query: CdxQuery = {}): string {
  const params = new URLSearchParams();
  params.set("url", query.url ?? FABTCG_DOMAIN);
  params.set("matchType", query.matchType ?? "domain");
  params.set("output", "json");

  const statusCode = query.statusCode === undefined ? "200" : query.statusCode;
  if (statusCode !== null) {
    params.append("filter", `statuscode:${statusCode}`);
  }
  for (const filter of query.filters ?? []) {
    params.append("filter", filter);
  }

  if (query.collapse !== undefined) params.set("collapse", query.collapse);
  if (query.from !== undefined) params.set("from", query.from);
  if (query.to !== undefined) params.set("to", query.to);
  if (query.fields !== undefined) params.set("fl", query.fields.join(","));
  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit)) {
      throw new TypeError(
        `limit must be an integer; received ${String(query.limit)}.`,
      );
    }
    params.set("limit", String(query.limit));
  }

  return `${WAYBACK_CDX_ENDPOINT}?${params.toString()}`;
}

function isStringRow(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((cell) => typeof cell === "string")
  );
}

/**
 * Parse a CDX `output=json` body into records.
 *
 * The format is an array of arrays whose **first row is a header row** naming
 * the columns. Rows are mapped by that header rather than by position, so a
 * caller narrowing columns with `fl` cannot silently shift every field by one.
 *
 * A query matching nothing returns `[]` — verified, not assumed — and that
 * parses to an empty array rather than throwing.
 *
 * @throws {WaybackError} When the body is not the documented shape, or when
 * the header lacks `timestamp` or `original`. Failing loudly here is the point:
 * a silently-empty result would look identical to "there is no archive".
 */
export function parseCdxResponse(
  body: string,
  sourceUrl = WAYBACK_CDX_ENDPOINT,
): CdxRecord[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (cause) {
    throw new WaybackError(
      `CDX response was not JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
      sourceUrl,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new WaybackError("CDX response was not an array of rows.", sourceUrl);
  }
  if (parsed.length === 0) return [];

  const header = parsed[0];
  if (!isStringRow(header)) {
    throw new WaybackError(
      "CDX response header row was not an array of strings.",
      sourceUrl,
    );
  }
  if (!header.includes("timestamp") || !header.includes("original")) {
    throw new WaybackError(
      `CDX header must name both "timestamp" and "original"; received [${header.join(", ")}].`,
      sourceUrl,
    );
  }

  const records: CdxRecord[] = [];
  for (let index = 1; index < parsed.length; index += 1) {
    const row = parsed[index];
    if (!isStringRow(row)) {
      throw new WaybackError(
        `CDX row ${String(index)} was not an array of strings.`,
        sourceUrl,
      );
    }

    const fields: Record<string, string> = {};
    for (let column = 0; column < header.length; column += 1) {
      const name = header[column];
      const cell = row[column];
      if (name !== undefined && cell !== undefined) fields[name] = cell;
    }

    const timestamp = fields["timestamp"];
    const original = fields["original"];
    if (timestamp === undefined || original === undefined) {
      throw new WaybackError(
        `CDX row ${String(index)} is missing timestamp or original.`,
        sourceUrl,
      );
    }

    records.push({
      timestamp,
      original,
      urlkey: fields["urlkey"],
      mimetype: fields["mimetype"],
      statuscode: fields["statuscode"],
      digest: fields["digest"],
      length: fields["length"],
      fields,
    });
  }

  return records;
}

/**
 * Run a CDX search. The only network call in the enumeration path.
 *
 * @param query - See {@link CdxQuery}. Defaults to every HTTP 200 capture
 * under `fabtcg.com`, which is a large result set — pass filters.
 * @param fetchImpl - Injected network; defaults to global `fetch`.
 * @throws {WaybackError} On a non-2xx response or a malformed body.
 */
export async function searchCaptures(
  query: CdxQuery = {},
  fetchImpl: FetchLike = defaultFetch,
): Promise<CdxRecord[]> {
  const url = buildCdxUrl(query);
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new WaybackError(
      `CDX search failed with HTTP ${String(response.status)}.`,
      url,
      response.status,
    );
  }
  return parseCdxResponse(await response.text(), url);
}

/**
 * The verified announcement search: HTML captures whose URL key matches
 * {@link ANNOUNCEMENT_URLKEY_FILTER}, collapsed to one row per URL key.
 *
 * This is a convenience over {@link searchCaptures}, not a curated list. It
 * returns whatever the archive holds today; it does not encode a hand-written
 * roster of announcements, because such a roster would be a dataset we
 * authored and would go stale silently.
 */
export function searchAnnouncementCaptures(
  query: CdxQuery = {},
  fetchImpl: FetchLike = defaultFetch,
): Promise<CdxRecord[]> {
  return searchCaptures(
    {
      collapse: "urlkey",
      ...query,
      filters: [
        ANNOUNCEMENT_URLKEY_FILTER,
        HTML_MIMETYPE_FILTER,
        ...(query.filters ?? []),
      ],
    },
    fetchImpl,
  );
}

/* -------------------------------------------------------------------------- */
/* De-duplication                                                              */
/* -------------------------------------------------------------------------- */

/** How {@link dedupeCaptures} groups rows and which member of a group survives. */
export interface DedupeOptions {
  /**
   * The grouping key.
   *
   * - `"url"` (default) — the exact `original` URL. Conservative: it discards
   *   only literal repeat captures of the same address.
   * - `"url-without-query"` — everything before the first `?` or `#`. This is
   *   what collapses the observed tracking-parameter variants
   *   (`…-sept21/?fbclid=…`, `…-errata-bulletin/?s=09`) onto their article. It
   *   is a judgement, not a fact: it assumes fabtcg.com article query strings
   *   never select different content, which held for every announcement URL
   *   retrieved on 2026-08-10 but is not guaranteed by anything.
   * - A function — supply your own key.
   */
  readonly by?: "url" | "url-without-query" | ((record: CdxRecord) => string);
  /**
   * Which capture of a group to keep.
   *
   * Defaults to `"earliest"`: for an announcement, the first crawl is the one
   * closest to publication and least likely to reflect a later edit to the
   * page. Pass `"latest"` if you want the most complete rendering instead.
   */
  readonly keep?: "earliest" | "latest";
}

/** The part of a URL before any query string or fragment. */
export function urlWithoutQuery(url: string): string {
  const cut = Math.min(
    ...[url.indexOf("?"), url.indexOf("#")].map((index) =>
      index === -1 ? url.length : index,
    ),
  );
  return url.slice(0, cut);
}

/**
 * Collapse captures to one per key, preserving first-seen order.
 *
 * Wayback timestamps are fixed-width zero-padded, so lexicographic comparison
 * is chronological comparison and no date parsing is needed to order them.
 */
export function dedupeCaptures(
  records: readonly CdxRecord[],
  options: DedupeOptions = {},
): CdxRecord[] {
  const mode = options.by ?? "url";
  const keyOf =
    typeof mode === "function"
      ? mode
      : mode === "url-without-query"
        ? (record: CdxRecord) => urlWithoutQuery(record.original)
        : (record: CdxRecord) => record.original;
  const keepLatest = options.keep === "latest";

  const chosen = new Map<string, CdxRecord>();
  for (const record of records) {
    const key = keyOf(record);
    const existing = chosen.get(key);
    if (existing === undefined) {
      chosen.set(key, record);
      continue;
    }
    const replace = keepLatest
      ? record.timestamp > existing.timestamp
      : record.timestamp < existing.timestamp;
    if (replace) chosen.set(key, record);
  }

  return [...chosen.values()];
}

/* -------------------------------------------------------------------------- */
/* Capture URLs and timestamps                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Wayback replay modifier.
 *
 * `id_` is the one this module uses everywhere: it returns the **original
 * archived bytes**, with no rewritten links and no injected toolbar. Verified
 * by fetching a capture and finding zero occurrences of `archive.org` in the
 * response body.
 */
export type CaptureModifier =
  | "id_"
  | "if_"
  | "im_"
  | "js_"
  | "cs_"
  | "oe_"
  | "";

const TIMESTAMP_PATTERN = /^\d{14}$/;

const CAPTURE_URL_PATTERN =
  /^https?:\/\/web\.archive\.org\/web\/(\d{14})((?:id|if|im|js|cs|oe)_)?\/(.+)$/;

function assertTimestamp(timestamp: string): void {
  if (!TIMESTAMP_PATTERN.test(timestamp)) {
    throw new TypeError(
      `A Wayback capture timestamp is exactly 14 digits (YYYYMMDDhhmmss); received ${JSON.stringify(timestamp)}.`,
    );
  }
}

/** The minimum a capture needs to be addressable. {@link CdxRecord} satisfies it. */
export interface CaptureRef {
  readonly timestamp: string;
  readonly original: string;
}

/**
 * The replay URL for a capture. Defaults to `id_` — original bytes.
 *
 * @throws {TypeError} When the timestamp is not 14 digits.
 */
export function captureUrl(
  capture: CaptureRef,
  modifier: CaptureModifier = "id_",
): string {
  assertTimestamp(capture.timestamp);
  return `${WAYBACK_WEB_PREFIX}${capture.timestamp}${modifier}/${capture.original}`;
}

/**
 * The inverse of {@link captureUrl}. Returns `undefined` rather than throwing,
 * because its caller is reading a URL a *server* chose (a redirect target),
 * where "not the shape I expected" is information rather than a bug.
 */
export function parseCaptureUrl(
  url: string,
): { timestamp: string; modifier: string; original: string } | undefined {
  const match = CAPTURE_URL_PATTERN.exec(url);
  if (match === null) return undefined;
  const [, timestamp, modifier, original] = match;
  if (timestamp === undefined || original === undefined) return undefined;
  return { timestamp, modifier: modifier ?? "", original };
}

/**
 * `YYYYMMDDhhmmss` → `YYYY-MM-DD`.
 *
 * **This is the date the Internet Archive crawled the page.** It is not the
 * announcement's publication date and it is emphatically not the effective
 * date of any ban — see the note at the top of this file, where all three
 * differ by days in the same real article. Use it for provenance and for
 * ordering captures; never as a {@link IsoDate} on a timeline entry.
 *
 * Validated against the calendar via `isIsoDate`, so `20260231…` throws rather
 * than yielding a date that does not exist.
 *
 * @throws {TypeError} When the timestamp is malformed or names no real date.
 */
export function captureTimestampToIsoDate(timestamp: string): IsoDate {
  assertTimestamp(timestamp);
  const date = `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}`;
  if (!isIsoDate(date)) {
    throw new TypeError(
      `Wayback timestamp ${JSON.stringify(timestamp)} does not name a real calendar date.`,
    );
  }
  return date;
}

/**
 * `YYYYMMDDhhmmss` → `YYYY-MM-DDThh:mm:ssZ`. Wayback timestamps are UTC.
 *
 * Same caveat as {@link captureTimestampToIsoDate}: this is crawl time.
 *
 * @throws {TypeError} When the timestamp is malformed, names no real date, or
 * carries an impossible clock time.
 */
export function captureTimestampToIsoInstant(timestamp: string): string {
  const date = captureTimestampToIsoDate(timestamp);
  const hours = timestamp.slice(8, 10);
  const minutes = timestamp.slice(10, 12);
  const seconds = timestamp.slice(12, 14);
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) {
    throw new TypeError(
      `Wayback timestamp ${JSON.stringify(timestamp)} carries an impossible time of day.`,
    );
  }
  return `${date}T${hours}:${minutes}:${seconds}Z`;
}

/* -------------------------------------------------------------------------- */
/* Fetching a capture                                                          */
/* -------------------------------------------------------------------------- */

/** The result of retrieving one capture, with enough provenance to audit it. */
export interface FetchedCapture {
  /** The `id_` URL that was requested. */
  readonly requestedUrl: string;
  /** The timestamp that was asked for. */
  readonly requestedTimestamp: string;
  /** The `original` URL of the capture that was asked for. */
  readonly original: string;
  /** The final URL, when the runtime reports one. */
  readonly resolvedUrl?: string | undefined;
  /**
   * The timestamp actually served. Differs from `requestedTimestamp` when the
   * archive redirected to the nearest capture — verified real behaviour, not a
   * hypothetical. `undefined` when the runtime does not report a final URL.
   */
  readonly resolvedTimestamp?: string | undefined;
  /**
   * True only when the archive is *known* to have served a different capture.
   * A runtime that reports no final URL yields `false` here and `undefined`
   * for `resolvedTimestamp`; "we cannot tell" is readable in the pair, and is
   * never dressed up as "we were not redirected".
   */
  readonly redirected: boolean;
  /**
   * The timestamp to record as provenance: what was served if we know it,
   * otherwise what was requested.
   */
  readonly capturedAt: string;
  readonly status: number;
  /** The archived bytes, verbatim. No toolbar, no rewriting. */
  readonly html: string;
}

/**
 * Fetch one capture's original bytes.
 *
 * @param capture - Anything with a timestamp and an original URL; a
 * {@link CdxRecord} fits.
 * @param fetchImpl - Injected network; defaults to global `fetch`.
 * @throws {WaybackError} On any non-2xx response. A URL the archive has never
 * seen returns 404 — verified.
 */
export async function fetchCapture(
  capture: CaptureRef,
  fetchImpl: FetchLike = defaultFetch,
): Promise<FetchedCapture> {
  const requestedUrl = captureUrl(capture);
  const response = await fetchImpl(requestedUrl);
  if (!response.ok) {
    throw new WaybackError(
      `Capture fetch failed with HTTP ${String(response.status)}.`,
      requestedUrl,
      response.status,
    );
  }

  const html = await response.text();
  const resolvedUrl = response.url;
  const resolved =
    resolvedUrl === undefined ? undefined : parseCaptureUrl(resolvedUrl);
  const resolvedTimestamp = resolved?.timestamp;

  return {
    requestedUrl,
    requestedTimestamp: capture.timestamp,
    original: capture.original,
    resolvedUrl,
    resolvedTimestamp,
    redirected:
      resolvedTimestamp !== undefined &&
      resolvedTimestamp !== capture.timestamp,
    capturedAt: resolvedTimestamp ?? capture.timestamp,
    status: response.status,
    html,
  };
}

/* -------------------------------------------------------------------------- */
/* HTML → text                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Element bodies that are code or vector data rather than prose. Their
 * contents are text nodes, so tag-stripping alone would splice minified
 * JavaScript and CSS into the output — the `sept21` capture carries jQuery,
 * Bootstrap, three inline `<style>` blocks and an inline `<script>` slider.
 */
const OPAQUE_ELEMENT_PATTERN =
  /<(script|style|noscript|template|svg|iframe|canvas)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

/** Tags whose boundaries are line breaks in the rendered document. */
const BLOCK_TAG_PATTERN =
  /<\/?(p|div|li|ul|ol|dl|dt|dd|h1|h2|h3|h4|h5|h6|table|thead|tbody|tr|section|article|header|footer|nav|aside|blockquote|pre|figure|figcaption|form|main|address|hr|br)\b[^>]*>/gi;

const REMAINING_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>|<![^>]*>/g;

/**
 * Named character references decoded here.
 *
 * Deliberately a short table of the standard references rather than the full
 * HTML5 set: everything in it is unambiguous, and an unrecognised name is left
 * **verbatim** so a reviewer sees `&thorn;` and knows the decoder did not cover
 * it, rather than seeing a character the decoder guessed at. `&amp;` decodes
 * last so `&amp;lt;` yields the literal text `&lt;`.
 */
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  times: "×",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
};

function decodeNumericEntity(
  digits: string,
  radix: number,
): string | undefined {
  const code = Number.parseInt(digits, radix);
  if (!Number.isFinite(code)) return undefined;
  // Surrogate halves and out-of-range code points are not decodable; leaving
  // them verbatim is more honest than emitting U+FFFD.
  if (code < 0 || code > 0x10ffff) return undefined;
  if (code >= 0xd800 && code <= 0xdfff) return undefined;
  return String.fromCodePoint(code);
}

/**
 * Decode the character references this module handles. Unrecognised names are
 * returned unchanged — see {@link NAMED_ENTITIES}.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(
      /&#[xX]([0-9a-fA-F]+);/g,
      (match, hex: string) => decodeNumericEntity(hex, 16) ?? match,
    )
    .replace(
      /&#(\d+);/g,
      (match, digits: string) => decodeNumericEntity(digits, 10) ?? match,
    )
    .replace(
      /&([a-zA-Z][a-zA-Z0-9]*);/g,
      (match, name: string) => NAMED_ENTITIES[name] ?? match,
    )
    .replace(/&amp;/g, "&");
}

/**
 * Reduce an archived HTML document to readable text.
 *
 * The order is load-bearing. Opaque element bodies go first (so minified
 * JavaScript never reaches the output), tags become line breaks or vanish, and
 * character references are decoded **last** — decoding earlier would let
 * `&lt;script&gt;` in ordinary prose become a tag and disappear.
 *
 * What this is for: giving a human reviewer, and a future closed-vocabulary
 * matcher, the announcement's words. It is not a rendering engine and makes no
 * claim to reproduce visual layout. It invents nothing — no bullet characters,
 * no inferred headings, no inserted punctuation. Every character in the output
 * came from the input.
 */
export function htmlToText(html: string): string {
  const stripped = html
    .replace(COMMENT_PATTERN, "")
    .replace(OPAQUE_ELEMENT_PATTERN, "")
    .replace(BLOCK_TAG_PATTERN, "\n")
    .replace(REMAINING_TAG_PATTERN, "");

  const decoded = decodeHtmlEntities(stripped);

  return decoded
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/gu, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Retrieve a capture and reduce it to text in one step — the shape a
 * scheduled ingestion job wants.
 *
 * The returned object is a {@link FetchedCapture} plus `text`; the raw `html`
 * is retained deliberately, because a reviewer checking an extracted claim
 * must be able to read the source bytes rather than this module's reading of
 * them.
 */
export async function fetchCaptureText(
  capture: CaptureRef,
  fetchImpl: FetchLike = defaultFetch,
): Promise<FetchedCapture & { readonly text: string }> {
  const fetched = await fetchCapture(capture, fetchImpl);
  return { ...fetched, text: htmlToText(fetched.html) };
}
