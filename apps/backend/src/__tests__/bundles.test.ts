import { describe, it, expect } from "vitest";
import { BUNDLES } from "@/lib/mcp/bundles";

// Official catalog slugs that install with NO required config → safe for a
// one-click bundle. Keep in sync with scripts/seed-mcps.ts.
const ZERO_CONFIG = new Set([
  "fetch",
  "time",
  "memory",
  "sequential-thinking",
  "everything",
  "sqlite",
  "duckduckgo",
  "wikipedia",
  "calculator",
  "markitdown",
  "shell",
  "duckdb",
  "arxiv",
  "youtube",
  "chart",
]);

// These require config (or are control-plane only) → must never be bundled,
// or the "one-click, no setup" promise breaks.
const NOT_BUNDLEABLE = new Set(["filesystem", "git", "twinmcp-docs"]);

describe("MCP bundles", () => {
  it("has unique bundle ids", () => {
    const ids = BUNDLES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(BUNDLES)("bundle '$id' is well-formed and one-click safe", (bundle) => {
    expect(bundle.name).toBeTruthy();
    expect(bundle.tagline).toBeTruthy();
    expect(bundle.emoji).toBeTruthy();
    expect(bundle.slugs.length).toBeGreaterThan(0);
    // no duplicate slugs within a bundle
    expect(new Set(bundle.slugs).size).toBe(bundle.slugs.length);
    for (const slug of bundle.slugs) {
      expect(NOT_BUNDLEABLE.has(slug), `${slug} must not be bundled (needs config)`).toBe(false);
      expect(ZERO_CONFIG.has(slug), `${slug} is not a known zero-config official MCP`).toBe(true);
    }
  });
});
