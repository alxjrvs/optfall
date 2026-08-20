/**
 * The mark — three interlocked links. React port.
 *
 * WHAT IT REPLACED AND WHY. The mark was a cut jewel: the pitch diamond,
 * cleaved and falling, on the argument that the logo and the core interface
 * primitive should be the same object. That was a good argument for a mark that
 * says *Flesh and Blood*. It is the wrong argument for this one, because the
 * jewel says what the game is and the chain says what the TOOL does.
 *
 * Optfall joins things. A card to the rule that governs it, a rule back to every
 * card that prints its keyword, a printing to its legality and to the upstream
 * flags that produced it. `docs/SCRYFALL-GAP.md` calls the card↔rules
 * cross-reference "the join nothing currently makes", and it is the one thing
 * here that no other tool has. A chain is that, drawn.
 *
 * THE INTERLOCK IS PURE PAINT ORDER — no mask, no subtraction, no cut edges.
 * Each link crosses its neighbour twice, and a real chain is on top at one
 * crossing and under at the other. Drawing left to right settles both the same
 * way, which reads as one ring lying flat over another; redrawing a link inside
 * a rectangle that contains only its UPPER crossing puts it back on top there
 * and nowhere else. The rectangles come from `MARK_GEOMETRY` and sit in the
 * empty band between each pair's two crossings, so nothing is ever clipped
 * through a link's own edge — which is what earlier attempts did, and why they
 * produced odd angled bites out of the rings.
 *
 * IT IS DRAWN AS AN SVG BECAUSE IT HAS TO SURVIVE A FAVICON, and the honest
 * finding at 16px is that three links are a smudge. That finding once bought a
 * reduced mark — one link, upright — for the tab and then for the installed-app
 * icon, and both have since gone back to the chain: an icon that is not the
 * logo is worse at every size than the logo is at its worst size. So
 * `apps/site/ssg/assets.ts` draws THIS chain, from these same constants, and
 * the 16px case is accepted rather than designed around.
 *
 * NOT SQUARE, AND THE SIZING FOLLOWS. The chain is about twice as wide as it is
 * tall, so the component sets a HEIGHT from `ornament.mark.*` and lets the
 * `viewBox` supply the width. A square box would letterbox it, and writing both
 * numbers would put a second copy of the aspect ratio somewhere it could drift
 * from the geometry.
 */

import { useId } from "react";

import { MARK_GEOMETRY } from "../index";
import "./Mark.css";

export interface MarkProps {
  /** Rendered size, in token steps rather than pixels. */
  readonly size?: "sm" | "md" | "lg";
  /**
   * Which fill set.
   *
   * `pitch` is canonical: the three links carry the three pitch values, red,
   * yellow and blue. `docs/DESIGN.md` rations colour to data and reserves the
   * pitch palette for pitch — and this is the one sanctioned exception, argued
   * there: the mark is not a card, so its links are not a pitch *value*. They
   * are the three-value system itself, spent once, as identity.
   *
   * `ink` is the alternate for surfaces that cannot take three colours — and it
   * is the more legible of the two when small, which is worth knowing before
   * choosing.
   */
  readonly variant?: "pitch" | "ink";
  /**
   * Accessible name. The product's name is the right default for a logo, and it
   * cannot be emptied — a blank falls back rather than through. To suppress the
   * name, say so with `decorative`.
   */
  readonly title?: string;
  /**
   * Render the mark as pure decoration: `aria-hidden`, with no role, no name and
   * no `<title>` child. For the one case where the name is already on the page —
   * the mark beside a visible "Optfall" wordmark, where announcing it twice is
   * noise rather than information.
   */
  readonly decorative?: boolean;
}

export function Mark({
  size = "md",
  variant = "pitch",
  title = "Optfall",
  decorative = false,
}: MarkProps) {
  /** A blank name is a missing name, and a logo's name is never missing. */
  const name = title?.trim() || "Optfall";

  /**
   * `aria-labelledby` rather than a bare `<title>`, because a `<title>` child is
   * mapped to the accessible name inconsistently across engines while this
   * association is not. The id is generated per instance, so a page carrying the
   * mark twice — header and footer — does not emit a duplicate id.
   *
   * The same id seeds the clip ids, for the same reason. A page rendering the
   * mark twice would otherwise emit two `clipPath`s with one id, and every
   * reference resolves to the first — so the second mark's scopes would clip
   * against the first's rectangles. On a page where both are the same size that
   * is invisible; at two different sizes it is a mark with its interlock
   * silently inside out.
   */
  const titleId = useId();
  const scopeId = (index: number): string => `${titleId}-scope-${index}`;

  return (
    /*
      THE TITLE IS CONDITIONAL AND THE RULE CANNOT SEE THAT. Either the mark
      carries a `<title>` and an `aria-labelledby` pointing at it, or it is
      `decorative` and carries `aria-hidden="true"` — and `decorative` exists
      precisely for the case where naming it a second time is noise, the mark
      beside a visible "Optfall" wordmark. Both branches are correct; a
      `<title>` on the hidden one would be a name nothing reads.
    */
    // biome-ignore lint/a11y/noSvgWithoutTitle: named when visible, hidden when decorative — see above.
    <svg
      className={`of-mark of-mark--${size}`}
      data-variant={variant}
      viewBox={MARK_GEOMETRY.viewBox}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? "true" : undefined}
      aria-labelledby={decorative ? undefined : titleId}
      focusable="false"
    >
      {decorative ? null : <title id={titleId}>{name}</title>}

      <defs>
        {MARK_GEOMETRY.scopes.map((scope, index) => (
          <clipPath key={scopeId(index)} id={scopeId(index)}>
            <rect
              x={scope.x}
              y={scope.y}
              width={scope.width}
              height={scope.height}
            />
          </clipPath>
        ))}
      </defs>

      {/*
        Every link, left to right. This settles the LOWER crossing of each pair:
        the right-hand link is drawn later, so it lies over its neighbour.
      */}
      {MARK_GEOMETRY.placements.map((placement, index) => (
        <g key={placement} transform={placement}>
          <path
            className="of-mark__link"
            data-link={index}
            d={MARK_GEOMETRY.link}
            fillRule="evenodd"
          />
        </g>
      ))}

      {/*
        And the UPPER crossing of each pair, by redrawing the left-hand link
        inside a rectangle that contains only that crossing. Same path, same
        transform, same fill — the only thing added is where it is allowed to
        appear.
      */}
      {MARK_GEOMETRY.scopes.map((scope, index) => (
        <g key={scopeId(index)} clipPath={`url(#${scopeId(index)})`}>
          <g transform={MARK_GEOMETRY.placements[scope.link]}>
            <path
              className="of-mark__link"
              data-link={scope.link}
              d={MARK_GEOMETRY.link}
              fillRule="evenodd"
            />
          </g>
        </g>
      ))}
    </svg>
  );
}
