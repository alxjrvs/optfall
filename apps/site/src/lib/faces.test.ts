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
  orientationOf,
  placeholderUrl,
} from "./faces";
import { CORPUS } from "./cards";

describe("faceKeyFor", () => {
  test("takes the basename and restates the extension as webp", () => {
    expect(
      faceKeyFor("https://storage.googleapis.com/fabmaster/cardfaces/2024-MST/EN/MST131.png"),
    ).toBe("MST131.webp");
    expect(
      faceKeyFor("https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/large/OMN243.webp"),
    ).toBe("OMN243.webp");
  });

  test("keeps a meaningful suffix that is part of the name", () => {
    // `-RF` is rainbow foil — a different piece of art, not a rendition.
    expect(
      faceKeyFor("https://d2wlb52bya4y8z.cloudfront.net/media/cards/large/LGS282-RF.webp"),
    ).toBe("LGS282-RF.webp");
  });

  test("strips a source rendition marker, which is not part of the identity", () => {
    // 2,144 URLs carry this: one host's pipeline stamping the width it served
    // into the file name. Carrying it through would put somebody else's build
    // artefact in our URL space forever.
    expect(
      faceKeyFor("https://dhhim4ltzu1pj.cloudfront.net/media/images/OUT183.width-450.png"),
    ).toBe("OUT183.webp");
    expect(
      faceKeyFor("https://storage.googleapis.com/fabmaster/media/images/1HP001.width-450.png"),
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
    // whole Astro build rather than degrading one card. No corpus URL contains
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
      "https://optfall-images.netlify.app/thumb/MST131.webp",
    );
    expect(faceUrl("MST131.webp", "normal")).toBe(
      "https://optfall-images.netlify.app/normal/MST131.webp",
    );
    expect(placeholderUrl()).toBe(
      "https://optfall-images.netlify.app/placeholder/portrait.svg",
    );
    expect(placeholderUrl("landscape")).toBe(
      "https://optfall-images.netlify.app/placeholder/landscape.svg",
    );
  });
});

describe("orientation and boxes", () => {
  test("a rotated or horizontally-played printing is landscape", () => {
    expect(orientationOf({ playedHorizontally: false, rotationDegrees: 0 })).toBe("portrait");
    expect(orientationOf({ playedHorizontally: true, rotationDegrees: 0 })).toBe("landscape");
    expect(orientationOf({ playedHorizontally: false, rotationDegrees: 90 })).toBe("landscape");
    // 180° is upside down, not sideways — still a portrait box.
    expect(orientationOf({ playedHorizontally: false, rotationDegrees: 180 })).toBe("portrait");
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
      (printing) => printing.image_url !== null && faceKeyFor(printing.image_url) === null,
    );
    // A printing with an image URL the rule cannot key is a card that would
    // silently show NO IMAGE forever, so it is named rather than counted.
    expect(unresolved.map((printing) => printing.image_url)).toEqual([]);
  });

  test("printings with no image are exactly the four upstream publishes as null", () => {
    const withoutImage = printings.filter((printing) => printing.image_url === null);
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
      printings.map((printing) => faceKeyFor(printing.image_url)).filter(Boolean),
    );
    expect(printings.length).toBe(16502);
    expect(keys.size).toBe(11376);
  });
});

describe("a face key identifies a printing within its card", () => {
  test("no card has two distinct printings sharing a face key", () => {
    // THE INVARIANT `?printing=` RESTS ON. The picker resolves the param by
    // scanning one card's printings for a matching key, so two different
    // printings of the SAME card sharing a key would make the link ambiguous —
    // it would silently select whichever came first.
    //
    // This is the per-card version of the corpus-wide claim above, and the
    // known mirror is allowed by name rather than by loosening the test.
    //
    // `LGS387` on Batter to a Pulp is reached by two URLs — the same image on
    // two hosts, fetched and hashed while the key rule was written and found
    // byte-identical. The picker dedupes by key, so it renders ONE tile and
    // `?printing=LGS387` is unambiguous in every sense that matters. Anything
    // else appearing here would be two different pictures fighting over one
    // parameter value, which is the thing this test exists to catch.
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
    // `?printing=U-WTR098`. The param strips `.webp`, so what is left has to be
    // safe in a query string without escaping — otherwise a pasted link would
    // arrive percent-encoded and fail the lookup.
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
