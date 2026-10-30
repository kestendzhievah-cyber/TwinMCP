import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema";
import { isKeyScope, isKeyUsable, type KeyScope } from "@/lib/auth/key-scope";
import { ACCESS_TOKEN_PREFIX, isOAuthEnabled, verifyAccessToken } from "@/lib/oauth";

// The proxy enforces a key's server binding with these (contract K1/K2).
export {
  keyAllowsManagement,
  keyAllowsServer,
  KEY_SCOPES,
  MANAGEMENT_SCOPE_MESSAGE,
  SERVER_SCOPE_MESSAGE,
  type KeyScope,
} from "@/lib/auth/key-scope";

export const API_KEY_PREFIX = "ctx7sk_";

export function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("hex"); // 48 chars
  const raw = `${API_KEY_PREFIX}${secret}`;
  const prefix = raw.slice(0, 12); // "ctx7sk_" + 5 chars — safe to show in UI
  return { raw, prefix, hash: hashKey(raw) };
}

/** The authenticating key: what it may reach (lib/auth/key-scope.ts). */
export interface AuthedApiKey {
  id: string;
  scope: KeyScope;
  /** mcp_proxy only: the one server the key may call (null = any). */
  serverId: string | null;
  /** Set when the key is being retired (rotation overlap) or has an expiry. */
  expiresAt: Date | null;
  /**
   * Agency sub-keys (contract D6): the end customer this key was issued for
   * (api_keys.external_user_id). Null for unlabelled keys and OAuth tokens.
   * Recorded on every tool call (D1) so the Activity page can attribute it.
   */
  externalUserId?: string | null;
  /**
   * OAuth only (RFC 8707 audience): the server slug the token was issued for,
   * null when it names none. keyAllowsServer refuses any other server path.
   */
  resourceServerSlug?: string | null;
}

export interface AuthedContext {
  userId: string;
  apiKeyId: string;
  /**
   * The key behind this request — always set by authenticateRequest; undefined
   * only for contexts built from a cookie session. For an OAuth access token
   * (contract D4) it is { id: <token id>, scope: "mcp_proxy", serverId: <bound
   * server or null> }, so management stays closed to connectors.
   * Gate the MCP proxy with keyAllowsServer(apiKey, serverId) and anything else
   * with keyAllowsManagement(apiKey).
   */
  apiKey?: AuthedApiKey;
  /**
   * How the request authenticated. "oauth": apiKeyId / apiKey.id is an
   * oauth_tokens.id, not an api_keys.id — don't write it into a column with a
   * foreign key to api_keys. Absent means an API key.
   */
  via?: "api_key" | "oauth";
  plan: "free" | "pro" | "team";
  /** users.stripe_customer_id present (the account has paid through Stripe before). */
  hasStripeCustomer: boolean;
}

// In-process auth cache. authenticateRequest runs on every MCP proxy / API-key
// request, and LLM tool loops hit the same key thousands of times. Cache the
// resolved key for a short TTL so repeat calls skip the DB round-trip. Trades
// revocation latency (≤ TTL) for far fewer auth queries — mitigated by
// clearAuthCache() on revoke for immediate effect. Per-process (single container).
interface AuthCacheEntry {
  ctx: AuthedContext;
  revokedAt: Date | null;
  expiresAt: Date | null;
  cachedAt: number;
  lastUsedWrittenAt: number;
}
const AUTH_CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS ?? 30_000);
const LAST_USED_THROTTLE_MS = 60_000;
const authCache = new Map<string, AuthCacheEntry>();

/** Drop cached auth (call on revoke so a revoked key stops working immediately). */
export function clearAuthCache(): void {
  authCache.clear();
}

export async function authenticateRequest(req: Request): Promise<AuthedContext | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice("Bearer ".length).trim();
  if (!raw.startsWith(API_KEY_PREFIX)) {
    // OAuth access token from a remote connector (lib/oauth.ts). Never reaches
    // the management API: always an mcp_proxy principal.
    if (raw.startsWith(ACCESS_TOKEN_PREFIX) && isOAuthEnabled()) return authenticateOAuth(raw);
    return null;
  }

  const keyHash = hashKey(raw);
  const now = Date.now();
  const db = getDb();

  let entry = authCache.get(keyHash);
  if (!entry || now - entry.cachedAt > AUTH_CACHE_TTL_MS) {
    const rows = await db
      .select({
        apiKeyId: apiKeys.id,
        userId: apiKeys.userId,
        scope: apiKeys.scope,
        serverId: apiKeys.serverId,
        revokedAt: apiKeys.revokedAt,
        expiresAt: apiKeys.expiresAt,
        externalUserId: apiKeys.externalUserId,
        plan: users.plan,
        stripeCustomerId: users.stripeCustomerId,
      })
      .from(apiKeys)
      .innerJoin(users, eq(users.id, apiKeys.userId))
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    const row = rows[0];
    if (!row) {
      authCache.delete(keyHash);
      return null;
    }
    entry = {
      ctx: {
        userId: row.userId,
        apiKeyId: row.apiKeyId,
        apiKey: {
          id: row.apiKeyId,
          // An unknown value (a future scope read by an older build) gets the
          // narrowest reach, never full access.
          scope: isKeyScope(row.scope) ? row.scope : "mcp_proxy",
          serverId: row.serverId ?? null,
          expiresAt: row.expiresAt ?? null,
          externalUserId: row.externalUserId ?? null,
        },
        plan: row.plan,
        hasStripeCustomer: Boolean(row.stripeCustomerId),
      },
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
      cachedAt: now,
      lastUsedWrittenAt: entry?.lastUsedWrittenAt ?? 0,
    };
    authCache.set(keyHash, entry);
  }

  // Reject revoked / expired keys from the cached values — an expiry that isn't
  // enforced is not an expiry.
  if (!isKeyUsable({ revokedAt: entry.revokedAt, expiresAt: entry.expiresAt }, now)) {
    return null;
  }

  // Throttled lastUsedAt write — a coarse display field, not needed per request.
  if (now - entry.lastUsedWrittenAt > LAST_USED_THROTTLE_MS) {
    entry.lastUsedWrittenAt = now;
    void db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, entry.ctx.apiKeyId))
      .catch(() => {});
  }

  return entry.ctx;
}

async function authenticateOAuth(raw: string): Promise<AuthedContext | null> {
  const p = await verifyAccessToken(raw);
  if (!p) return null;
  return {
    userId: p.userId,
    apiKeyId: p.tokenId,
    apiKey: {
      id: p.tokenId,
      scope: "mcp_proxy",
      serverId: p.serverId,
      expiresAt: p.accessExpiresAt,
      externalUserId: null,
      resourceServerSlug: p.resourceServerSlug,
    },
    via: "oauth",
    plan: p.plan,
    hasStripeCustomer: p.hasStripeCustomer,
  };
}
