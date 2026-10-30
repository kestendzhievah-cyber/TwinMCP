import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { users, apiKeys, usageEvents, teamspaceMembers, servers, auditLogs } from "@/db/schema";
import { serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { createClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import { getBoxClient } from "@/lib/upstash/box-client";
import { getStripe } from "@/lib/stripe";
import { clearAuthCache } from "@/lib/auth";
import { dropAgentsForUser } from "@/lib/agent/registry";
import { meterBoxBeforeDelete } from "@/lib/wallet/compute-meter";
import { credit, getWallet } from "@/lib/wallet/ledger";
import { formatEur } from "@/lib/wallet/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  try {
    const db = getDb();

    // Paid credit is the customer's money: the terms keep it available while
    // the account is open, and what happens to it at closure (refund) is
    // settled by hand. Refuse a self-service deletion while any remains; a
    // wallet read error refuses too (fail closed).
    const wallet = await getWallet(session.userId);
    if (wallet.paidMicros > 0) {
      return NextResponse.json(
        {
          code: "paid_credit_remaining",
          message: `You still have ${formatEur(wallet.paidMicros, "en")} of paid credit. Email hello@twinmcp.fr to close your account so we can settle it first.`,
        },
        { status: 409 }
      );
    }

    // Tear down running Upstash Boxes first — otherwise the server rows are
    // cascade-deleted with the user and the boxes keep running (and billing).
    // Each box's last usage is billed first: its counters die with it.
    const owned = await db
      .select({ id: servers.id, boxId: servers.boxId, boxSize: servers.boxSize })
      .from(servers)
      .where(eq(servers.userId, session.userId));
    await Promise.allSettled(
      owned
        .filter((s) => s.boxId)
        .map(async (s) => {
          await meterBoxBeforeDelete(s.boxId!, {
            serverId: s.id,
            userId: session.userId,
            size: s.boxSize,
          });
          await getBoxClient()
            .deleteBox(s.boxId!)
            .catch((err) => console.error("[account DELETE] box teardown failed:", err));
        })
    );

    // A negative balance (usage already happened) is written off. Record it in
    // the ledger, which outlives the user row (user_id becomes NULL), so the
    // books show why the debt was never recovered.
    const after = await getWallet(session.userId);
    if (after.paidMicros < 0) {
      await credit({
        userId: session.userId,
        amountMicros: -after.paidMicros,
        bucket: "paid",
        kind: "adjustment",
        idempotencyKey: `account_closed:${session.userId}`,
        note: "Account closed: negative balance written off",
        units: { writtenOffMicros: -after.paidMicros },
      });
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

    // These are independent; only the users row must go last (FKs).
    await Promise.all([
      db.delete(usageEvents).where(eq(usageEvents.userId, session.userId)),
      db.delete(apiKeys).where(eq(apiKeys.userId, session.userId)),
      db.delete(teamspaceMembers).where(eq(teamspaceMembers.userId, session.userId)),
      // GDPR: audit_logs.userId is SET NULL on user delete (rows are kept for
      // security / legal), but the stored IP is still personal data — scrub it
      // now, while we can still match by userId, so deletion truly anonymizes.
      db.update(auditLogs).set({ ip: null }).where(eq(auditLogs.userId, session.userId)),
    ]);
    await db.delete(users).where(eq(users.id, session.userId));
    // The deleted keys must stop authenticating now, not after the auth cache
    // TTL, and any local-agent link they opened must close.
    clearAuthCache();
    dropAgentsForUser(session.userId);

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
