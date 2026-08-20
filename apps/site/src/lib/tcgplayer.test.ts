import { describe, expect, test } from "bun:test";
import {
  AFFILIATE_ID,
  buyDisclosure,
  buyHref,
  buyRel,
  isAffiliate,
} from "./tcgplayer";

/*
 * THE POINT OF THIS FILE IS THE FLIP, not the string formatting. Every
 * behaviour below is asserted in both states, so the day somebody sets
 * AFFILIATE_ID there is already proof that links, `rel` and the disclosure all
 * move together. That day was 2026-08-18; the block at the bottom asserts the
 * live state, and asserted the pending one before it.
 *
 * BOTH-STATES COVERAGE OUTLIVES THE FLIP, so none of it is deleted. `null` is
 * still a reachable value of the constant — it is how the site would be put
 * back to earning nothing if the partnership ever ended — and a disclosure that
 * only works in one direction is the failure this module exists to prevent.
 */

/** A real row from the corpus — MST131, Standard foiling. */
const STANDARD = {
  tcgplayer_url:
    "https://www.tcgplayer.com/product/551703?Language=English&Printing=Normal",
};

/** The same collector number, Rainbow Foil. A different product entirely. */
const RAINBOW = {
  tcgplayer_url:
    "https://www.tcgplayer.com/product/551703?Language=English&Printing=Rainbow+Foil",
};

/** One of the 1,336 printings upstream lists no product for. */
const PROMO = {};

/**
 * A partner id that is deliberately **not** ours — Scryfall's, published.
 *
 * Kept different from `AFFILIATE_ID` on purpose. The explicit-argument tests
 * below prove the wrapping; the default-argument tests at the bottom prove the
 * shipped constant is actually wired to it. If this fixture were our own id the
 * second group could pass on a coincidence.
 */
const ID = "4931599";

describe("buyHref", () => {
  test("returns undefined when upstream published no product", () => {
    expect(buyHref(PROMO, "card-printings", null)).toBeUndefined();
    expect(buyHref(PROMO, "card-printings", ID)).toBeUndefined();
  });

  test("treats an empty url as no product rather than as a link", () => {
    expect(
      buyHref({ tcgplayer_url: "" }, "card-printings", ID),
    ).toBeUndefined();
  });

  test("without an affiliate id, links straight to the storefront", () => {
    expect(buyHref(STANDARD, "card-printings", null)).toBe(
      STANDARD.tcgplayer_url,
    );
  });

  test("with an affiliate id, wraps the storefront url", () => {
    const href = buyHref(STANDARD, "card-printings", ID);
    expect(href).toStartWith(
      `https://partner.tcgplayer.com/c/${ID}/1830156/21018?u=`,
    );
    expect(href).toEndWith("&subId1=card-printings");
  });

  test("encodes the destination whole, so its own query survives", () => {
    const href = buyHref(RAINBOW, "card-printings", ID) ?? "";

    /*
     * THE REGRESSION THIS EXISTS FOR. The destination carries `&Printing=`, so
     * a half-encoded url would let that `&` terminate our `u` parameter —
     * TCGplayer would receive the product with no foiling and quietly send the
     * reader to the wrong one of two products sharing a collector number.
     */
    const u = new URL(href).searchParams.get("u");
    expect(u).toBe(RAINBOW.tcgplayer_url);
    expect(new URL(u ?? "").searchParams.get("Printing")).toBe("Rainbow Foil");
  });

  test("distinguishes two foilings of one collector number", () => {
    expect(buyHref(STANDARD, "card-printings", ID)).not.toBe(
      buyHref(RAINBOW, "card-printings", ID),
    );
  });
});

describe("buyRel", () => {
  test("claims sponsorship only when there is a commission to declare", () => {
    expect(buyRel(null)).toBe("nofollow noreferrer");
    expect(buyRel(ID)).toBe("sponsored nofollow noreferrer");
  });
});

describe("buyDisclosure", () => {
  test("says we earn nothing while unpaid, and says so plainly", () => {
    expect(buyDisclosure(null)).toContain("Optfall earns nothing");
    expect(buyDisclosure(null)).not.toContain("commission");
  });

  test("declares the commission once there is one", () => {
    expect(buyDisclosure(ID)).toContain("earns a commission");
  });

  /*
   * THIS USED TO ASSERT TWO SENTENCES THAT NO LONGER EXIST. It required the
   * disclosure to SAY "No price is shown and no endorsement is implied", which
   * is a promise about the site made in the site's own fine print — the weakest
   * form the claim can take. Both sentences went when the disclosure was cut to
   * what TCGplayer and the FTC require of it (see `buyDisclosure`), and the
   * assertion is now the stronger version of the same intent: there is no price
   * in this sentence, rather than a sentence saying there is no price.
   */
  test("quotes no price and names the marketplace, in either state", () => {
    for (const text of [buyDisclosure(null), buyDisclosure(ID)]) {
      expect(text).toContain("TCGplayer");
      expect(text).not.toMatch(/\$|\d/);
    }
  });

  /*
   * THE ONE LAYOUT RULE THAT CAN BE TESTED FROM HERE, and it is here rather
   * than in a stylesheet because nothing in this repository renders CSS. The
   * sentence sits in the same row as the buy button, to its right, and must
   * never be taller than it — `CardEntry.css` caps the type step at the size
   * two lines fit the button's height at, and the only thing that can then
   * break the rule is a sentence long enough to need a third line.
   *
   * THE BUDGET, MEASURED on the built site at `/card/mst/131/
   * 10-000-year-reunion` in a fixed-width iframe. The paragraph sits beside the
   * button only while its flex basis fits, which leaves it 485px at the
   * narrowest and 528px at 1440 — so two lines hold about 970px of text. This
   * sentence renders 653px wide at `type.size.micro`, 5.8px per character, so
   * 130 characters is roughly 760px: comfortably over the 112 it is, and
   * comfortably under the point where a third line becomes possible. It is a
   * budget for rewording, not a target.
   */
  test("stays inside the two lines the button's height allows", () => {
    for (const text of [buyDisclosure(null), buyDisclosure(ID)]) {
      expect(text.length).toBeLessThanOrEqual(130);
    }
  });
});

describe("the live partnership", () => {
  /*
   * THIS BLOCK REPLACED A DELETE-ME MARKER, and it is the reason that marker
   * existed. It previously asserted `AFFILIATE_ID === null`, so setting the
   * constant on 2026-08-18 broke the suite and forced a read of this file
   * instead of letting a stale "we earn nothing" claim survive the change.
   *
   * It now asserts the mirror image. The suite fails just as loudly if the id
   * is ever unset or edited without the disclosure being reconsidered, which is
   * the same guarantee pointing the other way.
   */
  test("the shipped affiliate id is the one Impact issued us", () => {
    expect(AFFILIATE_ID).toBe("7630689");
    expect(isAffiliate()).toBe(true);
  });

  test("live links are wrapped, sponsored, and disclosed as paid", () => {
    const href = buyHref(STANDARD, "card-printings");
    expect(href).toStartWith(
      "https://partner.tcgplayer.com/c/7630689/1830156/21018?u=",
    );
    expect(new URL(href ?? "").searchParams.get("u")).toBe(
      STANDARD.tcgplayer_url,
    );
    expect(buyRel()).toBe("sponsored nofollow noreferrer");
    expect(buyDisclosure()).toContain("earns a commission");
    expect(buyDisclosure()).not.toContain("Optfall earns nothing");
  });

  test("a printing with no product stays absent rather than becoming a link", () => {
    expect(buyHref(PROMO, "card-printings")).toBeUndefined();
  });
});
