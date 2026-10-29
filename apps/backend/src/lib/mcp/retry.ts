// When may the MCP proxy resend a request to the box after a failure?
//
// The proxy wakes a paused box and resends the request while it warms up. That
// is harmless for protocol overhead (initialize, tools/list, the GET stream),
// but a `tools/call` can have side effects (write a file, send a message, make
// a payment). Resending one that may already have reached the MCP would run it
// twice. So for a billable request (lib/mcp/billable.ts) the proxy only resends
// when the box provably never received it:
//
//   - the TCP/DNS connection failed before the request was sent
//     (ECONNREFUSED, ENOTFOUND, EAI_AGAIN, EHOSTUNREACH, connect timeout…);
//   - the box gateway answered 502 or 503, which is how a paused box (or a
//     bridge that is still installing) refuses a request it did not run.
//
// Never after our own timeout (the tool may still be running), a 504 (the
// gateway gave up waiting, the tool may have finished), or a socket error once
// the request was on the wire. The client then gets a JSON-RPC error and
// decides itself.
//
// Pure: no imports, no I/O. Unit-tested in src/__tests__/mcp-retry.test.ts.

export type ForwardOutcome =
  | { kind: "response"; status: number }
  /** Our own abort timer fired: the request was sent, the answer never came. */
  | { kind: "timeout" }
  /** The connection could not be opened: the request never left. */
  | { kind: "connect_error" }
  /** Any other transport failure (reset, socket closed): it may have been sent. */
  | { kind: "network_error" };

/** Error codes that mean the request never reached the upstream. */
const CONNECT_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
]);

function errorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === "string") return e.code;
  if (e.cause && typeof e.cause === "object") {
    const c = e.cause as { code?: unknown; errors?: unknown };
    if (typeof c.code === "string") return c.code;
    // Happy-eyeballs: an AggregateError of per-address connect failures.
    if (Array.isArray(c.errors)) {
      for (const inner of c.errors) {
        const code = errorCode(inner);
        if (code) return code;
      }
    }
  }
  return null;
}

/** Classify a thrown fetch() error into a ForwardOutcome kind. */
export function classifyFetchError(err: unknown): Exclude<ForwardOutcome, { kind: "response" }> {
  const name = err && typeof err === "object" ? (err as { name?: unknown }).name : undefined;
  if (name === "AbortError" || name === "TimeoutError") return { kind: "timeout" };
  const code = errorCode(err);
  if (code && CONNECT_ERROR_CODES.has(code)) return { kind: "connect_error" };
  return { kind: "network_error" };
}

/** Did the attempt fail in a way that suggests a paused box (any request)? */
export function looksAsleep(outcome: ForwardOutcome): boolean {
  if (outcome.kind !== "response") return true;
  return outcome.status === 502 || outcome.status === 503 || outcome.status === 504;
}

/**
 * May the proxy wake the box and resend this request? Overhead: whenever the
 * box looks asleep. A tool call: only when the box provably never ran it.
 */
export function shouldRetry(verdict: { billable: boolean }, outcome: ForwardOutcome): boolean {
  if (!verdict.billable) return looksAsleep(outcome);
  if (outcome.kind === "response") return outcome.status === 502 || outcome.status === 503;
  return outcome.kind === "connect_error";
}
