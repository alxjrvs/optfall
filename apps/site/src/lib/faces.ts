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
 * The face host. A separate Worker from the main site — see
 * `apps/images/wrangler.jsonc` for why the runtime is confined there.
 *
 * Absolute rather than root-relative, because it is a different origin. If the
 * host is ever moved, this is the one line that changes.
 */
export const FACE_HOST = "https://images.optfall.com";

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
 * `apps/images/src/placeholder.ts` carries the same table for
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
  if (imageUrl === null || imageUrl === undefined || imageUrl === "")
    return null;

  let basename: string;
  try {
    const path = new URL(imageUrl).pathname;
    // THE DECODE IS INSIDE THE TRY, and it was not. `decodeURIComponent` throws
    // `URIError` on malformed percent-encoding — `%E0%A4%A` is enough — and it
    // sat one line below a comment promising that throwing here "would take
    // down every page that lists the card". It would have: this function runs
    // at module scope from `cards.ts` building `CARD_PAGES`, so a single
    // malformed URL arriving in a scheduled corpus sync would fail the whole
    // site build rather than degrade one card to a placeholder. No URL in
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
  const stem = basename.replace(/\.[^.]+$/, "").replace(/\.width-\d+$/, "");
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

/**
 * The non-foil sibling of a Cold Foil face key, or null if this is not one.
 *
 * WHY THIS EXISTS. Upstream publishes 576 `-CF` faces and withholds a handful
 * of them — they answer 403 while their non-foil siblings answer 200, and
 * Legend Story Studios' own card database points those cards at the sibling.
 * The face host serves the sibling in their place; this is the rule that names
 * it, and the ingest uses it to fetch a sibling no printing references.
 *
 * IT TAKES A KEY AS {@link faceKeyFor} EMITS ONE, WHICH IS THE WHOLE TRAP. That
 * output carries the STORED extension — `ANQ011-CF.webp`, never `ANQ011-CF` —
 * because everything is transcoded to WebP regardless of the source format. A
 * first version of the ingest's use of this tested `endsWith("-CF")` against
 * that value, matched nothing, and reported no work to do while eighteen faces
 * stayed missing. Nothing failed; it simply never ran.
 *
 * `apps/images/src/face.ts` carries the runtime twin of this rule, over keys
 * that also carry a tier prefix. It cannot import this one: that app declares
 * no dependencies at all, deliberately, and reaches nothing outside itself.
 */
export function coldFoilSiblingKey(faceKey: string): string | null {
  return /-CF\.webp$/.test(faceKey)
    ? faceKey.replace(/-CF\.webp$/, ".webp")
    : null;
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
 * Every stored face whose bytes are wider than they are tall.
 *
 * MEASURED, NOT PREDICTED, AND THAT IS THE ENTIRE POINT OF THIS CONSTANT.
 * Orientation used to be inferred from two corpus fields — `played_horizontally`
 * on the card and `image_rotation_degrees` on the printing — on the reasoning
 * that a card played sideways is published sideways. It is not. Upstream is
 * inconsistent about which way round it scans a horizontal card, and neither
 * field records what it chose.
 *
 * The whole store was measured to settle it: a ranged `GET` of the first forty
 * bytes of all 11,376 distinct faces at the `normal` tier, reading the box out
 * of the WebP header. 11,376 answered, none 404ed, none was served the
 * placeholder. **14 are landscape, all of them exactly 450×322.** The old rule
 * put a landscape box on 34 faces and got 24 of them wrong, in both directions:
 *
 * - **22 portrait faces in a landscape box.** `Vaporize // Shock` is the
 *   reported one — `LGS346-CF.webp` is 449×628, a portrait scan of a card whose
 *   text runs sideways, and `played_horizontally` said landscape. `object-fit:
 *   contain` then letterboxed it, so a split card drew at 322 px wide where
 *   every other card on the site draws at 450. That is the bug this fixes: not
 *   a crop, not a scale — the box was the wrong shape and the image obeyed it.
 *   Its own sibling printing `ROS011.webp` IS landscape, so one card rendered
 *   two sizes depending on which printing you were looking at.
 * - **2 landscape faces in a portrait box**, which the old rule could not have
 *   caught in principle. `ROS257_V2` and `ROS257_V2_BACK` — the `Runechant` /
 *   `Embodiment` token — are 450×322 with `played_horizontally: false` and
 *   `image_rotation_degrees: 0`. No combination of the two fields reaches them.
 *
 * `image_rotation_degrees` is not the missing signal either. It is 270 on seven
 * of these and 0 on the rest, and it does not sort them: `FLR013` (270) and
 * `LGS346-CF` (0) are both portrait files. The ingest honours EXIF and nothing
 * else (`scripts/ingest-card-images.ts`), so what is stored is whatever shape
 * upstream published, and only the stored bytes know it.
 *
 * KEEPING IT HONEST. `bun run check:face-orientation` re-measures the live
 * store against this list. It is deliberately NOT part of `bun run check` and
 * NOT pre-approved in `.claude/settings.json`, for the reason `check:symbols`
 * is not: it makes 11,376 network requests. Run it after a corpus sync.
 *
 * `apps/images/src/face.ts` carries the same list, for the same
 * declares-no-dependencies reason `coldFoilSiblingKey` has a twin there.
 */
export const LANDSCAPE_FACE_KEYS: ReadonlySet<string> = new Set([
  "AST017.webp",
  "ROS005.webp",
  "ROS006.webp",
  "ROS011.webp",
  "ROS012.webp",
  "ROS017.webp",
  "ROS018.webp",
  "ROS023.webp",
  "ROS024.webp",
  "ROS253.webp",
  "ROS257_V2.webp",
  "ROS257_V2_BACK.webp",
  "SEA258.webp",
  "SEA259.webp",
]);

/**
 * Which way round a face is, from the bytes where there are bytes.
 *
 * A key names something that has been measured, so it is answered from
 * {@link LANDSCAPE_FACE_KEYS} and no corpus field is consulted. A key the list
 * has never seen is portrait: that is the answer for 11,362 of 11,376 measured
 * faces, and a face added by a corpus sync since the last measurement is far
 * likelier to be another portrait than the fifteenth landscape.
 *
 * `null` is the one case with nothing to measure — four printings publish no
 * image at all — and it falls to {@link orientationOf}, because the page then
 * asks for `placeholderUrl(orientation)` explicitly and that endpoint really
 * does serve both shapes.
 */
export function orientationOfFace(input: {
  readonly key: string | null;
  readonly playedHorizontally: boolean;
  readonly rotationDegrees: number;
}): "portrait" | "landscape" {
  if (input.key !== null)
    return LANDSCAPE_FACE_KEYS.has(input.key) ? "landscape" : "portrait";
  return orientationOf(input);
}

/**
 * Which way round a card is PLAYED, which is a different question.
 *
 * 15 cards are `played_horizontally` and 10 printings carry a non-zero
 * `image_rotation_degrees`. That is a fact about the game, and it was used as a
 * proxy for a fact about an image file until the measurement above showed the
 * two disagree 24 times. It survives for the one case where there is no file to
 * measure — see {@link orientationOfFace} — and should not be reached for a
 * face that has a key.
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
