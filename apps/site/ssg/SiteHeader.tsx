/**
 * The site header — wordmark, a search field, five links. React port.
 *
 * FIVE DESTINATIONS, WHICH IS THE WHOLE SITE. A nav that needs a submenu is a
 * nav describing a product with more surfaces than this one has.
 *
 * `Syntax` is here rather than only linked from the search hint because the
 * grammar is the thing a reader needs at the moment they are already looking at
 * results and cannot narrow them — which is every page, not just the one with
 * the field on it. It is the most-linked page on the site this one is measured
 * against, for the same reason.
 *
 * THE FIELD IS A REAL GET TO THE RESULTS PAGE, so it works with scripting off
 * and a submitted query lands on a shareable address. No island, no index — the
 * header carries a way in, not a search engine.
 *
 * IT LIVES IN `ssg/` RATHER THAN IN THE COMPONENT LIBRARY, which is where
 * `Mark` and the rest live, and the line between them is worth stating: the
 * library publishes primitives another Flesh and Blood tool could adopt; this
 * knows Optfall's five URLs. A header naming `/cr` is not a primitive.
 */

import { Mark } from "optfall-components/react";

export type HeaderSection = "cards" | "sets" | "rules" | "syntax";

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
   * The id of a page element describing the field, for `aria-describedby`.
   *
   * THE SHELL CANNOT KNOW WHAT THE HINT SAYS, BUT IT HAS TO EMIT THE LINK.
   * `/search` renders the operator examples — they are about that page, and the
   * header is on every page — and `CardSearch` used to attach this when it
   * adopted the field. That made the association depend on JavaScript, on the
   * one page whose no-JS path is deliberately designed for (see the `noscript`
   * block in `search.page.tsx`) and on a hydration failure that
   * `islands.client.ts` deliberately swallows. `SearchField` wired its own hint
   * server-side; an adopted field has to be given the same thing by the page.
   */
  readonly fieldDescribedBy?: string | undefined;
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

export function SiteHeader({
  section,
  field = true,
  fieldDescribedBy,
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
        // biome-ignore lint/a11y/useSemanticElements: <search> is a separate change; see SearchField.
        <form
          className="of-bar__find"
          role="search"
          aria-label="Flesh and Blood cards"
          action="/search"
          method="get"
        >
          <label className="of-bar__sr" htmlFor="site-search">
            Search the cards
          </label>
          {/*
            NO CHAIN IN THIS FIELD, DELIBERATELY. `SearchField` puts the mark
            inside the well because there it is the only thing on the page
            telling you what you are about to search. Here the wordmark's chain
            is already a few pixels to the left, so a second one says nothing the
            first has not — two identical marks on one row read as a rendering
            mistake rather than as branding. The argument for matching the
            primitive was consistency between two implementations of one control;
            consistency is not worth a duplicate glyph, and the header's field is
            the one place the primitive's reason for the mark does not hold.
          */}
          <input
            id="site-search"
            className="of-bar__field"
            name="q"
            type="search"
            autoComplete="off"
            /*
              OFF, BECAUSE THE QUERY IS THE ARTEFACT. Without it a phone
              capitalises the first character of every search, and this site's
              whole design treats `?q=…` as the thing you paste. The parser
              lowercases field names and operands, so `Banned:cc` still works —
              it just puts a stray capital in the URL somebody shares.
              `SearchField` has always carried this; the header's field did not,
              and that only started to matter when `/search` began using it.
            */
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Search cards"
            aria-describedby={fieldDescribedBy}
          />
          {/*
            NO VISIBLE SUBMIT, AND STILL A REAL ONE — the same argument
            `SearchField` makes, now that this field has inherited its job.

            A single-input form submits on Enter, and a button would be the
            widest thing in the bar for an action nobody clicks. But implicit
            submission is a browser BEHAVIOUR, not a guarantee, and a form whose
            only way in is a key press is a form some assistive technology
            cannot submit at all. That was fine while this field was a
            convenience and `/search` had a `SearchField` of its own carrying a
            hidden button; it stopped being fine when this became the only way
            to search on that page.

            Hidden rather than deleted, and it reappears on `:focus-visible` so
            a keyboard reader who tabs to it can see what they have landed on.
          */}
          <button className="of-bar__submit" type="submit">
            Search
          </button>
        </form>
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
      */}
      <nav className="of-bar__nav" aria-label="Sections">
        <details className="of-bar__menu" name="of-bar__menu">
          <summary className="of-bar__menu-button">
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

          <ul className="of-bar__links">
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
        </details>
      </nav>
    </header>
  );
}
