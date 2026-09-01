/**
 * The registry of everything the build emits that is not a page.
 *
 * WHAT WAS UNCHECKED, AND WHY IT IS THE INTERESTING KIND OF GAP.
 * `generatedIcons.test.ts` covers the rasteriser thoroughly — four PNGs, their
 * dimensions, that the mark is on them — and nothing covered the registry those
 * PNGs are listed in, or the three text assets beside them. That left 130
 * uncovered lines in `assets.ts`, and more to the point it left the file's own
 * founding failure unguarded: `document.tsx` linked `/favicon.svg` for two
 * layers while nothing emitted it, page parity was measured at 13,675 = 13,675,
 * every page carried a broken icon link, and the build reported success. The
 * header of `assets.ts` is an essay about that failure. Nothing tested for it.
 *
 * SO THE ASSERTIONS HERE ARE CROSS-REFERENCES RATHER THAN SNAPSHOTS. What can
 * actually go wrong with derived bytes is not that they are the wrong bytes; it
 * is that something LINKS an address the registry does not emit, or the registry
 * emits an address nothing links. Each test below joins two declarations that
 * are written in different files and asserts they agree — the manifest's icons
 * against the registry, the document's `<link>`s against the registry, the
 * content-hashed index paths against a hash of their own contents.
 *
 * `generatedAssets()` IS CALLED ONCE, at module scope, and shared. It
 * rasterises four PNGs and dynamically imports `searchIndexes.ts`, which reads
 * the 18 MB card corpus — the two most expensive things in this directory.
 * Calling it per test would multiply both by the number of tests for no extra
 * truth: it takes no arguments and is deterministic.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { themes } from "optfall-theme";

import { generatedAssets, type GeneratedAsset, THEME_COLOUR } from "./assets";

const ASSETS: readonly GeneratedAsset[] = await generatedAssets();

/** Addresses as a linker would write them: rooted, exactly as the registry emits. */
const EMITTED = new Set(ASSETS.map((asset) => `/${asset.path}`));

/** One asset by path, or a failure naming what was asked for. */
function asset(path: string): GeneratedAsset {
  const found = ASSETS.find((entry) => entry.path === path);
  if (found === undefined) {
    throw new Error(
      `no generated asset at ${path}; the registry has ${ASSETS.map((entry) => entry.path).join(", ")}`,
    );
  }
  return found;
}

/** An asset's contents as text, refusing to stringify a PNG by accident. */
function text(path: string): string {
  const contents = asset(path).contents;
  if (typeof contents !== "string") {
    throw new Error(`${path} is bytes, not text`);
  }
  return contents;
}

describe("the registry itself", () => {
  test("every path is relative, and no two assets claim one address", () => {
    /* A leading slash here would produce `dist//favicon.svg` on one writer and
       an absolute filesystem path on another; the interface says "relative to
       the output root" and this is what holds it to that. */
    const rooted = ASSETS.filter((entry) => entry.path.startsWith("/"));
    expect(rooted.map((entry) => entry.path)).toEqual([]);

    const paths = ASSETS.map((entry) => entry.path);
    expect(paths.length).toBe(new Set(paths).size);
  });

  test("text assets are text and raster assets are bytes", () => {
    /* The union is what let the PNGs join this registry rather than arrive by a
       second mechanism. A PNG that arrived as a string would be written through
       a text encoder and corrupt silently, which is the whole reason the field
       is typed as a union rather than as `string`. */
    const wrong = ASSETS.filter((entry) =>
      entry.path.endsWith(".png")
        ? typeof entry.contents === "string"
        : typeof entry.contents !== "string",
    ).map((entry) => entry.path);

    expect(wrong).toEqual([]);
  });

  test("nothing is empty", () => {
    /* A generator that returns "" still registers an asset and still writes a
       file, and a zero-byte favicon fails exactly as invisibly as a missing
       one. */
    const empty = ASSETS.filter((entry) =>
      typeof entry.contents === "string"
        ? entry.contents.trim() === ""
        : entry.contents.byteLength === 0,
    ).map((entry) => entry.path);

    expect(empty).toEqual([]);
  });
});

describe("the vector icons", () => {
  /*
   * A REFERENCED SVG GETS NO PAGE STYLESHEET, which is the single fact every
   * decision in `chainPaint()` follows from: the fills cannot be `var(--of-*)`,
   * so they are read out of the theme's own tables at build time and written
   * in. That is only safe while the values ARE the theme's — an inlined colour
   * would look identical and drift on the next token change.
   */
  const pitch = [
    themes.dark.tokens["color.pitch.one"],
    themes.dark.tokens["color.pitch.two"],
    themes.dark.tokens["color.pitch.three"],
  ];

  for (const path of ["favicon.svg", "icon.svg", "icon-maskable.svg"]) {
    test(`${path} is a standalone document painted from the tokens`, () => {
      const svg = text(path);
      /* No page CSS, and no enclosing HTML either: the namespace has to be on
         the element or the file is not an image. */
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      for (const colour of pitch) {
        expect(svg).toContain(colour ?? "unset token");
      }
    });
  }

  test("the maskable icon is inset and the plain one is not", () => {
    /*
     * THE INSET IS THE ONLY DIFFERENCE BETWEEN THEM, and it is a real one: a
     * maskable crop is guaranteed only the centre 80%, so `icon.svg` spans the
     * square edge to edge and `icon-maskable.svg` sits inside a larger box.
     * Comparing the two documents is what catches a `safeZone` that stopped
     * being applied — both would still render, and both would still be valid.
     */
    expect(text("icon.svg")).not.toBe(text("icon-maskable.svg"));

    const side = (svg: string): number =>
      Number(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) /.exec(svg)?.[1] ?? "0");

    expect(side(text("icon-maskable.svg"))).toBeGreaterThan(
      side(text("icon.svg")),
    );
  });

  test("the favicon draws at the mark's own aspect, not on a square", () => {
    /* One declaration, two canvases — the chain is the same paths in both, and
       what differs is the box around it. If the favicon ever became square this
       would be a redesign rather than a refactor. */
    const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(
      text("favicon.svg"),
    );
    expect(box?.[1]).not.toBe(box?.[2]);
  });
});

describe("the manifest", () => {
  const parsed = JSON.parse(text("manifest.webmanifest")) as {
    theme_color: string;
    background_color: string;
    icons: readonly { src: string; type: string; purpose: string }[];
    display_override: readonly string[];
    display: string;
  };

  test("it is valid JSON and names the same colour the tab does", () => {
    /* Two declarations of one fact read by different consumers — the meta tag
       by the browser's chrome on a live page, this field by the installer. A
       site whose address bar is one colour installed and another in a tab is
       exactly the drift that is invisible until somebody installs it. */
    expect(parsed.theme_color).toBe(THEME_COLOUR);
    expect(parsed.background_color).toBe(THEME_COLOUR);
  });

  test("every icon it names is an address the build actually emits", () => {
    /*
     * THIS IS THE FILE'S FOUNDING FAILURE, IN THE OTHER DIRECTION. `favicon.svg`
     * was linked by a document nothing emitted it for; a manifest icon is the
     * same shape of defect, and worse to find, because the only surface that
     * reads it is an install dialog on somebody else's phone.
     */
    const missing = parsed.icons
      .map((icon) => icon.src)
      .filter((src) => !EMITTED.has(src));

    expect(missing).toEqual([]);
  });

  test("`any` and `maskable` are separate entries, not one doing both", () => {
    /* A single `purpose: "any maskable"` icon is the padded artwork, and it is
       then ALSO what every non-maskable surface renders — where nothing crops
       it and the mark sits inside empty ground looking like a mistake. */
    const purposes = parsed.icons.map((icon) => icon.purpose);
    expect(purposes).toContain("any");
    expect(purposes).toContain("maskable");
    expect(purposes.filter((purpose) => purpose.includes(" "))).toEqual([]);
  });

  test("both raster sizes the install checks look for are named", () => {
    /* 192 and 512 are not a pair of round numbers: they are the two sizes every
       major engine's install check is written against, and naming one without
       the other still trips diagnostics that look for both. */
    const sizes = parsed.icons
      .filter((icon) => icon.type === "image/png")
      .map((icon) => icon.src);
    expect(sizes).toContain("/icon-192.png");
    expect(sizes).toContain("/icon-512.png");
  });
});

describe("the service worker's purge script", () => {
  test("it deletes the page cache on activate", () => {
    /*
     * Stored HTML links content-hashed assets, so a page cached before a deploy
     * stops being servable the moment those addresses change. The worker has no
     * activate hook of its own — Workbox generates it — so this is imported.
     */
    const source = text("sw-purge.js");
    expect(source).toContain("activate");
    expect(source).toContain('caches.delete("pages")');
  });

  test("`serviceWorker.ts` still imports the name this file writes", () => {
    /* The two halves are in different files and neither can see the other. If
       the registry renamed this asset, the worker would import a 404 and no
       service worker would install at all — no precache, no offline, no install
       prompt — which `serviceWorker.ts` says in its own error message. */
    const worker = readFileSync(
      fileURLToPath(new URL("./serviceWorker.ts", import.meta.url)),
      "utf8",
    );
    expect(worker).toContain("sw-purge.js");
  });
});

describe("the content-hashed search indexes", () => {
  test("each path is a digest of the bytes it names", () => {
    /*
     * THE ADDRESS IS A PROMISE ABOUT THE CONTENTS, and it is the promise the
     * whole caching policy rests on: `useSearchIndex.ts` turns off every
     * refetch trigger because the bytes behind a hashed URL cannot change. A
     * path whose digest did not match its contents would make that false, and
     * readers would be served a stale index until they cleared their cache.
     */
    const hashed = ASSETS.filter((entry) =>
      /-[0-9a-f]{8}\.json$/.test(entry.path),
    );
    expect(hashed.length).toBe(2);

    for (const entry of hashed) {
      const contents = entry.contents;
      if (typeof contents !== "string")
        throw new Error(`${entry.path} is bytes`);
      const digest = createHash("sha256")
        .update(contents)
        .digest("hex")
        .slice(0, 8);
      expect(`${entry.path} ${digest}`).toBe(
        `${entry.path} ${/-([0-9a-f]{8})\.json$/.exec(entry.path)?.[1] ?? ""}`,
      );
    }
  });

  test("both live under `assets/`, where the headers file scopes its caching", () => {
    const hashed = ASSETS.filter((entry) =>
      /-[0-9a-f]{8}\.json$/.test(entry.path),
    );
    expect(hashed.every((entry) => entry.path.startsWith("assets/"))).toBe(
      true,
    );
  });
});

describe("what the document links", () => {
  /*
   * THE FOUNDING FAILURE, GUARDED FROM THE LINKING SIDE. Every rooted `href` on
   * a `<link>` in `document.tsx` that is not a route has to be something this
   * registry emits. It is a text search over the source, which is a real limit
   * — a link built from an expression is invisible to it — and it catches the
   * shape that actually happened: an address typed into a `<link>` with nothing
   * writing the file.
   */
  const document_ = readFileSync(
    fileURLToPath(new URL("./document.tsx", import.meta.url)),
    "utf8",
  );

  const linked = [...document_.matchAll(/<link[^>]*?href="(\/[^"{]*?)"/g)].map(
    (match) => match[1] ?? "",
  );

  test("the scan found the links it is meant to be checking", () => {
    /* A regex that silently matches nothing passes forever. */
    expect(linked.length).toBeGreaterThan(2);
  });

  test("every generated file it links is one the registry emits", () => {
    /* Stylesheets and the island bundle are Vite's, hashed, and injected from
       the manifest rather than written here; they never appear as literals. So
       everything this finds should be ours. */
    const missing = linked.filter((href) => !EMITTED.has(href));
    expect(missing).toEqual([]);
  });
});
