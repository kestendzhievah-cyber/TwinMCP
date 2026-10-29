import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema/core";
import { forbidden, jsonError, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { listServerToolCalls, parseActivityQuery } from "@/lib/activity/query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v2/servers/:id/activity — the server's tool-call log, newest first.
 *
 * Query: status (ok|error|denied|rate_limited), mcp (slug), tool (exact name),
 * apiKey (key id), limit (1..100, default 50), cursor (from `nextCursor`).
 * Metadata only: arguments and results are never stored. History is limited
 * to the owner's plan retention (`retentionDays`).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  const parsed = parseActivityQuery(req.nextUrl.searchParams);
  if (!parsed.ok) return jsonError(400, parsed.error, { code: "invalid_query" });

  try {
    await assertServerOwnership(session.userId, id);
    const [me] = await getDb()
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const page = await listServerToolCalls({
      userId: session.userId,
      serverId: id,
      plan: me?.plan,
      query: parsed.query,
    });
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[server activity]", err);
    return serverError();
  }
}
