import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, apiKeys, usageEvents, teamspaceMembers, servers } from "@/db/schema";
import { serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";
import { getBoxClient } from "@/lib/upstash/box-client";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  try {
    const db = getDb();

    // Tear down running Upstash Boxes first — otherwise the server rows are
    // cascade-deleted with the user and the boxes keep running (and billing).
    const owned = await db
      .select({ boxId: servers.boxId })
      .from(servers)
      .where(eq(servers.userId, session.userId));
    for (const s of owned) {
      if (!s.boxId) continue;
      try {
        await getBoxClient().deleteBox(s.boxId);
      } catch (err) {
        console.error("[account DELETE] box teardown failed:", err);
      }
    }

    // Cancel the Stripe subscription — the user row (with its stripe ids) is
    // about to be deleted, so the webhook could no longer reconcile it.
    const [u] = await db
      .select({ subId: users.stripeSubscriptionId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (u?.subId) {
      try {
        await getStripe().subscriptions.cancel(u.subId);
      } catch (err) {
        console.error("[account DELETE] subscription cancel failed:", err);
      }
    }

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
