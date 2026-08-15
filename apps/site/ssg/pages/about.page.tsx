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
 * THE SCRYFALL ACKNOWLEDGEMENT IS THE POINT OF THE PAGE, not a footnote on it.
 * `docs/SCRYFALL-GAP.md` is an entire document about being a tonal copy of
 * Scryfall, the front door is modelled on theirs shape for shape, and the six
 * cards in the fan are a joke about exactly that. None of that is visible to a
 * reader — verified: the string "Scryfall" appears nowhere in the built site —
 * so a debt that obvious in the source and that invisible in the product is one
 * worth paying out loud.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { OrnamentalRule } from "optfall-components/react";

import { CORPUS as RULES } from "../../src/lib/rules";
import { CARD_PAGES, CORPUS, LAST_CONFIRMED } from "../../src/lib/cards";
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

function page(): PageResult {
  return {
    title: "About — Optfall",
    description:
      "What Optfall is, where its data comes from, the debt it owes Scryfall, and its position on language models.",
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
          <h2 className="of-about__heading">This is a Scryfall tribute act</h2>
          <p>
            <a href="https://scryfall.com">Scryfall</a> is the card search
            engine for Magic: The Gathering, and it is the best reference tool
            any trading card game has. Optfall is openly modelled on it — the
            query grammar, the permanent-URL-per-card thesis, the shape of the
            front page, the decision that a search should say what it could not
            answer rather than quietly answering something else. Where I have
            had a good idea here, it is usually because I read theirs first.
          </p>
          <p>
            The grammar is inherited on purpose. People arrive already fluent in{" "}
            <code>pitch:3 class:guardian</code> because they have typed{" "}
            <code>c:r t:goblin</code> for years, and inventing a second dialect
            to prove originality would tax the reader to flatter the author.
            Even the six cards on the front page are a joke about it: Homage to
            Ancestors, Preserve Tradition, Path Well Traveled, Retrace the Past,
            Light Fingers, Semblance.
          </p>
          <p>
            Scryfall is not affiliated with this project, has not endorsed it,
            and bears no responsibility for anything I have got wrong. No code
            or data of theirs is used here.
          </p>
        </section>

        <OrnamentalRule label="The data" />

        <section className="of-about__section">
          <h2 className="of-about__heading">Where all of this comes from</h2>
          <p>
            The cards are {cards} cards and {printings} printings across {sets}{" "}
            sets, from <a href={upstream}>{CORPUS.source.repository}</a>, pinned
            at commit <code>{CORPUS.source.commit}</code> and last confirmed{" "}
            {LAST_CONFIRMED}. The rules are the Comprehensive Rules{" "}
            {RULES.version}, published by Legend Story Studios and parsed into{" "}
            {sections} addressable sections. Both are committed to the
            repository at an immutable commit rather than fetched at read time,
            so the site cannot silently change under a link somebody shared.
          </p>
          <p>
            {pages} card pages are generated at build time and served as static
            files. There is no database and no API to fall over, which is the
            point: three Flesh and Blood tools have died or decayed, and none of
            them died of a missing feature.
          </p>
          <p>
            Legality is present-day only, and the query language says so rather
            than guessing. Where upstream publishes no flag for a format,
            Optfall says it has nothing to say instead of inferring one.
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
            affiliated with them, does not relicense their content, and would
            take it down if asked.
          </p>
          <p>
            What is mine is the structural work over the dataset — the field
            selection, the upstream pin, the derivation of legality from
            published flags, the keyword-to-rules join — and that is openly
            licensed. The upstream card compilation publishes no licence of its
            own, which is stated rather than papered over.
          </p>
        </section>

        <OrnamentalRule label="Colophon" />

        <Colophon source={llmStatement} />
        <Colophon source={aboutJrvs} />
      </div>
    ),
  };
}

export const aboutPage: PageModule = {
  pattern: "/about",
  page,
};
