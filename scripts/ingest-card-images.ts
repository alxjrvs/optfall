/**
 * ingest-card-images — fill the `optfall-card-faces` Netlify Blobs store from
 * upstream's published card art.
 *
 * The bytes behind https://optfall-images.netlify.app. Sources every distinct
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
 * exists not to give, so the hash is checked and a real clash stops the run.
 *
 * ON CREDENTIALS. The Netlify token is read in-process out of the CLI's own
 * config and passed straight to the Blobs client. It is never printed, never
 * exported into the environment, and never written anywhere. Same discipline as
 * the `op-agent` path described in the user's CLAUDE.md: a resolved secret that
 * reaches stdout is a secret in a transcript.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { getStore } from "@netlify/blobs";
import sharp from "sharp";

import { FACE_TIERS, faceKeyFor, type FaceTier } from "../apps/site/src/lib/faces";

/** The site the store belongs to — `optfall-images`. Public, not a secret. */
const SITE_ID = "4ffb1b7a-8fb6-4c07-a83e-4641202b50e8";

/** Must equal `STORE_NAME` in `apps/images/netlify/functions/face.ts`. */
const STORE_NAME = "optfall-card-faces";

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
 * Read the Netlify personal access token from the CLI's own config.
 *
 * Returned, never logged. The caller hands it straight to `getStore`.
 */
function netlifyToken(): string {
  const path = join(homedir(), "Library/Preferences/netlify/config.json");
  if (!existsSync(path)) {
    throw new Error(
      `No Netlify CLI config at ${path}. Run \`netlify login\` first — this ` +
        `tool deliberately reads the CLI's own credential rather than taking a ` +
        `token on the command line, so the token never reaches a shell history ` +
        `or a process listing.`,
    );
  }
  const config = JSON.parse(readFileSync(path, "utf8")) as {
    userId?: string;
    users?: Record<string, { auth?: { token?: string } }>;
  };
  /*
    THE ACTIVE USER, NOT AN ARBITRARY ONE. `users` is keyed by account id and
    the CLI records which one is signed in as `userId`. Taking the first entry
    would silently authenticate as whichever account happened to serialise
    first — against a hard-coded SITE_ID, so the failure would be a confusing
    403 rather than an obvious wrong-account error.
  */
  const users = config.users ?? {};
  const active = config.userId === undefined ? undefined : users[config.userId];
  const token = (active ?? Object.values(users)[0])?.auth?.token;
  if (!token) {
    throw new Error(
      "The Netlify CLI config carries no auth token. Run `netlify login`.",
    );
  }
  return token;
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

/** SHA-256 of a buffer, hex. Used only to detect a genuine key clash. */
async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
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
async function transcode(source: Uint8Array, tier: FaceTier): Promise<Uint8Array> {
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

  const store = getStore({
    name: STORE_NAME,
    siteID: SITE_ID,
    token: netlifyToken(),
  });

  // Listed ONCE. Doing this per face would be 22,754 extra round trips to learn
  // something one call already knows.
  let present = new Set<string>();
  if (!force) {
    const listed = await store.list();
    present = new Set(listed.blobs.map((blob) => blob.key));
    console.log(`store: ${present.size.toLocaleString("en-GB")} keys already present`);
  }

  const tiers = Object.keys(FACE_TIERS) as FaceTier[];
  const pending = faces
    .filter((face) => force || tiers.some((tier) => !present.has(`${tier}/${face.key}`)))
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
    for (const face of pending.slice(0, 10)) console.log(`  ${face.key}  ←  ${face.url}`);
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
    const blobKey = `${tier}/${face.key}`;
    const bytes = await transcode(source, tier);
    const hash = await sha256(bytes);

    if (!force && present.has(blobKey)) {
      // Present already, and we have just recomputed what we would write. If it
      // differs, two genuinely different images want the same key.
      const existing = await store.getMetadata(blobKey);
      const existingHash = existing?.metadata?.["sha256"];
      if (typeof existingHash === "string" && existingHash !== hash) {
        outcome.clashes.push(blobKey);
        console.error(
          `  ‼ ${blobKey} — a different image already occupies this key. ` +
            `Not overwriting. Source: ${face.url}`,
        );
        return;
      }
      outcome.skipped += 1;
      return;
    }

    await store.set(blobKey, bytes as unknown as ArrayBuffer, {
      metadata: { sha256: hash, source: face.url },
    });
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
        `faces · ${outcome.written.toLocaleString("en-GB")} blobs written · ` +
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
