import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users, apiKeys, usageEvents, teamspaceMembers, servers } from "@/db/schema";
import { serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
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
    await Promise.allSettled(
      owned
        .filter((s) => s.boxId)
        .map((s) =>
          getBoxClient()
            .deleteBox(s.boxId!)
            .catch((err) => console.error("[account DELETE] box teardown failed:", err))
        )
    );

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

    // These three are independent; only the users row must go last (FKs).
    await Promise.all([
      db.delete(usageEvents).where(eq(usageEvents.userId, session.userId)),
      db.delete(apiKeys).where(eq(apiKeys.userId, session.userId)),
      db.delete(teamspaceMembers).where(eq(teamspaceMembers.userId, session.userId)),
    ]);
    await db.delete(users).where(eq(users.id, session.userId));

    // GDPR right-to-erasure: deleting our own rows isn't enough — the Supabase
    // Auth identity (email, hashed password, OAuth links) lives in auth.users
    // and must be erased too, or we'd retain PII after promising full deletion.
    // Needs the service-role key; if it's missing we alert rather than silently
    // leaving the identity behind.
    const admin = getSupabaseAdmin();
    if (admin) {
      const { error } = await admin.auth.admin.deleteUser(session.userId);
      if (error) {
        console.error("[account DELETE] auth identity deletion failed:", error);
        Sentry.captureException(error, { tags: { area: "account", stage: "auth-erasure" } });
      }
    } else {
      const msg = "SUPABASE_SERVICE_ROLE_KEY not set — auth identity not erased";
      console.error(`[account DELETE] ${msg}`);
      Sentry.captureMessage(`[account DELETE] ${msg}`, "error");
    }

    const supabase = await createClient();
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true, message: "Account and all associated data deleted." });
  } catch (err) {
    console.error("[account DELETE]", err);
    return serverError();
  }
}
