/**
 * The ingested artwork and the rules table have to describe the same eight
 * symbols, and neither one can tell on its own.
 *
 * `scripts/ingest-game-symbols.ts` hard-codes its key list so it can run
 * without importing the site package; `card-symbols.ts` derives its table from
 * the Comprehensive Rules. Two independent lists of the same closed set is
 * exactly the shape that drifts — a symbol added to the CR and to the table
 * would render as a missing image, and one removed upstream would 404 with no
 * test noticing. These bind them.
 */
import { describe, expect, test } from "bun:test";

import MANIFEST from "../../../../data/symbols/symbols.json";
import { INFERRED, SYMBOLS, assetForSymbol, symbolForKind } from "./card-symbols";

const PUBLIC_DIR = new URL("../../public/symbols/", import.meta.url);

describe("the ingested game symbols", () => {
  test("cover every symbol the rules table names, except the inferred one", () => {
    const published = SYMBOLS.filter((symbol) => !INFERRED.includes(symbol.kind));

    expect(published.length).toBe(MANIFEST.symbols.length);
    for (const symbol of published) {
      expect(assetForSymbol(symbol)).not.toBeNull();
    }
  });

  test("do not cover `{x}`, which the rules' own table does not list", () => {
    /* Not an oversight to be fixed later: 1.12.4 names eight symbols and X is
       not one of them, so there is no artwork to ingest and inventing one would
       be the exact move this project refuses everywhere else. */
    for (const kind of INFERRED) {
      expect(assetForSymbol(symbolForKind(kind))).toBeNull();
    }
  });

  test("each cite the rule that defines them, matching the rules table", () => {
    for (const entry of MANIFEST.symbols) {
      const symbol = SYMBOLS.find((candidate) => candidate.token === entry.token);
      expect(symbol, `no table entry for ${entry.token}`).toBeDefined();
      expect(symbol?.rule).toBe(entry.rule);
    }
  });

  test("are on disk, at the byte length and hash the manifest records", async () => {
    const read = await Promise.all(
      MANIFEST.symbols.map(async (entry) => {
        const file = Bun.file(new URL(entry.file, PUBLIC_DIR));
        const exists = await file.exists();
        const bytes = exists ? new Uint8Array(await file.arrayBuffer()) : new Uint8Array();
        return { entry, exists, bytes };
      }),
    );

    for (const { entry, exists, bytes } of read) {
      expect(exists, `${entry.file} is missing`).toBe(true);
      expect(bytes.length).toBe(entry.bytes);
      expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    }
  });

  test("record an https origin on Legend Story Studios' own rules site", () => {
    /* The compliance argument in `ingest-game-symbols.ts` rests on these coming
       from the RULES site — where the symbols are published as part of the
       rules — rather than from a brand or marketing asset kit. If that ever
       stops being true, the argument stops holding, so it is asserted. */
    for (const entry of MANIFEST.symbols) {
      expect(entry.url.startsWith("https://rules.fabtcg.com/")).toBe(true);
    }
  });

  test("carry a rights statement naming Legend Story Studios", () => {
    expect(MANIFEST.rights).toContain("Legend Story Studios");
    expect(MANIFEST.rights).toContain("not relicensed");
  });
});
