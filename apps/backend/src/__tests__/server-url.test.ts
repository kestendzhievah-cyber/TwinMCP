import { describe, it, expect } from "vitest";
import {
  buildClientConfig,
  buildServerUrl,
  hasWakingMcp,
  serverConfigLabel,
} from "@/lib/mcp/client-config";
import { WARNINGS_META_KEY } from "@/lib/mcp/aggregate";

// NEXT_PUBLIC_API_URL is unset in tests: URLs are built against the origin.

describe("buildServerUrl (one URL per server, contract D3)", () => {
  it("points at /api/mcp/<serverSlug>, trailing slash of the origin dropped", () => {
    expect(buildServerUrl("https://twinmcp.fr", "my-server")).toBe(
      "https://twinmcp.fr/api/mcp/my-server"
    );
    expect(buildServerUrl("https://twinmcp.fr/", "my-server")).toBe(
      "https://twinmcp.fr/api/mcp/my-server"
    );
  });

  it("adds ?mode=router for router mode only", () => {
    expect(buildServerUrl("https://twinmcp.fr", "s", { router: true })).toBe(
      "https://twinmcp.fr/api/mcp/s?mode=router"
    );
    expect(buildServerUrl("https://twinmcp.fr", "s", { router: false })).toBe(
      "https://twinmcp.fr/api/mcp/s"
    );
  });

  it("labels the client entry after the server", () => {
    expect(serverConfigLabel("my-server")).toBe("twinmcp-my-server");
  });
});

describe("snippets for a router URL", () => {
  const url = buildServerUrl("https://twinmcp.fr", "s", { router: true });

  it("quotes the URL on shell lines (zsh globs an unquoted ?)", () => {
    const cc = buildClientConfig("claude-code", { url, apiKey: "ctx7sk_x", label: "twinmcp-s" });
    expect(cc.code).toContain(`"${url}"`);
    const other = buildClientConfig("other", { url, apiKey: "ctx7sk_x", label: "twinmcp-s" });
    expect(other.code).toContain(`mcp-remote "${url}"`);
    expect(other.code).toContain(`curl -s -X POST "${url}"`);
  });

  it("keeps a plain URL unquoted", () => {
    const plain = buildServerUrl("https://twinmcp.fr", "s");
    const cc = buildClientConfig("claude-code", {
      url: plain,
      apiKey: "ctx7sk_x",
      label: "twinmcp-s",
    });
    expect(cc.code).toContain(` ${plain} `);
  });

  it("embeds the URL verbatim in JSON configs", () => {
    const cursor = buildClientConfig("cursor", { url, apiKey: "ctx7sk_x", label: "twinmcp-s" });
    expect(cursor.code).toContain(`"url": "${url}"`);
  });
});

describe("hasWakingMcp", () => {
  it("is true when a warning says an MCP is waking", () => {
    expect(
      hasWakingMcp({ [WARNINGS_META_KEY]: [{ mcp: "fetch", state: "waking", message: "…" }] })
    ).toBe(true);
  });

  it("is false for unavailable-only warnings, no warnings or junk", () => {
    expect(hasWakingMcp({ [WARNINGS_META_KEY]: [{ mcp: "x", state: "unavailable" }] })).toBe(false);
    expect(hasWakingMcp({})).toBe(false);
    expect(hasWakingMcp(undefined)).toBe(false);
    expect(hasWakingMcp({ [WARNINGS_META_KEY]: "waking" })).toBe(false);
    expect(hasWakingMcp({ [WARNINGS_META_KEY]: [null] })).toBe(false);
  });
});
