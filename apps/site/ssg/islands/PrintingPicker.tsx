/**
 * The alternate printings of one card, as a picker that swaps the face. React
 * port.
 *
 * NAMED BY SET AND NUMBER, because `BEN010` alone answers "which printing" for
 * somebody who already knows the set codes and nobody else. "Bright Lights ·
 * BEN010" answers it for everybody, and the number is kept because it is the
 * citable identity of a printing.
 *
 * WHY THIS IS AN ISLAND WHEN ALMOST NOTHING HERE IS. `docs/SCRYFALL-GAP.md` §5.2
 * rules out live updating for SEARCH — results must not re-rank under a cursor,
 * because the URL is the product. A printing picker is the opposite case: it
 * changes which image is displayed and nothing else. There is no query, no
 * ranking, no result set.
 *
 * THE FACE IS SWAPPED, NOT NAVIGATED, and the address bar is rewritten to the
 * printing's OWN page. Clicking a tile changes an image, so making it a link
 * would be a page load to move one picture — but the URL it writes has to be one
 * that works on its own, which is what the per-printing routes are for. The
 * address is always something the reader can copy and hand to anything at all.
 *
 * ONE SELECTION, AND IT IS A RADIO GROUP, because that is what "pick exactly one
 * of these" is. Arrow keys and a group name come free, the current choice is
 * announced rather than merely outlined, and a reader who cannot see the accent
 * border still knows which printing they are looking at.
 *
 * THE RADIOS ARE CONTROLLED, WHICH IS A PORT DIFFERENCE WITH TEETH. Svelte's
 * `checked={...}` plus `onchange` left the DOM in charge; React's `checked` makes
 * the input controlled and requires `onChange`, which is supplied. The
 * alternative — `defaultChecked` — would let the DOM and `selected` disagree the
 * moment the server-rendered index is not zero, which is exactly the case
 * per-printing URLs introduced.
 */

import { useCallback, useEffect, useId, useState } from "react";

import { CardFace } from "optfall-components/react";

import "./PrintingPicker.css";

export interface Printing {
  /** Blob key, already resolved by the build. */
  readonly key: string;
  /** Collector number — the citable identity. Carries the edition too where set
   *  and number alone do not tell two printings apart. */
  readonly id: string;
  readonly edition: string;
  /** The set's published name, or its code where upstream names none. */
  readonly setName: string;
  readonly setCode: string;
  readonly thumb: string;
  readonly normal: string;
  readonly width: number;
  readonly height: number;
  readonly thumbWidth: number;
  readonly thumbHeight: number;
  /** This printing's own page — `/card/<slug>/<set>/<number>`. */
  readonly href: string;
  /**
   * The rarity slug this printing was published at, or `""` where upstream
   * records none.
   *
   * Carried so the credit line can name the rarity of the printing actually on
   * screen. The picker does not RENDER it — that line lives in the other column
   * — it publishes it; see the effect below.
   */
  readonly rarity: string;
}

export interface PrintingPickerProps {
  readonly printings: readonly Printing[];
  /** The accessible name for the card's picture, composed by the caller. */
  readonly alt: string;
  /** The card's label, for the group's accessible name. */
  readonly label: string;
  /** Which face the server already rendered. */
  readonly selected?: number;
}

const PARAM = "printing";

function keyOf(printing: Printing): string {
  return printing.key.replace(/\.webp$/, "");
}

export function PrintingPicker({
  printings,
  alt,
  label,
  selected: initial = 0,
}: PrintingPickerProps) {
  /**
   * WHERE THE SELECTION COMES FROM, IN PRIORITY ORDER.
   *
   * 1. The PATH, resolved by the server. A per-printing URL is a page, so by the
   *    time this runs the correct face is already in the DOM and the only right
   *    thing to do is agree with it.
   * 2. `?printing=`, for links pasted before those pages existed. The param is
   *    no longer written, but it was, and a reference tool that breaks its own
   *    old links has failed at the one thing it is for.
   *
   * READ IN AN EFFECT, NOT AT INITIALISATION, for the reason `RulesSearch`
   * records: the server has no `window`, so initialising from the URL renders a
   * different tree than the server did and hydration fails. The server already
   * rendered the right face from `selected`, so the correction only ever fires
   * for the legacy query form.
   */
  const [selected, setSelected] = useState(initial);

  const fromUrl = useCallback((): number => {
    if (typeof window === "undefined") return initial;

    const here = window.location.pathname.replace(/\/$/, "");
    const byPath = printings.findIndex(
      (printing) => printing.href.replace(/\/$/, "") === here,
    );
    if (byPath !== -1) return byPath;

    const wanted = new URLSearchParams(window.location.search).get(PARAM);
    if (wanted === null) return initial;
    const index = printings.findIndex((printing) => keyOf(printing) === wanted);
    return index === -1 ? initial : index;
  }, [initial, printings]);

  useEffect(() => {
    const next = fromUrl();
    if (next !== initial) setSelected(next);
  }, [fromUrl, initial]);

  /** Back and forward have to work, which means listening for them. */
  useEffect(() => {
    const onPop = () => setSelected(fromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [fromUrl]);

  const current = printings[selected] ?? printings[0];
  const uid = useId();

  /**
   * PUBLISH WHICH RARITY IS ON SCREEN, for the credit line in the other column.
   *
   * The rarity of a card is a fact about a PRINTING, and this component is the
   * only thing on the page that knows which printing is being displayed once a
   * reader has clicked. The credit line renders every rarity the card has and
   * hides all but one; the slug stamped here is what chooses. `CardEntry.css`
   * holds the rules, and `CardEntry.tsx` explains why the whole list stopped
   * being shown at once.
   *
   * A DATA ATTRIBUTE ON THE ROOT, WHICH IS A DELIBERATE ESCAPE HATCH AND THE
   * SMALLEST ONE AVAILABLE. This island owns the face column and the credit
   * line is in the facts column, so there is no common ancestor either
   * component renders. The alternatives were worse in kind rather than in
   * degree: lifting both into one island would make most of the card page
   * interactive to move a five-letter word, and a custom event would need a
   * listener, which needs a second island to hold it.
   *
   * WRITTEN IN AN EFFECT, NOT DURING RENDER. Touching `document` while
   * rendering is a side effect in the body of a component, and on the server
   * there is no `document` at all — the page is built by `render.tsx` in Bun.
   *
   * NOT CLEANED UP ON UNMOUNT, and that is correct rather than overlooked. The
   * attribute describes what the page is showing; this island unmounts only
   * when the page goes away, and clearing it would hand control back to the
   * server's `--initial` rarity, which is the one printing that may well not be
   * on screen.
   */
  useEffect(() => {
    const rarity = printings[selected]?.rarity;
    if (rarity === undefined || rarity === "") return;
    /* `setAttribute` rather than `dataset.printingRarity`, so the string here is
       the string in the stylesheet. `dataset` would spell it `printingRarity`
       and rely on the reader knowing the camelCase-to-kebab rule to connect the
       two — a rename in either place would then miss the other silently. */
    document.documentElement.setAttribute("data-printing-rarity", rarity);
  }, [printings, selected]);

  /**
   * `replaceState`, not `pushState`.
   *
   * Clicking through six printings should not put six entries in the back
   * button — the reader is looking at one card, not visiting six pages. The
   * address stays correct so it can be copied at any moment, and Back still
   * returns to wherever they came from.
   */
  function remember(index: number): void {
    setSelected(index);
    const printing = printings[index];
    if (printing === undefined || typeof window === "undefined") return;
    window.history.replaceState({}, "", printing.href);
  }

  if (current === undefined) return null;

  return (
    /*
      EVERY FACE HERE GOES THROUGH THE COMPONENT, thumbnails included. An earlier
      version rendered the tiles as bare `<img>` tags, which is the exact path
      docs/COMPLIANCE.md §5 names as a way to break the copyright condition — and
      it left 22 card images on a page under one notice.

      The group carries the notice for all of them, once, because these are
      several pictures of ONE card and the legal fact is the same for each.
    */
    <div className="of-picker">
      <CardFace
        src={current.normal}
        alt={alt}
        width={current.width}
        height={current.height}
        loading="eager"
      />

      {printings.length > 1 ? (
        <fieldset className="of-picker__rail">
          <legend className="of-picker__legend">Printings of {label}</legend>
          <ul className="of-picker__list">
            {printings.map((printing, index) => (
              <li key={printing.key}>
                <label
                  className={
                    index === selected
                      ? "of-picker__tile of-picker__tile--current"
                      : "of-picker__tile"
                  }
                >
                  <input
                    type="radio"
                    name={`${uid}-printing`}
                    checked={index === selected}
                    onChange={() => remember(index)}
                  />
                  <span className="of-picker__face">
                    <CardFace
                      src={printing.thumb}
                      alt=""
                      width={printing.thumbWidth}
                      height={printing.thumbHeight}
                    />
                  </span>
                  <span className="of-picker__set">{printing.setName}</span>
                  <span className="of-picker__id">{printing.id}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
    </div>
  );
}
