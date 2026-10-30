// Which MCP proxy requests are billed to the prepaid wallet (contract W2).
//
// A user pays per tool call — the work they ask an MCP to do — out of their
// wallet (lib/wallet): a billable request is refused with a 402 before it is
// forwarded when the wallet is empty, and charged (lib/wallet/call-meter.ts)
// once the MCP has answered it. Everything else on the wire is protocol
// overhead, relayed for free: `initialize`, `notifications/initialized`,
// `tools/list`, `ping`, the GET server→client stream, DELETE to close a
// session. An IDE sends a handful of those every time it (re)connects. One
// rule, shared by every branch of the proxy, the aggregated endpoint and the
// playground:
//
//   billable ⇔ HTTP POST whose JSON-RPC body calls `tools/call`
//
// A batch (JSON array) is billable when any element is a tools/call, and
// `units` counts its tools/call elements: the proxy refuses a batch carrying
// more than one (MCP 2025-06-18 removed JSON-RPC batching), so N calls can
// never ride on the price of one. Anything unparseable is not billable (the
// upstream rejects it anyway).
//
// Other requests that make the MCP do work (resources/read, prompts/get,
// completion/complete, …) are not charged as tool calls, but they still need
// credit (`needsCredit`): a zero-balance account gets the same 402 for them.
// Only the handshake and the list calls stay free of any check.
//
// Pure and client-safe: no imports, no I/O. Unit-tested in
// src/__tests__/billable.test.ts.

export const BILLABLE_RPC_METHOD = "tools/call";

/**
 * Protocol overhead relayed without any wallet check: the handshake, pings,
 * the list calls and notifications/* (matched by prefix). Every other request
 * method needs credit.
 */
export const FREE_RPC_METHODS: ReadonlySet<string> = new Set([
  "initialize",
  "ping",
  "tools/list",
  "resources/list",
  "resources/templates/list",
  "prompts/list",
  "logging/setLevel",
]);

/** Whether a request with this JSON-RPC method needs a positive wallet. Pure. */
export function methodNeedsCredit(method: string | null): boolean {
  if (!method) return false; // a response to a server request, or garbage
  if (method.startsWith("notifications/")) return false;
  return !FREE_RPC_METHODS.has(method);
}

export interface BillableVerdict {
  /**
   * A tool call: gated on the wallet (402 when empty) and the per-minute abuse
   * limiter, charged once answered, counted in usage_metrics.
   */
  billable: boolean;
  /**
   * The request needs a positive wallet (402 when empty) even when it is not
   * charged: every billable request, plus resources/read, prompts/get,
   * completion/complete and any method outside FREE_RPC_METHODS.
   */
  needsCredit: boolean;
  /**
   * How many `tools/call` messages the body carries: 0 when not billable, 1
   * for a single call, N for a batch. The proxy rejects units > 1.
   */
  units: number;
  /**
   * The JSON-RPC method the verdict was made on: the single request's method,
   * or for a batch the first `tools/call` (when billable) else the first
   * element's method. Null when the body is absent, unparseable or not a
   * request.
   */
  rpcMethod: string | null;
  /**
   * The JSON-RPC id to echo in a proxy-generated error (402, 429, wake-up 503):
   * a string or a number, else null (notifications carry none). For a batch,
   * the id of the element `rpcMethod` was taken from.
   */
  rpcId: unknown;
}

const NOT_BILLABLE: BillableVerdict = {
  billable: false,
  needsCredit: false,
  units: 0,
  rpcMethod: null,
  rpcId: null,
};

interface RpcLike {
  method: string | null;
  id: string | number | null;
}

/** Read `method` and `id` off one JSON-RPC message; non-objects yield nulls. */
function describe(message: unknown): RpcLike {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { method: null, id: null };
  }
  const m = message as { method?: unknown; id?: unknown };
  return {
    method: typeof m.method === "string" ? m.method : null,
    id: typeof m.id === "string" || typeof m.id === "number" ? m.id : null,
  };
}

/**
 * Decide whether a proxy request is billable, without I/O. `method` is the
 * HTTP method (any case); `bodyText` is the raw body the proxy already read
 * (null/undefined for bodiless GET/DELETE).
 */
export function isBillableRequest(
  method: string,
  bodyText: string | null | undefined
): BillableVerdict {
  if (method.toUpperCase() !== "POST") return NOT_BILLABLE;
  if (!bodyText || !bodyText.trim()) return NOT_BILLABLE;

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return NOT_BILLABLE;
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return NOT_BILLABLE;
    const calls = parsed.filter((m) => describe(m).method === BILLABLE_RPC_METHOD);
    const picked = describe(calls[0] ?? parsed[0]);
    return {
      billable: calls.length > 0,
      needsCredit: parsed.some((m) => methodNeedsCredit(describe(m).method)),
      units: calls.length,
      rpcMethod: picked.method,
      rpcId: picked.id,
    };
  }

  const single = describe(parsed);
  const billable = single.method === BILLABLE_RPC_METHOD;
  return {
    billable,
    needsCredit: billable || methodNeedsCredit(single.method),
    units: billable ? 1 : 0,
    rpcMethod: single.method,
    rpcId: single.id,
  };
}
