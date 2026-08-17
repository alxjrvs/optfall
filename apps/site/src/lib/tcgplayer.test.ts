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
 * move together. The pending state is asserted separately at the bottom, and
 * that block is the one expected to fail when the id lands.
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

  test("never implies a price or an endorsement, in either state", () => {
    for (const text of [buyDisclosure(null), buyDisclosure(ID)]) {
      expect(text).toContain("No price is shown");
      expect(text).toContain("no endorsement is implied");
      expect(text).toContain("TCGplayer");
    }
  });
});

describe("the pending application", () => {
  /*
   * DELETE-ME MARKER. This block asserts the state the site ships in today. It
   * is meant to fail the moment AFFILIATE_ID is set, so that flipping the
   * constant forces a read of this file rather than letting a stale "we earn
   * nothing" claim survive the change.
   */
  test("no affiliate id is configured yet", () => {
    expect(AFFILIATE_ID).toBeNull();
    expect(isAffiliate()).toBe(false);
  });

  test("live links are unwrapped while the application is pending", () => {
    expect(buyHref(STANDARD, "card-printings")).toBe(STANDARD.tcgplayer_url);
    expect(buyRel()).toBe("nofollow noreferrer");
    expect(buyDisclosure()).toContain("Optfall earns nothing");
  });
});
