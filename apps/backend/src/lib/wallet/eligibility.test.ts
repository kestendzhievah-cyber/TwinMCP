import { describe, it, expect } from "vitest";
import { OFFICIAL_MCPS } from "@/lib/servers/seed-catalog";
import { PRICING } from "./pricing";
import {
  canUseMcpOnPromo,
  isPromoOnly,
  PROMO_EXCLUDED_MCP_SLUGS,
  PROMO_LOCKED_MCP_MESSAGE,
} from "./eligibility";

describe("PROMO_EXCLUDED_MCP_SLUGS", () => {
  it("names real catalogue slugs", () => {
    const slugs = new Set(OFFICIAL_MCPS.map((m) => m.slug));
    for (const slug of PROMO_EXCLUDED_MCP_SLUGS) expect(slugs.has(slug)).toBe(true);
  });

  it("covers the shell, the code interpreter and the headless browser", () => {
    expect(PROMO_EXCLUDED_MCP_SLUGS).toEqual(
      expect.arrayContaining(["shell", "e2b", "browserbase"])
    );
  });
});

describe("canUseMcpOnPromo", () => {
  it("refuses the listed slugs, official or not", () => {
    for (const slug of PROMO_EXCLUDED_MCP_SLUGS) {
      expect(canUseMcpOnPromo(slug)).toBe(false);
      expect(canUseMcpOnPromo(slug, { isOfficial: true })).toBe(false);
      expect(canUseMcpOnPromo(slug.toUpperCase())).toBe(false);
    }
  });

  it("allows every other official catalogue entry (no false positive)", () => {
    const excluded = new Set(PROMO_EXCLUDED_MCP_SLUGS);
    for (const m of OFFICIAL_MCPS) {
      if (excluded.has(m.slug)) continue;
      expect([m.slug, canUseMcpOnPromo(m.slug, { isOfficial: true })]).toEqual([m.slug, true]);
      // Even screened like a community entry, no official one trips the word filter.
      expect([m.slug, canUseMcpOnPromo(m.slug, { startCmd: m.startCmd })]).toEqual([m.slug, true]);
    }
  });

  it("screens community MCPs by slug words and start command", () => {
    expect(canUseMcpOnPromo("my-puppeteer-tools")).toBe(false);
    expect(canUseMcpOnPromo("playwright")).toBe(false);
    expect(canUseMcpOnPromo("python-sandbox")).toBe(false);
    expect(canUseMcpOnPromo("code_interpreter")).toBe(false);
    expect(canUseMcpOnPromo("web-terminal")).toBe(false);
    expect(canUseMcpOnPromo("innocent", { startCmd: "npx -y @playwright/mcp@latest" })).toBe(false);
    expect(canUseMcpOnPromo("innocent", { startCmd: "npx -y mcp-server-commands" })).toBe(false);
    expect(canUseMcpOnPromo("weather-mcp", { startCmd: "npx -y weather-mcp@1.0.0" })).toBe(true);
    // Whole words only.
    expect(canUseMcpOnPromo("shellfish-facts")).toBe(true);
    expect(canUseMcpOnPromo("execution-log-reader")).toBe(true);
  });

  it("trusts the explicit list only for official entries", () => {
    expect(canUseMcpOnPromo("headless-cms", { isOfficial: true })).toBe(true);
    expect(canUseMcpOnPromo("headless-cms")).toBe(false);
  });
});

describe("isPromoOnly", () => {
  it("is true for a never-funded account", () => {
    expect(isPromoOnly({ funded: false })).toBe(true);
    expect(isPromoOnly({ funded: false }, null)).toBe(true);
    expect(isPromoOnly({ funded: false }, "canceled")).toBe(true);
  });

  it("is false once funded, whatever the subscription says", () => {
    expect(isPromoOnly({ funded: true })).toBe(false);
    expect(isPromoOnly({ funded: true }, "canceled")).toBe(false);
  });

  it("is false for a subscription still being paid (pre-conversion)", () => {
    expect(isPromoOnly({ funded: false }, "active")).toBe(false);
    expect(isPromoOnly({ funded: false }, "past_due")).toBe(false);
  });

  it("keeps a trialing or trial-then-converted account promo-only", () => {
    // The conversion script cancels a trial and grants the sign-up credit: it
    // never paid, so it must not unlock the excluded compute MCPs.
    expect(isPromoOnly({ funded: false }, "trialing")).toBe(true);
    expect(isPromoOnly({ funded: false }, "canceled")).toBe(true);
  });
});

describe("PROMO_LOCKED_MCP_MESSAGE", () => {
  it("is the contract message, with the real minimum top-up", () => {
    expect(PRICING.minTopupEur).toBe(10);
    expect(PROMO_LOCKED_MCP_MESSAGE).toBe("This MCP needs a funded wallet (top up €10 to unlock)");
  });
});
