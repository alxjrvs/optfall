/**
 * `<meta value>`, which HTML does not define and one verifier insists on.
 *
 * Impact's site-verification tag is `<meta name="impact-site-verification"
 * value="…">` — `value`, not the `content` that HTML defines for `<meta>` and
 * that every other tag in `document.tsx`'s head uses. React renders the unknown
 * attribute through untouched, so the only objection is TypeScript's, and this
 * is that objection answered rather than silenced.
 *
 * DECLARED, NOT CAST, BECAUSE THE CAST WOULD BE THE LIE. `as
 * MetaHTMLAttributes` at the call site asserts the attribute is something it is
 * not and takes the rest of the tag's type-checking down with it; widening the
 * interface says the true thing — in this app, a `<meta>` may carry a string
 * `value` — and leaves `name`, `content` and the rest checked exactly as before.
 *
 * The scope is `apps/site` only. This file is picked up by that project's
 * `include`, so nothing in `packages/` sees the widened `<meta>`.
 */

import type {} from "react";

declare module "react" {
  interface MetaHTMLAttributes<T> extends HTMLAttributes<T> {
    /** Non-standard. Read by Impact's site verifier; see `document.tsx`. */
    value?: string | undefined;
  }
}
