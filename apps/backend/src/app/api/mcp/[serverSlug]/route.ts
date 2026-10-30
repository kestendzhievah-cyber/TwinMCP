import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { authenticateRequest, type AuthedContext } from "@/lib/auth";
import { SERVER_SCOPE_MESSAGE, keyAllowsServer } from "@/lib/auth/key-scope";
import {
  PROXY_ERROR,
  PROXY_REQUEST_ID_HEADER,
  newProxyRequestId,
  proxyError,
  withProxyRequestId,
} from "@/lib/errors";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";
import { isPausedRuntime } from "@/lib/server-lifecycle";
import { connKey, isAgentOnline } from "@/lib/agent/registry";
import type { BillableVerdict } from "@/lib/mcp/billable";
import {
  filterToolsList,
  isToolCallAllowed,
  isUnrestricted,
  parseToolPolicy,
  policyNeedsToolAnnotations,
  toolDeniedMessage,
  type ToolPolicy,
} from "@/lib/mcp/tool-policy";
import {
  TOOL_POLICY_DENIED_CODE,
  WARNINGS_META_KEY,
  aggregateInitializeResult,
  buildForwardedToolCall,
  buildIndexedToolsList,
  extractJsonRpcResponse,
  parseRpcBody,
  shouldAnswerWaking,
  type FanoutEntry,
  type FanoutState,
  type JsonRpcMessage,
  type McpTool,
  type ToolNameIndex,
  type ToolsListResult,
} from "@/lib/mcp/aggregate";
import {
  ROUTER_TOOLS,
  describeToolSchema,
  isRouterMode,
  resolveToolCall,
  searchToolsAnswer,
} from "@/lib/mcp/router-tools";
import {
  POLICY_TOOLS_MAX_AGE_MS,
  ROUTER_TOOLS_MAX_AGE_MS,
  STALE_TOOLS_MAX_AGE_MS,
  TWINMCP_DOCS_TOOLS,
  agentOffline,
  billingGate,
  callLocalAgent,
  decryptEndpointToken,
  fetchAllBoxTools,
  forwardToBox,
  handleTwinMcpDocs,
  jsonRpcResult,
  kickWake,
  newToolCallTrack,
  noteFirstToolCall,
  overheadVerdict,
  policyDenied,
  probeAgentTools,
  probeBoxTools,
  readBodyCapped,
  recordTrackedCall,
  reloadEndpoint,
  rememberToolIndex,
  sleep,
  toolCache,
  toolCallMeter,
  toolIndexFor,
  toolCallUncertain,
  unauthorizedMcp,
  wakingUp,
  type BoxTarget,
  type RelayCtx,
  type ToolCallTrack,
} from "@/lib/mcp/relay";
import type { HostType, ServerStatus } from "@/db/schema/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One MCP endpoint for a whole server (contract D3): /api/mcp/<serverSlug>.
//
// Streamable HTTP, answered as plain JSON (no server→client stream):
//   POST    JSON-RPC, one message per request (batches are refused).
//           initialize / ping are answered here; tools/list fans out to every
//           enabled MCP in parallel (8 s each, partial results + a `_meta`
//           warning for an MCP that is waking); tools/call `<mcp>__<tool>` is
//           routed to that MCP through the very code of the per-MCP endpoint
//           (lib/mcp/relay.ts): same wake/retry, billing gate (per-minute
//           limiter, wallet: 402 when empty), charge (one tools/call = one
//           billed call), tool policy (D2) and activity log (D1).
//           Notifications get a bodiless 202.
//   GET     405 — the aggregate offers no server-initiated stream.
//   DELETE  200 — nothing to tear down: the session id is ours and stateless.
//
// `?mode=router` lists three meta-tools instead (lib/mcp/router-tools.ts):
// search_tools and get_tool_schema are free, call_tool is billed like any
// tool call. The merged list is cached ~60 s per process for them.

type RouteCtx = { params: Promise<{ serverSlug: string }> };

/** Per-MCP budget of the tools/list fan-out (and of waiting for a paused box). */
const FANOUT_TIMEOUT_MS = 8_000;
/**
 * Waking with nothing to show (no stale tools — normal after a deploy): wait
 * for the box this long (from the request's start) before answering 503. IDE
 * clients mark a server failed on a 503 at connect and do not retry, and
 * typically time out at 60 s.
 */
const COLD_WAKE_BUDGET_MS = 25_000;
/** Pause between re-probes of a bridge that is still warming up. */
const REPROBE_INTERVAL_MS = 2_000;

export async function GET() {
  const requestId = newProxyRequestId();
  return withProxyRequestId(
    new NextResponse(null, { status: 405, headers: { Allow: "POST, DELETE" } }),
    requestId
  );
}

export async function DELETE(req: NextRequest) {
  const requestId = newProxyRequestId();
  const auth = await authenticateRequest(req).catch(() => null);
  const res = auth
    ? new NextResponse(null, { status: 200 })
    : unauthorizedMcp(req, requestId, null);
  return withProxyRequestId(res, requestId);
}

export async function POST(req: NextRequest, routeCtx: RouteCtx) {
  const requestId = newProxyRequestId();
  const startedAt = Date.now();
  const out: { track?: ToolCallTrack } = {};
  let res: Response;
  try {
    res = await handlePost(req, routeCtx, requestId, startedAt, out);
  } catch (err) {
    console.error(`[mcp aggregate] unhandled error (request ${requestId}):`, err);
    Sentry.captureException(err, { tags: { area: "mcp-proxy", mode: "aggregate", requestId } });
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

/** One enabled MCP installed on the server. */
interface McpRow {
  userServerId: string;
  mcpSlug: string;
  mcpEndpoint: string | null;
  tokenCiphertext: string;
  tokenIv: string;
  tokenTag: string;
  policy: ToolPolicy | null;
}

interface ServerRow {
  serverId: string;
  serverStatus: ServerStatus;
  hostType: HostType;
  boxId: string | null;
  mcps: McpRow[];
}

/** The server (owned by `userId`) and its enabled MCPs, in one query. */
async function loadServer(userId: string, serverSlug: string): Promise<ServerRow | null> {
  const rows = await getDb()
    .select({
      serverId: servers.id,
      serverStatus: servers.status,
      hostType: servers.hostType,
      boxId: servers.boxId,
      userServerId: userServers.id,
      mcpSlug: mcpServers.slug,
      mcpEndpoint: userServers.endpointUrl,
      tokenCiphertext: userServers.endpointTokenCiphertext,
      tokenIv: userServers.endpointTokenIv,
      tokenTag: userServers.endpointTokenTag,
      toolPolicy: userServers.toolPolicy,
    })
    .from(servers)
    .leftJoin(userServers, and(eq(userServers.serverId, servers.id), eq(userServers.enabled, true)))
    .leftJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(and(eq(servers.userId, userId), eq(servers.slug, serverSlug)));
  const first = rows[0];
  if (!first) return null;
  const mcps: McpRow[] = [];
  for (const r of rows) {
    if (!r.userServerId || !r.mcpSlug) continue;
    mcps.push({
      userServerId: r.userServerId,
      mcpSlug: r.mcpSlug,
      mcpEndpoint: r.mcpEndpoint,
      tokenCiphertext: r.tokenCiphertext ?? "",
      tokenIv: r.tokenIv ?? "",
      tokenTag: r.tokenTag ?? "",
      policy: parseToolPolicy(r.toolPolicy),
    });
  }
  mcps.sort((a, b) => a.mcpSlug.localeCompare(b.mcpSlug));
  return {
    serverId: first.serverId,
    serverStatus: first.serverStatus,
    hostType: first.hostType,
    boxId: first.boxId,
    mcps,
  };
}

/** Everything the handlers below share for one request. */
interface AggCtx {
  req: NextRequest;
  auth: AuthedContext;
  serverSlug: string;
  server: ServerRow;
  rpc: JsonRpcMessage;
  rpcId: string | number | null;
  requestId: string;
  startedAt: number;
  router: boolean;
  out: { track?: ToolCallTrack };
}

async function handlePost(
  req: NextRequest,
  { params }: RouteCtx,
  requestId: string,
  startedAt: number,
  out: { track?: ToolCallTrack }
): Promise<Response> {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedMcp(req, requestId, null);
  const { serverSlug } = await params;

  const parsed = parseRpcBody(await req.text());
  if (parsed.kind === "invalid") {
    return proxyError({
      status: 400,
      code: PROXY_ERROR.PARSE_ERROR,
      message: "Invalid JSON-RPC body",
      requestId,
    });
  }
  if (parsed.kind === "batch") {
    return proxyError({
      status: 400,
      code: PROXY_ERROR.INVALID_REQUEST,
      message: "Batches are not supported on the server endpoint. Send one message per request.",
      requestId,
    });
  }
  const rpc = parsed.message;
  const rpcId = typeof rpc.id === "string" || typeof rpc.id === "number" ? rpc.id : null;
  const fail = (status: number, code: number, message: string) =>
    proxyError({ status, code, message, requestId, rpcId });

  const isResponse = rpc.method === undefined && ("result" in rpc || "error" in rpc);
  if (typeof rpc.method !== "string" && !isResponse) {
    // JSON-RPC: a message that is neither a request nor a response.
    return fail(400, PROXY_ERROR.INVALID_REQUEST, "Invalid Request: missing or non-string method");
  }

  const server = await loadServer(auth.userId, serverSlug);
  if (!server) return fail(404, PROXY_ERROR.NOT_FOUND, `Server '${serverSlug}' not found`);
  const router = isRouterMode(req.nextUrl.searchParams);
  // A key scoped to one server (contract K1) cannot reach the others. Fails
  // closed: a context without a key (never produced today) is refused. A
  // refused tools/call is logged as `denied`, like on the per-MCP endpoint.
  if (!auth.apiKey || !keyAllowsServer(auth.apiKey, server.serverId, serverSlug)) {
    if (rpc.method === "tools/call") {
      const route = resolveToolCall(
        rpc.params,
        server.mcps.map((m) => m.mcpSlug),
        router,
        toolIndexFor(server.serverId, STALE_TOOLS_MAX_AGE_MS)
      );
      const mcp =
        route.kind === "forward" ? server.mcps.find((m) => m.mcpSlug === route.mcpSlug) : null;
      if (mcp && route.kind === "forward") {
        out.track = newToolCallTrack(auth, {
          serverId: server.serverId,
          userServerId: mcp.userServerId,
          mcpSlug: mcp.mcpSlug,
          toolName: route.toolName,
          startedAt,
        });
        out.track.deniedCode = PROXY_ERROR.KEY_RESTRICTED;
      }
    }
    return fail(403, PROXY_ERROR.KEY_RESTRICTED, SERVER_SCOPE_MESSAGE);
  }

  const ctx: AggCtx = {
    req,
    auth,
    serverSlug,
    server,
    rpc,
    rpcId,
    requestId,
    startedAt,
    router,
    out,
  };

  switch (rpc.method) {
    case "initialize":
      // Answered by the control plane: no MCP is woken just to connect. The
      // session id is ours (clients that require one send it back; it is
      // accepted and ignored — every request stands on its own).
      return jsonRpcResult(
        rpcId,
        aggregateInitializeResult(rpc.params?.protocolVersion, { router: ctx.router }),
        { "mcp-session-id": globalThis.crypto.randomUUID() }
      );
    case "ping":
      return jsonRpcResult(rpcId, {});
    case "tools/list":
      return ctx.router ? jsonRpcResult(rpcId, { tools: ROUTER_TOOLS }) : listTools(ctx);
    case "tools/call":
      return callTool(ctx);
    // Only tools are offered; empty answers keep clients that probe anyway quiet.
    case "resources/list":
      return jsonRpcResult(rpcId, { resources: [] });
    case "resources/templates/list":
      return jsonRpcResult(rpcId, { resourceTemplates: [] });
    case "prompts/list":
      return jsonRpcResult(rpcId, { prompts: [] });
    default:
      // Notifications and client responses get no JSON-RPC answer:
      // Streamable HTTP acknowledges them with a bodiless 202.
      if (
        (typeof rpc.method === "string" && rpc.method.startsWith("notifications/")) ||
        isResponse
      ) {
        return new NextResponse(null, { status: 202 });
      }
      return proxyError({
        status: 200,
        code: PROXY_ERROR.METHOD_NOT_FOUND,
        message: `Method not found: ${String(rpc.method)}`,
        requestId,
        rpcId,
      });
  }
}

// ---------------------------------------------------------------------------
// tools/list fan-out
// ---------------------------------------------------------------------------

/**
 * The merged list from a fan-out; its exposed-name index is remembered so a
 * later tools/call finds each MCP's own tool name back.
 */
function mergedList(ctx: AggCtx, entries: readonly FanoutEntry[]): ToolsListResult {
  const { result, index } = buildIndexedToolsList(entries);
  rememberToolIndex(ctx.server.serverId, index);
  return result;
}

async function listTools(ctx: AggCtx): Promise<Response> {
  const entries = await fanOut(ctx, 0);
  const verdict = overheadVerdict(ctx.rpcId);
  if (shouldAnswerWaking(entries)) {
    return wakingUp(
      { requestId: ctx.requestId, verdict },
      "The MCP servers on this server are waking up or still installing. Retry in a few seconds."
    );
  }
  const anyTool = entries.some((e) => e.tools.length > 0);
  if (!anyTool && entries.length > 0 && entries.every((e) => e.state === "unavailable")) {
    return proxyError({
      status: 503,
      code: PROXY_ERROR.UNAVAILABLE,
      message: entries[0]?.reason ?? "No MCP on this server is available right now.",
      requestId: ctx.requestId,
      rpcId: ctx.rpcId,
      headers: { "retry-after": "5" },
    });
  }
  return jsonRpcResult(ctx.rpcId, mergedList(ctx, entries));
}

/** The cache key of an MCP's tool list (the local agent route uses the same). */
function cacheKeyFor(ctx: AggCtx, m: McpRow): string {
  return ctx.server.hostType === "local_agent"
    ? `${connKey(ctx.auth.userId, ctx.serverSlug)}:${m.mcpSlug}`
    : m.userServerId;
}

type BoxState =
  | { kind: "running" | "woken" }
  | { kind: "waking"; reason?: string }
  | { kind: "unavailable"; reason: string };

/**
 * Ask every enabled MCP for its tools, in parallel, each capped at 8 s. With
 * `maxAgeMs` > 0 a list cached that recently is reused instead (router mode).
 * A paused server is woken first: up to 8 s when last known tools can be
 * listed meanwhile, up to COLD_WAKE_BUDGET_MS when there are none (a 503 at
 * connect makes IDE clients give up). An MCP still waking lists the tools it
 * had last time, flagged in a warning. Policy (D2) is applied here.
 */
async function fanOut(ctx: AggCtx, maxAgeMs: number): Promise<FanoutEntry[]> {
  const { server } = ctx;
  const isLocal = server.hostType === "local_agent";
  const boxMcps = server.mcps.filter((m) => m.mcpSlug !== TWINMCP_DOCS_SLUG);
  const allCached =
    maxAgeMs > 0 && boxMcps.every((m) => toolCache.get(cacheKeyFor(ctx, m), maxAgeMs));

  let box: BoxState = { kind: "running" };
  if (!isLocal && boxMcps.length > 0 && !allCached) {
    if (
      isPausedRuntime({
        status: server.serverStatus,
        hostType: server.hostType,
        boxId: server.boxId,
      })
    ) {
      const haveStale = boxMcps.some(
        (m) => (toolCache.get(cacheKeyFor(ctx, m), STALE_TOOLS_MAX_AGE_MS)?.length ?? 0) > 0
      );
      const budget = haveStale
        ? FANOUT_TIMEOUT_MS
        : Math.max(FANOUT_TIMEOUT_MS, COLD_WAKE_BUDGET_MS - (Date.now() - ctx.startedAt));
      const woke = await Promise.race([
        kickWake(server.serverId, ctx.requestId),
        sleep(budget).then(() => null),
      ]);
      box = { kind: woke === true ? "woken" : "waking" };
    } else if (server.serverStatus === "provisioning") {
      // Nothing to start: retryable, like a waking box.
      box = {
        kind: "waking",
        reason: "This server is still provisioning; retry in a minute.",
      };
    } else if (server.serverStatus !== "running") {
      box = {
        kind: "unavailable",
        reason: `Server is ${server.serverStatus}; start it before sending MCP requests`,
      };
    }
  }

  return Promise.all(server.mcps.map((m) => listOne(ctx, m, box, maxAgeMs)));
}

async function listOne(
  ctx: AggCtx,
  m: McpRow,
  box: BoxState,
  maxAgeMs: number
): Promise<FanoutEntry> {
  const entry = (state: FanoutState, raw: McpTool[], reason?: string): FanoutEntry => ({
    mcpSlug: m.mcpSlug,
    state,
    tools: filterToolsList(raw, m.policy),
    ...(reason ? { reason } : {}),
  });
  if (m.mcpSlug === TWINMCP_DOCS_SLUG) return entry("ok", TWINMCP_DOCS_TOOLS);

  const key = cacheKeyFor(ctx, m);
  if (maxAgeMs > 0) {
    const hit = toolCache.get(key, maxAgeMs);
    if (hit) return entry("ok", hit);
  }
  const stale = () => toolCache.get(key, STALE_TOOLS_MAX_AGE_MS) ?? [];

  if (ctx.server.hostType === "local_agent") {
    const probe = await probeAgentTools(
      connKey(ctx.auth.userId, ctx.serverSlug),
      m.mcpSlug,
      FANOUT_TIMEOUT_MS
    );
    if (probe.kind === "ok") {
      toolCache.set(key, probe.tools);
      return entry("ok", probe.tools);
    }
    return entry("unavailable", [], probe.reason);
  }

  if (box.kind === "unavailable") return entry("unavailable", [], box.reason);
  if (box.kind === "waking") {
    return entry(
      "waking",
      stale(),
      box.reason ?? "This server is waking up from a pause; its tools answer in a few seconds."
    );
  }

  let endpoint = m.mcpEndpoint;
  let token: string | null | undefined;
  if (box.kind === "woken") {
    const fresh = await reloadEndpoint(m.userServerId);
    endpoint = fresh?.endpoint ?? null;
    token = fresh?.token ?? null;
  } else {
    token = decryptEndpointToken(m);
    if (token === undefined) {
      return entry("unavailable", stale(), "MCP endpoint credentials unavailable.");
    }
  }
  if (!endpoint) return entry("waking", [], "This MCP is still installing.");

  let probe = await probeBoxTools(endpoint, token ?? null, FANOUT_TIMEOUT_MS);
  if (probe.kind === "asleep") {
    // Same move as the per-MCP endpoint: wake the box (single-flight) — only
    // on a refused connection or a gateway 502/503, never on a slow answer.
    // With last known tools, list them and let the wake finish in the
    // background; with none, wait (within COLD_WAKE_BUDGET_MS) and list again.
    const wake =
      box.kind === "woken" ? Promise.resolve(true) : kickWake(ctx.server.serverId, ctx.requestId);
    const known = stale();
    if (known.length === 0) probe = await wakeAndReprobe(ctx, m, wake, probe);
    if (probe.kind === "asleep") {
      return entry(
        "waking",
        known,
        "This MCP is waking up from idle; its tools answer in a few seconds."
      );
    }
  }
  if (probe.kind === "ok") {
    toolCache.set(key, probe.tools);
    return entry("ok", probe.tools);
  }
  if (probe.kind === "slow") {
    return entry(
      "waking",
      stale(),
      "This MCP is slow to list its tools; they will be listed on the next tools/list."
    );
  }
  return entry("unavailable", stale(), probe.reason);
}

/** Time left in the cold-wake budget of this request. */
function coldBudgetLeft(ctx: AggCtx): number {
  return COLD_WAKE_BUDGET_MS - (Date.now() - ctx.startedAt);
}

/**
 * An asleep box with no last known tools: wait for its wake, then list again
 * while the bridge warms up (npx/uvx), all within the request's cold budget.
 */
async function wakeAndReprobe(
  ctx: AggCtx,
  m: McpRow,
  wake: Promise<boolean>,
  first: Awaited<ReturnType<typeof probeBoxTools>>
): Promise<Awaited<ReturnType<typeof probeBoxTools>>> {
  let probe = first;
  const left = coldBudgetLeft(ctx);
  if (left <= 0) return probe;
  const woke = await Promise.race([wake, sleep(left).then(() => null)]);
  if (woke !== true) return probe;
  while (probe.kind === "asleep" && coldBudgetLeft(ctx) > 0) {
    const fresh = await reloadEndpoint(m.userServerId);
    if (!fresh) return probe;
    probe = await probeBoxTools(
      fresh.endpoint,
      fresh.token,
      Math.min(FANOUT_TIMEOUT_MS, Math.max(1_000, coldBudgetLeft(ctx)))
    );
    if (probe.kind === "asleep" && coldBudgetLeft(ctx) > REPROBE_INTERVAL_MS) {
      await sleep(REPROBE_INTERVAL_MS);
    } else {
      break;
    }
  }
  return probe;
}

// ---------------------------------------------------------------------------
// tools/call routing
// ---------------------------------------------------------------------------

/** A JSON-RPC error answered 200 (invalid params, unknown tool…). */
function rpcError(ctx: AggCtx, code: number, message: string): NextResponse {
  return proxyError({ status: 200, code, message, requestId: ctx.requestId, rpcId: ctx.rpcId });
}

/** A tool result carrying text (router meta-tools). */
function textResult(ctx: AggCtx, text: string, isError = false): NextResponse {
  return jsonRpcResult(ctx.rpcId, {
    content: [{ type: "text", text }],
    ...(isError ? { isError: true } : {}),
  });
}

/**
 * A refusal the model should read and correct: in router mode a tool result
 * with isError (several clients never pass JSON-RPC errors to the model), a
 * JSON-RPC error otherwise.
 */
function callError(ctx: AggCtx, code: number, message: string): NextResponse {
  return ctx.router ? textResult(ctx, message, true) : rpcError(ctx, code, message);
}

/** The `_meta` warnings of a merged list, as one line for a not-found answer. */
function warningsLine(result: ToolsListResult): string {
  const warnings = result._meta?.[WARNINGS_META_KEY];
  if (!Array.isArray(warnings) || warnings.length === 0) return "";
  const parts = warnings.map((w: { mcp?: unknown; message?: unknown }) => {
    return `${String(w.mcp)}: ${String(w.message)}`;
  });
  return ` Some MCPs did not list their tools: ${parts.join(" ")}`;
}

async function callTool(ctx: AggCtx): Promise<Response> {
  const slugs = ctx.server.mcps.map((m) => m.mcpSlug);
  let index: ToolNameIndex | null = toolIndexFor(ctx.server.serverId, STALE_TOOLS_MAX_AGE_MS);
  let route = resolveToolCall(ctx.rpc.params, slugs, ctx.router, index);
  if (!index && (route.kind === "forward" || route.kind === "invalid")) {
    // No list merged by this process yet (a restart): exposed names may be
    // client-safe rewrites or hashes, so rebuild the index (cached lists
    // first) before trusting the plain `<slug>__<tool>` split.
    mergedList(ctx, await fanOut(ctx, STALE_TOOLS_MAX_AGE_MS));
    // The fan-out may have woken the box (status, endpoint and token change):
    // route the call with the current row, so it is not woken a second time.
    ctx.server = (await loadServer(ctx.auth.userId, ctx.serverSlug)) ?? ctx.server;
    index = toolIndexFor(ctx.server.serverId, STALE_TOOLS_MAX_AGE_MS);
    route = resolveToolCall(
      ctx.rpc.params,
      ctx.server.mcps.map((m) => m.mcpSlug),
      ctx.router,
      index
    );
  }
  switch (route.kind) {
    case "invalid":
      return callError(ctx, PROXY_ERROR.INVALID_PARAMS, route.message);
    case "search":
    case "schema": {
      // Router meta-tools: answered here from the merged (policy-filtered)
      // list, cached ~60 s; they never reach an MCP and are free.
      const result = mergedList(ctx, await fanOut(ctx, ROUTER_TOOLS_MAX_AGE_MS));
      if (route.kind === "search") {
        const answer = searchToolsAnswer(
          result.tools,
          route.query,
          route.limit,
          result._meta?.[WARNINGS_META_KEY]
        );
        return textResult(ctx, JSON.stringify(answer, null, 2));
      }
      const tool = result.tools.find((t) => t.name === route.name);
      if (!tool) {
        return textResult(
          ctx,
          `Unknown tool: ${JSON.stringify(route.name)}. Use search_tools to find tool names.${warningsLine(result)}`,
          true
        );
      }
      return textResult(ctx, describeToolSchema(tool));
    }
    case "forward": {
      const mcp = ctx.server.mcps.find((m) => m.mcpSlug === route.mcpSlug);
      if (!mcp) {
        return callError(ctx, PROXY_ERROR.INVALID_PARAMS, `Unknown MCP: ${route.mcpSlug}`);
      }
      return routeToolCall(ctx, mcp, route.toolName, route.params);
    }
  }
}

/**
 * One tools/call to one MCP of the server, with the per-MCP endpoint's rules:
 * the billing gate first (per-minute limiter, then the wallet: nothing is
 * woken for a call that cannot be paid), then the tool policy, then the
 * forward (box: wake/retry; local agent; control-plane docs), one charged
 * call once the MCP answered, the activity log, first-call activation.
 */
async function routeToolCall(
  ctx: AggCtx,
  mcp: McpRow,
  toolName: string,
  params: Record<string, unknown>
): Promise<Response> {
  const track = newToolCallTrack(ctx.auth, {
    serverId: ctx.server.serverId,
    userServerId: mcp.userServerId,
    mcpSlug: mcp.mcpSlug,
    toolName,
    startedAt: ctx.startedAt,
  });
  ctx.out.track = track;

  const verdict: BillableVerdict = {
    billable: true,
    needsCredit: true,
    units: 1,
    rpcMethod: "tools/call",
    rpcId: ctx.rpcId,
  };
  const relay: RelayCtx = {
    auth: ctx.auth,
    requestId: ctx.requestId,
    verdict,
    meter: toolCallMeter(ctx.auth.userId, mcp.userServerId, true),
  };

  // Billing gate (contract W2): 429 / 402 before anything is woken or
  // forwarded, in router mode too (an HTTP-level refusal, like the 401).
  const gated = await billingGate(relay);
  if (gated) return gated;

  const body = buildForwardedToolCall(ctx.rpcId, params, toolName);
  const isDocs = mcp.mcpSlug === TWINMCP_DOCS_SLUG;
  const isLocal = !isDocs && ctx.server.hostType === "local_agent";
  const agentKey = connKey(ctx.auth.userId, ctx.serverSlug);
  const target: BoxTarget = {
    serverId: ctx.server.serverId,
    serverStatus: ctx.server.serverStatus,
    hostType: ctx.server.hostType,
    boxId: ctx.server.boxId,
    userServerId: mcp.userServerId,
    mcpEndpoint: mcp.mcpEndpoint,
    tokenCiphertext: mcp.tokenCiphertext,
    tokenIv: mcp.tokenIv,
    tokenTag: mcp.tokenTag,
  };
  const bridge = { accept: "application/json, text/event-stream" };

  // Tool policy (contract D2).
  if (!isUnrestricted(mcp.policy)) {
    let known: McpTool[] | null = null;
    if (policyNeedsToolAnnotations(mcp.policy)) {
      if (isDocs) known = TWINMCP_DOCS_TOOLS;
      else known = toolCache.get(cacheKeyFor(ctx, mcp), POLICY_TOOLS_MAX_AGE_MS);
      if (!known && isLocal) {
        // Offline first: an absent agent is "retry", not "denied".
        if (!isAgentOnline(agentKey)) {
          relay.meter(false);
          return agentOffline(relay);
        }
        const probe = await probeAgentTools(agentKey, mcp.mcpSlug, FANOUT_TIMEOUT_MS);
        if (probe.kind === "ok") known = probe.tools;
      } else if (!known) {
        // Every page of the list: a tool on page 2 must not be denied.
        const pre = await fetchAllBoxTools(relay, target, bridge);
        if (!pre.ok) return pre.response;
        known = pre.tools;
      }
      if (known && !isDocs) toolCache.set(cacheKeyFor(ctx, mcp), known);
    }
    if (!isToolCallAllowed(toolName, mcp.policy, known)) {
      track.deniedCode = TOOL_POLICY_DENIED_CODE;
      return ctx.router
        ? textResult(ctx, toolDeniedMessage(toolName, mcp.policy), true)
        : policyDenied(relay, toolName, mcp.policy);
    }
  }

  // TwinMCP Docs: served by the control plane, as on the per-MCP route.
  if (isDocs) {
    // Metered, charged and logged from the real outcome: a failed lookup is
    // answered as a 200 JSON-RPC error and is not charged.
    return handleTwinMcpDocs(
      ctx.req,
      {
        jsonrpc: "2.0",
        id: ctx.rpcId,
        method: "tools/call",
        params: { ...params, name: toolName },
      },
      ctx.requestId,
      () => {
        relay.meter(true);
        noteFirstToolCall(ctx.auth.userId, mcp.mcpSlug);
      },
      TWINMCP_DOCS_TOOLS,
      (code) => {
        relay.meter(false);
        track.failedCode = code;
      }
    );
  }

  if (isLocal) {
    return toJsonAnswer(await callLocalAgent(relay, agentKey, mcp.mcpSlug, body), ctx);
  }

  const result = await forwardToBox(relay, target, {
    method: "POST",
    bodyText: body,
    contentType: "application/json",
    headers: bridge,
  });
  if (!result.ok) return result.response;
  const ok = result.response.status < 400;
  relay.meter(ok);
  if (ok) noteFirstToolCall(ctx.auth.userId, mcp.mcpSlug);
  return toJsonAnswer(result.response, ctx);
}

/**
 * The aggregate answers plain JSON: read the MCP's JSON-RPC response out of
 * its JSON or SSE body (progress notifications are dropped), within a 10 MB
 * cap and a deadline. An answer the proxy produced itself (it carries the
 * request-id header) passes untouched.
 */
async function toJsonAnswer(res: Response, ctx: AggCtx): Promise<Response> {
  if (res.headers.has(PROXY_REQUEST_ID_HEADER)) return res;
  const body = await readBodyCapped(res);
  if (body.kind === "too_large") {
    return proxyError({
      status: 502,
      code: PROXY_ERROR.INTERNAL,
      message:
        "The tool result is larger than 10 MB, more than the server endpoint relays. Use this MCP's own URL, which streams results.",
      requestId: ctx.requestId,
      rpcId: ctx.rpcId,
    });
  }
  if (body.kind === "timeout") {
    return toolCallUncertain({ requestId: ctx.requestId, verdict: overheadVerdict(ctx.rpcId) });
  }
  const text = body.text;
  const message = extractJsonRpcResponse(text, res.headers.get("content-type"), ctx.rpcId);
  if (message) return NextResponse.json(message, { status: res.status });
  return proxyError({
    status: res.status >= 500 || res.status < 400 ? 502 : res.status,
    code: PROXY_ERROR.INTERNAL,
    message:
      res.status < 400
        ? "The MCP returned an answer the proxy could not read."
        : `The MCP answered HTTP ${res.status}.`,
    requestId: ctx.requestId,
    rpcId: ctx.rpcId,
  });
}
