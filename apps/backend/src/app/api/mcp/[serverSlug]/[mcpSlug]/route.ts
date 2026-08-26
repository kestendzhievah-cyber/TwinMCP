import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { authenticateRequest, type AuthedContext } from "@/lib/auth";
import { jsonError, rateLimited } from "@/lib/errors";
import { TWINMCP_DOCS_SLUG, resumeServer } from "@/lib/provisioning";
import { decryptConfig } from "@/lib/crypto/config-encryption";
import { MCP_STREAM_PATH } from "@/lib/upstash/mcp-bridge";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordMcpUsage } from "@/lib/usage-metrics";
import { connKey, isAgentOnline, relayToAgent } from "@/lib/agent/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

type Method = "GET" | "POST" | "DELETE";

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status }
  );
}

function jsonRpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

/** 401 with WWW-Authenticate so MCP clients can bootstrap auth discovery. */
function unauthorizedMcp() {
  return NextResponse.json(
    {
      message: "Invalid API key. Provide your TwinMCP key as 'Authorization: Bearer ctx7sk_...'.",
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="twinmcp", error="invalid_token"' },
    }
  );
}

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

async function handleProxy(req: NextRequest, { params }: RouteCtx, method: Method) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorizedMcp();
  const { serverSlug, mcpSlug } = await params;

  const db = getDb();
  const [row] = await db
    .select({
      serverId: servers.id,
      serverStatus: servers.status,
      hostType: servers.hostType,
      enabled: userServers.enabled,
      userServerId: userServers.id,
      mcpEndpoint: userServers.endpointUrl,
      tokenCiphertext: userServers.endpointTokenCiphertext,
      tokenIv: userServers.endpointTokenIv,
      tokenTag: userServers.endpointTokenTag,
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

  if (!row) return jsonError(404, `Server '${serverSlug}' or MCP '${mcpSlug}' not found`);
  if (!row.enabled) return jsonError(409, "MCP is disabled");

  // Per-MCP usage metering (fire-and-forget; never blocks the request).
  const meter = (ok: boolean) => recordMcpUsage(row.userServerId, ok);

  // Local-agent MCP: served by the user's own machine over a live relay, not a
  // box. Skip every box gate and route to the connected agent.
  if (row.hostType === "local_agent") {
    return handleLocalAgent(req, auth, serverSlug, mcpSlug, method, meter);
  }

  // TwinMCP Docs is served by the control plane (no box). It is stateless and
  // offers no server→client SSE stream, so only POST is meaningful. Its rate
  // limit is enforced by its backing /api/v2/context (not double-counted here).
  if (mcpSlug === TWINMCP_DOCS_SLUG) {
    if (method !== "POST") {
      return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
    }
    let rpc: JsonRpcRequest;
    try {
      rpc = (await req.json()) as JsonRpcRequest;
    } catch {
      return jsonError(400, "Invalid JSON-RPC body");
    }
    meter(true);
    return handleTwinMcpDocs(req, rpc);
  }

  // Rate-limit real (box) MCP traffic at the proxy — the shared daily quota
  // (free/pro/team) applies to MCP requests, not just /v2/context + /v2/libs.
  const rl = await checkRateLimit(auth.userId, auth.plan);
  if (!rl.ok) {
    meter(false);
    return rateLimited(true);
  }

  // Real MCP: server must be running and the bridge must be provisioned.
  if (row.serverStatus !== "running") {
    meter(false);
    return jsonError(503, `Server is ${row.serverStatus}; start it before sending MCP requests`);
  }
  if (!row.mcpEndpoint) {
    meter(false);
    return jsonError(503, "MCP endpoint not yet provisioned; restart the server");
  }

  // The box public URL is bearer-protected; decrypt the token so it never
  // leaves the control plane.
  let boxToken: string | null = null;
  if (row.tokenCiphertext) {
    try {
      boxToken = decryptConfig<string>({
        ciphertext: row.tokenCiphertext,
        iv: row.tokenIv,
        tag: row.tokenTag,
      });
    } catch (err) {
      console.error("[mcp proxy] token decrypt failed:", err);
      Sentry.captureException(err, { tags: { area: "mcp-proxy", stage: "token-decrypt" } });
      meter(false);
      return jsonError(502, "MCP endpoint credentials unavailable");
    }
  }

  // Read the body once so it can be replayed on a resume-and-retry.
  const bodyText = method === "POST" ? await req.text() : undefined;
  const contentType =
    method === "POST" ? (req.headers.get("content-type") ?? "application/json") : undefined;

  let upstream = await forwardOnce(req, row.mcpEndpoint, boxToken, method, bodyText, contentType);

  // A connection error / gateway 5xx means the box is likely paused (non-keep-
  // alive boxes pause when idle). Wake it, refresh the endpoint + token (the
  // re-exposed URL is deterministic; the token may rotate), retry while it warms.
  if (needsResume(upstream)) {
    try {
      await resumeServer(row.serverId);
    } catch (err) {
      console.error("[mcp proxy] resume failed:", err);
      Sentry.captureException(err, {
        tags: { area: "mcp-proxy", stage: "resume" },
        extra: { serverId: row.serverId },
      });
    }
    const fresh = await reloadEndpoint(row.userServerId);
    // The bridge is cold-restarting (npx/uvx warm-up) — retry for ~30s.
    for (let i = 0; fresh && i < 10 && needsResume(upstream); i++) {
      upstream = await forwardOnce(req, fresh.endpoint, fresh.token, method, bodyText, contentType);
      if (needsResume(upstream)) await sleep(3000);
    }
  }

  if (needsResume(upstream)) {
    meter(false);
    return wakingUp(bodyText);
  }
  const finalResp = upstream as Response;
  meter(finalResp.status < 400);
  return relay(finalResp);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Unreachable or gateway error → the box may be paused; try a resume. */
function needsResume(u: Response | null): boolean {
  return !u || u.status === 502 || u.status === 503 || u.status === 504;
}

/** Best-effort JSON-RPC request id so a wake-up error echoes the caller's id. */
function requestId(bodyText: string | undefined): string | number | null {
  if (!bodyText) return null;
  try {
    const parsed = JSON.parse(bodyText);
    const id = Array.isArray(parsed) ? parsed[0]?.id : parsed?.id;
    return typeof id === "string" || typeof id === "number" ? id : null;
  } catch {
    return null;
  }
}

/** JSON-RPC-shaped 503 so MCP clients surface a clean, retryable error while a
 *  paused box finishes waking, instead of a bare text body. */
function wakingUp(bodyText: string | undefined): NextResponse {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: requestId(bodyText),
      error: {
        code: -32001,
        message: "MCP server is waking up from idle. Retry in a few seconds.",
      },
    },
    { status: 503, headers: { "retry-after": "3" } }
  );
}

// ---------------------------------------------------------------------------
// Local-agent relay. The MCP runs on the user's machine (via `ctx7 connect`);
// we relay the JSON-RPC request over the agent's live link instead of forwarding
// to a box. Request/response only in v1 (no server→client SSE stream).
// ---------------------------------------------------------------------------
async function handleLocalAgent(
  req: NextRequest,
  auth: AuthedContext,
  serverSlug: string,
  mcpSlug: string,
  method: Method,
  meter: (ok: boolean) => void
): Promise<NextResponse> {
  if (method !== "POST") {
    return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
  }

  const rl = await checkRateLimit(auth.userId, auth.plan);
  if (!rl.ok) {
    meter(false);
    return rateLimited(true);
  }

  const bodyText = await req.text();
  const key = connKey(auth.userId, serverSlug);
  if (!isAgentOnline(key)) {
    meter(false);
    return agentOffline(bodyText);
  }

  try {
    const resp = await relayToAgent(key, mcpSlug, bodyText);
    meter(resp.ok);
    return new NextResponse(resp.body, {
      status: resp.ok ? 200 : 502,
      headers: { "content-type": resp.contentType ?? "application/json" },
    });
  } catch (err) {
    console.error("[mcp proxy] local-agent relay failed:", err);
    meter(false);
    return agentOffline(bodyText);
  }
}

/** JSON-RPC 503 shown when no local agent is currently connected for the server. */
function agentOffline(bodyText: string | undefined): NextResponse {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: requestId(bodyText),
      error: {
        code: -32001,
        message: "Local agent offline — run `ctx7 connect` on the machine that hosts this tool.",
      },
    },
    { status: 503, headers: { "retry-after": "3" } }
  );
}

// ---------------------------------------------------------------------------
// Streamable HTTP relay to the in-box supergateway bridge. One attempt; returns
// the raw upstream Response, or null on a connection error (box likely paused).
// ---------------------------------------------------------------------------
async function forwardOnce(
  req: NextRequest,
  endpoint: string,
  boxToken: string | null,
  method: Method,
  bodyText: string | undefined,
  contentType: string | undefined
): Promise<Response | null> {
  const targetUrl = `${endpoint.replace(/\/$/, "")}${MCP_STREAM_PATH}`;
  const headers: Record<string, string> = {
    accept:
      req.headers.get("accept") ??
      (method === "GET" ? "text/event-stream" : "application/json, text/event-stream"),
  };
  passHeader(req, headers, "mcp-session-id");
  passHeader(req, headers, "mcp-protocol-version");
  passHeader(req, headers, "last-event-id");
  if (boxToken) headers.authorization = `Bearer ${boxToken}`;

  const init: RequestInit = { method, headers };
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (method === "POST") {
    headers["content-type"] = contentType ?? "application/json";
    init.body = bodyText ?? "";
    // A JSON-RPC POST returns promptly; cap it so a hung/paused box surfaces as
    // a resume-and-retry instead of blocking the worker indefinitely. GET is the
    // long-lived server→client SSE stream — never time that out.
    const ac = new AbortController();
    timer = setTimeout(() => ac.abort(), 20_000);
    init.signal = ac.signal;
  }

  try {
    return await fetch(targetUrl, init);
  } catch (err) {
    console.error("[mcp proxy] upstream error:", err);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Reload the (possibly resume-refreshed) endpoint + decrypted token for an MCP. */
async function reloadEndpoint(
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

/** Build the streamed NextResponse from an upstream bridge Response. */
function relay(upstream: Response): NextResponse {
  const out = new Headers();
  copyHeader(upstream.headers, out, "content-type", "application/json");
  copyHeader(upstream.headers, out, "mcp-session-id");
  copyHeader(upstream.headers, out, "mcp-protocol-version");
  if ((out.get("content-type") ?? "").includes("text/event-stream")) {
    out.set("cache-control", "no-cache, no-transform");
    out.set("connection", "keep-alive");
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: out });
}

function passHeader(req: NextRequest, out: Record<string, string>, name: string) {
  const v = req.headers.get(name);
  if (v) out[name] = v;
}

function copyHeader(src: Headers, dst: Headers, name: string, fallback?: string) {
  const v = src.get(name) ?? fallback;
  if (v) dst.set(name, v);
}

// ---------------------------------------------------------------------------
// TwinMCP Docs handler — minimal MCP protocol over JSON-RPC.
// Exposes a single tool `get-context` that wraps GET /api/v2/context.
// ---------------------------------------------------------------------------
async function handleTwinMcpDocs(req: Request, rpc: JsonRpcRequest): Promise<NextResponse> {
  switch (rpc.method) {
    case "initialize":
      return jsonRpcResult(rpc.id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "twinmcp-docs", version: "1.0.0" },
      });

    case "tools/list":
      return jsonRpcResult(rpc.id, {
        tools: [
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
          },
        ],
      });

    case "tools/call": {
      const params = (rpc.params ?? {}) as {
        name?: string;
        arguments?: { query?: string; libraryId?: string };
      };
      if (params.name !== "get-context") {
        return jsonRpcError(rpc.id, -32601, `Unknown tool: ${params.name}`);
      }
      const args = params.arguments ?? {};
      if (!args.query || !args.libraryId) {
        return jsonRpcError(rpc.id, -32602, "Missing required argument: query or libraryId");
      }

      const url = new URL(req.url);
      const internalUrl = `${url.origin}/api/v2/context?query=${encodeURIComponent(
        args.query
      )}&libraryId=${encodeURIComponent(args.libraryId)}`;
      const inner = await fetch(internalUrl, {
        headers: { authorization: req.headers.get("authorization") ?? "" },
      });
      const text = await inner.text();
      if (!inner.ok) {
        return jsonRpcError(
          rpc.id,
          -32000,
          `Upstream error: ${inner.status} ${text.slice(0, 200)}`
        );
      }
      return jsonRpcResult(rpc.id, {
        content: [{ type: "text", text }],
      });
    }

    default:
      return jsonRpcError(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }
}
