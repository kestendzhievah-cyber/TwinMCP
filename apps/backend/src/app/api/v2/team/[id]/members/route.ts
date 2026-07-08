import { type NextRequest, NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { teamspaces, teamspaceMembers, users } from "@/db/schema";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { limitFor, minPlanForLimit, PLAN_LABELS } from "@/lib/plan-features";
import { logAudit, clientIp } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inviteSchema = z.object({ email: z.string().email() });

/** Returns the teamspace row iff the caller owns it, else null. */
async function ownedBy(userId: string, teamspaceId: string) {
  const [ts] = await getDb()
    .select({ ownerId: teamspaces.ownerId })
    .from(teamspaces)
    .where(eq(teamspaces.id, teamspaceId))
    .limit(1);
  return ts && ts.ownerId === userId ? ts : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id: teamspaceId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return badRequest("A valid email is required.");
  const email = parsed.data.email.toLowerCase();

  try {
    const db = getDb();
    if (!(await ownedBy(session.userId, teamspaceId))) {
      return forbidden("Only the teamspace owner can add members.");
    }

    const [me] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    const plan = me?.plan ?? "free";
    const limit = limitFor(plan, "members");

    const [tally] = await db
      .select({ n: count() })
      .from(teamspaceMembers)
      .where(eq(teamspaceMembers.teamspaceId, teamspaceId));
    if ((tally?.n ?? 0) >= limit) {
      const up = minPlanForLimit("members", (tally?.n ?? 0) + 1);
      return forbidden(
        `Your plan allows ${limit} member${limit > 1 ? "s" : ""}.` +
          (up ? ` Upgrade to ${PLAN_LABELS[up]} for more.` : "")
      );
    }

    const [invitee] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!invitee) return notFound("That person needs a TwinMCP account before they can be added.");

    const [existing] = await db
      .select({ userId: teamspaceMembers.userId })
      .from(teamspaceMembers)
      .where(
        and(eq(teamspaceMembers.teamspaceId, teamspaceId), eq(teamspaceMembers.userId, invitee.id))
      )
      .limit(1);
    if (existing) return badRequest("That user is already a member.");

    await db.insert(teamspaceMembers).values({ teamspaceId, userId: invitee.id, role: "member" });
    logAudit({
      userId: session.userId,
      action: "team.member.add",
      targetType: "teamspace",
      targetId: teamspaceId,
      metadata: { invitee: invitee.id },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[team members POST]", err);
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");
  const { id: teamspaceId } = await params;
  const memberId = new URL(req.url).searchParams.get("userId");
  if (!memberId) return badRequest("userId is required");

  try {
    const db = getDb();
    const owner = await ownedBy(session.userId, teamspaceId);
    if (!owner) return forbidden("Only the teamspace owner can remove members.");
    if (memberId === owner.ownerId) return badRequest("The owner cannot be removed.");

    await db
      .delete(teamspaceMembers)
      .where(
        and(eq(teamspaceMembers.teamspaceId, teamspaceId), eq(teamspaceMembers.userId, memberId))
      );
    logAudit({
      userId: session.userId,
      action: "team.member.remove",
      targetType: "teamspace",
      targetId: teamspaceId,
      metadata: { removed: memberId },
      ip: clientIp(req),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[team members DELETE]", err);
    return serverError();
  }
}
