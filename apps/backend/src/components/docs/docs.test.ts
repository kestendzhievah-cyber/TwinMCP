import { describe, expect, it } from "vitest";
import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  MATRIX_CLIENTS,
  buildClientConfig,
  proxyUrl,
} from "@/lib/mcp/client-config";
import { DOCS_EXAMPLE, docsClientEntries, docsExampleUrl } from "@/components/docs/client-setup";
import {
  RPC_CODES,
  SERVER_SCOPE_MESSAGE,
  docsPlanFacts,
  formatCount,
  rotationOverlapHours,
} from "@/components/docs/docs-facts";

const SITE = "https://twinmcp.fr";

describe("docsClientEntries", () => {
  it.each(["en", "fr"] as const)("lists every named client the dashboard supports (%s)", (l) => {
    const entries = docsClientEntries(l, SITE);
    expect(entries.map((e) => e.ide)).toEqual(MATRIX_CLIENTS);
    expect(entries).toHaveLength(7);
    expect(entries.map((e) => e.name)).toEqual(MATRIX_CLIENTS.map((k) => IDE_LABELS[k]));
    expect(entries.some((e) => e.ide === "other")).toBe(false);
  });

  it("uses the exact snippet buildClientConfig() produces (no hand-copied drift)", () => {
    for (const locale of ["en", "fr"] as const) {
      const url = docsExampleUrl(locale, SITE);
      for (const e of docsClientEntries(locale, SITE)) {
        const cfg = buildClientConfig(e.ide, {
          url,
          apiKey: API_KEY_PLACEHOLDER,
          label: DOCS_EXAMPLE[locale].mcp,
        });
        expect(e.code).toBe(cfg.code);
        expect(e.language).toBe(cfg.language);
        expect(e.code).toContain(`Bearer ${API_KEY_PLACEHOLDER}`);
      }
    }
  });

  it("shows the real config path in EN and only translates instructions in FR", () => {
    const url = docsExampleUrl("en", SITE);
    for (const e of docsClientEntries("en", SITE)) {
      const cfg = buildClientConfig(e.ide, { url, apiKey: API_KEY_PLACEHOLDER, label: "notion" });
      expect(e.location).toBe(cfg.filename);
    }
    const fr = Object.fromEntries(docsClientEntries("fr", SITE).map((e) => [e.ide, e]));
    expect(fr["claude-code"].location).toContain("terminal");
    expect(fr["claude-code"].location).not.toMatch(/run in your/i);
    expect(fr.vscode.location).toBe(".vscode/mcp.json");
    expect(fr.windsurf.location).toBe("~/.codeium/windsurf/mcp_config.json");
  });

  it("flags the stdio-only clients that go through mcp-remote", () => {
    const bridged = docsClientEntries("en", SITE)
      .filter((e) => e.bridged)
      .map((e) => e.ide);
    expect(bridged.sort()).toEqual(["claude-desktop", "zed"]);
  });

  it("marks only Claude Code as a terminal command", () => {
    const commands = docsClientEntries("en", SITE)
      .filter((e) => e.command)
      .map((e) => e.ide);
    expect(commands).toEqual(["claude-code"]);
  });

  it("builds the example URL with the same proxyUrl() as the dashboard", () => {
    expect(docsExampleUrl("en", SITE)).toBe(proxyUrl(SITE, "my-server", "notion"));
    expect(docsExampleUrl("fr", SITE)).toBe(proxyUrl(SITE, "mon-serveur", "notion"));
  });
});

describe("docs facts", () => {
  it("formats counts per locale", () => {
    expect(formatCount(5000, "en")).toBe("5,000");
    expect(formatCount(5000, "fr")).toBe("5 000");
    expect(formatCount(50, "fr")).toBe("50");
  });

  it("derives the key allowances from the plan module", () => {
    const f = docsPlanFacts();
    expect(f).toEqual({ freeKeys: 3, proKeys: 20 });
  });

  it("documents the 24 h rotation overlap and the K2 scope error", () => {
    expect(rotationOverlapHours()).toBe(24);
    expect(RPC_CODES.wrongServer).toBe(-32003);
    expect(RPC_CODES.noCredit).toBe(-32008);
    expect(SERVER_SCOPE_MESSAGE).toBe("This API key is restricted to another server.");
  });
});
