/**
 * Serves Flesh and Blood card faces from the `optfall-card-faces` R2 bucket.
 *
 * URL shape:  https://images.optfall.com/<tier>/<key>.webp
 *   e.g.      https://images.optfall.com/normal/MST131.webp
 *   → object key: normal/MST131.webp
 *
 * Plus one static route, served from this module rather than from a file so
 * that a miss and a deliberate request return the same bytes:
 *
 *             https://images.optfall.com/placeholder/portrait.svg
 *             https://images.optfall.com/placeholder/landscape.svg
 *
 * THE BYTES LIVE ONLY IN R2, NEVER IN GIT. 11,377 distinct faces at roughly
 * 695 KB apiece is ~7.7 GB of source; even transcoded to two WebP tiers it is
 * hundreds of megabytes of binary that git would carry forever.
 * `docs/SCRYFALL-GAP.md` §5.1. Only the serving code is here; the bytes are put
 * there out-of-band by `scripts/ingest-card-images.ts`.
 *
 * WHY THIS IS A SEPARATE WORKER FROM THE MAIN SITE. `apps/site` is served
 * entirely from static assets with no Worker script at all, and that is what
 * "no uptime story to fail" in `docs/PLAN.md` rests on. Serving images needs
 * code. Confining that code to its own Worker keeps the runtime inside the one
 * layer the plan already calls expendable: losing images costs a rendering
 * layer, never the product. If this host is down, every card page still renders
 * and every fact on it is still correct.
 *
 * A MISS RETURNS THE PLACEHOLDER WITH 200, NOT A 404, and that is the one
 * genuinely unusual decision here. Rationale in `./placeholder.ts`; the cache
 * consequence is below.
 */
import {
  PLACEHOLDER_CONTENT_TYPE,
  placeholderSvg,
  TIERS,
  type Orientation,
  type Tier,
} from "./placeholder";

/** The bucket the ingest writes to. Named once, here and in the ingest tool. */
export const BUCKET_NAME = "optfall-card-faces";

/**
 * The only extension this host serves for a face.
 *
 * Deliberately not a map of many types, unlike the Salvage Union asset host
 * this is modelled on: the ingest normalises everything to WebP, so a request
 * for `.png` is a caller working from a stale assumption rather than a caller
 * who wants a PNG. Answering it with a placeholder would hide that; refusing it
 * makes the mistake visible at the first request.
 */
const FACE_EXTENSION = ".webp";

/** How long a real face is good for. It never changes in place — see below. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * How long a placeholder is good for, and why it is emphatically not the above.
 *
 * A placeholder means "no face at this key *yet*". The ingest runs on a
 * schedule and upstream adds art; if a miss were cached for a year, a card
 * whose face landed the following week would keep showing NO IMAGE in every
 * cache that saw it first, and the only fix would be a purge nobody will
 * remember to run. Five minutes is long enough to absorb a crawl and short
 * enough that the tool corrects itself.
 */
const PROVISIONAL = "public, max-age=300";

/**
 * The slice of the face store this Worker uses.
 *
 * Declared structurally so the tests can inject a fake without a live R2
 * binding, and chosen over `mock.module()` because that is process-global and
 * this is one of several test files in the run.
 *
 * IT IS NARROWER THAN R2 ON PURPOSE. A key in, a stream or nothing out, is the
 * entire storage contract this host needs; `index.ts` adapts the binding down to
 * it in three lines. Everything below is therefore testable without a bucket,
 * and stays that way regardless of what the storage layer grows.
 */
export type FaceStore = {
  get(key: string): Promise<ReadableStream | null>;
};

/** How a failure is reported. Injected so the tests can assert on it. */
export type FaceFailureReporter = (
  error: unknown,
  context?: Record<string, unknown>,
) => void;

function placeholderResponse(orientation: Orientation, status = 200): Response {
  return new Response(placeholderSvg(orientation), {
    status,
    headers: {
      "content-type": PLACEHOLDER_CONTENT_TYPE,
      "cache-control": PROVISIONAL,
      "access-control-allow-origin": "*",
      // Names the reason in a header rather than only in the pixels, so a
      // caller debugging a grid of grey rectangles can tell "no art published"
      // from "the store did not answer" without reading the image.
      "x-optfall-face": status === 200 ? "placeholder" : "placeholder-degraded",
    },
  });
}

/**
 * Split `/normal/MST131.webp` into its tier and object key, or reject it.
 *
 * The guard is the security boundary for a public host that answers every path
 * on its domain: the tier must be one we publish, the remainder must carry no
 * traversal, no leading dot and no slash of its own. A key that fails any of
 * these is not a face request at all.
 */
export function parseFacePath(
  pathname: string,
): { tier: Tier; key: string } | null {
  let raw: string;
  try {
    raw = decodeURIComponent(pathname.replace(/^\/+/, ""));
  } catch {
    // `decodeURIComponent` throws `URIError` on malformed percent-encoding —
    // `/normal/%zz.webp` is enough. Uncaught, it escapes this function and the
    // platform answers 500 where the guard below is written to answer 404. This
    // function serves every path on a public, crawler-visible host, so the
    // first scanner probing bad escapes would turn the error log into noise and
    // the guard into a crash.
    return null;
  }
  const slash = raw.indexOf("/");
  if (slash <= 0) return null;

  const tier = raw.slice(0, slash);
  const name = raw.slice(slash + 1);

  if (!Object.hasOwn(TIERS, tier)) return null;
  if (!name.endsWith(FACE_EXTENSION)) return null;
  if (name.includes("/") || name.includes("..") || name.startsWith(".")) {
    return null;
  }
  // A basename is upstream's own file name — `MST131`, `LGS282-RF`. Anything
  // outside this alphabet did not come from the ingest.
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return null;

  return { tier: tier as Tier, key: `${tier}/${name}` };
}

/** `/placeholder/portrait.svg` → `"portrait"`. */
export function parsePlaceholderPath(pathname: string): Orientation | null {
  const raw = pathname.replace(/^\/+/, "");
  if (raw === "placeholder/portrait.svg") return "portrait";
  if (raw === "placeholder/landscape.svg") return "landscape";
  return null;
}

/**
 * Handler factory. The store getter is invoked per request rather than at
 * module scope, because the R2 binding lives on `env`, which a Worker only has
 * inside `fetch`. Module scope on Workers forbids async I/O anyway.
 *
 * ON REPORTING: a miss is not an error. This function answers every path on a
 * public, crawler-visible host, so unknown paths and un-ingested keys are
 * ordinary traffic and alerting on them would turn the error log into a scanner
 * log. What IS reported is the store failing to answer at all — the failure
 * that silently turns every card on the site into a grey rectangle.
 */
export const makeFaceHandler =
  (openStore: () => FaceStore, report: FaceFailureReporter = () => {}) =>
  async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url);

    const orientation = parsePlaceholderPath(pathname);
    if (orientation) return placeholderResponse(orientation);

    const parsed = parseFacePath(pathname);
    if (!parsed) {
      return new Response("Not found", {
        status: 404,
        headers: { "cache-control": PROVISIONAL },
      });
    }

    // Opening the store and reading from it are one failure domain: the
    // adapter throws when the R2 binding is missing, and `get` rejects on an
    // outage. Either way faces stop serving for everyone at once — so it
    // degrades to the placeholder rather than to a broken-image glyph, and says
    // so in the status code so a monitor can tell the difference.
    let stream: ReadableStream | null;
    try {
      stream = await openStore().get(parsed.key);
    } catch (error) {
      report(error, { fn: "face", op: "r2.get", key: parsed.key });
      return placeholderResponse("portrait", 503);
    }

    if (!stream) return placeholderResponse("portrait");

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "image/webp",
        // Immutable is honest here: a face is addressed by upstream's own file
        // name, and new art arrives under a new name rather than replacing the
        // bytes at an existing one. Nothing at a given key ever changes.
        "cache-control": IMMUTABLE,
        "access-control-allow-origin": "*",
        "x-optfall-face": "hit",
      },
    });
  };
