import { describe, it, expect } from "vitest";
import { buildLlmsFullTxt, buildLlmsTxt, OPENAPI_PATH } from "@/lib/marketing/llms";
import { PLAN_CAPABILITIES, maxMcpsForBoxSize } from "@/lib/plan-features";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";
import { SERVERS } from "@/lib/servers/catalog";

const facts = { siteUrl: "https://twinmcp.fr/" };
const W = walletFacts("en");

describe("llms.txt", () => {
  const txt = buildLlmsTxt(facts);

  it("follows the llmstxt.org shape: H1, summary blockquote, link sections", () => {
    expect(txt.startsWith("# TwinMCP\n\n> ")).toBe(true);
    expect(txt).toContain("## Docs");
    expect(txt).toContain("## Optional");
    expect(txt).not.toContain("twinmcp.fr//");
  });

  it("states the plan facts from the code that enforces them", () => {
    expect(txt).toContain(`${PLAN_CAPABILITIES.free.servers} server (small box)`);
    expect(txt).toContain(`up to ${FREE_MCP_LIMIT} MCPs plus TwinMCP Docs`);
    expect(txt).toContain(`${PLAN_CAPABILITIES.free.apiKeys} API keys`);
    expect(txt).toContain(`${PLAN_CAPABILITIES.pro.apiKeys} API keys`);
    expect(txt).toContain(`${PLAN_CAPABILITIES.pro.servers} servers`);
    expect(txt).toContain(`up to ${maxMcpsForBoxSize("small")}, ${maxMcpsForBoxSize("medium")}`);
  });

  it("states the wallet prices from lib/wallet/pricing.ts", () => {
    expect(txt).toContain(`Tool calls cost ${W.per1000Calls} per 1,000`);
    expect(txt).toContain(`${W.cpuHour.small} per active CPU-hour on a small box`);
    expect(txt).toContain(`${W.signupCredit} of promotional credit, valid ${W.signupDays} days`);
    expect(txt).toContain(`Top-ups from ${W.minTopup}`);
    expect(txt).toContain("HTTP 402");
    expect(txt).toContain("-32008");
    expect(txt).toContain("No subscription");
    for (const slug of PROMO_EXCLUDED_MCP_SLUGS) {
      const name = SERVERS.find((s) => s.slug === slug)?.name ?? slug;
      expect(txt, slug).toContain(name);
    }
    expect(txt).not.toMatch(/tool calls a day|daily quota|€14\.99|days free/);
  });

  it("leads with the server URL and says off-catalogue servers need a funded account", () => {
    const server = txt.indexOf("https://twinmcp.fr/api/mcp/<server-slug>,");
    const perMcp = txt.indexOf("https://twinmcp.fr/api/mcp/<server-slug>/<mcp-slug>");
    expect(server).toBeGreaterThan(-1);
    expect(perMcp).toBeGreaterThan(server);
    expect(txt).toContain("?mode=router");
    expect(txt).toMatch(/any other MCP server .* must be published .* once the account is funded/);
    expect(txt).not.toMatch(/a stdio server, or your own/);
  });

  it("gives the connection shape and the key URLs", () => {
    expect(txt).toContain("https://twinmcp.fr/api/mcp/<server-slug>/<mcp-slug>");
    expect(txt).toContain("Authorization: Bearer <API key>");
    for (const path of [
      "/docs",
      "/docs#troubleshooting",
      OPENAPI_PATH,
      "/plans",
      "/servers",
      "/migrate-from-smithery",
      "/security",
      "/demo",
      "/changelog",
      "/llms-full.txt",
      "/docs#credit",
    ]) {
      expect(txt, path).toContain(`https://twinmcp.fr${path}`);
    }
  });

  it("never claims what is not sold", () => {
    expect(txt).not.toMatch(/\bSLA\b|\bSSO\b|SOC ?2|ISO ?27001|refund|data residency|always-on/i);
  });
});

describe("llms-full.txt", () => {
  const full = buildLlmsFullTxt(facts);

  it("lists every catalogue page and the changelog", () => {
    for (const s of SERVERS) expect(full).toContain(`https://twinmcp.fr/servers/${s.slug}`);
    expect(full).toContain("## Changelog");
    expect(full).toContain("27 October 2026");
  });

  it("documents the proxy errors of the scoped-key and request-id contracts", () => {
    expect(full).toContain("-32003");
    expect(full).toContain("-32008");
    expect(full).toContain("402");
    expect(full).not.toMatch(/daily tool-call quota/);
    expect(full).toContain("x-twinmcp-request-id");
    expect(full).toContain("https://twinmcp.fr/docs#troubleshooting");
  });

  it("only names unsold features in the explicit 'Not offered' line", () => {
    const lines = full.split("\n").filter((l) => /\bSLA\b|\bSSO\b|region/i.test(l));
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith("- Not offered:")).toBe(true);
    expect(full).not.toMatch(/SOC ?2|ISO ?27001|refund|data residency|always-on/i);
  });
});
