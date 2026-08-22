import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { authenticateRequest } from "@/lib/auth";
import { decryptConfig } from "@/lib/crypto/config-encryption";
import { connKey, registerAgent, unregisterAgent, type AgentConn } from "@/lib/agent/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    {
      message: "Invalid API key. Provide your TwinMCP key as 'Authorization: Bearer ctx7sk_...'.",
    },
    { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="twinmcp"' } }
  );
}

/** Reflect agent presence through the server's status (online → running). */
async function setServerStatus(serverId: string, status: "running" | "stopped"): Promise<void> {
  await getDb()
    .update(servers)
    .set({ status, lastHeartbeatAt: new Date(), updatedAt: new Date() })
    .where(eq(servers.id, serverId))
    .catch(() => {});
}

/**
 * Local agent link: a long-lived SSE stream the agent (`ctx7 connect`) holds open
 * for one local-agent server. The stream first delivers an `init` event listing
 * the local tools to run (+ decrypted config as env), then carries relayed
 * JSON-RPC `request` events pushed by the MCP proxy. The agent answers each via
 * POST /api/agent/respond.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return unauthorized();

  const serverSlug = new URL(req.url).searchParams.get("server")?.trim();
  if (!serverSlug) {
    return NextResponse.json({ message: "Missing ?server=<slug>" }, { status: 400 });
  }

  const db = getDb();
  const [srv] = await db
    .select({ id: servers.id, hostType: servers.hostType })
    .from(servers)
    .where(and(eq(servers.userId, auth.userId), eq(servers.slug, serverSlug)))
    .limit(1);
  if (!srv) {
    return NextResponse.json({ message: `Server '${serverSlug}' not found` }, { status: 404 });
  }
  if (srv.hostType !== "local_agent") {
    return NextResponse.json({ message: "Server is not a local-agent server" }, { status: 409 });
  }

  // The tools the agent should run locally: enabled `local` tools on this server,
  // each with its start command and decrypted config (owner-only, delivered over
  // the authenticated stream).
  const rows = await db
    .select({
      slug: mcpServers.slug,
      name: mcpServers.name,
      runtime: mcpServers.runtime,
      startCmd: mcpServers.startCmd,
      hostMode: mcpServers.hostMode,
      cipher: userServers.configCiphertext,
      iv: userServers.configIv,
      tag: userServers.configTag,
    })
    .from(userServers)
    .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
    .where(and(eq(userServers.serverId, srv.id), eq(userServers.enabled, true)));

  const mcps = rows
    .filter((r) => r.hostMode === "local")
    .map((r) => {
      let env: Record<string, unknown> = {};
      if (r.cipher) {
        try {
          env = decryptConfig<Record<string, unknown>>({
            ciphertext: r.cipher,
            iv: r.iv,
            tag: r.tag,
          });
        } catch {
          env = {};
        }
      }
      return { slug: r.slug, name: r.name, runtime: r.runtime, startCmd: r.startCmd, env };
    });

  const key = connKey(auth.userId, serverSlug);
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      const write = (obj: unknown) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
        } catch {
          /* stream already closed */
        }
      };

      // Tell the agent what to run, then register it for relayed requests.
      write({ type: "init", server: serverSlug, mcps });
      const conn: AgentConn = { send: (e) => write(e), connectedAt: Date.now() };
      registerAgent(key, conn);
      void setServerStatus(srv.id, "running");

      // Heartbeat keeps the proxy/Traefik connection alive and lets the agent
      // detect a dead link.
      const hb = setInterval(() => write({ type: "ping" }), 20_000);

      cleanup = () => {
        clearInterval(hb);
        unregisterAgent(key, conn);
        void setServerStatus(srv.id, "stopped");
      };

      req.signal.addEventListener("abort", () => {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        cleanup();
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
