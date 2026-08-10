# Phase 2 — research spike

**Written 2026-08-10.** This document answers the three questions that decide
the shape of Phases 2, 3 and 4. No code was written for Phase 2; the point of a
spike is to find out what is worth writing.

Every claim below was checked by running the request. Where a source could not
be read, it says so and says how it failed.

---

## 1. Are past banned-and-restricted revisions publicly archived?

`docs/PLAN.md` calls this the question that **decides a headline feature**:
*"If they are, time travel is a scraping job; if only the current list is
published, reconstructing history is an excavation and may drop behind the
rules work."*

### Answer: yes. It is a scraping job.

**LSS's own site is not the route.** `fabtcg.com` still returns **HTTP 403** to
automated fetches — reproduced today against
`https://fabtcg.com/articles/banned-and-restricted-announcement-sep02/`. That
is the same blocker `docs/PHASE-0-STATUS.md` recorded, and it has not lifted.

**The Wayback Machine is the route, and it is a good one.** Its CDX API is
public, needs no key, and — decisively — serves the archived content that the
live host refuses. Verified end to end:

- **202 distinct archived URLs** under `fabtcg.com` match
  banned/restricted/living-legend with HTTP 200.
- Individual **dated announcements** are archived as their own articles, not
  merely a single rolling page:
  `banned-and-restricted-announcement-sept21`, `…-dec-14`, `…-oct02`,
  `…-sep02`, `…-06-10-25`, `…-28-10-25`, `…-errata-bulletin`, plus the older
  `banned-and-suspended-announcement` under its pre-rename slug.
- The rolling page `/articles/banned-and-restricted-announcement/` has 13
  captures spanning **2021-03-18 to 2025-11-14**, distributed across every year
  in between.
- A capture retrieves as **33 KB of real content**, and the body carries exactly
  the fields a timeline needs. From the 21 Sep 2021 announcement, verbatim:

  > Banned and Restricted Announcement 21st Sep 2021 James White … We believe
  > that removing Seeds of Agony from the Classic Constructed format will be
  > positive for the tournament experience…

  That is a **date**, an **author**, a **card**, a **format** and an **action**
  — the whole tuple.

### What this means for the plan

The Phase 2 estimate stands, and the risk the plan hedged against does not
materialise. Backfill is a scrape with a known shape:

1. Enumerate announcement URLs from the CDX API (one query, no key).
2. Fetch each capture through `web.archive.org/web/<timestamp>id_/<url>`, which
   returns the original bytes without the Wayback toolbar injected.
3. Parse card, format and action out of prose that is **not** structured — see
   the caveat below.
4. Publish as dated JSON.

### The caveat, and it is the real work

The announcements are **editorial prose, not tables**. The sentence above says
"removing Seeds of Agony from the Classic Constructed format" — not a field
called `banned`. Extracting a timeline from that is parsing natural language,
and this project has ruled out the tool most people would reach for: **no
language model, in the product or in a published dataset.**

That is not a problem, but it does set the method. Card names are a **closed,
known vocabulary** — the card dataset gives every legal name — so extraction is
matching against a dictionary of card names and a small set of action verbs
near them, not general comprehension. Deterministic, auditable, and it fails
visibly rather than confidently.

**Every extracted entry must be reviewed against its source capture before
publication.** A wrong ban date is precisely the failure this project exists to
eliminate, and an automated parse of prose is exactly where one would enter.

---

## 2. The community card dataset

**`the-fab-cube/flesh-and-blood-cards` is real, and it is alive.** Verified via
the GitHub API today:

| Property | Value |
|---|---|
| Last push | **2026-08-10** (hours before this was written) |
| Stars | 164 |
| Archived | no |
| **Licence** | **NONE** |

**The licence gap is confirmed, not merely suspected.** GitHub reports no
licence. By default that means all rights reserved: there is no granted right to
redistribute the compilation, and Phase 3 depends on doing exactly that.

`docs/upstream-licence-issue.md` is drafted and still **unposted**. This is now
the single highest-leverage unblocked action in the project — it is five
minutes of a human's time, it gates a whole phase, and the dataset being
actively maintained means there is somebody there to answer.

---

## 3. The rules corpus

### Answer: not blocked. The document is obtainable, and it is well-formed.

**The 403 was on the wrong host.** `fabtcg.com` refuses automated fetches, and
that led an earlier draft of this very document — and `docs/PHASE-0-STATUS.md`
before it — to record Phase 4 as blocked on unreachable source material. That
conclusion was wrong, and it was wrong because only one hostname was ever
tried.

**The rules live on a separate host, `rules.fabtcg.com`, and it serves them.**
Verified today:

| Request | Result |
|---|---|
| `https://rules.fabtcg.com/pdf/en-fab-cr.pdf` | **HTTP 200**, 413 KB, `application/pdf` |
| `https://rules.fabtcg.com/en/cr/` | **HTTP 200** (MkDocs-Material HTML) |
| `https://fabtcg.com/articles/…` | HTTP 403 — the old blocker, still true, still irrelevant here |

**The document is exactly the shape Phase 4 needs.** From the retrieved PDF:

- **Comprehensive Rules 2.14.0**, dated **2026-6-10**, read off its own title
  page rather than from a search result.
- **336,881 characters** of extractable text — `pdftotext` handles it, no OCR.
- **1,270 numbered sections** matching a strict hierarchical pattern, e.g.:

  ```
  1.0.   General
  1.0.1. The rules in this document apply to any game of Flesh and Blood.
  1.0.1a If an effect directly contradicts a rule contained in this document,
         the effect supersedes that rule.
  ```

That numbering — `chapter.section.rule` plus a letter for sub-clauses — **is**
the permanent identifier scheme. Phase 4 does not have to invent addressing; it
has to preserve what LSS already publishes. `cr:1.0.1a` is a citation that
exists today.

### What is still open here

- **The HTML chapter pages are inconsistent.** `/en/cr/` returns 200 but
  `/en/cr/cr1/` returned 403 in the same minute, which looks like rate limiting
  rather than policy. The PDF is the authoritative artefact and is reliably
  available, so this only affects whether parsing works from clean HTML or from
  extracted PDF text. Retry the HTML path before choosing.
- **Tournament rules and the penalty guide are not confirmed.**
  `rules.fabtcg.com/pdf/en-fab-trp.pdf` returned 403. Either the filename is
  different or those documents sit elsewhere; the Comprehensive Rules being
  reachable does not establish that they are.
- **Version-to-version section stability is inferred, not measured.** The
  numbering is clearly designed to be stable, but that should be checked by
  diffing two versions before permanent identifiers are promised to anyone.

### How this was nearly missed, which is the more useful finding

A subagent that died mid-run left a scratch directory containing
`en-fab-cr.pdf`, `en-fab-ppg.txt` and `en-fab-trp.txt`. I deleted it as
untracked debris, and only noticed on the way past that those filenames were
the rules documents — which is what prompted checking a second hostname at all.

Two things worth keeping from that:

1. **A failed agent's byproducts can be evidence.** The run reported nothing; it
   had nonetheless proven the documents were obtainable.
2. **"Source unreachable" deserves more scepticism than it got.** One 403 on one
   host became a recorded blocker in two documents and shaped a phase estimate.
   The correct test was five minutes of checking whether the material lived
   anywhere else.

---

## What was not built, and why

Per the repository owner's instruction — *build up to the blocker, then stop* —
no Phase 2 code was written in this pass. Two pieces are genuinely unblocked and
are the obvious next work:

- **Format rules** (`packages/legality`): deck sizes, copy limits and rarity
  restrictions for the six formats. These are published tournament rules rather
  than card data. Every constraint must cite a source or be marked UNVERIFIED in
  the code — a confidently wrong deck-size limit is the same class of failure as
  a wrong ban.
- **Timeline mechanics**: the date logic that answers *what was this card's
  status on this day*. Needs no card data at all, and its boundary semantics are
  where it will be wrong: whether `effectiveFrom` is inclusive, how overlapping
  entries resolve, and — most important — that "legal then" and "no record for
  then" must never be conflated.

Both were scoped and specified in this pass but not implemented: the agent fleet
that would have written them hit a **weekly usage limit** mid-run, which is a
capacity blocker rather than a technical one.

---

## Contradictions with `docs/PLAN.md` and with our own records

**One, and it is ours rather than the plan's.**
`docs/PHASE-0-STATUS.md` records *"The LSS terms page has never been read.
`fabtcg.com` returns 403 to automated fetches"* and carries that forward as a
constraint on Phase 4. The 403 is real, but the inference drawn from it was too
broad: the rules documents are on `rules.fabtcg.com` and are served without
complaint. **Phase 4 is not blocked on source access.** That line should be
narrowed to what it actually established — the *terms* page, on `fabtcg.com`,
is unread — rather than the rules corpus as a whole.

Otherwise the plan holds. It hedged on whether the banned-list archive existed
and it does, so the optimistic branch of its own text applies. Two notes for
whoever edits it next:

- Line ~531, *"Open, and it decides a headline feature"* — **this is now
  answered.** Time travel is a scrape. The entry should move from open to
  settled, with the Wayback route recorded.
- The plan assumes the announcements can be parsed. They can, but they are
  prose rather than tables, and the no-language-model rule means the method has
  to be closed-vocabulary matching with human review. That is a constraint on
  *how*, not a contradiction of *whether* — but it belongs in the phase's
  description rather than being discovered during it.

---

## What to do next

**For a human, one thing: post `docs/upstream-licence-issue.md`.** Five
minutes, it unblocks Phase 3 entirely, and the dataset was pushed to hours ago
so somebody is there to read it. It is the only remaining blocker in the project
that code cannot clear.

**For the build, in order:**

1. **Format rules and timeline mechanics** in `packages/legality` — both
   unblocked, both need no external data, both scoped above.
2. **The Comprehensive Rules parser** — no longer blocked. The document, its
   version and its 1,270 numbered sections are in hand. This turns out to be
   *more* ready than Phase 2's headline feature, which still needs prose
   extraction from archived announcements.
3. **The banned-list scrape**, with human review of every extracted entry
   before publication.

Worth noting that (2) being unblocked may be a reason to revisit the phase
order. `docs/PLAN.md` sequences Phase 4 after Phases 2 and 3 on the grounds
that it "needs nobody's permission" — which is even more true than the plan
knew, since it also needs no licence negotiation and no prose parsing. It is now
the most tractable body of work in the project, and the one whose output
(citable permanent rule identifiers) the later phases consume.
