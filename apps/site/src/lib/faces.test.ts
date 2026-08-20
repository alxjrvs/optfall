/**
 * The face-key rule, and the corpus-wide properties it has to hold.
 *
 * The unit tests below are cheap; the corpus assertions are the ones that
 * matter. A key rule that is correct on six hand-written examples and collides
 * on the real 16,502 printings would serve one card's art under another card's
 * name — a confident wrong answer, which is the one failure mode this project
 * is built to not have.
 */
import { describe, expect, test } from "bun:test";

import {
  boxFor,
  CARD_ASPECT_RATIO,
  FACE_TIERS,
  faceKeyFor,
  faceUrl,
  LANDSCAPE_FACE_KEYS,
  orientationOf,
  orientationOfFace,
  placeholderUrl,
  coldFoilSiblingKey,
} from "./faces";
import { CORPUS } from "./cards";

describe("faceKeyFor", () => {
  test("takes the basename and restates the extension as webp", () => {
    expect(
      faceKeyFor(
        "https://storage.googleapis.com/fabmaster/cardfaces/2024-MST/EN/MST131.png",
      ),
    ).toBe("MST131.webp");
    expect(
      faceKeyFor(
        "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/OMN243.webp",
      ),
    ).toBe("OMN243.webp");
  });

  test("keeps a meaningful suffix that is part of the name", () => {
    // `-RF` is rainbow foil — a different piece of art, not a rendition.
    expect(
      faceKeyFor(
        "https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/LGS282-RF.webp",
      ),
    ).toBe("LGS282-RF.webp");
  });

  test("strips a source rendition marker, which is not part of the identity", () => {
    // 2,144 URLs carry this: one host's pipeline stamping the width it served
    // into the file name. Carrying it through would put somebody else's build
    // artefact in our URL space forever.
    expect(
      faceKeyFor(
        "https://dhhim4ltzu1pj.cloudfront.net/media/images/OUT183.width-450.png",
      ),
    ).toBe("OUT183.webp");
    expect(
      faceKeyFor(
        "https://storage.googleapis.com/fabmaster/media/images/1HP001.width-450.png",
      ),
    ).toBe("1HP001.webp");
  });

  test("reports absence as absence", () => {
    // `cards.ts` keeps "there is no image" and "the image is the empty string"
    // apart upstream of here, and so does this.
    expect(faceKeyFor(null)).toBeNull();
    expect(faceKeyFor(undefined)).toBeNull();
    expect(faceKeyFor("")).toBeNull();
  });

  test("malformed percent-encoding is no image rather than an exception", () => {
    // This runs at module scope building CARD_PAGES, so a throw here fails the
    // whole site build rather than degrading one card. No corpus URL contains
    // a `%` today, which is exactly how this would have arrived: on a scheduled
    // sync nobody was watching.
    expect(faceKeyFor("https://example.com/media/%E0%A4%A.png")).toBeNull();
    expect(faceKeyFor("https://example.com/media/%zz.png")).toBeNull();
  });

  test("a malformed URL is no image rather than an exception", () => {
    // Throwing here would take down every page that lists the card. A
    // placeholder is the honest outcome.
    expect(faceKeyFor("not a url")).toBeNull();
    expect(faceKeyFor("https://example.com/")).toBeNull();
  });

  test("rejects anything outside the alphabet the host serves", () => {
    // The host's guard accepts [A-Za-z0-9._-] and nothing else, so a key it
    // would refuse must not be generated in the first place.
    expect(faceKeyFor("https://example.com/a b.png")).toBeNull();
    expect(faceKeyFor("https://example.com/%2e%2e.png")).toBeNull();
  });
});

describe("faceUrl and placeholderUrl", () => {
  test("build the tiered and placeholder addresses", () => {
    expect(faceUrl("MST131.webp", "thumb")).toBe(
      "https://images.optfall.com/thumb/MST131.webp",
    );
    expect(faceUrl("MST131.webp", "normal")).toBe(
      "https://images.optfall.com/normal/MST131.webp",
    );
    expect(placeholderUrl()).toBe(
      "https://images.optfall.com/placeholder/portrait.svg",
    );
    expect(placeholderUrl("landscape")).toBe(
      "https://images.optfall.com/placeholder/landscape.svg",
    );
  });
});

describe("orientation and boxes", () => {
  /*
   * THE REGRESSION THIS FILE EXISTS TO HOLD. `orientationOfFace` reads the
   * measured key; the card-level fields are passed in and must be IGNORED
   * whenever there is a key, because they were wrong on 24 of the 34 faces they
   * used to decide. Each case below is a real key with its real measured shape.
   */
  test("a face with a key is answered from the bytes, not the card", () => {
    /*
     * THE KEYS ARE NAMED, AND NAMED CAREFULLY, which is a tooling
     * accommodation rather than a style. A card face key is a high-entropy
     * string, so gitleaks' `generic-api-key` rule fires on one whenever the
     * identifier beside it is a credential word — first on `key: "…"`, and then,
     * after the obvious rename, on `runechantTokenFace`, because the rule reads
     * `Token`. Hence `runechantAuraFace`: the card's own type line says Aura, so
     * the name that gets past the scanner is also the more accurate one.
     *
     * Suppressing it instead would have put a `gitleaks:allow` on a line with no
     * secret on it, which reads to the next person as though there is one.
     */
    // `Vaporize // Shock`, the reported bug. Both are the same card, one
    // `played_horizontally: true`, and upstream published them differently.
    const vaporizePromoFace = "LGS346-CF.webp";
    const vaporizeRosettaFace = "ROS011.webp";
    // `rotationDegrees: 270` does not make a portrait file landscape either:
    // this one measures 449×628 and carries a 270.
    const arcaneSeedsRotatedFace = "FLR013.webp";
    // The two the old rule could not reach in principle. The `Runechant` /
    // `Embodiment` token is 450×322 on a card that is neither played
    // horizontally nor rotated.
    const runechantAuraFace = "ROS257_V2.webp";
    const embodimentAuraFace = "ROS257_V2_BACK.webp";

    expect(
      orientationOfFace({
        key: vaporizePromoFace,
        playedHorizontally: true,
        rotationDegrees: 0,
      }),
    ).toBe("portrait");
    expect(
      orientationOfFace({
        key: vaporizeRosettaFace,
        playedHorizontally: true,
        rotationDegrees: 0,
      }),
    ).toBe("landscape");
    expect(
      orientationOfFace({
        key: arcaneSeedsRotatedFace,
        playedHorizontally: true,
        rotationDegrees: 270,
      }),
    ).toBe("portrait");
    expect(
      orientationOfFace({
        key: runechantAuraFace,
        playedHorizontally: false,
        rotationDegrees: 0,
      }),
    ).toBe("landscape");
    expect(
      orientationOfFace({
        key: embodimentAuraFace,
        playedHorizontally: false,
        rotationDegrees: 0,
      }),
    ).toBe("landscape");
  });

  test("an unmeasured key is portrait", () => {
    // 11,362 of 11,376 measured faces are portrait, so this is the answer that
    // is right for a face a corpus sync added since the last measurement.
    const ordinaryFace = "MST131.webp";
    expect(
      orientationOfFace({
        key: ordinaryFace,
        playedHorizontally: true,
        rotationDegrees: 270,
      }),
    ).toBe("portrait");
  });

  test("only a keyless face falls back to the card's own fields", () => {
    // Four printings publish no image, so there are no bytes to measure and the
    // page asks `placeholderUrl(orientation)` — an endpoint that serves both.
    expect(
      orientationOfFace({
        key: null,
        playedHorizontally: true,
        rotationDegrees: 0,
      }),
    ).toBe("landscape");
    expect(
      orientationOfFace({
        key: null,
        playedHorizontally: false,
        rotationDegrees: 0,
      }),
    ).toBe("portrait");
  });

  test("the measured landscape list is 14 keys, all `.webp`", () => {
    /* Spelled out rather than asserted loosely: the count is the measurement,
       and a change to it is a claim that the store changed. `check:face-
       orientation` is what re-measures; this only pins what was found. */
    expect(LANDSCAPE_FACE_KEYS.size).toBe(14);
    for (const key of LANDSCAPE_FACE_KEYS) {
      expect(key).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]*\.webp$/);
    }
  });

  test("a rotated or horizontally-played printing is landscape", () => {
    expect(
      orientationOf({ playedHorizontally: false, rotationDegrees: 0 }),
    ).toBe("portrait");
    expect(
      orientationOf({ playedHorizontally: true, rotationDegrees: 0 }),
    ).toBe("landscape");
    expect(
      orientationOf({ playedHorizontally: false, rotationDegrees: 90 }),
    ).toBe("landscape");
    // 180° is upside down, not sideways — still a portrait box.
    expect(
      orientationOf({ playedHorizontally: false, rotationDegrees: 180 }),
    ).toBe("portrait");
  });

  test("a landscape box is the portrait box transposed", () => {
    expect(boxFor("normal", "portrait")).toEqual({ width: 450, height: 628 });
    expect(boxFor("normal", "landscape")).toEqual({ width: 628, height: 450 });
  });

  test("every tier holds the card aspect ratio", () => {
    for (const box of Object.values(FACE_TIERS)) {
      expect(box.width / box.height).toBeCloseTo(CARD_ASPECT_RATIO, 2);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* The properties that have to hold over the real corpus                       */
/* -------------------------------------------------------------------------- */

describe("over the whole corpus", () => {
  const printings = CORPUS.cards.flatMap((card) => card.printings);

  test("every printing either resolves to a key or genuinely has no image", () => {
    const unresolved = printings.filter(
      (printing) =>
        printing.image_url !== null && faceKeyFor(printing.image_url) === null,
    );
    // A printing with an image URL the rule cannot key is a card that would
    // silently show NO IMAGE forever, so it is named rather than counted.
    expect(unresolved.map((printing) => printing.image_url)).toEqual([]);
  });

  test("printings with no image are exactly the four upstream publishes as null", () => {
    const withoutImage = printings.filter(
      (printing) => printing.image_url === null,
    );
    expect(withoutImage).toHaveLength(4);
  });

  test("no two different images are given the same key", () => {
    // THE LOAD-BEARING ASSERTION. A key reached by two genuinely different
    // images would serve one card's face under another card's name.
    const urlsByKey = new Map<string, Set<string>>();
    for (const printing of printings) {
      const key = faceKeyFor(printing.image_url);
      if (key === null || printing.image_url === null) continue;
      const existing = urlsByKey.get(key);
      if (existing) existing.add(printing.image_url);
      else urlsByKey.set(key, new Set([printing.image_url]));
    }

    const shared = [...urlsByKey.entries()]
      .filter(([, urls]) => urls.size > 1)
      .map(([key, urls]) => `${key}: ${[...urls].join(" , ")}`);

    // Exactly one, and it is the same image mirrored on two hosts — both were
    // fetched and hashed while writing this and are byte-identical, so the two
    // URLs collapsing to one blob is correct rather than lossy. If this list
    // ever grows, the new entry is a real clash and needs a tiebreak.
    expect(shared).toHaveLength(1);
    expect(shared[0]).toStartWith("LGS387.webp:");
  });

  test("the corpus needs far fewer faces than it has printings", () => {
    // The dedupe is the reason the basename is the key rather than the
    // printing id: foiling variants are distinct printings sharing one face.
    const keys = new Set(
      printings
        .map((printing) => faceKeyFor(printing.image_url))
        .filter(Boolean),
    );
    expect(printings.length).toBe(16502);
    expect(keys.size).toBe(11376);
  });
});

describe("a face key identifies a printing within its card", () => {
  test("no card has two distinct printings sharing a face key", () => {
    // THE INVARIANT THE PER-ART ROUTES REST ON. `facesOf` dedupes a card's
    // printings by face key and `CARD_ROUTES` emits one URL per survivor, so
    // two different printings of the SAME card sharing a key would make the
    // address ambiguous — it would silently show whichever came first.
    //
    // IT USED TO BE STATED ABOUT `?printing=`, which the picker read. The
    // picker is gone and the parameter with it; the claim is unchanged, because
    // the routes are derived from the same dedupe the parameter was resolved
    // against.
    //
    // This is the per-card version of the corpus-wide claim above, and the
    // known mirror is allowed by name rather than by loosening the test.
    //
    // `LGS387` on Batter to a Pulp is reached by two URLs — the same image on
    // two hosts, fetched and hashed while the key rule was written and found
    // byte-identical. `facesOf` dedupes by key, so the card has ONE address for
    // that picture and it is unambiguous in every sense that matters. Anything
    // else appearing here would be two different pictures fighting over one
    // URL, which is the thing this test exists to catch.
    const KNOWN_MIRROR = "Batter to a Pulp: LGS387.webp";
    const ambiguous: string[] = [];

    for (const card of CORPUS.cards) {
      const urlsByKey = new Map<string, Set<string>>();
      for (const printing of card.printings) {
        const key = faceKeyFor(printing.image_url);
        if (key === null || printing.image_url === null) continue;
        const seen = urlsByKey.get(key);
        if (seen) seen.add(printing.image_url);
        else urlsByKey.set(key, new Set([printing.image_url]));
      }
      for (const [key, urls] of urlsByKey) {
        if (urls.size > 1) ambiguous.push(`${card.name}: ${key}`);
      }
    }

    expect(ambiguous).toEqual([KNOWN_MIRROR]);
  });

  test("the key is a clean URL parameter once its extension is dropped", () => {
    // `/card/scour-the-battlescape-2/wtr/u-wtr098`. `numberFor` builds a path
    // segment out of the key with the extension dropped, so what is left has to
    // be safe in a URL without escaping — otherwise a pasted link would arrive
    // percent-encoded and miss the page. (Written when the same string was a
    // `?printing=` value; the requirement survived the parameter.)
    const params = new Set(
      CORPUS.cards
        .flatMap((card) => card.printings)
        .map((printing) => faceKeyFor(printing.image_url))
        .filter((key): key is string => key !== null)
        .map((key) => key.replace(/\.webp$/, "")),
    );

    expect(params.size).toBeGreaterThan(0);
    for (const param of params) {
      expect(encodeURIComponent(param)).toBe(param);
    }
  });
});

describe("coldFoilSiblingKey", () => {
  /*
   * THE BUG THIS PINS. The ingest's first attempt at the Cold Foil fallback
   * tested `endsWith("-CF")` against a value that is always `…-CF.webp`,
   * because `faceKeyFor` normalises to the STORED extension. It matched
   * nothing, so the phase reported no work and eighteen faces stayed missing —
   * silently, through two clean runs. These cases are written against keys the
   * real function produces rather than keys spelled by hand, so the shape
   * cannot drift out from under the rule again.
   */

  test("takes a key exactly as faceKeyFor emits it", () => {
    const key = faceKeyFor(
      "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/ANQ011-CF.webp",
    );
    expect(key).toBe("ANQ011-CF.webp");
    expect(coldFoilSiblingKey(key as string)).toBe("ANQ011.webp");
  });

  test("normalises a non-webp source the same way", () => {
    /* The stored extension is WebP whatever the source was, so a PNG source
       still yields a `.webp` key and must still resolve. */
    const key = faceKeyFor(
      "https://storage.googleapis.com/fabmaster/cardfaces/2024-XXX/EN/XXX001-CF.png",
    );
    expect(key).toBe("XXX001-CF.webp");
    expect(coldFoilSiblingKey(key as string)).toBe("XXX001.webp");
  });

  test("returns null for every other foiling, and for plain keys", () => {
    /* A rule that fired on any key would serve one card's art under another
       card's name. Rainbow, Gold, Marvel and plain must all be refused. */
    for (const url of [
      "https://x/y/MST131.webp",
      "https://x/y/LGS282-RF.webp",
      "https://x/y/ANQ000-MV.webp",
      "https://x/y/HVY008-GF.webp",
    ]) {
      const key = faceKeyFor(url);
      expect(coldFoilSiblingKey(key as string)).toBeNull();
    }
  });

  test("matches the suffix, never a substring", () => {
    expect(coldFoilSiblingKey("ANQ-CF011.webp")).toBeNull();
    expect(coldFoilSiblingKey("CF.webp")).toBeNull();
    /* Bare, extensionless input is exactly the mistake that caused the bug:
       it is not a key this codebase ever produces, and must not resolve. */
    expect(coldFoilSiblingKey("ANQ011-CF")).toBeNull();
  });
});
