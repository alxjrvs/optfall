/**
 * ingest-card-images — fill the `optfall-card-faces` R2 bucket from upstream's
 * published card art.
 *
 * The bytes behind https://images.optfall.com. Sources every distinct
 * face in `data/cards/cards.json`, transcodes it to the two WebP tiers
 * `apps/site/src/lib/faces.ts` publishes, and uploads both. The image bytes
 * never enter git — 11,377 faces at ~695 KB apiece is ~7.7 GB of source, and
 * even as WebP tiers it is hundreds of megabytes git would carry forever.
 * `docs/SCRYFALL-GAP.md` §5.1.
 *
 * Usage:
 *   bun scripts/ingest-card-images.ts [--limit N] [--concurrency N] [--dry-run] [--force]
 *
 * IT IS IDEMPOTENT AND RESUMABLE, which is not a nicety at this size. The store
 * is listed once up front and every key already present is skipped, so an
 * interrupted run costs only the work in flight, and the scheduled re-run that
 * picks up newly-printed cards does almost no work at all.
 *
 * IT REFUSES TO OVERWRITE A KEY WITH DIFFERENT BYTES. The key is the source
 * basename (see `faces.ts` for why), and across today's corpus exactly one
 * basename is served from two hosts — verified byte-identical, the same image
 * mirrored. That makes the key correct rather than lossy. But a future clash
 * between genuinely different art would silently serve one card's face under
 * another card's name, which is the category of wrong answer this project
 * exists not to give, so the bytes are compared and a real clash stops the run.
 *
 * THE CLASH CHECK COMPARES ETAGS. R2 speaks S3, Bun's built-in S3 client cannot
 * attach custom metadata on write, and S3 already returns a strong validator for
 * every single-part upload: the ETag is the MD5 of the stored bytes. So the
 * check needs nothing stored alongside the object — recompute what we would
 * write, compare it to what is there. A multipart ETag carries a `-<n>` suffix
 * and is NOT a plain MD5; every object here is a few hundred kilobytes and
 * therefore single-part, and the suffix is detected rather than assumed so that
 * the day one is not, the run stops instead of guessing.
 *
 * MD5 IS DOING INTEGRITY WORK HERE, NOT SECURITY WORK. It is comparing two
 * copies of art we fetched ourselves against accidental divergence. Nothing
 * trusts it against an adversary, and nothing should start.
 *
 * ON CREDENTIALS. R2's S3 API needs an access key pair, and wrangler stores no
 * such pair to be read out of, so they come from the environment. They are held
 * in-process and are never printed, logged or written. Supply them the way
 * CLAUDE.md prescribes for everything else:
 *
 *   op run --env-file=scripts/.env.r2 -- bun scripts/ingest-card-images.ts
 *
 * A resolved secret that reaches stdout is a secret in a transcript.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { S3Client } from "bun";
import sharp from "sharp";

import {
  coldFoilSiblingKey,
  FACE_TIERS,
  faceKeyFor,
  type FaceTier,
} from "../apps/site/src/lib/faces";

/** Must equal `BUCKET_NAME` in `apps/images/src/face.ts` and the
 * `bucket_name` in `apps/images/wrangler.jsonc`. Public, not a secret. */
const BUCKET_NAME = "optfall-card-faces";

/**
 * WebP quality.
 *
 * 82 rather than the more usual 75: this is card art whose whole job is to be
 * legible enough to read a stat line off, and the artefacts of aggressive
 * chroma quantisation land exactly on the printed text. Measured on a sampled
 * face, 82 costs about 12 KB over 75 at the `normal` tier and removes visible
 * ringing on the type.
 */
const WEBP_QUALITY = 82;

/**
 * How many faces are in flight at once.
 *
 * Deliberately modest. These are LSS's own hosts and there is no rush — the
 * whole corpus is a one-off, and the scheduled re-run afterwards touches only
 * what upstream added. Being the downstream consumer that hammers somebody's
 * CDN is how a project loses an art licence it was granted for free.
 */
const DEFAULT_CONCURRENCY = 8;

interface Printing {
  readonly image_url: string | null;
}

interface Card {
  readonly printings: readonly Printing[];
}

interface Corpus {
  readonly cards: readonly Card[];
}

/**
 * The R2 client, built from the environment.
 *
 * EVERY VARIABLE IS CHECKED BEFORE ANY IS USED, and the error names all of the
 * missing ones at once. A tool that runs for an hour should not fail on the
 * second credential after the reader has already fixed the first.
 *
 * Values are read, held in-process and never echoed. `S3Client` keeps them for
 * request signing; nothing here logs them, and nothing should add a debug line
 * that does.
 */
function r2Client(): S3Client {
  const required = [
    "CLOUDFLARE_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
  ] as const;

  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")}. R2's S3 API needs an access key pair, ` +
        `and wrangler stores no such pair to be read out of. Supply them ` +
        `without putting a secret in your shell history:\n\n` +
        `  op run --env-file=scripts/.env.r2 -- bun scripts/ingest-card-images.ts\n`,
    );
  }

  /* Every name above is present and non-empty, checked directly. `process.env`
     is typed `string | undefined` regardless, and `exactOptionalPropertyTypes`
     will not take that for these fields — so the narrowing is spelled here,
     beside the check that earns it, rather than at each use. */
  const value = (name: (typeof required)[number]): string =>
    process.env[name] as string;

  return new S3Client({
    accessKeyId: value("R2_ACCESS_KEY_ID"),
    secretAccessKey: value("R2_SECRET_ACCESS_KEY"),
    bucket: BUCKET_NAME,
    /* R2's S3 endpoint is per account. `auto` is the only region it accepts. */
    endpoint: `https://${value("CLOUDFLARE_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    region: "auto",
  });
}

/**
 * The MD5 an S3 ETag would carry for these bytes.
 *
 * See the header: this is an integrity comparison against art we fetched
 * ourselves, not a security boundary.
 */
function md5(bytes: Uint8Array): string {
  return new Bun.CryptoHasher("md5").update(bytes).digest("hex");
}

/** An ETag as stored, reduced to a comparable digest — or null if it is not one. */
function etagDigest(etag: string | undefined): string | null {
  if (etag === undefined) return null;
  const unquoted = etag.replace(/^"|"$/g, "");
  /* `<md5>-<parts>` is a multipart upload and is not an MD5 of the content.
     Nothing this tool writes should ever be multipart; if one is, say so
     rather than silently treating a non-comparable value as a mismatch. */
  return unquoted.includes("-") ? null : unquoted;
}

/** One face to ingest: the key it lands at, and where to fetch it from. */
interface Face {
  readonly key: string;
  readonly url: string;
}

/**
 * Every distinct face in the corpus, in a stable order.
 *
 * Sorted by key so two runs enumerate the same work in the same sequence — a
 * resumable job whose order depends on object iteration is a job whose progress
 * numbers mean nothing.
 */
function facesFrom(corpus: Corpus): {
  readonly faces: readonly Face[];
  readonly printingsWithoutImage: number;
  readonly totalPrintings: number;
} {
  const byKey = new Map<string, string>();
  let printingsWithoutImage = 0;
  let totalPrintings = 0;

  for (const card of corpus.cards) {
    for (const printing of card.printings) {
      totalPrintings += 1;
      const key = faceKeyFor(printing.image_url);
      if (key === null) {
        printingsWithoutImage += 1;
        continue;
      }
      // First URL seen wins. The only basename served from two hosts today is
      // byte-identical on both, so this is a choice between equals; the hash
      // check on write is what catches the day that stops being true.
      if (!byKey.has(key)) byKey.set(key, printing.image_url as string);
    }
  }

  const faces = [...byKey.entries()]
    .map(([key, url]) => ({ key, url }))
    .toSorted((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  return { faces, printingsWithoutImage, totalPrintings };
}
/**
 * Transcode one source image to one tier.
 *
 * `fit: "inside"` with `withoutEnlargement` is the whole safety property: a
 * source narrower than the tier (the 450-wide CloudFront distribution, at the
 * `normal` tier) is left at its own size rather than upscaled. Optfall does not
 * invent pixels — a card face that has been enlarged is asserting detail the
 * publisher never printed.
 */
async function transcode(
  source: Uint8Array,
  tier: FaceTier,
): Promise<Uint8Array> {
  const { width, height } = FACE_TIERS[tier];
  const out = await sharp(source)
    .rotate() // Honour EXIF orientation before measuring anything.
    .resize({ width, height, fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
  return new Uint8Array(out);
}

interface Outcome {
  written: number;
  skipped: number;
  /**
   * Faces upstream publishes a URL for but does not actually serve — a `403` or
   * `404` from the host.
   *
   * DELIBERATELY NOT COUNTED AS A FAILURE. Measured on the first full run: all
   * of them are `-CF` cold-foil variants from one set, which upstream lists in
   * the dataset and does not make public. That is a permanent property of
   * somebody else's catalogue, not a fault in this tool, and a scheduled job
   * that goes red forever over it is a job whose red means nothing. These
   * printings render NO IMAGE, which is the honest outcome.
   */
  unavailable: string[];
  /**
   * Faces that failed for any other reason — a network error, a 5xx, a source
   * sharp could not decode. These ARE failures: they are transient or they are
   * a bug, and either way the next run should retry them.
   */
  failed: number;
  clashes: string[];
  bytesOut: number;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const force = argv.includes("--force");
  const numberAfter = (flag: string, fallback: number): number => {
    const index = argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = Number(argv[index + 1]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  };
  const limit = numberAfter("--limit", Number.POSITIVE_INFINITY);
  const concurrency = numberAfter("--concurrency", DEFAULT_CONCURRENCY);

  const corpusPath = join(import.meta.dir, "..", "data", "cards", "cards.json");
  const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as Corpus;
  const { faces, printingsWithoutImage, totalPrintings } = facesFrom(corpus);

  console.log(
    `corpus: ${totalPrintings.toLocaleString("en-GB")} printings → ` +
      `${faces.length.toLocaleString("en-GB")} distinct faces ` +
      `(${printingsWithoutImage} printings publish no image)`,
  );

  const store = r2Client();

  // Listed ONCE. Doing this per face would be 22,754 extra round trips to learn
  // something one call already knows.
  //
  // PAGINATED, AND THAT IS LOAD-BEARING. S3 caps a listing at 1,000 keys per
  // call and reports `isTruncated`; a full bucket is ~22,754 keys, so a single
  // un-paginated call would report 4% of the bucket as the whole of it — and
  // every key it did not see would be re-transcoded and re-uploaded on every
  // run. Silent, slow and expensive rather than wrong, which is the kind of bug
  // that survives a long time.
  const present = new Set<string>();
  if (!force) {
    let startAfter: string | undefined;
    for (;;) {
      const page = await store.list(
        startAfter === undefined
          ? { maxKeys: 1000 }
          : { maxKeys: 1000, startAfter },
      );
      for (const entry of page.contents ?? []) present.add(entry.key);
      if (!page.isTruncated) break;
      startAfter = page.contents?.at(-1)?.key;
      /* Defensive: a truncated page with no last key would loop forever. */
      if (startAfter === undefined) break;
    }
    console.log(
      `bucket: ${present.size.toLocaleString("en-GB")} keys already present`,
    );
  }

  const tiers = Object.keys(FACE_TIERS) as FaceTier[];
  const pending = faces
    .filter(
      (face) =>
        force || tiers.some((tier) => !present.has(`${tier}/${face.key}`)),
    )
    .slice(0, limit === Number.POSITIVE_INFINITY ? undefined : limit);

  console.log(
    `to do: ${pending.length.toLocaleString("en-GB")} faces × ${tiers.length} tiers` +
      (dryRun ? " (dry run — nothing will be written)" : ""),
  );
  if (pending.length === 0) {
    console.log("nothing to do.");
    return;
  }
  if (dryRun) {
    for (const face of pending.slice(0, 10))
      console.log(`  ${face.key}  ←  ${face.url}`);
    if (pending.length > 10) console.log(`  … and ${pending.length - 10} more`);
    return;
  }

  const outcome: Outcome = {
    written: 0,
    skipped: 0,
    unavailable: [],
    failed: 0,
    clashes: [],
    bytesOut: 0,
  };
  const startedAt = Date.now();
  let cursor = 0;

  /** One face at one tier: transcode, compare, write. */
  const ingestTier = async (
    face: Face,
    source: Uint8Array,
    tier: FaceTier,
  ): Promise<void> => {
    const objectKey = `${tier}/${face.key}`;
    const bytes = await transcode(source, tier);

    if (!force && present.has(objectKey)) {
      // Present already, and we have just recomputed what we would write. If it
      // differs, two genuinely different images want the same key.
      const stat = await store.stat(objectKey);
      const existing = etagDigest(stat.etag);
      if (existing !== null && existing !== md5(bytes)) {
        outcome.clashes.push(objectKey);
        console.error(
          `  ‼ ${objectKey} — a different image already occupies this key. ` +
            `Not overwriting. Source: ${face.url}`,
        );
        return;
      }
      outcome.skipped += 1;
      return;
    }

    await store.write(objectKey, bytes, { type: "image/webp" });
    outcome.written += 1;
    outcome.bytesOut += bytes.byteLength;
  };

  /**
   * One face: fetched once, written to every tier.
   *
   * The tiers go through `Promise.all` rather than a loop because they are
   * genuinely independent given the source bytes — and because a sequential
   * `await` inside a `for` is what `no-await-in-loop` exists to catch. Two
   * tiers is a small enough fan-out that the extra peak memory is a rounding
   * error against the downloaded source already in hand.
   */
  const ingestFace = async (face: Face): Promise<void> => {
    try {
      const response = await fetch(face.url);
      if (!response.ok) {
        // 403/404 is upstream saying "that URL is not public" — a fact about
        // their catalogue, recorded rather than retried. Anything else is a
        // failure worth retrying on the next run.
        if (response.status === 403 || response.status === 404) {
          outcome.unavailable.push(face.key);
        } else {
          outcome.failed += 1;
          console.warn(`  ✗ ${face.key} — upstream ${response.status}`);
        }
        return;
      }
      const source = new Uint8Array(await response.arrayBuffer());
      await Promise.all(tiers.map((tier) => ingestTier(face, source, tier)));
    } catch (error) {
      outcome.failed += 1;
      console.warn(
        `  ✗ ${face.key} — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const reportProgress = (done: number): void => {
    if (done % 100 !== 0 && done !== pending.length) return;
    const elapsed = (Date.now() - startedAt) / 1000;
    const rate = done / Math.max(elapsed, 1);
    const left = Math.round((pending.length - done) / Math.max(rate, 0.01));
    console.log(
      `  ${done.toLocaleString("en-GB")}/${pending.length.toLocaleString("en-GB")} ` +
        `faces · ${outcome.written.toLocaleString("en-GB")} objects written · ` +
        `${(outcome.bytesOut / 1e6).toFixed(0)} MB · ` +
        `${rate.toFixed(1)}/s · ~${Math.floor(left / 60)}m left`,
    );
  };

  /**
   * One worker, draining the shared cursor.
   *
   * Recursive rather than a `for(;;)` loop, which is the same shape without the
   * `await`-in-loop that a worker pool would otherwise be flagged for. The
   * recursion does not grow the stack: `return worker()` hands back a promise
   * rather than awaiting it, so each frame is discarded before the next runs.
   */
  const worker = async (): Promise<void> => {
    const index = cursor;
    cursor += 1;
    const face = pending[index];
    if (!face) return;

    await ingestFace(face);
    reportProgress(index + 1);
    return worker();
  };

  await Promise.all(Array.from({ length: concurrency }, worker));

  /*
   * SECOND PHASE — bytes for the Cold Foil substitutes.
   *
   * Upstream withholds the art for a handful of `-CF` printings while serving
   * their non-foil siblings, so `apps/images/src/face.ts` falls back to the
   * sibling and labels the response `x-optfall-face: substitute`. That fallback
   * is a store lookup, so it only works if the sibling's bytes are actually in
   * the bucket.
   *
   * ALMOST ALL OF THEM ALREADY ARE, because the sibling is usually its own
   * printing and therefore its own face in the corpus. The exception is a
   * sibling no printing references — today exactly one, `FAB402` — which nothing
   * else would ever fetch. This phase fetches precisely those.
   *
   * IT IS DERIVED, NOT A LIST. Hard-coding the eighteen keys would be correct
   * today and silently wrong the next time upstream withholds a different one;
   * this asks the run what it actually failed to get.
   */
  const coldFoilGaps = outcome.unavailable.filter(
    (key) => coldFoilSiblingKey(key) !== null,
  );
  if (coldFoilGaps.length > 0) {
    const urlByKey = new Map(faces.map((face) => [face.key, face.url]));
    const faceKeys = new Set(faces.map((face) => face.key));

    const substitutes: Face[] = coldFoilGaps.flatMap((key) => {
      const sibling = coldFoilSiblingKey(key);
      if (sibling === null) return [];
      /* A sibling that is its own printing was already fetched by the main
         pass. Only the orphans need anything. */
      if (faceKeys.has(sibling)) return [];
      const url = urlByKey.get(key);
      if (url === undefined) return [];
      return [{ key: sibling, url: url.replace(/-CF(?=\.[^.]+$)/, "") }];
    });

    /* SAID OUT LOUD EVEN WHEN THERE IS NOTHING TO DO. The first version of this
       phase logged only when it had work, and a key-shape bug meant it never
       had any — so it reported nothing, which is indistinguishable from not
       running at all. It cost two clean runs and a round of instrumentation to
       notice. A phase that decides something should say what it decided. */
    console.log(
      `\ncold foil: ${coldFoilGaps.length} gap(s) — ` +
        `${coldFoilGaps.length - substitutes.length} sibling(s) already held, ` +
        `${substitutes.length} to fetch`,
    );
    for (const face of substitutes) await ingestFace(face);
  }

  const elapsed = ((Date.now() - startedAt) / 1000 / 60).toFixed(1);
  console.log(
    `\ndone in ${elapsed}m — ${outcome.written.toLocaleString("en-GB")} written, ` +
      `${outcome.skipped.toLocaleString("en-GB")} already present, ` +
      `${outcome.unavailable.length.toLocaleString("en-GB")} not published by upstream, ` +
      `${outcome.failed.toLocaleString("en-GB")} failed, ` +
      `${(outcome.bytesOut / 1e6).toFixed(0)} MB uploaded`,
  );

  // DEGRADE VISIBLY. A face upstream will not serve is a permanent hole in the
  // product, and the project rule is that a surface must show what it does not
  // know rather than quietly showing less. So the list is printed in full and
  // grouped by set — a whole set going dark is a different problem from a
  // handful of promos, and the shape of the list is what tells them apart.
  if (outcome.unavailable.length > 0) {
    const bySet = new Map<string, number>();
    for (const key of outcome.unavailable) {
      const set = /^([A-Za-z]+)/.exec(key)?.[1] ?? "?";
      bySet.set(set, (bySet.get(set) ?? 0) + 1);
    }
    const summary = [...bySet.entries()]
      .toSorted((a, b) => b[1] - a[1])
      .map(([set, count]) => `${set}×${count}`)
      .join(", ");
    console.log(
      `\n${outcome.unavailable.length} face(s) upstream lists but does not serve ` +
        `(these render NO IMAGE): ${summary}`,
    );
  }

  if (outcome.clashes.length > 0) {
    console.error(
      `\n${outcome.clashes.length} key clash(es) — two different images wanting ` +
        `one key. The basename rule in apps/site/src/lib/faces.ts needs a ` +
        `tiebreak before these can be stored:\n  ${outcome.clashes.join("\n  ")}`,
    );
    process.exit(1);
  }
  // Transient failures only — upstream's own 403s are counted separately above
  // and never fail the run, because a scheduled job that goes red forever over
  // somebody else's catalogue is a job whose red means nothing.
  if (outcome.failed > pending.length * 0.02) {
    console.error(
      `\n${outcome.failed} failures is more than 2% of the run — treating that ` +
        `as broken rather than as attrition.`,
    );
    process.exit(1);
  }
}

await main();
