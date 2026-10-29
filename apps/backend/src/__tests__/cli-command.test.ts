import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { CLI_PACKAGE, cliCommand, localAgentCommand } from "../lib/cli";

const ROOT = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** A line that is only a comment (`//`, `/*`, ` *`, or a JSX `{/* … *\/}`). */
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|\{\/\*)/;

describe("lib/cli", () => {
  it("defaults to the @twinmcp/cli package", () => {
    expect(CLI_PACKAGE).toBe("@twinmcp/cli");
  });

  it("builds the local-agent command with the CLI's connect flags", () => {
    expect(localAgentCommand("my-server")).toBe("npx -y @twinmcp/cli connect --server my-server");
    expect(localAgentCommand("my-server", "ctx7sk_abc")).toBe(
      "npx -y @twinmcp/cli connect --server my-server --key ctx7sk_abc"
    );
    expect(localAgentCommand("my-server", null)).toBe(
      "npx -y @twinmcp/cli connect --server my-server"
    );
  });

  it("drops empty arguments", () => {
    expect(cliCommand("servers", "", undefined, null, false, "list")).toBe(
      "npx -y @twinmcp/cli servers list"
    );
    expect(cliCommand()).toBe("npx -y @twinmcp/cli");
  });

  it("honours NEXT_PUBLIC_TWINMCP_CLI_PACKAGE", async () => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_TWINMCP_CLI_PACKAGE", " @twinmcp/cli@0.4.0 ");
    try {
      const mod = await import("../lib/cli");
      expect(mod.localAgentCommand("s")).toBe("npx -y @twinmcp/cli@0.4.0 connect --server s");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

// `npx ctx7` installs Upstash's Context7 CLI, which has no `connect` command.
// Every printed command goes through lib/cli.ts; comments may still name it.
describe("no hard-coded ctx7 command", () => {
  it("is printed anywhere in the app", () => {
    const STALE = /npx ctx7\b|ctx7 connect/;
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (STALE.test(line) && !COMMENT_LINE.test(line)) {
          offenders.push(`${relative(ROOT, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
