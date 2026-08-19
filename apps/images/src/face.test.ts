/**
 * The face host's behaviour, asserted against a fake store.
 *
 * The seam is `makeFaceHandler`'s injected store getter, so none of this needs
 * a live R2 binding. What is worth testing here is not "does it return
 * bytes" — it is the three decisions a reader would otherwise have to take on
 * trust: the path guard actually rejects traversal, a miss degrades to a
 * placeholder rather than a 404, and a miss is NOT cached like a hit.
 */
import { describe, expect, test } from "bun:test";

import { placeholderSvg, TIERS } from "./placeholder";
import {
  coldFoilFallbackKey,
  makeFaceHandler,
  parseFacePath,
  parsePlaceholderPath,
  type FaceStore,
} from "./face";

/** A store holding exactly the keys given, and nothing else. */
function storeWith(keys: readonly string[]): FaceStore {
  return {
    get: async (key) =>
      keys.includes(key) ? new Response("webp-bytes").body : null,
  };
}

/** A store that is down. */
const brokenStore: FaceStore = {
  get: () => Promise.reject(new Error("r2 unavailable")),
};

function request(path: string): Request {
  return new Request(`https://images.optfall.com${path}`);
}

/** Width ÷ height, read off the SVG's own viewBox. */
function viewBoxRatio(svg: string): number {
  const match = /viewBox="0 0 (\d+) (\d+)"/.exec(svg);
  return Number(match?.[1]) / Number(match?.[2]);
}

describe("parseFacePath", () => {
  test("accepts a tiered webp key", () => {
    expect(parseFacePath("/normal/MST131.webp")).toEqual({
      tier: "normal",
      key: "normal/MST131.webp",
    });
    expect(parseFacePath("/thumb/LGS282-RF.webp")).toEqual({
      tier: "thumb",
      key: "thumb/LGS282-RF.webp",
    });
  });

  test("rejects a tier it does not publish", () => {
    expect(parseFacePath("/huge/MST131.webp")).toBeNull();
    expect(parseFacePath("/art_crop/MST131.webp")).toBeNull();
  });

  test("rejects anything that is not webp", () => {
    // The ingest normalises to WebP, so a .png request is a stale assumption
    // rather than a preference, and hiding it behind a placeholder would keep
    // the caller wrong for longer.
    expect(parseFacePath("/normal/MST131.png")).toBeNull();
    expect(parseFacePath("/normal/MST131")).toBeNull();
  });

  test("rejects traversal, nesting and dotfiles", () => {
    expect(parseFacePath("/normal/../../etc/passwd.webp")).toBeNull();
    expect(parseFacePath("/normal/sub/dir.webp")).toBeNull();
    expect(parseFacePath("/normal/.hidden.webp")).toBeNull();
  });

  test("rejects a bare tier and an empty path", () => {
    expect(parseFacePath("/normal")).toBeNull();
    expect(parseFacePath("/")).toBeNull();
    expect(parseFacePath("")).toBeNull();
  });

  test("malformed percent-encoding is a 404, not a crash", () => {
    // `decodeURIComponent` throws URIError on these. Uncaught, the platform answers
    // 500 where this guard is written to answer 404 — on a host that serves
    // every path on a public domain, so the first scanner probing bad escapes
    // would have found it.
    expect(parseFacePath("/normal/%zz.webp")).toBeNull();
    expect(parseFacePath("/normal/%E0%A4%A.webp")).toBeNull();
    expect(parseFacePath("/%.webp")).toBeNull();
  });

  test("decodes percent-encoding before guarding it", () => {
    // %2e%2e is `..`. Guarding the raw string would let this through.
    expect(parseFacePath("/normal/%2e%2e%2fsecret.webp")).toBeNull();
  });
});

describe("parsePlaceholderPath", () => {
  test("matches both orientations and nothing else", () => {
    expect(parsePlaceholderPath("/placeholder/portrait.svg")).toBe("portrait");
    expect(parsePlaceholderPath("/placeholder/landscape.svg")).toBe(
      "landscape",
    );
    expect(parsePlaceholderPath("/placeholder/other.svg")).toBeNull();
    expect(parsePlaceholderPath("/placeholder")).toBeNull();
  });
});

describe("the handler", () => {
  test("serves a stored face as immutable webp", async () => {
    const handler = makeFaceHandler(() => storeWith(["normal/MST131.webp"]));
    const response = await handler(request("/normal/MST131.webp"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(response.headers.get("x-optfall-face")).toBe("hit");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  test("a miss is a placeholder with 200, not a 404", async () => {
    // The whole point: an <img> that 404s collapses to a broken-image glyph of
    // the browser's own size, which reflows a grid. A card-shaped SVG does not.
    const handler = makeFaceHandler(() => storeWith([]));
    const response = await handler(request("/normal/NOPE001.webp"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("x-optfall-face")).toBe("placeholder");
    expect(await response.text()).toBe(placeholderSvg("portrait"));
  });

  test("a miss is NOT cached like a hit", async () => {
    // A placeholder means "no face here YET". Caching that for a year would
    // keep serving NO IMAGE after the ingest filled the key in.
    const handler = makeFaceHandler(() => storeWith([]));
    const response = await handler(request("/normal/NOPE001.webp"));

    const cacheControl = response.headers.get("cache-control") ?? "";
    expect(cacheControl).not.toContain("immutable");
    expect(cacheControl).toContain("max-age=300");
  });

  test("a store outage degrades to a placeholder and is reported", async () => {
    const reported: Record<string, unknown>[] = [];
    const handler = makeFaceHandler(
      () => brokenStore,
      (_error, context) => reported.push(context ?? {}),
    );
    const response = await handler(request("/normal/MST131.webp"));

    expect(response.status).toBe(503);
    expect(response.headers.get("x-optfall-face")).toBe("placeholder-degraded");
    expect(reported).toHaveLength(1);
    expect(reported[0]).toMatchObject({
      key: "normal/MST131.webp",
      fn: "face",
    });
  });

  test("an ordinary miss is NOT reported", async () => {
    // This host answers every path on a public domain. Reporting misses would
    // turn the error log into a scanner log.
    const reported: unknown[] = [];
    const handler = makeFaceHandler(
      () => storeWith([]),
      (error) => reported.push(error),
    );

    await handler(request("/normal/NOPE001.webp"));
    await handler(request("/nonsense"));

    expect(reported).toHaveLength(0);
  });

  test("an unparseable path is a 404", async () => {
    const handler = makeFaceHandler(() => storeWith([]));
    const response = await handler(request("/nonsense"));
    expect(response.status).toBe(404);
  });

  test("serves the placeholder directly at both orientations", async () => {
    const handler = makeFaceHandler(() => storeWith([]));

    const portrait = await handler(request("/placeholder/portrait.svg"));
    const landscape = await handler(request("/placeholder/landscape.svg"));

    expect(portrait.status).toBe(200);
    expect(landscape.status).toBe(200);
    expect(await portrait.text()).toBe(placeholderSvg("portrait"));
    expect(await landscape.text()).toBe(placeholderSvg("landscape"));
  });

  test("the placeholder a miss returns is byte-identical to the direct one", async () => {
    // One source of truth. If these ever diverge, two things a reader assumed
    // were the same asset have quietly become two assets.
    const handler = makeFaceHandler(() => storeWith([]));
    const viaMiss = await handler(request("/thumb/NOPE001.webp"));
    const direct = await handler(request("/placeholder/portrait.svg"));

    expect(await viaMiss.text()).toBe(await direct.text());
  });
});

describe("the placeholder itself", () => {
  test("carries the card aspect ratio in both orientations", () => {
    // 63:88 is standard TCG stock, and every measured upstream source lands on
    // it. A placeholder of the wrong shape reflows the grid it exists to hold
    // still, which would defeat the entire point of serving one.
    expect(viewBoxRatio(placeholderSvg("portrait"))).toBeCloseTo(63 / 88, 2);
    expect(viewBoxRatio(placeholderSvg("landscape"))).toBeCloseTo(88 / 63, 2);
  });

  test("names itself for a screen reader", () => {
    expect(placeholderSvg("portrait")).toContain(
      "<title>No image published</title>",
    );
    expect(placeholderSvg("portrait")).toContain('role="img"');
  });

  test("carries no LSS or FAB mark", () => {
    // docs/COMPLIANCE.md: no FAB or LSS logos, and set logos count as FAB
    // logos. What is drawn is Optfall's own mark and nothing else.
    const svg = placeholderSvg("portrait").toLowerCase();
    for (const forbidden of ["fab", "legend story", "flesh and blood", "lss"]) {
      expect(svg).not.toContain(forbidden);
    }
  });

  test("both tiers hold the card ratio", () => {
    // Named in the failure message, so a broken tier says WHICH tier.
    const ratios = Object.fromEntries(
      Object.entries(TIERS).map(([name, box]) => [
        name,
        Number((box.width / box.height).toFixed(2)),
      ]),
    );
    const card = Number((63 / 88).toFixed(2));
    expect(ratios).toEqual({ thumb: card, normal: card });
  });
});

describe("a Cold Foil with no art of its own", () => {
  /*
   * WHY THIS EXISTS. Upstream publishes 576 `-CF` faces and withholds 18 of
   * them — ANQ011-CF..ANQ027-CF and FAB402-CF return 403 from the official image
   * host while their non-foil siblings return 200, and LSS's own card database
   * points those cards at the sibling. Serving the sibling is a deliberate,
   * documented inaccuracy; these tests pin the parts that keep it honest.
   */

  test("maps a Cold Foil key to its non-foil sibling", () => {
    expect(coldFoilFallbackKey("normal/ANQ011-CF.webp")).toBe(
      "normal/ANQ011.webp",
    );
    expect(coldFoilFallbackKey("thumb/FAB402-CF.webp")).toBe(
      "thumb/FAB402.webp",
    );
  });

  test("never fires for a key that is not Cold Foil", () => {
    /* The fallback must not turn an ordinary miss into someone else's art.
       Rainbow Foil, Gold Foil, Marvel and plain keys all stay null. */
    expect(coldFoilFallbackKey("normal/MST131.webp")).toBeNull();
    expect(coldFoilFallbackKey("normal/LGS282-RF.webp")).toBeNull();
    expect(coldFoilFallbackKey("normal/ANQ000-MV.webp")).toBeNull();
    expect(coldFoilFallbackKey("normal/HVY008-GF.webp")).toBeNull();
    /* Substring, not suffix — this must not match. */
    expect(coldFoilFallbackKey("normal/ANQ-CF011.webp")).toBeNull();
  });

  test("serves the sibling, and says that it did", async () => {
    const store = storeWith(["normal/ANQ011.webp"]);
    const response = await makeFaceHandler(() => store)(
      request("/normal/ANQ011-CF.webp"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("x-optfall-face")).toBe("substitute");
    expect(await response.text()).toBe("webp-bytes");
  });

  test("caches the substitute for minutes, never for a year", async () => {
    /*
     * THE SAFETY OF THE WHOLE FEATURE. These bytes stand in for art upstream
     * has not published; an immutable year would outlive the gap and freeze the
     * wrong picture on the page long after the right one existed.
     */
    const store = storeWith(["normal/ANQ011.webp"]);
    const response = await makeFaceHandler(() => store)(
      request("/normal/ANQ011-CF.webp"),
    );

    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("cache-control")).not.toContain("immutable");
  });

  test("the real foil art wins the moment it exists", async () => {
    /* One cache lifetime after upstream publishes, the substitution stops. */
    const store = storeWith(["normal/ANQ011-CF.webp", "normal/ANQ011.webp"]);
    const response = await makeFaceHandler(() => store)(
      request("/normal/ANQ011-CF.webp"),
    );

    expect(response.headers.get("x-optfall-face")).toBe("hit");
    expect(response.headers.get("cache-control")).toContain("immutable");
  });

  test("falls through to the placeholder when the sibling is absent too", async () => {
    const store = storeWith([]);
    const response = await makeFaceHandler(() => store)(
      request("/normal/ANQ011-CF.webp"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-optfall-face")).toBe("placeholder");
  });

  test("a store outage on the fallback read still degrades, not throws", async () => {
    let call = 0;
    const flaky: FaceStore = {
      get: async () => {
        call += 1;
        if (call === 1) return null;
        throw new Error("r2 unavailable");
      },
    };
    const response = await makeFaceHandler(() => flaky)(
      request("/normal/ANQ011-CF.webp"),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("x-optfall-face")).toBe("placeholder-degraded");
  });

  test("an ordinary miss still costs exactly one read", async () => {
    /* The fallback must not double the store traffic for every absent key. */
    let reads = 0;
    const counting: FaceStore = {
      get: async () => {
        reads += 1;
        return null;
      },
    };
    await makeFaceHandler(() => counting)(request("/normal/MST999.webp"));
    expect(reads).toBe(1);
  });
});
