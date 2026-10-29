// Which MCP proxy requests count against the daily quota.
//
// The Free quota (50/day, lib/rate-limit.ts) is meant to cover tool calls —
// the work a user asks an MCP to do. Everything else on the wire is protocol
// overhead: `initialize`, `notifications/initialized`, `tools/list`, `ping`,
// the GET server→client stream, DELETE to close a session. An IDE sends a
// handful of those every time it (re)connects, so counting them burned a
// third of a Free day before the first real call. One rule, shared by the
// box and local-agent branches of the proxy:
//
//   billable ⇔ HTTP POST whose JSON-RPC body calls `tools/call`
//
// A batch (JSON array) is billable when any element is a tools/call, and
// `units` counts its tools/call elements: the proxy refuses a batch carrying
// more than one (MCP 2025-06-18 removed JSON-RPC batching), so N calls can
// never ride on the price of one. Anything unparseable is not billable (the
// upstream rejects it anyway).
//
// Pure and client-safe: no imports, no I/O. Unit-tested in
// src/__tests__/billable.test.ts.

export const BILLABLE_RPC_METHOD = "tools/call";

export interface BillableVerdict {
  /** Count this request against the quota and in usage_metrics. */
  billable: boolean;
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
   * The JSON-RPC id to echo in a proxy-generated error (429, wake-up 503):
   * a string or a number, else null (notifications carry none). For a batch,
   * the id of the element `rpcMethod` was taken from.
   */
  rpcId: unknown;
}

const NOT_BILLABLE: BillableVerdict = {
  billable: false,
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
      units: calls.length,
      rpcMethod: picked.method,
      rpcId: picked.id,
    };
  }

  const single = describe(parsed);
  const billable = single.method === BILLABLE_RPC_METHOD;
  return {
    billable,
    units: billable ? 1 : 0,
    rpcMethod: single.method,
    rpcId: single.id,
  };
}
