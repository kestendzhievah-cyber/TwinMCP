import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getStripe } from "@/lib/stripe";
import { badRequest, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  try {
    const db = getDb();
    const [row] = await db
      .select({ stripeCustomerId: users.stripeCustomerId })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const origin = req.headers.get("origin") ?? "https://twinmcp.fr";

    // No customer yet — user has never checked out. Steer them to /plans
    // with a clear hint instead of opening an empty portal.
    if (!row?.stripeCustomerId) {
      return badRequest("No subscription yet — pick a plan first.");
    }

    const portal = await getStripe().billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("[billing/portal]", err);
    return serverError();
  }
}
