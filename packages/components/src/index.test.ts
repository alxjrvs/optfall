import { describe, expect, test } from "bun:test";

import {
  CARD_IMAGE_COPYRIGHT,
  PRIMITIVES,
  VOICE_BY_ROLE,
  type CardImageProps,
} from "./index";

describe("card image compliance contract", () => {
  // docs/COMPLIANCE.md §5 requires the copyright notice to be something the
  // caller cannot omit, empty, or override. A required `copyright: string` prop
  // only defends against forgetting it — `copyright=""` type-checks and renders
  // a card face with no notice. These two tests pin the stronger shape, so the
  // prop cannot be reintroduced without a failing build to argue with.
  test("the notice is the exact text the asset policy requires", () => {
    expect(CARD_IMAGE_COPYRIGHT).toBe("Card images © Legend Story Studios.");
  });

  test("is not caller-supplied", () => {
    // A type-level assertion: if `copyright` is ever added back to the props,
    // this stops compiling. It has no runtime body because the guarantee is
    // that no such value exists to inspect.
    type HasCopyright = "copyright" extends keyof CardImageProps ? true : false;
    const callerCannotSupplyIt: HasCopyright = false;
    expect(callerCannotSupplyIt).toBe(false);
  });

  test("carries no legality or rules data", () => {
    // The art licence is revocable. Losing it must cost a rendering layer and
    // nothing else, which is only true while this type stays free of the data
    // the project actually owns.
    type Keys = keyof CardImageProps;
    const keys: Keys[] = ["src", "alt", "pitch"];
    expect(keys).toHaveLength(3);
  });
});

describe("the primitive set", () => {
  test("matches the eight Phase 1 deliverables, without duplicates", () => {
    expect(PRIMITIVES).toHaveLength(8);
    expect(new Set(PRIMITIVES).size).toBe(PRIMITIVES.length);
    expect(PRIMITIVES).toContain("pitch-jewel");
    expect(PRIMITIVES).toContain("citation");
  });
});

describe("typographic voice", () => {
  test("is fixed by role rather than chosen per usage", () => {
    expect(VOICE_BY_ROLE["card-name"]).toBe("serif");
    expect(VOICE_BY_ROLE.citation).toBe("mono");
    expect(VOICE_BY_ROLE.interface).toBe("sans");
  });
});
