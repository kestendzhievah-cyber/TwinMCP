import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MICROS_PER_EUR,
  PRICING,
  UPSTASH_CORE_HOUR_USD,
  UPSTASH_CPU_HOUR_USD,
  eurToMicros,
  formatEur,
  loadPricing,
  microsToEur,
  priceComputeMicros,
  priceToolCallsMicros,
  publicPriceTable,
  whatTenEuroBuys,
  type Pricing,
} from "./pricing";

const base: Pricing = loadPricing();

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PRICING defaults", () => {
  it("matches the owner's decisions", () => {
    expect(PRICING.multiplier).toBe(10);
    expect(PRICING.usdToEur).toBe(0.92);
    expect(PRICING.callCostEurPer1000).toBe(0.01);
    expect(PRICING.signupCreditEur).toBe(10);
    expect(PRICING.signupCreditDays).toBe(30);
    expect(PRICING.minTopupEur).toBe(10);
    expect(PRICING.topupPresetsEur).toEqual([10, 25, 50, 100]);
    expect(PRICING.maxTopupEur).toBe(1000);
    expect(PRICING.overdraftEur).toBe(0.5);
    // Real-cost caps below what the €10 promo is worth in real cost (€1 at ×10).
    expect(PRICING.promoDailyCostCapEur).toBe(0.2);
    expect(PRICING.promoTotalCostCapEur).toBe(0.9);
    expect(PRICING.promoTotalCostCapEur * PRICING.multiplier).toBeLessThan(PRICING.signupCreditEur);
    expect(Object.isFrozen(PRICING)).toBe(true);
  });

  it("reads the env knobs and ignores invalid values", () => {
    vi.stubEnv("WALLET_COST_MULTIPLIER", "5");
    vi.stubEnv("WALLET_USD_EUR", "0.9");
    vi.stubEnv("WALLET_CALL_COST_EUR_PER_1000", "0.02");
    expect(loadPricing()).toMatchObject({ multiplier: 5, usdToEur: 0.9, callCostEurPer1000: 0.02 });

    vi.stubEnv("WALLET_COST_MULTIPLIER", "0.5"); // below 1: would sell under cost
    vi.stubEnv("WALLET_USD_EUR", "abc");
    vi.stubEnv("WALLET_CALL_COST_EUR_PER_1000", "-1");
    expect(loadPricing()).toMatchObject({
      multiplier: 10,
      usdToEur: 0.92,
      callCostEurPer1000: 0.01,
    });

    vi.stubEnv("WALLET_COST_MULTIPLIER", "");
    expect(loadPricing().multiplier).toBe(10);
  });
});

describe("eurToMicros / microsToEur", () => {
  it("converts to whole micro-euros", () => {
    expect(eurToMicros(10)).toBe(10_000_000);
    expect(eurToMicros(0.01)).toBe(10_000);
    expect(eurToMicros(0.1 + 0.2)).toBe(300_000); // float noise absorbed
    expect(eurToMicros(1.0000005)).toBe(1_000_001); // half away from zero
    expect(eurToMicros(1.0000004)).toBe(1_000_000);
    expect(eurToMicros(-2.5)).toBe(-2_500_000);
    expect(eurToMicros(-0.0000001)).toBe(0);
    expect(Object.is(eurToMicros(-0.0000001), -0)).toBe(false);
    expect(eurToMicros(Number.NaN)).toBe(0);
    expect(eurToMicros(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("round-trips", () => {
    for (const eur of [0, 0.01, 1, 9.99, 10, 25, 1000]) {
      expect(microsToEur(eurToMicros(eur))).toBe(eur);
    }
    expect(MICROS_PER_EUR).toBe(1_000_000);
  });
});

describe("priceToolCallsMicros", () => {
  it("charges real cost x multiplier: €0.10 per 1,000 calls by default", () => {
    expect(priceToolCallsMicros(1)).toBe(100);
    expect(priceToolCallsMicros(1000)).toBe(100_000);
    expect(priceToolCallsMicros(100_000)).toBe(10_000_000); // €10
  });

  it("is always an integer and additive for whole batches", () => {
    for (const n of [1, 7, 99, 100, 101, 12345]) {
      const v = priceToolCallsMicros(n);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBe(n * priceToolCallsMicros(1));
    }
  });

  it("rounds the batch total, not each call", () => {
    const p: Pricing = { ...base, callCostEurPer1000: 0.0123, multiplier: 1 };
    // 12.3 micros per call: 3 calls = 36.9 -> 37 (per-call rounding would give 36)
    expect(priceToolCallsMicros(3, p)).toBe(37);
    expect(priceToolCallsMicros(1, p)).toBe(12);
  });

  it("charges nothing for invalid counts and floors fractions", () => {
    expect(priceToolCallsMicros(0)).toBe(0);
    expect(priceToolCallsMicros(-5)).toBe(0);
    expect(priceToolCallsMicros(Number.NaN)).toBe(0);
    expect(priceToolCallsMicros(Number.POSITIVE_INFINITY)).toBe(0);
    expect(priceToolCallsMicros(2.9)).toBe(200);
  });
});

describe("priceComputeMicros", () => {
  it("= costUsd x usdToEur x multiplier, in micro-euros", () => {
    expect(priceComputeMicros(1)).toBe(9_200_000); // $1 -> €9.20
    expect(priceComputeMicros(0.1)).toBe(920_000); // small CPU-hour
    expect(priceComputeMicros(0.000001)).toBe(9); // 9.2 -> 9
    expect(priceComputeMicros(0.0000001)).toBe(1); // 0.92 -> 1
    expect(priceComputeMicros(0.00000005)).toBe(0); // 0.46 -> 0
  });

  it("charges nothing for zero, negative or invalid cost", () => {
    expect(priceComputeMicros(0)).toBe(0);
    expect(priceComputeMicros(-1)).toBe(0);
    expect(priceComputeMicros(Number.NaN)).toBe(0);
  });

  it("follows the multiplier and rate", () => {
    expect(priceComputeMicros(1, { ...base, multiplier: 1, usdToEur: 1 })).toBe(1_000_000);
    expect(priceComputeMicros(2, { ...base, multiplier: 3, usdToEur: 0.5 })).toBe(3_000_000);
  });
});

describe("formatEur", () => {
  const norm = (s: string) => s.replace(/[  ]/g, " ");
  it("formats English and French", () => {
    expect(formatEur(10_000_000, "en")).toBe("€10.00");
    expect(norm(formatEur(10_000_000, "fr"))).toBe("10,00 €");
    expect(formatEur(1_234_560_000, "en")).toBe("€1,234.56");
    expect(formatEur(0)).toBe("€0.00");
    expect(formatEur(-5_000_000)).toBe("-€5.00");
  });

  it("keeps sub-cent amounts visible", () => {
    expect(formatEur(100)).toBe("€0.0001"); // one tool call
    expect(formatEur(9)).toBe("€0.000009");
    expect(formatEur(1_500)).toBe("€0.002");
    expect(norm(formatEur(100, "fr"))).toBe("0,0001 €");
  });
});

describe("publicPriceTable", () => {
  it("derives prices from the cost model", () => {
    const t = publicPriceTable();
    expect(t.currency).toBe("EUR");
    expect(t.per1000CallsEur).toBe(0.1);
    // Only the small (per-core) rate is quoted: medium/large are unconfirmed.
    expect(t.cpuHourEur).toEqual({ small: 0.92 });
    expect(t.signupCreditEur).toBe(10);
    expect(t.signupCreditDays).toBe(30);
    expect(t.minTopupEur).toBe(10);
    expect(t.topupPresetsEur).toEqual([10, 25, 50, 100]);
    expect(t.notes.en.length).toBe(t.notes.fr.length);
    expect(t.notes.en.length).toBeGreaterThan(0);
  });

  it("agrees with the charging functions", () => {
    const t = publicPriceTable();
    expect(eurToMicros(t.per1000CallsEur)).toBe(priceToolCallsMicros(1000));
    expect(eurToMicros(t.cpuHourEur.small)).toBe(priceComputeMicros(0.1));
    expect(UPSTASH_CORE_HOUR_USD).toBe(UPSTASH_CPU_HOUR_USD.small);
  });

  it("does not disclose the margin", () => {
    const text = [...publicPriceTable().notes.en, ...publicPriceTable().notes.fr].join(" ");
    expect(text).not.toMatch(/multiplier|x ?10|×|marge|margin/i);
  });
});

describe("whatTenEuroBuys", () => {
  it("states what €10 buys at list price", () => {
    const w = whatTenEuroBuys();
    expect(w.amountEur).toBe(10);
    expect(w.toolCalls).toBe(100_000);
    expect(w.cpuHours).toEqual({ small: 10.8 });
    expect(w.examples.en[0]).toContain("100,000 for €10.00");
    // A call also burns compute: the example must say so.
    expect(w.examples.en[0]).toContain("charged on top");
    expect(w.examples.fr[0]).toContain("facturé en plus");
    expect(w.examples.en[1]).toContain("10.8 hours");
    expect(w.examples.fr[0].replace(/[  ]/g, " ")).toContain("100 000 pour");
    expect(w.examples.fr[1]).toContain("10,8 heures");
  });

  it("never overstates (rounds down)", () => {
    const w = whatTenEuroBuys();
    expect(priceToolCallsMicros(w.toolCalls)).toBeLessThanOrEqual(eurToMicros(10));
    expect(w.cpuHours.small * 0.92).toBeLessThanOrEqual(10);
  });

  it("takes another amount", () => {
    expect(whatTenEuroBuys(base, 25).toolCalls).toBe(250_000);
  });
});

describe("promo cost caps (WALLET_PROMO_*_COST_CAP_EUR)", () => {
  it("default to 20% / 90% of the sign-up credit's real cost", () => {
    const p = loadPricing();
    expect(p.promoDailyCostCapEur).toBe(0.2);
    expect(p.promoTotalCostCapEur).toBe(0.9);
  });

  it("are overridable in real-cost euros", () => {
    vi.stubEnv("WALLET_PROMO_DAILY_COST_CAP_EUR", "0.15");
    vi.stubEnv("WALLET_PROMO_TOTAL_COST_CAP_EUR", "0.5");
    expect(loadPricing()).toMatchObject({ promoDailyCostCapEur: 0.15, promoTotalCostCapEur: 0.5 });
  });

  it("ignore zero, negative and junk values", () => {
    vi.stubEnv("WALLET_PROMO_DAILY_COST_CAP_EUR", "0");
    vi.stubEnv("WALLET_PROMO_TOTAL_COST_CAP_EUR", "-1");
    expect(loadPricing()).toMatchObject({ promoDailyCostCapEur: 0.2, promoTotalCostCapEur: 0.9 });
    vi.stubEnv("WALLET_PROMO_DAILY_COST_CAP_EUR", "abc");
    expect(loadPricing().promoDailyCostCapEur).toBe(0.2);
  });

  it("the daily cap never exceeds the total cap", () => {
    vi.stubEnv("WALLET_PROMO_DAILY_COST_CAP_EUR", "2");
    vi.stubEnv("WALLET_PROMO_TOTAL_COST_CAP_EUR", "0.5");
    expect(loadPricing()).toMatchObject({ promoDailyCostCapEur: 0.5, promoTotalCostCapEur: 0.5 });
  });
});
