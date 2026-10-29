import { describe, it, expect } from "vitest";
import { SERVERS, getServerBySlug } from "@/lib/servers/catalog";
import { OFFICIAL_MCPS, RETIRED_SLUGS } from "@/lib/servers/seed-catalog";
import { USE_CASES } from "@/lib/use-cases/registry";
import { getPostBySlug } from "@/lib/blog/posts";

// The public /servers pages may only describe MCPs a user can actually install
// on TwinMCP: each slug must be seeded (lib/servers/seed-catalog.ts, written to
// the database by scripts/seed-mcps.ts) and not retired.
const seeded = new Set(OFFICIAL_MCPS.map((m) => m.slug));
const retired = new Set(RETIRED_SLUGS);

describe("public server catalogue", () => {
  it("parses the seed", () => {
    expect(seeded.size).toBeGreaterThan(50);
    expect(retired.has("github")).toBe(true);
  });

  it("only lists installable MCPs", () => {
    for (const s of SERVERS) {
      expect(seeded.has(s.slug), `${s.slug} is not in the seed`).toBe(true);
      expect(retired.has(s.slug), `${s.slug} is retired`).toBe(false);
    }
  });

  it("only cross-links to existing catalogue pages", () => {
    for (const s of SERVERS) {
      for (const b of s.relatedBlogSlugs) {
        expect(getPostBySlug(b), `${s.slug} → /blog/${b}`).toBeDefined();
      }
    }
    for (const u of USE_CASES) {
      for (const r of u.relatedServerSlugs) {
        expect(getServerBySlug(r), `${u.slug} → ${r}`).toBeDefined();
      }
    }
  });

  it("never promises a hosted GitHub MCP", () => {
    const github = USE_CASES.find((u) => u.slug === "github-mcp");
    expect(github).toBeDefined();
    const copy = [github!.description, github!.heroHeadline, github!.heroSubheadline].join(" ");
    expect(copy).toMatch(/does not host/i);
  });
});
