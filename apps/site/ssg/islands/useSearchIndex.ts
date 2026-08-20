/**
 * Fetching a search index, and decoding it once when it lands.
 *
 * THIS IS THE CLIENT HALF OF `ssg/searchIndexes.ts`, which is where the argument
 * for having a client half at all is written down. The short version: an index
 * inside a `data-props` attribute is bytes in the page cache, which
 * `serviceWorker.ts` drops on every deploy and cannot share between two
 * documents. Under a content-hashed URL the same bytes are fetched once and kept
 * until they change.
 *
 * WHY TANSTACK QUERY FOR ONE `fetch`, WHICH IS THE FAIR OBJECTION. What is
 * actually needed here is not caching — the URL is content-hashed and the
 * service worker already answers it from disk — it is the STATE MACHINE around a
 * fetch that the page cannot render without. Three states have to reach the
 * screen and be told apart: not here yet, here, and it failed. `docs/PLAN.md`'s
 * "degrade visibly" makes the third one non-optional, and an island that renders
 * an empty result list while the index is in flight is the one shape that rule
 * forbids — a confident wrong answer. Query is that machine, plus retry with
 * backoff, plus deduplication if a second island on a page ever wants the same
 * index.
 *
 * NO `QueryClientProvider`, AND THAT IS DELIBERATE RATHER THAN A SHORTCUT. Each
 * island is its own hydration root (`Island.tsx` says why), so a provider would
 * have to be rendered INSIDE each island component, splitting every one of them
 * into a wrapper and an inner component that does the work. v5 takes the client
 * as `useQuery`'s second argument for exactly this case, so the client is a
 * module constant and the tree is unchanged.
 *
 * THE DECODE HAPPENS IN THE `queryFn`, NOT IN A `useMemo` OVER THE RESULT, and
 * that is the one performance decision in this file. `decodeIndex` walks 1,278
 * sections and `decodeCardIndex` walks 4,941 cards; doing either per render is
 * the difference between a field that feels instant and one that does not, which
 * is the same reasoning the `useMemo` it replaces already carried. What the query
 * caches is therefore the DECODED index — the encoded form is a wire format and
 * has no reason to outlive the parse.
 */

import { QueryClient, useQuery } from "@tanstack/react-query";

/**
 * One client for every island, created once.
 *
 * EVERY REFETCH TRIGGER IS OFF, because there is nothing to refetch. The URL
 * carries a digest of its own contents, so the bytes behind it can never change:
 * a new index is a new address, served by a page that links it. Focus,
 * reconnect and remount refetches would each be a request that cannot return
 * anything different.
 *
 * `staleTime: Infinity` states that in Query's own vocabulary; the three flags
 * are not redundant with it, since a refetch trigger fires on the CACHE ENTRY
 * rather than on staleness alone.
 */
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: Number.POSITIVE_INFINITY,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      /*
       * A FIXED, SMALL NUMBER OF RETRIES. The default is three with exponential
       * backoff, which is right for an API that might be rate-limiting and wrong
       * for a static file on our own origin: if two attempts have not produced
       * it, the honest thing is to tell the reader rather than to keep a
       * spinner up for another ten seconds.
       */
      retry: 2,
    },
  },
});

/** What an island needs to know about an index it has asked for. */
export interface SearchIndexState<Decoded> {
  /** The decoded index, or `undefined` until it has arrived. */
  readonly index: Decoded | undefined;
  /** True while the first fetch is in flight. Never true on the server. */
  readonly pending: boolean;
  /** True once every attempt has failed. */
  readonly failed: boolean;
}

/**
 * The index at `url`, fetched once and decoded once.
 *
 * THE URL IS THE QUERY KEY AND THAT IS THE WHOLE CACHE POLICY. It carries a
 * digest of the contents, so two readers asking for the same address are asking
 * for the same bytes, and a deploy that changes the index changes the key.
 *
 * `decode` IS TAKEN AS AN ARGUMENT RATHER THAN BRANCHED ON, so this file never
 * imports either decoder — which keeps it out of the dependency path that
 * `build.ts`'s island budget watches, and keeps the two islands from acquiring
 * each other's code.
 */
export function useSearchIndex<Encoded, Decoded>(
  url: string,
  decode: (encoded: Encoded) => Decoded,
): SearchIndexState<Decoded> {
  const query = useQuery(
    {
      queryKey: ["search-index", url],
      queryFn: async (): Promise<Decoded> => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`${url} responded ${response.status}`);
        }
        return decode((await response.json()) as Encoded);
      },
    },
    client,
  );

  return {
    index: query.data,
    pending: query.isPending,
    failed: query.isError,
  };
}
