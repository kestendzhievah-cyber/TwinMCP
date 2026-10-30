// Tool playground relay: POST /api/v2/servers/[id]/try
//
// The dashboard playground runs `tools/list` / `tools/call` against one MCP of
// the caller's own server without the browser ever holding an API key. The
// session (or a full-scope key) authenticates; the server must belong to the
// caller. The request then goes through the same gates as the public MCP
// proxy (/api/mcp/[serverSlug]/[mcpSlug]):
//
//   - only `tools/call` is billable (lib/mcp/billable.ts): before anything is
//     woken it goes through the billing gate (per-minute abuse limiter → 429,
//     then the prepaid wallet → 402 when empty, failing closed), it is charged
//     to the wallet once the MCP answered it (lib/wallet/call-meter.ts),
//     metered in usage_metrics and logged in the activity log
//     (recordToolCall), exactly like a call from an IDE. tools/list is free.
//   - a tools/call is sent once and never replayed (lib/mcp/retry.ts): a 502 /
//     503 / refused connection means it never ran (503 "waking", the UI
//     retries); a timeout or a 504 means its fate is unknown (504, no retry).
//   - the installation's tool policy (lib/mcp/tool-policy.ts) filters
//     tools/list and refuses a blocked tools/call before it is sent.
//   - a paused box is woken; a box that no longer exists is reprovisioned.
//
// Unlike an IDE, the relay opens its own MCP session (initialize →
// notifications/initialized → the request) and closes it afterwards, so one
// playground request is self-contained.
//
// Answer: TryResponse (app/dashboard/servers/[id]/try/protocol.ts), with the
// HTTP status telling the UI what to do: 503 = retry shortly (waking), 402 =
// credit used up (top up), 429 = too many calls this minute, 403 = policy,
// 504 = outcome unknown.

import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users } from "@/db/schema/core";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { requireManagementUser, type SessionUser } from "@/lib/session";
import { SERVER_SCOPE_MESSAGE, keyAllowsServer } from "@/lib/auth/key-scope";
import {
  CREDIT_ERROR_DATA,
  CREDIT_EXHAUSTED_MESSAGE,
  PROXY_ERROR,
  PROXY_REQUEST_ID_HEADER,
  jsonRpcErrorBody,
  newProxyRequestId,
  rateLimitMessage,
  type ProxyErrorData,
} from "@/lib/errors";
import {
  TWINMCP_DOCS_SLUG,
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
import { notifyCreditExhausted } from "@/lib/billing/quota-nudge";
import { checkCallBurst, walletAllowsCall } from "@/lib/wallet/call-meter";
import { classifyFetchError, looksAsleep, shouldRetry, type ForwardOutcome } from "@/lib/mcp/retry";
import {
  filterToolsList,
  isToolCallAllowed,
  isUnrestricted,
  parseToolPolicy,
  policyNeedsToolAnnotations,
  toolDeniedMessage,
  type PolicyTool,
  type ToolPolicy,
} from "@/lib/mcp/tool-policy";
import {
  MAX_TOOLS_LIST_PAGES,
  TOOL_POLICY_DENIED_CODE,
  mergeToolsListPages,
  nextCursorOf,
  toolCallStatusFor,
  type McpTool,
} from "@/lib/mcp/aggregate";
import {
  POLICY_TOOLS_MAX_AGE_MS,
  noteFirstToolCall,
  toolCache,
  toolCallMeter,
} from "@/lib/mcp/relay";
import { recordToolCall } from "@/lib/activity/record";
import { connKey, isAgentOnline, relayToAgent } from "@/lib/agent/registry";
import {
  extractTools,
  isToolResultError,
  parseJsonRpcPayload,
  parseTryBody,
  type JsonRpcMessage,
  type TryRequestBody,
  type TryResponse,
  type TryStatus,
} from "@/app/dashboard/servers/[id]/try/protocol";
import { localAgentCommand } from "@/lib/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same per-request cap as the public proxy's forwardOnce. */
const RPC_TIMEOUT_MS = 20_000;
/** A result larger than this is not shipped to the browser. */
const MAX_RESULT_BYTES = 2 * 1024 * 1024;
/** After waking a box: initialize attempts while the bridge warms up. */
const WARMUP_ATTEMPTS = 4;
const WARMUP_DELAY_MS = 3000;
/**
 * A tools/call the bridge provably never received (connection refused, 502,
 * 503) is resent in place a few times, as the proxy does, so a bridge that is
 * still warming does not send the user through the UI's retry.
 */
const CALL_RETRY_ATTEMPTS = 3;
/** The tools/call verdict, for lib/mcp/retry.ts shouldRetry. */
const BILLABLE = { billable: true } as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RouteCtx = { params: Promise<{ id: string }> };

/** Everything a step needs once the request is authenticated and resolved. */
interface TryCtx {
  requestId: string;
  started: number;
  body: TryRequestBody;
  userId: string;
  apiKeyId: string | null;
  plan: "free" | "pro" | "team";
  serverId: string;
  serverSlug: string;
  userServerId: string;
  policy: ToolPolicy | null;
  /** Served by the user's machine over the CLI's `connect`, not a box. */
  isLocalAgent: boolean;
  /** JSON-RPC id of the user's request (unique: the agent relay keys on it). */
  rpcId: string;
  /** Set when the tool policy refused the call (activity status "denied"). */
  deniedCode?: number;
  /** usage_metrics + the wallet charge of a tools/call (relay.ts toolCallMeter). */
  charge: (ok: boolean) => void;
}

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Body must be JSON." }, { status: 400 });
  }
  const parsed = parseTryBody(rawBody);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });
  const body = parsed.body;

  const requestId = newProxyRequestId();
  const stamp: Stamp = { requestId, started: Date.now(), rpcId: `try-${requestId}` };
  const holder: { ctx?: TryCtx } = {};
  let res: NextResponse;
  try {
    res = await handle(session, id, body, stamp, holder);
  } catch (err) {
    console.error(`[try] unhandled error (request ${requestId}):`, err);
    Sentry.captureException(err, { tags: { area: "mcp-try", requestId } });
    res = failure(
      stamp,
      500,
      "error",
      PROXY_ERROR.INTERNAL,
      "Internal error. Quote the request id to support if it persists."
    );
  }
  // Activity log (contract D1): once per tools/call, from the final answer,
  // with the proxy's mapping (lib/mcp/aggregate.ts toolCallStatusFor).
  if (holder.ctx) recordCall(holder.ctx, res.status);
  return res;
}

async function handle(
  session: SessionUser,
  id: string,
  body: TryRequestBody,
  { requestId, started, rpcId }: Stamp,
  holder: { ctx?: TryCtx }
): Promise<NextResponse> {
  {
    const [row] = await getDb()
      .select({
        serverId: servers.id,
        serverSlug: servers.slug,
        serverStatus: servers.status,
        hostType: servers.hostType,
        boxId: servers.boxId,
        userServerId: userServers.id,
        enabled: userServers.enabled,
        endpoint: userServers.endpointUrl,
        tokenCiphertext: userServers.endpointTokenCiphertext,
        tokenIv: userServers.endpointTokenIv,
        tokenTag: userServers.endpointTokenTag,
        toolPolicy: userServers.toolPolicy,
        plan: users.plan,
      })
      .from(servers)
      .innerJoin(users, eq(users.id, servers.userId))
      .innerJoin(userServers, eq(userServers.serverId, servers.id))
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(
        and(
          eq(servers.id, id),
          eq(servers.userId, session.userId),
          eq(mcpServers.slug, body.mcpSlug)
        )
      )
      .limit(1);

    const base = { requestId, started, rpcId };
    if (!row) {
      return failure(base, 404, "error", PROXY_ERROR.NOT_FOUND, "Server or MCP not found.");
    }
    // A full key bound to another server (never minted today) stays out.
    if (session.apiKey && !keyAllowsServer(session.apiKey, row.serverId)) {
      return failure(base, 403, "error", PROXY_ERROR.KEY_RESTRICTED, SERVER_SCOPE_MESSAGE);
    }
    if (!row.enabled) {
      return failure(
        base,
        409,
        "error",
        PROXY_ERROR.CONFLICT,
        "This MCP is disabled. Enable it on the server page first."
      );
    }
    if (body.mcpSlug === TWINMCP_DOCS_SLUG) {
      return failure(
        base,
        400,
        "error",
        PROXY_ERROR.INVALID_REQUEST,
        "TwinMCP Docs is served by TwinMCP itself and needs an API key; try it from your IDE."
      );
    }

    const ctx: TryCtx = {
      requestId,
      started,
      body,
      userId: session.userId,
      apiKeyId: session.apiKey?.id ?? null,
      plan: row.plan,
      serverId: row.serverId,
      serverSlug: row.serverSlug,
      userServerId: row.userServerId,
      policy: parseToolPolicy(row.toolPolicy),
      isLocalAgent: row.hostType === "local_agent",
      rpcId,
      charge: toolCallMeter(session.userId, row.userServerId, body.method === "tools/call"),
    };
    holder.ctx = ctx;

    // Billing gate (contract W2) before anything is woken or sent: a call the
    // wallet cannot pay never wakes a box.
    const gated = await billingGate(ctx);
    if (gated) return gated;

    if (ctx.isLocalAgent) return await runOnLocalAgent(ctx);

    // A paused server wakes on its next request (contract K4).
    let woke = false;
    if (isPausedRuntime({ status: row.serverStatus, hostType: row.hostType, boxId: row.boxId })) {
      const wake = await wakeServer(ctx);
      if (wake) return wake;
      woke = true;
    } else if (row.serverStatus === "provisioning") {
      return waking(ctx, "The server is provisioning. Waking up (about a minute)…", 10);
    } else if (row.serverStatus !== "running") {
      meter(ctx, false);
      return failure(
        ctx,
        409,
        "error",
        PROXY_ERROR.UNAVAILABLE,
        `Server is ${row.serverStatus}; start it before running tools.`
      );
    }

    let target: Target | null;
    if (woke) {
      target = await reloadTarget(row.userServerId);
    } else if (!row.endpoint) {
      target = null;
    } else {
      let token: string | null = null;
      if (row.tokenCiphertext) {
        try {
          token = decryptConfig<string>({
            ciphertext: row.tokenCiphertext,
            iv: row.tokenIv,
            tag: row.tokenTag,
          });
        } catch (err) {
          console.error("[try] token decrypt failed:", err);
          Sentry.captureException(err, {
            tags: { area: "mcp-try", stage: "token-decrypt", requestId },
          });
          meter(ctx, false);
          return failure(
            ctx,
            502,
            "error",
            PROXY_ERROR.INTERNAL,
            "MCP endpoint credentials unavailable."
          );
        }
      }
      target = { endpoint: row.endpoint, token };
    }
    if (!target) {
      return waking(ctx, "This MCP is still installing. Waking up (about a minute)…", 10);
    }

    return await runOnBox(ctx, target, woke);
  }
}

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

type Stamp = Pick<TryCtx, "requestId" | "started" | "rpcId">;

function reply(
  ctx: Stamp,
  httpStatus: number,
  payload: Omit<TryResponse, "latencyMs" | "requestId">,
  headers?: Record<string, string>
): NextResponse {
  const out: TryResponse = {
    ...payload,
    latencyMs: Date.now() - ctx.started,
    requestId: ctx.requestId,
  };
  const res = NextResponse.json(out, { status: httpStatus, headers });
  res.headers.set(PROXY_REQUEST_ID_HEADER, ctx.requestId);
  res.headers.set("cache-control", "no-store");
  return res;
}

/** A failure made by the relay itself, shaped like the proxy's JSON-RPC errors. */
function failure(
  ctx: Stamp,
  httpStatus: number,
  status: TryStatus,
  code: number,
  message: string,
  extra?: {
    retryAfterSec?: number;
    headers?: Record<string, string>;
    data?: Partial<Omit<ProxyErrorData, "requestId">>;
  }
): NextResponse {
  const raw = jsonRpcErrorBody(ctx.rpcId, code, message, ctx.requestId, extra?.data);
  return reply(
    ctx,
    httpStatus,
    {
      ok: false,
      status,
      error: raw.error,
      raw,
      ...(extra?.retryAfterSec ? { retryAfterSec: extra.retryAfterSec } : {}),
    },
    extra?.headers
  );
}

/** 503: the request never ran; the playground retries after `retryAfterSec`. */
function waking(ctx: Stamp, message: string, retryAfterSec = 5): NextResponse {
  return failure(ctx, 503, "waking", PROXY_ERROR.UNAVAILABLE, message, {
    retryAfterSec,
    headers: { "retry-after": String(retryAfterSec) },
  });
}

// ---------------------------------------------------------------------------
// Metering and billing: the proxy's rules, for tools/call only.
// ---------------------------------------------------------------------------

function isCall(ctx: TryCtx): boolean {
  return ctx.body.method === "tools/call";
}

/**
 * Like the proxy's meter(): a tools/call only — usage_metrics on every
 * outcome, the wallet charge when the MCP answered it (`ok`), at most once.
 */
function meter(ctx: TryCtx, ok: boolean): void {
  ctx.charge(ok);
}

/**
 * Activity log (contract D1, metadata only, fire-and-forget) for a tools/call,
 * from the HTTP status of the final answer, like the proxy's
 * recordTrackedCall: 429 = rate_limited, a policy refusal or 402 = denied,
 * other 4xx/5xx = error (the status is the error code), else ok.
 */
function recordCall(ctx: TryCtx, httpStatus: number): void {
  if (!isCall(ctx)) return;
  try {
    const { status, errorCode } = toolCallStatusFor(httpStatus, ctx.deniedCode);
    recordToolCall({
      userId: ctx.userId,
      serverId: ctx.serverId,
      userServerId: ctx.userServerId,
      mcpSlug: ctx.body.mcpSlug,
      toolName: ctx.body.name ?? null,
      status,
      errorCode,
      latencyMs: Date.now() - ctx.started,
      requestId: ctx.requestId,
      apiKeyId: ctx.apiKeyId,
      externalUserId: null,
    });
  } catch (err) {
    // recordToolCall never throws by contract; belt and braces.
    console.warn("[try] activity record failed:", err);
  }
}

/**
 * Policy gate for a tools/call, before it is sent: a refused tool is never
 * charged. Returns the 403 to send, or null when the tool may run.
 */
function denyIfBlocked(
  ctx: TryCtx,
  knownTools: ReadonlyArray<PolicyTool> | null
): NextResponse | null {
  if (!isCall(ctx) || isUnrestricted(ctx.policy)) return null;
  if (isToolCallAllowed(ctx.body.name ?? "", ctx.policy, knownTools)) return null;
  ctx.deniedCode = TOOL_POLICY_DENIED_CODE;
  return failure(
    ctx,
    403,
    "denied",
    TOOL_POLICY_DENIED_CODE,
    toolDeniedMessage(ctx.body.name ?? "", ctx.policy)
  );
}

/**
 * The billing gate of a tools/call (contract W2, as the proxy's billingGate):
 * the per-minute abuse limiter (429), then the wallet (402 when empty; fails
 * closed). Returns the answer to send, or null when the call may go on.
 */
async function billingGate(ctx: TryCtx): Promise<NextResponse | null> {
  if (!isCall(ctx)) return null;
  const burst = checkCallBurst(ctx.userId);
  if (!burst.ok) {
    meter(ctx, false);
    const resetAt = new Date(burst.reset);
    const message = rateLimitMessage(
      true,
      { limit: burst.limit, remaining: 0, reset: burst.reset, window: "minute" },
      resetAt
    );
    const retryAfterSec = Math.max(1, Math.ceil((burst.reset - Date.now()) / 1000));
    return failure(ctx, 429, "rate_limited", PROXY_ERROR.RATE_LIMITED, message, {
      retryAfterSec,
      headers: { "retry-after": String(retryAfterSec) },
    });
  }
  if (!(await walletAllowsCall(ctx.userId))) {
    meter(ctx, false);
    void notifyCreditExhausted(ctx.userId, ctx.plan);
    return failure(ctx, 402, "no_credit", PROXY_ERROR.CREDIT_EXHAUSTED, CREDIT_EXHAUSTED_MESSAGE, {
      data: CREDIT_ERROR_DATA,
    });
  }
  return null;
}

// ---------------------------------------------------------------------------
// Box lifecycle (mirrors the proxy)
// ---------------------------------------------------------------------------

interface Target {
  endpoint: string;
  token: string | null;
}

async function wakeServer(ctx: TryCtx): Promise<NextResponse | null> {
  try {
    await resumeServer(ctx.serverId);
    return null;
  } catch (err) {
    if (err instanceof RuntimeGoneError) return runtimeGone(ctx);
    if (isInsufficientCreditError(err)) return computeRefused(ctx, err);
    console.error("[try] waking a paused server failed:", err);
    Sentry.captureException(err, {
      tags: { area: "mcp-try", stage: "wake-paused", requestId: ctx.requestId },
      extra: { serverId: ctx.serverId },
    });
    meter(ctx, false);
    return waking(ctx, "This server is paused and is waking up (about a minute)…", 5);
  }
}

/** The wallet refused to wake the box (resumeServer → InsufficientCreditError): 402. */
function computeRefused(ctx: TryCtx, err: InsufficientCreditError): NextResponse {
  meter(ctx, false);
  if (err.reason === "no_credit") void notifyCreditExhausted(ctx.userId, ctx.plan);
  return failure(ctx, 402, "no_credit", PROXY_ERROR.CREDIT_EXHAUSTED, err.message, {
    data: CREDIT_ERROR_DATA,
  });
}

async function runtimeGone(ctx: TryCtx): Promise<NextResponse> {
  meter(ctx, false);
  try {
    if (await claimReprovision(ctx.serverId)) {
      await enqueue({ type: "provision-server", serverId: ctx.serverId });
    }
  } catch (err) {
    console.error("[try] reprovision after a lost runtime failed:", err);
    Sentry.captureException(err, {
      tags: { area: "mcp-try", stage: "reprovision", requestId: ctx.requestId },
      extra: { serverId: ctx.serverId },
    });
  }
  return waking(
    ctx,
    "This server's runtime no longer existed, so a fresh one is provisioning from your saved configuration. Waking up (about a minute)…",
    30
  );
}

/** The (possibly resume-refreshed) endpoint + decrypted box token of an MCP. */
async function reloadTarget(userServerId: string): Promise<Target | null> {
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

// ---------------------------------------------------------------------------
// Streamable HTTP exchange with the in-box supergateway bridge
// ---------------------------------------------------------------------------

interface McpSession {
  id: string | null;
  protocolVersion: string | null;
}

interface Exchange {
  outcome: ForwardOutcome;
  status: number;
  contentType: string | null;
  text: string;
  message: JsonRpcMessage | null;
  sessionId: string | null;
  tooLarge?: boolean;
}

/**
 * POST one JSON-RPC message and read the answer (JSON or SSE) until the
 * response carrying `message.id` arrives. The timeout covers the body too.
 */
async function exchange(
  target: Target,
  session: McpSession,
  message: Record<string, unknown>
): Promise<Exchange> {
  const url = `${target.endpoint.replace(/\/$/, "")}${MCP_STREAM_PATH}`;
  const headers: Record<string, string> = {
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
  };
  if (target.token) headers.authorization = `Bearer ${target.token}`;
  if (session.id) headers["mcp-session-id"] = session.id;
  if (session.protocolVersion) headers["mcp-protocol-version"] = session.protocolVersion;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), RPC_TIMEOUT_MS);
  const id = (message.id as string | undefined) ?? null;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(message),
      signal: ac.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    return {
      outcome: classifyFetchError(err),
      status: 0,
      contentType: null,
      text: "",
      message: null,
      sessionId: null,
    };
  }

  const contentType = response.headers.get("content-type");
  const base = {
    outcome: { kind: "response" as const, status: response.status },
    status: response.status,
    contentType,
    sessionId: response.headers.get("mcp-session-id"),
  };
  try {
    if (!response.body || id === null || response.status === 202) {
      const text = response.body ? await response.text() : "";
      return {
        ...base,
        text,
        message: id === null ? null : parseJsonRpcPayload(text, contentType, id),
      };
    }
    // Read incrementally: an SSE answer may keep the stream open after the
    // response frame, so stop as soon as the response to `id` is in.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (value) text += decoder.decode(value, { stream: true });
      if (text.length > MAX_RESULT_BYTES) {
        void reader.cancel().catch(() => {});
        return { ...base, text: "", message: null, tooLarge: true };
      }
      if (done) break;
      const hit = parseJsonRpcPayload(text, contentType, id);
      if (hit && hit.id === id) {
        void reader.cancel().catch(() => {});
        return { ...base, text, message: hit };
      }
    }
    return { ...base, text, message: parseJsonRpcPayload(text, contentType, id) };
  } catch (err) {
    // The headers came back, then the body failed: the request was received.
    const kind = classifyFetchError(err).kind === "timeout" ? "timeout" : "network_error";
    return { ...base, outcome: { kind }, text: "", message: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget: end the MCP session the relay opened. */
function closeSession(target: Target, session: McpSession): void {
  if (!session.id) return;
  const headers: Record<string, string> = { "mcp-session-id": session.id };
  if (target.token) headers.authorization = `Bearer ${target.token}`;
  void fetch(`${target.endpoint.replace(/\/$/, "")}${MCP_STREAM_PATH}`, {
    method: "DELETE",
    headers,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

function initializeMessage(requestId: string) {
  return {
    jsonrpc: "2.0",
    id: `try-init-${requestId}`,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "twinmcp-playground", version: "1.0.0" },
    },
  };
}

/**
 * Open an MCP session (initialize + notifications/initialized). A box that
 * looks asleep is woken (unless this request already did) and given a few
 * attempts to warm up; initialize is protocol overhead, so retrying it is safe.
 */
async function openSession(
  ctx: TryCtx,
  target: Target,
  woke: boolean
): Promise<{ target: Target; session: McpSession } | NextResponse> {
  const init = initializeMessage(ctx.requestId);
  let current = target;
  let attempt = await exchange(current, { id: null, protocolVersion: null }, init);

  if (looksAsleep(attempt.outcome)) {
    if (!woke) {
      try {
        await resumeServer(ctx.serverId);
      } catch (err) {
        if (err instanceof RuntimeGoneError) return runtimeGone(ctx);
        if (isInsufficientCreditError(err)) return computeRefused(ctx, err);
        console.error("[try] resume failed:", err);
        Sentry.captureException(err, {
          tags: { area: "mcp-try", stage: "resume", requestId: ctx.requestId },
          extra: { serverId: ctx.serverId },
        });
      }
    }
    const fresh = await reloadTarget(ctx.userServerId);
    if (fresh) current = fresh;
    for (let i = 0; fresh && i < WARMUP_ATTEMPTS && looksAsleep(attempt.outcome); i++) {
      await sleep(WARMUP_DELAY_MS);
      attempt = await exchange(current, { id: null, protocolVersion: null }, init);
    }
    if (looksAsleep(attempt.outcome)) {
      return waking(ctx, "The MCP server is waking up (about a minute)…", 5);
    }
  }

  if (attempt.status >= 400 || !attempt.message) {
    meter(ctx, false);
    return failure(
      ctx,
      502,
      "error",
      PROXY_ERROR.INTERNAL,
      `The MCP did not complete the handshake (HTTP ${attempt.status || "no answer"}).`
    );
  }
  if (attempt.message.error) {
    meter(ctx, false);
    return reply(ctx, 502, {
      ok: false,
      status: "error",
      error: attempt.message.error,
      raw: attempt.message,
    });
  }

  const result = attempt.message.result as { protocolVersion?: unknown } | undefined;
  const session: McpSession = {
    id: attempt.sessionId,
    protocolVersion: typeof result?.protocolVersion === "string" ? result.protocolVersion : null,
  };
  // Acknowledged with a 202 and no body; a failure here surfaces on the next call.
  await exchange(current, session, { jsonrpc: "2.0", method: "notifications/initialized" });
  return { target: current, session };
}

async function runOnBox(ctx: TryCtx, target: Target, woke: boolean): Promise<NextResponse> {
  const opened = await openSession(ctx, target, woke);
  if (opened instanceof NextResponse) return opened;
  const { session } = opened;
  target = opened.target;

  try {
    const listPage = (id: string, cursor: string | null) =>
      exchange(target, session, toolsListMessage(id, cursor));
    if (ctx.body.method === "tools/list") {
      return toolsListReply(ctx, await listAllPages(ctx.rpcId, listPage));
    }

    // tools/call (the billing gate already passed). A read_only policy needs
    // each tool's annotations: list first (free), then gate, then the call
    // itself, once.
    // The proxy's tool cache is shared, so a recent list from an IDE counts.
    let known: McpTool[] | null = null;
    if (policyNeedsToolAnnotations(ctx.policy)) {
      known = toolCache.get(toolCacheKey(ctx), POLICY_TOOLS_MAX_AGE_MS);
      if (!known) {
        // Every page: a read-only tool on page 2 must not be denied.
        const listed = await listAllPages(`${ctx.rpcId}-list`, listPage);
        known = rememberTools(ctx, listed.message?.result);
      }
    }
    const denied = denyIfBlocked(ctx, known);
    if (denied) return denied;

    const call = {
      jsonrpc: "2.0",
      id: ctx.rpcId,
      method: "tools/call",
      params: { name: ctx.body.name, arguments: ctx.body.arguments ?? {} },
    };
    let called = await exchange(target, session, call);
    for (let i = 0; i < CALL_RETRY_ATTEMPTS && shouldRetry(BILLABLE, called.outcome); i++) {
      await sleep(WARMUP_DELAY_MS);
      called = await exchange(target, session, call);
    }
    return toolsCallReply(ctx, called);
  } finally {
    closeSession(target, session);
  }
}

function toolsListMessage(id: string, cursor: string | null): Record<string, unknown> {
  return { jsonrpc: "2.0", id, method: "tools/list", params: cursor ? { cursor } : {} };
}

/**
 * tools/list, following `nextCursor` like the proxy (lib/mcp/relay.ts, at
 * most MAX_TOOLS_LIST_PAGES pages), merged into one answer under `firstId`.
 * The first page's failure is the answer; a later page failing keeps what was
 * read. Pages past MAX_RESULT_BYTES in total make the answer too large.
 */
async function listAllPages(
  firstId: string,
  fetchPage: (id: string, cursor: string | null) => Promise<Exchange>
): Promise<Exchange> {
  const first = await fetchPage(firstId, null);
  if (!first.message || first.message.error || first.tooLarge || first.status >= 400) return first;
  const pages: JsonRpcMessage[] = [first.message];
  let bytes = first.text.length;
  let cursor = nextCursorOf(first.message);
  while (cursor && pages.length < MAX_TOOLS_LIST_PAGES) {
    const next = await fetchPage(`${firstId}-p${pages.length}`, cursor).catch(() => null);
    if (!next || !next.message || next.message.error || next.tooLarge || next.status >= 400) break;
    bytes += next.text.length;
    if (bytes > MAX_RESULT_BYTES) return { ...first, text: "", message: null, tooLarge: true };
    pages.push(next.message);
    cursor = nextCursorOf(next.message);
  }
  return { ...first, message: mergeToolsListPages(pages) };
}

function toolsListReply(ctx: TryCtx, listed: Exchange): NextResponse {
  if (looksAsleep(listed.outcome)) {
    return waking(ctx, "The MCP server is waking up (about a minute)…", 5);
  }
  return finish(ctx, listed);
}

function toolsCallReply(ctx: TryCtx, called: Exchange): NextResponse {
  if (shouldRetry(BILLABLE, called.outcome)) {
    // Not metered nor charged, like the proxy's wakingUp(): the call never
    // ran. The UI retries it, through the billing gate again (as an IDE's
    // retry of the proxy's 503 is).
    return waking(ctx, "The MCP server is waking up (about a minute)…", 5);
  }
  if (
    called.outcome.kind === "timeout" ||
    called.outcome.kind === "network_error" ||
    (called.outcome.kind === "response" && called.outcome.status === 504)
  ) {
    meter(ctx, false);
    return failure(
      ctx,
      504,
      "error",
      PROXY_ERROR.OUTCOME_UNKNOWN,
      "The MCP server did not answer in time. The tool call may still have run; it was not retried automatically."
    );
  }
  meter(ctx, called.status < 400);
  if (called.status < 400) noteFirstToolCall(ctx.userId, ctx.body.mcpSlug);
  return finish(ctx, called);
}

/** Shape the MCP's answer (any method) into a TryResponse. */
function finish(ctx: TryCtx, ex: Exchange): NextResponse {
  if (ex.tooLarge) {
    return failure(
      ctx,
      502,
      "error",
      PROXY_ERROR.INTERNAL,
      `The answer is larger than ${MAX_RESULT_BYTES / (1024 * 1024)} MB and cannot be shown here.`
    );
  }
  const msg = ex.message;
  if (!msg) {
    return failure(
      ctx,
      502,
      "error",
      PROXY_ERROR.INTERNAL,
      `The MCP returned no JSON-RPC answer (HTTP ${ex.status || "no answer"}).`
    );
  }
  if (msg.error) {
    // The upstream's own HTTP status when it failed (as the proxy relays it),
    // else 200: a JSON-RPC error is a normal MCP answer.
    const httpStatus = ex.status >= 400 ? ex.status : 200;
    return reply(ctx, httpStatus, { ok: false, status: "error", error: msg.error, raw: msg });
  }
  if (ctx.body.method === "tools/list") return listResult(ctx, msg);

  const toolError = isToolResultError(msg.result);
  return reply(ctx, 200, {
    ok: !toolError,
    status: toolError ? "tool_error" : "ok",
    result: msg.result,
    raw: msg,
  });
}

/**
 * Keep a tools/list result (before the policy) in the proxy's per-process
 * tool cache, which the read_only policy check and the aggregated endpoint
 * read. Null when the result holds no tool list.
 */
function rememberTools(ctx: TryCtx, result: unknown): McpTool[] | null {
  const list = (result as { tools?: unknown } | null | undefined)?.tools;
  if (!Array.isArray(list)) return null;
  const tools = list.filter(
    (t): t is McpTool =>
      !!t && typeof t === "object" && typeof (t as { name?: unknown }).name === "string"
  );
  toolCache.set(toolCacheKey(ctx), tools);
  return tools;
}

/**
 * The proxy's tool-cache key for this MCP: the installation id for a box,
 * `<agent connection>:<mcpSlug>` for a local agent (as the single-MCP proxy).
 */
function toolCacheKey(ctx: TryCtx): string {
  return ctx.isLocalAgent
    ? `${connKey(ctx.userId, ctx.serverSlug)}:${ctx.body.mcpSlug}`
    : ctx.userServerId;
}

/**
 * tools/list through the installation's tool policy (what an IDE would see),
 * or the full list with `ignorePolicy` (the owner's Tool access dialog).
 */
function listResult(ctx: TryCtx, msg: JsonRpcMessage): NextResponse {
  const result = msg.result as { tools?: unknown } | undefined;
  rememberTools(ctx, result);
  if (
    ctx.body.ignorePolicy ||
    isUnrestricted(ctx.policy) ||
    !result ||
    !Array.isArray(result.tools)
  ) {
    return reply(ctx, 200, { ok: true, status: "ok", result: msg.result, raw: msg });
  }
  const visible = new Set(filterToolsList(extractTools(result), ctx.policy).map((t) => t.name));
  const tools = result.tools.filter(
    (t) => !!t && typeof t === "object" && visible.has((t as { name?: string }).name ?? "")
  );
  const filtered = { ...result, tools };
  return reply(ctx, 200, {
    ok: true,
    status: "ok",
    result: filtered,
    raw: { ...msg, result: filtered },
    hiddenByPolicy: result.tools.length - tools.length,
  });
}

// ---------------------------------------------------------------------------
// Local agent: the MCP runs on the user's machine behind the CLI's `connect`. The
// agent keeps one long-lived stdio process per MCP, already initialized by the
// IDE that uses it, so the request is relayed as is (a second initialize
// could reset that session for some servers).
// ---------------------------------------------------------------------------

/** A local agent's answer, shaped like a box exchange. */
function agentExchange(
  resp: { ok: boolean; body: string; contentType?: string | null },
  id: string
): Exchange {
  const contentType = resp.contentType ?? "application/json";
  const status = resp.ok ? 200 : 502;
  return {
    outcome: { kind: "response", status },
    status,
    contentType,
    text: resp.body,
    message: parseJsonRpcPayload(resp.body, contentType, id),
    sessionId: null,
    tooLarge: resp.body.length > MAX_RESULT_BYTES,
  };
}

async function runOnLocalAgent(ctx: TryCtx): Promise<NextResponse> {
  const key = connKey(ctx.userId, ctx.serverSlug);
  if (!isAgentOnline(key)) {
    meter(ctx, false);
    return failure(
      ctx,
      409,
      "error",
      PROXY_ERROR.UNAVAILABLE,
      `Local agent offline. Run ${localAgentCommand(ctx.serverSlug)} on the machine that hosts this tool, then retry.`
    );
  }

  const relay = (id: string, method: string, params: Record<string, unknown>) =>
    relayToAgent(key, ctx.body.mcpSlug, JSON.stringify({ jsonrpc: "2.0", id, method, params }));
  const listPage = async (id: string, cursor: string | null): Promise<Exchange> =>
    agentExchange(await relay(id, "tools/list", cursor ? { cursor } : {}), id);

  try {
    if (ctx.body.method === "tools/call") {
      let known: McpTool[] | null = null;
      if (policyNeedsToolAnnotations(ctx.policy)) {
        known = toolCache.get(toolCacheKey(ctx), POLICY_TOOLS_MAX_AGE_MS);
        if (!known) {
          const listed = await listAllPages(`${ctx.rpcId}-list`, listPage);
          known = rememberTools(ctx, listed.message?.result);
        }
      }
      const denied = denyIfBlocked(ctx, known);
      if (denied) return denied;
    }

    if (ctx.body.method === "tools/list") {
      return finish(ctx, await listAllPages(ctx.rpcId, listPage));
    }
    const resp = await relay(ctx.rpcId, ctx.body.method, {
      name: ctx.body.name,
      arguments: ctx.body.arguments ?? {},
    });
    meter(ctx, resp.ok);
    if (resp.ok) noteFirstToolCall(ctx.userId, ctx.body.mcpSlug);
    return finish(ctx, agentExchange(resp, ctx.rpcId));
  } catch (err) {
    console.error("[try] local-agent relay failed:", err);
    meter(ctx, false);
    return failure(
      ctx,
      504,
      "error",
      PROXY_ERROR.OUTCOME_UNKNOWN,
      isCall(ctx)
        ? "The local agent did not answer in time. The tool call may still have run; it was not retried automatically."
        : `The local agent did not answer in time. Check ${localAgentCommand(ctx.serverSlug)} on your machine, then retry.`
    );
  }
}
