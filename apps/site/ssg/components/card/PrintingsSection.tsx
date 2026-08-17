/**
 * The "Printings" apparatus — every printing of this card, and what each says
 * about itself.
 *
 * Split out of `CardEntry`, which was 1,907 lines. #178 retired the printing
 * picker in favour of this table, and #181/#183/#184 reshaped its credit line,
 * so it is one of the two regions of the card page under continuous edit.
 *
 * The CSS stays in `CardEntry.css` — see `SourceSection` for why.
 */

import { OrnamentalRule } from "optfall-components/react";

import { faceKeyFor } from "../../../src/lib/faces";
import { buyDisclosure, buyHref, buyRel } from "../../../src/lib/tcgplayer";
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
  /** Distinct flavour texts across the printings, in printing order. */
  readonly flavours: readonly string[];
  /** Face key to the permalink for the printing that carries it. */
  readonly hrefByFace: ReadonlyMap<string, string>;
  /** Collector number to a qualifier, where two printings share a number. */
  readonly numberQualifier: ReadonlyMap<string, string>;
  /** The face currently selected on the page. */
  readonly shown: PrintingRef | undefined;
  /** Whether any printing has a buy link, which gates the disclosure. */
  readonly hasBuyLinks: boolean;
  /** Collector number to the label its buy link should carry. */
  readonly buyLabel: ReadonlyMap<string, string>;
}

export function PrintingsSection({
  page,
  flavours,
  hrefByFace,
  numberQualifier,
  shown,
  hasBuyLinks,
  buyLabel,
}: PrintingsSectionProps) {
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
                <th scope="col">Buy</th>
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
                const buy = buyHref(printing, "card-printings");

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
                        <a href={otherFace.href}>{otherFace.label}</a>
                      )}
                    </td>
                    {/*
                    THE ONLY COLUMN THAT LEAVES THE SITE, and the only reason
                    it is on the row rather than beside the face: a card route
                    addresses an ART, so a Standard and a Rainbow Foil struck
                    from one picture share a page and the URL cannot say which
                    a reader means. Upstream's storefront link carries
                    `Printing=` and names the foiling, so the row can say what
                    the address cannot.

                    AN EM DASH WHERE UPSTREAM LISTED NO PRODUCT, matching
                    every other column in this table. 1,336 of 16,502
                    printings are that shape — promos and organised play,
                    where whole sets carry none — and an absence is reported
                    as an absence rather than as "unavailable", exactly as the
                    legality table renders a flag it does not have.
                  */}
                    <td>
                      {buy === undefined ? (
                        "—"
                      ) : (
                        <a className="of-card__buy" href={buy} rel={buyRel()}>
                          TCGplayer
                          {/*
                          SIXTEEN LINKS READING "TCGplayer" ARE SIXTEEN
                          IDENTICAL LINKS to anything that lists them out of
                          context. The column header supplies the verb for a
                          reader who can see it; this supplies the whole
                          sentence for one who cannot.

                          IT NAMES ALL THREE AXES, and the edition is not
                          optional politeness. A printing is identified by
                          (number, edition, foiling) — the corpus builder says
                          so where it drops `set_printing_unique_id` — and Head
                          Jab's WTR098 is four printings across two editions
                          and two foilings. Number and foiling alone give the
                          two Standard rows identical names pointing at
                          different products, which is WCAG 2.4.4 and is the
                          same failure `numberQualifier` exists to prevent one
                          column to the left.

                          IT DOES NOT REUSE `numberQualifier`, which
                          disambiguates ADDRESSES rather than products: two
                          printings can share an art page — and therefore carry
                          no qualifier — while linking to two different things
                          here. `buyLabel` is that second map; see it for why
                          the name sometimes ends in a product id.

                          IT DOES NOT SAY "TCGplayer" TWICE. The visible text
                          is already the vendor, and this span follows it into
                          the same accessible name — so "on TCGplayer" here
                          would be announced as "TCGplayer — buy MST131,
                          Standard, on TCGplayer". `numberQualifier` suppresses
                          exactly this shape one column to the left, for
                          exactly this reason: heard aloud, the same word
                          twice.
                        */}
                          <span className="of-card__visually-hidden">
                            {` — buy ${
                              buyLabel.get(printing.unique_id) ?? printing.id
                            }`}
                          </span>
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
        THE DISCLOSURE SITS WITH THE LINKS, not in the site footer.
        TCGplayer's Partner Guidelines require it to be "clear, conspicuous,
        prominent and unambiguous to the average member of your audience" and
        put FTC compliance on us. Scryfall's equivalent wording lives in their
        footer inside a sentence about price accuracy; that is the looser
        reading, and a reference work whose whole claim is being right should
        not take it.

        THE TEXT SWITCHES ITSELF. `buyDisclosure` reads the same constant the
        links do, so the sentence cannot claim we earn nothing on a page whose
        links are earning — see `apps/site/src/lib/tcgplayer.ts`.

        AND IT ONLY APPEARS WHERE THERE IS SOMETHING TO DISCLOSE. A card whose
        every printing is a promo has a Buy column of em dashes, and a notice
        under it saying "buy links go to TCGplayer" would be describing links
        that are not on the page. The point of this sentence is that a claim on
        a page is true of THAT page.
      */}
        {hasBuyLinks ? (
          <p className="of-card__verify">{buyDisclosure()}</p>
        ) : null}

        {/*
        ONLY WHERE THE PRINTINGS DISAGREE. A card whose every printing carries
        the same flavour has that flavour shown once, in the panel. Repeating
        it here under a collector number would be the same words twice, the
        second time implying a distinction between printings that does not
        exist.
      */}
        {flavours.length > 1 ? (
          <div className="of-card__flavour">
            <h3 className="of-apparatus__heading" id="flavour">
              Flavour text, by printing
            </h3>
            <dl className="of-card__attributes">
              {page.printings
                .filter(({ printing }) => printing.flavor_text.trim() !== "")
                .map(({ printing }) => (
                  <div className="of-card__attribute" key={printing.unique_id}>
                    <dt className="of-card__collector">{printing.id}</dt>
                    <dd className="of-card__flavour-text">
                      {printing.flavor_text}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ) : null}
      </section>
    </>
  );
}
