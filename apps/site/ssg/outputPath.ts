/**
 * URL to file, and the reason it is `index.html` in a directory.
 *
 * `/syntax` becomes `syntax/index.html` rather than `syntax.html` because a
 * static host serves the former at `/syntax` AND at `/syntax/`, and the latter
 * only at `/syntax.html`. Astro emits the directory form, this site's 13,675
 * live URLs are all directory form, and every canonical, sitemap entry and
 * pasted link already assumes it. Changing it would be a redirect table.
 */
export function outputPathFor(route: string): string {
  if (route === "/") return "index.html";
  if (route === "/404") return "404.html";
  const trimmed = route.replace(/^\/+|\/+$/g, "");
  if (trimmed === "") return "index.html";
  return `${trimmed}/index.html`;
}
