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
  /** The search field. Off on the page that already has one as its hero. */
  readonly field?: boolean;
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

export function SiteHeader({ section, field = true }: SiteHeaderProps) {
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
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Search cards"
          />
        </form>
      ) : null}

      <nav className="of-bar__links" aria-label="Sections">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            aria-current={
              link.key !== undefined && link.key === section
                ? "page"
                : undefined
            }
          >
            {link.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
