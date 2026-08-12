/**
 * How a printing resolves to a card face, stated once.
 *
 * This module is the join between two things that must never disagree: the
 * ingest that PUTS bytes into the `optfall-card-faces` Blobs store
 * (`scripts/ingest-card-images.ts`) and the markup that ASKS for them
 * (`CardFace`). Both import the rule from here, so a key written by one is by
 * construction the key requested by the other. `docs/SCRYFALL-GAP.md` §5.1a.
 *
 * THE KEY IS THE SOURCE IMAGE'S BASENAME, AND THE OBVIOUS ALTERNATIVES ARE
 * BOTH WRONG.
 *
 * - `printing.id` is the collector number — `MST131` — and `cards.ts` calls it
 *   "the citable identity of a printing". It is NOT unique: measured, 4,780 of
 *   them appear on more than one printing. `MST131` occurs twice with the same
 *   edition and different foiling (`S` standard, `R` rainbow), and both point at
 *   the same image. Keying on it would collapse two printings that genuinely
 *   differ.
 * - `printing.unique_id` IS unique, and keying on it would store 16,502 blobs
 *   where only 11,377 distinct images exist — 45% of the store paying for bytes
 *   it already has, and an opaque nanoid in every URL.
 *
 * The basename is the granularity upstream publishes art at, so it dedupes
 * exactly where the source does: the 5,056 printings that share a face with a
 * sibling share a blob.
 *
 * THE ONE COLLISION IS NOT A COLLISION. Across the 11,377 distinct URLs there
 * are 11,376 distinct basenames — `LGS387.webp` is served from two hosts. Both
 * were fetched and hashed while writing this: **identical bytes**, the same
 * image mirrored. So collapsing them to one key is correct rather than lossy,
 * and it saves a duplicate. The ingest still hashes what it writes and refuses
 * to overwrite a key with different bytes, so a future basename clash between
 * genuinely different art fails loudly instead of silently serving one card's
 * face under another card's name.
 */

/**
 * The face host. A separate Netlify site from the main one — see
 * `apps/images/netlify.toml` for why the runtime is confined there.
 *
 * Absolute rather than root-relative, because it is a different origin. If the
 * host is ever moved, this is the one line that changes.
 */
export const FACE_HOST = "https://optfall-images.netlify.app";

/**
 * The tiers the host publishes, and the box each promises.
 *
 * WIDTHS ARE DICTATED BY THE SOURCES, NOT CHOSEN. Upstream faces are not
 * uniform — measured: 546×762 PNG from fabmaster, 450×628 PNG from one
 * CloudFront distribution, WebP of varying size from S3. 450 is the largest
 * width EVERY source satisfies without upscaling, so it is the ceiling.
 * Inventing pixels to reach a rounder number would be the tool asserting detail
 * it does not have.
 *
 * Heights are stated rather than derived so they can be written into `width`
 * and `height` attributes verbatim: an image without intrinsic dimensions in a
 * lazy-loaded grid is a layout-shift generator.
 *
 * `apps/images/netlify/functions/_placeholder.ts` carries the same table for
 * its own guard. The duplication is deliberate — that is a separate deployable
 * with no shared package — and both cite this file.
 */
export const FACE_TIERS = {
  thumb: { width: 180, height: 251 },
  normal: { width: 450, height: 628 },
} as const;

export type FaceTier = keyof typeof FACE_TIERS;

/** Standard TCG stock, 63 × 88 mm. Every measured upstream source lands here. */
export const CARD_ASPECT_RATIO = 63 / 88;

/**
 * The blob key for one printing's image URL, or `null` where upstream publishes
 * none.
 *
 * Pure, so the ingest and the page cannot produce different answers from the
 * same input. Four printings in the corpus carry `image_url: null` and get
 * `null` here — "there is no image" and "the image is at the empty string" are
 * different claims, and `cards.ts` already keeps them apart upstream of this.
 */
export function faceKeyFor(imageUrl: string | null | undefined): string | null {
  if (imageUrl === null || imageUrl === undefined || imageUrl === "") return null;

  let basename: string;
  try {
    const path = new URL(imageUrl).pathname;
    // THE DECODE IS INSIDE THE TRY, and it was not. `decodeURIComponent` throws
    // `URIError` on malformed percent-encoding — `%E0%A4%A` is enough — and it
    // sat one line below a comment promising that throwing here "would take
    // down every page that lists the card". It would have: this function runs
    // at module scope from `cards.ts` building `CARD_PAGES`, so a single
    // malformed URL arriving in a scheduled corpus sync would fail the whole
    // Astro build rather than degrade one card to a placeholder. No URL in
    // today's corpus contains a `%`, so this was latent rather than live — and
    // latent is exactly how it would have arrived, on a sync nobody was
    // watching.
    basename = decodeURIComponent(path.split("/").pop() ?? "");
  } catch {
    // A malformed URL is a corpus problem, not a rendering problem. Reporting
    // it as "no image" puts a placeholder on the page, which is the honest
    // outcome.
    return null;
  }

  if (basename === "") return null;

  // Everything is stored as WebP regardless of what the source was, because the
  // ingest transcodes. So the key's extension is the STORED format, never the
  // source's — `MST131.png` upstream is `MST131.webp` here.
  //
  // A SOURCE RENDITION MARKER IS NOT PART OF THE IDENTITY. 2,144 of the URLs
  // are named `1HP001.width-450.png` — one host's rendition pipeline stamping
  // the width it happened to serve into the file name. Carrying that through
  // would put somebody else's build artefact in our URL space forever, and
  // would key two renditions of one card's art as two faces. Measured before
  // stripping it: 11,376 distinct stems either way, and the only stem reached
  // by two URLs is the byte-identical `LGS387` mirror described above. So this
  // is free.
  const stem = basename
    .replace(/\.[^.]+$/, "")
    .replace(/\.width-\d+$/, "");
  if (stem === "") return null;

  // The host's guard accepts this alphabet and no other; anything outside it
  // could not have come from the ingest, so it is treated as no image rather
  // than as a key that will 404.
  //
  // THE LEADING CHARACTER IS CONSTRAINED SEPARATELY, and that is not
  // decoration. `.` is a legal character inside a key (`LGS282-RF`, and the
  // rendition marker before it is stripped), so an alphabet of
  // `[A-Za-z0-9._-]+` alone accepts a stem of `..` — which is exactly what
  // `/%2e%2e.png` decodes to, and it would emit `...webp` as a key. The host's
  // own guard would refuse that, so nothing could ever have been served, but a
  // rule that generates addresses its own server rejects is a rule that is
  // wrong. Every real key begins with a letter or a digit: `MST131`, `1HP001`,
  // `LGS282-RF`.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(stem)) return null;
  if (stem.includes("..")) return null;

  return `${stem}.webp`;
}

/** The absolute URL of one face at one tier. */
export function faceUrl(key: string, tier: FaceTier): string {
  return `${FACE_HOST}/${tier}/${key}`;
}

/**
 * The NO IMAGE placeholder, which is a real asset rather than a missing one.
 *
 * Used where the printing has no `image_url` at all. Where a key EXISTS but the
 * store has not been filled yet, nothing needs to call this — the host answers
 * a miss with the same bytes, so the page asks for the face it expects and gets
 * a card-shaped image either way.
 */
export function placeholderUrl(
  orientation: "portrait" | "landscape" = "portrait",
): string {
  return `${FACE_HOST}/placeholder/${orientation}.svg`;
}

/**
 * Which way round a printing is.
 *
 * 15 cards are `played_horizontally` and 10 printings carry a non-zero
 * `image_rotation_degrees`. Either makes the face landscape, and a portrait box
 * around a landscape image is a bug visible at a glance.
 */
export function orientationOf(input: {
  readonly playedHorizontally: boolean;
  readonly rotationDegrees: number;
}): "portrait" | "landscape" {
  return input.playedHorizontally || input.rotationDegrees % 180 !== 0
    ? "landscape"
    : "portrait";
}

/** The pixel box for a tier, transposed when the face is landscape. */
export function boxFor(
  tier: FaceTier,
  orientation: "portrait" | "landscape",
): { readonly width: number; readonly height: number } {
  const { width, height } = FACE_TIERS[tier];
  return orientation === "portrait"
    ? { width, height }
    : { width: height, height: width };
}
