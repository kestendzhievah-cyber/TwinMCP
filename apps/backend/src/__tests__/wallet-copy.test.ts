import { describe, it, expect } from "vitest";
import { publicPriceTable, whatTenEuroBuys, type PublicPriceTable } from "@/lib/wallet/pricing";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import {
  ESTIMATE_DAYS,
  PRICE_TABLE,
  RETIRED_PRICING_PHRASES,
  SIGNUP_OFFER,
  TEN_EURO,
  WALLET_SUMMARY,
  WORKLOADS,
  count,
  estimateMonthly,
  eurAmount,
  formatMicrosEur,
  walletFacts,
  walletProductSchema,
} from "@/components/pricing/wallet-copy";
import { FEATURES, marketingOffers } from "@/components/pricing/pricing-data";

// A fixed price list, so the arithmetic below does not depend on env.
const TABLE: PublicPriceTable = {
  currency: "EUR",
  per1000CallsEur: 0.1,
  cpuHourEur: { small: 0.92 },
  signupCreditEur: 10,
  signupCreditDays: 30,
  minTopupEur: 10,
  topupPresetsEur: [10, 25, 50, 100],
  maxTopupEur: 1000,
  notes: { en: ["n"], fr: ["n"] },
};

describe("wallet copy: formatting", () => {
  it("writes whole euros without decimals and keeps cents when needed", () => {
    expect(eurAmount(10, "en")).toBe("€10");
    expect(eurAmount(10, "fr")).toBe("10 €");
    expect(eurAmount(1000, "en")).toBe("€1,000");
    expect(eurAmount(0.1, "en")).toBe("€0.10");
    expect(eurAmount(0.92, "fr")).toMatch(/^0,92\s€$/);
  });

  it("groups integers per locale", () => {
    expect(count(100000, "en")).toBe("100,000");
    expect(count(100000, "fr")).toMatch(/^100\s000$/);
  });

  it("formats micro-euros for the estimator", () => {
    expect(formatMicrosEur(12_540_000, "en")).toBe("€12.54");
    expect(formatMicrosEur(0, "en")).toBe("€0.00");
  });
});

describe("wallet copy: facts come from the price list", () => {
  it("quotes publicPriceTable() and whatTenEuroBuys(), never typed by hand", () => {
    const live = publicPriceTable();
    expect(PRICE_TABLE).toEqual(live);
    expect(TEN_EURO).toEqual(whatTenEuroBuys());
    const en = walletFacts("en");
    expect(en.signupCredit).toBe(eurAmount(live.signupCreditEur, "en"));
    expect(en.per1000Calls).toBe(eurAmount(live.per1000CallsEur, "en"));
    expect(en.cpuHour.small).toBe(eurAmount(live.cpuHourEur.small, "en"));
    expect(en.minTopup).toBe(eurAmount(live.minTopupEur, "en"));
    expect(en.signupDays).toBe(live.signupCreditDays);
    expect(en.creditCalls).toBe(count(whatTenEuroBuys().toolCalls, "en"));
    expect(en.creditServers).toBe(PLAN_CAPABILITIES.free.servers);
    expect(en.fundedServers).toBe(PLAN_CAPABILITIES.pro.servers);
  });

  it("follows a different price list when given one", () => {
    const other = walletFacts("en", { ...TABLE, per1000CallsEur: 0.25, minTopupEur: 20 });
    expect(other.per1000Calls).toBe("€0.25");
    expect(other.minTopup).toBe("€20");
  });

  it("states the offer in both languages with the ad-safe claims", () => {
    const f = walletFacts("en");
    expect(SIGNUP_OFFER.en).toBe(`${f.signupCredit} of free credit at sign-up, no card`);
    expect(WALLET_SUMMARY.en).toContain("no subscription");
    expect(WALLET_SUMMARY.en).toContain("no surprise bills");
    expect(WALLET_SUMMARY.en).toContain(f.per1000Calls);
    expect(WALLET_SUMMARY.fr).toContain("sans abonnement");
    expect(WALLET_SUMMARY.fr).toContain("aucune facture surprise");
    for (const text of [...Object.values(WALLET_SUMMARY), ...Object.values(SIGNUP_OFFER)]) {
      for (const re of RETIRED_PRICING_PHRASES) expect(text).not.toMatch(re);
    }
  });
});

describe("wallet copy: estimator arithmetic", () => {
  it("prices compute and calls over 30 days in integer micro-euros", () => {
    const e = estimateMonthly(
      { servers: 1, hoursPerDay: 10, callsPerDay: 1000, cpuShare: 0.1 },
      TABLE
    );
    // 1 × 10 h × 10% × 30 days = 30 CPU-hours × €0.92 = €27.60
    expect(e.cpuHours).toBeCloseTo(30, 10);
    expect(e.computeMicros).toBe(27_600_000);
    // 1,000 × 30 = 30,000 calls × €0.10 / 1,000 = €3.00
    expect(e.calls).toBe(30_000);
    expect(e.callsMicros).toBe(3_000_000);
    expect(e.totalMicros).toBe(30_600_000);
    expect(Number.isInteger(e.totalMicros)).toBe(true);
    // €10 at €1.02 a day lasts about 9.8 days.
    expect(e.creditDays).toBeCloseTo(10_000_000 / (30_600_000 / ESTIMATE_DAYS), 6);
  });

  it("scales with the number of servers (small-box rate, the only one quoted)", () => {
    const base = { hoursPerDay: 8, callsPerDay: 0, cpuShare: 0.01 };
    const one = estimateMonthly({ ...base, servers: 1 }, TABLE);
    const three = estimateMonthly({ ...base, servers: 3 }, TABLE);
    expect(three.computeMicros).toBe(one.computeMicros * 3);
  });

  it("clamps inputs to what the product allows", () => {
    const e = estimateMonthly(
      { servers: 500, hoursPerDay: 40, callsPerDay: -5, cpuShare: 2 },
      TABLE
    );
    // 50 servers × 24 h × 100% × 30 days.
    expect(e.cpuHours).toBe(PLAN_CAPABILITIES.pro.servers * 24 * 30);
    expect(e.calls).toBe(0);
    const nan = estimateMonthly(
      { servers: Number.NaN, hoursPerDay: Number.NaN, callsPerDay: 0, cpuShare: 0 },
      TABLE
    );
    expect(nan.totalMicros).toBe(0);
  });

  it("says the credit is untouched when nothing is used", () => {
    const e = estimateMonthly(
      { servers: 1, hoursPerDay: 0, callsPerDay: 0, cpuShare: 0.05 },
      TABLE
    );
    expect(e.totalMicros).toBe(0);
    expect(e.creditDays).toBe(Infinity);
  });

  it("offers workload presets as shares of one core", () => {
    for (const w of WORKLOADS) {
      expect(w.cpuShare).toBeGreaterThan(0);
      expect(w.cpuShare).toBeLessThanOrEqual(1);
    }
  });
});

describe("wallet copy: structured data", () => {
  it("offers the free credit and the smallest top-up, never a monthly price", () => {
    const offers = marketingOffers();
    expect(offers.map((o) => o.price)).toEqual(["0", String(PRICE_TABLE.minTopupEur)]);
    const schema = walletProductSchema({
      siteUrl: "https://twinmcp.fr/",
      path: "/plans",
      locale: "en",
    });
    expect(schema.offers[0].url).toBe("https://twinmcp.fr/plans");
    expect(JSON.stringify(schema)).not.toMatch(/MONTH/);
  });

  it("builds the pricing ledger from the price list and the plan code", () => {
    const f = walletFacts("en");
    const row = (label: string) => FEATURES.find((r) => r.label === label)!;
    expect(row("Servers").values).toEqual({
      free: String(PLAN_CAPABILITIES.free.servers),
      pro: String(PLAN_CAPABILITIES.pro.servers),
    });
    expect(row("Tool calls").values.pro).toContain(f.per1000Calls);
    expect(row("Compute").values.free).toContain(f.cpuHour.small);
    expect(row("Credit").values.free).toContain(f.signupCredit);
  });
});

describe("wallet copy: French typography", () => {
  it("puts a narrow no-break space (never a plain space) before ; : ! ? in French", () => {
    const fr = walletFacts("fr");
    const texts = [
      WALLET_SUMMARY.fr,
      JSON.stringify(SIGNUP_OFFER.fr),
      fr.largerSizes,
      ...publicPriceTable().notes.fr,
      ...whatTenEuroBuys().examples.fr,
    ];
    for (const text of texts) expect(text).not.toMatch(/\S [;:!?]/);
  });
});
