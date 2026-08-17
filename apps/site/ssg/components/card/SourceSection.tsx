/**
 * The provenance fold at the foot of a card page.
 *
 * Split out of `CardEntry`, which was 1,907 lines. This section is the one that
 * makes the page auditable — the upstream repository, the pinned commit, the
 * file hash and the ordinal — and it reads nothing from the card but its id,
 * so it was the cleanest thing in the file to lift out whole.
 *
 * The CSS stays in `CardEntry.css`: the classes are all `of-card__*` and the
 * bundle is assembled by a glob over `components/*.css`, which does not descend
 * into this directory. Moving the rules here would silently drop them from
 * every page — `styles.entry.ts` records that exact failure happening once.
 */

import { BevelledPlate, OrnamentalRule } from "optfall-components/react";

import { CORPUS, LAST_CONFIRMED, type CardPage } from "../../../src/lib/cards";

export function SourceSection({ page }: { readonly page: CardPage }) {
  const { card } = page;
  return (
    <>
      <OrnamentalRule label="Source" />
      <section className="of-card__apparatus" aria-labelledby="source">
        <details className="of-card__source-fold">
          <summary className="of-card__source-summary">
            <h2 className="of-apparatus__heading" id="source">
              Source
            </h2>
          </summary>
          <BevelledPlate emphasis="sunken">
            <dl className="of-card__provenance">
              <dt>Upstream</dt>
              <dd>
                <a
                  className="of-card__source-url"
                  href={`https://github.com/${CORPUS.source.repository}`}
                >
                  {CORPUS.source.repository}
                </a>
              </dd>
              <dt>File</dt>
              <dd>
                <code>{CORPUS.source.path}</code>
              </dd>
              <dt>Pinned commit</dt>
              <dd>
                <code className="of-card__hash">{CORPUS.source.commit}</code>
              </dd>
              <dt>Last confirmed</dt>
              <dd>
                <time dateTime={LAST_CONFIRMED}>{LAST_CONFIRMED}</time>
              </dd>
              <dt>Retrieved from</dt>
              <dd>
                <a className="of-card__source-url" href={CORPUS.source.url}>
                  {CORPUS.source.url}
                </a>
              </dd>
              <dt>File SHA-256</dt>
              <dd>
                <code className="of-card__hash">{CORPUS.source.sha256}</code>
              </dd>
              <dt>This card</dt>
              <dd>
                <code>{card.unique_id}</code>
              </dd>
            </dl>
          </BevelledPlate>
          <p className="of-card__verify">
            Card {page.ordinal} of {CORPUS.counts.cards}. Fetch that URL, hash
            it, compare. Every value here is read from those bytes by
            deterministic code — no language model touches this corpus.
          </p>
        </details>
      </section>
    </>
  );
}
