/**
 * One page per addressable section of the Comprehensive Rules — 1,278 of them,
 * every one a permalink. Ported to the generator.
 *
 * `docs/ROADMAP.md` Phase 4 puts every Comprehensive Rules paragraph at a
 * permanent URL, citable by number. **The permalink is the product: a judge
 * pasting a citation into Discord instead of describing which paragraph they
 * mean is the unprompted-share moment.** That sentence decides every argument
 * on this page.
 *
 * **THE IDENTIFIER IS THE HEADING.** Not the chapter title, not a rewritten
 * question — the `<h1>` is `cr:8.3.4b`, at display size, `user-select: all`. The
 * single most likely thing a visitor does here is select that string and paste
 * it somewhere else, so it is the largest thing on the page and one click
 * selects all of it.
 *
 * **THE TEXT IS VERBATIM, AND THE PAGE NEVER TRUNCATES IT.** Bullets, examples
 * and notes are rendered whole and in document order, with the document's own
 * `Example:` and `Note:` labels intact. Nothing here is summarised, shortened or
 * reworded — the one string this page builds rather than copies is the `<meta>`
 * description, which is explicitly marked with an ellipsis when it is cut.
 *
 * **CONTEXT IS PART OF THE CITATION.** A subrule read alone is a sentence
 * without a subject: `1.0.1a` says "if an effect directly contradicts a rule",
 * and *which* rules it is talking about lives one level up. So the breadcrumb
 * links the whole ancestor chain, the children are listed with their text rather
 * than merely their numbers, and previous/next let the corpus be read in
 * document order.
 *
 * **NO `StatePill`, NO FILIGREE.** The pill is for something that carries state
 * and a paragraph of the rules carries none; the nearest temptation is
 * `verified`, and spending brass here would devalue the one signal Phase 5's
 * two-tier contract depends on. Filigree earns three roles and this page hosts
 * none of them — and a page that appears 1,278 times is the last place to spend
 * a per-screen ornament.
 *
 * THE HEAVIEST ROUTE IN THE PORT SO FAR, and the reason it is worth naming: the
 * keyword vocabulary and the card↔rule join are built ONCE at module scope. This
 * route emits 1,278 pages; rebuilding a 4,941-card index for each would be that
 * work 1,278 times for an answer that does not change. Astro's frontmatter runs
 * per page and the original had the same note; module scope means the same thing
 * in both.
 */

import { BevelledPlate, Citation } from "optfall-components/react";

import { CARD_PAGES } from "../../src/lib/cards";
import { buildKeywordVocabulary, cardsByRule } from "../../src/lib/keywords";
import {
  CORPUS,
  descriptionFor,
  LEVEL_LABEL,
  permalinkFor,
  RULE_PAGES,
  type RulePage,
  titleFor,
} from "../../src/lib/rules";
import type { PageModule, PageResult, RouteContext } from "../types";
import "./rule.css";

type Params = { readonly id: string };
type Props = { readonly page: RulePage };

/**
 * WHICH CARDS THIS RULE GOVERNS — the direction that makes a rules corpus worth
 * visiting rather than merely correct.
 *
 * `docs/DESIGN.md`, screen 4, asks for the cross-reference in both directions
 * — "a rule knows which interactions cite it" — and a rule that lists its
 * cards is the half nothing else in the game has: the
 * Comprehensive Rules is a PDF with a search box, and no tool joins it to the
 * cards it governs.
 */
const KEYWORD_VOCABULARY = buildKeywordVocabulary(CORPUS);

const CARDS_BY_RULE = cardsByRule(
  KEYWORD_VOCABULARY,
  CARD_PAGES.map((card) => ({
    label: card.label,
    href: card.href,
    keywords: [
      ...card.card.card_keywords,
      ...card.card.ability_and_effect_keywords,
    ],
  })),
);

/**
 * How many cards a rule page lists before it stops being a rule page.
 *
 * `Go again` is on 1,434 cards. Printing all of them would bury the rule's own
 * text under a directory, so the list is capped and the true total is stated —
 * the same honesty the search results page keeps, and the link goes somewhere
 * that can show the rest.
 */
const CARD_LIST_LIMIT = 24;

/**
 * Every section, statically. There is no fallback route and no catch-all
 * renderer: a URL either was published by Legend Story Studios or it 404s, which
 * is the honest behaviour for a citation index.
 */
function getStaticPaths() {
  return RULE_PAGES.map((page) => ({
    params: { id: page.section.number },
    props: { page },
  }));
}

function page({ props }: RouteContext<Params, Props>): PageResult {
  const { section, ancestors, children, references, previous, next, ordinal } =
    props.page;

  const governedCards = CARDS_BY_RULE.get(section.number) ?? [];
  const governedShown = governedCards.slice(0, CARD_LIST_LIMIT);
  /** The keyword these cards share, for the search link. Every entry agrees. */
  const governedKeyword = governedShown[0]?.keyword ?? "";

  const hasText = section.text.trim() !== "";
  const hasBody =
    hasText ||
    section.bullets.length > 0 ||
    section.examples.length > 0 ||
    section.notes.length > 0;

  const eyebrow =
    section.level === "chapter"
      ? LEVEL_LABEL[section.level]
      : `${LEVEL_LABEL[section.level]} · Chapter ${section.chapter}`;

  return {
    title: titleFor(props.page),
    description: descriptionFor(props.page),
    section: "rules",
    children: (
      <>
        <nav className="of-lineage" aria-label="Breadcrumb">
          <ol className="of-rule__crumbs">
            <li>
              <a className="of-rule__home" href="/">
                Optfall
              </a>
            </li>
            {ancestors.map((ancestor) => (
              <li key={ancestor.id}>
                <Citation ruleId={ancestor.id} href={permalinkFor(ancestor)} />
                {ancestor.title !== null ? (
                  <span className="of-rule__crumb-title">{ancestor.title}</span>
                ) : null}
              </li>
            ))}
            <li>
              <span className="of-rule__crumb-current" aria-current="page">
                {section.id}
              </span>
            </li>
          </ol>
        </nav>

        <article>
          <header className="of-rule__masthead">
            <p className="of-rule__eyebrow">{eyebrow}</p>
            <h1 className="of-rule__id">{section.id}</h1>
            {section.title !== null ? (
              <p className="of-rule__title">{section.title}</p>
            ) : null}
          </header>

          {hasBody ? (
            <div className="of-rule__body">
              <BevelledPlate emphasis="raised">
                {hasText ? (
                  <p className="of-rule__text">{section.text}</p>
                ) : null}
                {section.bullets.length > 0 ? (
                  <ul className="of-rule__bullets">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                {section.examples.map((example) => (
                  <p className="of-rule__aside" key={example}>
                    {example}
                  </p>
                ))}
                {section.notes.map((note) => (
                  <p className="of-rule__aside" key={note}>
                    {note}
                  </p>
                ))}
              </BevelledPlate>
            </div>
          ) : (
            /* Degrade visibly: a chapter or section heading genuinely has no
               prose in the published document, and saying so is better than
               rendering an empty plate that reads as a parse failure. */
            <p className="of-rule__void">
              {LEVEL_LABEL[section.level]} headings carry no rule text of their
              own in the published document.
            </p>
          )}

          {references.length > 0 ? (
            <section
              className="of-apparatus"
              aria-labelledby="cross-references"
            >
              <h2 className="of-apparatus__heading" id="cross-references">
                Cross-references
              </h2>
              <ul className="of-rule__citations">
                {references.map((reference) => (
                  <li key={reference.id}>
                    {reference.target === null ? (
                      <code>{reference.id}</code>
                    ) : (
                      <Citation
                        ruleId={reference.id}
                        href={permalinkFor(reference.target)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>

        {governedCards.length > 0 ? (
          <section className="of-apparatus" aria-labelledby="governs">
            <h2 className="of-apparatus__heading" id="governs">
              Cards this rule governs
            </h2>
            {/*
              NOTHING BETWEEN THE HEADING AND THE LIST, and that is the end of
              an argument this comment has already made twice.

              It first said: not a paragraph defending the match. A sentence
              explaining that the join is on the published keyword vocabulary
              rather than on resemblance went, because its twin on the card page
              had gone for the same reason — it answered a doubt the reader had
              not raised, where the heading above and the citation beside each
              entry already say what the list is.

              What survived that cut was a COUNT — "N cards print the keyword
              this section defines" — sitting above a list of those cards. The
              same reasoning finishes the job: the heading names the list, the
              list is the cards, and counting them in a sentence is the reader
              being told what is already in front of them. A count belongs to
              the data, never to a sentence about it.
            */}
            <ul className="of-rule__governs">
              {governedShown.map((card) => (
                <li key={card.href}>
                  <a href={card.href}>{card.label}</a>
                </li>
              ))}
            </ul>
            {governedCards.length > governedShown.length ? (
              <p className="of-rule__scope">
                <a
                  href={`/search?q=${encodeURIComponent(`keyword:"${governedKeyword}"`)}`}
                >
                  Every card with this keyword, in card search
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {children.length > 0 ? (
          <section className="of-apparatus" aria-labelledby="contents">
            <h2 className="of-apparatus__heading" id="contents">
              Contents
            </h2>
            <ul className="of-rule__entries">
              {children.map((child) => (
                <li key={child.id}>
                  <Citation ruleId={child.id} href={permalinkFor(child)} />
                  <span className="of-rule__entry-text">
                    {child.title ?? child.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="of-apparatus" aria-labelledby="source">
          <h2 className="of-apparatus__heading" id="source">
            Source
          </h2>
          <BevelledPlate emphasis="sunken">
            <dl className="of-rule__provenance">
              <dt>Document</dt>
              <dd>
                {CORPUS.game} — {CORPUS.title}, version {CORPUS.version}
              </dd>

              <dt>Published</dt>
              <dd>
                <time dateTime={CORPUS.publishedDateIso}>
                  {CORPUS.publishedDateIso}
                </time>
              </dd>

              <dt>This section</dt>
              <dd>
                <Citation
                  ruleId={section.id}
                  href={permalinkFor(section)}
                  version={section.version}
                />
              </dd>

              <dt>Retrieved from</dt>
              <dd>
                <a className="of-rule__source-url" href={CORPUS.sourceUrl}>
                  {CORPUS.sourceUrl}
                </a>
              </dd>

              <dt>PDF SHA-256</dt>
              <dd>
                <code className="of-rule__hash">{CORPUS.source.sha256}</code>
              </dd>
            </dl>
          </BevelledPlate>
          <p className="of-rule__verify">
            Hash the PDF at that URL yourself and compare. The text above is
            parsed from those exact bytes by deterministic code — no language
            model reads, rewrites or summarises any part of this corpus.
          </p>
        </section>

        <nav className="of-rule__sequence" aria-label="Document order">
          {/*
            Each slot is a labelled group rather than a bare label above a link.
            A `Citation` names itself after the identifier it carries — that is
            the point of it — so a screen-reader user tabbing through would
            otherwise hear "cr:1.0.1, link" and "cr:1.0.1b, link" with nothing to
            say which way each one goes. The visible "Previous"/"Next" is right
            there for a sighted reader; `role="group"` with a name is how that
            same fact reaches the accessibility tree without an `aria-label` on
            the citation itself, which would shadow the identifier it exists to
            announce.
          */}
          {/* biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls; this groups a label and a link. See the note above. */}
          <div
            className="of-rule__slot"
            role="group"
            aria-label="Previous section"
          >
            {previous !== null ? (
              <>
                <span className="of-rule__eyebrow">Previous</span>
                <Citation ruleId={previous.id} href={permalinkFor(previous)} />
              </>
            ) : null}
          </div>

          <p className="of-rule__ordinal">
            {ordinal} of {CORPUS.counts.total}
          </p>

          {/* biome-ignore lint/a11y/useSemanticElements: as above — a navigation slot, not a form. */}
          <div
            className="of-rule__slot of-rule__slot--end"
            role="group"
            aria-label="Next section"
          >
            {next !== null ? (
              <>
                <span className="of-rule__eyebrow">Next</span>
                <Citation ruleId={next.id} href={permalinkFor(next)} />
              </>
            ) : null}
          </div>
        </nav>
      </>
    ),
  };
}

export const rulePage: PageModule<Params, Props> = {
  pattern: "/cr/[id]",
  getStaticPaths,
  page,
};
