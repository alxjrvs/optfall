/**
 * The rasterised icons, checked for what they actually contain.
 *
 * WHAT WAS UNCHECKED. Four PNGs are rendered from an SVG by sharp at build
 * time, and nothing imported `assets.ts` in any test. The only things standing
 * between a sharp bump and `main` were the build not throwing and
 * `check-dev-server.ts` confirming those four routes return `200 image/png` —
 * neither of which looks at a pixel. Minor and patch bumps are auto-merge
 * eligible, so a rasterisation regression could land green.
 *
 * `assets.ts` names this risk itself, one comment above `iconPng`: the worry is
 * "a soft blur nobody notices in a diff", and the note says the behaviour was
 * "verified rather than assumed". That verification happened once, by hand, when
 * the code was written. This is it made repeatable.
 *
 * WHY NOT GOLDEN BYTES. Because the thing being defended against is a sharp
 * upgrade, and a byte comparison fails on every upgrade — including all the
 * legitimate ones. A test that cries wolf at each dependabot PR gets its
 * expectations regenerated without being read, which is worse than no test.
 * So this asserts the properties a broken rasteriser breaks and a working one
 * preserves across versions: the size, that the mark is actually THERE, and
 * that the safe-zone inset still does something.
 *
 * SHARP IS IMPORTED INSIDE THE TESTS for the reason the module gives for
 * deferring it: a static import pulls a native binary into everything that
 * touches this file.
 */

import { describe, expect, test } from "bun:test";

import { iconPng } from "./assets";

/** Width and height straight out of the IHDR chunk — no decoder needed. */
function dimensions(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** The PNG magic, so "it rendered something" is not confused with "it rendered". */
const MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Every size the build actually emits, and the inset it emits it at. */
const ICONS: readonly {
  readonly path: string;
  readonly safeZone: number;
  readonly size: number;
}[] = [
  { path: "icon-192.png", safeZone: 1, size: 192 },
  { path: "icon-512.png", safeZone: 1, size: 512 },
  { path: "icon-maskable-512.png", safeZone: 0.8, size: 512 },
  { path: "apple-touch-icon.png", safeZone: 1, size: 180 },
];

describe("the generated icons are the size they claim", () => {
  for (const icon of ICONS) {
    test(`${icon.path} is ${icon.size}×${icon.size}`, async () => {
      const png = await iconPng(icon.safeZone, icon.size);

      expect([...png.slice(0, 8)]).toEqual(MAGIC);
      expect(dimensions(png)).toEqual({
        width: icon.size,
        height: icon.size,
      });
    });
  }
});

describe("and they have a mark on them", () => {
  /** Distinct RGBA pixels, which is the cheapest proof that anything drew. */
  const colours = async (png: Uint8Array): Promise<number> => {
    const { default: sharp } = await import("sharp");
    const { data, info } = await sharp(Buffer.from(png))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const seen = new Set<number>();
    for (let i = 0; i < data.length; i += info.channels) {
      seen.add(
        ((data[i] ?? 0) << 24) |
          ((data[i + 1] ?? 0) << 16) |
          ((data[i + 2] ?? 0) << 8) |
          (data[i + 3] ?? 0),
      );
    }
    return seen.size;
  };

  for (const icon of ICONS) {
    test(`${icon.path} is not a flat rectangle`, async () => {
      /*
       * A rasteriser that stopped understanding the source would most likely
       * produce a correctly-sized blank, not a crash — which is precisely the
       * failure the build and the content-type check both wave through.
       */
      expect(
        await colours(await iconPng(icon.safeZone, icon.size)),
      ).toBeGreaterThan(1);
    });
  }

  test("the maskable inset still insets", async () => {
    /*
     * THE ONE ASSERTION THAT PINS THE ARGUMENT, rather than just the output.
     * `safeZone` is the whole reason there are two 512s: the maskable one draws
     * the mark inside the centre 80% so a circular crop cannot take a bite out
     * of it. If a sharp or librsvg change made the parameter stop mattering,
     * every test above would still pass and the maskable icon would quietly
     * become the full-bleed one.
     *
     * Compared as byte length rather than pixel-by-pixel: two renders of the
     * same source at the same size differing in size at all means the geometry
     * differs, and that is the fact being defended.
     */
    const bleed = await iconPng(1, 512);
    const masked = await iconPng(0.8, 512);

    expect(masked.byteLength).not.toBe(bleed.byteLength);
  });
});
