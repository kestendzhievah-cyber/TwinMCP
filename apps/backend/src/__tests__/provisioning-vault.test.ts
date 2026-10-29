import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Contract D6 in provisioning: an MCP whose config references a missing vault
// secret is never started with the literal placeholder; the box log gets a
// "Missing secret NAME" line instead. Contract D5: status transitions emit
// server.status_changed.

const box = {
  exec: vi.fn(),
  writeFile: vi.fn(),
  exposePort: vi.fn(),
  unexposePort: vi.fn(),
};
vi.mock("@/lib/upstash/box-client", () => ({ getBoxClient: () => box }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
const { emitWebhookEvent } = vi.hoisted(() => ({ emitWebhookEvent: vi.fn() }));
vi.mock("@/lib/webhooks/emit", () => ({ emitWebhookEvent }));

const state: {
  install: Record<string, unknown> | null;
  secrets: Array<{ id: string; name: string; value: unknown }>;
  server: { userId: string; status: string } | null;
  claimWins: boolean;
  updates: Array<Record<string, unknown>>;
} = { install: null, secrets: [], server: null, claimWins: true, updates: [] };

function chain(result: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit", "innerJoin", "returning"]) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve().then(result).then(res, rej);
  return q;
}

vi.mock("@/db", () => ({
  getDb: () => ({
    select: (fields: Record<string, unknown>) => {
      if ("installCmd" in fields) return chain(() => (state.install ? [state.install] : []));
      if ("value" in fields) return chain(() => state.secrets);
      if ("status" in fields) return chain(() => (state.server ? [state.server] : []));
      return chain(() => []);
    },
    update: () => ({
      set: (values: Record<string, unknown>) => {
        state.updates.push(values);
        return chain(() => (state.claimWins ? [{ id: "srv_1" }] : []));
      },
    }),
  }),
}));

import { encryptConfig } from "@/lib/crypto/config-encryption";
import { claimProvision, installMcpInBox } from "@/lib/provisioning";

beforeAll(() => {
  process.env.CONFIG_ENCRYPTION_KEY = "22".repeat(32);
});

beforeEach(() => {
  vi.clearAllMocks();
  state.secrets = [];
  state.updates = [];
  state.server = null;
  state.claimWins = true;
  box.exec.mockResolvedValue({ status: "completed", result: "" });
});

function installRow(config: Record<string, unknown>) {
  const enc = encryptConfig(config);
  return {
    usId: "us_1",
    userId: "user_1",
    bridgePort: 8080,
    configCiphertext: enc.ciphertext,
    configIv: enc.iv,
    configTag: enc.tag,
    mcpSlug: "github",
    installCmd: "npm i -g gh-mcp",
    startCmd: "gh-mcp",
    serverId: "srv_1",
    serverBoxId: "box_1",
    serverStatus: "running",
  };
}

describe("installMcpInBox with vault references", () => {
  it("missing secret: nothing installed, a 'Missing secret NAME' log line instead", async () => {
    state.install = installRow({ GITHUB_TOKEN: "{{secret:GITHUB_TOKEN}}" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await installMcpInBox("us_1");
    warn.mockRestore();

    expect(box.exec).toHaveBeenCalledTimes(1);
    const cmd = String(box.exec.mock.calls[0][1]);
    expect(cmd).toContain("Missing secret GITHUB_TOKEN");
    expect(cmd).toContain(">> /tmp/mcp-github.log");
    expect(cmd).not.toContain("npm i");
    expect(box.writeFile).not.toHaveBeenCalled(); // no launcher written
    expect(state.updates).toHaveLength(0); // no endpoint persisted
  });

  it("resolved secret: the launcher gets the value, never the placeholder", async () => {
    state.install = installRow({ GITHUB_TOKEN: "{{secret:GITHUB_TOKEN}}" });
    state.secrets = [{ id: "s1", name: "GITHUB_TOKEN", value: encryptConfig("ghp_live") }];
    // Fail right after the launcher is written: enough to inspect it.
    box.writeFile.mockRejectedValueOnce(new Error("stop here"));

    await expect(installMcpInBox("us_1")).rejects.toThrow("stop here");

    const launcher = String(box.writeFile.mock.calls[0][2]);
    expect(launcher).toContain("export GITHUB_TOKEN='ghp_live'");
    expect(launcher).not.toContain("{{secret:");
  });
});

describe("status webhooks", () => {
  it("claimProvision emits server.status_changed from the previous status", async () => {
    state.server = { userId: "user_1", status: "error" };
    expect(await claimProvision("srv_1")).toBe(true);
    expect(emitWebhookEvent).toHaveBeenCalledWith("user_1", "server.status_changed", {
      serverId: "srv_1",
      from: "error",
      to: "provisioning",
    });
  });

  it("a lost claim emits nothing", async () => {
    state.server = { userId: "user_1", status: "running" };
    state.claimWins = false;
    expect(await claimProvision("srv_1")).toBe(false);
    expect(emitWebhookEvent).not.toHaveBeenCalled();
  });

  it("a throwing webhook emitter never breaks provisioning", async () => {
    state.server = { userId: "user_1", status: "stopped" };
    emitWebhookEvent.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await claimProvision("srv_1")).toBe(true);
    err.mockRestore();
  });
});
