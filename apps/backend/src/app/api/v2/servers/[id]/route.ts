import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers } from "@/db/schema";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { updateServerSchema } from "@/lib/validation/platform";
import {
  assertServerOwnership,
  ForbiddenError,
  NotFoundError,
} from "@/lib/auth/rbac";
import { logAudit, clientIp } from "@/lib/audit/log";
import { destroyServerRuntime } from "@/lib/provisioning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id } = await params;

  try {
    const row = await assertServerOwnership(session.userId, id);
    return NextResponse.json(row);
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[servers/:id GET]", err);
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = updateServerSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    await assertServerOwnership(session.userId, id);

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.boxSize !== undefined) patch.boxSize = parsed.data.boxSize;

    await getDb().update(servers).set(patch).where(eq(servers.id, id));

    logAudit({
      userId: session.userId,
      action: "server.update",
      targetType: "server",
      targetId: id,
      metadata: parsed.data,
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[servers/:id PATCH]", err);
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id } = await params;

  try {
    await assertServerOwnership(session.userId, id);
    await destroyServerRuntime(id);
    await getDb().delete(servers).where(eq(servers.id, id));

    logAudit({
      userId: session.userId,
      action: "server.delete",
      targetType: "server",
      targetId: id,
      ip: clientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NotFoundError) return notFound(err.message);
    if (err instanceof ForbiddenError) return forbidden(err.message);
    console.error("[servers/:id DELETE]", err);
    return serverError();
  }
}
