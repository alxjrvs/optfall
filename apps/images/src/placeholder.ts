/**
 * NO IMAGE — the face Optfall serves when it has none.
 *
 * WHY THIS IS AN ASSET AND NOT A 404. Three different states share one need:
 * a printing upstream publishes with `image_url: null` (four of them today), a
 * key the ingest has not reached yet, and a storage outage. In every one of them
 * the page still has a card-shaped hole to fill, and an `<img>` that 404s
 * collapses to a broken-image glyph of the browser's own size — which reflows a
 * grid and makes a working page look broken. `docs/SCRYFALL-GAP.md` §5.1b.
 *
 * WHY SVG, AND WHY IN A MODULE RATHER THAN A FILE. It is text, so it lives in
 * git as source rather than as a committed binary; it is one file per
 * orientation rather than one per tier, because it scales; and holding it in a
 * module means the function that serves a miss and the URL that serves the
 * placeholder directly return *the same bytes* rather than two things somebody
 * has to remember to keep in step.
 *
 * WHY IT IS THEME-NEUTRAL. This is served cross-origin into an `<img>`, so it
 * inherits no CSS from the page and cannot read the reader's theme through the
 * token layer. `prefers-color-scheme` does resolve inside an SVG loaded as an
 * image in current browsers, but relying on it would make the one asset that
 * exists to be dependable depend on something. So the plate is drawn in the
 * neutral the token set already reserves for "no state to report" — the same
 * `#4a4a4a` family as `color.state.not-in-format` — which sits legibly on both
 * the near-black ground and the ash one.
 *
 * NO CARD ART, NO LSS MARK. `docs/COMPLIANCE.md`: no FAB or LSS logos, and
 * product set logos count as FAB logos. What is drawn here is Optfall's own
 * mark and its own type voices, which is the whole reason the mark was built
 * from a mechanic rather than from anyone's branding.
 */

/** The tiers this host serves, and the pixel box each one promises. */
export const TIERS = {
  thumb: { width: 180, height: 251 },
  normal: { width: 450, height: 628 },
} as const;

export type Tier = keyof typeof TIERS;

export type Orientation = "portrait" | "landscape";

/**
 * The placeholder, as SVG source.
 *
 * Drawn rather than typed out twice: the landscape form is the portrait form
 * with the box transposed, so the two cannot drift apart in the way two
 * hand-maintained files would.
 *
 * WHICH ONE A MISS GETS IS DECIDED BY `orientationOfKey` IN `./face.ts`, from
 * the same measured list the site sizes its boxes with. It used to be decided
 * here in the sense that it was not decided at all — every face miss took the
 * portrait plate — and the note this replaces justified the landscape form by
 * counting `played_horizontally` cards, which is a fact about the game rather
 * than about any stored file. Measured: 14 of the 11,376 stored faces are
 * landscape, and those are the ones whose miss needs this form.
 */
export function placeholderSvg(orientation: Orientation): string {
  const long = 628;
  const short = 450;
  const width = orientation === "portrait" ? short : long;
  const height = orientation === "portrait" ? long : short;

  // The plate is inset by a hairline so the bevel reads as an edge rather than
  // as a border drawn on the outside of the box.
  const inset = 8;
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;

  const centreX = width / 2;
  const centreY = height / 2;

  // The mark sits above the label, and the pair is optically centred as one
  // block rather than each being centred on its own.
  const markScale = orientation === "portrait" ? 2.4 : 1.9;
  const markWidth = 22 * markScale;
  const markHeight = 26 * markScale;
  const gap = 24;
  const labelSize = orientation === "portrait" ? 20 : 17;
  const blockHeight = markHeight + gap + labelSize;
  const markX = centreX - markWidth / 2;
  const markY = centreY - blockHeight / 2;
  const labelY = markY + markHeight + gap + labelSize * 0.8;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="No image published">
  <title>No image published</title>
  <rect width="${width}" height="${height}" fill="#1a1a1a"/>
  <rect x="${inset}" y="${inset}" width="${innerWidth}" height="${innerHeight}" fill="#242424"/>
  <path d="M${inset} ${inset} H${width - inset} V${inset + 2} H${inset + 2} V${height - inset} H${inset} Z" fill="#3a3a3a"/>
  <path d="M${width - inset} ${inset} V${height - inset} H${inset} V${height - inset - 2} H${width - inset - 2} V${inset} Z" fill="#0e0e0e"/>
  <g transform="translate(${markX} ${markY}) scale(${markScale})">
    <path d="M4 1 L18 1 L21 6 L11 9 L1 6 Z" fill="#6b6b6b"/>
    <path d="M2 12 L20 12 L11 25 Z" fill="#4a4a4a"/>
  </g>
  <text x="${centreX}" y="${labelY}" text-anchor="middle" fill="#8a8a8a" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="${labelSize}" letter-spacing="${labelSize * 0.18}">NO IMAGE</text>
</svg>
`;
}

/** `image/svg+xml`, stated once so the two callers cannot disagree. */
export const PLACEHOLDER_CONTENT_TYPE = "image/svg+xml; charset=utf-8";
