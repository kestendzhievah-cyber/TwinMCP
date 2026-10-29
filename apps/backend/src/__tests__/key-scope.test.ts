import { describe, expect, it } from "vitest";
import {
  connectKeyName,
  countsTowardKeyLimit,
  isKeyScope,
  isKeyUsable,
  KEY_SCOPES,
  keyAllowsManagement,
  keyAllowsServer,
  keyScopeLabel,
  MANAGEMENT_SCOPE_MESSAGE,
  pickKeyForServer,
  ROTATION_OVERLAP_MS,
  rotationExpiry,
  SERVER_SCOPE_MESSAGE,
  type KeyScope,
  keyMayManageKeys,
  RETIRING_KEY_MESSAGE,
} from "@/lib/auth/key-scope";

const HOUR = 3_600_000;

describe("KEY_SCOPES / isKeyScope", () => {
  it("lists exactly the two scopes", () => {
    expect([...KEY_SCOPES]).toEqual(["full", "mcp_proxy"]);
  });
  it("accepts known scopes only", () => {
    expect(isKeyScope("full")).toBe(true);
    expect(isKeyScope("mcp_proxy")).toBe(true);
    expect(isKeyScope("admin")).toBe(false);
    expect(isKeyScope(undefined)).toBe(false);
    expect(isKeyScope(1)).toBe(false);
  });
});

describe("keyAllowsServer", () => {
  it("full key reaches every server", () => {
    expect(keyAllowsServer({ scope: "full", serverId: null }, "srv_a")).toBe(true);
    // A full key with a stray serverId is still full.
    expect(keyAllowsServer({ scope: "full", serverId: "srv_b" }, "srv_a")).toBe(true);
  });
  it("unbound mcp_proxy key reaches every server", () => {
    expect(keyAllowsServer({ scope: "mcp_proxy", serverId: null }, "srv_a")).toBe(true);
  });
  it("bound mcp_proxy key reaches only its server", () => {
    expect(keyAllowsServer({ scope: "mcp_proxy", serverId: "srv_a" }, "srv_a")).toBe(true);
    expect(keyAllowsServer({ scope: "mcp_proxy", serverId: "srv_a" }, "srv_b")).toBe(false);
  });
  it("denies an unknown scope", () => {
    expect(keyAllowsServer({ scope: "weird" as KeyScope, serverId: null }, "srv_a")).toBe(false);
  });
});

describe("keyAllowsManagement", () => {
  it("only full keys may use the management API", () => {
    expect(keyAllowsManagement({ scope: "full" })).toBe(true);
    expect(keyAllowsManagement({ scope: "mcp_proxy" })).toBe(false);
    expect(keyAllowsManagement({ scope: "weird" as KeyScope })).toBe(false);
  });
});

describe("messages", () => {
  it("match the contract wording", () => {
    expect(MANAGEMENT_SCOPE_MESSAGE).toBe(
      "This key can only call MCP servers. Create a full-access key in the dashboard to use the management API."
    );
    expect(SERVER_SCOPE_MESSAGE).toBe("This API key is restricted to another server.");
  });
});

describe("rotation / usability", () => {
  const now = Date.UTC(2026, 9, 27, 12, 0, 0);

  it("rotationExpiry is now + 24 h", () => {
    expect(ROTATION_OVERLAP_MS).toBe(24 * HOUR);
    expect(rotationExpiry(new Date(now)).getTime()).toBe(now + 24 * HOUR);
  });

  it("isKeyUsable rejects revoked and expired keys", () => {
    expect(isKeyUsable({ revokedAt: null, expiresAt: null }, now)).toBe(true);
    expect(isKeyUsable({ revokedAt: new Date(now - 1), expiresAt: null }, now)).toBe(false);
    expect(isKeyUsable({ revokedAt: null, expiresAt: new Date(now + 1) }, now)).toBe(true);
    expect(isKeyUsable({ revokedAt: null, expiresAt: new Date(now) }, now)).toBe(false);
    expect(isKeyUsable({ revokedAt: null, expiresAt: new Date(now - HOUR) }, now)).toBe(false);
  });

  it("a key in its rotation overlap works but frees its plan slot", () => {
    const retiring = { revokedAt: null, expiresAt: rotationExpiry(new Date(now)) };
    expect(isKeyUsable(retiring, now)).toBe(true);
    expect(countsTowardKeyLimit(retiring, now)).toBe(false);
  });

  it("counts plain and far-future-expiry keys, not dead ones", () => {
    expect(countsTowardKeyLimit({ revokedAt: null, expiresAt: null }, now)).toBe(true);
    expect(
      countsTowardKeyLimit({ revokedAt: null, expiresAt: new Date(now + 30 * 24 * HOUR) }, now)
    ).toBe(true);
    expect(countsTowardKeyLimit({ revokedAt: new Date(now), expiresAt: null }, now)).toBe(false);
    expect(countsTowardKeyLimit({ revokedAt: null, expiresAt: new Date(now - 1) }, now)).toBe(
      false
    );
  });
});

describe("keyScopeLabel", () => {
  it("labels full and proxy keys", () => {
    expect(keyScopeLabel({ scope: "full" })).toBe("Full access");
    expect(keyScopeLabel({ scope: "full", serverName: "prod" })).toBe("Full access");
    expect(keyScopeLabel({ scope: "mcp_proxy", serverName: "prod" })).toBe("Proxy · prod");
    expect(keyScopeLabel({ scope: "mcp_proxy", serverName: null })).toBe("Proxy · all servers");
    expect(keyScopeLabel({ scope: "mcp_proxy", serverName: "  " })).toBe("Proxy · all servers");
  });
});

describe("pickKeyForServer", () => {
  const now = Date.UTC(2026, 9, 27, 12, 0, 0);
  const full = { id: "k_full", scope: "full" as const, serverId: null };
  const anyProxy = { id: "k_any", scope: "mcp_proxy" as const, serverId: null };
  const boundA = { id: "k_a", scope: "mcp_proxy" as const, serverId: "srv_a" };
  const boundB = { id: "k_b", scope: "mcp_proxy" as const, serverId: "srv_b" };

  it("prefers a proxy key bound to this server", () => {
    expect(pickKeyForServer([full, anyProxy, boundB, boundA], "srv_a", now)?.id).toBe("k_a");
  });
  it("falls back to an unbound proxy key", () => {
    expect(pickKeyForServer([full, boundB, anyProxy], "srv_a", now)?.id).toBe("k_any");
  });
  it("never offers a full-access key or another server's key", () => {
    expect(pickKeyForServer([full, boundB], "srv_a", now)).toBeUndefined();
    expect(pickKeyForServer([], "srv_a", now)).toBeUndefined();
  });
  it("skips revoked, expired and rotating-out keys", () => {
    const revoked = { ...boundA, id: "k_rev", revokedAt: new Date(now - HOUR) };
    const retiring = { ...boundA, id: "k_ret", expiresAt: new Date(now + HOUR).toISOString() };
    const expired = { ...boundA, id: "k_exp", expiresAt: new Date(now - HOUR) };
    expect(pickKeyForServer([revoked, retiring, expired], "srv_a", now)).toBeUndefined();
    expect(pickKeyForServer([retiring, boundA], "srv_a", now)?.id).toBe("k_a");
  });
});

describe("connectKeyName", () => {
  it("formats '<server> · <ide>' within 80 chars", () => {
    expect(connectKeyName("prod", "Cursor")).toBe("prod · Cursor");
    expect(connectKeyName("  ", "")).toBe("Server · MCP client");
    expect(connectKeyName("x".repeat(100), "Cursor")).toHaveLength(80);
  });
});

describe("keyMayManageKeys — a retiring key cannot mint its own successor", () => {
  it("only a full key without an expiry", () => {
    expect(keyMayManageKeys({ scope: "full", expiresAt: null })).toBe(true);
    expect(keyMayManageKeys({ scope: "full" })).toBe(true);
    expect(keyMayManageKeys({ scope: "full", expiresAt: new Date(Date.now() + 3600_000) })).toBe(
      false
    );
    expect(keyMayManageKeys({ scope: "mcp_proxy", expiresAt: null })).toBe(false);
    expect(RETIRING_KEY_MESSAGE).toMatch(/replacement/);
  });
});
