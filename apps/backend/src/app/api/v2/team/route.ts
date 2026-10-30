import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { teamspaceMembers, teamspaces } from "@/db/schema";
import { badRequest, forbidden, serverError, unauthorized } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { meetsPlan } from "@/lib/plan-features";
import { getEntitlements } from "@/lib/wallet/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().min(1).max(80) });

export async function POST(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

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
    // The tier comes from the wallet (getEntitlements), never users.plan.
    const ent = await getEntitlements(session.userId);
    if (!ent) return unauthorized("User not found");
    if (!meetsPlan(ent.tier, "team")) {
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
