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
 * NO `<h1>`, for the reason `/search` has none: it read "Search the rules" and
 * the field's own visible `<label>` — the one that names the control to a screen
 * reader — says the same words directly beneath it, under a nav that says
 * "Rules" and a document title that says "Search the rules — Optfall". The label
 * is the one worth keeping; the display-sized duplicate was pure fold.
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
    headerSearch: false,
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
