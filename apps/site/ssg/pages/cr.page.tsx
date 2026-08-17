/**
 * `/cr` — searching the Comprehensive Rules, at the root of the corpus it
 * searches. Ported, and the first page with an island on it.
 *
 * IT MOVED OFF `/search`, and the reason is that `/search` now means what it
 * means everywhere else: cards. Optfall is a card search engine with a rules
 * engine attached — `docs/PLAN.md` — and a reader who types `/search` is looking
 * for a card. Scryfall's `/search?q=` is the shape people arrive fluent in, and
 * having it answer the Comprehensive Rules instead was a private joke at a
 * stranger's expense.
 *
 * `/cr` is where the corpus already lives: every section is at `/cr/<id>`, so
 * the index of a thing sits at the root of the thing. That is the same
 * arrangement `/sets` has with `/sets/<code>`.
 *
 * NO `<h1>`, AND THIS PAGE'S REASON IS NO LONGER `/search`'s. It read "Search
 * the rules", and the field's own VISIBLE `<label>` — the one that names the
 * control to a screen reader — says the same words directly beneath it, under a
 * nav that says "Rules" and a document title that says "Search the rules —
 * Optfall". The label is the one worth keeping; the display-sized duplicate was
 * pure fold.
 *
 * That argument used to be shared with `/search` and is not any more: `/search`
 * gave its field to the header, where the label is clipped to a pixel, so it had
 * no visible heading of any kind left and now carries a hidden `<h1>`. This
 * page's label is still on screen, so the premise still holds here. Whether a
 * visible label should count as a heading in the document OUTLINE is a fair
 * question and a separate one; it is not answered by the header-search change,
 * so it is not answered here.
 *
 * THE ISLAND IS RENDERED ON THE SERVER AND HYDRATED IN THE BROWSER, which is
 * what `Island` buys and what a bare mount point would not. Arriving here with
 * scripting off gives a real field, the chapter browse and every `/cr/<id>` link
 * under it — static, but the whole corpus is reachable. What it cannot do is
 * answer `?q=`, and the notice above the field says so rather than letting a
 * submitted query vanish in silence.
 */

import corpusJson from "../../../../data/rules/cr-2.14.0.json";

import { buildIndex, type RulesCorpus } from "../../src/lib/search";
import { Island } from "../Island";
import { RulesSearch } from "../islands/RulesSearch";
import type { PageModule, PageResult } from "../types";
import "./cr.css";

const corpus = corpusJson as unknown as RulesCorpus;
const index = buildIndex(corpus);

const sections = corpus.sections.length.toLocaleString("en-GB");
const published = new Date(
  `${corpus.publishedDateIso}T00:00:00Z`,
).toLocaleDateString("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function page(): PageResult {
  return {
    title: "Search the rules — Optfall",
    description:
      "Lexical search over the Flesh and Blood Comprehensive Rules. Every section has a permanent, citable URL.",
    section: "rules",
    /*
      THE CARD FIELD STAYS IN THE HEADER HERE, BESIDE A RULES FIELD, and the two
      searches are the reason. This page's hero searches the Comprehensive
      Rules; the header searches cards. They are different corpora with
      different grammars, so the usual objection to two fields on one screen —
      two places to type and one of them wrong — does not apply: neither can
      answer the other's question, and both say which they are in their
      `aria-label`. A reader who arrives at the rules and then wants a card
      should not have to go somewhere else to type.
    */
    islands: true,
    children: (
      <>
        {/*
          THIS IS THE PAGE THE NO-JS FAILURE LANDS ON. It is above the island
          because the island renders its own hint, rule and browse, and an
          explanation printed after all of that is an explanation nobody
          reaching for the field will see.
        */}
        <noscript>
          <p className="of-cr__noscript">
            Live results need JavaScript. Every section is addressable without
            it: <code>/cr/8.3.4b</code> is the section cited as{" "}
            <code>cr:8.3.4b</code>, and the chapter list under the field is nine
            links into the same corpus.
          </p>
        </noscript>

        <Island name="RulesSearch" props={{ index }}>
          <RulesSearch index={index} />
        </Island>

        {/*
          Degrade visibly. `docs/PLAN.md`: "Every surface shows when its data was
          last confirmed. A stale Optfall must look stale." The version, the date
          and the source are stated on the surface that serves the text, not
          buried in an about page — and the source is a link, so the claim is
          checkable.
        */}
        <p className="of-cr__provenance">
          {corpus.title} <strong>{corpus.version}</strong>, published{" "}
          {published} by Legend Story Studios and parsed to {sections}{" "}
          addressable sections. Read from{" "}
          <a href={corpus.sourceUrl}>the published document</a>.
        </p>
      </>
    ),
  };
}

export const crPage: PageModule = {
  pattern: "/cr",
  page,
};
