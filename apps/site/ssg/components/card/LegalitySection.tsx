/**
 * The legality table — the first thing the card page says about a card after
 * the card itself.
 *
 * Split out of `CardEntry` for the same reason `PrintingsSection` and
 * `RelatedCards` were: the file is the most-edited pair in the repository and
 * this is the region hardest to find inside it. That is the whole of the
 * change — the markup, the classes and the reasoning below are the original's.
 *
 * THIS IS THE DIFFERENTIATOR, WHICH IS WHY IT LEADS. `docs/SCRYFALL-GAP.md` §3:
 * "our legality table is already better than Scryfall's … put it on the card
 * page above the fold — it is the differentiator that is already finished." It
 * is also the surface Phase 3 changes when `packages/legality` is finally
 * wired, so having it in a file of its own is worth more than the line count
 * suggests: the timeline lands here, and it lands in eighty lines rather than
 * in the middle of fifteen hundred.
 *
 * The CSS stays in `CardEntry.css` — see `PrintingsSection` for why.
 */

import { StatePill } from "optfall-components/react";

import { type FormatVerdict, LAST_CONFIRMED } from "../../../src/lib/cards";

export function LegalitySection({
  verdicts,
}: {
  readonly verdicts: readonly FormatVerdict[];
}) {
  return (
    <section className="of-card__apparatus" aria-labelledby="legality">
      <h2 className="of-apparatus__heading" id="legality">
        Legality
      </h2>
      <ul className="of-card__formats">
        {verdicts.map((verdict) => (
          <li className="of-card__format" key={verdict.format.id}>
            <h3
              className="of-card__format-name"
              id={`format-${verdict.format.id}`}
            >
              {verdict.format.name}
            </h3>
            {verdict.unknown ? (
              /*
                THE SAME REFUSAL, SAID ONCE INSTEAD OF SIX TIMES. It is
                deliberately not a `StatePill`: a pill would have to name a
                state, and the entire point is that there is no state to name —
                "Not in format" is a claim upstream did not make and this
                project will not make for it.
              */
              <p className="of-card__unknown">No flag published</p>
            ) : (
              <ul className="of-card__states">
                {verdict.states.map((state) => (
                  <li className="of-card__state" key={state.label}>
                    <StatePill tone={state.tone} label={state.label} />
                    {state.since !== null ? (
                      <span className="of-card__since">
                        since <time dateTime={state.since}>{state.since}</time>
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {verdict.affectsFullCycle &&
            verdict.format.id === "living-legend" ? (
              <p className="of-card__scope">
                Upstream records this restriction as affecting the full cycle of
                cards sharing this name.
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/*
        WHEN THESE FLAGS WERE LAST TRUE, BESIDE THE FLAGS.

        `docs/PLAN.md` requires every surface to show when its data was last
        confirmed, and this one did not. The date was on `/search` and nowhere
        else — so the page carrying the actual verdict, the one a reader arrives
        at from a search engine and reads without seeing `/search` at all, was
        the page that said nothing about its own age.

        IT IS HERE RATHER THAN IN THE FOOTER because it is a fact about THESE
        pills rather than about the site. A card page also states its printed
        text, its printings and its rules join, none of which move when upstream
        re-syncs; legality is the part that goes stale, and "a stale Optfall must
        look stale" is a claim about the thing that staled.

        `/about` DECLINES TO GIVE A DATE, and that is not a contradiction — it
        argues a page is identified by the bytes it was built from, which is
        right for a rules corpus carrying a PDF hash. A ban list is the case it
        is wrong for: the reader's question is not "which bytes" but "is this
        current as of the last Banned and Suspended announcement", and only a
        date answers it.
      */}
      <p className="of-card__scope">
        Legality last confirmed against upstream on{" "}
        <time dateTime={LAST_CONFIRMED}>{LAST_CONFIRMED}</time>.
      </p>
    </section>
  );
}
