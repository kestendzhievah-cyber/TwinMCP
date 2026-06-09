import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { servers, users } from "@/db/schema";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { updateServerSchema } from "@/lib/validation/platform";
import {
  assertServerOwnership,
  ForbiddenError,
  NotFoundError,
} from "@/lib/auth/rbac";
import {
  isBoxSizeAllowed,
  minPlanForBoxSize,
  PlanRestrictionError,
  PLAN_LABELS,
} from "@/lib/plan-features";
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
    const db = getDb();
    const current = await assertServerOwnership(session.userId, id);

    // Same box-size plan gate as POST /servers — a resize must not let a
    // free/pro user escalate to a box their plan forbids. Only enforced on an
    // actual change, so unrelated edits (e.g. rename) by a downgraded user who
    // still owns a larger box keep working.
    if (parsed.data.boxSize !== undefined && parsed.data.boxSize !== current.boxSize) {
      const [me] = await db
        .select({ plan: users.plan })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);
      const plan = me?.plan ?? "free";
      if (!isBoxSizeAllowed(plan, parsed.data.boxSize)) {
        const required = minPlanForBoxSize(parsed.data.boxSize) ?? "team";
        throw new PlanRestrictionError(
          "box-size",
          required,
          `The ${parsed.data.boxSize} box size requires the ${PLAN_LABELS[required]} plan.`,
        );
      }
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.boxSize !== undefined) patch.boxSize = parsed.data.boxSize;

    await db.update(servers).set(patch).where(eq(servers.id, id));

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
    if (err instanceof PlanRestrictionError) return forbidden(err.message);
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
