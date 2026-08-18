/**
 * The Worker entrypoint's own three decisions.
 *
 * `face.test.ts` covers the behaviour; this file covers only what the platform
 * adapter adds, because that is the part the migration actually wrote and the
 * part no other test touches: R2's `{ body }` becoming a bare stream, a miss
 * becoming `null`, and a missing binding degrading rather than throwing.
 */
import { describe, expect, test } from "bun:test";

import worker, { type Env } from "./index";

/** An R2 bucket holding exactly these keys. */
function bucketWith(keys: readonly string[]) {
  return {
    get: async (key: string) =>
      keys.includes(key) ? { body: new Response("webp-bytes").body! } : null,
  };
}

const request = (path: string) =>
  new Request(`https://images.optfall.com${path}`);

describe("the R2 adapter", () => {
  test("unwraps R2's object into the stream the handler wants", async () => {
    const env = { FACES: bucketWith(["normal/MST131.webp"]) } as unknown as Env;
    const response = await worker.fetch(request("/normal/MST131.webp"), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-optfall-face")).toBe("hit");
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(await response.text()).toBe("webp-bytes");
  });

  test("a key R2 does not hold is a placeholder, not a 404", async () => {
    const env = { FACES: bucketWith([]) } as unknown as Env;
    const response = await worker.fetch(request("/normal/NOPE999.webp"), env);

    /* 200, deliberately. A card-shaped hole beats a broken-image glyph that
       reflows the grid — see `placeholder.ts`. */
    expect(response.status).toBe(200);
    expect(response.headers.get("x-optfall-face")).toBe("placeholder");
  });

  test("a missing binding degrades to 503 rather than a bare platform 500", async () => {
    /*
     * THE CASE THE TYPE SAYS CANNOT HAPPEN. `Env.FACES` is declared present, so
     * a binding typo in wrangler.jsonc is invisible to the compiler and shows up
     * only in production — as every card on the site turning into a grey
     * rectangle. Degrading keeps that legible in the status code instead of
     * losing it inside a platform error.
     */
    const response = await worker.fetch(
      request("/normal/MST131.webp"),
      {} as unknown as Env,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("x-optfall-face")).toBe("placeholder-degraded");
  });

  test("a bucket that is down degrades the same way", async () => {
    const env = {
      FACES: { get: () => Promise.reject(new Error("r2 unavailable")) },
    } as unknown as Env;
    const response = await worker.fetch(request("/normal/MST131.webp"), env);

    expect(response.status).toBe(503);
  });

  test("the placeholder route never touches the bucket at all", async () => {
    let asked = false;
    const env = {
      FACES: {
        get: async () => {
          asked = true;
          return null;
        },
      },
    } as unknown as Env;

    const response = await worker.fetch(
      request("/placeholder/portrait.svg"),
      env,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("svg");
    expect(asked).toBe(false);
  });
});
