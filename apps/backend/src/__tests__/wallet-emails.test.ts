import { describe, it, expect, vi, beforeEach } from "vitest";

// The wallet email templates (lib/email.ts): rendered through a mocked
// Resend client so the subject/body can be checked without sending anything.
const send = vi.hoisted(() =>
  vi.fn<(msg: { to: string; subject: string; html: string }) => Promise<unknown>>()
);
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import {
  sendAdminDigest,
  sendAutoRechargeFailedEmail,
  sendLowBalanceEmail,
  sendPromoExpiringEmail,
  sendRuntimeDeletionWarningEmail,
  sendSignupCreditEmail,
  sendSubscriptionConvertedEmail,
  sendTopupSucceededEmail,
  sendZeroBalanceEmail,
} from "@/lib/email";

process.env.RESEND_API_KEY = "re_test";

function last() {
  const call = send.mock.calls.at(-1);
  if (!call) throw new Error("nothing sent");
  return call[0];
}

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: "x" }, error: null });
});

describe("wallet emails", () => {
  it("sign-up credit: amount, expiry, examples, setup steps", async () => {
    await sendSignupCreditEmail("dev@example.com", {
      amount: "€10.00",
      expiresAt: new Date("2026-11-28T10:00:00.000Z"),
      examples: ["About 10,000 tool calls."],
      per1000Calls: "€0.10",
      minTopup: "€10.00",
    });
    const m = last();
    expect(m.to).toBe("dev@example.com");
    expect(m.subject).toBe("€10.00 of free TwinMCP credit is on your account");
    expect(m.html).toContain("28 November 2026");
    expect(m.html).toContain("About 10,000 tool calls.");
    expect(m.html).toContain("1 · Server");
    expect(m.html).not.toMatch(/trial|free month|subscribe/i);
  });

  it("escapes values that end up in the HTML", async () => {
    await sendSignupCreditEmail("dev@example.com", {
      amount: "€10.00",
      expiresAt: null,
      examples: ["<script>x</script>"],
      per1000Calls: "€0.10",
      minTopup: "€10.00",
    });
    expect(last().html).not.toContain("<script>");
    expect(last().html).toContain("&lt;script&gt;");
  });

  it("low balance mentions auto-recharge only when it is on", async () => {
    await sendLowBalanceEmail("a@b.co", { balance: "€1.20", autoRecharge: false });
    expect(last().subject).toContain("€1.20");
    expect(last().html).toContain("turn on auto-recharge");
    await sendLowBalanceEmail("a@b.co", { balance: "€1.20", autoRecharge: true });
    expect(last().html).toContain("Auto-recharge is on");
  });

  it("zero balance: deletion rule for free accounts, expiry wording", async () => {
    await sendZeroBalanceEmail("a@b.co", { funded: false, deleteAfterDays: 14 });
    expect(last().html).toContain("deleted after 14 days");
    await sendZeroBalanceEmail("a@b.co", { funded: true, deleteAfterDays: null });
    expect(last().html).not.toContain("deleted after");
    await sendZeroBalanceEmail("a@b.co", { funded: false, promoExpired: true });
    expect(last().subject).toBe("Your free TwinMCP credit has expired");
  });

  it("promo expiring: days left and expiry", async () => {
    await sendPromoExpiringEmail("a@b.co", {
      remaining: "€6.40",
      expiresAt: new Date("2026-11-05T00:00:00.000Z"),
      daysLeft: 2,
      funded: false,
    });
    expect(last().subject).toBe("Your free TwinMCP credit expires in 2 days");
    expect(last().html).toContain("€6.40");
  });

  it("money-critical notices carry the account note, not the preferences link", async () => {
    await sendAutoRechargeFailedEmail("a@b.co", { amount: "€20.00", reason: "card_declined" });
    expect(last().html).toContain("concerns the credit balance");
    expect(last().html).not.toContain("Manage email preferences");
    await sendRuntimeDeletionWarningEmail("a@b.co", {
      stage: 13,
      deleteAt: new Date("2026-11-12T08:00:00.000Z"),
      serverCount: 1,
    });
    expect(last().subject).toBe("Your server runtime is deleted tomorrow");
    expect(last().html).toContain("configuration is kept");
    await sendSubscriptionConvertedEmail("a@b.co", {
      credited: "€9.50",
      plan: "Pro",
      balance: "€9.50",
    });
    expect(last().html).toContain("€9.50");
    expect(last().html).toContain("cancelled");
    await sendTopupSucceededEmail("a@b.co", { amount: "€25.00", balance: "€31.20" });
    expect(last().subject).toBe("€25.00 added to your TwinMCP credit");
  });

  it("throws on a Resend error so the dedupe stamp is released", async () => {
    send.mockResolvedValueOnce({ data: null, error: { message: "rate limited" } });
    await expect(
      sendLowBalanceEmail("a@b.co", { balance: "€1.00", autoRecharge: false })
    ).rejects.toThrow("Resend: rate limited");
  });
});

describe("sendAdminDigest", () => {
  it("throws when Resend reports an error, so churn/digest record a failure", async () => {
    send.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    await expect(sendAdminDigest("admin@example.com", "s", "<p>x</p>")).rejects.toThrow(
      "Resend: domain not verified"
    );
  });

  it("resolves when the email was accepted", async () => {
    await expect(sendAdminDigest("admin@example.com", "s", "<p>x</p>")).resolves.toBeUndefined();
    expect(last().to).toBe("admin@example.com");
  });
});
