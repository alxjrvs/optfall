#!/usr/bin/env bun
/**
 * Assert that every card face on a built page was rendered by `CardFace`, and
 * that pages showing faces carry the notice.
 *
 *   bun scripts/check-card-notice.ts [output-directory]
 *
 * WHY A COMPONENT TEST WAS NOT ENOUGH. `CardFaceGroup.test.ts` proves the
 * components render the notice: a lone face carries its own, faces in a group
 * share exactly one. That is the right test, and it cannot see a page that
 * renders a face without going through the components at all.
 *
 * THE FIRST DRAFT OF THIS FILE DID NOT CATCH THAT EITHER, and the mistake is
 * worth recording because it is the one this whole layer exists to correct. It
 * tested `html.includes(CARD_IMAGE_COPYRIGHT)` — presence — and claimed to
 * catch the two incidents this project has actually had. It would have passed
 * both. The real incident was 22 printing thumbnails rendered as bare `<img>`
 * on a page that still carried one notice from its hero face, and a presence
 * test says yes to that page: one compliant face immunises any number of
 * unmarked ones beside it.
 *
 * SO THE CHECK COUNTS. `CardFace` is the only thing that emits an inline
 * `--face-ratio`, and it emits exactly one per face, so a page whose count of
 * card-image `<img>` tags does not equal its count of those markers has
 * rendered a face some other way. That is the bare-`<img>` failure, by
 * construction, and it no longer matters whether some other face on the page
 * happened to bring a notice with it.
 *
 * EQUALITY, NOT "NO MORE IMAGES THAN MARKERS". A marker with no matching image
 * is a `CardFace` rendering something that is not a card — which nothing does
 * today, because even the placeholder is served from our own host — and left
 * unflagged it would be a free credit, masking exactly one bare `<img>`
 * elsewhere on the page. This check exists to constrain callers who do not
 * exist yet, so it fails on both directions and says which one happened.
 *
 * WHAT IT STILL CANNOT SEE, said plainly so the status it justifies stays
 * honest: it reads HTML. The other incident — the front-door fan's crop cutting
 * the hoisted notice in half — was correct markup hidden by a stylesheet, and
 * nothing here can tell. That gap is visual regression, which
 * `docs/COMPLIANCE.md` §5 lists as outstanding, and this file does not claim it.
 *
 * A PAGE WITH NO FACES IS NOT A FAILURE. Most built pages show no card image,
 * and demanding a copyright line on a page with nothing to copyright would be
 * noise that trains everyone to ignore this check.
 *
 * IT DOES NOT SEE THE SEARCH GRID, and that is the largest hole in it. `/search`
 * server-renders no results — an empty query parses to a null tree — so the
 * grid of up to sixty faces is built in the browser and never appears in the
 * HTML this reads. That is the surface where a future bare `<img>` is most
 * tempting, because it is the one view in which sixty separate notices look
 * like a cost. Closing it needs a rendered-DOM check rather than a file read.
 * Recorded in `docs/COMPLIANCE.md` §5 as open rather than papered over: this
 * check covers server-rendered faces, which is where the incident happened, and
 * not every face the site can show.
 */
import { readFileSync } from "node:fs";

import { CARD_IMAGE_COPYRIGHT } from "../packages/components/src/index";
import { FACE_HOST } from "../apps/site/src/lib/faces";
import { CORPUS } from "../apps/site/src/lib/cards";

const outputDirectory = process.argv[2] ?? "apps/site/dist";

const pages = [
  ...new Bun.Glob("**/*.html").scanSync({ cwd: outputDirectory, dot: false }),
].toSorted();

if (pages.length === 0) {
  console.log(
    `::error::No HTML found in ${outputDirectory}. Run \`bun run build\` first — an empty build is a failure here, not a pass.`,
  );
  process.exit(1);
}

/**
 * Every host a card image can be served from.
 *
 * OUR HOST IS NOT THE ONLY ONE, AND ASSUMING IT WAS LEFT THE GAP THIS LIST
 * CLOSES. The corpus carries `printings[].image_url` verbatim — upstream URLs
 * on Google Cloud Storage, an LSS S3 bucket and two CloudFront distributions —
 * so `<img src={printing.image_url}>` is one field away at any call site, shows
 * a card face with no notice, and would have counted as zero images against a
 * check that only knew about our own host. That is the bare-`<img>` incident
 * again, wearing a different URL.
 *
 * Keyed on hosts rather than on a class name, because the condition is about
 * images of cards reaching a reader: a check looking for `class="face"` passes
 * the exact failure this exists to prevent. Derived from the corpus rather than
 * typed, so a new upstream host is covered on the day it appears in the data.
 */
/**
 * The host of a URL, or `null` if it will not parse.
 *
 * Guarded because the corpus is re-synced on a schedule and one malformed
 * `image_url` would otherwise throw an uncaught `TypeError` here — failing the
 * compliance job with a stack trace instead of a diagnosis, on a day nobody
 * touched this code. `faceKeyFor` wraps the identical parse for the identical
 * reason. A URL that will not parse cannot be an image anybody is serving, so
 * dropping it is right; the pages that matter are still checked against every
 * host that did parse.
 */
function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const UPSTREAM_HOSTS = [
  ...new Set(
    CORPUS.cards.flatMap((card) =>
      card.printings
        .map((printing) => printing.image_url)
        .filter((url): url is string => typeof url === "string" && url !== "")
        .map((url) => hostOf(url))
        .filter((host): host is string => host !== null),
    ),
  ),
].toSorted();

const CARD_IMAGE_HOSTS = [new URL(FACE_HOST).host, ...UPSTREAM_HOSTS];

function faceImages(html: string): number {
  return (html.match(/<img\b[^>]*>/g) ?? []).filter((tag) =>
    CARD_IMAGE_HOSTS.some((host) => tag.includes(host)),
  ).length;
}

/**
 * Faces rendered by `CardFace`.
 *
 * The inline `--face-ratio` is the marker: `CardFace` sets it on its `<figure>`
 * from the intrinsic width and height, once per face, and nothing else in the
 * system emits it as an inline style. It is deliberately not the scoped class —
 * Svelte's scope hashes change whenever the component's CSS does, so a check
 * keyed on one would go quietly green on a rename.
 */
function componentFaces(html: string): number {
  // Position-independent: matching `style="--face-ratio:` would count zero the
  // day anyone puts another declaration first, and a check that silently reads
  // zero is worse than one that is merely strict.
  return (html.match(/--face-ratio:\s*\d/g) ?? []).length;
}

let facePages = 0;
let failures = 0;

for (const page of pages) {
  const html = readFileSync(`${outputDirectory}/${page}`, "utf8");
  const images = faceImages(html);
  if (images === 0) continue;

  facePages += 1;
  const rendered = componentFaces(html);
  const file = `${outputDirectory}/${page}`;

  if (images > rendered) {
    console.log(
      `::error file=${file}::${page} serves ${images} card image(s) but only ${rendered} came from CardFace. A face outside the component carries no notice of its own and no guarantee that one covers it.`,
    );
    failures += 1;
    continue;
  }

  if (rendered > images) {
    console.log(
      `::error file=${file}::${page} renders ${rendered} CardFace element(s) for ${images} card image(s). A CardFace whose src is not a card image makes this check's arithmetic meaningless — it would mask one bare <img> elsewhere on the page. Either the src is wrong or this check's host list needs the new one.`,
    );
    failures += 1;
    continue;
  }

  if (!html.includes(CARD_IMAGE_COPYRIGHT)) {
    console.log(
      `::error file=${file}::${page} shows ${images} card face(s) and does not contain "${CARD_IMAGE_COPYRIGHT}".`,
    );
    failures += 1;
  }
}

if (facePages === 0) {
  console.log(
    `::error::No built page serves a card image from any of ${CARD_IMAGE_HOSTS.join(", ")}, so this check verified nothing. Either a host changed — update lib/faces.ts or the corpus and re-run — or card images stopped rendering, which is itself worth failing on.`,
  );
  process.exit(1);
}

if (failures > 0) {
  console.log("");
  console.log(
    `${failures} of ${facePages} page(s) showing card faces failed. Card images are permitted on the condition that the notice accompanies them; the mechanism is CardFace emitting it, or CardFaceGroup hoisting one for faces shown together. See docs/COMPLIANCE.md §5.`,
  );
  process.exit(1);
}

console.log(
  `${facePages} of ${pages.length} built page(s) show a card face; every face came from CardFace and every page carries the notice. ✔`,
);
