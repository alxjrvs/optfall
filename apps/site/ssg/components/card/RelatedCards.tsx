/**
 * The "Related cards" apparatus — the two reverse joins over card text.
 *
 * Split out of `CardEntry`, which was 1,907 lines. This is the region #170,
 * #172, #176 and #182 kept reshaping — one row per name, a stone per version,
 * the qualifier a destination needs — so it is the part of the card page most
 * likely to be edited next, and the part that was hardest to find inside a
 * fifteen-hundred-line function.
 *
 * The grouping itself is not here: `groupByName` and `groupTarget` are domain
 * logic and live in `src/lib/card-versions.ts`.
 *
 * The CSS stays in `CardEntry.css` — see `SourceSection` for why.
 */

import { OrnamentalRule, PitchJewel } from "optfall-components/react";

import type { CardLink } from "../../../src/lib/cards";
import { groupByName, groupTarget } from "../../../src/lib/card-versions";

/** A heading, its explanation, and the links under it. */
export type RelatedGroup = readonly [string, string, readonly CardLink[]];

export function RelatedCards({
  relatedShown,
}: {
  readonly relatedShown: readonly RelatedGroup[];
}) {
  return (
    <>
      {relatedShown.length > 0 ? (
        <>
          <OrnamentalRule label="Related cards" />
          <section className="of-card__apparatus" aria-labelledby="related">
            <h2 className="of-apparatus__heading" id="related">
              Related cards
            </h2>
            {relatedShown.map(([label, blurb, links]) => (
              <div className="of-card__related" key={label}>
                <h3 className="of-card__related-name">{label}</h3>
                <p className="of-card__scope">{blurb}</p>
                <ul className="of-card__links">
                  {groupByName(links).map((group) => {
                    const target = groupTarget(group);
                    return (
                      <li className="of-card__link" key={group.name}>
                        {/*
                      ONE ROW PER NAME, WITH A STONE PER VERSION — and which
                      of them is a link follows `CardIndex`'s rule rather than
                      a second one invented here.

                      This listed one row per CARD, so `Runechant` carried 119
                      rows across the lists it had where 69 names exist. The
                      pitch was the only thing that differed, which is exactly
                      what a stone is for. Grouping took 10,868 rows to 6,816
                      at the time; retiring the Other versions list has since
                      taken the two remaining lists to 20,372 rows across
                      4,388 pages, 3,883 of them carrying more than one
                      stone — so the collapse is doing MORE work here now, not
                      less, because the list that survived is the one where
                      one name really can mean several cards.

                      THE NAME IS ALWAYS THE LINK. `PitchStones` in
                      `CardIndex`: "a stone is a link only where there is
                      something to choose between." A first pass at this list
                      dropped the name's anchor on multi-version rows and left
                      the stones as the only way in — so a reader who had
                      learned on a set page that the name is the card found,
                      on a card page, that it was inert text. The information
                      the two surfaces carry is identical and now so is what
                      can be clicked; what still differs is only how the mark
                      is DRAWN, which `CardIndexEntry.versions` already argues
                      is a per-surface choice rather than an inconsistency.

                      GROUPED BY NAME, WHICH IS SOUND HERE AND WOULD NOT BE
                      EVERYWHERE. Two cards sharing a name in these lists are
                      always the pitch versions of one card — 900 names belong
                      to more than one card and that is what those are — so a
                      name plus a pitch identifies a link. Measured: zero
                      groups in the whole corpus contain two links at the same
                      pitch, which is the collision that would make a stone
                      ambiguous, and the test pins that at zero.
                    */}
                        <a className="of-card__link-name" href={target.href}>
                          {group.name}
                          {/*
                        READ BUT NOT SEEN, exactly as `of-index__variant` is
                        in the card index. Empty on a row that points at the
                        shared page, because there is nothing left to qualify;
                        see `groupTarget`.
                      */}
                          {target.qualifier === "" ? null : (
                            <span className="of-card__visually-hidden">
                              {target.qualifier}
                            </span>
                          )}
                        </a>
                        <span className="of-card__link-pitches">
                          {group.links.map((link) =>
                            group.links.length === 1 ? (
                              /*
                            A SOLE VERSION DRAWS A PLAIN STONE, unlinked, for
                            the reason `PitchStones` gives: it would point
                            where the name beside it already points — a second
                            control, in a smaller target, for one destination.
                            Half the rows take this branch (51.1% of groups
                            have one version), so it is the common shape rather
                            than an edge.
                          */
                              <PitchJewel
                                key={link.href}
                                value={link.pitch}
                                size="sm"
                              />
                            ) : (
                              /*
                            THE STONE CARRIES THE LINK'S NAME, via
                            `PitchJewel`'s own `label` prop rather than a
                            hidden span beside it. A `role="img"` with an
                            `aria-label` contributes that string to the
                            anchor's accessible name, so the link is called
                            "Head Jab (pitch 2)" with NO text in the DOM at
                            all — which is what keeps two stones on one row
                            from being two links called the same thing, and
                            leaves nothing for a drag-select to pick up.

                            `link.label`, not `link.name`: the label is the one
                            composed to tell two same-named cards apart, and
                            here it is the whole of what names the link.
                          */
                              <a
                                className="of-card__pitch-link"
                                href={link.href}
                                key={link.href}
                              >
                                <PitchJewel
                                  value={link.pitch}
                                  size="sm"
                                  label={link.label}
                                />
                              </a>
                            ),
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        </>
      ) : null}
    </>
  );
}
