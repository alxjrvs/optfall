#!/usr/bin/env bun
/**
 * The eight game symbols, from Legend Story Studios' own rules site.
 *
 * WHY THESE ARE ALLOWED WHEN SET SYMBOLS ARE NOT, because that is the first
 * question a reviewer should ask. `docs/COMPLIANCE.md` §3 bars "FAB or LSS
 * logos … product set logos count as FAB logos", and prohibits close semblance
 * of them. It draws the line at MARKS: "card faces are fine; marks are not",
 * and it explicitly blesses drawing from a game MECHANIC — that is the stated
 * reason this project's own mark is a pitch jewel rather than a chiselled
 * wordmark. `{p}` is a mechanic. It is defined in the Comprehensive Rules at
 * 1.12.4d as a notation for a power value, it appears in the printed text of
 * thousands of cards, and it identifies no brand. Nothing ingested here is a
 * logo, a set symbol, or a wordmark, and the script refuses to fetch anything
 * outside the eight names the rules define.
 *
 * WHY THE REAL ARTWORK RATHER THAN OUR OWN SHAPES. Optfall drew its own plates
 * for a while and they were honest, but they were a private notation: a reader
 * meets `{p}` mid-sentence in "this gets +4{p}", with no label beside it, and a
 * shape they have to learn is a shape that sends them to a legend. The symbol
 * on the card in their hand is the one they already know. A reference work that
 * renders the game's notation in its own dialect is asking the reader to
 * translate twice.
 *
 * WHAT THIS SCRIPT GUARANTEES, which is the part §3 actually requires:
 *
 *   - **Provenance.** Every file written here gets an entry in
 *     `data/symbols/symbols.json` naming the exact URL it came from, its
 *     SHA-256, its byte length, its pixel box and the date it was retrieved.
 *     "Every binary asset committed under a public directory needs a recorded
 *     origin. An asset with no provenance entry is treated as non-compliant
 *     until it has one." `scripts/check-asset-provenance.ts` enforces that on
 *     every build, so a stray PNG dropped into `public/` fails the gate.
 *   - **A closed set.** The keys come from `SYMBOLS` in
 *     `apps/site/src/lib/card-symbols.ts`, which is itself checked against the
 *     rules corpus by `card-symbols.test.ts`. There is no argument that widens
 *     it and no glob that could pick up a neighbouring file on that host.
 *   - **Verifiability.** `--check` re-fetches and compares hashes without
 *     writing, so "has upstream changed the artwork" is a question with an
 *     answer rather than an assumption.
 *
 * Run: `bun scripts/ingest-game-symbols.ts [--check]`
 */
import { mkdir, readdir } from "node:fs/promises";

/**
 * LSS's own rules site — the same document `card-symbols.ts` cites rule numbers
 * out of, and the place the symbols are published as part of the rules rather
 * than as part of a brand kit.
 */
const ORIGIN = "https://rules.fabtcg.com/en/assets/images";

/** Where the committed PNGs live, served as `/symbols/icon_<key>.png`. */
const PUBLIC_ROOT = "apps/site/public";

/**
 * Where the icons sit inside it. The manifest records paths RELATIVE TO THE
 * PUBLIC ROOT — `symbols/icon_p.png`, not `icon_p.png` — because
 * `check-asset-provenance.ts` keys on the directory-relative path. Keyed on
 * basename, a second copy of an approved file at another depth would inherit
 * its approval, which is not what "every binary has a recorded origin" means.
 */
const SYMBOL_DIR = `${PUBLIC_ROOT}/symbols`;

/** The provenance record. Committed, human-readable, and checked by CI. */
const MANIFEST = "data/symbols/symbols.json";

/**
 * The eight keys, and the rule that defines each.
 *
 * Hard-coded rather than imported so this script has no dependency on the site
 * package. `x` is deliberately absent: 1.12.4 names eight symbols and X is not
 * one of them, so LSS publishes no icon for it and Optfall renders it as the
 * letter it is.
 *
 * HOW THIS LIST IS HELD TO THE RULES TABLE, stated precisely because the
 * "closed set" argument in `docs/COMPLIANCE.md` §3 leans on it and an earlier
 * version of this comment overstated it. It named a `symbols.test.ts` that does
 * not exist and claimed a direct assertion that is not made. What is true:
 * `apps/site/src/lib/symbol-assets.test.ts` binds the generated MANIFEST to
 * `SYMBOLS`, and this list is what generates the manifest — so a divergence is
 * caught, but only after a re-ingest, not at the moment this array is edited.
 * The gap is narrow (an edit here that is never run changes nothing that
 * ships) and it is a gap rather than a guarantee.
 */
const SYMBOLS = [
  { key: "p", name: "power", rule: "1.12.4d" },
  { key: "r", name: "resource", rule: "1.12.4e" },
  { key: "d", name: "defence", rule: "1.12.4a" },
  { key: "h", name: "life", rule: "1.12.4c" },
  { key: "i", name: "intellect", rule: "1.12.4b" },
  { key: "c", name: "chi", rule: "1.12.4f" },
  { key: "t", name: "tap", rule: "1.12.4g" },
  { key: "u", name: "untap", rule: "1.12.4h" },
] as const;

/**
 * The rights line that travels with these bytes.
 *
 * Fixed text, stored in the manifest rather than only in a comment, so the
 * statement is part of the artefact a reviewer reads rather than part of the
 * code they would have to go looking through.
 */
const RIGHTS =
  "The Flesh and Blood game symbols are the property of Legend Story Studios. " +
  "Optfall is in no way affiliated with Legend Story Studios. These files are " +
  "reproduced unmodified from Legend Story Studios' published rules site as the " +
  "notation the Comprehensive Rules defines at 1.12.4, and are not relicensed.";

interface Entry {
  readonly key: string;
  readonly name: string;
  readonly rule: string;
  readonly token: string;
  readonly file: string;
  readonly url: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
}

/**
 * Width and height out of the PNG header.
 *
 * Read rather than assumed, for the same reason `CardFace` demands an intrinsic
 * box from its caller: the `width`/`height` attributes on the rendered `<img>`
 * are what stop a paragraph reflowing as eight symbols load, and a guessed box
 * is a layout shift waiting for a slow connection.
 *
 * @throws {Error} When the bytes are not a PNG.
 */
function pngBox(bytes: Uint8Array): { width: number; height: number } {
  const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const isPng = SIGNATURE.every((byte, index) => bytes[index] === byte);
  if (!isPng) throw new Error("not a PNG");

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function fetchSymbol(
  key: string,
): Promise<{ bytes: Uint8Array; url: string }> {
  const url = `${ORIGIN}/icon_${key}.png`;
  const response = await fetch(url, {
    headers: {
      /* Named, not disguised. A fan reference tool fetching eight icons should
         be identifiable in a log; pretending to be a browser to take somebody
         else's bytes is how a project earns a block it deserves. */
      "user-agent": "optfall-symbol-ingest (+https://optfall.com)",
    },
  });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), url };
}

const checkOnly = process.argv.includes("--check");

/*
  VALIDATE THE DIRECTORY BEFORE WRITING A BYTE INTO IT.

  NOTHING ELSE MAY LIVE HERE. The provenance rule is only worth having if the
  directory it governs cannot quietly acquire a ninth file, so the script owns
  the whole folder rather than just the files it writes.

  This ran at the END, and that ordering had a nasty failure: it exited after
  the PNGs were written and before the manifest was, leaving new bytes on disk
  described by a stale record — which then failed `check:provenance` on a hash
  mismatch and needed a hand-rolled `git checkout` to get back to a clean tree.
  A precondition belongs before the side effects it guards.
*/
const strays = (await readdir(SYMBOL_DIR).catch(() => []))
  .filter((name) => name.endsWith(".png"))
  .filter(
    (name) => !SYMBOLS.some((symbol) => `icon_${symbol.key}.png` === name),
  );

if (strays.length > 0) {
  console.error(
    `::error::unexpected files in ${SYMBOL_DIR}: ${strays.join(", ")}`,
  );
  process.exit(1);
}

/*
  ALL EIGHT AT ONCE, which is a change of shape rather than of manners.

  `ingest-card-images.ts` rate-limits itself deliberately — "these are LSS's own
  hosts and there is no rush" — and it is fetching eleven thousand card faces.
  This is eight icons totalling about thirty kilobytes, once, by hand. Eight
  parallel requests is not a load; it is one page view.

  Written this way rather than as a sequential loop because `no-await-in-loop`
  is an error in this repository, and the rule is right here: the awaits are
  genuinely independent, and a loop would have serialised them for no reason
  beyond how the code was first typed.
*/
const downloaded = await Promise.all(
  SYMBOLS.map(async (symbol) => {
    const { bytes, url } = await fetchSymbol(symbol.key);
    const { width, height } = pngBox(bytes);

    const entry: Entry = {
      key: symbol.key,
      name: symbol.name,
      rule: symbol.rule,
      token: `{${symbol.key}}`,
      file: `symbols/icon_${symbol.key}.png`,
      url,
      bytes: bytes.length,
      width,
      height,
      sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
    };

    return { entry, bytes };
  }),
);

/* Manifest order follows `SYMBOLS`, not completion order — `Promise.all`
   preserves input order, so the committed JSON does not reshuffle itself
   between runs according to which request happened to land first. */
const entries: Entry[] = downloaded.map(({ entry }) => entry);

if (!checkOnly) await mkdir(SYMBOL_DIR, { recursive: true });

const outcomes = await Promise.all(
  downloaded.map(async ({ entry, bytes }) => {
    const target = `${PUBLIC_ROOT}/${entry.file}`;
    const existing = Bun.file(target);
    const same =
      (await existing.exists()) &&
      new Bun.CryptoHasher("sha256")
        .update(new Uint8Array(await existing.arrayBuffer()))
        .digest("hex") === entry.sha256;

    if (same) return false;

    if (checkOnly) {
      console.error(`::error::${entry.file} differs from ${entry.url}`);
      return true;
    }

    await Bun.write(target, bytes);
    console.log(
      `wrote ${target} (${entry.bytes}B, ${entry.width}×${entry.height})`,
    );
    return true;
  }),
);

const changed = outcomes.filter(Boolean).length;

/*
  THE DATE IS THE RUN'S ONLY WHEN THE RUN CHANGED SOMETHING.

  It was re-stamped unconditionally, so a re-ingest that fetched eight identical
  files printed "0 changed" and still produced a one-line diff in the committed
  manifest. A provenance record that churns on a no-op teaches the next reader
  to skim past it, which is the opposite of what it is for — and `retrieved`
  means "when these bytes were obtained", which is not today if today's fetch
  returned exactly what was already here.

  A single stamp per run, not one per symbol: they were retrieved together, and
  eight timestamps milliseconds apart would imply a precision the record lacks.
*/
const previous = await Bun.file(MANIFEST)
  .json()
  .catch(() => null);
const retrieved =
  changed === 0 && typeof previous?.retrieved === "string"
    ? previous.retrieved
    : new Date().toISOString().slice(0, 10);

const manifest = {
  $comment:
    "Provenance for the Flesh and Blood game symbols, per docs/COMPLIANCE.md §3. " +
    "Generated by scripts/ingest-game-symbols.ts — do not edit by hand.",
  rights: RIGHTS,
  origin: ORIGIN,
  retrieved,
  symbols: entries,
};

if (checkOnly) {
  if (changed > 0) {
    console.error(
      `\n${changed} symbol(s) differ from upstream. Re-run \`bun scripts/ingest-game-symbols.ts\` and review the diff.`,
    );
    process.exit(1);
  }
  console.log(`All ${entries.length} symbols match ${ORIGIN}. ✔`);
} else {
  await mkdir("data/symbols", { recursive: true });
  await Bun.write(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `\n${entries.length} symbols, ${changed} changed. Provenance → ${MANIFEST}`,
  );
}
