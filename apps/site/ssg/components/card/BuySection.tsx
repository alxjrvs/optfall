/**
 * "Buy" — where this card can be bought, and the disclosure that says we are
 * paid for saying so.
 *
 * IT USED TO BE THE EIGHTH COLUMN OF THE PRINTINGS TABLE, and pulling it out is
 * the point of this file. Scryfall keeps its purchase links in their own block
 * rather than in the prints list, and the reason survives the copying: the
 * printings table answers "what exists", which is a reference question, and a
 * buy link answers "where do I get one", which is a commercial one. Mixed, the
 * table asked a reader to scan past commerce to read the corpus — and the
 * commerce was a column of em dashes on the 1,336 printings with no product,
 * which is a column that mostly says nothing.
 *
 * SEPARATING THEM ALSO GIVES THE DISCLOSURE SOMEWHERE HONEST TO SIT. It was
 * under the table, describing an eighth column; now it is under the links it
 * describes, with nothing between them. TCGplayer's Partner Guidelines want
 * disclosure that is "clear, conspicuous, prominent and unambiguous to the
 * average member of your audience", and adjacency is most of that.
 *
 * ONE ROW PER PURCHASABLE PRINTING, AND NO ROW FOR THE REST. The table renders
 * an absent product as an em dash because a table's job is to be complete
 * across its rows; a list of places to buy something has no such obligation,
 * and a row reading "— " under a heading called Buy would be advertising the
 * absence. A card with no purchasable printing renders no section at all.
 */

import { IconButton, OrnamentalRule } from "optfall-components/react";

import { buyDisclosure, buyHref, buyRel } from "../../../src/lib/tcgplayer";
import type { CardPage } from "../../../src/lib/cards";

import { TcgplayerMark } from "./TcgplayerMark";

export interface BuySectionProps {
  readonly page: CardPage;
  /** Collector number to the label its buy link should carry. */
  readonly buyLabel: ReadonlyMap<string, string>;
}

export function BuySection({ page, buyLabel }: BuySectionProps) {
  /*
    RESOLVED ONCE, HERE, rather than asked twice. `CardEntry` used to compute a
    `hasBuyLinks` flag beside this and the section then recomputed the hrefs to
    render them — two passes over the same predicate, which is two places for it
    to disagree. The list IS the flag: empty means no section.
  */
  const purchasable = page.printings
    .map(({ printing }) => ({
      printing,
      href: buyHref(printing, "card-printings"),
      what: buyLabel.get(printing.unique_id) ?? printing.id,
    }))
    .filter(
      (row): row is typeof row & { href: string } => row.href !== undefined,
    );

  if (purchasable.length === 0) return null;

  return (
    <>
      <OrnamentalRule label="Buy" />
      <section className="of-card__apparatus" aria-labelledby="buy">
        <h2 className="of-apparatus__heading" id="buy">
          Buy
        </h2>

        <ul className="of-card__buys">
          {purchasable.map(({ printing, href, what }) => (
            <li className="of-card__buy-row" key={printing.unique_id}>
              {/*
                THE PRINTING IS NAMED VISIBLY AND AGAIN INSIDE THE LINK, and
                that is not a duplicate. This span is a sibling of the anchor,
                so it is not part of the link's accessible name — a reader
                listing links out of context would otherwise get five identical
                "Buy on TCGplayer" entries, which is WCAG 2.4.4 and is the same
                failure the printings table's own hidden text was written to
                prevent. `IconButton`'s `detail` carries it into the name; this
                carries it to the eye.
              */}
              <span className="of-card__buy-what">{what}</span>
              <IconButton
                detail={what}
                href={href}
                icon={<TcgplayerMark />}
                label="Buy on TCGplayer"
                rel={buyRel()}
              />
            </li>
          ))}
        </ul>

        {/*
          THE TEXT SWITCHES ITSELF. `buyDisclosure` reads the same constant the
          links do, so the sentence cannot claim we earn nothing on a page whose
          links are earning — see `apps/site/src/lib/tcgplayer.ts`.
        */}
        <p className="of-card__verify">{buyDisclosure()}</p>
      </section>
    </>
  );
}
