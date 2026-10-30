import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { returnOrigin } from "@/lib/billing/origin";
import { badRequest, jsonError, serverError } from "@/lib/errors";
import { refuseApiKeySession, requireManagementUser } from "@/lib/session";
import { getStripe } from "@/lib/stripe";
import {
  AUTO_RECHARGE_LIMITS,
  applyAutoRechargePatch,
  getAutoRechargeState,
  maybeAutoRecharge,
  monthAutoRecharges,
  saveAutoRechargeSettings,
  type AutoRechargeState,
} from "@/lib/wallet/auto-recharge";
import { createCardSetupCheckout } from "@/lib/wallet/topup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toEur = (micros: number) => micros / 1_000_000;

interface CardSummary {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

async function cardSummary(paymentMethodId: string | null): Promise<CardSummary | null> {
  if (!paymentMethodId || !process.env.STRIPE_SECRET_KEY) return null;
  try {
    const pm = await getStripe().paymentMethods.retrieve(paymentMethodId);
    if (!pm.card) return null;
    return {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
    };
  } catch {
    return null;
  }
}

async function view(userId: string, state: AutoRechargeState) {
  const [card, month] = await Promise.all([
    cardSummary(state.paymentMethodId),
    monthAutoRecharges(userId).catch(() => ({ count: 0, micros: 0 })),
  ]);
  return {
    enabled: state.enabled,
    thresholdEur: toEur(state.thresholdMicros),
    amountEur: toEur(state.amountMicros),
    monthlyCapEur: toEur(state.monthlyCapMicros),
    hasCard: !!state.paymentMethodId,
    card,
    rechargedThisMonthEur: toEur(month.micros),
    limits: AUTO_RECHARGE_LIMITS,
  };
}

// GET /api/v2/wallet/auto-recharge → current settings, saved card, this month's total.
export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;
  try {
    const state = await getAutoRechargeState(session.userId);
    return NextResponse.json(await view(session.userId, state), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[wallet/auto-recharge] read failed", err);
    return serverError("Could not load auto-recharge settings.");
  }
}

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    thresholdEur: z.number().optional(),
    amountEur: z.number().optional(),
    monthlyCapEur: z.number().optional(),
    // Open the card form to replace the saved card (returns { needsCard, url }).
    updateCard: z.boolean().optional(),
  })
  .strict();

// PATCH /api/v2/wallet/auto-recharge { enabled?, thresholdEur?, amountEur?, monthlyCapEur?, updateCard? }
// Rules: threshold ≥ €2, amount ≥ the minimum top-up, monthly cap ≥ amount.
// Enabling without a saved card stores the settings (still disabled) and
// returns { needsCard: true, url } to a setup-mode Checkout; the webhook
// switches auto-recharge on once the card is saved.
export async function PATCH(req: NextRequest) {
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("Expected { enabled?, thresholdEur?, amountEur?, monthlyCapEur? }");
  }
  const { updateCard, ...patch } = parsed.data;

  try {
    const current = await getAutoRechargeState(session.userId);
    const merged = applyAutoRechargePatch(current, patch);
    if (!merged.ok) return badRequest(merged.message);

    const wantsOn = merged.next.enabled && !current.enabled;
    const needsCard = updateCard === true || (wantsOn && !current.paymentMethodId);
    if (needsCard) {
      // Keep the new numbers, but stay off until a card is actually saved.
      const next = {
        ...merged.next,
        enabled: current.paymentMethodId ? merged.next.enabled : false,
      };
      await saveAutoRechargeSettings(session.userId, next);
      const setup = await createCardSetupCheckout({
        userId: session.userId,
        email: session.email ?? null,
        origin: returnOrigin(req),
        enableAutoRecharge: merged.next.enabled,
      });
      if (setup.kind === "error") {
        return jsonError(setup.status, setup.message, { reason: setup.reason });
      }
      return NextResponse.json({ needsCard: true, url: setup.url });
    }

    await saveAutoRechargeSettings(session.userId, merged.next);
    // The balance may already be under the new threshold.
    if (merged.next.enabled) void maybeAutoRecharge(session.userId);
    const state = await getAutoRechargeState(session.userId);
    return NextResponse.json(await view(session.userId, state));
  } catch (err) {
    console.error("[wallet/auto-recharge] update failed", err);
    return serverError("Could not save auto-recharge settings.");
  }
}
