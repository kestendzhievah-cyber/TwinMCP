import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { displayHost, parseExternalUrl, resolveSiteLinks, sameAsList } from "@/lib/site-links";

describe("site links", () => {
  it("accepts only absolute http(s) URLs", () => {
    expect(parseExternalUrl(undefined)).toBeNull();
    expect(parseExternalUrl(null)).toBeNull();
    expect(parseExternalUrl("")).toBeNull();
    expect(parseExternalUrl("   ")).toBeNull();
    expect(parseExternalUrl("status.twinmcp.fr")).toBeNull();
    expect(parseExternalUrl("javascript:alert(1)")).toBeNull();
    expect(parseExternalUrl("ftp://example.com")).toBeNull();
    expect(parseExternalUrl(" https://status.example.com ")).toBe("https://status.example.com");
    expect(parseExternalUrl("http://example.com/x")).toBe("http://example.com/x");
  });

  it("shows the host of a URL", () => {
    expect(displayHost("https://status.example.com/")).toBe("status.example.com");
    expect(displayHost("not a url")).toBe("not a url");
  });

  it("resolves nothing when no env var is set", () => {
    const links = resolveSiteLinks({});
    expect(links.status).toBeNull();
    expect(links.social).toEqual({ twitter: null, github: null, linkedin: null });
    expect(sameAsList(links.social)).toEqual([]);
  });

  it("resolves each link from its own env var and lists the set ones for sameAs", () => {
    const links = resolveSiteLinks({
      NEXT_PUBLIC_STATUS_URL: "https://status.example.com",
      NEXT_PUBLIC_TWITTER_URL: "https://x.com/example",
      NEXT_PUBLIC_GITHUB_URL: "",
      NEXT_PUBLIC_LINKEDIN_URL: "https://www.linkedin.com/company/example",
    });
    expect(links.status).toBe("https://status.example.com");
    expect(links.social.github).toBeNull();
    expect(sameAsList(links.social)).toEqual([
      "https://x.com/example",
      "https://www.linkedin.com/company/example",
    ]);
  });

  it("no longer hard-codes the unresolved status page or the dead social profiles", () => {
    const src = join(__dirname, "..");
    for (const file of [
      "components/marketing/footer.tsx",
      "app/onboarding/layout.tsx",
      "components/auth/auth-shell.tsx",
      "lib/seo/schema.ts",
    ]) {
      const code = readFileSync(join(src, file), "utf8");
      expect(code, file).not.toMatch(/status\.twinmcp\.fr/);
      expect(code, file).not.toMatch(/(?:twitter|x)\.com\/twinmcp/i);
      expect(code, file).not.toMatch(/github\.com\/kestendzhievah-cyber/);
    }
  });
});
