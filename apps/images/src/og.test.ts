/**
 * The link-preview route, asserted against a fake store and a fake Images
 * binding.
 *
 * The decisions worth pinning: only an exact `/og/<key>.jpg` reaches the
 * transform, an unknown key never bills one, the transform is asked for the
 * canvas link previews are drawn at, and a failing binding degrades to the
 * plain face rather than to nothing.
 */
import { describe, expect, test } from "bun:test";

import { THEME_COLOUR } from "../../site/ssg/assets";
import type { FaceStore } from "./face";
import {
  CANVAS,
  type ImagesBinding,
  makeOgHandler,
  OG_SIZE,
  parseOgPath,
} from "./og";

function storeWith(keys: readonly string[]): FaceStore {
  return {
    get: async (key) =>
      keys.includes(key) ? new Response("webp-bytes").body : null,
  };
}

/** An Images binding that records what it was asked for. */
function recordingImages(): {
  readonly binding: ImagesBinding;
  readonly calls: unknown[];
} {
  const calls: unknown[] = [];
  const transformer = {
    transform(options: unknown) {
      calls.push(options);
      return transformer;
    },
    async output(options: unknown) {
      calls.push(options);
      return {
        image: () =>
          new Response("jpeg-bytes").body as ReadableStream<Uint8Array>,
      };
    },
  };
  return { binding: { input: () => transformer }, calls };
}

const failingImages: ImagesBinding = {
  input: () => {
    throw new Error("images unavailable");
  },
};

describe("parseOgPath", () => {
  test("takes exactly /og/<key>.jpg", () => {
    expect(parseOgPath("/og/MST131.jpg")).toBe("MST131");
    expect(parseOgPath("/og/LGS282-RF.jpg")).toBe("LGS282-RF");
    expect(parseOgPath("/og/spoiler-SLV001.jpg")).toBe("spoiler-SLV001");
  });

  test("refuses everything else", () => {
    for (const path of [
      "/og/MST131.webp",
      "/og/MST131.png",
      "/og/../normal/MST131.jpg",
      "/og/a/b.jpg",
      "/og/.hidden.jpg",
      "/og/%zz.jpg",
      "/og/.jpg",
      "/normal/MST131.webp",
    ]) {
      expect(parseOgPath(path)).toBeNull();
    }
  });
});

describe("the og handler", () => {
  test("pads a held face to 1200×630 on the site's ground, as a JPEG", async () => {
    const images = recordingImages();
    const response = await makeOgHandler(
      () => storeWith(["normal/MST131.webp"]),
      () => images.binding,
    )("MST131");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(images.calls[0]).toEqual({
      width: 1200,
      height: 630,
      fit: "pad",
      background: CANVAS,
    });
    expect(images.calls[1]).toMatchObject({ format: "image/jpeg" });
  });

  test("an unknown key bills no transform", async () => {
    const images = recordingImages();
    const response = await makeOgHandler(
      () => storeWith([]),
      () => images.binding,
    )("NOPE001");

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).not.toContain("immutable");
    expect(images.calls).toEqual([]);
  });

  test("a withheld Cold Foil previews its sibling, provisionally", async () => {
    const images = recordingImages();
    const response = await makeOgHandler(
      () => storeWith(["normal/ANQ011.webp"]),
      () => images.binding,
    )("ANQ011-CF");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).not.toContain("immutable");
    expect(response.headers.get("x-optfall-face")).toBe("og-substitute");
  });

  test("a failing binding redirects to the plain face, uncached", async () => {
    const reported: unknown[] = [];
    const response = await makeOgHandler(
      () => storeWith(["normal/MST131.webp"]),
      () => failingImages,
      (_error, context) => reported.push(context),
    )("MST131");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/normal/MST131.webp");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(reported).toHaveLength(1);
  });

  test("the canvas is the size the site advertises", () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });

  test("the canvas colour is the site's ground", () => {
    /* `CANVAS` is a literal because this Worker imports nothing from the
       site at runtime. This is what keeps it honest. */
    expect(CANVAS).toBe(THEME_COLOUR);
  });
});
