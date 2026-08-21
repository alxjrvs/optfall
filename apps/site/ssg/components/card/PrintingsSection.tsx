/**
 * The "Printings" apparatus — every printing of this card, and what each says
 * about itself.
 *
 * Split out of `CardEntry`, which was 1,907 lines. #178 retired the printing
 * picker in favour of this table, and #181/#183/#184 reshaped its credit line,
 * so it is one of the two regions of the card page under continuous edit.
 *
 * The CSS stays in `CardEntry.css`: the classes are all `of-card__*` and the
 * bundle is assembled by a glob over `components/*.css`, which does not
 * descend into this directory. Moving the rules here would silently drop them
 * from every page — `styles.entry.ts` records that exact failure happening
 * once.
 */

import { OrnamentalRule } from "optfall-components/react";

import { faceKeyFor } from "../../../src/lib/faces";
import type { PrintingRef } from "../../../src/lib/printings";
import type { CardPage } from "../../../src/lib/cards";
import {
  editionLabel,
  foilingName,
  hrefForSet,
  rarityName,
  setName,
} from "../../../src/lib/sets";

/**
 * Everything this section needs that `CardEntry` already computed.
 *
 * They are passed rather than recomputed because each is derived from the
 * whole page — `numberQualifier` in particular dedupes collector numbers
 * ACROSS printings, so it cannot be worked out from one row.
 */
export interface PrintingsSectionProps {
  readonly page: CardPage;
  /** Face key to the permalink for the printing that carries it. */
  readonly hrefByFace: ReadonlyMap<string, string>;
  /** Collector number to a qualifier, where two printings share a number. */
  readonly numberQualifier: ReadonlyMap<string, string>;
  /** The face currently selected on the page. */
  readonly shown: PrintingRef | undefined;
}

export function PrintingsSection({
  page,
  hrefByFace,
  numberQualifier,
  shown,
}: PrintingsSectionProps) {
  /**
   * What tells two BACK-FACE links apart when they read the same words.
   *
   * `numberQualifier` one column over, and the same rule arrived at from the
   * other end. Every row's back link addresses that row's OWN back now rather
   * than the other card's default printing — which is the point, and which is
   * what makes two rows able to point at two arts under one name: Dash's ARC002
   * First and ARC002 Unlimited back onto `ARC039` and `U-ARC039` Azalea, and
   * both cells read "Azalea". Two links spoken alike going to different places
   * is WCAG 2.4.4, and it is exactly the failure the collector column already
   * handles.
   *
   * THE KEY IS THE DISCRIMINATOR, not the row's own edition. `numberQualifier`
   * names the axis that separates two printings OF THIS CARD; what separates
   * two backs is which art of the BACK card each one is, and the face key is
   * that, uniquely, by construction. It is also the backstop the collector
   * column falls back to, so the two columns speak one vocabulary.
   *
   * ONLY WHERE IT IS AMBIGUOUS. A back named once on the page needs nothing,
   * which is all but a handful of the 271 pages that draw this column at all.
   */
  const backQualifier = ((): ReadonlyMap<string, string> => {
    const addressesByLabel = new Map<string, Set<string>>();
    for (const { otherFace } of page.printings) {
      if (otherFace === null) continue;
      const found = addressesByLabel.get(otherFace.label) ?? new Set<string>();
      found.add(otherFace.href);
      addressesByLabel.set(otherFace.label, found);
    }

    const qualifiers = new Map<string, string>();
    for (const { printing, otherFace } of page.printings) {
      if (otherFace === null) continue;
      if ((addressesByLabel.get(otherFace.label)?.size ?? 0) < 2) continue;
      const stem = otherFace.faceKey?.replace(/\.webp$/, "") ?? "";
      if (stem !== "") qualifiers.set(printing.unique_id, ` (${stem})`);
    }
    return qualifiers;
  })();

  return (
    <>
      <OrnamentalRule label="Printings" />
      <section className="of-card__apparatus" aria-labelledby="printings">
        <h2 className="of-apparatus__heading" id="printings">
          Printings
        </h2>
        <div className="of-card__scroller">
          <table className="of-card__printings">
            <caption className="of-card__visually-hidden">
              Every published printing of {page.label}
            </caption>
            <thead>
              <tr>
                <th scope="col">Number</th>
                <th scope="col">Set</th>
                <th scope="col">Rarity</th>
                <th scope="col">Edition</th>
                <th scope="col">Foiling</th>
                <th scope="col">Artist</th>
                <th scope="col">Other face</th>
              </tr>
            </thead>
            <tbody>
              {page.printings.map(({ printing, otherFace }) => {
                /*
                THE COLLECTOR NUMBER IS THE CONTROL — this is where the
                picker went.

                A rail of thumbnails under the face used to do this job and
                did it worse. A tile could caption three facts and this row
                names seven; 279 tiles in the corpus read identically to a
                sibling, so a reader could see two pictures differ, select
                either, and not learn which they had chosen. Here the row IS
                the answer, and clicking its number opens the page that shows
                that art.

                AN ADDRESS IS PER ART, NOT PER PRINTING, and that is the cost
                of the trade rather than an oversight. `facesOf` dedupes by
                image and `CARD_ROUTES` emits one URL per art, so a Standard
                and a Rainbow Foil published from one picture share a page —
                the rarity in the caption up there is then the one belonging
                to the printing that claimed the art, which is the row marked
                current. Both rows still tell the truth in their own cells,
                which is what the table is for.

                A PRINTING WITH NO PUBLISHED IMAGE IS NOT A LINK, because
                there is no picture for it to open. Four printings in this
                corpus are that shape; their rows keep every other column.
              */
                const key = faceKeyFor(printing.image_url);
                const href = key === null ? undefined : hrefByFace.get(key);
                const current =
                  shown !== undefined &&
                  shown.printing.unique_id === printing.unique_id;
                const qualifier = numberQualifier.get(printing.unique_id) ?? "";
                /* The same, for the back-face column. See `backQualifier`. */
                const backSaid = backQualifier.get(printing.unique_id) ?? "";

                return (
                  <tr
                    key={printing.unique_id}
                    className={current ? "of-card__printing--shown" : undefined}
                  >
                    <th scope="row" className="of-card__collector">
                      {href === undefined ? (
                        printing.id
                      ) : (
                        /*
                        `aria-current="page"`, AND IT USED TO BE `"true"`
                        BECAUSE OF A PAGE THAT NO LONGER EXISTS. `"page"`
                        claims the link addresses the URL being rendered. That
                        was true of a card's own route and its per-art routes
                        and FALSE of `/card/head-jab` — the shared page for a
                        name, which rendered the first version's card and so
                        would have marked a row pointing somewhere else as the
                        page you are on. `"true"`, the weaker "current item
                        within a set", was the only claim true on every route.

                        Every route is a printing now and every printing's row
                        addresses itself, so the stronger claim is simply
                        accurate — and it is the one a screen reader can do
                        something with, since "page" is the value that gets
                        announced as *this page* rather than as an unspecified
                        currency.

                        It is still a link, which is what makes the row
                        copyable: the marked row is the permalink for the art
                        at the top of this page.
                      */
                        <a
                          href={href}
                          aria-current={current ? "page" : undefined}
                        >
                          {printing.id}
                          {qualifier === "" ? null : (
                            <span className="of-card__visually-hidden">
                              {qualifier}
                            </span>
                          )}
                        </a>
                      )}
                    </th>
                    {/*
                  IN WORDS, WITH THE CODE KEPT BESIDE IT. The name is what a
                  reader wants; the code is what a printing is CITED by, so
                  both are here. An unknown code falls back to itself rather
                  than to a blank.
                */}
                    <td>
                      <a href={hrefForSet(printing.set_id)}>
                        {setName(printing.set_id)}
                      </a>
                      <span className="of-card__code-hint">
                        {printing.set_id}
                      </span>
                    </td>
                    <td>
                      {printing.rarity === ""
                        ? "—"
                        : rarityName(printing.rarity)}
                    </td>
                    {/*
                    AN EM DASH WHERE THERE IS NO EDITION, and `N` is no
                    edition. Upstream glosses that code as "No specified
                    edition (used for promos, non-set releases, etc.)" — its
                    own explanation of an absence, in the commonest edition in
                    the corpus — which this column printed in full on most
                    rows of most cards. See `editionLabel`.
                  */}
                    <td>{editionLabel(printing.edition) ?? "—"}</td>
                    <td>
                      {printing.foiling === ""
                        ? "—"
                        : foilingName(printing.foiling)}
                    </td>
                    <td>
                      {printing.artists.length === 0
                        ? "—"
                        : printing.artists.join(", ")}
                    </td>
                    <td>
                      {otherFace === null ? (
                        "—"
                      ) : (
                        <a href={otherFace.href}>
                          {otherFace.label}
                          {/* READ BUT NOT SEEN, exactly as the collector
                              number's qualifier is. The column still reads as
                              a list of names; what a screen reader gets is a
                              name that identifies which back. */}
                          {backSaid === "" ? null : (
                            <span className="of-card__visually-hidden">
                              {backSaid}
                            </span>
                          )}
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/*
        NO FLAVOUR HERE, AND THAT IS THE CHANGE. A "Flavour text, by printing"
        list stood below this table, rendered whenever the printings carried
        more than one distinct wording: one row per printing, keyed by
        collector number. Its own comment defended the condition — a card whose
        printings agree should not read its flavour twice — but the condition
        was never the problem the list had.

        A ROW IS A PRINTING AND PRINTINGS SHARE WORDING, so the list repeated
        itself: on Steelblade Shunt (pitch 2), six rows of which four read
        WTR127 and the identical sentence — Alpha and Unlimited, Standard and
        Rainbow Foil, and the list keyed on the collector number alone so it
        named none of that. It implied a distinction between printings that was
        not there, which is precisely what the condition existed to prevent.
        The table two lines up already tells those four apart, in columns.

        The flavour is the panel's now, and it is the SHOWN printing's rather
        than the card's — see `flavour` in `CardEntry.tsx` for what that costs.
      */}
      </section>
    </>
  );
}
