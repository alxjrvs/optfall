/**
 * The card's printed text, rendered.
 *
 * ONE VIEW, NOT TWO. This shipped as a pair — "Text" and "Raw text" — behind a
 * radio toggle, on the argument that rendering `{p}` as a power plate is a JOIN
 * and a reference work should let you see the thing a claim was derived from.
 * The join is still a join and that is still worth stating; what did not hold up
 * is the idea that a second copy of the same sentence is how you state it.
 *
 * The raw view existed to be CHECKABLE, and it was the weakest available way to
 * be. It sat behind a control most readers never touched, it duplicated every
 * card's text into the markup of all 11,378 pages, and what it proved — that
 * `{p}` was in the bytes — is not the part anybody doubts. The part worth
 * checking is the MAPPING, `{p}` → power, and that is not in the raw text at
 * all: it is in the Comprehensive Rules at 1.12.4a–h, which the card page cites
 * by rule number next to the symbols themselves. The citation is the audit
 * trail. The duplicate paragraph was a copy of the evidence's less useful half.
 *
 * WHAT IS STILL GUARANTEED, so removing the view does not quietly remove the
 * promise it carried. `parseCardText` does not paraphrase: it splits blocks and
 * swaps markers for the symbols the rules name, and `white-space: pre-line`
 * below keeps the published line breaks, which are the only formatting the
 * printed text carries. `card-symbols.test.ts` reads 1.12.4 out of the corpus
 * and fails if this site's table stops matching it. So the text a reader sees
 * is upstream's, and the one interpretation applied to it is one the rules
 * document underwrites.
 *
 * STILL NO JAVASCRIPT, and now trivially so. The toggle was two radio inputs and
 * a `:has()` selector precisely to avoid turning a 12,278-page static route into
 * an island; with one view there is no state left to hold.
 *
 * NO PLATE OF ITS OWN. This sat in a `BevelledPlate emphasis="raised"`, which
 * drew a bevelled, padded, differently-toned box around the text INSIDE the
 * oracle band — a box within a box, on the one band whose own comment in
 * `CardEntry.tsx` already says "the panel is the box, so the text simply IS the
 * widest band in it". The flavour band below it never had one. The plate is
 * gone and the printed text sets inline in the band like every other run of
 * prose in the panel; the band's rule and spacing are what separate it.
 */

import { parseCardText } from "../../src/lib/card-text";
import { CardTextInline } from "./CardTextInline";
import "./PrintedText.css";

export interface PrintedTextProps {
  /** The printed text, exactly as upstream published it. */
  readonly text: string;
}

export function PrintedText({ text }: PrintedTextProps) {
  const blocks = parseCardText(text);

  return (
    <div className="of-printed">
      {blocks.map((block, index) =>
        block.kind === "paragraph" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parsed once from an immutable string; two paragraphs can be identical.
          <p className="of-printed__text" key={index}>
            <CardTextInline nodes={block.children} />
          </p>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: as above.
          <ul className="of-printed__list" key={index}>
            {block.items.map((item, itemIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: as above.
              <li key={itemIndex}>
                <CardTextInline nodes={item} />
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
