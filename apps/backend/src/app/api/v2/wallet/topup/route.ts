import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { returnOrigin } from "@/lib/billing/origin";
import { badRequest, jsonError } from "@/lib/errors";
import { refuseApiKeySession, requireManagementUser } from "@/lib/session";
import { createTopupCheckout, parseTopupAmount } from "@/lib/wallet/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  // Whole euros; the range (min/max) is checked by parseTopupAmount so the
  // message names the actual limits.
  amountEur: z.union([z.number(), z.string()]),
  // Keep the card for auto-recharge (Stripe setup_future_usage = off_session).
  saveCard: z.boolean().optional(),
});

// POST /api/v2/wallet/topup { amountEur, saveCard? } → { url }
// Opens a Stripe Checkout (mode payment) buying `amountEur` of paid credit.
// The credit itself is written by the Stripe webhook once the payment is
// confirmed (checkout.session.completed / async_payment_succeeded), never here.
export async function POST(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  const keyRefusal = refuseApiKeySession(session);
  if (keyRefusal) return keyRefusal;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Expected { amountEur, saveCard? }");
  const amount = parseTopupAmount(parsed.data.amountEur);
  if (!amount.ok) return badRequest(amount.message);

  const result = await createTopupCheckout({
    userId: session.userId,
    email: session.email ?? null,
    amountEur: amount.amountEur,
    saveCard: parsed.data.saveCard ?? false,
    origin: returnOrigin(req),
  });
  if (result.kind === "error") {
    return jsonError(result.status, result.message, { reason: result.reason });
  }
  return NextResponse.json({ url: result.url });
}
