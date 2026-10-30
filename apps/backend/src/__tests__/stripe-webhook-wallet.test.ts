import { describe, it, expect, beforeEach, vi } from "vitest";

// app/api/webhooks/stripe/route.ts after the switch to the wallet: which
// handler each event reaches, event-level dedupe (processed_stripe_events),
// claim release on a failed handler, and the "billing never downgrades" rule
// for the legacy subscription events.

const mocks = vi.hoisted(() => ({
  event: null as unknown,
  claimRows: [{ eventId: "evt" }] as unknown[],
  dbUpdateSets: [] as unknown[],
  deletes: 0,
  applyTopupSession: vi.fn(async () => {}),
  applyCardSetupSession: vi.fn(async () => {}),
  applyChargeRefund: vi.fn(async () => {}),
  applyDisputeCreated: vi.fn(async () => {}),
  applyDisputeClosed: vi.fn(async () => {}),
  settleAutoRecharge: vi.fn(async () => {}),
  failAutoRecharge: vi.fn(async () => {}),
  audit: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: mocks.audit }));
vi.mock("@/lib/email", () => ({ sendUpgradeConfirmationEmail: vi.fn(async () => {}) }));
vi.mock("@/lib/wallet/auto-recharge", () => ({
  settleAutoRecharge: mocks.settleAutoRecharge,
  failAutoRecharge: mocks.failAutoRecharge,
}));
vi.mock("@/lib/wallet/topup", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/wallet/topup")>();
  return {
    stripeId: real.stripeId,
    walletSessionAction: real.walletSessionAction,
    walletPaymentIntentKind: real.walletPaymentIntentKind,
    applyTopupSession: mocks.applyTopupSession,
    applyCardSetupSession: mocks.applyCardSetupSession,
    applyChargeRefund: mocks.applyChargeRefund,
    applyDisputeCreated: mocks.applyDisputeCreated,
    applyDisputeClosed: mocks.applyDisputeClosed,
  };
});
vi.mock("@/lib/wallet/ledger", () => ({ credit: vi.fn(), debit: vi.fn(), getWallet: vi.fn() }));
vi.mock("@/lib/wallet/notify", () => ({ notifyWalletState: vi.fn() }));
vi.mock("@/lib/stripe", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...real,
    getStripe: () => ({
      webhooks: { constructEvent: () => mocks.event },
      customers: { retrieve: async () => ({ metadata: {} }) },
      charges: { retrieve: async () => ({ customer: "cus_1" }) },
    }),
  };
});
vi.mock("@/db", () => ({
  getDb: () => ({
    insert: () => ({
      values: () => ({
        onConflictDoNothing: () => ({ returning: async () => mocks.claimRows }),
      }),
    }),
    delete: () => ({
      where: async () => {
        mocks.deletes++;
      },
    }),
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ id: "u1" }] }) }),
    }),
    update: () => ({
      set: (v: unknown) => {
        mocks.dbUpdateSets.push(v);
        return { where: async () => [] };
      },
    }),
  }),
}));

import { POST } from "@/app/api/webhooks/stripe/route";
import type { NextRequest } from "next/server";

function req(): NextRequest {
  return new Request("https://twinmcp.fr/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": "t=1,v1=x" },
    body: "{}",
  }) as unknown as NextRequest;
}

async function deliver(type: string, object: unknown) {
  mocks.event = { id: `evt_${type}`, type, data: { object } };
  return POST(req());
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimRows = [{ eventId: "evt" }];
  mocks.dbUpdateSets.length = 0;
  mocks.deletes = 0;
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
});

describe("stripe webhook — wallet routing", () => {
  const topup = {
    id: "cs_1",
    mode: "payment",
    payment_status: "paid",
    metadata: { kind: "wallet_topup", userId: "u1" },
  };

  it("credits a paid top-up on completed and on async success", async () => {
    await deliver("checkout.session.completed", topup);
    await deliver("checkout.session.async_payment_succeeded", topup);
    expect(mocks.applyTopupSession).toHaveBeenCalledTimes(2); // same ledger key: one credit
  });

  it("waits for an unpaid (async) top-up", async () => {
    await deliver("checkout.session.completed", { ...topup, payment_status: "unpaid" });
    expect(mocks.applyTopupSession).not.toHaveBeenCalled();
  });

  it("stores the card from a setup session", async () => {
    await deliver("checkout.session.completed", {
      id: "cs_2",
      mode: "setup",
      metadata: { kind: "wallet_card", userId: "u1" },
    });
    expect(mocks.applyCardSetupSession).toHaveBeenCalledTimes(1);
  });

  it("settles and fails auto-recharges only", async () => {
    const pi = { id: "pi_1", metadata: { kind: "auto_recharge", userId: "u1" } };
    await deliver("payment_intent.succeeded", pi);
    await deliver("payment_intent.succeeded", { id: "pi_2", metadata: { kind: "wallet_topup" } });
    expect(mocks.settleAutoRecharge).toHaveBeenCalledTimes(1);
    await deliver("payment_intent.payment_failed", {
      ...pi,
      last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" },
    });
    expect(mocks.failAutoRecharge).toHaveBeenCalledWith("u1", "insufficient_funds", "pi_1");
  });

  it("claws back on refunds and disputes", async () => {
    await deliver("charge.refunded", { id: "ch_1", customer: "cus_1", payment_intent: "pi_1" });
    expect(mocks.applyChargeRefund).toHaveBeenCalledWith(
      "u1",
      expect.anything(),
      expect.any(String)
    );
    await deliver("charge.dispute.created", { id: "dp_1", charge: "ch_1", payment_intent: "pi_1" });
    expect(mocks.applyDisputeCreated).toHaveBeenCalledTimes(1);
    await deliver("charge.dispute.closed", { id: "dp_1", charge: "ch_1", status: "won" });
    expect(mocks.applyDisputeClosed).toHaveBeenCalledTimes(1);
  });
});

describe("stripe webhook — idempotency", () => {
  it("a redelivered event is acknowledged without running any handler", async () => {
    mocks.claimRows = [];
    const res = await deliver("checkout.session.completed", {
      id: "cs_1",
      mode: "payment",
      payment_status: "paid",
      metadata: { kind: "wallet_topup", userId: "u1" },
    });
    expect(await res.json()).toEqual({ received: true, deduped: true });
    expect(mocks.applyTopupSession).not.toHaveBeenCalled();
  });

  it("a failed handler releases its claim and answers 500 so Stripe retries", async () => {
    mocks.applyTopupSession.mockRejectedValueOnce(new Error("db down"));
    const res = await deliver("checkout.session.completed", {
      id: "cs_1",
      mode: "payment",
      payment_status: "paid",
      metadata: { kind: "wallet_topup", userId: "u1" },
    });
    expect(res.status).toBe(500);
    expect(mocks.deletes).toBe(1);
  });
});

describe("stripe webhook — legacy subscriptions never downgrade", () => {
  const sub = (status: string) => ({
    id: "sub_1",
    customer: "cus_1",
    status,
    cancel_at_period_end: false,
    metadata: { plan: "pro" },
    items: { data: [{ current_period_end: 1_800_000_000, price: { id: "price_x" } }] },
  });

  it("an unpaid/canceled subscription updates the status mirror only", async () => {
    await deliver("customer.subscription.updated", sub("unpaid"));
    expect(mocks.dbUpdateSets).toHaveLength(1);
    expect(mocks.dbUpdateSets[0]).toMatchObject({ subscriptionStatus: "unpaid" });
    expect(mocks.dbUpdateSets[0]).not.toHaveProperty("plan");
  });

  it("a deleted subscription keeps the plan", async () => {
    await deliver("customer.subscription.deleted", sub("canceled"));
    expect(mocks.dbUpdateSets[0]).toEqual({
      subscriptionStatus: "canceled",
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
    });
  });

  it("an active subscription still restores its plan", async () => {
    await deliver("customer.subscription.updated", sub("active"));
    expect(mocks.dbUpdateSets[0]).toMatchObject({ plan: "pro", subscriptionStatus: "active" });
  });
});
