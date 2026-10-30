import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { authenticateRequest } from "@/lib/auth";
import { SERVER_SCOPE_MESSAGE, keyAllowsServer } from "@/lib/auth/key-scope";
import { PROXY_ERROR, newProxyRequestId, proxyError, withProxyRequestId } from "@/lib/errors";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { isBillableRequest } from "@/lib/mcp/billable";
import { connKey, isAgentOnline } from "@/lib/agent/registry";
import {
  applyPolicyToJsonRpcResponse,
  filterToolsList,
  isToolCallAllowed,
  isUnrestricted,
  parseToolPolicy,
  policyNeedsToolAnnotations,
  type ToolPolicy,
} from "@/lib/mcp/tool-policy";
import {
  TOOL_POLICY_DENIED_CODE,
  extractJsonRpcResponse,
  nextCursorOf,
  toolCallName,
  toolsFromResponse,
  type McpTool,
} from "@/lib/mcp/aggregate";
import {
  POLICY_TOOLS_MAX_AGE_MS,
  TWINMCP_DOCS_TOOLS,
  agentOffline,
  billingGate,
  callLocalAgent,
  fetchAllBoxTools,
  forwardToBox,
  handleTwinMcpDocs,
  newToolCallTrack,
  noteFirstToolCall,
  passHeader,
  policyDenied,
  probeAgentTools,
  recordTrackedCall,
  relayUpstream,
  rememberToolsFromBody,
  requestsCursor,
  toolCache,
  toolCallMeter,
  unauthorizedMcp,
  type BoxForward,
  type BoxTarget,
  type JsonRpcRequest,
  type Method,
  type RelayCtx,
  type ToolCallTrack,
} from "@/lib/mcp/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One MCP of one server: /api/mcp/<serverSlug>/<mcpSlug>. A full Streamable
// HTTP relay (GET stream, POST, DELETE) to the box bridge, the local agent or
// the control-plane TwinMCP Docs. The whole server behind one URL is the
// sibling route /api/mcp/<serverSlug> (contract D3); both share lib/mcp/relay.ts.

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return handleProxy(req, ctx, "GET");
}
export async function POST(req: NextRequest, ctx: RouteCtx) {
  return handleProxy(req, ctx, "POST");
}
export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return handleProxy(req, ctx, "DELETE");
}

type RouteCtx = { params: Promise<{ serverSlug: string; mcpSlug: string }> };

/** Everything a branch needs once the request is authenticated and classified. */
interface ProxyCtx extends RelayCtx {
  req: NextRequest;
  serverSlug: string;
  mcpSlug: string;
  method: Method;
  /** The POST body, read once (replayed on a resume-and-retry). */
  bodyText: string | undefined;
  /** The tool call's own name (params.name), when this is a tools/call. */
  toolName: string | null;
  /** The installation's tool policy (contract D2); null = every tool. */
  policy: ToolPolicy | null;
  /** The activity-log entry of a tools/call (contract D1), logged once answered. */
  track: ToolCallTrack | undefined;
}

/**
 * Every proxy response carries `x-twinmcp-request-id` (contract K2), errors
 * included, and the id goes into each JSON-RPC error the proxy produces
 * (`error.data.requestId`) and into Sentry, so a user can quote it to support.
 * A tools/call is logged to the activity log (contract D1) from the answer
 * sent — fire-and-forget, metadata only. Its latency runs to the response
 * headers (a streamed result is not awaited).
 */
async function handleProxy(req: NextRequest, routeCtx: RouteCtx, method: Method) {
  const requestId = newProxyRequestId();
  const startedAt = Date.now();
  const out: { track?: ToolCallTrack } = {};
  let res: Response;
  try {
    res = await proxyRequest(req, routeCtx, method, requestId, startedAt, out);
  } catch (err) {
    console.error(`[mcp proxy] unhandled error (request ${requestId}):`, err);
    Sentry.captureException(err, { tags: { area: "mcp-proxy", requestId } });
    res = proxyError({
      status: 500,
      code: PROXY_ERROR.INTERNAL,
      message: "Internal proxy error. Quote the request id to support if it persists.",
      requestId,
    });
  }
  if (out.track) recordTrackedCall(out.track, res, requestId);
  return withProxyRequestId(res, requestId);
}

async function proxyRequest(
  req: NextRequest,
  { params }: RouteCtx,
  method: Method,
  requestId: string,
  startedAt: number,
  out: { track?: ToolCallTrack }
): Promise<Response> {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedMcp(req, requestId, null);
  const { serverSlug, mcpSlug } = await params;

  // Read the body once and classify the message before any gate. Only a
  // `tools/call` is billed to the wallet and lands in usage_metrics; the
  // protocol overhead around it (initialize, tools/list, notifications, ping,
  // the GET stream, DELETE) is relayed for free.
  const bodyText = method === "POST" ? await req.text() : undefined;
  const verdict = isBillableRequest(method, bodyText ?? null);
  const fail = (status: number, code: number, message: string, headers?: HeadersInit) =>
    proxyError({ status, code, message, requestId, rpcId: verdict.rpcId, headers });

  const db = getDb();
  const [row] = await db
    .select({
      serverId: servers.id,
      serverStatus: servers.status,
      hostType: servers.hostType,
      boxId: servers.boxId,
      enabled: userServers.enabled,
      userServerId: userServers.id,
      mcpEndpoint: userServers.endpointUrl,
      tokenCiphertext: userServers.endpointTokenCiphertext,
      tokenIv: userServers.endpointTokenIv,
      tokenTag: userServers.endpointTokenTag,
      toolPolicy: userServers.toolPolicy,
    })
    .from(servers)
    .innerJoin(userServers, eq(userServers.serverId, servers.id))
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(
      and(
        eq(servers.userId, auth.userId),
        eq(servers.slug, serverSlug),
        eq(mcpServers.slug, mcpSlug)
      )
    )
    .limit(1);

  if (!row) {
    return fail(404, PROXY_ERROR.NOT_FOUND, `Server '${serverSlug}' or MCP '${mcpSlug}' not found`);
  }

  // From here on the request belongs to a known server: a tools/call is
  // logged whatever happens to it (refused, rate-limited, unpaid, failed or
  // served).
  const toolName = verdict.billable ? toolCallName(bodyText) : null;
  if (verdict.billable) {
    out.track = newToolCallTrack(auth, {
      serverId: row.serverId,
      userServerId: row.userServerId,
      mcpSlug,
      toolName,
      startedAt,
    });
  }

  // A key scoped to one server (contract K1) cannot reach the others. Applies
  // to every branch, twinmcp-docs and local agents included.
  // Fails closed: a context without a key (never produced today) is refused.
  if (!auth.apiKey || !keyAllowsServer(auth.apiKey, row.serverId, serverSlug)) {
    // Logged as `denied` (db/schema/activity.ts), like the aggregated endpoint.
    if (out.track) out.track.deniedCode = PROXY_ERROR.KEY_RESTRICTED;
    return fail(403, PROXY_ERROR.KEY_RESTRICTED, SERVER_SCOPE_MESSAGE);
  }
  if (!row.enabled) return fail(409, PROXY_ERROR.CONFLICT, "MCP is disabled");

  // usage_metrics + the wallet charge, once the MCP has answered the call.
  const meter = toolCallMeter(auth.userId, row.userServerId, verdict.billable);
  const ctx: ProxyCtx = {
    req,
    auth,
    serverSlug,
    mcpSlug,
    method,
    bodyText,
    verdict,
    meter,
    requestId,
    toolName,
    policy: parseToolPolicy(row.toolPolicy),
    track: out.track,
  };

  // One tool call per request: a JSON-RPC batch carrying several tools/call
  // would otherwise be charged and rate-limited as one (MCP 2025-06-18 removed
  // batching; current clients never send one).
  if (verdict.units > 1) {
    return fail(
      400,
      PROXY_ERROR.INVALID_REQUEST,
      "Batches with more than one tools/call are not supported. Send one call per request."
    );
  }

  // Billing gate (contract W2), before any branch wakes or forwards anything:
  // the per-minute abuse limiter (429), then the wallet (402 when empty, fails
  // closed). Logged as `rate_limited` / `denied` (aggregate.ts toolCallStatusFor).
  const gated = await billingGate(ctx);
  if (gated) return gated;

  // Local-agent MCP: served by the user's own machine over a live relay, not a
  // box. Skip every box gate and route to the connected agent.
  if (row.hostType === "local_agent") {
    return handleLocalAgent(ctx);
  }

  // TwinMCP Docs is served by the control plane (no box). It is stateless and
  // offers no server→client SSE stream, so only POST is meaningful. A
  // get-context call is charged like any tool call, on success only.
  if (mcpSlug === TWINMCP_DOCS_SLUG) {
    if (method !== "POST") {
      return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
    }
    let rpc: JsonRpcRequest;
    try {
      rpc = JSON.parse(bodyText ?? "") as JsonRpcRequest;
    } catch {
      return fail(400, PROXY_ERROR.PARSE_ERROR, "Invalid JSON-RPC body");
    }
    if (verdict.billable && !isToolCallAllowed(toolName ?? "", ctx.policy, TWINMCP_DOCS_TOOLS)) {
      return deny(ctx);
    }
    // Metered from the call's real outcome: a failed lookup is answered as a
    // 200 JSON-RPC error, and must count (and be logged) as a failure — and
    // is not charged.
    return handleTwinMcpDocs(
      req,
      rpc,
      requestId,
      () => {
        meter(true);
        noteFirstToolCall(auth.userId, mcpSlug);
      },
      filterToolsList(TWINMCP_DOCS_TOOLS, ctx.policy),
      (code) => {
        meter(false);
        if (out.track) out.track.failedCode = code;
      }
    );
  }

  const target: BoxTarget = {
    serverId: row.serverId,
    serverStatus: row.serverStatus,
    hostType: row.hostType,
    boxId: row.boxId,
    userServerId: row.userServerId,
    mcpEndpoint: row.mcpEndpoint,
    tokenCiphertext: row.tokenCiphertext,
    tokenIv: row.tokenIv,
    tokenTag: row.tokenTag,
  };
  const fwd: BoxForward = {
    method,
    bodyText,
    contentType:
      method === "POST" ? (req.headers.get("content-type") ?? "application/json") : undefined,
    headers: bridgeHeaders(req, method),
  };

  // Tool policy (contract D2): a refused tools/call never reaches the box and
  // is not charged. read_only needs the MCP's annotations: the cached
  // tools/list, else one fetched now (free overhead, same wake/retry path).
  if (verdict.billable && !isUnrestricted(ctx.policy)) {
    let known: McpTool[] | null = null;
    if (policyNeedsToolAnnotations(ctx.policy)) {
      known = toolCache.get(row.userServerId, POLICY_TOOLS_MAX_AGE_MS);
      if (!known) {
        // Every page of the list: a tool on page 2 must not be denied.
        const pre = await fetchAllBoxTools(ctx, target, fwd.headers);
        if (!pre.ok) return pre.response;
        known = pre.tools;
        if (known) toolCache.set(row.userServerId, known);
      }
    }
    if (!isToolCallAllowed(toolName ?? "", ctx.policy, known)) return deny(ctx);
  }

  const result = await forwardToBox(ctx, target, fwd);
  if (!result.ok) return result.response;

  const finalResp = result.response;
  const ok = finalResp.status < 400;
  meter(ok);
  if (verdict.billable && ok) noteFirstToolCall(auth.userId, mcpSlug);

  // A restricted installation never shows its hidden tools: buffer the
  // tools/list answer (JSON or SSE) and rewrite it. Everything else streams.
  if (ok && verdict.rpcMethod === "tools/list" && !isUnrestricted(ctx.policy)) {
    const text = await finalResp.text();
    rememberToolsFromBody(
      row.userServerId,
      text,
      finalResp.headers.get("content-type"),
      requestsCursor(bodyText)
    );
    return relayUpstream(finalResp, applyPolicyToJsonRpcResponse(text, ctx.policy));
  }
  return relayUpstream(finalResp);
}

/** The request headers relayed to the box bridge (never the caller's key). */
function bridgeHeaders(req: NextRequest, method: Method): Record<string, string> {
  const headers: Record<string, string> = {
    accept:
      req.headers.get("accept") ??
      (method === "GET" ? "text/event-stream" : "application/json, text/event-stream"),
  };
  passHeader(req.headers, headers, "mcp-session-id");
  passHeader(req.headers, headers, "mcp-protocol-version");
  passHeader(req.headers, headers, "last-event-id");
  return headers;
}

/** Refuse a tools/call the tool policy does not allow (logged as `denied`). */
function deny(ctx: ProxyCtx): NextResponse {
  if (ctx.track) ctx.track.deniedCode = TOOL_POLICY_DENIED_CODE;
  return policyDenied(ctx, ctx.toolName ?? "", ctx.policy);
}

// ---------------------------------------------------------------------------
// Local-agent relay. The MCP runs on the user's machine (via `ctx7 connect`);
// we relay the JSON-RPC request over the agent's live link instead of forwarding
// to a box. Request/response only in v1 (no server→client SSE stream).
// ---------------------------------------------------------------------------
async function handleLocalAgent(ctx: ProxyCtx): Promise<Response> {
  const { auth, serverSlug, mcpSlug, method, verdict } = ctx;
  if (method !== "POST") {
    return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
  }
  const bodyText = ctx.bodyText ?? "";
  const key = connKey(auth.userId, serverSlug);
  const restricted = !isUnrestricted(ctx.policy);

  if (verdict.billable && restricted) {
    // Offline first: the policy check below may need the agent's tool list.
    if (!isAgentOnline(key)) {
      ctx.meter(false);
      return agentOffline(ctx);
    }
    let known: McpTool[] | null = null;
    if (policyNeedsToolAnnotations(ctx.policy)) {
      known = toolCache.get(`${key}:${mcpSlug}`, POLICY_TOOLS_MAX_AGE_MS);
      if (!known) {
        const probe = await probeAgentTools(key, mcpSlug, 8_000);
        if (probe.kind === "ok") {
          known = probe.tools;
          toolCache.set(`${key}:${mcpSlug}`, known);
        }
      }
    }
    if (!isToolCallAllowed(ctx.toolName ?? "", ctx.policy, known)) return deny(ctx);
  }

  const res = await callLocalAgent(ctx, key, mcpSlug, bodyText);
  if (res.status === 200 && verdict.rpcMethod === "tools/list" && restricted) {
    const text = await res.text();
    // Cache a complete list only (not one page of a paginated one).
    const message = extractJsonRpcResponse(text, res.headers.get("content-type"));
    const tools = toolsFromResponse(message);
    if (tools && !nextCursorOf(message) && !requestsCursor(bodyText)) {
      toolCache.set(`${key}:${mcpSlug}`, tools);
    }
    return new NextResponse(applyPolicyToJsonRpcResponse(text, ctx.policy), {
      status: res.status,
      headers: res.headers,
    });
  }
  return res;
}
