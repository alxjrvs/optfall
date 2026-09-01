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
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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

/** `about.page.tsx` -> `aboutPage`, the export `routes.ts` registers. */
function exportNameFor(file: string): string {
  const stem = file.replace(/\.page\.tsx$/, "");
  const camel = stem.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return `${camel}Page`;
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
    const name = exportNameFor(file);
    const reason = UNREGISTERED[file];

    test(`${file} is registered${reason ? " — or exempt" : ""}`, () => {
      const registered = routesSource.includes(`register(${name})`);

      if (reason !== undefined) {
        /* An exempt page must ALSO not be registered — otherwise the allowlist
           is describing a state that is not true, which is worse than having
           no allowlist. */
        expect(`${file} exempt and unregistered: ${!registered}`).toBe(
          `${file} exempt and unregistered: true`,
        );
        return;
      }

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
