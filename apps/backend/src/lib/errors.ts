import { NextResponse } from "next/server";
import type { Plan } from "@/db/schema/core";

export function jsonError(
  status: number,
  message: string,
  extra: object = {},
  headers?: HeadersInit
) {
  return NextResponse.json({ message, ...extra }, { status, headers });
}

export const unauthorized = (
  msg = "Invalid API key. Please check your API key. API keys should start with 'ctx7sk' prefix."
) => jsonError(401, msg);

const DASHBOARD_URL = "https://twinmcp.fr/dashboard";
const SUPPORT_EMAIL = "hello@twinmcp.fr";

/**
 * Where a user tops up the prepaid wallet. Since 2026-10-29 there are no
 * subscriptions and no daily tool-call quotas: the wallet is the limit
 * (lib/wallet), and a tool call refused for an empty wallet points here.
 */
export const CREDIT_TOPUP_URL = "https://twinmcp.fr/dashboard/billing";
/** The docs section on credit, prices and the 402 (anchor added by the docs page). */
export const CREDIT_DOCS_URL = "https://twinmcp.fr/docs#credit";
/** The exact text of the credit refusal (contract W2). */
export const CREDIT_EXHAUSTED_MESSAGE = `Your TwinMCP credit is used up. Top up at ${CREDIT_TOPUP_URL}`;

/**
 * Details of the window that rejected the request, straight from the limiter.
 * With them the 429 names the limit and the reset time, and carries the
 * standard Retry-After / X-RateLimit-* headers so MCP clients can back off.
 *
 * Rate limits are abuse guards only (the MCP proxy's per-minute tool-call
 * limiter, the REST endpoints' own windows); spending is bounded by the
 * wallet, so a 429 never upsells a plan.
 */
export interface RateLimitInfo {
  plan?: Plan;
  /** Requests allowed per window. */
  limit?: number;
  /** Requests left in the window (0 once rejected). */
  remaining?: number;
  /** Epoch ms when the window resets. */
  reset?: number;
  /**
   * The window the limit applies to: "minute" (the proxy's tool-call abuse
   * limiter) or "day" (the default: the REST endpoints' UTC-day windows).
   */
  window?: "minute" | "day";
  /** What is counted; defaults to tool calls (minute, API key) or requests. */
  unit?: "tool calls" | "requests";
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

/** "2026-10-25T00:00Z" (day) or "2026-10-25T10:31:07Z" (minute): compact, unambiguous. */
function fmtReset(d: Date, window: "minute" | "day"): string {
  return `${d.toISOString().slice(0, window === "minute" ? 19 : 16)}Z`;
}

function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function genericRateLimitMessage(apiKey: boolean): string {
  return apiKey
    ? `Rate limited. Slow down and retry in a moment; contact ${SUPPORT_EMAIL} if you need a higher limit.`
    : `Rate limited. Create a free API key at ${DASHBOARD_URL} for higher limits.`;
}

/**
 * The 429 body text. Exported so the proxy's JSON-RPC error and the dashboard
 * can show the very same sentence the API returns. No plan upsell: the wallet,
 * not the plan, bounds usage.
 */
export function rateLimitMessage(
  apiKey: boolean,
  info: RateLimitInfo & { limit: number },
  resetAt: Date
): string {
  const window = info.window ?? "day";
  const unit = info.unit ?? (apiKey && window === "minute" ? "tool calls" : "requests");
  const head = `Rate limit reached: ${fmtInt(info.limit)} ${unit} per ${window}. Resets at ${fmtReset(resetAt, window)}.`;
  if (!apiKey) return `${head} Create a free API key at ${DASHBOARD_URL} for higher limits.`;
  if (window === "minute") return `${head} Slow down and retry.`;
  return `${head} Contact ${SUPPORT_EMAIL} if you need more.`;
}

/**
 * 429. Without `info` (or without a known limit) a generic message is
 * returned, for callers that only know "over".
 */
export function rateLimited(apiKey: boolean, info?: RateLimitInfo) {
  const parts = rateLimitParts(apiKey, info);
  return jsonError(429, parts.message, parts.extra, parts.headers);
}

/**
 * The pieces of a 429 (body text, extra body fields, headers), shared by
 * rateLimited() and the MCP proxy's JSON-RPC flavoured proxyRateLimited() so
 * both say exactly the same thing.
 */
function rateLimitParts(
  apiKey: boolean,
  info?: RateLimitInfo
): { message: string; extra: Record<string, unknown>; headers?: Record<string, string> } {
  if (!info || typeof info.limit !== "number") {
    return { message: genericRateLimitMessage(apiKey), extra: {} };
  }
  const window = info.window ?? "day";
  const now = Date.now();
  // A missing/past reset (fail-open paths, clock skew) falls back to the end
  // of the window: a minute from now, or the next UTC midnight.
  const resetAt =
    typeof info.reset === "number" && info.reset > now
      ? new Date(info.reset)
      : window === "minute"
        ? new Date(now + 60_000)
        : nextUtcMidnight(new Date(now));
  const retryAfterSec = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
  const remaining = Math.max(0, Math.floor(info.remaining ?? 0));

  const headers: Record<string, string> = {
    "Retry-After": String(retryAfterSec),
    "X-RateLimit-Limit": String(info.limit),
    "X-RateLimit-Remaining": String(remaining),
    // Epoch seconds (GitHub convention), to pair with Retry-After in seconds.
    "X-RateLimit-Reset": String(Math.ceil(resetAt.getTime() / 1000)),
  };

  const extra: Record<string, unknown> = {
    limit: info.limit,
    remaining,
    resetsAt: resetAt.toISOString(),
    window,
  };
  if (info.plan) extra.plan = info.plan;

  return {
    message: rateLimitMessage(apiKey, { ...info, limit: info.limit }, resetAt),
    extra,
    headers,
  };
}

// ---------------------------------------------------------------------------
// MCP proxy errors (/api/mcp/:serverSlug/:mcpSlug).
//
// Every proxy response carries `x-twinmcp-request-id` so a user can quote it to
// support and we can find the request in the logs / Sentry. Errors the proxy
// itself produces are JSON-RPC shaped with
// `error.data = { requestId, docsUrl }`. Non-2xx bodies also keep the
// historical top-level `message` (plus the window fields of a 429, the
// `topupUrl` of a 402) for plain
// JSON callers; a 200 JSON-RPC error stays strictly JSON-RPC so MCP SDKs that
// validate the envelope accept it.
// ---------------------------------------------------------------------------

export const PROXY_REQUEST_ID_HEADER = "x-twinmcp-request-id";
export const PROXY_DOCS_URL = "https://twinmcp.fr/docs#troubleshooting";

/** JSON-RPC error codes used by the proxy (server range -32000..-32099 + spec codes). */
export const PROXY_ERROR = {
  /** Upstream or internal failure (502/500). */
  INTERNAL: -32000,
  /** Not reachable right now: waking, provisioning, agent offline (503). */
  UNAVAILABLE: -32001,
  /** A tool call whose outcome is unknown; never resent (504). */
  OUTCOME_UNKNOWN: -32002,
  /** The API key is restricted to another server (403). */
  KEY_RESTRICTED: -32003,
  /** Missing or invalid API key (401). */
  UNAUTHORIZED: -32004,
  /** Unknown server or MCP (404). */
  NOT_FOUND: -32005,
  /** The MCP exists but is disabled (409). */
  CONFLICT: -32006,
  /** A tools/call refused by the MCP's tool access policy (HTTP 200). */
  TOOL_POLICY_DENIED: -32007,
  /** The prepaid wallet is empty: a tools/call refused before forwarding (402). */
  CREDIT_EXHAUSTED: -32008,
  /** Too many tool calls per minute (429, abuse limiter). */
  RATE_LIMITED: -32029,
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
} as const;

/** A fresh id for one proxied request. */
export function newProxyRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/** JSON-RPC ids are a string, a number or null; anything else becomes null. */
function rpcIdOrNull(id: unknown): string | number | null {
  return typeof id === "string" || typeof id === "number" ? id : null;
}

export interface ProxyErrorData {
  requestId: string;
  docsUrl: string;
  /** The 402 credit refusal only: where to top up. */
  topupUrl?: string;
}

/**
 * The JSON-RPC error envelope the proxy returns, with its support data.
 * `data` overrides / extends the default `{ requestId, docsUrl }` (the 402
 * points docsUrl at the credit section and adds topupUrl).
 */
export function jsonRpcErrorBody(
  id: unknown,
  code: number,
  message: string,
  requestId: string,
  data?: Partial<Omit<ProxyErrorData, "requestId">>
): {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data: ProxyErrorData };
} {
  return {
    jsonrpc: "2.0",
    id: rpcIdOrNull(id),
    error: { code, message, data: { requestId, docsUrl: PROXY_DOCS_URL, ...data } },
  };
}

/** Stamp the request id on any proxy response (relayed streams included). */
export function withProxyRequestId<T extends Response>(res: T, requestId: string): T {
  res.headers.set(PROXY_REQUEST_ID_HEADER, requestId);
  return res;
}

/** A JSON-RPC error produced by the proxy, request id in body and header. */
export function proxyError(opts: {
  status: number;
  code: number;
  message: string;
  requestId: string;
  rpcId?: unknown;
  headers?: HeadersInit;
  /** Extra top-level fields, non-2xx only (e.g. the 429 window fields). */
  extra?: Record<string, unknown>;
  /** Extra `error.data` fields (see jsonRpcErrorBody). */
  data?: Partial<Omit<ProxyErrorData, "requestId">>;
}): NextResponse {
  const headers = new Headers(opts.headers);
  headers.set(PROXY_REQUEST_ID_HEADER, opts.requestId);
  const envelope = jsonRpcErrorBody(opts.rpcId, opts.code, opts.message, opts.requestId, opts.data);
  const body =
    opts.status >= 400 ? { ...opts.extra, ...envelope, message: opts.message } : envelope;
  return NextResponse.json(body, { status: opts.status, headers });
}

/** The 429 of the proxy: same text, headers and window fields as rateLimited(). */
export function proxyRateLimited(
  requestId: string,
  rpcId: unknown,
  apiKey: boolean,
  info?: RateLimitInfo
): NextResponse {
  const parts = rateLimitParts(apiKey, info);
  return proxyError({
    status: 429,
    code: PROXY_ERROR.RATE_LIMITED,
    message: parts.message,
    requestId,
    rpcId,
    headers: parts.headers,
    extra: parts.extra,
  });
}

/** The `error.data` of the credit refusal (contract W2), requestId aside. */
export const CREDIT_ERROR_DATA = {
  docsUrl: CREDIT_DOCS_URL,
  topupUrl: CREDIT_TOPUP_URL,
} as const;

/**
 * 402: a billable tools/call refused before forwarding because the wallet is
 * empty (contract W2). JSON-RPC code -32008, `error.data = { requestId,
 * docsUrl, topupUrl }`, plus the top-level `message` / `topupUrl` for plain
 * JSON callers. Nothing ran and nothing was charged.
 */
export function proxyCreditExhausted(requestId: string, rpcId: unknown): NextResponse {
  return proxyError({
    status: 402,
    code: PROXY_ERROR.CREDIT_EXHAUSTED,
    message: CREDIT_EXHAUSTED_MESSAGE,
    requestId,
    rpcId,
    data: CREDIT_ERROR_DATA,
    extra: { topupUrl: CREDIT_TOPUP_URL },
  });
}

/**
 * 402 for the REST routes that create, start or wake compute (servers create /
 * start / restart, admin provisioning): `{ message, code, topupUrl }`.
 */
export function creditRequired(message: string = CREDIT_EXHAUSTED_MESSAGE): NextResponse {
  return jsonError(402, message, { code: "credit_exhausted", topupUrl: CREDIT_TOPUP_URL });
}

export const badRequest = (msg: string) => jsonError(400, msg);
export const forbidden = (msg = "Forbidden") => jsonError(403, msg);
export const notFound = (msg = "Not found") => jsonError(404, msg);
export const serverError = (msg = "Internal server error") => jsonError(500, msg);
