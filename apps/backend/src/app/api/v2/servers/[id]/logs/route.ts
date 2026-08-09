import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, like } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, userServers, mcpServers } from "@/db/schema/platform";
import { usageEvents } from "@/db/schema/core";
import { forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { getBoxClient } from "@/lib/upstash/box-client";
import { logFileForMcp, TWINMCP_DOCS_SLUG } from "@/lib/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface LogLine {
  ts: string | null;
  source: string;
  message: string;
}

const ISO_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/;

function parseLines(raw: string, source: string): LogLine[] {
  return raw
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .map((line) => {
      const m = line.match(ISO_RE);
      if (m) {
        return { ts: m[1], source, message: line.slice(m[1].length).trimStart() };
      }
      return { ts: null, source, message: line };
    });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id } = await params;

  const url = new URL(req.url);
  const slugFilter = url.searchParams.get("slug")?.trim() || "all";
  const lines = Math.max(1, Math.min(Number(url.searchParams.get("lines") ?? 200), 2000));

  try {
    const srv = await assertServerOwnership(session.userId, id);
    const db = getDb();

    // Special case: TwinMCP Docs is served by the control plane.
    // We synthesize logs from usage_events for the proxy endpoint.
    if (slugFilter === TWINMCP_DOCS_SLUG) {
      const sinceWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          ts: usageEvents.timestamp,
          endpoint: usageEvents.endpoint,
          status: usageEvents.statusCode,
          latency: usageEvents.latencyMs,
        })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, session.userId),
            like(usageEvents.endpoint, `%/api/mcp/${srv.slug}/${TWINMCP_DOCS_SLUG}%`),
            gte(usageEvents.timestamp, sinceWindow)
          )
        )
        .orderBy(desc(usageEvents.timestamp))
        .limit(lines);

      return NextResponse.json({
        slug: TWINMCP_DOCS_SLUG,
        source: "control-plane",
        boxId: null,
        fetchedAt: new Date().toISOString(),
        lines: rows
          .map((r) => ({
            ts: r.ts.toISOString(),
            source: TWINMCP_DOCS_SLUG,
            message: `${r.status} ${r.endpoint} (${r.latency}ms)`,
          }))
          .reverse(),
      });
    }

    // For real MCPs we need a running box.
    if (srv.status !== "running" || !srv.boxId) {
      return NextResponse.json({
        slug: slugFilter,
        source: "box",
        boxId: srv.boxId,
        fetchedAt: new Date().toISOString(),
        lines: [],
        notice: `Server is ${srv.status}; no logs available.`,
      });
    }

    const client = getBoxClient();

    if (slugFilter === "all") {
      const installed = await db
        .select({ slug: mcpServers.slug })
        .from(userServers)
        .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
        .where(eq(userServers.serverId, srv.id));

      const allLines: LogLine[] = [];
      for (const m of installed) {
        if (m.slug === TWINMCP_DOCS_SLUG) continue;
        const raw = await client.tail(srv.boxId, logFileForMcp(m.slug), Math.ceil(lines / Math.max(installed.length, 1)));
        allLines.push(...parseLines(raw, m.slug));
      }
      // Sort by timestamp when present, keep insertion order otherwise
      allLines.sort((a, b) => {
        if (!a.ts && !b.ts) return 0;
        if (!a.ts) return -1;
        if (!b.ts) return 1;
        return a.ts.localeCompare(b.ts);
      });
      return NextResponse.json({
        slug: "all",
        source: "box",
        boxId: srv.boxId,
        fetchedAt: new Date().toISOString(),
        lines: allLines.slice(-lines),
      });
    }

    // Single MCP slug — verify it's installed on this server (else 404)
    const [match] = await db
      .select({ id: userServers.id })
      .from(userServers)
      .innerJoin(mcpServers, eq(mcpServers.id, userServers.mcpServerId))
      .where(and(eq(userServers.serverId, srv.id), eq(mcpServers.slug, slugFilter)))
      .limit(1);
    if (!match) return notFound(`MCP '${slugFilter}' not installed on this server`);

    const raw = await client.tail(srv.boxId, logFileForMcp(slugFilter), lines);
    return NextResponse.json({
      slug: slugFilter,
      source: "box",
      boxId: srv.boxId,
      fetchedAt: new Date().toISOString(),
      lines: parseLines(raw, slugFilter),
    });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[server logs]", err);
    return serverError();
  }
}
