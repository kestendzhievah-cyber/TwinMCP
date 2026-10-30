import { describe, expect, it } from "vitest";
import {
  SUBSCRIPTION_CONVERSION,
  TOPUP_CONVERSION,
  topupConversionSendTo,
} from "../lib/analytics/google-ads";

// Wallet top-ups report to the "Recharge" action once
// NEXT_PUBLIC_GOOGLE_ADS_TOPUP_SEND_TO is set at build time, and to the
// existing "Abonnement" action until then.
describe("topupConversionSendTo", () => {
  it("uses the dedicated top-up action when configured", () => {
    expect(topupConversionSendTo("AW-1/recharge", "AW-1/abonnement")).toBe("AW-1/recharge");
  });

  it("falls back to the subscription action when empty or blank", () => {
    expect(topupConversionSendTo("", "AW-1/abonnement")).toBe("AW-1/abonnement");
    expect(topupConversionSendTo("   ", "AW-1/abonnement")).toBe("AW-1/abonnement");
  });

  it("defaults to the build-time env, then to Abonnement", () => {
    expect(TOPUP_CONVERSION).toBe(process.env.NEXT_PUBLIC_GOOGLE_ADS_TOPUP_SEND_TO || "");
    expect(topupConversionSendTo()).toBe(TOPUP_CONVERSION.trim() || SUBSCRIPTION_CONVERSION);
    expect(topupConversionSendTo()).not.toBe("");
  });
});
