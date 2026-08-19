/**
 * `/data-terms`, ported — the first page rendered by the generator this project
 * owns rather than by Astro.
 *
 * WHY THIS PAGE FIRST. It was chosen for being boring: no islands, no corpus,
 * no dynamic routes, 98 lines. What it does have is the one thing worth proving
 * on the first attempt — it is a COMPLIANCE page, so rendering it exercises
 * `check-disclaimer.ts`'s contract end to end. A harness that emits a page
 * missing the LSS disclaimer is a harness that cannot be used at all, and
 * finding that out on page one costs nothing.
 *
 * The prose was copied verbatim from `src/pages/data-terms.astro`, which was
 * the page that shipped while both renderers ran side by side. That deliberate
 * duplication ended with Phase 6 layer 5, which deleted the Astro sources —
 * this module is now the only thing that renders `/data-terms`.
 */

import type { PageModule, PageResult } from "../types";

const CANONICAL =
  "https://github.com/alxjrvs/optfall/blob/main/docs/DATA-TERMS.md";

function page(): PageResult {
  return {
    title: "Data terms — Optfall",
    description:
      "Terms on the data Optfall publishes: what is openly licensed, and what belongs to Legend Story Studios.",
    children: (
      <>
        <h1>Data terms</h1>

        <p>
          This page summarises the terms on data Optfall publishes. The
          canonical text is{" "}
          <a href={CANONICAL}>
            <code>docs/DATA-TERMS.md</code>
          </a>
          , and where the two differ, that document governs.
        </p>

        <h2>What is openly licensed</h2>

        <p>
          The <strong>structural work this project owns</strong>: rule
          identifiers, the legality timeline, version diffs, and annotations.
          These are ours to license, and they are published openly so that if
          this site disappears the corpus does not.
        </p>

        <h2>What is not ours to license</h2>

        <p>
          <strong>
            Card names, card text and card art remain the property of Legend
            Story Studios
          </strong>{" "}
          and are never relicensed here. Optfall uses them under LSS's published
          policy for third-party applications, which permits card databases and
          rules-enforcement tools on conditions that bind anyone we pass the
          data to as well.
        </p>

        <p>
          So a dataset from Optfall carries two things at once: an open licence
          over the structure, and LSS's conditions over the game content inside
          it. Redistributing one without the other is not something this project
          can authorise.
        </p>
      </>
    ),
  };
}

export const dataTermsPage: PageModule = {
  pattern: "/data-terms",
  page,
};
