/**
 * The Worker entrypoint for the card-face host.
 *
 * Everything interesting is in `./face`, which is platform-free and tested
 * against a fake store. This file is the whole of the platform coupling: take
 * the R2 binding off `env`, adapt it to the {@link FaceStore} seam, and answer.
 *
 * WHY THE BINDING IS READ INSIDE `fetch` AND NOT AT MODULE SCOPE. A Worker's
 * `env` does not exist until a request arrives, and module scope on workerd
 * forbids async I/O, timers and randomness outright — code that reaches for any
 * of them fails at STARTUP rather than at build, which is the expensive place
 * to find out. `makeFaceHandler` takes the store as a getter precisely so that
 * opening it happens inside a request and never at import time.
 *
 * THE HANDLER IS BUILT PER REQUEST, WHICH IS CHEAPER THAN IT LOOKS: it closes
 * over two functions and allocates nothing else. Hoisting it would mean caching
 * a binding across requests for no measurable gain.
 */
import { makeFaceHandler, type FaceStore } from "./face";

/**
 * The slice of R2 this Worker uses, declared structurally.
 *
 * Written out rather than pulled from `@cloudflare/workers-types` because it is
 * two members, and a types package would be a dependency this app otherwise
 * does not have — `apps/images` declares NONE, which is the point: a host whose
 * whole job is to stay up should have as little to break as possible, and no
 * runtime dependencies at all is the strongest version of that.
 */
interface R2ObjectBody {
  readonly body: ReadableStream;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
}

export interface Env {
  /** Bound to the `optfall-card-faces` bucket by `wrangler.jsonc`. */
  readonly FACES: R2Bucket;
}

/**
 * R2 answers with an object carrying a stream; the seam wants the stream or
 * nothing. A miss is `null` from both, so this is the whole adapter.
 */
function storeFor(bucket: R2Bucket): FaceStore {
  return {
    get: async (key) => (await bucket.get(key))?.body ?? null,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    /*
     * A MISSING BINDING MUST REACH `face.ts`'s CATCH, NOT THROW PAST IT. The
     * handler treats "cannot open the store" and "the store did not answer" as
     * one failure domain and degrades both to a 503 placeholder, which is what
     * keeps a binding typo from turning every card on the site into a broken
     * image glyph. Throwing here instead would produce a bare platform 500 and
     * skip that. `env.FACES` is typed as present, so this is the case the type
     * says cannot happen — which is exactly the kind that reaches production.
     */
    const handler = makeFaceHandler(() => {
      if (env.FACES === undefined) throw new Error("FACES binding is missing");
      return storeFor(env.FACES);
    });
    return await handler(request);
  },
};
