import { describe, expect, it } from "vitest";
import {
  ONBOARDING_SLUGS,
  POPULAR_ONBOARDING_SLUGS,
  hasRequiredConfig,
  popularRank,
  sampleToolPrompt,
} from "@/lib/mcp/onboarding-catalog";
import { OFFICIAL_MCPS, RETIRED_SLUGS } from "@/lib/servers/seed-catalog";
import { hasBrandLogo } from "@/components/brand/brand-logo";
import { PROMO_EXCLUDED_MCP_SLUGS } from "@/lib/wallet/eligibility";

const bySlug = new Map(OFFICIAL_MCPS.map((m) => [m.slug, m]));

describe("onboarding catalogue", () => {
  it("lists only box-hosted, non-retired catalogue entries", () => {
    for (const slug of [...POPULAR_ONBOARDING_SLUGS, ...ONBOARDING_SLUGS]) {
      const entry = bySlug.get(slug);
      expect(entry, slug).toBeDefined();
      expect(entry?.hostMode ?? "box", slug).toBe("box");
      expect((RETIRED_SLUGS as readonly string[]).includes(slug), slug).toBe(false);
    }
  });

  it("shows popular apps with an approved logo that the free credit may run", () => {
    for (const slug of POPULAR_ONBOARDING_SLUGS) {
      expect(hasBrandLogo(slug), slug).toBe(true);
      expect(PROMO_EXCLUDED_MCP_SLUGS.includes(slug), slug).toBe(false);
      expect(sampleToolPrompt(slug)).not.toBe(`Use the ${slug} tool`);
    }
  });

  it("keeps the instant list zero-config and disjoint from the popular one", () => {
    for (const slug of ONBOARDING_SLUGS) {
      expect(hasRequiredConfig(bySlug.get(slug)?.configSchema), slug).toBe(false);
      expect(popularRank(slug), slug).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("ranks popular apps in their curated order", () => {
    expect(popularRank("notion")).toBe(0);
    expect(popularRank("fetch")).toBe(Number.POSITIVE_INFINITY);
  });
});
