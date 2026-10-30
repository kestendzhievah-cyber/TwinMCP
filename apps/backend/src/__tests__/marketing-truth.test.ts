import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { maxMcpsForBoxSize, PLAN_CAPABILITIES } from "@/lib/plan-features";
import { publicPriceTable } from "@/lib/wallet/pricing";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import {
  RETIRED_PRICING_PHRASES,
  WALLET_SUMMARY,
  walletFacts,
} from "@/components/pricing/wallet-copy";
import { defaultFaqItems, frFaqItems } from "@/components/marketing/faq";
import { buildLlmsFullTxt, buildLlmsTxt } from "@/lib/marketing/llms";
import { COMPARISONS } from "@/lib/compare/data";

// Marketing copy that the product does not back is a trust leak. These guards
// pin the pricing surface to the code that enforces it: the wallet price list
// (lib/wallet/pricing.ts) and the allowances (lib/plan-features.ts).
const SRC = join(__dirname, "..");
const MARKETING_FILES = [
  "components/marketing/hero.tsx",
  "components/marketing/hero-mockup.tsx",
  "components/marketing/how-it-works.tsx",
  "components/marketing/faq.tsx",
  "components/marketing/pricing-teaser.tsx",
  "components/marketing/footer.tsx",
  "components/pricing/pricing-data.ts",
  "app/(marketing)/plans/page.tsx",
  "app/(marketing)/page.tsx",
  "app/fr/page.tsx",
  "lib/servers/catalog.ts",
  "lib/use-cases/registry.ts",
];

// Every surface that states TwinMCP's price since the switch to the prepaid
// wallet (2026-10-29). None may describe the retired subscription model.
const PRICING_SURFACES = [
  "components/pricing/pricing-data.ts",
  "components/marketing/hero.tsx",
  "components/marketing/faq.tsx",
  "components/marketing/pricing-teaser.tsx",
  "components/marketing/how-it-works.tsx",
  "components/marketing/smithery-migration.tsx",
  "components/marketing/demo-content.tsx",
  "components/marketing/security-content.tsx",
  "components/pricing/price-table.tsx",
  "components/pricing/cost-estimator.tsx",
  "components/pricing/pricing-experience.tsx",
  "components/pricing/comparison-table.tsx",
  "components/pricing/trust-signals.tsx",
  "components/pricing/credit-docs-section.tsx",
  "app/(marketing)/plans/page.tsx",
  "app/fr/tarifs/page.tsx",
  "app/docs/page.tsx",
  "app/fr/docs/page.tsx",
  "app/servers/_components/copy.ts",
  "lib/compare/data.ts",
  "lib/solutions/data.ts",
  "lib/seo/server-pages.ts",
  "lib/marketing/llms.ts",
  "app/(marketing)/page.tsx",
  "app/fr/page.tsx",
  "app/(auth)/sign-up/form.tsx",
  "app/solutions/_components/solution-view.tsx",
  "app/compare/_components/compare-view.tsx",
  "app/use-cases/cursor-mcp-hosting/page.tsx",
  "app/use-cases/github-mcp/page.tsx",
  "app/blog/mcp-server-hosting/page.tsx",
  "app/fr/blog/mcp-server-hosting/page.tsx",
  "components/marketing/social-proof.tsx",
  "components/marketing/hero-mockup.tsx",
];

describe("marketing truth", () => {
  it("states the real MCP-per-server rule, never a fixed '5 official MCPs'", () => {
    expect(FREE_MCP_LIMIT).toBe(maxMcpsForBoxSize("small"));
    for (const file of MARKETING_FILES) {
      const src = readFileSync(join(SRC, file), "utf8");
      expect(src, file).not.toMatch(/5 official|5 MCPs? officiels|five official/i);
      // Regions are not applied by the runtime: no region labels in copy.
      expect(src, file).not.toMatch(/\b(?:fra1|iad1|cdg1)\b/);
    }
  });

  it("never describes the retired subscription pricing", () => {
    for (const file of PRICING_SURFACES) {
      const src = readFileSync(join(SRC, file), "utf8");
      for (const re of RETIRED_PRICING_PHRASES) expect(src, `${file} ${re}`).not.toMatch(re);
      // No daily cap any more: the wallet is the limit.
      expect(src, file).not.toMatch(
        /getDailyLimit|PRO_TRIAL_DAYS|\d[\d,]* tool calls (?:a|per) day/
      );
    }
  });

  it("keeps the terms free of the retired subscription (termination, billing period, free plan)", () => {
    const legal = [
      "app/(marketing)/legal/terms/page.tsx",
      "app/(marketing)/legal/en/terms/page.tsx",
    ];
    const retired = [
      /résilier ton abonnement/i,
      /période de facturation/i,
      /billing period/i,
      /plan gratuit/i,
      /free plan/i,
      /cancel your subscription/i,
    ];
    for (const file of legal) {
      const src = readFileSync(join(SRC, file), "utf8");
      for (const re of [...RETIRED_PRICING_PHRASES, ...retired]) {
        expect(src, `${file} ${re}`).not.toMatch(re);
      }
    }
  });

  it("keeps the generated briefs and comparisons free of the old pricing", () => {
    const facts = { siteUrl: "https://twinmcp.fr" };
    const full = buildLlmsFullTxt(facts);
    // The changelog keeps its dated history; everything above it must be current.
    const current = full.slice(0, full.indexOf("## Changelog"));
    const compare = JSON.stringify(
      COMPARISONS.map((c) => [c.rows.map((r) => r.twinmcp), c.chooseTwinmcp, c.faq, c.summary])
    );
    for (const text of [buildLlmsTxt(facts), current, compare, ...Object.values(WALLET_SUMMARY)]) {
      for (const re of RETIRED_PRICING_PHRASES) expect(text).not.toMatch(re);
    }
  });

  it("quotes the price list and the allowances the product enforces", () => {
    const table = publicPriceTable();
    const en = walletFacts("en");
    const fr = walletFacts("fr");
    const enFaq = defaultFaqItems.map((f) => `${f.q} ${f.a}`).join("\n");
    const frFaq = frFaqItems.map((f) => `${f.q} ${f.a}`).join("\n");
    expect(en.signupDays).toBe(table.signupCreditDays);
    expect(enFaq).toContain(`${en.signupCredit} of free credit`);
    expect(enFaq).toContain(en.per1000Calls);
    expect(enFaq).toContain(`up to ${en.fundedServers} servers`);
    expect(en.fundedServers).toBe(PLAN_CAPABILITIES.pro.servers);
    expect(frFaq).toContain(`${fr.signupCredit} de crédit offert`);
    expect(frFaq).toContain(fr.per1000Calls);
  });

  it("answers the credit and surprise-bill questions in both languages", () => {
    const en = defaultFaqItems.map((f) => `${f.q} ${f.a}`).join("\n");
    const fr = frFaqItems.map((f) => `${f.q} ${f.a}`).join("\n");
    expect(en).toMatch(/Only tool calls are charged/);
    expect(en).toMatch(/surprise bill/);
    expect(en).toMatch(/no subscription/);
    expect(fr).toMatch(/Seuls les appels d’outils sont facturés/);
    expect(fr).toMatch(/facture surprise/);
    expect(fr).toMatch(/sans abonnement/);
    expect(defaultFaqItems).toHaveLength(frFaqItems.length);
  });

  it("never promises what is not sold", () => {
    const banned =
      /\bSLA\b|\bSSO\b|SOC ?2|ISO ?27001|data residency|résidence des données|always-on|team sharing|refund|rembours/i;
    for (const item of [...defaultFaqItems, ...frFaqItems]) {
      expect(`${item.q} ${item.a}`).not.toMatch(banned);
    }
  });
});
