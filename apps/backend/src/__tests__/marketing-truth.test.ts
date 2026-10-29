import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { maxMcpsForBoxSize, PLAN_CAPABILITIES } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";
import { FREE_MCP_LIMIT, PLANS, planCopy } from "@/components/pricing/pricing-data";
import { defaultFaqItems, frFaqItems } from "@/components/marketing/faq";

// Marketing copy that the product does not back is a trust leak. These guards
// pin the pricing/plan surface to the code that enforces it.
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

  it("prices the daily quota in tool calls, with the enforced numbers", () => {
    const free = PLANS.find((p) => p.id === "free")!;
    const pro = PLANS.find((p) => p.id === "pro")!;
    const fmt = (n: number) => n.toLocaleString("en-US");
    expect(free.bullets).toContain(`${fmt(getDailyLimit("free"))} tool calls / day`);
    expect(pro.bullets).toContain(`${fmt(getDailyLimit("pro"))} tool calls / day`);
    expect(free.bullets).toContain(`${PLAN_CAPABILITIES.free.servers} server`);
    expect(pro.bullets).toContain(`${PLAN_CAPABILITIES.pro.servers} servers`);
    expect(pro.bullets).toContain(`${PLAN_CAPABILITIES.pro.apiKeys} API keys`);
    expect(planCopy(free, "fr").bullets.join(" ")).toMatch(/appels d’outils/);
  });

  it("answers the quota and flat-price questions in both languages", () => {
    const en = defaultFaqItems.map((f) => `${f.q} ${f.a}`).join("\n");
    const fr = frFaqItems.map((f) => `${f.q} ${f.a}`).join("\n");
    expect(en).toMatch(/Only tool calls count/);
    expect(en).toMatch(/surprise bill/);
    expect(en).toMatch(/no per-call charges/);
    expect(fr).toMatch(/Seuls les appels d’outils comptent/);
    expect(fr).toMatch(/facture surprise/);
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
