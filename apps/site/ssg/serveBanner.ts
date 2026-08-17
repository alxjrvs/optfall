/**
 * The line `ssg/serve.ts` prints once it has bound.
 *
 * IT IS A MODULE RATHER THAN A `console.log` BECAUSE TWO FILES READ IT AND
 * NEITHER CAN NOTICE THE OTHER CHANGING. `scripts/check-dev-server.ts` waits
 * for this exact text before it will believe the server it is about to measure
 * is the one it started — that is the whole reason the check cannot be fooled
 * by a neighbouring worktree holding the port.
 *
 * WRITTEN OUT IN BOTH PLACES, THE DRIFT IS SILENT AND EXPENSIVE. Rewording the
 * banner, or spelling the host `127.0.0.1`, would not fail anything at build or
 * type-check time; it would make the check wait out its full seven-minute
 * startup timeout and then blame `bun run dev` for not serving — which is the
 * one thing that would not be wrong. The check cannot detect the difference
 * between a renamed banner and a dead server, so the two spellings are made
 * one instead.
 *
 * THE PORT IS AN ARGUMENT, not baked in, so the line names the port actually
 * bound. A server on some other port cannot satisfy a check waiting on this.
 */
export function serveReadyLine(port: number): string {
  return `[ssg] serving dist/ on http://localhost:${port}`;
}
