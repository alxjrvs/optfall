<script lang="ts">
  /**
   * Two faces inside a group — a fixture, so the hoisting can be tested.
   *
   * IT EXISTS BECAUSE THE GUARANTEE NEEDS COMPOSITION TO OBSERVE. The claim is
   * that a `CardFace` inside a `CardFaceGroup` suppresses its own copyright
   * notice and the group emits one for all of them, and that hand-off runs
   * through Svelte context — which cannot be set from a test by passing props.
   * Rendering a real parent with real children is the only way to watch it
   * happen, so the parent is a file.
   *
   * IT LIVES IN A SUBDIRECTORY BECAUSE A FIXTURE IS NOT A COMPONENT. The
   * library's public surface is what `src/index.ts` exports and what sits
   * beside it in this directory; a two-face test double in that list invites
   * someone to import it, and the next person reading the directory has to work
   * out which files are the library.
   *
   * It also keeps it out of `a11y.test.ts`'s non-recursive `readdirSync`, which
   * compiles every top-level `.svelte` file's CSS into the shared stylesheet
   * that harness renders against. That is a small thing — this fixture has no
   * styles — and it is stated narrowly on purpose: an earlier draft of this
   * comment claimed the harness "runs axe over every `.svelte` file it finds",
   * which it does not. Its axe cases are a hand-written `CASES` array. Being
   * wrong about the file next door, in a fixture written to make a compliance
   * claim checkable, is the exact failure this whole layer is correcting.
   */
  import CardFace from "../CardFace.svelte";
  import CardFaceGroup from "../CardFaceGroup.svelte";
</script>

<CardFaceGroup>
  <CardFace src="/a.webp" alt="A" width={180} height={251} />
  <CardFace src="/b.webp" alt="B" width={180} height={251} />
</CardFaceGroup>
