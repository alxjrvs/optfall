/**
 * One run of parsed card text: emphasis, symbols and the words between them.
 * React port.
 *
 * Recursive, because emphasis nests symbols — Cosmo prints
 * `**Once per Turn Action - {r}: Attack**` with the marker inside the bold run.
 * The recursion terminates on `text` and `symbol` nodes, which have no children.
 *
 * ONE THING THE PORT DELETES. Astro has no recursive-component sugar, so the
 * original imported ITSELF under an alias to recurse. A React component can name
 * itself inside its own body, so the alias is gone and the recursion is the
 * ordinary kind.
 */

import { GameSymbol } from "optfall-components/react";

import { assetForSymbol } from "../../src/lib/card-symbols";
import type { Inline } from "../../src/lib/card-text";

export interface CardTextInlineProps {
  readonly nodes: readonly Inline[];
}

export function CardTextInline({ nodes }: CardTextInlineProps) {
  return (
    <>
      {nodes.map((node, index) => {
        /*
         * KEYED BY INDEX, AND THIS IS THE CASE THAT JUSTIFIES IT. The rule
         * against index keys is about lists that reorder, insert or delete
         * between renders; this list is parsed once from an immutable string and
         * rendered once. Two adjacent text nodes can also be identical — `and`
         * appearing twice in a sentence — so the content is not a key either.
         */
        const key = index;

        /*
         * A BARE STRING, NOT A WRAPPED ONE. Returning `<span>{value}</span>`
         * type-checks and renders the same words, and it is wrong: it puts an
         * element into the DOM that the Astro version did not, on 4,941 pages,
         * inside a block whose `white-space: pre-line` behaviour depends on the
         * text nodes being adjacent. React does not ask for a key on a string in
         * an array, so nothing is lost by returning it directly.
         */
        if (node.kind === "text") return node.value;

        if (node.kind === "symbol") {
          /*
            LSS's own artwork where they publish it, the drawn plate where they
            do not — which is `{x}` alone, and only because 1.12.4 does not list
            it. The intrinsic box travels with the source so a paragraph of
            symbols holds its height before the images land.
          */
          const asset = assetForSymbol(node.symbol);
          return (
            <GameSymbol
              key={key}
              kind={node.symbol.kind}
              letter={node.symbol.letter}
              name={node.symbol.name}
              src={asset?.src}
              width={asset?.width}
              height={asset?.height}
            />
          );
        }

        if (node.kind === "strong") {
          return (
            <strong key={key}>
              <CardTextInline nodes={node.children} />
            </strong>
          );
        }

        return (
          <em key={key}>
            <CardTextInline nodes={node.children} />
          </em>
        );
      })}
    </>
  );
}
