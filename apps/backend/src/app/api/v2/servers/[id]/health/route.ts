import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import { forbidden, notFound, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { assertServerOwnership, ForbiddenError, NotFoundError } from "@/lib/auth/rbac";
import { getBoxClient } from "@/lib/upstash/box-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const { id } = await params;

  try {
    const srv = await assertServerOwnership(session.userId, id);

    let live: boolean | null = null;
    if (srv.status === "running" && srv.boxId) {
      try {
        live = await getBoxClient().ping(srv.boxId);
        await getDb()
          .update(servers)
          .set({ lastHeartbeatAt: new Date(), updatedAt: new Date() })
          .where(eq(servers.id, id));
      } catch (err) {
        console.error("[health] ping failed:", err);
        live = false;
      }
    }

    return NextResponse.json({
      id: srv.id,
      status: srv.status,
      live,
      boxId: srv.boxId,
      endpointUrl: srv.endpointUrl,
      lastHeartbeatAt: srv.lastHeartbeatAt,
    });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[server health]", err);
    return serverError();
  }
}
