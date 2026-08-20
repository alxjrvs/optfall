/**
 * Filigree, rationed — scrollwork in one of its three sanctioned roles. React
 * port.
 *
 * `docs/DESIGN.md`: leaving scrollwork out made the first pass read as austere
 * Swiss rather than as Rathe, so it comes back — but it "earns a place in
 * exactly three roles: the corners of a feature panel, the corners of a card
 * frame, and a section rule. Never on a control, never on a list, never twice on
 * one screen." That last clause is retired for `section-rule` — every rule on
 * the site draws a centre mark now, and `OrnamentalRule.tsx` says why — and
 * holds for the two roles this component is actually spent on today, since
 * nothing mounts a filigree in a rule. The `OrnamentRole` union *is* that
 * ration, and this component
 * takes nothing else: there is no `size`, no `tone`, no `variant`. A prop that
 * let a caller put filigree somewhere new would spend the signal, and the signal
 * is the whole reason it exists.
 *
 * THIS COMPONENT DRAWS SCROLLWORK AND OWNS NO LAYOUT. That sentence is the
 * contract, and it is written down because getting it wrong twice cost this
 * library two collisions with its own primitives:
 *
 * - **Placement belongs to the host.** `BevelledPlate` opens four
 *   correctly-placed corner slots and calls its `corner` render prop for each,
 *   passing the corner id. So one instance of this component is *one* ornament,
 *   told by `corner` which corner it is drawing, and it positions nothing and
 *   sizes nothing — it fills the slot it was given:
 *
 *   ```tsx
 *   <BevelledPlate
 *     ornament="panel-corner"
 *     corner={(id) => <FiligreeCorner role="panel-corner" corner={id} />}
 *   />
 *   ```
 *
 *   An earlier version drew all four corners itself, which rendered sixteen
 *   ornaments through that slot and stacked them inside one box, because its own
 *   absolute positioning resolved against the slot rather than against the
 *   plate.
 * - **The section rule belongs to `OrnamentalRule`.** In the `section-rule` role
 *   this emits a bare figure: no lines, no `role="separator"`, no vertical
 *   rhythm. `OrnamentalRule` owns the `<hr>` semantics, the two hairlines and
 *   the margins, which is what its name says. An earlier version rendered a
 *   complete rule here as well, so following `OrnamentalRule`'s own composition
 *   instructions produced four hairlines at two different weights, doubled
 *   rhythm, and a `separator` buried inside an `aria-hidden` mount where the
 *   accessibility tree discarded it.
 *
 * **Drawn as inline SVG, never a font or an image.** A glyph would need a
 * webfont we have not licensed and would inherit `font-size` rather than the
 * ornament token; a raster would not scale and could not take `currentColor`.
 * Inline paths give us both, and keep the drawing auditable in review — which
 * matters for the compliance point below.
 *
 * **THE ACCESSIBLE NAME IS DELIBERATELY ABSENT, AND THIS IS THE ONE PLACE THAT
 * IS RIGHT.** Every other primitive in this library takes a name prop with a
 * sensible default, because a name a caller can forget is a name that will be
 * forgotten. Filigree is the exception that proves it: there is no label prop
 * because the ornament carries no information at all, and a name would make
 * assistive technology announce pure decoration four times per panel. So the svg
 * is `aria-hidden="true"` and `focusable="false"` unconditionally — not by
 * default, unconditionally, in all three roles. The caller cannot name it, which
 * is the same discipline as the caller not being able to *un*-name a pitch
 * jewel. Nothing here is ever the only carrier of anything: remove every
 * ornament in the library and no information is lost, which is what "decoration"
 * has to mean to be honest.
 *
 * **Compliance.** LSS's policy prohibits not merely copying their marks but
 * creating any *close semblance* to them. Every path below is abstract
 * scrollwork drawn from scratch — a volute, two crescent leaves and a lozenge
 * bead — with no reference to any Legend Story Studios logo, set symbol or frame
 * asset. It borrows the register (struck, angular, chiselled) and none of the
 * form.
 */

import type { OrnamentRole } from "optfall-theme";

import { FILIGREE_PATHS, type PlateCorner } from "../index";
import "./FiligreeCorner.css";

export interface FiligreeCornerProps {
  /**
   * Which of the three sanctioned roles this is. Required, with no default:
   * "wherever you happen to have dropped it" is not one of the three.
   */
  readonly role: OrnamentRole;
  /**
   * Which corner of the frame this instance is drawing, in CSS logical order —
   * block axis first, then inline, exactly as `border-start-start-radius` names
   * them. It selects the mirroring of the motif and nothing else; the host slot
   * supplies the position. Ignored in the `section-rule` role.
   *
   * It defaults to `start-start` rather than being required so that the
   * single-corner case reads cleanly, but a host with four slots must pass the
   * id it already has — see `BevelledPlate`'s `corner` render prop.
   */
  readonly corner?: PlateCorner;
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

/*
 * THE PATHS MOVED TO `src/index.ts`, BESIDE `MARK_GEOMETRY`, AND FOR ITS REASON.
 *
 * They gained a second consumer — `scripts/build-design-system.ts` draws this
 * ornament on the `filigree-corner` design-system card — and that generator's
 * own header records what happens to a drawing it keeps a private copy of: the
 * card goes on showing a rendering the product no longer has. One definition,
 * two renderers.
 *
 * What did NOT move is the sizing below. `box`, the stroke weight and the
 * relief `lift` are presentation, chosen per role by whoever renders; the
 * scrollwork is the part that has to agree.
 */
const { panel: PANEL, card: CARD, rule: RULE, mirror: MIRROR } = FILIGREE_PATHS;

export function FiligreeCorner({
  role,
  corner = "start-start",
}: FiligreeCornerProps) {
  const isRule = role === "section-rule";
  const isPanel = role === "panel-corner";

  const box = isPanel ? 48 : 32;
  const strokes = isPanel ? PANEL.strokes : CARD.strokes;
  const fills = isPanel ? PANEL.fills : CARD.fills;
  const weight = isRule ? 1.4 : isPanel ? 1.6 : 1.3;

  /**
   * The bevel offset, in user units. A light pass above and a dark pass below
   * the ink is the system's "light top edge, dark bottom edge" rule applied to a
   * line rather than to a plate.
   */
  const lift = isPanel ? 1.1 : 0.8;

  /** Ink last, so it sits on top of both relief passes. */
  const passes = [
    { tone: "of-filigree__relief-dark", shift: `translate(0 ${lift})` },
    { tone: "of-filigree__relief-light", shift: `translate(0 ${-lift})` },
    { tone: "of-filigree__ink", shift: "translate(0 0)" },
  ];

  if (isRule) {
    return (
      /*
        A bare figure. The separator role, the hairlines and the vertical rhythm
        are `OrnamentalRule`'s, because a rule is structure and this is not.
      */
      <svg
        className="of-filigree of-filigree--figure"
        viewBox={RULE.viewBox}
        aria-hidden="true"
        focusable="false"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        strokeWidth={weight}
      >
        {passes.map((pass) => (
          <g key={pass.tone} className={pass.tone} transform={pass.shift}>
            {[1, -1].map((half) => (
              <g
                key={half}
                transform={
                  half === 1 ? "translate(0 0)" : "translate(72 0) scale(-1 1)"
                }
              >
                {RULE.strokes.map((d) => (
                  <path key={d} d={d} fill="none" />
                ))}
                {RULE.fills.map((d) => (
                  <path key={d} d={d} stroke="none" />
                ))}
              </g>
            ))}
            <path d={RULE.centre} stroke="none" />
          </g>
        ))}
      </svg>
    );
  }

  return (
    /*
      One corner, mirrored into place inside its own viewBox. Purely decorative,
      so it is hidden outright rather than merely unnamed.
    */
    <svg
      className={`of-filigree of-filigree--corner of-filigree--${role}`}
      data-corner={corner}
      viewBox={`0 0 ${box} ${box}`}
      aria-hidden="true"
      focusable="false"
      strokeLinecap="butt"
      strokeLinejoin="miter"
      strokeWidth={weight}
    >
      {/*
        THE RELIEF PASS IS OUTSIDE THE MIRROR, AND THE ORDER IS THE POINT. Light
        comes from above in every corner of the frame, so the light pass has to
        sit above the ink in *screen* space. Nested the other way round,
        `end-start` and `end-end` — which mirror on the y axis — would carry
        their bevel upside down, lighting the plate from below on half the panel.
        Mirroring happens about the centre of the viewBox rather than about its
        origin, so one transform serves all four corners without a per-corner
        translate that has to be kept in step with `box`.
      */}
      {passes.map((pass) => (
        <g key={pass.tone} className={pass.tone} transform={pass.shift}>
          <g
            transform={`translate(${box / 2} ${box / 2}) ${MIRROR[corner]} translate(${-box / 2} ${-box / 2})`}
          >
            {strokes.map((d) => (
              <path key={d} d={d} fill="none" />
            ))}
            {fills.map((d) => (
              <path key={d} d={d} stroke="none" />
            ))}
          </g>
        </g>
      ))}
    </svg>
  );
}
