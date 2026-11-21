/**
 * Link-preview images: a card face, padded onto a 1200×630 canvas.
 *
 *   e.g.      https://images.optfall.com/og/MST131.jpg
 *   → face:   normal/MST131.webp, letterboxed to 1200×630, as a JPEG
 *
 * WHY THIS EXISTS. A card page's `og:image` used to be the face itself, a
 * 450×628 portrait WebP, under `summary_large_image`. Every large preview card
 * is drawn at about 1.91:1, so X cropped the face to a strip across its middle
 * — the bottom of the art and the top of the text box, which is neither the
 * picture nor the name — and WebP is the format link unfurlers are least
 * consistent about. 1200×630 is the size those cards are drawn at, so a
 * padded face arrives whole, and a JPEG arrives everywhere.
 *
 * PADDED, NOT CROPPED. `fit: "pad"` scales the face to fit inside the canvas
 * and fills the rest with `CANVAS`, so the whole card is in the preview —
 * which is the point of previewing a card — at the height the card allows.
 *
 * THE TRANSFORM IS CLOUDFLARE IMAGES, THROUGH ITS WORKER BINDING, AND THE
 * BILL IS BOUNDED BY THE BUCKET. A transform only runs for a key the bucket
 * holds — an unknown key is answered before the binding is touched — so the
 * most it can ever cost is one transform per face, and Workers Cache
 * (`wrangler.jsonc`) makes each of those a one-time cost: the response says
 * `immutable` for the same reason a face does. Nothing in the URL but the key
 * reaches the transform, so nobody can mint new billable variants by changing
 * a query string or a colour.
 *
 * IF THE BINDING FAILS, THE PREVIEW FALLS BACK TO THE FACE. A 302 to
 * `/normal/<key>.webp`, uncacheable, so the reader still gets the old portrait
 * preview rather than none, and the next request tries the transform again.
 * The failure is reported the way a store failure is, because silence here is
 * every shared link losing its picture.
 */

import type { FaceFailureReporter, FaceStore } from "./face";
import { coldFoilFallbackKey } from "./face";

/** The canvas every large link-preview card is drawn at. */
export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * The colour around the face: the site's own ground.
 *
 * A LITERAL, LIKE THE PLACEHOLDER'S GREY, because this Worker imports nothing
 * from the site. It is `color.ground` in the dark theme — the same value
 * `apps/site/ssg/assets.ts` exports as `THEME_COLOUR` — and `og.test.ts`
 * asserts the two agree, so a token change that moves the site's ground fails
 * there rather than leaving every preview a shade off.
 */
export const CANVAS = "#1a1a1a";

const IMMUTABLE = "public, max-age=31536000, immutable";
const PROVISIONAL = "public, max-age=300";

/**
 * The slice of the Images binding this module uses.
 *
 * STRUCTURAL, AS `FaceStore` IS, so the tests can drive it without a binding.
 * The real one (`env.IMAGES`) has more; these three calls are the contract.
 */
export type ImageTransformer = {
  transform(options: {
    width: number;
    height: number;
    fit: "pad";
    background: string;
  }): ImageTransformer;
  output(options: {
    format: "image/jpeg";
    quality: number;
  }): Promise<{ image(): ReadableStream<Uint8Array> }>;
};

export type ImagesBinding = {
  input(stream: ReadableStream<Uint8Array>): ImageTransformer;
};

/** `/og/MST131.jpg` → `MST131`, or `null` for anything else. */
export function parseOgPath(pathname: string): string | null {
  let raw: string;
  try {
    raw = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const match = /^\/og\/([A-Za-z0-9._-]+)\.jpg$/.exec(raw);
  const stem = match?.[1];
  if (stem === undefined) return null;
  /* The same refusals `parseFacePath` makes of a basename: no traversal, no
     dotfile. The alphabet above already excludes `/`. */
  if (stem.includes("..") || stem.startsWith(".")) return null;
  return stem;
}

export const makeOgHandler =
  (
    openStore: () => FaceStore,
    openImages: () => ImagesBinding,
    report: FaceFailureReporter = () => {},
  ) =>
  async (stem: string): Promise<Response> => {
    const key = `normal/${stem}.webp`;

    let face: ReadableStream | null;
    let substitute = false;
    try {
      face = await openStore().get(key);
      /* A Cold Foil with no art of its own previews as its sibling, exactly
         as its page shows it — and provisionally, for the reason `face.ts`
         gives: the real foil may yet be published. */
      const fallback = face === null ? coldFoilFallbackKey(key) : null;
      if (fallback !== null) {
        face = await openStore().get(fallback);
        substitute = face !== null;
      }
    } catch (error) {
      report(error, { fn: "og", op: "r2.get", key });
      return new Response("Store unavailable", {
        status: 503,
        headers: { "cache-control": "no-store" },
      });
    }

    /* NO FACE, NO PREVIEW IMAGE — and no transform billed for one. A
       placeholder padded to 1200×630 would be a large grey card claiming to
       be a picture. Provisional, so new art appears within minutes. */
    if (face === null) {
      return new Response("Not found", {
        status: 404,
        headers: {
          "cache-control": PROVISIONAL,
          "content-type": "text/plain; charset=utf-8",
          "x-content-type-options": "nosniff",
        },
      });
    }

    try {
      const result = await openImages()
        .input(face as ReadableStream<Uint8Array>)
        .transform({
          ...OG_SIZE,
          fit: "pad",
          background: CANVAS,
        })
        .output({ format: "image/jpeg", quality: 85 });
      return new Response(result.image(), {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "cache-control": substitute ? PROVISIONAL : IMMUTABLE,
          "access-control-allow-origin": "*",
          "x-optfall-face": substitute ? "og-substitute" : "og",
        },
      });
    } catch (error) {
      report(error, { fn: "og", op: "images.transform", key });
      return new Response(null, {
        status: 302,
        headers: { location: `/${key}`, "cache-control": "no-store" },
      });
    }
  };
