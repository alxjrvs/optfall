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
  /**
   * How this art is foiled, in words — `"Cold Foil"`, `"Standard · Rainbow
   * Foil"` — or `""` where upstream records no foiling for it.
   *
   * ALREADY DECODED, because `foilingName` reads the sets corpus and this is an
   * island. `printings.ts` records what happens when a module the client entry
   * can reach pulls a corpus in behind it: a 9.28 MB bundle. The build decodes;
   * the island renders a string.
   *
   * PLURAL, BECAUSE A TILE IS AN IMAGE AND FOILING IS A PROPERTY OF A PRINTING.
   * This list is deduped by art, and 4,995 tiles are shared by printings at two
   * different foilings — `MST131` is one image published Standard AND Rainbow
   * Foil. Naming only the first would caption a picture with one of the two
   * things it is, which is the trap the rarity field one line up had to accept
   * (a caption can show one rarity at a time) and this one does not: every
   * foiling that reaches this art is named, so the tile says what the picture
   * IS rather than which row happened to claim it.
   */
  readonly foiling: string;
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
    /*
      STAMPED UNCONDITIONALLY, INCLUDING WITH AN EMPTY VALUE.

      This used to bail out when the newly selected printing had no rarity,
      which left the PREVIOUS printing's slug on the root — so the credit line
      went on asserting the old printing's rarity under the new picture, which
      is the exact failure the whole arrangement exists to end. An empty stamp
      is the honest state instead: a bare `[data-printing-rarity]` still matches,
      so it retires the server's `--initial` and reveals nothing, which is what
      "upstream published no rarity for this printing" should look like.

      THE FALLBACK MIRRORS `current` ABOVE. That line resolves an out-of-range
      index to `printings[0]` for the picture; resolving it differently here
      would put a rarity on screen for a printing the reader is not looking at.

      `setAttribute` rather than `dataset.printingRarity`, so the string here is
      the string in the stylesheet. `dataset` would spell it `printingRarity`
      and rely on the reader knowing the camelCase-to-kebab rule to connect the
      two — a rename in either place would then miss the other silently.
    */
    document.documentElement.setAttribute(
      "data-printing-rarity",
      printings[selected]?.rarity ?? printings[0]?.rarity ?? "",
    );
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
                  {/*
                    THE FOILING, WHICH IS WHAT MAKES THE TILE DISTINGUISHABLE AT
                    ALL ON 640 CARDS.

                    Set and number named a printing almost everywhere and named
                    NOTHING here: `Aether Ashwing` showed three tiles all reading
                    "Uprising · UPR042" — the standard art, the cold foil, and a
                    second cold foil — and `Adaptive Plating` showed two reading
                    "Evolution · EVO013" with no standard art among them.
                    Measured: 1,410 tiles across 640 cards carried a caption
                    identical to a sibling's. The reader could see the pictures
                    differ and could select either, which is the control working;
                    they could not learn WHICH THING they had selected, which is
                    the control failing at the one question it exists to answer.

                    The edition disambiguation above solves the neighbouring case
                    and could not solve this one — these printings share an
                    edition and differ only in how they are foiled — so the fact
                    that separates them is the fact that goes on the tile. It
                    takes those 1,410 down to 359.

                    WHAT IS LEFT, NAMED RATHER THAN ROUNDED AWAY. 336 of the 359
                    are the Arakni shape `CardEntry` already documents: upstream
                    publishes a front and a back under one number, both Marvel
                    cold foil, so the two tiles agree on set, number, edition,
                    foiling and rarity and differ only by which face they are.
                    That is a different axis, and the printings table's `Other
                    face` column is where it is answered. The remaining 23 are
                    cards with TWO cold-foil arts under one number — a `-CF` and
                    a `-MV` — which upstream distinguishes by `art_variations`
                    codes (`AA`, `AB`, `EA`, …) that it publishes no decode table
                    for. Inventing display names for them would be this project
                    asserting a vocabulary its source does not define.

                    ROOM IS TAKEN, NOT MADE. Foiling is missing on 5 printing
                    rows in the corpus and the line is dropped entirely for them
                    rather than rendering a dash, because a strip of tiles all
                    one row taller to hold one em-dash is a layout paying for an
                    absence.
                  */}
                  {printing.foiling === "" ? null : (
                    <span className="of-picker__foiling">
                      {printing.foiling}
                    </span>
                  )}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}
    </div>
  );
}
