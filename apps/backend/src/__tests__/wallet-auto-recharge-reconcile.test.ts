import { describe, expect, it, vi } from "vitest";

// A lost payment_intent webhook must not leave the auto_recharge_pending
// marker blocking recharges for 7 days: the enforce pass reconciles it
// against Stripe. These are the pure decisions behind that pass.

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/analytics/server", () => ({ trackServer: vi.fn() }));
vi.mock("@/lib/wallet/notify", () => ({ notifyWalletState: vi.fn(async () => {}) }));
vi.mock("@/lib/wallet/ledger", () => ({ credit: vi.fn(), debit: vi.fn(), getWallet: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ TAX_ENABLED: false, getStripe: vi.fn() }));
vi.mock("@/db", () => ({ getDb: vi.fn() }));

import {
  PENDING_KEY,
  PROCESSING_MAX_AGE_MS,
  RECONCILE_MIN_AGE_MS,
  decidePendingReconcile,
  readPendingMarker,
  type PendingMarker,
} from "@/lib/wallet/auto-recharge";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const marker = (ageMs: number, pi: string | null = "pi_123"): PendingMarker => ({
  pi,
  at: ago(ageMs),
});
const ours = (status: string | null) => ({ status, ours: true });

describe("readPendingMarker", () => {
  it("reads the PaymentIntent and its date", () => {
    const at = ago(60_000).toISOString();
    expect(readPendingMarker({ [PENDING_KEY]: { pi: "pi_1", amountMicros: 1, at } })).toEqual({
      pi: "pi_1",
      at: new Date(at),
    });
  });

  it("no marker → null", () => {
    expect(readPendingMarker(null)).toBeNull();
    expect(readPendingMarker({})).toBeNull();
    expect(readPendingMarker({ other: 1 })).toBeNull();
    expect(readPendingMarker([])).toBeNull();
  });

  it("a malformed marker keeps nulls (it is then cleared)", () => {
    expect(readPendingMarker({ [PENDING_KEY]: "x" })).toEqual({ pi: null, at: null });
    expect(readPendingMarker({ [PENDING_KEY]: { pi: "ch_1", at: "nope" } })).toEqual({
      pi: null,
      at: null,
    });
  });
});

describe("decidePendingReconcile — before asking Stripe", () => {
  it("a young marker waits for the webhook", () => {
    expect(decidePendingReconcile(marker(RECONCILE_MIN_AGE_MS - 1), NOW)).toEqual({
      action: "wait",
    });
  });

  it("an older marker is checked against Stripe", () => {
    expect(decidePendingReconcile(marker(RECONCILE_MIN_AGE_MS), NOW)).toEqual({
      action: "retrieve",
      pi: "pi_123",
    });
  });

  it("a malformed marker is cleared without a Stripe call", () => {
    expect(decidePendingReconcile({ pi: null, at: NOW }, NOW)).toEqual({
      action: "clear",
      reason: "malformed",
    });
    expect(decidePendingReconcile({ pi: "pi_1", at: null }, NOW)).toEqual({
      action: "clear",
      reason: "malformed",
    });
  });
});

describe("decidePendingReconcile — with Stripe's answer", () => {
  const m = marker(HOURS(2));

  it("succeeded → credit (idempotent with the webhook)", () => {
    expect(decidePendingReconcile(m, NOW, ours("succeeded"))).toEqual({
      action: "credit",
      pi: "pi_123",
    });
  });

  it("failed or canceled → fail (clear + switch off + notify)", () => {
    for (const status of ["canceled", "requires_payment_method", "requires_action"]) {
      expect(decidePendingReconcile(m, NOW, ours(status))).toEqual({
        action: "fail",
        pi: "pi_123",
        reason: status,
      });
    }
  });

  it("still processing within 24 h → wait", () => {
    expect(decidePendingReconcile(m, NOW, ours("processing"))).toEqual({ action: "wait" });
    expect(decidePendingReconcile(marker(PROCESSING_MAX_AGE_MS), NOW, ours("processing"))).toEqual({
      action: "wait",
    });
  });

  it("still processing after 24 h → clear the marker", () => {
    expect(
      decidePendingReconcile(marker(PROCESSING_MAX_AGE_MS + 1), NOW, ours("processing"))
    ).toEqual({ action: "clear", reason: "stale_processing" });
  });

  it("unknown to Stripe → clear", () => {
    expect(decidePendingReconcile(m, NOW, ours(null))).toEqual({
      action: "clear",
      reason: "not_found",
    });
  });

  it("a PaymentIntent that is not this user's auto-recharge is never credited", () => {
    expect(decidePendingReconcile(m, NOW, { status: "succeeded", ours: false })).toEqual({
      action: "clear",
      reason: "foreign",
    });
  });
});

function HOURS(n: number): number {
  return n * 3_600_000;
}
