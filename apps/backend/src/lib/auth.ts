import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, users } from "@/db/schema";

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

export interface AuthedContext {
  userId: string;
  apiKeyId: string;
  plan: "free" | "pro" | "team";
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
  if (!raw.startsWith(API_KEY_PREFIX)) return null;

  const keyHash = hashKey(raw);
  const now = Date.now();
  const db = getDb();

  let entry = authCache.get(keyHash);
  if (!entry || now - entry.cachedAt > AUTH_CACHE_TTL_MS) {
    const rows = await db
      .select({
        apiKeyId: apiKeys.id,
        userId: apiKeys.userId,
        revokedAt: apiKeys.revokedAt,
        expiresAt: apiKeys.expiresAt,
        plan: users.plan,
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
      ctx: { userId: row.userId, apiKeyId: row.apiKeyId, plan: row.plan },
      revokedAt: row.revokedAt,
      expiresAt: row.expiresAt,
      cachedAt: now,
      lastUsedWrittenAt: entry?.lastUsedWrittenAt ?? 0,
    };
    authCache.set(keyHash, entry);
  }

  // Reject revoked / expired keys from the cached values — an expiry that isn't
  // enforced is not an expiry.
  if (entry.revokedAt || (entry.expiresAt && entry.expiresAt.getTime() < now)) {
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
