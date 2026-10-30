// Shared server-side relay of the MCP proxy. Used by the per-MCP endpoint
// (/api/mcp/<server>/<mcp>) and the aggregated server endpoint
// (/api/mcp/<server>, contract D3), so both wake paused boxes, retry, bill,
// rate-limit, answer errors and log tool calls in exactly the same way.
//
// Billing (contract W2): a billable tools/call (billable.ts) goes through
// billingGate() BEFORE anything is woken or forwarded (per-minute abuse
// limiter, then the wallet: 402 when empty), and is charged by
// toolCallMeter() once the MCP has answered it (lib/wallet/call-meter.ts).
// Proxy-side failures (waking, unreachable, outcome unknown) are not charged.
//
// Server-only (DB, Upstash Box, Sentry). The pure rules live next door:
// billable.ts (what is billed), retry.ts (when a request may be resent),
// aggregate.ts (naming, parsing, activity status), tool-policy.ts (D2).

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users } from "@/db/schema/core";
import { userServers, type HostType, type ServerStatus } from "@/db/schema/platform";
import type { AuthedContext } from "@/lib/auth";
import {
  CREDIT_ERROR_DATA,
  CREDIT_TOPUP_URL,
  PROXY_ERROR,
  proxyCreditExhausted,
  proxyError,
  proxyRateLimited,
} from "@/lib/errors";
import {
  RuntimeGoneError,
  claimReprovision,
  isInsufficientCreditError,
  resumeServer,
  type InsufficientCreditError,
} from "@/lib/provisioning";
import { isPausedRuntime } from "@/lib/server-lifecycle";
import { enqueue } from "@/lib/queue/qstash";
import { decryptConfig } from "@/lib/crypto/config-encryption";
import { MCP_STREAM_PATH } from "@/lib/upstash/mcp-bridge";
import { recordMcpUsage } from "@/lib/usage-metrics";
import { notifyCreditExhausted } from "@/lib/billing/quota-nudge";
import { chargeToolCall, checkCallBurst, walletAllowsCall } from "@/lib/wallet/call-meter";
import { trackServer } from "@/lib/analytics/server";
import { isAgentOnline, relayToAgent } from "@/lib/agent/registry";
import { cliCommand } from "@/lib/cli";
import { wwwAuthenticateHeader } from "@/lib/oauth";
import { recordToolCall } from "@/lib/activity/record";
import { toolDeniedMessage, type ToolPolicy } from "@/lib/mcp/tool-policy";
import type { BillableVerdict } from "@/lib/mcp/billable";
import { classifyFetchError, shouldRetry, type ForwardOutcome } from "@/lib/mcp/retry";
import {
  MAX_TOOLS_LIST_PAGES,
  TOOL_POLICY_DENIED_CODE,
  ToolCache,
  extractJsonRpcResponse,
  mergePagedToolLists,
  nextCursorOf,
  toolCallStatusFor,
  toolsFromResponse,
  toolsListRequest,
  type McpTool,
  type ToolNameIndex,
} from "@/lib/mcp/aggregate";

export type Method = "GET" | "POST" | "DELETE";

/** What every relay helper needs about the request being served. */
export interface RelayCtx {
  auth: AuthedContext;
  /** This request's x-twinmcp-request-id (contract K2). */
  requestId: string;
  /** Is this message a tool call (lib/mcp/billable.ts)? */
  verdict: BillableVerdict;
  /**
   * Usage metering for a billable request; a no-op otherwise. `ok` = the MCP
   * answered it (usage_metrics, and the wallet charge — see toolCallMeter).
   * Fire-and-forget (in-memory counters), never blocks the request.
   */
  meter: (ok: boolean) => void;
}

/**
 * The `meter` of a request (RelayCtx.meter): for a billable tools/call, count
 * it in usage_metrics (analytics, every outcome) and, when the MCP answered it
 * (`ok`: a JSON-RPC result or a tool error), charge it to the wallet — at most
 * once per request, whatever the call sites do. A no-op for overhead.
 */
export function toolCallMeter(
  userId: string,
  userServerId: string,
  billable: boolean
): (ok: boolean) => void {
  let charged = false;
  return (ok: boolean) => {
    if (!billable) return;
    recordMcpUsage(userServerId, ok);
    if (ok && !charged) {
      charged = true;
      chargeToolCall(userId);
    }
  };
}

/**
 * The billing gate of a billable tools/call, run before anything is woken or
 * forwarded. Returns the answer to send, or null to go on:
 *   1. the per-minute abuse limiter (429; in-process, so it works without Redis);
 *   2. the wallet (402, code -32008), which fails CLOSED on any error.
 * Overhead (initialize, tools/list…) is never gated. Other non-tool requests
 * that make the MCP work (resources/read, prompts/get…) are not charged but
 * need credit: an empty wallet gets the same 402.
 */
export async function billingGate(ctx: RelayCtx): Promise<NextResponse | null> {
  if (!ctx.verdict.billable) {
    if (ctx.verdict.needsCredit && !(await walletAllowsCall(ctx.auth.userId))) {
      return creditExhausted(ctx);
    }
    return null;
  }
  const burst = checkCallBurst(ctx.auth.userId);
  if (!burst.ok) {
    ctx.meter(false);
    trackRateLimited(ctx.auth);
    return proxyRateLimited(ctx.requestId, ctx.verdict.rpcId, true, {
      limit: burst.limit,
      remaining: burst.remaining,
      reset: burst.reset,
      window: "minute",
    });
  }
  if (!(await walletAllowsCall(ctx.auth.userId))) {
    ctx.meter(false);
    return creditExhausted(ctx);
  }
  return null;
}

/**
 * 402: the wallet is empty. The zero-balance email / webhook / event are
 * fire-and-forget (notifyCreditExhausted dedups per user per day and catches
 * everything), never able to change or slow the response.
 */
export function creditExhausted(
  ctx: Pick<RelayCtx, "auth" | "requestId" | "verdict">
): NextResponse {
  void notifyCreditExhausted(ctx.auth.userId, ctx.auth.plan);
  return proxyCreditExhausted(ctx.requestId, ctx.verdict.rpcId);
}

/**
 * 402 for a wake/resume refused by the wallet (resumeServer throws
 * InsufficientCreditError): same body as the tools/call gate when the wallet
 * is empty, the compute-cap wording when promotional credit hit its cap.
 */
export function computeRefused(
  ctx: Pick<RelayCtx, "auth" | "requestId" | "verdict" | "meter">,
  err: InsufficientCreditError
): NextResponse {
  ctx.meter(false);
  if (err.reason === "no_credit") return creditExhausted(ctx);
  return proxyError({
    status: 402,
    code: PROXY_ERROR.CREDIT_EXHAUSTED,
    message: err.message,
    requestId: ctx.requestId,
    rpcId: ctx.verdict.rpcId,
    data: CREDIT_ERROR_DATA,
    extra: { topupUrl: CREDIT_TOPUP_URL },
  });
}

/** A box-hosted MCP installation, as the proxy reads it from the DB. */
export interface BoxTarget {
  serverId: string;
  serverStatus: ServerStatus;
  hostType: HostType;
  boxId: string | null;
  userServerId: string;
  mcpEndpoint: string | null;
  tokenCiphertext: string;
  tokenIv: string;
  tokenTag: string;
  /**
   * Set by forwardToBox once it has woken the box or reloaded the endpoint, so
   * a second forward in the same request (the read_only policy prefetch, then
   * the call) reuses it instead of waking the box twice.
   */
  resolved?: { endpoint: string; token: string | null };
}

/** The HTTP side of one forward to the box bridge. */
export interface BoxForward {
  method: Method;
  bodyText: string | undefined;
  contentType?: string;
  /** accept + passthrough headers (mcp-session-id…). Never `authorization`. */
  headers: Record<string, string>;
}

export type BoxForwardResult =
  | { ok: true; response: Response }
  | { ok: false; response: NextResponse };

/**
 * Where this process serves its own API, for the twinmcp-docs internal call.
 * Fixed (env or loopback), never derived from request headers, so a spoofed
 * Host / X-Forwarded-Host cannot redirect the forwarded Authorization header.
 */
export function internalBaseUrl(): string {
  const configured = process.env.INTERNAL_BASE_URL?.trim().replace(/\/+$/, "");
  return configured || `http://127.0.0.1:${process.env.PORT ?? "3000"}`;
}

export function jsonRpcResult(id: unknown, result: unknown, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }, { headers });
}

/** 401 with WWW-Authenticate so MCP clients can bootstrap auth discovery. */
export function unauthorizedMcp(req: Request, requestId: string, rpcId: unknown): NextResponse {
  return proxyError({
    status: 401,
    code: PROXY_ERROR.UNAUTHORIZED,
    message: "Invalid credentials. Use 'Authorization: Bearer ctx7sk_...' or connect with OAuth.",
    requestId,
    rpcId,
    // Points OAuth-capable clients (claude.ai, ChatGPT…) at the protected-
    // resource metadata so they can start the flow (contract D4).
    headers: { "WWW-Authenticate": wwwAuthenticateHeader(req) },
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Box forwarding: wake → endpoint → forward → retry while it warms.
// ---------------------------------------------------------------------------

/**
 * Serve one request through a box-hosted MCP. A billable request must have
 * passed billingGate() already (the routes call it first, so a call the
 * wallet cannot pay never wakes a box). Then, in this order:
 *   1. a paused server (user Pause, contract K4) is woken in place;
 *   2. any other non-running server → 503;
 *   3. the endpoint + its bearer token are resolved (decrypted here only);
 *   4. forward, and on a connection error / gateway 5xx wake the box and resend
 *      while it warms — a tool call only when the box provably never got it
 *      (lib/mcp/retry.ts), so a side-effecting tool cannot run twice.
 * Returns the upstream Response (the caller meters it and relays/reads it), or
 * the proxy's own error answer (already metered).
 */
export async function forwardToBox(
  ctx: RelayCtx,
  target: BoxTarget,
  fwd: BoxForward
): Promise<BoxForwardResult> {
  const fail = (status: number, code: number, message: string, headers?: HeadersInit) =>
    proxyError({
      status,
      code,
      message,
      requestId: ctx.requestId,
      rpcId: ctx.verdict.rpcId,
      headers,
    });

  let woke = false;
  if (!target.resolved) {
    if (
      isPausedRuntime({
        status: target.serverStatus,
        hostType: target.hostType,
        boxId: target.boxId,
      })
    ) {
      const wake = await wakeServer(ctx, target.serverId);
      if (wake) return { ok: false, response: wake };
      woke = true;
      target.serverStatus = "running";
    } else if (target.serverStatus !== "running") {
      ctx.meter(false);
      return {
        ok: false,
        response: fail(
          503,
          PROXY_ERROR.UNAVAILABLE,
          `Server is ${target.serverStatus}; start it before sending MCP requests`
        ),
      };
    }
  }

  // After a wake the endpoint was re-exposed and its token may have rotated.
  let endpoint: string | null = target.resolved?.endpoint ?? target.mcpEndpoint;
  let boxToken: string | null = target.resolved?.token ?? null;
  if (!target.resolved) {
    if (woke) {
      const fresh = await reloadEndpoint(target.userServerId);
      endpoint = fresh?.endpoint ?? null;
      boxToken = fresh?.token ?? null;
    } else if (target.tokenCiphertext) {
      // The box public URL is bearer-protected; decrypt the token so it never
      // leaves the control plane.
      try {
        boxToken = decryptConfig<string>({
          ciphertext: target.tokenCiphertext,
          iv: target.tokenIv,
          tag: target.tokenTag,
        });
      } catch (err) {
        console.error("[mcp proxy] token decrypt failed:", err);
        Sentry.captureException(err, {
          tags: { area: "mcp-proxy", stage: "token-decrypt", requestId: ctx.requestId },
        });
        ctx.meter(false);
        return {
          ok: false,
          response: fail(502, PROXY_ERROR.INTERNAL, "MCP endpoint credentials unavailable"),
        };
      }
    }
  }
  if (!endpoint) {
    ctx.meter(false);
    return {
      ok: false,
      response: fail(
        503,
        PROXY_ERROR.UNAVAILABLE,
        "MCP endpoint not yet provisioned; restart the server"
      ),
    };
  }

  let attempt = await forwardOnce(endpoint, boxToken, fwd);
  let current = { endpoint, token: boxToken };

  // A connection error / gateway 5xx means the box is likely paused (non-keep-
  // alive boxes pause when idle) or, right after a wake, still warming. Wake it
  // (unless this request just did), refresh the endpoint + token (the
  // re-exposed URL is deterministic; the token may rotate), retry while it
  // warms.
  if (shouldRetry(ctx.verdict, attempt.outcome)) {
    if (!woke) {
      try {
        await resumeServer(target.serverId);
      } catch (err) {
        if (err instanceof RuntimeGoneError) {
          return { ok: false, response: await runtimeGone(ctx, target.serverId) };
        }
        if (isInsufficientCreditError(err)) {
          return { ok: false, response: computeRefused(ctx, err) };
        }
        console.error("[mcp proxy] resume failed:", err);
        Sentry.captureException(err, {
          tags: { area: "mcp-proxy", stage: "resume", requestId: ctx.requestId },
          extra: { serverId: target.serverId },
        });
      }
    }
    const fresh = await reloadEndpoint(target.userServerId);
    if (fresh) current = fresh;
    // The bridge is cold-restarting (npx/uvx warm-up) — retry for ~30s.
    for (let i = 0; fresh && i < 10 && shouldRetry(ctx.verdict, attempt.outcome); i++) {
      attempt = await forwardOnce(fresh.endpoint, fresh.token, fwd);
      if (shouldRetry(ctx.verdict, attempt.outcome)) await sleep(3000);
    }
  }
  target.resolved = current;

  // Still waking: the request never ran, the client retries in a few seconds,
  // so this is neither a charge nor an error worth a usage row.
  if (shouldRetry(ctx.verdict, attempt.outcome)) return { ok: false, response: wakingUp(ctx) };

  // A tool call whose fate is unknown (our timeout, a 504, a dropped socket):
  // say so instead of resending it, and let the client decide.
  if (ctx.verdict.billable && isUncertain(attempt.outcome)) {
    ctx.meter(false);
    return { ok: false, response: toolCallUncertain(ctx) };
  }
  // Overhead that failed for good (it was retried while the box woke up).
  if (!attempt.response) return { ok: false, response: wakingUp(ctx) };

  return { ok: true, response: attempt.response };
}

/**
 * Wake a paused server in place. Returns null once it is running again, or the
 * error response to send: the box is gone (a fresh one is being created), or
 * it could not be woken right now.
 */
export async function wakeServer(ctx: RelayCtx, serverId: string): Promise<NextResponse | null> {
  try {
    await resumeServer(serverId);
    return null;
  } catch (err) {
    if (err instanceof RuntimeGoneError) return runtimeGone(ctx, serverId);
    if (isInsufficientCreditError(err)) return computeRefused(ctx, err);
    console.error("[mcp proxy] waking a paused server failed:", err);
    Sentry.captureException(err, {
      tags: { area: "mcp-proxy", stage: "wake-paused", requestId: ctx.requestId },
      extra: { serverId },
    });
    ctx.meter(false);
    return proxyError({
      status: 503,
      code: PROXY_ERROR.UNAVAILABLE,
      message:
        "This server is paused and could not be woken right now. Retry in a few seconds, or press Resume in the dashboard.",
      requestId: ctx.requestId,
      rpcId: ctx.verdict.rpcId,
      headers: { "retry-after": "5" },
    });
  }
}

/**
 * Start waking a server without waiting for it (the aggregated tools/list
 * cannot hold a client for the ~30 s a cold box can take). Single-flight via
 * resumeServer; a lost runtime is reprovisioned. Never throws.
 */
export function kickWake(serverId: string, requestId: string): Promise<boolean> {
  return resumeServer(serverId).then(
    () => true,
    async (err: unknown) => {
      if (err instanceof RuntimeGoneError) {
        await reprovisionLostRuntime(serverId, requestId);
      } else if (isInsufficientCreditError(err)) {
        // Expected: the wallet refuses compute. Nothing to report.
      } else {
        console.error("[mcp proxy] background wake failed:", err);
        Sentry.captureException(err, {
          tags: { area: "mcp-proxy", stage: "wake-background", requestId },
          extra: { serverId },
        });
      }
      return false;
    }
  );
}

async function reprovisionLostRuntime(serverId: string, requestId: string): Promise<void> {
  try {
    if (await claimReprovision(serverId)) {
      await enqueue({ type: "provision-server", serverId });
    }
  } catch (err) {
    console.error("[mcp proxy] reprovision after a lost runtime failed:", err);
    Sentry.captureException(err, {
      tags: { area: "mcp-proxy", stage: "reprovision", requestId },
      extra: { serverId },
    });
  }
}

/**
 * The box no longer exists upstream. Claim the reprovision (only one of many
 * concurrent requests wins), enqueue it, and tell the client to come back.
 * The MCP list and configs are intact; files that lived in the old box are not.
 */
export async function runtimeGone(ctx: RelayCtx, serverId: string): Promise<NextResponse> {
  ctx.meter(false);
  await reprovisionLostRuntime(serverId, ctx.requestId);
  return proxyError({
    status: 503,
    code: PROXY_ERROR.UNAVAILABLE,
    message:
      "This server's runtime no longer existed, so a fresh one is provisioning from your saved configuration. Retry in about a minute.",
    requestId: ctx.requestId,
    rpcId: ctx.verdict.rpcId,
    headers: { "retry-after": "30" },
  });
}

/** The request may have reached the MCP but no usable answer came back. */
export function isUncertain(outcome: ForwardOutcome): boolean {
  if (outcome.kind === "response") return outcome.status === 504;
  return outcome.kind === "timeout" || outcome.kind === "network_error";
}

/** JSON-RPC 504 for a tool call that may or may not have run. Never resent by
 *  the proxy, so a side-effecting tool cannot execute twice. */
export function toolCallUncertain(ctx: Pick<RelayCtx, "requestId" | "verdict">): NextResponse {
  return proxyError({
    status: 504,
    code: PROXY_ERROR.OUTCOME_UNKNOWN,
    message:
      "The MCP server did not answer in time. The tool call may still have run; it was not retried automatically.",
    requestId: ctx.requestId,
    rpcId: ctx.verdict.rpcId,
  });
}

/** JSON-RPC-shaped 503 so MCP clients surface a clean, retryable error while a
 *  paused box finishes waking, instead of a bare text body. */
export function wakingUp(
  ctx: Pick<RelayCtx, "requestId" | "verdict">,
  message?: string
): NextResponse {
  return proxyError({
    status: 503,
    code: PROXY_ERROR.UNAVAILABLE,
    message: message ?? "MCP server is waking up from idle. Retry in a few seconds.",
    requestId: ctx.requestId,
    rpcId: ctx.verdict.rpcId,
    headers: { "retry-after": "3" },
  });
}

/**
 * One attempt at the in-box supergateway bridge. Returns the raw upstream
 * Response (null on a transport failure) and how it went, so the caller can
 * apply the retry policy (lib/mcp/retry.ts). A POST is capped at `timeoutMs`
 * (default 20 s) so a hung/paused box surfaces as a resume-and-retry; GET is
 * the long-lived server→client SSE stream and is never timed out.
 */
export async function forwardOnce(
  endpoint: string,
  boxToken: string | null,
  fwd: BoxForward,
  timeoutMs = 20_000
): Promise<{ response: Response | null; outcome: ForwardOutcome }> {
  const targetUrl = `${endpoint.replace(/\/$/, "")}${MCP_STREAM_PATH}`;
  const headers: Record<string, string> = { ...fwd.headers };
  if (boxToken) headers.authorization = `Bearer ${boxToken}`;

  const init: RequestInit = { method: fwd.method, headers };
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (fwd.method === "POST") {
    headers["content-type"] = fwd.contentType ?? "application/json";
    init.body = fwd.bodyText ?? "";
    const ac = new AbortController();
    timer = setTimeout(() => ac.abort(), timeoutMs);
    init.signal = ac.signal;
  }

  try {
    const response = await fetch(targetUrl, init);
    return { response, outcome: { kind: "response", status: response.status } };
  } catch (err) {
    console.error("[mcp proxy] upstream error:", err);
    return { response: null, outcome: classifyFetchError(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Reload the (possibly resume-refreshed) endpoint + decrypted token for an MCP. */
export async function reloadEndpoint(
  userServerId: string
): Promise<{ endpoint: string; token: string | null } | null> {
  const [r] = await getDb()
    .select({
      endpoint: userServers.endpointUrl,
      tc: userServers.endpointTokenCiphertext,
      iv: userServers.endpointTokenIv,
      tag: userServers.endpointTokenTag,
    })
    .from(userServers)
    .where(eq(userServers.id, userServerId))
    .limit(1);
  if (!r?.endpoint) return null;
  let token: string | null = null;
  if (r.tc) {
    try {
      token = decryptConfig<string>({ ciphertext: r.tc, iv: r.iv, tag: r.tag });
    } catch {
      return null;
    }
  }
  return { endpoint: r.endpoint, token };
}

/** Decrypt a stored endpoint token; null when there is none, undefined when it is unreadable. */
export function decryptEndpointToken(t: {
  tokenCiphertext: string;
  tokenIv: string;
  tokenTag: string;
}): string | null | undefined {
  if (!t.tokenCiphertext) return null;
  try {
    return decryptConfig<string>({ ciphertext: t.tokenCiphertext, iv: t.tokenIv, tag: t.tokenTag });
  } catch {
    return undefined;
  }
}

/** Build the streamed NextResponse from an upstream bridge Response. */
export function relayUpstream(upstream: Response, bodyOverride?: string): NextResponse {
  const out = new Headers();
  copyHeader(upstream.headers, out, "content-type", "application/json");
  copyHeader(upstream.headers, out, "mcp-session-id");
  copyHeader(upstream.headers, out, "mcp-protocol-version");
  if ((out.get("content-type") ?? "").includes("text/event-stream")) {
    out.set("cache-control", "no-cache, no-transform");
    out.set("connection", "keep-alive");
  }
  return new NextResponse(bodyOverride ?? upstream.body, { status: upstream.status, headers: out });
}

/** Copy a request header into an outgoing header map when present. */
export function passHeader(src: Headers, out: Record<string, string>, name: string): void {
  const v = src.get(name);
  if (v) out[name] = v;
}

function copyHeader(src: Headers, dst: Headers, name: string, fallback?: string) {
  const v = src.get(name) ?? fallback;
  if (v) dst.set(name, v);
}

// ---------------------------------------------------------------------------
// Local-agent relay. The MCP runs on the user's machine (via the TwinMCP CLI's
// `connect` command, lib/cli.ts);
// the JSON-RPC request goes over the agent's live link instead of to a box.
// Request/response only (no server→client SSE stream).
// ---------------------------------------------------------------------------

/**
 * Relay one POST body to the local agent. A billable request must have passed
 * billingGate() already; it is charged (ctx.meter(true)) only when the agent
 * answered it.
 */
export async function callLocalAgent(
  ctx: RelayCtx,
  key: string,
  mcpSlug: string,
  bodyText: string
): Promise<NextResponse> {
  if (!isAgentOnline(key)) {
    ctx.meter(false);
    return agentOffline(ctx);
  }

  try {
    const resp = await relayToAgent(key, mcpSlug, bodyText);
    ctx.meter(resp.ok);
    if (ctx.verdict.billable && resp.ok) noteFirstToolCall(ctx.auth.userId, mcpSlug);
    return new NextResponse(resp.body, {
      status: resp.ok ? 200 : 502,
      headers: { "content-type": resp.contentType ?? "application/json" },
    });
  } catch (err) {
    console.error("[mcp proxy] local-agent relay failed:", err);
    ctx.meter(false);
    return agentOffline(ctx);
  }
}

export const AGENT_OFFLINE_MESSAGE = `Local agent offline — run \`${cliCommand(
  "connect",
  "--server",
  "<server-slug>"
)}\` on the machine that hosts this tool.`;

/** JSON-RPC 503 shown when no local agent is currently connected for the server. */
export function agentOffline(ctx: Pick<RelayCtx, "requestId" | "verdict">): NextResponse {
  return proxyError({
    status: 503,
    code: PROXY_ERROR.UNAVAILABLE,
    message: AGENT_OFFLINE_MESSAGE,
    requestId: ctx.requestId,
    rpcId: ctx.verdict.rpcId,
    headers: { "retry-after": "3" },
  });
}

// ---------------------------------------------------------------------------
// Tool lists: the per-process cache and the non-billable tools/list fetches
// used by the aggregated fan-out and the read_only policy check.
// ---------------------------------------------------------------------------

/** Raw (pre-policy) tools/list per user_servers id. */
export const toolCache = new ToolCache();

/** How long a cached list may vouch for a tool's annotations (read_only policy). */
export const POLICY_TOOLS_MAX_AGE_MS = 10 * 60_000;
/** Router mode reuses a list this young instead of fanning out again. */
export const ROUTER_TOOLS_MAX_AGE_MS = 60_000;
/** A waking MCP keeps listing the tools it had this recently. */
export const STALE_TOOLS_MAX_AGE_MS = 24 * 60 * 60_000;

/** A verdict for protocol overhead the proxy sends itself (never billed). */
export function overheadVerdict(rpcId: unknown): BillableVerdict {
  return { billable: false, needsCredit: false, units: 0, rpcMethod: "tools/list", rpcId };
}

export type BoxToolsProbe =
  | { kind: "ok"; tools: McpTool[] }
  /** Connection refused / reset or a gateway 502/503: the box is asleep. */
  | { kind: "asleep" }
  /** Our timeout or a 504: the box is up but slow to list; never a reason to wake it. */
  | { kind: "slow" }
  | { kind: "error"; reason: string };

/**
 * tools/list straight to a box bridge, every page (up to MAX_TOOLS_LIST_PAGES)
 * within one `timeoutMs` budget, single attempt per page. Never wakes the box
 * itself: the caller decides (see kickWake), and only on "asleep" — a timeout
 * means a slow MCP (a cold npx/uvx tools/list), and resuming a running box
 * re-exposes its ports and rotates the tokens of in-flight calls.
 */
export async function probeBoxTools(
  endpoint: string,
  token: string | null,
  timeoutMs: number
): Promise<BoxToolsProbe> {
  const deadline = Date.now() + timeoutMs;
  const pages: McpTool[][] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_TOOLS_LIST_PAGES; page++) {
    const left = deadline - Date.now();
    if (left <= 0) return pages.length > 0 ? mergedPages(pages) : { kind: "slow" };
    const attempt = await forwardOnce(
      endpoint,
      token,
      {
        method: "POST",
        bodyText: toolsListRequest(`twinmcp-tools-list-${page}`, cursor),
        headers: { accept: "application/json, text/event-stream" },
      },
      left
    );
    const res = attempt.response;
    if (!res) {
      if (pages.length > 0) return mergedPages(pages);
      return attempt.outcome.kind === "timeout" ? { kind: "slow" } : { kind: "asleep" };
    }
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      void res.body?.cancel().catch(() => undefined);
      if (pages.length > 0) return mergedPages(pages);
      return res.status === 504 ? { kind: "slow" } : { kind: "asleep" };
    }
    const text = await res.text().catch(() => "");
    const message = extractJsonRpcResponse(text, res.headers.get("content-type"));
    const tools = toolsFromResponse(message);
    if (!tools) {
      if (pages.length > 0) return mergedPages(pages);
      return { kind: "error", reason: `tools/list failed (HTTP ${res.status})` };
    }
    pages.push(tools);
    cursor = nextCursorOf(message);
    if (!cursor) break;
  }
  return mergedPages(pages);
}

function mergedPages(pages: McpTool[][]): { kind: "ok"; tools: McpTool[] } {
  return { kind: "ok", tools: mergePagedToolLists(pages) };
}

/** tools/list to a local agent's MCP, every page within one `timeoutMs` budget. */
export async function probeAgentTools(
  key: string,
  mcpSlug: string,
  timeoutMs: number
): Promise<{ kind: "ok"; tools: McpTool[] } | { kind: "error"; reason: string }> {
  if (!isAgentOnline(key)) return { kind: "error", reason: AGENT_OFFLINE_MESSAGE };
  const deadline = Date.now() + timeoutMs;
  const pages: McpTool[][] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_TOOLS_LIST_PAGES; page++) {
    const left = deadline - Date.now();
    if (left <= 0) break;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const resp = await Promise.race([
        relayToAgent(key, mcpSlug, toolsListRequest(`twinmcp-tools-list-${page}`, cursor)),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), left);
        }),
      ]);
      if (!resp) {
        if (pages.length > 0) break;
        return { kind: "error", reason: "The local agent did not answer in time." };
      }
      const message = extractJsonRpcResponse(resp.body, resp.contentType);
      const tools = toolsFromResponse(message);
      if (!resp.ok || !tools) {
        if (pages.length > 0) break;
        return { kind: "error", reason: "tools/list failed on the local agent." };
      }
      pages.push(tools);
      cursor = nextCursorOf(message);
      if (!cursor) break;
    } catch {
      if (pages.length > 0) break;
      return { kind: "error", reason: AGENT_OFFLINE_MESSAGE };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (pages.length === 0)
    return { kind: "error", reason: "The local agent did not answer in time." };
  return mergedPages(pages);
}

/**
 * Every page of a box MCP's tools/list through forwardToBox (wake + retry
 * path, never billed), for the read_only policy check. The first page's
 * failure is the proxy's answer; a later page failing keeps what was read.
 */
export async function fetchAllBoxTools(
  ctx: RelayCtx,
  target: BoxTarget,
  headers: Record<string, string>
): Promise<{ ok: true; tools: McpTool[] | null } | { ok: false; response: NextResponse }> {
  const overhead: RelayCtx = {
    ...ctx,
    verdict: overheadVerdict(ctx.verdict.rpcId),
    meter: () => {},
  };
  const pages: McpTool[][] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_TOOLS_LIST_PAGES; page++) {
    const pre = await forwardToBox(overhead, target, {
      method: "POST",
      bodyText: toolsListRequest(`twinmcp-tools-list-${page}`, cursor),
      contentType: "application/json",
      headers: { ...headers, accept: "application/json, text/event-stream" },
    });
    if (!pre.ok) {
      if (pages.length > 0) break;
      return pre;
    }
    const text = await pre.response.text().catch(() => "");
    const message = extractJsonRpcResponse(text, pre.response.headers.get("content-type"));
    const tools = toolsFromResponse(message);
    if (!tools) break;
    pages.push(tools);
    cursor = nextCursorOf(message);
    if (!cursor) break;
  }
  return { ok: true, tools: pages.length > 0 ? mergePagedToolLists(pages) : null };
}

/**
 * Remember the raw tools of a buffered tools/list response (JSON or SSE) — a
 * complete, single-page list only: one page of a paginated list would make the
 * read_only policy deny the tools of the other pages.
 */
export function rememberToolsFromBody(
  cacheKey: string,
  bodyText: string,
  contentType: string | null,
  requestedCursor = false
): void {
  if (requestedCursor) return;
  const message = extractJsonRpcResponse(bodyText, contentType);
  if (nextCursorOf(message)) return;
  const tools = toolsFromResponse(message);
  if (tools) toolCache.set(cacheKey, tools);
}

/** Did this tools/list request ask for a later page (params.cursor)? */
export function requestsCursor(bodyText: string | undefined): boolean {
  if (!bodyText) return false;
  try {
    const parsed = JSON.parse(bodyText) as { params?: { cursor?: unknown } };
    return typeof parsed?.params?.cursor === "string" && parsed.params.cursor.length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The exposed-name index of the aggregated endpoint (names made client-safe or
// hashed by mergeToolListsIndexed), per server, so a tools/call finds the MCP's
// own tool name back. Per process, bounded.
// ---------------------------------------------------------------------------

const toolIndexes = new Map<string, { at: number; index: ToolNameIndex }>();
const MAX_TOOL_INDEXES = 2_000;

export function rememberToolIndex(serverId: string, index: ToolNameIndex): void {
  toolIndexes.delete(serverId);
  toolIndexes.set(serverId, { at: Date.now(), index });
  while (toolIndexes.size > MAX_TOOL_INDEXES) {
    const oldest = toolIndexes.keys().next().value;
    if (oldest === undefined) break;
    toolIndexes.delete(oldest);
  }
}

/** The server's last exposed-name index, when younger than `maxAgeMs`. */
export function toolIndexFor(serverId: string, maxAgeMs: number): ToolNameIndex | null {
  const hit = toolIndexes.get(serverId);
  if (!hit || Date.now() - hit.at > maxAgeMs) return null;
  return hit.index;
}

// ---------------------------------------------------------------------------
// Bounded body read (the aggregated endpoint buffers tool results).
// ---------------------------------------------------------------------------

/** Largest tool result the aggregated endpoint buffers. */
export const MAX_BUFFERED_RESULT_BYTES = 10 * 1024 * 1024;
/** Longest the aggregated endpoint waits for a tool result body. */
export const RESULT_BODY_DEADLINE_MS = 5 * 60_000;

/**
 * Read a response body as text with a byte cap and a deadline. The stream is
 * cancelled on either, so a huge result or a hung SSE stream cannot hold the
 * request (or its memory) forever.
 */
export async function readBodyCapped(
  res: Response,
  maxBytes: number = MAX_BUFFERED_RESULT_BYTES,
  deadlineMs: number = RESULT_BODY_DEADLINE_MS
): Promise<{ kind: "ok"; text: string } | { kind: "too_large" } | { kind: "timeout" }> {
  if (!res.body) return { kind: "ok", text: "" };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), deadlineMs);
  });
  try {
    for (;;) {
      const next = await Promise.race([reader.read(), timeout]);
      if (next === "timeout") {
        void reader.cancel().catch(() => undefined);
        return { kind: "timeout" };
      }
      if (next.done) break;
      size += next.value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return { kind: "too_large" };
      }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    return { kind: "ok", text };
  } catch {
    // A dropped stream: parse what arrived (the caller reports an unreadable answer).
    return { kind: "ok", text };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Tool policy (contract D2) and the activity log (contract D1).
// ---------------------------------------------------------------------------

/** The answer to a tools/call the tool policy refuses: a JSON-RPC error, HTTP 200. */
export function policyDenied(
  ctx: Pick<RelayCtx, "requestId" | "verdict">,
  toolName: string,
  policy: ToolPolicy | null
): NextResponse {
  return proxyError({
    status: 200,
    code: TOOL_POLICY_DENIED_CODE,
    message: toolDeniedMessage(toolName, policy),
    requestId: ctx.requestId,
    rpcId: ctx.verdict.rpcId,
  });
}

/** One tools/call to log once the proxy has answered it. */
export interface ToolCallTrack {
  userId: string;
  serverId: string;
  userServerId: string | null;
  mcpSlug: string;
  toolName: string | null;
  apiKeyId: string | null;
  externalUserId: string | null;
  startedAt: number;
  /** Set when the call was refused before forwarding (tool policy, key scope). */
  deniedCode?: number;
  /**
   * Set when the answer is a 2xx carrying a failure (TwinMCP Docs answers its
   * upstream errors as a 200 JSON-RPC error): the HTTP status of that failure.
   */
  failedCode?: number;
}

/** The key's end-customer id (api_keys.external_user_id, contract D6). */
function externalUserIdOf(auth: AuthedContext): string | null {
  return auth.apiKey?.externalUserId ?? null;
}

export function newToolCallTrack(
  auth: AuthedContext,
  at: {
    serverId: string;
    userServerId: string | null;
    mcpSlug: string;
    toolName: string | null;
    startedAt: number;
  }
): ToolCallTrack {
  return {
    userId: auth.userId,
    apiKeyId: auth.apiKey?.id ?? auth.apiKeyId ?? null,
    externalUserId: externalUserIdOf(auth),
    ...at,
  };
}

/** Log a tool call from the answer the proxy sent. Fire-and-forget, never throws. */
export function recordTrackedCall(track: ToolCallTrack, res: Response, requestId: string): void {
  try {
    let { status, errorCode } = toolCallStatusFor(res.status, track.deniedCode);
    if (status === "ok" && typeof track.failedCode === "number") {
      status = "error";
      errorCode = track.failedCode;
    }
    recordToolCall({
      userId: track.userId,
      serverId: track.serverId,
      userServerId: track.userServerId,
      mcpSlug: track.mcpSlug,
      toolName: track.toolName,
      status,
      errorCode,
      latencyMs: Date.now() - track.startedAt,
      requestId,
      apiKeyId: track.apiKeyId,
      externalUserId: track.externalUserId,
    });
  } catch (err) {
    console.error("[mcp proxy] activity record failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Activation telemetry. Both helpers are synchronous from the caller's point of
// view: they bump in-memory state and let a promise run in the background, so
// the request path gains no await. Per-process memory (prod is one container)
// keeps the cost at one DB query / one event per account rather than one per
// call — an LLM tool loop can send hundreds a minute.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

// `rate_limited` (the per-minute limiter): once per account per UTC day.
let rateLimitedDay = -1;
const rateLimitedToday = new Set<string>();

function trackRateLimited(auth: AuthedContext): void {
  const day = Math.floor(Date.now() / DAY_MS);
  if (day !== rateLimitedDay) {
    rateLimitedDay = day;
    rateLimitedToday.clear();
  }
  if (rateLimitedToday.has(auth.userId)) return;
  rateLimitedToday.add(auth.userId);
  trackServer({ event: "rate_limited", distinctId: auth.userId, properties: { plan: auth.plan } });
}

// Accounts whose first tool call is already stamped (or was found stamped).
const firstCallKnown = new Set<string>();

/**
 * Record an account's first successful tool call, once: stamp
 * users.metadata.firstToolCallAt if it is unset and, only when this call set
 * it, emit `first_tool_call`. The conditional UPDATE is the race guard —
 * two concurrent first calls produce one row and one event.
 */
export function noteFirstToolCall(userId: string, mcpSlug: string): void {
  if (firstCallKnown.has(userId)) return;
  firstCallKnown.add(userId);
  const stamp = JSON.stringify({ firstToolCallAt: new Date().toISOString() });
  getDb()
    .update(users)
    .set({ metadata: sql`${users.metadata} || ${stamp}::jsonb` })
    .where(and(eq(users.id, userId), sql`(${users.metadata}->>'firstToolCallAt') IS NULL`))
    .returning({ id: users.id })
    .then((rows) => {
      if (rows.length > 0) {
        trackServer({ event: "first_tool_call", distinctId: userId, properties: { mcpSlug } });
      }
    })
    .catch((err) => {
      // Transient failure: let a later call try again.
      firstCallKnown.delete(userId);
      console.warn("[mcp proxy] first-tool-call stamp failed:", err);
    });
}

// ---------------------------------------------------------------------------
// TwinMCP Docs — served by the control plane (no box), minimal MCP over
// JSON-RPC. One tool, `get-context`, wrapping GET /api/v2/context (which
// enforces its own rate limit). A get-context call is billed like any tool
// call: gated by billingGate() and charged on success (onToolCallOk).
// ---------------------------------------------------------------------------

export const TWINMCP_DOCS_TOOLS: McpTool[] = [
  {
    name: "get-context",
    description:
      "Retrieve documentation chunks for a library indexed by TwinMCP. Use to get up-to-date library docs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What you want to know" },
        libraryId: {
          type: "string",
          description: "TwinMCP library id, e.g. /facebook/react",
        },
      },
      required: ["query", "libraryId"],
    },
    annotations: { readOnlyHint: true },
  },
];

export interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

/**
 * Answer one JSON-RPC message for TwinMCP Docs. `tools` is the list to show
 * (the per-MCP route passes it through the tool policy). `onToolCallOk` fires
 * once a get-context call has succeeded (metering, activation);
 * `onToolCallFail` once it has failed, with the HTTP status of the failure
 * (the answer itself stays a 200 JSON-RPC error, as MCP expects).
 */
export async function handleTwinMcpDocs(
  req: Request,
  rpc: JsonRpcRequest,
  requestId: string,
  onToolCallOk?: () => void,
  tools: McpTool[] = TWINMCP_DOCS_TOOLS,
  onToolCallFail?: (code: number) => void
): Promise<NextResponse> {
  // A JSON-RPC error answered with HTTP 200, as MCP expects for tool errors.
  const rpcError = (code: number, message: string) =>
    proxyError({ status: 200, code, message, requestId, rpcId: rpc.id });
  switch (rpc.method) {
    case "initialize":
      return jsonRpcResult(rpc.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "twinmcp-docs", version: "1.0.0" },
      });

    case "tools/list":
      return jsonRpcResult(rpc.id, { tools });

    case "tools/call": {
      const params = (rpc.params ?? {}) as {
        name?: string;
        arguments?: { query?: string; libraryId?: string };
      };
      if (params.name !== "get-context") {
        onToolCallFail?.(404);
        return rpcError(PROXY_ERROR.METHOD_NOT_FOUND, `Unknown tool: ${params.name}`);
      }
      const args = params.arguments ?? {};
      if (!args.query || !args.libraryId) {
        onToolCallFail?.(400);
        return rpcError(
          PROXY_ERROR.INVALID_PARAMS,
          "Missing required argument: query or libraryId"
        );
      }

      // Fixed internal base, never the request's Host / X-Forwarded-Host: the
      // caller's Authorization header is forwarded to this URL.
      const internalUrl = `${internalBaseUrl()}/api/v2/context?query=${encodeURIComponent(
        args.query
      )}&libraryId=${encodeURIComponent(args.libraryId)}`;
      let inner: Response;
      let text: string;
      try {
        inner = await fetch(internalUrl, {
          headers: { authorization: req.headers.get("authorization") ?? "" },
        });
        text = await inner.text();
      } catch (err) {
        onToolCallFail?.(502);
        throw err;
      }
      if (!inner.ok) {
        onToolCallFail?.(inner.status);
        return rpcError(
          PROXY_ERROR.INTERNAL,
          `Upstream error: ${inner.status} ${text.slice(0, 200)}`
        );
      }
      onToolCallOk?.();
      return jsonRpcResult(rpc.id, {
        content: [{ type: "text", text }],
      });
    }

    default:
      // Notifications (no id, e.g. notifications/initialized) get no JSON-RPC
      // answer: Streamable HTTP acknowledges them with a bodiless 202.
      if (typeof rpc.method === "string" && rpc.method.startsWith("notifications/")) {
        return new NextResponse(null, { status: 202 });
      }
      return rpcError(PROXY_ERROR.METHOD_NOT_FOUND, `Method not found: ${rpc.method}`);
  }
}
