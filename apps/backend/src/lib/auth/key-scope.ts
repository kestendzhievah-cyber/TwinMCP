// API-key scopes (contract K1). Pure helpers only — no DB, no Next imports — so
// the schema, the auth layer, the MCP proxy, the keys API and the dashboard can
// all share them, and they stay unit-testable.
//
//   full       the management API (servers, keys, billing…) + every MCP server
//              of the owner. What every key was before scopes existed.
//   mcp_proxy  only /api/mcp/<server>/<mcp>, optionally bound to one server.
//              The key that ends up in plain text in an IDE config file.

export const KEY_SCOPES = ["full", "mcp_proxy"] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];

export function isKeyScope(v: unknown): v is KeyScope {
  return typeof v === "string" && (KEY_SCOPES as readonly string[]).includes(v);
}

/**
 * May this key call an MCP on `serverId` (through the MCP proxy)? With
 * `serverSlug`, an OAuth token's audience (`resourceServerSlug`, RFC 8707) must
 * match too: a token minted for /api/mcp/A is refused on /api/mcp/B even when
 * the user granted "all my servers".
 */
export function keyAllowsServer(
  key: { scope: KeyScope; serverId: string | null; resourceServerSlug?: string | null },
  serverId: string,
  serverSlug?: string
): boolean {
  if (key.scope === "full") return true;
  if (key.scope !== "mcp_proxy") return false; // unknown scope → deny
  if (key.serverId !== null && key.serverId !== serverId) return false;
  if (key.resourceServerSlug && serverSlug !== undefined && key.resourceServerSlug !== serverSlug) {
    return false;
  }
  return true;
}

/** May this key use the management API (anything outside the MCP proxy)? */
export function keyAllowsManagement(key: { scope: KeyScope }): boolean {
  return key.scope === "full";
}

/**
 * May this key create, rotate or revoke API keys? Only a full key with no
 * expiry: a key being retired (rotation overlap) must not be able to mint a
 * permanent replacement for whoever holds it, nor revoke its successor.
 */
export function keyMayManageKeys(key: { scope: KeyScope; expiresAt?: Date | null }): boolean {
  return keyAllowsManagement(key) && !key.expiresAt;
}

/** The 403 message for a retiring key on a key-management route. */
export const RETIRING_KEY_MESSAGE =
  "This key is being retired; use its replacement (or sign in to the dashboard) to manage API keys.";

/** The 403 body message for an mcp_proxy key on a management route. */
export const MANAGEMENT_SCOPE_MESSAGE =
  "This key can only call MCP servers. Create a full-access key in the dashboard to use the management API.";

/** The proxy's 403 message for a key bound to another server (contract K2). */
export const SERVER_SCOPE_MESSAGE = "This API key is restricted to another server.";

/**
 * Rotation overlap: the replaced key keeps working this long after a rotation,
 * so configs can be updated without an outage. Revoke is still immediate.
 */
export const ROTATION_OVERLAP_MS = 24 * 60 * 60 * 1000;

/** When a key replaced at `now` stops working. */
export function rotationExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + ROTATION_OVERLAP_MS);
}

/** Usable right now: not revoked and not past its expiry. */
export function isKeyUsable(
  key: { revokedAt: Date | null; expiresAt: Date | null },
  now: number = Date.now()
): boolean {
  if (key.revokedAt) return false;
  return !key.expiresAt || key.expiresAt.getTime() > now;
}

/**
 * Does the key count against the plan's API-key allowance? A usable key does,
 * unless it is a replaced key in its rotation overlap (it expires within the
 * window), so rotating never pushes an account over its limit.
 */
export function countsTowardKeyLimit(
  key: { revokedAt: Date | null; expiresAt: Date | null },
  now: number = Date.now()
): boolean {
  if (!isKeyUsable(key, now)) return false;
  return !key.expiresAt || key.expiresAt.getTime() > now + ROTATION_OVERLAP_MS;
}

/**
 * Dashboard / API label for a key's reach: "Full access", "Proxy · <server>",
 * or "Proxy · all servers" for an unbound proxy key.
 */
export function keyScopeLabel(key: { scope: KeyScope; serverName?: string | null }): string {
  if (key.scope === "full") return "Full access";
  return `Proxy · ${key.serverName?.trim() || "all servers"}`;
}

/**
 * Pick the key to reuse when connecting a client to `serverId`: an mcp_proxy
 * key bound to that server first, then an unbound proxy key. A full-access key
 * is never offered — it would end up in plain text in an IDE config. Revoked /
 * expired / rotating-out keys are skipped. Returns undefined when nothing fits
 * (the caller mints a new bound key).
 */
export function pickKeyForServer<
  K extends {
    scope: KeyScope;
    serverId: string | null;
    revokedAt?: Date | null;
    expiresAt?: Date | string | null;
  },
>(keys: readonly K[], serverId: string, now: number = Date.now()): K | undefined {
  const live = keys.filter((k) => {
    if (k.revokedAt) return false;
    if (!k.expiresAt) return true;
    const t = new Date(k.expiresAt).getTime();
    return t > now + ROTATION_OVERLAP_MS;
  });
  return (
    live.find((k) => k.scope === "mcp_proxy" && k.serverId === serverId) ??
    live.find((k) => k.scope === "mcp_proxy" && k.serverId === null)
  );
}

/** Default name for a key minted from a connect flow: "<server> · <ide>". */
export function connectKeyName(serverName: string, ide: string): string {
  return `${serverName.trim() || "Server"} · ${ide.trim() || "MCP client"}`.slice(0, 80);
}
