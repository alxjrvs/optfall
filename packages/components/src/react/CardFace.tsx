/**
 * A card face — the printed image, and the copyright line that is the
 * condition of being allowed to show it. The React port.
 *
 * THE COPYRIGHT LINE IS NOT A PROP, AND THIS COMPONENT IS THE REASON THAT
 * WORKS. `docs/COMPLIANCE.md` §5 requires the line be "not a prop the caller
 * may omit, not a default that can be overridden to empty, and not the page's
 * responsibility", and it names the ways that could be undone: making it a
 * prop, or "adding a `compact` or `bare` variant that drops it". There is no
 * such variant here and there must never be one. The line is emitted from
 * {@link CARD_IMAGE_COPYRIGHT} on every render, at every tier, and a caller
 * who wants the image gets the line.
 *
 * It is small and muted at thumbnail size, and it is genuinely rendered rather
 * than hidden. A grid of sixty faces therefore carries sixty short notices,
 * and that is the correct-looking outcome rather than a cost to engineer
 * around: this is what a compliant card database looks like, and the
 * permission it satisfies is the only reason any of these images may be shown
 * at all.
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

import { CARD_IMAGE_COPYRIGHT } from "../index";
import "./CardFace.css";
import { useInsideCardFaceGroup } from "./CardFaceGroup";

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
  /**
   * A group above us carries the notice for all of its faces.
   *
   * READ FROM CONTEXT, NOT FROM A PROP, and that distinction is the whole
   * guarantee. §5 forbids a prop the caller may omit and a variant that drops
   * the line — a caller cannot forge this from markup, and the only thing that
   * sets it is `CardFaceGroup`, which emits the notice itself. The line is
   * hoisted, never dropped: a face outside a group still carries its own.
   */
  const carriedByGroup = useInsideCardFaceGroup();

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

      {/*
        Not optional, not overridable, not the page's job. See the block comment
        above and docs/COMPLIANCE.md §5. The only thing that suppresses it here
        is a `CardFaceGroup` ancestor, which emits it for the whole group.
      */}
      {carriedByGroup ? null : (
        <figcaption className="of-card-face__copyright">
          {CARD_IMAGE_COPYRIGHT}
        </figcaption>
      )}
    </figure>
  );
}
