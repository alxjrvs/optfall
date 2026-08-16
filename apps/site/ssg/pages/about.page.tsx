/**
 * `/about` — what this is, where the data comes from, and who to blame.
 *
 * THE COLOPHON PROSE IS READ FROM DISK AT BUILD TIME, the same arrangement
 * SU-SRD uses: `LLM_STATEMENT.md` and `ABOUT_JRVS.md` live at the repository
 * root, and this page renders them verbatim. Two reasons rather than one. The
 * files are the canonical wording, so editing prose does not mean editing a
 * component; and `ABOUT_JRVS.md` is deliberately identical to the copy in
 * SU-SRD, because a bio that drifts between two of the same author's sites is
 * worse than one copied between them.
 *
 * `node:fs` IS FREE HERE. This module only ever runs in the build, so a read
 * costs the browser nothing. The path resolves from `import.meta.url` rather
 * than `process.cwd()`, so it does not depend on where the build was invoked
 * from.
 *
 * SCRYFALL IS NAMED IN THE FIRST PERSON, AND IT IS NOT A DISCLAIMER.
 * `docs/SCRYFALL-GAP.md` is an entire document about being a tonal copy of
 * Scryfall, the front door is modelled on theirs shape for shape, and the six
 * cards in the fan are the joke about exactly that. None of it was visible to a
 * reader — the string "Scryfall" appeared nowhere in the built site — so the
 * section exists to say where the ideas came from. It says it the way you would
 * say it out loud, because the author has used the thing for years and the
 * influence is a credit rather than an admission.
 *
 * THE SIX FRONT-DOOR CARDS ARE NOT NAMED HERE. They were, briefly, linked to
 * their own pages — and explaining the joke is what killed it. The fan stands
 * on its own for whoever reads the names; a paragraph pointing at it does not.
 * `home.page.tsx` still owns that list and still fails the build if a name
 * stops resolving.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { OrnamentalRule } from "optfall-components/react";

import { CORPUS as RULES } from "../../src/lib/rules";
import { CARD_PAGES, CORPUS } from "../../src/lib/cards";
import { FACE_HOST } from "../../src/lib/faces";
import { SETS } from "../../src/lib/sets";
import type { PageModule, PageResult } from "../types";
import "./about.css";

/** Repo root, relative to this module — `apps/site/ssg/pages` → four levels up. */
const repoRootFile = (name: string): string =>
  fileURLToPath(new URL(`../../../../${name}`, import.meta.url));

const llmStatement = readFileSync(repoRootFile("LLM_STATEMENT.md"), "utf8");
const aboutJrvs = readFileSync(repoRootFile("ABOUT_JRVS.md"), "utf8");

/**
 * The format contract these two files are written against: an HTML comment
 * header, one `#` heading, then blank-line-separated paragraphs, with
 * `[label](href)` and `**bold**` the only inline markdown that renders.
 *
 * A THREE-RULE RENDERER RATHER THAN A MARKDOWN LIBRARY, and the reason is the
 * same one that governs everything else here: this parses two files this
 * repository writes, to a contract this repository sets. A dependency would
 * bring a spec nobody asked for — bold, lists, raw HTML — and the failure mode
 * of the small version is a literal asterisk on a page, which is visible. It
 * throws rather than guessing when the shape is wrong.
 */
function parseColophon(source: string): {
  readonly heading: string;
  readonly paragraphs: readonly string[];
} {
  const body = source.replace(/^<!--[\s\S]*?-->\s*/, "").trim();
  const blocks = body.split(/\n{2,}/).map((block) => block.trim());

  const [head, ...rest] = blocks;
  if (head === undefined || !head.startsWith("# ")) {
    throw new Error(
      "about.page.tsx: a colophon file must open with a single `# ` heading. See the format contract in LLM_STATEMENT.md.",
    );
  }

  return {
    heading: head.slice(2).trim(),
    /* Newlines inside a paragraph are wrapping, not structure — the files are
       hard-wrapped for review and must render as continuous prose. */
    paragraphs: rest.map((block) => block.replace(/\s*\n\s*/g, " ")),
  };
}

/**
 * `[label](href)` and `**bold**`. Nothing else.
 *
 * THE BOLD RULE IS AN ADDITION TO SU-SRD'S CONTRACT, and it was added because
 * the alternative was worse. That contract permits links only, and says plainly
 * that bold "would ship as literal punctuation" — which is exactly what
 * happened on the first render of this page: the LLM statement's one load-
 * bearing sentence appeared with four asterisks around it. The choice was to
 * strip the emphasis from a sentence that earns it, or to teach the renderer the
 * one construct the prose actually wanted. Five lines, and the failure mode is
 * still a visible asterisk rather than a silent one.
 *
 * Bold is matched BEFORE links so `**[a](b)**` cannot half-match, and neither
 * pattern nests — a contract this small is only safe while it stays flat.
 */
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;

  for (const match of text.matchAll(pattern)) {
    const at = match.index;
    if (at > last) out.push(text.slice(last, at));

    const [, bold, label, href] = match;
    if (bold !== undefined) {
      out.push(<strong key={`b${at}`}>{bold}</strong>);
    } else if (href !== undefined) {
      out.push(
        <a key={`a${at}`} href={href}>
          {label}
        </a>,
      );
    }
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Colophon({ source }: { readonly source: string }) {
  const { heading, paragraphs } = parseColophon(source);
  return (
    <section className="of-about__section">
      <h2 className="of-about__heading">{heading}</h2>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{renderInline(paragraph)}</p>
      ))}
    </section>
  );
}

const cards = CORPUS.counts.cards.toLocaleString("en-GB");
const printings = CORPUS.counts.printings.toLocaleString("en-GB");
const pages = CARD_PAGES.length.toLocaleString("en-GB");
const sections = RULES.sections.length.toLocaleString("en-GB");
const sets = SETS.counts.sets.toLocaleString("en-GB");
const upstream = `https://github.com/${CORPUS.source.repository}`;

/**
 * One real face key, taken from the corpus rather than typed, so the sample
 * link in the sources table points at an image that exists.
 */
const SAMPLE_FACE = CARD_PAGES.find((page) => page.face.key !== null)?.face.key;

/** This site's own source. Linked from the sources table and from the foot. */
const OPTFALL_REPO = "https://github.com/alxjrvs/optfall";

/**
 * Every source this site is built from, each one a link you can open.
 *
 * IT IS A TABLE RATHER THAN PROSE because the claim is completeness: this page
 * says the data has provenance, and a reader has no way to check that against
 * three sentences naming two of five things. Each row is the address the build
 * actually read, pulled from the corpus metadata rather than typed, so a
 * re-sync moves the link with the data.
 *
 * NO RETRIEVAL DATE ON THIS PAGE, and the scope of that is worth stating
 * because the site has not stopped recording one everywhere.
 *
 * The date was a fact about the last sync rather than about the data. On a page
 * whose job is "here is what Optfall is built from", it went stale the moment a
 * script ran and told a reader nothing they could act on: "last confirmed"
 * three months ago does not distinguish an old corpus from a script nobody
 * re-ran. The COMMIT answers the same question honestly — it identifies the
 * exact bytes, cannot drift, and is checkable.
 *
 * `/search` and every card page still print `LAST_CONFIRMED`, deliberately.
 * There it sits beside a specific claim about a specific card — this legality
 * verdict, confirmed against upstream on this date — and a date is exactly the
 * right qualifier for that. What was wrong was using it as a summary of the
 * whole dataset's freshness, which is a question it cannot answer.
 */
const SOURCES: readonly {
  readonly what: string;
  readonly href: string;
  readonly label: string;
  readonly note: string;
}[] = [
  {
    what: "Cards",
    /* THE BLOB VIEW, NOT `source.url`. That field is the raw address the build
       fetched — 23 MB of JSON, which a browser downloads rather than shows. It
       is the same bytes at the same commit either way; this one is the one a
       reader can open. */
    href: `${upstream}/blob/${CORPUS.source.commit}/${CORPUS.source.path}`,
    label: `${CORPUS.source.repository}/${CORPUS.source.path}`,
    note: `The compilation this site's card data is read from, pinned at commit ${CORPUS.source.commit.slice(0, 7)}. Community-maintained; it publishes no licence of its own.`,
  },
  {
    what: "Sets, rarities, editions, foilings",
    href: `${upstream}/tree/${SETS.source.commit}/json/english`,
    label: SETS.source.files.join(", "),
    note: "Four more files from the same compilation, at the same commit.",
  },
  {
    what: "Comprehensive Rules",
    href: RULES.sourceUrl,
    label: `Comprehensive Rules ${RULES.version} (PDF)`,
    note: "Published by Legend Story Studios and parsed into addressable sections. The PDF is the source; the parse is ours.",
  },
  {
    what: "Game symbols",
    href: "https://rules.fabtcg.com/en/",
    label: "rules.fabtcg.com",
    note: "The resource, attack and defence markers the printed text carries, ingested from the rules site and recorded in data/symbols/symbols.json.",
  },
  /*
    A FACE, NOT THE HOST ROOT. `/` on that site answers a plain-text 404 — the
    function only serves `<tier>/<name>` — and a table claiming every row is a
    link you can open must not contain one that opens an error.

    SO THE ROW IS DROPPED RATHER THAN POINTED AT NOTHING when the corpus has no
    face to sample. That cannot happen today; it could after a bad sync, and a
    missing row is a smaller lie than a broken link on the one table whose claim
    is that every entry opens.
  */
  ...(SAMPLE_FACE === undefined
    ? []
    : [
        {
          what: "Card images",
          href: `${FACE_HOST}/normal/${SAMPLE_FACE}`,
          label: "optfall-images.netlify.app",
          note: "Faces published by Legend Story Studios, reached through the URLs the card compilation carries and re-served from a store of our own so the page does not hotlink theirs.",
        },
      ]),
  {
    what: "Typeface",
    href: "https://fonts.google.com/specimen/Grenze",
    label: "Grenze",
    note: "Self-hosted under the SIL Open Font Licence, whose text ships beside the font file.",
  },
  {
    what: "Optfall itself",
    href: OPTFALL_REPO,
    label: "alxjrvs/optfall",
    note: "Every page on this site is generated from this repository by a script in it. The structural work over the dataset is openly licensed.",
  },
];

function page(): PageResult {
  return {
    title: "About — Optfall",
    description:
      "What Optfall is, where its data comes from, what it takes from Scryfall, and its position on language models.",
    /* The header stays. `section: "none"` is for the front door, which is its own
       masthead; every other page needs a way back out of it. No `key` matches
       "about" in the nav, so nothing renders as current, which is correct — it
       is a destination rather than a section of the site. */
    islands: false,
    children: (
      <div className="of-about">
        <h1 className="of-about__title">About Optfall</h1>

        <section className="of-about__section">
          <p className="of-about__lede">
            Optfall is a card search engine and rules reference for Flesh and
            Blood. Every card, every printing and every rules section has a
            permanent URL you can paste into a judge call, and every legality
            verdict shows the upstream flags it was derived from rather than
            asking you to trust it.
          </p>
          <p>
            It is free, it has no accounts, it runs no server, and it will never
            have a chat box in it.
          </p>
        </section>

        <OrnamentalRule label="Scryfall" />

        <section className="of-about__section">
          <h2 className="of-about__heading">I have used Scryfall for years</h2>
          <p>
            <a href="https://scryfall.com">Scryfall</a> is the card search
            engine for Magic: The Gathering, and it is the best reference tool
            any trading card game has. I have typed queries into it for years,
            and Optfall is built on what it taught me: the query grammar, a
            permanent URL for every card, the shape of the front page, and the
            rule that a search should say what it could not answer rather than
            quietly answering something else.
          </p>
          <p>
            The grammar is inherited on purpose. You arrive already fluent in{" "}
            <code>pitch:3 class:guardian</code> because you have typed{" "}
            <code>c:r t:goblin</code> for years, and a second dialect would just
            be the same thing learned twice.
          </p>
        </section>

        <OrnamentalRule label="The data" />

        <section className="of-about__section">
          <h2 className="of-about__heading">Sources</h2>
          <p>
            {cards} cards, {printings} printings, {sets} sets and {sections}{" "}
            rules sections, generated into {pages} card pages and served as
            static files. No database, no API, no server.
          </p>
          <p>
            Every source is listed here with the address the build actually
            read. Both corpora are committed to the repository at a pinned
            commit, so what a page shows is identified by bytes rather than by a
            date somebody last checked.
          </p>

          <dl className="of-about__sources">
            {SOURCES.map((source) => (
              <div className="of-about__source" key={source.what}>
                <dt>{source.what}</dt>
                <dd>
                  <a href={source.href}>{source.label}</a>
                  <span className="of-about__source-note">{source.note}</span>
                </dd>
              </div>
            ))}
          </dl>

          <p>
            Legality is present-day only. Where upstream publishes no flag for a
            format, Optfall returns no verdict for it.
          </p>
        </section>

        <OrnamentalRule label="Rights" />

        <section className="of-about__section">
          <h2 className="of-about__heading">Rights and permission</h2>
          <p>
            Flesh and Blood is a game by{" "}
            <a href="https://legendstory.com">Legend Story Studios</a>. Card
            names, card text and card images are their property, displayed here
            under their third-party application policy. Optfall is not
            affiliated with them, and would take it down if asked.
          </p>
          <p>
            What is mine is the structural work over the dataset — the field
            selection, the upstream pin, the derivation of legality from
            published flags, the keyword-to-rules join — and that is openly
            licensed. The upstream card compilation publishes no licence of its
            own.
          </p>
        </section>

        <OrnamentalRule label="Colophon" />

        <Colophon source={llmStatement} />
        <Colophon source={aboutJrvs} />

        {/*
          THE LAST THING ON THE PAGE IS THE SOURCE, which is the one link a
          reader who has got this far is most likely to want and the only claim
          on this page that can be checked in full. Everything above describes
          how the site is built; this is the build.

          It is also in the sources table above, deliberately. That table is
          about provenance and answers "where did this data come from"; this is
          an invitation and answers "can I see it". Same URL, two different
          questions, and a reader who skimmed the table should not have to
          scroll back up to find it.
        */}
        <p className="of-about__source-link">
          <a href={OPTFALL_REPO}>Optfall on GitHub</a>
        </p>
      </div>
    ),
  };
}

export const aboutPage: PageModule = {
  pattern: "/about",
  page,
};
