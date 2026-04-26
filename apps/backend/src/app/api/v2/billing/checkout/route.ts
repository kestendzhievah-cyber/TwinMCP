import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getStripe, PRICES } from "@/lib/stripe";
import { badRequest, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ plan: z.enum(["pro", "team"]) });

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

  const price = PRICES[parsed.data.plan];
  if (!price.priceId) return badRequest("Stripe price not configured for this plan");

  try {
    const db = getDb();
    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);

    const origin = req.headers.get("origin") ?? "https://twinmcp.com";
    const stripe = getStripe();

    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: userRow?.email,
      line_items: [{ price: price.priceId, quantity: 1 }],
      metadata: { userId: session.userId, plan: parsed.data.plan },
      success_url: `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/plans`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (err) {
    console.error("[billing/checkout]", err);
    return serverError();
  }
}
