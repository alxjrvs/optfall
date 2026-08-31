/**
 * Tests for the Wayback retrieval layer.
 *
 * **Nothing here touches the network.** `globalThis.fetch` is replaced with a
 * thrower for the duration of the file, so a function that silently forgot its
 * injected `FetchLike` and fell through to the global fails loudly instead of
 * quietly making a real request. Every fixture below is verbatim bytes
 * retrieved on 2026-08-10 and pasted in, not a shape invented to match the
 * implementation.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import {
  ANNOUNCEMENT_URLKEY_FILTER,
  buildCdxUrl,
  captureTimestampToIsoDate,
  captureTimestampToIsoInstant,
  captureUrl,
  dedupeCaptures,
  decodeHtmlEntities,
  fetchCapture,
  fetchCaptureText,
  htmlToText,
  HTML_MIMETYPE_FILTER,
  parseCaptureUrl,
  parseCdxResponse,
  searchAnnouncementCaptures,
  searchCaptures,
  urlWithoutQuery,
  WaybackError,
  type CaptureResponse,
  type CdxRecord,
  type FetchLike,
} from "./wayback";

/* -------------------------------------------------------------------------- */
/* No network, enforced                                                        */
/* -------------------------------------------------------------------------- */

const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = ((input: unknown) => {
    throw new Error(
      `A test reached the network: ${String(input)}. Every network call in this module takes an injected FetchLike; one of them fell through to the global.`,
    );
  }) as unknown as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

/* -------------------------------------------------------------------------- */
/* Fixtures — verbatim bytes, retrieved 2026-08-10                             */
/* -------------------------------------------------------------------------- */

/**
 * Verbatim body of
 * `https://web.archive.org/cdx/search/cdx?url=fabtcg.com/articles/banned-and-restricted-announcement-sept21/&matchType=prefix&output=json&filter=statuscode:200`,
 * truncated to the first six rows. It carries both shapes that matter: three
 * separate captures of one identical URL, and two tracking-parameter variants
 * of that same article.
 */
const CDX_SEPT21 = `[["urlkey","timestamp","original","mimetype","statuscode","digest","length"],
["com,fabtcg)/articles/banned-and-restricted-announcement-sept21","20210921012416","https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/","text/html","200","QFRUWS7UFLRXWP3ZMGA4PT6E6ZM5ND2Q","7438"],
["com,fabtcg)/articles/banned-and-restricted-announcement-sept21","20211024022304","https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/","text/html","200","XQ4GITLCN6KVS5SXXEVZTHCXOSHEXPOO","8916"],
["com,fabtcg)/articles/banned-and-restricted-announcement-sept21","20220819012851","https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/","text/html","200","2J35GJZANBSTZBOXAD2QGMMGGWX2C2OS","8942"],
["com,fabtcg)/articles/banned-and-restricted-announcement-sept21?fbclid=iwar0fwoyjujahuecnjsvdgsxy3i2hj_3zspwjliwlgie-yhrp7kacrj1rv5y","20221208064522","https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/?fbclid=IwAR0FWoYJuJaHUEcnjSVDGsxy3I2HJ_3zSpwJLIwlGiE-yhRp7KACRJ1Rv5Y","text/html","200","VD2CIMLUXYBY45R5SJHWPNNLLGWV42WN","9011"],
["com,fabtcg)/articles/banned-and-restricted-announcement-sept21?fbclid=iwar27azmzk4nvnuqw0w8iws9zwyfdkhik4frd4mqwkflmakdut_lrh5ot_vw","20210921195021","https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/?fbclid=IwAR27aZmzK4NvnUqw0w8iwS9ZWyfDKhiK4FrD4MQWkFlmaKdut_lRh5ot_vw","text/html","200","HSHSUWJF5U6RGG7P35NGGFIN2N3VUMYJ","7494"]]`;

/**
 * Verbatim body of the same endpoint with `fl=original,timestamp,digest`.
 *
 * The point of keeping this one is the header row: CDX returns the columns in
 * the order asked for, so `original` arrives at index 0 and `timestamp` at
 * index 1 — the reverse of the default. A parser reading by position rather
 * than by header name would swap them silently.
 */
const CDX_NARROWED = `[["original","timestamp","digest"],
["https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/","20210921012416","QFRUWS7UFLRXWP3ZMGA4PT6E6ZM5ND2Q"],
["https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/","20211024022304","XQ4GITLCN6KVS5SXXEVZTHCXOSHEXPOO"],
["https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/","20220819012851","2J35GJZANBSTZBOXAD2QGMMGGWX2C2OS"]]`;

/** Verbatim body returned by a CDX query that matches nothing. */
const CDX_EMPTY = "[]";

/**
 * Excerpt of
 * `https://web.archive.org/web/20210921012416id_/https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/`
 * (HTTP 200, 33,561 bytes, no Wayback toolbar).
 *
 * Every line is a verbatim slice of that capture; the assembly into a shorter
 * document is ours, so that the fixture stays reviewable. It deliberately
 * keeps one of each hazard the stripper has to survive: a CDN `<script>` with
 * a body, an inline `<style>` block, an inline `<script>` with jQuery in it,
 * an inline `<svg>` whose `<path d="…">` would otherwise leak coordinates, a
 * `&nbsp;`, a `&#x27;`, and the announcement's own `<ul><li>` payload.
 */
const CAPTURE_SEPT21 = `
<!DOCTYPE html>
<html lang="en-us">
    <head>
        <title>Banned and Restricted Announcement</title>
        <meta name="description" content="Changes to the banned and restricted list" />
            <script crossorigin="anonymous" integrity="sha384-tsQFqpEReu7ZLhBV2VZlAu7zcOV+rXbYlF2cqB8txI/8aZajjp4Bqd+V6D5IgvKT" src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
        <style>
    .alert {
        border-radius: 0px;
    }

</style>
    </head>
    <body>
                <a class="fab-btn mr-1" href="/accounts/login/">Login</a> &nbsp;
        <h1 class="px-3 px-lg-5 text-center">Banned and Restricted Announcement</h1>
        <span class="diamond mx-2 d-flex align-items-center justify-content-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8.85 11.34" width=5><g id="Layer_2" data-name="Layer 2"><g id="Layer_2-2" data-name="Layer 2"><path class="cls-1" d="M4.41,0,0,5.67l4.41,5.67L8.85,5.67Z"/></g></g></svg></span>
    <div class="row mw-100 p-0 m-0 d-flex justify-content-center flex-row">
        21st Sep 2021
        James White
    </div>
        <div class="container page-content py-3 px-0">
                <div class="block-paragraphs"><div class="rich-text"><p>We believe that removing Seeds of Agony from the Classic Constructed format will be positive for the tournament experience while not eliminating Chane&#x27;s viability as a player in the metagame.</p><p></p><p><b>Classic Constructed:</b></p><ul><li>Seeds of Agony is banned (Effective September 24, 2021)</li></ul><p><b>Blitz:</b></p><ul><li>Seeds of Agony is banned (Effective September 24, 2021)</li></ul></div></div>
        </div>
<script type="text/javascript">
    $(document).ready(function(){

        $slider2 = $("#pagesListblock2");
    });
</script>
    </body>
</html>
`;

const SEPT21_CAPTURE_URL =
  "https://web.archive.org/web/20210921012416id_/https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/";

/* -------------------------------------------------------------------------- */
/* Stub network                                                                */
/* -------------------------------------------------------------------------- */

interface StubOptions {
  readonly status?: number;
  readonly url?: string | undefined;
}

function stubResponse(
  body: string,
  options: StubOptions = {},
): CaptureResponse {
  const status = options.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    url: options.url,
    text: () => Promise.resolve(body),
  };
}

/** A `FetchLike` that records the URLs it was asked for. */
function recordingFetch(
  body: string,
  options: StubOptions = {},
): FetchLike & { readonly calls: string[] } {
  const calls: string[] = [];
  const impl = (url: string) => {
    calls.push(url);
    return Promise.resolve(stubResponse(body, options));
  };
  return Object.assign(impl, { calls });
}

/* -------------------------------------------------------------------------- */
/* buildCdxUrl                                                                 */
/* -------------------------------------------------------------------------- */

describe("buildCdxUrl", () => {
  test("defaults to every HTTP 200 capture under fabtcg.com, as JSON", () => {
    const params = new URL(buildCdxUrl()).searchParams;
    expect(params.get("url")).toBe("fabtcg.com");
    expect(params.get("matchType")).toBe("domain");
    expect(params.get("output")).toBe("json");
    expect(params.getAll("filter")).toEqual(["statuscode:200"]);
  });

  test("the HTTP 200 filter comes first, and extra filters are appended in order", () => {
    const params = new URL(
      buildCdxUrl({
        filters: [ANNOUNCEMENT_URLKEY_FILTER, HTML_MIMETYPE_FILTER],
      }),
    ).searchParams;
    expect(params.getAll("filter")).toEqual([
      "statuscode:200",
      "urlkey:.*banned.*",
      "mimetype:text/html",
    ]);
  });

  test("statusCode: null asks for failed captures too", () => {
    const params = new URL(buildCdxUrl({ statusCode: null })).searchParams;
    expect(params.getAll("filter")).toEqual([]);
  });

  test("carries collapse, from, to, limit and fl through", () => {
    const params = new URL(
      buildCdxUrl({
        collapse: "urlkey",
        from: "2021",
        to: "2026",
        limit: 40,
        fields: ["original", "timestamp", "digest"],
      }),
    ).searchParams;
    expect(params.get("collapse")).toBe("urlkey");
    expect(params.get("from")).toBe("2021");
    expect(params.get("to")).toBe("2026");
    expect(params.get("limit")).toBe("40");
    expect(params.get("fl")).toBe("original,timestamp,digest");
  });

  test("rejects a non-integer limit rather than sending it", () => {
    expect(() => buildCdxUrl({ limit: 2.5 })).toThrow(TypeError);
  });
});

/* -------------------------------------------------------------------------- */
/* parseCdxResponse                                                            */
/* -------------------------------------------------------------------------- */

describe("parseCdxResponse", () => {
  test("reads the real sept21 response, dropping the header row", () => {
    const records = parseCdxResponse(CDX_SEPT21);
    expect(records).toHaveLength(5);

    const first = records[0];
    expect(first?.timestamp).toBe("20210921012416");
    expect(first?.original).toBe(
      "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
    );
    expect(first?.mimetype).toBe("text/html");
    expect(first?.statuscode).toBe("200");
    expect(first?.digest).toBe("QFRUWS7UFLRXWP3ZMGA4PT6E6ZM5ND2Q");
    expect(first?.length).toBe("7438");
    expect(first?.urlkey).toBe(
      "com,fabtcg)/articles/banned-and-restricted-announcement-sept21",
    );
  });

  test("maps by header name, so a narrowed fl cannot shift the columns", () => {
    // The real `fl=original,timestamp,digest` response puts `original` at
    // index 0 — the reverse of the default column order. Reading by position
    // would return the URL as the timestamp.
    const records = parseCdxResponse(CDX_NARROWED);
    expect(records).toHaveLength(3);
    expect(records[0]?.timestamp).toBe("20210921012416");
    expect(records[0]?.original).toBe(
      "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
    );
    expect(records[0]?.mimetype).toBeUndefined();
    expect(records[0]?.fields["digest"]).toBe(
      "QFRUWS7UFLRXWP3ZMGA4PT6E6ZM5ND2Q",
    );
  });

  test("a query that matches nothing parses to no records, not an error", () => {
    expect(parseCdxResponse(CDX_EMPTY)).toEqual([]);
  });

  test("throws on a body that is not JSON", () => {
    expect(() =>
      parseCdxResponse("<html>429 Too Many Requests</html>"),
    ).toThrow(WaybackError);
  });

  test("throws when the header names no timestamp or original", () => {
    expect(() => parseCdxResponse('[["urlkey","digest"],["a","b"]]')).toThrow(
      WaybackError,
    );
  });

  test("throws on a row that is not an array of strings", () => {
    expect(() =>
      parseCdxResponse('[["timestamp","original"],[20210921012416,"u"]]'),
    ).toThrow(WaybackError);
  });
});

/* -------------------------------------------------------------------------- */
/* searchCaptures                                                              */
/* -------------------------------------------------------------------------- */

describe("searchCaptures", () => {
  test("requests the URL buildCdxUrl produced and parses the response", async () => {
    const fetchImpl = recordingFetch(CDX_SEPT21);
    const records = await searchCaptures(
      { url: "fabtcg.com", matchType: "domain" },
      fetchImpl,
    );
    expect(fetchImpl.calls).toEqual([
      buildCdxUrl({ url: "fabtcg.com", matchType: "domain" }),
    ]);
    expect(records).toHaveLength(5);
  });

  test("a non-2xx response throws with the status and the URL attached", async () => {
    const fetchImpl = recordingFetch("", { status: 503 });
    const error = (await searchCaptures({}, fetchImpl).catch(
      (cause: unknown) => cause,
    )) as WaybackError;
    expect(error).toBeInstanceOf(WaybackError);
    expect(error.status).toBe(503);
    expect(error.url).toBe(buildCdxUrl({}));
  });
});

describe("searchAnnouncementCaptures", () => {
  test("applies the verified announcement filters and collapses by url key", async () => {
    const fetchImpl = recordingFetch(CDX_SEPT21);
    await searchAnnouncementCaptures({}, fetchImpl);

    const requested = fetchImpl.calls[0];
    expect(requested).toBeDefined();
    const params = new URL(requested ?? "").searchParams;
    expect(params.getAll("filter")).toEqual([
      "statuscode:200",
      "urlkey:.*banned.*",
      "mimetype:text/html",
    ]);
    expect(params.get("collapse")).toBe("urlkey");
  });

  test("caller filters are added, never substituted for the announcement ones", async () => {
    const fetchImpl = recordingFetch(CDX_SEPT21);
    await searchAnnouncementCaptures(
      { filters: ["urlkey:.*sept21.*"] },
      fetchImpl,
    );
    const params = new URL(fetchImpl.calls[0] ?? "").searchParams;
    expect(params.getAll("filter")).toEqual([
      "statuscode:200",
      "urlkey:.*banned.*",
      "mimetype:text/html",
      "urlkey:.*sept21.*",
    ]);
  });
});

/* -------------------------------------------------------------------------- */
/* De-duplication                                                              */
/* -------------------------------------------------------------------------- */

describe("dedupeCaptures", () => {
  const records = parseCdxResponse(CDX_SEPT21);

  test("the fixture really does contain the duplicates this is for", () => {
    expect(records).toHaveLength(5);
    expect(new Set(records.map((record) => record.original)).size).toBe(3);
  });

  test("by url: three distinct addresses survive", () => {
    expect(dedupeCaptures(records)).toHaveLength(3);
  });

  test("by url: keeps the earliest capture of each address by default", () => {
    const [first] = dedupeCaptures(records);
    expect(first?.timestamp).toBe("20210921012416");
  });

  test("by url: keep 'latest' takes the most recent instead", () => {
    const [first] = dedupeCaptures(records, { keep: "latest" });
    expect(first?.timestamp).toBe("20220819012851");
  });

  test("by url-without-query: the fbclid variants collapse onto the article", () => {
    const deduped = dedupeCaptures(records, { by: "url-without-query" });
    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.original).toBe(
      "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
    );
    expect(deduped[0]?.timestamp).toBe("20210921012416");
  });

  test("a custom key function is honoured", () => {
    const deduped = dedupeCaptures(records, {
      by: (record) => record.digest ?? "",
    });
    expect(deduped).toHaveLength(5);
  });

  test("first-seen order is preserved, so output is deterministic", () => {
    const shuffled: CdxRecord[] = [records[2], records[0], records[4]].filter(
      (record): record is CdxRecord => record !== undefined,
    );
    expect(dedupeCaptures(shuffled, { by: "url-without-query" })).toHaveLength(
      1,
    );
    expect(dedupeCaptures(shuffled).map((record) => record.original)).toEqual([
      "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
      "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/?fbclid=IwAR27aZmzK4NvnUqw0w8iwS9ZWyfDKhiK4FrD4MQWkFlmaKdut_lRh5ot_vw",
    ]);
  });

  test("an empty input is an empty output", () => {
    expect(dedupeCaptures([])).toEqual([]);
  });
});

describe("urlWithoutQuery", () => {
  test("cuts at the first ? or #", () => {
    expect(urlWithoutQuery("https://fabtcg.com/articles/x/?fbclid=abc")).toBe(
      "https://fabtcg.com/articles/x/",
    );
    expect(urlWithoutQuery("https://fabtcg.com/articles/x/#top")).toBe(
      "https://fabtcg.com/articles/x/",
    );
    expect(urlWithoutQuery("https://fabtcg.com/articles/x/?a#b")).toBe(
      "https://fabtcg.com/articles/x/",
    );
    expect(urlWithoutQuery("https://fabtcg.com/articles/x/")).toBe(
      "https://fabtcg.com/articles/x/",
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Capture URLs                                                                */
/* -------------------------------------------------------------------------- */

describe("captureUrl", () => {
  const capture = {
    timestamp: "20210921012416",
    original:
      "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
  };

  test("builds the id_ form, which is what suppresses the Wayback toolbar", () => {
    expect(captureUrl(capture)).toBe(SEPT21_CAPTURE_URL);
  });

  test("other replay modifiers are available but never the default", () => {
    expect(captureUrl(capture, "")).toBe(
      "https://web.archive.org/web/20210921012416/https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
    );
  });

  test("rejects a timestamp that is not 14 digits", () => {
    expect(() => captureUrl({ ...capture, timestamp: "20210921" })).toThrow(
      TypeError,
    );
    expect(() =>
      captureUrl({ ...capture, timestamp: "2021-09-21T01:24:16Z" }),
    ).toThrow(TypeError);
  });
});

describe("parseCaptureUrl", () => {
  test("round-trips the URL captureUrl produces", () => {
    expect(parseCaptureUrl(SEPT21_CAPTURE_URL)).toEqual({
      timestamp: "20210921012416",
      modifier: "id_",
      original:
        "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
    });
  });

  test("reads a toolbar-form replay URL too", () => {
    expect(
      parseCaptureUrl(
        "https://web.archive.org/web/20210921012416/https://fabtcg.com/articles/x/",
      ),
    ).toEqual({
      timestamp: "20210921012416",
      modifier: "",
      original: "https://fabtcg.com/articles/x/",
    });
  });

  test("returns undefined for anything else, rather than throwing", () => {
    expect(parseCaptureUrl("https://fabtcg.com/articles/x/")).toBeUndefined();
    expect(parseCaptureUrl("")).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/* Timestamps                                                                  */
/* -------------------------------------------------------------------------- */

describe("captureTimestampToIsoDate", () => {
  test("normalises a real capture timestamp", () => {
    expect(captureTimestampToIsoDate("20210921012416")).toBe("2021-09-21");
    expect(captureTimestampToIsoDate("20251006092723")).toBe("2025-10-06");
  });

  test("rejects a timestamp naming a date that does not exist", () => {
    expect(() => captureTimestampToIsoDate("20260231000000")).toThrow(
      TypeError,
    );
    expect(() => captureTimestampToIsoDate("20261301000000")).toThrow(
      TypeError,
    );
  });

  test("rejects anything that is not 14 digits", () => {
    expect(() => captureTimestampToIsoDate("2021092101241")).toThrow(TypeError);
    expect(() => captureTimestampToIsoDate("202109210124160")).toThrow(
      TypeError,
    );
    expect(() => captureTimestampToIsoDate("")).toThrow(TypeError);
  });

  test("is crawl time, and therefore not the announcement's effective date", () => {
    // The capture at 20210921012416 is the article announcing that Seeds of
    // Agony is banned "Effective September 24, 2021". Three days apart. This
    // test exists to make the distinction fail loudly if anyone ever tries to
    // make this function return the effective date.
    expect(captureTimestampToIsoDate("20210921012416")).not.toBe("2021-09-24");
  });
});

describe("captureTimestampToIsoInstant", () => {
  test("normalises to a UTC instant", () => {
    expect(captureTimestampToIsoInstant("20210921012416")).toBe(
      "2021-09-21T01:24:16Z",
    );
  });

  test("rejects an impossible time of day", () => {
    expect(() => captureTimestampToIsoInstant("20210921256000")).toThrow(
      TypeError,
    );
    expect(() => captureTimestampToIsoInstant("20210921017700")).toThrow(
      TypeError,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* fetchCapture                                                                */
/* -------------------------------------------------------------------------- */

describe("fetchCapture", () => {
  const capture = {
    timestamp: "20210921012416",
    original:
      "https://fabtcg.com/articles/banned-and-restricted-announcement-sept21/",
  };

  test("requests the id_ URL and returns the bytes verbatim", async () => {
    const fetchImpl = recordingFetch(CAPTURE_SEPT21, {
      url: SEPT21_CAPTURE_URL,
    });
    const fetched = await fetchCapture(capture, fetchImpl);

    expect(fetchImpl.calls).toEqual([SEPT21_CAPTURE_URL]);
    expect(fetched.html).toBe(CAPTURE_SEPT21);
    expect(fetched.status).toBe(200);
    expect(fetched.redirected).toBe(false);
    expect(fetched.resolvedTimestamp).toBe("20210921012416");
    expect(fetched.capturedAt).toBe("20210921012416");
  });

  test("reports the timestamp actually served when the archive redirects", async () => {
    // Verified real behaviour: requesting 19990101000000 for this article
    // 302s to 20210921012416, keeping the id_ modifier. The bytes are from a
    // different capture than the one asked for, and provenance must say so.
    const fetchImpl = recordingFetch(CAPTURE_SEPT21, {
      url: SEPT21_CAPTURE_URL,
    });
    const fetched = await fetchCapture(
      { ...capture, timestamp: "19990101000000" },
      fetchImpl,
    );

    expect(fetched.requestedTimestamp).toBe("19990101000000");
    expect(fetched.resolvedTimestamp).toBe("20210921012416");
    expect(fetched.redirected).toBe(true);
    expect(fetched.capturedAt).toBe("20210921012416");
    expect(captureTimestampToIsoDate(fetched.capturedAt)).toBe("2021-09-21");
  });

  test("a runtime that reports no final URL yields 'unknown', never 'not redirected'", async () => {
    const fetchImpl = recordingFetch(CAPTURE_SEPT21);
    const fetched = await fetchCapture(capture, fetchImpl);

    expect(fetched.resolvedUrl).toBeUndefined();
    expect(fetched.resolvedTimestamp).toBeUndefined();
    expect(fetched.redirected).toBe(false);
    expect(fetched.capturedAt).toBe("20210921012416");
  });

  test("a 404 — a URL the archive has never seen — throws with the status", async () => {
    const fetchImpl = recordingFetch("", { status: 404 });
    const error = (await fetchCapture(capture, fetchImpl).catch(
      (cause: unknown) => cause,
    )) as WaybackError;
    expect(error).toBeInstanceOf(WaybackError);
    expect(error.status).toBe(404);
    expect(error.url).toBe(SEPT21_CAPTURE_URL);
  });
});

/* -------------------------------------------------------------------------- */
/* HTML → text                                                                 */
/* -------------------------------------------------------------------------- */

describe("htmlToText", () => {
  const text = htmlToText(CAPTURE_SEPT21);

  test("keeps the announcement's own words, verbatim", () => {
    expect(text).toContain(
      "Seeds of Agony is banned (Effective September 24, 2021)",
    );
    expect(text).toContain(
      "We believe that removing Seeds of Agony from the Classic Constructed format",
    );
    expect(text).toContain("21st Sep 2021");
    expect(text).toContain("James White");
    expect(text).toContain("Banned and Restricted Announcement");
  });

  test("drops stylesheet bodies", () => {
    expect(text).not.toContain("border-radius");
    expect(text).not.toContain(".alert");
  });

  test("drops script bodies, inline and external", () => {
    expect(text).not.toContain("$(document)");
    expect(text).not.toContain("pagesListblock2");
    expect(text).not.toContain("jquery");
  });

  test("drops inline SVG, so path coordinates never look like prose", () => {
    expect(text).not.toContain("M4.41");
    expect(text).not.toContain("Layer_2");
  });

  test("leaves no markup behind", () => {
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    expect(text).not.toContain("DOCTYPE");
    expect(text).not.toContain("class=");
  });

  test("decodes the character references the page actually uses", () => {
    expect(text).toContain("Chane's viability");
    expect(text).not.toContain("&#x27;");
    expect(text).not.toContain("&nbsp;");
  });

  test("puts block boundaries on their own lines", () => {
    const lines = text.split("\n");
    expect(lines).toContain("Classic Constructed:");
    expect(lines).toContain("Blitz:");
    expect(lines).toContain(
      "Seeds of Agony is banned (Effective September 24, 2021)",
    );
  });

  test("never runs more than one blank line together", () => {
    expect(text).not.toContain("\n\n\n");
    expect(text.startsWith("\n")).toBe(false);
    expect(text.endsWith("\n")).toBe(false);
  });

  test("invents nothing: no bullet or list markers are added", () => {
    expect(text).not.toContain("•");
    expect(text).not.toContain("- Seeds of Agony");
    expect(text).not.toContain("* Seeds of Agony");
  });

  test("an empty document is empty text", () => {
    expect(htmlToText("")).toBe("");
    expect(htmlToText("<html><body></body></html>")).toBe("");
  });

  test("markup written as text in the prose survives as text", () => {
    expect(htmlToText("<p>use &lt;b&gt; for bold</p>")).toBe(
      "use <b> for bold",
    );
  });
});

describe("decodeHtmlEntities", () => {
  test("decodes the numeric forms", () => {
    expect(decodeHtmlEntities("Chane&#x27;s")).toBe("Chane's");
    expect(decodeHtmlEntities("&#8212;")).toBe("—");
    expect(decodeHtmlEntities("&#x2014;")).toBe("—");
  });

  test("decodes the named references it covers", () => {
    expect(decodeHtmlEntities("&quot;villain&quot;")).toBe('"villain"');
    expect(decodeHtmlEntities("by&nbsp;hand")).toBe("by hand");
    expect(decodeHtmlEntities("&lt;p&gt;")).toBe("<p>");
  });

  test("leaves an unrecognised name verbatim rather than guessing at it", () => {
    expect(decodeHtmlEntities("&thorn;")).toBe("&thorn;");
    expect(decodeHtmlEntities("&notarealentity;")).toBe("&notarealentity;");
  });

  test("leaves undecodable code points verbatim rather than emitting U+FFFD", () => {
    expect(decodeHtmlEntities("&#xD800;")).toBe("&#xD800;");
    expect(decodeHtmlEntities("&#x110000;")).toBe("&#x110000;");
  });

  test("decodes &amp; last, so &amp;lt; yields the literal text &lt;", () => {
    expect(decodeHtmlEntities("&amp;lt;")).toBe("&lt;");
    expect(decodeHtmlEntities("Kayo &amp; Rhinar")).toBe("Kayo & Rhinar");
  });
});

/* -------------------------------------------------------------------------- */
/* End to end, over fixtures only                                              */
/* -------------------------------------------------------------------------- */

describe("the retrieval pipeline, end to end", () => {
  test("search, dedupe, fetch, text — with the network injected throughout", async () => {
    const cdx = recordingFetch(CDX_SEPT21);
    const records = await searchAnnouncementCaptures({}, cdx);
    const [announcement] = dedupeCaptures(records, { by: "url-without-query" });
    expect(announcement).toBeDefined();
    if (announcement === undefined) return;

    const capture = recordingFetch(CAPTURE_SEPT21, { url: SEPT21_CAPTURE_URL });
    const fetched = await fetchCaptureText(announcement, capture);

    expect(capture.calls).toEqual([SEPT21_CAPTURE_URL]);
    expect(captureTimestampToIsoDate(fetched.capturedAt)).toBe("2021-09-21");
    expect(fetched.text).toContain(
      "Seeds of Agony is banned (Effective September 24, 2021)",
    );
    // The raw bytes are retained alongside the text, because a reviewer
    // checking an extracted claim must be able to read the source.
    expect(fetched.html).toBe(CAPTURE_SEPT21);
  });

  test("this module stops at retrieval: nothing here names a card or a ban", () => {
    // Extraction is closed-vocabulary matching against the card dataset, with
    // human review before publication (docs/PHASE-2-REPORT.md). It is not
    // implemented, and its absence is the design rather than a gap.
    const exported = Object.keys({
      buildCdxUrl,
      parseCdxResponse,
      searchCaptures,
      searchAnnouncementCaptures,
      dedupeCaptures,
      captureUrl,
      parseCaptureUrl,
      captureTimestampToIsoDate,
      captureTimestampToIsoInstant,
      fetchCapture,
      fetchCaptureText,
      htmlToText,
      decodeHtmlEntities,
      urlWithoutQuery,
    });
    expect(exported.some((name) => /ban|card|format|extract/i.test(name))).toBe(
      false,
    );
  });
});
