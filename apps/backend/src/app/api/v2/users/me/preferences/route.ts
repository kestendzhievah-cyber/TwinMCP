import { type NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { badRequest, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { emailNudgesEnabled } from "@/lib/billing/quota-nudge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email preferences live in users.metadata (jsonb) — no migration:
//   emailNudges: boolean   absent = true (sign-up credit, low-balance, promo-expiring
//   and activation emails). Money-critical wallet emails (zero balance, failed
//   auto-recharge, runtime deletion, conversion, receipts) ignore it.

const preferencesSchema = z.object({
  emailNudges: z.boolean(),
});

export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  try {
    const [row] = await getDb()
      .select({ metadata: users.metadata })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    return NextResponse.json({ emailNudges: emailNudgesEnabled(row?.metadata) });
  } catch (err) {
    console.error("[preferences GET]", err);
    return serverError();
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) return badRequest("emailNudges must be a boolean");

  const { emailNudges } = parsed.data;
  try {
    // Merge into the existing blob (same pattern as users/me/onboarding) so
    // promo attribution, onboarding fields, etc. are never clobbered.
    const patch = JSON.stringify({ emailNudges });
    await getDb()
      .update(users)
      .set({
        updatedAt: new Date(),
        metadata: sql`COALESCE(${users.metadata}, '{}'::jsonb) || ${patch}::jsonb`,
      })
      .where(eq(users.id, session.userId));

    return NextResponse.json({ ok: true, emailNudges });
  } catch (err) {
    console.error("[preferences PATCH]", err);
    return serverError();
  }
}
