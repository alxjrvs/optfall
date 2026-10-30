#!/usr/bin/env bun
/**
 * Regenerates `data/spoilers/spoilers.json`: cards revealed for sets that are
 * not out yet.
 *
 * WHERE SPOILERS COME FROM, AND WHY IT IS THIS SOURCE. The card corpus already
 * syncs from `the-fab-cube/flesh-and-blood-cards`, and that compilation's own
 * README describes how it handles a set before release: "during spoiler
 * seasons, I spin off feature branches to work in." Those branches carry every
 * card Legend Story Studios has revealed, entered in the same schema as the
 * released corpus, with image URLs on LSS's own S3 bucket. So the source of
 * truth for a spoiler is the source of truth for a card, one stage earlier —
 * no second upstream, no scraped rumour site, and no field this repository
 * does not already know how to read.
 *
 * LSS publishes no machine-readable spoiler feed of its own. Its card gallery
 * pages are HTML for people; scraping them would be a second, brittle copy of
 * the work this upstream already does by hand, and it would arrive without the
 * unique_id that lets a spoiler graduate into the corpus cleanly.
 *
 * WHICH BRANCHES. Every branch except `main` and `develop`, discovered with
 * `git ls-remote` rather than named here, because the branch names are set
 * names (`outbreak`, `usurp-the-shadow-throne`) and a list of them would go
 * stale every season. A branch that lingers after its set releases contributes
 * nothing, because of the predicate below.
 *
 * WHAT COUNTS AS A SPOILER. A card on a feature branch that
 *
 *   1. is not in `data/cards/cards.json` (by `unique_id`), and
 *   2. has a printing in a set that, according to that branch's own
 *      `set.json`, had not been released when the branch's head was committed
 *      — either no release date at all, or one after the commit.
 *
 * The first clause is how a spoiler leaves this page: the next corpus sync
 * carries the card and it drops out here on the following run. The second
 * keeps out cards that are merely newer than our corpus pin — a card from a set
 * already on shelves is a corpus sync waiting to happen, not a spoiler. It is
 * judged against the COMMIT's date rather than today's so that two runs against
 * the same upstream commits produce the same bytes, the same rule
 * `build-card-corpus.ts` follows for the same reason: a non-empty diff should
 * mean the spoilers changed, not that the clock moved.
 *
 * A reprint revealed for an upcoming set is NOT listed. Its `unique_id` is
 * already in the corpus, so clause 1 excludes it, and that is the honest
 * outcome: its text is not news, and it already has a card page.
 *
 * WHAT IS CARRIED. Enough to read the card — name, pitch, stats, types and
 * printed text — and the collector number and rarity of each printing in an
 * unreleased set. No legality (an unreleased card is legal nowhere yet), no
 * images (faces are served from our own host after an ingest this does not
 * run), no artists or flavour text. Field names are upstream's, verbatim, as
 * in the card corpus.
 *
 * NO TIMESTAMP OF OUR OWN. The only dates written are the upstream commits'
 * own, so an unchanged upstream yields a byte-identical file and the daily job
 * that runs this has nothing to commit.
 *
 * USAGE
 *
 *   bun run spoilers
 *
 * Network: `git ls-remote` and a blobless, depth-1 fetch against github.com,
 * plus two raw files per branch from raw.githubusercontent.com. No token.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { ROOT } from "./lib/root";

/** Bumped when the shape of the file changes. */
const SCHEMA_VERSION = 1;

const UPSTREAM_REPOSITORY = "the-fab-cube/flesh-and-blood-cards";
const UPSTREAM_GIT = `https://github.com/${UPSTREAM_REPOSITORY}.git`;
const CARD_PATH = "json/english/card.json";
const SET_PATH = "json/english/set.json";

/** Upstream's long-lived branches. Everything else is a set in progress. */
const NOT_SPOILER_BRANCHES: ReadonlySet<string> = new Set(["main", "develop"]);

const OUT_FILE = join(ROOT, "data/spoilers/spoilers.json");
const CORPUS_FILE = join(ROOT, "data/cards/cards.json");

/**
 * The card corpus's rights notice, with "this dataset" meaning this one. Kept
 * in the data for the reason `build-card-corpus.ts` gives: a file that travels
 * without it invites the one use the permission forbids.
 */
const RIGHTS =
  "Card names and card text are the property of Legend Story Studios. " +
  "Optfall is in no way affiliated with Legend Story Studios. This dataset displays that " +
  "content under LSS's third-party application policy and does not relicense it. Only " +
  "Optfall's structural work over the dataset — the selection, the upstream pins and " +
  "this envelope — is openly licensed. The upstream compilation is " +
  `https://github.com/${UPSTREAM_REPOSITORY}, which publishes no licence of its own.`;

/** Card fields carried, in written order. All strings upstream. */
const CARD_TEXT_FIELDS = [
  "unique_id",
  "name",
  "pitch",
  "cost",
  "power",
  "defense",
  "health",
  "intelligence",
  "arcane",
  "type_text",
  "functional_text",
] as const;

type JsonRecord = Readonly<Record<string, unknown>>;

interface Source {
  readonly branch: string;
  readonly commit: string;
  readonly committedAt: string;
}

interface SpoilerPrinting {
  readonly id: string;
  readonly set_id: string;
  readonly rarity: string;
}

type SpoilerCard = Record<(typeof CARD_TEXT_FIELDS)[number], string> & {
  readonly types: readonly string[];
  readonly printings: readonly SpoilerPrinting[];
};

interface SpoilerSet {
  readonly id: string;
  readonly name: string;
  /** `YYYY-MM-DD`, or `null` where upstream has no date yet. */
  readonly released: string | null;
}

function git(args: readonly string[], cwd?: string): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed:\n${result.stderr}`);
  }
  return result.stdout;
}

/** Every upstream branch that is a set in progress, with its head commit. */
function spoilerBranches(): readonly { branch: string; commit: string }[] {
  return git(["ls-remote", "--heads", UPSTREAM_GIT])
    .trim()
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => {
      const [commit = "", ref = ""] = line.split("\t");
      return { branch: ref.replace(/^refs\/heads\//, ""), commit };
    })
    .filter(({ branch }) => !NOT_SPOILER_BRANCHES.has(branch))
    .toSorted((a, b) => a.branch.localeCompare(b.branch));
}

/**
 * A commit's own date, in UTC to the second.
 *
 * Read from a blobless, depth-1 fetch rather than the REST API so the script
 * needs no token and is not subject to the API's unauthenticated rate limit.
 * The fetch downloads the commit and its trees and no file contents.
 */
function committedAt(commit: string): string {
  const scratch = mkdtempSync(join(tmpdir(), "optfall-spoilers-"));
  try {
    git(["init", "--quiet", "--bare"], scratch);
    git(
      [
        "fetch",
        "--quiet",
        "--depth=1",
        "--filter=blob:none",
        UPSTREAM_GIT,
        commit,
      ],
      scratch,
    );
    const iso = git(["log", "-1", "--format=%cI", commit], scratch).trim();
    return new Date(iso).toISOString().replace(/\.\d{3}Z$/, "Z");
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

async function fetchJson(commit: string, path: string): Promise<unknown> {
  const url = `https://raw.githubusercontent.com/${UPSTREAM_REPOSITORY}/${commit}/${path}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url}: HTTP ${response.status}`);
  }
  return response.json();
}

function records(value: unknown, where: string): readonly JsonRecord[] {
  if (!Array.isArray(value)) throw new Error(`${where}: expected an array`);
  return value as readonly JsonRecord[];
}

function text(record: JsonRecord, key: string, where: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new Error(`${where}: "${key}" is not a string`);
  }
  return value;
}

/**
 * Each set's earliest release date on this branch, or `null` for a set with
 * no dated printing. Keyed by set code.
 */
function releaseDates(sets: readonly JsonRecord[]): Map<string, string | null> {
  const dates = new Map<string, string | null>();
  for (const set of sets) {
    const id = text(set, "id", "set.json");
    const dated = records(set["printings"], `set ${id}`)
      .map((printing) => printing["initial_release_date"])
      .filter((date): date is string => typeof date === "string")
      .toSorted();
    dates.set(id, dated[0] ?? null);
  }
  return dates;
}

function setNames(sets: readonly JsonRecord[]): Map<string, string> {
  return new Map(
    sets.map((set) => [
      text(set, "id", "set.json"),
      text(set, "name", "set.json"),
    ]),
  );
}

const corpus = (await Bun.file(CORPUS_FILE).json()) as {
  readonly cards: readonly { readonly unique_id: string }[];
};
const released = new Set(corpus.cards.map((card) => card.unique_id));

const sources: Source[] = [];
/** By unique_id; a later (newer) branch's copy replaces an earlier one's. */
const cards = new Map<string, { card: SpoilerCard; at: string }>();
const sets = new Map<string, SpoilerSet>();

for (const { branch, commit } of spoilerBranches()) {
  const at = committedAt(commit);
  sources.push({ branch, commit, committedAt: at });

  const branchSets = records(await fetchJson(commit, SET_PATH), SET_PATH);
  const dates = releaseDates(branchSets);
  const names = setNames(branchSets);
  const unreleased = (setId: string): boolean => {
    const date = dates.get(setId);
    return date === null || (date !== undefined && date > at);
  };

  const upstream = records(await fetchJson(commit, CARD_PATH), CARD_PATH);
  let found = 0;

  for (const card of upstream) {
    const id = text(card, "unique_id", CARD_PATH);
    if (released.has(id)) continue;

    const where = `${branch} card ${id}`;
    const seen = new Set<string>();
    const printings: SpoilerPrinting[] = [];
    for (const printing of records(card["printings"], where)) {
      const setId = text(printing, "set_id", where);
      const number = text(printing, "id", where);
      if (!unreleased(setId) || seen.has(number)) continue;
      seen.add(number);
      printings.push({
        id: number,
        set_id: setId,
        rarity: text(printing, "rarity", where),
      });
    }
    if (printings.length === 0) continue;

    const previous = cards.get(id);
    if (previous !== undefined && previous.at > at) continue;

    const fields = Object.fromEntries(
      CARD_TEXT_FIELDS.map((key) => [key, text(card, key, where)]),
    ) as Record<(typeof CARD_TEXT_FIELDS)[number], string>;
    const types = records(card["types"], where).map(String);
    cards.set(id, {
      card: {
        ...fields,
        types,
        printings: printings.toSorted((a, b) => a.id.localeCompare(b.id)),
      },
      at,
    });
    found += 1;

    for (const { set_id } of printings) {
      const date = dates.get(set_id) ?? null;
      sets.set(set_id, {
        id: set_id,
        name: names.get(set_id) ?? set_id,
        released: date === null ? null : date.slice(0, 10),
      });
    }
  }

  console.log(`${branch} @ ${commit.slice(0, 7)} (${at}): ${found} spoilers`);
}

/* Undated sets last: calling an undated set the soonest is a claim the data
   does not make. Within a date, by code, so the order is a function of the
   data alone. */
const orderedSets = [...sets.values()].toSorted(
  (a, b) =>
    (a.released ?? "9999").localeCompare(b.released ?? "9999") ||
    a.id.localeCompare(b.id),
);

/* By collector number, then name and pitch: a function of the data, not of
   which branch was read first. */
const orderedCards = [...cards.values()]
  .map(({ card }) => card)
  .toSorted(
    (a, b) =>
      (a.printings[0]?.id ?? "").localeCompare(b.printings[0]?.id ?? "") ||
      a.name.localeCompare(b.name) ||
      a.pitch.localeCompare(b.pitch),
  );

const output = {
  schemaVersion: SCHEMA_VERSION,
  repository: UPSTREAM_REPOSITORY,
  sources,
  rights: RIGHTS,
  counts: { cards: orderedCards.length, sets: orderedSets.length },
  sets: orderedSets,
  cards: orderedCards,
};

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `wrote ${orderedCards.length} spoilers across ${orderedSets.length} sets`,
);
