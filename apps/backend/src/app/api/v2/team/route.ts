import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { teamspaceMembers, teamspaces, users } from "@/db/schema";
import { badRequest, forbidden, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { meetsPlan } from "@/lib/plan-features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().min(1).max(80) });

export async function POST(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const db = getDb();

    // Teamspaces are the multi-member collaboration feature — gated to the Team
    // plan (free/pro are single-member per the pricing table). Member invites,
    // when added, must additionally check limitFor(plan, "members").
    const [me] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!me) return unauthorized("User not found");
    if (!meetsPlan(me.plan, "team")) {
      return forbidden("Teamspaces require the Team plan.");
    }

    const id = randomUUID();
    await db.insert(teamspaces).values({ id, ownerId: session.userId, name: parsed.data.name });
    await db
      .insert(teamspaceMembers)
      .values({ teamspaceId: id, userId: session.userId, role: "owner" });
    return NextResponse.json({ id, name: parsed.data.name }, { status: 201 });
  } catch (err) {
    console.error("[team POST]", err);
    return serverError();
  }
}
