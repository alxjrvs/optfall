/**
 * Where a printing can be bought, and whether we are paid for saying so.
 *
 * ONE CONSTANT DECIDES BOTH, and that is the whole point of this module.
 * {@link AFFILIATE_ID} is `null` until TCGplayer's partner programme approves
 * the application; setting it turns every link on the site into an affiliate
 * link **and** switches the disclosure from "we link there" to "we are paid for
 * this". Those two must never disagree — a site that earns a commission while
 * telling readers it does not is the one failure here that actually matters —
 * so they are derived from the same value rather than maintained in parallel.
 *
 * WHAT WE DO NOT DO. No price, ever. TCGplayer's public API has been closed to
 * new applicants since late 2024, but that is the lesser reason: a price needs a
 * refresh cadence, and this project's whole provenance story is committed JSON
 * pinned by commit. A stale price is exactly the confidently-wrong answer
 * `README.md` says this tool cannot produce. `docs/PLAN.md` puts the collector
 * economy out of scope and it stays there — a link says "this printing is
 * purchasable, here", which is a fact about the world that does not rot in
 * hours.
 *
 * WHY WE MAY DO THIS AT ALL. LSS's Terms of Use permit card databases to
 * monetise indirectly, naming "ad-sense on YouTube videos and website traffic",
 * and permit singles commerce on top of card images outright. An affiliate
 * commission is payment for referred traffic. See `docs/COMPLIANCE.md` §2, which
 * carries the clause verbatim along with the precedent.
 */

/**
 * Our Impact partner identifier, or `null` while the application is pending.
 *
 * FLIPPING THIS IS THE ENTIRE DEPLOYMENT. Set it to the numeric id Impact
 * issues — as a string — and nothing else in the repository needs to change:
 * links gain their wrapper, the disclosure gains its sentence, and the tests
 * that assert both flip with it.
 */
export const AFFILIATE_ID: string | null = null;

/**
 * TCGplayer's campaign path, which is theirs rather than ours.
 *
 * Identical across every partner — Scryfall and FaBrary both publish links on
 * this exact path with only the account segment differing — so it is a constant
 * of the programme, not a value we were issued.
 */
const CAMPAIGN_PATH = "1830156/21018";

const PARTNER_ORIGIN = "https://partner.tcgplayer.com/c";

/**
 * Where on the site a link sits, reported back to us in Impact's own numbers.
 *
 * A closed set rather than a free string, because the value's only job is to be
 * grouped by later, and a typo produces a silently separate row that looks like
 * a placement nobody built.
 */
export type Placement = "card-printings";

/**
 * True when links carry our affiliate identifier, and therefore when the page
 * must disclose that we are paid.
 *
 * Read this rather than testing {@link AFFILIATE_ID} directly, so the disclosure
 * and the links can never be reasoned about separately.
 */
export function isAffiliate(
  affiliateId: string | null = AFFILIATE_ID,
): boolean {
  return affiliateId !== null;
}

/** A printing's TCGplayer fields, as the corpus carries them. */
interface Purchasable {
  readonly tcgplayer_url?: string;
}

/**
 * The href for a printing's storefront page, or `undefined` when upstream
 * published no product for it.
 *
 * `undefined` IS A REAL ANSWER HERE, not a failure. 1,336 of 16,502 printings
 * have no TCGplayer product — promos and organised-play sets, where WIN, SBL,
 * SBA, SLY, SGB and the armory sets carry none at all. A caller renders nothing
 * for those, exactly as the legality table renders a missing flag as absent
 * rather than as `false`.
 *
 * The destination is upstream's URL untouched, including the `Printing=`
 * parameter that names the foiling. We wrap it; we never rebuild it.
 */
export function buyHref(
  printing: Purchasable,
  placement: Placement,
  affiliateId: string | null = AFFILIATE_ID,
): string | undefined {
  const destination = printing.tcgplayer_url;
  if (destination === undefined || destination === "") return undefined;
  if (affiliateId === null) return destination;

  /*
   * THE DESTINATION IS ENCODED WHOLE, as one opaque `u` parameter. It carries
   * its own query string — `?Language=English&Printing=Rainbow+Foil` — so
   * anything less than full encoding lets its `&` terminate our parameter and
   * silently drops the foiling from the link.
   */
  const target = encodeURIComponent(destination);
  return `${PARTNER_ORIGIN}/${affiliateId}/${CAMPAIGN_PATH}?u=${target}&subId1=${placement}`;
}

/**
 * The `rel` for a purchase link.
 *
 * `sponsored` is the attribute that actually describes a paid link, and it is
 * the one Scryfall's own partner anchors omit. It appears only once we are
 * actually paid, because claiming a commercial relationship we do not have is
 * as wrong as concealing one we do.
 */
export function buyRel(affiliateId: string | null = AFFILIATE_ID): string {
  return isAffiliate(affiliateId)
    ? "sponsored nofollow noreferrer"
    : "nofollow noreferrer";
}

/**
 * The sentence printed under the printings table.
 *
 * Written out in both states rather than assembled from fragments, because this
 * is the text a regulator or LSS would read and a sentence built by
 * concatenation is a sentence nobody has actually proofread. TCGplayer's Partner
 * Guidelines require disclosure that is "clear, conspicuous, prominent and
 * unambiguous to the average member of your audience" and put FTC compliance on
 * the partner, so this sits with the links rather than in the site footer.
 */
export function buyDisclosure(
  affiliateId: string | null = AFFILIATE_ID,
): string {
  return isAffiliate(affiliateId)
    ? "Buy links go to TCGplayer, a third-party marketplace, and Optfall earns a commission on purchases made through them. The product each link addresses is recorded in the community dataset this corpus is built from, not supplied by TCGplayer. No price is shown and no endorsement is implied."
    : "Buy links go to TCGplayer, a third-party marketplace. Optfall earns nothing from them. The product each link addresses is recorded in the community dataset this corpus is built from, not supplied by TCGplayer. No price is shown and no endorsement is implied.";
}
