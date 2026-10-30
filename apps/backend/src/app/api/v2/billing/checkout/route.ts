import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOPUP_URL = "https://twinmcp.fr/dashboard/billing";

// Subscriptions are retired: TwinMCP is a prepaid wallet since 2026-10-29.
// Old clients (pricing page, onboarding, cached dashboards) that still POST
// here get a clear 410 pointing at the top-up flow (POST /api/v2/wallet/topup).
export async function POST() {
  return NextResponse.json(
    {
      message:
        "Subscriptions are no longer sold. TwinMCP is pay-as-you-go: top up your credit from Billing.",
      code: "subscriptions_retired",
      topupUrl: TOPUP_URL,
    },
    { status: 410 }
  );
}
