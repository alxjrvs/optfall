/**
 * `/about` — what this is, who it owes, where the data comes from, and who to
 * blame.
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
 * influence is a credit rather than an admission. The heading now names the
 * debt outright: the resemblance is homage, and a homage nobody states reads as
 * a copy nobody owned up to.
 *
 * NO FIGURES ON THIS PAGE, and that is a rule rather than an omission. Corpus
 * counts, the page total and the keyword join's coverage percentage were all
 * interpolated, so none of them could rot — and every one of them still read as
 * a specification sheet in the middle of a page whose subject is who made what.
 * A reader who wants the size of the corpus is not on `/about`. The keyword
 * join's *unmatched list* survives the rule deliberately: naming what a join
 * could not answer is honesty, whereas counting what it could is a boast.
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
import { CORPUS } from "../../src/lib/cards";
import {
  buildKeywordVocabulary,
  keywordCoverage,
} from "../../src/lib/keywords";
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

const upstream = `https://github.com/${CORPUS.source.repository}`;

/**
 * THE KEYWORD JOIN'S UNMATCHED LIST, computed rather than typed so it cannot
 * rot when either document is re-synced. The percentage and the tallies that
 * used to sit beside it are gone; the note on figures at the head of this file
 * says why this half stayed.
 */
const coverage = keywordCoverage(
  buildKeywordVocabulary(RULES),
  CORPUS.cards.flatMap((card) =>
    card.card_keywords.concat(card.ability_and_effect_keywords),
  ),
);
const unmatchedList = coverage.unmatched.join(", ");

/** This site's own source. Linked from the sources list and from the foot. */
const OPTFALL_REPO = "https://github.com/alxjrvs/optfall";

/**
 * Everyone this site is built on, each one a link you can open.
 *
 * IT IS A LIST RATHER THAN PROSE because the claim is completeness: this page
 * says nothing here started with me, and a reader has no way to check that
 * against three sentences naming two of five things. Reading it should feel
 * like credits, which is what it is.
 *
 * EACH LINK IS THE SOURCE'S FRONT DOOR, NOT THE EXACT BYTES THE BUILD READ, and
 * that is the reversal worth recording. The rows used to carry a pinned blob
 * URL, the commit's short SHA, the list of JSON filenames and the rules
 * document's version number, all interpolated from corpus metadata — provably
 * accurate, and addressed to an auditor rather than a reader. A version number
 * in a credit line ages the credit, and the thanks do not expire when the PDF
 * is revised. The pin is still real and still checkable: it is in the
 * repository, which is the last link on the page. It is simply no longer what a
 * reader has to wade through to find out who made the cards.
 *
 * NO RETRIEVAL DATE ON THIS PAGE. It was a fact about the last sync rather than
 * about the data: "last confirmed" three months ago does not distinguish an old
 * corpus from a script nobody re-ran. `/search` and every card page still print
 * `LAST_CONFIRMED`, deliberately — there it sits beside a specific claim about
 * a specific card, and a date is exactly the right qualifier for that.
 */
const SOURCES: readonly {
  readonly what: string;
  readonly href: string;
  readonly label: string;
  readonly note: string;
}[] = [
  {
    what: "The cards",
    href: upstream,
    label: CORPUS.source.repository,
    note: "A community compilation of Flesh and Blood card data — cards, printings, sets, rarities, editions, foilings — kept up in the open by people doing it for nothing. Optfall reads a copy of it, pinned to one commit. It publishes no licence of its own.",
  },
  {
    what: "The rules",
    href: RULES.sourceUrl,
    label: "the Comprehensive Rules (PDF)",
    note: "Published by Legend Story Studios. The document is theirs; the parse into sections you can link to is mine.",
  },
  {
    what: "The symbols",
    href: "https://rules.fabtcg.com/en/",
    label: "rules.fabtcg.com",
    note: "The resource, attack and defence markers the printed text carries, taken from the rules site rather than redrawn.",
  },
  {
    what: "The letterforms",
    href: "https://fonts.google.com/specimen/Grenze",
    label: "Grenze",
    note: "Self-hosted under the SIL Open Font Licence, whose text ships beside the font file.",
  },
  {
    what: "Optfall itself",
    href: OPTFALL_REPO,
    label: "alxjrvs/optfall",
    note: "Every page on this site is generated from this repository by a script in it. The structural work over the dataset is openly licensed — read it, take it, tell me where I got it wrong.",
  },
];

function page(): PageResult {
  return {
    title: "About — Optfall",
    description:
      "What Optfall is, who it owes, where its data comes from, and its position on language models.",
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
            Blood. I built it because I wanted one: somewhere every card, every
            printing and every rules section has a permanent URL you can paste
            into a judge call, and where a legality verdict shows you the
            upstream flags it came from instead of asking you to take my word
            for it.
          </p>
          <p>
            It is free, it has no accounts, it runs no server, and it will never
            have a chat box in it.
          </p>
        </section>

        <OrnamentalRule label="Scryfall" />

        <section className="of-about__section">
          <h2 className="of-about__heading">In honour of Scryfall</h2>
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
            Where the two look alike, that is on purpose, and it is a debt
            rather than a coincidence. None of their code, their data or their
            blessing is in here. What is in here is their idea of what a card
            search engine owes the person using it, and they should get the
            credit for it — which is the whole reason this section exists,
            because a resemblance nobody owns up to reads as something worse
            than an influence.
          </p>
          <p>
            The grammar is inherited on purpose too. You arrive already fluent
            in <code>pitch:3 class:guardian</code> because you have typed{" "}
            <code>c:r t:goblin</code> for years, and a second dialect would just
            be the same thing learned twice.
          </p>
          <p>
            If you play Magic, go and use theirs. This is a small thing made in
            respect of a much larger one.
          </p>
        </section>

        <OrnamentalRule label="The data" />

        <section className="of-about__section">
          <h2 className="of-about__heading">Where all this came from</h2>
          <p>
            Almost none of it is mine. The cards, the rules, the symbols, the
            art and even the letterforms were made by other people first; what I
            did was the joining-up. So here is everyone to thank, with the
            address the build actually reads.
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
            Both corpora are committed to this repository at a pinned commit,
            and the whole site is generated from them as static files, so what a
            page shows you is identified by the bytes it was built from rather
            than by a date somebody last checked. No database, no API, nothing
            to go down.
          </p>
          <p>
            Card images are Legend Story Studios'. They are reached through the
            URLs the card compilation carries and re-served from a store of my
            own, so these pages do not hotlink theirs.
          </p>
          <p>
            Legality is present-day only. Where upstream publishes no flag for a
            format, Optfall returns no verdict for it.
          </p>

          {/*
            THE JOIN'S FAILURES, AND THEY MOVED HERE FROM `/search`.

            A join that quietly drops what it cannot answer is asserting a
            completeness it does not have, so the failures are named. What
            changed first is only where: they used to sit at the foot of the
            results page, which paginates — so build metadata was filed under
            sixty card faces, addressed to somebody who came to look up a card.
            This is the page about method.

            THE NAMES STAYED WHERE THE PERCENTAGE WENT. Both were computed, so
            neither could rot; only one of them was information. A coverage
            figure invites the reader to be satisfied, and the list invites them
            to check. The list is also the shorter sentence.

            AND THEN THE SENTENCE ASSERTED THE COMPLETENESS ANYWAY. It read
            "every card page cites the rules that govern it", two lines under a
            paragraph arguing that a join which drops what it cannot answer must
            not claim to be total — and it was false: a third of cards cite
            nothing, because the join reads `card_keywords` and
            `ability_and_effect_keywords`, and upstream leaves those empty on
            plenty of cards that plainly have keywords. Art of War grants go
            again, banishes and touches arsenal, and carries no citation at all.

            THE REPLACEMENT DOES NOT COUNT EITHER, which is the same argument
            this comment already made about the percentage. "A third" belongs in
            this comment, where it explains a decision, and not in the prose,
            where it would be a number the reader is asked to take on trust
            about a page they are already looking at.
          */}
          <p>
            Card keywords are matched to the Comprehensive Rules section that
            defines each one, and a card page cites what its own keywords
            resolve to. The keywords the rules never define outright are named
            rather than hidden: {unmatchedList}. A keyword the rules do not
            define carries no citation instead of a guessed one, and a card
            upstream records no keywords for carries none at all.
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
            affiliated with them, and I would take it down if they asked.
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

          It is also in the sources list above, deliberately. That list is about
          provenance and answers "where did this come from"; this is an
          invitation and answers "can I see it". Same URL, two different
          questions, and a reader who skimmed the list should not have to scroll
          back up to find it.
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
