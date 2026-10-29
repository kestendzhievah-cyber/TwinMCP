import { describe, it, expect } from "vitest";
import { marketingClientSnippets, EXAMPLE_MCP_SLUG } from "@/lib/marketing/client-snippets";
import { API_KEY_PLACEHOLDER, MATRIX_CLIENTS, proxyUrl } from "@/lib/mcp/client-config";

describe("marketingClientSnippets", () => {
  const snippets = marketingClientSnippets("https://twinmcp.fr/");

  it("has one tab per named client, in the Connect panel's order", () => {
    expect(snippets.map((s) => s.id)).toEqual(MATRIX_CLIENTS);
    expect(snippets.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        "cursor",
        "claude-desktop",
        "claude-code",
        "vscode",
        "windsurf",
        "cline",
        "zed",
      ])
    );
    expect(snippets.map((s) => s.id)).not.toContain("other");
  });

  it("shows the placeholder URL and key, never a real-looking credential", () => {
    const url = proxyUrl("https://twinmcp.fr", "my-server", EXAMPLE_MCP_SLUG);
    for (const s of snippets) {
      expect(s.code, s.id).toContain(url);
      expect(s.code, s.id).toContain(`Bearer ${API_KEY_PLACEHOLDER}`);
      expect(s.label, s.id).not.toBe("");
      expect(s.filename, s.id).not.toBe("");
    }
  });

  it("keeps tab ids unique", () => {
    expect(new Set(snippets.map((s) => s.id)).size).toBe(snippets.length);
  });
});
