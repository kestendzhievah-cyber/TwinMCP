import { type NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  try {
    const stripe = getStripe();
    const origin = req.headers.get("origin") ?? "https://twinmcp.com";

    const customers = await stripe.customers.search({
      query: `metadata["userId"]:"${session.userId}"`,
      limit: 1,
    });
    if (customers.data.length === 0) {
      return NextResponse.json({ url: `${origin}/plans` });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customers.data[0].id,
      return_url: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ url: portal.url });
  } catch (err) {
    console.error("[billing/portal]", err);
    return serverError();
  }
}
