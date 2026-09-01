/**
 * Every page file is registered, or is listed here as deliberately not.
 *
 * `apps/site/ssg/routes.ts` argues its own design at length, and the argument
 * is right: the registry is an explicit list rather than a directory scan, so
 * that what exists as a URL is a decision visible in a reviewable diff. This
 * test does not undo that. A page still becomes a URL only by someone typing
 * `register(...)`.
 *
 * WHAT IT CLOSES IS THE ACCIDENT, WHICH THAT DESIGN LEAVES OPEN AND SAYS SO:
 * "an unregistered page file silently is not a URL". Silently is the problem.
 * Writing a page, wiring nothing, and getting a green suite is indistinguishable
 * from finishing the job — no test fails, no route 404s in a way anyone sees,
 * and the file sits there looking done.
 *
 * THE ALLOWLIST IS THE PART THAT PRESERVES THE DESIGN. A page that should not
 * be a URL yet — a draft, a page waiting on data — stays possible; it just has
 * to say so here, with a reason, which is the same shape
 * `design-system-coverage.test.ts` uses for its own exceptions and
 * `syntax.test.ts` for its refusals. Deliberate stays cheap; accidental stops
 * being free.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT } from "./lib/root";
const PAGES = join(ROOT, "apps/site/ssg/pages");
const ROUTES = join(ROOT, "apps/site/ssg/routes.ts");

/**
 * Page files that are deliberately not registered, each with the reason.
 *
 * Empty today, and adding to it should feel like a decision rather than a fix:
 * an entry here is a page that exists and is not reachable, which is worth a
 * sentence explaining why that is the intent.
 */
const UNREGISTERED: Readonly<Record<string, string>> = {};

/**
 * The binding `routes.ts` imports from a page file, or `undefined` if it
 * imports nothing from it.
 *
 * DERIVING THE NAME FROM THE FILENAME WAS THE FIRST VERSION, AND A PAGE THAT
 * CANNOT OBEY THE CONVENTION BROKE IT. It mapped `about.page.tsx` to
 * `aboutPage` and looked for `register(aboutPage)`, which works only while
 * every page stem is a valid JavaScript identifier. `404.page.tsx` is not one:
 * an identifier cannot begin with a digit, so that page MUST export a name the
 * convention cannot spell — it exports `notFoundPage` — and the guard failed a
 * page that was correctly wired, which is the one outcome a guard must not
 * produce.
 *
 * Reading the import is convention-independent and strictly stronger. It
 * follows the binding `routes.ts` actually took from the file through to its
 * `register(...)` call, so a page imported under any name is checked properly,
 * and a rename that updates the import but not the registration — invisible to
 * a name guessed from the filename — now fails.
 */
function importedBinding(file: string): string | undefined {
  const stem = file.replace(/\.page\.tsx$/, "");
  /* Stems are file names, so anything regex-significant in one is escaped
     rather than trusted; `data-terms.page.tsx` is the only punctuated case
     today and `-` is harmless, but the next one need not be. */
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `import\\s*\\{\\s*([A-Za-z_$][\\w$]*)[^}]*\\}\\s*from\\s*"\\./pages/${escaped}\\.page"`,
  );
  return pattern.exec(routesSource)?.[1];
}

/**
 * Whether `routes.ts` registers this binding.
 *
 * THE SECOND ARGUMENT IS WHY THIS IS NOT `includes("register(" + name + ")")`.
 * `register` takes optional route options, and the first page to use them —
 * `register(notFoundPage, { sitemap: false })` — has a comma where that
 * substring wants a bracket. The literal check called a correctly registered
 * page unregistered, which is the same false alarm the filename convention
 * produced, arriving from the other end of the same line.
 *
 * So the closing bracket is matched as "end of this argument": `)` for the
 * no-options form, `,` for the form that passes them.
 */
function isRegistered(name: string): boolean {
  return new RegExp(`register\\(${name}\\s*[,)]`).test(routesSource);
}

const pageFiles = readdirSync(PAGES)
  .filter((entry) => entry.endsWith(".page.tsx"))
  .toSorted();

const routesSource = readFileSync(ROUTES, "utf8");

describe("the route registry", () => {
  test("there are page files to check", () => {
    /* A glob that matches nothing would make every assertion below vacuous. */
    expect(pageFiles.length).toBeGreaterThan(0);
  });

  for (const file of pageFiles) {
    const reason = UNREGISTERED[file];

    test(`${file} is registered${reason ? " — or exempt" : ""}`, () => {
      const name = importedBinding(file);
      /* No import and no registration are the same state to a reader — the
         page is not a URL — so an exempt page is allowed to have neither. */
      const registered = name !== undefined && isRegistered(name);

      if (reason !== undefined) {
        /* An exempt page must ALSO not be registered — otherwise the allowlist
           is describing a state that is not true, which is worse than having
           no allowlist. */
        expect(`${file} exempt and unregistered: ${!registered}`).toBe(
          `${file} exempt and unregistered: true`,
        );
        return;
      }

      /* Reported separately from the registration below, because "routes.ts
         never imported this file" and "it imported it and never registered it"
         are different mistakes with different fixes. */
      expect(`${file} imported by routes.ts: ${name !== undefined}`).toBe(
        `${file} imported by routes.ts: true`,
      );

      expect(`${file} -> register(${name}): ${registered}`).toBe(
        `${file} -> register(${name}): true`,
      );
    });
  }

  test("every allowlist entry names a page that exists", () => {
    /* Stops the exemption list outliving the pages it exempts — the failure
       mode of every hand-maintained list in this repository. */
    const stale = Object.keys(UNREGISTERED).filter(
      (file) => !pageFiles.includes(file),
    );
    expect(stale).toEqual([]);
  });
});
