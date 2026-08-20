/**
 * The site header — wordmark, a search field, five links. React port.
 *
 * FIVE DESTINATIONS, WHICH IS THE WHOLE SITE. A nav that needs a submenu is a
 * nav describing a product with more surfaces than this one has.
 *
 * `Syntax` is here because the grammar is the thing a reader needs at the moment
 * they are already looking at results and cannot narrow them — which is every
 * page, not just the one with the field on it. It is the most-linked page on the
 * site this one is measured against, for the same reason.
 *
 * IT IS NOW THE ONLY LINK TO THE GRAMMAR. `/search` used to repeat it under a
 * line of example queries; that line said what this bar's own field already
 * says, so it went, and this nav entry inherited the whole job.
 *
 * THE FIELD IS A REAL GET TO THE RESULTS PAGE, so it works with scripting off
 * and a submitted query lands on a shareable address. ~~No island, no index~~ —
 * **no index, and an island on exactly one page.** The header still carries a
 * way in rather than a search engine: the form, its `action` and its `method`
 * are the shell's on every page, and nothing here has ever loaded a corpus.
 * What `/search` adds is that the FIELD is hydrated there, so a submit is
 * answered in place instead of navigating to the page you are already on. See
 * `fieldIsland` below, and `islands/HeaderSearch.tsx` for what it replaced.
 *
 * IT LIVES IN `ssg/` RATHER THAN IN THE COMPONENT LIBRARY, which is where
 * `Mark` and the rest live, and the line between them is worth stating: the
 * library publishes primitives another Flesh and Blood tool could adopt; this
 * knows Optfall's five URLs. A header naming `/cr` is not a primitive.
 */

import { Mark } from "optfall-components/react";

import { Island } from "./Island";
import { HeaderSearch } from "./islands/HeaderSearch";

export type HeaderSection = "cards" | "sets" | "rules" | "syntax";

/**
 * The form's own attributes — the half of the field the shell keeps.
 *
 * SPELLED ONCE BECAUSE THERE ARE TWO WAYS IT IS RENDERED and they must not
 * differ. On most pages this is a plain `<form>` and nothing hydrates it; on
 * `/search` the same element is an island's container. `action` and `method` are
 * what make the no-JavaScript path real either way, so a divergence here would
 * be a header that submits to the right place on twelve thousand pages and the
 * wrong one on the page that matters.
 */
const FORM_ATTRS = {
  className: "of-bar__find",
  role: "search",
  "aria-label": "Flesh and Blood cards",
  action: "/search",
  method: "get",
} as const;

export interface SiteHeaderProps {
  /** Which section is current, for `aria-current`. */
  readonly section?: HeaderSection | undefined;
  /**
   * The search field. On everywhere; nothing turns it off today.
   *
   * IT USED TO READ "off on the page that already has one as its hero", which
   * is now false in both halves: no page passes `false`, and `/cr` is
   * specifically a page with a hero AND this field — its hero searches the
   * rules and this one searches cards. See `PageResult.headerSearch` for the
   * whole argument; the flag survives for the front door, which removes the bar
   * entirely today and would need this the moment it grew one.
   */
  readonly field?: boolean;
  /**
   * Whether the field is hydrated, so a submit can be answered without leaving.
   *
   * ONE PAGE PASSES THIS AND IT IS `/search`, which is the only surface that can
   * answer a card query in place. See the render below, and
   * `PageResult.headerSearchIsland` for where a page declares it.
   */
  readonly fieldIsland?: boolean;
}

const LINKS: readonly {
  readonly href: string;
  readonly label: string;
  readonly key?: HeaderSection;
}[] = [
  { href: "/search", label: "Cards", key: "cards" },
  { href: "/sets", label: "Sets", key: "sets" },
  { href: "/cr", label: "Rules", key: "rules" },
  { href: "/syntax", label: "Syntax", key: "syntax" },
  { href: "/random", label: "Random" },
  /* Last, and without a `key`: it is a destination rather than a section, so no
     page marks it current. */
  { href: "/about", label: "About" },
];

/** What the disclosure discloses. Named, because it is not its child. */
const SECTIONS_LIST_ID = "bar-sections";

export function SiteHeader({
  section,
  field = true,
  fieldIsland = false,
}: SiteHeaderProps) {
  return (
    <header className="of-bar">
      <a className="of-bar__wordmark" href="/">
        {/*
          THE PITCH VARIANT, AND `md` RATHER THAN `sm`. The header used to carry
          the monochrome mark at the smallest step, on the argument that chrome
          should be quiet and the door was the one surface where the mark was
          identity rather than furniture. That is a defensible position and it
          made every page but one look unbranded — the wordmark reads as text
          with a grey glyph beside it, and the three-colour mark is the thing
          people recognise. It is the same object either way; this is a decision
          about which of the two surfaces gets the recognisable one, and the
          answer is both.
        */}
        <Mark size="md" decorative />
        Optfall
      </a>

      {field ? (
        /*
          TWO SHAPES OF ONE FORM, AND THE DIFFERENCE IS ONLY WHO OWNS THE FIELD.

          On every page but `/search` this is exactly what it has always been:
          static markup, a real GET, no island and no index — "the header carries
          a way in, not a search engine". On `/search` the same form becomes the
          container of an island, so the field is React's and a submit can be
          answered in place instead of navigating to the page you are on.

          THE ISLAND IS THE FORM RATHER THAN A WRAPPER ROUND IT, because
          `.of-bar` is a flex container and `.of-bar__find` is a flex item with a
          growth basis. A `div` between them would take the item's place and the
          form would stop growing. See `Island`'s `as` prop.

          AND IT IS OPT-IN PER PAGE rather than on wherever islands are, which is
          a narrower rule than it first looks. Every page with any island would
          otherwise hydrate this field — `/cr`, every set page — to write into a
          store nothing on those pages reads, for a submit that still has to
          navigate. One page can answer a card query without leaving, so one page
          asks for it.
        */
        fieldIsland ? (
          <Island
            name="HeaderSearch"
            props={{}}
            as="form"
            containerProps={FORM_ATTRS}
          >
            <HeaderSearch />
          </Island>
        ) : (
          <form {...FORM_ATTRS}>
            <HeaderSearch />
          </form>
        )
      ) : null}

      {/*
        A DISCLOSURE, NOT A SCRIPT. Six links do not fit beside a wordmark and a
        search field on a phone, and the bar's answer used to be `flex-wrap` —
        the nav dropped to a second row and the header doubled in height on the
        surface with the least of it to spare.

        `<details>` is the collapse, because it is the only one the platform
        gives us for free: it opens on click and on Enter/Space, it is in the
        accessibility tree as a disclosure with its state announced, and it
        needs no JavaScript on a header that is rendered by the shell into
        12,776 static documents. A checkbox and a label would look the same and
        announce as a checkbox; a real `<button>` would need an island in the
        one component that must never depend on one.

        IT IS ONLY A MENU WHEN THERE IS NO ROOM. See `SiteHeader.css`: a
        container query hides the summary and lays the list out as a row as soon
        as the bar is wide enough to seat it, so the disclosure is inert on a
        desktop rather than a thing to click before you can navigate.

        THE LIST IS THE DISCLOSURE'S SIBLING, NOT ITS CHILD, and that is the one
        thing here that looks wrong and is not. A closed `<details>` does not
        hide its contents with a rule we can outrank: Blink and WebKit stop
        rendering the shadow slot the contents are assigned to, which no
        light-DOM `display` can reach — that is why `::details-content` had to be
        specified at all, and it landed only in Chrome 131, Safari 18.4 and
        Firefox 139.

        Nesting the list therefore made the WIDE layout depend on revealing a
        closed disclosure, which works on a current engine and fails on an older
        one in the worst possible way: the container query hides the summary,
        the slot keeps the links unrendered, and the header is left with no
        navigation and no control to open any. Reproduced by disabling the
        `::details-content` override in a live page — the links landed 12px past
        the right edge of the window in a nav box of zero width.

        As a sibling, the list is ordinary markup in the light DOM at every
        width, and `[open] ~` toggles it. What is lost is the parent-child
        relationship between the control and what it discloses, so `aria-controls`
        states it instead; what is kept is a header that works in every browser
        rather than in the last two years of them.
      */}
      <nav className="of-bar__nav" aria-label="Sections">
        <details className="of-bar__menu">
          <summary
            className="of-bar__menu-button"
            aria-controls={SECTIONS_LIST_ID}
          >
            {/*
              THE GLYPH IS DRAWN, NOT TYPED. `☰` is a CJK character that a
              screen reader may read aloud as "trigram for heaven" and that a
              font may simply not have; three rules are three rules everywhere.
              The accessible name comes from the text beside it, which is
              clipped rather than absent for the same reason the field's label
              is.
            */}
            <svg
              className="of-bar__menu-glyph"
              viewBox="0 0 16 16"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d="M1 3h14M1 8h14M1 13h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="of-bar__sr">Sections</span>
          </summary>
        </details>

        <ul className="of-bar__links" id={SECTIONS_LIST_ID}>
          {LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                aria-current={
                  link.key !== undefined && link.key === section
                    ? "page"
                    : undefined
                }
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
