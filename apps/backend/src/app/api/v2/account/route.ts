import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, apiKeys, usageEvents, teamspaceMembers } from "@/db/schema";
import { serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  try {
    const db = getDb();

    await db.delete(usageEvents).where(eq(usageEvents.userId, session.userId));
    await db.delete(apiKeys).where(eq(apiKeys.userId, session.userId));
    await db.delete(teamspaceMembers).where(eq(teamspaceMembers.userId, session.userId));
    await db.delete(users).where(eq(users.id, session.userId));

    const supabase = await createClient();
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true, message: "Account and all associated data deleted." });
  } catch (err) {
    console.error("[account DELETE]", err);
    return serverError();
  }
}
