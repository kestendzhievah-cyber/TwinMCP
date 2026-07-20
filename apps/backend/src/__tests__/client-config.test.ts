import { describe, it, expect } from "vitest";
import { IDE_LABELS, buildClientConfig, proxyUrl, type IdeKey } from "@/lib/mcp/client-config";

const URL = proxyUrl("https://twinmcp.fr", "twinmcp", "fetch");
const KEY = "ctx7sk_test_abc123";
const KEYS = Object.keys(IDE_LABELS) as IdeKey[];

describe("buildClientConfig", () => {
  it("covers the documented major MCP clients", () => {
    expect(KEYS).toEqual(
      expect.arrayContaining([
        "cursor",
        "claude-desktop",
        "claude-code",
        "vscode",
        "windsurf",
        "cline",
        "zed",
        "other",
      ])
    );
  });

  it.each(KEYS)("produces a usable snippet for %s (url + bearer key)", (ide) => {
    const cfg = buildClientConfig(ide, { url: URL, apiKey: KEY, label: "fetch" });
    expect(cfg.code).toContain(URL);
    expect(cfg.code).toContain(KEY);
    // The bearer credential must be present verbatim so the client authenticates.
    expect(cfg.code).toContain(`Bearer ${KEY}`);
    expect(cfg.filename).toBeTruthy();
  });

  it.each(KEYS.filter((k) => k !== "claude-code" && k !== "other"))(
    "emits parseable JSON for %s",
    (ide) => {
      const cfg = buildClientConfig(ide, { url: URL, apiKey: KEY, label: "fetch" });
      expect(cfg.language).toBe("json");
      expect(() => JSON.parse(cfg.code)).not.toThrow();
    }
  );

  it("Cursor: native Streamable HTTP (url + Authorization header)", () => {
    const c = JSON.parse(
      buildClientConfig("cursor", { url: URL, apiKey: KEY, label: "fetch" }).code
    );
    expect(c.mcpServers.fetch.url).toBe(URL);
    expect(c.mcpServers.fetch.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("VS Code: .vscode/mcp.json uses `servers` + type http", () => {
    const cfg = buildClientConfig("vscode", { url: URL, apiKey: KEY, label: "fetch" });
    const c = JSON.parse(cfg.code);
    expect(cfg.filename).toContain(".vscode/mcp.json");
    expect(c.servers.fetch.type).toBe("http");
    expect(c.servers.fetch.url).toBe(URL);
    expect(c.servers.fetch.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("Windsurf: references the remote server by serverUrl", () => {
    const c = JSON.parse(
      buildClientConfig("windsurf", { url: URL, apiKey: KEY, label: "fetch" }).code
    );
    expect(c.mcpServers.fetch.serverUrl).toBe(URL);
  });

  it("Cline: explicit streamableHttp transport", () => {
    const c = JSON.parse(
      buildClientConfig("cline", { url: URL, apiKey: KEY, label: "fetch" }).code
    );
    expect(c.mcpServers.fetch.type).toBe("streamableHttp");
    expect(c.mcpServers.fetch.url).toBe(URL);
  });

  it("Claude Desktop & Zed: bridge stdio-only clients via mcp-remote", () => {
    for (const ide of ["claude-desktop", "zed"] as const) {
      const c = JSON.parse(buildClientConfig(ide, { url: URL, apiKey: KEY, label: "fetch" }).code);
      const entry = ide === "zed" ? c.context_servers.fetch : c.mcpServers.fetch;
      expect(entry.command).toBe("npx");
      expect(entry.args).toContain("mcp-remote");
      expect(entry.args).toContain(URL);
      expect(entry.args).toContain(`Authorization: Bearer ${KEY}`);
    }
  });

  it("Claude Code: CLI registers an HTTP transport", () => {
    const cfg = buildClientConfig("claude-code", { url: URL, apiKey: KEY, label: "fetch" });
    expect(cfg.language).toBe("bash");
    expect(cfg.code).toContain("claude mcp add --transport http");
    expect(cfg.code).toContain(URL);
    expect(cfg.code).toContain(`Authorization: Bearer ${KEY}`);
  });
});
