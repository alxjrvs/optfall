/**
 * Faces seen together, sharing one copyright notice. The React port.
 *
 * THE GUARANTEE SURVIVES BECAUSE THE MECHANISM IS THE SAME SHAPE. In Svelte
 * this is `setContext`/`getContext` behind a module-private symbol; here it is
 * a React context whose Provider is not exported. Both give the same property,
 * and it is the only one that matters: **a caller cannot forge "the notice is
 * already carried" from markup.** The single thing that sets it is this
 * component, which emits the notice itself.
 *
 * `docs/COMPLIANCE.md` §5 forbids the line being "a prop the caller may omit,
 * a default that can be overridden to empty, or the page's responsibility". A
 * prop-drilled `carriedByGroup` would be exactly the first of those, and it is
 * why the port does not take the obvious shortcut of passing a boolean down.
 *
 * WHAT MAY SHARE A NOTICE is unchanged and is decided by whether the notice
 * ACCOMPANIES the faces — the condition itself rather than a proxy for it. The
 * test is whether a reader can see the line at the same time as the images it
 * covers. A card page's hero face and its printings rail pass; so does the
 * front door's row, six cards in one band with the notice directly beneath.
 *
 * A SEARCH GRID DOES NOT, and that is the case the rule exists for: sixty
 * results scroll, so one line at the bottom does not accompany the face at the
 * top, and those keep a notice each.
 *
 * The narrower rule remains the safe default when in doubt: if you cannot say
 * for certain that every face in the group is visible with the notice, do not
 * group them.
 */

import { createContext, useContext, type ReactNode } from "react";

import { CARD_IMAGE_COPYRIGHT } from "../index";
import "./CardFaceGroup.css";

/**
 * NOT EXPORTED, AND THAT IS THE ENFORCEMENT. Exporting the context would let
 * any caller wrap a face in a Provider set to `true` and suppress the notice
 * with no notice rendered anywhere — the precise failure §5 describes. Only
 * `CardFaceGroup` below can set it, and it always renders the line.
 */
const CarriedByGroup = createContext(false);

/** True when a `CardFace` is rendering inside a group that carries the notice. */
export function useInsideCardFaceGroup(): boolean {
  return useContext(CarriedByGroup);
}

export interface CardFaceGroupProps {
  /** The faces. Any `CardFace` in here suppresses its own notice. */
  readonly children: ReactNode;
}

export function CardFaceGroup({ children }: CardFaceGroupProps) {
  return (
    <CarriedByGroup.Provider value={true}>
      <div className="of-card-face-group">
        {children}
        {/*
          Emitted by the library, exactly as it is on a lone face. Not a prop,
          not optional, not the page's job.
        */}
        <p className="of-card-face-group__copyright">{CARD_IMAGE_COPYRIGHT}</p>
      </div>
    </CarriedByGroup.Provider>
  );
}
