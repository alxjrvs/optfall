<script lang="ts" module>
import { getContext, hasContext, setContext } from "svelte";

const KEY = Symbol.for("optfall.card-face-group");

/** True when a `CardFace` is rendering inside a group that carries the notice. */
export function insideCardFaceGroup(): boolean {
  return hasContext(KEY) && getContext(KEY) === true;
}

export function markCardFaceGroup(): void {
  setContext(KEY, true);
}
</script>

<script lang="ts">
  /**
   * Faces seen together, sharing one copyright notice.
   *
   * THE PROBLEM THIS SOLVES, stated honestly because I caused it twice. The
   * copyright line has to accompany every card image — `docs/COMPLIANCE.md` §5,
   * and it is the condition the whole art licence rests on. `CardFace` emits it
   * with no prop and no variant that can drop it, which is what makes the
   * requirement unforgeable rather than merely documented.
   *
   * That is right for one face. It is wrong for a card page showing a hero face
   * and seven printing thumbnails, because eight notices for eight pictures of
   * the SAME card is eight repetitions of one legal fact. The first time I hit
   * this I "solved" it by rendering the thumbnails as bare `<img>` tags —
   * which is the exact path COMPLIANCE.md names as a way to break the
   * condition, and it left 22 card images on the page under a single notice.
   *
   * SO THE NOTICE IS HOISTED, NOT DROPPED. A group renders it once, and tells
   * the faces inside it — through context, which a caller cannot forge from
   * markup — that it has been carried. The guarantee is unchanged: the LIBRARY
   * emits the notice, never the page, and a `CardFace` that is not inside a
   * group still emits its own. What changed is where, not whether.
   *
   * WHAT MAY SHARE A NOTICE IS DECIDED BY WHETHER THE NOTICE ACCOMPANIES THE
   * FACES, which is the condition itself rather than a proxy for it. The test
   * is whether a reader can see the line at the same time as the images it
   * covers. A card page's hero face and its printing thumbnails pass. So does
   * the front door's row — six different cards, one band, one screen, with the
   * notice directly beneath them.
   *
   * A SEARCH GRID DOES NOT, and that is the case this rule exists for: sixty
   * results scroll, so a single line at the bottom does not accompany the face
   * at the top, and those keep a notice each.
   *
   * THIS SAID "A GROUP IS ONE CARD'S FACES" AND THAT WAS THE WRONG LINE TO
   * DRAW. It is a proxy that happens to agree with the real condition on a card
   * page and disagrees on the front door's row — which review caught only
   * because that row shipped and contradicted this file while citing it.
   * Counting cards was never what made the notice legible; being on the same
   * screen was.
   *
   * The narrower rule is still the safe default when in doubt: if you cannot
   * say for certain that every face in the group is visible with the notice,
   * do not group them.
   *
   * `PrintingPicker` WAS ON THE WRONG SIDE OF THIS AND IS NOT ANY MORE. It
   * grouped the whole printings rail as a wrapping four-up grid — up to 22
   * tiles, six rows deep, notice last — which is precisely the scrolling case
   * above. The rail is now a single row that scrolls sideways inside its own
   * box, one tile tall at every width, so the notice sits directly beneath a
   * band the reader can see in full whatever it is scrolled to. Recorded
   * because the rule was written down first and the caller was fixed second,
   * which is the right order and worth being able to point at.
   */
  import type { Snippet } from "svelte";

  import { CARD_IMAGE_COPYRIGHT } from "../index";

  interface Props {
    /** The faces. Any `CardFace` in here suppresses its own notice. */
    children: Snippet;
  }

  const { children }: Props = $props();

  markCardFaceGroup();
</script>

<div class="group">
  {@render children()}
  <!-- Emitted by the library, exactly as it is on a lone face. Not a prop, not
       optional, not the page's job. -->
  <p class="copyright">{CARD_IMAGE_COPYRIGHT}</p>
</div>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--of-space-loose);
  }

  /*
    LEGALESE, AND SET LIKE IT — the same treatment `CardFace` uses, and for the
    same reason. Small, tight and quiet: fine print is not a label and should
    not be tracked out like one.
  */
  .copyright {
    margin: 0;
    font-family: var(--of-type-family-sans);
    font-size: var(--of-type-size-micro);
    letter-spacing: var(--of-type-tracking-tight);
    color: var(--of-color-ink-faint);
    line-height: var(--of-type-leading-tight);
  }
</style>
