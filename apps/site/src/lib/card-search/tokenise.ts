/* -------------------------------------------------------------------------- */
/* Tokenising                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Words carrying no discriminating power in card text.
 *
 * What is *absent* is the part worth reading. `may`, `if`, `when`, `each`,
 * `target`, `not`, `instead` and `until` are ordinary English stopwords and are
 * all load-bearing vocabulary on a Flesh and Blood card — "may" and "must" are
 * the difference between an option and an obligation, and "target" is a rules
 * term. Dropping them would make the most card-literate queries the ones that
 * work worst.
 *
 * THE THRESHOLD IS MEASURED, NOT TASTE. A word is here when it is a function
 * word AND it appears in a majority of cards, because a term in most documents
 * cannot separate one from another. Measured against this corpus, `you` is the
 * only content-ish word over half (2,528 of 4,941, 51.2%), and it is in the
 * list for that reason alone. `if` (47.4%), `your` (35.7%) and `may` (19.1%)
 * are all under it and all stay — the second-guess would have been to add
 * "obvious" stopwords by eye and quietly break `may` and `if`.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "in",
  "on",
  "and",
  "or",
  "is",
  "are",
  "be",
  "it",
  "its",
  "as",
  "at",
  "by",
  "for",
  "from",
  "that",
  "this",
  "these",
  "those",
  "with",
  "their",
  "them",
  "they",
  "you",
]);

/**
 * The one tokeniser. Build time and query time call this same function, which
 * is what makes a query term and an indexed term comparable at all.
 *
 * Single letters are dropped; single digits are not — "Arcane Barrier 2" is a
 * real thing to search for and `2` is the discriminating half of it.
 */
export function tokeniseCard(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return raw.filter(
    (token) => !STOPWORDS.has(token) && (token.length > 1 || /\d/.test(token)),
  );
}

/** Case- and punctuation-insensitive form, for whole-name comparison. */
export function fold(text: string): string {
  return tokeniseCard(text).join(" ");
}
