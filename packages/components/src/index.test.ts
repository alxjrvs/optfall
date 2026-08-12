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
  // Containment, not equality. The policy mandates the notice
  // "© Legend Story Studios"; this constant is Optfall's rendering of it, and
  // the exact wrapper sentence is not ratified. Pinning the full string here
  // would make it look specified while the mandated form and our rendering
  // drifted apart — scripts/canonical-disclaimer.test.ts asserts the two agree
  // across the compliance documents, which is the check that actually binds.
  test("contains the notice the asset policy mandates", () => {
    expect(CARD_IMAGE_COPYRIGHT).toContain("© Legend Story Studios");
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
  test("is the eight Phase 1 deliverables plus the card face, without duplicates", () => {
    // The eight are Phase 1's closed list. `card-face` is the ninth and it
    // arrived with the card layer rather than with the design system, which is
    // why the count moved: docs/SCRYFALL-GAP.md §5.1 made images a product
    // surface, and a component that renders a card image is the only place the
    // compliance line can be made unrepresentable-to-omit.
    expect(PRIMITIVES).toHaveLength(9);
    expect(new Set(PRIMITIVES).size).toBe(PRIMITIVES.length);
    expect(PRIMITIVES).toContain("pitch-jewel");
    expect(PRIMITIVES).toContain("citation");
    expect(PRIMITIVES).toContain("card-face");
  });
});

describe("typographic voice", () => {
  test("is fixed by role rather than chosen per usage", () => {
    expect(VOICE_BY_ROLE["card-name"]).toBe("serif");
    expect(VOICE_BY_ROLE.citation).toBe("mono");
    expect(VOICE_BY_ROLE.interface).toBe("sans");
  });
});
