import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { authenticateRequest } from "@/lib/auth";
import { jsonError, unauthorized } from "@/lib/errors";
import { TWINMCP_DOCS_SLUG } from "@/lib/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

function jsonRpcError(id: unknown, code: number, message: string, status = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status }
  );
}

function jsonRpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ serverSlug: string; mcpSlug: string }> }
) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();
  const { serverSlug, mcpSlug } = await params;

  const db = getDb();
  const [row] = await db
    .select({
      serverId: servers.id,
      serverStatus: servers.status,
      serverEndpoint: servers.endpointUrl,
      userServerId: userServers.id,
      enabled: userServers.enabled,
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

  let rpc: JsonRpcRequest;
  try {
    rpc = await req.json();
  } catch {
    return jsonError(400, "Invalid JSON-RPC body");
  }

  // Special case: TwinMCP Docs is served by the control plane, not by the box.
  if (mcpSlug === TWINMCP_DOCS_SLUG) {
    return handleTwinMcpDocs(req, rpc);
  }

  // Regular case: server must be running, box must have an endpoint.
  if (row.serverStatus !== "running") {
    return jsonError(503, `Server is ${row.serverStatus}; start it before sending MCP requests`);
  }
  if (!row.serverEndpoint) {
    return jsonError(503, "Server endpoint not yet provisioned");
  }

  // Forward to the box. The exact URL pattern Upstash uses is not yet wired —
  // this hits the box's public URL with the MCP slug as the path segment.
  const targetUrl = `${row.serverEndpoint.replace(/\/$/, "")}/${mcpSlug}`;
  try {
    const upstream = await fetch(targetUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rpc),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    console.error("[mcp proxy] upstream error:", err);
    return jsonRpcError(rpc.id, -32000, "Upstream MCP unreachable");
  }
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
        return jsonRpcError(rpc.id, -32000, `Upstream error: ${inner.status} ${text.slice(0, 200)}`);
      }
      return jsonRpcResult(rpc.id, {
        content: [{ type: "text", text }],
      });
    }

    default:
      return jsonRpcError(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }
}
