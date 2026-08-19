/**
 * Where a printing can be bought, and whether we are paid for saying so.
 *
 * ONE CONSTANT DECIDES BOTH, and that is the whole point of this module.
 * {@link AFFILIATE_ID} was `null` until TCGplayer's partner programme approved
 * the application; setting it turned every link on the site into an affiliate
 * link **and** switched the disclosure from "we link there" to "we are paid for
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
 * Our Impact partner identifier.
 *
 * Set 2026-08-18, read off Impact's own contract notification — *"your account,
 * Alex Jarvis (7630689)"* — after TCGplayer accepted the partner application
 * filed on 2026-08-17. It is not a secret: it is the fourth path segment of
 * every outbound purchase link the site renders, so it belongs in the source
 * beside the reasoning rather than in an environment variable nobody can audit.
 *
 * ONE THING NO TEST CAN COVER, because it is a fact about TCGplayer's servers
 * rather than about this code: whether a built link actually resolves and
 * actually credits us. The tests build their expected URL from the same
 * constants the module ships, so a wrong {@link CAMPAIGN_PATH} would satisfy
 * every assertion here and still send readers to a dead partner link, or to a
 * live one crediting nobody.
 *
 * **Checked end to end on 2026-08-18**, by requesting a built link and reading
 * the redirect: it returns `301` to the right product with `Printing=Normal`
 * intact, and the destination carries `irpid=7630689` — this account — plus a
 * generated `irclickid`. So the path resolves and the click is attributed. What
 * that request cannot show is the click surfacing in Impact's own reporting,
 * which is the one remaining thing a human confirms in the dashboard.
 */
export const AFFILIATE_ID: string | null = "7630689";

/**
 * TCGplayer's campaign path, which is theirs rather than ours.
 *
 * HALF CONFIRMED, HALF STILL INFERRED — and the halves are worth keeping apart.
 *
 * The campaign segment, `21018`, is **confirmed.** Every Impact notification
 * about this partnership is headed `TCGplayer (4710985) TCGplayer (21018)`,
 * naming TCGplayer's advertiser id and the campaign we sit under. That is the
 * programme stating the number, not us reading it off somebody else's anchor.
 *
 * The media segment, `1830156`, was **inferred from two published examples and
 * then measured.** Scryfall (account `4931599`) and FaBrary (account `4925001`)
 * both publish links on this exact path with only the account segment
 * differing, which was good evidence that it is a constant of the programme
 * rather than a per-partner value. On 2026-08-18 a built link was requested and
 * the redirect read: `301` to the correct product, `irpid=7630689` on the
 * destination. The inference was right, and it is no longer only an inference.
 *
 * Impact still issues each partner a link, and ours remains the authority if we
 * are ever handed one that disagrees — but "disagrees with a working path" is
 * now the surprising case rather than the expected one.
 */
const CAMPAIGN_PATH = "1830156/21018";

const PARTNER_ORIGIN = "https://partner.tcgplayer.com/c";

/**
 * Where on the site a link sits, reported back to us in Impact's own numbers.
 *
 * A closed set rather than a free string, because the value's only job is to be
 * grouped by later, and a typo produces a silently separate row that looks like
 * a placement nobody built.
 *
 * `"card-printings"` NAMES A TABLE COLUMN THAT NO LONGER EXISTS, and it is kept
 * anyway. The links moved into a Buy section of their own and one now sits under
 * the card face, so the value is no longer descriptive — but it is a REPORTING
 * KEY, and Impact groups by the string it was sent. Renaming it would split one
 * placement into two rows at the rename date and silently end the series
 * somebody would be comparing against. It means "the card page's buy links",
 * which is what it has always been counting.
 *
 * Splitting the face button onto its own value is a real option and deliberately
 * not taken here: it is worth doing only if somebody intends to compare the two
 * placements, and inventing a second key nobody reads is how the closed set
 * above stops being closed.
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
 * The sentence printed under the block of buy links.
 *
 * It said "under the printings table", which was true while the links were that
 * table's eighth column and stopped being true when they became a section of
 * their own. See `BuySection`.
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
