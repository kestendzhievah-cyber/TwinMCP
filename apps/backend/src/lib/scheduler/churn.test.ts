import { describe, it, expect, vi, beforeEach } from "vitest";

const sendAdminDigest = vi.fn();
const logAudit = vi.fn();
const client = {
  userId: "u1",
  email: "a@example.com",
  status: "at_risk",
  reason: "no calls in 14 days",
};

vi.mock("@/lib/email", () => ({ sendAdminDigest: (...a: unknown[]) => sendAdminDigest(...a) }));
vi.mock("@/lib/audit/log", () => ({ logAudit: (...a: unknown[]) => logAudit(...a) }));
vi.mock("@/lib/admin/health", () => ({
  computeClientHealth: async () => [client],
  atRiskClients: (h: unknown[]) => h,
}));
vi.mock("@/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: async () => [],
  };
  return { getDb: () => chain };
});

import { runChurnAlerts } from "./churn";

describe("runChurnAlerts", () => {
  beforeEach(() => {
    sendAdminDigest.mockReset();
    logAudit.mockReset();
  });

  it("marks clients as alerted only after the email went out", async () => {
    sendAdminDigest.mockResolvedValue(undefined);
    await expect(runChurnAlerts("admin@example.com")).resolves.toEqual({ alerted: 1, atRisk: 1 });
    expect(logAudit).toHaveBeenCalledTimes(1);
  });

  it("does not mark anyone as alerted when the send fails", async () => {
    sendAdminDigest.mockRejectedValue(new Error("Resend: domain not verified"));
    await expect(runChurnAlerts("admin@example.com")).rejects.toThrow(/Resend/);
    expect(logAudit).not.toHaveBeenCalled();
  });
});
