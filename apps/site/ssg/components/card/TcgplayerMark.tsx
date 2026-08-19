/**
 * TCGplayer's mark, as an image.
 *
 * IT LIVES IN `apps/site` AND NOT IN THE COMPONENT LIBRARY, and the line is the
 * same one `SiteHeader`'s docblock draws: the library publishes primitives
 * another Flesh and Blood tool could adopt, and a component that knows one
 * marketplace's logo is not one of those. `IconButton` takes an icon slot for
 * exactly this reason — the shape is generic, this filling is ours.
 *
 * `alt=""` BECAUSE `IconButton` ALREADY HID IT. The button wraps its icon in an
 * `aria-hidden` span and carries the name in its label, so a non-empty `alt`
 * here would either be ignored or, worse, announced alongside it as "image,
 * TCGplayer, Buy on TCGplayer".
 *
 * DIMENSIONS ARE STATED so the row does not reflow when the image lands. They
 * are the file's own pixels — a 48x48 PNG derived from TCGplayer's published
 * favicon — and the CSS sizes it from `ornament.mark.small` regardless; these
 * exist to give the browser an aspect ratio before the bytes arrive, not to
 * choose how big it is.
 *
 * The file's origin, the conversion that produced it, and the one thing about
 * it that is NOT established — whether this placement is permitted — are all
 * recorded in `data/brand/brand.json`. Read the `rights` field there before
 * moving this mark anywhere new.
 */

export function TcgplayerMark() {
  return (
    <img
      alt=""
      decoding="async"
      height={48}
      loading="lazy"
      src="/brand/tcgplayer-mark.png"
      width={48}
    />
  );
}
