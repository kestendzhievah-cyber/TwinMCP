// Per-key metadata for agencies (contract D6): an mcp_proxy key may carry the
// agency's own id for the end customer it was issued to (api_keys.external_user_id).
// The pure helpers validate it; getKeyExternalUserId lets the MCP proxy attach
// it to activity records (D1 recordToolCall) until AuthedContext.apiKey carries
// it directly (lib/auth.ts, OAUTH agent).
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema/core";
import type { KeyScope } from "@/lib/auth/key-scope";

export const EXTERNAL_USER_ID_MAX = 128;

// Printable text only: no control characters (they would corrupt CSV exports
// and log lines). Any other character is the agency's business.
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export type ExternalUserIdCheck =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

/**
 * Validate an optional externalUserId for a key of `scope`. Empty / absent →
 * null. Only mcp_proxy keys may carry one (a full key is the account itself).
 */
export function checkExternalUserId(raw: unknown, scope: KeyScope): ExternalUserIdCheck {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, message: "externalUserId must be a string." };
  const value = raw.trim();
  if (value === "") return { ok: true, value: null };
  if (value.length > EXTERNAL_USER_ID_MAX) {
    return {
      ok: false,
      message: `externalUserId must be at most ${EXTERNAL_USER_ID_MAX} characters.`,
    };
  }
  if (CONTROL_CHARS.test(value)) {
    return { ok: false, message: "externalUserId must not contain control characters." };
  }
  if (scope !== "mcp_proxy") {
    return { ok: false, message: 'externalUserId is only allowed with scope "mcp_proxy".' };
  }
  return { ok: true, value };
}

// Per-process cache (single-container assumption, like the auth cache). The
// value never changes after creation, so only deletion matters: a stale hit
// for a deleted key is harmless (the key no longer authenticates).
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 5000;
const cache = new Map<string, { value: string | null; exp: number }>();

/**
 * The externalUserId of an API key (null when none or unknown). Never throws:
 * meant for fire-and-forget activity logging off the proxy's hot path.
 */
export async function getKeyExternalUserId(
  keyId: string | null | undefined
): Promise<string | null> {
  if (!keyId) return null;
  const now = Date.now();
  const hit = cache.get(keyId);
  if (hit && hit.exp > now) return hit.value;
  try {
    const [row] = await getDb()
      .select({ externalUserId: apiKeys.externalUserId })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);
    const value = row?.externalUserId ?? null;
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(keyId, { value, exp: now + CACHE_TTL_MS });
    return value;
  } catch (err) {
    console.error("[vault/key-meta] externalUserId lookup failed:", err);
    return null;
  }
}

/** Test hook. */
export function _clearKeyMetaCache(): void {
  cache.clear();
}
