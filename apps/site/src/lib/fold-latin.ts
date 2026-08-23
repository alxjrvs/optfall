/**
 * One rule for reducing a card name to plain `a-z0-9`, for the two callers that
 * have to agree about it.
 *
 * IT LIVES HERE BECAUSE THE TWO CALLERS CANNOT SHARE A FILE. `slugify` in
 * `cards.ts` builds the URL; `tokeniseCard` in `card-search/tokenise.ts` builds
 * the index a reader's typing is matched against. `cards.ts` loads the 18 MB
 * corpus at module scope and every module under `card-search/` must import it
 * TYPE-ONLY — a value import there once shipped the whole corpus to every
 * reader, which is what `build.ts`'s island budget exists to catch. So the rule
 * has to sit somewhere both can reach without one dragging the other, and this
 * module imports nothing at all.
 *
 * WHAT WENT WRONG WHILE THEY DISAGREED, because this is a fix rather than a
 * tidy-up. `slugify` folded; `tokeniseCard` did not — it was
 * `text.toLowerCase().match(/[a-z0-9]+/g)`, which treats every accented letter
 * as a SEPARATOR rather than as a letter. So `Vetreiði` indexed as `vetrei`
 * plus `i`, and the ASCII spelling a reader can actually type could never reach
 * it, while the URL built from the same name was `jarl-vetreidi` and worked
 * perfectly. Five cards were reachable by typing their address and not by
 * typing their name: Jarl Vetreiði, Olé, Potion of Déjà Vu, Riches of
 * Trōpal-Dhani and Twelve Petal Kāṣāya.
 *
 * THE STEPS, IN ORDER, AND THE ORDER MATTERS:
 *
 * 1. Decompose with NFKD, so an accented letter splits into a base letter and a
 *    combining mark.
 * 2. Replace anything in {@link TRANSLITERATIONS} — the letters step 1 cannot
 *    fold, because they are not accented forms of an ASCII letter but letters
 *    in their own right, plus the two apostrophe forms.
 * 3. Lowercase, and drop the combining marks step 1 produced.
 *
 * What each caller does with the result differs, and that is the only thing
 * that should: a slug collapses the rest into `-`, an index splits it into
 * words. Neither decides how a letter folds.
 */

/**
 * Letters NFKD cannot decompose, and the apostrophes.
 *
 * NFKD SPLITS AN ACCENT OFF A BASE LETTER; it does nothing for a letter that is
 * not an accented ASCII one. `ð` is not a `d` with a mark on it, so it survives
 * decomposition intact and would be dropped as punctuation — which means an
 * upstream card named `Ærlig` produces `rlig` rather than `aerlig` on the day
 * it lands, a slug we would then be stuck with or would have to break a
 * permalink to fix.
 *
 * The apostrophes VANISH rather than becoming a separator, so `Nature's Path`
 * reads as `natures path` rather than `nature s path` — the possessive is one
 * word to a reader and has to be one word to the index.
 */
export const TRANSLITERATIONS: Readonly<Record<string, string>> = {
  æ: "ae",
  Æ: "ae",
  œ: "oe",
  Œ: "oe",
  ø: "o",
  Ø: "o",
  ð: "d",
  Ð: "d",
  đ: "d",
  Đ: "d",
  þ: "th",
  Þ: "th",
  ß: "ss",
  ł: "l",
  Ł: "l",
  ı: "i",
  "’": "",
  "'": "",
};

/**
 * Steps 1 to 3. The result is lower-case and carries no combining marks, but
 * still holds whatever separators and punctuation the input had — deciding
 * those is the caller's job.
 */
export function foldLatin(text: string): string {
  return [...text.normalize("NFKD")]
    .map((character) => TRANSLITERATIONS[character] ?? character)
    .join("")
    .toLowerCase()
    .replace(/[̀-ͯ]/g, "");
}
