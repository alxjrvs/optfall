/**
 * A card face — the printed image. The React port.
 *
 * THE COPYRIGHT LINE USED TO LIVE HERE, AND MOVING IT WAS A DELIBERATE CHANGE
 * OF POSTURE RATHER THAN A TIDY-UP. This component rendered
 * `CARD_IMAGE_COPYRIGHT` on every face, unconditionally, and `CardFaceGroup`
 * existed only to hoist one notice over a set of them. `docs/COMPLIANCE.md` §5
 * required exactly that: "not a prop the caller may omit… and not the page's
 * responsibility".
 *
 * The requirement it serves is that **the disclaimer be provided wherever card
 * images are used**, and a per-image line is one way to satisfy it, not the
 * only one. It is now carried once per page, in the universal footer emitted by
 * `ssg/document.tsx`, alongside the corpus's own rights notice and the LSS
 * disclaimer. Every page gets the literal `© Legend Story Studios`, and gets it
 * whether or not it shows a face.
 *
 * WHAT THAT COSTS, STATED PLAINLY. The old arrangement made the line
 * unforgeable from markup: a caller could not obtain the image without the
 * notice, because one component emitted both. The new one puts the notice in a
 * shell the page cannot opt out of but which is a different file from the
 * image — so `scripts/check-card-notice.ts` is what holds the two together
 * now, and §5 records that the enforcement moved rather than that it relaxed.
 *
 * WHY IT TAKES BUILT URLS RATHER THAN A KEY. `src`, `srcset` and the box are
 * composed by `apps/site/src/lib/faces.ts`, which owns the URL grammar and is
 * shared with the ingest that writes the blobs. Passing finished strings keeps
 * this package free of a host name and of the key rule — so the library stays
 * adoptable by a tool that serves its faces from somewhere else, which is the
 * whole premise of publishing these primitives.
 *
 * WIDTH AND HEIGHT ARE REQUIRED, and that is not pedantry. Sixty lazily loaded
 * images with no intrinsic size are sixty layout shifts; the attributes give
 * the browser the box before a byte arrives. They are also why the landscape
 * cases matter — 15 cards are played horizontally and 10 printings carry a
 * rotation, and a portrait box around a landscape face is visible at a glance.
 *
 * THERE IS NO ERROR HANDLING HERE, DELIBERATELY. The face host answers a miss
 * with a card-shaped NO IMAGE placeholder at 200 rather than a 404, so the
 * degraded path is already an image of the right shape. An `onError` swap here
 * would be a second mechanism for the same thing, in a component that cannot
 * know why the first one did not fire.
 *
 * ONE PORT DIFFERENCE, AND IT IS THE JEWEL. Svelte took a `Snippet<[PitchValue]>`
 * so the caller rendered the jewel and this component only positioned it. React
 * has no snippets; the equivalent is a render prop, and it is kept as one
 * rather than being simplified to `children` — the point of the original design
 * was that this component NEVER draws the jewel, and a plain `children` slot
 * would not carry the pitch value the caller needs to draw the right one.
 */

import type { CSSProperties, ReactNode } from "react";

import type { PitchValue } from "optfall-theme";

import "./CardFace.css";

export interface CardFaceProps {
  /** The face URL at the tier being rendered. */
  readonly src: string;
  /** Optional `srcSet`, when more than one tier is worth offering. */
  readonly srcSet?: string;
  /** Paired with `srcSet`; the layout width the browser should assume. */
  readonly sizes?: string;
  /**
   * The accessible name. Composed by the caller from VERBATIM card fields —
   * `cards.ts` builds it the same way `titleFor` does, out of fixed labels
   * wrapped around real values. Nothing here composes prose.
   */
  readonly alt: string;
  /** Intrinsic width in pixels. Required; see the note above. */
  readonly width: number;
  /** Intrinsic height in pixels. Required; see the note above. */
  readonly height: number;
  /**
   * Drawn by us as an overlay, never sampled from the artwork — so the jewel's
   * three-channel contract (shape, numeral, colour) travels with the component
   * instead of depending on what the printed face happens to show. Rendered by
   * the caller through `jewel`; this component only positions it.
   */
  readonly pitch?: PitchValue;
  /** Eager only for the one face above the fold on a card page. */
  readonly loading?: "lazy" | "eager";
  /** Renders the jewel. Called only when `pitch` is set. */
  readonly jewel?: (pitch: PitchValue) => ReactNode;
}

export function CardFace({
  src,
  srcSet,
  sizes,
  alt,
  width,
  height,
  pitch,
  loading = "lazy",
  jewel,
}: CardFaceProps) {
  return (
    <figure
      className="of-card-face"
      style={{ "--face-ratio": `${width} / ${height}` } as CSSProperties}
    >
      <span className="of-card-face__frame">
        <img
          src={src}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding="async"
        />

        {pitch !== undefined && jewel ? (
          <span className="of-card-face__jewel">{jewel(pitch)}</span>
        ) : null}
      </span>
    </figure>
  );
}
