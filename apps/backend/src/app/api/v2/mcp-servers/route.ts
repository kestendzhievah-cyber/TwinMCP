import { randomUUID } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers, users } from "@/db/schema";
import { badRequest, forbidden, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { createMcpServerSchema } from "@/lib/validation/platform";
import { can, minPlanFor, PLAN_LABELS } from "@/lib/plan-features";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const runtimeFilter = url.searchParams.get("runtime")?.trim();
  const isOfficial = url.searchParams.get("official");
  const cursor = url.searchParams.get("cursor");
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? PAGE_SIZE) || PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  try {
    const visibility = or(
      eq(mcpServers.isPublic, true),
      eq(mcpServers.publishedByUserId, session.userId)
    );
    const filters = [visibility];
    if (q) {
      filters.push(or(ilike(mcpServers.name, `%${q}%`), ilike(mcpServers.slug, `%${q}%`))!);
    }
    if (runtimeFilter) filters.push(eq(mcpServers.runtime, runtimeFilter as never));
    if (isOfficial === "true") filters.push(eq(mcpServers.isOfficial, true));
    if (cursor) filters.push(sql`${mcpServers.createdAt} < ${new Date(cursor)}`);

    const rows = await getDb()
      .select({
        id: mcpServers.id,
        slug: mcpServers.slug,
        name: mcpServers.name,
        description: mcpServers.description,
        runtime: mcpServers.runtime,
        version: mcpServers.version,
        repoUrl: mcpServers.repoUrl,
        isOfficial: mcpServers.isOfficial,
        isPublic: mcpServers.isPublic,
        publishedByUserId: mcpServers.publishedByUserId,
        createdAt: mcpServers.createdAt,
      })
      .from(mcpServers)
      .where(and(...filters))
      .orderBy(desc(mcpServers.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.createdAt.toISOString() : null;

    return NextResponse.json({ items, nextCursor });
  } catch (err) {
    console.error("[mcp-servers GET]", err);
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = createMcpServerSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const db = getDb();
    const [me] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!me) return unauthorized("User not found");
    if (!can(me.plan, "publishMcp")) {
      const required = minPlanFor("publishMcp");
      return forbidden(`Publishing MCPs requires the ${PLAN_LABELS[required]} plan.`);
    }

    const id = randomUUID();
    await db.insert(mcpServers).values({
      id,
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      repoUrl: parsed.data.repoUrl ?? null,
      runtime: parsed.data.runtime,
      installCmd: parsed.data.installCmd,
      startCmd: parsed.data.startCmd,
      version: parsed.data.version,
      configSchema: parsed.data.configSchema ?? { properties: {} },
      publishedByUserId: session.userId,
      isOfficial: false,
      isPublic: parsed.data.isPublic ?? false,
    });

    logAudit({
      userId: session.userId,
      action: "mcp_server.publish",
      targetType: "mcp_server",
      targetId: id,
      metadata: { slug: parsed.data.slug },
      ip: clientIp(req),
    });

    return NextResponse.json({ id, slug: parsed.data.slug }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && /unique/i.test(err.message)) {
      return badRequest("Slug already taken");
    }
    console.error("[mcp-servers POST]", err);
    return serverError();
  }
}
