import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BRAND_LOGOS } from "@/components/brand/logos.generated";
import { BrandLogo, getBrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { IDE_LABELS } from "@/lib/mcp/client-config";
import { OFFICIAL_MCPS, RETIRED_SLUGS } from "@/lib/servers/seed-catalog";

// Trademark guard (docs/DESIGN.md "Logos and trademark rules", redesign §7):
// a brand mark may only be shown for a client we connect to or an MCP a user
// can install, and never for a brand whose rules forbid it.
const DENY = [
  "vscode", // Microsoft forbids the icon: text only
  "github", // retired from the catalogue
  "slack", // needs the official asset under Slack's media-kit terms
  "excel", // Microsoft
  "markitdown", // Microsoft
  "nasa", // insignia is legally restricted
  "revit", // Autodesk marks, our own MCP
  "airbnb", // unofficial MCP
  "youtube", // third-party servers, strict rules
  "youtube-data",
];

const ideKeys = new Set(Object.keys(IDE_LABELS));
const catalogue = new Set(OFFICIAL_MCPS.map((m) => m.slug));
const keys = Object.keys(BRAND_LOGOS);

describe("brand logos", () => {
  it("only keys an IdeKey or a catalogue slug", () => {
    const strays = keys.filter((k) => !ideKeys.has(k) && !catalogue.has(k));
    expect(strays).toEqual([]);
  });

  it("never includes a retired or denied brand", () => {
    const banned = keys.filter((k) => RETIRED_SLUGS.includes(k) || DENY.includes(k));
    expect(banned).toEqual([]);
  });

  it("has a valid, non-empty path and hex for every mark", () => {
    for (const [key, def] of Object.entries(BRAND_LOGOS)) {
      expect(def.title.trim(), key).not.toBe("");
      expect(def.path.trim(), key).not.toBe("");
      if (def.hex !== null) expect(def.hex, key).toMatch(/^[0-9A-F]{6}$/);
    }
  });

  it("credits Git (CC BY 3.0)", () => {
    expect(BRAND_LOGOS.git?.credit).toMatch(/Jason Long/);
  });

  it("keeps the brand-mandated colours", () => {
    expect(BRAND_LOGOS.zed?.hex).toBe("1348DC");
    expect(BRAND_LOGOS.windsurf?.hex).toBeNull();
    expect(BRAND_LOGOS.cursor?.hex).toBeNull();
    expect(BRAND_LOGOS.notion?.hex).toBeNull();
    expect(BRAND_LOGOS.other?.hex).toBeNull();
    // Claude stays Clay in both themes: never recoloured.
    expect(BRAND_LOGOS["claude-desktop"]?.hex).toBe("D97757");
    expect(BRAND_LOGOS["claude-code"]?.hex).toBe("D97757");
  });

  it("looks up only real keys", () => {
    expect(hasBrandLogo("notion")).toBe(true);
    expect(hasBrandLogo("vscode")).toBe(false);
    expect(hasBrandLogo("constructor")).toBe(false);
    expect(hasBrandLogo(undefined)).toBe(false);
    expect(getBrandLogo("postgres")?.title).toBe("PostgreSQL");
  });

  it("renders a labelled svg, a hidden decorative one, and null for unknown slugs", () => {
    const labelled = renderToStaticMarkup(createElement(BrandLogo, { slug: "zed", size: 24 }));
    expect(labelled).toContain('role="img"');
    expect(labelled).toContain('aria-label="Zed"');
    expect(labelled).toContain('fill="#1348DC"');

    const decorative = renderToStaticMarkup(
      createElement(BrandLogo, { slug: "notion", decorative: true })
    );
    expect(decorative).toContain('aria-hidden="true"');
    expect(decorative).not.toContain("role=");
    expect(decorative).toContain('fill="currentColor"');

    const mono = renderToStaticMarkup(createElement(BrandLogo, { slug: "stripe", mono: true }));
    expect(mono).toContain('fill="currentColor"');

    expect(renderToStaticMarkup(createElement(BrandLogo, { slug: "vscode" }))).toBe("");
  });
});
