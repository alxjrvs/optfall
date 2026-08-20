/**
 * How a card's versions are grouped, and how a group addresses itself.
 *
 * WHY THIS IS NOT IN `CardEntry.tsx`, WHERE IT WAS WRITTEN. It is domain logic:
 * it indexes the corpus, decides what counts as one name, and works out which
 * URL a group of printings should point at. None of that is presentation, and
 * an agent asked "how are card versions grouped?" has no reason to look inside
 * a JSX file for the answer. `CardEntry` was 1,907 lines and this was the part
 * of it that was not about markup at all.
 *
 * It is also the machinery the related-cards and printings work keeps
 * reshaping, so it is the code most likely to be edited next.
 *
 * IT MAY IMPORT `./cards` BY VALUE. Its only consumer is `CardEntry`, which is
 * rendered at build time by `pages/card.page.tsx` and reached from no island —
 * so the rule in `printings.ts` about islands never reaching the 18 MB corpus
 * does not bind here. Do not import this module from an island.
 */

import {
  type CardLink,
  CARD_PAGES,
  type CardPage,
  HREF_BY_NAME_SLUG,
  facesOf,
  hrefForPrinting,
  variantSuffix,
} from "./cards";

/**
 * No-pitch sorts last, otherwise ascending.
 *
 * THE SENTINEL IS ABOVE EVERY PITCH VALUE, NOT EQUAL TO THE HIGHEST ONE. It was
 * `4`, which was one more than the largest pitch that existed — and a fourth
 * pitch value has since been previewed, at which point "last" and "pitch 4" are
 * the same rank and a group holding both would order them by whichever the sort
 * happened to see first. No card in `data/cards` carries `pitch: "4"` yet, so
 * this is a repair made before the fault rather than after it. `NO_PITCH_RANK` is
 * deliberately far clear of the scale so the next value upstream invents cannot
 * repeat it either.
 */
const NO_PITCH_RANK = 10;

export function pitchRank(pitch: number): number {
  return pitch === 0 ? NO_PITCH_RANK : pitch;
}

/**
 * How many versions each name has, and the address of the name itself.
 *
 * BUILT ONCE FOR ALL 12,278 CARD PAGES, at module scope beside the keyword
 * vocabulary, because it is a fact about the corpus rather than about a page.
 *
 * IT EXISTS TO ANSWER "IS THIS GROUP THE WHOLE CARD", which is what decides
 * where a row's NAME points, and how it is NAMED — see `groupTarget`. A related
 * list can be a subset: upstream's `referenced_cards` names card ids, not
 * names, so a card whose text names Head Jab may pull two of its three
 * versions. Sending that name to the shared page would offer a version the list
 * is not showing; sending a WHOLE group to one of its members would pick a
 * favourite.
 *
 * `nameSlug` is safe to key by name: measured, zero names in the corpus have
 * cards that disagree about it, and all 3,158 name-level routes exist.
 */
const VERSIONS_BY_NAME = ((): ReadonlyMap<
  string,
  { readonly count: number; readonly nameSlug: string }
> => {
  const found = new Map<string, { count: number; nameSlug: string }>();
  for (const page of CARD_PAGES) {
    const seen = found.get(page.card.name);
    if (seen === undefined)
      found.set(page.card.name, { count: 1, nameSlug: page.nameSlug });
    else seen.count += 1;
  }
  return found;
})();

/**
 * Every card page by its own address, for reaching a SIBLING's printings.
 *
 * A `CardLink` carries a name, a label, a pitch and one href — deliberately, so
 * that the four lists built out of them stay cheap across 4,941 cards. That is
 * enough to LINK to a version and not enough to ask where else it was printed,
 * which is exactly what the version tabs need (see {@link addressInSet}). The
 * link's href IS the sibling's default address, and `CardPage.href` is built by
 * the same function from the same face, so it is a key rather than a guess.
 *
 * Module scope, like the keyword vocabulary above it: a fact about the corpus,
 * built once, not once per each of 11,378 pages.
 */
const PAGE_BY_HREF: ReadonlyMap<string, CardPage> = new Map(
  CARD_PAGES.map((entry) => [entry.href, entry] as const),
);

/**
 * Where a version of this card lives IN A NAMED SET, or `undefined` if that set
 * never printed it.
 *
 * A READER ON A PRINTING PAGE HAS ALREADY CHOSEN A SET. Landing them on Welcome
 * to Rathe's Head Jab and then sending "Pitch 2" to whichever set upstream
 * happens to list first for the pitch 2 version throws that choice away — the
 * two tabs are the same card in the same box, and the strip is the one control
 * on the page whose whole job is to move between them without changing anything
 * else.
 *
 * THE FIRST FACE IN THE SET, WHICH IS THAT SET'S DEFAULT. `facesOf` is corpus
 * order, and `defaultAddressOf` picks its first entry for the card's own
 * address; picking the first entry within a set is the same rule scoped to one
 * box, so a set that published two arts of a version opens on the same one its
 * set page links to.
 *
 * `undefined` RATHER THAN A FALLBACK, because the caller has a better one: the
 * link's own default address. Measured on this corpus: 5,799 printing pages
 * carry a version strip, 11,565 tabs between them, and 2,127 of those tabs name
 * a version the set on screen never printed — a pitch added in a later set, a
 * promo carrying one version of a name. A tab that goes nowhere is worse than a
 * tab that goes somewhere else.
 */
export function addressInSet(
  link: CardLink,
  setCode: string,
): string | undefined {
  const sibling = PAGE_BY_HREF.get(link.href);
  if (sibling === undefined) return undefined;
  const face = facesOf(sibling.card).find((ref) => ref.setCode === setCode);
  return face === undefined
    ? undefined
    : hrefForPrinting(face.setCode, face.number, sibling.slug);
}

/** One related-card row: a name, and every version of it this list carries. */
export interface LinkGroup {
  readonly name: string;
  readonly links: readonly CardLink[];
}

/**
 * A list of card links, collapsed to one entry per NAME.
 *
 * IN FIRST-APPEARANCE ORDER, NOT ALPHABETICAL. These lists arrive in corpus
 * order and the page has never re-sorted them; grouping is not the moment to
 * start, because a reader comparing this page to the one they came from would
 * find the same relatives in a different sequence for no stated reason. The
 * `Map` preserves insertion order, so a group sits where its first member sat.
 *
 * THE VERSIONS INSIDE A GROUP *ARE* SORTED, and by pitch rather than by
 * arrival, because they render as a row of stones. `1 2 3` is the order a
 * reader expects of three numbered things placed side by side, and corpus order
 * would produce a different arrangement per card for no reason a reader could
 * see. `pitchRank` puts a card with no pitch last, matching the version tabs.
 */
export function groupByName(links: readonly CardLink[]): readonly LinkGroup[] {
  const byName = new Map<string, CardLink[]>();
  for (const link of links) {
    const found = byName.get(link.name) ?? [];
    found.push(link);
    byName.set(link.name, found);
  }
  return [...byName].map(([name, found]) => ({
    name,
    links: found.toSorted((a, b) => pitchRank(a.pitch) - pitchRank(b.pitch)),
  }));
}

/**
 * The hidden suffix for a row standing for SOME of a name's versions.
 *
 * ONE VERSION IS `variantSuffix`, UNCHANGED, so the ordinary row is named by
 * the same function every other surface names a card with, and a name belonging
 * to one card still gets `""`.
 *
 * SEVERAL ARE SPELLED OUT — " (pitch 2 and 3)" — rather than named after the
 * one the href opens. The row covers two cards; calling it "(pitch 2)" would be
 * true of the destination and false of the row, and it would announce the same
 * string as the first stone sitting beside it. `PitchRule` spells its own
 * values the same way for the same reason; it cannot be borrowed from because
 * that one is a primitive's `aria-label` and this is a suffix on a name.
 *
 * `variantSuffix` STILL DECIDES WHETHER THERE IS ONE AT ALL: a group of two is
 * two cards sharing a name, so both are disambiguated by construction.
 */
function versionsSuffix(links: readonly CardLink[]): string {
  const first = links[0];
  if (first === undefined) return "";
  if (links.length === 1)
    return variantSuffix(first.pitch, first.disambiguated);

  const spoken = links.map((link) =>
    link.pitch === 0 ? "no pitch" : String(link.pitch),
  );
  const last = spoken[spoken.length - 1];
  return ` (pitch ${spoken.slice(0, -1).join(", ")} and ${last})`;
}

/**
 * Where a row's NAME points, and what it is CALLED — one function, because they
 * are one decision and splitting them is what shipped a bug.
 *
 * WHERE IT POINTS is the rule `CardIndex` already publishes. `PitchStones`
 * there: "a stone is a link only where there is something to choose between" —
 * the name is the destination, and the marks become controls only when a row
 * stands for more than one card. An earlier version of this list dropped the
 * name's link entirely on a multi-version row and left the stones as the only
 * way in, which made the two surfaces disagree about what a name IS. It is the
 * address for "this card, whichever version you meant", on both.
 *
 * THE WHOLE-GROUP CASE GOES TO THE NAME; A PARTIAL ONE GOES TO A MEMBER. This
 * is `set.page.tsx`'s `collapsed && whole` test, arrived at for the same
 * reason: a set that printed two of three versions lands its name "on one it
 * did print", because the shared page would offer a third the surface is not
 * showing. The partial case is now the RARE one here: it was guaranteed while
 * "Other versions" was a list, because `variants` excludes the card being read
 * by definition, and that list is gone. What is left is partial only when
 * upstream's `referenced_cards` names some versions of a name and not others —
 * measured on the shipped build, 55 rows of 20,372. Rare, not gone, and the
 * branch is what keeps those 55 from offering a version the list is not
 * showing.
 *
 * WHAT IT IS CALLED HAD NO RULE AT ALL, AND THAT WAS THE BUG. A row prints the
 * BARE NAME — the whole point of collapsing versions into a stone. But a bare
 * name is not always a name: 900 in this corpus belong to more than one card,
 * and two anchors that differ only in where they point are a WCAG 2.4.4
 * failure. It was measured at 3,583 card pages carrying such a pair, back when
 * a page listed Other versions and References side by side and
 * `/card/count-your-blessings-1` read "Count Your Blessings" twice — once to
 * `/card/count-your-blessings-2`, once to `/card/count-your-blessings`.
 *
 * DO NOT READ THE RETIRED LIST AS HAVING RETIRED THE HAZARD. It is this rule,
 * not the shorter page, that holds the invariant: measured on the current
 * build, zero pages carry two related anchors with the same accessible name
 * and different destinations — with the qualifier still doing the work on 55
 * rows. Delete the qualifier and pages regress.
 *
 * SO THE ANCHOR IS NAMED FOR WHAT IT STANDS FOR, which is `CardIndexEntry`'s
 * rule — "the full text the anchor must be NAMED by, qualifier and all" — and
 * three cases fall out of it:
 *
 * - A row that IS the whole name goes to the shared page and is named by the
 *   shared name. Nothing to qualify. It reads alike to the breadcrumb and goes
 *   where the breadcrumb goes, which 2.4.4 permits and a reader expects.
 * - A row standing for ONE version is named for that version, "(pitch 2)".
 * - A row standing for SOME of them is named for all of those — "(pitch 2 and
 *   3)". Naming it after the version its href happens to open would be a
 *   third true-but-partial statement: it would announce the same string as the
 *   first stone beside it, for a row that covers two cards. See
 *   {@link versionsSuffix}.
 *
 * IT IS HIDDEN, NOT PRINTED. `CardIndex` does exactly this with
 * `of-index__variant`: the suffix stays inside the anchor and out of sight, so
 * the list still reads as bare names and the links are still told apart by
 * anything reading them aloud. The stones were already right — `PitchJewel`'s
 * `label` names each of them — and this is the same fix applied to the one
 * anchor on the row that was left carrying a bare name.
 */
export function groupTarget(group: LinkGroup): {
  readonly href: string;
  readonly qualifier: string;
} {
  const first = group.links[0];
  if (first === undefined) return { href: "", qualifier: "" };

  const known = VERSIONS_BY_NAME.get(group.name);
  const whole =
    group.links.length > 1 &&
    known !== undefined &&
    known.count === group.links.length;

  /* THE NAME'S DEFAULT VERSION, RESOLVED HERE. `/card/<nameSlug>` is a 301
     now; the map holds the address it points at, so the anchor goes straight
     there. Falls back to the first link, which is the lowest-pitch version of
     this group and therefore the same card the map would have named. */
  return whole
    ? {
        href: HREF_BY_NAME_SLUG.get(known.nameSlug) ?? first.href,
        qualifier: "",
      }
    : { href: first.href, qualifier: versionsSuffix(group.links) };
}
