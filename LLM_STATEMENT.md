<!--
  The canonical LLM statement for this project.

  Rendered verbatim on `/about` (`apps/site/ssg/pages/about.page.tsx`, read at
  build time with node:fs), alongside `ABOUT_JRVS.md`. Edit the wording here and
  the site changes; there is no second copy.

  Written for this project rather than copied from SU-SRD's. The position is the
  same; the wording is not, because a statement about how a particular codebase
  was made has to be true of that codebase. Say nothing here about how any other
  project was built.
-->

# LLM Statement

Optfall was built with LLM coding tools. I have used Claude and various open
weight models to produce code, tests, documentation and design here. All of it
was directed, reviewed and deployed by me. The
[GitHub](https://github.com/alxjrvs/optfall) shows the full extent of that
involvement — every pull request, every review, every argument I lost. Bugs and
errors are my responsibility, and the blame for them falls on me.

None of that reaches you. **No language model runs in this site, and none was
used to produce anything it tells you about a card or a rule.** That is not a
promise about my intentions, it is a property of the build: every string served
traces to a parsed official document or to a named human author, the parsers are
deterministic code whose output diffs cleanly and fails loudly, and continuous
integration fails if a language model so much as appears in a dependency
manifest. A tool whose entire claim is being right cannot have a component in
it that is confidently wrong, and a rules answer composed by a model is exactly
that.

This constrains the product and I think it improves it. There is no chat box
here and there will not be one. Where Optfall does not know something it says so
— the keywords the rules do not define, the cards with no published release
date, the formats where upstream publishes no flag — rather than generating a
plausible sentence to fill the gap.

I support open-weight models. I am against consolidated ownership of LLM
infrastructure, and against the obtrusive, environmentally unsound data centers
built to serve it.

Software, like games, will eternally be a human endeavor.
