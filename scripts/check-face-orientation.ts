/**
 * Re-measure every stored face and hold `LANDSCAPE_FACE_KEYS` to it.
 *
 * WHY THIS EXISTS AT ALL. `apps/site/src/lib/faces.ts` used to derive a face's
 * orientation from two corpus fields — `played_horizontally` on the card and
 * `image_rotation_degrees` on the printing. It was wrong on 24 of the 34 faces
 * it decided, in both directions, and the visible symptom was that the split
 * cards drew at 322 px wide beside 450 px neighbours: a portrait file
 * letterboxed inside a landscape box by `object-fit: contain`. The fix replaced
 * the inference with a measurement, and a measurement rots. This is what stops
 * it rotting silently.
 *
 * IT IS NOT PART OF `bun run check`, AND MUST NOT BECOME PART OF IT. It makes
 * one ranged request per distinct face — 11,376 of them — against the live face
 * host. That is the same reason `check:symbols` and `corpus:*` are kept out of
 * the loop and out of `.claude/settings.json`'s pre-approved list: a command
 * that talks to the network is a decision somebody makes, not a step that runs
 * on every save. Run it after a corpus sync, or when a face looks the wrong
 * shape.
 *
 * WHY A RANGED GET RATHER THAN A HEAD. `HEAD` reports the byte length, which
 * says nothing about the box. The first forty bytes of a WebP carry the width
 * and height in all three container forms, so forty bytes per face answers the
 * question outright — about 50 seconds for the whole store, against ~7.7 GB for
 * the naive version.
 *
 * IT READS THE `normal` TIER ONLY. Both tiers are produced from one source by
 * one `fit: "inside"` resize (`scripts/ingest-card-images.ts`), so they cannot
 * disagree about which side is longer, and measuring both would double the
 * traffic to re-derive the same bit.
 */

import { CORPUS } from "../apps/site/src/lib/cards";
import {
  faceKeyFor,
  faceUrl,
  LANDSCAPE_FACE_KEYS,
} from "../apps/site/src/lib/faces";

/** How many faces are in flight at once. */
const CONCURRENCY = 48;

/** Enough to reach the dimensions in every WebP container form. */
const HEADER_BYTES = 40;

/**
 * The pixel box out of a WebP header, or `null` if these bytes are not one.
 *
 * THREE CONTAINER FORMS, AND ALL THREE ARE REACHED IN PRACTICE. `VP8X` is the
 * extended form sharp emits, `VP8 ` is lossy simple and `VP8L` is lossless.
 * Reading only the first would silently report "unparsed" for the others, and an
 * unparsed face is treated as a failure below rather than as a portrait one —
 * guessing is the thing this script exists to stop.
 */
function boxOf(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 32) return null;
  if (bytes.toString("ascii", 0, 4) !== "RIFF") return null;

  const form = bytes.toString("ascii", 12, 16);
  if (form === "VP8X") {
    // 24-bit little-endian, stored as (value - 1).
    return {
      width: bytes.readUIntLE(24, 3) + 1,
      height: bytes.readUIntLE(27, 3) + 1,
    };
  }
  if (form === "VP8 ") {
    // The top two bits of each 16-bit field are the scaling hint, not size.
    return {
      width: bytes.readUInt16LE(26) & 0x3fff,
      height: bytes.readUInt16LE(28) & 0x3fff,
    };
  }
  if (form === "VP8L") {
    const packed = bytes.readUInt32LE(21);
    return {
      width: (packed & 0x3fff) + 1,
      height: ((packed >> 14) & 0x3fff) + 1,
    };
  }
  return null;
}

interface Measured {
  readonly key: string;
  readonly width: number;
  readonly height: number;
}

async function measure(key: string): Promise<Measured | string> {
  let response: Response;
  try {
    response = await fetch(faceUrl(key, "normal"), {
      headers: { Range: `bytes=0-${HEADER_BYTES - 1}` },
    });
  } catch (error) {
    return `${key}: ${error instanceof Error ? error.message : String(error)}`;
  }

  if (response.status !== 200 && response.status !== 206) {
    return `${key}: HTTP ${response.status}`;
  }

  /*
   * A PLACEHOLDER IS NOT A MEASUREMENT. The host answers a miss with the NO
   * IMAGE plate at 200 rather than a 404 (`apps/images/src/face.ts`), and that
   * plate is an SVG whose shape is whatever the host guessed. Parsing it would
   * record the guess as a fact — so a miss is reported as a failure, which is
   * what it is for a script whose subject is what the store actually holds.
   *
   * A SUBSTITUTE IS. The 18 withheld Cold Foils — ANQ011-CF..ANQ027-CF and
   * FAB402-CF — are served their non-foil sibling's bytes under their own key,
   * permanently, because upstream publishes the art and not the foil rendition.
   * Those bytes are what the page draws at that address, so their box is the box
   * the site must reserve, and treating them as unmeasurable would fail this
   * check forever over a condition `coldFoilFallbackKey` already documents as
   * settled. The first run of this script did exactly that, which is how the
   * distinction got written down.
   */
  const marker = response.headers.get("x-optfall-face") ?? "";
  if (marker.startsWith("placeholder")) {
    return `${key}: served the ${marker}, so the store holds no face for it`;
  }

  const box = boxOf(Buffer.from(await response.arrayBuffer()));
  if (box === null) return `${key}: not a readable WebP header`;
  return { key, width: box.width, height: box.height };
}

async function main(): Promise<void> {
  const keys = new Set<string>();
  for (const card of CORPUS.cards) {
    for (const printing of card.printings) {
      const key = faceKeyFor(printing.image_url);
      if (key !== null) keys.add(key);
    }
  }
  const list = [...keys].toSorted();

  console.log(
    `measuring ${list.length.toLocaleString("en-GB")} distinct faces at the ` +
      `normal tier, ${CONCURRENCY} at a time`,
  );

  const measured: Measured[] = [];
  const failures: string[] = [];
  let cursor = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= list.length) return;
      const key = list[index];
      if (key === undefined) return;
      const result = await measure(key);
      if (typeof result === "string") failures.push(result);
      else measured.push(result);
    }
  }

  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  const found = new Set(
    measured.filter((m) => m.width > m.height).map((m) => m.key),
  );
  const declared = LANDSCAPE_FACE_KEYS;

  const missing = [...found].filter((key) => !declared.has(key)).toSorted();
  const stale = [...declared].filter((key) => !found.has(key)).toSorted();

  console.log(
    `measured ${measured.length.toLocaleString("en-GB")} in ${elapsed}s; ` +
      `${found.size} landscape, ${declared.size} declared`,
  );

  /*
   * A FAILURE IS A FAILURE, not a reason to compare a partial measurement. Half
   * the store is enough to "prove" a declared key stale, and a check that can
   * delete a correct entry on a flaky network is worse than no check.
   */
  if (failures.length > 0) {
    console.error(
      `\n${failures.length} face(s) could not be measured, so the comparison ` +
        `below would be against a partial store and is not made:`,
    );
    for (const failure of failures.slice(0, 20)) console.error(`  ${failure}`);
    if (failures.length > 20) {
      console.error(`  … and ${failures.length - 20} more`);
    }
    process.exit(1);
  }

  if (missing.length === 0 && stale.length === 0) {
    console.log("\nLANDSCAPE_FACE_KEYS agrees with the store.");
    return;
  }

  console.error(
    `\nLANDSCAPE_FACE_KEYS in apps/site/src/lib/faces.ts disagrees with the ` +
      `store. Every entry is a face whose box the site draws, so a wrong list ` +
      `letterboxes a real card. Update it AND its twin in ` +
      `apps/images/src/face.ts, and the count asserted in faces.test.ts.`,
  );
  for (const key of missing) {
    console.error(`  + "${key}", — measured landscape, not declared`);
  }
  for (const key of stale) {
    console.error(`  - "${key}", — declared landscape, measured portrait`);
  }
  process.exit(1);
}

await main();
