import { type NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { authenticateRequest } from "@/lib/auth";
import { keyAllowsServer, SERVER_SCOPE_MESSAGE } from "@/lib/auth/key-scope";
import { decryptConfig } from "@/lib/crypto/config-encryption";
import { emitWebhookEvent } from "@/lib/webhooks/emit";
import {
  agentLinkExpired,
  connKey,
  getAgent,
  mayReplaceAgent,
  registerAgent,
  unregisterAgent,
  type AgentConn,
} from "@/lib/agent/registry";
import { cliCommand } from "@/lib/cli";

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

/**
 * Reflect agent presence through the server's status (online → running), and
 * emit server.status_changed (contract D5) when it actually changes.
 */
async function setServerStatus(
  userId: string,
  serverId: string,
  status: "running" | "stopped"
): Promise<void> {
  try {
    const db = getDb();
    const [before] = await db
      .select({ status: servers.status })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);
    await db
      .update(servers)
      .set({ status, lastHeartbeatAt: new Date(), updatedAt: new Date() })
      .where(eq(servers.id, serverId));
    if (before && before.status !== status) {
      emitWebhookEvent(userId, "server.status_changed", {
        serverId,
        from: before.status,
        to: status,
      });
    }
  } catch {
    // Presence is best-effort: never break the agent link over it.
  }
}

/**
 * Local agent link: a long-lived SSE stream the agent (CLI `connect`) holds open
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
  // Contract K1: a key bound to another server must not open this link (the
  // init event below carries the server's decrypted MCP config).
  // Fails closed: a context without a key (never produced today) is refused.
  if (!auth.apiKey || !keyAllowsServer(auth.apiKey, srv.id)) {
    return NextResponse.json({ message: SERVER_SCOPE_MESSAGE, code: "key_scope" }, { status: 403 });
  }
  // A remote OAuth connector (contract D4) has no reason to open a local-agent
  // link, and the init event carries the server's decrypted MCP config.
  if (auth.via === "oauth") {
    return NextResponse.json(
      {
        message: `Use an API key ('Bearer ctx7sk_...') for ${cliCommand("connect")}.`,
        code: "key_scope",
      },
      { status: 403 }
    );
  }
  if (srv.hostType !== "local_agent") {
    return NextResponse.json({ message: "Server is not a local-agent server" }, { status: 409 });
  }

  const key = connKey(auth.userId, serverSlug);
  const apiKeyId = auth.apiKey.id;
  // Another key already holds the live link: refuse instead of handing it the
  // decrypted env and the owner's relayed tool calls (registry mayReplaceAgent).
  if (!mayReplaceAgent(getAgent(key), apiKeyId)) {
    console.warn(`[agent/link] refused takeover of ${serverSlug} by key ${apiKeyId}`);
    return NextResponse.json(
      {
        message:
          "Another agent is already connected to this server with a different API key. Stop it (or revoke its key) first.",
        code: "agent_already_connected",
      },
      { status: 409 }
    );
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

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        cleanup();
      };

      // Register first (it can lose a race against another key), then tell the
      // agent what to run.
      const conn: AgentConn = { send: (e) => write(e), connectedAt: Date.now(), apiKeyId, close };
      if (!registerAgent(key, conn)) {
        write({ type: "error", message: "Another agent is already connected to this server." });
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
        return;
      }
      write({ type: "init", server: serverSlug, mcps });
      void setServerStatus(auth.userId, srv.id, "running");

      // Heartbeat keeps the proxy/Traefik connection alive and lets the agent
      // detect a dead link. Each beat also re-checks the key (the auth cache is
      // cleared on revoke / rotate, so this reaches the DB) and the link's
      // lifetime: a revoked, expired or re-scoped key, or a link older than
      // AGENT_LINK_MAX_MS, is closed (the CLI reconnects with a valid key).
      const hb = setInterval(() => {
        void (async () => {
          if (closed) return;
          if (agentLinkExpired(conn.connectedAt)) return close();
          let again: Awaited<ReturnType<typeof authenticateRequest>> | undefined;
          try {
            again = await authenticateRequest(req);
          } catch {
            again = undefined; // transient DB error: keep the link, retry next beat
          }
          if (
            again === null ||
            (again &&
              (again.userId !== auth.userId ||
                !again.apiKey ||
                !keyAllowsServer(again.apiKey, srv.id)))
          ) {
            return close();
          }
          write({ type: "ping" });
        })();
      }, 20_000);

      cleanup = () => {
        clearInterval(hb);
        // Only report the server offline if this link was still the current
        // one (a same-key reconnect replaces it while staying online).
        if (unregisterAgent(key, conn)) void setServerStatus(auth.userId, srv.id, "stopped");
      };

      req.signal.addEventListener("abort", close);
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
