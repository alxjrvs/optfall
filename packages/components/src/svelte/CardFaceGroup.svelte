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
   * Several faces of ONE card, sharing one copyright notice.
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
   * A GROUP IS ONE CARD'S FACES. It is not "several cards" — a search grid
   * shows sixty different cards, and one notice at the bottom of a scrolling
   * grid does not accompany the face at the top of it. Those keep a notice
   * each.
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
