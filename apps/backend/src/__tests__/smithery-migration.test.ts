import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { getComparison } from "@/lib/compare/data";

// The component's copy holds JSX at module level; vitest compiles it with the
// classic runtime, so React must be global before the module is evaluated.
(globalThis as { React?: typeof React }).React = React;
const { SMITHERY_MIGRATION_FAQ, smitheryShutdownRows, smitheryShutdownScope } = await import(
  "@/components/marketing/smithery-migration"
);

const SOURCE = readFileSync(
  join(__dirname, "..", "components/marketing/smithery-migration.tsx"),
  "utf8"
);

describe("Smithery migration page", () => {
  const smithery = getComparison("smithery")!;

  it("takes the shutdown facts from the sourced comparison data", () => {
    for (const locale of ["en", "fr"] as const) {
      const rows = smitheryShutdownRows(locale);
      expect(rows).toHaveLength(5);
      const bodies = rows.map((r) => r.body);
      for (const id of ["status", "url", "accounts", "tooling", "registry"]) {
        const row = smithery.rows.find((r) => r.id === id)!;
        expect(bodies, `${locale}:${id}`).toContain(row.them[locale]);
      }
      const all = bodies.join(" ");
      expect(all).toContain("run.tools");
      expect(all).toMatch(/CLI/);
      expect(all).toMatch(/registr/i);
    }
  });

  it("answers the shutdown FAQ with the comparison's full scope", () => {
    for (const locale of ["en", "fr"] as const) {
      const first = SMITHERY_MIGRATION_FAQ[locale][0];
      expect(first.a).toContain(smitheryShutdownScope(locale));
      expect(first.a).toMatch(/CLI/);
    }
  });

  it("does not repeat the false claims about URLs, keys and secrets", () => {
    expect(SOURCE).not.toMatch(/one URL and one API key per MCP/i);
    expect(SOURCE).not.toMatch(/une URL et une clé API par MCP/i);
    expect(SOURCE).not.toMatch(/One URL per MCP, not per server/i);
    expect(SOURCE).not.toMatch(/Une URL par MCP, pas par serveur/i);
    expect(SOURCE).not.toMatch(/belong to that server only/i);
    expect(SOURCE).not.toMatch(/n’appartiennent qu’à ce serveur/i);
    expect(SOURCE).not.toMatch(/about 70|environ 70/);
  });

  it("presents the server URL as the recommended connection", () => {
    expect(SOURCE).toContain("buildServerUrl(");
    expect(SOURCE).toMatch(/MCP-proxy key bound to\s+that server/);
    expect(SOURCE).toContain("{{secret:NAME}}");
  });
});
