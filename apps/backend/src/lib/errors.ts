import { NextResponse } from "next/server";
import type { Plan } from "@/db/schema/core";
import { PLAN_LABELS } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";
import { nextUtcMidnight } from "@/lib/billing/upgrade-state";

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

const BILLING_URL = "https://twinmcp.fr/dashboard/billing";
const DASHBOARD_URL = "https://twinmcp.fr/dashboard";
const SUPPORT_EMAIL = "hello@twinmcp.fr";

/**
 * Details of the window that rejected the request, straight from
 * checkRateLimit(). With them the 429 names the plan, the quota and the reset
 * time, and carries the standard Retry-After / X-RateLimit-* headers so MCP
 * clients and the dashboard can back off (and upsell) precisely.
 */
export interface RateLimitInfo {
  plan?: Plan;
  /** Requests allowed per window (the daily quota). */
  limit?: number;
  /** Requests left in the window (0 once rejected). */
  remaining?: number;
  /** Epoch ms when the window resets (Upstash `reset`). */
  reset?: number;
  /**
   * Whether a Pro checkout would start with the free month. Only a FIRST
   * subscription gets it, so the promise is made only when a caller that knows
   * the account has no Stripe customer passes true; absent or false, the 429
   * names the Pro quota without it.
   */
  trialEligible?: boolean;
}

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

/** "2026-10-25T00:00Z" — compact, unambiguous, sortable. */
function fmtReset(d: Date): string {
  return `${d.toISOString().slice(0, 16)}Z`;
}

function genericRateLimitMessage(apiKey: boolean): string {
  return apiKey
    ? `Rate limited or quota exceeded. Upgrade your plan at ${BILLING_URL} for higher limits.`
    : `Rate limited or quota exceeded. Create a free API key at ${DASHBOARD_URL} for higher limits.`;
}

/**
 * The 429 body text. Exported so the proxy's JSON-RPC error and the dashboard
 * can show the very same sentence the API returns.
 */
export function rateLimitMessage(
  apiKey: boolean,
  info: RateLimitInfo & { limit: number },
  resetAt: Date
): string {
  const resets = `Resets at ${fmtReset(resetAt)}.`;
  if (!apiKey) {
    return `Daily limit reached: ${fmtInt(info.limit)} requests per day. ${resets} Create a free API key at ${DASHBOARD_URL} for higher limits.`;
  }
  if (!info.plan) {
    return `Daily limit reached: ${fmtInt(info.limit)} requests per day. ${resets} Upgrade your plan at ${BILLING_URL} for higher limits.`;
  }
  const head = `Daily limit reached: ${fmtInt(info.limit)} tool calls per day on the ${PLAN_LABELS[info.plan]} plan. ${resets}`;
  if (info.plan === "free") {
    const proLimit = fmtInt(getDailyLimit("pro"));
    return info.trialEligible === true
      ? `${head} Pro raises it to ${proLimit} per day and your first month is free: ${BILLING_URL}`
      : `${head} Pro raises it to ${proLimit} per day: ${BILLING_URL}`;
  }
  return `${head} Contact ${SUPPORT_EMAIL} if you need more.`;
}

/**
 * 429. Without `info` (or without a known limit) the historical generic
 * message is returned, unchanged, for callers that only know "over".
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
  const now = Date.now();
  // Upstash gives the window end; the daily window is UTC-day aligned, so a
  // missing/past reset (fail-open paths, clock skew) falls back to midnight UTC.
  const resetAt =
    typeof info.reset === "number" && info.reset > now
      ? new Date(info.reset)
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
  };
  if (info.plan) extra.plan = info.plan;
  if (apiKey && (info.plan === "free" || !info.plan)) extra.upgradeUrl = BILLING_URL;

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
// historical top-level `message` (and, for a 429, the quota fields) for plain
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
  /** Daily quota exhausted (429). */
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
}

/** The JSON-RPC error envelope the proxy returns, with its support data. */
export function jsonRpcErrorBody(
  id: unknown,
  code: number,
  message: string,
  requestId: string
): {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data: ProxyErrorData };
} {
  return {
    jsonrpc: "2.0",
    id: rpcIdOrNull(id),
    error: { code, message, data: { requestId, docsUrl: PROXY_DOCS_URL } },
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
  /** Extra top-level fields, non-2xx only (e.g. the 429 quota fields). */
  extra?: Record<string, unknown>;
}): NextResponse {
  const headers = new Headers(opts.headers);
  headers.set(PROXY_REQUEST_ID_HEADER, opts.requestId);
  const envelope = jsonRpcErrorBody(opts.rpcId, opts.code, opts.message, opts.requestId);
  const body =
    opts.status >= 400 ? { ...opts.extra, ...envelope, message: opts.message } : envelope;
  return NextResponse.json(body, { status: opts.status, headers });
}

/** The 429 of the proxy: same text, headers and quota fields as rateLimited(). */
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

export const badRequest = (msg: string) => jsonError(400, msg);
export const forbidden = (msg = "Forbidden") => jsonError(403, msg);
export const notFound = (msg = "Not found") => jsonError(404, msg);
export const serverError = (msg = "Internal server error") => jsonError(500, msg);
