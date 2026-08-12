/**
 * build-sets-corpus — the second card corpus: sets, and the tables that decode
 * upstream's single-letter codes.
 *
 * WHY THIS EXISTS. `data/cards/cards.json` gives a printing a `set_id` of
 * `MST`, a `rarity` of `R`, an `edition` of `N` and a `foiling` of `S`, and
 * Optfall has been printing those letters. That is upstream's storage format
 * shown to a reader — "Rarity: R" is a database dump, not a reference work, and
 * a set is a three-letter code with no name and no release date attached.
 *
 * Upstream publishes all four decode tables and a set index; this pulls them in
 * beside the card corpus, pinned to the SAME commit, so a card and its set can
 * never come from two different snapshots.
 *
 * WHAT IT UNLOCKS, in the order it matters:
 *   - Set names and release dates, so a printing reads "Part the Mistveil"
 *     rather than "MST".
 *   - `/sets` — a browsable spine, `docs/SCRYFALL-GAP.md` §2 item 7.
 *   - Rarity, edition and foiling in words.
 *   - The earliest-release default-printing rule that `cards.ts` currently
 *     documents as a stopgap.
 *
 * Usage: bun scripts/build-sets-corpus.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * PINNED TO THE SAME COMMIT AS THE CARD CORPUS, and that is not tidiness. A set
 * index from a later snapshot than the cards would list sets no card in the
 * corpus belongs to, and — worse — could omit one that cards do reference, so a
 * printing would resolve to no set at all. One snapshot, one pin.
 */
const COMMIT = "7a4822f3dab483a52a78206b7ad8696394e02dc0";
const REPOSITORY = "the-fab-cube/flesh-and-blood-cards";
const BASE = `https://raw.githubusercontent.com/${REPOSITORY}/${COMMIT}/json/english`;

const SCHEMA_VERSION = 1;

interface UpstreamSetPrinting {
  readonly edition: string;
  readonly initial_release_date: string | null;
  readonly out_of_print: boolean;
}

interface UpstreamSet {
  readonly unique_id: string;
  readonly id: string;
  readonly name: string;
  readonly printings: readonly UpstreamSetPrinting[];
}

interface CodeRow {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
}

async function fetchJson<T>(file: string): Promise<T> {
  const response = await fetch(`${BASE}/${file}`);
  if (!response.ok) {
    throw new Error(`${file}: upstream answered ${response.status}`);
  }
  return (await response.json()) as T;
}

/** `2024-05-31T00:00:00.000Z` → `2024-05-31`. Anything else, verbatim. */
function dateOf(value: string | null): string | null {
  if (value === null) return null;
  return /^(\d{4}-\d{2}-\d{2})T/.exec(value)?.[1] ?? value;
}

/**
 * A decode table, as `{ code: words }`.
 *
 * `rarity.json` calls its label `description` and the other two call theirs
 * `name`. Normalised here rather than at every call site, because a consumer
 * should not have to know which upstream file a code came from to read it.
 */
function decodeTable(rows: readonly CodeRow[]): Record<string, string> {
  const table: Record<string, string> = {};
  for (const row of rows) {
    const label = (row.name ?? row.description ?? "").trim();
    if (row.id === "" || label === "") continue;
    table[row.id] = label;
  }
  return table;
}

async function main(): Promise<void> {
  const [sets, rarity, edition, foiling] = await Promise.all([
    fetchJson<UpstreamSet[]>("set.json"),
    fetchJson<CodeRow[]>("rarity.json"),
    fetchJson<CodeRow[]>("edition.json"),
    fetchJson<CodeRow[]>("foiling.json"),
  ]);

  const shaped = sets
    .map((set) => {
      /*
        THE SET'S RELEASE DATE IS ITS EARLIEST PRINTING'S. A set is reprinted —
        `MST` has one printing, `WTR` has several — and "when did this set come
        out" means the first time, not the last. Nulls are dropped rather than
        sorted as empty strings, which would put an undated set at the start of
        a chronological list and quietly assert it is the oldest.
      */
      const dates = set.printings
        .map((printing) => dateOf(printing.initial_release_date))
        .filter((date): date is string => date !== null)
        .toSorted();

      return {
        id: set.id,
        name: set.name,
        released: dates[0] ?? null,
        /** True only when EVERY printing is out of print. */
        outOfPrint: set.printings.length > 0 && set.printings.every((p) => p.out_of_print),
        editions: [...new Set(set.printings.map((p) => p.edition))].filter((e) => e !== ""),
      };
    })
    // Sorted by id so the artifact is a function of the data rather than of
    // upstream's file order — the same discipline the card corpus keeps, and
    // what makes a re-sync produce a readable diff.
    .toSorted((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const corpus = {
    schemaVersion: SCHEMA_VERSION,
    source: { repository: REPOSITORY, commit: COMMIT, files: ["set.json", "rarity.json", "edition.json", "foiling.json"] },
    rights:
      "Set names are the property of Legend Story Studios. Optfall is in no way affiliated with Legend Story Studios. Only Optfall's structural work over this data — the field selection, the upstream pin and this envelope — is openly licensed.",
    counts: { sets: shaped.length, dated: shaped.filter((s) => s.released !== null).length },
    decode: {
      rarity: decodeTable(rarity),
      edition: decodeTable(edition),
      foiling: decodeTable(foiling),
    },
    sets: shaped,
  };

  const out = join(import.meta.dir, "..", "data", "sets");
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "sets.json"), `${JSON.stringify(corpus, null, 2)}\n`);

  console.log(
    `${shaped.length} sets (${corpus.counts.dated} with a release date), ` +
      `${Object.keys(corpus.decode.rarity).length} rarities, ` +
      `${Object.keys(corpus.decode.edition).length} editions, ` +
      `${Object.keys(corpus.decode.foiling).length} foilings`,
  );
}

await main();
