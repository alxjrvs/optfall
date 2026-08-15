/**
 * `/syntax` — the search grammar, written down. Ported to the generator.
 *
 * WHY THIS PAGE EXISTS. The search field backs a real grammar — booleans,
 * grouping, negation, field operators, comparisons on the three printed stats,
 * the three query options, and four legality operators over six formats — and
 * the only place any of it was written down was a one-line hint above the
 * field. A grammar nobody can look up is a grammar nobody uses. Scryfall's
 * equivalent page is the single most-linked page on that site for exactly this
 * reason.
 *
 * EVERY OPERATOR BELOW WAS READ OFF THE PARSER, not remembered. The field list
 * is `FIELD_OPERATORS`, the legality list is `STATE_OPERATORS` crossed with
 * `FORMAT_ALIASES`, the booleans are `tokenise()` in `lib/query.ts`, and the
 * comparison rule is the branch in `lib/card-search.ts`. When one of those
 * changes this page is wrong, and there is no test that will say so — the
 * honest mitigation is that they sit three files apart and this comment names
 * all three.
 *
 * The tone is the project's: it documents what the engine DOES, including the
 * two places it deliberately refuses to guess. A syntax page that quietly omits
 * the refusals is how a reader concludes the feature is broken rather than
 * unbuilt.
 *
 * PORTED SECOND, AFTER `/data-terms`, because it is the largest page with no
 * island in it — tables, a definition list and prose, and nothing that has to
 * run in a browser. It is the proof that a real content page survives the move
 * before anything with state is attempted.
 */

import type { PageModule, PageResult } from "../types";
import "./syntax.css";

/**
 * One row of the operator tables below.
 *
 * `aliases` is a field rather than prose inside `meaning` because these tables
 * are the one place on the site where the difference between a description and
 * an identifier has to survive into the markup — an alias is something a reader
 * copies, so it is rendered as `<code>` and never as a sentence that happens to
 * mention it.
 */
interface Row {
  readonly example: string;
  readonly meaning: string;
  readonly aliases?: readonly string[];
}

const FIELDS: readonly Row[] = [
  { example: "name:dash", meaning: "The card's name contains this word." },
  {
    example: "text:dominate",
    meaning: "The printed rules text contains this word.",
    aliases: ["o:"],
  },
  {
    example: "type:guardian",
    meaning: "The card's type line contains this word — see the note below.",
    aliases: ["class:"],
  },
  { example: "trait:mechanologist", meaning: "The card carries this trait." },
  {
    example: "keyword:go-again",
    meaning: "The card has this keyword.",
    aliases: ["kw:"],
  },
  {
    example: "artist:fikri",
    meaning: "An artist credited on any printing of the card.",
    aliases: ["a:"],
  },
  {
    example: "ft:blood",
    meaning: "The flavour text on any printing — never the rules text.",
    aliases: ["flavour:", "flavor:"],
  },
  { example: "set:wtr", meaning: "The card was printed in this set." },
  {
    example: "rarity:majestic",
    meaning: "The card was printed at this rarity.",
  },
  { example: "pitch:3", meaning: "The card's pitch value." },
  { example: "cost:2", meaning: "The printed resource cost." },
  { example: "power:6", meaning: "The printed attack power." },
  {
    example: "defence:3",
    meaning: "The printed defence.",
    aliases: ["defense:", "def:"],
  },
];

const BOOLEANS: readonly Row[] = [
  {
    example: "dash dagger",
    meaning:
      "Two words next to each other both have to match. There is no need to type AND.",
  },
  { example: "dash or dagger", meaning: "Either one matches." },
  {
    example: "-type:attack",
    meaning:
      "Negation. It composes with every operator, not only with bare words.",
  },
  {
    example: "(dash or dagger) pitch:1",
    meaning:
      "Parentheses group, so an either-or can be narrowed by something else.",
  },
  {
    example: '"head jab"',
    meaning: "Quotes match a phrase rather than two separate words.",
  },
  {
    example: '!"Head Jab"',
    meaning: "The exact-name operator: this card and no other.",
    aliases: ["!headjab"],
  },
];

const ORDERING: readonly Row[] = [
  {
    example: "order:cost",
    meaning: "Sort by printed cost instead of by relevance.",
  },
  { example: "order:name", meaning: "Sort alphabetically." },
  { example: "order:pitch", meaning: "Sort by pitch value." },
  { example: "order:power", meaning: "Sort by printed attack power." },
  {
    example: "order:defence",
    meaning: "Sort by printed defence.",
    aliases: ["defense", "def"],
  },
  {
    example: "order:rarity",
    meaning: "Sort by the scarcest rarity the card was ever printed at.",
  },
  {
    example: "order:set",
    meaning: "Sort by the first set the card appeared in.",
  },
  {
    example: "dir:desc",
    meaning: "Reverse the order. The default is ascending.",
  },
  {
    example: "unique:art",
    meaning: "How much one row stands for — names, cards or art. See below.",
  },
  {
    example: "display:text",
    meaning: "The shape of the results — grid, list or text. See below.",
    aliases: ["display:checklist"],
  },
];

const LEGALITY: readonly Row[] = [
  { example: "legal:cc", meaning: "Legal in Classic Constructed." },
  { example: "banned:blitz", meaning: "Banned in Blitz." },
  { example: "suspended:cc", meaning: "Suspended in Classic Constructed." },
  { example: "restricted:commoner", meaning: "Restricted in Commoner." },
];

/**
 * The formats and the aliases the parser accepts for each, from `FORMAT_NAMES`
 * and `FORMAT_ALIASES`. Listed in full because a reader guessing at an alias
 * gets a notice rather than results, and guessing is the only alternative to
 * writing them down.
 */
const FORMATS: readonly { readonly name: string; readonly aliases: string }[] =
  [
    {
      name: "Classic Constructed",
      aliases: "cc, classic-constructed, classic, constructed",
    },
    { name: "Blitz", aliases: "blitz" },
    { name: "Living Legend", aliases: "ll, living-legend, livinglegend" },
    { name: "Commoner", aliases: "commoner" },
    { name: "Silver Age", aliases: "silver-age, silverage, silver" },
    { name: "Ultimate Pit Fight", aliases: "upf, ultimate-pit-fight" },
  ];

/** One operator table. Three of them differ only in their column heading. */
function OperatorTable({
  rows,
  answers,
}: {
  readonly rows: readonly Row[];
  readonly answers: string;
}) {
  return (
    <div className="of-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Example</th>
            <th>{answers}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.example}>
              <td>
                <code>{row.example}</code>
                {(row.aliases ?? []).map((alias) => (
                  <code key={alias} className="of-alias">
                    {alias}
                  </code>
                ))}
              </td>
              <td>{row.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function page(): PageResult {
  return {
    title: "Search syntax — Optfall",
    description:
      "Every operator the Optfall card search accepts: fields, comparisons, legality, booleans and grouping.",
    section: "syntax",
    children: (
      <>
        <h1>Search syntax</h1>

        <p>
          Typing words searches names and printed text. Everything below narrows
          that, and all of it composes — an operator can be negated, grouped, or
          joined with another.
        </p>

        <h2>Fields</h2>

        <p>
          A field operator scopes a word to one part of the card. Operands on{" "}
          <code>name</code>, <code>text</code>, <code>type</code>,{" "}
          <code>trait</code> and <code>keyword</code> are read as prose and
          split into one requirement per word, so{" "}
          <code>type:"illusionist action"</code> asks for both. Everything else
          — a set code, a rarity, a printed number — is matched whole.
        </p>

        <OperatorTable rows={FIELDS} answers="Matches" />

        <p>
          <strong>
            <code>class:</code> and <code>type:</code> are the same operator
          </strong>
          , and that is a property of the data rather than an oversight. The
          upstream dataset publishes classes and card types in one list —
          Guardian, Action and Attack are all entries in it — so separating them
          would mean inventing a class vocabulary Optfall does not have.
          Documenting them as one operator is the honest description of what the
          engine can answer.
        </p>

        <p>
          <strong>
            <code>artist:</code>, <code>ft:</code>, <code>set:</code> and{" "}
            <code>rarity:</code> are facts about a PRINTING, not about a card
          </strong>
          , and a card matches when any one of its printings does. A card
          reprinted with new art is found by either artist; one whose second
          printing carries different flavour is found by either. That is usually
          what you want, and it is worth knowing when it is not.
        </p>

        <p>
          <strong>
            Flavour text is a separate index from rules text, and neither
            reaches the other.
          </strong>{" "}
          <code>text:blood</code> asks what a card does; <code>ft:blood</code>{" "}
          asks what it says about itself, and they return different cards. A
          bare word searches names, types, keywords, traits and rules text —
          never flavour, because a card that merely mentions a thing is not a
          card that does it.
        </p>

        <h2 id="display">What the answer looks like</h2>

        <p>
          <code>display:</code> picks the shape of the results, and it is part
          of the query rather than a setting beside it — so the link you copy
          shows what you were looking at.
        </p>

        <dl className="of-modes">
          <dt>
            <code>display:grid</code> — the default
          </dt>
          <dd>
            The card face is the row. Recognising a card by its picture is
            faster than reading its name.
          </dd>

          <dt>
            <code>display:list</code>
          </dt>
          <dd>
            A dense row: pitch, name, type line and the printed stats, plus why
            the card matched.
          </dd>

          <dt>
            <code>display:text</code> (also <code>display:checklist</code>)
          </dt>
          <dd>
            Names, one per line, and nothing else — the mode whose output is
            meant to leave the page. Select it and paste it into a deck list.
          </dd>
        </dl>

        <h2 id="uniqueness">How much one row stands for</h2>

        <p>
          A search returns ROWS, and a row is not obviously a card. Head Jab is
          printed at three pitches and reprinted in six sets, so "how many Head
          Jabs are there" has three defensible answers. <code>unique:</code>{" "}
          picks which one you get.
        </p>

        <dl className="of-modes">
          <dt>
            <code>unique:names</code> — the default
          </dt>
          <dd>
            One row per NAME. The red, yellow and blue Head Jabs are one result,
            linking to the card page where the versions are tabs. A player calls
            them one card, and being told "3 cards match" should mean three
            things to click.
          </dd>

          <dt>
            <code>unique:cards</code>
          </dt>
          <dd>
            One row per CARD. Those three versions separate, because they
            genuinely are three cards — different text, different legality, and
            a page each.
          </dd>

          <dt>
            <code>unique:art</code> (also <code>unique:prints</code>)
          </dt>
          <dd>
            One row per distinct PICTURE, alternate arts included, each linking
            to that art's own page.
          </dd>
        </dl>

        <p>
          <strong>
            <code>unique:prints</code> resolves to <code>unique:art</code>, and
            that is a fact about this data rather than a shortcut.
          </strong>{" "}
          The corpus carries 16,502 printing rows and 11,378 distinct pictures:
          a card printed Regular, Rainbow Foil and Cold Foil in one set is three
          rows sharing one image, one collector number and one page. A separate{" "}
          <code>prints</code> level could only have emitted three identical rows
          pointing at the same URL.
        </p>

        <p>
          <strong>Collapsing happens after matching, never before it.</strong> A
          query only one pitch version satisfies still finds the card under the
          default, and the row links to the version that actually matched — not
          to whichever version happens to be first.
        </p>

        <h2 id="comparisons">Comparisons</h2>

        <p>
          <code>cost</code>, <code>power</code> and <code>defence</code> accept{" "}
          <code>&gt;</code>, <code>&gt;=</code>, <code>&lt;</code>,{" "}
          <code>&lt;=</code> and <code>!=</code> — so <code>power&gt;=6</code>{" "}
          is a query. No other field does, because no other field has an order
          to compare along.
        </p>

        <p>
          <strong>
            A card printing <code>X</code> matches no comparison at all.
          </strong>{" "}
          Printed costs in this corpus include <code>X</code>, <code>XX</code>{" "}
          and blanks, and those have no place in a numeric order. So a
          comparison means "this value is a number, and it satisfies the
          comparison", and a card printing <code>X</code> is simply absent from
          the answer rather than sorted arbitrarily into it.
        </p>

        <h2>Legality</h2>

        <p>
          Four operators, each naming a format. Legality here is{" "}
          <em>today's</em>.
        </p>

        <OperatorTable rows={LEGALITY} answers="Matches" />

        <div className="of-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Format</th>
                <th>Accepted names</th>
              </tr>
            </thead>
            <tbody>
              {FORMATS.map((format) => (
                <tr key={format.name}>
                  <td>{format.name}</td>
                  <td>
                    <code>{format.aliases}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Ordering</h2>

        <p>
          Results come back by relevance — an exact name match ahead of a text
          match — until you ask for something else. <code>order:</code> replaces
          that ranking rather than refining it, and <code>dir:</code> reverses
          whatever it chose.
        </p>

        <OperatorTable rows={ORDERING} answers="Sorts by" />

        <p>
          <strong>
            A card with no value for the key sorts last, whichever direction you
            asked for.
          </strong>{" "}
          Printed costs include <code>X</code>, <code>XX</code> and blanks, and
          a card with no defence has no defence rather than zero of it — putting
          those first under <code>dir:desc</code> would claim they are the
          largest, and first under <code>asc</code> that they are the smallest.
          They are neither, so the direction applies to the cards that have a
          value and the rest go to the end. It is the same refusal{" "}
          <a href="#comparisons">comparisons</a> already make.
        </p>

        <p>
          An ordering is an option on the whole query rather than a term in it,
          so it can be written anywhere and does not change which cards match.{" "}
          <code>order:cost</code> on its own finds nothing — it says how to
          arrange results, not which to find — and says so rather than returning
          an empty page.
        </p>

        <h2>Booleans and grouping</h2>

        <OperatorTable rows={BOOLEANS} answers="Means" />

        <h2>What Optfall will not guess</h2>

        <p>
          <strong>Dated legality is not answered yet.</strong>{" "}
          <code>legal:cc@2026-03-14</code> parses, and asks a real question —
          what was legal on a given date — and Optfall publishes present-day
          legality only. Rather than answer with today's flags and let the date
          read as though it were honoured, the query returns a notice saying the
          feature is unbuilt. A wrong answer is worse than a missing one, and it
          is worse precisely because it looks like an answer.
        </p>

        <p>
          An unknown operator, an unknown format name, or an operator typed with
          nothing after it is reported the same way: the query says what it
          ignored rather than quietly returning everything.
        </p>
      </>
    ),
  };
}

export const syntaxPage: PageModule = {
  pattern: "/syntax",
  page,
};
