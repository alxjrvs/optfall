# DRAFT — upstream licence request

> ## ⚠ THIS IS A DRAFT. IT HAS NOT BEEN POSTED.
>
> Nothing in this file has been sent to anyone. No issue has been opened, no
> comment has been left, and no maintainer has been contacted. It is a prepared
> text for **a human** to review, edit, and post themselves.
>
> This is deliberate. The text asks a favour of a volunteer maintainer on behalf
> of a named person, and it cites a third party's legal terms. Both are things a
> person should send under their own name, having read them.

---

## What was verified

Checked **2026-08-08**, via the read-only GitHub API and web search.

**The repository is the right one.** `PLAN.md` refers to "the community card
dataset" without naming it; `the-fab-cube/flesh-and-blood-cards` was the likely
candidate and it checks out:

| | |
|---|---|
| Repository | [`the-fab-cube/flesh-and-blood-cards`](https://github.com/the-fab-cube/flesh-and-blood-cards) |
| Description | "Open source JSON/CSV representations of the cards for the Flesh and Blood TCG" |
| Created | 2022-02-18 |
| Default branch | `develop` (note: **not** `main`; releases are tagged off `main`) |
| Activity | Last push **2026-08-03** — actively maintained, not abandoned |
| Scale | 163 stars, 57 forks, 127 open issues |
| Archived / fork | No / no |

**The licence is genuinely absent — this is confirmed, not assumed.**

- The GitHub API reports `"license": null` for the repository.
- `GET /repos/the-fab-cube/flesh-and-blood-cards/license` returns **404 Not
  Found**.
- The root tree contains no `LICENSE` file of any spelling: `.github`,
  `.gitignore`, `.pre-commit-config.yaml`, `.python-version`, `CONTRIBUTING.md`,
  `README.md`, `changelog.txt`, `csvs`, `documentation`, `helper-scripts`,
  `index.html`, `json-schema`, `json`, `release-template.md`, `web`.
- Neither `README.md` nor `CONTRIBUTING.md` contains any licensing,
  redistribution or copyright statement.

**The maintainer's intent is already permissive — this matters for tone.** The
README says, in the maintainer's own words:

> "Please feel free to clone or fork the repo and generally use it for whatever
> projects you like. I put this together so the community doesn't have to keep
> re-entering the same data!"

So this is **not** a request to change policy. It is a request to write down a
policy that has already been stated informally, in a form tools and lawyers can
read. The draft below is built around that, and it should stay built around it.

**There is already an open issue asking for exactly this, and it is stale.**

| | |
|---|---|
| Issue | [#119 — "Add missing license to repository"](https://github.com/the-fab-cube/flesh-and-blood-cards/issues/119) |
| Opened | 2022-09-13 by `luceleaftea` |
| State | **Open**, label `bug` |
| Body | *Empty* — title only |
| Comments | **0**, in nearly four years |

**This changes the recommendation.** Opening a second issue for the same request
would be a duplicate, and duplicates on a 127-issue backlog read as noise. The
better move is to **comment on #119**, which is also the more useful
contribution: the existing issue is a bare title with no reasoning, no proposed
licence, and no explanation of why it matters. Supplying those is the thing that
might actually move it.

The draft below is therefore written **as a comment on issue #119**. A version
for a fresh issue is given afterwards, in case a human prefers that.

**Downstream context worth knowing.** The README lists roughly a dozen projects
already consuming this data — Fabrary, Talishar, Rules of Rathe, FABREC,
Spellvoid and others. Every one of them is in the same position. That is worth
one sentence in the ask and not more; it is context, not leverage.

**One upstream house rule, noted for our own use:** `CONTRIBUTING.md` states
"All image links must be from LSS' site." The dataset links to LSS-hosted
images rather than redistributing them.

---

## The draft — as a comment on issue #119

Everything between the rules is the text to post. Roughly 260 words, which is
the right length for a request to a volunteer.

---

Hi — reviving this one with some specifics, since the original issue is just a
title.

I'm building a Flesh and Blood legality and rules reference tool that would
depend on this data set, and the missing licence is the one thing blocking me
from depending on it properly.

The practical problem: with no `LICENSE` file, the default position is all
rights reserved. That leaves no clearly granted right to redistribute the
compilation — which is the part that's genuinely yours, from years of data entry
and structuring, quite apart from anything Legend Story Studios owns. In
practice that means downstream projects either quietly assume permission, or
build around the data set rather than on it. Neither seems like what you want,
given the README already says:

> Please feel free to clone or fork the repo and generally use it for whatever
> projects you like.

That's exactly the intent — it just isn't in a form a licence scanner, a
corporate policy, or a cautious maintainer can act on. So this is really a
request to write down what you've already said.

Worth adding: LSS's own [Terms of Use for Game and Studio Assets and
IP](https://fabtcg.com/resources/terms-use-licensed-assets/) explicitly permit
third-party card databases and APIs transferring game content, provided they
aren't directly monetised. So the underlying game content is already blessed by
the rights holder for this exact use. The only missing piece is your own terms
over the compilation.

If it's useful, a minimal version would be a `LICENSE` with **CC0-1.0** or
**MIT** covering the data set as a compilation, plus a README line noting that
card names, card text and images remain LSS property and that downstream users
must follow LSS's terms.

Happy to open the PR if you'd like — just say which licence you'd prefer. And
thanks for maintaining this; the dozen-odd projects in your README are the
argument for it.

---

## Alternative — if a human prefers a fresh issue

Only if #119 has been closed, or the maintainer asks for a new one. Reference
#119 either way so the history stays connected.

**Title:** `Add an explicit licence for the data set`

**Body:** the text above, with the opening line replaced by:

> Opening this to add specifics to #119, which has been open since 2022 with
> just a title. Happy to have it closed as a duplicate if you'd rather keep the
> discussion there.

---

## Before a human posts this

1. **Re-check that #119 is still open** and still has no substantive replies.
   This was verified 2026-08-08 and the situation may have moved.
2. **Re-read the LSS terms page.** The draft cites it as permitting third-party
   card databases and APIs. That is accurate to the best available reading, but
   `fabtcg.com` returns HTTP 403 to automated fetches, so the citation was
   assembled from search excerpts rather than read directly. **Do not post a
   summary of someone else's legal terms without having read them.** See the
   verification caveat in [`COMPLIANCE.md`](COMPLIANCE.md).
3. **Post under your own name**, from your own account.
4. **Ask, do not press.** No deadline, no escalation, no follow-up ping. One
   comment. If the maintainer says no or says nothing, that is a complete answer
   and the interim position below applies.
5. **Mean the PR offer.** If the maintainer says "sure, MIT", open it that day.
   `PLAN.md`'s standing rule is *contribute upstream, never fork* — this is a
   chance to be a good downstream contributor before ever asking for anything
   else.
6. **Do not mention Optfall's roadmap, traffic or ambitions.** The ask stands on
   its own; anything else reads as leverage.

---

## If it does not resolve

A licence may never arrive. The maintainer may be busy, may not want the
decision, or may reasonably feel it is not theirs to make given LSS's ownership
of the underlying content. Plan for that outcome rather than waiting on it.

The interim position, which is already recorded in
[`DATA-TERMS.md`](DATA-TERMS.md):

- **Consume, do not mirror.** Pull on a schedule, pin by commit, and cite the
  commit. Do not republish their files verbatim as part of an Optfall dataset.
- **Publish only our own derived structural records** — the legality timeline,
  rule identifiers, diffs and annotations. Those are Optfall's work and are CC0
  regardless of what upstream decides.
- **Point people upstream** for the card corpus itself, so they can form their
  own view.
- **Keep contributing upstream anyway.** Corrections go to them. Being a good
  downstream contributor is not contingent on the answer.

This is a genuinely workable fallback, which is why the request is a
five-minute task with outsized leverage rather than a dependency. If it lands,
Phase 3 gets simpler. If it does not, nothing stops.
